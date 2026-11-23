"""
Backend Page-Based Translation Pipeline Test Suite
--------------------------------------------------
Verifies:
1. Per-page schemas (`PageTranslationItem`, `PageTranslationUpdateRequest`,
   `PageTranslationListResponse`) and backward compatibility defaults on
   `ProcessResponseData` and `ProcessingResultResponse`.
2. `TranslationService.translate_pages` for multi-page translation, blank/empty
   page skipping, non-contiguous page selection, and OCR/engine preservation.
3. Synchronous `/api/process/upload-and-translate` and asynchronous
   `_execute_pdf_background_job` pipelines for Digital PDFs, Hybrid/OCR PDFs,
   non-contiguous page selection, and JSON result persistence via HistoryService.
"""

import inspect
import io
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from app.api import process as process_module
from app.core.database import Base
from app.models.document import Document
from app.models.processing_history import ProcessingHistory
from app.models.user import User, UserRole
from app.schemas.process import (
    PageTranslationItem,
    PageTranslationListResponse,
    PageTranslationUpdateRequest,
    ProcessResponseData,
)
from app.schemas.processing_history import ProcessingResultResponse
from app.services.history_service import HistoryService, history_service
from app.services.job_service import JobStatus, job_manager
from app.services.storage_service import StorageService
from app.services.translation_service import TranslationService
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def run_coro(coro):
    """Execute nested coroutines synchronously without creating an OS event loop."""
    gen = coro.__await__()
    val = None
    while True:
        try:
            future = gen.send(val)
            if inspect.iscoroutine(future):
                val = run_coro(future)
            else:
                val = future
        except StopIteration as exc:
            return exc.value


class MockUploadFile:
    """Lightweight UploadFile stand-in for invoking FastAPI endpoints directly."""

    def __init__(self, filename: str, content: bytes, content_type: str = "application/pdf"):
        self.filename = filename
        self.content = content
        self.content_type = content_type

    async def read(self) -> bytes:
        return self.content


def create_custom_pdf_bytes(page_texts: list[str | None]) -> bytes:
    """Create an in-memory multi-page PDF; None or empty string produces a blank page."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    for text in page_texts:
        if text:
            c.drawString(72, 720, text)
        c.showPage()
    c.save()
    return buf.getvalue()


@pytest.fixture()
def isolated_db_and_storage(tmp_path):
    """Provide an isolated in-memory SQLite session factory and temporary storage."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    user = User(
        email="page_pipeline_tester@example.com",
        hashed_password="hashed-test-password",
        full_name="Page Pipeline Tester",
        role=UserRole.PRO,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    temp_storage = StorageService(base_dir=tmp_path / "documents")
    orig_process_storage = process_module.storage_service
    orig_history_storage = HistoryService.storage_service
    orig_history_instance_storage = history_service.storage_service

    process_module.storage_service = temp_storage
    HistoryService.storage_service = temp_storage
    history_service.storage_service = temp_storage

    try:
        yield {
            "db": db,
            "SessionLocal": TestingSessionLocal,
            "user": user,
            "storage": temp_storage,
        }
    finally:
        process_module.storage_service = orig_process_storage
        HistoryService.storage_service = orig_history_storage
        history_service.storage_service = orig_history_instance_storage
        db.close()
        engine.dispose()


# ── Schema Validation & Backward Compatibility ────────────────────────────────


def test_process_response_data_backward_compatibility_defaults():
    legacy_payload = {
        "filename": "legacy.pdf",
        "page_count": 2,
        "file_size_mb": 0.5,
        "target_lang": "vi",
        "is_ocr_used": False,
        "original_text": "Hello world",
        "translated_text": "Xin chào thế giới",
        "engine_used": "google",
    }
    parsed = ProcessResponseData.model_validate(legacy_payload)
    assert parsed.pages == []

    parsed_none = ProcessResponseData.model_validate({**legacy_payload, "pages": None})
    assert parsed_none.pages == []


def test_processing_result_response_backward_compatibility_defaults():
    legacy_result = {
        "history_id": 10,
        "document_id": 20,
        "document_filename": "old_record.pdf",
        "action_type": "TRANSLATE",
        "target_lang": "vi",
        "original_text": "Old content",
        "translated_text": "Nội dung cũ",
        "engine_used": "google",
    }
    parsed = ProcessingResultResponse.model_validate(legacy_result)
    assert parsed.pages == []

    parsed_none = ProcessingResultResponse.model_validate({**legacy_result, "pages": None})
    assert parsed_none.pages == []


