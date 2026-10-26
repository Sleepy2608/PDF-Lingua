"""
Authentication Service
----------------------
Handles business logic for user registration, authentication, and password management.
"""

from typing import Optional
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.user import UserCreate


class AuthService:
    """Service class encapsulating authentication-related business operations."""

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """
        Query a user by normalized (lowercase, trimmed) email address.
        """
        normalized_email = email.strip().lower()
        return db.query(User).filter(User.email == normalized_email).first()

    @classmethod
    def register_user(cls, db: Session, user_in: UserCreate) -> User:
        """
        Register a new user account.

        Flow:
        1. Sanitize & normalize email.
        2. Verify email is not already taken; raise BadRequestException if duplicate.
        3. Securely hash password using bcrypt (with salt rounds=12).
        4. Create and persist user entity with default role `UserRole.FREE` (client cannot override).
        5. Return the newly created user record.
        """
        # 1. Normalize email
        normalized_email = user_in.email.strip().lower()

        # 2. Check duplicate email
        existing_user = cls.get_user_by_email(db, normalized_email)
        if existing_user:
            raise BadRequestException(
                message="Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.",
                error_code="EMAIL_ALREADY_EXISTS",
            )

        # 3. Hash password
        hashed_pwd = hash_password(user_in.password)

        # 4. Create new user with fixed role UserRole.FREE
        db_user = User(
            email=normalized_email,
            hashed_password=hashed_pwd,
            full_name=user_in.full_name.strip() if user_in.full_name else None,
            role=UserRole.FREE,
            is_active=True,
        )

        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        return db_user
