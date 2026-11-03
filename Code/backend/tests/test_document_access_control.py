"""
Access Control, Multi-Tenant Isolation & Anti-IDOR Tests (PDFL-95, PDFL-98)
----------------------------------------------------------------------------
Verifies:
- Document endpoints require authentication (401 for guests).
- Users can view and download their own documents (200 OK).
- Users cannot access documents belonging to other users (404 Not Found).
- Admins can access documents across users for support/audit purposes.
- Physical file missing on disk gracefully returns 404 Not Found.
- Listing documents strictly isolates data per user.
"""

from pathlib import Path

import pytest
from app.core.database import Base
from app.core.dependencies import get_current_user, get_db
from app.main import app
from app.models.document import Document
from app.models.user import User, UserRole
from app.services.storage_service import StorageService
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

client = TestClient(app)


@pytest.fixture
def access_control_env(tmp_path: Path, monkeypatch):
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)

    test_storage_service = StorageService(base_dir=storage_dir)
    monkeypatch.setattr("app.api.documents.storage_service", test_storage_service)

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
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    session = TestingSessionLocal()

    # User A (Regular Free user)
    user_a = User(email="user_a@example.com", hashed_password="pw_a", role=UserRole.FREE)
    # User B (Regular Pro user)
    user_b = User(email="user_b@example.com", hashed_password="pw_b", role=UserRole.PRO)
    # Admin
    admin_user = User(email="admin@example.com", hashed_password="pw_admin", role=UserRole.ADMIN)

    session.add_all([user_a, user_b, admin_user])
    session.commit()
    session.refresh(user_a)
    session.refresh(user_b)
    session.refresh(admin_user)

    # Save a physical file for User A
    stored_name_a, rel_path_a, _ = test_storage_service.save_document_file(
        user_id=user_a.id,
        original_filename="Tài liệu bí mật của A.pdf",
        content=b"%PDF-1.4 User A confidential document content",
    )

    doc_a = Document(
        user_id=user_a.id,
        original_filename="Tài liệu bí mật của A.pdf",
        stored_filename=stored_name_a,
        stored_path=rel_path_a,
        file_size_bytes=42,
        page_count=2,
        target_lang="vi",
    )

    # Save a physical file for User B
    stored_name_b, rel_path_b, _ = test_storage_service.save_document_file(
        user_id=user_b.id,
        original_filename="Tài liệu của B.pdf",
        content=b"%PDF-1.4 User B public paper",
    )

    doc_b = Document(
        user_id=user_b.id,
        original_filename="Tài liệu của B.pdf",
        stored_filename=stored_name_b,
        stored_path=rel_path_b,
        file_size_bytes=30,
        page_count=1,
        target_lang="en",
    )

    session.add_all([doc_a, doc_b])
    session.commit()
    session.refresh(doc_a)
    session.refresh(doc_b)

    yield {
        "session": session,
        "user_a": user_a,
        "user_b": user_b,
        "admin": admin_user,
        "doc_a": doc_a,
        "doc_b": doc_b,
        "storage": test_storage_service,
    }

    app.dependency_overrides.clear()
    session.close()
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# PDFL-95 & PDFL-98 Tests
# ---------------------------------------------------------------------------

def test_pdfl_95_download_unauthenticated_returns_401():
    """Unauthenticated users cannot download documents."""
    app.dependency_overrides.pop(get_current_user, None)
    res = client.get("/api/documents/1/download")
    assert res.status_code == 401


def test_pdfl_95_download_owner_success(access_control_env):
    """Document owner can successfully download their file."""
    env = access_control_env
    app.dependency_overrides[get_current_user] = lambda: env["user_a"]

    res = client.get(f"/api/documents/{env['doc_a'].id}/download")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert b"User A confidential document content" in res.content


def test_pdfl_98_download_other_user_document_returns_404(access_control_env):
    """User B cannot access or download User A's document (Anti-IDOR)."""
    env = access_control_env
    # Authenticate as User B
    app.dependency_overrides[get_current_user] = lambda: env["user_b"]

    # Try downloading User A's document
    res = client.get(f"/api/documents/{env['doc_a'].id}/download")
    assert res.status_code == 404
    data = res.json()
    msg = data.get("message") or data.get("detail", "")
    assert "Tài liệu không tồn tại hoặc bạn không có quyền truy cập" in msg


def test_pdfl_95_admin_can_download_any_document(access_control_env):
    """Admin has elevated privileges to access documents for audit."""
    env = access_control_env
    app.dependency_overrides[get_current_user] = lambda: env["admin"]

    res = client.get(f"/api/documents/{env['doc_a'].id}/download")
    assert res.status_code == 200
    assert b"User A confidential document content" in res.content


def test_pdfl_95_download_missing_physical_file_returns_404(access_control_env):
    """If database record exists but physical file was deleted from disk, returns 404."""
    env = access_control_env
    app.dependency_overrides[get_current_user] = lambda: env["user_a"]

    # Delete physical file
    env["storage"].delete_document_file(env["user_a"].id, env["doc_a"].stored_filename)

    res = client.get(f"/api/documents/{env['doc_a'].id}/download")
    assert res.status_code == 404
    data = res.json()
    msg = data.get("message") or data.get("detail", "")
    assert "Tệp tin vật lý không tồn tại" in msg


def test_pdfl_98_get_details_anti_idor(access_control_env):
    """User B cannot view details of User A's document."""
    env = access_control_env
    app.dependency_overrides[get_current_user] = lambda: env["user_b"]

    res = client.get(f"/api/documents/{env['doc_a'].id}")
    assert res.status_code == 404


def test_pdfl_98_list_documents_tenant_isolation(access_control_env):
    """Listing documents strictly returns only documents owned by caller."""
    env = access_control_env

    # User A listing: only doc_a
    app.dependency_overrides[get_current_user] = lambda: env["user_a"]
    res_a = client.get("/api/documents")
    assert res_a.status_code == 200
    docs_a = res_a.json()["data"]
    assert len(docs_a) == 1
    assert docs_a[0]["id"] == env["doc_a"].id

    # User B listing: only doc_b
    app.dependency_overrides[get_current_user] = lambda: env["user_b"]
    res_b = client.get("/api/documents")
    assert res_b.status_code == 200
    docs_b = res_b.json()["data"]
    assert len(docs_b) == 1
    assert docs_b[0]["id"] == env["doc_b"].id

    # Admin listing: sees both
    app.dependency_overrides[get_current_user] = lambda: env["admin"]
    res_admin = client.get("/api/documents")
    assert res_admin.status_code == 200
    docs_admin = res_admin.json()["data"]
    assert len(docs_admin) == 2

