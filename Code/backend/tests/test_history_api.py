"""
Comprehensive Validation & Audit Tests for Processing History API (PDFL-160.2 & PDFL-160.3)
-------------------------------------------------------------------------------------------
Covers:
1. Router registration & OpenAPI contract (`/api/history`, `/api/history/{history_id}`).
2. Authentication & Authorization (`get_current_user`, guest/unauthenticated, non-Bearer,
   deleted user, inactive user, cross-tenant history access, and cross-tenant document access).
3. Pagination & Filtering:
   - Boundary values (`skip=0`, `limit=1`, `limit=100`, `skip < 0`, `limit < 1`, `limit > 100`,
     `document_id <= 0`, `history_id <= 0`).
   - Empty dataset and large dataset (> 100 records).
   - Combined filters (`action_type`, `status`, `document_id`) & case/whitespace normalization.
4. Response Structure & Security Sanitization:
   - Strict `ApiResponse` & `ProcessingHistoryResponse` field contract (no internal ORM/user/doc fields).
   - Stack trace & file path redaction (including legacy/raw DB rows).
5. Error Handling:
   - Non-existent history/document (`404 NotFoundException`).
   - Invalid query parameters (`400 BadRequestException`).
   - Database failure (`SQLAlchemyError` -> session rollback + sanitized `500 DATABASE_ERROR`).
6. Query Performance:
   - Zero N+1 queries verification via SQLAlchemy cursor execution counter.
"""

import os
import sys
from typing import Any, Coroutine, TypeVar
from unittest.mock import patch
import uuid

from fastapi.routing import APIRoute
from fastapi.security import HTTPAuthorizationCredentials
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.history import get_history_detail, list_user_histories, router as history_router
from app.core.database import Base
from app.core.dependencies import get_current_user
from app.core.exceptions import (
    AppException,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
)
from app.core.security import create_access_token
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse
from app.schemas.processing_history import ProcessingHistoryCreate, ProcessingHistoryResponse
from app.services.history_service import HistoryService

T = TypeVar("T")


