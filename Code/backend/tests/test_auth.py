"""
Authentication Tests
--------------------
Tests for user registration:
- Successful registration (201 Created)
- Duplicate email prevention (400 Bad Request with EMAIL_ALREADY_EXISTS)
- Password security: hashing verification, no plain or hashed password exposed
- Input validation: weak password, invalid email (422 Unprocessable Entity)
- Role tampering protection: client cannot set role to admin
- Isolated in-memory SQLite database to prevent modifying real database
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.core.dependencies import get_db
from app.core.security import verify_password
from app.main import app
from app.models.user import User, UserRole

# Use an isolated in-memory SQLite database with StaticPool for test threads
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a clean database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """TestClient that overrides get_db dependency with test database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ── Test Cases ────────────────────────────────────────────────────────────────

def test_register_success(client, db_session):
    """TC-REG-01: Successful user registration returns 201 and UserResponse."""
    payload = {
        "email": "testuser@example.com",
        "password": "SecurePassword123",
        "full_name": "Nguyễn Văn Test",
    }
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Đăng ký tài khoản thành công."
    user_data = data["data"]
    assert user_data["email"] == "testuser@example.com"
    assert user_data["full_name"] == "Nguyễn Văn Test"
    assert user_data["role"] == "free"
    assert user_data["is_active"] is True
    assert "id" in user_data

    # Security: No passwords leaked
    assert "password" not in user_data
    assert "hashed_password" not in user_data

    # Verify user exists in database with hashed password
    db_user = db_session.query(User).filter(User.email == "testuser@example.com").first()
    assert db_user is not None
    assert db_user.hashed_password != "SecurePassword123"
    assert db_user.hashed_password.startswith("$2b$")
    assert verify_password("SecurePassword123", db_user.hashed_password) is True


def test_register_success_without_full_name(client):
    """TC-REG-02: Registering without optional full_name succeeds with full_name=None."""
    payload = {
        "email": "nofullname@example.com",
        "password": "Password12345",
    }
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == "nofullname@example.com"
    assert data["data"]["full_name"] is None


def test_register_duplicate_email(client):
    """TC-REG-03: Registering with an existing email returns 400 and EMAIL_ALREADY_EXISTS."""
    payload = {
        "email": "duplicate@example.com",
        "password": "Password12345",
        "full_name": "First Account",
    }
    # First registration
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 201

    # Second registration with uppercase/mixed email
    duplicate_payload = {
        "email": "DUPLICATE@EXAMPLE.COM",
        "password": "AnotherPassword456",
        "full_name": "Duplicate Account",
    }
    res2 = client.post("/api/auth/register", json=duplicate_payload)

    assert res2.status_code == 400
    err = res2.json()
    assert err["success"] is False
    assert err["error_code"] == "EMAIL_ALREADY_EXISTS"
    assert "Email này đã được sử dụng" in err["message"]


