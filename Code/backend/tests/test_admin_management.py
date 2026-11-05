"""
Admin RBAC, Statistics & Account Moderation Security Tests (EPIC 14: PDFL-188, PDFL-189, PDFL-194, PDFL-197, PDFL-198)
------------------------------------------------------------------------------------------------------------------------
Verifies:
- All `/api/admin/*` endpoints strictly require authentication (401 for unauthenticated/invalid tokens).
- Role-Based Access Control (RBAC): Regular free and pro accounts cannot access admin endpoints (403 Forbidden).
- Admin users can retrieve system statistics with accurate metric aggregates (PDFL-188).
- Admin users can query user directory with pagination, search, and role/status filtering (PDFL-189).
- Admin users can suspend/lock and reactivate user accounts (PDFL-194).
- Suspended accounts are immediately rejected with 403 ACCOUNT_INACTIVE on subsequent requests.
- Safety Guardrails: Administrators cannot suspend or demote their own account (PDFL-197).
- Operating on non-existent user IDs gracefully returns 404 Not Found.
"""

from datetime import datetime, timezone

import pytest
from app.core.database import Base
from app.core.dependencies import get_db
from app.core.security import create_access_token
from app.main import app
from app.models.document import Document
from app.models.user import User, UserRole
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

client = TestClient(app)


# ── Test Environment Fixtures ────────────────────────────────────────────────

