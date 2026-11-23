"""
Unit & Integration Test Suite for Per-Page Translation Persistence API
----------------------------------------------------------------------
Verifies:
1. Router registration, authentication dependency (`get_current_user`), and OpenAPI
   response contracts for:
   - GET /api/history/{history_id}/pages
   - GET /api/history/{history_id}/pages/{page_number}
   - PUT /api/history/{history_id}/pages/{page_number}
2. Retrieval of per-page translation lists and individual pages preserving original
   page numbers (including non-contiguous page selections).
3. Updating a single page's translation:
   - Updates `translated_text`, `status="edited"`, and `updated_at` (page + DB).
   - Leaves all other pages unmodified.
   - Synchronizes document-level `translated_text` for export consistency.
   - Persists changes durably to JSON storage and database.
4. Legacy history compatibility:
   - Records without `pages` return an empty list on GET `/pages`.
   - GET `/pages/{n}` returns 404.
   - PUT `/pages/{n}` returns 400 (`PAGE_DATA_UNAVAILABLE`) without fabricating pages.
5. Security (Anti-IDOR), boundary validation, and transactional rollback restoration.
"""

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Coroutine, TypeVar
from unittest.mock import patch

import pytest
from app.api.history import (
    get_history_page_detail,
    get_history_pages,
    get_history_result,
    update_history_page_result,
)
from app.api.history import router as history_router
from app.core.database import Base
from app.core.dependencies import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse
from app.schemas.processing_history import (
    PageTranslationItem,
    PageTranslationListResponse,
    PageTranslationUpdateRequest,
    ProcessingHistoryCreate,
    ProcessingResultResponse,
)
from app.services.history_service import HistoryService, history_service
from app.services.storage_service import StorageService
from fastapi.routing import APIRoute
from sqlalchemy import create_engine, event
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

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
def isolated_env():
    """Provide an isolated in-memory SQLite DB, temporary StorageService, and seeded users."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _enable_fk(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = session_factory()

    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_storage = StorageService(base_dir=tmp_dir)
        orig_cls_storage = HistoryService.storage_service
        orig_inst_storage = history_service.storage_service
        HistoryService.storage_service = temp_storage
        history_service.storage_service = temp_storage

        user_a = User(
            email="owner_alice@example.com",
            hashed_password="hashed_pw_alice",
            full_name="Alice Owner",
            role=UserRole.PRO,
            is_active=True,
        )
        user_b = User(
            email="other_bob@example.com",
            hashed_password="hashed_pw_bob",
            full_name="Bob Other",
            role=UserRole.FREE,
            is_active=True,
        )
        admin = User(
            email="admin_sys@example.com",
            hashed_password="hashed_pw_admin",
            full_name="System Admin",
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add_all([user_a, user_b, admin])
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)
        db.refresh(admin)

        doc_a = Document(
            user_id=user_a.id,
            original_filename="quarterly_report.pdf",
            stored_filename="abc123_quarterly_report.pdf",
            stored_path=f"{user_a.id}/abc123_quarterly_report.pdf",
            file_size_bytes=512000,
            page_count=6,
            target_lang="vi",
            is_ocr_used=True,
        )
        db.add(doc_a)
        db.commit()
        db.refresh(doc_a)

        try:
            yield {
                "db": db,
                "storage": temp_storage,
                "storage_dir": Path(tmp_dir),
                "user_a": user_a,
                "user_b": user_b,
                "admin": admin,
                "doc_a": doc_a,
            }
        finally:
            HistoryService.storage_service = orig_cls_storage
            history_service.storage_service = orig_inst_storage
            db.close()
            Base.metadata.drop_all(bind=engine)
            engine.dispose()


def _seed_history_with_pages(db, user: User, doc: Document, pages: list[dict] | None = None) -> ProcessingHistory:
    """Create a SUCCESS ProcessingHistory record with optional per-page JSON data."""
    record = history_service.create_history(
        db,
        ProcessingHistoryCreate(
            user_id=user.id,
            document_id=doc.id,
            action_type=ActionType.TRANSLATE,
            status=ProcessingStatus.PENDING,
        ),
        current_user_id=user.id,
        reuse_pending=False,
    )
    payload: dict[str, Any] = {
        "document_id": doc.id,
        "filename": doc.original_filename,
        "page_count": len(pages) if pages else doc.page_count,
        "file_size_mb": 0.49,
        "target_lang": "vi",
        "is_ocr_used": True,
        "original_text": "Original page 2 text.\n\nOriginal page 5 text.\n\nOriginal page 6 text.",
        "translated_text": "Bản dịch trang 2.\n\nBản dịch trang 5.\n\nBản dịch trang 6.",
        "engine_used": "google",
        "execution_time_ms": 1450,
    }
    if pages is not None:
        payload["pages"] = pages

    return history_service.save_history_result(
        db,
        history_id=record.id,
        user_id=user.id,
        result_data=payload,
        execution_time_ms=1450,
    )


def _sample_non_contiguous_pages() -> list[dict]:
    """Sample per-page data matching the pipeline structure with non-contiguous pages."""
    ts = "2026-11-22T12:00:00+00:00"
    return [
        {
            "page_number": 2,
            "original_text": "Original page 2 text.",
            "translated_text": "Bản dịch trang 2.",
            "is_ocr_used": False,
            "is_blank": False,
            "target_lang": "vi",
            "engine_used": "google",
            "status": "completed",
            "updated_at": ts,
        },
        {
            "page_number": 4,
            "original_text": "",
            "translated_text": "",
            "is_ocr_used": True,
            "is_blank": True,
            "target_lang": "vi",
            "engine_used": "none",
            "status": "blank",
            "updated_at": ts,
        },
        {
            "page_number": 5,
            "original_text": "Original page 5 text.",
            "translated_text": "Bản dịch trang 5.",
            "is_ocr_used": True,
            "is_blank": False,
            "target_lang": "vi",
            "engine_used": "google",
            "status": "completed",
            "updated_at": ts,
        },
        {
            "page_number": 6,
            "original_text": "Original page 6 text.",
            "translated_text": "Bản dịch trang 6.",
            "is_ocr_used": False,
            "is_blank": False,
            "target_lang": "vi",
            "engine_used": "google",
            "status": "completed",
            "updated_at": ts,
        },
    ]


# ── Router Registration & Auth Dependency Contract ────────────────────────────


def test_page_persistence_routes_registered_with_auth_and_schemas():
    route_map: dict[tuple[str, str], APIRoute] = {}
    for route in history_router.routes:
        if isinstance(route, APIRoute):
            for method in route.methods:
                route_map[(method, route.path)] = route

    expected = [
        ("GET", "/api/history/{history_id}/pages", ApiResponse[PageTranslationListResponse]),
        ("GET", "/api/history/{history_id}/pages/{page_number}", ApiResponse[PageTranslationItem]),
        ("PUT", "/api/history/{history_id}/pages/{page_number}", ApiResponse[PageTranslationItem]),
    ]

    for method, path, response_model in expected:
        assert (method, path) in route_map, f"Missing route {method} {path}"
        route = route_map[(method, path)]
        assert route.response_model == response_model
        dep_calls = [dep.call for dep in route.dependant.dependencies]
        assert get_current_user in dep_calls, f"Route {method} {path} must require get_current_user"


# ── 1. GET Page List Success ──────────────────────────────────────────────────


def test_get_history_pages_success_preserves_original_page_numbers(isolated_env):
    db = isolated_env["db"]
    user_a = isolated_env["user_a"]
    doc_a = isolated_env["doc_a"]
    record = _seed_history_with_pages(db, user_a, doc_a, pages=_sample_non_contiguous_pages())

    response = _run_async(get_history_pages(history_id=record.id, current_user=user_a, db=db))

    assert response.success is True
    assert isinstance(response.data, PageTranslationListResponse)
    assert response.data.history_id == record.id
    assert response.data.document_id == doc_a.id
    assert response.data.target_lang == "vi"
    assert response.data.total_pages == 4
    assert [p.page_number for p in response.data.pages] == [2, 4, 5, 6]
    assert response.data.pages[1].is_blank is True
    assert response.data.pages[2].is_ocr_used is True


# ── 2. GET Single Page Success ────────────────────────────────────────────────


def test_get_single_history_page_success(isolated_env):
    db = isolated_env["db"]
    user_a = isolated_env["user_a"]
    doc_a = isolated_env["doc_a"]
    record = _seed_history_with_pages(db, user_a, doc_a, pages=_sample_non_contiguous_pages())

    response = _run_async(
        get_history_page_detail(history_id=record.id, page_number=5, current_user=user_a, db=db)
    )

    assert response.success is True
    assert isinstance(response.data, PageTranslationItem)
    assert response.data.page_number == 5
    assert response.data.original_text == "Original page 5 text."
    assert response.data.translated_text == "Bản dịch trang 5."
    assert response.data.is_ocr_used is True
    assert response.data.status == "completed"


# ── 3, 4, 5, 10, 11. PUT Update Page, Isolation, Sync, Durability & JSON Compat ─


def test_put_update_page_synchronizes_aggregate_and_preserves_other_pages(isolated_env):
    db = isolated_env["db"]
    user_a = isolated_env["user_a"]
    doc_a = isolated_env["doc_a"]
    storage = isolated_env["storage"]
    original_pages = _sample_non_contiguous_pages()
    record = _seed_history_with_pages(db, user_a, doc_a, pages=original_pages)
    previous_page_updated_at = original_pages[2]["updated_at"]

    payload = PageTranslationUpdateRequest(
        translated_text="Bản dịch trang 5 đã hiệu đính chi tiết bằng tiếng Việt.",
        target_lang="vi",
    )
    put_resp = _run_async(
        update_history_page_result(
            history_id=record.id,
            page_number=5,
            payload=payload,
            current_user=user_a,
            db=db,
        )
    )

    assert put_resp.success is True
    assert isinstance(put_resp.data, PageTranslationItem)
    assert put_resp.data.page_number == 5
    assert put_resp.data.translated_text == "Bản dịch trang 5 đã hiệu đính chi tiết bằng tiếng Việt."
    assert put_resp.data.status == "edited"
    assert put_resp.data.updated_at is not None
    assert put_resp.data.updated_at != previous_page_updated_at

    # Re-query single page and full list to confirm durable persistence
    reloaded_page = _run_async(
        get_history_page_detail(history_id=record.id, page_number=5, current_user=user_a, db=db)
    )
    assert reloaded_page.data.translated_text == "Bản dịch trang 5 đã hiệu đính chi tiết bằng tiếng Việt."
    assert reloaded_page.data.status == "edited"

    reloaded_list = _run_async(get_history_pages(history_id=record.id, current_user=user_a, db=db))
    pages_by_num = {p.page_number: p for p in reloaded_list.data.pages}
    assert sorted(pages_by_num.keys()) == [2, 4, 5, 6]

    # Other pages must remain completely untouched
    assert pages_by_num[2].translated_text == "Bản dịch trang 2."
    assert pages_by_num[2].status == "completed"
    assert pages_by_num[2].updated_at == previous_page_updated_at
    assert pages_by_num[4].is_blank is True
    assert pages_by_num[4].translated_text == ""
    assert pages_by_num[6].translated_text == "Bản dịch trang 6."
    assert pages_by_num[6].status == "completed"

    # Aggregate translated_text must be synchronized for Export & GET /result
    result_resp = _run_async(get_history_result(history_id=record.id, current_user=user_a, db=db))
    assert isinstance(result_resp.data, ProcessingResultResponse)
    expected_aggregate = (
        "Bản dịch trang 2.\n\n"
        "Bản dịch trang 5 đã hiệu đính chi tiết bằng tiếng Việt.\n\n"
        "Bản dịch trang 6."
    )
    assert result_resp.data.translated_text == expected_aggregate

    # Raw JSON on disk must preserve all existing top-level keys cleanly
    json_path = storage.get_result_path(user_a.id, record.result_path)
    assert json_path is not None and json_path.is_file()
    raw_json = json.loads(json_path.read_text(encoding="utf-8"))
    assert raw_json["history_id"] == record.id
    assert raw_json["document_id"] == doc_a.id
    assert raw_json["document_filename"] == "quarterly_report.pdf"
    assert raw_json["action_type"] == "TRANSLATE"
    assert raw_json["engine_used"] == "google"
    assert raw_json["execution_time_ms"] == 1450
    assert raw_json["translated_text"] == expected_aggregate
    assert len(raw_json["pages"]) == 4


# ── 6. Non-Existent History ───────────────────────────────────────────────────


def test_non_existent_history_returns_404_on_all_page_endpoints(isolated_env):
    db = isolated_env["db"]
    user_a = isolated_env["user_a"]

    with pytest.raises(NotFoundException):
        _run_async(get_history_pages(history_id=999999, current_user=user_a, db=db))

    with pytest.raises(NotFoundException):
        _run_async(get_history_page_detail(history_id=999999, page_number=1, current_user=user_a, db=db))

    with pytest.raises(NotFoundException):
        _run_async(
            update_history_page_result(
                history_id=999999,
                page_number=1,
                payload=PageTranslationUpdateRequest(translated_text="Updated text"),
                current_user=user_a,
                db=db,
            )
        )


# ── 7. Non-Existent Page Number & Input Validation ────────────────────────────


def test_non_existent_page_number_returns_404_and_invalid_inputs_return_400(isolated_env):
    db = isolated_env["db"]
    user_a = isolated_env["user_a"]
    doc_a = isolated_env["doc_a"]
    record = _seed_history_with_pages(db, user_a, doc_a, pages=_sample_non_contiguous_pages())

    # Page 3 was not part of [2, 4, 5, 6]
    with pytest.raises(NotFoundException):
        _run_async(get_history_page_detail(history_id=record.id, page_number=3, current_user=user_a, db=db))

    with pytest.raises(NotFoundException):
        _run_async(
            update_history_page_result(
                history_id=record.id,
                page_number=99,
                payload=PageTranslationUpdateRequest(translated_text="Nội dung mới"),
                current_user=user_a,
                db=db,
            )
        )

    # Boundary page_number <= 0 -> 400 BadRequestException
    with pytest.raises(BadRequestException):
        _run_async(get_history_page_detail(history_id=record.id, page_number=0, current_user=user_a, db=db))

    with pytest.raises(BadRequestException):
        _run_async(
            update_history_page_result(
                history_id=record.id,
                page_number=0,
                payload=PageTranslationUpdateRequest(translated_text="Nội dung mới"),
                current_user=user_a,
                db=db,
            )
        )

    # Empty / whitespace-only translated_text -> 400 BadRequestException
    with pytest.raises(BadRequestException):
        _run_async(
            update_history_page_result(
                history_id=record.id,
                page_number=2,
                payload=PageTranslationUpdateRequest(translated_text="   \n\t "),
                current_user=user_a,
                db=db,
            )
        )


# ── 8. Anti-IDOR Multi-Tenant Isolation & Admin Access ────────────────────────


def test_anti_idor_blocks_other_user_and_allows_admin(isolated_env):
    db = isolated_env["db"]
    user_a = isolated_env["user_a"]
    user_b = isolated_env["user_b"]
    admin = isolated_env["admin"]
    doc_a = isolated_env["doc_a"]
    record = _seed_history_with_pages(db, user_a, doc_a, pages=_sample_non_contiguous_pages())

    # User B must receive 404 on GET pages, GET page, and PUT page (no existence leak)
    with pytest.raises(NotFoundException):
        _run_async(get_history_pages(history_id=record.id, current_user=user_b, db=db))

    with pytest.raises(NotFoundException):
        _run_async(get_history_page_detail(history_id=record.id, page_number=2, current_user=user_b, db=db))

    with pytest.raises(NotFoundException):
        _run_async(
            update_history_page_result(
                history_id=record.id,
                page_number=2,
                payload=PageTranslationUpdateRequest(translated_text="Tampered by Bob"),
                current_user=user_b,
                db=db,
            )
        )

    # Confirm User A's stored translation was not modified by User B's attempt
    owner_page = _run_async(
        get_history_page_detail(history_id=record.id, page_number=2, current_user=user_a, db=db)
    )
    assert owner_page.data.translated_text == "Bản dịch trang 2."

    # Admin can inspect pages across tenants
    admin_resp = _run_async(get_history_pages(history_id=record.id, current_user=admin, db=db))
    assert admin_resp.success is True
    assert admin_resp.data.total_pages == 4


# ── 9. Legacy History Without `pages` Field ───────────────────────────────────


def test_legacy_history_without_pages_handled_safely(isolated_env):
    db = isolated_env["db"]
    user_a = isolated_env["user_a"]
    doc_a = isolated_env["doc_a"]
    storage = isolated_env["storage"]
    legacy_record = _seed_history_with_pages(db, user_a, doc_a, pages=None)

    # GET /pages returns empty list cleanly
    pages_resp = _run_async(get_history_pages(history_id=legacy_record.id, current_user=user_a, db=db))
    assert pages_resp.success is True
    assert pages_resp.data.total_pages == 0
    assert pages_resp.data.pages == []

    # GET /pages/1 returns 404
    with pytest.raises(NotFoundException):
        _run_async(
            get_history_page_detail(history_id=legacy_record.id, page_number=1, current_user=user_a, db=db)
        )

    # PUT /pages/1 must reject with 400 PAGE_DATA_UNAVAILABLE rather than fabricating page data
    with pytest.raises(BadRequestException) as exc_info:
        _run_async(
            update_history_page_result(
                history_id=legacy_record.id,
                page_number=1,
                payload=PageTranslationUpdateRequest(translated_text="Should not fabricate page 1"),
                current_user=user_a,
                db=db,
            )
        )
    assert exc_info.value.error_code == "PAGE_DATA_UNAVAILABLE"

    # Confirm legacy JSON file on disk was NOT mutated
    json_path = storage.get_result_path(user_a.id, legacy_record.result_path)
    raw_legacy = json.loads(json_path.read_text(encoding="utf-8"))
    assert "pages" not in raw_legacy
    assert raw_legacy["translated_text"] == "Bản dịch trang 2.\n\nBản dịch trang 5.\n\nBản dịch trang 6."


# ── Transactional Consistency & Rollback Restoration ──────────────────────────


def test_save_history_page_result_restores_disk_file_on_db_commit_failure(isolated_env):
    db = isolated_env["db"]
    user_a = isolated_env["user_a"]
    doc_a = isolated_env["doc_a"]
    storage = isolated_env["storage"]
    record = _seed_history_with_pages(db, user_a, doc_a, pages=_sample_non_contiguous_pages())

    json_path = storage.get_result_path(user_a.id, record.result_path)
    original_bytes = json_path.read_bytes()

    with patch.object(db, "commit", side_effect=OperationalError("COMMIT", {}, Exception("disk error"))):
        with pytest.raises(OperationalError):
            history_service.save_history_page_result(
                db=db,
                history_id=record.id,
                page_number=2,
                translated_text="Should roll back on DB failure",
                current_user_id=user_a.id,
            )

    # Disk file must match pre-update bytes exactly after rollback
    assert json_path.read_bytes() == original_bytes
    assert datetime.now(timezone.utc) is not None
