from datetime import timedelta
import pytest
from jose import jwt

from app.core.config import settings
from app.core.exceptions import UnauthorizedException
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

def test_hash_password_format():
    """Hashed password should start with $2b$ and not be plaintext."""
    raw = "MySecureP@ss1"
    hashed = hash_password(raw)

    assert hashed != raw
    assert hashed.startswith("$2b$")
    assert len(hashed) >= 50


def test_hash_password_generates_unique_salts():
    """Two hashes of the same password must produce different strings."""
    raw = "DuplicatePass123"
    hash1 = hash_password(raw)
    hash2 = hash_password(raw)

    assert hash1 != hash2
    assert verify_password(raw, hash1) is True
    assert verify_password(raw, hash2) is True


def test_verify_password_success():
    """Verify returns True when plain password matches the hash."""
    raw = "CorrectPassword@2026"
    hashed = hash_password(raw)

    assert verify_password(raw, hashed) is True


def test_verify_password_failure():
    """Verify returns False when plain password does not match the hash."""
    raw = "CorrectPassword@2026"
    hashed = hash_password(raw)

    assert verify_password("WrongPassword@2026", hashed) is False
    assert verify_password("", hashed) is False


def test_verify_password_malformed_hash():
    """Verify returns False gracefully when hash is corrupted or invalid."""
    assert verify_password("AnyPassword123", "not_a_valid_hash") is False
    assert verify_password("AnyPassword123", "") is False
    assert verify_password("AnyPassword123", "$2b$12$invalidtruncated") is False


def test_password_with_vietnamese_characters():
    """Password with unicode/Vietnamese characters should hash and verify properly."""
    raw = "MậtKhẩuBảoMật@123"
    hashed = hash_password(raw)

    assert verify_password(raw, hashed) is True
    assert verify_password("MatKhauBaoMat@123", hashed) is False


def test_password_longer_than_72_bytes():
    """Passwords exceeding bcrypt's 72-byte limit are truncated safely without error."""
    long_pwd = "A" * 100
    hashed = hash_password(long_pwd)

    assert verify_password(long_pwd, hashed) is True
    assert verify_password("A" * 72, hashed) is True
    assert verify_password("B" * 100, hashed) is False


# ── JWT Security Tests ────────────────────────────────────────────────────────

def test_create_and_decode_access_token_success():
    """Verify that a valid JWT token can be created and decoded with stable string sub."""
    user_id = 42
    token = create_access_token(subject=user_id)

    assert isinstance(token, str)
    assert len(token.split(".")) == 3

    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert "exp" in payload
    assert "iat" in payload


def test_create_access_token_with_custom_claims_and_delta():
    """Verify custom expiration delta and additional claims."""
    delta = timedelta(minutes=15)
    token = create_access_token(
        subject="admin_user",
        expires_delta=delta,
        additional_claims={"role": "admin", "custom": "value123"},
    )

    payload = decode_access_token(token)
    assert payload["sub"] == "admin_user"
    assert payload["role"] == "admin"
    assert payload["custom"] == "value123"


def test_decode_access_token_expired():
    """Expired token must raise UnauthorizedException with TOKEN_EXPIRED."""
    expired_token = create_access_token(
        subject=100,
        expires_delta=timedelta(seconds=-10),
    )

    with pytest.raises(UnauthorizedException) as exc_info:
        decode_access_token(expired_token)

    assert exc_info.value.status_code == 401
    assert exc_info.value.error_code == "TOKEN_EXPIRED"


def test_decode_access_token_invalid_signature():
    """Token signed with wrong key must raise UnauthorizedException with INVALID_TOKEN."""
    fake_token = jwt.encode(
        {"sub": "999", "exp": 9999999999},
        "wrong-secret-key-pdf-lingua",
        algorithm="HS256",
    )

    with pytest.raises(UnauthorizedException) as exc_info:
        decode_access_token(fake_token)

    assert exc_info.value.status_code == 401
    assert exc_info.value.error_code == "INVALID_TOKEN"


def test_decode_access_token_missing_sub():
    """Token missing 'sub' claim must raise UnauthorizedException with INVALID_TOKEN."""
    token_without_sub = jwt.encode(
        {"exp": 9999999999},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    with pytest.raises(UnauthorizedException) as exc_info:
        decode_access_token(token_without_sub)

    assert exc_info.value.status_code == 401
    assert exc_info.value.error_code == "INVALID_TOKEN"


def test_decode_access_token_malformed():
    """Malformed or garbage string must raise UnauthorizedException with INVALID_TOKEN."""
    with pytest.raises(UnauthorizedException) as exc_info:
        decode_access_token("not.a.valid.jwt.token")

    assert exc_info.value.status_code == 401
    assert exc_info.value.error_code == "INVALID_TOKEN"

