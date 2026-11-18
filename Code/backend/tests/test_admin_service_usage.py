"""
Admin Service Usage Aggregation Unit & Security Tests
------------------------------------------------------
Verifies:
- Aggregation of successful document processing actions (EXTRACT, TRANSLATE, SUMMARIZE, CHAT).
- Total actions calculation as sum of all successful services.
- Proper exclusion of FAILED and PENDING processing history records.
- Graceful empty database handling (all usage metrics return 0).
- Admin stats API endpoint serialization of the services breakdown.
- Role-Based Access Control (RBAC): Admin (200), Free (403), Pro (403), Guest (401).
"""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.core.dependencies import get_db
from app.core.security import create_access_token
from app.main import app
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from app.services.admin_service import AdminService

client = TestClient(app)


# ── In-Memory Database & Auth Fixtures ───────────────────────────────

@pytest.fixture
def usage_test_env():
    """
    Setup an isolated in-memory SQLite database populated with admin,
    free, and pro users for service usage aggregation testing.
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
        email="admin_usage@example.com",
        hashed_password="hashed_admin_pass",
        full_name="Usage Administrator",
        role=UserRole.ADMIN,
        is_active=True,
    )
    free_user = User(
        email="free_usage@example.com",
        hashed_password="hashed_free_pass",
        full_name="Free Tier User",
        role=UserRole.FREE,
        is_active=True,
    )
    pro_user = User(
        email="pro_usage@example.com",
        hashed_password="hashed_pro_pass",
        full_name="Pro Tier User",
        role=UserRole.PRO,
        is_active=True,
    )

    session.add_all([admin_user, free_user, pro_user])
    session.commit()
    session.refresh(admin_user)
    session.refresh(free_user)
    session.refresh(pro_user)

    # Seed Sample Document
    doc = Document(
        user_id=free_user.id,
        original_filename="sample_test.pdf",
        stored_filename="doc_sample_uuid.pdf",
        stored_path="users/free/doc_sample_uuid.pdf",
        file_size_bytes=2048,
        page_count=3,
        target_lang="vi",
        created_at=datetime.now(timezone.utc),
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)

    admin_token = create_access_token(subject=admin_user.id)
    free_token = create_access_token(subject=free_user.id)
    pro_token = create_access_token(subject=pro_user.id)

    yield {
        "session": session,
        "admin": admin_user,
        "free": free_user,
        "pro": pro_user,
        "document": doc,
        "admin_token": admin_token,
        "free_token": free_token,
        "pro_token": pro_token,
    }

    app.dependency_overrides.clear()
    session.close()
    Base.metadata.drop_all(bind=engine)


# ── Unit Tests: AdminService Usage Aggregation Logic ─────────────────

def test_service_usage_empty_database_returns_zeroes(usage_test_env):
    """When no processing history records exist, all counts and total must be 0."""
    session = usage_test_env["session"]
    stats = AdminService.get_system_stats(db=session)

    assert stats.services.extract_count == 0
    assert stats.services.translate_count == 0
    assert stats.services.summarize_count == 0
    assert stats.services.chat_count == 0
    assert stats.services.total_actions == 0


def test_service_usage_aggregates_successful_actions_correctly(usage_test_env):
    """Verifies that only successful actions are aggregated by their action_type."""
    session = usage_test_env["session"]
    user_id = usage_test_env["free"].id
    doc_id = usage_test_env["document"].id

    records = [
        # 3 EXTRACT (SUCCESS)
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.EXTRACT, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.EXTRACT, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.EXTRACT, status=ProcessingStatus.SUCCESS),
        # 2 TRANSLATE (SUCCESS)
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.TRANSLATE, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.TRANSLATE, status=ProcessingStatus.SUCCESS),
        # 1 SUMMARIZE (SUCCESS)
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.SUMMARIZE, status=ProcessingStatus.SUCCESS),
        # 4 CHAT (SUCCESS)
        ProcessingHistory(user_id=user_id, document_id=None, action_type=ActionType.CHAT, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=None, action_type=ActionType.CHAT, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=None, action_type=ActionType.CHAT, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=None, action_type=ActionType.CHAT, status=ProcessingStatus.SUCCESS),
    ]
    session.add_all(records)
    session.commit()

    stats = AdminService.get_system_stats(db=session)

    assert stats.services.extract_count == 3
    assert stats.services.translate_count == 2
    assert stats.services.summarize_count == 1
    assert stats.services.chat_count == 4
    assert stats.services.total_actions == 10


def test_service_usage_strictly_excludes_failed_and_pending_records(usage_test_env):
    """Verifies that FAILED and PENDING records are never counted in service statistics."""
    session = usage_test_env["session"]
    user_id = usage_test_env["free"].id
    doc_id = usage_test_env["document"].id

    records = [
        # EXTRACT: 1 SUCCESS, 2 FAILED, 1 PENDING
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.EXTRACT, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.EXTRACT, status=ProcessingStatus.FAILED),
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.EXTRACT, status=ProcessingStatus.FAILED),
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.EXTRACT, status=ProcessingStatus.PENDING),
        # TRANSLATE: 2 SUCCESS, 1 FAILED
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.TRANSLATE, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.TRANSLATE, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.TRANSLATE, status=ProcessingStatus.FAILED),
        # SUMMARIZE: 0 SUCCESS, 1 PENDING
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.SUMMARIZE, status=ProcessingStatus.PENDING),
        # CHAT: 1 SUCCESS, 1 FAILED
        ProcessingHistory(user_id=user_id, document_id=None, action_type=ActionType.CHAT, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=None, action_type=ActionType.CHAT, status=ProcessingStatus.FAILED),
    ]
    session.add_all(records)
    session.commit()

    stats = AdminService.get_system_stats(db=session)

    assert stats.services.extract_count == 1
    assert stats.services.translate_count == 2
    assert stats.services.summarize_count == 0
    assert stats.services.chat_count == 1
    assert stats.services.total_actions == 4


# ── Integration Tests: API Endpoint & Serialization ─────────────────

def test_admin_stats_api_returns_services_breakdown(usage_test_env):
    """GET /api/admin/stats returns 200 with complete services breakdown schema."""
    session = usage_test_env["session"]
    user_id = usage_test_env["pro"].id
    doc_id = usage_test_env["document"].id

    records = [
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.EXTRACT, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.TRANSLATE, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=doc_id, action_type=ActionType.SUMMARIZE, status=ProcessingStatus.SUCCESS),
        ProcessingHistory(user_id=user_id, document_id=None, action_type=ActionType.CHAT, status=ProcessingStatus.SUCCESS),
    ]
    session.add_all(records)
    session.commit()

    headers = {"Authorization": f"Bearer {usage_test_env['admin_token']}"}
    response = client.get("/api/admin/stats", headers=headers)

    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True

    data = res_json["data"]
    assert "services" in data
    services = data["services"]

    assert services["extract_count"] == 1
    assert services["translate_count"] == 1
    assert services["summarize_count"] == 1
    assert services["chat_count"] == 1
    assert services["total_actions"] == 4


# ── Security & RBAC Tests ────────────────────────────────────────────

def test_admin_stats_unauthenticated_rejected_with_401(usage_test_env):
    """Unauthenticated requests without token must return 401."""
    response = client.get("/api/admin/stats")
    assert response.status_code == 401


def test_admin_stats_free_user_forbidden_with_403(usage_test_env):
    """Free user attempting to access admin stats must return 403."""
    headers = {"Authorization": f"Bearer {usage_test_env['free_token']}"}
    response = client.get("/api/admin/stats", headers=headers)
    assert response.status_code == 403
    assert response.json()["error_code"] == "FORBIDDEN"


def test_admin_stats_pro_user_forbidden_with_403(usage_test_env):
    """Pro user attempting to access admin stats must return 403."""
    headers = {"Authorization": f"Bearer {usage_test_env['pro_token']}"}
    response = client.get("/api/admin/stats", headers=headers)
    assert response.status_code == 403
    assert response.json()["error_code"] == "FORBIDDEN"
