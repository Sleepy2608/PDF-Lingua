import io
import zipfile
import pytest
from fastapi.testclient import TestClient

from app.models.user import UserRole
from app.services.job_service import job_manager


def test_batch_download_unauthenticated_returns_401(security_client: TestClient):
    """PDFL-252.2: Endpoint /api/process/batch-download requires authentication."""
    response = security_client.post("/api/process/batch-download", json={"job_ids": ["dummy-job-1"]})
    assert response.status_code == 401


def test_batch_download_empty_payload_returns_400(security_client: TestClient, free_user):
    """PDFL-252.2: Empty job_ids/history_ids must be rejected with 400 Bad Request."""
    # No IDs
    resp1 = security_client.post("/api/process/batch-download", json={}, headers=free_user.headers)
    assert resp1.status_code == 400

    # Empty array
    resp2 = security_client.post("/api/process/batch-download", json={"job_ids": []}, headers=free_user.headers)
    assert resp2.status_code == 400


def test_batch_download_duplicate_ids_returns_400(security_client: TestClient, free_user):
    """PDFL-252.2: Duplicate job_ids or history_ids must be rejected with 400."""
    resp = security_client.post(
        "/api/process/batch-download",
        json={"job_ids": ["job-dup-1", "job-dup-1"]},
        headers=free_user.headers,
    )
    assert resp.status_code == 400
    msg = resp.json().get("message") or resp.json().get("detail", "")
    assert "trùng lặp" in msg


def test_batch_download_anti_idor_forbidden(security_client: TestClient, tenant_users):
    """PDFL-252.2: Tenant 2 cannot download Tenant 1's jobs (403 Forbidden)."""
    tenant_1, tenant_2 = tenant_users

    # Create completed job for Tenant 1
    job_1 = job_manager.create_job("report_user_a.pdf", "vi", user_id=tenant_1.id)
    job_manager.set_completed(job_1.job_id, result={"filename": "report_user_a.pdf", "translated_text": "Bản dịch A"})

    # Caller is Tenant 2
    resp = security_client.post(
        "/api/process/batch-download",
        json={"job_ids": [job_1.job_id]},
        headers=tenant_2.headers,
    )
    assert resp.status_code == 403
    msg = resp.json().get("message") or resp.json().get("detail", "")
    assert "quyền truy cập" in msg


def test_batch_download_nonexistent_job_returns_404(security_client: TestClient, free_user):
    """PDFL-252.2: Non-existent job_id returns 404 Not Found."""
    resp = security_client.post(
        "/api/process/batch-download",
        json={"job_ids": ["non-existent-job-uuid"]},
        headers=free_user.headers,
    )
    assert resp.status_code == 404


def test_batch_download_incomplete_job_returns_400(security_client: TestClient, free_user):
    """PDFL-252.2: Job that is not COMPLETED returns 400 Bad Request."""
    job_pending = job_manager.create_job("pending.pdf", "vi", user_id=free_user.id)

    resp = security_client.post(
        "/api/process/batch-download",
        json={"job_ids": [job_pending.job_id]},
        headers=free_user.headers,
    )
    assert resp.status_code == 400
    msg = resp.json().get("message") or resp.json().get("detail", "")
    assert "chưa hoàn thành" in msg


def test_batch_download_success_and_deduplication(security_client: TestClient, free_user):
    """PDFL-252.2: Packages files into valid ZIP and deduplicates identical filenames."""
    # Create 3 jobs with overlapping filenames: "document.pdf", "document.pdf", "notes.pdf"
    job1 = job_manager.create_job("document.pdf", "vi", user_id=free_user.id)
    job_manager.set_completed(job1.job_id, result={"filename": "document.pdf", "translated_text": "Nội dung tệp 1"})

    job2 = job_manager.create_job("document.pdf", "vi", user_id=free_user.id)
    job_manager.set_completed(job2.job_id, result={"filename": "document.pdf", "translated_text": "Nội dung tệp 2"})

    job3 = job_manager.create_job("notes.pdf", "vi", user_id=free_user.id)
    job_manager.set_completed(job3.job_id, result={"filename": "notes.pdf", "translated_text": "Nội dung ghi chú"})

    resp = security_client.post(
        "/api/process/batch-download",
        json={"job_ids": [job1.job_id, job2.job_id, job3.job_id], "format": "txt"},
        headers=free_user.headers,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/zip")
    assert 'filename="PDFLingua_Batch_Results.zip"' in resp.headers["content-disposition"]

    # Verify ZIP contents
    zip_bytes = io.BytesIO(resp.content)
    with zipfile.ZipFile(zip_bytes, "r") as zf:
        namelist = zf.namelist()
        assert len(namelist) == 3
        # Should contain document.txt, document (1).txt, and notes.txt
        assert "document.txt" in namelist
        assert "document (1).txt" in namelist
        assert "notes.txt" in namelist

        doc1_content = zf.read("document.txt").decode("utf-8")
        assert "Nội dung tệp 1" in doc1_content
        doc2_content = zf.read("document (1).txt").decode("utf-8")
        assert "Nội dung tệp 2" in doc2_content


def test_batch_download_admin_can_download_any_job(security_client: TestClient, tenant_users, admin_user):
    """PDFL-252.2: Admin user has permission to download jobs created by any user."""
    tenant_1, _ = tenant_users
    job = job_manager.create_job("secret_a.pdf", "vi", user_id=tenant_1.id)
    job_manager.set_completed(job.job_id, result={"filename": "secret_a.pdf", "translated_text": "Bí mật"})

    resp = security_client.post(
        "/api/process/batch-download",
        json={"job_ids": [job.job_id], "format": "txt"},
        headers=admin_user.headers,
    )
    assert resp.status_code == 200
    zip_bytes = io.BytesIO(resp.content)
    with zipfile.ZipFile(zip_bytes, "r") as zf:
        assert "secret_a.txt" in zf.namelist()