def test_register_invalid_email_format(client):
    """TC-REG-04: Invalid email format is rejected with 422 Unprocessable Entity."""
    payload = {
        "email": "not-an-email",
        "password": "ValidPassword123",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["error_code"] == "VALIDATION_ERROR"


def test_register_password_too_short(client):
    """TC-REG-05: Password < 8 characters is rejected with 422."""
    payload = {
        "email": "shortpass@example.com",
        "password": "Pass1",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["error_code"] == "VALIDATION_ERROR"


def test_register_password_no_digits(client):
    """TC-REG-06: Password without digits is rejected with 422."""
    payload = {
        "email": "nodigit@example.com",
        "password": "OnlyLettersPassword",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["error_code"] == "VALIDATION_ERROR"


def test_register_password_no_letters(client):
    """TC-REG-07: Password without letters is rejected with 422."""
    payload = {
        "email": "noletter@example.com",
        "password": "1234567890",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["error_code"] == "VALIDATION_ERROR"


def test_register_cannot_tamper_role(client, db_session):
    """TC-REG-08: Client cannot assign admin role during registration."""
    payload = {
        "email": "hacker@example.com",
        "password": "Password12345",
        "role": "admin",
    }
    response = client.post("/api/auth/register", json=payload)

    # UserCreate does not accept role in its schema, role in payload is ignored
    assert response.status_code == 201
    user_data = response.json()["data"]
    assert user_data["role"] == "free"

    # Verify in DB
    db_user = db_session.query(User).filter(User.email == "hacker@example.com").first()
    assert db_user.role == UserRole.FREE


def test_register_cannot_tamper_internal_fields(client, db_session):
    """TC-REG-09: Client cannot tamper with is_active, role, or id."""
    payload = {
        "email": "tamper@example.com",
        "password": "Password12345",
        "role": "admin",
        "is_active": False,
        "id": 999999,
    }
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    user_data = response.json()["data"]
    assert user_data["role"] == "free"
    assert user_data["is_active"] is True
    assert user_data["id"] != 999999

    db_user = db_session.query(User).filter(User.email == "tamper@example.com").first()
    assert db_user.role == UserRole.FREE
    assert db_user.is_active is True
    assert db_user.id != 999999


def test_register_whitespace_full_name_sanitized(client):
    """TC-REG-10: Whitespace-only full_name is converted to None."""
    payload = {
        "email": "spacesname@example.com",
        "password": "Password12345",
        "full_name": "     ",
    }
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    user_data = response.json()["data"]
    assert user_data["full_name"] is None


def test_register_unicode_vietnamese_password(client, db_session):
    """TC-REG-11: Password with Vietnamese unicode characters registers and verifies securely."""
    raw_pwd = "MậtKhẩuBảoMật@123"
    payload = {
        "email": "unicodeuser@example.com",
        "password": raw_pwd,
        "full_name": "Người Dùng Tiếng Việt",
    }
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    db_user = db_session.query(User).filter(User.email == "unicodeuser@example.com").first()
    assert db_user is not None
    assert verify_password(raw_pwd, db_user.hashed_password) is True
    assert verify_password("MatKhauBaoMat@123", db_user.hashed_password) is False


def test_register_long_password_consistent_bcrypt(client, db_session):
    """TC-REG-12: Password > 72 bytes registers safely and verifies consistently."""
    long_pwd = "SecurePass123" + "A" * 70  # 83 characters
    payload = {
        "email": "longpwd@example.com",
        "password": long_pwd,
    }
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    db_user = db_session.query(User).filter(User.email == "longpwd@example.com").first()
    assert db_user is not None
    assert verify_password(long_pwd, db_user.hashed_password) is True
    assert verify_password(long_pwd[:72], db_user.hashed_password) is True
    assert verify_password("WrongPassword123", db_user.hashed_password) is False


def test_register_response_has_no_sensitive_fields(client):
    """TC-REG-13: Registration response data keys contain only public safe fields."""
    payload = {
        "email": "safecheck@example.com",
        "password": "Password12345",
        "full_name": "Check Public Keys",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    user_data = response.json()["data"]

    allowed_keys = {"id", "email", "full_name", "role", "is_active", "created_at", "updated_at"}
    assert set(user_data.keys()) == allowed_keys
    assert "password" not in user_data
    assert "hashed_password" not in user_data


def test_register_concurrent_race_condition_handled(db_session):
    """TC-REG-14: Database IntegrityError during concurrent registration raises 400 and rolls back."""
    from unittest.mock import patch
    from sqlalchemy.exc import IntegrityError
    from app.services.auth_service import AuthService
    from app.schemas.user import UserCreate
    from app.core.exceptions import BadRequestException

    user_in = UserCreate(
        email="concurrent@example.com",
        password="Password12345",
        full_name="Concurrent User",
    )

    # Simulate an IntegrityError occurring during db.commit (race condition)
    with patch.object(db_session, "commit", side_effect=IntegrityError("duplicate", params=None, orig=None)):
        with pytest.raises(BadRequestException) as exc_info:
            AuthService.register_user(db=db_session, user_in=user_in)

        assert exc_info.value.status_code == 400
        assert exc_info.value.error_code == "EMAIL_ALREADY_EXISTS"