@pytest.fixture
def admin_test_env():
    """
    Setup an isolated in-memory SQLite database populated with a multi-role user set
    and sample documents to verify all admin features without external side-effects.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    session = TestingSessionLocal()

    # Seed Users
    admin_user = User(
        email="superadmin@example.com",
        hashed_password="pw_admin_hash",
        full_name="Quản Trị Viên",
        role=UserRole.ADMIN,
        is_active=True,
    )
    free_user = User(
        email="free_user@example.com",
        hashed_password="pw_free_hash",
        full_name="Nguyễn Văn Free",
        role=UserRole.FREE,
        is_active=True,
    )
    pro_user = User(
        email="pro_vip@example.com",
        hashed_password="pw_pro_hash",
        full_name="Trần Thị Pro",
        role=UserRole.PRO,
        is_active=True,
    )
    locked_user = User(
        email="locked_user@example.com",
        hashed_password="pw_locked_hash",
        full_name="Lê Văn Khóa",
        role=UserRole.FREE,
        is_active=False,
    )

    session.add_all([admin_user, free_user, pro_user, locked_user])
    session.commit()
    session.refresh(admin_user)
    session.refresh(free_user)
    session.refresh(pro_user)
    session.refresh(locked_user)

    # Seed Documents
    doc1 = Document(
        user_id=free_user.id,
        original_filename="Tài liệu free.pdf",
        stored_filename="doc_uuid_1.pdf",
        stored_path="users/free/doc_uuid_1.pdf",
        file_size_bytes=1024,
        page_count=2,
        target_lang="vi",
        created_at=datetime.now(timezone.utc),
    )
    doc2 = Document(
        user_id=pro_user.id,
        original_filename="Tài liệu pro.pdf",
        stored_filename="doc_uuid_2.pdf",
        stored_path="users/pro/doc_uuid_2.pdf",
        file_size_bytes=4096,
        page_count=5,
        target_lang="en",
        created_at=datetime.now(timezone.utc),
    )
    session.add_all([doc1, doc2])
    session.commit()

    # Generate Access Tokens
    admin_token = create_access_token(subject=admin_user.id)
    free_token = create_access_token(subject=free_user.id)
    pro_token = create_access_token(subject=pro_user.id)
    locked_token = create_access_token(subject=locked_user.id)

    yield {
        "session": session,
        "admin": admin_user,
        "free": free_user,
        "pro": pro_user,
        "locked": locked_user,
        "admin_token": admin_token,
        "free_token": free_token,
        "pro_token": pro_token,
        "locked_token": locked_token,
    }

    app.dependency_overrides.clear()
    session.close()
    Base.metadata.drop_all(bind=engine)


# ==============================================================================
# RBAC Gatekeeper Tests: 401 & 403 Enforcement (PDFL-198)
# ==============================================================================

def test_admin_stats_unauthenticated_returns_401(admin_test_env):
    """Guest requests without token must be rejected with 401."""
    res = client.get("/api/admin/stats")
    assert res.status_code == 401
    assert res.json()["error_code"] == "NOT_AUTHENTICATED"


def test_admin_stats_invalid_token_returns_401(admin_test_env):
    """Requests with malformed or tampered token must be rejected with 401."""
    res = client.get("/api/admin/stats", headers={"Authorization": "Bearer invalid_malformed_token"})
    assert res.status_code == 401


def test_admin_stats_free_user_returns_403(admin_test_env):
    """Regular free users cannot access administrative endpoints (403 Forbidden)."""
    headers = {"Authorization": f"Bearer {admin_test_env['free_token']}"}
    res = client.get("/api/admin/stats", headers=headers)
    assert res.status_code == 403
    assert res.json()["error_code"] == "FORBIDDEN"


def test_admin_stats_pro_user_returns_403(admin_test_env):
    """Pro tier users cannot access administrative endpoints (403 Forbidden)."""
    headers = {"Authorization": f"Bearer {admin_test_env['pro_token']}"}
    res = client.get("/api/admin/stats", headers=headers)
    assert res.status_code == 403
    assert res.json()["error_code"] == "FORBIDDEN"


def test_admin_list_users_non_admin_returns_403(admin_test_env):
    """Non-admin accounts cannot query the user management directory."""
    headers = {"Authorization": f"Bearer {admin_test_env['free_token']}"}
    res = client.get("/api/admin/users", headers=headers)
    assert res.status_code == 403


# ==============================================================================
# System Overview Stats Tests (PDFL-188)
# ==============================================================================

def test_admin_stats_returns_accurate_metrics(admin_test_env):
    """Admin successfully retrieves system metrics and aggregates."""
    headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}
    res = client.get("/api/admin/stats", headers=headers)
    assert res.status_code == 200

    data = res.json()["data"]
    assert data["total_users"] == 4
    assert data["active_users"] == 3
    assert data["locked_users"] == 1
    assert data["free_users"] == 2
    assert data["pro_users"] == 1
    assert data["admin_users"] == 1
    assert data["total_documents"] == 2
    assert data["total_storage_bytes"] == 1024 + 4096


# ==============================================================================
# User Management Directory & Filtering Tests (PDFL-189)
# ==============================================================================

def test_admin_list_users_pagination(admin_test_env):
    """Admin lists users with custom page limit and pagination metadata."""
    headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}
    res = client.get("/api/admin/users?page=1&limit=2", headers=headers)
    assert res.status_code == 200

    data = res.json()["data"]
    assert data["total_count"] == 4
    assert data["total_pages"] == 2
    assert data["page"] == 1
    assert data["limit"] == 2
    assert len(data["items"]) == 2


def test_admin_list_users_search_filter(admin_test_env):
    """Admin searches user by email or full name substring."""
    headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}

    # Search by full name keyword
    res = client.get("/api/admin/users?search=Nguyễn", headers=headers)
    assert res.status_code == 200
    items = res.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["email"] == "free_user@example.com"

    # Search non-matching term
    res_empty = client.get("/api/admin/users?search=unknown_none_existent", headers=headers)
    assert res_empty.status_code == 200
    assert len(res_empty.json()["data"]["items"]) == 0


def test_admin_list_users_role_filter(admin_test_env):
    """Admin filters user directory by role tier."""
    headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}

    res_pro = client.get("/api/admin/users?role=pro", headers=headers)
    assert res_pro.status_code == 200
    items = res_pro.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["role"] == "pro"


def test_admin_list_users_status_filter(admin_test_env):
    """Admin filters user directory by active/locked status."""
    headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}

    res_locked = client.get("/api/admin/users?is_active=false", headers=headers)
    assert res_locked.status_code == 200
    items = res_locked.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["email"] == "locked_user@example.com"
    assert items[0]["is_active"] is False


# ==============================================================================
# Account Lock / Unlock Moderation Tests (PDFL-194)
# ==============================================================================

def test_admin_lock_and_unlock_account_lifecycle(admin_test_env):
    """Admin suspends an active account, verifies immediate lockout, then reactivates."""
    headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}
    target_id = admin_test_env["free"].id

    # 1. Admin suspends account
    res_lock = client.patch(f"/api/admin/users/{target_id}/status", json={"is_active": False}, headers=headers)
    assert res_lock.status_code == 200
    assert res_lock.json()["data"]["is_active"] is False

    # 2. Suspended user's token is immediately rejected on protected routes
    free_headers = {"Authorization": f"Bearer {admin_test_env['free_token']}"}
    res_me = client.get("/api/auth/me", headers=free_headers)
    assert res_me.status_code == 403
    assert res_me.json()["error_code"] == "ACCOUNT_INACTIVE"

    # 3. Admin reactivates account
    res_unlock = client.patch(f"/api/admin/users/{target_id}/status", json={"is_active": True}, headers=headers)
    assert res_unlock.status_code == 200
    assert res_unlock.json()["data"]["is_active"] is True

    # 4. Reactivated user can access protected routes again
    res_me_active = client.get("/api/auth/me", headers=free_headers)
    assert res_me_active.status_code == 200
    assert res_me_active.json()["data"]["email"] == "free_user@example.com"


def test_admin_cannot_lock_own_account(admin_test_env):
    """Admin cannot suspend/lock their own account (safety guardrail)."""
    headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}
    admin_id = admin_test_env["admin"].id

    res = client.patch(f"/api/admin/users/{admin_id}/status", json={"is_active": False}, headers=headers)
    assert res.status_code == 400
    assert res.json()["error_code"] == "CANNOT_LOCK_SELF"


# ==============================================================================
# Role Elevation & Demotion Tests (PDFL-197)
# ==============================================================================

def test_admin_update_user_role_success(admin_test_env):
    """Admin elevates a free user to Pro VIP tier."""
    headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}
    target_id = admin_test_env["free"].id

    res = client.patch(f"/api/admin/users/{target_id}/role", json={"role": "pro"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["data"]["role"] == "pro"


def test_admin_cannot_demote_own_role(admin_test_env):
    """Admin cannot demote their own account from admin tier (safety guardrail)."""
    headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}
    admin_id = admin_test_env["admin"].id

    res = client.patch(f"/api/admin/users/{admin_id}/role", json={"role": "free"}, headers=headers)
    assert res.status_code == 400
    assert res.json()["error_code"] == "CANNOT_DEMOTE_SELF"


# ==============================================================================
# Not Found Handling Tests
# ==============================================================================

def test_admin_operations_on_nonexistent_user_returns_404(admin_test_env):
    """Updating status or role of a non-existent user ID returns 404 Not Found."""
    headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}
    non_existent_id = 99999

    res_status = client.patch(f"/api/admin/users/{non_existent_id}/status", json={"is_active": False}, headers=headers)
    assert res_status.status_code == 404
    assert res_status.json()["error_code"] == "NOT_FOUND"

    res_role = client.patch(f"/api/admin/users/{non_existent_id}/role", json={"role": "pro"}, headers=headers)
    assert res_role.status_code == 404
    assert res_role.json()["error_code"] == "NOT_FOUND"