def test_page_translation_schemas_validation():
    item = PageTranslationItem(
        page_number=2,
        original_text="Second page",
        translated_text="Trang thứ hai",
        is_ocr_used=True,
        is_blank=False,
        target_lang="vi",
        engine_used="google",
        status="completed",
        updated_at="2026-11-22T15:00:00+00:00",
    )
    assert item.page_number == 2
    assert item.is_ocr_used is True

    update_req = PageTranslationUpdateRequest(
        translated_text="Bản dịch đã chỉnh sửa",
        target_lang="vi",
    )
    assert update_req.translated_text == "Bản dịch đã chỉnh sửa"
    assert update_req.original_text is None

    list_resp = PageTranslationListResponse(
        history_id=1,
        document_id=2,
        target_lang="vi",
        total_pages=1,
        pages=[item],
    )
    assert list_resp.total_pages == 1
    assert len(list_resp.pages) == 1

    with pytest.raises(Exception):
        PageTranslationItem(page_number=0)


# ── TranslationService.translate_pages Unit Tests ─────────────────────────────


def test_translate_pages_multi_page_preserves_order_and_aggregates():
    svc = TranslationService()
    calls = []

    def fake_translate(text, target_lang="vi", source_lang="auto", **kwargs):
        calls.append(text)
        engine = "google" if "Page 1" in text else "google_web"
        return {
            "translated_text": f"[VI] {text}",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "chunk_count": 1,
            "engine_used": engine,
        }

    with patch.object(svc, "translate_text", side_effect=fake_translate):
        res = svc.translate_pages(
            [
                {"page": 1, "text": "Page 1 introduction.", "is_ocr_used": False, "is_blank": False},
                {"page": 2, "text": "Page 2 methodology.", "is_ocr_used": False, "is_blank": False},
                {"page": 3, "text": "Page 3 conclusion.", "is_ocr_used": True, "is_blank": False},
            ],
            target_lang="vi",
        )

    assert len(calls) == 3
    assert len(res["pages"]) == 3
    assert [p["page_number"] for p in res["pages"]] == [1, 2, 3]
    assert [p["is_ocr_used"] for p in res["pages"]] == [False, False, True]
    assert all(p["status"] == "completed" for p in res["pages"])
    assert all(p["target_lang"] == "vi" for p in res["pages"])
    assert all(p["updated_at"] for p in res["pages"])
    assert res["translated_text"] == (
        "[VI] Page 1 introduction.\n\n[VI] Page 2 methodology.\n\n[VI] Page 3 conclusion."
    )
    assert res["engine_used"] == "google, google_web"
    assert res["chunk_count"] == 3


def test_translate_pages_skips_blank_and_empty_pages_while_preserving_page_numbers():
    svc = TranslationService()
    translated_inputs = []

    def fake_translate(text, target_lang="vi", source_lang="auto", **kwargs):
        translated_inputs.append(text)
        return {
            "translated_text": f"[VI] {text}",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "chunk_count": 1,
            "engine_used": "google",
        }

    with patch.object(svc, "translate_text", side_effect=fake_translate):
        res = svc.translate_pages(
            [
                {"page": 1, "text": "First content page.", "is_ocr_used": False, "is_blank": False},
                {"page": 2, "text": "", "is_ocr_used": False, "is_blank": True},
                {"page": 3, "text": "   \n\t  ", "is_ocr_used": True, "is_blank": False},
                {"page": 4, "text": "Fourth content page.", "is_ocr_used": True, "is_blank": False},
            ],
            target_lang="vi",
        )

    # Blank and whitespace-only pages must NOT invoke translate_text
    assert translated_inputs == ["First content page.", "Fourth content page."]
    assert [p["page_number"] for p in res["pages"]] == [1, 2, 3, 4]

    assert res["pages"][1]["is_blank"] is True
    assert res["pages"][1]["status"] == "blank"
    assert res["pages"][1]["translated_text"] == ""
    assert res["pages"][1]["engine_used"] == "none"

    assert res["pages"][2]["is_blank"] is True
    assert res["pages"][2]["status"] == "blank"
    assert res["pages"][2]["is_ocr_used"] is True
    assert res["pages"][2]["translated_text"] == ""

    assert res["translated_text"] == "[VI] First content page.\n\n[VI] Fourth content page."
    assert res["engine_used"] == "google"


