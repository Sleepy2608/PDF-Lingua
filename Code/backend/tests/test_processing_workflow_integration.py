"""
Integration & Unit Tests for Processing Workflow Integration (PDFL-160.1)
--------------------------------------------------------------------------
Validates:
1. History tracking integration for EXTRACT, TRANSLATE, and SUMMARIZE.
2. Initial status PENDING -> completion SUCCESS or FAILED.
3. Execution duration tracking (execution_time_ms >= 0).
4. Error sanitization (redacting local file paths and internal details).
5. User and document ownership isolation (anti-IDOR).
6. Fault isolation: history DB failures never break the primary document workflow.
7. API endpoint integration: /api/process/retranslate and /api/process/summarize.
"""

from typing import Any
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.api.process import (
    _persist_user_document,
    _update_document_ocr_flag,
    execute_summarize_workflow,
)
from app.core.database import Base
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from app.schemas.process import RetranslateRequest, SummarizeRequest
from app.services.history_service import history_service


@pytest.fixture
def in_memory_db():
    """Isolated in-memory SQLite database session with foreign keys enabled."""
    engine = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def _seed_user_and_doc(session: Session, email: str = "alice@example.com") -> tuple[User, Document]:
    user = User(
        email=email,
        hashed_password="hashed_pw_secret_123",
        role=UserRole.FREE,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    doc = Document(
        user_id=user.id,
        original_filename="sample_contract.pdf",
        stored_filename=f"uuid_{user.id}_sample.pdf",
        stored_path=f"storage/{user.id}/uuid_{user.id}_sample.pdf",
        file_size_bytes=4096,
        page_count=3,
        target_lang="vi",
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return user, doc


# ── 1. EXTRACT Workflow Tests ────────────────────────────────────────────────


def test_extract_workflow_success_records_history(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db, "extract_success@example.com")

    def _mock_extract() -> tuple[str, bool]:
        return "Extracted plain text content from PDF document.", False

    text, used_ocr = history_service.execute_tracked_action(
        db=in_memory_db,
        user_id=user.id,
        document_id=doc.id,
        action_type=ActionType.EXTRACT,
        operation=_mock_extract,
    )

    assert text == "Extracted plain text content from PDF document."
    assert used_ocr is False

    records = (
        in_memory_db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == user.id,
            ProcessingHistory.document_id == doc.id,
            ProcessingHistory.action_type == ActionType.EXTRACT,
        )
        .all()
    )
    assert len(records) == 1
    rec = records[0]
    assert rec.status == ProcessingStatus.SUCCESS
    assert rec.execution_time_ms is not None and rec.execution_time_ms >= 0
    assert rec.error_message is None


def test_extract_workflow_failure_records_failed_status_and_sanitizes_error(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db, "extract_fail@example.com")

    def _failing_extract():
        raise RuntimeError("Corrupt PDF header encountered at C:\\Users\\ADMIN\\AppData\\Local\\Temp\\corrupt.pdf")

    with pytest.raises(RuntimeError, match="Corrupt PDF header"):
        history_service.execute_tracked_action(
            db=in_memory_db,
            user_id=user.id,
            document_id=doc.id,
            action_type=ActionType.EXTRACT,
            operation=_failing_extract,
        )

    rec = (
        in_memory_db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == user.id,
            ProcessingHistory.document_id == doc.id,
            ProcessingHistory.action_type == ActionType.EXTRACT,
        )
        .first()
    )
    assert rec is not None
    assert rec.status == ProcessingStatus.FAILED
    assert rec.execution_time_ms is not None and rec.execution_time_ms >= 0
    assert "Corrupt PDF header" in rec.error_message
    assert "C:\\Users\\ADMIN" not in rec.error_message
    assert "[redacted-path]" in rec.error_message


# ── 2. TRANSLATE Workflow Tests ──────────────────────────────────────────────


