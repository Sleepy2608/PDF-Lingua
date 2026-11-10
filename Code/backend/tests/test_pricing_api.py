"""
Unit & Integration Tests for Pricing Plans & Subscription API (`Code/backend/app/api/pricing.py`)
-------------------------------------------------------------------------------------------------
Verifies:
- `GET /api/pricing/plans`: Publicly returns Free tier (0 VND, 20MB, 100 pages) and Pro tiers
  (Monthly 49,000 VND / 30 days, Yearly 399,000 VND / 365 days / 32% discount / 33.250đ/tháng).
- `GET /api/pricing/my-subscription`: Requires auth, returns Free/Pro quotas and active subscription.
- `POST /api/pricing/subscribe`: Validates plan_code & payment_method, creates pending transaction,
  and generates valid Napas247 VietQR URL.
- `POST /api/pricing/transactions/{code}/simulate`: Confirms payment, calculates 30-day (monthly) or
  365-day (yearly) expiration, upgrades `user.role` from `free` to `pro`, and preserves `admin` role.
- Idempotency: Repeated confirmation/webhook calls do not extend `expires_at` twice.
- Cumulative renewal: Purchasing another plan while active extends from existing `expires_at`.
- Automatic expiration: Expired subscriptions transition to `expired` and downgrade `user.role`
  from `pro` back to `free` (while never downgrading `admin`).
- Ownership & security: User A cannot inspect or simulate User B's transaction (403 Forbidden).
- Webhook reconciliation: Validates `X-Webhook-Secret` / `Authorization: Apikey`, matches by
  `transaction_code` or bank transfer `content`, rejects underpayments, and handles failed status.
- `POST /api/pricing/cancel`: Disables `auto_renew` and sets `cancelled_at` while keeping Pro access
  active until `expires_at`.
"""

from datetime import datetime, timedelta, timezone

import pytest
from app.core.config import settings
from app.core.database import Base
from app.core.dependencies import get_db
from app.core.security import create_access_token
from app.main import app
from app.models.subscription import (
    PaymentStatus,
    Subscription,
    SubscriptionStatus,
    seed_pricing_plans,
)
from app.models.user import User, UserRole
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

client = TestClient(app)


