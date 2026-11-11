"""
Integration and Unit Tests for AI Copilot Chat Endpoint (POST /api/ai/chat)
-------------------------------------------------------------------------
Covers Sprint 6 Phase 2 tasks:
- PDFL-138: Prompt scoping and query handling
- PDFL-139: API endpoint routing and payload schema
- PDFL-140: Document context injection
- PDFL-141: Relevant chunk extraction ranking
- PDFL-145: Daily question quota enforcement (15 questions/day for Pro)
- PDFL-146: Document grounded answers with chunk reference
- PDFL-147: Truthfulness and anti-hallucination when info is missing
- PDFL-148: Document ownership isolation (RBAC and multi-tenant security)
- PDFL-149: Verification test suite against hallucinations and out-of-scope queries
"""

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from app.core.database import Base
from app.core.dependencies import get_db
from app.core.security import create_access_token
from app.main import app
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from app.services.ai_service import ai_service
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

client = TestClient(app)


@pytest.fixture
def ai_chat_env():
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
        email="chat_free@example.com",
        hashed_password="hashed_pw_free",
        full_name="Nguoi Dung Free",
        role=UserRole.FREE,
        is_active=True,
    )
    pro_user = User(
        email="chat_pro@example.com",
        hashed_password="hashed_pw_pro",
        full_name="Nguoi Dung Pro VIP",
        role=UserRole.PRO,
        is_active=True,
    )
    other_pro_user = User(
        email="chat_other_pro@example.com",
        hashed_password="hashed_pw_other_pro",
        full_name="Nguoi Dung Pro Khac",
        role=UserRole.PRO,
        is_active=True,
    )
    admin_user = User(
        email="chat_admin@example.com",
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
        original_filename="chinh_sach_gia_goi_dich_vu.pdf",
        stored_filename="uuid_chinh_sach.pdf",
        stored_path="uploads/uuid_chinh_sach.pdf",
        file_size_bytes=102400,
        page_count=5,
        target_lang="vi",
        is_ocr_used=False,
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


class TestAIChatAuthAndRBAC:
    """Test suite for authentication and authorization on /api/ai/chat."""

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated request must be rejected with HTTP 401."""
        response = client.post(
            "/api/ai/chat",
            json={"query": "Cau hoi bat ky?", "document_text": "Noi dung mau."},
        )
        assert response.status_code == 401

    def test_free_user_rejected_with_pro_required(self, ai_chat_env):
        """Free user must be rejected with HTTP 403 and PRO_REQUIRED error code."""
        headers = {"Authorization": f"Bearer {ai_chat_env['free_token']}"}
        payload = {
            "query": "Hoi dap ve tai lieu",
            "document_text": "Noi dung van ban can hoi dap.",
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error_code"] == "PRO_REQUIRED"
        assert "/#pricingSection" in data["details"]["upgrade_url"]

    def test_pro_user_success(self, ai_chat_env):
        """Pro VIP user can successfully query Copilot chat."""
        headers = {"Authorization": f"Bearer {ai_chat_env['pro_token']}"}
        payload = {
            "query": "Han ngach tai khoan Pro la bao nhieu?",
            "document_text": "Chinh sach he thong: Tai khoan Pro co han ngach 50 tai lieu moi thang va 15 cau hoi AI moi ngay.",
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["answer"] is not None
        assert len(body["data"]["answer"]) > 0
        assert body["data"]["provider"] == "b.ai"
        assert body["data"]["daily_questions_remaining"] == 14

    def test_admin_user_success_unlimited_quota(self, ai_chat_env):
        """Admin user can query chat and has unlimited daily quota."""
        headers = {"Authorization": f"Bearer {ai_chat_env['admin_token']}"}
        payload = {
            "query": "Bao mat he thong",
            "document_text": "He thong ap dung ma hoa AES-256 va xac thuc JWT.",
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["daily_questions_remaining"] is None


class TestAIChatDocumentIsolation:
    """Test suite for PDFL-148 multi-tenant document security."""

    def test_access_another_user_document_forbidden(self, ai_chat_env):
        """User cannot ask questions using another user's document ID."""
        headers = {"Authorization": f"Bearer {ai_chat_env['other_pro_token']}"}
        payload = {
            "query": "Thong tin bao mat trong tai lieu nay la gi?",
            "document_id": ai_chat_env["pro_doc"].id,
            "document_text": "Noi dung bi mat cua nguoi khac.",
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert "Ban khong co quyen truy cap" in data["message"]

    def test_non_existent_document_id_returns_404(self, ai_chat_env):
        """Querying a non-existent document ID returns HTTP 404."""
        headers = {"Authorization": f"Bearer {ai_chat_env['pro_token']}"}
        payload = {
            "query": "Cau hoi cho tai lieu khong ton tai",
            "document_id": 999999,
            "document_text": "Van ban bat ky",
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 404
        assert response.json()["error_code"] == "NOT_FOUND"

    def test_admin_can_access_any_document(self, ai_chat_env):
        """Admin user can query any document regardless of ownership."""
        headers = {"Authorization": f"Bearer {ai_chat_env['admin_token']}"}
        payload = {
            "query": "Thong tin tai lieu",
            "document_id": ai_chat_env["pro_doc"].id,
            "document_text": "Van ban do nguoi dung khac so huu.",
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestAIChatAntiHallucinationAndGroundedness:
    """Test suite for PDFL-146, PDFL-147, PDFL-149 truthfulness and anti-hallucination."""

    def test_anti_hallucination_returns_no_info_when_missing(self, ai_chat_env):
        """When document lacks query facts, returns standard truthfulness message without fabricating."""
        headers = {"Authorization": f"Bearer {ai_chat_env['pro_token']}"}
        payload = {
            "query": "Dan so cua thanh pho Paris vao nam 2025 la bao nhieu nguoi?",
            "document_text": "Day la huong dan su dung phan mem quan ly kho hang doanh nghiep.",
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        # Must return truthful denial
        assert body["data"]["answer"] == ai_service.NO_INFO_RESPONSE

    def test_grounded_answer_includes_relevant_chunk(self, ai_chat_env):
        """When document contains the fact, returns grounded answer matching context."""
        headers = {"Authorization": f"Bearer {ai_chat_env['pro_token']}"}
        payload = {
            "query": "Goi VIP Enterprise co muc gia nhu the nao?",
            "document_text": (
                "Bang gia dich vu nam 2026: Goi Free mien phi hoan toan. "
                "Goi Pro co gia 99.000 VND moi thang. "
                "Goi VIP Enterprise co muc gia 499.000 VND moi thang voi khong gioi han tinh nang."
            ),
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        answer = body["data"]["answer"]
        assert "Enterprise" in answer or "499.000" in answer
        assert len(body["data"]["relevant_chunks"]) > 0

    def test_multi_turn_conversation_history(self, ai_chat_env):
        """Multi-turn conversation history is passed and processed properly."""
        headers = {"Authorization": f"Bearer {ai_chat_env['pro_token']}"}
        payload = {
            "query": "Vay thoi gian bao hanh la bao lau?",
            "document_text": "Chinh sach san pham: Thoi gian bao hanh la 24 thang ke tu ngay mua.",
            "conversation_history": [
                {"role": "user", "content": "San pham nay la gi?"},
                {"role": "assistant", "content": "Day la thiet bi dien tu cao cap."},
            ],
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["answer"] is not None


class TestAIChatDailyQuota:
    """Test suite for PDFL-145 daily question limit (15 questions/day)."""

    def test_daily_quota_exhaustion_returns_403(self, ai_chat_env):
        """When 15 questions have been used today, 16th question is rejected with 403."""
        session = ai_chat_env["session"]
        user_id = ai_chat_env["pro_user"].id

        # Pre-seed 15 CHAT records for today
        now = datetime.now(timezone.utc)
        for i in range(15):
            rec = ProcessingHistory(
                user_id=user_id,
                action_type=ActionType.CHAT,
                status=ProcessingStatus.SUCCESS,
                created_at=now,
            )
            session.add(rec)
        session.commit()

        headers = {"Authorization": f"Bearer {ai_chat_env['pro_token']}"}
        payload = {
            "query": "Cau hoi thu 16 vuot han ngach?",
            "document_text": "Noi dung van ban thu nghiem.",
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error_code"] == "DAILY_QUOTA_EXCEEDED"
        assert data["details"]["daily_limit"] == 15
        assert data["details"]["used_today"] == 15

    def test_processing_history_recorded_on_success(self, ai_chat_env):
        """Each successful chat call records a ProcessingHistory record."""
        session = ai_chat_env["session"]
        user_id = ai_chat_env["pro_user"].id

        # Initial count
        init_count = (
            session.query(ProcessingHistory)
            .filter(
                ProcessingHistory.user_id == user_id,
                ProcessingHistory.action_type == ActionType.CHAT,
            )
            .count()
        )

        headers = {"Authorization": f"Bearer {ai_chat_env['pro_token']}"}
        payload = {
            "query": "Cau hoi ghi log kiem toan?",
            "document_id": ai_chat_env["pro_doc"].id,
            "document_text": "Noi dung tai lieu ghi log.",
        }

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["data"]["history_id"] is not None

        new_count = (
            session.query(ProcessingHistory)
            .filter(
                ProcessingHistory.user_id == user_id,
                ProcessingHistory.action_type == ActionType.CHAT,
            )
            .count()
        )
        assert new_count == init_count + 1


class TestAIChatValidationAndErrorHandling:
    """Test suite for input validation and fallback handling."""

    def test_empty_query_rejected(self, ai_chat_env):
        """Empty query string returns HTTP 422 Unprocessable Entity."""
        headers = {"Authorization": f"Bearer {ai_chat_env['pro_token']}"}
        payload = {"query": "   ", "document_text": "Van ban hop le."}

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 422

    def test_missing_document_text_and_id_rejected(self, ai_chat_env):
        """Missing both document_text and document_id returns HTTP 400."""
        headers = {"Authorization": f"Bearer {ai_chat_env['pro_token']}"}
        payload = {"query": "Cau hoi khong co ngu canh?"}

        response = client.post("/api/ai/chat", json=payload, headers=headers)
        assert response.status_code == 400
        assert response.json()["error_code"] == "EMPTY_DOCUMENT_TEXT"

    def test_service_exception_triggers_graceful_response(self, ai_chat_env):
        """When underlying API fails, fallback provides valid response instead of crashing."""
        headers = {"Authorization": f"Bearer {ai_chat_env['pro_token']}"}
        payload = {
            "query": "Noi dung cua tai lieu nay la gi?",
            "document_text": "Day la mot tai lieu rat quan trong ve nang luong tai tao.",
        }

        with patch.object(
            ai_service,
            "_call_bai_api",
            side_effect=Exception("Simulated connection timeout"),
        ):
            response = client.post("/api/ai/chat", json=payload, headers=headers)
            assert response.status_code == 200
            body = response.json()
            assert body["success"] is True
            assert body["data"]["fallback_used"] is True
            assert "Simulated connection timeout" in body["data"]["fallback_reason"]
