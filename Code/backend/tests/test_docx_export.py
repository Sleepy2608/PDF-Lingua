"""
Tests for DOCX Export Service & API Pro RBAC (PDFL-254.1)
---------------------------------------------------------
Verifies:
1. ExportService.export_to_docx generates valid Microsoft Word (.docx) documents.
2. Proper support for Vietnamese Unicode characters and A4 layout.
3. Content modes: TRANSLATED, ORIGINAL, SUMMARY, and BILINGUAL (2-column table).
4. Input validation (rejecting empty/whitespace content).
5. DownloadRequest schema strictly validates format ("txt", "pdf", "docx") and rejects invalid values.
6. Role-Based Access Control (RBAC):
   - Pro and Admin accounts can download DOCX (HTTP 200).
   - Free accounts are rejected with HTTP 403 Forbidden (PRO_REQUIRED).
   - Guest accounts (unauthenticated) requesting DOCX receive HTTP 403 Forbidden (PRO_REQUIRED).
   - Guest accounts requesting TXT or PDF receive HTTP 401 Unauthorized (NOT_AUTHENTICATED).
7. Preserves existing TXT and PDF export capabilities without regressions.
"""

import io

import docx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.dependencies import get_current_user, get_optional_current_user
from app.main import app
from app.models.user import User, UserRole
from app.schemas.process import DownloadRequest, ExportFormat, ExportTargetType
from app.services.export_service import ExportService


# ── 1. Unit Tests for ExportService.export_to_docx ───────────────────────────

def test_unit_export_docx_translated_vietnamese():
    """Kiểm tra xuất DOCX bản dịch tiếng Việt có dấu đầy đủ."""
    service = ExportService()
    sample_text = (
        "PDF-Lingua là nền tảng xử lý tài liệu thông minh.\n\n"
        "Hỗ trợ trích xuất văn bản tiếng Việt có dấu: Hà Nội, Đà Nẵng, TP. Hồ Chí Minh."
    )
    docx_bytes = service.export_to_docx(
        content=sample_text,
        title="Tài Liệu Mẫu Tiếng Việt",
        export_type=ExportTargetType.TRANSLATED,
    )

    assert isinstance(docx_bytes, bytes)
    assert len(docx_bytes) > 0

    doc = docx.Document(io.BytesIO(docx_bytes))
    all_text = "\n".join(p.text for p in doc.paragraphs)
    assert "Tài Liệu Mẫu Tiếng Việt" in all_text
    assert "BẢN DỊCH THUẬT" in all_text
    assert "Hà Nội, Đà Nẵng, TP. Hồ Chí Minh" in all_text


def test_unit_export_docx_original():
    """Kiểm tra xuất DOCX văn bản gốc (ORIGINAL)."""
    service = ExportService()
    orig_text = "Original English text extracted from the first page."
    docx_bytes = service.export_to_docx(
        content=orig_text,
        title="Original Document",
        export_type=ExportTargetType.ORIGINAL,
    )

    doc = docx.Document(io.BytesIO(docx_bytes))
    all_text = "\n".join(p.text for p in doc.paragraphs)
    assert "Original Document" in all_text
    assert "VĂN BẢN GỐC" in all_text
    assert "Original English text" in all_text


def test_unit_export_docx_summary():
    """Kiểm tra xuất DOCX tóm tắt (SUMMARY) với bullet points."""
    service = ExportService()
    summary_text = (
        "Tổng hợp nội dung chính:\n"
        "- Ý thứ nhất: Tối ưu hiệu năng xử lý PDF.\n"
        "- Ý thứ hai: Tích hợp trí tuệ nhân tạo AI.\n"
        "• Ý thứ ba: Hỗ trợ đa định dạng xuất file."
    )
    docx_bytes = service.export_to_docx(
        content=summary_text,
        title="Tóm Tắt Nội Dung",
        export_type=ExportTargetType.SUMMARY,
    )

    doc = docx.Document(io.BytesIO(docx_bytes))
    all_text = "\n".join(p.text for p in doc.paragraphs)
    assert "BẢN TÓM TẮT NỘI DUNG" in all_text
    assert "Tối ưu hiệu năng xử lý PDF" in all_text
    assert "Tích hợp trí tuệ nhân tạo AI" in all_text


