"""
Test Suite: URL Authorization & Access Control Hardening
--------------------------------------------------------
Tests security mitigations against URL parameter tampering, BFLA, BOLA/IDOR on background jobs,
IP spoofing, and resource enumeration.
"""

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app.core.dependencies import get_db
from app.core.network import extract_client_ip
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User, UserRole
from app.services.job_service import JobStatus, job_manager


@pytest.fixture
def auth_users(db_session):
    """Seed test users for multi-tenant URL authorization tests."""
    user_a = User(
        email="victim_user_a@example.com",
        hashed_password=hash_password("Password123!"),
        full_name="User A",
        role=UserRole.FREE,
        is_active=True,
    )
    user_b = User(
        email="attacker_user_b@example.com",
        hashed_password=hash_password("Password123!"),
        full_name="User B (Attacker)",
        role=UserRole.FREE,
        is_active=True,
    )
    admin_user = User(
        email="super_admin@example.com",
        hashed_password=hash_password("Password123!"),
        full_name="Administrator",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add_all([user_a, user_b, admin_user])
    db_session.commit()
    db_session.refresh(user_a)
    db_session.refresh(user_b)
    db_session.refresh(admin_user)

    token_a = create_access_token(subject=user_a.id, additional_claims={"email": user_a.email, "role": user_a.role.value})
    token_b = create_access_token(subject=user_b.id, additional_claims={"email": user_b.email, "role": user_b.role.value})
    token_admin = create_access_token(subject=admin_user.id, additional_claims={"email": admin_user.email, "role": admin_user.role.value})

    return {
        "user_a": user_a,
        "user_b": user_b,
        "admin": admin_user,
        "token_a": token_a,
        "token_b": token_b,
        "token_admin": token_admin,
    }


@pytest.fixture
def test_client(db_session):
    """Test client with db_session dependency override."""
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


def test_job_status_unauthorized_user_b_rejected_404(test_client, auth_users):
    """User B attempts to inspect User A's background job by URL parameter tampering -> 404."""
    user_a = auth_users["user_a"]
    job = job_manager.create_job(
        filename="confidential_contract.pdf",
        target_lang="vi",
        user_id=user_a.id,
    )
    job.status = JobStatus.PROCESSING
    job.message = "Đang xử lý nội dung nhạy cảm của User A..."

    # 1. Attacker User B attempts to access User A's job status -> 404 Not Found
    res_b = test_client.get(
        f"/api/process/jobs/{job.job_id}",
        headers={"Authorization": f"Bearer {auth_users['token_b']}"},
    )
    assert res_b.status_code == 404
    err_msg = res_b.json().get("message", "") or res_b.json().get("detail", "")
    assert "không có quyền truy cập" in err_msg.lower()

    # 2. Unauthenticated caller attempts to access -> 404 Not Found
    res_anon = test_client.get(f"/api/process/jobs/{job.job_id}")
    assert res_anon.status_code == 404

    # 3. Owner User A accesses -> 200 OK
    res_a = test_client.get(
        f"/api/process/jobs/{job.job_id}",
        headers={"Authorization": f"Bearer {auth_users['token_a']}"},
    )
    assert res_a.status_code == 200
    assert res_a.json()["data"]["job_id"] == job.job_id
    assert res_a.json()["data"]["filename"] == "confidential_contract.pdf"

    # 4. Administrator accesses -> 200 OK
    res_admin = test_client.get(
        f"/api/process/jobs/{job.job_id}",
        headers={"Authorization": f"Bearer {auth_users['token_admin']}"},
    )
    assert res_admin.status_code == 200
    assert res_admin.json()["data"]["job_id"] == job.job_id


def test_job_cancel_unauthorized_user_b_rejected_404(test_client, auth_users):
    """User B attempts to cancel User A's job -> 404 Not Found."""
    user_a = auth_users["user_a"]
    job = job_manager.create_job(
        filename="important_doc.pdf",
        target_lang="en",
        user_id=user_a.id,
    )

    # Attacker attempts to cancel victim's job
    res_cancel_b = test_client.post(
        f"/api/process/jobs/{job.job_id}/cancel",
        headers={"Authorization": f"Bearer {auth_users['token_b']}"},
    )
    assert res_cancel_b.status_code == 404
    assert job.status != JobStatus.CANCELLED

    # Owner User A can cancel
    res_cancel_a = test_client.post(
        f"/api/process/jobs/{job.job_id}/cancel",
        headers={"Authorization": f"Bearer {auth_users['token_a']}"},
    )
    assert res_cancel_a.status_code == 200
    assert res_cancel_a.json()["data"]["status"] == JobStatus.CANCELLED.value


def test_guest_job_protection_with_guest_token(test_client):
    """Guest jobs with guest_token require matching token in header or query parameter."""
    token = "secret-guest-token-xyz-12345"
    job = job_manager.create_job(
        filename="guest_document.pdf",
        target_lang="vi",
        user_id=None,
        guest_token=token,
    )

    # 1. No token -> 404
    res_no_token = test_client.get(f"/api/process/jobs/{job.job_id}")
    assert res_no_token.status_code == 404

    # 2. Wrong token -> 404
    res_wrong_token = test_client.get(
        f"/api/process/jobs/{job.job_id}",
        headers={"X-Guest-Token": "wrong-token-999"},
    )
    assert res_wrong_token.status_code == 404

    # 3. Correct token in header -> 200
    res_header = test_client.get(
        f"/api/process/jobs/{job.job_id}",
        headers={"X-Guest-Token": token},
    )
    assert res_header.status_code == 200
    assert res_header.json()["data"]["job_id"] == job.job_id

    # 4. Correct token in query parameter -> 200
    res_query = test_client.get(f"/api/process/jobs/{job.job_id}?guest_token={token}")
    assert res_query.status_code == 200
    assert res_query.json()["data"]["job_id"] == job.job_id


def test_extract_client_ip_prioritizes_trusted_proxy_headers():
    """extract_client_ip correctly honors Cloudflare and trusted proxy headers."""
    # 1. Cloudflare CF-Connecting-IP takes highest priority
    scope_cf = {
        "type": "http",
        "headers": [
            (b"cf-connecting-ip", b"203.0.113.195"),
            (b"x-forwarded-for", b"1.1.1.1, 2.2.2.2"),
        ],
    }
    req_cf = Request(scope_cf)
    assert extract_client_ip(req_cf) == "203.0.113.195"

    # 2. True-Client-IP priority
    scope_true = {
        "type": "http",
        "headers": [
            (b"true-client-ip", b"198.51.100.24"),
            (b"x-forwarded-for", b"3.3.3.3"),
        ],
    }
    req_true = Request(scope_true)
    assert extract_client_ip(req_true) == "198.51.100.24"

    # 3. X-Real-IP priority
    scope_real = {
        "type": "http",
        "headers": [
            (b"x-real-ip", b"192.0.2.1"),
            (b"x-forwarded-for", b"4.4.4.4"),
        ],
    }
    req_real = Request(scope_real)
    assert extract_client_ip(req_real) == "192.0.2.1"


def test_batch_download_array_boundary_clamping(test_client, auth_users):
    """batch-download rejects payloads with more than 20 items to prevent resource exhaustion."""
    token = auth_users["token_a"]

    # Exceeding 20 job_ids -> rejected with 400 or 422
    payload_excessive = {
        "job_ids": [f"job-id-{i}" for i in range(25)],
        "format": "pdf",
    }
    res = test_client.post(
        "/api/process/batch-download",
        headers={"Authorization": f"Bearer {token}"},
        json=payload_excessive,
    )
    assert res.status_code in (400, 422)
