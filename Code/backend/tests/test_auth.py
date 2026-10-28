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
    with TestClient(app, raise_server_exceptions=False) as test_client:
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
    with patch.object(db_session, "rollback", wraps=db_session.rollback) as mock_rollback:
        with patch.object(db_session, "commit", side_effect=IntegrityError("duplicate", params=None, orig=None)):
            with pytest.raises(BadRequestException) as exc_info:
                AuthService.register_user(db=db_session, user_in=user_in)

            assert exc_info.value.status_code == 400
            assert exc_info.value.error_code == "EMAIL_ALREADY_EXISTS"
        mock_rollback.assert_called_once()


def test_register_session_usable_after_rollback(client, db_session):
    """TC-REG-15: Database session remains usable for subsequent requests after rollback."""
    from unittest.mock import patch
    from sqlalchemy.exc import IntegrityError

    payload1 = {
        "email": "first_fail@example.com",
        "password": "Password12345",
        "full_name": "Will Fail First",
    }
    payload2 = {
        "email": "second_success@example.com",
        "password": "Password12345",
        "full_name": "Will Succeed Next",
    }

    # Simulate an error on the first call and assert rollback is called
    with patch.object(db_session, "rollback", wraps=db_session.rollback) as mock_rollback:
        with patch.object(db_session, "commit", side_effect=IntegrityError("forced error", params=None, orig=None)):
            res1 = client.post("/api/auth/register", json=payload1)
            assert res1.status_code == 400
            assert res1.json()["error_code"] == "EMAIL_ALREADY_EXISTS"
        mock_rollback.assert_called_once()

    # Verify first user was not persisted
    assert db_session.query(User).filter(User.email == "first_fail@example.com").first() is None

    # Subsequent request using the same session must succeed without transaction-abort issues
    res2 = client.post("/api/auth/register", json=payload2)
    assert res2.status_code == 201
    assert res2.json()["success"] is True
    assert res2.json()["data"]["email"] == "second_success@example.com"
    assert db_session.query(User).filter(User.email == "second_success@example.com").first() is not None


def test_register_internal_db_error_masked_no_leak(client, db_session):
    """TC-REG-16: Unexpected database errors return generic 500 without leaking stack traces or internal schema details."""
    from unittest.mock import patch
    from sqlalchemy.exc import OperationalError

    payload = {
        "email": "db_crash@example.com",
        "password": "Password12345",
        "full_name": "Crash Test",
    }

    # Simulate an unexpected operational error (e.g. disk I/O, database corrupted) and assert rollback is called
    with patch.object(db_session, "rollback", wraps=db_session.rollback) as mock_rollback:
        with patch.object(db_session, "commit", side_effect=OperationalError("disk I/O error on users.ibd", params=None, orig=None)):
            response = client.post("/api/auth/register", json=payload)
        mock_rollback.assert_called_once()

    assert response.status_code == 500
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "INTERNAL_SERVER_ERROR"
    # Ensure raw database strings or stack traces are NOT leaked in response
    assert "disk I/O" not in str(data)
    assert "users.ibd" not in str(data)
    assert "OperationalError" not in str(data)
    assert "Traceback" not in str(data)
    assert data["details"] is None


def test_register_password_exceeds_max_length(client, db_session):
    """TC-REG-17: Password exceeding 128 characters is rejected with 422 and does not create user."""
    too_long_pwd = "A1" + "a" * 127  # 129 characters
    payload = {
        "email": "toolongpwd@example.com",
        "password": too_long_pwd,
        "full_name": "Too Long Password",
    }
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "VALIDATION_ERROR"
    assert any("password" in err.get("field", "") for err in data.get("details", []))

    # Verify database is untouched
    assert db_session.query(User).filter(User.email == "toolongpwd@example.com").first() is None


def test_register_full_name_exceeds_max_length(client, db_session):
    """TC-REG-18: full_name exceeding 150 characters is rejected with 422 and does not create user."""
    too_long_name = "N" * 151
    payload = {
        "email": "toolongname@example.com",
        "password": "SecurePassword123",
        "full_name": too_long_name,
    }
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "VALIDATION_ERROR"
    assert any("full_name" in err.get("field", "") for err in data.get("details", []))

    # Verify database is untouched
    assert db_session.query(User).filter(User.email == "toolongname@example.com").first() is None