def test_unit_export_docx_bilingual_table():
    """Kiểm tra xuất DOCX song ngữ (BILINGUAL) với bảng 2 cột và header xám nhạt."""
    service = ExportService()
    original = "Artificial Intelligence is transforming modern industries.\n\nIt enables high automation."
    translated = "Trí tuệ nhân tạo đang làm thay đổi các ngành công nghiệp.\n\nNó thúc đẩy tự động hóa cao."

    docx_bytes = service.export_to_docx(
        content=translated,
        title="Tài Liệu Song Ngữ Anh - Việt",
        original_content=original,
        export_type=ExportTargetType.BILINGUAL,
    )

    doc = docx.Document(io.BytesIO(docx_bytes))
    assert len(doc.tables) >= 1, "Bản dịch song ngữ phải tạo bảng 2 cột"

    table = doc.tables[0]
    assert len(table.columns) == 2

    # Kiểm tra tiêu đề header
    hdr_cells = table.rows[0].cells
    assert "1. VĂN BẢN GỐC" in hdr_cells[0].text
    assert "2. BẢN DỊCH" in hdr_cells[1].text

    # Kiểm tra shading xám nhạt (#F1F5F9) trên ô header
    hdr_xml = hdr_cells[0]._tc.xml
    assert "w:shd" in hdr_xml
    assert "F1F5F9" in hdr_xml

    # Kiểm tra nội dung các hàng đối chiếu
    row_1_cells = table.rows[1].cells
    assert "Artificial Intelligence" in row_1_cells[0].text
    assert "Trí tuệ nhân tạo" in row_1_cells[1].text


def test_unit_export_docx_validation_empty_content():
    """Kiểm tra ném ValueError khi nội dung xuất rỗng hoặc chỉ có khoảng trắng."""
    service = ExportService()
    with pytest.raises(ValueError, match="không được để trống"):
        service.export_to_docx(content="", export_type=ExportTargetType.TRANSLATED)

    with pytest.raises(ValueError, match="không được để trống"):
        service.export_to_docx(content="   \n  ", export_type=ExportTargetType.TRANSLATED)


def test_unit_export_docx_validation_bilingual_missing_original():
    """Kiểm tra ném ValueError khi xuất song ngữ mà thiếu nội dung văn bản gốc."""
    service = ExportService()
    with pytest.raises(ValueError, match="Nội dung văn bản gốc không được để trống"):
        service.export_to_docx(
            content="Bản dịch",
            original_content="",
            export_type=ExportTargetType.BILINGUAL,
        )


# ── 2. Unit Tests for DownloadRequest Schema Format Validation ───────────────

def test_download_request_format_accepted_values():
    """Kiểm tra schema DownloadRequest chấp nhận chính xác 'txt', 'pdf', 'docx' (case-insensitive) và có annotation ExportFormat."""
    # Kiểm tra model field được định kiểu bằng ExportFormat enum
    assert DownloadRequest.model_fields["format"].annotation == ExportFormat

    req_txt = DownloadRequest(format="txt")
    assert req_txt.format == "txt"
    assert req_txt.format == ExportFormat.TXT

    req_pdf = DownloadRequest(format="pdf")
    assert req_pdf.format == "pdf"
    assert req_pdf.format == ExportFormat.PDF

    req_docx = DownloadRequest(format="docx")
    assert req_docx.format == "docx"
    assert req_docx.format == ExportFormat.DOCX

    # Case-insensitive & whitespace normalization
    assert DownloadRequest(format="DOCX").format == ExportFormat.DOCX
    assert DownloadRequest(format="  PDF  ").format == ExportFormat.PDF
    assert DownloadRequest(format="Txt").format == ExportFormat.TXT


def test_download_request_format_invalid_rejected():
    """Kiểm tra schema DownloadRequest từ chối các định dạng không hợp lệ."""
    invalid_formats = ["exe", "zip", "doc", "odt", "mp3", "", "   ", "xlsx"]
    for bad_fmt in invalid_formats:
        with pytest.raises(ValidationError) as exc_info:
            DownloadRequest(format=bad_fmt)
        errors = exc_info.value.errors()
        assert len(errors) > 0
        assert "format" in errors[0]["loc"]
        assert "không hợp lệ" in errors[0]["msg"] or "không được để trống" in errors[0]["msg"]


# ── 3. Integration Tests for POST /api/process/download (RBAC & Formats) ─────

client = TestClient(app)


def make_mock_user(role: UserRole, user_id: int = 1) -> User:
    return User(
        id=user_id,
        email=f"user_{role.value}@example.com",
        full_name=f"User {role.value.capitalize()}",
        role=role,
        is_active=True,
    )


