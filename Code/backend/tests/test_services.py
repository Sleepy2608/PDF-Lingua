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


def test_pdf_service_max_pages_constraint(tmp_path: Path):
    writer = pypdf.PdfWriter()
    for _ in range(5):
        writer.add_blank_page(width=200, height=200)
    pdf_file = tmp_path / "multipage.pdf"
    with open(pdf_file, "wb") as f:
        writer.write(f)

    service = PDFService()
    assert service.get_page_count(pdf_file) == 5

    pages_all = service.extract_pages(pdf_file)
    assert len(pages_all) == 5

    pages_limited = service.extract_pages(pdf_file, max_pages=2)
    assert len(pages_limited) == 2


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


def test_pdf_service_whitespace_cleaning_with_spaces_on_newlines():
    raw_text = "Đoạn văn 1.\n \nĐoạn văn 2.\n   \nĐoạn văn 3."
    cleaned = PDFService._clean_whitespace(raw_text)
    assert cleaned == "Đoạn văn 1.\n\nĐoạn văn 2.\n\nĐoạn văn 3."


def test_translation_service_is_isolated_char_list():
    service = TranslationService()

    # Isolated character list (e.g. alphabet)
    assert service.is_isolated_char_list("Ă Â Ơ Ô Ê Ư Á À Ạ Ã Ả Ỏ Ò Ó Ỏ Ọ Õ") is True
    assert service.is_isolated_char_list("A B C D E\nF G H I J") is True

    # Multi-line text with regular paragraphs containing an alphabet line (must NOT be treated as isolated char list)
    mixed_text = "Đây là văn bản thử nghiệm.\nĂ Â Ơ Ô Ê Ư Á À Ạ Ã Ả Ỏ Ò Ó Ỏ Ọ Õ\nNội dung tiếp theo."
    assert service.is_isolated_char_list(mixed_text) is False

    # Regular single sentences or normal words
    assert service.is_isolated_char_list("Xin chào mọi người") is False
    assert service.is_isolated_char_list("") is False


def test_translation_service_chunking_with_spaced_newlines():
    service = TranslationService()
    # Paragraphs with different script categories separated by spaced newlines
    text = "Đoạn tiếng Việt.\n \nこんにちは世界\n  \nĂ Â Ơ Ô Ê Ư Á À Ạ"
    chunks = service.chunk_text(text)
    assert len(chunks) == 3
    assert chunks[0] == "Đoạn tiếng Việt."
    assert chunks[1] == "こんにちは世界"
    assert chunks[2] == "Ă Â Ơ Ô Ê Ư Á À Ạ"


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


def test_pdf_service_multi_column_reading_order(tmp_path: Path):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    pdf_file = tmp_path / "two_column.pdf"
    c = canvas.Canvas(str(pdf_file), pagesize=letter)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(100, 750, "Full Width Document Title")

    c.setFont("Helvetica", 10)
    # Draw interleaved rows:
    # Row 1
    c.drawString(50, 700, "Left Col Line 1")
    c.drawString(320, 700, "Right Col Line 1")
    # Row 2
    c.drawString(50, 680, "Left Col Line 2")
    c.drawString(320, 680, "Right Col Line 2")
    # Row 3
    c.drawString(50, 660, "Left Col Line 3")
    c.drawString(320, 660, "Right Col Line 3")

    c.drawString(100, 100, "Full Width Document Footer")
    c.save()

    service = PDFService()
    text = service.extract_text(pdf_file)

    # Verify natural reading order: Title -> Left lines 1, 2, 3 -> Right lines 1, 2, 3 -> Footer
    assert "Full Width Document Title" in text
    left_1_idx = text.find("Left Col Line 1")
    left_2_idx = text.find("Left Col Line 2")
    left_3_idx = text.find("Left Col Line 3")
    right_1_idx = text.find("Right Col Line 1")
    right_2_idx = text.find("Right Col Line 2")
    right_3_idx = text.find("Right Col Line 3")
    footer_idx = text.find("Full Width Document Footer")

    assert left_1_idx != -1
    assert left_1_idx < left_2_idx < left_3_idx
    assert left_3_idx < right_1_idx
    assert right_1_idx < right_2_idx < right_3_idx
    assert right_3_idx < footer_idx


def test_pdf_service_single_column_preservation(tmp_path: Path):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    pdf_file = tmp_path / "single_column.pdf"
    c = canvas.Canvas(str(pdf_file), pagesize=letter)
    c.setFont("Helvetica", 10)
    c.drawString(50, 700, "Header line of document")
    c.drawString(50, 680, "Paragraph one regular text")
    c.drawString(50, 660, "Paragraph two regular text")
    c.save()

    service = PDFService()
    text = service.extract_text(pdf_file)

    p1_idx = text.find("Header line of document")
    p2_idx = text.find("Paragraph one regular text")
    p3_idx = text.find("Paragraph two regular text")

    assert p1_idx != -1 and p2_idx != -1 and p3_idx != -1
    assert p1_idx < p2_idx < p3_idx
