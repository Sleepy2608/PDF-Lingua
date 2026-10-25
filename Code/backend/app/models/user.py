"""
User ORM Model — PDFL-72
-------------------------
Defines the `users` table schema for the PDF-Lingua database.

Columns
-------
id              : Integer primary key (auto-increment).
email           : Unique, case-folded email — used as login identifier.
hashed_password : bcrypt/argon2 hash — never store plaintext (PDFL-75).
full_name       : Optional display name shown in the UI.
role            : Enum(free | pro | admin) — drives feature access gates (PDFL-81, PDFL-82).
is_active       : Soft-disable without deleting the account (PDFL-84).
created_at      : Timestamp set automatically on INSERT.
updated_at      : Timestamp updated automatically on every UPDATE (PDFL-79).
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String
from sqlalchemy.orm import validates

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
    id: int = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # ── Identity ─────────────────────────────────────────────────────────────
    email: str = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Login identifier — stored lower-cased.",
    )
    hashed_password: str = Column(
        String(255),
        nullable=False,
        comment="bcrypt hash of the user's password (PDFL-75). Never plaintext.",
    )
    full_name: str | None = Column(
        String(150),
        nullable=True,
        default=None,
        comment="Display name shown in the UI.",
    )

    # ── Authorisation ─────────────────────────────────────────────────────────
    role: UserRole = Column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.FREE,
        server_default=UserRole.FREE.value,
        comment="Privilege level: free | pro | admin (PDFL-81).",
    )

    # ── Account Status ────────────────────────────────────────────────────────
    is_active: bool = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
        comment="False = account is suspended / locked (PDFL-84).",
    )

    # ── Audit Timestamps ──────────────────────────────────────────────────────
    created_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the account was created.",
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp of the last profile update (PDFL-79).",
    )

    # ── Validators ────────────────────────────────────────────────────────────
    @validates("email")
    def normalise_email(self, _key: str, email: str) -> str:
        """Fold email to lowercase before persisting to prevent duplicate accounts."""
        return email.strip().lower()

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
