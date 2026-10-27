import io
from pathlib import Path
import pypdf
import pytest

from app.services.pdf_service import PDFService
from app.services.ocr_service import OCRService
from app.services.translation_service import TranslationService
from app.services.export_service import ExportService


@pytest.fixture
def sample_pdf(tmp_path: Path) -> Path:
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=200, height=200)
    pdf_file = tmp_path / "sample.pdf"
    with open(pdf_file, "wb") as f:
        writer.write(f)
    return pdf_file


def test_pdf_service_page_count_and_validation(sample_pdf: Path):
    service = PDFService()
    validation = service.validate_pdf(sample_pdf)

    assert validation["is_valid"] is True
    assert validation["is_encrypted"] is False
    assert validation["page_count"] == 1
    assert service.get_page_count(sample_pdf) == 1


def test_pdf_service_scanned_detection(sample_pdf: Path):
    service = PDFService()
    assert service.is_scanned_pdf(sample_pdf) is True


def test_ocr_service_availability():
    service = OCRService()
    avail = service.is_available()
    assert isinstance(avail, bool)


def test_translation_service_chunking():
    service = TranslationService()
    short_text = "Câu ngắn thử nghiệm."
    chunks = service.chunk_text(short_text, max_chars=100)
    assert len(chunks) == 1
    assert chunks[0] == short_text

    long_text = ". ".join([f"Đây là câu thứ {i}" for i in range(50)])
    long_chunks = service.chunk_text(long_text, max_chars=150)
    assert len(long_chunks) > 1
    for chunk in long_chunks:
        assert len(chunk) <= 150


def test_translation_service_empty_text():
    service = TranslationService()
    res = service.translate_text("")
    assert res["translated_text"] == ""
    assert res["chunk_count"] == 0


def test_export_service_txt():
    service = ExportService()
    content = "Nội dung tiếng Việt thử nghiệm: Xin chào thế giới."
    txt_bytes = service.export_to_txt(content, title="Tiêu Đề")

    assert isinstance(txt_bytes, bytes)
    decoded = txt_bytes.decode("utf-8-sig")
    assert "Tiêu Đề" in decoded
    assert content in decoded


def test_export_service_pdf():
    service = ExportService()
    content = "Bản dịch tài liệu tiếng Việt hoàn chỉnh."
    pdf_bytes = service.export_to_pdf(content, title="Báo Cáo Dịch", original_content="Original text in English.")

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")
