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

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Session, relationship

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

DEFAULT_PRICING_PLANS: list[dict] = [
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

    id: int = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code: str = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique plan identifier: pro_monthly | pro_yearly.",
    )
    name: str = Column(
        String(100),
        nullable=False,
        comment="Human-readable display name of the plan.",
    )
    billing_cycle: str = Column(
        String(20),
        nullable=False,
        comment="Billing cycle: monthly | yearly.",
    )
    price_vnd: int = Column(
        Integer,
        nullable=False,
        comment="Actual price in VND (e.g. 49000 or 399000).",
    )
    original_price_vnd: int | None = Column(
        Integer,
        nullable=True,
        comment="Original undiscounted price in VND (e.g. 588000 for yearly).",
    )
    discount_percent: int = Column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="Discount percentage compared to monthly rate.",
    )
    duration_days: int = Column(
        Integer,
        nullable=False,
        comment="Validity duration in days (30 for monthly, 365 for yearly).",
    )
    max_file_size_mb: int = Column(
        Integer,
        nullable=False,
        default=100,
        server_default="100",
        comment="Maximum upload file size in MB granted by this plan.",
    )
    max_ocr_pages: int = Column(
        Integer,
        nullable=False,
        default=500,
        server_default="500",
        comment="Maximum OCR pages per document granted by this plan.",
    )
    features_json: str | None = Column(
        Text,
        nullable=True,
        comment="JSON-encoded list of plan feature descriptions.",
    )
    is_active: bool = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
        comment="True if the plan is currently available for purchase.",
    )
    created_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the plan was created.",
    )

    subscriptions = relationship("Subscription", back_populates="plan")
    transactions = relationship("PaymentTransaction", back_populates="plan")

    @property
    def features(self) -> list[str]:
        """Parse `features_json` into a Python list of strings."""
        if not self.features_json:
            return []
        try:
            parsed = json.loads(self.features_json)
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

    id: int = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id: int = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Owner user ID.",
    )
    plan_id: int = Column(
        Integer,
        ForeignKey("pricing_plans.id"),
        nullable=False,
        index=True,
        comment="Subscribed pricing plan ID.",
    )
    status: str = Column(
        String(20),
        nullable=False,
        default=SubscriptionStatus.ACTIVE.value,
        server_default=SubscriptionStatus.ACTIVE.value,
        comment="Subscription status: active | expired | cancelled | grace_period.",
    )
    started_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the subscription started.",
    )
    expires_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="UTC timestamp when the subscription expires.",
    )
    auto_renew: bool = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
        comment="Whether automatic renewal is enabled.",
    )
    cancelled_at: datetime | None = Column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        comment="UTC timestamp when the user requested cancellation.",
    )
    created_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the subscription record was created.",
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp of the last subscription update.",
    )

    user = relationship("User", back_populates="subscriptions")
    plan = relationship("PricingPlan", back_populates="subscriptions")
    transactions = relationship("PaymentTransaction", back_populates="subscription")

    def __repr__(self) -> str:
        return (
            f"<Subscription id={self.id} user_id={self.user_id} "
            f"plan_id={self.plan_id} status={self.status!r}>"
        )


class PaymentTransaction(Base):
    """SQLAlchemy ORM model for the `payment_transactions` table."""

    __tablename__ = "payment_transactions"

    id: int = Column(Integer, primary_key=True, index=True, autoincrement=True)
    transaction_code: str = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique transaction reference code.",
    )
    user_id: int = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="User who initiated the transaction.",
    )
    plan_id: int = Column(
        Integer,
        ForeignKey("pricing_plans.id"),
        nullable=False,
        comment="Target pricing plan for this transaction.",
    )
    subscription_id: int | None = Column(
        Integer,
        ForeignKey("subscriptions.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        comment="Resulting subscription ID once payment completes.",
    )
    amount_vnd: int = Column(
        Integer,
        nullable=False,
        comment="Transaction amount in VND (e.g. 49000 or 399000).",
    )
    payment_method: str = Column(
        String(50),
        nullable=False,
        default=PaymentMethod.VIETQR.value,
        server_default=PaymentMethod.VIETQR.value,
        comment="Payment method: vietqr | bank_transfer | momo | test_simulator.",
    )
    payment_status: str = Column(
        String(20),
        nullable=False,
        default=PaymentStatus.PENDING.value,
        server_default=PaymentStatus.PENDING.value,
        comment="Transaction status: pending | completed | failed | expired.",
    )
    qr_code_url: str | None = Column(
        Text,
        nullable=True,
        default=None,
        comment="Generated Napas247 VietQR image URL.",
    )
    payment_note: str | None = Column(
        String(100),
        nullable=True,
        default=None,
        comment="Bank transfer memo / description for reconciliation.",
    )
    paid_at: datetime | None = Column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        comment="UTC timestamp when payment was confirmed.",
    )
    created_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the transaction was created.",
    )

    user = relationship("User", back_populates="payment_transactions")
    plan = relationship("PricingPlan", back_populates="transactions")
    subscription = relationship("Subscription", back_populates="transactions")

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
            .filter(PricingPlan.code == plan_data["code"])
            .first()
        )
        if existing is None:
            plan = PricingPlan(**plan_data)
            db.add(plan)
            seeded_plans.append(plan)
        else:
            existing.name = plan_data["name"]
            existing.billing_cycle = plan_data["billing_cycle"]
            existing.price_vnd = plan_data["price_vnd"]
            existing.original_price_vnd = plan_data["original_price_vnd"]
            existing.discount_percent = plan_data["discount_percent"]
            existing.duration_days = plan_data["duration_days"]
            existing.max_file_size_mb = plan_data["max_file_size_mb"]
            existing.max_ocr_pages = plan_data["max_ocr_pages"]
            existing.features_json = plan_data["features_json"]
            existing.is_active = plan_data["is_active"]
            seeded_plans.append(existing)

    db.commit()
    for plan in seeded_plans:
        db.refresh(plan)
    return seeded_plans

