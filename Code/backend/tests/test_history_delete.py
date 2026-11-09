"""
Unit & Integration Test Suite for Processing History Deletion & Retention Cleanup (PDFL-166.1)
----------------------------------------------------------------------------------------------
Covers:
1. HistoryService.delete_history:
   - Successful deletion of database record and physical result file.
   - Non-existent history ID raises NotFoundException (404).
   - Multi-tenant isolation (Anti-IDOR): Attempting to delete another user's record raises NotFoundException (404).
   - Graceful handling when result file was already deleted or missing on disk.
   - Protection of original PDF documents (documents table and files are NEVER deleted).
   - Transactional consistency: DB commit failure restores deleted file from memory.
2. HistoryService.cleanup_expired_histories:
   - Cleans up only records older than retention threshold (older_than_days).
   - Preserves PENDING records currently in processing regardless of age.
   - Cleans up corresponding physical result JSON files.
   - Tenant isolation: Never touches another user's history records or files.
   - Default retention period fallback (settings.HISTORY_RETENTION_DAYS).
   - Multi-tenant forbidden check (ForbiddenException).
3. API Endpoints:
   - DELETE /api/history/{history_id}: Contract, response schema, invalid IDs, Anti-IDOR.
   - POST /api/history/cleanup: Contract, response schema, query param validation, auth dependency.
"""