def _run_async(coro: Coroutine[Any, Any, T]) -> T:
    """Execute a non-yielding async endpoint coroutine synchronously without socket event loops."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()


@pytest.fixture()
def in_memory_db():
    """Provide an isolated SQLite in-memory database session with foreign keys enabled."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _create_user(
    session,
    email: str = "user@pdflingua.com",
    role: str = UserRole.FREE.value,
    is_active: bool = True,
) -> User:
    user = User(
        email=email,
        hashed_password="hashed_password_value",
        full_name="Test User",
        role=role,
        is_active=is_active,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_document(session, user_id: int, filename: str = "sample.pdf") -> Document:
    doc = Document(
        user_id=user_id,
        original_filename=filename,
        stored_filename=f"{uuid.uuid4()}.pdf",
        stored_path=f"documents/{user_id}/{uuid.uuid4()}.pdf",
        file_size_bytes=2048,
        page_count=3,
        is_ocr_used=0,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


def _make_dummy_request(headers: dict[str, str] | None = None) -> Request:
    raw_headers = [
        (k.lower().encode("latin-1"), v.encode("latin-1"))
        for k, v in (headers or {}).items()
    ]
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/history",
        "headers": raw_headers,
    }
    return Request(scope)


# ── 1. Router Registration & Endpoint Metadata ───────────────────────────────


def test_history_routes_registered_in_app():
    """Verify `/api/history` and `/api/history/{history_id}` are registered in FastAPI app."""
    from app.main import app

    included_routers = [
        getattr(r, "original_router", None)
        for r in app.routes
        if getattr(r, "original_router", None) is not None
    ]
    assert history_router in included_routers

    routes_by_path = {
        route.path: route
        for route in history_router.routes
        if isinstance(route, APIRoute)
    }

    assert "/api/history" in routes_by_path
    assert "/api/history/{history_id}" in routes_by_path

    list_route = routes_by_path["/api/history"]
    detail_route = routes_by_path["/api/history/{history_id}"]

    assert "GET" in list_route.methods
    assert "GET" in detail_route.methods
    assert list_route.response_model == ApiResponse[list[ProcessingHistoryResponse]]
    assert detail_route.response_model == ApiResponse[ProcessingHistoryResponse]


# ── 2. Authentication & Authorization (`get_current_user` & Anti-IDOR) ───────


def test_history_endpoints_require_authentication(in_memory_db):
    """Verify guest, non-Bearer, invalid-token, deleted-user, and inactive-user requests fail."""
    user = _create_user(in_memory_db, email="auth_user@test.com", is_active=True)
    inactive_user = _create_user(in_memory_db, email="inactive@test.com", is_active=False)

    # 1. Guest / Missing Authorization header -> 401 NOT_AUTHENTICATED
    req_no_auth = _make_dummy_request()
    with pytest.raises(UnauthorizedException) as exc_info:
        get_current_user(request=req_no_auth, credentials=None, db=in_memory_db)
    assert exc_info.value.status_code == 401
    assert exc_info.value.error_code == "NOT_AUTHENTICATED"

    # 2. Non-Bearer Authorization scheme (e.g. Basic auth) -> 401 NOT_AUTHENTICATED
    req_basic = _make_dummy_request({"authorization": "Basic dXNlcjpwYXNz"})
    with pytest.raises(UnauthorizedException) as exc_info:
        get_current_user(request=req_basic, credentials=None, db=in_memory_db)
    assert exc_info.value.status_code == 401
    assert exc_info.value.error_code == "NOT_AUTHENTICATED"

    # 3. Invalid Bearer token -> 401 INVALID_TOKEN
    bad_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.jwt.token")
    req_with_auth = _make_dummy_request({"authorization": "Bearer invalid.jwt.token"})
    with pytest.raises(UnauthorizedException) as exc_info:
        get_current_user(request=req_with_auth, credentials=bad_creds, db=in_memory_db)
    assert exc_info.value.status_code == 401

    # 4. Valid JWT for deleted / non-existent user -> 401 USER_NOT_FOUND
    ghost_token = create_access_token(999999)
    ghost_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=ghost_token)
    req_ghost = _make_dummy_request({"authorization": f"Bearer {ghost_token}"})
    with pytest.raises(UnauthorizedException) as exc_info:
        get_current_user(request=req_ghost, credentials=ghost_creds, db=in_memory_db)
    assert exc_info.value.status_code == 401
    assert exc_info.value.error_code == "USER_NOT_FOUND"

    # 5. Valid token for inactive user -> 403 ACCOUNT_INACTIVE
    inactive_token = create_access_token(inactive_user.id)
    inactive_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=inactive_token)
    req_inactive = _make_dummy_request({"authorization": f"Bearer {inactive_token}"})
    with pytest.raises(ForbiddenException) as exc_info:
        get_current_user(request=req_inactive, credentials=inactive_creds, db=in_memory_db)
    assert exc_info.value.status_code == 403
    assert exc_info.value.error_code == "ACCOUNT_INACTIVE"

    # 6. Valid token for active user -> returns authenticated User
    valid_token = create_access_token(user.id)
    valid_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=valid_token)
    req_valid = _make_dummy_request({"authorization": f"Bearer {valid_token}"})
    authenticated = get_current_user(request=req_valid, credentials=valid_creds, db=in_memory_db)
    assert authenticated.id == user.id


def test_list_user_histories_document_ownership_and_not_found(in_memory_db):
    """
    Verify filtering `/api/history?document_id=...` blocks access to another user's document (403)
    and rejects non-existent documents (404).
    """
    user_a = _create_user(in_memory_db, email="doc_owner_a@test.com")
    user_b = _create_user(in_memory_db, email="doc_intruder_b@test.com")
    doc_a = _create_document(in_memory_db, user_id=user_a.id, filename="private_a.pdf")

    HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.SUCCESS,
        ),
        reuse_pending=False,
    )

    # User B attempts to filter history using User A's document_id -> 403 ForbiddenException
    with pytest.raises(ForbiddenException) as exc_forbidden:
        _run_async(
            list_user_histories(
                document_id=doc_a.id,
                current_user=user_b,
                db=in_memory_db,
            )
        )
    assert exc_forbidden.value.status_code == 403
    assert exc_forbidden.value.error_code == "FORBIDDEN"

    # User A attempts to filter history using a non-existent document_id -> 404 NotFoundException
    with pytest.raises(NotFoundException) as exc_not_found:
        _run_async(
            list_user_histories(
                document_id=888888,
                current_user=user_a,
                db=in_memory_db,
            )
        )
    assert exc_not_found.value.status_code == 404
    assert exc_not_found.value.error_code == "NOT_FOUND"


