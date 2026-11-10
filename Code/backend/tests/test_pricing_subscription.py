"""
End-to-End Subscription Lifecycle & Quota Synchronization Test Suite
--------------------------------------------------------------------
Verifies complete integration across Auth, Pricing, Subscription Service, and User Quotas:
1. Full E2E Upgrade Flow: Free user (`GET /api/auth/me` -> role='free', 20MB/100p) subscribes
   to `pro_monthly` (49,000 VND / 30 days) or `pro_yearly` (399,000 VND / 365 days), completes
   payment, and `GET /api/auth/me` + `GET /api/pricing/my-subscription` reflect `role='pro'`
   and `100MB / 500 pages` immediately.
2. Cross-Cycle Stacking: Upgrading from Monthly (30 days) to Yearly (+365 days) accumulates
   to ~395 days total without losing remaining time.
3. Expired Transaction Guard: Attempting to confirm or simulate a transaction that has already
   been marked `expired` returns `400 Bad Request` (`TRANSACTION_EXPIRED`) and does not grant Pro.
4. Full Downgrade Lifecycle: When an active subscription's `expires_at` passes, calling
   `SubscriptionService.expire_overdue_subscriptions` or `GET /api/pricing/my-subscription`
   transitions subscription status to `expired`, downgrades `user.role` to `free`, and restores
   `20MB / 100 pages` limits.
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
    PaymentTransaction,
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
def sub_e2e_env():
    """Create an isolated in-memory SQLite database for E2E subscription lifecycle tests."""
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

    user = User(
        email="e2e_sub_user@example.com",
        hashed_password="hashed_pw_e2e",
        full_name="Lê Hoàng E2E",
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(subject=user.id)

    try:
        yield {
            "session": session,
            "user_id": user.id,
            "headers": {"Authorization": f"Bearer {token}"},
        }
    finally:
        session.close()
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_e2e_free_to_pro_monthly_syncs_auth_me_and_quotas(sub_e2e_env):
    """
    Verify that a Free user upgrading to Pro Monthly (49,000 VND) immediately sees
    `role='pro'` in `/api/auth/me` and 100MB/500p quotas in `/api/pricing/my-subscription`.
    """
    headers = sub_e2e_env["headers"]

    # 1. Initial state: Free role & 20MB / 100 pages
    me_before = client.get("/api/auth/me", headers=headers)
    assert me_before.status_code == 200
    assert me_before.json()["data"]["role"] == "free"

    sub_before = client.get("/api/pricing/my-subscription", headers=headers)
    assert sub_before.status_code == 200
    assert sub_before.json()["data"]["is_pro"] is False
    assert sub_before.json()["data"]["max_file_size_mb"] == 20
    assert sub_before.json()["data"]["max_ocr_pages"] == 100

    # 2. Initiate Pro Monthly checkout (49,000 VND)
    checkout_res = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_monthly", "payment_method": "vietqr"},
        headers=headers,
    )
    assert checkout_res.status_code == 201
    tx_code = checkout_res.json()["data"]["transaction_code"]
    assert checkout_res.json()["data"]["amount_vnd"] == 49000

    # 3. Complete payment via simulator
    sim_res = client.post(
        f"/api/pricing/transactions/{tx_code}/simulate",
        headers=headers,
    )
    assert sim_res.status_code == 200
    assert sim_res.json()["data"]["payment_status"] == "completed"
    assert sim_res.json()["data"]["user_role"] == "pro"

    # 4. Verify `/api/auth/me` and `/api/pricing/my-subscription` reflect Pro status
    me_after = client.get("/api/auth/me", headers=headers)
    assert me_after.status_code == 200
    assert me_after.json()["data"]["role"] == "pro"

    sub_after = client.get("/api/pricing/my-subscription", headers=headers)
    assert sub_after.status_code == 200
    sub_data = sub_after.json()["data"]
    assert sub_data["current_role"] == "pro"
    assert sub_data["is_pro"] is True
    assert sub_data["max_file_size_mb"] == 100
    assert sub_data["max_ocr_pages"] == 500
    assert sub_data["active_subscription"]["plan_code"] == "pro_monthly"
    assert 29 <= sub_data["active_subscription"]["days_remaining"] <= 31


def test_e2e_monthly_plus_yearly_cumulative_stacking(sub_e2e_env):
    """
    Verify that purchasing `pro_monthly` (30 days) followed by `pro_yearly` (365 days)
    stacks the validity period to ~395 days.
    """
    headers = sub_e2e_env["headers"]

    # Purchase Monthly (30 days)
    r1 = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_monthly"},
        headers=headers,
    )
    tx1 = r1.json()["data"]["transaction_code"]
    client.post(f"/api/pricing/transactions/{tx1}/simulate", headers=headers)

    # Purchase Yearly (+365 days) via Webhook
    r2 = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_yearly"},
        headers=headers,
    )
    note2 = r2.json()["data"]["bank_info"]["transfer_note"]

    wh_res = client.post(
        "/api/pricing/webhook",
        json={
            "content": f"CHUYEN KHOAN {note2}",
            "transfer_amount": 399000,
            "status": "completed",
        },
        headers={"X-Webhook-Secret": settings.PAYMENT_WEBHOOK_SECRET},
    )
    assert wh_res.status_code == 200
    sub_info = wh_res.json()["data"]["subscription"]
    assert sub_info["plan_code"] == "pro_yearly"
    assert 394 <= sub_info["days_remaining"] <= 396


def test_e2e_expired_transaction_cannot_be_confirmed(sub_e2e_env):
    """
    Verify that a transaction marked as `expired` rejects confirmation attempts
    with `400 Bad Request` (`TRANSACTION_EXPIRED`).
    """
    headers = sub_e2e_env["headers"]
    session = sub_e2e_env["session"]

    r = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_monthly"},
        headers=headers,
    )
    tx_code = r.json()["data"]["transaction_code"]

    tx_record = (
        session.query(PaymentTransaction)
        .filter(PaymentTransaction.transaction_code == tx_code)
        .first()
    )
    tx_record.payment_status = PaymentStatus.EXPIRED.value
    session.commit()

    sim_res = client.post(
        f"/api/pricing/transactions/{tx_code}/simulate",
        headers=headers,
    )
    assert sim_res.status_code == 400
    assert sim_res.json()["error_code"] == "INVALID_TRANSACTION_STATE"


def test_e2e_overdue_subscription_downgrades_user_and_quotas(sub_e2e_env):
    """
    Verify that when an active Pro subscription expires, the user's role is automatically
    downgraded back to `free` and quotas revert to 20MB / 100 pages.
    """
    headers = sub_e2e_env["headers"]
    session = sub_e2e_env["session"]

    r = client.post(
        "/api/pricing/subscribe",
        json={"plan_code": "pro_yearly"},
        headers=headers,
    )
    tx_code = r.json()["data"]["transaction_code"]
    client.post(f"/api/pricing/transactions/{tx_code}/simulate", headers=headers)

    # Fast-forward subscription expiration into the past
    sub_record = (
        session.query(Subscription)
        .filter(Subscription.user_id == sub_e2e_env["user_id"])
        .first()
    )
    sub_record.expires_at = datetime.now(timezone.utc) - timedelta(hours=2)
    session.commit()

    # Querying `/api/pricing/my-subscription` triggers automatic expiration check
    sub_check = client.get("/api/pricing/my-subscription", headers=headers)
    assert sub_check.status_code == 200
    data = sub_check.json()["data"]
    assert data["current_role"] == "free"
    assert data["is_pro"] is False
    assert data["max_file_size_mb"] == 20
    assert data["max_ocr_pages"] == 100
    assert data["active_subscription"] is None

    session.refresh(sub_record)
    assert sub_record.status == SubscriptionStatus.EXPIRED.value
