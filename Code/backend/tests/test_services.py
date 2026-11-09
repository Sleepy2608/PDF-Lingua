from pathlib import Path

import pypdf
import pytest
from app.services.export_service import ExportService
from app.services.ocr_service import OCRService
from app.services.pdf_service import PDFService
from app.services.translation_service import TranslationService


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


def test_export_service_txt_4_types():
    service = ExportService()
    orig = "Đoạn văn gốc trích xuất từ tài liệu."
    trans = "Bản dịch tiếng Việt hoàn chỉnh."
    summ = "- Ý chính 1\n- Ý chính 2"

    # 1. Original
    b_orig = service.export_to_txt(orig, title="Gốc", export_type="original")
    d_orig = b_orig.decode("utf-8-sig")
    assert "=== 1. VĂN BẢN GỐC ===" not in d_orig
    assert orig in d_orig

    # 2. Translated
    b_trans = service.export_to_txt(trans, title="Dịch", export_type="translated")
    d_trans = b_trans.decode("utf-8-sig")
    assert "=== 1. VĂN BẢN GỐC ===" not in d_trans
    assert trans in d_trans

    # 3. Summary
    b_summ = service.export_to_txt(summ, title="Tóm Tắt", export_type="summary")
    d_summ = b_summ.decode("utf-8-sig")
    assert "=== 1. VĂN BẢN GỐC ===" not in d_summ
    assert summ in d_summ

    # 4. Bilingual: có đủ hai phần
    b_bi = service.export_to_txt(trans, title="Song Ngữ", export_type="bilingual", original_content=orig)
    d_bi = b_bi.decode("utf-8-sig")
    assert "=== 1. VĂN BẢN GỐC ===" in d_bi
    assert orig in d_bi
    assert "=== 2. BẢN DỊCH ===" in d_bi
    assert trans in d_bi


def test_export_service_txt_translated_with_original_not_bilingual():
    """Đảm bảo translated không vô tình bị chuyển thành song ngữ dù có truyền original_content."""
    service = ExportService()
    b = service.export_to_txt(
        "Bản dịch duy nhất.",
        title="Bản Dịch",
        export_type="translated",
        original_content="Original not included",
    )
    d = b.decode("utf-8-sig")
    assert "=== 1. VĂN BẢN GỐC ===" not in d
    assert "Original not included" not in d
    assert "Bản dịch duy nhất." in d


def test_export_service_pdf():
    service = ExportService()
    content = "Bản dịch tài liệu tiếng Việt hoàn chỉnh."
    pdf_bytes = service.export_to_pdf(content, title="Báo Cáo Dịch", original_content="Original text in English.")

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")


def test_export_service_pdf_4_types():
    service = ExportService()
    orig = "Đoạn văn gốc tiếng Anh hoặc quét OCR."
    trans = "Bản dịch tiếng Việt với đầy đủ thanh điệu và dấu câu: Ă, Â, Đ, Ê, Ô, Ơ, Ư."
    summ = "- Ý chính số 1 tóm tắt tài liệu.\n- Ý chính số 2 nêu bật kết quả quan trọng.\n1. Điểm lưu ý A.\n2. Điểm lưu ý B."

    # 1. Original PDF
    pdf_orig = service.export_to_pdf(orig, title="Văn Bản Gốc", export_type="original")
    assert isinstance(pdf_orig, bytes)
    assert pdf_orig.startswith(b"%PDF")

    # 2. Translated PDF (truyền cả original_content nhưng export_type là translated -> không được xuất song ngữ)
    pdf_trans = service.export_to_pdf(
        trans,
        title="Bản Dịch",
        original_content=orig,
        export_type="translated",
    )
    assert isinstance(pdf_trans, bytes)
    assert pdf_trans.startswith(b"%PDF")

    # 3. Summary PDF
    pdf_summ = service.export_to_pdf(summ, title="Tóm Tắt Nội Dung", export_type="summary")
    assert isinstance(pdf_summ, bytes)
    assert pdf_summ.startswith(b"%PDF")

    # 4. Bilingual PDF
    pdf_bi = service.export_to_pdf(
        trans,
        title="Tài Liệu Song Ngữ",
        original_content=orig,
        export_type="bilingual",
    )
    assert isinstance(pdf_bi, bytes)
    assert pdf_bi.startswith(b"%PDF")


def test_export_service_unicode_vietnamese_font():
    service = ExportService()
    # Kiểm tra font Unicode đã được cấu hình (không phải Helvetica mặc định nếu có font hệ thống)
    assert service.font_name in ("Arial", "TimesNewRoman", "SegoeUI", "DejaVuSans", "Helvetica")
    # Văn bản dài tiếng Việt phức tạp
    long_vietnamese = "Tôi học tiếng Việt tại thành phố Hồ Chí Minh. " * 50
    pdf_bytes = service.export_to_pdf(long_vietnamese, title="Tài Liệu Tiếng Việt", export_type="translated")
    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 1000


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
