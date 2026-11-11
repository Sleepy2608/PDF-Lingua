import codecs
import io
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


def test_pdf_service_invalid_and_edge_case_handling(tmp_path: Path):
    """PDFL-178.1: Safe handling of missing, 0-byte, corrupt, 0-page, and encrypted PDFs."""
    service = PDFService()

    # 1. Non-existent file
    missing_file = tmp_path / "does_not_exist.pdf"
    res_missing = service.validate_pdf(missing_file)
    assert res_missing["is_valid"] is False
    assert res_missing["page_count"] == 0
    assert "Tệp không tồn tại" in res_missing["error"]
    assert service.get_page_count(missing_file) == 0

    # 2. 0-byte file
    zero_file = tmp_path / "zero_bytes.pdf"
    zero_file.write_bytes(b"")
    res_zero = service.validate_pdf(zero_file)
    assert res_zero["is_valid"] is False
    assert res_zero["page_count"] == 0
    assert service.get_page_count(zero_file) == 0

    # 3. Corrupt / Non-PDF file
    corrupt_file = tmp_path / "corrupt.pdf"
    corrupt_file.write_bytes(b"%PDF-1.4 corrupt content not valid trailer")
    res_corrupt = service.validate_pdf(corrupt_file)
    assert res_corrupt["is_valid"] is False
    assert res_corrupt["page_count"] == 0
    assert service.get_page_count(corrupt_file) == 0

    # 4. Zero-page PDF (valid PDF structure but 0 pages)
    zero_page_file = tmp_path / "zero_pages.pdf"
    writer = pypdf.PdfWriter()
    with open(zero_page_file, "wb") as f:
        writer.write(f)
    res_zero_page = service.validate_pdf(zero_page_file)
    assert res_zero_page["is_valid"] is False
    assert res_zero_page["page_count"] == 0
    assert "không có trang nào hợp lệ" in res_zero_page["error"]
    assert service.get_page_count(zero_page_file) == 0

    # 5. Encrypted PDF with password
    encrypted_file = tmp_path / "encrypted.pdf"
    enc_writer = pypdf.PdfWriter()
    enc_writer.add_blank_page(width=100, height=100)
    enc_writer.encrypt("super_secret_password")
    with open(encrypted_file, "wb") as f:
        enc_writer.write(f)
    res_encrypted = service.validate_pdf(encrypted_file)
    assert res_encrypted["is_valid"] is False
    assert res_encrypted["is_encrypted"] is True
    assert "mật khẩu bảo vệ" in res_encrypted["error"]
    assert service.get_page_count(encrypted_file) == 0


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


# ==============================================================================
# PDFL-156.2 Tests: Export Service Empty Content Handling
# ==============================================================================

@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_export_to_txt_empty_content_original(empty_val):
    service = ExportService()
    with pytest.raises(ValueError, match="văn bản gốc.*không được để trống"):
        service.export_to_txt(empty_val, export_type="original")


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_export_to_txt_empty_content_translated(empty_val):
    service = ExportService()
    with pytest.raises(ValueError, match="bản dịch.*không được để trống"):
        service.export_to_txt(empty_val, export_type="translated")


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_export_to_txt_empty_content_summary(empty_val):
    service = ExportService()
    with pytest.raises(ValueError, match="tóm tắt.*không được để trống"):
        service.export_to_txt(empty_val, export_type="summary")


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_export_to_txt_bilingual_empty_translated(empty_val):
    service = ExportService()
    with pytest.raises(ValueError, match="bản dịch.*không được để trống khi xuất song ngữ"):
        service.export_to_txt(empty_val, export_type="bilingual", original_content="Valid original text.")


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_export_to_txt_bilingual_empty_original(empty_val):
    service = ExportService()
    with pytest.raises(ValueError, match="văn bản gốc.*không được để trống khi xuất song ngữ"):
        service.export_to_txt("Valid translated text.", export_type="bilingual", original_content=empty_val)


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_export_to_pdf_empty_content_original(empty_val):
    service = ExportService()
    with pytest.raises(ValueError, match="văn bản gốc.*không được để trống"):
        service.export_to_pdf(empty_val, export_type="original")


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_export_to_pdf_empty_content_translated(empty_val):
    service = ExportService()
    with pytest.raises(ValueError, match="bản dịch.*không được để trống"):
        service.export_to_pdf(empty_val, export_type="translated")


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_export_to_pdf_empty_content_summary(empty_val):
    service = ExportService()
    with pytest.raises(ValueError, match="tóm tắt.*không được để trống"):
        service.export_to_pdf(empty_val, export_type="summary")


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_export_to_pdf_bilingual_empty_translated(empty_val):
    service = ExportService()
    with pytest.raises(ValueError, match="bản dịch.*không được để trống khi xuất song ngữ"):
        service.export_to_pdf(empty_val, export_type="bilingual", original_content="Valid original text.")


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_export_to_pdf_bilingual_empty_original(empty_val):
    service = ExportService()
    with pytest.raises(ValueError, match="văn bản gốc.*không được để trống khi xuất song ngữ"):
        service.export_to_pdf("Valid translated text.", export_type="bilingual", original_content=empty_val)


