from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import bcrypt
from jose import ExpiredSignatureError, JWTError, jwt

from app.core.config import settings
from app.core.exceptions import UnauthorizedException


def hash_password(password: str) -> str:
    """
    Hash a plaintext password using bcrypt with automated salt.

    - Password is truncated to 72 bytes (the maximum bcrypt input length).
    - Salt rounds default to 12 for an optimal balance between security and latency.

    :param password: The plain text password to hash.
    :return: The bcrypt hashed password string (e.g., $2b$12$...).
    """
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a stored bcrypt hash.

    Uses constant-time comparison to prevent timing attack vulnerabilities.
    Safely returns False if the hash string is malformed or invalid.

    :param plain_password: The plaintext password from login attempt.
    :param hashed_password: The hashed password stored in the database.
    :return: True if the password matches, False otherwise.
    """
    try:
        plain_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(plain_bytes, hash_bytes)
    except Exception:
        return False


def create_access_token(
    subject: str | int,
    expires_delta: Optional[timedelta] = None,
    additional_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Create a signed JWT access token using python-jose.

    :param subject: User ID or stable identifier (cast to string for the 'sub' claim).
    :param expires_delta: Optional expiration delta. Defaults to settings.ACCESS_TOKEN_EXPIRE_MINUTES.
    :param additional_claims: Optional extra claims dictionary.
    :return: Encoded JWT string.
    """
    now = datetime.now(timezone.utc)
    if expires_delta is not None:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": expire,
    }
    if additional_claims:
        to_encode.update(additional_claims)

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode, verify signature and validate expiration of a JWT access token.

    :param token: Raw JWT string.
    :return: Decoded claims dictionary including 'sub' and 'exp'.
    :raises UnauthorizedException: When token is expired, corrupted, signature mismatch, or missing sub.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        sub = payload.get("sub")
        if not sub:
            raise UnauthorizedException(
                message="Token không hợp lệ (thiếu thông tin sub).",
                error_code="INVALID_TOKEN",
            )
        return payload
    except ExpiredSignatureError as exc:
        raise UnauthorizedException(
            message="Token đã hết hạn.",
            error_code="TOKEN_EXPIRED",
        ) from exc
    except JWTError as exc:
        raise UnauthorizedException(
            message="Token không hợp lệ hoặc chữ ký sai.",
            error_code="INVALID_TOKEN",
        ) from exc

