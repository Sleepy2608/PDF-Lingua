"""
Pricing Plans & Subscription API Endpoints
------------------------------------------
Exposes RESTful endpoints for browsing pricing tiers, initiating VietQR checkout,
polling transaction status, simulating dev payments, receiving bank webhooks,
and managing user subscriptions:
- GET  /api/pricing/plans                     : Public pricing catalog (Free vs Pro 49k/399k)
- GET  /api/pricing/my-subscription           : Current user's role, quotas, and active subscription
- POST /api/pricing/subscribe                 : Create pending transaction & generate Napas247 VietQR
- GET  /api/pricing/transactions/{code}/status: Poll transaction status (owner or admin)
- POST /api/pricing/transactions/{code}/simulate: Dev/test endpoint to simulate immediate payment
- POST /api/pricing/webhook                   : Payment gateway webhook receiver (secret header protected)
- POST /api/pricing/cancel                    : Cancel automatic renewal on active subscription
"""

import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import UnauthorizedException
from app.core.logger import logger
from app.models.subscription import PaymentMethod
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.pricing import (
    MySubscriptionResponse,
    PaymentWebhookRequest,
    PricingCatalogResponse,
    SubscribeRequest,
    SubscribeResponse,
    SubscriptionDetailSchema,
    TransactionStatusResponse,
)
from app.services.subscription_service import SubscriptionService

router = APIRouter(
    prefix="/api/pricing",
    tags=["Pricing & Subscriptions"],
)


@router.get("/plans", response_model=ApiResponse[PricingCatalogResponse])
async def get_pricing_plans(
    db: Session = Depends(get_db),
):
    """
    Retrieve the complete catalog of active pricing plans (Free tier and Pro Monthly/Yearly tiers).
    Publicly accessible without authentication.
    """
    catalog = SubscriptionService.get_pricing_catalog(db=db)
    return ApiResponse(
        data=catalog,
        message="Lấy danh sách bảng giá dịch vụ thành công.",
    )


@router.get("/my-subscription", response_model=ApiResponse[MySubscriptionResponse])
async def get_my_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve the authenticated user's current role, quota limits, and active subscription details.
    Automatically expires overdue subscriptions before returning.
    """
    result = SubscriptionService.get_user_subscription(db=db, user=current_user)
    return ApiResponse(
        data=result,
        message="Lấy thông tin gói dịch vụ hiện tại thành công.",
    )


@router.post(
    "/subscribe",
    response_model=ApiResponse[SubscribeResponse],
    status_code=status.HTTP_201_CREATED,
)
async def subscribe_to_plan(
    body: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Initiate a subscription upgrade order for `pro_monthly` (49,000 VND) or `pro_yearly` (399,000 VND)
    and generate a dynamic Napas247 VietQR payment payload.
    """
    logger.info(
        f"[Pricing] User {current_user.email} initiating subscription for plan={body.plan_code} "
        f"via method={body.payment_method}."
    )
    checkout = SubscriptionService.create_subscription_transaction(
        db=db,
        user=current_user,
        plan_code=body.plan_code,
        payment_method=body.payment_method,
    )
    return ApiResponse(
        data=checkout,
        message="Khởi tạo đơn hàng nâng cấp gói Pro và mã VietQR thành công.",
    )


@router.get(
    "/transactions/{code}/status",
    response_model=ApiResponse[TransactionStatusResponse],
)
async def check_transaction_status(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Poll the current status of a subscription payment transaction.
    Restricted to the user who created the transaction (or an administrator).
    """
    tx_status = SubscriptionService.get_transaction_status(
        db=db,
        transaction_code=code,
        current_user=current_user,
    )
    return ApiResponse(
        data=tx_status,
        message="Kiểm tra trạng thái giao dịch thành công.",
    )


@router.post(
    "/transactions/{code}/simulate",
    response_model=ApiResponse[TransactionStatusResponse],
)
async def simulate_transaction_payment(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Simulate an immediate successful bank transfer for the specified transaction code
    (intended for local/dev testing and interactive demo verification).
    """
    logger.info(
        f"[Pricing] User {current_user.email} simulating payment completion for transaction={code}."
    )
    result = SubscriptionService.confirm_transaction_payment(
        db=db,
        transaction_code=code,
        acting_user=current_user,
        override_payment_method=PaymentMethod.TEST_SIMULATOR.value,
    )
    return ApiResponse(
        data=result,
        message="Xác nhận thanh toán nâng cấp gói Pro thành công.",
    )


@router.post(
    "/webhook",
    response_model=ApiResponse[TransactionStatusResponse],
)
async def payment_webhook(
    body: PaymentWebhookRequest,
    x_webhook_secret: Optional[str] = Header(default=None, alias="X-Webhook-Secret"),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    """
    Receive automated payment confirmation callbacks from payment gateways (SePAY / Casso / Bank).
    Protected by `X-Webhook-Secret` header or `Authorization: Apikey <secret>` / `Bearer <secret>`.
    """
    provided_secret = (x_webhook_secret or "").strip()
    if not provided_secret and authorization:
        parts = authorization.strip().split(" ", 1)
        if len(parts) == 2 and parts[0].lower() in ("apikey", "bearer"):
            provided_secret = parts[1].strip()

    expected_secret = settings.PAYMENT_WEBHOOK_SECRET
    if not provided_secret or not secrets.compare_digest(provided_secret, expected_secret):
        raise UnauthorizedException(
            message="Khóa bí mật Webhook không hợp lệ hoặc bị thiếu.",
            error_code="INVALID_WEBHOOK_SECRET",
        )

    result = SubscriptionService.process_payment_webhook(db=db, payload=body)
    return ApiResponse(
        data=result,
        message="Xử lý tín hiệu thanh toán Webhook thành công.",
    )


@router.post(
    "/cancel",
    response_model=ApiResponse[SubscriptionDetailSchema],
)
async def cancel_my_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancel automatic renewal on the authenticated user's active Pro subscription.
    The user retains Pro access until the current billing period expires.
    """
    logger.info(f"[Pricing] User {current_user.email} requested subscription auto-renew cancellation.")
    cancelled_sub = SubscriptionService.cancel_subscription(db=db, user=current_user)
    return ApiResponse(
        data=cancelled_sub,
        message="Đã hủy gia hạn tự động gói dịch vụ Pro thành công.",
    )

