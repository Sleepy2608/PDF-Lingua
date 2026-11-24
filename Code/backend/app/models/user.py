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
avatar_url      : Optional public URL or relative path to user's avatar image.
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
    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        default=None,
        comment="Public URL or relative path to the user's avatar image.",
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


def seed_default_admin(db: Any) -> User | None:
    """
    Seed or elevate the initial system administrator account from environment variables.

    If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are provided via environment variables,
    this function ensures that an account with that email exists, possesses `UserRole.ADMIN`,
    is active, and has its password synchronized.
    If either variable is not provided, this function safely no-ops.
    """
    from app.core.config import settings
    from app.core.logger import logger
    from app.core.security import hash_password, verify_password

    admin_email_raw = getattr(settings, "ADMIN_EMAIL", None)
    admin_password = getattr(settings, "ADMIN_PASSWORD", None)

    if not admin_email_raw or not admin_password:
        return None

    admin_email = admin_email_raw.strip().lower()
    if not admin_email:
        return None

    existing = db.query(User).filter(User.email == admin_email).first()
    if existing is None:
        logger.info(f"[Admin Seeding] Creating initial system administrator for {admin_email}...")
        admin_user = User(
            email=admin_email,
            hashed_password=hash_password(admin_password),
            full_name="Quản Trị Viên",
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        logger.info(f"[Admin Seeding] Initial administrator {admin_email} successfully created.")
        return admin_user

    # Elevate role if currently free or pro
    updated = False
    if existing.role != UserRole.ADMIN:
        logger.info(f"[Admin Seeding] Elevating existing user {admin_email} to UserRole.ADMIN...")
        existing.role = UserRole.ADMIN
        updated = True

    if not existing.is_active:
        existing.is_active = True
        updated = True

    # Synchronize password if different
    if not verify_password(admin_password, existing.hashed_password):
        logger.info(f"[Admin Seeding] Updating administrator password for {admin_email}...")
        existing.hashed_password = hash_password(admin_password)
        updated = True

    if updated:
        db.commit()
        db.refresh(existing)
        logger.info(f"[Admin Seeding] Administrator {admin_email} updated successfully.")

    return existing

