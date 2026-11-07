"""
Unit & Integration Tests for PricingPlan, Subscription, and PaymentTransaction Models
-------------------------------------------------------------------------------------
Verifies:
- Default pricing plans seeding (pro_monthly 49,000 VND & pro_yearly 399,000 VND) and idempotency.
- PricingPlan, Subscription, and PaymentTransaction schema, defaults, and constraints.
- Bidirectional ORM relationships with User (`user.subscriptions`, `user.payment_transactions`).
- Foreign key integrity, cascade deletions on User, and SET NULL on Subscription deletion.
"""

from datetime import datetime, timedelta, timezone

import pytest
from app.core.database import Base
from app.models.subscription import (
    BillingCycle,
    PaymentMethod,
    PaymentStatus,
    PaymentTransaction,
    PricingPlan,
    Subscription,
    SubscriptionStatus,
    seed_pricing_plans,
)
from app.models.user import User, UserRole
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def in_memory_db():
    """Create a completely isolated in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_seed_pricing_plans_creates_monthly_and_yearly_tiers(in_memory_db):
    """Verify seed_pricing_plans populates pro_monthly (49k) and pro_yearly (399k) accurately."""
    plans = seed_pricing_plans(in_memory_db)

    assert len(plans) == 2
    plans_by_code = {p.code: p for p in plans}
    assert "pro_monthly" in plans_by_code
    assert "pro_yearly" in plans_by_code

    monthly = plans_by_code["pro_monthly"]
    assert monthly.name == "Gói Pro Hàng Tháng"
    assert monthly.billing_cycle == BillingCycle.MONTHLY.value
    assert monthly.price_vnd == 49000
    assert monthly.original_price_vnd == 49000
    assert monthly.discount_percent == 0
    assert monthly.duration_days == 30
    assert monthly.max_file_size_mb == 100
    assert monthly.max_ocr_pages == 500
    assert monthly.is_active is True
    assert len(monthly.features) >= 5
    assert "<PricingPlan id=" in repr(monthly)

    yearly = plans_by_code["pro_yearly"]
    assert yearly.name == "Gói Pro Hàng Năm"
    assert yearly.billing_cycle == BillingCycle.YEARLY.value
    assert yearly.price_vnd == 399000
    assert yearly.original_price_vnd == 588000
    assert yearly.discount_percent == 32
    assert yearly.duration_days == 365
    assert yearly.max_file_size_mb == 100
    assert yearly.max_ocr_pages == 500
    assert yearly.is_active is True
    assert len(yearly.features) == len(monthly.features)


def test_seed_pricing_plans_is_idempotent_and_restores_canonical_values(in_memory_db):
    """Verify calling seed_pricing_plans multiple times does not duplicate rows and updates modified values."""
    seed_pricing_plans(in_memory_db)

    monthly = in_memory_db.query(PricingPlan).filter_by(code="pro_monthly").first()
    monthly.price_vnd = 99999
    in_memory_db.commit()

    # Re-run seed
    seed_pricing_plans(in_memory_db)

    all_plans = in_memory_db.query(PricingPlan).all()
    assert len(all_plans) == 2

    refreshed_monthly = in_memory_db.query(PricingPlan).filter_by(code="pro_monthly").first()
    assert refreshed_monthly.price_vnd == 49000


def test_pricing_plan_features_property_handles_empty_and_invalid_json(in_memory_db):
    """Verify PricingPlan.features safely returns an empty list on None or malformed JSON."""
    plan = PricingPlan(
        code="custom_plan",
        name="Custom Plan",
        billing_cycle="monthly",
        price_vnd=10000,
        duration_days=10,
        features_json=None,
    )
    assert plan.features == []

    plan.features_json = "not valid json {"
    assert plan.features == []

    plan.features_json = '{"not": "a list"}'
    assert plan.features == []


def test_pricing_plan_unique_code_constraint(in_memory_db):
    """Verify duplicate PricingPlan.code raises IntegrityError."""
    seed_pricing_plans(in_memory_db)

    duplicate = PricingPlan(
        code="pro_monthly",
        name="Duplicate Monthly",
        billing_cycle="monthly",
        price_vnd=49000,
        duration_days=30,
    )
    in_memory_db.add(duplicate)
    with pytest.raises(IntegrityError):
        in_memory_db.commit()
    in_memory_db.rollback()


def test_user_subscription_and_payment_transaction_relationships(in_memory_db):
    """Verify User <-> Subscription <-> PaymentTransaction creation, defaults, and bidirectional links."""
    seed_pricing_plans(in_memory_db)
    yearly_plan = in_memory_db.query(PricingPlan).filter_by(code="pro_yearly").first()

    user = User(
        email="subscriber@example.com",
        hashed_password="hashed_password_123",
        full_name="Nguyễn Văn A",
        role=UserRole.FREE,
    )
    in_memory_db.add(user)
    in_memory_db.commit()
    in_memory_db.refresh(user)

    now = datetime.now(timezone.utc)
    sub = Subscription(
        user_id=user.id,
        plan_id=yearly_plan.id,
        started_at=now,
        expires_at=now + timedelta(days=yearly_plan.duration_days),
    )
    in_memory_db.add(sub)
    in_memory_db.commit()
    in_memory_db.refresh(sub)

    assert sub.id is not None
    assert sub.status == SubscriptionStatus.ACTIVE.value
    assert sub.auto_renew is False
    assert sub.cancelled_at is None
    assert "<Subscription id=" in repr(sub)

    tx = PaymentTransaction(
        transaction_code="SUB-20261107-0001",
        user_id=user.id,
        plan_id=yearly_plan.id,
        subscription_id=sub.id,
        amount_vnd=yearly_plan.price_vnd,
        payment_method=PaymentMethod.VIETQR.value,
        payment_status=PaymentStatus.COMPLETED.value,
        qr_code_url="https://img.vietqr.io/image/MB-0345678999-compact2.png",
        payment_note="SUB 20261107 0001",
        paid_at=now,
    )
    in_memory_db.add(tx)
    in_memory_db.commit()
    in_memory_db.refresh(tx)
    in_memory_db.refresh(user)

    assert tx.id is not None
    assert tx.amount_vnd == 399000
    assert "<PaymentTransaction id=" in repr(tx)

    # Verify bidirectional ORM relationships
    assert len(user.subscriptions) == 1
    assert user.subscriptions[0].id == sub.id
    assert sub.user.email == "subscriber@example.com"
    assert sub.plan.code == "pro_yearly"

    assert len(user.payment_transactions) == 1
    assert user.payment_transactions[0].transaction_code == "SUB-20261107-0001"
    assert tx.user.id == user.id
    assert tx.plan.id == yearly_plan.id
    assert tx.subscription.id == sub.id


def test_payment_transaction_unique_code_and_foreign_key_constraints(in_memory_db):
    """Verify unique transaction_code and foreign key enforcement on PaymentTransaction."""
    seed_pricing_plans(in_memory_db)
    monthly_plan = in_memory_db.query(PricingPlan).filter_by(code="pro_monthly").first()

    user = User(
        email="payer@example.com",
        hashed_password="hashed_password_123",
        role=UserRole.FREE,
    )
    in_memory_db.add(user)
    in_memory_db.commit()

    tx1 = PaymentTransaction(
        transaction_code="UNIQUE-TX-100",
        user_id=user.id,
        plan_id=monthly_plan.id,
        amount_vnd=49000,
    )
    in_memory_db.add(tx1)
    in_memory_db.commit()

    # Duplicate transaction_code must fail
    tx_dup = PaymentTransaction(
        transaction_code="UNIQUE-TX-100",
        user_id=user.id,
        plan_id=monthly_plan.id,
        amount_vnd=49000,
    )
    in_memory_db.add(tx_dup)
    with pytest.raises(IntegrityError):
        in_memory_db.commit()
    in_memory_db.rollback()

    # Non-existent user_id must fail foreign key check
    tx_bad_fk = PaymentTransaction(
        transaction_code="UNIQUE-TX-200",
        user_id=999999,
        plan_id=monthly_plan.id,
        amount_vnd=49000,
    )
    in_memory_db.add(tx_bad_fk)
    with pytest.raises(IntegrityError):
        in_memory_db.commit()
    in_memory_db.rollback()


def test_cascade_delete_user_and_set_null_on_subscription_delete(in_memory_db):
    """Verify deleting a Subscription sets transaction.subscription_id to NULL, and deleting User cascades."""
    seed_pricing_plans(in_memory_db)
    monthly_plan = in_memory_db.query(PricingPlan).filter_by(code="pro_monthly").first()

    user = User(
        email="cascade_test@example.com",
        hashed_password="hashed_password_123",
        role=UserRole.PRO,
    )
    in_memory_db.add(user)
    in_memory_db.commit()

    now = datetime.now(timezone.utc)
    sub = Subscription(
        user_id=user.id,
        plan_id=monthly_plan.id,
        started_at=now,
        expires_at=now + timedelta(days=30),
    )
    in_memory_db.add(sub)
    in_memory_db.commit()

    tx = PaymentTransaction(
        transaction_code="TX-CASCADE-01",
        user_id=user.id,
        plan_id=monthly_plan.id,
        subscription_id=sub.id,
        amount_vnd=49000,
    )
    in_memory_db.add(tx)
    in_memory_db.commit()

    # 1. Delete subscription -> transaction remains with subscription_id = None
    in_memory_db.delete(sub)
    in_memory_db.commit()
    in_memory_db.refresh(tx)
    assert tx.subscription_id is None

    # 2. Delete user -> cascades to delete user's transactions and subscriptions
    in_memory_db.delete(user)
    in_memory_db.commit()

    remaining_tx = in_memory_db.query(PaymentTransaction).filter_by(transaction_code="TX-CASCADE-01").first()
    assert remaining_tx is None