def test_register_missing_required_fields(client, db_session):
    """TC-REG-19: Missing required fields (email or password) are rejected with 422 and do not create user."""
    # Missing email
    payload_no_email = {
        "password": "SecurePassword123",
        "full_name": "No Email User",
    }
    res_no_email = client.post("/api/auth/register", json=payload_no_email)
    assert res_no_email.status_code == 422
    data_email = res_no_email.json()
    assert data_email["success"] is False
    assert data_email["error_code"] == "VALIDATION_ERROR"
    assert any("email" in err.get("field", "") for err in data_email.get("details", []))

    # Missing password
    payload_no_pwd = {
        "email": "nopwd@example.com",
        "full_name": "No Password User",
    }
    res_no_pwd = client.post("/api/auth/register", json=payload_no_pwd)
    assert res_no_pwd.status_code == 422
    data_pwd = res_no_pwd.json()
    assert data_pwd["success"] is False
    assert data_pwd["error_code"] == "VALIDATION_ERROR"
    assert any("password" in err.get("field", "") for err in data_pwd.get("details", []))

    # Verify database is untouched
    assert db_session.query(User).filter(User.email == "nopwd@example.com").first() is None


def test_register_empty_payload(client, db_session):
    """TC-REG-20: Empty payload {} is rejected with 422 and does not create user."""
    response = client.post("/api/auth/register", json={})

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "VALIDATION_ERROR"
    fields_with_errors = [err.get("field", "") for err in data.get("details", [])]
    assert any("email" in f for f in fields_with_errors)
    assert any("password" in f for f in fields_with_errors)

    # Verify database has zero users created
    assert db_session.query(User).count() == 0


def test_register_email_with_spaces_inside(client, db_session):
    """TC-REG-21: Email containing spaces inside is rejected with 422 and does not create user."""
    payload = {
        "email": "user name@example.com",
        "password": "SecurePassword123",
        "full_name": "Space In Email",
    }
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "VALIDATION_ERROR"
    assert any("email" in err.get("field", "") for err in data.get("details", []))

    # Verify database is untouched
    assert db_session.query(User).filter(User.email.ilike("%space%")).first() is None


# ── Login Test Cases ──────────────────────────────────────────────────────────