def test_translate_pages_non_contiguous_page_selection():
    svc = TranslationService()

    def fake_translate(text, target_lang="en", source_lang="auto", **kwargs):
        return {
            "translated_text": f"[EN] {text}",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "chunk_count": 1,
            "engine_used": "google",
        }

    with patch.object(svc, "translate_text", side_effect=fake_translate):
        res = svc.translate_pages(
            [
                {"page": 2, "text": "Nội dung trang 2", "is_ocr_used": False, "is_blank": False},
                {"page": 5, "text": "Nội dung trang 5", "is_ocr_used": False, "is_blank": False},
                {"page": 6, "text": "Nội dung trang 6", "is_ocr_used": True, "is_blank": False},
            ],
            target_lang="en",
        )

    assert [p["page_number"] for p in res["pages"]] == [2, 5, 6]
    assert res["pages"][0]["translated_text"] == "[EN] Nội dung trang 2"
    assert res["pages"][1]["translated_text"] == "[EN] Nội dung trang 5"
    assert res["pages"][2]["translated_text"] == "[EN] Nội dung trang 6"
    assert res["pages"][2]["is_ocr_used"] is True


def test_translate_pages_empty_list():
    svc = TranslationService()
    res = svc.translate_pages([], target_lang="vi")
    assert res["pages"] == []
    assert res["translated_text"] == ""
    assert res["original_text"] == ""
    assert res["engine_used"] == "none"
    assert res["chunk_count"] == 0


# ── Sync Upload Pipeline Tests (Digital, Non-Contiguous, Blank, Hybrid/OCR) ──


def test_sync_upload_digital_multipage_with_blank_and_history_persistence(isolated_db_and_storage):
    ctx = isolated_db_and_storage
    pdf_bytes = create_custom_pdf_bytes([
        "Page 1 digital content for testing.",
        None,
        "Page 3 digital content after blank page.",
    ])

    def fake_translate(text, target_lang="vi", source_lang="auto", **kwargs):
        return {
            "translated_text": f"[DICH] {text}",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "chunk_count": 1,
            "engine_used": "mock_google",
        }

    with patch.object(process_module.translation_service, "translate_text", side_effect=fake_translate):
        resp = run_coro(
            process_module.upload_and_translate(
                file=MockUploadFile("digital_with_blank.pdf", pdf_bytes),
                target_lang="vi",
                pages=None,
                current_user=ctx["user"],
                db=ctx["db"],
            )
        )

    assert resp.success is True
    data = resp.data.model_dump()

    assert data["page_count"] == 3
    assert data["is_ocr_used"] is False
    assert len(data["pages"]) == 3
    assert [p["page_number"] for p in data["pages"]] == [1, 2, 3]

    assert data["pages"][0]["status"] == "completed"
    assert "Page 1 digital content" in data["pages"][0]["original_text"]
    assert data["pages"][0]["translated_text"].startswith("[DICH]")

    assert data["pages"][1]["is_blank"] is True
    assert data["pages"][1]["status"] == "blank"
    assert data["pages"][1]["translated_text"] == ""

    assert data["pages"][2]["status"] == "completed"
    assert "Page 3 digital content" in data["pages"][2]["original_text"]

    # Verify history JSON result persisted pages and deserializes via ProcessingResultResponse
    history_id = data["history_id"]
    assert history_id is not None
    persisted = history_service.get_history_result(
        ctx["db"],
        history_id=history_id,
        current_user_id=ctx["user"].id,
    )
    validated_hist = ProcessingResultResponse.model_validate(persisted)
    assert len(validated_hist.pages) == 3
    assert [p.page_number for p in validated_hist.pages] == [1, 2, 3]
    assert validated_hist.pages[1].is_blank is True


