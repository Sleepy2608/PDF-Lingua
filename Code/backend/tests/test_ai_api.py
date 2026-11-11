"""
Integration and Unit Tests for AI API Endpoints (POST /api/ai/summarize)
-----------------------------------------------------------------------
Verifies:
- Unauthenticated access rejection (HTTP 401).
- Free user access rejection with Pro upgrade guidance (HTTP 403 PRO_REQUIRED).
- Pro and Admin user authorization (HTTP 200).
- Input payload validation (empty text, text limit 100,000 chars, invalid style/length).
- Document ownership isolation and ProcessingHistory audit trail recording.
- Error handling and diagnostics.
"""

from unittest.mock import AsyncMock, patch

import pytest
from app.core.database import Base
from app.core.dependencies import get_db
from app.core.security import create_access_token
from app.main import app
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

client = TestClient(app)


@pytest.fixture
def ai_test_env():
    """Create an isolated in-memory SQLite database with Free, Pro, and Admin users."""
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

    free_user = User(
        email="free_user@example.com",
        hashed_password="hashed_pw_free",
        full_name="Nguoi Dung Free",
        role=UserRole.FREE,
        is_active=True,
    )
    pro_user = User(
        email="pro_user@example.com",
        hashed_password="hashed_pw_pro",
        full_name="Nguoi Dung Pro VIP",
        role=UserRole.PRO,
        is_active=True,
    )
    other_pro_user = User(
        email="other_pro@example.com",
        hashed_password="hashed_pw_other_pro",
        full_name="Nguoi Dung Pro Khac",
        role=UserRole.PRO,
        is_active=True,
    )
    admin_user = User(
        email="admin_ai@example.com",
        hashed_password="hashed_pw_admin",
        full_name="Quan Tri Vien",
        role=UserRole.ADMIN,
        is_active=True,
    )

    session.add_all([free_user, pro_user, other_pro_user, admin_user])
    session.commit()
    session.refresh(free_user)
    session.refresh(pro_user)
    session.refresh(other_pro_user)
    session.refresh(admin_user)

    # Create sample document owned by pro_user
    pro_doc = Document(
        user_id=pro_user.id,
        original_filename="tai_lieu_khoa_hoc.pdf",
        stored_filename="tai_lieu_khoa_hoc_uuid.pdf",
        stored_path="storage/documents/tai_lieu_khoa_hoc_uuid.pdf",
        file_size_bytes=1024 * 50,
        page_count=5,
    )
    session.add(pro_doc)
    session.commit()
    session.refresh(pro_doc)

    free_token = create_access_token(subject=free_user.id)
    pro_token = create_access_token(subject=pro_user.id)
    other_pro_token = create_access_token(subject=other_pro_user.id)
    admin_token = create_access_token(subject=admin_user.id)

    yield {
        "session": session,
        "free_user": free_user,
        "pro_user": pro_user,
        "other_pro_user": other_pro_user,
        "admin_user": admin_user,
        "pro_doc": pro_doc,
        "free_token": free_token,
        "pro_token": pro_token,
        "other_pro_token": other_pro_token,
        "admin_token": admin_token,
    }

    session.close()
    app.dependency_overrides.pop(get_db, None)


class TestAISummarizeAuthAndRoleGate:
    """Test authentication and Pro role authorization gates (PDFL-134)."""

    def test_unauthenticated_request_rejected(self):
        res = client.post(
            "/api/ai/summarize",
            json={"text": "Van ban thu nghiem."},
        )
        assert res.status_code == 401

    def test_invalid_token_rejected(self):
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": "Bearer invalid.jwt.token"},
            json={"text": "Van ban thu nghiem."},
        )
        assert res.status_code == 401

    def test_free_user_rejected_with_pro_guidance(self, ai_test_env):
        token = ai_test_env["free_token"]
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {token}"},
            json={"text": "Van ban can tom tat boi tai khoan Free."},
        )
        assert res.status_code == 403
        data = res.json()
        assert data["success"] is False
        assert data["error_code"] == "PRO_REQUIRED"
        assert "Pro VIP" in data["message"]
        assert data["details"]["upgrade_url"] == "/#pricingSection"

    def test_pro_user_allowed(self, ai_test_env):
        token = ai_test_env["pro_token"]
        payload = {
            "text": "Tri tue nhan tao giup tu dong hoa tom tat van ban nhanh chong.",
            "style": "brief",
            "length": "short",
        }
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "data" in data
        assert len(data["data"]["summary"]) > 0
        assert data["data"]["style"] == "brief"
        assert data["data"]["length"] == "short"

    def test_admin_user_allowed(self, ai_test_env):
        token = ai_test_env["admin_token"]
        payload = {
            "text": "Admin kiem tra chuc nang tom tat van ban.",
            "style": "bullets",
        }
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["style"] == "bullets"


