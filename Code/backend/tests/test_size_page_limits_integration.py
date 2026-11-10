"""
Upload Size & Page Limit Integration Tests (PDFL-185.2)
-------------------------------------------------------
Integration tests verifying:
1. Page limit enforcement across all roles (Guest: 100, FREE: 100, PRO: 500, ADMIN: 500).
2. Size limit enforcement across all roles (Guest/FREE: 20MB, PRO/ADMIN: 100MB).
3. Consistent enforcement on both synchronous (/upload-and-translate) and asynchronous (/jobs) endpoints.
4. Boundary condition verification:
   - Exactly at limit: accepted (200 OK / 202 Accepted).
   - Exceeding limit: rejected with HTTP 413 Content Too Large.
   - 0-byte or corrupted PDF: rejected with HTTP 400 Bad Request.
5. Early rejection guarantee: OCR, translation, and background workers are NEVER called when limits are exceeded.
6. Background Jobs: No job is created (job_manager.create_job never called) when limit is exceeded.
7. Temporary file cleanup: all temporary files are safely unlinked when upload fails.
8. Anti-Role-Spoofing: role is strictly derived from backend authentication, ignoring any role parameters sent by client.
"""

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.api.process import job_manager, ocr_service, pdf_service, translation_service
from app.core.config import settings
from tests.security_fixtures import AuthUserFixture


# ── 1. Page Limit Integration Tests (Sync & Background Job Endpoints) ─────────

@pytest.mark.parametrize(
    "role_fixture_name, page_count, expected_status, is_allowed",
    [
        # Guest: 100 allowed, 101 rejected
        (None, 100, 200, True),
        (None, 101, 413, False),
        # FREE: 100 allowed, 101 rejected
        ("free_user", 100, 200, True),
        ("free_user", 101, 413, False),
        # PRO: 500 allowed, 501 rejected
        ("pro_user", 500, 200, True),
        ("pro_user", 501, 413, False),
        # ADMIN: 500 allowed, 501 rejected
        ("admin_user", 500, 200, True),
        ("admin_user", 501, 413, False),
    ],
    ids=[
        "guest_100p_accepted",
        "guest_101p_rejected",
        "free_100p_accepted",
        "free_101p_rejected",
        "pro_500p_accepted",
        "pro_501p_rejected",
        "admin_500p_accepted",
        "admin_501p_rejected",
    ],
)
def test_integration_page_limits_sync_endpoint(
    security_client,
    pdf_factory,
    free_user: AuthUserFixture,
    pro_user: AuthUserFixture,
    admin_user: AuthUserFixture,
    monkeypatch,
    role_fixture_name,
    page_count,
    expected_status,
    is_allowed,
):
    """
    Verifies that POST /api/process/upload-and-translate enforces page limits
    and NEVER invokes OCR or translation when page limits are exceeded.
    """
    mock_ocr = MagicMock(return_value={"text": "Mock OCR output", "page_count": page_count})
    mock_translate = MagicMock(return_value={
        "translated_text": "Mock translated text",
        "source_lang": "en",
        "target_lang": "vi",
        "chunk_count": 1,
        "engine_used": "mock",
    })
    monkeypatch.setattr(ocr_service, "extract_text_from_scanned_pdf", mock_ocr)
    monkeypatch.setattr(translation_service, "translate_text", mock_translate)
    monkeypatch.setattr(pdf_service, "is_scanned_pdf", lambda path, max_pages=None: False)
    monkeypatch.setattr(pdf_service, "extract_text", lambda path, max_pages=None: "Sample digital PDF text.")

    headers = {}
    if role_fixture_name == "free_user":
        headers = free_user.headers
    elif role_fixture_name == "pro_user":
        headers = pro_user.headers
    elif role_fixture_name == "admin_user":
        headers = admin_user.headers

    pdf_bytes = pdf_factory(page_count)

    res = security_client.post(
        "/api/process/upload-and-translate",
        files={"file": (f"test_doc_{page_count}p.pdf", pdf_bytes, "application/pdf")},
        data={"target_lang": "vi"},
        headers=headers,
    )

    assert res.status_code == expected_status

    if is_allowed:
        assert res.json()["success"] is True
        assert res.json()["data"]["page_count"] == page_count
        mock_translate.assert_called_once()
    else:
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "vượt quá giới hạn" in msg
        assert str(page_count) in msg
        # Critical security check: Translation and OCR MUST NOT be called
        mock_ocr.assert_not_called()
        mock_translate.assert_not_called()


