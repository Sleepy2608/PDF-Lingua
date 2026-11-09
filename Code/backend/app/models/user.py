"""
User ORM Model
--------------
Defines the `users` table schema for the PDF-Lingua database.

Columns
-------
id              : Integer primary key (auto-increment).
email           : Unique, case-folded email - used as login identifier.
hashed_password : bcrypt/argon2 hash - never store plaintext.
full_name       : Optional display name shown in the UI.
role            : Enum(free | pro | admin) - drives feature access gates.
is_active       : Soft-disable without deleting the account.
created_at      : Timestamp set automatically on INSERT.
updated_at      : Timestamp updated automatically on every UPDATE.
"""

import enum
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.core.database import Base


class UserRole(str, enum.Enum):
    """Account privilege levels for PDF-Lingua."""

    FREE = "free"
    PRO = "pro"
    ADMIN = "admin"


class User(Base):
    """SQLAlchemy ORM model for the `users` table."""

    __tablename__ = "users"

    # ── Primary Key ─────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)

    # ── Identity ─────────────────────────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Login identifier: stored lower-cased.",
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="bcrypt hash of the user's password. Never plaintext.",
    )
    full_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        default=None,
        comment="Display name shown in the UI.",
    )

    # ── Authorisation ─────────────────────────────────────────────────────────
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.FREE,
        server_default=UserRole.FREE.value,
        comment="Privilege level: free | pro | admin.",
    )

    # ── Account Status ────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
        comment="False = account is suspended / locked.",
    )

    # ── Audit Timestamps ──────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the account was created.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp of the last profile update.",
    )

    # ── Validators ────────────────────────────────────────────────────────────
    @validates("email")
    def normalise_email(self, _key: str, email: str) -> str:
        """Fold email to lowercase before persisting to prevent duplicate accounts."""
        return email.strip().lower()

    # ── Relationships ─────────────────────────────────────────────────────────
    documents: Mapped[list[Any]] = relationship(
        "Document",
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    subscriptions: Mapped[list[Any]] = relationship(
        "Subscription",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    payment_transactions: Mapped[list[Any]] = relationship(
        "PaymentTransaction",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    processing_histories: Mapped[list[Any]] = relationship(
        "ProcessingHistory",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # ── Helpers ───────────────────────────────────────────────────────────────
    @property
    def is_pro(self) -> bool:
        """True if the user has Pro or Admin privileges."""
        return self.role in (UserRole.PRO, UserRole.ADMIN)

    @property
    def is_admin(self) -> bool:
        """True if the user is a system administrator."""
        return self.role == UserRole.ADMIN

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role.value}>"
