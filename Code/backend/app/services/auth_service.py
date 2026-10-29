"""
Authentication Service
----------------------
Handles business logic for user registration, authentication, and password management.
"""

from typing import Optional
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, ForbiddenException, UnauthorizedException
from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserLogin, UserUpdate


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
        5. Handle concurrent insert race condition via IntegrityError catch and rollback.
        6. Return the newly created user record.
        """
        # 1. Normalize email
        normalized_email = user_in.email.strip().lower()

        # 2. Check duplicate email (application-level check)
        existing_user = cls.get_user_by_email(db, normalized_email)
        if existing_user:
            raise BadRequestException(
                message="Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.",
                error_code="EMAIL_ALREADY_EXISTS",
            )

        # 3. Hash password
        hashed_pwd = hash_password(user_in.password)

        # 4. Clean full_name: treat whitespace-only as None
        clean_full_name = (
            user_in.full_name.strip()
            if user_in.full_name and user_in.full_name.strip()
            else None
        )

        # 5. Create new user with fixed role UserRole.FREE
        db_user = User(
            email=normalized_email,
            hashed_password=hashed_pwd,
            full_name=clean_full_name,
            role=UserRole.FREE,
            is_active=True,
        )

        try:
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
        except IntegrityError:
            # Handle concurrent race condition when two requests register the same email
            db.rollback()
            raise BadRequestException(
                message="Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.",
                error_code="EMAIL_ALREADY_EXISTS",
            )
        except SQLAlchemyError:
            # Rollback transaction on unexpected database errors to keep session clean
            db.rollback()
            raise

        return db_user


    @classmethod
    def authenticate_user(cls, db: Session, user_in: "UserLogin") -> User:
        """Authenticate an active user without exposing whether an email exists."""
        user = cls.get_user_by_email(db, user_in.email)
        if user is None or not verify_password(user_in.password, user.hashed_password):
            raise UnauthorizedException(
                message="Email hoặc mật khẩu không chính xác.",
                error_code="INVALID_CREDENTIALS",
            )

        if not user.is_active:
            raise ForbiddenException(
                message="Tài khoản này đã bị vô hiệu hóa.",
                error_code="ACCOUNT_INACTIVE",
            )

        return user

    @classmethod
    def update_user_profile(
        cls,
        db: Session,
        user: User,
        user_update: UserUpdate,
    ) -> User:
        """
        Update the current user's profile details.
        Currently permits updating `full_name`.
        Ignores and prevents any modifications to email, role, is_active, or id.
        """
        # If full_name is provided in payload (even if empty/whitespace)
        if user_update.full_name is not None:
            clean_name = user_update.full_name.strip() if user_update.full_name.strip() else None
            user.full_name = clean_name

        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except SQLAlchemyError:
            db.rollback()
            raise

        return user