class TestAISummarizeInputValidation:
    """Test input payload validation rules (PDFL-135)."""

    def test_empty_text_rejected(self, ai_test_env):
        token = ai_test_env["pro_token"]
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {token}"},
            json={"text": ""},
        )
        assert res.status_code == 422

    def test_whitespace_only_text_rejected(self, ai_test_env):
        token = ai_test_env["pro_token"]
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {token}"},
            json={"text": "    \n   "},
        )
        assert res.status_code == 422

    def test_text_exceeding_100k_chars_rejected(self, ai_test_env):
        token = ai_test_env["pro_token"]
        giant_text = "A" * 100001
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {token}"},
            json={"text": giant_text},
        )
        assert res.status_code == 422

    def test_invalid_style_rejected(self, ai_test_env):
        token = ai_test_env["pro_token"]
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {token}"},
            json={"text": "Van ban hop le.", "style": "super_fancy_style"},
        )
        assert res.status_code == 422

    def test_invalid_length_rejected(self, ai_test_env):
        token = ai_test_env["pro_token"]
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {token}"},
            json={"text": "Van ban hop le.", "length": "extra_gigantic"},
        )
        assert res.status_code == 422


class TestAISummarizeDocumentIsolationAndAudit:
    """Test document access isolation and ProcessingHistory recording (PDFL-135, PDFL-148)."""

    def test_summarize_own_document_creates_history(self, ai_test_env):
        token = ai_test_env["pro_token"]
        doc = ai_test_env["pro_doc"]
        session = ai_test_env["session"]

        payload = {
            "text": "Noi dung trich xuat tu tai lieu khoa hoc.",
            "style": "detailed",
            "length": "medium",
            "document_id": doc.id,
        }
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["document_id"] == doc.id
        assert data["history_id"] is not None

        # Verify database record
        history = session.query(ProcessingHistory).filter(ProcessingHistory.id == data["history_id"]).first()
        assert history is not None
        assert history.user_id == ai_test_env["pro_user"].id
        assert history.document_id == doc.id
        assert history.action_type == ActionType.SUMMARIZE
        assert history.status == ProcessingStatus.SUCCESS

    def test_summarize_other_user_document_forbidden(self, ai_test_env):
        # other_pro_token attempts to access pro_user's document
        other_token = ai_test_env["other_pro_token"]
        doc = ai_test_env["pro_doc"]

        payload = {
            "text": "Noi dung can tom tat.",
            "document_id": doc.id,
        }
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {other_token}"},
            json=payload,
        )
        assert res.status_code == 403
        data = res.json()
        assert data["success"] is False
        assert "quyen truy cap" in data["message"].lower()

    def test_summarize_nonexistent_document_not_found(self, ai_test_env):
        token = ai_test_env["pro_token"]
        payload = {
            "text": "Noi dung can tom tat.",
            "document_id": 99999,
        }
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        assert res.status_code == 404
        data = res.json()
        assert data["success"] is False
        assert "khong ton tai" in data["message"].lower()

    def test_admin_can_summarize_any_user_document(self, ai_test_env):
        admin_token = ai_test_env["admin_token"]
        doc = ai_test_env["pro_doc"]

        payload = {
            "text": "Admin xem xet va tom tat tai lieu cua thanh vien.",
            "document_id": doc.id,
        }
        res = client.post(
            "/api/ai/summarize",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["document_id"] == doc.id


class TestAISummarizeServiceErrorHandling:
    """Test exception handling during summarization (PDFL-136)."""

    def test_service_exception_logs_failed_history(self, ai_test_env):
        token = ai_test_env["pro_token"]
        doc = ai_test_env["pro_doc"]
        session = ai_test_env["session"]

        payload = {
            "text": "Van ban gay loi noi bo.",
            "document_id": doc.id,
        }

        with patch("app.services.ai_service.AIService.summarize_text", new_callable=AsyncMock) as mock_sum:
            mock_sum.side_effect = RuntimeError("AI service pipeline crashed abruptly")

            res = client.post(
                "/api/ai/summarize",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
            assert res.status_code == 500

            # Verify that failed ProcessingHistory record was written
            failed_entry = (
                session.query(ProcessingHistory)
                .filter(
                    ProcessingHistory.document_id == doc.id,
                    ProcessingHistory.action_type == ActionType.SUMMARIZE,
                    ProcessingHistory.status == ProcessingStatus.FAILED,
                )
                .first()
            )
            assert failed_entry is not None
            assert "AI service pipeline crashed" in failed_entry.error_message