def test_export_service_valid_content_preservation_and_formats():
    """Kiểm tra xuất hợp lệ cho cả 4 loại trên TXT và PDF, giữ nguyên định dạng và font Unicode."""
    service = ExportService()
    orig = "This is original content with special chars: <>&\"'."
    trans = "Đây là bản dịch tiếng Việt có ký tự đặc biệt: <>&\"' và chữ có dấu: Ắ, Ậ, Ỡ."
    summ = "- Ý chính 1\n- Ý chính 2"

    # TXT 4 types
    for exp_type, c, o in [
        ("original", orig, None),
        ("translated", trans, None),
        ("summary", summ, None),
        ("bilingual", trans, orig),
    ]:
        txt_b = service.export_to_txt(c, title="Tiêu đề", export_type=exp_type, original_content=o)
        assert isinstance(txt_b, bytes)
        decoded = txt_b.decode("utf-8-sig")
        assert "Tiêu đề" in decoded

    # PDF 4 types
    for exp_type, c, o in [
        ("original", orig, None),
        ("translated", trans, None),
        ("summary", summ, None),
        ("bilingual", trans, orig),
    ]:
        pdf_b = service.export_to_pdf(c, title="Tiêu đề", export_type=exp_type, original_content=o)
        assert isinstance(pdf_b, bytes)
        assert pdf_b.startswith(b"%PDF")
        assert len(pdf_b) > 500


# ── PDFL-158.3: Automated Export Compatibility Tests ───────────────────────────

def test_export_txt_utf8_bom_and_decoding_compatibility():
    """Kiểm tra file TXT xuất ra có đúng byte UTF-8 BOM, tương thích trình đọc Notepad/UTF-8 và không lỗi font."""
    service = ExportService()
    vietnamese_sample = (
        "Cộng hòa Xã hội Chủ nghĩa Việt Nam\n"
        "Độc lập - Tự do - Hạnh phúc\n\n"
        "Bảng nguyên âm có dấu và thanh điệu: "
        "a à á ả ã ạ, ă ằ ắ ẳ ẵ ặ, â ầ ấn ẩ ẫ ậ, "
        "e è é ẻ ẽ ẹ, ê ề ế ể ễ ệ, "
        "i ì í ỉ ĩ ị, "
        "o ò ó ỏ õ ọ, ô ồ ố ổ ỗ ộ, ơ ờ ớ ở ỡ ợ, "
        "u ù ú ủ ũ ụ, ư ừ ứ ử ữ ự, "
        "y ỳ ý ỷ ỹ ỵ, "
        "đ Đ."
    )
    title = "Văn Bản Pháp Quy Mẫu"

    txt_bytes = service.export_to_txt(vietnamese_sample, title=title, export_type="translated")

    # 1. Byte BOM chính xác UTF-8 (\xef\xbb\xbf)
    assert txt_bytes.startswith(codecs.BOM_UTF8)
    assert txt_bytes[:3] == b"\xef\xbb\xbf"

    # 2. Đọc bằng utf-8 tiêu chuẩn: không lỗi giải mã (UnicodeDecodeError), ký tự đầu tiên là \ufeff
    decoded_utf8 = txt_bytes.decode("utf-8")
    assert decoded_utf8.startswith("\ufeff")
    assert "\ufffd" not in decoded_utf8  # Không có ký tự thay thế do lỗi giải mã

    # 3. Đọc bằng utf-8-sig: tự động bóc tách BOM, nội dung giữ nguyên vẹn 100%
    decoded_sig = txt_bytes.decode("utf-8-sig")
    assert not decoded_sig.startswith("\ufeff")
    assert title in decoded_sig
    assert vietnamese_sample in decoded_sig

    # 4. Kiểm tra từng ký tự đặc thù tiếng Việt có mặt trong chuỗi giải mã
    for char in ["ă", "â", "đ", "ê", "ô", "ơ", "ư", "ắ", "ấ", "ế", "ố", "ớ", "ứ", "Đ"]:
        assert char in decoded_sig