def test_login_success(client, db_session):
    """TC-LOG-01: Valid credentials return HTTP 200 and safe UserResponse without passwords."""
    # Setup registered user
    reg_payload = {
        "email": "loginuser@example.com",
        "password": "ValidPassword123",
        "full_name": "Login User",
    }
    client.post("/api/auth/register", json=reg_payload)

    login_payload = {
        "email": "loginuser@example.com",
        "password": "ValidPassword123",
    }
    response = client.post("/api/auth/login", json=login_payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Đăng nhập thành công."

    token_data = data["data"]
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    assert isinstance(token_data["access_token"], str)
    assert len(token_data["access_token"].split(".")) == 3
    user_data = token_data["user"]
    assert user_data["email"] == "loginuser@example.com"
    assert user_data["full_name"] == "Login User"
    assert user_data["role"] == "free"
    assert user_data["is_active"] is True
    assert "id" in user_data

    # Security: No sensitive password fields in response
    assert "password" not in user_data
    assert "hashed_password" not in user_data


def test_login_email_normalization_and_whitespace(client):
    """TC-LOG-02: Email with surrounding spaces or uppercase letters logs in successfully."""
    reg_payload = {
        "email": "normaluser@example.com",
        "password": "ValidPassword123",
    }
    client.post("/api/auth/register", json=reg_payload)

    login_payload = {
        "email": "   NORMALUSER@EXAMPLE.COM   ",
        "password": "ValidPassword123",
    }
    response = client.post("/api/auth/login", json=login_payload)

    assert response.status_code == 200
    assert response.json()["data"]["user"]["email"] == "normaluser@example.com"


def test_login_wrong_password(client):
    """TC-LOG-03: Wrong password returns 401 Unauthorized with INVALID_CREDENTIALS."""
    reg_payload = {
        "email": "wrongpwd@example.com",
        "password": "ValidPassword123",
    }
    client.post("/api/auth/register", json=reg_payload)

    login_payload = {
        "email": "wrongpwd@example.com",
        "password": "WrongPassword999",
    }
    response = client.post("/api/auth/login", json=login_payload)

    assert response.status_code == 401
    err = response.json()
    assert err["success"] is False
    assert err["error_code"] == "INVALID_CREDENTIALS"
    assert err["message"] == "Email hoặc mật khẩu không chính xác."


def test_login_nonexistent_email(client):
    """TC-LOG-04: Non-existent email returns identical 401 response as wrong password (anti-enumeration)."""
    login_payload = {
        "email": "nonexistent@example.com",
        "password": "AnyPassword123",
    }
    response = client.post("/api/auth/login", json=login_payload)

    assert response.status_code == 401
    err = response.json()
    assert err["success"] is False
    assert err["error_code"] == "INVALID_CREDENTIALS"
    assert err["message"] == "Email hoặc mật khẩu không chính xác."


def test_login_inactive_account(client, db_session):
    """TC-LOG-05: Account with is_active=False returns 403 Forbidden with ACCOUNT_INACTIVE."""
    reg_payload = {
        "email": "inactive@example.com",
        "password": "ValidPassword123",
    }
    client.post("/api/auth/register", json=reg_payload)

    # Deactivate user directly in DB
    user = db_session.query(User).filter(User.email == "inactive@example.com").first()
    user.is_active = False
    db_session.commit()

    login_payload = {
        "email": "inactive@example.com",
        "password": "ValidPassword123",
    }
    response = client.post("/api/auth/login", json=login_payload)

    assert response.status_code == 403
    err = response.json()
    assert err["success"] is False
    assert err["error_code"] == "ACCOUNT_INACTIVE"
    assert "vô hiệu hóa" in err["message"]


def test_login_validation_errors(client):
    """TC-LOG-06: Missing fields or invalid email format returns 422 Unprocessable Entity."""
    # Missing email
    r1 = client.post("/api/auth/login", json={"password": "Password123"})
    assert r1.status_code == 422
    assert r1.json()["error_code"] == "VALIDATION_ERROR"

    # Missing password
    r2 = client.post("/api/auth/login", json={"email": "valid@example.com"})
    assert r2.status_code == 422
    assert r2.json()["error_code"] == "VALIDATION_ERROR"

    # Invalid email format
    r3 = client.post("/api/auth/login", json={"email": "not-an-email", "password": "Password123"})
    assert r3.status_code == 422
    assert r3.json()["error_code"] == "VALIDATION_ERROR"


def test_login_failed_does_not_mutate_db(client, db_session):
    """TC-LOG-07: Failed login attempts do not modify user data in the database."""
    reg_payload = {
        "email": "unmodified@example.com",
        "password": "ValidPassword123",
        "full_name": "Original Name",
    }
    client.post("/api/auth/register", json=reg_payload)

    u_before = db_session.query(User).filter(User.email == "unmodified@example.com").first()
    updated_at_before = u_before.updated_at

    # Perform failed login
    client.post("/api/auth/login", json={"email": "unmodified@example.com", "password": "WrongPassword"})

    db_session.expire_all()
    u_after = db_session.query(User).filter(User.email == "unmodified@example.com").first()

    assert u_after.full_name == "Original Name"
    assert u_after.role == UserRole.FREE
    assert u_after.is_active is True
    assert u_after.updated_at == updated_at_before


def test_login_payload_tampering_ignored(client, db_session):
    """TC-LOG-08: Extra fields like role, id, or is_active in login payload are ignored."""
    reg_payload = {
        "email": "tamperlogin@example.com",
        "password": "ValidPassword123",
    }
    client.post("/api/auth/register", json=reg_payload)

    tampered_login = {
        "email": "tamperlogin@example.com",
        "password": "ValidPassword123",
        "role": "admin",
        "id": 99999,
        "is_active": False,
    }
    response = client.post("/api/auth/login", json=tampered_login)

    assert response.status_code == 200
    user_data = response.json()["data"]["user"]
    assert user_data["role"] == "free"
    assert user_data["is_active"] is True
    assert user_data["id"] != 99999

    # Confirm DB state unchanged
    db_user = db_session.query(User).filter(User.email == "tamperlogin@example.com").first()
    assert db_user.role == UserRole.FREE
    assert db_user.is_active is True

