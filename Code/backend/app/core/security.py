import bcrypt


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
