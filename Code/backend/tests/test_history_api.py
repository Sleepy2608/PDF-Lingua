"""
Unit & Integration Tests for PDFL-160.2: Processing History API
---------------------------------------------------------------
Covers:
1. Router registration & OpenAPI route inspection (`/api/history`, `/api/history/{history_id}`).
2. Authentication enforcement via `get_current_user` (401 on missing/invalid token, 403 on inactive user).
3. `GET /api/history`:
   - Multi-tenant isolation (only returns current user's records).
   - Pagination (`skip`, `limit`).
   - Filtering (`action_type`, `status`, `document_id`, case-insensitive & combined filters).
   - Validation on invalid `action_type` / `status` (400 BadRequestException).
4. `GET /api/history/{history_id}`:
   - Owner access returning `ApiResponse[ProcessingHistoryResponse]`.
   - Non-existent ID raising `NotFoundException` (404).
   - Cross-tenant access raising `ForbiddenException` (403 Anti-IDOR).
5. Security: Sanitization of error messages (no raw stack traces or system paths leaked).
"""

import os
import sys
from typing import Any, Coroutine, TypeVar
import uuid

from fastapi.routing import APIRoute
from fastapi.security import HTTPAuthorizationCredentials
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.history import get_history_detail, list_user_histories, router as history_router
from app.core.database import Base
from app.core.dependencies import get_current_user
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
)
from app.core.security import create_access_token
from app.main import app
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingStatus
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


# ── 2. Authentication & Access Control (`get_current_user`) ──────────────────


