"""
Admin Pydantic Schemas
----------------------
Defines data transfer objects (DTOs) for system administration:
- System overview metrics and statistics
- User list query and paginated responses
- User status update and role mutation payloads
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole

# ── System Overview Stats ─────────────────────────────────────────

class AdminServiceUsageStats(BaseModel):
    """Breakdown of successful document processing actions across system services."""

    extract_count: int = Field(default=0, description="Total successful text extraction operations.")
    translate_count: int = Field(default=0, description="Total successful document translation operations.")
    summarize_count: int = Field(default=0, description="Total successful AI summary operations.")
    chat_count: int = Field(default=0, description="Total successful AI copilot chat interactions.")
    total_actions: int = Field(default=0, description="Total successful processing actions across all services.")

    model_config = ConfigDict(from_attributes=True)


class AdminStatsResponse(BaseModel):
    """Aggregated system metrics for the administrative dashboard."""

    total_users: int = Field(..., description="Total registered accounts in the system.")
    active_users: int = Field(..., description="Number of currently active/unlocked accounts.")
    locked_users: int = Field(..., description="Number of locked/suspended accounts.")
    free_users: int = Field(..., description="Number of Free tier accounts.")
    pro_users: int = Field(..., description="Number of Pro VIP tier accounts.")
    admin_users: int = Field(..., description="Number of Administrator tier accounts.")
    total_documents: int = Field(..., description="Total document records stored in database.")
    total_storage_bytes: int = Field(..., description="Total storage consumed by uploaded PDFs.")
    services: AdminServiceUsageStats = Field(
        default_factory=AdminServiceUsageStats,
        description="Aggregated usage metrics categorized by service type.",
    )

    model_config = ConfigDict(from_attributes=True)


# ── User Management Table ──────────────────────────────────────────

class AdminUserListItem(BaseModel):
    """User account summary item displayed in the admin management table."""

    id: int = Field(..., description="Unique account identifier.")
    email: EmailStr = Field(..., description="Account email address.")
    full_name: Optional[str] = Field(None, description="User's display name.")
    role: UserRole = Field(..., description="Privilege role: free | pro | admin.")
    is_active: bool = Field(..., description="Account status: True (Active), False (Locked).")
    document_count: int = Field(default=0, description="Total documents uploaded by this user.")
    last_ip: Optional[str] = Field(None, description="Most recent client IP recorded during login/register.")
    last_device: Optional[str] = Field(None, description="Most recent browser/OS summary.")
    last_login_at: Optional[datetime] = Field(None, description="Timestamp of the most recent recorded access.")
    distinct_ip_count_24h: int = Field(default=0, description="Distinct IP addresses seen in the last 24 hours.")
    multi_ip_warning: bool = Field(default=False, description="True if account accessed from >= 3 distinct IPs in 24h.")
    created_at: datetime = Field(..., description="Timestamp when the account was registered.")
    updated_at: datetime = Field(..., description="Timestamp of the last profile or role update.")

    model_config = ConfigDict(from_attributes=True)


class AdminUserListResponse(BaseModel):
    """Paginated list of user accounts with pagination metadata."""

    items: list[AdminUserListItem] = Field(..., description="Current page of user items.")
    total_count: int = Field(..., description="Total number of matching users across all pages.")
    page: int = Field(..., description="Current page number (1-based).")
    limit: int = Field(..., description="Number of items per page.")
    total_pages: int = Field(..., description="Total number of pages available.")


# ── Status & Role Mutations ─────────────────────────────

class UserStatusUpdateRequest(BaseModel):
    """Payload to lock or unlock a user account."""

    is_active: bool = Field(..., description="True to activate/unlock; False to suspend/lock.")


class UserRoleUpdateRequest(BaseModel):
    """Payload to elevate or demote a user role."""

    role: UserRole = Field(..., description="Target role to assign: free | pro | admin.")


# ── Payment & VietQR Transaction Management ───────────────────────

class AdminTransactionItem(BaseModel):
    """Payment transaction summary item displayed in the admin billing table."""

    id: int = Field(..., description="Unique transaction database ID.")
    transaction_code: str = Field(..., description="Unique VietQR reference code.")
    user_id: int = Field(..., description="ID of user who initiated the payment.")
    user_email: str = Field(..., description="Email of the user.")
    user_name: Optional[str] = Field(None, description="Display name of the user.")
    plan_code: str = Field(..., description="Target plan code (pro_monthly / pro_yearly).")
    plan_name: str = Field(..., description="Human-readable plan name.")
    amount_vnd: int = Field(..., description="Amount in VND.")
    amount_display: str = Field(..., description="Formatted VND string.")
    payment_method: str = Field(..., description="Payment method (vietqr, etc.).")
    payment_status: str = Field(..., description="Status: pending | completed | failed | expired.")
    payment_note: Optional[str] = Field(None, description="Transfer memo / description.")
    paid_at: Optional[datetime] = Field(None, description="Timestamp when confirmed.")
    created_at: datetime = Field(..., description="Timestamp when created.")

    model_config = ConfigDict(from_attributes=True)


class AdminTransactionListResponse(BaseModel):
    """Paginated list of payment transactions with revenue & status summary."""

    items: list[AdminTransactionItem] = Field(..., description="Current page of transaction items.")
    total_count: int = Field(..., description="Total matching transactions.")
    page: int = Field(..., description="Current page number.")
    limit: int = Field(..., description="Items per page.")
    total_pages: int = Field(..., description="Total pages available.")
    total_revenue_vnd: int = Field(default=0, description="Total completed revenue in VND.")
    total_revenue_display: str = Field(default="0đ", description="Formatted total revenue.")
    pending_count: int = Field(default=0, description="Total pending transactions waiting for approval.")
    completed_count: int = Field(default=0, description="Total completed transactions.")


# ── User Access & IP Audit Logs ───────────────────────────────────

class AdminAccessLogItem(BaseModel):
    """Single user access audit record showing IP, device, and action timestamp."""

    id: int = Field(..., description="Unique log record ID.")
    user_id: int = Field(..., description="Authenticated user ID.")
    user_email: str = Field(..., description="User account email.")
    user_name: Optional[str] = Field(None, description="User display name.")
    user_role: UserRole = Field(..., description="User role tier.")
    ip_address: str = Field(..., description="Client IP address resolved behind reverse proxy.")
    device_summary: Optional[str] = Field(None, description="Human-readable browser/OS label.")
    user_agent: Optional[str] = Field(None, description="Raw User-Agent header.")
    action: str = Field(..., description="Auth action type: login | register.")
    created_at: datetime = Field(..., description="Timestamp of access event.")

    model_config = ConfigDict(from_attributes=True)


class AdminAccessLogListResponse(BaseModel):
    """Paginated user access log list with 24-hour IP anomaly metrics."""

    items: list[AdminAccessLogItem] = Field(..., description="Current page of access log items.")
    total_count: int = Field(..., description="Total matching log records.")
    page: int = Field(..., description="Current page number.")
    limit: int = Field(..., description="Items per page.")
    total_pages: int = Field(..., description="Total available pages.")
    unique_ips_24h: int = Field(default=0, description="Total distinct IPs recorded system-wide in last 24h.")
    multi_ip_users_count: int = Field(default=0, description="Number of users with >= 3 distinct IPs in last 24h.")