@pytest.mark.parametrize(
    "role_fixture_name, page_count, expected_status, is_allowed",
    [
        (None, 100, 202, True),
        (None, 101, 413, False),
        ("free_user", 100, 202, True),
        ("free_user", 101, 413, False),
        ("pro_user", 500, 202, True),
        ("pro_user", 501, 413, False),
        ("admin_user", 500, 202, True),
        ("admin_user", 501, 413, False),
    ],
    ids=[
        "job_guest_100p_accepted",
        "job_guest_101p_rejected",
        "job_free_100p_accepted",
        "job_free_101p_rejected",
        "job_pro_500p_accepted",
        "job_pro_501p_rejected",
        "job_admin_500p_accepted",
        "job_admin_501p_rejected",
    ],
)
def test_integration_page_limits_background_jobs_endpoint(
    security_client,
    pdf_factory,
    free_user: AuthUserFixture,
    pro_user: AuthUserFixture,
    admin_user: AuthUserFixture,
    monkeypatch,
    role_fixture_name,
    page_count,
    expected_status,
    is_allowed,
):
    """
    Verifies that POST /api/process/jobs enforces page limits BEFORE creating a job
    and NEVER creates a job or launches worker threads when limits are exceeded.
    """
    original_create_job = job_manager.create_job
    mock_create_job = MagicMock(side_effect=original_create_job)
    mock_worker = MagicMock()
    monkeypatch.setattr(job_manager, "create_job", mock_create_job)
    monkeypatch.setattr("app.api.process._execute_pdf_background_job", mock_worker)

    headers = {}
    if role_fixture_name == "free_user":
        headers = free_user.headers
    elif role_fixture_name == "pro_user":
        headers = pro_user.headers
    elif role_fixture_name == "admin_user":
        headers = admin_user.headers

    pdf_bytes = pdf_factory(page_count)

    res = security_client.post(
        "/api/process/jobs",
        files={"file": (f"test_job_{page_count}p.pdf", pdf_bytes, "application/pdf")},
        data={"target_lang": "vi"},
        headers=headers,
    )

    assert res.status_code == expected_status

    if is_allowed:
        assert res.json()["success"] is True
        assert "job_id" in res.json()["data"]
        mock_create_job.assert_called_once()
        mock_worker.assert_called_once()
    else:
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "vượt quá giới hạn" in msg
        assert str(page_count) in msg
        # Critical security check: No job should be created and worker MUST NOT be launched
        mock_create_job.assert_not_called()
        mock_worker.assert_not_called()


# ── 2. Size Limit Integration Tests ──────────────────────────────────────────

def test_integration_size_limit_free_user_rejected(security_client, free_user: AuthUserFixture):
    """
    Verifies that files exceeding FREE size limit (20MB) are immediately rejected with HTTP 413
    without writing or persisting to storage.
    """
    # 21MB payload
    oversized_content = b"%PDF-1.4\n" + (b"0" * (21 * 1024 * 1024))

    for endpoint in ["/api/process/upload-and-translate", "/api/process/jobs"]:
        res = security_client.post(
            endpoint,
            files={"file": ("oversized_21mb.pdf", oversized_content, "application/pdf")},
            data={"target_lang": "vi"},
            headers=free_user.headers,
        )
        assert res.status_code == 413
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "vượt quá giới hạn" in msg
        assert "20MB" in msg


def test_integration_size_limit_pro_user_allows_larger_than_20mb(
    security_client,
    pdf_factory,
    pro_user: AuthUserFixture,
    monkeypatch,
):
    """
    Verifies that a PRO user is allowed to upload files > 20MB (up to 100MB).
    Tests with a 21MB valid PDF on the async jobs endpoint.
    """
    monkeypatch.setattr(
        "app.api.process._execute_pdf_background_job",
        lambda *args, **kwargs: None,
    )

    # 21MB valid PDF content (padded with comment bytes so it remains a valid PDF)
    valid_pdf_base = pdf_factory(1)
    padding = b"\n%" + (b"A" * (21 * 1024 * 1024 - len(valid_pdf_base)))
    valid_21mb_pdf = valid_pdf_base + padding

    res = security_client.post(
        "/api/process/jobs",
        files={"file": ("pro_large_21mb.pdf", valid_21mb_pdf, "application/pdf")},
        data={"target_lang": "vi"},
        headers=pro_user.headers,
    )
    # PRO limit is 100MB, so 21MB is accepted (202)
    assert res.status_code == 202
    assert res.json()["success"] is True