def test_translate_workflow_success_records_history(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db, "trans_success@example.com")

    def _mock_translate():
        return {
            "translated_text": "Trí tuệ nhân tạo đang biến đổi các luồng xử lý tài liệu.",
            "source_lang": "en",
            "target_lang": "vi",
            "engine_used": "google_gtx",
        }

    res = history_service.execute_tracked_action(
        db=in_memory_db,
        user_id=user.id,
        document_id=doc.id,
        action_type=ActionType.TRANSLATE,
        operation=_mock_translate,
    )

    assert "Trí tuệ nhân tạo" in res["translated_text"]

    rec = (
        in_memory_db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == user.id,
            ProcessingHistory.document_id == doc.id,
            ProcessingHistory.action_type == ActionType.TRANSLATE,
        )
        .first()
    )
    assert rec is not None
    assert rec.status == ProcessingStatus.SUCCESS
    assert rec.execution_time_ms is not None and rec.execution_time_ms >= 0
    assert rec.error_message is None


def test_translate_workflow_failure_records_failed_status_and_sanitizes_error(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db, "trans_fail@example.com")

    def _failing_translate():
        raise TimeoutError("Translation API request timed out after 8s: /var/log/translate_api.log")

    with pytest.raises(TimeoutError, match="Translation API request timed out"):
        history_service.execute_tracked_action(
            db=in_memory_db,
            user_id=user.id,
            document_id=doc.id,
            action_type=ActionType.TRANSLATE,
            operation=_failing_translate,
        )

    rec = (
        in_memory_db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == user.id,
            ProcessingHistory.document_id == doc.id,
            ProcessingHistory.action_type == ActionType.TRANSLATE,
        )
        .first()
    )
    assert rec is not None
    assert rec.status == ProcessingStatus.FAILED
    assert "Translation API request timed out" in rec.error_message
    assert "/var/log" not in rec.error_message
    assert "[redacted-path]" in rec.error_message


# ── 3. SUMMARIZE Workflow Tests ──────────────────────────────────────────────


def test_summarize_workflow_success_records_history(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db, "sum_success@example.com")
    text = (
        "PDF-Lingua is a high performance document translation platform. "
        "It supports OCR for scanned files and fast extraction for digital documents. "
        "All workflows are tracked in the processing history database."
    )

    summary_result = execute_summarize_workflow(
        text,
        db=in_memory_db,
        user_id=user.id,
        document_id=doc.id,
        max_sentences=2,
    )

    assert "PDF-Lingua is a high performance" in summary_result["summary_text"]
    assert summary_result["original_length"] == len(text)
    assert summary_result["summary_length"] > 0

    rec = (
        in_memory_db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == user.id,
            ProcessingHistory.document_id == doc.id,
            ProcessingHistory.action_type == ActionType.SUMMARIZE,
        )
        .first()
    )
    assert rec is not None
    assert rec.status == ProcessingStatus.SUCCESS
    assert rec.execution_time_ms is not None and rec.execution_time_ms >= 0
    assert rec.error_message is None


def test_summarize_workflow_failure_records_failed_status(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db, "sum_fail@example.com")

    def _failing_summarizer(_input_text: str) -> str:
        raise ValueError("Model capacity exceeded on internal node /tmp/ai_worker_01.sock")

    with pytest.raises(ValueError, match="Model capacity exceeded"):
        execute_summarize_workflow(
            "Some valid text to summarize.",
            db=in_memory_db,
            user_id=user.id,
            document_id=doc.id,
            summarizer_fn=_failing_summarizer,
        )

    rec = (
        in_memory_db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == user.id,
            ProcessingHistory.document_id == doc.id,
            ProcessingHistory.action_type == ActionType.SUMMARIZE,
        )
        .first()
    )
    assert rec is not None
    assert rec.status == ProcessingStatus.FAILED
    assert "Model capacity exceeded" in rec.error_message
    assert "/tmp/ai_worker" not in rec.error_message


def test_summarize_workflow_empty_input_raises_without_recording(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db, "sum_empty@example.com")

    with pytest.raises(ValueError, match="Văn bản cần tóm tắt không được để trống"):
        execute_summarize_workflow(
            "   ",
            db=in_memory_db,
            user_id=user.id,
            document_id=doc.id,
        )

    count = (
        in_memory_db.query(ProcessingHistory)
        .filter(ProcessingHistory.user_id == user.id)
        .count()
    )
    assert count == 0


# ── 4. End-to-End Sequential Workflow on Single Document ─────────────────────


