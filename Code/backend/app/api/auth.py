"""
Authentication API Router
-------------------------
Endpoints for user registration, login, logout, and token refresh.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.schemas.common import ApiResponse
from app.schemas.user import UserCreate, UserResponse
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
