import io
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.pdf_service import PDFService, parse_page_selection
from app.services.job_service import job_manager, JobStatus
from app.models.user import User, UserRole


def create_multi_page_pdf(num_pages: int = 5) -> bytes:
    """Helper tạo PDF nhiều trang có nội dung phân biệt để kiểm tra trích xuất chọn lọc."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    for i in range(1, num_pages + 1):
        c.drawString(100, 700, f"Page {i} Unique Content in PDF-Lingua test document.")
        c.showPage()
    c.save()
    return buf.getvalue()


# ── 1. Cú pháp dải trang hợp lệ (Valid Syntax) ──────────────────────────────

def test_parse_page_selection_single_page():
    assert parse_page_selection("1", 5) == [0]
    assert parse_page_selection("3", 5) == [2]
    assert parse_page_selection("5", 5) == [4]


def test_parse_page_selection_range():
    assert parse_page_selection("1-3", 5) == [0, 1, 2]
    assert parse_page_selection("2-4", 5) == [1, 2, 3]
    assert parse_page_selection("4-5", 5) == [3, 4]
    assert parse_page_selection("2-2", 5) == [1]


def test_parse_page_selection_comma_list():
    assert parse_page_selection("2, 4, 6", 6) == [1, 3, 5]
    assert parse_page_selection("1, 3, 5", 5) == [0, 2, 4]
    assert parse_page_selection("1,2,3", 3) == [0, 1, 2]


def test_parse_page_selection_mixed_range_and_comma():
    assert parse_page_selection("1-2, 5", 5) == [0, 1, 4]
    assert parse_page_selection("1, 3-4, 6", 6) == [0, 2, 3, 5]
    assert parse_page_selection("2-3, 5-6", 6) == [1, 2, 4, 5]


def test_parse_page_selection_all_variants():
    assert parse_page_selection(None, 5) == [0, 1, 2, 3, 4]
    assert parse_page_selection("", 5) == [0, 1, 2, 3, 4]
    assert parse_page_selection("   ", 5) == [0, 1, 2, 3, 4]
    assert parse_page_selection("all", 5) == [0, 1, 2, 3, 4]
    assert parse_page_selection("ALL", 5) == [0, 1, 2, 3, 4]
    assert parse_page_selection(" All ", 5) == [0, 1, 2, 3, 4]


def test_parse_page_selection_deduplication_and_sorting():
    # Thử nghiệm kết hợp trùng lặp và xáo trộn thứ tự nhập
    assert parse_page_selection("3, 1-2, 2, 1", 5) == [0, 1, 2]
    assert parse_page_selection("5, 4, 3, 2, 1", 5) == [0, 1, 2, 3, 4]
    assert parse_page_selection("1-3, 2-4", 5) == [0, 1, 2, 3]
    assert parse_page_selection("2, 2, 2", 3) == [1]


# ── 2. Cú pháp dải trang không hợp lệ (Invalid Syntax) ────────────────────────

def test_parse_page_selection_invalid_characters():
    with pytest.raises(ValueError, match="Số trang không hợp lệ"):
        parse_page_selection("abc", 5)

    with pytest.raises(ValueError, match="Số trang không hợp lệ"):
        parse_page_selection("1a", 5)

    with pytest.raises(ValueError, match="Số trang không hợp lệ"):
        parse_page_selection("p1", 5)


def test_parse_page_selection_invalid_range_format():
    with pytest.raises(ValueError, match="Cú pháp khoảng trang không hợp lệ"):
        parse_page_selection("1-", 5)

    with pytest.raises(ValueError, match="Cú pháp khoảng trang không hợp lệ"):
        parse_page_selection("-3", 5)

    with pytest.raises(ValueError, match="Cú pháp khoảng trang không hợp lệ"):
        parse_page_selection("1-2-3", 5)

    with pytest.raises(ValueError, match="Khoảng trang phải là số nguyên dương"):
        parse_page_selection("1-a", 5)


def test_parse_page_selection_invalid_commas():
    with pytest.raises(ValueError, match="Cú pháp khoảng trang không hợp lệ"):
        parse_page_selection("1, , 2", 5)

    with pytest.raises(ValueError, match="Cú pháp khoảng trang không hợp lệ"):
        parse_page_selection(",,", 5)

    with pytest.raises(ValueError, match="Cú pháp khoảng trang không hợp lệ"):
        parse_page_selection("1,", 5)

    with pytest.raises(ValueError, match="Cú pháp khoảng trang không hợp lệ"):
        parse_page_selection(",1", 5)


def test_parse_page_selection_reverse_range():
    with pytest.raises(ValueError, match="Khoảng trang ngược không hợp lệ"):
        parse_page_selection("5-1", 5)

    with pytest.raises(ValueError, match="Khoảng trang ngược không hợp lệ"):
        parse_page_selection("4-2", 5)


# ── 3. Giới hạn trang ngoài phạm vi (Boundary & Out of bounds) ─────────────────

def test_parse_page_selection_zero_or_negative():
    with pytest.raises(ValueError, match="Số trang phải lớn hơn hoặc bằng 1"):
        parse_page_selection("0", 5)

    with pytest.raises(ValueError, match="Cú pháp khoảng trang không hợp lệ|Số trang không hợp lệ"):
        parse_page_selection("-1", 5)

    with pytest.raises(ValueError, match="Số trang phải lớn hơn hoặc bằng 1"):
        parse_page_selection("0-3", 5)


def test_parse_page_selection_exceeds_total_pages():
    with pytest.raises(ValueError, match="vượt quá tổng số trang"):
        parse_page_selection("10", 5)

    with pytest.raises(ValueError, match="vượt quá tổng số trang"):
        parse_page_selection("3-6", 5)

    with pytest.raises(ValueError, match="vượt quá tổng số trang"):
        parse_page_selection("6-8", 5)


def test_parse_page_selection_invalid_total_pages():
    with pytest.raises(ValueError, match="Tổng số trang của tài liệu không hợp lệ"):
        parse_page_selection("1", 0)

    with pytest.raises(ValueError, match="Tổng số trang của tài liệu không hợp lệ"):
        parse_page_selection("1", -5)

    with pytest.raises(ValueError, match="Tổng số trang của tài liệu không hợp lệ"):
        parse_page_selection("1", True)

    with pytest.raises(ValueError, match="Tổng số trang của tài liệu không hợp lệ"):
        parse_page_selection("1", False)


def test_pdf_service_method_binding():
    svc = PDFService()
    assert svc.parse_page_selection("1-2", 4) == [0, 1]
    assert PDFService.parse_page_selection("2, 4", 5) == [1, 3]


def test_document_classification_with_selected_pages():
    pdf_bytes = create_multi_page_pdf(num_pages=5)
    svc = PDFService()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        tmp_path = Path(f.name)

    try:
        # 1. Phân loại toàn bộ tài liệu (selected_pages=None)
        all_res = svc.classify_document(tmp_path)
        assert all_res["total_pages"] == 5
        assert len(all_res["pages"]) == 5
        assert [p["page"] for p in all_res["pages"]] == [1, 2, 3, 4, 5]

        # 2. Phân loại chỉ các trang được chọn [1, 3] (trang 2 và trang 4)
        selected_res = svc.classify_document(tmp_path, selected_pages=[1, 3])
        assert selected_res["total_pages"] == 2
        assert len(selected_res["pages"]) == 2
        assert [p["page"] for p in selected_res["pages"]] == [2, 4]

        # 3. is_scanned_pdf với selected_pages
        assert svc.is_scanned_pdf(tmp_path, selected_pages=[0, 1]) is False
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


# ── 4. Selective Extraction giữ đúng số trang gốc (Original Page Preservation) ─

def test_selective_extraction_extract_pages_preserves_page_numbers():
    pdf_bytes = create_multi_page_pdf(num_pages=5)
    svc = PDFService()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        tmp_path = Path(f.name)

    try:
        # Chọn trang 2 và trang 5 (0-based index: 1 và 4)
        pages_data = svc.extract_pages(tmp_path, selected_pages=[1, 4])

        assert len(pages_data) == 2
        # Trang đầu tiên trong kết quả phải giữ nguyên số trang gốc là 2 (không phải 1)
        assert pages_data[0]["page"] == 2
        assert "Page 2 Unique Content" in pages_data[0]["text"]

        # Trang thứ hai trong kết quả phải giữ nguyên số trang gốc là 5 (không phải 2)
        assert pages_data[1]["page"] == 5
        assert "Page 5 Unique Content" in pages_data[1]["text"]
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def test_selective_extraction_hybrid_fast_path_preserves_page_numbers():
    pdf_bytes = create_multi_page_pdf(num_pages=5)
    svc = PDFService()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        tmp_path = Path(f.name)

    try:
        # Chọn trang 3 và trang 4 (0-based index: 2 và 3)
        res = svc.extract_hybrid_fast_path(tmp_path, selected_pages=[2, 3])

        assert res["page_count"] == 2
        assert len(res["pages"]) == 2
        assert res["pages"][0]["page"] == 3
        assert "Page 3 Unique Content" in res["pages"][0]["text"]
        assert res["pages"][1]["page"] == 4
        assert "Page 4 Unique Content" in res["pages"][1]["text"]

        # Toàn bộ text chỉ chứa trang 3 và 4
        assert "Page 3 Unique Content" in res["text"]
        assert "Page 4 Unique Content" in res["text"]
        assert "Page 1 Unique Content" not in res["text"]
        assert "Page 5 Unique Content" not in res["text"]
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def test_selective_extraction_extract_hybrid_text_wrapper():
    pdf_bytes = create_multi_page_pdf(num_pages=4)
    svc = PDFService()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        tmp_path = Path(f.name)

    try:
        # Gọi qua hàm wrapper extract_hybrid_text
        res = svc.extract_hybrid_text(tmp_path, selected_pages=[1])

        assert res["page_count"] == 1
        assert res["pages"][0]["page"] == 2
        assert "Page 2 Unique Content" in res["text"]
        assert "Page 1 Unique Content" not in res["text"]
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def test_selective_extraction_extract_text_content_filtering():
    pdf_bytes = create_multi_page_pdf(num_pages=5)
    svc = PDFService()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        tmp_path = Path(f.name)

    try:
        # Trích xuất trang 1 và 5
        text = svc.extract_text(tmp_path, selected_pages=[0, 4])
        assert "Page 1 Unique Content" in text
        assert "Page 5 Unique Content" in text
        assert "Page 2 Unique Content" not in text
        assert "Page 3 Unique Content" not in text
        assert "Page 4 Unique Content" not in text
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def test_selective_extraction_scanned_ocr_mapping():
    pdf_bytes = create_multi_page_pdf(num_pages=5)
    svc = PDFService()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        tmp_path = Path(f.name)

    mock_ocr = MagicMock()
    mock_ocr.is_available.return_value = True
    mock_ocr.default_lang = "vie+eng"
    requested_indices = []

    def fake_ocr(path, s_idx, lang):
        requested_indices.append(s_idx)
        return {"page": s_idx + 1, "text": f"OCR Text for page {s_idx + 1}", "is_blank": False}

    mock_ocr._ocr_single_page_isolated.side_effect = fake_ocr

    try:
        # Mock classify_page so all selected pages are treated as scanned (forcing OCR)
        with patch.object(svc, "classify_page", return_value="scanned"):
            # Select pages 2 and 5 (0-based indices: 1 and 4)
            res = svc.extract_hybrid_fast_path(
                tmp_path,
                ocr_service=mock_ocr,
                selected_pages=[1, 4],
            )

        assert res["page_count"] == 2
        # Requested indices must be exactly 1 and 4 (original 0-based page indices in the PDF)
        assert sorted(requested_indices) == [1, 4]
        # Result pages must retain original 1-based page numbers 2 and 5
        assert res["pages"][0]["page"] == 2
        assert "OCR Text for page 2" in res["pages"][0]["text"]
        assert res["pages"][1]["page"] == 5
        assert "OCR Text for page 5" in res["pages"][1]["text"]
        assert res["ocr_pages_count"] == 2
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


# ── 5. Tiến độ Job Manager & Background Worker ───────────────────────────────

def test_job_manager_progress_with_selected_pages():
    job = job_manager.create_job(filename="sample_multipage.pdf", target_lang="vi")
    job_id = job.job_id

    # Giả lập xử lý 3 trang được chọn từ tài liệu 10 trang
    selected_pages = [1, 2, 4]
    effective_total = len(selected_pages)

    job_manager.set_processing(
        job_id,
        total_pages=effective_total,
        message=f"Đang phân tích {effective_total} trang PDF...",
    )

    current_job = job_manager.get_job(job_id)
    assert current_job is not None
    assert current_job.status == JobStatus.PROCESSING.value
    assert current_job.total_pages == 3
    assert current_job.progress_percentage == 10.0

    # Cập nhật tiến độ hoàn thành 2/3 trang
    job_manager.update_progress(job_id, processed_pages=2, total_pages=3, message="Đã xử lý 2/3 trang")
    current_job = job_manager.get_job(job_id)
    assert current_job.processed_pages == 2
    assert current_job.progress_percentage > 0


# ── 6. FastAPI Endpoints HTTP Validation ─────────────────────────────────────

def test_api_process_invalid_pages_format_returns_400():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    pdf_bytes = create_multi_page_pdf(num_pages=3)

    files = {"file": ("test.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi", "pages": "abc"}

    response = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert response.status_code == 400
    err_msg = response.json().get("message") or response.json().get("detail", "")
    assert "Dải trang không hợp lệ" in err_msg


def test_api_process_pages_out_of_bounds_returns_400():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    pdf_bytes = create_multi_page_pdf(num_pages=3)

    files = {"file": ("test.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi", "pages": "1-10"}

    response = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert response.status_code == 400
    err_msg = response.json().get("message") or response.json().get("detail", "")
    assert "vượt quá tổng số trang" in err_msg


def test_api_process_reverse_range_returns_400():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    pdf_bytes = create_multi_page_pdf(num_pages=3)

    files = {"file": ("test.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi", "pages": "3-1"}

    response = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert response.status_code == 400
    err_msg = response.json().get("message") or response.json().get("detail", "")
    assert "Khoảng trang ngược không hợp lệ" in err_msg


def test_api_process_valid_selected_pages_success():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    pdf_bytes = create_multi_page_pdf(num_pages=5)

    files = {"file": ("sample.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi", "pages": "2, 4"}

    response = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()["data"]
    # page_count trả về số trang đã chọn xử lý
    assert res_data["page_count"] == 2
    assert "Page 2 Unique Content" in res_data["original_text"]
    assert "Page 4 Unique Content" in res_data["original_text"]
    assert "Page 1 Unique Content" not in res_data["original_text"]


def test_api_process_compat_endpoint_success():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    pdf_bytes = create_multi_page_pdf(num_pages=3)

    files = {"file": ("compat.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi", "pages": "1"}

    response = client.post("/process", files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()["data"]
    assert res_data["page_count"] == 1
    assert "Page 1 Unique Content" in res_data["original_text"]


def test_api_process_jobs_endpoint_with_pages_validation():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    pdf_bytes = create_multi_page_pdf(num_pages=5)

    # 1. Invalid pages on /jobs
    files = {"file": ("job_test.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi", "pages": "10-20"}
    response = client.post("/api/process/jobs", files=files, data=data)
    assert response.status_code == 400
    err_msg = response.json().get("message") or response.json().get("detail", "")
    assert "vượt quá tổng số trang" in err_msg

    # 2. Valid pages on /jobs
    files = {"file": ("job_test.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi", "pages": "1-3"}
    response = client.post("/api/process/jobs", files=files, data=data)
    assert response.status_code == 202
    res_data = response.json()["data"]
    assert "job_id" in res_data
