from typing import Callable, Generator, Optional, Sequence, Set, Union
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token
from app.models.user import User, UserRole

http_bearer = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a transactional database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    Authenticate and extract current user from the HTTP Bearer token.

    Validates:
    - Presence of Bearer token and valid Bearer scheme (401 NOT_AUTHENTICATED)
    - Token validity and signature (401 INVALID_TOKEN)
    - Token expiration (401 TOKEN_EXPIRED)
    - User existence in database (401 USER_NOT_FOUND)
    - Active user status (403 ACCOUNT_INACTIVE)
    """
    if not credentials or not credentials.credentials:
        auth_header = request.headers.get("authorization")
        if not auth_header:
            raise UnauthorizedException(
                message="Yêu cầu xác thực. Vui lòng gửi kèm Bearer token.",
                error_code="NOT_AUTHENTICATED",
            )
        raise UnauthorizedException(
            message="Phương thức xác thực không hợp lệ. Vui lòng sử dụng Bearer token.",
            error_code="NOT_AUTHENTICATED",
        )

    # Decode and verify JWT access token
    payload = decode_access_token(credentials.credentials)

    sub = payload.get("sub")
    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        raise UnauthorizedException(
            message="Token không hợp lệ (subject không hợp lệ).",
            error_code="INVALID_TOKEN",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise UnauthorizedException(
            message="Tài khoản người dùng không tồn tại hoặc đã bị xóa.",
            error_code="USER_NOT_FOUND",
        )

    if not user.is_active:
        raise ForbiddenException(
            message="Tài khoản này đã bị vô hiệu hóa.",
            error_code="ACCOUNT_INACTIVE",
        )

    return user


def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Authenticate and extract current user if an Authorization header is provided.

    Behavior:
    - Returns None if no Authorization header is present (Guest mode).
    - If an Authorization header is present, strictly validates credentials via get_current_user.
      Expired, invalid, or malformed tokens will raise standard 401/403 exceptions
      rather than silently falling back to Guest mode.
    """
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.strip():
        return None

    return get_current_user(request=request, credentials=credentials, db=db)


def require_roles(
    *allowed_roles: Union[UserRole, str, Sequence[Union[UserRole, str]]],
) -> Callable[..., User]:
    """
    FastAPI dependency factory enforcing Role-Based Access Control (RBAC).

    Requires the user to be authenticated and have one of the designated roles.
    Raises:
    - 401 UnauthorizedException if unauthenticated (via get_current_user).
    - 403 ForbiddenException if the user's role is not in allowed_roles.

    Usage:
        @router.get("/admin-route")
        def admin_endpoint(current_user: User = Depends(require_roles(UserRole.ADMIN))):
            ...
    """
    flattened: Set[UserRole] = set()
    for item in allowed_roles:
        if isinstance(item, (list, tuple, set)):
            for sub_item in item:
                flattened.add(sub_item if isinstance(sub_item, UserRole) else UserRole(str(sub_item).lower()))
        else:
            flattened.add(item if isinstance(item, UserRole) else UserRole(str(item).lower()))

    if not flattened:
        raise ValueError("At least one UserRole must be specified for require_roles.")

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.role
        role_enum = user_role if isinstance(user_role, UserRole) else UserRole(str(user_role).lower())
        if role_enum not in flattened:
            raise ForbiddenException(
                message="Bạn không có quyền thực hiện hành động này.",
                error_code="FORBIDDEN",
            )
        return current_user

    return role_checker
