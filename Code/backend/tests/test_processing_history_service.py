"""
Unit Tests for Processing History Schema & Service Layer (PDFL-159.3)
--------------------------------------------------------------------
Covers:
1. Pydantic Schemas (`ProcessingHistoryBase`, `ProcessingHistoryCreate`,
   `ProcessingHistoryUpdate`, `ProcessingHistoryResponse`):
   - Enum normalization and validations.
   - Execution time constraints (ge=0).
   - Sensitive path and traceback sanitization in `error_message`.
   - Consistency check: error_message cleared on SUCCESS status.
   - Timestamp validation: updated_at >= created_at.
2. `HistoryService`:
   - Creation of history records with document ownership verification.
   - Prevention of duplicate in-flight PENDING records.
   - Status transitions (PENDING -> SUCCESS, PENDING -> FAILED).
   - Execution time and error message persistence.
   - Querying methods (by ID, by user, by document) with pagination and filters.
   - Multi-tenant data isolation and Anti-IDOR guards (ForbiddenException).
   - Transaction commit and automatic rollback handling on DB errors.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from app.schemas.processing_history import (
    ProcessingHistoryCreate,
    ProcessingHistoryResponse,
    ProcessingHistoryUpdate,
    sanitize_error_message,
)
from app.services.history_service import HistoryService


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


def _seed_user_and_doc(session, email: str = "alice@example.com") -> tuple[User, Document]:
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


# ── 1. Schema Unit Tests ─────────────────────────────────────────────────────


def test_schema_valid_normalization():
    payload = ProcessingHistoryCreate(
        user_id=1,
        document_id=10,
        action_type="extract",
        status="pending",
        execution_time_ms=0,
    )
    assert payload.action_type == ActionType.EXTRACT
    assert payload.status == ProcessingStatus.PENDING
    assert payload.execution_time_ms == 0
    assert payload.error_message is None


def test_schema_invalid_action_and_status():
    with pytest.raises(ValueError, match="action_type không hợp lệ"):
        ProcessingHistoryCreate(
            user_id=1,
            document_id=10,
            action_type="INVALID_ACTION",
        )

    with pytest.raises(ValueError, match="status không hợp lệ"):
        ProcessingHistoryCreate(
            user_id=1,
            document_id=10,
            action_type=ActionType.TRANSLATE,
            status="INVALID_STATUS",
        )


def test_schema_rejects_negative_execution_time_and_invalid_ids():
    with pytest.raises(ValueError):
        ProcessingHistoryCreate(
            user_id=1,
            document_id=10,
            action_type=ActionType.TRANSLATE,
            execution_time_ms=-10,
        )

    with pytest.raises(ValueError):
        ProcessingHistoryCreate(
            user_id=0,
            document_id=10,
            action_type=ActionType.SUMMARIZE,
        )

    with pytest.raises(ValueError):
        ProcessingHistoryCreate(
            user_id=1,
            document_id=-5,
            action_type=ActionType.SUMMARIZE,
        )


def test_schema_sanitizes_error_message():
    raw_error = (
        "Traceback (most recent call last):\n"
        '  File "C:\\Users\\ADMIN\\workspace\\PDF-Lingua\\ocr.py", line 88\n'
        "RuntimeError: Failed reading /home/ubuntu/secrets/doc.pdf: timeout"
    )
    cleaned = sanitize_error_message(raw_error)
    assert cleaned is not None
    assert "C:\\Users\\ADMIN" not in cleaned
    assert "/home/ubuntu" not in cleaned
    assert "[redacted-path]" in cleaned

    # SUCCESS status clears residual error_message
    update_ok = ProcessingHistoryUpdate(
        status=ProcessingStatus.SUCCESS,
        execution_time_ms=120,
        error_message="Should be automatically cleared",
    )
    assert update_ok.error_message is None

    # FAILED status provides default error message if empty
    update_fail = ProcessingHistoryUpdate(
        status=ProcessingStatus.FAILED,
        execution_time_ms=45,
    )
    assert "thất bại" in update_fail.error_message


def test_schema_response_timestamp_check():
    now = datetime.now(timezone.utc)
    res_valid = ProcessingHistoryResponse(
        id=1,
        user_id=1,
        document_id=10,
        action_type=ActionType.SUMMARIZE,
        status=ProcessingStatus.SUCCESS,
        created_at=now,
        updated_at=now + timedelta(seconds=1),
    )
    assert res_valid.id == 1

    with pytest.raises(ValueError, match="updated_at không được nhỏ hơn created_at"):
        ProcessingHistoryResponse(
            id=1,
            user_id=1,
            document_id=10,
            action_type=ActionType.SUMMARIZE,
            status=ProcessingStatus.SUCCESS,
            created_at=now,
            updated_at=now - timedelta(seconds=5),
        )


# ── 2. Service Unit Tests: Create & Update Lifecycle ─────────────────────────


def test_create_history_success_and_reuse_pending(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db)

    create_payload = ProcessingHistoryCreate(
        user_id=user.id,
        document_id=doc.id,
        action_type=ActionType.EXTRACT,
    )
    rec1 = HistoryService.create_history(
        in_memory_db,
        create_payload,
        current_user_id=user.id,
        reuse_pending=True,
    )
    assert rec1.id is not None
    assert rec1.status == ProcessingStatus.PENDING
    assert rec1.action_type == ActionType.EXTRACT

    # Calling create_history again with reuse_pending=True should return existing record
    rec2 = HistoryService.create_history(
        in_memory_db,
        create_payload,
        current_user_id=user.id,
        reuse_pending=True,
    )
    assert rec2.id == rec1.id


def test_create_history_ownership_checks(in_memory_db):
    user_a, doc_a = _seed_user_and_doc(in_memory_db, email="alice@test.com")
    user_b, doc_b = _seed_user_and_doc(in_memory_db, email="bob@test.com")

    # 1. User B tries to create history for doc_a owned by User A -> ForbiddenException
    with pytest.raises(ForbiddenException, match="không có quyền truy cập tài liệu"):
        HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_b.id,
                document_id=doc_a.id,
                action_type=ActionType.TRANSLATE,
            ),
            current_user_id=user_b.id,
        )

    # 2. current_user_id mismatch with data.user_id -> ForbiddenException
    with pytest.raises(ForbiddenException, match="không có quyền tạo bản ghi lịch sử cho người dùng khác"):
        HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_a.id,
                document_id=doc_a.id,
                action_type=ActionType.TRANSLATE,
            ),
            current_user_id=user_b.id,
        )

    # 3. Target document does not exist -> NotFoundException
    with pytest.raises(NotFoundException, match="không tồn tại"):
        HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user_a.id,
                document_id=999999,
                action_type=ActionType.TRANSLATE,
            ),
            current_user_id=user_a.id,
        )


def test_mark_success_and_failed(in_memory_db):
    user, doc = _seed_user_and_doc(in_memory_db)

    rec = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user.id,
            document_id=doc.id,
            action_type=ActionType.TRANSLATE,
        ),
        current_user_id=user.id,
    )

    # Mark SUCCESS
    success_rec = HistoryService.mark_success(
        in_memory_db,
        rec.id,
        execution_time_ms=350,
        current_user_id=user.id,
    )
    assert success_rec.status == ProcessingStatus.SUCCESS
    assert success_rec.execution_time_ms == 350
    assert success_rec.error_message is None

    # Mark FAILED
    fail_rec = HistoryService.mark_failed(
        in_memory_db,
        rec.id,
        error_message="Translation API timeout at C:\\Users\\ADMIN\\secret.py",
        execution_time_ms=500,
        current_user_id=user.id,
    )
    assert fail_rec.status == ProcessingStatus.FAILED
    assert fail_rec.execution_time_ms == 500
    assert "Translation API timeout" in fail_rec.error_message
    assert "C:\\Users\\ADMIN" not in fail_rec.error_message


def test_update_status_forbidden_for_other_user(in_memory_db):
    user_a, doc_a = _seed_user_and_doc(in_memory_db, email="alice@test.com")
    user_b, _ = _seed_user_and_doc(in_memory_db, email="bob@test.com")

    rec = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.EXTRACT,
        ),
        current_user_id=user_a.id,
    )

    # User B tries to update User A's history -> ForbiddenException
    with pytest.raises(ForbiddenException, match="không có quyền cập nhật"):
        HistoryService.update_status(
            in_memory_db,
            history_id=rec.id,
            status=ProcessingStatus.SUCCESS,
            current_user_id=user_b.id,
        )


# ── 3. Service Unit Tests: Querying and Multi-Tenant Isolation ───────────────


def test_get_history_by_id_and_ownership(in_memory_db):
    user_a, doc_a = _seed_user_and_doc(in_memory_db, email="alice@test.com")
    user_b, _ = _seed_user_and_doc(in_memory_db, email="bob@test.com")

    rec = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.SUMMARIZE,
        ),
        current_user_id=user_a.id,
    )

    # Owner can retrieve record
    retrieved = HistoryService.get_history_by_id(in_memory_db, rec.id, current_user_id=user_a.id)
    assert retrieved is not None
    assert retrieved.id == rec.id

    # Non-owner is blocked with ForbiddenException
    with pytest.raises(ForbiddenException, match="không có quyền truy cập"):
        HistoryService.get_history_by_id(in_memory_db, rec.id, current_user_id=user_b.id)

    # Non-existent ID returns None
    assert HistoryService.get_history_by_id(in_memory_db, 999999, current_user_id=user_a.id) is None


def test_get_histories_by_user_filters_and_pagination(in_memory_db):
    user_a, doc_a = _seed_user_and_doc(in_memory_db, email="alice@test.com")
    user_b, doc_b = _seed_user_and_doc(in_memory_db, email="bob@test.com")

    # Add 3 records for User A
    h1 = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(user_id=user_a.id, document_id=doc_a.id, action_type=ActionType.EXTRACT, status=ProcessingStatus.SUCCESS),
        reuse_pending=False,
    )
    h2 = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(user_id=user_a.id, document_id=doc_a.id, action_type=ActionType.TRANSLATE, status=ProcessingStatus.SUCCESS),
        reuse_pending=False,
    )
    h3 = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(user_id=user_a.id, document_id=doc_a.id, action_type=ActionType.SUMMARIZE, status=ProcessingStatus.FAILED),
        reuse_pending=False,
    )
    # Add 1 record for User B
    HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(user_id=user_b.id, document_id=doc_b.id, action_type=ActionType.EXTRACT),
        reuse_pending=False,
    )

    # User A gets all their own histories (count = 3)
    user_a_histories = HistoryService.get_histories_by_user(in_memory_db, user_a.id, current_user_id=user_a.id)
    assert len(user_a_histories) == 3
    assert HistoryService.count_histories_by_user(in_memory_db, user_a.id, current_user_id=user_a.id) == 3

    # Filter by action_type
    extract_only = HistoryService.get_histories_by_user(in_memory_db, user_a.id, current_user_id=user_a.id, action_type=ActionType.EXTRACT)
    assert len(extract_only) == 1
    assert extract_only[0].action_type == ActionType.EXTRACT

    # Filter by status
    failed_only = HistoryService.get_histories_by_user(in_memory_db, user_a.id, current_user_id=user_a.id, status=ProcessingStatus.FAILED)
    assert len(failed_only) == 1
    assert failed_only[0].action_type == ActionType.SUMMARIZE

    # Pagination limit
    paged = HistoryService.get_histories_by_user(in_memory_db, user_a.id, current_user_id=user_a.id, skip=0, limit=2)
    assert len(paged) == 2

    # User B cannot access User A's history
    with pytest.raises(ForbiddenException):
        HistoryService.get_histories_by_user(in_memory_db, user_a.id, current_user_id=user_b.id)

    with pytest.raises(ForbiddenException):
        HistoryService.count_histories_by_user(in_memory_db, user_a.id, current_user_id=user_b.id)


def test_get_histories_by_document_and_isolation(in_memory_db):
    user_a, doc_a = _seed_user_and_doc(in_memory_db, email="alice@test.com")
    user_b, doc_b = _seed_user_and_doc(in_memory_db, email="bob@test.com")

    h = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(user_id=user_a.id, document_id=doc_a.id, action_type=ActionType.EXTRACT),
        reuse_pending=False,
    )

    # User A accesses their document's history
    doc_histories = HistoryService.get_histories_by_document(in_memory_db, doc_a.id, current_user_id=user_a.id)
    assert len(doc_histories) == 1
    assert doc_histories[0].id == h.id

    # User B cannot access User A's document history
    with pytest.raises(ForbiddenException):
        HistoryService.get_histories_by_document(in_memory_db, doc_a.id, current_user_id=user_b.id)


def test_db_rollback_on_commit_error():
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.id = 10
    mock_doc.user_id = 1
    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc
    mock_db.commit.side_effect = SQLAlchemyError("Simulated database failure")

    with pytest.raises(SQLAlchemyError):
        HistoryService.create_history(
            mock_db,
            ProcessingHistoryCreate(user_id=1, document_id=10, action_type=ActionType.EXTRACT),
            reuse_pending=False,
        )
    assert mock_db.rollback.called


def test_update_status_and_count_rollback_on_query_error():
    """Verify `update_status` and `count_histories_by_user` call `db.rollback()` when `db.query` fails (AUDIT-05)."""
    mock_db = MagicMock()
    mock_db.query.side_effect = SQLAlchemyError("Database connection lost during query")

    with pytest.raises(SQLAlchemyError):
        HistoryService.update_status(
            mock_db,
            history_id=1,
            status=ProcessingStatus.SUCCESS,
            execution_time_ms=100,
        )
    assert mock_db.rollback.call_count == 1

    with pytest.raises(SQLAlchemyError):
        HistoryService.count_histories_by_user(mock_db, user_id=1, current_user_id=1)
    assert mock_db.rollback.call_count == 2


def test_composite_index_user_created_id_defined(in_memory_db):
    """Verify composite index `ix_processing_histories_user_created_id` on (user_id, created_at, id) exists (AUDIT-06)."""
    from sqlalchemy import inspect as sa_inspect

    inspector = sa_inspect(in_memory_db.get_bind())
    indexes = {idx["name"]: idx["column_names"] for idx in inspector.get_indexes("processing_histories")}
    assert "ix_processing_histories_user_created_id" in indexes
    assert indexes["ix_processing_histories_user_created_id"] == ["user_id", "created_at", "id"]


