"""
Security Test Matrix Verification Suite (PDFL-185.1)
----------------------------------------------------
Executes comprehensive verification of test fixtures and the security test matrix:
1. Fixture Independence & Characteristic Verification.
2. Role & Page Limit Matrix (Guest: 100, Free: 100, Pro: 500, Admin: 500).
3. Role & File Size Limit Matrix (Guest: 20MB, Free: 20MB, Pro: 100MB, Admin: 100MB).
4. Upload Validation Matrix (0-byte, corrupted, password, fake types, double extension, null byte).
5. Path Traversal Protection Matrix (relative, backslash, absolute, encoded).
6. IDOR & Multi-Tenant Ownership Matrix (cross-tenant 404, admin 200).
7. Authentication & Role Spoofing Matrix (unauthenticated 401, ignored user_id query param).
"""

import io
from pathlib import Path

import pypdf
import pytest
from sqlalchemy.orm import Session

from app.api.process import get_max_pages_by_role, get_user_limits, pdf_service
from app.core.dependencies import get_current_user
from app.core.security import decode_access_token
from app.main import app
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from app.services.storage_service import StorageService
from tests.security_fixtures import (
    IDOR_OWNERSHIP_MATRIX,
    PATH_TRAVERSAL_MATRIX,
    ROLE_PAGE_LIMIT_MATRIX,
    ROLE_SIZE_LIMIT_MATRIX,
    UPLOAD_VALIDATION_MATRIX,
    AuthUserFixture,
)


# ── 1. Fixture Independence & Characteristic Tests ───────────────────────────

