"""
Unit & Integration Tests for StorageService & Upload Persistence (PDFL-90, PDFL-91)
-----------------------------------------------------------------------------------
Verifies:
- File sanitization and path traversal prevention.
- User-isolated folder creation and binary file persistence.
- Safe retrieval and deletion of stored documents.
- Authenticated upload saves physical file and creates Document record.
- Guest upload does not persist file or database record.
"""

import io
from pathlib import Path

import pytest
from app.core.database import Base
from app.core.dependencies import get_db, get_optional_current_user
from app.main import app
from app.models.document import Document
from app.models.user import User, UserRole
from app.services.storage_service import StorageService
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

client = TestClient(app)


def create_sample_pdf_bytes(text: str = "Tài liệu kiểm thử lưu trữ.") -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(100, 700, text)
    c.save()
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Unit Tests for StorageService
# ---------------------------------------------------------------------------

def test_pdfl_90_storage_service_sanitize_filename(tmp_path: Path):
    service = StorageService(base_dir=tmp_path)

    # Standard clean name
    assert service.sanitize_filename("document.pdf") == "document.pdf"

    # Missing .pdf extension
    assert service.sanitize_filename("my_document") == "my_document.pdf"

    # Path traversal attempts
    traversal1 = service.sanitize_filename("../../etc/passwd.pdf")
    assert ".." not in traversal1
    assert "/" not in traversal1
    assert "\\" not in traversal1

    traversal2 = service.sanitize_filename("..\\..\\windows\\system32.pdf")
    assert ".." not in traversal2
    assert "\\" not in traversal2

    # Dangerous characters: < > : " / \ | ? *
    dangerous = service.sanitize_filename('bad<file>:name"test|here?.pdf')
    for ch in '<>:"/\\|?*':
        assert ch not in dangerous

    # Vietnamese / Unicode characters preserved
    vn_name = service.sanitize_filename("Báo cáo tài chính năm 2026.pdf")
    assert "Báo cáo tài chính năm 2026.pdf" in vn_name

    # Empty string fallback
    assert service.sanitize_filename("") == "document.pdf"
    assert service.sanitize_filename("   ") == "document.pdf"


def test_pdfl_90_storage_service_save_and_retrieve_file(tmp_path: Path):
    service = StorageService(base_dir=tmp_path)
    user_id = 42
    content = b"%PDF-1.4 Mock binary content for test."

    # Save document
    stored_name, rel_path, abs_path = service.save_document_file(
        user_id=user_id,
        original_filename="research_paper.pdf",
        content=content,
    )

    assert abs_path.exists()
    assert abs_path.read_bytes() == content
    assert f"{user_id}" in rel_path
    assert stored_name in rel_path

    # Retrieve valid path
    retrieved = service.get_document_path(user_id=user_id, stored_filename=stored_name)
    assert retrieved is not None
    assert retrieved == abs_path

    # Traversal attempt via retrieval
    escaped = service.get_document_path(user_id=user_id, stored_filename="../other/file.pdf")
    assert escaped is None

    # Non-existent file
    missing = service.get_document_path(user_id=user_id, stored_filename="does_not_exist.pdf")
    assert missing is None


def test_pdfl_90_storage_service_delete_file(tmp_path: Path):
    service = StorageService(base_dir=tmp_path)
    user_id = 99
    content = b"%PDF-1.4 Temp file to delete"

    stored_name, _, abs_path = service.save_document_file(
        user_id=user_id,
        original_filename="delete_me.pdf",
        content=content,
    )
    assert abs_path.exists()

    # Delete existing
    assert service.delete_document_file(user_id=user_id, stored_filename=stored_name) is True
    assert not abs_path.exists()

    # Delete non-existing
    assert service.delete_document_file(user_id=user_id, stored_filename=stored_name) is False


# ---------------------------------------------------------------------------
# Integration Tests for Upload & Document Persistence (PDFL-90, PDFL-91)
# ---------------------------------------------------------------------------