import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Coroutine, TypeVar
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.history import cleanup_expired_histories, delete_history_record, router as history_router
from app.core.config import settings
from app.core.database import Base
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse
from app.schemas.processing_history import (
    HistoryCleanupResponse,
    HistoryDeleteResponse,
    ProcessingHistoryCreate,
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
    """Isolated in-memory SQLite database session with foreign keys enabled."""
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
    """Temporary storage directory for testing result persistence and cleanup."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        service = StorageService(base_dir=tmp_dir)
        yield service, Path(tmp_dir)


@pytest.fixture()
def setup_users_and_doc(in_memory_db, temp_storage):
    """Seed two users and a document with physical file for deletion safety tests."""
    storage, base_path = temp_storage
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

    # Save real document file
    stored_fn, rel_path, abs_path = storage.save_document_file(
        user_id=user_a.id,
        original_filename="thesis_chapter1.pdf",
        content=b"%PDF-1.4 Mock PDF content for testing safety.",
    )

    doc_a = Document(
        user_id=user_a.id,
        original_filename="thesis_chapter1.pdf",
        stored_filename=stored_fn,
        stored_path=rel_path,
        file_size_bytes=42,
        page_count=3,
        target_lang="vi",
        is_ocr_used=False,
    )
    in_memory_db.add(doc_a)
    in_memory_db.commit()
    in_memory_db.refresh(doc_a)

    return user_a, user_b, doc_a, abs_path


# ── 1. Single History Record Deletion Tests ──────────────────────────────────

def test_delete_history_success_with_result_file(in_memory_db, setup_users_and_doc, temp_storage):
    """Verify that deleting history removes DB record and result JSON, but keeps Document & PDF."""
    user_a, _, doc_a, pdf_path = setup_users_and_doc
    storage, _ = temp_storage
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        # Create history and save result
        hist_rec = HistoryService.create_history(
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
            history_id=hist_rec.id,
            user_id=user_a.id,
            result_data={"translated_text": "Chương 1 Luận văn"},
        )

        result_path = hist_rec.result_path
        abs_result_path = storage.get_result_path(user_a.id, result_path)
        assert abs_result_path is not None and abs_result_path.is_file()

        # Delete history
        success = HistoryService.delete_history(
            in_memory_db,
            history_id=hist_rec.id,
            current_user_id=user_a.id,
        )
        assert success is True

        # Verify ProcessingHistory deleted from DB
        db_record = in_memory_db.query(ProcessingHistory).filter(ProcessingHistory.id == hist_rec.id).first()
        assert db_record is None

        # Verify result JSON file deleted from disk
        assert not abs_result_path.exists()

        # CRITICAL SAFETY: Original Document and physical PDF MUST NOT be deleted!
        reloaded_doc = in_memory_db.query(Document).filter(Document.id == doc_a.id).first()
        assert reloaded_doc is not None
        assert pdf_path.is_file()

    finally:
        HistoryService.storage_service = orig_storage


def test_delete_history_success_when_result_file_missing(in_memory_db, setup_users_and_doc, temp_storage):
    """Verify that deleting history proceeds smoothly if the result file was already deleted."""
    user_a, _, doc_a, _ = setup_users_and_doc
    storage, _ = temp_storage
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        hist_rec = HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_a.id,
                document_id=doc_a.id,
                action_type=ActionType.EXTRACT,
                status=ProcessingStatus.PENDING,
            ),
        )

        HistoryService.save_history_result(
            in_memory_db,
            history_id=hist_rec.id,
            user_id=user_a.id,
            result_data={"original_text": "Extracted text"},
        )

        # Prematurely delete physical result file
        storage.delete_result_file(user_a.id, hist_rec.result_path)

        # Deleting history must not crash and must delete DB record
        deleted = HistoryService.delete_history(
            in_memory_db,
            history_id=hist_rec.id,
            current_user_id=user_a.id,
        )
        assert deleted is True

        db_record = in_memory_db.query(ProcessingHistory).filter(ProcessingHistory.id == hist_rec.id).first()
        assert db_record is None

    finally:
        HistoryService.storage_service = orig_storage


def test_delete_history_not_found(in_memory_db, setup_users_and_doc):
    """Verify that attempting to delete a non-existent history ID raises NotFoundException."""
    user_a, _, _, _ = setup_users_and_doc
    with pytest.raises(NotFoundException) as exc_info:
        HistoryService.delete_history(
            in_memory_db,
            history_id=999999,
            current_user_id=user_a.id,
        )
    assert "999999 không tồn tại" in exc_info.value.message


def test_delete_history_anti_idor(in_memory_db, setup_users_and_doc, temp_storage):
    """Verify Anti-IDOR: Bob cannot delete Alice's history record, and Alice's data remains intact."""
    user_a, user_b, doc_a, _ = setup_users_and_doc
    storage, _ = temp_storage
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        alice_hist = HistoryService.create_history(
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
            history_id=alice_hist.id,
            user_id=user_a.id,
            result_data={"translated_text": "Alice private translation"},
        )

        result_path = alice_hist.result_path
        abs_result_path = storage.get_result_path(user_a.id, result_path)

        # Bob attempts to delete Alice's history -> 404 NotFound
        with pytest.raises(NotFoundException):
            HistoryService.delete_history(
                in_memory_db,
                history_id=alice_hist.id,
                current_user_id=user_b.id,
            )

        # Alice's history in DB and file on disk MUST still exist
        reloaded = in_memory_db.query(ProcessingHistory).filter(ProcessingHistory.id == alice_hist.id).first()
        assert reloaded is not None
        assert abs_result_path.is_file()

    finally:
        HistoryService.storage_service = orig_storage


def test_delete_history_pending_raises_bad_request(in_memory_db, setup_users_and_doc):
    """Verify that attempting to delete a PENDING history raises BadRequestException."""
    user_a, _, doc_a, _ = setup_users_and_doc
    pending_hist = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.TRANSLATE,
            status=ProcessingStatus.PENDING,
        ),
    )

    with pytest.raises(BadRequestException) as exc_info:
        HistoryService.delete_history(
            in_memory_db,
            history_id=pending_hist.id,
            current_user_id=user_a.id,
        )
    assert "Không thể xóa bản ghi đang trong tiến trình xử lý" in exc_info.value.message


def test_delete_history_db_commit_error_restores_file(in_memory_db, setup_users_and_doc, temp_storage):
    """Verify that if DB commit fails during deletion, the deleted file is restored on rollback."""
    user_a, _, doc_a, _ = setup_users_and_doc
    storage, _ = temp_storage
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        hist_rec = HistoryService.create_history(
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
            history_id=hist_rec.id,
            user_id=user_a.id,
            result_data={"translated_text": "Precious translation content"},
        )

        abs_result_path = storage.get_result_path(user_a.id, hist_rec.result_path)
        assert abs_result_path.is_file()

        # Simulate DB error during commit
        with patch.object(in_memory_db, "commit", side_effect=SQLAlchemyError("DB disk full")):
            with pytest.raises(SQLAlchemyError):
                HistoryService.delete_history(
                    in_memory_db,
                    history_id=hist_rec.id,
                    current_user_id=user_a.id,
                )

        # Result file MUST have been restored from in-memory backup
        assert abs_result_path.is_file()
        content = abs_result_path.read_text(encoding="utf-8")
        assert "Precious translation content" in content

        # DB record MUST still exist
        in_memory_db.rollback()
        assert in_memory_db.query(ProcessingHistory).filter(ProcessingHistory.id == hist_rec.id).first() is not None

    finally:
        HistoryService.storage_service = orig_storage


# ── 2. Retention Policy Cleanup Tests ────────────────────────────────────────

def test_cleanup_expired_histories_retention_and_isolation(in_memory_db, setup_users_and_doc, temp_storage):
    """
    Verify cleanup_expired_histories:
    - Deletes only records older than cutoff date.
    - Preserves PENDING records regardless of age.
    - Cleans up associated result JSON files.
    - Preserves other users' records even if they are old.
    """
    user_a, user_b, doc_a, _ = setup_users_and_doc
    storage, _ = temp_storage
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        now = datetime.now(timezone.utc)
        date_45_days_ago = now - timedelta(days=45)
        date_5_days_ago = now - timedelta(days=5)

        # 1. User A - Expired record (45 days old, SUCCESS) -> SHOULD BE DELETED
        rec1 = ProcessingHistory(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.TRANSLATE,
            status=ProcessingStatus.SUCCESS,
            created_at=date_45_days_ago,
            updated_at=date_45_days_ago,
        )
        in_memory_db.add(rec1)
        in_memory_db.commit()
        in_memory_db.refresh(rec1)
        rel1, abs1 = storage.save_result_file(user_a.id, rec1.id, {"text": "old translated result"})
        rec1.result_path = rel1
        in_memory_db.commit()

        # 2. User A - Old PENDING record (45 days old, PENDING) -> MUST BE PRESERVED
        rec2 = ProcessingHistory(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.PENDING,
            created_at=date_45_days_ago,
            updated_at=date_45_days_ago,
        )
        in_memory_db.add(rec2)
        in_memory_db.commit()
        in_memory_db.refresh(rec2)

        # 3. User A - Recent record (5 days old, SUCCESS) -> MUST BE PRESERVED
        rec3 = ProcessingHistory(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.SUMMARIZE,
            status=ProcessingStatus.SUCCESS,
            created_at=date_5_days_ago,
            updated_at=date_5_days_ago,
        )
        in_memory_db.add(rec3)
        in_memory_db.commit()
        in_memory_db.refresh(rec3)
        rel3, abs3 = storage.save_result_file(user_a.id, rec3.id, {"text": "recent summary"})
        rec3.result_path = rel3
        in_memory_db.commit()

        # 4. User B - Old record (45 days old, SUCCESS) -> MUST NOT BE TOUCHED BY USER A
        doc_b = Document(
            user_id=user_b.id,
            original_filename="bob_doc.pdf",
            stored_filename="bob_uuid.pdf",
            stored_path=f"{user_b.id}/bob_uuid.pdf",
            file_size_bytes=100,
            page_count=1,
            target_lang="vi",
            is_ocr_used=False,
        )
        in_memory_db.add(doc_b)
        in_memory_db.commit()

        rec_b = ProcessingHistory(
            user_id=user_b.id,
            document_id=doc_b.id,
            action_type=ActionType.TRANSLATE,
            status=ProcessingStatus.SUCCESS,
            created_at=date_45_days_ago,
            updated_at=date_45_days_ago,
        )
        in_memory_db.add(rec_b)
        in_memory_db.commit()
        in_memory_db.refresh(rec_b)
        rel_b, abs_b = storage.save_result_file(user_b.id, rec_b.id, {"text": "bob old result"})
        rec_b.result_path = rel_b
        in_memory_db.commit()

        # Run cleanup for User A older than 30 days
        result = HistoryService.cleanup_expired_histories(
            in_memory_db,
            user_id=user_a.id,
            older_than_days=30,
            current_user_id=user_a.id,
        )

        assert result["deleted_count"] == 1
        assert result["older_than_days"] == 30

        # Rec 1 deleted from DB and file removed
        assert in_memory_db.query(ProcessingHistory).filter(ProcessingHistory.id == rec1.id).first() is None
        assert not abs1.exists()

        # Rec 2 (PENDING) preserved
        assert in_memory_db.query(ProcessingHistory).filter(ProcessingHistory.id == rec2.id).first() is not None

        # Rec 3 (recent) preserved and file intact
        assert in_memory_db.query(ProcessingHistory).filter(ProcessingHistory.id == rec3.id).first() is not None
        assert abs3.is_file()

        # User B's record and file preserved
        assert in_memory_db.query(ProcessingHistory).filter(ProcessingHistory.id == rec_b.id).first() is not None
        assert abs_b.is_file()

    finally:
        HistoryService.storage_service = orig_storage


def test_cleanup_expired_histories_default_retention_days(in_memory_db, setup_users_and_doc):
    """Verify that omitting older_than_days defaults to settings.HISTORY_RETENTION_DAYS."""
    user_a, _, _, _ = setup_users_and_doc
    result = HistoryService.cleanup_expired_histories(
        in_memory_db,
        user_id=user_a.id,
        older_than_days=None,
        current_user_id=user_a.id,
    )
    assert result["older_than_days"] == settings.HISTORY_RETENTION_DAYS
    assert result["deleted_count"] == 0


def test_cleanup_expired_histories_forbidden_other_user(in_memory_db, setup_users_and_doc):
    """Verify that a user cannot trigger cleanup on another user's history."""
    user_a, user_b, _, _ = setup_users_and_doc
    with pytest.raises(ForbiddenException):
        HistoryService.cleanup_expired_histories(
            in_memory_db,
            user_id=user_b.id,
            older_than_days=30,
            current_user_id=user_a.id,
        )


# ── 3. API Endpoints Tests ───────────────────────────────────────────────────

def test_api_routes_registered():
    """Verify DELETE /api/history/{history_id} and POST /api/history/cleanup route contracts."""
    delete_route = next(
        (r for r in history_router.routes if getattr(r, "path", None) == "/api/history/{history_id}" and "DELETE" in r.methods),
        None,
    )
    assert delete_route is not None
    assert delete_route.response_model == ApiResponse[HistoryDeleteResponse]

    cleanup_route = next(
        (r for r in history_router.routes if getattr(r, "path", None) == "/api/history/cleanup" and "POST" in r.methods),
        None,
    )
    assert cleanup_route is not None
    assert cleanup_route.response_model == ApiResponse[HistoryCleanupResponse]


def test_api_delete_history_endpoint(in_memory_db, setup_users_and_doc, temp_storage):
    """Verify DELETE /api/history/{history_id} endpoint success and schema."""
    user_a, _, doc_a, _ = setup_users_and_doc
    storage, _ = temp_storage
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        hist_rec = HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_a.id,
                document_id=doc_a.id,
                action_type=ActionType.TRANSLATE,
                status=ProcessingStatus.SUCCESS,
            ),
        )

        response = _run_async(
            delete_history_record(
                history_id=hist_rec.id,
                current_user=user_a,
                db=in_memory_db,
            )
        )

        assert response.success is True
        assert isinstance(response.data, HistoryDeleteResponse)
        assert response.data.id == hist_rec.id
        assert response.data.deleted is True

        # Invalid ID boundary check
        with pytest.raises(BadRequestException):
            _run_async(
                delete_history_record(
                    history_id=0,
                    current_user=user_a,
                    db=in_memory_db,
                )
            )

        # Deleting a PENDING history via API raises BadRequestException
        pending_rec = HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_a.id,
                document_id=doc_a.id,
                action_type=ActionType.TRANSLATE,
                status=ProcessingStatus.PENDING,
            ),
        )
        with pytest.raises(BadRequestException) as bad_req_exc:
            _run_async(
                delete_history_record(
                    history_id=pending_rec.id,
                    current_user=user_a,
                    db=in_memory_db,
                )
            )
        assert "tiến trình xử lý" in bad_req_exc.value.message

    finally:
        HistoryService.storage_service = orig_storage