def test_history_endpoints_require_authentication(in_memory_db):
    """Verify unauthenticated, invalid-token, and inactive-user requests are rejected."""
    user = _create_user(in_memory_db, email="auth_user@test.com", is_active=True)
    inactive_user = _create_user(in_memory_db, email="inactive@test.com", is_active=False)

    # 1. Missing Authorization header -> 401 NOT_AUTHENTICATED
    req_no_auth = _make_dummy_request()
    with pytest.raises(UnauthorizedException) as exc_info:
        get_current_user(request=req_no_auth, credentials=None, db=in_memory_db)
    assert exc_info.value.status_code == 401
    assert exc_info.value.error_code == "NOT_AUTHENTICATED"

    # 2. Invalid Bearer token -> 401 INVALID_TOKEN
    bad_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.jwt.token")
    req_with_auth = _make_dummy_request({"authorization": "Bearer invalid.jwt.token"})
    with pytest.raises(UnauthorizedException) as exc_info:
        get_current_user(request=req_with_auth, credentials=bad_creds, db=in_memory_db)
    assert exc_info.value.status_code == 401

    # 3. Valid token for inactive user -> 403 ACCOUNT_INACTIVE
    inactive_token = create_access_token(inactive_user.id)
    inactive_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=inactive_token)
    req_inactive = _make_dummy_request({"authorization": f"Bearer {inactive_token}"})
    with pytest.raises(ForbiddenException) as exc_info:
        get_current_user(request=req_inactive, credentials=inactive_creds, db=in_memory_db)
    assert exc_info.value.status_code == 403
    assert exc_info.value.error_code == "ACCOUNT_INACTIVE"

    # 4. Valid token for active user -> returns authenticated User
    valid_token = create_access_token(user.id)
    valid_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=valid_token)
    req_valid = _make_dummy_request({"authorization": f"Bearer {valid_token}"})
    authenticated = get_current_user(request=req_valid, credentials=valid_creds, db=in_memory_db)
    assert authenticated.id == user.id


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
    # Record belonging to User B
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
            skip=0,
            limit=50,
            action_type=None,
            status=None,
            document_id=None,
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

    # Expected descending order by ID/timestamp
    expected_desc = list(reversed(created_ids))

    page_1 = _run_async(
        list_user_histories(
            skip=0,
            limit=2,
            action_type=None,
            status=None,
            document_id=None,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert [item.id for item in page_1.data] == expected_desc[0:2]

    page_2 = _run_async(
        list_user_histories(
            skip=2,
            limit=2,
            action_type=None,
            status=None,
            document_id=None,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert [item.id for item in page_2.data] == expected_desc[2:4]

    page_3 = _run_async(
        list_user_histories(
            skip=4,
            limit=2,
            action_type=None,
            status=None,
            document_id=None,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert [item.id for item in page_3.data] == expected_desc[4:5]


def test_list_user_histories_filters_by_action_status_and_document(in_memory_db):
    """Verify filtering by `action_type`, `status`, and `document_id`."""
    user = _create_user(in_memory_db, email="filter@test.com")
    other_user = _create_user(in_memory_db, email="other@test.com")
    doc_1 = _create_document(in_memory_db, user_id=user.id, filename="doc1.pdf")
    doc_2 = _create_document(in_memory_db, user_id=user.id, filename="doc2.pdf")
    other_doc = _create_document(in_memory_db, user_id=other_user.id, filename="other.pdf")

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
    HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=other_user.id,
            document_id=other_doc.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.SUCCESS,
        ),
        reuse_pending=False,
    )

    # Filter by action_type (case-insensitive)
    res_extract = _run_async(
        list_user_histories(
            skip=0,
            limit=50,
            action_type="extract",
            status=None,
            document_id=None,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert [item.id for item in res_extract.data] == [h1.id]

    # Filter by status
    res_failed = _run_async(
        list_user_histories(
            skip=0,
            limit=50,
            action_type=None,
            status="FAILED",
            document_id=None,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert [item.id for item in res_failed.data] == [h2.id]

    # Filter by document_id
    res_doc2 = _run_async(
        list_user_histories(
            skip=0,
            limit=50,
            action_type=None,
            status=None,
            document_id=doc_2.id,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert [item.id for item in res_doc2.data] == [h3.id]

    # Combined filters (document_id + status)
    res_combined = _run_async(
        list_user_histories(
            skip=0,
            limit=50,
            action_type="EXTRACT",
            status="SUCCESS",
            document_id=doc_1.id,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert [item.id for item in res_combined.data] == [h1.id]

    # Filtering by another user's document_id returns empty list without leaking data
    res_other_doc = _run_async(
        list_user_histories(
            skip=0,
            limit=50,
            action_type=None,
            status=None,
            document_id=other_doc.id,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert res_other_doc.data == []


def test_list_user_histories_invalid_filters_raise_bad_request(in_memory_db):
    """Verify invalid `action_type` or `status` filter values raise 400 BadRequestException."""
    user = _create_user(in_memory_db, email="invalid_filter@test.com")

    with pytest.raises(BadRequestException) as exc_action:
        _run_async(
            list_user_histories(
                skip=0,
                limit=50,
                action_type="UNKNOWN_ACTION",
                status=None,
                document_id=None,
                current_user=user,
                db=in_memory_db,
            )
        )
    assert exc_action.value.status_code == 400
    assert exc_action.value.error_code == "INVALID_ACTION_TYPE"

    with pytest.raises(BadRequestException) as exc_status:
        _run_async(
            list_user_histories(
                skip=0,
                limit=50,
                action_type=None,
                status="INVALID_STATE",
                document_id=None,
                current_user=user,
                db=in_memory_db,
            )
        )
    assert exc_status.value.status_code == 400
    assert exc_status.value.error_code == "INVALID_PROCESSING_STATUS"


# ── 4. `GET /api/history/{history_id}` Detail, 404 & Anti-IDOR ───────────────


def test_get_history_detail_success_and_response_schema(in_memory_db):
    """Verify owner can fetch a specific history record by ID."""
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


# ── 5. Security: Error Sanitization on API Responses ─────────────────────────


def test_history_api_never_exposes_raw_stack_trace_or_paths(in_memory_db):
    """Verify failed history records returned by the API have sanitized error messages."""
    user = _create_user(in_memory_db, email="sanitize@test.com")
    doc = _create_document(in_memory_db, user_id=user.id)

    raw_traceback = (
        "Traceback (most recent call last):\n"
        "  File \"C:\\Users\\ADMIN\\PDF-Lingua\\Code\\backend\\app\\services\\pdf_service.py\", line 42\n"
        "RuntimeError: Corrupt stream at C:\\Users\\ADMIN\\secret\\file.pdf and /var/data/private.pdf"
    )

    pending = HistoryService.create_history(
        in_memory_db,
        ProcessingHistoryCreate(
            user_id=user.id,
            document_id=doc.id,
            action_type=ActionType.EXTRACT,
            status=ProcessingStatus.PENDING,
        ),
    )
    HistoryService.mark_failed(
        in_memory_db,
        history_id=pending.id,
        error_message=raw_traceback,
        execution_time_ms=55,
        current_user_id=user.id,
    )

    detail_resp = _run_async(
        get_history_detail(
            history_id=pending.id,
            current_user=user,
            db=in_memory_db,
        )
    )
    assert detail_resp.data is not None
    assert "Traceback" not in detail_resp.data.error_message
    assert "C:\\Users\\ADMIN" not in detail_resp.data.error_message
    assert "/var/data/private.pdf" not in detail_resp.data.error_message
    assert "[redacted-path]" in detail_resp.data.error_message