# ── 3. `GET /api/history` List, Tenant Isolation, Pagination & Filtering ────


def test_list_user_histories_returns_only_owned_records(in_memory_db):
    """Verify `GET /api/history` returns only records belonging to the logged-in user."""
    user_a = _create_user(in_memory_db, email="alice@test.com")
    user_b = _create_user(in_memory_db, email="bob@test.com")
    doc_a = _create_document(in_memory_db, user_id=user_a.id, filename="alice.pdf")
    doc_b = _create_document(in_memory_db, user_id=user_b.id, filename="bob.pdf")

    h_a1 = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.SUCCESS,
            execution_time_ms=120,
        ),
        reuse_pending=False,
    )
    h_a2 = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.TRANSLATE,
            status=ProcessingStatus.SUCCESS,
            execution_time_ms=340,
        ),
        reuse_pending=False,
    )
    HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_b.id,
            document_id=doc_b.id,
            action_type=ActionType.SUMMARIZE,
            status=ProcessingStatus.SUCCESS,
            execution_time_ms=210,
        ),
        reuse_pending=False,
    )

    response = _run_async(
        list_user_histories(
            current_user=user_a,
            db=in_memory_db,
        )
    )

    assert isinstance(response, ApiResponse)
    assert response.success is True
    assert response.data is not None
    assert len(response.data) == 2
    assert [item.id for item in response.data] == [h_a2.id, h_a1.id]
    assert all(isinstance(item, ProcessingHistoryResponse) for item in response.data)
    assert all(item.user_id == user_a.id for item in response.data)


def test_list_user_histories_pagination_skip_and_limit(in_memory_db):
    """Verify `skip` and `limit` pagination parameters on `GET /api/history`."""
    user = _create_user(in_memory_db, email="paginated@test.com")
    doc = _create_document(in_memory_db, user_id=user.id)

    created_ids = []
    for idx in range(5):
        rec = HistoryService.create_history(
            in_memory_db,
            ProcessingHistoryCreate(
                user_id=user.id,
                document_id=doc.id,
                action_type=ActionType.EXTRACT,
                status=ProcessingStatus.SUCCESS,
                execution_time_ms=100 + idx,
            ),
            reuse_pending=False,
        )
        created_ids.append(rec.id)

    expected_desc = list(reversed(created_ids))

    page_1 = _run_async(
        list_user_histories(skip=0, limit=2, current_user=user, db=in_memory_db)
    )
    assert [item.id for item in page_1.data] == expected_desc[0:2]

    page_2 = _run_async(
        list_user_histories(skip=2, limit=2, current_user=user, db=in_memory_db)
    )
    assert [item.id for item in page_2.data] == expected_desc[2:4]

    page_3 = _run_async(
        list_user_histories(skip=4, limit=2, current_user=user, db=in_memory_db)
    )
    assert [item.id for item in page_3.data] == expected_desc[4:5]


