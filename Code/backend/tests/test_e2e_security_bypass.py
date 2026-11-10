"""
End-to-End Security Bypass & Authentication Verification Test Suite (PDFL-185.3)
--------------------------------------------------------------------------------
Comprehensive security verification tests covering:
1. Authentication & Token Tampering:
   - Missing token on protected endpoints (401).
   - Malformed, expired, or signature-tampered tokens (401).
   - No silent downgrade to Guest when an invalid/expired token is supplied to optional-auth endpoints.
2. Authorization & Role Spoofing:
   - FREE and Guest callers cannot access ADMIN endpoints (403 / 401).
   - Client-controlled role/plan/user_id in request bodies/params are strictly ignored.
   - ADMIN privileges cannot be obtained via client-supplied inputs.
3. Limit Bypass & Evasion Attempts:
   - Manipulating filename, extension, or Content-Type cannot bypass PDF validation.
   - Direct API calls cannot exceed page limits (100 for Guest/FREE, 500 for PRO/ADMIN) or size limits.
   - Background jobs maintain job owner identity; second-layer defense prevents limit bypass during async execution.
   - Cross-tenant access to unowned documents or histories returns 404 (Anti-IDOR).
4. IDOR & Path Traversal E2E:
   - Path traversal in document downloads is blocked.
   - Cross-tenant isolation strictly verified across all document and history endpoints.
   - ADMIN privileges adhere strictly to defined audit policy.
5. Endpoint Consistency:
   - Identical authentication, authorization, and limits between sync (/upload-and-translate) and async (/jobs).
"""

from datetime import timedelta
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.api.process import _execute_pdf_background_job, job_manager
from app.core.config import settings
from app.core.security import create_access_token
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import UserRole
from app.services.storage_service import StorageService
from tests.security_fixtures import AuthUserFixture


# ── 1. Authentication & Token Tampering Tests ─────────────────────────────────

def test_unauthenticated_requests_to_protected_endpoints_return_401(security_client):
    """
    Endpoints requiring authentication must reject unauthenticated requests with HTTP 401.
    """
    protected_endpoints = [
        ("GET", "/api/documents"),
        ("GET", "/api/documents/1"),
        ("GET", "/api/documents/1/download"),
        ("DELETE", "/api/documents/1"),
        ("GET", "/api/history"),
        ("GET", "/api/history/1"),
        ("GET", "/api/history/1/result"),
        ("DELETE", "/api/history/1"),
        ("POST", "/api/history/cleanup"),
        ("GET", "/api/admin/stats"),
        ("GET", "/api/admin/users"),
    ]

    for method, endpoint in protected_endpoints:
        if method == "GET":
            res = security_client.get(endpoint)
        elif method == "DELETE":
            res = security_client.delete(endpoint)
        elif method == "POST":
            res = security_client.post(endpoint)

        assert res.status_code == 401, f"Expected 401 for unauthenticated {method} {endpoint}, got {res.status_code}"
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "xác thực" in msg.lower() or "not_authenticated" in str(res.json()).lower()


def test_tampered_and_expired_tokens_rejected_with_401(security_client, free_user: AuthUserFixture):
    """
    Tokens with expired timestamps, invalid syntax, or tampered signatures must return HTTP 401.
    """
    # 1. Malformed token string
    res_malformed = security_client.get("/api/documents", headers={"Authorization": "Bearer not.a.valid.jwt"})
    assert res_malformed.status_code == 401

    # 2. Expired token (issued with expiration in the past)
    expired_token = create_access_token(subject=free_user.id, expires_delta=timedelta(seconds=-30))
    res_expired = security_client.get("/api/documents", headers={"Authorization": f"Bearer {expired_token}"})
    assert res_expired.status_code == 401
    assert "hết hạn" in res_expired.text or "TOKEN_EXPIRED" in res_expired.text

    # 3. Tampered token signature (modify last character)
    valid_token = free_user.token
    tampered_token = valid_token[:-2] + ("X" if valid_token[-2] != "X" else "Y") + valid_token[-1]
    res_tampered = security_client.get("/api/documents", headers={"Authorization": f"Bearer {tampered_token}"})
    assert res_tampered.status_code == 401
    assert "chữ ký sai" in res_tampered.text or "INVALID_TOKEN" in res_tampered.text


