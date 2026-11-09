import io

import pypdf
from app.main import app
from app.services.export_service import ExportService
from app.services.translation_service import TranslationService
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

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


def test_e2e_full_pipeline_multi_target_export_and_empty_validation():
    """
    PDFL-156.4: E2E Integration test validating the entire document processing and export workflow:
    1. Upload and translate digital PDF.
    2. Extract original and translated content.
    3. Successfully export to all 4 types (original, translated, summary, bilingual) via /api/process/download.
    4. Validate that empty/whitespace requests across all 4 types are rejected with HTTP 400.
    5. Validate that unexpected internal errors in ExportService return HTTP 500.
    """
    from unittest.mock import patch

    # 1. Upload & Translate
    text = "Artificial intelligence is transforming document engineering and automated localization."
    pdf_bytes = generate_pdf_buffer([text])
    files = {"file": ("integration_doc.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi"}

    res = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert res.status_code == 200
    doc_res = res.json()["data"]
    orig_text = doc_res["original_text"]
    trans_text = doc_res["translated_text"]
    assert len(orig_text) > 0
    assert len(trans_text) > 0

    # 2. Valid multi-target export (4 types x 2 formats = 8 successful exports)
    export_matrix = [
        ("original", "txt", orig_text, None, "_goc.txt"),
        ("original", "pdf", orig_text, None, "_goc.pdf"),
        ("translated", "txt", trans_text, None, "_dich.txt"),
        ("translated", "pdf", trans_text, None, "_dich.pdf"),
        ("summary", "txt", "1. Điểm chính A\n2. Điểm chính B", None, "_tomtat.txt"),
        ("summary", "pdf", "1. Điểm chính A\n2. Điểm chính B", None, "_tomtat.pdf"),
        ("bilingual", "txt", trans_text, orig_text, "_songngu.txt"),
        ("bilingual", "pdf", trans_text, orig_text, "_songngu.pdf"),
    ]

    for exp_type, fmt, content, orig_content, expected_sfx in export_matrix:
        payload = {
            "content": content,
            "format": fmt,
            "export_type": exp_type,
            "filename": "pipeline_doc",
        }
        if orig_content:
            payload["original_content"] = orig_content

        dl_res = client.post("/api/process/download", json=payload)
        assert dl_res.status_code == 200
        assert expected_sfx in dl_res.headers.get("content-disposition", "")
        if fmt == "pdf":
            assert dl_res.content.startswith(b"%PDF")
        else:
            assert len(dl_res.content) > 0

    # 3. Empty / whitespace validation across all 4 export types -> must return HTTP 400
    empty_cases = [
        {"content": "", "export_type": "original"},
        {"content": "   ", "export_type": "original"},
        {"content": None, "export_type": "translated"},
        {"content": " \t\n ", "export_type": "translated"},
        {"content": "", "export_type": "summary"},
        {"content": "   ", "export_type": "summary"},
        {"content": "", "original_content": orig_text, "export_type": "bilingual"},
        {"content": trans_text, "original_content": "   ", "export_type": "bilingual"},
        {"content": None, "original_content": None, "export_type": "bilingual"},
    ]

    for ec in empty_cases:
        ec["format"] = "txt"
        ec["filename"] = "invalid_doc"
        bad_res = client.post("/api/process/download", json=ec)
        assert bad_res.status_code == 400
        msg = bad_res.json().get("message", "") or bad_res.json().get("detail", "")
        assert "không được để trống" in msg

    # 4. Internal ExportService failure -> must return HTTP 500 without disclosing details
    valid_payload = {
        "content": trans_text,
        "format": "pdf",
        "export_type": "translated",
        "filename": "pipeline_doc",
    }
    with patch("app.api.process.export_service.export_to_pdf", side_effect=Exception("Catastrophic memory error")):
        err_res = client.post("/api/process/download", json=valid_payload)
        assert err_res.status_code == 500
        err_msg = err_res.json().get("message", "") or err_res.json().get("detail", "")
        assert "Catastrophic memory error" not in err_msg
        assert "lỗi nội bộ" in err_msg.lower() or "thử lại" in err_msg.lower()
