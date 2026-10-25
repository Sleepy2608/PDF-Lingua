from app.core.security import hash_password, verify_password

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