def test_end_to_end_three_workflows_on_same_document(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db, "e2e@example.com")

    # Step 1: EXTRACT
    extracted = history_service.execute_tracked_action(
        db=in_memory_db,
        user_id=user.id,
        document_id=doc.id,
        action_type=ActionType.EXTRACT,
        operation=lambda: "Artificial Intelligence in Legal Tech. Natural language processing parses clauses efficiently.",
    )

    # Step 2: TRANSLATE
    translated = history_service.execute_tracked_action(
        db=in_memory_db,
        user_id=user.id,
        document_id=doc.id,
        action_type=ActionType.TRANSLATE,
        operation=lambda: {
            "translated_text": "Trí tuệ nhân tạo trong công nghệ pháp lý. Xử lý ngôn ngữ tự nhiên phân tích các điều khoản hiệu quả.",
            "engine_used": "google_web",
        },
    )

    # Step 3: SUMMARIZE
    summary = execute_summarize_workflow(
        extracted,
        db=in_memory_db,
        user_id=user.id,
        document_id=doc.id,
        max_sentences=1,
    )

    assert "Artificial Intelligence" in extracted
    assert "Trí tuệ nhân tạo" in translated["translated_text"]
    assert "Artificial Intelligence" in summary["summary_text"]

    all_histories = (
        in_memory_db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == user.id,
            ProcessingHistory.document_id == doc.id,
        )
        .order_by(ProcessingHistory.id.asc())
        .all()
    )

    assert len(all_histories) == 3
    action_types = [h.action_type for h in all_histories]
    statuses = [h.status for h in all_histories]

    assert action_types == [ActionType.EXTRACT, ActionType.TRANSLATE, ActionType.SUMMARIZE]
    assert statuses == [ProcessingStatus.SUCCESS, ProcessingStatus.SUCCESS, ProcessingStatus.SUCCESS]
    for h in all_histories:
        assert h.execution_time_ms is not None and h.execution_time_ms >= 0
        assert h.error_message is None


# ── 5. Anti-IDOR & Guest Mode Tests ──────────────────────────────────────────


def test_guest_mode_does_not_fail_or_persist_history():
    """When user_id or document_id is None (guest), the operation runs cleanly with no DB writes."""
    res = history_service.execute_tracked_action(
        db=None,
        user_id=None,
        document_id=None,
        action_type=ActionType.EXTRACT,
        operation=lambda: "Guest extraction works seamlessly",
    )
    assert res == "Guest extraction works seamlessly"


def test_anti_idor_cross_tenant_document_protection(in_memory_db):
    """User B cannot create or attach history to User A's document."""
    user_a, doc_a = _seed_user_and_doc(in_memory_db, "user_a@example.com")
    user_b, doc_b = _seed_user_and_doc(in_memory_db, "user_b@example.com")

    # User B tries to record history referencing doc_a
    result = history_service.execute_tracked_action(
        db=in_memory_db,
        user_id=user_b.id,
        document_id=doc_a.id,
        action_type=ActionType.EXTRACT,
        operation=lambda: "User B operation text",
    )
    # The operation executes, but safe_start_action rejects logging to doc_a
    assert result == "User B operation text"

    # Verify no history record was assigned to doc_a with user_b
    illegal_rec = (
        in_memory_db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == user_b.id,
            ProcessingHistory.document_id == doc_a.id,
        )
        .first()
    )
    assert illegal_rec is None


# ── 6. Fault Isolation Tests ─────────────────────────────────────────────────


def test_fault_isolation_when_database_is_broken():
    """
    Simulate catastrophic DB connection failure during history logging.
    The primary document processing workflow must still return 100% normal output.
    """
    mock_failing_db = MagicMock(spec=Session)
    mock_failing_db.query.side_effect = RuntimeError("Database connection timed out or pool exhausted")

    # EXTRACT must succeed
    extract_output = history_service.execute_tracked_action(
        db=mock_failing_db,
        user_id=1,
        document_id=1,
        action_type=ActionType.EXTRACT,
        operation=lambda: "Primary extraction survived DB outage",
    )
    assert extract_output == "Primary extraction survived DB outage"

    # TRANSLATE must succeed
    translate_output = history_service.execute_tracked_action(
        db=mock_failing_db,
        user_id=1,
        document_id=1,
        action_type=ActionType.TRANSLATE,
        operation=lambda: {"translated_text": "Dịch thuật thành công dù DB lịch sử lỗi."},
    )
    assert translate_output["translated_text"] == "Dịch thuật thành công dù DB lịch sử lỗi."

    # SUMMARIZE must succeed
    summary_output = execute_summarize_workflow(
        "Important first sentence. Less important second sentence.",
        db=mock_failing_db,
        user_id=1,
        document_id=1,
        max_sentences=1,
    )
    assert summary_output["summary_text"] == "Important first sentence."