def test_list_user_histories_boundary_pagination_and_empty_state(in_memory_db):
    """
    Verify boundary values (`skip=0`, `limit=1`, `limit=100`, `skip > total`),
    empty dataset behavior, and rejection of out-of-range pagination/ID parameters.
    """
    empty_user = _create_user(in_memory_db, email="empty@test.com")

    # 1. Empty dataset -> 200 OK with empty list
    empty_resp = _run_async(
        list_user_histories(skip=0, limit=1, current_user=empty_user, db=in_memory_db)
    )
    assert empty_resp.success is True
    assert empty_resp.data == []

    # 2. Skip beyond dataset length -> empty list
    doc = _create_document(in_memory_db, user_id=empty_user.id)
    rec = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=empty_user.id,
            document_id=doc.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.SUCCESS,
        ),
        reuse_pending=False,
    )
    min_limit_resp = _run_async(
        list_user_histories(skip=0, limit=1, current_user=empty_user, db=in_memory_db)
    )
    assert [item.id for item in min_limit_resp.data] == [rec.id]

    max_limit_resp = _run_async(
        list_user_histories(skip=0, limit=100, current_user=empty_user, db=in_memory_db)
    )
    assert len(max_limit_resp.data) == 1

    far_skip_resp = _run_async(
        list_user_histories(skip=500, limit=10, current_user=empty_user, db=in_memory_db)
    )
    assert far_skip_resp.data == []

    # 3. Invalid boundary values -> 400 BadRequestException
    with pytest.raises(BadRequestException) as exc_neg_skip:
        _run_async(list_user_histories(skip=-1, limit=10, current_user=empty_user, db=in_memory_db))
    assert exc_neg_skip.value.error_code == "INVALID_PAGINATION"

    with pytest.raises(BadRequestException) as exc_zero_limit:
        _run_async(list_user_histories(skip=0, limit=0, current_user=empty_user, db=in_memory_db))
    assert exc_zero_limit.value.error_code == "INVALID_PAGINATION"

    with pytest.raises(BadRequestException) as exc_over_limit:
        _run_async(list_user_histories(skip=0, limit=101, current_user=empty_user, db=in_memory_db))
    assert exc_over_limit.value.error_code == "INVALID_PAGINATION"

    with pytest.raises(BadRequestException) as exc_bad_doc_id:
        _run_async(list_user_histories(document_id=0, current_user=empty_user, db=in_memory_db))
    assert exc_bad_doc_id.value.error_code == "INVALID_DOCUMENT_ID"

    with pytest.raises(BadRequestException) as exc_bad_hist_id:
        _run_async(get_history_detail(history_id=0, current_user=empty_user, db=in_memory_db))
    assert exc_bad_hist_id.value.error_code == "INVALID_HISTORY_ID"


