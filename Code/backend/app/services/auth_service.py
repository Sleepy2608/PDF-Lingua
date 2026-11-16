"""
Authentication Service
----------------------
Handles business logic for user registration, authentication, and password management.
"""

from typing import Optional

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    AppException,
    BadRequestException,
    ForbiddenException,
    UnauthorizedException,
)
from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.user import PasswordChangeRequest, UserCreate, UserLogin, UserUpdate
from app.services.storage_service import StorageService


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
        Permits updating `full_name`.
        Prevents direct modification of `avatar_url` via generic profile updates.
        Ignores and prevents any modifications to email, role, is_active, or id.
        """
        # Block direct update of avatar_url via generic profile endpoint
        if user_update.avatar_url is not None:
            raise BadRequestException(
                message="Không được phép cập nhật avatar_url trực tiếp qua API cập nhật thông tin. Vui lòng sử dụng API tải lên ảnh đại diện.",
                error_code="AVATAR_UPDATE_FORBIDDEN",
            )

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

    @classmethod
    def update_user_avatar(
        cls,
        db: Session,
        user: User,
        content: bytes,
        storage_service: StorageService,
    ) -> tuple[str, User]:
        """
        Cập nhật ảnh đại diện mới cho người dùng hiện tại với cơ chế đảm bảo tính nhất quán (2-phase commit):
        1. Lưu tệp ảnh đại diện mới vào hệ thống tệp đĩa.
        2. Cập nhật đường dẫn avatar_url mới trong cơ sở dữ liệu.
        3. Nếu ghi cơ sở dữ liệu thất bại: xóa ngay tệp mới trên đĩa để tránh tệp mồ côi (rollback filesystem).
        4. Nếu cơ sở dữ liệu cập nhật thành công: xóa tệp ảnh đại diện cũ (nếu có).
        """
        # 1. Lưu tệp mới (chưa xóa tệp cũ ngay để bảo toàn dữ liệu nếu DB lỗi)
        stored_filename, rel_path, _target_path = storage_service.save_avatar_file(
            user_id=user.id,
            content=content,
            old_filename_or_path=None,
        )

        previous_avatar = user.avatar_url
        new_avatar_url = f"/api/storage/{rel_path}"

        # 2. Cập nhật database
        user.avatar_url = new_avatar_url
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception as db_err:
            db.rollback()
            # Xóa tệp mới vừa tạo để duy trì tính nhất quán giữa filesystem và database
            storage_service.delete_avatar_file(user_id=user.id, filename_or_path=stored_filename)
            raise AppException(
                message="Lỗi cơ sở dữ liệu khi cập nhật ảnh đại diện.",
                status_code=500,
                error_code="DB_PERSISTENCE_ERROR",
            ) from db_err

        # 3. Dọn dẹp an toàn tệp cũ sau khi database commit thành công
        if previous_avatar:
            try:
                storage_service.delete_avatar_file(user_id=user.id, filename_or_path=previous_avatar)
            except Exception:
                pass

        return new_avatar_url, user

    @classmethod
    def delete_user_avatar(
        cls,
        db: Session,
        user: User,
        storage_service: StorageService,
    ) -> None:
        """
        Xóa ảnh đại diện của người dùng hiện tại:
        1. Kiểm tra người dùng đã có ảnh đại diện hay chưa (nếu chưa có thì báo lỗi 400).
        2. Cập nhật avatar_url = None trong cơ sở dữ liệu trước.
        3. Nếu commit DB thành công thì xóa tệp vật lý khỏi đĩa lưu trữ.
        """
        if not user.avatar_url:
            raise BadRequestException(
                message="Tài khoản hiện tại chưa thiết lập ảnh đại diện để xóa.",
                error_code="NO_AVATAR_TO_DELETE",
            )

        previous_avatar = user.avatar_url
        user.avatar_url = None

        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception as db_err:
            db.rollback()
            raise AppException(
                message="Lỗi cơ sở dữ liệu khi xóa ảnh đại diện.",
                status_code=500,
                error_code="DB_PERSISTENCE_ERROR",
            ) from db_err

        # Xóa tệp vật lý sau khi DB đã commit thành công
        if previous_avatar:
            try:
                storage_service.delete_avatar_file(user_id=user.id, filename_or_path=previous_avatar)
            except Exception:
                pass

    @classmethod
    def change_password(
        cls,
        db: Session,
        user: User,
        data: PasswordChangeRequest,
    ) -> None:
        """
        Change password for an authenticated user.

        Validation & Security rules:
        1. Verify current password against stored bcrypt hash.
           If mismatched, raises BadRequestException with INCORRECT_CURRENT_PASSWORD.
        2. Verify new password is not identical to current password.
           If matched, raises BadRequestException with PASSWORD_SAME_AS_OLD.
        3. Securely hash new password using bcrypt (with salt rounds=12).
        4. Persist updated hash and commit; rollback safely on database errors.
        """
        if not verify_password(data.current_password, user.hashed_password):
            raise BadRequestException(
                message="Mật khẩu hiện tại không chính xác.",
                error_code="INCORRECT_CURRENT_PASSWORD",
            )

        if verify_password(data.new_password, user.hashed_password):
            raise BadRequestException(
                message="Mật khẩu mới không được trùng với mật khẩu hiện tại.",
                error_code="PASSWORD_SAME_AS_OLD",
            )

        user.hashed_password = hash_password(data.new_password)

        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except SQLAlchemyError:
            db.rollback()
            raise