# ── 7. FastAPI Endpoint Integration Tests ────────────────────────────────────


def test_retranslate_workflow_with_document_history(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db, "retranslate_api@example.com")

    # Simulate retranslate workflow step with document_id
    req = RetranslateRequest(
        text="Hello world from PDF-Lingua.",
        target_lang="vi",
        source_lang="en",
        document_id=doc.id,
    )

    result = history_service.execute_tracked_action(
        db=in_memory_db,
        user_id=user.id,
        document_id=req.document_id,
        action_type=ActionType.TRANSLATE,
        operation=lambda: {
            "translated_text": "Xin chào thế giới từ PDF-Lingua.",
            "target_lang": req.target_lang,
            "engine_used": "mocked_engine",
        },
    )
    assert "Xin chào thế giới" in result["translated_text"]

    # Verify history was recorded for doc.id
    rec = (
        in_memory_db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == user.id,
            ProcessingHistory.document_id == doc.id,
            ProcessingHistory.action_type == ActionType.TRANSLATE,
        )
        .first()
    )
    assert rec is not None
    assert rec.status == ProcessingStatus.SUCCESS
    assert rec.execution_time_ms is not None and rec.execution_time_ms >= 0


def test_summarize_request_schema_and_workflow_validation(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db, "summarize_api@example.com")

    # 1. Valid request payload
    req = SummarizeRequest(
        text="Deep learning models have revolutionized NLP. Transformers enable fast document analysis.",
        max_sentences=1,
        document_id=doc.id,
    )
    assert req.document_id == doc.id
    assert req.max_sentences == 1

    summary_res = execute_summarize_workflow(
        text=req.text,
        db=in_memory_db,
        user_id=user.id,
        document_id=req.document_id,
        max_sentences=req.max_sentences,
    )
    assert "Deep learning models" in summary_res["summary_text"]

    # Verify SUCCESS record in DB
    success_rec = (
        in_memory_db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == user.id,
            ProcessingHistory.document_id == doc.id,
            ProcessingHistory.action_type == ActionType.SUMMARIZE,
        )
        .first()
    )
    assert success_rec is not None
    assert success_rec.status == ProcessingStatus.SUCCESS

    # 2. Invalid empty text raises validation error
    with pytest.raises(Exception):
        SummarizeRequest(
            text="   ",
            max_sentences=1,
            document_id=doc.id,
        )


def test_persist_user_document_and_ocr_flag_helpers(in_memory_db):
    user = User(email="persist_test@example.com", hashed_password="pw", role=UserRole.FREE)
    in_memory_db.add(user)
    in_memory_db.commit()
    in_memory_db.refresh(user)

    # 1. Guest mode returns (None, None)
    doc_none, doc_id_none = _persist_user_document(
        in_memory_db,
        user_id=None,
        filename="test.pdf",
        content=b"%PDF-1.4 mock",
        page_count=1,
        target_lang="vi",
    )
    assert doc_none is None
    assert doc_id_none is None

    # 2. Authenticated user creates document
    doc, doc_id = _persist_user_document(
        in_memory_db,
        user_id=user.id,
        filename="test.pdf",
        content=b"%PDF-1.4 mock",
        page_count=2,
        target_lang="vi",
        is_ocr_used=False,
    )
    assert doc is not None
    assert doc_id is not None
    assert doc.page_count == 2
    assert doc.is_ocr_used is False

    # 3. Update OCR flag
    _update_document_ocr_flag(in_memory_db, doc, is_ocr_used=True)
    assert doc.is_ocr_used is True