def test_download_docx_pro_user_success():
    """Tài khoản Pro xuất file DOCX thành công với HTTP 200."""
    pro_user = make_mock_user(UserRole.PRO, user_id=10)
    app.dependency_overrides[get_optional_current_user] = lambda: pro_user

    try:
        payload = {
            "content": "Bản dịch thử nghiệm dành riêng cho người dùng Pro.",
            "format": "docx",
            "export_type": "translated",
            "filename": "tai_lieu_pro",
            "title": "Bản Dịch VIP",
        }
        response = client.post("/api/process/download", json=payload)
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in response.headers.get("content-type", "")
        
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment;" in content_disp
        assert "tai_lieu_pro_dich.docx" in content_disp

        # Đọc lại nội dung tệp DOCX từ byte phản hồi
        doc = docx.Document(io.BytesIO(response.content))
        all_text = "\n".join(p.text for p in doc.paragraphs)
        assert "Bản Dịch VIP" in all_text
        assert "Bản dịch thử nghiệm dành riêng cho người dùng Pro" in all_text
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


def test_download_docx_admin_user_success():
    """Tài khoản Admin xuất file DOCX thành công với HTTP 200."""
    admin_user = make_mock_user(UserRole.ADMIN, user_id=1)
    app.dependency_overrides[get_optional_current_user] = lambda: admin_user

    try:
        payload = {
            "content": "Nội dung báo cáo quản trị hệ thống.",
            "format": "docx",
            "export_type": "translated",
            "filename": "admin_report",
        }
        response = client.post("/api/process/download", json=payload)
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in response.headers.get("content-type", "")
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


def test_download_docx_free_user_forbidden_403():
    """Tài khoản Free bị chặn tải DOCX với HTTP 403 Forbidden và mã lỗi PRO_REQUIRED."""
    free_user = make_mock_user(UserRole.FREE, user_id=20)
    app.dependency_overrides[get_optional_current_user] = lambda: free_user

    try:
        payload = {
            "content": "Tài khoản Free thử tải file docx.",
            "format": "docx",
            "export_type": "translated",
            "filename": "free_attempt",
        }
        response = client.post("/api/process/download", json=payload)
        assert response.status_code == 403

        data = response.json()
        assert data.get("error_code") == "PRO_REQUIRED"
        assert "Tính năng tải tệp DOCX chỉ dành riêng cho tài khoản Pro" in (data.get("message") or "")
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


def test_download_docx_guest_user_forbidden_403():
    """Tài khoản Guest (không có token) khi yêu cầu tải DOCX phải nhận HTTP 403 Forbidden (PRO_REQUIRED)."""
    # Đảm bảo không có dependency override -> caller là Guest thực thụ
    app.dependency_overrides.pop(get_optional_current_user, None)
    app.dependency_overrides.pop(get_current_user, None)

    payload = {
        "content": "Khách chưa đăng nhập thử tải DOCX.",
        "format": "docx",
        "export_type": "translated",
        "filename": "guest_docx_attempt",
    }
    # Gọi không gửi header Authorization
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 403

    data = response.json()
    assert data.get("error_code") == "PRO_REQUIRED"
    assert "Tính năng tải tệp DOCX chỉ dành riêng cho tài khoản Pro" in (data.get("message") or "")


def test_download_txt_or_pdf_guest_user_unauthorized_401():
    """Tài khoản Guest (không có token) khi tải TXT hoặc PDF vẫn nhận HTTP 401 Unauthorized (bảo toàn auth hiện có)."""
    app.dependency_overrides.pop(get_optional_current_user, None)
    app.dependency_overrides.pop(get_current_user, None)

    payload_txt = {"content": "Guest tải TXT.", "format": "txt", "export_type": "translated"}
    res_txt = client.post("/api/process/download", json=payload_txt)
    assert res_txt.status_code == 401
    assert res_txt.json().get("error_code") == "NOT_AUTHENTICATED"

    payload_pdf = {"content": "Guest tải PDF.", "format": "pdf", "export_type": "translated"}
    res_pdf = client.post("/api/process/download", json=payload_pdf)
    assert res_pdf.status_code == 401
    assert res_pdf.json().get("error_code") == "NOT_AUTHENTICATED"


