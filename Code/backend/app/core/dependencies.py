from typing import Generator, Optional
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token
from app.models.user import User

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