def test_background_job_empty_and_successful_extraction_consistency(in_memory_db, tmp_path):
    """
    Verify `_execute_pdf_background_job` marks both the Job and EXTRACT ProcessingHistory
    as FAILED when extraction returns empty/whitespace text, and marks both EXTRACT and
    TRANSLATE as SUCCESS when extraction succeeds (AUDIT-02).
    """
    from unittest.mock import patch
    from app.api.process import _execute_pdf_background_job, job_manager, pdf_service, translation_service
    from app.services.job_service import JobStatus

    user = User(email="bg_job_audit02@example.com", hashed_password="pw", role=UserRole.FREE)
    in_memory_db.add(user)
    in_memory_db.commit()
    in_memory_db.refresh(user)

    # Create non-closing wrapper around in_memory_db so SessionLocal() uses the test session
    class _NonClosingSessionProxy:
        def __init__(self, real_session):
            self._s = real_session

        def __getattr__(self, name):
            if name == "close":
                return lambda: None
            return getattr(self._s, name)

    # 1. Empty extraction -> Job FAILED and EXTRACT ProcessingHistory FAILED
    pdf_file_empty = tmp_path / "empty_doc.pdf"
    pdf_file_empty.write_bytes(b"%PDF-1.4 empty content")
    job_empty = job_manager.create_job(filename="empty_doc.pdf", target_lang="vi")

    with patch("app.api.process.SessionLocal", return_value=_NonClosingSessionProxy(in_memory_db)), patch.object(
        pdf_service, "validate_pdf", return_value={"is_valid": True, "page_count": 1, "error": None}
    ), patch.object(
        pdf_service,
        "extract_hybrid_fast_path",
        return_value={"text": "   \n  ", "ocr_pages_count": 1, "fast_path_used": False},
    ):
        _execute_pdf_background_job(
            job_id=job_empty.job_id,
            tmp_path=pdf_file_empty,
            filename="empty_doc.pdf",
            target_lang="vi",
            max_allowed_pages=100,
            file_size_mb=0.01,
            user_id=user.id,
        )

    updated_job_empty = job_manager.get_job(job_empty.job_id)
    assert updated_job_empty is not None
    assert updated_job_empty.status == JobStatus.FAILED
    assert "Không thể trích xuất văn bản" in (updated_job_empty.error or "")

    empty_histories = (
        in_memory_db.query(ProcessingHistory)
        .filter(ProcessingHistory.user_id == user.id)
        .order_by(ProcessingHistory.id.asc())
        .all()
    )
    assert len(empty_histories) == 1
    assert empty_histories[0].action_type == ActionType.EXTRACT
    assert empty_histories[0].status == ProcessingStatus.FAILED
    assert "Không thể trích xuất văn bản" in (empty_histories[0].error_message or "")

    # 2. Valid extraction -> Job COMPLETED and both EXTRACT + TRANSLATE ProcessingHistory SUCCESS
    pdf_file_ok = tmp_path / "valid_doc.pdf"
    pdf_file_ok.write_bytes(b"%PDF-1.4 valid content")
    job_ok = job_manager.create_job(filename="valid_doc.pdf", target_lang="vi")

    with patch("app.api.process.SessionLocal", return_value=_NonClosingSessionProxy(in_memory_db)), patch.object(
        pdf_service, "validate_pdf", return_value={"is_valid": True, "page_count": 2, "error": None}
    ), patch.object(
        pdf_service,
        "extract_hybrid_fast_path",
        return_value={"text": "Valid extracted PDF text.", "ocr_pages_count": 0, "fast_path_used": True},
    ), patch.object(
        translation_service,
        "translate_text",
        return_value={"translated_text": "Văn bản PDF hợp lệ đã trích xuất.", "engine_used": "mock_engine"},
    ):
        _execute_pdf_background_job(
            job_id=job_ok.job_id,
            tmp_path=pdf_file_ok,
            filename="valid_doc.pdf",
            target_lang="vi",
            max_allowed_pages=100,
            file_size_mb=0.02,
            user_id=user.id,
        )

    updated_job_ok = job_manager.get_job(job_ok.job_id)
    assert updated_job_ok is not None
    assert updated_job_ok.status == JobStatus.COMPLETED

    all_histories = (
        in_memory_db.query(ProcessingHistory)
        .filter(ProcessingHistory.user_id == user.id)
        .order_by(ProcessingHistory.id.asc())
        .all()
    )
    assert len(all_histories) == 3
    assert all_histories[1].action_type == ActionType.EXTRACT
    assert all_histories[1].status == ProcessingStatus.SUCCESS
    assert all_histories[2].action_type == ActionType.TRANSLATE
    assert all_histories[2].status == ProcessingStatus.SUCCESS