def test_list_user_histories_large_dataset_and_combined_filters(in_memory_db):
    """Verify pagination and multi-filter accuracy over a large dataset (135 records)."""
    user = _create_user(in_memory_db, email="large_data@test.com")
    doc_a = _create_document(in_memory_db, user_id=user.id, filename="large_a.pdf")
    doc_b = _create_document(in_memory_db, user_id=user.id, filename="large_b.pdf")

    actions = [ActionType.EXTRACT, ActionType.TRANSLATE, ActionType.SUMMARIZE]
    statuses = [ProcessingStatus.PENDING, ProcessingStatus.SUCCESS, ProcessingStatus.FAILED]

    records_to_insert = []
    for i in range(135):
        target_doc = doc_a if i % 2 == 0 else doc_b
        act = actions[i % 3]
        st = statuses[(i // 3) % 3]
        records_to_insert.append(
            ProcessingHistory(
                user_id=user.id,
                document_id=target_doc.id,
                action_type=act,
                status=st,
                execution_time_ms=10 + i if st != ProcessingStatus.PENDING else None,
                error_message="Simulated failure" if st == ProcessingStatus.FAILED else None,
            )
        )
    in_memory_db.add_all(records_to_insert)
    in_memory_db.commit()

    # Fetch first 100 items
    batch_1 = _run_async(
        list_user_histories(skip=0, limit=100, current_user=user, db=in_memory_db)
    )
    assert len(batch_1.data) == 100

    # Fetch remaining 35 items
    batch_2 = _run_async(
        list_user_histories(skip=100, limit=100, current_user=user, db=in_memory_db)
    )
    assert len(batch_2.data) == 35

    # Ensure zero overlap and strict descending ID order
    all_ids = [item.id for item in batch_1.data] + [item.id for item in batch_2.data]
    assert len(set(all_ids)) == 135
    assert all_ids == sorted(all_ids, reverse=True)

    # Combined 3-way filter: doc_a + TRANSLATE + SUCCESS
    filtered = _run_async(
        list_user_histories(
            skip=0,
            limit=100,
            action_type="  translate ",
            status=" success ",
            document_id=doc_a.id,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert len(filtered.data) > 0
    assert all(
        item.document_id == doc_a.id
        and item.action_type == ActionType.TRANSLATE
        and item.status == ProcessingStatus.SUCCESS
        for item in filtered.data
    )


def test_list_user_histories_filters_by_action_status_and_document(in_memory_db):
    """Verify filtering by `action_type`, `status`, and `document_id`."""
    user = _create_user(in_memory_db, email="filter@test.com")
    doc_1 = _create_document(in_memory_db, user_id=user.id, filename="doc1.pdf")
    doc_2 = _create_document(in_memory_db, user_id=user.id, filename="doc2.pdf")

    h1 = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user.id,
            document_id=doc_1.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.SUCCESS,
            execution_time_ms=80,
        ),
        reuse_pending=False,
    )
    h2 = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user.id,
            document_id=doc_1.id,
            action_type=ActionType.TRANSLATE,
            status=ProcessingStatus.FAILED,
            error_message="Translation service timeout",
        ),
        reuse_pending=False,
    )
    h3 = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user.id,
            document_id=doc_2.id,
            action_type=ActionType.SUMMARIZE,
            status=ProcessingStatus.SUCCESS,
            execution_time_ms=150,
        ),
        reuse_pending=False,
    )

    # Filter by action_type (case-insensitive)
    res_extract = _run_async(
        list_user_histories(action_type="extract", current_user=user, db=in_memory_db)
    )
    assert [item.id for item in res_extract.data] == [h1.id]

    # Filter by status
    res_failed = _run_async(
        list_user_histories(status="FAILED", current_user=user, db=in_memory_db)
    )
    assert [item.id for item in res_failed.data] == [h2.id]

    # Filter by document_id
    res_doc2 = _run_async(
        list_user_histories(document_id=doc_2.id, current_user=user, db=in_memory_db)
    )
    assert [item.id for item in res_doc2.data] == [h3.id]

    # Combined filters
    res_combined = _run_async(
        list_user_histories(
            action_type="EXTRACT",
            status="SUCCESS",
            document_id=doc_1.id,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert [item.id for item in res_combined.data] == [h1.id]


def test_list_user_histories_invalid_filters_raise_bad_request(in_memory_db):
    """Verify invalid or empty `action_type` / `status` filter values raise 400 BadRequestException."""
    user = _create_user(in_memory_db, email="invalid_filter@test.com")

    for bad_action in ("UNKNOWN_ACTION", "", "   "):
        with pytest.raises(BadRequestException) as exc_action:
            _run_async(
                list_user_histories(action_type=bad_action, current_user=user, db=in_memory_db)
            )
        assert exc_action.value.status_code == 400
        assert exc_action.value.error_code == "INVALID_ACTION_TYPE"

    for bad_status in ("INVALID_STATE", "", "   "):
        with pytest.raises(BadRequestException) as exc_status:
            _run_async(
                list_user_histories(status=bad_status, current_user=user, db=in_memory_db)
            )
        assert exc_status.value.status_code == 400
        assert exc_status.value.error_code == "INVALID_PROCESSING_STATUS"


# ── 4. `GET /api/history/{history_id}` Detail, Schema Contract & 404/403 ─────


def test_get_history_detail_success_and_response_schema(in_memory_db):
    """Verify owner can fetch a specific history record and response strictly matches schema fields."""
    user = _create_user(in_memory_db, email="detail_owner@test.com")
    doc = _create_document(in_memory_db, user_id=user.id)

    created = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user.id,
            document_id=doc.id,
            action_type=ActionType.SUMMARIZE,
            status=ProcessingStatus.SUCCESS,
            execution_time_ms=450,
        ),
        reuse_pending=False,
    )

    response = _run_async(
        get_history_detail(
            history_id=created.id,
            current_user=user,
            db=in_memory_db,
        )
    )

    assert isinstance(response, ApiResponse)
    assert response.success is True
    assert isinstance(response.data, ProcessingHistoryResponse)
    assert response.data.id == created.id
    assert response.data.user_id == user.id
    assert response.data.document_id == doc.id
    assert response.data.action_type == ActionType.SUMMARIZE
    assert response.data.status == ProcessingStatus.SUCCESS
    assert response.data.execution_time_ms == 450
    assert response.data.error_message is None

    # Verify serialized dictionary exposes ONLY expected public fields (no internal ORM state)
    dumped = response.model_dump()
    assert set(dumped.keys()) == {"success", "message", "data"}
    expected_data_fields = {
        "id",
        "user_id",
        "document_id",
        "action_type",
        "status",
        "execution_time_ms",
        "error_message",
        "created_at",
        "updated_at",
    }
    assert set(dumped["data"].keys()) == expected_data_fields