def test_export_txt_formatting_newlines_and_all_4_types():
    """Kiểm tra cấu trúc dòng, ngắt đoạn, tiêu đề phân cách và đầy đủ 4 loại export trong file TXT."""
    service = ExportService()
    orig = "Đoạn gốc 1:\nDòng 1.1\nDòng 1.2\n\nĐoạn gốc 2."
    trans = "Đoạn dịch 1:\nDòng dịch 1.1\nDòng dịch 1.2\n\nĐoạn dịch 2."
    summ = "- Ý chính A: Nội dung tóm tắt\n- Ý chính B: Kết quả chi tiết\n1. Bước 1\n2. Bước 2"
    title = "Tài Liệu Kiểm Tra Xuất"

    # 1. Original
    b_orig = service.export_to_txt(orig, title=title, export_type="original")
    t_orig = b_orig.decode("utf-8-sig")
    assert title in t_orig
    assert "=" * len(title) in t_orig
    assert orig in t_orig
    assert "=== 1. VĂN BẢN GỐC ===" not in t_orig

    # 2. Translated
    b_trans = service.export_to_txt(trans, title=title, export_type="translated")
    t_trans = b_trans.decode("utf-8-sig")
    assert trans in t_trans
    assert "=== 1. VĂN BẢN GỐC ===" not in t_trans

    # 3. Summary
    b_summ = service.export_to_txt(summ, title=title, export_type="summary")
    t_summ = b_summ.decode("utf-8-sig")
    assert summ in t_summ

    # 4. Bilingual: có đầy đủ 2 phần với phân cách rõ ràng
    b_bi = service.export_to_txt(trans, title=title, export_type="bilingual", original_content=orig)
    t_bi = b_bi.decode("utf-8-sig")
    assert "=== 1. VĂN BẢN GỐC ===" in t_bi
    assert orig in t_bi
    assert "=== 2. BẢN DỊCH ===" in t_bi
    assert trans in t_bi
    # Thứ tự: văn bản gốc xuất hiện trước bản dịch
    assert t_bi.index("=== 1. VĂN BẢN GỐC ===") < t_bi.index("=== 2. BẢN DỊCH ===")


def test_export_pdf_structural_validity_and_pypdf_reader():
    """Kiểm tra cấu trúc file PDF: header %PDF-, có thể mở và phân tích bằng pypdf, kích thước trang chuẩn A4."""
    service = ExportService()
    content = "Nội dung kiểm tra tính tương thích cấu trúc PDF với công cụ đọc phổ biến."
    title = "Kiểm Tra Cấu Trúc PDF"

    pdf_bytes = service.export_to_pdf(content, title=title, export_type="translated")

    # 1. Chữ ký hợp lệ %PDF-
    assert pdf_bytes.startswith(b"%PDF-")
    assert b"%%EOF" in pdf_bytes[-1024:]

    # 2. Mở và đọc bằng pypdf
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    assert not reader.is_encrypted
    assert len(reader.pages) >= 1

    # 3. Kích thước trang chuẩn A4 (595.27 x 841.89 points)
    page = reader.pages[0]
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    assert 590 < width < 600
    assert 835 < height < 845


def test_export_pdf_vietnamese_unicode_text_extraction():
    """Kiểm tra trích xuất văn bản tiếng Việt từ PDF: không lỗi font, không mất dấu thanh điệu."""
    service = ExportService()
    vietnamese_phrases = [
        "Trường Đại học Bách Khoa Hà Nội",
        "Thành phố Hồ Chí Minh rực rỡ cờ hoa",
        "Đà Nẵng - Thành phố đáng sống bên bờ biển",
        "Nghiên cứu ứng dụng trí tuệ nhân tạo trong xử lý ngôn ngữ tự nhiên",
        "Dấu hỏi ngã nặng: Cửa sổ, vội vã, nặng nhọc, kỳ vĩ",
    ]
    full_content = "\n\n".join(vietnamese_phrases)
    title = "Kiểm Tra Font Tiếng Việt"

    pdf_bytes = service.export_to_pdf(full_content, title=title, export_type="translated")
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    extracted = "".join(p.extract_text() for p in reader.pages)

    # Kiểm tra tiêu đề và các cụm từ tiếng Việt đều được trích xuất chính xác
    assert title in extracted
    for phrase in vietnamese_phrases:
        keywords = phrase.split()
        for kw in keywords:
            assert kw in extracted, f"Từ khóa '{kw}' không tìm thấy trong văn bản trích xuất PDF."


