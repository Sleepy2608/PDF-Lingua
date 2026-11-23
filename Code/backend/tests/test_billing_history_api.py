"""
Unit & Integration Tests for User Billing History & Invoices API
-----------------------------------------------------------------
Verifies endpoints:
- `GET /api/pricing/billing/history`:
  - Enforces JWT authentication (401 Unauthorized for guests).
  - Returns empty list when user has no billing transactions.
  - Strictly isolates user transaction history (User A cannot view User B records).
  - Orders transaction items chronologically (newest first: created_at DESC, id DESC).
  - Filters by payment status (pending, completed, failed, expired, all).
  - Supports pagination with page and page_size.
  - Validates query bounds (page < 1 -> 422, page_size > 50 -> 422).
  - Verifies ApiResponse structure and currency formatting (49.000 VNĐ).
- `GET /api/pricing/billing/invoices/{transaction_code}`:
  - Enforces JWT authentication (401 Unauthorized for guests).
  - Allows transaction owner to view complete invoice receipt (200 OK).
  - Allows system administrator to view any user's invoice (200 OK).
  - Forbids access by unauthorized non-owner users (403 Forbidden).
  - Returns 404 Not Found for non-existent transaction codes.
  - Validates full invoice detail fields against database records.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.subscription import (
    BillingCycle,
    PaymentMethod,
    PaymentStatus,
    PaymentTransaction,
    PricingPlan,
    seed_pricing_plans,
)
from tests.security_fixtures import AuthUserFixture


@pytest.fixture(autouse=True)
def seed_plans(db_session: Session):
    """Seed pricing plans into the in-memory test database."""
    seed_pricing_plans(db_session)


# ── Billing History Endpoint Tests ──────────────────────────────────────────


def test_billing_history_unauthenticated_returns_401(security_client: TestClient):
    """Guest requests without Bearer token must be rejected with 401 Unauthorized."""
    res = security_client.get("/api/pricing/billing/history")
    assert res.status_code == 401


def test_billing_history_empty_returns_empty_list(
    security_client: TestClient,
    free_user: AuthUserFixture,
):
    """User with no transaction records receives an empty list with total_count=0."""
    res = security_client.get("/api/pricing/billing/history", headers=free_user.headers)
    assert res.status_code == 200

    body = res.json()
    assert body["success"] is True
    data = body["data"]
    assert data["items"] == []
    assert data["total_count"] == 0
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert data["total_pages"] == 1


def test_billing_history_user_isolation(
    security_client: TestClient,
    db_session: Session,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """User A cannot view transactions belonging to User B."""
    tenant_1, tenant_2 = tenant_users
    plan = db_session.query(PricingPlan).filter(PricingPlan.code == "pro_monthly").first()

    now = datetime.now(timezone.utc)
    tx1 = PaymentTransaction(
        transaction_code="TXN-TENANT1-001",
        user_id=tenant_1.user.id,
        plan_id=plan.id,
        amount_vnd=49000,
        payment_method=PaymentMethod.VIETQR.value,
        payment_status=PaymentStatus.COMPLETED.value,
        created_at=now - timedelta(hours=2),
    )
    tx2 = PaymentTransaction(
        transaction_code="TXN-TENANT1-002",
        user_id=tenant_1.user.id,
        plan_id=plan.id,
        amount_vnd=49000,
        payment_method=PaymentMethod.VIETQR.value,
        payment_status=PaymentStatus.PENDING.value,
        created_at=now - timedelta(hours=1),
    )
    tx_other = PaymentTransaction(
        transaction_code="TXN-TENANT2-001",
        user_id=tenant_2.user.id,
        plan_id=plan.id,
        amount_vnd=49000,
        payment_method=PaymentMethod.VIETQR.value,
        payment_status=PaymentStatus.COMPLETED.value,
        created_at=now,
    )
    db_session.add_all([tx1, tx2, tx_other])
    db_session.commit()

    # Tenant 1 checks history -> sees 2 transactions, TXN-TENANT2-001 is excluded
    res_1 = security_client.get("/api/pricing/billing/history", headers=tenant_1.headers)
    assert res_1.status_code == 200
    codes_1 = [item["transaction_code"] for item in res_1.json()["data"]["items"]]
    assert len(codes_1) == 2
    assert "TXN-TENANT1-001" in codes_1
    assert "TXN-TENANT1-002" in codes_1
    assert "TXN-TENANT2-001" not in codes_1

    # Tenant 2 checks history -> sees only 1 transaction
    res_2 = security_client.get("/api/pricing/billing/history", headers=tenant_2.headers)
    assert res_2.status_code == 200
    codes_2 = [item["transaction_code"] for item in res_2.json()["data"]["items"]]
    assert codes_2 == ["TXN-TENANT2-001"]


def test_billing_history_chronological_ordering(
    security_client: TestClient,
    db_session: Session,
    free_user: AuthUserFixture,
):
    """Transactions must be ordered by created_at DESC, then id DESC."""
    plan = db_session.query(PricingPlan).filter(PricingPlan.code == "pro_monthly").first()
    now = datetime.now(timezone.utc)

    t1 = PaymentTransaction(
        transaction_code="TXN-ORDER-OLDEST",
        user_id=free_user.user.id,
        plan_id=plan.id,
        amount_vnd=49000,
        payment_method=PaymentMethod.VIETQR.value,
        payment_status=PaymentStatus.COMPLETED.value,
        created_at=now - timedelta(days=3),
    )
    t2 = PaymentTransaction(
        transaction_code="TXN-ORDER-MIDDLE",
        user_id=free_user.user.id,
        plan_id=plan.id,
        amount_vnd=49000,
        payment_method=PaymentMethod.VIETQR.value,
        payment_status=PaymentStatus.COMPLETED.value,
        created_at=now - timedelta(days=2),
    )
    t3 = PaymentTransaction(
        transaction_code="TXN-ORDER-NEWEST",
        user_id=free_user.user.id,
        plan_id=plan.id,
        amount_vnd=49000,
        payment_method=PaymentMethod.VIETQR.value,
        payment_status=PaymentStatus.PENDING.value,
        created_at=now - timedelta(days=1),
    )
    db_session.add_all([t1, t2, t3])
    db_session.commit()

    res = security_client.get("/api/pricing/billing/history", headers=free_user.headers)
    assert res.status_code == 200
    codes = [item["transaction_code"] for item in res.json()["data"]["items"]]
    assert codes == ["TXN-ORDER-NEWEST", "TXN-ORDER-MIDDLE", "TXN-ORDER-OLDEST"]


def test_billing_history_status_filter(
    security_client: TestClient,
    db_session: Session,
    free_user: AuthUserFixture,
):
    """Filtering by status accurately isolates records matching the requested lifecycle state."""
    plan = db_session.query(PricingPlan).filter(PricingPlan.code == "pro_monthly").first()
    now = datetime.now(timezone.utc)

    statuses = [
        ("TXN-STATUS-PENDING", PaymentStatus.PENDING.value),
        ("TXN-STATUS-COMPLETED", PaymentStatus.COMPLETED.value),
        ("TXN-STATUS-FAILED", PaymentStatus.FAILED.value),
        ("TXN-STATUS-EXPIRED", PaymentStatus.EXPIRED.value),
    ]
    for code, st in statuses:
        db_session.add(
            PaymentTransaction(
                transaction_code=code,
                user_id=free_user.user.id,
                plan_id=plan.id,
                amount_vnd=49000,
                payment_method=PaymentMethod.VIETQR.value,
                payment_status=st,
                created_at=now,
            )
        )
    db_session.commit()

    headers = free_user.headers

    # Filter completed
    res_completed = security_client.get("/api/pricing/billing/history?status=completed", headers=headers)
    assert res_completed.status_code == 200
    items = res_completed.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["transaction_code"] == "TXN-STATUS-COMPLETED"
    assert items[0]["payment_status"] == "completed"

    # Filter pending
    res_pending = security_client.get("/api/pricing/billing/history?status=pending", headers=headers)
    assert res_pending.status_code == 200
    items_p = res_pending.json()["data"]["items"]
    assert len(items_p) == 1
    assert items_p[0]["transaction_code"] == "TXN-STATUS-PENDING"

    # Filter failed
    res_failed = security_client.get("/api/pricing/billing/history?status=failed", headers=headers)
    assert res_failed.status_code == 200
    items_f = res_failed.json()["data"]["items"]
    assert len(items_f) == 1
    assert items_f[0]["transaction_code"] == "TXN-STATUS-FAILED"

    # Filter expired
    res_expired = security_client.get("/api/pricing/billing/history?status=expired", headers=headers)
    assert res_expired.status_code == 200
    items_e = res_expired.json()["data"]["items"]
    assert len(items_e) == 1
    assert items_e[0]["transaction_code"] == "TXN-STATUS-EXPIRED"

    # Filter all
    res_all = security_client.get("/api/pricing/billing/history?status=all", headers=headers)
    assert res_all.status_code == 200
    assert len(res_all.json()["data"]["items"]) == 4


def test_billing_history_pagination(
    security_client: TestClient,
    db_session: Session,
    free_user: AuthUserFixture,
):
    """Pagination parameters page and page_size correctly slice returned transaction batches."""
    plan = db_session.query(PricingPlan).filter(PricingPlan.code == "pro_monthly").first()
    now = datetime.now(timezone.utc)

    for i in range(5):
        db_session.add(
            PaymentTransaction(
                transaction_code=f"TXN-PAGE-{i+1:02d}",
                user_id=free_user.user.id,
                plan_id=plan.id,
                amount_vnd=49000,
                payment_method=PaymentMethod.VIETQR.value,
                payment_status=PaymentStatus.COMPLETED.value,
                created_at=now - timedelta(minutes=(5 - i)),
            )
        )
    db_session.commit()

    headers = free_user.headers

    # Page 1, size 2 -> items 1, 2 (newest)
    res_p1 = security_client.get("/api/pricing/billing/history?page=1&page_size=2", headers=headers)
    assert res_p1.status_code == 200
    d1 = res_p1.json()["data"]
    assert len(d1["items"]) == 2
    assert d1["total_count"] == 5
    assert d1["page"] == 1
    assert d1["page_size"] == 2
    assert d1["total_pages"] == 3
    assert d1["items"][0]["transaction_code"] == "TXN-PAGE-05"
    assert d1["items"][1]["transaction_code"] == "TXN-PAGE-04"

    # Page 2, size 2 -> items 3, 4
    res_p2 = security_client.get("/api/pricing/billing/history?page=2&page_size=2", headers=headers)
    assert res_p2.status_code == 200
    d2 = res_p2.json()["data"]
    assert len(d2["items"]) == 2
    assert d2["items"][0]["transaction_code"] == "TXN-PAGE-03"
    assert d2["items"][1]["transaction_code"] == "TXN-PAGE-02"

    # Page 3, size 2 -> item 5 (last)
    res_p3 = security_client.get("/api/pricing/billing/history?page=3&page_size=2", headers=headers)
    assert res_p3.status_code == 200
    d3 = res_p3.json()["data"]
    assert len(d3["items"]) == 1
    assert d3["items"][0]["transaction_code"] == "TXN-PAGE-01"


def test_billing_history_query_validation_errors(
    security_client: TestClient,
    free_user: AuthUserFixture,
):
    """Query parameter bound violations return 422 Unprocessable Entity."""
    headers = free_user.headers

    # page < 1
    res_page_zero = security_client.get("/api/pricing/billing/history?page=0", headers=headers)
    assert res_page_zero.status_code == 422

    # page_size < 1
    res_size_zero = security_client.get("/api/pricing/billing/history?page_size=0", headers=headers)
    assert res_size_zero.status_code == 422

    # page_size > 50
    res_size_huge = security_client.get("/api/pricing/billing/history?page_size=51", headers=headers)
    assert res_size_huge.status_code == 422


def test_billing_history_response_structure_and_formatting(
    security_client: TestClient,
    db_session: Session,
    free_user: AuthUserFixture,
):
    """Verify detailed fields and Vietnamese currency formatting in transaction items."""
    plan = db_session.query(PricingPlan).filter(PricingPlan.code == "pro_yearly").first()
    now = datetime.now(timezone.utc)

    db_session.add(
        PaymentTransaction(
            transaction_code="TXN-FMT-YEARLY",
            user_id=free_user.user.id,
            plan_id=plan.id,
            amount_vnd=399000,
            payment_method=PaymentMethod.VIETQR.value,
            payment_status=PaymentStatus.COMPLETED.value,
            payment_note="PRO YEARLY MEMO",
            paid_at=now,
            created_at=now,
        )
    )
    db_session.commit()

    res = security_client.get("/api/pricing/billing/history", headers=free_user.headers)
    assert res.status_code == 200
    item = res.json()["data"]["items"][0]
    assert item["transaction_code"] == "TXN-FMT-YEARLY"
    assert item["invoice_number"] == "INV-TXN-FMT-YEARLY"
    assert item["plan_code"] == "pro_yearly"
    assert item["plan_name"] == "Gói Pro Hàng Năm"
    assert item["billing_cycle"] == BillingCycle.YEARLY.value
    assert item["amount_vnd"] == 399000
    assert item["amount_display"] == "399.000 VNĐ"
    assert item["payment_method"] == "vietqr"
    assert item["payment_status"] == "completed"
    assert item["payment_note"] == "PRO YEARLY MEMO"
    assert item["paid_at"] is not None
    assert item["created_at"] is not None


# ── Invoice Detail Endpoint Tests ───────────────────────────────────────────


def test_invoice_detail_unauthenticated_returns_401(security_client: TestClient):
    """Guest requests to invoice endpoint must be rejected with 401 Unauthorized."""
    res = security_client.get("/api/pricing/billing/invoices/TXN-ANY")
    assert res.status_code == 401


def test_invoice_detail_owner_can_view_invoice(
    security_client: TestClient,
    db_session: Session,
    free_user: AuthUserFixture,
):
    """Transaction owner can view complete electronic invoice receipt with 200 OK."""
    plan = db_session.query(PricingPlan).filter(PricingPlan.code == "pro_monthly").first()
    now = datetime.now(timezone.utc)

    db_session.add(
        PaymentTransaction(
            transaction_code="TXN-INV-OWNER",
            user_id=free_user.user.id,
            plan_id=plan.id,
            amount_vnd=49000,
            payment_method=PaymentMethod.VIETQR.value,
            payment_status=PaymentStatus.COMPLETED.value,
            payment_note="MEMO-INV-01",
            qr_code_url="https://img.vietqr.io/image/test.png",
            paid_at=now,
            created_at=now,
        )
    )
    db_session.commit()

    res = security_client.get(
        "/api/pricing/billing/invoices/TXN-INV-OWNER",
        headers=free_user.headers,
    )
    assert res.status_code == 200

    body = res.json()
    assert body["success"] is True
    inv = body["data"]

    # Verify buyer info
    assert inv["buyer_name"] == free_user.user.full_name
    assert inv["buyer_email"] == free_user.user.email

    # Verify invoice codes and dates
    assert inv["invoice_number"] == "INV-TXN-INV-OWNER"
    assert inv["transaction_code"] == "TXN-INV-OWNER"
    assert inv["issued_at"] is not None
    assert inv["paid_at"] is not None

    # Verify plan specifications
    assert inv["plan_code"] == "pro_monthly"
    assert inv["plan_name"] == "Gói Pro Hàng Tháng"
    assert inv["billing_cycle"] == "monthly"
    assert inv["duration_days"] == 30

    # Verify payment breakdown and 0% VAT
    assert inv["amount_vnd"] == 49000
    assert inv["amount_display"] == "49.000 VNĐ"
    assert inv["tax_rate_percent"] == 0
    assert inv["tax_amount_vnd"] == 0
    assert inv["total_amount_vnd"] == 49000
    assert inv["total_amount_display"] == "49.000 VNĐ"

    # Verify reconciliation metadata
    assert inv["payment_note"] == "MEMO-INV-01"
    assert inv["qr_code_url"] == "https://img.vietqr.io/image/test.png"


def test_invoice_detail_admin_can_access_any_invoice(
    security_client: TestClient,
    db_session: Session,
    free_user: AuthUserFixture,
    admin_user: AuthUserFixture,
):
    """Administrator is authorized to access and inspect any user's invoice."""
    plan = db_session.query(PricingPlan).filter(PricingPlan.code == "pro_monthly").first()
    now = datetime.now(timezone.utc)

    db_session.add(
        PaymentTransaction(
            transaction_code="TXN-ADMIN-AUDIT",
            user_id=free_user.user.id,
            plan_id=plan.id,
            amount_vnd=49000,
            payment_method=PaymentMethod.VIETQR.value,
            payment_status=PaymentStatus.COMPLETED.value,
            created_at=now,
        )
    )
    db_session.commit()

    # Admin requests User's invoice
    res = security_client.get(
        "/api/pricing/billing/invoices/TXN-ADMIN-AUDIT",
        headers=admin_user.headers,
    )
    assert res.status_code == 200
    inv = res.json()["data"]
    assert inv["transaction_code"] == "TXN-ADMIN-AUDIT"
    assert inv["buyer_email"] == free_user.user.email


