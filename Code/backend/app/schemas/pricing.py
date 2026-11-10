"""
Pricing Plans & Subscription Pydantic Schemas
---------------------------------------------
Defines data transfer objects (DTOs) for the Pricing Plans and Subscription API:
- Plan catalog responses (`GET /api/pricing/plans`)
- User subscription status responses (`GET /api/pricing/my-subscription`)
- Subscription checkout & VietQR payloads (`POST /api/pricing/subscribe`)
- Transaction status polling & simulation payloads (`GET/POST /api/pricing/transactions/...`)
- Payment gateway webhook payloads (`POST /api/pricing/webhook`)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class FreeTierPlanSchema(BaseModel):
    """Schema describing the default Free Tier plan."""

    code: str = Field(default="free", description="Plan identifier for the free tier.")
    name: str = Field(default="Miễn Phí", description="Display name of the free tier.")
    price_vnd: int = Field(default=0, description="Price in VND (always 0).")
    billing_cycle: str = Field(default="forever", description="Billing cycle label.")
    max_file_size_mb: int = Field(default=20, description="Max upload size in MB for free tier.")
    max_ocr_pages: int = Field(default=100, description="Max OCR pages per document for free tier.")
    features: list[str] = Field(default_factory=list, description="List of free tier features.")


class ProPlanItemSchema(BaseModel):
    """Schema describing an individual Pro billing option (monthly or yearly)."""

    code: str = Field(..., description="Unique plan identifier: pro_monthly | pro_yearly.")
    name: str = Field(..., description="Human-readable display name.")
    price_vnd: int = Field(..., description="Actual price in VND.")
    original_price_vnd: int = Field(..., description="Original undiscounted price in VND.")
    discount_percent: int = Field(default=0, description="Discount percentage compared to monthly rate.")
    billing_cycle: str = Field(..., description="Billing cycle: monthly | yearly.")
    duration_days: int = Field(..., description="Plan validity duration in days.")
    price_display: str = Field(..., description="Formatted price string (e.g. '49.000đ').")
    period_display: str = Field(..., description="Formatted period label (e.g. '/ tháng').")
    monthly_equivalent: Optional[str] = Field(
        default=None,
        description="Formatted monthly equivalent price for yearly plans (e.g. '33.250đ / tháng').",
    )
    badge: Optional[str] = Field(
        default=None,
        description="Promotional badge label (e.g. 'TIẾT KIỆM 32%').",
    )

    model_config = ConfigDict(from_attributes=True)


class ProTierCatalogSchema(BaseModel):
    """Schema grouping monthly and yearly Pro options along with shared Pro features."""

    monthly: ProPlanItemSchema = Field(..., description="Pro monthly subscription option (49,000 VND).")
    yearly: ProPlanItemSchema = Field(..., description="Pro yearly subscription option (399,000 VND).")
    shared_features: list[str] = Field(
        default_factory=list,
        description="Features included in all Pro subscription plans.",
    )


class PricingCatalogResponse(BaseModel):
    """Response payload for `GET /api/pricing/plans`."""

    free_tier: FreeTierPlanSchema = Field(..., description="Free tier specifications.")
    pro_tier: ProTierCatalogSchema = Field(..., description="Pro tier options and shared features.")


class SubscribeRequest(BaseModel):
    """Request payload for `POST /api/pricing/subscribe`."""

    plan_code: str = Field(
        ...,
        description="Selected plan code to subscribe to ('pro_monthly' or 'pro_yearly').",
    )
    payment_method: str = Field(
        default="vietqr",
        description="Preferred payment method ('vietqr', 'bank_transfer', 'momo', 'test_simulator').",
    )


class BankInfoSchema(BaseModel):
    """Bank transfer details for VietQR checkout."""

    bank_name: str = Field(..., description="Display name of the beneficiary bank.")
    account_number: str = Field(..., description="Beneficiary bank account number.")
    account_name: str = Field(..., description="Beneficiary account holder name.")
    transfer_note: str = Field(..., description="Required bank transfer memo for reconciliation.")


class SubscribeResponse(BaseModel):
    """Response payload for `POST /api/pricing/subscribe`."""

    transaction_code: str = Field(..., description="Unique transaction reference code.")
    plan_code: str = Field(..., description="Target plan code ('pro_monthly' or 'pro_yearly').")
    plan_name: str = Field(..., description="Human-readable target plan name.")
    duration_days: int = Field(..., description="Duration in days granted upon completion.")
    amount_vnd: int = Field(..., description="Amount to pay in VND.")
    amount_display: str = Field(..., description="Formatted amount string (e.g. '399.000 VNĐ').")
    payment_method: str = Field(..., description="Selected payment method.")
    payment_status: str = Field(..., description="Initial transaction status ('pending').")
    qr_code_url: str = Field(..., description="Dynamic Napas247 VietQR image URL.")
    bank_info: BankInfoSchema = Field(..., description="Bank account and transfer memo details.")
    expires_in_seconds: int = Field(default=900, description="Checkout countdown duration in seconds.")


class SubscriptionDetailSchema(BaseModel):
    """Detailed representation of a user's subscription record."""

    id: int = Field(..., description="Subscription record ID.")
    user_id: int = Field(..., description="Subscribed user ID.")
    plan_code: str = Field(..., description="Subscribed plan code ('pro_monthly' or 'pro_yearly').")
    plan_name: str = Field(..., description="Subscribed plan display name.")
    billing_cycle: str = Field(..., description="Billing cycle ('monthly' or 'yearly').")
    status: str = Field(..., description="Subscription lifecycle status ('active', 'expired', 'cancelled').")
    started_at: datetime = Field(..., description="UTC timestamp when the subscription started.")
    expires_at: datetime = Field(..., description="UTC timestamp when the subscription expires.")
    days_remaining: int = Field(..., description="Number of full or partial days remaining.")
    auto_renew: bool = Field(..., description="Whether automatic renewal is enabled.")
    cancelled_at: Optional[datetime] = Field(default=None, description="UTC timestamp when cancelled.")

    model_config = ConfigDict(from_attributes=True)


