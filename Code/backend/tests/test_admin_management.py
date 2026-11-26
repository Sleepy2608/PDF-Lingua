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


# ── Admin VietQR Transaction Management ──────────────────────────────────


def test_admin_transactions_list_approve_and_reject(admin_test_env):
    from app.models.subscription import PaymentMethod, PaymentStatus, PaymentTransaction
    from app.services.subscription_service import SubscriptionService

    db_session = admin_test_env["session"]
    free_user = admin_test_env["free"]
    admin_headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}
    free_headers = {"Authorization": f"Bearer {admin_test_env['free_token']}"}

    plans = SubscriptionService.ensure_plans_seeded(db_session)
    monthly_plan = plans["pro_monthly"]

    tx_pending = PaymentTransaction(
        transaction_code="TX-ADMIN-TEST-001",
        user_id=free_user.id,
        plan_id=monthly_plan.id,
        amount_vnd=monthly_plan.price_vnd,
        payment_method=PaymentMethod.VIETQR.value,
        payment_status=PaymentStatus.PENDING.value,
        payment_note="PDFLINGUA TXADMINTEST001",
    )
    tx_reject = PaymentTransaction(
        transaction_code="TX-ADMIN-TEST-002",
        user_id=free_user.id,
        plan_id=monthly_plan.id,
        amount_vnd=monthly_plan.price_vnd,
        payment_method=PaymentMethod.VIETQR.value,
        payment_status=PaymentStatus.PENDING.value,
        payment_note="PDFLINGUA TXADMINTEST002",
    )
    db_session.add(tx_pending)
    db_session.add(tx_reject)
    db_session.commit()

    # 1. Non-admin forbidden
    res_forbidden = client.get("/api/admin/transactions", headers=free_headers)
    assert res_forbidden.status_code == 403

    # 2. Admin lists transactions
    res_list = client.get("/api/admin/transactions?status=pending", headers=admin_headers)
    assert res_list.status_code == 200
    data = res_list.json()["data"]
    assert data["pending_count"] >= 2
    codes = [item["transaction_code"] for item in data["items"]]
    assert "TX-ADMIN-TEST-001" in codes
    assert "TX-ADMIN-TEST-002" in codes

    # 3. Admin approves tx_pending -> upgrades free_user to PRO
    res_approve = client.post(
        "/api/admin/transactions/TX-ADMIN-TEST-001/approve",
        headers=admin_headers,
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["data"]["payment_status"] == "completed"

    db_session.refresh(free_user)
    assert free_user.role == UserRole.PRO

    # 4. Admin rejects tx_reject -> status becomes failed
    res_reject = client.post(
        "/api/admin/transactions/TX-ADMIN-TEST-002/reject",
        headers=admin_headers,
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["data"]["payment_status"] == "failed"

    # 5. Revenue summary updated
    res_completed = client.get("/api/admin/transactions?status=completed", headers=admin_headers)
    assert res_completed.status_code == 200
    assert res_completed.json()["data"]["total_revenue_vnd"] >= monthly_plan.price_vnd


# ── User Access Logs & Multi-IP Anomaly Detection ────────────────────────


def test_network_ip_extraction_and_device_summary():
    from types import SimpleNamespace

    from app.core.network import extract_client_ip, parse_device_summary

    req_xff = SimpleNamespace(
        headers={"x-forwarded-for": "203.0.113.42, 10.0.0.1, 172.16.0.2"},
        client=SimpleNamespace(host="127.0.0.1"),
    )
    assert extract_client_ip(req_xff) == "203.0.113.42"

    req_real_ip = SimpleNamespace(
        headers={"x-real-ip": "198.51.100.88"},
        client=SimpleNamespace(host="127.0.0.1"),
    )
    assert extract_client_ip(req_real_ip) == "198.51.100.88"

    req_direct = SimpleNamespace(
        headers={},
        client=SimpleNamespace(host="192.0.2.5"),
    )
    assert extract_client_ip(req_direct) == "192.0.2.5"

    assert parse_device_summary("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0") == "Chrome / Windows"
    assert parse_device_summary("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1") == "Safari / iOS"


def test_admin_access_logs_and_multi_ip_warning(admin_test_env):
    from app.core.security import hash_password
    from app.models.access_log import UserAccessLog

    db_session = admin_test_env["session"]
    pro_user = admin_test_env["pro"]
    free_user = admin_test_env["free"]
    admin_headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}
    free_headers = {"Authorization": f"Bearer {admin_test_env['free_token']}"}

    # Give pro_user a known password to exercise live /api/auth/login tracking
    pro_user.hashed_password = hash_password("StrongPass123!")
    db_session.commit()

    # Login from 3 distinct IPs via X-Forwarded-For
    ips_and_uas = [
        ("203.0.113.10, 10.0.0.1", "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0"),
        ("198.51.100.20", "Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1.15"),
        ("192.0.2.30", "Mozilla/5.0 (Linux; Android 14) Chrome/121.0.0.0"),
    ]
    for ip_hdr, ua in ips_and_uas:
        login_res = client.post(
            "/api/auth/login",
            json={"email": pro_user.email, "password": "StrongPass123!"},
            headers={"X-Forwarded-For": ip_hdr, "User-Agent": ua},
        )
        assert login_res.status_code == 200

    # 1. Non-admin forbidden on /api/admin/access-logs
    res_forbidden = client.get("/api/admin/access-logs", headers=free_headers)
    assert res_forbidden.status_code == 403

    # 2. Verify /api/admin/users returns last_ip & multi_ip_warning for pro_user
    res_users = client.get(f"/api/admin/users?search={pro_user.email}", headers=admin_headers)
    assert res_users.status_code == 200
    user_item = res_users.json()["data"]["items"][0]
    assert user_item["last_ip"] == "192.0.2.30"
    assert user_item["last_device"] == "Chrome / Android"
    assert user_item["distinct_ip_count_24h"] == 3
    assert user_item["multi_ip_warning"] is True

    # 3. Verify /api/admin/access-logs returns logs, unique_ips_24h, and filters cleanly
    res_logs = client.get(
        f"/api/admin/access-logs?user_id={pro_user.id}&multi_ip_only=true",
        headers=admin_headers,
    )
    assert res_logs.status_code == 200
    log_data = res_logs.json()["data"]
    assert log_data["total_count"] == 3
    assert log_data["unique_ips_24h"] >= 3
    assert log_data["multi_ip_users_count"] >= 1
    assert [item["ip_address"] for item in log_data["items"]] == [
        "192.0.2.30",
        "198.51.100.20",
        "203.0.113.10",
    ]

    # 4. Search by specific IP returns exact log
    res_ip_search = client.get("/api/admin/access-logs?search=198.51.100.20", headers=admin_headers)
    assert res_ip_search.status_code == 200
    assert res_ip_search.json()["data"]["total_count"] == 1
    assert res_ip_search.json()["data"]["items"][0]["device_summary"] == "Safari / macOS"

    # Ensure free_user has no logs yet
    assert db_session.query(UserAccessLog).filter(UserAccessLog.user_id == free_user.id).count() == 0


def test_admin_access_traffic_unique_ip_series(admin_test_env):
    """Verify 14-day GitHub-Traffic-style daily & overall distinct-IP visitor counting."""
    from datetime import datetime, timedelta, timezone

    from app.models.access_log import UserAccessLog

    db_session = admin_test_env["session"]
    pro_user = admin_test_env["pro"]
    free_user = admin_test_env["free"]
    admin_headers = {"Authorization": f"Bearer {admin_test_env['admin_token']}"}

    now_utc = datetime.now(timezone.utc)
    today_dt = datetime(now_utc.year, now_utc.month, now_utc.day, 9, 0, tzinfo=timezone.utc)
    yesterday_dt = today_dt - timedelta(days=1)
    stale_dt = today_dt - timedelta(days=20)

    db_session.add_all(
        [
            # Today: 3 visits across 2 distinct IPs (203.0.113.10 appears twice)
            UserAccessLog(user_id=pro_user.id, ip_address="203.0.113.10", action="login", created_at=today_dt),
            UserAccessLog(
                user_id=free_user.id,
                ip_address="203.0.113.10",
                action="login",
                created_at=today_dt + timedelta(hours=1),
            ),
            UserAccessLog(
                user_id=pro_user.id,
                ip_address="198.51.100.20",
                action="login",
                created_at=today_dt + timedelta(hours=2),
            ),
            # Yesterday: 2 visits sharing 203.0.113.10 again + 1 new IP (192.0.2.30)
            UserAccessLog(user_id=pro_user.id, ip_address="203.0.113.10", action="login", created_at=yesterday_dt),
            UserAccessLog(
                user_id=free_user.id,
                ip_address="192.0.2.30",
                action="register",
                created_at=yesterday_dt + timedelta(minutes=30),
            ),
            # Outside 14-day window: must be excluded
            UserAccessLog(user_id=free_user.id, ip_address="192.0.2.99", action="login", created_at=stale_dt),
        ]
    )
    db_session.commit()

    res = client.get("/api/admin/access-logs", headers=admin_headers)
    assert res.status_code == 200
    traffic = res.json()["data"]["traffic"]

    assert traffic["window_days"] == 14
    assert len(traffic["daily"]) == 14
    assert traffic["total_visits"] == 5
    # Distinct across the 14-day window: 203.0.113.10, 198.51.100.20, 192.0.2.30 -> 3 (not 4, excludes 192.0.2.99)
    assert traffic["unique_visitors"] == 3

    by_date = {pt["date"]: pt for pt in traffic["daily"]}
    today_key = today_dt.date().isoformat()
    yesterday_key = yesterday_dt.date().isoformat()

    assert by_date[today_key] == {"date": today_key, "total_visits": 3, "unique_visitors": 2}
    assert by_date[yesterday_key] == {"date": yesterday_key, "total_visits": 2, "unique_visitors": 2}
    assert traffic["daily"][0]["date"] <= traffic["daily"][-1]["date"]



