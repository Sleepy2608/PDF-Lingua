"""
Subscription & Pricing Service Layer
------------------------------------
Encapsulates all business logic for pricing plans, subscription lifecycle,
VietQR checkout generation, payment confirmation, and automatic expiration:
- `get_pricing_catalog`: Returns Free and Pro (Monthly 49k / Yearly 399k) plans.
- `get_user_subscription`: Inspects and enforces expiration on user subscriptions.
- `create_subscription_transaction`: Creates pending transaction with Napas247 VietQR URL.
- `get_transaction_status`: Retrieves transaction state for client polling with ownership check.
- `confirm_transaction_payment`: Idempotently activates or extends Pro subscription (+30d / +365d).
- `process_payment_webhook`: Reconciles incoming bank transfer webhooks.
- `cancel_subscription`: Cancels automatic renewal on active subscription.
- `expire_overdue_subscriptions`: Batch-expires overdue subscriptions and downgrades roles.
"""

import math
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.models.subscription import (
    PRO_SHARED_FEATURES,
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
from app.schemas.pricing import (
    BankInfoSchema,
    FreeTierPlanSchema,
    MySubscriptionResponse,
    PaymentWebhookRequest,
    PricingCatalogResponse,
    ProPlanItemSchema,
    ProTierCatalogSchema,
    SubscribeResponse,
    SubscriptionDetailSchema,
    TransactionStatusResponse,
)

FREE_TIER_FEATURES: list[str] = [
    "Tải lên tệp PDF tối đa 20 MB",
    "Nhận diện OCR tối đa 100 trang",
    "Dịch thuật song ngữ thông minh tiêu chuẩn",
    "Lưu trữ 5 tài liệu gần đây",
    "Hỗ trợ xuất tệp TXT và PDF Song ngữ",
]


def _ensure_utc(dt: datetime) -> datetime:
    """Normalize a naive or timezone-aware datetime to UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _format_vnd(amount: int, suffix: str = "đ") -> str:
    """Format an integer amount in VND with dot thousand separators (e.g. 49.000đ)."""
    formatted = f"{amount:,}".replace(",", ".")
    return f"{formatted}{suffix}"


def _build_plan_item_schema(plan: PricingPlan) -> ProPlanItemSchema:
    """Convert a `PricingPlan` ORM model into a `ProPlanItemSchema`."""
    is_yearly = plan.billing_cycle == BillingCycle.YEARLY.value
    period_display = "/ năm" if is_yearly else "/ tháng"
    monthly_equivalent: Optional[str] = None
    badge: Optional[str] = None

    if is_yearly:
        monthly_eq_amount = round(plan.price_vnd / 12)
        monthly_equivalent = f"{_format_vnd(monthly_eq_amount)} / tháng"
        if plan.discount_percent > 0:
            badge = f"TIẾT KIỆM {plan.discount_percent}%"

    return ProPlanItemSchema(
        code=plan.code,
        name=plan.name,
        price_vnd=plan.price_vnd,
        original_price_vnd=plan.original_price_vnd or plan.price_vnd,
        discount_percent=plan.discount_percent,
        billing_cycle=plan.billing_cycle,
        duration_days=plan.duration_days,
        price_display=_format_vnd(plan.price_vnd),
        period_display=period_display,
        monthly_equivalent=monthly_equivalent,
        badge=badge,
    )


def _build_subscription_detail(sub: Subscription, now: Optional[datetime] = None) -> SubscriptionDetailSchema:
    """Convert a `Subscription` ORM model into a `SubscriptionDetailSchema`."""
    current_time = _ensure_utc(now or datetime.now(timezone.utc))
    started_at = _ensure_utc(sub.started_at)
    expires_at = _ensure_utc(sub.expires_at)

    remaining_seconds = (expires_at - current_time).total_seconds()
    days_remaining = max(0, math.ceil(remaining_seconds / 86400)) if remaining_seconds > 0 else 0

    plan = sub.plan
    return SubscriptionDetailSchema(
        id=sub.id,
        user_id=sub.user_id,
        plan_code=plan.code if plan else "pro_monthly",
        plan_name=plan.name if plan else "Gói Pro",
        billing_cycle=plan.billing_cycle if plan else BillingCycle.MONTHLY.value,
        status=sub.status,
        started_at=started_at,
        expires_at=expires_at,
        days_remaining=days_remaining,
        auto_renew=sub.auto_renew,
        cancelled_at=_ensure_utc(sub.cancelled_at) if sub.cancelled_at else None,
    )


class SubscriptionService:
    """Service managing pricing plans, checkout transactions, and user subscriptions."""

    @staticmethod
    def ensure_plans_seeded(db: Session) -> dict[str, PricingPlan]:
        """Ensure default pricing plans exist in the database and return them keyed by code."""
        plans = (
            db.query(PricingPlan)
            .filter(PricingPlan.is_active.is_(True))
            .all()
        )
        by_code = {p.code: p for p in plans}
        if "pro_monthly" not in by_code or "pro_yearly" not in by_code:
            seeded = seed_pricing_plans(db)
            by_code = {p.code: p for p in seeded if p.is_active}
        return by_code

    @staticmethod
    def get_pricing_catalog(db: Session) -> PricingCatalogResponse:
        """Return the complete Free and Pro pricing catalog for `GET /api/pricing/plans`."""
        plans_by_code = SubscriptionService.ensure_plans_seeded(db)
        monthly_plan = plans_by_code["pro_monthly"]
        yearly_plan = plans_by_code["pro_yearly"]

        free_tier = FreeTierPlanSchema(
            code="free",
            name="Miễn Phí",
            price_vnd=0,
            billing_cycle="forever",
            max_file_size_mb=settings.MAX_UPLOAD_SIZE_FREE_MB,
            max_ocr_pages=settings.MAX_PAGES_FREE,
            features=list(FREE_TIER_FEATURES),
        )

        shared_features = monthly_plan.features or list(PRO_SHARED_FEATURES)
        pro_tier = ProTierCatalogSchema(
            monthly=_build_plan_item_schema(monthly_plan),
            yearly=_build_plan_item_schema(yearly_plan),
            shared_features=shared_features,
        )

        return PricingCatalogResponse(
            free_tier=free_tier,
            pro_tier=pro_tier,
        )

    @staticmethod
    def expire_overdue_subscriptions(db: Session, user_id: Optional[int] = None) -> int:
        """
        Scan active subscriptions whose `expires_at` has passed, transition them to
        `expired`, and downgrade the owning user from `pro` back to `free` (unless `admin`
        or covered by another active subscription).
        """
        now = datetime.now(timezone.utc)
        query = db.query(Subscription).filter(
            Subscription.status.in_([
                SubscriptionStatus.ACTIVE.value,
                SubscriptionStatus.GRACE_PERIOD.value,
            ])
        )
        if user_id is not None:
            query = query.filter(Subscription.user_id == user_id)

        candidates = query.all()
        expired_count = 0
        affected_user_ids: set[int] = set()

        for sub in candidates:
            if _ensure_utc(sub.expires_at) <= now:
                sub.status = SubscriptionStatus.EXPIRED.value
                sub.auto_renew = False
                sub.updated_at = now
                expired_count += 1
                affected_user_ids.add(sub.user_id)

        for uid in affected_user_ids:
            # Check if the user has any other non-expired active subscription
            remaining_active = (
                db.query(Subscription)
                .filter(
                    Subscription.user_id == uid,
                    Subscription.status == SubscriptionStatus.ACTIVE.value,
                )
                .all()
            )
            has_valid_sub = any(_ensure_utc(s.expires_at) > now for s in remaining_active)
            if not has_valid_sub:
                owner = db.query(User).filter(User.id == uid).first()
                if owner is not None and owner.role == UserRole.PRO:
                    owner.role = UserRole.FREE

        if expired_count > 0:
            db.commit()

        return expired_count

    @staticmethod
    def get_active_subscription_record(db: Session, user_id: int) -> Optional[Subscription]:
        """Return the latest active subscription for `user_id` after expiring any overdue ones."""
        SubscriptionService.expire_overdue_subscriptions(db, user_id=user_id)
        now = datetime.now(timezone.utc)
        active_subs = (
            db.query(Subscription)
            .filter(
                Subscription.user_id == user_id,
                Subscription.status == SubscriptionStatus.ACTIVE.value,
            )
            .order_by(Subscription.expires_at.desc(), Subscription.id.desc())
            .all()
        )
        for sub in active_subs:
            if _ensure_utc(sub.expires_at) > now:
                return sub
        return None

    @staticmethod
    def get_user_subscription(db: Session, user: User) -> MySubscriptionResponse:
        """Retrieve current role, quota limits, and active subscription for `user`."""
        active_sub = SubscriptionService.get_active_subscription_record(db, user.id)
        db.refresh(user)

        role_val = user.role.value if isinstance(user.role, UserRole) else str(user.role).lower()
        is_pro = role_val in (UserRole.PRO.value, UserRole.ADMIN.value)

        if is_pro:
            max_file_mb = active_sub.plan.max_file_size_mb if (active_sub and active_sub.plan) else settings.MAX_UPLOAD_SIZE_PRO_MB
            max_pages = active_sub.plan.max_ocr_pages if (active_sub and active_sub.plan) else settings.MAX_PAGES_PRO
        else:
            max_file_mb = settings.MAX_UPLOAD_SIZE_FREE_MB
            max_pages = settings.MAX_PAGES_FREE

        return MySubscriptionResponse(
            current_role=role_val,
            is_pro=is_pro,
            max_file_size_mb=max_file_mb,
            max_ocr_pages=max_pages,
            active_subscription=_build_subscription_detail(active_sub) if active_sub else None,
        )

    @staticmethod
    def _generate_unique_transaction_code(db: Session, user_id: int) -> tuple[str, str]:
        """Generate a unique transaction code and bank transfer memo."""
        for _ in range(10):
            rand_digits = f"{secrets.randbelow(90000) + 10000}"
            suffix = secrets.token_hex(1).upper()
            tx_code = f"SUB-{user_id}-{rand_digits}-{suffix}"
            transfer_note = f"SUB {user_id} {rand_digits} {suffix}"
            exists = (
                db.query(PaymentTransaction)
                .filter(PaymentTransaction.transaction_code == tx_code)
                .first()
            )
            if exists is None:
                return tx_code, transfer_note
        raise BadRequestException(
            message="Không thể khởi tạo mã giao dịch duy nhất. Vui lòng thử lại.",
            error_code="TRANSACTION_CODE_GENERATION_FAILED",
        )

    @staticmethod
    def _build_vietqr_url(amount_vnd: int, transfer_note: str) -> str:
        """Construct a Napas247 VietQR dynamic image URL."""
        bank_id = quote(settings.VIETQR_BANK_ID.strip())
        account_no = quote(settings.VIETQR_ACCOUNT_NUMBER.strip())
        encoded_info = quote(transfer_note)
        encoded_name = quote(settings.VIETQR_ACCOUNT_NAME.strip())
        return (
            f"https://img.vietqr.io/image/{bank_id}-{account_no}-compact2.png"
            f"?amount={amount_vnd}&addInfo={encoded_info}&accountName={encoded_name}"
        )

    @staticmethod
    def create_subscription_transaction(
        db: Session,
        user: User,
        plan_code: str,
        payment_method: str = PaymentMethod.VIETQR.value,
    ) -> SubscribeResponse:
        """
        Validate the requested plan, generate a pending `PaymentTransaction` with
        a dynamic Napas247 VietQR URL, and return the checkout payload.
        """
        normalized_code = (plan_code or "").strip().lower()
        plans_by_code = SubscriptionService.ensure_plans_seeded(db)

        plan = plans_by_code.get(normalized_code)
        if plan is None or not plan.is_active:
            raise BadRequestException(
                message=f"Mã gói dịch vụ '{plan_code}' không hợp lệ. Chỉ hỗ trợ 'pro_monthly' hoặc 'pro_yearly'.",
                error_code="INVALID_PLAN_CODE",
                details={"plan_code": plan_code, "allowed_plans": list(plans_by_code.keys())},
            )

        normalized_method = (payment_method or PaymentMethod.VIETQR.value).strip().lower()
        valid_methods = {m.value for m in PaymentMethod}
        if normalized_method not in valid_methods:
            raise BadRequestException(
                message=f"Phương thức thanh toán '{payment_method}' không được hỗ trợ.",
                error_code="INVALID_PAYMENT_METHOD",
                details={"payment_method": payment_method, "allowed_methods": sorted(valid_methods)},
            )

        tx_code, transfer_note = SubscriptionService._generate_unique_transaction_code(db, user.id)
        qr_url = SubscriptionService._build_vietqr_url(plan.price_vnd, transfer_note)

        transaction = PaymentTransaction(
            transaction_code=tx_code,
            user_id=user.id,
            plan_id=plan.id,
            subscription_id=None,
            amount_vnd=plan.price_vnd,
            payment_method=normalized_method,
            payment_status=PaymentStatus.PENDING.value,
            qr_code_url=qr_url,
            payment_note=transfer_note,
            paid_at=None,
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)

        return SubscribeResponse(
            transaction_code=transaction.transaction_code,
            plan_code=plan.code,
            plan_name=plan.name,
            duration_days=plan.duration_days,
            amount_vnd=transaction.amount_vnd,
            amount_display=_format_vnd(transaction.amount_vnd, suffix=" VNĐ"),
            payment_method=transaction.payment_method,
            payment_status=transaction.payment_status,
            qr_code_url=qr_url,
            bank_info=BankInfoSchema(
                bank_name=settings.VIETQR_BANK_NAME,
                account_number=settings.VIETQR_ACCOUNT_NUMBER,
                account_name=settings.VIETQR_ACCOUNT_NAME,
                transfer_note=transfer_note,
            ),
            expires_in_seconds=settings.TRANSACTION_EXPIRE_SECONDS,
        )

    @staticmethod
    def _build_transaction_status_response(
        db: Session,
        tx: PaymentTransaction,
    ) -> TransactionStatusResponse:
        """Build a standardized `TransactionStatusResponse` from a `PaymentTransaction`."""
        owner = db.query(User).filter(User.id == tx.user_id).first()
        role_val = (
            owner.role.value
            if (owner is not None and isinstance(owner.role, UserRole))
            else (str(owner.role).lower() if owner is not None else UserRole.FREE.value)
        )
        plan = tx.plan
        sub = tx.subscription
        return TransactionStatusResponse(
            transaction_code=tx.transaction_code,
            plan_code=plan.code if plan else "pro_monthly",
            plan_name=plan.name if plan else "Gói Pro",
            amount_vnd=tx.amount_vnd,
            payment_method=tx.payment_method,
            payment_status=tx.payment_status,
            paid_at=_ensure_utc(tx.paid_at) if tx.paid_at else None,
            user_role=role_val,
            subscription=_build_subscription_detail(sub) if sub else None,
        )

    @staticmethod
    def get_transaction_status(
        db: Session,
        transaction_code: str,
        current_user: User,
    ) -> TransactionStatusResponse:
        """
        Retrieve the status of a payment transaction.
        Enforces ownership so users cannot inspect another user's transaction
        (administrators are allowed to inspect any transaction).
        """
        code = (transaction_code or "").strip()
        tx = (
            db.query(PaymentTransaction)
            .filter(PaymentTransaction.transaction_code == code)
            .first()
        )
        if tx is None:
            raise NotFoundException(
                message=f"Không tìm thấy giao dịch với mã '{code}'.",
                details={"transaction_code": code},
            )

        user_role = (
            current_user.role
            if isinstance(current_user.role, UserRole)
            else UserRole(str(current_user.role).lower())
        )
        if tx.user_id != current_user.id and user_role != UserRole.ADMIN:
            raise ForbiddenException(
                message="Bạn không có quyền truy cập giao dịch của người dùng khác.",
                error_code="TRANSACTION_FORBIDDEN",
            )

        return SubscriptionService._build_transaction_status_response(db, tx)

    @staticmethod
    def confirm_transaction_payment(
        db: Session,
        transaction_code: str,
        acting_user: Optional[User] = None,
        override_payment_method: Optional[str] = None,
    ) -> TransactionStatusResponse:
        """
        Confirm payment for `transaction_code` idempotently:
        - If `acting_user` is provided, verifies transaction ownership (or admin).
        - If transaction is already `completed`, returns existing state without double-extending.
        - If transaction is `failed` or `expired`, raises `BadRequestException`.
        - Otherwise marks transaction `completed`, creates or extends the user's active
          `Subscription` by `plan.duration_days` (30 or 365 days), and upgrades `user.role`
          to `UserRole.PRO` (preserving `UserRole.ADMIN` if admin).
        """
        code = (transaction_code or "").strip()
        tx = (
            db.query(PaymentTransaction)
            .filter(PaymentTransaction.transaction_code == code)
            .first()
        )
        if tx is None:
            raise NotFoundException(
                message=f"Không tìm thấy giao dịch với mã '{code}'.",
                details={"transaction_code": code},
            )

        if acting_user is not None:
            acting_role = (
                acting_user.role
                if isinstance(acting_user.role, UserRole)
                else UserRole(str(acting_user.role).lower())
            )
            if tx.user_id != acting_user.id and acting_role != UserRole.ADMIN:
                raise ForbiddenException(
                    message="Bạn không có quyền thanh toán hoặc xác nhận giao dịch của người dùng khác.",
                    error_code="TRANSACTION_FORBIDDEN",
                )

        # Idempotency guard: if already completed, return immediately without adding extra days
        if tx.payment_status == PaymentStatus.COMPLETED.value:
            return SubscriptionService._build_transaction_status_response(db, tx)

        if tx.payment_status in (PaymentStatus.FAILED.value, PaymentStatus.EXPIRED.value):
            raise BadRequestException(
                message=f"Giao dịch '{code}' đã ở trạng thái '{tx.payment_status}' và không thể xác nhận thanh toán.",
                error_code="INVALID_TRANSACTION_STATE",
                details={"transaction_code": code, "payment_status": tx.payment_status},
            )

        owner = db.query(User).filter(User.id == tx.user_id).first()
        if owner is None:
            raise NotFoundException(
                message="Không tìm thấy người dùng sở hữu giao dịch này.",
                details={"user_id": tx.user_id},
            )

        plan = db.query(PricingPlan).filter(PricingPlan.id == tx.plan_id).first()
        if plan is None:
            raise NotFoundException(
                message="Không tìm thấy gói cước tương ứng với giao dịch này.",
                details={"plan_id": tx.plan_id},
            )

        now = datetime.now(timezone.utc)
        existing_sub = SubscriptionService.get_active_subscription_record(db, owner.id)

        if existing_sub is not None and _ensure_utc(existing_sub.expires_at) > now:
            # Extend existing active subscription from its current expiration timestamp
            base_expiry = _ensure_utc(existing_sub.expires_at)
            existing_sub.plan_id = plan.id
            existing_sub.expires_at = base_expiry + timedelta(days=plan.duration_days)
            existing_sub.status = SubscriptionStatus.ACTIVE.value
            existing_sub.auto_renew = True
            existing_sub.cancelled_at = None
            existing_sub.updated_at = now
            target_sub = existing_sub
        else:
            target_sub = Subscription(
                user_id=owner.id,
                plan_id=plan.id,
                status=SubscriptionStatus.ACTIVE.value,
                started_at=now,
                expires_at=now + timedelta(days=plan.duration_days),
                auto_renew=True,
                cancelled_at=None,
                created_at=now,
                updated_at=now,
            )
            db.add(target_sub)
            db.flush()

        # Upgrade user role to PRO unless they are already ADMIN
        owner_role = (
            owner.role
            if isinstance(owner.role, UserRole)
            else UserRole(str(owner.role).lower())
        )
        if owner_role != UserRole.ADMIN:
            owner.role = UserRole.PRO

        tx.subscription_id = target_sub.id
        tx.payment_status = PaymentStatus.COMPLETED.value
        tx.paid_at = now
        if override_payment_method:
            tx.payment_method = override_payment_method

        db.commit()
        db.refresh(target_sub)
        db.refresh(tx)
        db.refresh(owner)

        return SubscriptionService._build_transaction_status_response(db, tx)

    @staticmethod
    def process_payment_webhook(
        db: Session,
        payload: PaymentWebhookRequest,
    ) -> TransactionStatusResponse:
        """
        Process an incoming bank/payment gateway webhook.
        Matches transaction by `transaction_code` or by searching `content` for a matching
        `transaction_code` / `payment_note`, validates the transfer amount, and confirms payment.
        """
        tx: Optional[PaymentTransaction] = None

        if payload.transaction_code and payload.transaction_code.strip():
            code = payload.transaction_code.strip()
            tx = (
                db.query(PaymentTransaction)
                .filter(PaymentTransaction.transaction_code == code)
                .first()
            )

        if tx is None and payload.content and payload.content.strip():
            raw_content = payload.content.strip().upper()
            pending_Or_completed = db.query(PaymentTransaction).order_by(PaymentTransaction.id.desc()).all()
            for candidate in pending_Or_completed:
                code_upper = candidate.transaction_code.upper()
                note_upper = (candidate.payment_note or "").upper()
                if code_upper in raw_content or (note_upper and note_upper in raw_content):
                    tx = candidate
                    break

        if tx is None:
            raise NotFoundException(
                message="Không tìm thấy giao dịch khớp với dữ liệu webhook.",
                details={
                    "transaction_code": payload.transaction_code,
                    "content": payload.content,
                },
            )

        if payload.status.strip().lower() == PaymentStatus.FAILED.value:
            if tx.payment_status == PaymentStatus.PENDING.value:
                tx.payment_status = PaymentStatus.FAILED.value
                db.commit()
                db.refresh(tx)
            return SubscriptionService._build_transaction_status_response(db, tx)

        if payload.transfer_amount is not None and payload.transfer_amount < tx.amount_vnd:
            raise BadRequestException(
                message=(
                    f"Số tiền chuyển khoản ({payload.transfer_amount} VNĐ) "
                    f"nhỏ hơn mệnh giá gói ({tx.amount_vnd} VNĐ)."
                ),
                error_code="INSUFFICIENT_PAYMENT_AMOUNT",
                details={
                    "expected_amount_vnd": tx.amount_vnd,
                    "received_amount_vnd": payload.transfer_amount,
                },
            )

        return SubscriptionService.confirm_transaction_payment(
            db=db,
            transaction_code=tx.transaction_code,
            acting_user=None,
        )

    @staticmethod
    def cancel_subscription(db: Session, user: User) -> SubscriptionDetailSchema:
        """
        Disable automatic renewal on the user's active subscription and record `cancelled_at`.
        The user retains Pro benefits until `expires_at`.
        """
        active_sub = SubscriptionService.get_active_subscription_record(db, user.id)
        if active_sub is None:
            raise NotFoundException(
                message="Bạn hiện không có gói dịch vụ Pro nào đang hoạt động để hủy gia hạn.",
                details={"user_id": user.id},
            )

        now = datetime.now(timezone.utc)
        active_sub.auto_renew = False
        active_sub.cancelled_at = now
        active_sub.updated_at = now
        db.commit()
        db.refresh(active_sub)

        return _build_subscription_detail(active_sub, now=now)

