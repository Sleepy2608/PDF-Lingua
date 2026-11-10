"""
Pytest Configuration & Global Test Fixtures (PDFL-185.1)
---------------------------------------------------------
Exposes reusable fixtures across backend test suites for:
- Database: in-memory SQLite session with foreign key constraints.
- Storage: isolated temporary filesystem storage service.
- Client: TestClient with dependency overrides.
- Authentication: Guest (None), FREE, PRO, ADMIN, and multi-tenant user pairs.
- PDF Binaries: valid custom-page PDFs, empty, corrupted, encrypted, and fake PDFs.
"""

from pathlib import Path
from typing import Callable, Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.core.dependencies import get_db
from app.main import app
from app.models.user import UserRole
from app.services.storage_service import StorageService
from tests.security_fixtures import (
    AuthUserFixture,
    create_corrupted_pdf_bytes,
    create_custom_page_pdf_bytes,
    create_empty_pdf_bytes,
    create_fake_pdf_bytes,
    create_password_protected_pdf_bytes,
    create_test_user_with_role,
)


# ── Database & Storage Fixtures ──────────────────────────────────────────────

@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Provides a clean, isolated in-memory SQLite session with foreign keys enabled."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_storage_dir(tmp_path: Path) -> Path:
    """Isolated temporary directory for filesystem storage during tests."""
    storage_path = tmp_path / "test_storage"
    storage_path.mkdir(parents=True, exist_ok=True)
    return storage_path


@pytest.fixture(scope="function")
def test_storage_service(test_storage_dir: Path, monkeypatch) -> StorageService:
    """Configures StorageService pointing to the isolated test directory."""
    service = StorageService(base_dir=test_storage_dir)
    monkeypatch.setattr("app.api.documents.storage_service", service)
    monkeypatch.setattr("app.services.history_service.HistoryService.storage_service", service)
    monkeypatch.setattr("app.services.history_service.history_service.storage_service", service)
    return service


@pytest.fixture(scope="function")
def security_client(
    db_session: Session,
    test_storage_service: StorageService,
) -> Generator[TestClient, None, None]:
    """TestClient overriding get_db and isolated storage for secure testing."""
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
    app.dependency_overrides.clear()


# ── Authentication & Role Fixtures ───────────────────────────────────────────

@pytest.fixture(scope="function")
def guest_user() -> None:
    """Represents an unauthenticated Guest caller (None)."""
    return None


@pytest.fixture(scope="function")
def free_user(db_session: Session) -> AuthUserFixture:
    """User with FREE role (100 pages, 20MB limit)."""
    return create_test_user_with_role(
        db=db_session,
        email="free_user@example.com",
        role=UserRole.FREE,
        full_name="Free Tier User",
    )


@pytest.fixture(scope="function")
def pro_user(db_session: Session) -> AuthUserFixture:
    """User with PRO role (500 pages, 100MB limit)."""
    return create_test_user_with_role(
        db=db_session,
        email="pro_user@example.com",
        role=UserRole.PRO,
        full_name="Pro Tier User",
    )


@pytest.fixture(scope="function")
def admin_user(db_session: Session) -> AuthUserFixture:
    """User with ADMIN role (500 pages, 100MB limit, system-wide access)."""
    return create_test_user_with_role(
        db=db_session,
        email="admin_user@example.com",
        role=UserRole.ADMIN,
        full_name="Administrator User",
    )


@pytest.fixture(scope="function")
def tenant_users(db_session: Session) -> tuple[AuthUserFixture, AuthUserFixture]:
    """
    Two distinct users in different roles/tenants for testing isolation and Anti-IDOR.
    Returns: (user_tenant_1, user_tenant_2)
    """
    tenant_1 = create_test_user_with_role(
        db=db_session,
        email="tenant_1@example.com",
        role=UserRole.FREE,
        full_name="Tenant 1 (Free)",
    )
    tenant_2 = create_test_user_with_role(
        db=db_session,
        email="tenant_2@example.com",
        role=UserRole.PRO,
        full_name="Tenant 2 (Pro)",
    )
    return tenant_1, tenant_2


# ── PDF Binary Fixtures ──────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def pdf_factory() -> Callable[[int, str], bytes]:
    """Factory fixture returning a callable to create custom-page PDF bytes."""
    return create_custom_page_pdf_bytes


@pytest.fixture(scope="session")
def valid_1p_pdf() -> bytes:
    """Standard 1-page valid PDF."""
    return create_custom_page_pdf_bytes(1)


@pytest.fixture(scope="session")
def valid_100p_pdf() -> bytes:
    """Exactly 100-page valid PDF (boundary limit for Guest and FREE)."""
    return create_custom_page_pdf_bytes(100)


@pytest.fixture(scope="session")
def valid_101p_pdf() -> bytes:
    """101-page valid PDF (boundary violation for Guest and FREE)."""
    return create_custom_page_pdf_bytes(101)


@pytest.fixture(scope="session")
def valid_500p_pdf() -> bytes:
    """Exactly 500-page valid PDF (boundary limit for PRO and ADMIN)."""
    return create_custom_page_pdf_bytes(500)


@pytest.fixture(scope="session")
def valid_501p_pdf() -> bytes:
    """501-page valid PDF (boundary violation for PRO and ADMIN)."""
    return create_custom_page_pdf_bytes(501)


@pytest.fixture(scope="session")
def empty_pdf() -> bytes:
    """0-byte empty file."""
    return create_empty_pdf_bytes()


@pytest.fixture(scope="session")
def corrupted_pdf() -> bytes:
    """Corrupted PDF bytes with valid magic bytes but malformed catalog/trailer."""
    return create_corrupted_pdf_bytes()


@pytest.fixture(scope="session")
def password_pdf() -> bytes:
    """Password-encrypted PDF bytes."""
    return create_password_protected_pdf_bytes("SecuredPassword123", page_count=1)


@pytest.fixture(scope="session")
def fake_pdf_txt() -> bytes:
    """Plain text content disguised with a .pdf extension."""
    return create_fake_pdf_bytes("txt")


@pytest.fixture(scope="session")
def fake_pdf_exe() -> bytes:
    """Executable content (MZ header) disguised with a .pdf extension."""
    return create_fake_pdf_bytes("exe")

