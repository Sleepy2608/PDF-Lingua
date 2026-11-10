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
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
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
    monkeypatch.setattr("app.services.history_service.HistoryService.storage_service", test_storage_service)
    monkeypatch.setattr("app.services.history_service.history_service.storage_service", test_storage_service)

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

    # Create processing history & result file for User A
    hist_a = ProcessingHistory(
        user_id=user_a.id,
        document_id=doc_a.id,
        action_type=ActionType.TRANSLATE,
        status=ProcessingStatus.SUCCESS,
        execution_time_ms=120,
    )
    session.add(hist_a)
    session.commit()
    session.refresh(hist_a)
    rel_res_a, _ = test_storage_service.save_result_file(
        user_id=user_a.id,
        history_id=hist_a.id,
        result_data={
            "original_text": "Văn bản gốc bí mật",
            "translated_text": "Bản dịch tài liệu bí mật của A",
            "page_count": 2,
        },
    )
    hist_a.result_path = rel_res_a
    session.commit()
    session.refresh(hist_a)

    # Create processing history & result file for User B
    hist_b = ProcessingHistory(
        user_id=user_b.id,
        document_id=doc_b.id,
        action_type=ActionType.EXTRACT,
        status=ProcessingStatus.SUCCESS,
        execution_time_ms=85,
    )
    session.add(hist_b)
    session.commit()
    session.refresh(hist_b)
    rel_res_b, _ = test_storage_service.save_result_file(
        user_id=user_b.id,
        history_id=hist_b.id,
        result_data={
            "original_text": "User B public paper extracted",
            "page_count": 1,
        },
    )
    hist_b.result_path = rel_res_b
    session.commit()
    session.refresh(hist_b)

    yield {
        "session": session,
        "user_a": user_a,
        "user_b": user_b,
        "admin": admin_user,
        "doc_a": doc_a,
        "doc_b": doc_b,
        "hist_a": hist_a,
        "hist_b": hist_b,
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


# ---------------------------------------------------------------------------
# PDFL-94.1: Document Delete API Tests
# ---------------------------------------------------------------------------

def test_pdfl_94_1_delete_unauthenticated_returns_401():
    """Unauthenticated users cannot delete documents."""
    app.dependency_overrides.pop(get_current_user, None)
    res = client.delete("/api/documents/1")
    assert res.status_code == 401


def test_pdfl_94_1_delete_owner_success_removes_db_and_file(access_control_env):
    """Document owner can delete their document; both DB record and physical file are removed."""
    env = access_control_env
    doc_a_id = env["doc_a"].id
    stored_filename_a = env["doc_a"].stored_filename
    user_a_id = env["user_a"].id

    # Verify physical file and DB record exist before delete
    assert env["storage"].get_document_path(user_a_id, stored_filename_a) is not None
    assert env["session"].query(Document).filter(Document.id == doc_a_id).first() is not None

    app.dependency_overrides[get_current_user] = lambda: env["user_a"]
    res = client.delete(f"/api/documents/{doc_a_id}")
    assert res.status_code == 200

    body = res.json()
    assert body["success"] is True
    assert body["message"] == "Xóa tài liệu thành công."
    assert body["data"]["id"] == doc_a_id
    assert body["data"]["original_filename"] == "Tài liệu bí mật của A.pdf"

    # Verify DB record is removed
    env["session"].expire_all()
    assert env["session"].query(Document).filter(Document.id == doc_a_id).first() is None

    # Verify physical file is removed from storage
    assert env["storage"].get_document_path(user_a_id, stored_filename_a) is None


def test_pdfl_94_1_delete_non_existent_document_returns_404(access_control_env):
    """Deleting a non-existent document ID returns 404 Not Found."""
    env = access_control_env
    app.dependency_overrides[get_current_user] = lambda: env["user_a"]

    res = client.delete("/api/documents/999999")
    assert res.status_code == 404
    data = res.json()
    msg = data.get("message") or data.get("detail", "")
    assert "Tài liệu không tồn tại hoặc bạn không có quyền truy cập" in msg


def test_pdfl_94_1_delete_other_user_document_returns_404_and_preserves_data(access_control_env):
    """User B cannot delete User A's document (Anti-IDOR); DB record and physical file remain intact."""
    env = access_control_env
    doc_a_id = env["doc_a"].id
    stored_filename_a = env["doc_a"].stored_filename
    user_a_id = env["user_a"].id

    # Authenticate as User B
    app.dependency_overrides[get_current_user] = lambda: env["user_b"]

    res = client.delete(f"/api/documents/{doc_a_id}")
    assert res.status_code == 404
    data = res.json()
    msg = data.get("message") or data.get("detail", "")
    assert "Tài liệu không tồn tại hoặc bạn không có quyền truy cập" in msg

    # Verify User A's DB record and physical file are completely untouched
    env["session"].expire_all()
    assert env["session"].query(Document).filter(Document.id == doc_a_id).first() is not None
    assert env["storage"].get_document_path(user_a_id, stored_filename_a) is not None


def test_pdfl_94_1_admin_can_delete_user_document(access_control_env):
    """ADMIN can delete any user's document; both DB record and physical file are removed."""
    env = access_control_env
    doc_b_id = env["doc_b"].id
    stored_filename_b = env["doc_b"].stored_filename
    user_b_id = env["user_b"].id

    app.dependency_overrides[get_current_user] = lambda: env["admin"]

    res = client.delete(f"/api/documents/{doc_b_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["id"] == doc_b_id

    env["session"].expire_all()
    assert env["session"].query(Document).filter(Document.id == doc_b_id).first() is None
    assert env["storage"].get_document_path(user_b_id, stored_filename_b) is None


def test_pdfl_94_1_delete_storage_failure_aborts_db_deletion(access_control_env, monkeypatch):
    """If physical file deletion fails on storage, DB record is NOT deleted and 500 is returned."""
    env = access_control_env
    doc_a_id = env["doc_a"].id
    stored_filename_a = env["doc_a"].stored_filename
    user_a_id = env["user_a"].id

    app.dependency_overrides[get_current_user] = lambda: env["user_a"]

    # Simulate filesystem unlink failure
    monkeypatch.setattr(
        env["storage"],
        "delete_document_file",
        lambda user_id, stored_filename: False,
    )

    res = client.delete(f"/api/documents/{doc_a_id}")
    assert res.status_code == 500
    data = res.json()
    msg = data.get("message") or data.get("detail", "")
    assert "Không thể xóa tệp tin vật lý" in msg

    # DB record and physical file must still exist
    env["session"].expire_all()
    assert env["session"].query(Document).filter(Document.id == doc_a_id).first() is not None
    assert env["storage"].get_document_path(user_a_id, stored_filename_a) is not None


def test_pdfl_94_1_delete_db_commit_failure_rolls_back_and_restores_file(access_control_env, monkeypatch):
    """If DB commit fails after physical file deletion, DB is rolled back and physical file is restored."""
    env = access_control_env
    doc_a_id = env["doc_a"].id
    stored_filename_a = env["doc_a"].stored_filename
    user_a_id = env["user_a"].id

    app.dependency_overrides[get_current_user] = lambda: env["user_a"]

    from sqlalchemy.orm import Session as OrmSession

    def failing_commit(self):
        raise RuntimeError("Simulated database commit failure")

    monkeypatch.setattr(OrmSession, "commit", failing_commit)

    res = client.delete(f"/api/documents/{doc_a_id}")
    assert res.status_code == 500
    data = res.json()
    msg = data.get("message") or data.get("detail", "")
    assert "Lỗi cơ sở dữ liệu khi xóa tài liệu" in msg

    # Verify DB record still exists after rollback
    env["session"].expire_all()
    assert env["session"].query(Document).filter(Document.id == doc_a_id).first() is not None

    # Verify physical file was restored back to storage with exact contents
    restored_path = env["storage"].get_document_path(user_a_id, stored_filename_a)
    assert restored_path is not None
    assert restored_path.is_file()
    assert b"User A confidential document content" in restored_path.read_bytes()


def test_pdfl_94_3_repeated_delete_and_post_delete_access_consistency(access_control_env):
    """
    PDFL-94.3 End-to-End Backend Consistency:
    - First DELETE succeeds (200 OK) and removes DB + Storage file.
    - Subsequent repeated DELETE on the same ID safely returns 404 Not Found.
    - Subsequent GET /api/documents/{id} and GET /api/documents/{id}/download return 404.
    - GET /api/documents list immediately reflects removal for the owner while preserving other users' docs.
    """
    env = access_control_env
    doc_a_id = env["doc_a"].id
    doc_b_id = env["doc_b"].id

    app.dependency_overrides[get_current_user] = lambda: env["user_a"]

    # 1. First DELETE -> 200 OK
    res_del_1 = client.delete(f"/api/documents/{doc_a_id}")
    assert res_del_1.status_code == 200
    assert res_del_1.json()["success"] is True

    # 2. Repeated DELETE on already deleted document -> 404 Not Found
    res_del_2 = client.delete(f"/api/documents/{doc_a_id}")
    assert res_del_2.status_code == 404

    # 3. Detail and Download endpoints for deleted document -> 404 Not Found
    assert client.get(f"/api/documents/{doc_a_id}").status_code == 404
    assert client.get(f"/api/documents/{doc_a_id}/download").status_code == 404

    # 4. User A's document list is now empty (0 documents)
    res_list_a = client.get("/api/documents")
    assert res_list_a.status_code == 200
    assert res_list_a.json()["data"] == []

    # 5. User B's document (#doc_b) is completely unaffected
    app.dependency_overrides[get_current_user] = lambda: env["user_b"]
    res_list_b = client.get("/api/documents")
    assert res_list_b.status_code == 200
    docs_b = res_list_b.json()["data"]
    assert len(docs_b) == 1
    assert docs_b[0]["id"] == doc_b_id


# ---------------------------------------------------------------------------
# PDFL-214.3: Anti-IDOR, Multi-Tenant Ownership & Privilege Enforcement Tests
# ---------------------------------------------------------------------------

def test_pdfl_214_3_spoofed_user_id_ignored_for_regular_user(access_control_env):
    """
    Client-supplied user_id or owner_id query parameters are strictly ignored
    for non-admin callers to prevent spoofing and data leakage across tenants.
    """
    env = access_control_env
    user_a = env["user_a"]
    user_b = env["user_b"]
    doc_a = env["doc_a"]
    hist_a = env["hist_a"]

    # User A requests /api/documents spoofing user_id=user_b.id
    app.dependency_overrides[get_current_user] = lambda: user_a
    res_docs = client.get(f"/api/documents?user_id={user_b.id}")
    assert res_docs.status_code == 200
    doc_data = res_docs.json()["data"]
    doc_ids = [d["id"] for d in doc_data]
    assert doc_ids == [doc_a.id]
    assert env["doc_b"].id not in doc_ids

    # User A requests /api/history spoofing user_id=user_b.id
    res_hist = client.get(f"/api/history?user_id={user_b.id}")
    assert res_hist.status_code == 200
    hist_data = res_hist.json()["data"]
    hist_ids = [h["id"] for h in hist_data]
    assert hist_ids == [hist_a.id]
    assert env["hist_b"].id not in hist_ids


def test_pdfl_214_3_admin_user_id_filter(access_control_env):
    """
    ADMIN has elevated privileges to filter documents and histories by user_id
    or view all records across the system when no user_id is specified.
    """
    env = access_control_env
    app.dependency_overrides[get_current_user] = lambda: env["admin"]

    # Filter documents by User A
    res_doc_a = client.get(f"/api/documents?user_id={env['user_a'].id}")
    assert res_doc_a.status_code == 200
    docs_a = res_doc_a.json()["data"]
    assert len(docs_a) == 1
    assert docs_a[0]["id"] == env["doc_a"].id

    # Filter documents by User B
    res_doc_b = client.get(f"/api/documents?user_id={env['user_b'].id}")
    assert res_doc_b.status_code == 200
    docs_b = res_doc_b.json()["data"]
    assert len(docs_b) == 1
    assert docs_b[0]["id"] == env["doc_b"].id

    # View all documents
    res_doc_all = client.get("/api/documents")
    assert res_doc_all.status_code == 200
    assert len(res_doc_all.json()["data"]) == 2

    # Filter history by User A
    res_h_a = client.get(f"/api/history?user_id={env['user_a'].id}")
    assert res_h_a.status_code == 200
    h_a = res_h_a.json()["data"]
    assert len(h_a) == 1
    assert h_a[0]["id"] == env["hist_a"].id

    # Filter history by User B
    res_h_b = client.get(f"/api/history?user_id={env['user_b'].id}")
    assert res_h_b.status_code == 200
    h_b = res_h_b.json()["data"]
    assert len(h_b) == 1
    assert h_b[0]["id"] == env["hist_b"].id

    # View all histories
    res_h_all = client.get("/api/history")
    assert res_h_all.status_code == 200
    assert len(res_h_all.json()["data"]) == 2


def test_pdfl_214_3_cross_tenant_history_detail_and_result_anti_idor(access_control_env):
    """
    Regular users cannot inspect or fetch results of other users' processing histories.
    Returns 404 Not Found to prevent leaking resource existence.
    """
    env = access_control_env
    hist_a_id = env["hist_a"].id

    # Owner (User A) accesses own history detail & result
    app.dependency_overrides[get_current_user] = lambda: env["user_a"]
    res_a_detail = client.get(f"/api/history/{hist_a_id}")
    assert res_a_detail.status_code == 200
    assert res_a_detail.json()["data"]["id"] == hist_a_id

    res_a_result = client.get(f"/api/history/{hist_a_id}/result")
    assert res_a_result.status_code == 200
    assert "Bản dịch tài liệu bí mật của A" in res_a_result.text

    # Cross-tenant attack: User B tries to view User A's history detail -> 404
    app.dependency_overrides[get_current_user] = lambda: env["user_b"]
    res_b_detail = client.get(f"/api/history/{hist_a_id}")
    assert res_b_detail.status_code == 404

    # Cross-tenant attack: User B tries to view User A's history result -> 404
    res_b_result = client.get(f"/api/history/{hist_a_id}/result")
    assert res_b_result.status_code == 404

    # Cross-tenant attack: User B tries to delete User A's history -> 404
    res_b_delete = client.delete(f"/api/history/{hist_a_id}")
    assert res_b_delete.status_code == 404

    # Verify User A's history and result file were NOT deleted
    env["session"].expire_all()
    assert env["session"].query(ProcessingHistory).filter(ProcessingHistory.id == hist_a_id).first() is not None
    assert env["storage"].get_result_path(env["user_a"].id, env["hist_a"].result_path) is not None


def test_pdfl_214_3_non_existent_history_returns_404(access_control_env):
    """
    Querying or deleting non-existent history records consistently returns 404 Not Found.
    """
    env = access_control_env
    app.dependency_overrides[get_current_user] = lambda: env["user_a"]

    assert client.get("/api/history/999999").status_code == 404
    assert client.get("/api/history/999999/result").status_code == 404
    assert client.delete("/api/history/999999").status_code == 404


def test_pdfl_214_3_admin_can_access_and_delete_user_history(access_control_env):
    """
    ADMIN has authority to inspect, retrieve results, and delete any history record and physical result file.
    """
    env = access_control_env
    hist_a_id = env["hist_a"].id
    user_a_id = env["user_a"].id
    res_path = env["hist_a"].result_path

    app.dependency_overrides[get_current_user] = lambda: env["admin"]

    # Admin accesses detail
    res_detail = client.get(f"/api/history/{hist_a_id}")
    assert res_detail.status_code == 200
    assert res_detail.json()["data"]["id"] == hist_a_id

    # Admin accesses result
    res_result = client.get(f"/api/history/{hist_a_id}/result")
    assert res_result.status_code == 200
    assert "Bản dịch tài liệu bí mật của A" in res_result.text

    # Admin deletes history
    res_del = client.delete(f"/api/history/{hist_a_id}")
    assert res_del.status_code == 200
    assert res_del.json()["data"]["deleted"] is True

    # Verify DB record and physical file are unlinked
    env["session"].expire_all()
    assert env["session"].query(ProcessingHistory).filter(ProcessingHistory.id == hist_a_id).first() is None
    assert env["storage"].get_result_path(user_a_id, res_path) is None


def test_pdfl_214_3_filter_history_by_unowned_document_forbidden(access_control_env):
    """
    Filtering history by a document owned by another user returns 403 Forbidden.
    ADMIN can filter by any document.
    """
    env = access_control_env
    doc_a_id = env["doc_a"].id

    # User B attempts to filter history by User A's document
    app.dependency_overrides[get_current_user] = lambda: env["user_b"]
    res_b = client.get(f"/api/history?document_id={doc_a_id}")
    assert res_b.status_code == 403

    # ADMIN can filter history by User A's document
    app.dependency_overrides[get_current_user] = lambda: env["admin"]
    res_admin = client.get(f"/api/history?document_id={doc_a_id}")
    assert res_admin.status_code == 200
    assert len(res_admin.json()["data"]) == 1
    assert res_admin.json()["data"][0]["document_id"] == doc_a_id


def test_pdfl_214_3_cleanup_anti_idor(access_control_env):
    """
    Cleanup endpoint isolates tenants:
    - Non-admin callers only clean their own histories even if user_id query param is supplied.
    - ADMIN callers can specify user_id to clean that user's expired records.
    """
    from datetime import datetime, timedelta, timezone
    env = access_control_env
    session = env["session"]

    # Create old expired history for User A (35 days old)
    old_date = datetime.now(timezone.utc) - timedelta(days=35)
    hist_old_a = ProcessingHistory(
        user_id=env["user_a"].id,
        document_id=env["doc_a"].id,
        action_type=ActionType.EXTRACT,
        status=ProcessingStatus.SUCCESS,
        created_at=old_date,
    )
    session.add(hist_old_a)
    session.commit()
    session.refresh(hist_old_a)
    old_a_id = hist_old_a.id

    # User B calls cleanup with user_id=user_a.id -> User A's record must NOT be deleted
    app.dependency_overrides[get_current_user] = lambda: env["user_b"]
    res_b_cleanup = client.post(f"/api/history/cleanup?user_id={env['user_a'].id}&older_than_days=30")
    assert res_b_cleanup.status_code == 200
    assert res_b_cleanup.json()["data"]["deleted_count"] == 0

    session.expire_all()
    assert session.query(ProcessingHistory).filter(ProcessingHistory.id == old_a_id).first() is not None

    # Admin calls cleanup with user_id=user_a.id -> User A's record is cleaned
    app.dependency_overrides[get_current_user] = lambda: env["admin"]
    res_admin_cleanup = client.post(f"/api/history/cleanup?user_id={env['user_a'].id}&older_than_days=30")
    assert res_admin_cleanup.status_code == 200
    assert res_admin_cleanup.json()["data"]["deleted_count"] == 1

    session.expire_all()
    assert session.query(ProcessingHistory).filter(ProcessingHistory.id == old_a_id).first() is None


def test_pdfl_214_3_error_responses_do_not_leak_metadata(access_control_env):
    """
    Error responses on unauthorized access do not leak sensitive document/history metadata,
    such as filenames, user emails, raw database details, or absolute file paths.
    """
    env = access_control_env
    doc_a = env["doc_a"]
    hist_a = env["hist_a"]

    app.dependency_overrides[get_current_user] = lambda: env["user_b"]

    # Attempting to access User A's document detail
    res_doc = client.get(f"/api/documents/{doc_a.id}")
    assert res_doc.status_code == 404
    assert doc_a.original_filename not in res_doc.text
    assert doc_a.stored_filename not in res_doc.text
    assert "user_a@example.com" not in res_doc.text

    # Attempting to access User A's history detail
    res_hist = client.get(f"/api/history/{hist_a.id}")
    assert res_hist.status_code == 404
    assert doc_a.original_filename not in res_hist.text
    assert "user_a@example.com" not in res_hist.text



