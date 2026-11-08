"""
Unit & Integration Test Suite for Processing History Result Persistence & API (PDFL-165.1)
-----------------------------------------------------------------------------------------
Verifies:
1. StorageService result operations: save, read, get path, delete, and path traversal prevention.
2. HistoryService result management:
   - save_history_result: file creation, database update, status=SUCCESS, result_path linkage.
   - get_history_result: success retrieval, multi-tenant isolation (Anti-IDOR).
   - Error handling: PENDING history, FAILED history, missing result_path, deleted physical file.
3. API Endpoint GET /api/history/{history_id}/result:
   - Authentication dependency enforcement.
   - Anti-IDOR security (never leak other users' history existence).
   - Schema validation and response format (ProcessingResultResponse).
   - Boundary checks and status error codes (RESULT_PENDING, RESULT_FAILED, RESULT_FILE_MISSING).
"""

import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Coroutine, TypeVar

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.history import get_history_result, router as history_router
from app.core.database import Base
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse
from app.schemas.processing_history import (
    ProcessingHistoryCreate,
    ProcessingResultResponse,
)
from app.services.history_service import HistoryService
from app.services.storage_service import StorageService

T = TypeVar("T")


def _run_async(coro: Coroutine[Any, Any, T]) -> T:
    """Execute a non-yielding async endpoint coroutine synchronously."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()


@pytest.fixture()
def in_memory_db():
    """Isolated in-memory SQLite database session with foreign keys."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _enable_fk(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def temp_storage():
    """Temporary storage directory for testing result persistence."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        service = StorageService(base_dir=tmp_dir)
        yield service, Path(tmp_dir)


@pytest.fixture()
def setup_users_and_doc(in_memory_db):
    """Seed two users and a document for multi-tenant tests."""
    user_a = User(
        email="alice@example.com",
        hashed_password="hashed_pw_alice",
        full_name="Alice User",
        role=UserRole.FREE,
        is_active=True,
    )
    user_b = User(
        email="bob@example.com",
        hashed_password="hashed_pw_bob",
        full_name="Bob User",
        role=UserRole.PRO,
        is_active=True,
    )
    in_memory_db.add_all([user_a, user_b])
    in_memory_db.commit()
    in_memory_db.refresh(user_a)
    in_memory_db.refresh(user_b)

    doc_a = Document(
        user_id=user_a.id,
        original_filename="research_paper.pdf",
        stored_filename="uuid123_research_paper.pdf",
        stored_path=f"{user_a.id}/uuid123_research_paper.pdf",
        file_size_bytes=204800,
        page_count=5,
        target_lang="vi",
        is_ocr_used=False,
    )
    in_memory_db.add(doc_a)
    in_memory_db.commit()
    in_memory_db.refresh(doc_a)

    return user_a, user_b, doc_a


# ── 1. StorageService Result Operations ──────────────────────────────────────

def test_storage_service_save_read_delete_result(temp_storage):
    storage, base_path = temp_storage
    user_id = 42
    history_id = 101
    sample_data = {
        "original_text": "Machine Learning in Healthcare.",
        "translated_text": "Học máy trong y tế.",
        "target_lang": "vi",
        "engine_used": "google",
    }

    rel_path, abs_path = storage.save_result_file(user_id, history_id, sample_data)
    assert rel_path == f"{user_id}/results/{history_id}_result.json"
    assert abs_path.is_file()

    # Read back
    read_data = storage.read_result_file(user_id, rel_path)
    assert read_data is not None
    assert read_data["original_text"] == sample_data["original_text"]
    assert read_data["translated_text"] == sample_data["translated_text"]

    # Traversal prevention
    traversal_path = f"../{history_id}_result.json"
    assert storage.get_result_path(user_id, traversal_path) is None

    # Delete result file
    deleted = storage.delete_result_file(user_id, rel_path)
    assert deleted is True
    assert not abs_path.exists()
    assert storage.read_result_file(user_id, rel_path) is None


# ── 2. HistoryService Result Persistence & Anti-IDOR ─────────────────────────

def test_history_service_save_and_get_result(in_memory_db, setup_users_and_doc, temp_storage):
    user_a, user_b, doc_a = setup_users_and_doc
    storage, _ = temp_storage

    # Inject mock storage service into HistoryService
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        # Create PENDING history
        history_rec = HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_a.id,
                document_id=doc_a.id,
                action_type=ActionType.TRANSLATE,
                status=ProcessingStatus.PENDING,
            ),
        )

        result_payload = {
            "original_text": "Abstract: Neural networks.",
            "translated_text": "Tóm tắt: Mạng nơ-ron.",
            "target_lang": "vi",
            "engine_used": "deep-translator",
            "page_count": 5,
            "is_ocr_used": False,
        }

        # Save result
        updated_history = HistoryService.save_history_result(
            in_memory_db,
            history_id=history_rec.id,
            user_id=user_a.id,
            result_data=result_payload,
            execution_time_ms=1250,
        )

        assert updated_history.status == ProcessingStatus.SUCCESS
        assert updated_history.result_path is not None
        assert updated_history.execution_time_ms == 1250
        assert updated_history.error_message is None

        # Retrieve result as owner (User A)
        fetched_result = HistoryService.get_history_result(
            in_memory_db,
            history_id=history_rec.id,
            current_user_id=user_a.id,
        )
        assert fetched_result["history_id"] == history_rec.id
        assert fetched_result["document_id"] == doc_a.id
        assert fetched_result["original_text"] == result_payload["original_text"]
        assert fetched_result["translated_text"] == result_payload["translated_text"]
        assert fetched_result["document_filename"] == "research_paper.pdf"

        # Anti-IDOR: User B cannot retrieve User A's result (404 NotFoundException)
        with pytest.raises(NotFoundException) as exc_info:
            HistoryService.get_history_result(
                in_memory_db,
                history_id=history_rec.id,
                current_user_id=user_b.id,
            )
        assert f"ID {history_rec.id} không tồn tại" in str(exc_info.value.message)

    finally:
        HistoryService.storage_service = orig_storage


def test_history_service_save_result_forbidden_and_not_found(in_memory_db, setup_users_and_doc):
    user_a, user_b, doc_a = setup_users_and_doc

    history_rec = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.PENDING,
        ),
    )

    # Attempt saving result by user_b (forbidden)
    with pytest.raises(ForbiddenException):
        HistoryService.save_history_result(
            in_memory_db,
            history_id=history_rec.id,
            user_id=user_b.id,
            result_data={"text": "forbidden"},
        )

    # Attempt saving result for non-existent history
    with pytest.raises(NotFoundException):
        HistoryService.save_history_result(
            in_memory_db,
            history_id=999999,
            user_id=user_a.id,
            result_data={"text": "none"},
        )


def test_history_service_get_result_pending_and_failed_states(in_memory_db, setup_users_and_doc):
    user_a, _, doc_a = setup_users_and_doc

    # 1. Pending history
    pending_rec = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.TRANSLATE,
            status=ProcessingStatus.PENDING,
        ),
    )
    with pytest.raises(BadRequestException) as pending_err:
        HistoryService.get_history_result(
            in_memory_db,
            history_id=pending_rec.id,
            current_user_id=user_a.id,
        )
    assert pending_err.value.error_code == "RESULT_PENDING"

    # 2. Failed history
    failed_rec = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.FAILED,
            error_message="OCR engine crashed.",
        ),
        reuse_pending=False,
    )
    with pytest.raises(BadRequestException) as failed_err:
        HistoryService.get_history_result(
            in_memory_db,
            history_id=failed_rec.id,
            current_user_id=user_a.id,
        )
    assert failed_err.value.error_code == "RESULT_FAILED"


def test_history_service_get_result_file_missing_on_disk(in_memory_db, setup_users_and_doc, temp_storage):
    user_a, _, doc_a = setup_users_and_doc
    storage, _ = temp_storage
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        history_rec = HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_a.id,
                document_id=doc_a.id,
                action_type=ActionType.TRANSLATE,
                status=ProcessingStatus.PENDING,
            ),
        )

        HistoryService.save_history_result(
            in_memory_db,
            history_id=history_rec.id,
            user_id=user_a.id,
            result_data={"translated_text": "temporary"},
        )

        # Manually delete physical result file from disk
        storage.delete_result_file(user_a.id, history_rec.result_path)

        # Retrieval must fail cleanly with RESULT_FILE_MISSING
        with pytest.raises(NotFoundException) as missing_err:
            HistoryService.get_history_result(
                in_memory_db,
                history_id=history_rec.id,
                current_user_id=user_a.id,
            )
        assert missing_err.value.details.get("error_code") == "RESULT_FILE_MISSING"

    finally:
        HistoryService.storage_service = orig_storage


# ── 3. GET /api/history/{history_id}/result API Endpoint ────────────────────

def test_api_route_registered_and_response_schema():
    """Verify route registration and OpenAPI contract."""
    route = next(
        (r for r in history_router.routes if getattr(r, "path", None) == "/api/history/{history_id}/result"),
        None,
    )
    assert route is not None
    assert "GET" in route.methods
    assert route.response_model == ApiResponse[ProcessingResultResponse]


def test_api_get_history_result_success(in_memory_db, setup_users_and_doc, temp_storage):
    user_a, _, doc_a = setup_users_and_doc
    storage, _ = temp_storage
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        history_rec = HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_a.id,
                document_id=doc_a.id,
                action_type=ActionType.TRANSLATE,
                status=ProcessingStatus.PENDING,
            ),
        )

        HistoryService.save_history_result(
            in_memory_db,
            history_id=history_rec.id,
            user_id=user_a.id,
            result_data={
                "original_text": "Deep Learning Architecture.",
                "translated_text": "Kiến trúc học sâu.",
                "target_lang": "vi",
                "engine_used": "deep-translator",
                "page_count": 3,
                "is_ocr_used": True,
            },
        )

        response = _run_async(
            get_history_result(
                history_id=history_rec.id,
                current_user=user_a,
                db=in_memory_db,
            )
        )

        assert response.success is True
        assert isinstance(response.data, ProcessingResultResponse)
        assert response.data.history_id == history_rec.id
        assert response.data.document_id == doc_a.id
        assert response.data.original_text == "Deep Learning Architecture."
        assert response.data.translated_text == "Kiến trúc học sâu."
        assert response.data.document_filename == "research_paper.pdf"
        assert response.data.is_ocr_used is True

    finally:
        HistoryService.storage_service = orig_storage


def test_api_get_history_result_anti_idor(in_memory_db, setup_users_and_doc, temp_storage):
    user_a, user_b, doc_a = setup_users_and_doc
    storage, _ = temp_storage
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        history_rec = HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_a.id,
                document_id=doc_a.id,
                action_type=ActionType.TRANSLATE,
                status=ProcessingStatus.PENDING,
            ),
        )

        HistoryService.save_history_result(
            in_memory_db,
            history_id=history_rec.id,
            user_id=user_a.id,
            result_data={"translated_text": "secret content"},
        )

        # Bob requests Alice's history result -> 404 NotFound
        with pytest.raises(NotFoundException):
            _run_async(
                get_history_result(
                    history_id=history_rec.id,
                    current_user=user_b,
                    db=in_memory_db,
                )
            )

    finally:
        HistoryService.storage_service = orig_storage


def test_api_get_history_result_invalid_id_raises_bad_request(in_memory_db, setup_users_and_doc):
    user_a, _, _ = setup_users_and_doc
    with pytest.raises(BadRequestException):
        _run_async(
            get_history_result(
                history_id=0,
                current_user=user_a,
                db=in_memory_db,
            )
        )