# ── 3. Malformed / Empty File Rejection Tests (HTTP 400) ──────────────────────

def test_integration_rejects_empty_and_corrupted_files(
    security_client,
    empty_pdf: bytes,
    corrupted_pdf: bytes,
    free_user: AuthUserFixture,
):
    """
    Verifies that 0-byte or corrupted PDFs return HTTP 400 Bad Request
    and are rejected before any downstream processing occurs.
    """
    for endpoint in ["/api/process/upload-and-translate", "/api/process/jobs"]:
        # Empty file (0 bytes)
        res_empty = security_client.post(
            endpoint,
            files={"file": ("empty.pdf", empty_pdf, "application/pdf")},
            data={"target_lang": "vi"},
            headers=free_user.headers,
        )
        assert res_empty.status_code == 400
        msg_empty = res_empty.json().get("message", "") or res_empty.json().get("detail", "")
        assert "rỗng" in msg_empty

        # Corrupted PDF
        res_corrupt = security_client.post(
            endpoint,
            files={"file": ("corrupt.pdf", corrupted_pdf, "application/pdf")},
            data={"target_lang": "vi"},
            headers=free_user.headers,
        )
        assert res_corrupt.status_code == 400
        msg_corrupt = res_corrupt.json().get("message", "") or res_corrupt.json().get("detail", "")
        assert "Lỗi đọc tệp PDF" in msg_corrupt or "không hợp lệ" in msg_corrupt


# ── 4. Temporary File Cleanup on Upload Failure ───────────────────────────────

def test_integration_temporary_file_cleanup_on_failure(
    security_client,
    corrupted_pdf: bytes,
    free_user: AuthUserFixture,
    monkeypatch,
):
    """
    Verifies that when validation or page limit checks fail, the temporary file
    created during upload is safely unlinked and not leaked on disk.
    """
    created_temp_paths: list[Path] = []
    import tempfile
    original_named_temp_file = tempfile.NamedTemporaryFile

    def tracking_named_temp_file(*args, **kwargs):
        tf = original_named_temp_file(*args, **kwargs)
        created_temp_paths.append(Path(tf.name))
        return tf

    monkeypatch.setattr(tempfile, "NamedTemporaryFile", tracking_named_temp_file)

    res = security_client.post(
        "/api/process/upload-and-translate",
        files={"file": ("corrupt.pdf", corrupted_pdf, "application/pdf")},
        data={"target_lang": "vi"},
        headers=free_user.headers,
    )
    assert res.status_code == 400

    # Ensure all tracked temporary files were deleted
    for tmp_file in created_temp_paths:
        assert not tmp_file.exists(), f"Temporary file was leaked on disk: {tmp_file}"


# ── 5. Anti-Role-Spoofing: Backend Derives Role From Token Only ───────────────

def test_integration_role_spoofing_in_request_body_is_ignored(
    security_client,
    pdf_factory,
    free_user: AuthUserFixture,
):
    """
    Verifies that role parameters sent in request body / form data (e.g. role="admin", plan="pro")
    are strictly IGNORED by the backend.
    A FREE user uploading 101 pages with role='admin' must be rejected with HTTP 413 based on their actual role.
    """
    pdf_101p = pdf_factory(101)

    # Free user attempting to spoof admin role in form data
    res_sync = security_client.post(
        "/api/process/upload-and-translate",
        files={"file": ("spoof.pdf", pdf_101p, "application/pdf")},
        data={"target_lang": "vi", "role": "admin", "plan": "pro"},
        headers=free_user.headers,
    )
    assert res_sync.status_code == 413
    msg = res_sync.json().get("message", "") or res_sync.json().get("detail", "")
    assert "FREE" in msg
    assert "100" in msg

    # Unauthenticated guest attempting to spoof pro role
    res_job = security_client.post(
        "/api/process/jobs",
        files={"file": ("spoof_job.pdf", pdf_101p, "application/pdf")},
        data={"target_lang": "vi", "role": "pro", "is_admin": "true"},
    )
    assert res_job.status_code == 413
    msg_job = res_job.json().get("message", "") or res_job.json().get("detail", "")
    assert "Guest" in msg_job
    assert "100" in msg_job