@pytest.fixture
def pricing_test_env():
    """
    Create an isolated in-memory SQLite database seeded with default pricing plans
    and test accounts (`free_user`, `other_user`, `admin_user`).
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, _connection_record):
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
    seed_pricing_plans(session)

    free_user = User(
        email="buyer_free@example.com",
        hashed_password="hashed_pw_buyer",
        full_name="Nguyễn Văn Mua",
        role=UserRole.FREE,
        is_active=True,
    )
    other_user = User(
        email="other_user@example.com",
        hashed_password="hashed_pw_other",
        full_name="Trần Thị Khác",
        role=UserRole.FREE,
        is_active=True,
    )
    admin_user = User(
        email="admin_pricing@example.com",
        hashed_password="hashed_pw_admin",
        full_name="Quản Trị Viên",
        role=UserRole.ADMIN,
        is_active=True,
    )

    session.add_all([free_user, other_user, admin_user])
    session.commit()
    session.refresh(free_user)
    session.refresh(other_user)
    session.refresh(admin_user)

    free_token = create_access_token(subject=free_user.id)
    other_token = create_access_token(subject=other_user.id)
    admin_token = create_access_token(subject=admin_user.id)

    yield {
        "session": session,
        "free_user": free_user,
        "other_user": other_user,
        "admin_user": admin_user,
        "free_token": free_token,
        "other_token": other_token,
        "admin_token": admin_token,
    }

    app.dependency_overrides.clear()
    session.close()
    Base.metadata.drop_all(bind=engine)


# ==============================================================================
# 1. Public Pricing Catalog Tests (`GET /api/pricing/plans`)
# ==============================================================================

def test_get_pricing_plans_public_returns_free_and_pro_tiers(pricing_test_env):
    """Public endpoint returns Free (0đ), Pro Monthly (49.000đ), and Pro Yearly (399.000đ, -32%)."""
    res = client.get("/api/pricing/plans")
    assert res.status_code == 200

    body = res.json()
    assert body["success"] is True
    data = body["data"]

    free_tier = data["free_tier"]
    assert free_tier["code"] == "free"
    assert free_tier["price_vnd"] == 0
    assert free_tier["max_file_size_mb"] == 20
    assert free_tier["max_ocr_pages"] == 100
    assert len(free_tier["features"]) >= 4

    pro_tier = data["pro_tier"]
    monthly = pro_tier["monthly"]
    assert monthly["code"] == "pro_monthly"
    assert monthly["price_vnd"] == 49000
    assert monthly["original_price_vnd"] == 49000
    assert monthly["discount_percent"] == 0
    assert monthly["duration_days"] == 30
    assert monthly["price_display"] == "49.000đ"
    assert monthly["period_display"] == "/ tháng"

    yearly = pro_tier["yearly"]
    assert yearly["code"] == "pro_yearly"
    assert yearly["price_vnd"] == 399000
    assert yearly["original_price_vnd"] == 588000
    assert yearly["discount_percent"] == 32
    assert yearly["duration_days"] == 365
    assert yearly["price_display"] == "399.000đ"
    assert yearly["period_display"] == "/ năm"
    assert yearly["monthly_equivalent"] == "33.250đ / tháng"
    assert yearly["badge"] == "TIẾT KIỆM 32%"

    assert len(pro_tier["shared_features"]) >= 6


# ==============================================================================
# 2. Authentication & Initial Subscription State Tests
# ==============================================================================

def test_protected_pricing_endpoints_require_authentication(pricing_test_env):
    """Unauthenticated requests to protected pricing endpoints must return 401."""
    assert client.get("/api/pricing/my-subscription").status_code == 401
    assert client.post("/api/pricing/subscribe", json={"plan_code": "pro_monthly"}).status_code == 401
    assert client.get("/api/pricing/transactions/SUB-123/status").status_code == 401
    assert client.post("/api/pricing/transactions/SUB-123/simulate").status_code == 401
    assert client.post("/api/pricing/cancel").status_code == 401


def test_my_subscription_for_free_user_returns_default_quotas(pricing_test_env):
    """Free user without subscription sees `is_pro=False`, 20MB, 100 pages, and `active_subscription=None`."""
    headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}
    res = client.get("/api/pricing/my-subscription", headers=headers)
    assert res.status_code == 200

    data = res.json()["data"]
    assert data["current_role"] == "free"
    assert data["is_pro"] is False
    assert data["max_file_size_mb"] == 20
    assert data["max_ocr_pages"] == 100
    assert data["active_subscription"] is None


# ==============================================================================
# 3. Subscribe & VietQR Checkout Tests (`POST /api/pricing/subscribe`)
# ==============================================================================

def test_subscribe_invalid_plan_code_returns_400(pricing_test_env):
    """Subscribing to an unknown plan code returns 400 INVALID_PLAN_CODE."""
    headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}
    res = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "invalid_plan"},
        headers=headers,
    )
    assert res.status_code == 400
    assert res.json()["error_code"] == "INVALID_PLAN_CODE"


def test_subscribe_invalid_payment_method_returns_400(pricing_test_env):
    """Subscribing with an unsupported payment method returns 400 INVALID_PAYMENT_METHOD."""
    headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}
    res = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_monthly", "payment_method": "crypto_bitcoin"},
        headers=headers,
    )
    assert res.status_code == 400
    assert res.json()["error_code"] == "INVALID_PAYMENT_METHOD"


def test_subscribe_pro_monthly_and_confirm_30_days_upgrade(pricing_test_env):
    """
    Full flow for `pro_monthly` (49,000 VND):
    1. Create pending transaction with VietQR URL.
    2. Check pending status via `/transactions/{code}/status`.
    3. Simulate payment completion -> upgrades `user.role` to `pro` and sets `expires_at = started_at + 30 days`.
    """
    headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}

    # 1. Initiate subscription
    res_sub = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_monthly"},
        headers=headers,
    )
    assert res_sub.status_code == 201
    checkout = res_sub.json()["data"]
    tx_code = checkout["transaction_code"]

    assert checkout["plan_code"] == "pro_monthly"
    assert checkout["amount_vnd"] == 49000
    assert checkout["amount_display"] == "49.000 VNĐ"
    assert checkout["duration_days"] == 30
    assert checkout["payment_status"] == "pending"
    assert "https://img.vietqr.io/image/" in checkout["qr_code_url"]
    assert "amount=49000" in checkout["qr_code_url"]
    assert checkout["bank_info"]["account_number"] == settings.VIETQR_ACCOUNT_NUMBER
    assert checkout["expires_in_seconds"] == 900

    # 2. Poll status while pending
    res_status = client.get(f"/api/pricing/transactions/{tx_code}/status", headers=headers)
    assert res_status.status_code == 200
    assert res_status.json()["data"]["payment_status"] == "pending"
    assert res_status.json()["data"]["subscription"] is None

    # 3. Simulate payment confirmation
    res_sim = client.post(f"/api/pricing/transactions/{tx_code}/simulate", headers=headers)
    assert res_sim.status_code == 200
    sim_data = res_sim.json()["data"]
    assert sim_data["payment_status"] == "completed"
    assert sim_data["user_role"] == "pro"
    assert sim_data["paid_at"] is not None

    sub_info = sim_data["subscription"]
    assert sub_info is not None
    assert sub_info["plan_code"] == "pro_monthly"
    assert sub_info["status"] == "active"
    assert sub_info["auto_renew"] is True

    started_dt = datetime.fromisoformat(sub_info["started_at"])
    expires_dt = datetime.fromisoformat(sub_info["expires_at"])
    delta = expires_dt - started_dt
    assert delta == timedelta(days=30)
    assert sub_info["days_remaining"] == 30

    # 4. Verify `/my-subscription` reflects Pro status and 100MB / 500 page limits
    res_my = client.get("/api/pricing/my-subscription", headers=headers)
    assert res_my.status_code == 200
    my_data = res_my.json()["data"]
    assert my_data["current_role"] == "pro"
    assert my_data["is_pro"] is True
    assert my_data["max_file_size_mb"] == 100
    assert my_data["max_ocr_pages"] == 500
    assert my_data["active_subscription"]["id"] == sub_info["id"]


def test_subscribe_pro_yearly_and_confirm_365_days_upgrade(pricing_test_env):
    """
    Full flow for `pro_yearly` (399,000 VND):
    Verifies `expires_at = started_at + 365 days` and role upgrade to `pro`.
    """
    headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}

    res_sub = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_yearly"},
        headers=headers,
    )
    assert res_sub.status_code == 201
    checkout = res_sub.json()["data"]
    tx_code = checkout["transaction_code"]
    assert checkout["amount_vnd"] == 399000
    assert checkout["amount_display"] == "399.000 VNĐ"
    assert "amount=399000" in checkout["qr_code_url"]

    res_sim = client.post(f"/api/pricing/transactions/{tx_code}/simulate", headers=headers)
    assert res_sim.status_code == 200
    sim_data = res_sim.json()["data"]
    sub_info = sim_data["subscription"]
    assert sub_info["plan_code"] == "pro_yearly"

    started_dt = datetime.fromisoformat(sub_info["started_at"])
    expires_dt = datetime.fromisoformat(sub_info["expires_at"])
    assert (expires_dt - started_dt) == timedelta(days=365)
    assert sub_info["days_remaining"] == 365


# ==============================================================================
# 4. Idempotency, Cumulative Renewal & Ownership Security Tests
# ==============================================================================

def test_payment_confirmation_is_idempotent_and_does_not_double_extend(pricing_test_env):
    """Calling `/simulate` or `/webhook` multiple times on the same transaction must not add extra days."""
    headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}
    res_sub = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_monthly"},
        headers=headers,
    )
    tx_code = res_sub.json()["data"]["transaction_code"]

    # First confirmation
    res_first = client.post(f"/api/pricing/transactions/{tx_code}/simulate", headers=headers)
    assert res_first.status_code == 200
    first_expires_at = res_first.json()["data"]["subscription"]["expires_at"]
    first_sub_id = res_first.json()["data"]["subscription"]["id"]

    # Second confirmation via simulate
    res_second = client.post(f"/api/pricing/transactions/{tx_code}/simulate", headers=headers)
    assert res_second.status_code == 200
    assert res_second.json()["data"]["subscription"]["expires_at"] == first_expires_at
    assert res_second.json()["data"]["subscription"]["id"] == first_sub_id

    # Third confirmation via webhook
    res_webhook = client.post(
        "/api/pricing/webhook",
        json={"transaction_code": tx_code, "transfer_amount": 49000, "status": "completed"},
        headers={"X-Webhook-Secret": settings.PAYMENT_WEBHOOK_SECRET},
    )
    assert res_webhook.status_code == 200
    assert res_webhook.json()["data"]["subscription"]["expires_at"] == first_expires_at


def test_second_subscription_purchase_extends_existing_active_expiration(pricing_test_env):
    """Purchasing another subscription while active adds days onto the current `expires_at`."""
    headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}

    # Purchase 1: Monthly (+30 days)
    tx1 = client.post("/api/pricing/subscribe", json={"plan_code": "pro_monthly"}, headers=headers).json()["data"]["transaction_code"]
    sim1 = client.post(f"/api/pricing/transactions/{tx1}/simulate", headers=headers).json()["data"]
    exp1 = datetime.fromisoformat(sim1["subscription"]["expires_at"])

    # Purchase 2: Yearly (+365 days on top of exp1)
    tx2 = client.post("/api/pricing/subscribe", json={"plan_code": "pro_yearly"}, headers=headers).json()["data"]["transaction_code"]
    sim2 = client.post(f"/api/pricing/transactions/{tx2}/simulate", headers=headers).json()["data"]
    exp2 = datetime.fromisoformat(sim2["subscription"]["expires_at"])

    assert (exp2 - exp1) == timedelta(days=365)


def test_user_cannot_inspect_or_simulate_another_users_transaction(pricing_test_env):
    """User B is forbidden (403) from viewing or simulating User A's transaction; Admin is allowed."""
    buyer_headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}
    other_headers = {"Authorization": f"Bearer {pricing_test_env['other_token']}"}
    admin_headers = {"Authorization": f"Bearer {pricing_test_env['admin_token']}"}

    res_sub = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_monthly"},
        headers=buyer_headers,
    )
    tx_code = res_sub.json()["data"]["transaction_code"]

    # Other user cannot check status
    res_other_status = client.get(f"/api/pricing/transactions/{tx_code}/status", headers=other_headers)
    assert res_other_status.status_code == 403
    assert res_other_status.json()["error_code"] == "TRANSACTION_FORBIDDEN"

    # Other user cannot simulate payment
    res_other_sim = client.post(f"/api/pricing/transactions/{tx_code}/simulate", headers=other_headers)
    assert res_other_sim.status_code == 403
    assert res_other_sim.json()["error_code"] == "TRANSACTION_FORBIDDEN"

    # Admin can inspect the transaction status
    res_admin_status = client.get(f"/api/pricing/transactions/{tx_code}/status", headers=admin_headers)
    assert res_admin_status.status_code == 200
    assert res_admin_status.json()["data"]["transaction_code"] == tx_code


