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
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base
from app.core.dependencies import get_current_user, get_db, get_optional_current_user, require_roles
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User, UserRole
from app.api.process import get_user_limits

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
