"""
Admin Pydantic Schemas
----------------------
Defines data transfer objects (DTOs) for system administration:
- System overview metrics and statistics (PDFL-188)
- User list query and paginated responses (PDFL-189)
- User status update and role mutation payloads (PDFL-194, PDFL-197)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole

# ── System Overview Stats (PDFL-188) ─────────────────────────────────────────

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

    model_config = ConfigDict(from_attributes=True)


# ── User Management Table (PDFL-189) ──────────────────────────────────────────

class AdminUserListItem(BaseModel):
    """User account summary item displayed in the admin management table."""

    id: int = Field(..., description="Unique account identifier.")
    email: EmailStr = Field(..., description="Account email address.")
    full_name: Optional[str] = Field(None, description="User's display name.")
    role: UserRole = Field(..., description="Privilege role: free | pro | admin.")
    is_active: bool = Field(..., description="Account status: True (Active), False (Locked).")
    document_count: int = Field(default=0, description="Total documents uploaded by this user.")
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


# ── Status & Role Mutations (PDFL-194, PDFL-197) ─────────────────────────────

class UserStatusUpdateRequest(BaseModel):
    """Payload to lock or unlock a user account."""

    is_active: bool = Field(..., description="True to activate/unlock; False to suspend/lock.")


class UserRoleUpdateRequest(BaseModel):
    """Payload to elevate or demote a user role."""

    role: UserRole = Field(..., description="Target role to assign: free | pro | admin.")
