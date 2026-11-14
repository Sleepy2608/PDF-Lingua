"""
Upload Security & Hardened PDF Validation Tests (PDFL-214.1)
-----------------------------------------------------------
Verifies:
1. Only .pdf extensions allowed (case-insensitive: .pdf, .PDF, .Pdf).
2. Double extensions (.txt.pdf, .exe.pdf, .php.pdf, etc.), null bytes, and invalid filenames blocked.
3. Content-Type application/pdf strictly enforced.
4. Magic Bytes starting with %PDF-1. strictly enforced.
5. 0-byte files, corrupted PDFs, and password-protected encrypted PDFs safely rejected.
6. Safe exception handling: returns HTTP 400 Bad Request, preventing unexpected HTTP 500 errors.
7. Consistent enforcement across both synchronous (/upload-and-translate) and background (/jobs) endpoints.
"""

import io
from pathlib import Path

import pypdf
import pytest
from app.api.process import pdf_service
from app.main import app
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

client = TestClient(app)


def make_valid_pdf_bytes(text: str = "Tài liệu PDF bảo mật hợp lệ.") -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(100, 700, text)
    c.save()
    return buf.getvalue()


# ── 1. Unit Tests for PDFService Validation Helpers ──────────────────────────

def test_unit_validate_filename():
    # Valid filenames
    assert pdf_service.validate_filename("document.pdf")[0] is True
    assert pdf_service.validate_filename("Report_2026.PDF")[0] is True
    assert pdf_service.validate_filename("my-file-v2.Pdf")[0] is True

    # Missing or empty filenames
    assert pdf_service.validate_filename(None)[0] is False
    assert pdf_service.validate_filename("")[0] is False
    assert pdf_service.validate_filename("   ")[0] is False

    # Invalid extension
    assert pdf_service.validate_filename("document.txt")[0] is False
    assert pdf_service.validate_filename("malware.exe")[0] is False
    assert pdf_service.validate_filename("archive.zip")[0] is False

    # Empty stem (only extension)
    assert pdf_service.validate_filename(".pdf")[0] is False
    assert pdf_service.validate_filename("   .pdf")[0] is False

    # Double extension attempts
    assert pdf_service.validate_filename("document.txt.pdf")[0] is False
    assert pdf_service.validate_filename("exploit.php.pdf")[0] is False
    assert pdf_service.validate_filename("virus.exe.pdf")[0] is False
    assert pdf_service.validate_filename("test.pdf.pdf")[0] is False

    # Null bytes
    assert pdf_service.validate_filename("doc.pdf\x00.exe")[0] is False
    assert pdf_service.validate_filename("doc\x00.pdf")[0] is False

    # Control characters
    assert pdf_service.validate_filename("doc\nname.pdf")[0] is False
    assert pdf_service.validate_filename("doc\rname.pdf")[0] is False


def test_unit_validate_content_type():
    # Valid content types
    assert pdf_service.validate_content_type("application/pdf")[0] is True
    assert pdf_service.validate_content_type("APPLICATION/PDF")[0] is True
    assert pdf_service.validate_content_type("application/pdf; charset=utf-8")[0] is True

    # Invalid content types
    assert pdf_service.validate_content_type(None)[0] is False
    assert pdf_service.validate_content_type("")[0] is False
    assert pdf_service.validate_content_type("text/plain")[0] is False
    assert pdf_service.validate_content_type("application/octet-stream")[0] is False
    assert pdf_service.validate_content_type("image/png")[0] is False


def test_unit_validate_raw_pdf_content():
    valid_pdf = make_valid_pdf_bytes("Kiểm thử raw bytes.")
    assert pdf_service.validate_raw_pdf_content(valid_pdf)[0] is True

    # Empty content
    assert pdf_service.validate_raw_pdf_content(b"")[0] is False

    # Fake magic bytes
    assert pdf_service.validate_raw_pdf_content(b"MZ\x90\x00 executable")[0] is False
    assert pdf_service.validate_raw_pdf_content(b"Plain text file")[0] is False
    assert pdf_service.validate_raw_pdf_content(b"%PDF")[0] is False
    assert pdf_service.validate_raw_pdf_content(b"%PDF-0.9")[0] is False