def test_nonexistent_transaction_returns_404(pricing_test_env):
    """Requesting status or simulation for an unknown transaction code returns 404."""
    headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}
    assert client.get("/api/pricing/transactions/SUB-NOT-FOUND/status", headers=headers).status_code == 404
    assert client.post("/api/pricing/transactions/SUB-NOT-FOUND/simulate", headers=headers).status_code == 404


# ==============================================================================
# 5. Webhook Security & Reconciliation Tests (`POST /api/pricing/webhook`)
# ==============================================================================

def test_webhook_rejects_missing_or_invalid_secret(pricing_test_env):
    """Webhook endpoint returns 401 when secret header is missing or invalid."""
    res_no_secret = client.post(
        "/api/pricing/webhook",
        json={"transaction_code": "SUB-123"},
    )
    assert res_no_secret.status_code == 401
    assert res_no_secret.json()["error_code"] == "INVALID_WEBHOOK_SECRET"

    res_bad_secret = client.post(
        "/api/pricing/webhook",
        json={"transaction_code": "SUB-123"},
        headers={"X-Webhook-Secret": "wrong-secret"},
    )
    assert res_bad_secret.status_code == 401


def test_webhook_matches_by_transfer_note_content_and_validates_amount(pricing_test_env):
    """
    Webhook can match a transaction by scanning the bank transfer description (`content`),
    rejects underpayments (400 INSUFFICIENT_PAYMENT_AMOUNT), and activates Pro when amount matches.
    """
    buyer_headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}
    res_sub = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_monthly"},
        headers=buyer_headers,
    )
    checkout = res_sub.json()["data"]
    transfer_note = checkout["bank_info"]["transfer_note"]

    # 1. Underpayment must be rejected with 400
    res_underpaid = client.post(
        "/api/pricing/webhook",
        json={
            "content": f"MBVCB.123456.Chuyen tien {transfer_note} tai MB",
            "transfer_amount": 10000,
            "status": "completed",
        },
        headers={"Authorization": f"Apikey {settings.PAYMENT_WEBHOOK_SECRET}"},
    )
    assert res_underpaid.status_code == 400
    assert res_underpaid.json()["error_code"] == "INSUFFICIENT_PAYMENT_AMOUNT"

    # 2. Exact payment via bank memo content succeeds
    res_ok = client.post(
        "/api/pricing/webhook",
        json={
            "content": f"MBVCB.123456.Chuyen tien {transfer_note} tai MB",
            "transfer_amount": 49000,
            "status": "completed",
        },
        headers={"Authorization": f"Apikey {settings.PAYMENT_WEBHOOK_SECRET}"},
    )
    assert res_ok.status_code == 200
    data = res_ok.json()["data"]
    assert data["payment_status"] == "completed"
    assert data["user_role"] == "pro"
    assert data["subscription"]["status"] == "active"