def test_get_history_detail_not_found(in_memory_db):
    """Verify requesting a non-existent `history_id` raises 404 NotFoundException."""
    user = _create_user(in_memory_db, email="notfound@test.com")

    with pytest.raises(NotFoundException) as exc_info:
        _run_async(
            get_history_detail(
                history_id=999999,
                current_user=user,
                db=in_memory_db,
            )
        )
    assert exc_info.value.status_code == 404
    assert exc_info.value.error_code == "NOT_FOUND"


def test_get_history_detail_forbidden_for_other_user(in_memory_db):
    """Verify User B cannot view User A's history record (403 ForbiddenException)."""
    user_a = _create_user(in_memory_db, email="owner_a@test.com")
    user_b = _create_user(in_memory_db, email="intruder_b@test.com")
    doc_a = _create_document(in_memory_db, user_id=user_a.id)

    record_a = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user_a.id,
            document_id=doc_a.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.SUCCESS,
        ),
        reuse_pending=False,
    )

    with pytest.raises(ForbiddenException) as exc_info:
        _run_async(
            get_history_detail(
                history_id=record_a.id,
                current_user=user_b,
                db=in_memory_db,
            )
        )
    assert exc_info.value.status_code == 403
    assert exc_info.value.error_code == "FORBIDDEN"


# ── 5. Security Sanitization & Database Error Handling ───────────────────────


