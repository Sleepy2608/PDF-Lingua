"""
Authentication API Router
-------------------------
Endpoints for user registration, login, logout, and token refresh.
"""

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import (
    BadRequestException,
    PayloadTooLargeException,
    UnsupportedMediaTypeException,
)
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.user import (
    AvatarUploadResponse,
    PasswordChangeRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)
from app.services.auth_service import AuthService
from app.services.storage_service import StorageService

router = APIRouter()
storage_service = StorageService()


@router.post(
    "/register",
    response_model=ApiResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
    description="Registers a new user with default 'free' role. Validates email and password, hashes password with bcrypt, and checks for duplicate email.",
)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
) -> ApiResponse[UserResponse]:
    """
    Register a new user account.
    Returns 201 Created and user information without exposing password or hash.
    """
    user = AuthService.register_user(db=db, user_in=user_in)
    return ApiResponse(
        success=True,
        message="Đăng ký tài khoản thành công.",
        data=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Authenticate user credentials",
    description="Authenticates an active user using email and password. Returns 200 OK with bearer access token and safe user information.",
)
def login(
    credentials: UserLogin,
    db: Session = Depends(get_db),
) -> ApiResponse[TokenResponse]:
    """
    Authenticate user credentials.
    Returns 200 OK with bearer access token and safe user object on success.
    Raises 401 INVALID_CREDENTIALS for invalid email/password, or 403 ACCOUNT_INACTIVE for inactive accounts.
    """
    user = AuthService.authenticate_user(db=db, user_in=credentials)
    access_token = create_access_token(subject=user.id)
    return ApiResponse(
        success=True,
        message="Đăng nhập thành công.",
        data=TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        ),
    )


@router.get(
    "/me",
    response_model=ApiResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
    description="Returns profile of the currently authenticated user based on Bearer token.",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> ApiResponse[UserResponse]:
    """
    Get current user information.
    Requires a valid Bearer access token.
    Returns 200 OK and UserResponse without password or password hash.
    """
    return ApiResponse(
        success=True,
        message="Lấy thông tin tài khoản thành công.",
        data=UserResponse.model_validate(current_user),
    )


@router.patch(
    "/me",
    response_model=ApiResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Update current user profile",
    description="Updates editable profile fields (full_name) for the currently authenticated user.",
)
def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[UserResponse]:
    """
    Update profile details for the currently logged-in user.
    Currently supports updating `full_name`.
    Prevents altering system fields (`id`, `email`, `role`, `is_active`).
    """
    updated_user = AuthService.update_user_profile(
        db=db,
        user=current_user,
        user_update=user_update,
    )
    return ApiResponse(
        success=True,
        message="Cập nhật thông tin tài khoản thành công.",
        data=UserResponse.model_validate(updated_user),
    )


@router.post(
    "/change-password",
    response_model=ApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Change user password",
    description="Changes password for currently authenticated user after verifying current password.",
)
def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[None]:
    """
    Change password for the current logged-in user.
    Requires valid Bearer token, correct current password, and strong new password.
    Never returns or logs plaintext passwords or hash values.
    """
    AuthService.change_password(
        db=db,
        user=current_user,
        data=data,
    )
    return ApiResponse(
        success=True,
        message="Đổi mật khẩu thành công.",
        data=None,
    )


@router.post(
    "/logout",
    response_model=ApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Log out user",
    description=(
        "Confirms client logout request. In stateless JWT architecture, "
        "tokens are not blacklisted server-side; the client MUST discard the token. "
        "Token is not revoked immediately on server."
    ),
)
def logout(
    current_user: User = Depends(get_current_user),
) -> ApiResponse[None]:
    """
    Log out the current user session.
    Requires a valid Bearer token.
    Returns 200 OK. Frontend must clear the stored token from client storage.
    """
    return ApiResponse(
        success=True,
        message="Đăng xuất thành công.",
        data=None,
    )


# ── User Profile Avatar Operations ────────────────────────────────────────────

@router.post(
    "/me/avatar",
    response_model=ApiResponse[AvatarUploadResponse],
    status_code=status.HTTP_200_OK,
    summary="Upload user avatar image",
    description="Uploads and updates avatar image for current user. Validates magic bytes, max size (2 MB), and format (JPEG, PNG, WebP).",
)
def upload_avatar(
    file: UploadFile = File(..., description="Image file (JPEG, PNG, WebP up to 2 MB)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[AvatarUploadResponse]:
    """
    Tải lên và cập nhật ảnh đại diện của người dùng hiện tại.
    - Yêu cầu xác thực JWT Bearer token.
    - Nhận tệp qua multipart/form-data.
    - Kiểm tra tệp rỗng, dung lượng vượt quá 2 MB (HTTP 413).
    - Kiểm tra Magic Bytes thực tế, chỉ chấp nhận JPEG, PNG, WebP (HTTP 415).
    - Cập nhật avatar_url trong cơ sở dữ liệu và dọn dẹp ảnh cũ an toàn.
    """
    if not file or not file.filename:
        raise BadRequestException(
            message="Vui lòng chọn một tệp hình ảnh hợp lệ để tải lên.",
            error_code="FILE_MISSING",
        )

    try:
        if hasattr(file, "file") and hasattr(file.file, "read"):
            content = file.file.read()
        else:
            content = file.read()
    except Exception as read_err:
        raise BadRequestException(
            message=f"Không thể đọc nội dung tệp tải lên: {read_err}",
            error_code="FILE_READ_ERROR",
        )

    if not content or len(content) == 0:
        raise BadRequestException(
            message="Tệp ảnh tải lên không được để rỗng.",
            error_code="EMPTY_FILE",
        )

    max_size = getattr(settings, "MAX_AVATAR_SIZE_BYTES", 2 * 1024 * 1024)
    if len(content) > max_size:
        raise PayloadTooLargeException(
            message="Kích thước tệp ảnh vượt quá giới hạn tối đa cho phép (2 MB).",
            details={"max_size": max_size, "actual_size": len(content)},
        )

    detected_format = StorageService.detect_image_format(content)
    if not detected_format:
        raise UnsupportedMediaTypeException(
            message="Định dạng tệp không được hỗ trợ. Chỉ chấp nhận các định dạng JPEG, PNG và WebP.",
            details={"allowed_formats": ["jpeg", "png", "webp"]},
        )

    avatar_url, _user = AuthService.update_user_avatar(
        db=db,
        user=current_user,
        content=content,
        storage_service=storage_service,
    )

    return ApiResponse(
        success=True,
        message="Cập nhật ảnh đại diện thành công.",
        data=AvatarUploadResponse(avatar_url=avatar_url),
    )


@router.delete(
    "/me/avatar",
    response_model=ApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Delete user avatar",
    description="Deletes profile avatar image for the authenticated user and resets avatar_url to null.",
)
def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[None]:
    """
    Xóa ảnh đại diện của người dùng hiện tại.
    - Yêu cầu xác thực JWT Bearer token.
    - Xóa tệp vật lý tương ứng khỏi hệ thống lưu trữ đĩa.
    - Đặt lại avatar_url = None trong cơ sở dữ liệu.
    - Trả về HTTP 400 nếu tài khoản chưa thiết lập ảnh đại diện để xóa.
    """
    AuthService.delete_user_avatar(
        db=db,
        user=current_user,
        storage_service=storage_service,
    )

    return ApiResponse(
        success=True,
        message="Xóa ảnh đại diện thành công.",
        data=None,
    )