def test_webhook_failed_status_marks_transaction_failed_and_blocks_simulation(pricing_test_env):
    """A webhook reporting `status='failed'` marks the transaction failed and prevents confirmation."""
    buyer_headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}
    tx_code = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_monthly"},
        headers=buyer_headers,
    ).json()["data"]["transaction_code"]

    res_fail = client.post(
        "/api/pricing/webhook",
        json={"transaction_code": tx_code, "status": "failed"},
        headers={"X-Webhook-Secret": settings.PAYMENT_WEBHOOK_SECRET},
    )
    assert res_fail.status_code == 200
    assert res_fail.json()["data"]["payment_status"] == PaymentStatus.FAILED.value

    # Attempting to simulate a failed transaction must return 400 INVALID_TRANSACTION_STATE
    res_sim = client.post(f"/api/pricing/transactions/{tx_code}/simulate", headers=buyer_headers)
    assert res_sim.status_code == 400
    assert res_sim.json()["error_code"] == "INVALID_TRANSACTION_STATE"


# ==============================================================================
# 6. Cancellation & Automatic Expiration Downgrade Tests
# ==============================================================================

def test_cancel_subscription_disables_auto_renew_while_preserving_active_access(pricing_test_env):
    """Cancelling an active subscription sets `auto_renew=False` and `cancelled_at` without revoking Pro immediately."""
    headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}

    # Cancel when no active subscription exists -> 404
    res_no_sub = client.post("/api/pricing/cancel", headers=headers)
    assert res_no_sub.status_code == 404

    # Subscribe and activate
    tx_code = client.post("/api/pricing/subscribe", json={"plan_code": "pro_monthly"}, headers=headers).json()["data"]["transaction_code"]
    client.post(f"/api/pricing/transactions/{tx_code}/simulate", headers=headers)

    # Cancel active subscription
    res_cancel = client.post("/api/pricing/cancel", headers=headers)
    assert res_cancel.status_code == 200
    cancel_data = res_cancel.json()["data"]
    assert cancel_data["status"] == SubscriptionStatus.ACTIVE.value
    assert cancel_data["auto_renew"] is False
    assert cancel_data["cancelled_at"] is not None
    assert cancel_data["days_remaining"] == 30