def test_history_api_never_exposes_raw_stack_trace_or_paths(in_memory_db):
    """
    Verify failed history records returned by the API have sanitized error messages,
    even if a legacy ORM row in the database contained an unsanitized traceback.
    """
    user = _create_user(in_memory_db, email="sanitize@test.com")
    doc = _create_document(in_memory_db, user_id=user.id)

    raw_traceback = (
        "Traceback (most recent call last):\n"
        "  File \"C:\\Users\\ADMIN\\PDF-Lingua\\Code\\backend\\app\\services\\pdf_service.py\", line 42\n"
        "RuntimeError: Corrupt stream at C:\\Users\\ADMIN\\secret\\file.pdf and /var/data/private.pdf"
    )

    # Insert raw ORM record directly bypassing service creation sanitizer to test response-level defense
    raw_record = ProcessingHistory(
        user_id=user.id,
        document_id=doc.id,
        action_type=ActionType.EXTRACT,
        status=ProcessingStatus.FAILED,
        execution_time_ms=55,
        error_message=raw_traceback,
    )
    in_memory_db.add(raw_record)
    in_memory_db.commit()
    in_memory_db.refresh(raw_record)

    detail_resp = _run_async(
        get_history_detail(
            history_id=raw_record.id,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert detail_resp.data is not None
    assert "Traceback" not in detail_resp.data.error_message
    assert "C:\\Users\\ADMIN" not in detail_resp.data.error_message
    assert "/var/data/private.pdf" not in detail_resp.data.error_message
    assert "[redacted-path]" in detail_resp.data.error_message

    list_resp = _run_async(
        list_user_histories(current_user=user, db=in_memory_db)
    )
    assert len(list_resp.data) == 1
    assert "Traceback" not in list_resp.data[0].error_message
    assert "C:\\Users\\ADMIN" not in list_resp.data[0].error_message


def test_history_api_database_error_handling_and_rollback(in_memory_db):
    """
    Verify database failures during history queries trigger `db.rollback()` in HistoryService
    and return a sanitized 500 `DATABASE_ERROR` AppException in HistoryAPI without leaking SQL details.
    """
    user = _create_user(in_memory_db, email="db_error@test.com")
    sensitive_sql_err = OperationalError(
        "SELECT * FROM processing_histories WHERE user_id = 1",
        params={"user_id": 1},
        orig=Exception("disk I/O error at C:\\Users\\ADMIN\\secret\\pdf_lingua.db"),
    )

    with patch.object(in_memory_db, "query", side_effect=sensitive_sql_err), patch.object(
        in_memory_db, "rollback", wraps=in_memory_db.rollback
    ) as spy_rollback:
        # 1. List endpoint catches SQLAlchemyError, rolls back, and raises sanitized AppException(500)
        with pytest.raises(AppException) as exc_list:
            _run_async(list_user_histories(current_user=user, db=in_memory_db))

        assert exc_list.value.status_code == 500
        assert exc_list.value.error_code == "DATABASE_ERROR"
        assert exc_list.value.details is None
        assert "SELECT * FROM" not in exc_list.value.message
        assert "pdf_lingua.db" not in exc_list.value.message
        assert spy_rollback.call_count == 1

        # 2. Detail endpoint catches SQLAlchemyError, rolls back, and raises sanitized AppException(500)
        with pytest.raises(AppException) as exc_detail:
            _run_async(get_history_detail(history_id=1, current_user=user, db=in_memory_db))

        assert exc_detail.value.status_code == 500
        assert exc_detail.value.error_code == "DATABASE_ERROR"
        assert exc_detail.value.details is None
        assert "SELECT * FROM" not in exc_detail.value.message
        assert spy_rollback.call_count == 2


# ── 6. Query Performance & N+1 Prevention ────────────────────────────────────


def test_history_api_query_count_no_n_plus_one(in_memory_db):
    """
    Verify `list_user_histories` and `get_history_detail` execute a constant number of SQL queries
    (1 query for list, at most 2 with document_id filter, 1 for detail) with zero N+1 lazy loads.
    """
    user = _create_user(in_memory_db, email="perf@test.com")
    doc = _create_document(in_memory_db, user_id=user.id)

    bulk_items = [
        ProcessingHistory(
            user_id=user.id,
            document_id=doc.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.SUCCESS,
            execution_time_ms=100 + i,
        )
        for i in range(40)
    ]
    in_memory_db.add_all(bulk_items)
    in_memory_db.commit()
    in_memory_db.refresh(user)
    in_memory_db.refresh(doc)
    target_history_id = bulk_items[0].id

    executed_statements: list[str] = []

    def _count_queries(_conn, _cursor, statement, _parameters, _context, _executemany):
        if statement.strip().upper().startswith("SELECT"):
            executed_statements.append(statement)

    engine = in_memory_db.get_bind()
    event.listen(engine, "before_cursor_execute", _count_queries)
    try:
        # 1. List 40 records without document_id filter -> strictly 1 SELECT query
        executed_statements.clear()
        list_resp = _run_async(
            list_user_histories(skip=0, limit=50, current_user=user, db=in_memory_db)
        )
        assert len(list_resp.data) == 40
        assert len(executed_statements) == 1

        # 2. List with document_id filter -> strictly 2 SELECT queries (1 ownership check + 1 history select)
        executed_statements.clear()
        doc_resp = _run_async(
            list_user_histories(
                skip=0,
                limit=50,
                document_id=doc.id,
                current_user=user,
                db=in_memory_db,
            )
        )
        assert len(doc_resp.data) == 40
        assert len(executed_statements) == 2

        # 3. Detail lookup -> strictly 1 SELECT query
        executed_statements.clear()
        detail_resp = _run_async(
            get_history_detail(
                history_id=target_history_id,
                current_user=user,
                db=in_memory_db,
            )
        )
        assert detail_resp.data.id == target_history_id
        assert len(executed_statements) == 1
    finally:
        event.remove(engine, "before_cursor_execute", _count_queries)
