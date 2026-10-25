"""
User Pydantic Schemas
---------------------
Defines the request/response shapes for the Auth subsystem.

Schema hierarchy
----------------
UserBase          — shared read-safe fields (email, full_name)
  └─ UserCreate   — registration payload: + password (plaintext, validated here)
  └─ UserUpdate   — profile update payload: all fields optional
UserResponse      — API response: all fields except hashed_password
UserInDB          — internal model that includes hashed_password (never serialised to clients)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole


# ── Base ─────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    """Fields safe to read from the database and return in API responses."""

    email: EmailStr = Field(
        ...,
        description="Valid email address used as login identifier.",
        examples=["user@example.com"],
    )
    full_name: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Display name shown in the UI.",
        examples=["Nguyễn Văn A"],
    )


# ── Create (Registration) ─────────────────────────────────────────────────────

class UserCreate(UserBase):
    """
    Payload for POST /api/auth/register.
    Password strength is validated here before it reaches the service layer.
    """

    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Plaintext password — must be ≥ 8 chars, contain letters and digits.",
        examples=["SecureP@ss1"],
    )

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        """
        Reject weak passwords.
        Rules: ≥ 8 characters, at least one letter, at least one digit.
        """
        if not any(c.isalpha() for c in value):
            raise ValueError("Password must contain at least one letter.")
        if not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one digit.")
        return value

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        """Fold email to lowercase to match DB normalisation in User model."""
        return value.strip().lower()


# ── Update (Profile Edit) ─────────────────────────────────────────────────────

class UserUpdate(BaseModel):
    """
    Payload for PATCH /api/users/me.
    All fields are optional — only provided fields will be updated.
    """

    full_name: Optional[str] = Field(
        default=None,
        max_length=150,
        description="New display name.",
    )
    current_password: Optional[str] = Field(
        default=None,
        description="Current password — required when changing password.",
    )
    new_password: Optional[str] = Field(
        default=None,
        min_length=8,
        max_length=128,
        description="New password — required alongside current_password.",
    )

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, value: Optional[str]) -> Optional[str]:
        """Apply same strength rules as registration when a new password is set."""
        if value is None:
            return value
        if not any(c.isalpha() for c in value):
            raise ValueError("New password must contain at least one letter.")
        if not any(c.isdigit() for c in value):
            raise ValueError("New password must contain at least one digit.")
        return value


# ── Response (Public API Output) ──────────────────────────────────────────────

class UserResponse(UserBase):
    """
    Shape returned by all public-facing user endpoints.
    hashed_password is intentionally excluded.
    """

    id: int = Field(..., description="Unique user identifier.")
    role: UserRole = Field(..., description="Account privilege level: free | pro | admin.")
    is_active: bool = Field(..., description="False when the account is suspended.")
    created_at: datetime = Field(..., description="UTC timestamp of account creation.")
    updated_at: datetime = Field(..., description="UTC timestamp of last profile update.")

    model_config = {"from_attributes": True}


# ── Internal DB Model ─────────────────────────────────────────────────────────

class UserInDB(UserResponse):
    """
    Internal schema used by the service layer — includes hashed_password.
    NEVER return this schema directly from an API route.
    """

    hashed_password: str

    model_config = {"from_attributes": True}
