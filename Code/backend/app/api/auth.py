"""
Authentication API Router
-------------------------
Endpoints for user registration, login, logout, and token refresh.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import AuthService

router = APIRouter()


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