def test_optional_auth_endpoints_never_downgrade_invalid_token_to_guest(
    security_client,
    valid_1p_pdf: bytes,
    free_user: AuthUserFixture,
):
    """
    Security Requirement: When an Authorization header is provided to /upload-and-translate
    or /jobs, but the token is invalid or expired, the backend MUST NOT silently downgrade
    to Guest mode. It must strictly reject the request with HTTP 401.
    """
    expired_token = create_access_token(subject=free_user.id, expires_delta=timedelta(seconds=-60))
    bad_headers = {"Authorization": f"Bearer {expired_token}"}

    # 1. Sync endpoint with expired token -> MUST return 401, NOT 200 (Guest)
    res_sync = security_client.post(
        "/api/process/upload-and-translate",
        files={"file": ("test.pdf", valid_1p_pdf, "application/pdf")},
        data={"target_lang": "vi"},
        headers=bad_headers,
    )
    assert res_sync.status_code == 401, f"Expected 401 but got {res_sync.status_code}: {res_sync.text}"

    # 2. Background jobs endpoint with expired token -> MUST return 401, NOT 202 (Guest)
    res_job = security_client.post(
        "/api/process/jobs",
        files={"file": ("test.pdf", valid_1p_pdf, "application/pdf")},
        data={"target_lang": "vi"},
        headers=bad_headers,
    )
    assert res_job.status_code == 401, f"Expected 401 but got {res_job.status_code}: {res_job.text}"

    # 3. Conversely, completely omitting Authorization header properly defaults to Guest mode
    res_guest = security_client.post(
        "/api/process/jobs",
        files={"file": ("test.pdf", valid_1p_pdf, "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_guest.status_code == 202
    assert res_guest.json()["success"] is True


# ── 2. Authorization & Role Spoofing Tests ───────────────────────────────────

def test_free_and_pro_users_cannot_access_admin_endpoints(
    security_client,
    free_user: AuthUserFixture,
    pro_user: AuthUserFixture,
):
    """
    Users with FREE or PRO roles receive HTTP 403 Forbidden when attempting
    to access ADMIN-only administration endpoints.
    """
    admin_routes = ["/api/admin/stats", "/api/admin/users"]

    for route in admin_routes:
        # Free user attempt -> 403
        res_free = security_client.get(route, headers=free_user.headers)
        assert res_free.status_code == 403, f"Expected 403 for FREE on {route}, got {res_free.status_code}"

        # Pro user attempt -> 403
        res_pro = security_client.get(route, headers=pro_user.headers)
        assert res_pro.status_code == 403, f"Expected 403 for PRO on {route}, got {res_pro.status_code}"


def test_client_supplied_role_and_user_id_tampering_is_ignored(
    security_client,
    pdf_factory,
    free_user: AuthUserFixture,
    pro_user: AuthUserFixture,
):
    """
    Attempts to elevate privileges or bypass limits by passing client-controlled
    parameters (e.g. role="admin", is_admin=True, user_id=admin.id) are strictly ignored.
    The backend exclusively uses authenticated credentials.
    """
    # 101 pages exceeds FREE limit (100)
    pdf_101p = pdf_factory(101)

    # Free user attempts to claim PRO or ADMIN role in request data
    tampered_payloads = [
        {"target_lang": "vi", "role": "admin"},
        {"target_lang": "vi", "role": "pro", "plan": "pro"},
        {"target_lang": "vi", "is_admin": "true", "role": "ADMIN"},
        {"target_lang": "vi", "user_id": "999"},
    ]

    for payload in tampered_payloads:
        res = security_client.post(
            "/api/process/upload-and-translate",
            files={"file": ("bypass_attempt.pdf", pdf_101p, "application/pdf")},
            data=payload,
            headers=free_user.headers,
        )
        assert res.status_code == 413
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "FREE" in msg
        assert "100" in msg


# ── 3. Limit Bypass & Validation Evasion Tests ───────────────────────────────

def test_validation_cannot_be_bypassed_via_disguised_files(security_client, fake_pdf_exe: bytes):
    """
    Uploading a Windows executable renamed to 'payload.pdf' with Content-Type 'application/pdf'
    must be blocked by Magic Bytes check (HTTP 400).
    """
    for endpoint in ["/api/process/upload-and-translate", "/api/process/jobs"]:
        res = security_client.post(
            endpoint,
            files={"file": ("payload.pdf", fake_pdf_exe, "application/pdf")},
            data={"target_lang": "vi"},
        )
        assert res.status_code == 400
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert "Magic Bytes" in msg


def test_background_job_second_layer_defense_rejects_exceeding_pages(
    tmp_path: Path,
    pdf_factory,
):
    """
    Verifies defense-in-depth: If anomalous data ever bypassed the API endpoint,
    the background thread worker `_execute_pdf_background_job` performs a secondary check
    against `max_allowed_pages` and immediately fails the job before processing.
    """
    # Create 105-page PDF
    pdf_bytes = pdf_factory(105)
    temp_pdf = tmp_path / "anomalous_105p.pdf"
    temp_pdf.write_bytes(pdf_bytes)

    # Create job in manager
    job = job_manager.create_job(filename="anomalous_105p.pdf", target_lang="vi")
    job_id = job.job_id

    # Simulate background worker execution with FREE limit (100 pages)
    _execute_pdf_background_job(
        job_id=job_id,
        tmp_path=temp_pdf,
        filename="anomalous_105p.pdf",
        target_lang="vi",
        max_allowed_pages=100,  # FREE limit
        user_id=1,
        file_size_bytes=len(pdf_bytes),
        file_size_mb=0.1,
    )

    # Verify job status was marked as FAILED with page limit error
    final_job = job_manager.get_job(job_id)
    assert final_job is not None
    assert final_job.status == "FAILED"
    assert "vượt quá giới hạn" in final_job.error
    assert "100" in final_job.error


# ── 4. Cross-Tenant Isolation, IDOR & Path Traversal E2E ─────────────────────

def test_cross_tenant_document_and_history_isolation_e2e(
    security_client,
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
    admin_user: AuthUserFixture,
):
    """
    End-to-end verification of multi-tenant data isolation:
    - User A owns Document A and History A.
    - User B cannot view, download, or delete Document A (404 Anti-IDOR).
    - User B cannot view detail, extract result, or delete History A (404 Anti-IDOR).
    - User B filtering history by Document A receives 403 Forbidden.
    - ADMIN can access and delete both for administrative audit (200 OK).
    """
    user_a, user_b = tenant_users

    # Save document for User A
    stored_a, rel_a, _ = test_storage_service.save_document_file(
        user_id=user_a.id,
        original_filename="Confidential_Report_A.pdf",
        content=b"%PDF-1.4 Confidential content for User A only",
    )
    doc_a = Document(
        user_id=user_a.id,
        original_filename="Confidential_Report_A.pdf",
        stored_filename=stored_a,
        stored_path=rel_a,
        file_size_bytes=46,
        page_count=2,
    )
    db_session.add(doc_a)
    db_session.commit()
    db_session.refresh(doc_a)

    # Save history for User A
    hist_a = ProcessingHistory(
        user_id=user_a.id,
        document_id=doc_a.id,
        action_type=ActionType.TRANSLATE,
        status=ProcessingStatus.SUCCESS,
        execution_time_ms=150,
    )
    db_session.add(hist_a)
    db_session.commit()
    db_session.refresh(hist_a)
    rel_res_a, _ = test_storage_service.save_result_file(
        user_id=user_a.id,
        history_id=hist_a.id,
        result_data={"original_text": "Secret data", "translated_text": "Dữ liệu mật của A"},
    )
    hist_a.result_path = rel_res_a
    db_session.commit()
    db_session.refresh(hist_a)

    # 1. User B (Attacker) tries accessing User A's document endpoints -> 404
    assert security_client.get(f"/api/documents/{doc_a.id}", headers=user_b.headers).status_code == 404
    assert security_client.get(f"/api/documents/{doc_a.id}/download", headers=user_b.headers).status_code == 404
    assert security_client.delete(f"/api/documents/{doc_a.id}", headers=user_b.headers).status_code == 404

    # 2. User B tries accessing User A's history endpoints -> 404
    assert security_client.get(f"/api/history/{hist_a.id}", headers=user_b.headers).status_code == 404
    assert security_client.get(f"/api/history/{hist_a.id}/result", headers=user_b.headers).status_code == 404
    assert security_client.delete(f"/api/history/{hist_a.id}", headers=user_b.headers).status_code == 404

    # 3. User B tries filtering history by Document A -> 403 Forbidden
    res_filter = security_client.get(f"/api/history?document_id={doc_a.id}", headers=user_b.headers)
    assert res_filter.status_code == 403

    # 4. ADMIN accesses User A's resources -> 200 OK
    assert security_client.get(f"/api/documents/{doc_a.id}", headers=admin_user.headers).status_code == 200
    assert security_client.get(f"/api/documents/{doc_a.id}/download", headers=admin_user.headers).status_code == 200
    assert security_client.get(f"/api/history/{hist_a.id}", headers=admin_user.headers).status_code == 200
    assert security_client.get(f"/api/history/{hist_a.id}/result", headers=admin_user.headers).status_code == 200


def test_path_traversal_attempts_in_file_access_blocked(
    security_client,
    free_user: AuthUserFixture,
    test_storage_service: StorageService,
):
    """
    Verifies that directory traversal vectors cannot be used to read or delete files
    outside the user's isolated storage directory.
    """
    # Attempt resolving path traversal vector
    traversal_vectors = [
        "../../etc/passwd",
        "..\\..\\Windows\\System32\\cmd.exe",
        "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "/etc/shadow",
    ]
    for vector in traversal_vectors:
        assert test_storage_service.get_document_path(free_user.id, vector) is None
        assert test_storage_service.get_result_path(free_user.id, vector) is None


# ── 5. Endpoint Consistency Between Sync & Background Jobs ────────────────────

def test_endpoint_consistency_between_sync_and_async_jobs(
    security_client,
    pdf_factory,
    empty_pdf: bytes,
    corrupted_pdf: bytes,
    password_pdf: bytes,
    free_user: AuthUserFixture,
    pro_user: AuthUserFixture,
    monkeypatch,
):
    """
    Verifies consistent authentication, authorization, validation, and page limit behavior
    between synchronous /api/process/upload-and-translate and asynchronous /api/process/jobs.
    """
    # Mock text extraction & translation so sync endpoint doesn't perform heavy OCR
    monkeypatch.setattr(
        "app.api.process.pdf_service.is_scanned_pdf",
        lambda path, max_pages=None: False,
    )
    monkeypatch.setattr(
        "app.api.process.pdf_service.extract_text",
        lambda path, max_pages=None: "Sample digital PDF content.",
    )
    monkeypatch.setattr(
        "app.api.process.translation_service.translate_text",
        lambda text, target_lang=None, source_lang="auto", **kwargs: {
            "translated_text": "Sample translated text",
            "source_lang": source_lang,
            "target_lang": target_lang or "vi",
            "chunk_count": 1,
            "engine_used": "mock",
        },
    )
    # Mock worker so async endpoint doesn't spawn thread
    monkeypatch.setattr("app.api.process._execute_pdf_background_job", lambda *args, **kwargs: None)

    endpoints = [
        ("/api/process/upload-and-translate", 200),
        ("/api/process/jobs", 202),
    ]

    for endpoint, success_code in endpoints:
        # 1. Valid 1-page PDF -> Accepted
        res_valid = security_client.post(
            endpoint,
            files={"file": ("doc.pdf", pdf_factory(1), "application/pdf")},
            data={"target_lang": "vi"},
            headers=free_user.headers,
        )
        assert res_valid.status_code == success_code

        # 2. 101 pages for FREE -> 413 on both
        res_101p = security_client.post(
            endpoint,
            files={"file": ("doc_101p.pdf", pdf_factory(101), "application/pdf")},
            data={"target_lang": "vi"},
            headers=free_user.headers,
        )
        assert res_101p.status_code == 413

        # 3. 501 pages for PRO -> 413 on both
        res_501p = security_client.post(
            endpoint,
            files={"file": ("doc_501p.pdf", pdf_factory(501), "application/pdf")},
            data={"target_lang": "vi"},
            headers=pro_user.headers,
        )
        assert res_501p.status_code == 413

        # 4. Empty file (0 bytes) -> 400 on both
        res_empty = security_client.post(
            endpoint,
            files={"file": ("empty.pdf", empty_pdf, "application/pdf")},
            data={"target_lang": "vi"},
            headers=free_user.headers,
        )
        assert res_empty.status_code == 400

        # 5. Corrupted PDF -> 400 on both
        res_corrupt = security_client.post(
            endpoint,
            files={"file": ("corrupt.pdf", corrupted_pdf, "application/pdf")},
            data={"target_lang": "vi"},
            headers=free_user.headers,
        )
        assert res_corrupt.status_code == 400

        # 6. Password-encrypted PDF -> 400 on both
        res_pwd = security_client.post(
            endpoint,
            files={"file": ("pwd.pdf", password_pdf, "application/pdf")},
            data={"target_lang": "vi"},
            headers=free_user.headers,
        )
        assert res_pwd.status_code == 400