def test_invoice_detail_non_owner_forbidden(
    security_client: TestClient,
    db_session: Session,
    tenant_users: tuple[AuthUserFixture, AuthUserFixture],
):
    """Regular user attempting to inspect another user's invoice receives 403 Forbidden."""
    tenant_1, tenant_2 = tenant_users
    plan = db_session.query(PricingPlan).filter(PricingPlan.code == "pro_monthly").first()
    now = datetime.now(timezone.utc)

    db_session.add(
        PaymentTransaction(
            transaction_code="TXN-SECRET-USER",
            user_id=tenant_1.user.id,
            plan_id=plan.id,
            amount_vnd=49000,
            payment_method=PaymentMethod.VIETQR.value,
            payment_status=PaymentStatus.COMPLETED.value,
            created_at=now,
        )
    )
    db_session.commit()

    # Tenant 2 attempts access to Tenant 1's invoice -> 403 Forbidden
    res = security_client.get(
        "/api/pricing/billing/invoices/TXN-SECRET-USER",
        headers=tenant_2.headers,
    )
    assert res.status_code == 403
    body = res.json()
    assert body["error_code"] == "INVOICE_FORBIDDEN"


def test_invoice_detail_not_found(
    security_client: TestClient,
    free_user: AuthUserFixture,
):
    """Requesting an invoice for a non-existent transaction code returns 404 Not Found."""
    res = security_client.get(
        "/api/pricing/billing/invoices/TXN-DOES-NOT-EXIST",
        headers=free_user.headers,
    )
    assert res.status_code == 404
    body = res.json()
    assert body["error_code"] == "NOT_FOUND"