@pytest.fixture
def isolated_db_and_storage(tmp_path: Path, monkeypatch):
    """Sets up an isolated in-memory DB and storage dir for upload integration."""
    storage_dir = tmp_path / "test_storage"
    storage_dir.mkdir(parents=True, exist_ok=True)

    test_storage_service = StorageService(base_dir=storage_dir)
    monkeypatch.setattr("app.api.process.storage_service", test_storage_service)

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
    monkeypatch.setattr("app.api.process.SessionLocal", TestingSessionLocal)

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    session = TestingSessionLocal()
    user = User(
        email="testuser@example.com",
        hashed_password="hashed_password_123",
        role=UserRole.FREE,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    yield session, user, test_storage_service

    app.dependency_overrides.clear()
    session.close()
    Base.metadata.drop_all(bind=engine)


def test_pdfl_90_and_91_authenticated_upload_persists_file_and_db(isolated_db_and_storage):
    db_session, user, storage_svc = isolated_db_and_storage

    # Authenticate as test user
    app.dependency_overrides[get_optional_current_user] = lambda: user

    pdf_bytes = create_sample_pdf_bytes("Hello from authenticated user!")
    files = {"file": ("report_q4.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi"}

    res = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert res.status_code == 200

    body = res.json()
    assert body["success"] is True
    doc_data = body["data"]

    # Verify document_id is present
    doc_id = doc_data.get("document_id")
    assert doc_id is not None
    assert isinstance(doc_id, int)

    # Verify database record exists
    db_doc = db_session.query(Document).filter(Document.id == doc_id).first()
    assert db_doc is not None
    assert db_doc.user_id == user.id
    assert db_doc.original_filename == "report_q4.pdf"
    assert db_doc.file_size_bytes == len(pdf_bytes)
    assert db_doc.page_count == 1
    assert db_doc.target_lang == "vi"

    # Verify physical file exists on disk inside user's directory
    saved_file_path = storage_svc.get_document_path(user.id, db_doc.stored_filename)
    assert saved_file_path is not None
    assert saved_file_path.exists()
    assert saved_file_path.read_bytes() == pdf_bytes


def test_pdfl_90_and_91_guest_upload_does_not_persist(isolated_db_and_storage):
    db_session, _, storage_svc = isolated_db_and_storage

    # Unauthenticated / guest user
    app.dependency_overrides[get_optional_current_user] = lambda: None

    pdf_bytes = create_sample_pdf_bytes("Hello from guest visitor!")
    files = {"file": ("guest_doc.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "vi"}

    res = client.post("/api/process/upload-and-translate", files=files, data=data)
    assert res.status_code == 200

    body = res.json()
    assert body["success"] is True
    doc_data = body["data"]

    # document_id must be None for guests
    assert doc_data.get("document_id") is None

    # Database must have NO document records
    assert db_session.query(Document).count() == 0


def test_background_job_authenticated_upload_persists_file_and_db(isolated_db_and_storage):
    """
    Verifies that uploading via POST /api/process/jobs (used by the Frontend Workspace)
    for an authenticated user also persists the physical PDF file and creates a Document
    record in the database so it immediately appears in GET /api/documents.
    """
    import time

    db_session, user, storage_svc = isolated_db_and_storage
    app.dependency_overrides[get_optional_current_user] = lambda: user

    pdf_bytes = create_sample_pdf_bytes("Hello from background job upload!")
    files = {"file": ("complex_tables_and_symbols.pdf", pdf_bytes, "application/pdf")}
    data = {"target_lang": "zh"}

    res = client.post("/api/process/jobs", files=files, data=data)
    assert res.status_code == 202

    job_id = res.json()["data"]["job_id"]
    assert job_id is not None

    # Wait for background worker thread to finish processing
    completed_job = None
    for _ in range(50):
        status_res = client.get(f"/api/process/jobs/{job_id}")
        assert status_res.status_code == 200
        job_data = status_res.json()["data"]
        if job_data["status"] in ("COMPLETED", "FAILED"):
            completed_job = job_data
            break
        time.sleep(0.1)

    assert completed_job is not None
    assert completed_job["status"] == "COMPLETED"
    result_payload = completed_job["result"]
    assert result_payload is not None

    doc_id = result_payload.get("document_id")
    assert doc_id is not None

    # Verify DB record was created for the authenticated user
    db_session.expire_all()
    db_doc = db_session.query(Document).filter(Document.id == doc_id).first()
    assert db_doc is not None
    assert db_doc.user_id == user.id
    assert db_doc.original_filename == "complex_tables_and_symbols.pdf"
    assert db_doc.file_size_bytes == len(pdf_bytes)
    assert db_doc.target_lang == "zh"

    # Verify physical file exists in storage
    saved_path = storage_svc.get_document_path(user.id, db_doc.stored_filename)
    assert saved_path is not None
    assert saved_path.is_file()
    assert saved_path.read_bytes() == pdf_bytes


# ---------------------------------------------------------------------------
# PDFL-214.2: Filename Sanitization & Path Traversal Protection Tests
# ---------------------------------------------------------------------------

def test_pdfl_214_2_sanitize_filename_encoded_and_special_cases(tmp_path: Path):
    service = StorageService(base_dir=tmp_path)

    # 1. URL-encoded and double-encoded path traversal
    encoded1 = service.sanitize_filename("..%2f..%2fetc%2fpasswd.pdf")
    assert ".." not in encoded1
    assert "/" not in encoded1
    assert "\\" not in encoded1
    assert "passwd.pdf" in encoded1

    double_encoded = service.sanitize_filename("%252e%252e%252f%252e%252e%252fwindows%252fsystem32.pdf")
    assert ".." not in double_encoded
    assert "/" not in double_encoded
    assert "\\" not in double_encoded
    assert "system32.pdf" in double_encoded

    win_encoded = service.sanitize_filename("..%5c..%5cboot.ini.pdf")
    assert ".." not in win_encoded
    assert "\\" not in win_encoded

    # 2. Absolute paths (POSIX & Windows)
    posix_abs = service.sanitize_filename("/var/log/nginx/access.log.pdf")
    assert not posix_abs.startswith("/")
    assert "access.log.pdf" in posix_abs

    win_abs = service.sanitize_filename("C:\\Windows\\System32\\drivers\\etc\\hosts.pdf")
    assert "C:" not in win_abs
    assert "\\" not in win_abs
    assert "hosts.pdf" in win_abs

    # 3. Unicode normalization and unusual characters (RTL override, zero-width space)
    rtl_override = service.sanitize_filename("test\u202e_spoofed.pdf")
    assert "\u202e" not in rtl_override

    zero_width = service.sanitize_filename("clean\u200b\ufeff_name.pdf")
    assert "\u200b" not in zero_width
    assert "\ufeff" not in zero_width

    # Valid Vietnamese Unicode preserved
    vietnamese = service.sanitize_filename("Báo Cáo Tài Chính Quý 1 - Năm 2026.pdf")
    assert "Báo Cáo Tài Chính Quý 1 - Năm 2026.pdf" in vietnamese

    # 4. Windows reserved device names (CON, PRN, AUX, NUL, COM1, LPT1)
    con_name = service.sanitize_filename("CON.pdf")
    assert con_name == "safe_CON.pdf"

    nul_name = service.sanitize_filename("NUL.pdf")
    assert nul_name == "safe_NUL.pdf"

    prn_name = service.sanitize_filename("prn.pdf")
    assert "safe_" in prn_name

    # 5. Null bytes and control characters
    null_byte = service.sanitize_filename("doc\x00evil.pdf")
    assert "\x00" not in null_byte
    assert "docevil.pdf" in null_byte

    ctrl_char = service.sanitize_filename("doc\n\r\tname.pdf")
    assert "\n" not in ctrl_char
    assert "\r" not in ctrl_char
    assert "\t" not in ctrl_char


def test_pdfl_214_2_path_traversal_read_write_delete_isolation(tmp_path: Path):
    storage_root = tmp_path / "storage"
    outside_dir = tmp_path / "outside"
    storage_root.mkdir(parents=True, exist_ok=True)
    outside_dir.mkdir(parents=True, exist_ok=True)

    # Place a secret file outside the storage root
    secret_file = outside_dir / "secret.txt"
    secret_file.write_text("SENSITIVE_SECRET_DATA", encoding="utf-8")

    service = StorageService(base_dir=storage_root)
    user_id = 101

    # Save a legitimate file
    stored_name, _, abs_path = service.save_document_file(
        user_id=user_id,
        original_filename="user101_file.pdf",
        content=b"%PDF-1.4 User 101 content",
    )
    assert abs_path.is_file()
    assert abs_path.is_relative_to(storage_root)

    # 1. Attempt Path Traversal via get_document_path
    traversal_candidates = [
        "../../outside/secret.txt",
        "..\\..\\outside\\secret.txt",
        "..%2f..%2foutside%2fsecret.txt",
        "%2e%2e%2f%2e%2e%2foutside%2fsecret.txt",
        str(secret_file),  # Absolute path to secret file
        "/etc/passwd",
        "C:\\Windows\\win.ini",
        "doc\x00../../secret.txt",
    ]

    for attack_path in traversal_candidates:
        res = service.get_document_path(user_id=user_id, stored_filename=attack_path)
        assert res is None, f"Expected None for traversal path '{attack_path}' but got '{res}'"

    # 2. Attempt Path Traversal via delete_document_file
    for attack_path in traversal_candidates:
        del_res = service.delete_document_file(user_id=user_id, stored_filename=attack_path)
        assert del_res is False
        assert secret_file.exists()  # Ensure external file was NOT deleted!

    # 3. Invalid or malicious user_id cannot escape storage directory
    invalid_user_ids = ["../admin", -1, 0, "admin"]
    for bad_uid in invalid_user_ids:
        assert service.get_document_path(user_id=bad_uid, stored_filename=stored_name) is None

    # 4. Result file path traversal prevention
    result_traversals = [
        "../../secret.txt",
        "..%2f..%2fsecret.txt",
        str(secret_file),
        "/etc/passwd",
    ]
    for res_attack in result_traversals:
        assert service.get_result_path(user_id=user_id, result_path_or_filename=res_attack) is None
        assert service.read_result_file(user_id=user_id, result_path_or_filename=res_attack) is None
        assert service.delete_result_file(user_id=user_id, result_path_or_filename=res_attack) is False
        assert secret_file.exists()

    # Clean delete of legitimate file
    assert service.delete_document_file(user_id=user_id, stored_filename=stored_name) is True
    assert not abs_path.exists()
    assert secret_file.exists()