def test_api_cleanup_endpoint(in_memory_db, setup_users_and_doc):
    """Verify POST /api/history/cleanup endpoint success and schema."""
    user_a, _, _, _ = setup_users_and_doc
    response = _run_async(
        cleanup_expired_histories(
            older_than_days=15,
            current_user=user_a,
            db=in_memory_db,
        )
    )

    assert response.success is True
    assert isinstance(response.data, HistoryCleanupResponse)
    assert response.data.older_than_days == 15
    assert response.data.deleted_count == 0
    assert response.data.cutoff_date is not None


def test_history_full_lifecycle_and_document_safety(in_memory_db, setup_users_and_doc, temp_storage):
    """
    End-to-end integration test (PDFL-166.3):
    1. Create history record
    2. Save and open/verify result
    3. Delete history record
    4. Confirm result is no longer accessible (404)
    5. Confirm original Document and physical PDF still exist completely intact.
    """
    user_a, _, doc_a, pdf_path = setup_users_and_doc
    storage, _ = temp_storage
    orig_storage = HistoryService.storage_service
    HistoryService.storage_service = storage

    try:
        # Step 1: Create history record
        hist_rec = HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_a.id,
                document_id=doc_a.id,
                action_type=ActionType.TRANSLATE,
                status=ProcessingStatus.SUCCESS,
                execution_time_ms=1250,
            ),
        )
        assert hist_rec.id is not None

        # Step 2: Save processing result
        result_payload = {
            "action_type": "TRANSLATE",
            "document_filename": doc_a.original_filename,
            "original_text": "Hello world from PDF",
            "translated_text": "Xin chào thế giới từ PDF",
        }
        saved_hist = HistoryService.save_history_result(
            in_memory_db,
            history_id=hist_rec.id,
            user_id=user_a.id,
            result_data=result_payload,
        )
        assert saved_hist.result_path is not None

        # Retrieve and verify result is readable
        retrieved_result = HistoryService.get_history_result(
            in_memory_db,
            history_id=hist_rec.id,
            current_user_id=user_a.id,
        )
        assert retrieved_result["original_text"] == "Hello world from PDF"
        assert retrieved_result["translated_text"] == "Xin chào thế giới từ PDF"

        # Step 3: Delete history record via API
        del_response = _run_async(
            delete_history_record(
                history_id=hist_rec.id,
                current_user=user_a,
                db=in_memory_db,
            )
        )
        assert del_response.success is True
        assert del_response.data.deleted is True

        # Step 4: Confirm result is no longer accessible (raises NotFoundException)
        with pytest.raises(NotFoundException):
            HistoryService.get_history_result(
                in_memory_db,
                history_id=hist_rec.id,
                current_user_id=user_a.id,
            )

        # Step 5: Confirm Document and PDF file on disk are 100% preserved
        db_doc = in_memory_db.query(Document).filter(Document.id == doc_a.id).first()
        assert db_doc is not None
        assert db_doc.original_filename == "thesis_chapter1.pdf"
        assert pdf_path.is_file()
        assert pdf_path.read_bytes() == b"%PDF-1.4 Mock PDF content for testing safety."

    finally:
        HistoryService.storage_service = orig_storage
