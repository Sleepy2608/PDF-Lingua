import io
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import pypdf

from app.main import app
from app.services.pdf_service import PDFService
from app.services.translation_service import TranslationService
from app.services.export_service import ExportService

client = TestClient(app)


def generate_pdf_buffer(paragraphs: list[str]) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    y = 750
    for para in paragraphs:
        c.drawString(72, y, para)
        y -= 30
        if y < 72:
            c.showPage()
            y = 750
    c.save()
    return buf.getvalue()


def test_e2e_digital_pdf_pipeline():
    sample_text = "Natural language processing enables computers to understand human language."
    pdf_bytes = generate_pdf_buffer([sample_text])

    files = {"file": ("nlp_paper.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi"}

    response = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert response.status_code == 200

    payload = response.json()
    assert payload["success"] is True
    res_data = payload["data"]
    assert res_data["filename"] == "nlp_paper.pdf"
    assert res_data["page_count"] == 1
    assert res_data["is_ocr_used"] is False
    assert "Natural language processing" in res_data["original_text"]
    assert len(res_data["translated_text"]) > 0


def test_e2e_scanned_pdf_detection():
    service = PDFService()

    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=300, height=300)
    buf = io.BytesIO()
    writer.write(buf)
    blank_bytes = buf.getvalue()

    files = {"file": ("scanned_blank.pdf", blank_bytes, "application/pdf")}
    data = {"target_lang": "vi"}

    response = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert response.status_code in [200, 422]


def test_e2e_long_document_chunking_and_order():
    service = TranslationService()

    paragraphs = [
        f"Paragraph {i}: This is an important section detailing system specifications and requirements."
        for i in range(1, 15)
    ]
    full_text = "\n\n".join(paragraphs)

    assert len(full_text) > 1000
    chunks = service.chunk_text(full_text, max_chars=500)
    assert len(chunks) >= 2

    res = service.translate_text(full_text, target_lang="vi", max_chars=500)
    assert len(res["translated_text"]) > 0
    assert res["chunk_count"] >= 2


def test_e2e_export_txt_and_pdf():
    export_svc = ExportService()
    test_content = "Bản dịch tài liệu kỹ thuật hoàn chỉnh: Hệ thống đã sẵn sàng."
    title = "Báo Cáo Kỹ Thuật"

    txt_data = export_svc.export_to_txt(test_content, title=title)
    assert isinstance(txt_data, bytes)
    assert title in txt_data.decode("utf-8-sig")

    pdf_data = export_svc.export_to_pdf(test_content, title=title, original_content="Original English content.")
    assert isinstance(pdf_data, bytes)
    assert pdf_data.startswith(b"%PDF")
    assert len(pdf_data) > 1000


def test_e2e_retranslate_multilingual():
    original = "The quick brown fox jumps over the lazy dog."

    res_vi = client.post("/api/process/retranslate", json={"text": original, "target_lang": "vi"})
    assert res_vi.status_code == 200
    body_vi = res_vi.json()["data"]
    assert len(body_vi["translated_text"]) > 0

    res_fr = client.post("/api/process/retranslate", json={"text": original, "target_lang": "fr"})
    assert res_fr.status_code == 200
    body_fr = res_fr.json()["data"]
    assert len(body_fr["translated_text"]) > 0