def test_sync_upload_non_contiguous_page_selection(isolated_db_and_storage):
    ctx = isolated_db_and_storage
    pdf_bytes = create_custom_pdf_bytes([
        f"Content of page number {i} in document." for i in range(1, 7)
    ])

    def fake_translate(text, target_lang="vi", source_lang="auto", **kwargs):
        return {
            "translated_text": f"[VI] {text}",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "chunk_count": 1,
            "engine_used": "mock_google",
        }

    with patch.object(process_module.translation_service, "translate_text", side_effect=fake_translate):
        resp = run_coro(
            process_module.upload_and_translate(
                file=MockUploadFile("six_pages.pdf", pdf_bytes),
                target_lang="vi",
                pages="2, 5-6",
                current_user=ctx["user"],
                db=ctx["db"],
            )
        )

    assert resp.success is True
    data = resp.data.model_dump()
    assert data["page_count"] == 3
    assert [p["page_number"] for p in data["pages"]] == [2, 5, 6]
    assert "page number 2" in data["pages"][0]["original_text"]
    assert "page number 5" in data["pages"][1]["original_text"]
    assert "page number 6" in data["pages"][2]["original_text"]
    assert "page number 1" not in data["original_text"]
    assert "page number 3" not in data["original_text"]
    assert "page number 4" not in data["original_text"]


def test_sync_upload_hybrid_ocr_fallback_preserves_per_page_ocr_flags(isolated_db_and_storage):
    ctx = isolated_db_and_storage
    pdf_bytes = create_custom_pdf_bytes([None, None, None])

    mock_hybrid_res = {
        "document_type": "mixed",
        "text": "Digital page 1 text.\n\nScanned OCR page 3 text.",
        "page_count": 3,
        "pages": [
            {"page": 1, "text": "Digital page 1 text.", "type": "digital", "is_ocr_used": False, "is_blank": False},
            {"page": 2, "text": "", "type": "scanned", "is_ocr_used": True, "is_blank": True},
            {"page": 3, "text": "Scanned OCR page 3 text.", "type": "scanned", "is_ocr_used": True, "is_blank": False},
        ],
        "fast_path_used": False,
        "ocr_pages_count": 2,
    }

    def fake_translate(text, target_lang="vi", source_lang="auto", **kwargs):
        return {
            "translated_text": f"[OCR-VI] {text}",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "chunk_count": 1,
            "engine_used": "mock_google",
        }

    with (
        patch.object(process_module.pdf_service, "is_scanned_pdf", return_value=True),
        patch.object(process_module.pdf_service, "extract_hybrid_fast_path", return_value=mock_hybrid_res),
        patch.object(process_module.translation_service, "translate_text", side_effect=fake_translate),
    ):
        resp = run_coro(
            process_module.upload_and_translate(
                file=MockUploadFile("mixed_hybrid.pdf", pdf_bytes),
                target_lang="vi",
                pages=None,
                current_user=ctx["user"],
                db=ctx["db"],
            )
        )

    assert resp.success is True
    data = resp.data.model_dump()
    assert data["is_ocr_used"] is True
    assert len(data["pages"]) == 3
    assert [p["page_number"] for p in data["pages"]] == [1, 2, 3]
    assert [p["is_ocr_used"] for p in data["pages"]] == [False, True, True]
    assert data["pages"][1]["status"] == "blank"
    assert data["pages"][2]["translated_text"] == "[OCR-VI] Scanned OCR page 3 text."


# ── Background Job Pipeline Tests ─────────────────────────────────────────────


