import io

from app.main import app
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

client = TestClient(app)


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