def test_export_pdf_all_4_export_types_sections_and_content():
    """Kiểm tra cả 4 loại export trên PDF: tiêu đề từng section và phân tách nội dung chuẩn xác."""
    service = ExportService()
    orig = "This is the source document extracted via OCR engine."
    trans = "Đây là bản dịch tiếng Việt tương ứng cho tài liệu."
    summ = "- Điểm nhấn 1: Tối ưu hóa hiệu năng\n- Điểm nhấn 2: Bảo mật thông tin"

    # 1. Original
    p_orig = service.export_to_pdf(orig, title="Tài Liệu Gốc", export_type="original")
    r_orig = pypdf.PdfReader(io.BytesIO(p_orig))
    t_orig = "".join(p.extract_text() for p in r_orig.pages)
    assert "VĂN BẢN GỐC" in t_orig
    assert "OCR engine" in t_orig
    assert "bản dịch tiếng Việt" not in t_orig

    # 2. Translated
    p_trans = service.export_to_pdf(trans, title="Bản Dịch Thuật", export_type="translated")
    r_trans = pypdf.PdfReader(io.BytesIO(p_trans))
    t_trans = "".join(p.extract_text() for p in r_trans.pages)
    assert "BẢN DỊCH THUẬT" in t_trans
    assert "bản dịch tiếng Việt" in t_trans
    assert "OCR engine" not in t_trans

    # 3. Summary
    p_summ = service.export_to_pdf(summ, title="Tóm Tắt Báo Cáo", export_type="summary")
    r_summ = pypdf.PdfReader(io.BytesIO(p_summ))
    t_summ = "".join(p.extract_text() for p in r_summ.pages)
    assert "BẢN TÓM TẮT NỘI DUNG" in t_summ
    assert "Tối ưu hóa hiệu năng" in t_summ

    # 4. Bilingual
    p_bi = service.export_to_pdf(trans, title="Văn Bản Song Ngữ", export_type="bilingual", original_content=orig)
    r_bi = pypdf.PdfReader(io.BytesIO(p_bi))
    t_bi = "".join(p.extract_text() for p in r_bi.pages)
    assert "1. VĂN BẢN GỐC" in t_bi
    assert "2. BẢN DỊCH" in t_bi
    assert "OCR engine" in t_bi
    assert "bản dịch tiếng Việt" in t_bi


def test_export_pdf_multipage_pagination_and_special_characters():
    """Kiểm tra văn bản dài (>50 đoạn) phân trang mượt mà (>=3 trang) và an toàn với ký tự đặc biệt."""
    service = ExportService()
    special_header = (
        "Báo cáo & Phân tích kỹ thuật <v2.0>:\n"
        "• Dấu ngoặc kép: \"Trích dẫn quan trọng\" và 'ngoặc đơn'.\n"
        "• Toán học & Tiền tệ: 100% ± 5%, Doanh số 50.000$ (hoặc 1.250.000.000₫), 10 × 20 ÷ 4 = 50.\n"
        "• So sánh: a < b và x > y & z != w."
    )
    long_paragraphs = [
        f"Mục số {i:02d}: Đoạn văn phân tích chuyên sâu nhằm xác thực hệ thống ngắt trang tự động của ReportLab. "
        f"Nội dung chứa đầy đủ thanh điệu tiếng Việt: Ă, Â, Đ, Ê, Ô, Ơ, Ư và các chữ số 0123456789."
        for i in range(1, 55)
    ]
    full_text = special_header + "\n\n" + "\n\n".join(long_paragraphs)

    pdf_bytes = service.export_to_pdf(full_text, title="Tài Liệu Đa Trang & Ký Tự Đặc Biệt", export_type="translated")
    assert pdf_bytes.startswith(b"%PDF-")

    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    page_count = len(reader.pages)
    assert page_count >= 3, f"Kỳ vọng ít nhất 3 trang nhưng nhận được {page_count}"

    for idx, page in enumerate(reader.pages):
        text = page.extract_text()
        assert len(text.strip()) > 50, f"Trang {idx+1} bị rỗng hoặc không trích xuất được text"

    all_extracted = "".join(p.extract_text() for p in reader.pages)
    assert "Phân tích kỹ thuật" in all_extracted
    assert "100%" in all_extracted
    assert "50.000$" in all_extracted
    assert "Mục số 01" in all_extracted
    assert "Mục số 54" in all_extracted


