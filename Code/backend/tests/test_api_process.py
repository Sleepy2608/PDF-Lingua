import io
from datetime import timedelta
from unittest.mock import patch
import pytest

from app.core.dependencies import get_current_user
from app.core.security import create_access_token
from app.main import app
from app.models.user import User, UserRole
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

client = TestClient(app)

mock_auth_user = User(
    id=1,
    email="test_export_user@example.com",
    full_name="Test Export User",
    role=UserRole.FREE,
    is_active=True,
)


@pytest.fixture(autouse=True)
def setup_auth_for_export():
    """Mặc định cung cấp authenticated user cho các test export/download."""
    app.dependency_overrides[get_current_user] = lambda: mock_auth_user
    yield mock_auth_user
    app.dependency_overrides.pop(get_current_user, None)


def create_test_pdf_bytes(text: str = "Hello world from PDF-Lingua test.") -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(100, 700, text)
    c.save()
    return buf.getvalue()


def test_upload_non_pdf_file():
    files = {"file": ("test.txt", b"plain text content", "text/plain")}
    response = client.post("/api/process/upload-and-translate", files=files)
    assert response.status_code == 400


def test_upload_fake_pdf_magic_bytes():
    files = {"file": ("fake.pdf", b"not a real pdf content", "application/pdf")}
    response = client.post("/api/process/upload-and-translate", files=files)
    assert response.status_code == 400