class MySubscriptionResponse(BaseModel):
    """Response payload for `GET /api/pricing/my-subscription`."""

    current_role: str = Field(..., description="User's effective role ('free', 'pro', or 'admin').")
    is_pro: bool = Field(..., description="True if the user currently holds Pro or Admin privileges.")
    max_file_size_mb: int = Field(..., description="Current max upload size in MB.")
    max_ocr_pages: int = Field(..., description="Current max OCR pages per document.")
    active_subscription: Optional[SubscriptionDetailSchema] = Field(
        default=None,
        description="Active subscription details if subscribed, otherwise None.",
    )


class TransactionStatusResponse(BaseModel):
    """Response payload for `GET /api/pricing/transactions/{code}/status` and simulation/webhook."""

    transaction_code: str = Field(..., description="Unique transaction reference code.")
    plan_code: str = Field(..., description="Target plan code.")
    plan_name: str = Field(..., description="Target plan display name.")
    amount_vnd: int = Field(..., description="Transaction amount in VND.")
    payment_method: str = Field(..., description="Payment method used.")
    payment_status: str = Field(..., description="Current payment status ('pending', 'completed', 'failed', 'expired').")
    paid_at: Optional[datetime] = Field(default=None, description="UTC timestamp when payment completed.")
    user_role: str = Field(..., description="Updated role of the user owning the transaction.")
    subscription: Optional[SubscriptionDetailSchema] = Field(
        default=None,
        description="Activated subscription details once payment is completed.",
    )


class PaymentWebhookRequest(BaseModel):
    """Request payload for `POST /api/pricing/webhook` from payment gateways (SePAY / Casso / Bank)."""

    transaction_code: Optional[str] = Field(
        default=None,
        description="Explicit transaction code if provided directly by the gateway.",
    )
    content: Optional[str] = Field(
        default=None,
        description="Raw bank transfer description/memo containing the transaction code or transfer note.",
    )
    transfer_amount: Optional[int] = Field(
        default=None,
        description="Transferred amount in VND reported by the payment gateway.",
    )
    status: str = Field(
        default="completed",
        description="Reported payment status ('completed' or 'failed').",
    )

