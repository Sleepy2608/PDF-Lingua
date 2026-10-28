import io
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.main import app

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