def test_retranslate_endpoint():
    payload = {
        "text": "Hello world",
        "target_lang": "vi",
        "source_lang": "en",
    }
    response = client.post("/api/process/retranslate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "translated_text" in data["data"]
    assert len(data["data"]["translated_text"]) > 0


def test_retranslate_empty_text():
    payload = {
        "text": "   ",
        "target_lang": "vi",
    }
    response = client.post("/api/process/retranslate", json=payload)
    assert response.status_code == 400


def test_download_txt_endpoint():
    payload = {
        "content": "Nội dung bản dịch thử nghiệm.",
        "format": "txt",
        "filename": "ket_qua_dich",
        "title": "Bản Dịch",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")
    assert "attachment;" in response.headers.get("content-disposition", "")
    assert len(response.content) > 0


def test_download_pdf_endpoint():
    payload = {
        "content": "Nội dung bản dịch thử nghiệm.",
        "format": "pdf",
        "filename": "ket_qua_dich",
        "title": "Bản Dịch",
        "original_content": "Original text content.",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    assert response.headers.get("content-type") == "application/pdf"
    assert response.content.startswith(b"%PDF")


# PDFL-150.2 Tests: Export Target Types & Standardized Download API
def test_download_export_type_original():
    payload = {
        "content": "Nội dung văn bản gốc trích xuất từ PDF.",
        "format": "txt",
        "export_type": "original",
        "filename": "tai_lieu_mau",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    content_disp = response.headers.get("content-disposition", "")
    assert "tai_lieu_mau_goc.txt" in content_disp
    # Default title for original
    assert "PDF-Lingua - Văn Bản Gốc" in response.content.decode("utf-8-sig")


def test_download_export_type_translated():
    payload = {
        "content": "Nội dung đã được dịch thuật.",
        "format": "txt",
        "export_type": "translated",
        "filename": "tai_lieu_mau",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    content_disp = response.headers.get("content-disposition", "")
    assert "tai_lieu_mau_dich.txt" in content_disp
    assert "PDF-Lingua - Bản Dịch" in response.content.decode("utf-8-sig")


def test_download_export_type_summary():
    payload = {
        "content": "1. Điểm chính A.\n2. Điểm chính B.",
        "format": "txt",
        "export_type": "summary",
        "filename": "tai_lieu_mau",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    content_disp = response.headers.get("content-disposition", "")
    assert "tai_lieu_mau_tomtat.txt" in content_disp
    assert "PDF-Lingua - Tóm Tắt Nội Dung" in response.content.decode("utf-8-sig")


def test_download_export_type_bilingual_success():
    payload = {
        "content": "Bản dịch tiếng Việt.",
        "format": "pdf",
        "export_type": "bilingual",
        "filename": "tai_lieu_mau",
        "original_content": "Original English content.",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    assert response.headers.get("content-type") == "application/pdf"
    content_disp = response.headers.get("content-disposition", "")
    assert "tai_lieu_mau_songngu.pdf" in content_disp
    assert response.content.startswith(b"%PDF")


def test_download_export_type_bilingual_missing_original_content():
    payload = {
        "content": "Bản dịch tiếng Việt.",
        "format": "txt",
        "export_type": "bilingual",
        "filename": "tai_lieu_mau",
        "original_content": "",  # Empty original content
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 400
    res_json = response.json()
    err_msg = res_json.get("message", "") or res_json.get("detail", "")
    assert "original_content" in err_msg or "song ngữ" in err_msg


def test_download_default_export_type_and_custom_title():
    # When export_type is omitted, defaults to translated (_dich)
    payload = {
        "content": "Nội dung dịch.",
        "format": "txt",
        "filename": "tai_lieu",
        "title": "Tiêu Đề Tùy Biến Của Tôi",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    content_disp = response.headers.get("content-disposition", "")
    assert "tai_lieu_dich.txt" in content_disp
    assert "Tiêu Đề Tùy Biến Của Tôi" in response.content.decode("utf-8-sig")


def test_download_bilingual_txt_has_two_parts():
    payload = {
        "content": "Nội dung bản dịch tiếng Việt.",
        "format": "txt",
        "export_type": "bilingual",
        "filename": "song_ngu_doc",
        "original_content": "Original content in English.",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    decoded = response.content.decode("utf-8-sig")
    assert "=== 1. VĂN BẢN GỐC ===" in decoded
    assert "Original content in English." in decoded
    assert "=== 2. BẢN DỊCH ===" in decoded
    assert "Nội dung bản dịch tiếng Việt." in decoded


def test_download_translated_with_original_not_bilingual():
    """Đảm bảo khi xuất translated mà client có gửi original_content thì không bị xuất nhầm thành song ngữ."""
    payload = {
        "content": "Chỉ xuất bản dịch này.",
        "format": "txt",
        "export_type": "translated",
        "filename": "ban_dich_doc",
        "original_content": "Đoạn gốc không được xuất hiện trong file.",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    decoded = response.content.decode("utf-8-sig")
    assert "=== 1. VĂN BẢN GỐC ===" not in decoded
    assert "Đoạn gốc không được xuất hiện trong file." not in decoded
    assert "Chỉ xuất bản dịch này." in decoded


def test_upload_and_translate_success():
    pdf_bytes = create_test_pdf_bytes("Artificial intelligence and natural language processing.")
    files = {"file": ("document.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi"}

    response = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    payload = body["data"]
    assert payload["filename"] == "document.pdf"
    assert payload["page_count"] == 1
    assert len(payload["original_text"]) > 0
    assert len(payload["translated_text"]) > 0


def create_multipage_pdf_bytes(page_count: int) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    for i in range(page_count):
        c.drawString(100, 700, f"Page {i + 1} content for testing.")
        c.showPage()
    c.save()
    return buf.getvalue()


def test_upload_exceeds_max_pages():
    # settings.MAX_PAGES_FREE is 100
    pdf_bytes = create_multipage_pdf_bytes(105)
    files = {"file": ("large_doc.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi"}

    response = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert response.status_code == 400
    resp_body = response.json()
    msg = resp_body.get("message", "") or resp_body.get("detail", "")
    assert "vượt quá giới hạn" in msg
    assert "105" in msg


def test_submit_feedback_success():
    payload = {
        "name": "Nguyễn Văn A",
        "email": "user@example.com",
        "topic": "bug",
        "message": "Phát hiện lỗi dịch thuật trên đoạn văn tiếng Nhật.",
    }
    response = client.post("/api/process/feedback", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["email"] == "user@example.com"
    assert "ghi nhận" in body["message"]


def test_submit_feedback_invalid_payload():
    payload = {
        "name": "",
        "email": "invalid",
        "message": "abc",  # less than 5 chars
    }
    response = client.post("/api/process/feedback", json=payload)
    assert response.status_code in [400, 422]


# ==============================================================================
# PDFL-156.1 Tests: Backend Empty Content Validation
# ==============================================================================

@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_download_empty_content_original(empty_val):
    payload = {
        "content": empty_val,
        "format": "txt",
        "export_type": "original",
        "filename": "doc_empty",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 400
    res_json = response.json()
    err_msg = res_json.get("message", "") or res_json.get("detail", "")
    assert "văn bản gốc" in err_msg.lower() or "không được để trống" in err_msg


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_download_empty_content_translated(empty_val):
    payload = {
        "content": empty_val,
        "format": "txt",
        "export_type": "translated",
        "filename": "doc_empty",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 400
    res_json = response.json()
    err_msg = res_json.get("message", "") or res_json.get("detail", "")
    assert "bản dịch" in err_msg.lower() or "không được để trống" in err_msg


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_download_empty_content_summary(empty_val):
    payload = {
        "content": empty_val,
        "format": "pdf",
        "export_type": "summary",
        "filename": "doc_empty",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 400
    res_json = response.json()
    err_msg = res_json.get("message", "") or res_json.get("detail", "")
    assert "tóm tắt" in err_msg.lower() or "không được để trống" in err_msg


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_download_bilingual_empty_translated_content(empty_val):
    payload = {
        "content": empty_val,
        "format": "txt",
        "export_type": "bilingual",
        "original_content": "Valid original text.",
        "filename": "doc_empty",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 400
    res_json = response.json()
    err_msg = res_json.get("message", "") or res_json.get("detail", "")
    assert "bản dịch" in err_msg.lower() or "song ngữ" in err_msg.lower()


@pytest.mark.parametrize("empty_val", [None, "", "   ", "\n\t  "])
def test_download_bilingual_empty_original_content(empty_val):
    payload = {
        "content": "Valid translated text.",
        "format": "pdf",
        "export_type": "bilingual",
        "original_content": empty_val,
        "filename": "doc_empty",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 400
    res_json = response.json()
    err_msg = res_json.get("message", "") or res_json.get("detail", "")
    assert "văn bản gốc" in err_msg.lower() or "original_content" in err_msg.lower()


def test_download_bilingual_both_empty():
    payload = {
        "content": "   ",
        "original_content": "   ",
        "format": "txt",
        "export_type": "bilingual",
        "filename": "doc_empty",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 400
    res_json = response.json()
    err_msg = res_json.get("message", "") or res_json.get("detail", "")
    assert "không được để trống" in err_msg


def test_download_original_fallback_to_original_content():
    """Nếu client gửi original export với content rỗng nhưng có original_content, hệ thống vẫn xuất thành công."""
    payload = {
        "content": "",
        "original_content": "Nội dung văn bản gốc dự phòng.",
        "format": "txt",
        "export_type": "original",
        "filename": "tai_lieu_goc",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    decoded = response.content.decode("utf-8-sig")
    assert "Nội dung văn bản gốc dự phòng." in decoded


def test_download_valid_all_types():
    """Kiểm tra trường hợp hợp lệ cho cả 4 loại export_type với cả TXT và PDF."""
    types_config = [
        ("original", "txt", "Nội dung gốc TXT", None, "_goc.txt"),
        ("original", "pdf", "Nội dung gốc PDF", None, "_goc.pdf"),
        ("translated", "txt", "Nội dung dịch TXT", None, "_dich.txt"),
        ("translated", "pdf", "Nội dung dịch PDF", None, "_dich.pdf"),
        ("summary", "txt", "Nội dung tóm tắt TXT", None, "_tomtat.txt"),
        ("summary", "pdf", "Nội dung tóm tắt PDF", None, "_tomtat.pdf"),
        ("bilingual", "txt", "Dịch song ngữ TXT", "Gốc song ngữ TXT", "_songngu.txt"),
        ("bilingual", "pdf", "Dịch song ngữ PDF", "Gốc song ngữ PDF", "_songngu.pdf"),
    ]
    for exp_type, fmt, content, orig_content, expected_suffix in types_config:
        payload = {
            "content": content,
            "format": fmt,
            "export_type": exp_type,
            "filename": "test_valid",
        }
        if orig_content:
            payload["original_content"] = orig_content
        resp = client.post("/api/process/download", json=payload)
        assert resp.status_code == 200, f"Failed for {exp_type} with format {fmt}"
        assert expected_suffix in resp.headers.get("content-disposition", "")


def test_download_export_service_pdf_exception_returns_500():
    """Khi ExportService.export_to_pdf phát sinh lỗi ngoài dự kiến, API phải trả về HTTP 500 với thông điệp chung."""
    payload = {
        "content": "Nội dung hợp lệ để xuất.",
        "format": "pdf",
        "export_type": "translated",
        "filename": "tai_lieu_loi",
    }
    with patch("app.api.process.export_service.export_to_pdf", side_effect=RuntimeError("ReportLab internal segmentation error")):
        response = client.post("/api/process/download", json=payload)
        assert response.status_code == 500
        res_json = response.json()
        err_msg = res_json.get("message", "") or res_json.get("detail", "")
        # Đảm bảo không tiết lộ chi tiết lỗi nội bộ ra ngoài client
        assert "ReportLab internal segmentation error" not in err_msg
        assert "lỗi nội bộ" in err_msg.lower() or "thử lại" in err_msg.lower()


def test_download_export_service_txt_exception_returns_500():
    """Khi ExportService.export_to_txt phát sinh lỗi ngoài dự kiến, API phải trả về HTTP 500 với thông điệp chung."""
    payload = {
        "content": "Nội dung hợp lệ để xuất.",
        "format": "txt",
        "export_type": "translated",
        "filename": "tai_lieu_loi",
    }
    with patch("app.api.process.export_service.export_to_txt", side_effect=IOError("Unexpected file buffer failure")):
        response = client.post("/api/process/download", json=payload)
        assert response.status_code == 500
        res_json = response.json()
        err_msg = res_json.get("message", "") or res_json.get("detail", "")
        # Đảm bảo không tiết lộ chi tiết lỗi nội bộ ra ngoài client
        assert "Unexpected file buffer failure" not in err_msg
        assert "lỗi nội bộ" in err_msg.lower() or "thử lại" in err_msg.lower()


def test_download_empty_payload_dict():
    """Khi client gửi body là dict rỗng {}, API trả về HTTP 400 rõ ràng thay vì 500."""
    response = client.post("/api/process/download", json={})
    assert response.status_code == 400
    res_json = response.json()
    err_msg = res_json.get("message", "") or res_json.get("detail", "")
    assert "không được để trống" in err_msg


# ── PDFL-157.2: Download Endpoint Authentication Tests ─────────────────────────

def test_download_without_token_returns_401():
    """Request gọi POST /api/process/download không có token phải bị từ chối với HTTP 401."""
    app.dependency_overrides.pop(get_current_user, None)
    payload = {
        "content": "Nội dung cần xuất khi chưa đăng nhập.",
        "format": "txt",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 401
    res_json = response.json()
    err_msg = res_json.get("message", "") or res_json.get("detail", "")
    assert res_json.get("error_code") == "NOT_AUTHENTICATED" or "xác thực" in err_msg.lower()


def test_download_invalid_token_returns_401():
    """Request có token không hợp lệ (sai chữ ký, malformed) phải bị từ chối với HTTP 401 INVALID_TOKEN."""
    app.dependency_overrides.pop(get_current_user, None)
    payload = {
        "content": "Nội dung cần xuất với token không hợp lệ.",
        "format": "txt",
    }
    response = client.post(
        "/api/process/download",
        headers={"Authorization": "Bearer bad.malformed.token"},
        json=payload,
    )
    assert response.status_code == 401
    res_json = response.json()
    assert res_json.get("error_code") == "INVALID_TOKEN" or "token" in str(res_json).lower()


def test_download_expired_token_returns_401():
    """Request có token đã hết hạn phải bị từ chối với HTTP 401 TOKEN_EXPIRED."""
    app.dependency_overrides.pop(get_current_user, None)
    expired_token = create_access_token(subject=1, expires_delta=timedelta(seconds=-1))
    payload = {
        "content": "Nội dung cần xuất với token hết hạn.",
        "format": "txt",
    }
    response = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {expired_token}"},
        json=payload,
    )
    assert response.status_code == 401
    res_json = response.json()
    assert res_json.get("error_code") == "TOKEN_EXPIRED" or "hết hạn" in str(res_json).lower()


def test_download_valid_user_success():
    """User hợp lệ đã đăng nhập được phép gọi POST /api/process/download và xuất file thành công."""
    payload = {
        "content": "Nội dung bản dịch thành công cho authenticated user.",
        "format": "txt",
        "export_type": "translated",
        "filename": "authenticated_export",
    }
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 200
    assert "authenticated_export_dich.txt" in response.headers.get("content-disposition", "")
    assert "Nội dung bản dịch thành công cho authenticated user." in response.content.decode("utf-8-sig")


def test_download_inactive_account_returns_403():
    """Tài khoản bị vô hiệu hóa (is_active=False) bị từ chối với HTTP 403 ACCOUNT_INACTIVE."""
    from app.core.exceptions import ForbiddenException

    def raise_inactive():
        raise ForbiddenException(
            message="Tài khoản này đã bị vô hiệu hóa.",
            error_code="ACCOUNT_INACTIVE",
        )

    app.dependency_overrides[get_current_user] = raise_inactive
    payload = {"content": "Sample content", "format": "txt"}
    response = client.post("/api/process/download", json=payload)
    assert response.status_code == 403
    res_json = response.json()
    assert res_json.get("error_code") == "ACCOUNT_INACTIVE"


def test_download_roles_free_pro_admin_all_succeed():
    """Cả 3 role FREE, PRO và ADMIN đều được phép xuất dữ liệu thành công."""
    for role in (UserRole.FREE, UserRole.PRO, UserRole.ADMIN):
        role_user = User(
            id=10,
            email=f"{role.value}@example.com",
            full_name=f"{role.value.capitalize()} User",
            role=role,
            is_active=True,
        )
        app.dependency_overrides[get_current_user] = lambda u=role_user: u
        payload = {
            "content": f"Nội dung từ role {role.value}",
            "format": "txt",
            "export_type": "translated",
            "filename": f"role_{role.value}",
        }
        response = client.post("/api/process/download", json=payload)
        assert response.status_code == 200
        assert f"role_{role.value}_dich.txt" in response.headers.get("content-disposition", "")


def test_download_ignores_document_id_and_does_not_leak():
    """Export API chỉ xuất dữ liệu từ body của request, không nhận document_id để truy vấn hoặc làm lộ tài liệu."""
    payload_with_id_no_content = {
        "document_id": 9999,
        "format": "txt",
        "export_type": "translated",
    }
    res1 = client.post("/api/process/download", json=payload_with_id_no_content)
    assert res1.status_code == 400
    msg1 = res1.json().get("message") or res1.json().get("detail", "")
    assert "không được để trống" in msg1

    payload_with_id_and_content = {
        "document_id": 9999,
        "content": "Văn bản client gửi lên.",
        "format": "txt",
        "export_type": "translated",
        "filename": "custom_doc",
    }
    res2 = client.post("/api/process/download", json=payload_with_id_and_content)
    assert res2.status_code == 200
    assert "Văn bản client gửi lên." in res2.content.decode("utf-8-sig")