def test_background_job_persists_pages_with_non_contiguous_selection_and_ocr(isolated_db_and_storage):
    ctx = isolated_db_and_storage
    pdf_bytes = create_custom_pdf_bytes([
        f"Background job page {i} content." for i in range(1, 7)
    ])

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(pdf_bytes)
        tmp_path = Path(tmp.name)

    mock_hybrid_res = {
        "document_type": "mixed",
        "text": "Digital page 2 content.\n\nOCR page 6 content.",
        "page_count": 3,
        "pages": [
            {"page": 2, "text": "Digital page 2 content.", "type": "digital", "is_ocr_used": False, "is_blank": False},
            {"page": 5, "text": "", "type": "scanned", "is_ocr_used": True, "is_blank": True},
            {"page": 6, "text": "OCR page 6 content.", "type": "scanned", "is_ocr_used": True, "is_blank": False},
        ],
        "fast_path_used": False,
        "ocr_pages_count": 2,
    }

    def fake_translate(text, target_lang="vi", source_lang="auto", **kwargs):
        return {
            "translated_text": f"[BG-VI] {text}",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "chunk_count": 1,
            "engine_used": "mock_bg_engine",
        }

    job = job_manager.create_job(filename="bg_mixed.pdf", target_lang="vi")

    with (
        patch.object(process_module, "SessionLocal", ctx["SessionLocal"]),
        patch.object(process_module.pdf_service, "extract_hybrid_fast_path", return_value=mock_hybrid_res),
        patch.object(process_module.translation_service, "translate_text", side_effect=fake_translate),
    ):
        process_module._execute_pdf_background_job(
            job_id=job.job_id,
            tmp_path=tmp_path,
            filename="bg_mixed.pdf",
            target_lang="vi",
            max_allowed_pages=500,
            file_size_mb=0.05,
            user_id=ctx["user"].id,
            file_size_bytes=len(pdf_bytes),
            selected_pages=[1, 4, 5],
        )

    final_job = job_manager.get_job(job.job_id)
    assert final_job is not None
    assert final_job.status == JobStatus.COMPLETED
    result = final_job.result
    assert result is not None
    assert result["is_ocr_used"] is True
    assert result["page_count"] == 3
    assert [p["page_number"] for p in result["pages"]] == [2, 5, 6]
    assert [p["is_ocr_used"] for p in result["pages"]] == [False, True, True]
    assert result["pages"][0]["translated_text"] == "[BG-VI] Digital page 2 content."
    assert result["pages"][1]["status"] == "blank"
    assert result["pages"][1]["translated_text"] == ""
    assert result["pages"][2]["translated_text"] == "[BG-VI] OCR page 6 content."
    assert result["translated_text"] == "[BG-VI] Digital page 2 content.\n\n[BG-VI] OCR page 6 content."

    # Verify persisted JSON file on disk has identical pages list
    history_id = result["history_id"]
    assert history_id is not None
    db_verify = ctx["SessionLocal"]()
    try:
        hist_row = db_verify.query(ProcessingHistory).filter(ProcessingHistory.id == history_id).first()
        assert hist_row is not None
        assert hist_row.result_path is not None

        saved_json_path = ctx["storage"].get_result_path(ctx["user"].id, hist_row.result_path)
        assert saved_json_path is not None and saved_json_path.is_file()
        raw_saved = json.loads(saved_json_path.read_text(encoding="utf-8"))
        assert len(raw_saved["pages"]) == 3
        assert [p["page_number"] for p in raw_saved["pages"]] == [2, 5, 6]

        doc_row = db_verify.query(Document).filter(Document.id == result["document_id"]).first()
        assert doc_row is not None
    finally:
        db_verify.close()


def test_background_job_fallback_when_hybrid_mock_omits_pages(isolated_db_and_storage):
    pdf_bytes = create_custom_pdf_bytes(["Legacy mock text only."])

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(pdf_bytes)
        tmp_path = Path(tmp.name)

    legacy_hybrid_res = {
        "text": "Flat extracted text without pages key.",
        "fast_path_used": True,
        "ocr_pages_count": 0,
    }

    def fake_translate(text, target_lang="vi", source_lang="auto", **kwargs):
        return {
            "translated_text": f"[LEGACY] {text}",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "chunk_count": 1,
            "engine_used": "mock_engine",
        }

    job = job_manager.create_job(filename="legacy_mock.pdf", target_lang="vi")

    with (
        patch.object(process_module.pdf_service, "extract_hybrid_fast_path", return_value=legacy_hybrid_res),
        patch.object(process_module.translation_service, "translate_text", side_effect=fake_translate),
    ):
        process_module._execute_pdf_background_job(
            job_id=job.job_id,
            tmp_path=tmp_path,
            filename="legacy_mock.pdf",
            target_lang="vi",
            max_allowed_pages=100,
            file_size_mb=0.01,
            user_id=None,
        )

    final_job = job_manager.get_job(job.job_id)
    assert final_job is not None
    assert final_job.status == JobStatus.COMPLETED
    assert len(final_job.result["pages"]) == 1
    assert final_job.result["pages"][0]["page_number"] == 1
    assert final_job.result["pages"][0]["translated_text"] == "[LEGACY] Flat extracted text without pages key."