def test_user_fixtures_integrity(
    guest_user: None,
    free_user: AuthUserFixture,
    pro_user: AuthUserFixture,
    admin_user: AuthUserFixture,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """
    Verifies that all user fixtures instantiate cleanly with expected roles,
    valid JWT tokens, distinct user IDs, and Bearer authorization headers.
    """
    # Guest fixture is None
    assert guest_user is None

    # FREE user fixture
    assert free_user.role == UserRole.FREE
    assert free_user.user.role == UserRole.FREE
    assert free_user.headers["Authorization"].startswith("Bearer ")
    payload_free = decode_access_token(free_user.token)
    assert payload_free["sub"] == str(free_user.id)

    # PRO user fixture
    assert pro_user.role == UserRole.PRO
    assert pro_user.user.role == UserRole.PRO
    payload_pro = decode_access_token(pro_user.token)
    assert payload_pro["sub"] == str(pro_user.id)

    # ADMIN user fixture
    assert admin_user.role == UserRole.ADMIN
    assert admin_user.user.role == UserRole.ADMIN
    payload_admin = decode_access_token(admin_user.token)
    assert payload_admin["sub"] == str(admin_user.id)

    # Tenant users fixture
    t1, t2 = tenant_users
    assert t1.id != t2.id
    assert t1.token != t2.token
    assert t1.email != t2.email
    assert t1.role == UserRole.FREE
    assert t2.role == UserRole.PRO


def test_pdf_fixtures_characteristics(
    pdf_factory,
    valid_1p_pdf: bytes,
    valid_100p_pdf: bytes,
    valid_101p_pdf: bytes,
    valid_500p_pdf: bytes,
    valid_501p_pdf: bytes,
    empty_pdf: bytes,
    corrupted_pdf: bytes,
    password_pdf: bytes,
    fake_pdf_txt: bytes,
    fake_pdf_exe: bytes,
):
    """
    Verifies that all PDF fixtures exhibit exact expected binary characteristics:
    page count, magic bytes, encryption status, and corruption state.
    """
    # 1. Custom factory
    pdf_5p = pdf_factory(5)
    reader_5p = pypdf.PdfReader(io.BytesIO(pdf_5p))
    assert len(reader_5p.pages) == 5

    # 2. Standard page boundaries
    reader_1p = pypdf.PdfReader(io.BytesIO(valid_1p_pdf))
    assert len(reader_1p.pages) == 1
    assert valid_1p_pdf.startswith(b"%PDF-1.")

    reader_100p = pypdf.PdfReader(io.BytesIO(valid_100p_pdf))
    assert len(reader_100p.pages) == 100

    reader_101p = pypdf.PdfReader(io.BytesIO(valid_101p_pdf))
    assert len(reader_101p.pages) == 101

    reader_500p = pypdf.PdfReader(io.BytesIO(valid_500p_pdf))
    assert len(reader_500p.pages) == 500

    reader_501p = pypdf.PdfReader(io.BytesIO(valid_501p_pdf))
    assert len(reader_501p.pages) == 501

    # 3. Empty PDF
    assert len(empty_pdf) == 0

    # 4. Corrupted PDF
    assert corrupted_pdf.startswith(b"%PDF-1.")
    with pytest.raises(Exception):
        # Corrupted PDF without valid catalog/xref must fail pypdf parsing
        pypdf.PdfReader(io.BytesIO(corrupted_pdf)).pages

    # 5. Password-encrypted PDF
    reader_pwd = pypdf.PdfReader(io.BytesIO(password_pdf))
    assert reader_pwd.is_encrypted is True

    # 6. Fake PDFs
    assert not fake_pdf_txt.startswith(b"%PDF-1.")
    assert fake_pdf_exe.startswith(b"MZ")


# ── 2. Security Test Matrix: Role & Page Limits ──────────────────────────────

@pytest.mark.parametrize("case", ROLE_PAGE_LIMIT_MATRIX, ids=lambda c: f"{c.role_label}_{c.page_count}p")
def test_matrix_role_and_page_limits_policy(case):
    """
    Verifies that `get_max_pages_by_role()` strictly adheres to the standardized
    PDF page limit matrix across all roles and input variants (PDFL-178.1).
    """
    max_pages = get_max_pages_by_role(case.role_enum)
    if case.role_label in ("GUEST", "FREE"):
        assert max_pages == 100
    elif case.role_label in ("PRO", "ADMIN"):
        assert max_pages == 500

    if case.page_count <= max_pages:
        assert case.expected_allowed is True
    else:
        assert case.expected_allowed is False


@pytest.mark.parametrize("case", ROLE_PAGE_LIMIT_MATRIX, ids=lambda c: f"sync_{c.role_label}_{c.page_count}p")
def test_matrix_role_and_page_limits_sync_endpoint(
    security_client,
    pdf_factory,
    free_user: AuthUserFixture,
    pro_user: AuthUserFixture,
    admin_user: AuthUserFixture,
    monkeypatch,
    case,
):
    """
    Verifies HTTP 200 vs 413 on POST /api/process/upload-and-translate
    according to the Role Page Limit Matrix.
    """
    # Mock text extraction & translation to focus strictly on page limit enforcement without heavy OCR
    monkeypatch.setattr(
        "app.api.process.pdf_service.is_scanned_pdf",
        lambda path, max_pages=None: False,
    )
    monkeypatch.setattr(
        "app.api.process.pdf_service.extract_text",
        lambda path, max_pages=None: "Nội dung văn bản hợp lệ phục vụ kiểm thử bảo mật.",
    )
    monkeypatch.setattr(
        "app.api.process.translation_service.translate_text",
        lambda text, target_lang=None, source_lang="auto", **kwargs: {
            "translated_text": f"Bản dịch mock: {text[:30]}",
            "source_lang": source_lang,
            "target_lang": target_lang or "vi",
            "chunk_count": 1,
            "engine_used": "mock",
        },
    )

    pdf_bytes = pdf_factory(case.page_count)
    headers = {}

    if case.role_label == "FREE":
        headers = free_user.headers
    elif case.role_label == "PRO":
        headers = pro_user.headers
    elif case.role_label == "ADMIN":
        headers = admin_user.headers

    res = security_client.post(
        "/api/process/upload-and-translate",
        files={"file": (f"test_{case.page_count}p.pdf", pdf_bytes, "application/pdf")},
        data={"target_lang": "vi"},
        headers=headers,
    )

    if case.expected_allowed:
        assert res.status_code == 200, f"Expected 200 for {case.role_label} with {case.page_count} pages: {res.text}"
        assert res.json()["success"] is True
    else:
        assert res.status_code == 413, f"Expected 413 for {case.role_label} with {case.page_count} pages: {res.text}"
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert str(case.page_count) in msg
        assert "vượt quá giới hạn" in msg


@pytest.mark.parametrize("case", ROLE_PAGE_LIMIT_MATRIX, ids=lambda c: f"async_{c.role_label}_{c.page_count}p")
def test_matrix_role_and_page_limits_async_job_endpoint(
    security_client,
    pdf_factory,
    free_user: AuthUserFixture,
    pro_user: AuthUserFixture,
    admin_user: AuthUserFixture,
    case,
):
    """
    Verifies HTTP 202 vs 413 on POST /api/process/jobs
    according to the Role Page Limit Matrix.
    """
    pdf_bytes = pdf_factory(case.page_count)
    headers = {}

    if case.role_label == "FREE":
        headers = free_user.headers
    elif case.role_label == "PRO":
        headers = pro_user.headers
    elif case.role_label == "ADMIN":
        headers = admin_user.headers

    res = security_client.post(
        "/api/process/jobs",
        files={"file": (f"test_{case.page_count}p.pdf", pdf_bytes, "application/pdf")},
        data={"target_lang": "vi"},
        headers=headers,
    )

    if case.expected_allowed:
        assert res.status_code == 202, f"Expected 202 for {case.role_label} with {case.page_count} pages: {res.text}"
        assert res.json()["success"] is True
        assert "job_id" in res.json()["data"]
    else:
        assert res.status_code == 413, f"Expected 413 for {case.role_label} with {case.page_count} pages: {res.text}"
        msg = res.json().get("message", "") or res.json().get("detail", "")
        assert str(case.page_count) in msg
        assert "vượt quá giới hạn" in msg


# ── 3. Security Test Matrix: File Size Limits ────────────────────────────────

@pytest.mark.parametrize("case", ROLE_SIZE_LIMIT_MATRIX, ids=lambda c: c.role_label)
def test_matrix_role_and_file_size_limits(case):
    """
    Verifies file size limits across all user roles via `get_user_limits()`.
    """
    user_mock = User(role=case.role_enum) if case.role_enum else None
    max_mb, _ = get_user_limits(user_mock)
    assert max_mb == case.expected_mb


# ── 4. Security Test Matrix: Upload Validation Hardening ─────────────────────

@pytest.mark.parametrize("case", UPLOAD_VALIDATION_MATRIX, ids=lambda c: c.case_name)
def test_matrix_upload_validation(security_client, monkeypatch, case):
    """
    Verifies that the upload pipeline safely accepts valid PDFs and rejects all
    malicious/invalid formats with HTTP 400 without crashing (preventing HTTP 500).
    """
    monkeypatch.setattr(
        "app.api.process.pdf_service.is_scanned_pdf",
        lambda path, max_pages=None: False,
    )
    monkeypatch.setattr(
        "app.api.process.pdf_service.extract_text",
        lambda path, max_pages=None: "Nội dung văn bản hợp lệ phục vụ kiểm thử bảo mật.",
    )
    monkeypatch.setattr(
        "app.api.process.translation_service.translate_text",
        lambda text, target_lang=None, source_lang="auto", **kwargs: {
            "translated_text": f"Bản dịch mock: {text[:30]}",
            "source_lang": source_lang,
            "target_lang": target_lang or "vi",
            "chunk_count": 1,
            "engine_used": "mock",
        },
    )
    payload_bytes = case.content_generator()

    for endpoint in ["/api/process/upload-and-translate", "/api/process/jobs"]:
        res = security_client.post(
            endpoint,
            files={"file": (case.filename, payload_bytes, case.content_type)},
            data={"target_lang": "vi"},
        )
        if case.expected_status == 200:
            expected_code = 200 if "upload-and-translate" in endpoint else 202
            assert res.status_code == expected_code
        else:
            assert res.status_code == case.expected_status, (
                f"Expected {case.expected_status} for {case.case_name} on {endpoint}, got {res.status_code}: {res.text}"
            )
            msg = res.json().get("message", "") or res.json().get("detail", "")
            if case.error_keyword:
                assert case.error_keyword.lower() in msg.lower()


# ── 5. Security Test Matrix: Path Traversal Protection ───────────────────────

@pytest.mark.parametrize("case", PATH_TRAVERSAL_MATRIX, ids=lambda c: c.filename_vector)
def test_matrix_path_traversal_protection(test_storage_service: StorageService, case):
    """
    Verifies that `StorageService` strictly detects and neutralizes all directory
    and path traversal vectors (PDFL-214.2).
    """
    # 1. Filename sanitization
    safe_name = test_storage_service.sanitize_filename(case.filename_vector)
    assert ".." not in safe_name
    assert "/" not in safe_name
    assert "\\" not in safe_name

    # 2. Path resolution blocks traversal
    resolved = test_storage_service.get_document_path(user_id=1, stored_filename=case.filename_vector)
    assert resolved is None


# ── 6. Security Test Matrix: IDOR & Document Ownership ───────────────────────

def test_matrix_idor_and_document_ownership(
    security_client,
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
    admin_user: AuthUserFixture,
):
    """
    Verifies multi-tenant isolation, Anti-IDOR (HTTP 404 for unauthorized access),
    and elevated ADMIN privileges across all document and history endpoints (PDFL-214.3).
    """
    tenant_a, tenant_b = tenant_users

    # Save document for Tenant A
    stored_a, rel_a, _ = test_storage_service.save_document_file(
        user_id=tenant_a.id,
        original_filename="Confidential_A.pdf",
        content=b"%PDF-1.4 Confidential content for Tenant A",
    )
    doc_a = Document(
        user_id=tenant_a.id,
        original_filename="Confidential_A.pdf",
        stored_filename=stored_a,
        stored_path=rel_a,
        file_size_bytes=45,
        page_count=1,
    )
    db_session.add(doc_a)
    db_session.commit()
    db_session.refresh(doc_a)

    # Save history for Tenant A
    hist_a = ProcessingHistory(
        user_id=tenant_a.id,
        document_id=doc_a.id,
        action_type=ActionType.TRANSLATE,
        status=ProcessingStatus.SUCCESS,
        execution_time_ms=100,
    )
    db_session.add(hist_a)
    db_session.commit()
    db_session.refresh(hist_a)
    rel_res_a, _ = test_storage_service.save_result_file(
        user_id=tenant_a.id,
        history_id=hist_a.id,
        result_data={"original_text": "Secret text", "translated_text": "Văn bản bí mật"},
    )
    hist_a.result_path = rel_res_a
    db_session.commit()
    db_session.refresh(hist_a)

    # 1. Tenant A accesses own document and history -> 200 OK
    assert security_client.get(f"/api/documents/{doc_a.id}", headers=tenant_a.headers).status_code == 200
    assert security_client.get(f"/api/documents/{doc_a.id}/download", headers=tenant_a.headers).status_code == 200
    assert security_client.get(f"/api/history/{hist_a.id}", headers=tenant_a.headers).status_code == 200
    assert security_client.get(f"/api/history/{hist_a.id}/result", headers=tenant_a.headers).status_code == 200

    # 2. Tenant B attempts cross-tenant access -> 404 Not Found (Anti-IDOR)
    assert security_client.get(f"/api/documents/{doc_a.id}", headers=tenant_b.headers).status_code == 404
    assert security_client.get(f"/api/documents/{doc_a.id}/download", headers=tenant_b.headers).status_code == 404
    assert security_client.delete(f"/api/documents/{doc_a.id}", headers=tenant_b.headers).status_code == 404
    assert security_client.get(f"/api/history/{hist_a.id}", headers=tenant_b.headers).status_code == 404
    assert security_client.get(f"/api/history/{hist_a.id}/result", headers=tenant_b.headers).status_code == 404
    assert security_client.delete(f"/api/history/{hist_a.id}", headers=tenant_b.headers).status_code == 404

    # 3. ADMIN accesses Tenant A's document and history -> 200 OK
    assert security_client.get(f"/api/documents/{doc_a.id}", headers=admin_user.headers).status_code == 200
    assert security_client.get(f"/api/documents/{doc_a.id}/download", headers=admin_user.headers).status_code == 200
    assert security_client.get(f"/api/history/{hist_a.id}", headers=admin_user.headers).status_code == 200
    assert security_client.get(f"/api/history/{hist_a.id}/result", headers=admin_user.headers).status_code == 200


# ── 7. Security Test Matrix: Authentication & Role Spoofing ──────────────────

def test_matrix_auth_and_role_spoofing(
    security_client,
    free_user: AuthUserFixture,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """
    Verifies that:
    1. Protected endpoints require valid authentication (401).
    2. Client-supplied `user_id` query params are strictly ignored for non-admins.
    3. Tampered tokens or fake roles cannot escalate privileges.
    """
    tenant_a, tenant_b = tenant_users

    # 1. Unauthenticated request to protected endpoint -> 401
    assert security_client.get("/api/documents").status_code == 401
    assert security_client.get("/api/history").status_code == 401

    # 2. Invalid / expired / forged token -> 401
    bad_headers = {"Authorization": "Bearer invalid.jwt.token"}
    assert security_client.get("/api/documents", headers=bad_headers).status_code == 401

    # 3. Spoofed user_id in query parameter: Tenant A sends ?user_id=tenant_b.id
    res_docs = security_client.get(f"/api/documents?user_id={tenant_b.id}", headers=tenant_a.headers)
    assert res_docs.status_code == 200
    # Must only return Tenant A's documents, completely ignoring tenant_b.id
    for doc in res_docs.json()["data"]:
        assert doc["user_id"] == tenant_a.id

    res_hist = security_client.get(f"/api/history?user_id={tenant_b.id}", headers=tenant_a.headers)
    assert res_hist.status_code == 200
    for h in res_hist.json()["data"]:
        assert h["user_id"] == tenant_a.id