def test_expired_subscription_automatically_downgrades_pro_user_to_free(pricing_test_env):
    """When an active subscription's `expires_at` is in the past, `user.role` downgrades from `pro` to `free`."""
    session = pricing_test_env["session"]
    free_user = pricing_test_env["free_user"]
    headers = {"Authorization": f"Bearer {pricing_test_env['free_token']}"}

    # Subscribe and confirm
    tx_code = client.post("/api/pricing/subscribe", json={"plan_code": "pro_monthly"}, headers=headers).json()["data"]["transaction_code"]
    client.post(f"/api/pricing/transactions/{tx_code}/simulate", headers=headers)

    # Fast-forward subscription expiration into the past
    sub = session.query(Subscription).filter(Subscription.user_id == free_user.id).first()
    assert sub is not None
    sub.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    session.commit()

    # Query `/my-subscription` -> triggers automatic expiration & downgrade
    res_my = client.get("/api/pricing/my-subscription", headers=headers)
    assert res_my.status_code == 200
    my_data = res_my.json()["data"]
    assert my_data["current_role"] == "free"
    assert my_data["is_pro"] is False
    assert my_data["max_file_size_mb"] == 20
    assert my_data["max_ocr_pages"] == 100
    assert my_data["active_subscription"] is None

    session.refresh(sub)
    assert sub.status == SubscriptionStatus.EXPIRED.value


def test_admin_subscribing_and_expiring_never_loses_admin_role(pricing_test_env):
    """Admin accounts preserve `UserRole.ADMIN` both when purchasing a subscription and when it expires."""
    session = pricing_test_env["session"]
    admin_user = pricing_test_env["admin_user"]
    admin_headers = {"Authorization": f"Bearer {pricing_test_env['admin_token']}"}

    tx_code = client.post("/api/pricing/subscribe", json={"plan_code": "pro_monthly"}, headers=admin_headers).json()["data"]["transaction_code"]
    sim_data = client.post(f"/api/pricing/transactions/{tx_code}/simulate", headers=admin_headers).json()["data"]
    assert sim_data["user_role"] == "admin"

    # Expire the admin's subscription
    sub = session.query(Subscription).filter(Subscription.user_id == admin_user.id).first()
    assert sub is not None
    sub.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    session.commit()

    res_my = client.get("/api/pricing/my-subscription", headers=admin_headers)
    assert res_my.status_code == 200
    assert res_my.json()["data"]["current_role"] == "admin"
    assert res_my.json()["data"]["is_pro"] is True
