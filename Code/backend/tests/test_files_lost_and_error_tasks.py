"""
Unit & Integration Tests for:
- PDFL-96: Xử lý lỗi khi tải file, mất kết nối hoặc quá giới hạn
- PDFL-97: Xóa các file tạm khi hoàn tất xử lý hoặc khi xảy ra lỗi
- PDFL-108: Hiển thị kết quả trích xuất trên giao diện
- PDFL-112: Trả thông báo rõ ràng khi không trích xuất được nội dung
"""

import io
import tempfile
from pathlib import Path
from unittest.mock import patch

import pypdf
from app.main import app
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

client = TestClient(app)


def create_sample_pdf_bytes(text: str = "Tài liệu kiểm thử trích xuất tiếng Việt.") -> bytes:
    """Helper to generate in-memory valid digital PDF bytes."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(100, 700, text)
    c.save()
    return buf.getvalue()


def create_blank_pdf_bytes() -> bytes:
    """Helper to generate valid PDF structure without text content."""
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=300, height=300)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


# ==============================================================================
# PDFL-96: Xử lý lỗi khi tải file, mất kết nối hoặc quá giới hạn
# ==============================================================================

def test_pdfl_96_reject_non_pdf_extension():
    """Verify system rejects files without .pdf extension with HTTP 400."""
    files = {"file": ("document.docx", b"dummy content", "application/octet-stream")}
    res = client.post("/api/process/upload-and-translate", files=files)
    assert res.status_code == 400
    data = res.json()
    msg = data.get("message", "") or data.get("detail", "")
    assert "phải có định dạng .pdf" in msg


def test_pdfl_96_reject_fake_magic_bytes():
    """Verify system inspects magic bytes and rejects files masquerading as PDF."""
    files = {"file": ("malicious.pdf", b"MZThis is not a real PDF", "application/pdf")}
    res = client.post("/api/process/upload-and-translate", files=files)
    assert res.status_code == 400
    data = res.json()
    msg = data.get("message", "") or data.get("detail", "")
    assert "Magic Bytes" in msg


def test_pdfl_96_reject_file_exceeding_free_limit():
    """Verify system rejects files exceeding 20MB limit for unauthenticated/free users."""
    # 21 MB payload
    large_payload = b"%PDF-1.4\n" + b"0" * (21 * 1024 * 1024)
    files = {"file": ("oversized.pdf", large_payload, "application/pdf")}
    res = client.post("/api/process/upload-and-translate", files=files)
    assert res.status_code == 413
    data = res.json()
    msg = data.get("message", "") or data.get("detail", "")
    assert "vượt quá giới hạn 20MB" in msg


def test_pdfl_96_reject_corrupt_pdf():
    """Verify system rejects corrupted PDF structure with HTTP 400."""
    corrupt_content = b"%PDF-1.4\n%%EOF_CORRUPTED_STREAM"
    files = {"file": ("corrupt.pdf", corrupt_content, "application/pdf")}
    res = client.post("/api/process/upload-and-translate", files=files)
    assert res.status_code == 400
    data = res.json()
    msg = data.get("message", "") or data.get("detail", "")
    assert "Lỗi đọc tệp PDF" in msg or "không hợp lệ" in msg or "hỏng" in msg


# ==============================================================================
# PDFL-97: Xóa các file tạm khi hoàn tất xử lý hoặc khi xảy ra lỗi
# ==============================================================================

def test_pdfl_97_temp_file_deleted_after_successful_processing():
    """Verify temporary file created during processing is removed from disk on success."""
    created_temp_paths = []
    original_named_temp = tempfile.NamedTemporaryFile

    def tracking_temp_file(*args, **kwargs):
        temp_obj = original_named_temp(*args, **kwargs)
        created_temp_paths.append(Path(temp_obj.name))
        return temp_obj

    pdf_bytes = create_sample_pdf_bytes("Testing auto cleanup of temp files.")
    files = {"file": ("clean_test.pdf", pdf_bytes, "application/pdf")}

    with patch("tempfile.NamedTemporaryFile", side_effect=tracking_temp_file):
        res = client.post("/api/process/upload-and-translate", files=files)

    assert res.status_code == 200
    assert len(created_temp_paths) > 0
    for p in created_temp_paths:
        assert not p.exists(), f"Temp file {p} was not cleaned up after success!"


def test_pdfl_97_temp_file_deleted_after_error_processing():
    """Verify temporary file is removed even when processing raises validation/parsing error."""
    created_temp_paths = []
    original_named_temp = tempfile.NamedTemporaryFile

    def tracking_temp_file(*args, **kwargs):
        temp_obj = original_named_temp(*args, **kwargs)
        created_temp_paths.append(Path(temp_obj.name))
        return temp_obj

    # Invalid PDF that passes magic bytes check but fails PDF validation
    fake_pdf = b"%PDF-1.4\nBROKEN_INTERNAL_STRUCTURE"
    files = {"file": ("broken.pdf", fake_pdf, "application/pdf")}

    with patch("tempfile.NamedTemporaryFile", side_effect=tracking_temp_file):
        res = client.post("/api/process/upload-and-translate", files=files)

    assert res.status_code == 400
    assert len(created_temp_paths) > 0
    for p in created_temp_paths:
        assert not p.exists(), f"Temp file {p} was not cleaned up after error!"


# ==============================================================================
# PDFL-108: Hiển thị kết quả trích xuất trên giao diện (API Data Contract)
# ==============================================================================

def test_pdfl_108_extraction_response_structure_and_text():
    """Verify endpoint provides all fields required by workspace.js to render extraction."""
    raw_text = "Natural Language Processing and Machine Learning in PDF-Lingua."
    pdf_bytes = create_sample_pdf_bytes(raw_text)
    files = {"file": ("ai_report.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi"}

    res = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    doc = body["data"]

    # Required fields for workspace.js renderWorkspace()
    assert doc["filename"] == "ai_report.pdf"
    assert doc["page_count"] == 1
    assert isinstance(doc["file_size_mb"], float)
    assert doc["target_lang"] == "vi"
    assert "is_ocr_used" in doc
    assert isinstance(doc["is_ocr_used"], bool)
    assert "original_text" in doc
    assert raw_text in doc["original_text"]
    assert "translated_text" in doc
    assert len(doc["translated_text"]) > 0


# ==============================================================================
# PDFL-112: Trả thông báo rõ ràng khi không trích xuất được nội dung
# ==============================================================================

def test_pdfl_112_blank_page_without_text_raises_422():
    """Verify blank PDF without extractable text returns clear HTTP 422 error message."""
    blank_pdf = create_blank_pdf_bytes()
    files = {"file": ("blank_document.pdf", blank_pdf, "application/pdf")}

    # Mock OCR returning empty text to simulate blank scanned page
    with patch("app.services.ocr_service.OCRService.extract_text_from_scanned_pdf", return_value={"text": "", "page_count": 1}):
        res = client.post("/api/process/upload-and-translate", files=files)

    assert res.status_code == 422
    data = res.json()
    detail = data.get("message", "") or data.get("detail", "")
    assert "Không thể trích xuất văn bản từ tài liệu này" in detail
    assert "tài liệu rỗng hoặc máy chủ chưa bật OCR" in detail


def test_pdfl_112_zero_page_pdf_raises_400():
    """Verify PDF with 0 valid pages returns clear HTTP 400 error message."""
    # Create empty PDF with 0 pages
    writer = pypdf.PdfWriter()
    buf = io.BytesIO()
    writer.write(buf)
    zero_page_pdf = buf.getvalue()

    files = {"file": ("zero_page.pdf", zero_page_pdf, "application/pdf")}
    res = client.post("/api/process/upload-and-translate", files=files)
    assert res.status_code == 400
    data = res.json()
    detail = data.get("message", "") or data.get("detail", "")
    assert "không có trang nào hợp lệ" in detail
