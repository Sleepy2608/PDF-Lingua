"""
Subscription & Pricing Plan ORM Models
--------------------------------------
Defines the `pricing_plans`, `subscriptions`, and `payment_transactions` tables
for the PDF-Lingua database.

Tables
------
pricing_plans        : Catalog of available subscription plans (pro_monthly, pro_yearly).
subscriptions        : Active and historical user subscription records.
payment_transactions : Payment transaction records and VietQR metadata.
"""

import enum
import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from app.core.database import Base


class BillingCycle(str, enum.Enum):
    """Supported billing cycles for paid plans."""

    MONTHLY = "monthly"
    YEARLY = "yearly"


class SubscriptionStatus(str, enum.Enum):
    """Lifecycle states of a user subscription."""

    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    GRACE_PERIOD = "grace_period"


class PaymentStatus(str, enum.Enum):
    """Lifecycle states of a payment transaction."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class PaymentMethod(str, enum.Enum):
    """Supported payment methods."""

    VIETQR = "vietqr"
    BANK_TRANSFER = "bank_transfer"
    MOMO = "momo"
    TEST_SIMULATOR = "test_simulator"


PRO_SHARED_FEATURES: list[str] = [
    "Tải lên tệp PDF siêu lớn đến 100 MB",
    "Nhận dạng OCR chuyên sâu đến 500 trang",
    "Trợ lý AI Hỏi đáp (AI Copilot) không giới hạn",
    "Tóm tắt thông minh AI Summary & bảng thuật ngữ",
    "Hàng đợi ưu tiên tốc độ cao (Fast-track Worker)",
    "Kho lưu trữ tài liệu cá nhân không giới hạn",
    "Huy hiệu Pro VIP ánh kim trên hồ sơ và giao diện",
    "Hỗ trợ xuất tài liệu sang Microsoft Word (.docx)",
]

DEFAULT_PRICING_PLANS: list[dict[str, Any]] = [
    {
        "code": "pro_monthly",
        "name": "Gói Pro Hàng Tháng",
        "billing_cycle": BillingCycle.MONTHLY.value,
        "price_vnd": 49000,
        "original_price_vnd": 49000,
        "discount_percent": 0,
        "duration_days": 30,
        "max_file_size_mb": 100,
        "max_ocr_pages": 500,
        "features_json": json.dumps(PRO_SHARED_FEATURES, ensure_ascii=False),
        "is_active": True,
    },
    {
        "code": "pro_yearly",
        "name": "Gói Pro Hàng Năm",
        "billing_cycle": BillingCycle.YEARLY.value,
        "price_vnd": 399000,
        "original_price_vnd": 588000,
        "discount_percent": 32,
        "duration_days": 365,
        "max_file_size_mb": 100,
        "max_ocr_pages": 500,
        "features_json": json.dumps(PRO_SHARED_FEATURES, ensure_ascii=False),
        "is_active": True,
    },
]


class PricingPlan(Base):
    """SQLAlchemy ORM model for the `pricing_plans` table."""

    __tablename__ = "pricing_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique plan identifier: pro_monthly | pro_yearly.",
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Human-readable display name of the plan.",
    )
    billing_cycle: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Billing cycle: monthly | yearly.",
    )
    price_vnd: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Actual price in VND (e.g. 49000 or 399000).",
    )
    original_price_vnd: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Original undiscounted price in VND (e.g. 588000 for yearly).",
    )
    discount_percent: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="Discount percentage compared to monthly rate.",
    )
    duration_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Validity duration in days (30 for monthly, 365 for yearly).",
    )
    max_file_size_mb: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=100,
        server_default="100",
        comment="Maximum upload file size in MB granted by this plan.",
    )
    max_ocr_pages: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=500,
        server_default="500",
        comment="Maximum OCR pages per document granted by this plan.",
    )
    features_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON-encoded list of plan feature descriptions.",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
        comment="True if the plan is currently available for purchase.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the plan was created.",
    )

    subscriptions: Mapped[list["Subscription"]] = relationship("Subscription", back_populates="plan")
    transactions: Mapped[list["PaymentTransaction"]] = relationship("PaymentTransaction", back_populates="plan")

    @property
    def features(self) -> list[str]:
        """Parse `features_json` into a Python list of strings."""
        raw_json = self.features_json
        if not raw_json:
            return []
        try:
            parsed = json.loads(raw_json)
            return [str(item) for item in parsed] if isinstance(parsed, list) else []
        except (ValueError, TypeError):
            return []

    def __repr__(self) -> str:
        return (
            f"<PricingPlan id={self.id} code={self.code!r} "
            f"price_vnd={self.price_vnd} cycle={self.billing_cycle!r}>"
        )


class Subscription(Base):
    """SQLAlchemy ORM model for the `subscriptions` table."""

    __tablename__ = "subscriptions"
    __table_args__ = (
        Index("idx_subscriptions_user_status", "user_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Owner user ID.",
    )
    plan_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pricing_plans.id"),
        nullable=False,
        index=True,
        comment="Subscribed pricing plan ID.",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=SubscriptionStatus.ACTIVE.value,
        server_default=SubscriptionStatus.ACTIVE.value,
        comment="Subscription status: active | expired | cancelled | grace_period.",
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the subscription started.",
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="UTC timestamp when the subscription expires.",
    )
    auto_renew: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
        comment="Whether automatic renewal is enabled.",
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        comment="UTC timestamp when the user requested cancellation.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the subscription record was created.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp of the last subscription update.",
    )

    user = relationship("User", back_populates="subscriptions")
    plan: Mapped["PricingPlan"] = relationship("PricingPlan", back_populates="subscriptions")
    transactions: Mapped[list["PaymentTransaction"]] = relationship("PaymentTransaction", back_populates="subscription")

    def __repr__(self) -> str:
        return (
            f"<Subscription id={self.id} user_id={self.user_id} "
            f"plan_id={self.plan_id} status={self.status!r}>"
        )


class PaymentTransaction(Base):
    """SQLAlchemy ORM model for the `payment_transactions` table."""

    __tablename__ = "payment_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    transaction_code: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique transaction reference code.",
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="User who initiated the transaction.",
    )
    plan_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pricing_plans.id"),
        nullable=False,
        comment="Target pricing plan for this transaction.",
    )
    subscription_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("subscriptions.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        comment="Resulting subscription ID once payment completes.",
    )
    amount_vnd: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Transaction amount in VND (e.g. 49000 or 399000).",
    )
    payment_method: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=PaymentMethod.VIETQR.value,
        server_default=PaymentMethod.VIETQR.value,
        comment="Payment method: vietqr | bank_transfer | momo | test_simulator.",
    )
    payment_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PaymentStatus.PENDING.value,
        server_default=PaymentStatus.PENDING.value,
        comment="Transaction status: pending | completed | failed | expired.",
    )
    qr_code_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Generated Napas247 VietQR image URL.",
    )
    payment_note: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        default=None,
        comment="Bank transfer memo / description for reconciliation.",
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        comment="UTC timestamp when payment was confirmed.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the transaction was created.",
    )

    user = relationship("User", back_populates="payment_transactions")
    plan: Mapped["PricingPlan"] = relationship("PricingPlan", back_populates="transactions")
    subscription: Mapped["Subscription | None"] = relationship("Subscription", back_populates="transactions")

    def __repr__(self) -> str:
        return (
            f"<PaymentTransaction id={self.id} code={self.transaction_code!r} "
            f"amount_vnd={self.amount_vnd} status={self.payment_status!r}>"
        )


def seed_pricing_plans(db: Session) -> list[PricingPlan]:
    """
    Idempotently seed the default Pro Monthly (49,000 VND) and Pro Yearly (399,000 VND)
    pricing plans into the database. Existing plans matched by `code` are kept up-to-date.
    """
    seeded_plans: list[PricingPlan] = []
    for plan_data in DEFAULT_PRICING_PLANS:
        existing = (
            db.query(PricingPlan)
            .filter(PricingPlan.code == str(plan_data["code"]))
            .first()
        )
        if existing is None:
            plan = PricingPlan(**plan_data)
            db.add(plan)
            seeded_plans.append(plan)
        else:
            existing.name = str(plan_data["name"])
            existing.billing_cycle = str(plan_data["billing_cycle"])
            existing.price_vnd = int(plan_data["price_vnd"])
            existing.original_price_vnd = (
                int(plan_data["original_price_vnd"])
                if plan_data.get("original_price_vnd") is not None
                else None
            )
            existing.discount_percent = int(plan_data["discount_percent"])
            existing.duration_days = int(plan_data["duration_days"])
            existing.max_file_size_mb = int(plan_data["max_file_size_mb"])
            existing.max_ocr_pages = int(plan_data["max_ocr_pages"])
            existing.features_json = (
                str(plan_data["features_json"])
                if plan_data.get("features_json") is not None
                else None
            )
            existing.is_active = bool(plan_data["is_active"])
            seeded_plans.append(existing)

    db.commit()
    for plan in seeded_plans:
        db.refresh(plan)
    return seeded_plans