def test_download_docx_invalid_token_returns_401():
    """Gửi token không hợp lệ (sai signature) khi yêu cầu DOCX phải trả về HTTP 401 INVALID_TOKEN."""
    app.dependency_overrides.pop(get_optional_current_user, None)
    app.dependency_overrides.pop(get_current_user, None)

    payload = {
        "content": "Thử tải docx với token sai.",
        "format": "docx",
        "export_type": "translated",
    }
    response = client.post(
        "/api/process/download",
        headers={"Authorization": "Bearer bad.token.signature"},
        json=payload,
    )
    assert response.status_code == 401
    assert response.json().get("error_code") == "INVALID_TOKEN"


def test_download_api_invalid_format_returns_422():
    """Gửi định dạng tệp không hợp lệ (format='exe') qua API bị chặn với HTTP 422 Unprocessable Content."""
    pro_user = make_mock_user(UserRole.PRO, user_id=11)
    app.dependency_overrides[get_optional_current_user] = lambda: pro_user

    try:
        payload = {
            "content": "Nội dung test định dạng lạ.",
            "format": "exe",
            "export_type": "translated",
        }
        response = client.post("/api/process/download", json=payload)
        assert response.status_code == 422
        data = response.json()
        assert data.get("error_code") == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


def test_download_docx_uppercase_format_pro_user_success():
    """Gửi định dạng tệp chữ hoa 'DOCX' được tự động chuẩn hóa và xuất thành công 200."""
    pro_user = make_mock_user(UserRole.PRO, user_id=12)
    app.dependency_overrides[get_optional_current_user] = lambda: pro_user

    try:
        payload = {
            "content": "Nội dung định dạng chữ hoa.",
            "format": "DOCX",
            "export_type": "translated",
            "filename": "upper_test",
        }
        response = client.post("/api/process/download", json=payload)
        assert response.status_code == 200
        assert "upper_test_dich.docx" in response.headers.get("content-disposition", "")
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


def test_download_docx_bilingual_pro_success():
    """Tài khoản Pro tải file DOCX song ngữ thành công với bảng 2 cột."""
    pro_user = make_mock_user(UserRole.PRO, user_id=12)
    app.dependency_overrides[get_optional_current_user] = lambda: pro_user

    try:
        payload = {
            "content": "Đây là bản dịch tiếng Việt.",
            "original_content": "This is original English text.",
            "format": "docx",
            "export_type": "bilingual",
            "filename": "bilingual_doc",
            "title": "Bản Dịch Song Ngữ",
        }
        response = client.post("/api/process/download", json=payload)
        assert response.status_code == 200
        content_disp = response.headers.get("content-disposition", "")
        assert "bilingual_doc_songngu.docx" in content_disp

        doc = docx.Document(io.BytesIO(response.content))
        assert len(doc.tables) >= 1
        assert "This is original English text." in doc.tables[0].rows[1].cells[0].text
        assert "Đây là bản dịch tiếng Việt." in doc.tables[0].rows[1].cells[1].text
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


def test_download_docx_empty_content_returns_400():
    """Kiểm tra validation HTTP 400 khi nội dung tệp DOCX để trống."""
    pro_user = make_mock_user(UserRole.PRO, user_id=15)
    app.dependency_overrides[get_optional_current_user] = lambda: pro_user

    try:
        payload = {
            "content": "   ",
            "format": "docx",
            "export_type": "translated",
        }
        response = client.post("/api/process/download", json=payload)
        assert response.status_code == 400
        msg = response.json().get("message") or response.json().get("detail", "")
        assert "không được để trống" in msg
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


def test_download_pdf_and_txt_regression_for_free_user():
    """Đảm bảo không làm hỏng tính năng tải TXT và PDF đối với tài khoản Free."""
    free_user = make_mock_user(UserRole.FREE, user_id=25)
    app.dependency_overrides[get_optional_current_user] = lambda: free_user

    try:
        # 1. Test TXT export
        res_txt = client.post(
            "/api/process/download",
            json={"content": "Văn bản thử nghiệm TXT", "format": "txt", "export_type": "translated"},
        )
        assert res_txt.status_code == 200
        assert "text/plain" in res_txt.headers.get("content-type", "")

        # 2. Test PDF export
        res_pdf = client.post(
            "/api/process/download",
            json={"content": "Văn bản thử nghiệm PDF", "format": "pdf", "export_type": "translated"},
        )
        assert res_pdf.status_code == 200
        assert "application/pdf" in res_pdf.headers.get("content-type", "")
        assert res_pdf.content.startswith(b"%PDF-")
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)
