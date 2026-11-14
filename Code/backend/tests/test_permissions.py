"""
Role-Based Access Control (RBAC) & Permission Limits Test Suite
--------------------------------------------------------------
Tests for PDFL-81:
- RBAC dependency require_roles(*roles) enforcement (200 OK vs 403 Forbidden).
- get_optional_current_user behavior (Guest None, valid User, rejection of invalid/expired tokens).
- get_user_limits helper for all roles (Guest, Free, Pro, Admin).
- Role-based file size limits on /api/process/upload-and-translate (20MB vs 100MB).
- Role-based OCR page limits on /api/process/upload-and-translate (100 vs 500 pages).
- Rejection of invalid/expired tokens on process endpoints without silent downgrade to Guest.
"""

from datetime import timedelta
from typing import Optional

import pytest
from app.api.process import get_max_pages_by_role, get_user_limits
from app.core.config import settings
from app.core.database import Base
from app.core.dependencies import get_db, get_optional_current_user, require_roles
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.document import Document
from app.models.user import User, UserRole
from app.services.storage_service import StorageService
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Isolated in-memory SQLite database
TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create fresh database schema for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """TestClient overriding get_db with test db_session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def create_user_with_role(db, email: str, role: UserRole, is_active: bool = True) -> tuple[User, str]:
    """Helper to create a user with a specific role and generate an access token."""
    user = User(
        email=email,
        hashed_password=hash_password("Password123"),
        full_name=f"Test {role.value.capitalize()}",
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(subject=user.id)
    return user, token


# ── 1. Unit Tests for get_user_limits() ────────────────────────────────────────

def test_get_user_limits_guest():
    """Guest (unauthenticated) receives Free limits: 20MB and 100 pages."""
    upload_mb, ocr_pages = get_user_limits(None)
    assert upload_mb == settings.MAX_UPLOAD_SIZE_FREE_MB
    assert upload_mb == 20
    assert ocr_pages == settings.MAX_PAGES_FREE
    assert ocr_pages == 100


def test_get_user_limits_free_user():
    """Free user receives Free limits: 20MB and 100 pages."""
    free_user = User(role=UserRole.FREE)
    upload_mb, ocr_pages = get_user_limits(free_user)
    assert upload_mb == 20
    assert ocr_pages == 100


def test_get_user_limits_pro_user():
    """Pro user receives Pro limits: 100MB and 500 pages."""
    pro_user = User(role=UserRole.PRO)
    upload_mb, ocr_pages = get_user_limits(pro_user)
    assert upload_mb == settings.MAX_UPLOAD_SIZE_PRO_MB
    assert upload_mb == 100
    assert ocr_pages == settings.MAX_PAGES_PRO
    assert ocr_pages == 500


def test_get_user_limits_admin_user():
    """Admin user receives expanded limits equal to Pro: 100MB and 500 pages."""
    admin_user = User(role=UserRole.ADMIN)
    upload_mb, ocr_pages = get_user_limits(admin_user)
    assert upload_mb == 100
    assert ocr_pages == 500


def test_get_user_limits_unknown_role_fallback():
    """Unrecognized role safely falls back to standard Free limits."""
    class MockUser:
        role = "unknown_role"
    upload_mb, ocr_pages = get_user_limits(MockUser())
    assert upload_mb == 20
    assert ocr_pages == 100


def test_get_max_pages_by_role_standardized_limits():
    """PDFL-178.1: Verify standardized max pages policy across all roles and input formats."""
    # Guest (None / 'guest') -> 100
    assert get_max_pages_by_role(None) == 100
    assert get_max_pages_by_role("guest") == 100
    assert get_max_pages_by_role("GUEST") == 100

    # FREE (UserRole.FREE / 'free' / User instance) -> 100
    assert get_max_pages_by_role(UserRole.FREE) == 100
    assert get_max_pages_by_role("free") == 100
    assert get_max_pages_by_role("FREE") == 100
    assert get_max_pages_by_role(User(role=UserRole.FREE)) == 100

    # PRO (UserRole.PRO / 'pro' / User instance) -> 500
    assert get_max_pages_by_role(UserRole.PRO) == 500
    assert get_max_pages_by_role("pro") == 500
    assert get_max_pages_by_role("PRO") == 500
    assert get_max_pages_by_role(User(role=UserRole.PRO)) == 500

    # ADMIN (UserRole.ADMIN / 'admin' / User instance) -> 500
    assert get_max_pages_by_role(UserRole.ADMIN) == 500
    assert get_max_pages_by_role("admin") == 500
    assert get_max_pages_by_role("ADMIN") == 500
    assert get_max_pages_by_role(User(role=UserRole.ADMIN)) == 500

    # Unknown / unexpected values safely fallback to Free limit (100)
    assert get_max_pages_by_role("unknown") == 100
    assert get_max_pages_by_role("") == 100
    assert get_max_pages_by_role(12345) == 100


# ── 2. RBAC require_roles() Dependency Tests ──────────────────────────────────

# Create test routes using require_roles (named rbac_router to avoid pytest collection warning)
rbac_router = APIRouter(prefix="/api/test-rbac")


@rbac_router.get("/pro-only")
def pro_only_endpoint(user: User = Depends(require_roles(UserRole.PRO))):
    return {"status": "ok", "role": user.role.value}


@rbac_router.get("/admin-only")
def admin_only_endpoint(user: User = Depends(require_roles(UserRole.ADMIN))):
    return {"status": "ok", "role": user.role.value}


@rbac_router.get("/pro-or-admin")
def pro_or_admin_endpoint(user: User = Depends(require_roles(UserRole.PRO, UserRole.ADMIN))):
    return {"status": "ok", "role": user.role.value}


@rbac_router.get("/optional-auth")
def optional_auth_endpoint(user: Optional[User] = Depends(get_optional_current_user)):
    return {"authenticated": user is not None, "role": user.role.value if user else None}


# Register test router on FastAPI app
app.include_router(rbac_router)


def test_require_roles_unauthenticated(client):
    """Accessing a protected endpoint without token returns 401 NOT_AUTHENTICATED."""
    res = client.get("/api/test-rbac/pro-only")
    assert res.status_code == 401
    assert res.json()["error_code"] == "NOT_AUTHENTICATED"


def test_require_roles_free_user_forbidden(client, db_session):
    """Free user accessing Pro-only endpoint receives 403 FORBIDDEN."""
    _, free_token = create_user_with_role(db_session, "free@example.com", UserRole.FREE)

    res = client.get("/api/test-rbac/pro-only", headers={"Authorization": f"Bearer {free_token}"})
    assert res.status_code == 403
    assert res.json()["error_code"] == "FORBIDDEN"
    assert "không có quyền" in res.json()["message"]


def test_require_roles_pro_user_success(client, db_session):
    """Pro user accessing Pro-only endpoint succeeds with 200 OK."""
    _, pro_token = create_user_with_role(db_session, "pro@example.com", UserRole.PRO)

    res = client.get("/api/test-rbac/pro-only", headers={"Authorization": f"Bearer {pro_token}"})
    assert res.status_code == 200
    assert res.json()["role"] == "pro"


def test_require_roles_admin_only_restricts_pro(client, db_session):
    """Pro user accessing Admin-only endpoint receives 403 FORBIDDEN."""
    _, pro_token = create_user_with_role(db_session, "pro_denied@example.com", UserRole.PRO)

    res = client.get("/api/test-rbac/admin-only", headers={"Authorization": f"Bearer {pro_token}"})
    assert res.status_code == 403
    assert res.json()["error_code"] == "FORBIDDEN"


def test_require_roles_admin_success(client, db_session):
    """Admin user accessing Admin-only endpoint succeeds with 200 OK."""
    _, admin_token = create_user_with_role(db_session, "admin@example.com", UserRole.ADMIN)

    res = client.get("/api/test-rbac/admin-only", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


def test_require_roles_multi_role_acceptance(client, db_session):
    """Endpoint requiring Pro or Admin accepts both, and rejects Free."""
    _, free_token = create_user_with_role(db_session, "free_m@example.com", UserRole.FREE)
    _, pro_token = create_user_with_role(db_session, "pro_m@example.com", UserRole.PRO)
    _, admin_token = create_user_with_role(db_session, "admin_m@example.com", UserRole.ADMIN)

    # Free rejected
    res_free = client.get("/api/test-rbac/pro-or-admin", headers={"Authorization": f"Bearer {free_token}"})
    assert res_free.status_code == 403

    # Pro accepted
    res_pro = client.get("/api/test-rbac/pro-or-admin", headers={"Authorization": f"Bearer {pro_token}"})
    assert res_pro.status_code == 200

    # Admin accepted
    res_admin = client.get("/api/test-rbac/pro-or-admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200


def test_require_roles_empty_roles_definition_raises():
    """Defining require_roles without any role raises ValueError."""
    with pytest.raises(ValueError, match="At least one UserRole must be specified"):
        require_roles()


# ── 3. get_optional_current_user Dependency Tests ─────────────────────────────

def test_optional_user_guest_no_token(client):
    """Request with no Authorization header returns Guest state (None)."""
    res = client.get("/api/test-rbac/optional-auth")
    assert res.status_code == 200
    assert res.json()["authenticated"] is False
    assert res.json()["role"] is None


def test_optional_user_valid_token(client, db_session):
    """Request with valid Bearer token returns authenticated user and correct role."""
    _, pro_token = create_user_with_role(db_session, "opt_pro@example.com", UserRole.PRO)

    res = client.get("/api/test-rbac/optional-auth", headers={"Authorization": f"Bearer {pro_token}"})
    assert res.status_code == 200
    assert res.json()["authenticated"] is True
    assert res.json()["role"] == "pro"


def test_optional_user_invalid_token_rejects_with_401(client):
    """Malformed or tampered token returns 401 INVALID_TOKEN, not degraded to Guest."""
    res = client.get("/api/test-rbac/optional-auth", headers={"Authorization": "Bearer invalid.malformed.token"})
    assert res.status_code == 401
    assert res.json()["error_code"] == "INVALID_TOKEN"


def test_optional_user_expired_token_rejects_with_401(client):
    """Expired token returns 401 TOKEN_EXPIRED, not degraded to Guest."""
    expired_token = create_access_token(subject=1, expires_delta=timedelta(seconds=-1))
    res = client.get("/api/test-rbac/optional-auth", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert res.json()["error_code"] == "TOKEN_EXPIRED"


def test_optional_user_inactive_account_rejects_with_403(client, db_session):
    """Inactive account token returns 403 ACCOUNT_INACTIVE, not degraded to Guest."""
    _, inactive_token = create_user_with_role(db_session, "inactive@example.com", UserRole.FREE, is_active=False)

    res = client.get("/api/test-rbac/optional-auth", headers={"Authorization": f"Bearer {inactive_token}"})
    assert res.status_code == 403
    assert res.json()["error_code"] == "ACCOUNT_INACTIVE"


# ── 4. Process Endpoint Limits & Boundary Tests ───────────────────────────────

def test_upload_free_guest_within_limit_accepted(client):
    """Guest uploading small PDF (<= 20MB) passes size validation check."""
    fake_pdf = b"%PDF-1.4 sample content within free limit"
    files = {"file": ("test.pdf", fake_pdf, "application/pdf")}
    res = client.post("/api/process/upload-and-translate", files=files, data={"target_lang": "vi"})
    # May return 200 or 400 (if empty text), but NOT 413
    assert res.status_code != 413


def test_upload_free_user_exceeding_20mb_rejected_413(client, db_session):
    """Free user uploading file > 20MB receives 413 with 20MB limit message."""
    _, free_token = create_user_with_role(db_session, "free_limit@example.com", UserRole.FREE)

    # 21 MB content
    large_content = b"%PDF-1.4 " + b"0" * (21 * 1024 * 1024)
    files = {"file": ("large_free.pdf", large_content, "application/pdf")}

    res = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {free_token}"},
        files=files,
        data={"target_lang": "vi"},
    )
    assert res.status_code == 413
    assert "20MB" in res.json()["message"]


def test_upload_guest_exceeding_20mb_rejected_413(client):
    """Guest (unauthenticated) uploading file > 20MB receives 413."""
    large_content = b"%PDF-1.4 " + b"0" * (21 * 1024 * 1024)
    files = {"file": ("large_guest.pdf", large_content, "application/pdf")}

    res = client.post(
        "/api/process/upload-and-translate",
        files=files,
        data={"target_lang": "vi"},
    )
    assert res.status_code == 413
    assert "20MB" in res.json()["message"]


def test_upload_pro_user_allows_over_20mb(client, db_session, monkeypatch):
    """Pro user uploading 25MB file passes the 20MB boundary without 413."""
    _, pro_token = create_user_with_role(db_session, "pro_limit@example.com", UserRole.PRO)

    content_25mb = b"%PDF-1.4 " + b"0" * (25 * 1024 * 1024)
    files = {"file": ("pro_25mb.pdf", content_25mb, "application/pdf")}

    # Mock validation and extraction so it doesn't fail downstream
    from app.api.process import pdf_service, translation_service
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 5, "error": None})
    monkeypatch.setattr(pdf_service, "is_scanned_pdf", lambda path, *a, **kw: False)
    monkeypatch.setattr(pdf_service, "extract_text", lambda path, *a, **kw: "Sample extracted text from Pro document.")
    monkeypatch.setattr(translation_service, "translate_text", lambda text, **kw: {
        "translated_text": "Bản dịch thử nghiệm.",
        "engine_used": "mock",
    })

    res = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {pro_token}"},
        files=files,
        data={"target_lang": "vi"},
    )
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_upload_admin_user_allows_over_20mb(client, db_session, monkeypatch):
    """Admin user uploading 25MB file passes the 20MB boundary without 413."""
    _, admin_token = create_user_with_role(db_session, "admin_limit@example.com", UserRole.ADMIN)

    content_25mb = b"%PDF-1.4 " + b"0" * (25 * 1024 * 1024)
    files = {"file": ("admin_25mb.pdf", content_25mb, "application/pdf")}

    from app.api.process import pdf_service, translation_service
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 5, "error": None})
    monkeypatch.setattr(pdf_service, "is_scanned_pdf", lambda path, *a, **kw: False)
    monkeypatch.setattr(pdf_service, "extract_text", lambda path, *a, **kw: "Sample extracted text from Admin document.")
    monkeypatch.setattr(translation_service, "translate_text", lambda text, **kw: {
        "translated_text": "Bản dịch thử nghiệm Admin.",
        "engine_used": "mock",
    })

    res = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {admin_token}"},
        files=files,
        data={"target_lang": "vi"},
    )
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_upload_pro_user_exceeding_100mb_rejected_413(client, db_session):
    """Pro user uploading > 100MB file receives 413 with 100MB limit message."""
    _, pro_token = create_user_with_role(db_session, "pro_max@example.com", UserRole.PRO)

    # 101 MB content
    huge_content = b"%PDF-1.4 " + b"0" * (101 * 1024 * 1024)
    files = {"file": ("huge_pro.pdf", huge_content, "application/pdf")}

    res = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {pro_token}"},
        files=files,
        data={"target_lang": "vi"},
    )
    assert res.status_code == 413
    assert "100MB" in res.json()["message"]


def test_ocr_page_limit_free_user_exceeding_100_pages(client, db_session, monkeypatch):
    """Free user with scanned PDF exceeding 100 pages receives 413."""
    _, free_token = create_user_with_role(db_session, "free_ocr@example.com", UserRole.FREE)

    files = {"file": ("scanned_101.pdf", b"%PDF-1.4 scanned", "application/pdf")}

    from app.api.process import pdf_service
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 101, "error": None})
    monkeypatch.setattr(pdf_service, "is_scanned_pdf", lambda path, *a, **kw: True)
    monkeypatch.setattr(pdf_service, "extract_text", lambda path, *a, **kw: "")

    res = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {free_token}"},
        files=files,
        data={"target_lang": "vi"},
    )
    assert res.status_code == 413
    assert "101 trang" in res.json()["message"]
    assert "100 trang" in res.json()["message"]


def test_ocr_page_limit_pro_user_allows_up_to_500_pages(client, db_session, monkeypatch):
    """Pro user with scanned PDF of 200 pages passes the 100-page Free ceiling."""
    _, pro_token = create_user_with_role(db_session, "pro_ocr@example.com", UserRole.PRO)

    files = {"file": ("scanned_200.pdf", b"%PDF-1.4 scanned", "application/pdf")}

    from app.api.process import ocr_service, pdf_service, translation_service
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 200, "error": None})
    monkeypatch.setattr(pdf_service, "is_scanned_pdf", lambda path, *a, **kw: True)
    monkeypatch.setattr(pdf_service, "extract_text", lambda path, *a, **kw: "")
    monkeypatch.setattr(ocr_service, "extract_text_from_scanned_pdf", lambda path, **kw: {
        "success": True,
        "text": "Recognized text from 200 scanned pages.",
    })
    monkeypatch.setattr(translation_service, "translate_text", lambda text, **kw: {
        "translated_text": "Bản dịch từ văn bản quét.",
        "engine_used": "mock",
    })

    res = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {pro_token}"},
        files=files,
        data={"target_lang": "vi"},
    )
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_ocr_page_limit_pro_user_exceeding_500_pages(client, db_session, monkeypatch):
    """Pro user with scanned PDF exceeding 500 pages (505 pages) receives 413."""
    _, pro_token = create_user_with_role(db_session, "pro_ocr_max@example.com", UserRole.PRO)

    files = {"file": ("scanned_505.pdf", b"%PDF-1.4 scanned", "application/pdf")}

    from app.api.process import pdf_service
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 505, "error": None})
    monkeypatch.setattr(pdf_service, "is_scanned_pdf", lambda path, *a, **kw: True)
    monkeypatch.setattr(pdf_service, "extract_text", lambda path, *a, **kw: "")

    res = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {pro_token}"},
        files=files,
        data={"target_lang": "vi"},
    )
    assert res.status_code == 413
    assert "505 trang" in res.json()["message"]
    assert "500 trang" in res.json()["message"]


def test_process_endpoint_invalid_token_rejects_without_downgrade(client):
    """upload-and-translate rejects invalid token with 401 instead of silent downgrade to Guest."""
    files = {"file": ("test.pdf", b"%PDF-1.4 content", "application/pdf")}
    res = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": "Bearer bad.token.here"},
        files=files,
        data={"target_lang": "vi"},
    )
    assert res.status_code == 401
    assert res.json()["error_code"] == "INVALID_TOKEN"


def test_retranslate_invalid_token_rejects_without_downgrade(client):
    """retranslate rejects invalid token with 401 instead of silent downgrade to Guest."""
    payload = {"text": "Hello world", "target_lang": "vi"}
    res = client.post(
        "/api/process/retranslate",
        headers={"Authorization": "Bearer bad.token.here"},
        json=payload,
    )
    assert res.status_code == 401
    assert res.json()["error_code"] == "INVALID_TOKEN"


def test_download_invalid_token_rejects_without_downgrade(client):
    """download rejects invalid token with 401 instead of silent downgrade to Guest."""
    payload = {"content": "Sample content", "format": "txt"}
    res = client.post(
        "/api/process/download",
        headers={"Authorization": "Bearer bad.token.here"},
        json=payload,
    )
    assert res.status_code == 401
    assert res.json()["error_code"] == "INVALID_TOKEN"


# ── 5. PDFL-157.4: Export API Permission & Anti-IDOR Tests ────────────────────

def test_download_guest_without_token_rejected_401(client):
    """Guest request without Authorization header to /api/process/download returns 401 NOT_AUTHENTICATED."""
    payload = {"content": "Sample content to export", "format": "txt"}
    res = client.post("/api/process/download", json=payload)
    assert res.status_code == 401
    assert res.json()["error_code"] == "NOT_AUTHENTICATED"


def test_download_expired_token_rejected_401(client):
    """Request with expired JWT token to /api/process/download returns 401 TOKEN_EXPIRED."""
    expired_token = create_access_token(subject=1, expires_delta=timedelta(seconds=-1))
    payload = {"content": "Sample content to export", "format": "txt"}
    res = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {expired_token}"},
        json=payload,
    )
    assert res.status_code == 401
    assert res.json()["error_code"] == "TOKEN_EXPIRED"


def test_download_inactive_account_rejected_403(client, db_session):
    """Inactive user account token to /api/process/download returns 403 ACCOUNT_INACTIVE."""
    _, inactive_token = create_user_with_role(
        db_session, "inactive_export@example.com", UserRole.FREE, is_active=False
    )
    payload = {"content": "Sample content to export", "format": "txt"}
    res = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {inactive_token}"},
        json=payload,
    )
    assert res.status_code == 403
    assert res.json()["error_code"] == "ACCOUNT_INACTIVE"


def test_download_free_user_success(client, db_session):
    """Active FREE user exports TXT successfully."""
    _, token = create_user_with_role(db_session, "free_export@example.com", UserRole.FREE)
    payload = {
        "content": "Nội dung văn bản cho tài khoản FREE.",
        "format": "txt",
        "export_type": "translated",
        "filename": "free_doc",
    }
    res = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert res.status_code == 200
    assert "free_doc_dich.txt" in res.headers.get("content-disposition", "")
    assert "Nội dung văn bản cho tài khoản FREE." in res.content.decode("utf-8-sig")


def test_download_pro_user_success(client, db_session):
    """Active PRO user exports PDF successfully."""
    _, token = create_user_with_role(db_session, "pro_export@example.com", UserRole.PRO)
    payload = {
        "content": "Nội dung văn bản cho tài khoản PRO.",
        "format": "pdf",
        "export_type": "summary",
        "filename": "pro_doc",
    }
    res = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert res.status_code == 200
    assert res.headers.get("content-type") == "application/pdf"
    assert res.content.startswith(b"%PDF")
    assert "pro_doc_tomtat.pdf" in res.headers.get("content-disposition", "")


def test_download_admin_user_success(client, db_session):
    """Active ADMIN user exports bilingual TXT successfully."""
    _, token = create_user_with_role(db_session, "admin_export@example.com", UserRole.ADMIN)
    payload = {
        "content": "Bản dịch song ngữ của Admin.",
        "original_content": "Original bilingual content of Admin.",
        "format": "txt",
        "export_type": "bilingual",
        "filename": "admin_doc",
    }
    res = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert res.status_code == 200
    assert "admin_doc_songngu.txt" in res.headers.get("content-disposition", "")
    decoded = res.content.decode("utf-8-sig")
    assert "Bản dịch song ngữ của Admin." in decoded
    assert "Original bilingual content of Admin." in decoded


# ── PDFL-254.1: DOCX Export RBAC Tests (Pro VIP Gate) ─────────────────────────

def test_download_docx_guest_without_token_rejected_403(client):
    """Guest (chưa đăng nhập, không có token) yêu cầu tải DOCX phải nhận HTTP 403 PRO_REQUIRED."""
    payload = {
        "content": "Nội dung export DOCX bởi Guest.",
        "format": "docx",
        "export_type": "translated",
    }
    res = client.post("/api/process/download", json=payload)
    assert res.status_code == 403
    assert res.json().get("error_code") == "PRO_REQUIRED"


def test_download_docx_free_user_rejected_403(client, db_session):
    """Tài khoản FREE đã đăng nhập yêu cầu tải DOCX phải nhận HTTP 403 PRO_REQUIRED."""
    _, token = create_user_with_role(db_session, "free_docx_test@example.com", UserRole.FREE)
    payload = {
        "content": "Nội dung export DOCX bởi Free user.",
        "format": "docx",
        "export_type": "translated",
    }
    res = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert res.status_code == 403
    assert res.json().get("error_code") == "PRO_REQUIRED"


def test_download_docx_pro_user_success(client, db_session):
    """Tài khoản PRO đã đăng nhập xuất DOCX thành công với HTTP 200."""
    _, token = create_user_with_role(db_session, "pro_docx_test@example.com", UserRole.PRO)
    payload = {
        "content": "Nội dung export DOCX bởi Pro VIP user.",
        "format": "docx",
        "export_type": "translated",
        "filename": "pro_vip_doc",
    }
    res = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in res.headers.get("content-type", "")
    assert "pro_vip_doc_dich.docx" in res.headers.get("content-disposition", "")


def test_download_docx_admin_user_success(client, db_session):
    """Tài khoản ADMIN đã đăng nhập xuất DOCX thành công với HTTP 200."""
    _, token = create_user_with_role(db_session, "admin_docx_test@example.com", UserRole.ADMIN)
    payload = {
        "content": "Nội dung export DOCX bởi Admin.",
        "format": "docx",
        "export_type": "translated",
        "filename": "admin_vip_doc",
    }
    res = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in res.headers.get("content-type", "")
    assert "admin_vip_doc_dich.docx" in res.headers.get("content-disposition", "")



def test_export_api_anti_idor_does_not_fetch_or_leak_document_by_id(client, db_session):
    """
    IDOR Security Verification for Export API (/api/process/download):
    - Export API generates files on-the-fly strictly from client request body.
    - Supplying another user's document_id without content is rejected with HTTP 400.
    - Supplying document_id with custom content only exports the client's content, never querying or leaking the target document.
    """
    owner, _ = create_user_with_role(db_session, "victim_owner@example.com", UserRole.FREE)
    attacker, attacker_token = create_user_with_role(db_session, "malicious_user@example.com", UserRole.FREE)

    victim_doc = Document(
        user_id=owner.id,
        original_filename="confidential_contract.pdf",
        stored_filename="stored_confidential.pdf",
        stored_path="victim/stored_confidential.pdf",
        file_size_bytes=2048,
        page_count=3,
        target_lang="vi",
    )
    db_session.add(victim_doc)
    db_session.commit()
    db_session.refresh(victim_doc)

    # 1. Attacker attempts to download victim's document by only passing victim document_id without content
    res_no_content = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {attacker_token}"},
        json={"document_id": victim_doc.id, "format": "txt", "export_type": "translated"},
    )
    assert res_no_content.status_code == 400
    msg = res_no_content.json().get("message") or res_no_content.json().get("detail", "")
    assert "không được để trống" in msg

    # 2. Attacker passes victim document_id along with custom content -> only custom content is exported
    res_with_content = client.post(
        "/api/process/download",
        headers={"Authorization": f"Bearer {attacker_token}"},
        json={
            "document_id": victim_doc.id,
            "content": "Attacker controlled payload text.",
            "format": "txt",
            "export_type": "translated",
            "filename": "exploit_attempt",
        },
    )
    assert res_with_content.status_code == 200
    exported_text = res_with_content.content.decode("utf-8-sig")
    assert "Attacker controlled payload text." in exported_text
    assert "confidential_contract" not in exported_text


def test_documents_download_anti_idor_and_admin_audit(client, db_session, tmp_path, monkeypatch):
    """
    Documents Download API Anti-IDOR test:
    - User B cannot download User A's document (returns 404 Not Found to prevent enumeration).
    - Owner can download their own document (returns 200 OK).
    - Admin has permission to download any document for administrative audit (returns 200 OK).
    """
    test_storage = StorageService(base_dir=tmp_path / "storage")
    monkeypatch.setattr("app.api.documents.storage_service", test_storage)

    user_a, token_a = create_user_with_role(db_session, "user_a_doc@example.com", UserRole.FREE)
    user_b, token_b = create_user_with_role(db_session, "user_b_doc@example.com", UserRole.FREE)
    admin_user, token_admin = create_user_with_role(db_session, "admin_doc_audit@example.com", UserRole.ADMIN)

    # Save physical file for User A
    stored_name_a, rel_path_a, _ = test_storage.save_document_file(
        user_id=user_a.id,
        original_filename="private_doc_a.pdf",
        content=b"%PDF-1.4 User A confidential data",
    )
    doc_a = Document(
        user_id=user_a.id,
        original_filename="private_doc_a.pdf",
        stored_filename=stored_name_a,
        stored_path=rel_path_a,
        file_size_bytes=32,
        page_count=1,
        target_lang="vi",
    )
    db_session.add(doc_a)
    db_session.commit()
    db_session.refresh(doc_a)

    # 1. User B (malicious/other user) tries to download User A's document -> 404 Not Found (Anti-IDOR)
    res_b = client.get(
        f"/api/documents/{doc_a.id}/download",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 404
    msg_b = res_b.json().get("message") or res_b.json().get("detail", "")
    assert "Tài liệu không tồn tại hoặc bạn không có quyền truy cập" in msg_b

    # 2. User A (owner) downloads their own document -> 200 OK
    res_a = client.get(
        f"/api/documents/{doc_a.id}/download",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_a.status_code == 200
    assert b"User A confidential data" in res_a.content

    # 3. Admin user downloads User A's document according to system policy -> 200 OK
    res_admin = client.get(
        f"/api/documents/{doc_a.id}/download",
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert res_admin.status_code == 200
    assert b"User A confidential data" in res_admin.content


# ── 6. PDFL-178.2 Synchronous Upload Page Limit Enforcement Tests ─────────────

def test_sync_page_limit_free_user_accepts_100_rejects_101(client, db_session, monkeypatch):
    """PDFL-178.2: Free user accepts 100 pages, rejects 101 pages with 413 and role/limit detail."""
    _, free_token = create_user_with_role(db_session, "free_p178@example.com", UserRole.FREE)
    from app.api.process import pdf_service, translation_service

    monkeypatch.setattr(translation_service, "translate_text", lambda text, **kw: {
        "translated_text": "Bản dịch 100 trang.",
        "engine_used": "mock",
    })

    # Case 1: 100 pages accepted
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 100, "error": None})
    monkeypatch.setattr(pdf_service, "is_scanned_pdf", lambda path, *a, **kw: False)
    monkeypatch.setattr(pdf_service, "extract_text", lambda path, *a, **kw: "Văn bản trang 1-100.")

    res_100 = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {free_token}"},
        files={"file": ("doc_100p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_100.status_code == 200
    assert res_100.json()["success"] is True

    # Case 2: 101 pages rejected
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 101, "error": None})
    res_101 = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {free_token}"},
        files={"file": ("doc_101p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_101.status_code == 413
    msg = res_101.json()["message"]
    assert "101 trang" in msg
    assert "100 trang" in msg
    assert "FREE" in msg


def test_sync_page_limit_pro_user_accepts_500_rejects_501(client, db_session, monkeypatch):
    """PDFL-178.2: Pro user accepts 500 pages, rejects 501 pages with 413 and role/limit detail."""
    _, pro_token = create_user_with_role(db_session, "pro_p178@example.com", UserRole.PRO)
    from app.api.process import pdf_service, translation_service

    monkeypatch.setattr(translation_service, "translate_text", lambda text, **kw: {
        "translated_text": "Bản dịch 500 trang.",
        "engine_used": "mock",
    })

    # Case 1: 500 pages accepted
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 500, "error": None})
    monkeypatch.setattr(pdf_service, "is_scanned_pdf", lambda path, *a, **kw: False)
    monkeypatch.setattr(pdf_service, "extract_text", lambda path, *a, **kw: "Văn bản trang 1-500.")

    res_500 = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {pro_token}"},
        files={"file": ("doc_500p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_500.status_code == 200
    assert res_500.json()["success"] is True

    # Case 2: 501 pages rejected
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 501, "error": None})
    res_501 = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {pro_token}"},
        files={"file": ("doc_501p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_501.status_code == 413
    msg = res_501.json()["message"]
    assert "501 trang" in msg
    assert "500 trang" in msg
    assert "PRO" in msg


def test_sync_page_limit_admin_user_accepts_500_rejects_501(client, db_session, monkeypatch):
    """PDFL-178.2: Admin user applies 500 pages limit (accepts 500, rejects 501)."""
    _, admin_token = create_user_with_role(db_session, "admin_p178@example.com", UserRole.ADMIN)
    from app.api.process import pdf_service, translation_service

    monkeypatch.setattr(translation_service, "translate_text", lambda text, **kw: {
        "translated_text": "Bản dịch Admin 500 trang.",
        "engine_used": "mock",
    })

    # Case 1: 500 pages accepted
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 500, "error": None})
    monkeypatch.setattr(pdf_service, "is_scanned_pdf", lambda path, *a, **kw: False)
    monkeypatch.setattr(pdf_service, "extract_text", lambda path, *a, **kw: "Văn bản Admin trang 1-500.")

    res_500 = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("doc_admin_500p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_500.status_code == 200
    assert res_500.json()["success"] is True

    # Case 2: 501 pages rejected
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 501, "error": None})
    res_501 = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("doc_admin_501p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_501.status_code == 413
    msg = res_501.json()["message"]
    assert "501 trang" in msg
    assert "500 trang" in msg
    assert "ADMIN" in msg


def test_sync_page_limit_guest_user_accepts_100_rejects_101(client, monkeypatch):
    """PDFL-178.2: Guest user applies 100 pages limit (accepts 100, rejects 101 with 413)."""
    from app.api.process import pdf_service, translation_service

    monkeypatch.setattr(translation_service, "translate_text", lambda text, **kw: {
        "translated_text": "Bản dịch Guest 100 trang.",
        "engine_used": "mock",
    })

    # Case 1: 100 pages accepted
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 100, "error": None})
    monkeypatch.setattr(pdf_service, "is_scanned_pdf", lambda path, *a, **kw: False)
    monkeypatch.setattr(pdf_service, "extract_text", lambda path, *a, **kw: "Văn bản Guest 100 trang.")

    res_100 = client.post(
        "/api/process/upload-and-translate",
        files={"file": ("doc_guest_100p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_100.status_code == 200
    assert res_100.json()["success"] is True

    # Case 2: 101 pages rejected with 413
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 101, "error": None})
    res_101 = client.post(
        "/api/process/upload-and-translate",
        files={"file": ("doc_guest_101p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_101.status_code == 413
    msg = res_101.json()["message"]
    assert "101 trang" in msg
    assert "100 trang" in msg
    assert "Guest" in msg


def test_sync_page_limit_does_not_call_ocr_or_translation_on_excess(client, db_session, monkeypatch):
    """PDFL-178.2: Ensure OCR and Translation services are never invoked when page limit is exceeded."""
    _, free_token = create_user_with_role(db_session, "no_ocr_trans@example.com", UserRole.FREE)
    from app.api.process import ocr_service, pdf_service, translation_service

    def forbidden_call(*args, **kwargs):
        raise AssertionError("OCR or Translation service was unexpectedly called despite exceeding page limit!")

    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 150, "error": None})
    monkeypatch.setattr(ocr_service, "extract_text_from_scanned_pdf", forbidden_call)
    monkeypatch.setattr(translation_service, "translate_text", forbidden_call)

    res = client.post(
        "/api/process/upload-and-translate",
        headers={"Authorization": f"Bearer {free_token}"},
        files={"file": ("doc_150p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res.status_code == 413
    assert "150 trang" in res.json()["message"]
    assert "100 trang" in res.json()["message"]


# ── 6. PDFL-178.3 Background Job Page Limit Enforcement Tests ─────────────────

def test_job_page_limit_free_user_accepts_100_rejects_101(client, db_session, monkeypatch):
    """PDFL-178.3: Free user job creation accepts 100 pages (202), rejects 101 pages (413)."""
    _, free_token = create_user_with_role(db_session, "free_job@example.com", UserRole.FREE)
    from app.api.process import pdf_service
    from app.services.job_service import job_manager

    initial_job_count = len(job_manager._jobs)

    # Case 1: 100 pages accepted -> Job created (202)
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 100, "error": None})
    res_100 = client.post(
        "/api/process/jobs",
        headers={"Authorization": f"Bearer {free_token}"},
        files={"file": ("job_100p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_100.status_code == 202
    assert res_100.json()["success"] is True
    assert "job_id" in res_100.json()["data"]

    # Case 2: 101 pages rejected -> 413, no Job created
    current_job_count = len(job_manager._jobs)
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 101, "error": None})
    res_101 = client.post(
        "/api/process/jobs",
        headers={"Authorization": f"Bearer {free_token}"},
        files={"file": ("job_101p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_101.status_code == 413
    msg = res_101.json()["message"]
    assert "101 trang" in msg
    assert "100 trang" in msg
    assert "FREE" in msg
    # Verify no new job was created
    assert len(job_manager._jobs) == current_job_count


def test_job_page_limit_pro_user_accepts_500_rejects_501(client, db_session, monkeypatch):
    """PDFL-178.3: Pro user job creation accepts 500 pages (202), rejects 501 pages (413)."""
    _, pro_token = create_user_with_role(db_session, "pro_job@example.com", UserRole.PRO)
    from app.api.process import pdf_service
    from app.services.job_service import job_manager

    # Case 1: 500 pages accepted
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 500, "error": None})
    res_500 = client.post(
        "/api/process/jobs",
        headers={"Authorization": f"Bearer {pro_token}"},
        files={"file": ("job_500p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_500.status_code == 202
    assert res_500.json()["success"] is True

    # Case 2: 501 pages rejected
    current_job_count = len(job_manager._jobs)
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 501, "error": None})
    res_501 = client.post(
        "/api/process/jobs",
        headers={"Authorization": f"Bearer {pro_token}"},
        files={"file": ("job_501p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_501.status_code == 413
    msg = res_501.json()["message"]
    assert "501 trang" in msg
    assert "500 trang" in msg
    assert "PRO" in msg
    assert len(job_manager._jobs) == current_job_count


def test_job_page_limit_admin_user_accepts_500_rejects_501(client, db_session, monkeypatch):
    """PDFL-178.3: Admin user job creation applies 500 pages limit (202 vs 413)."""
    _, admin_token = create_user_with_role(db_session, "admin_job@example.com", UserRole.ADMIN)
    from app.api.process import pdf_service
    from app.services.job_service import job_manager

    # Case 1: 500 pages accepted
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 500, "error": None})
    res_500 = client.post(
        "/api/process/jobs",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("job_admin_500p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_500.status_code == 202
    assert res_500.json()["success"] is True

    # Case 2: 501 pages rejected
    current_job_count = len(job_manager._jobs)
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 501, "error": None})
    res_501 = client.post(
        "/api/process/jobs",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("job_admin_501p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_501.status_code == 413
    msg = res_501.json()["message"]
    assert "501 trang" in msg
    assert "500 trang" in msg
    assert "ADMIN" in msg
    assert len(job_manager._jobs) == current_job_count


def test_job_page_limit_guest_user_accepts_100_rejects_101(client, monkeypatch):
    """PDFL-178.3: Guest user job creation applies 100 pages limit (202 vs 413)."""
    from app.api.process import pdf_service
    from app.services.job_service import job_manager

    # Case 1: 100 pages accepted
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 100, "error": None})
    res_100 = client.post(
        "/api/process/jobs",
        files={"file": ("job_guest_100p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_100.status_code == 202
    assert res_100.json()["success"] is True

    # Case 2: 101 pages rejected
    current_job_count = len(job_manager._jobs)
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 101, "error": None})
    res_101 = client.post(
        "/api/process/jobs",
        files={"file": ("job_guest_101p.pdf", b"%PDF-1.4 content", "application/pdf")},
        data={"target_lang": "vi"},
    )
    assert res_101.status_code == 413
    msg = res_101.json()["message"]
    assert "101 trang" in msg
    assert "100 trang" in msg
    assert "Guest" in msg
    assert len(job_manager._jobs) == current_job_count


def test_job_worker_second_layer_check_aborts_excess_pages(tmp_path, monkeypatch):
    """PDFL-178.3: Background worker second layer validation fails job and prevents OCR/translation."""
    from app.api.process import _execute_pdf_background_job, ocr_service, pdf_service, translation_service
    from app.services.job_service import JobStatus, job_manager

    fake_pdf = tmp_path / "leak_test.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4 mock content")

    job = job_manager.create_job(filename="leak_test.pdf", target_lang="vi")

    def forbidden_call(*args, **kwargs):
        raise AssertionError("Worker called OCR/Translation despite second-layer page limit check!")

    # Worker detects 150 pages while max_allowed_pages is 100
    monkeypatch.setattr(pdf_service, "validate_pdf", lambda path, *a, **kw: {"is_valid": True, "page_count": 150, "error": None})
    monkeypatch.setattr(ocr_service, "extract_text_from_scanned_pdf", forbidden_call)
    monkeypatch.setattr(translation_service, "translate_text", forbidden_call)

    _execute_pdf_background_job(
        job_id=job.job_id,
        tmp_path=fake_pdf,
        filename="leak_test.pdf",
        target_lang="vi",
        max_allowed_pages=100,
        file_size_mb=1.0,
    )

    updated_job = job_manager.get_job(job.job_id)
    assert updated_job is not None
    assert updated_job.status == JobStatus.FAILED
    assert "150 trang" in (updated_job.error or "")
    assert "100 trang" in (updated_job.error or "")

