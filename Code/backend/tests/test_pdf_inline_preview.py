"""
PDF-Lingua - PDFL-256.2: Dual/Split View & Secure Inline PDF Stream Tests
-----------------------------------------------------------------------
Verifies:
1. Secure inline PDF stream headers (Content-Type: application/pdf, Content-Disposition: inline).
2. Strict authorization: Document Owner and Admin have 200 OK access.
3. Anti-IDOR protection: Other users receive HTTP 403 Forbidden.
4. Non-existent documents return HTTP 404 Not Found.
5. Missing physical file returns HTTP 404 Not Found.
6. Unauthenticated requests return HTTP 401 Unauthorized.
7. Both standard route (/api/documents/{id}/file) and compat route (/documents/{id}/file) work.
"""

from pathlib import Path
from urllib.parse import quote
import pytest
from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.documents import preview_document_file
from app.models.document import Document
from app.models.user import User, UserRole
from app.services.storage_service import StorageService
from tests.security_fixtures import AuthUserFixture, create_custom_page_pdf_bytes


def _create_db_document(
    db: Session,
    storage: StorageService,
    user_id: int,
    filename: str = "tai_lieu_mau.pdf",
    content: bytes = b"%PDF-1.4 test stream",
) -> Document:
    """Helper to create a physical test file and corresponding DB Document record."""
    stored_name, relative_path, _ = storage.save_document_file(
        user_id=user_id,
        original_filename=filename,
        content=content,
    )
    doc = Document(
        user_id=user_id,
        original_filename=filename,
        stored_filename=stored_name,
        stored_path=relative_path,
        file_size_bytes=len(content),
        page_count=1,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# ── 1. Unit & Direct Handler Verification ─────────────────────────────────────

@pytest.mark.anyio
async def test_preview_inline_stream_owner_success(
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """Owner successfully retrieves inline PDF stream with proper headers."""
    owner, _ = tenant_users
    pdf_bytes = create_custom_page_pdf_bytes(1, "Owner Inline PDF Content")
    doc = _create_db_document(db_session, test_storage_service, owner.id, "bao_cao_goc.pdf", pdf_bytes)

    response: FileResponse = await preview_document_file(
        document_id=doc.id,
        current_user=owner.user,
        db=db_session,
    )

    assert isinstance(response, FileResponse)
    assert response.status_code == 200
    assert response.media_type == "application/pdf"
    assert response.headers.get("Content-Type") == "application/pdf"

    content_disp = response.headers.get("Content-Disposition", "")
    assert "inline;" in content_disp
    assert quote("bao_cao_goc.pdf") in content_disp
    assert response.headers.get("X-Content-Type-Options") == "nosniff"


@pytest.mark.anyio
async def test_preview_inline_stream_admin_success(
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
    admin_user: AuthUserFixture,
):
    """Admin has full authorization to preview any tenant's document inline."""
    owner, _ = tenant_users
    pdf_bytes = create_custom_page_pdf_bytes(2, "Tenant Doc for Admin Audit")
    doc = _create_db_document(db_session, test_storage_service, owner.id, "hop_dong.pdf", pdf_bytes)

    response: FileResponse = await preview_document_file(
        document_id=doc.id,
        current_user=admin_user.user,
        db=db_session,
    )

    assert response.status_code == 200
    assert response.media_type == "application/pdf"
    assert "inline;" in response.headers.get("Content-Disposition", "")


@pytest.mark.anyio
async def test_preview_inline_stream_idor_forbidden(
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """Another tenant attempting to access Owner's PDF is blocked with HTTP 403 Forbidden."""
    owner, attacker = tenant_users
    pdf_bytes = create_custom_page_pdf_bytes(1, "Confidential Tenant A PDF")
    doc = _create_db_document(db_session, test_storage_service, owner.id, "mat.pdf", pdf_bytes)

    with pytest.raises(HTTPException) as exc_info:
        await preview_document_file(
            document_id=doc.id,
            current_user=attacker.user,
            db=db_session,
        )

    assert exc_info.value.status_code == 403
    assert "không có quyền" in exc_info.value.detail


@pytest.mark.anyio
async def test_preview_inline_stream_nonexistent_document_404(
    db_session: Session,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """Non-existent document_id returns HTTP 404 Not Found."""
    owner, _ = tenant_users
    with pytest.raises(HTTPException) as exc_info:
        await preview_document_file(
            document_id=999999,
            current_user=owner.user,
            db=db_session,
        )

    assert exc_info.value.status_code == 404
    assert "không tồn tại" in exc_info.value.detail


@pytest.mark.anyio
async def test_preview_inline_stream_missing_physical_file_404(
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """Document in DB with missing disk file returns HTTP 404."""
    owner, _ = tenant_users
    doc = Document(
        user_id=owner.id,
        original_filename="ghost.pdf",
        stored_filename="non_existent_uuid.pdf",
        stored_path=f"{owner.id}/non_existent_uuid.pdf",
        file_size_bytes=100,
        page_count=1,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    with pytest.raises(HTTPException) as exc_info:
        await preview_document_file(
            document_id=doc.id,
            current_user=owner.user,
            db=db_session,
        )

    assert exc_info.value.status_code == 404
    assert "vật lý không tồn tại" in exc_info.value.detail


@pytest.mark.anyio
async def test_preview_inline_vietnamese_unicode_filename_encoding(
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """Vietnamese Unicode filename is correctly encoded in Content-Disposition inline header."""
    owner, _ = tenant_users
    pdf_bytes = create_custom_page_pdf_bytes(1, "Nội dung tiếng Việt")
    viet_filename = "Tài liệu hướng dẫn dịch thuật tiếng Việt (2026).pdf"
    doc = _create_db_document(db_session, test_storage_service, owner.id, viet_filename, pdf_bytes)

    response: FileResponse = await preview_document_file(
        document_id=doc.id,
        current_user=owner.user,
        db=db_session,
    )

    content_disp = response.headers.get("Content-Disposition", "")
    assert "inline;" in content_disp
    encoded_expected = quote(viet_filename)
    assert encoded_expected in content_disp


# ── 2. Full HTTP Client Endpoint Tests (Authentication & IDOR) ────────────────

def test_http_endpoint_inline_stream_owner_200(
    security_client: TestClient,
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """GET /api/documents/{id}/file returns 200 with inline headers for document owner."""
    owner, _ = tenant_users
    pdf_bytes = create_custom_page_pdf_bytes(1, "Stream HTTP Owner")
    doc = _create_db_document(db_session, test_storage_service, owner.id, "test_owner.pdf", pdf_bytes)

    res = security_client.get(f"/api/documents/{doc.id}/file", headers=owner.headers)
    assert res.status_code == 200
    assert "application/pdf" in res.headers.get("content-type", "")
    assert "inline;" in res.headers.get("content-disposition", "")
    assert res.content == pdf_bytes


def test_http_endpoint_inline_stream_compat_route_200(
    security_client: TestClient,
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """GET /documents/{id}/file compat route returns 200 with inline headers."""
    owner, _ = tenant_users
    pdf_bytes = create_custom_page_pdf_bytes(1, "Stream HTTP Compat")
    doc = _create_db_document(db_session, test_storage_service, owner.id, "compat.pdf", pdf_bytes)

    res = security_client.get(f"/documents/{doc.id}/file", headers=owner.headers)
    assert res.status_code == 200
    assert "application/pdf" in res.headers.get("content-type", "")
    assert "inline;" in res.headers.get("content-disposition", "")


def test_http_endpoint_inline_stream_admin_200(
    security_client: TestClient,
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
    admin_user: AuthUserFixture,
):
    """GET /api/documents/{id}/file returns 200 for Admin auditing user's file."""
    owner, _ = tenant_users
    pdf_bytes = create_custom_page_pdf_bytes(1, "Stream HTTP Admin")
    doc = _create_db_document(db_session, test_storage_service, owner.id, "user_audit.pdf", pdf_bytes)

    res = security_client.get(f"/api/documents/{doc.id}/file", headers=admin_user.headers)
    assert res.status_code == 200
    assert "application/pdf" in res.headers.get("content-type", "")
    assert "inline;" in res.headers.get("content-disposition", "")


def test_http_endpoint_inline_stream_cross_tenant_idor_403(
    security_client: TestClient,
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """GET /api/documents/{id}/file returns 403 Forbidden when Tenant B tries accessing Tenant A's doc."""
    owner, attacker = tenant_users
    pdf_bytes = create_custom_page_pdf_bytes(1, "Tenant A Secret")
    doc = _create_db_document(db_session, test_storage_service, owner.id, "tenant_a_secret.pdf", pdf_bytes)

    res = security_client.get(f"/api/documents/{doc.id}/file", headers=attacker.headers)
    assert res.status_code == 403
    err_body = res.json()
    err_msg = err_body.get("message") or err_body.get("detail", "")
    assert "không có quyền" in err_msg


def test_http_endpoint_inline_stream_unauthenticated_401(
    security_client: TestClient,
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """GET /api/documents/{id}/file returns 401 Unauthorized when missing Bearer token."""
    owner, _ = tenant_users
    pdf_bytes = create_custom_page_pdf_bytes(1, "Public Cannot View")
    doc = _create_db_document(db_session, test_storage_service, owner.id, "protected.pdf", pdf_bytes)

    res = security_client.get(f"/api/documents/{doc.id}/file")
    assert res.status_code == 401


def test_http_endpoint_inline_stream_nonexistent_404(
    security_client: TestClient,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """GET /api/documents/999999/file returns 404 Not Found."""
    owner, _ = tenant_users
    res = security_client.get("/api/documents/999999/file", headers=owner.headers)
    assert res.status_code == 404


@pytest.mark.anyio
async def test_preview_inline_path_traversal_stored_filename_rejected_404(
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """Path traversal attempt via manipulated stored_filename in DB is rejected with 404."""
    owner, _ = tenant_users
    doc = Document(
        user_id=owner.id,
        original_filename="traversal_test.pdf",
        stored_filename="../../etc/passwd",
        stored_path=f"{owner.id}/../../etc/passwd",
        file_size_bytes=100,
        page_count=1,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    with pytest.raises(HTTPException) as exc_info:
        await preview_document_file(
            document_id=doc.id,
            current_user=owner.user,
            db=db_session,
        )

    assert exc_info.value.status_code == 404
    assert "vật lý không tồn tại" in exc_info.value.detail


@pytest.mark.anyio
async def test_preview_inline_crlf_header_injection_sanitized(
    db_session: Session,
    test_storage_service: StorageService,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """Filename containing CRLF sequences is sanitized to eliminate HTTP Response Splitting."""
    owner, _ = tenant_users
    pdf_bytes = create_custom_page_pdf_bytes(1, "Sanitized PDF")
    malicious_filename = "doc\r\nInjected-Header: evil\r\nSet-Cookie: stolen=1\n.pdf"
    doc = _create_db_document(db_session, test_storage_service, owner.id, "normal_stored.pdf", pdf_bytes)
    # Simulate DB having CRLF injection in original_filename
    doc.original_filename = malicious_filename
    db_session.commit()

    response: FileResponse = await preview_document_file(
        document_id=doc.id,
        current_user=owner.user,
        db=db_session,
    )

    content_disp = response.headers.get("Content-Disposition", "")
    assert "\r" not in content_disp
    assert "\n" not in content_disp
    assert "Injected-Header" in content_disp or "doc" in content_disp
    assert "inline;" in content_disp