# ── 2. Endpoint Tests: Valid Uploads ──────────────────────────────────────────

def test_upload_valid_pdf_sync_and_async():
    pdf_bytes = make_valid_pdf_bytes("Hợp đồng nguyên tắc 2026.")

    # Sync endpoint with .pdf
    res_sync = client.post(
        "/api/process/upload-and-translate",
        files={"file": ("contract.pdf", pdf_bytes, "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_sync.status_code == 200
    assert res_sync.json()["success"] is True

    # Async job endpoint with uppercase .PDF
    res_async = client.post(
        "/api/process/jobs",
        files={"file": ("REPORT_Q4.PDF", pdf_bytes, "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_async.status_code == 202
    assert res_async.json()["success"] is True
    assert "job_id" in res_async.json()["data"]


# ── 3. Endpoint Tests: Filename & Extension Hardening ────────────────────────

def test_upload_rejects_non_pdf_extensions():
    pdf_bytes = make_valid_pdf_bytes()

    for bad_name in ["doc.txt", "script.sh", "payload.exe", "image.png"]:
        res = client.post(
            "/api/process/upload-and-translate",
            files={"file": (bad_name, pdf_bytes, "application/pdf")},
            data={"target_lang": "vi"},
        )
        assert res.status_code == 400
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "phải có định dạng .pdf" in msg


def test_upload_rejects_double_extensions():
    pdf_bytes = make_valid_pdf_bytes()

    double_ext_files = [
        "shell.php.pdf",
        "malware.exe.pdf",
        "notes.txt.pdf",
        "document.pdf.pdf",
        "archive.tar.gz.pdf",
    ]

    for fname in double_ext_files:
        # Test on sync endpoint
        res_sync = client.post(
            "/api/process/upload-and-translate",
            files={"file": (fname, pdf_bytes, "application/pdf")},
            data={"target_lang": "vi"},
        )
        assert res_sync.status_code == 400
        msg_sync = res_sync.json().get("message", "") or res_sync.json().get("detail", "")
        assert "double extension" in msg_sync or "không hợp lệ" in msg_sync

        # Test on jobs endpoint
        res_job = client.post(
            "/api/process/jobs",
            files={"file": (fname, pdf_bytes, "application/pdf")},
            data={"target_lang": "vi"},
        )
        assert res_job.status_code == 400
        msg_job = res_job.json().get("message", "") or res_job.json().get("detail", "")
        assert "double extension" in msg_job or "không hợp lệ" in msg_job


def test_upload_rejects_null_byte_and_invalid_filenames():
    pdf_bytes = make_valid_pdf_bytes()

    invalid_names = [
        "doc.pdf\x00.exe",
        "evil\x00.pdf",
        ".pdf",
        "   .pdf",
        "doc\nnewline.pdf",
    ]

    for fname in invalid_names:
        res = client.post(
            "/api/process/upload-and-translate",
            files={"file": (fname, pdf_bytes, "application/pdf")},
            data={"target_lang": "vi"},
        )
        assert res.status_code == 400
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "không hợp lệ" in msg or "phải có định dạng .pdf" in msg or "thiếu" in msg


# ── 4. Endpoint Tests: Content-Type Hardening ────────────────────────────────

def test_upload_rejects_invalid_content_type():
    pdf_bytes = make_valid_pdf_bytes()

    invalid_types = [
        "text/plain",
        "application/octet-stream",
        "image/jpeg",
        "application/x-msdownload",
    ]

    for ctype in invalid_types:
        res = client.post(
            "/api/process/upload-and-translate",
            files={"file": ("document.pdf", pdf_bytes, ctype)},
            data={"target_lang": "vi"},
        )
        assert res.status_code == 400
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "Content-Type" in msg


# ── 5. Endpoint Tests: Magic Bytes & Masquerading Files ───────────────────────

def test_upload_rejects_renamed_txt_or_exe():
    # 1. Plain text masquerading as PDF
    txt_bytes = b"This is just a plain text document masquerading as a PDF file."
    res_txt = client.post(
        "/api/process/upload-and-translate",
        files={"file": ("fake_text.pdf", txt_bytes, "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_txt.status_code == 400
    assert "Magic Bytes" in (res_txt.json().get("message", "") or res_txt.json().get("detail", ""))

    # 2. EXE executable masquerading as PDF
    exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
    res_exe = client.post(
        "/api/process/jobs",
        files={"file": ("fake_exe.pdf", exe_bytes, "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_exe.status_code == 400
    assert "Magic Bytes" in (res_exe.json().get("message", "") or res_exe.json().get("detail", ""))


def test_upload_rejects_wrong_magic_bytes():
    wrong_magic_payloads = [
        b"%PDF-0.9 outdated magic",
        b"%PDFfake header",
        b"PK\x03\x04 zip header",
        b"\x89PNG\r\n\x1a\n png header",
    ]

    for payload in wrong_magic_payloads:
        res = client.post(
            "/api/process/upload-and-translate",
            files={"file": ("test_wrong_magic.pdf", payload, "application/pdf")},
            data={"target_lang": "vi"},
        )
        assert res.status_code == 400
        assert "Magic Bytes" in (res.json().get("message", "") or res.json().get("detail", ""))


# ── 6. Endpoint Tests: 0-byte, Corrupted & Password-Protected Files ──────────

def test_upload_rejects_zero_byte_file():
    for endpoint in ["/api/process/upload-and-translate", "/api/process/jobs"]:
        res = client.post(
            endpoint,
            files={"file": ("empty.pdf", b"", "application/pdf")},
            data={"target_lang": "vi"},
        )
        assert res.status_code == 400
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "rỗng" in msg or "không có dữ liệu" in msg


def test_upload_rejects_corrupted_pdf_without_500():
    # Starts with valid magic bytes %PDF-1.4 but broken trailer/catalog
    corrupt_bytes = b"%PDF-1.4\n%junk\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer corrupted without xref\n%%EOF"

    for endpoint in ["/api/process/upload-and-translate", "/api/process/jobs"]:
        res = client.post(
            endpoint,
            files={"file": ("corrupted.pdf", corrupt_bytes, "application/pdf")},
            data={"target_lang": "vi"},
        )
        assert res.status_code == 400, f"Expected 400 but got {res.status_code}: {res.text}"
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "Lỗi đọc tệp PDF" in msg or "không hợp lệ" in msg


def test_upload_rejects_encrypted_pdf_without_500():
    # Create password-encrypted PDF
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.encrypt("secret_pass_123")
    buf = io.BytesIO()
    writer.write(buf)
    encrypted_bytes = buf.getvalue()

    for endpoint in ["/api/process/upload-and-translate", "/api/process/jobs"]:
        res = client.post(
            endpoint,
            files={"file": ("secured.pdf", encrypted_bytes, "application/pdf")},
            data={"target_lang": "vi"},
        )
        assert res.status_code == 400, f"Expected 400 but got {res.status_code}: {res.text}"
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "mật khẩu bảo vệ" in msg


# ── 7. Endpoint Tests: Export Download Path Traversal Sanitization ───────────

def test_download_export_filename_path_traversal_sanitized():
    """Verify POST /api/process/download sanitizes path traversal filename sequences."""
    from app.core.security import create_access_token

    token = create_access_token(subject="1", additional_claims={"role": "free"})
    payload = {
        "content": "Nội dung bản dịch kiểm thử.",
        "filename": "../../etc/passwd",
        "format": "pdf",
        "title": "Bản dịch",
    }
    res = client.post(
        "/api/process/download",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    disposition = res.headers.get("content-disposition", "")
    assert ".." not in disposition
    assert "/" not in disposition
    assert "\\" not in disposition
    assert "passwd" in disposition
    assert ".pdf" in disposition


