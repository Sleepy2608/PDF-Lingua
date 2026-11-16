"""
Avatar Schema & Database Model Tests
------------------------------------
Verifies avatar_url attribute expansion on User ORM model, Pydantic DTOs,
database migration backward compatibility, and auth endpoint responses.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.auth import get_me, register, update_me
from app.core.database import Base, _migrate_db_schema
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, hash_password
from app.models.user import User, UserRole
from app.schemas.user import AvatarUploadResponse, UserBase, UserCreate, UserResponse, UserUpdate

# Use an isolated in-memory SQLite database with StaticPool for test isolation
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Fixtures & Setup ──────────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def db_session():
    """Tạo database in-memory độc lập cho từng ca kiểm thử."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


# ── Model & Schema Unit Tests ────────────────────────────────────────────────

def test_user_model_has_avatar_url_default_none(db_session: Session):
    """Kiểm tra trường avatar_url trên ORM model User mặc định là None khi tạo tài khoản."""
    user = User(
        email="test_avatar@example.com",
        hashed_password=hash_password("Password123"),
        full_name="Nguyễn Văn A",
        role=UserRole.FREE,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert hasattr(user, "avatar_url")
    assert user.avatar_url is None


def test_user_base_and_response_schemas_include_avatar_url():
    """Kiểm tra UserBase và UserResponse chứa trường avatar_url hợp lệ."""
    base = UserBase(email="user@example.com", full_name="User Test", avatar_url="/static/avatars/test.webp")
    assert base.avatar_url == "/static/avatars/test.webp"

    # Trường hợp không truyền avatar_url, mặc định phải là None
    base_default = UserBase(email="user2@example.com")
    assert base_default.avatar_url is None

    # Kiểm tra UserResponse model_validate từ ORM object đầy đủ
    now = datetime.now(timezone.utc)
    user = User(
        id=1,
        email="user_resp@example.com",
        hashed_password="hashed_pwd",
        full_name="User Resp",
        role=UserRole.FREE,
        is_active=True,
        avatar_url="/static/avatars/custom_avatar.webp",
        created_at=now,
        updated_at=now,
    )
    response = UserResponse.model_validate(user)
    assert response.avatar_url == "/static/avatars/custom_avatar.webp"


def test_user_update_schema_supports_avatar_url():
    """Kiểm tra payload UserUpdate hỗ trợ cập nhật avatar_url."""
    update_data = UserUpdate(full_name="New Name", avatar_url="/static/avatars/updated.webp")
    assert update_data.avatar_url == "/static/avatars/updated.webp"

    update_none = UserUpdate(full_name="Only Name")
    assert update_none.avatar_url is None


def test_avatar_upload_response_schema():
    """Kiểm tra schema AvatarUploadResponse trả về đúng URL dạng chuỗi."""
    resp = AvatarUploadResponse(avatar_url="/static/avatars/avatar_uuid123.webp")
    assert resp.avatar_url == "/static/avatars/avatar_uuid123.webp"
    assert resp.model_dump() == {"avatar_url": "/static/avatars/avatar_uuid123.webp"}


# ── Database Migration & Compatibility Tests ─────────────────────────────────

def test_migration_adds_column_without_data_loss():
    """
    Kiểm tra cơ chế migration: khi bảng users cũ chưa có cột avatar_url,
    hàm _migrate_db_schema tự động bổ sung cột và bảo toàn toàn bộ tài khoản cũ.
    """
    migration_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # 1. Tạo bảng users kiểu cũ (không có cột avatar_url)
    with migration_engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    hashed_password VARCHAR(255) NOT NULL,
                    full_name VARCHAR(150),
                    role VARCHAR(20) DEFAULT 'free' NOT NULL,
                    is_active BOOLEAN DEFAULT 1 NOT NULL,
                    created_at DATETIME,
                    updated_at DATETIME
                );
                """
            )
        )
        # Chèn tài khoản cũ trước khi migrate
        conn.execute(
            text(
                """
                INSERT INTO users (email, hashed_password, full_name, role, is_active)
                VALUES ('legacy_user@example.com', 'legacy_hash', 'Legacy User', 'free', 1);
                """
            )
        )

    # 2. Chạy migration
    _migrate_db_schema(migration_engine)

    # 3. Kiểm tra cột đã được bổ sung và dữ liệu cũ vẫn nguyên vẹn
    with migration_engine.connect() as conn:
        result = conn.execute(
            text("SELECT email, full_name, avatar_url FROM users WHERE email = 'legacy_user@example.com'")
        ).fetchone()
        assert result is not None
        assert result[0] == "legacy_user@example.com"
        assert result[1] == "Legacy User"
        assert result[2] is None  # avatar_url được gán NULL mặc định cho tài khoản cũ


# ── Service & Endpoints Logic Tests ──────────────────────────────────────────

def test_register_creates_user_with_avatar_null(db_session: Session):
    """Kiểm tra API đăng ký tài khoản mới trả về avatar_url là None."""
    payload = UserCreate(
        email="fresh_register@example.com",
        password="SecurePassword123",
        full_name="Fresh Register",
    )
    api_response = register(user_in=payload, db=db_session)
    assert api_response.success is True
    assert api_response.data.avatar_url is None

    # Xác thực trong cơ sở dữ liệu
    saved_user = db_session.query(User).filter(User.email == "fresh_register@example.com").first()
    assert saved_user is not None
    assert saved_user.avatar_url is None


def test_get_me_returns_avatar_url_null_by_default(db_session: Session):
    """Kiểm tra API get_me trả về avatar_url là None cho người dùng mặc định."""
    user = User(
        email="me_default@example.com",
        hashed_password=hash_password("Password123"),
        full_name="Me Default",
        role=UserRole.FREE,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    api_response = get_me(current_user=user)
    assert api_response.success is True
    assert api_response.data.avatar_url is None


def test_get_me_returns_custom_avatar_url(db_session: Session):
    """Kiểm tra API get_me trả về đúng avatar_url khi tài khoản đã cập nhật ảnh."""
    user = User(
        email="me_custom@example.com",
        hashed_password=hash_password("Password123"),
        full_name="Me Custom",
        role=UserRole.PRO,
        is_active=True,
        avatar_url="/static/avatars/user_custom_abc.webp",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    api_response = get_me(current_user=user)
    assert api_response.success is True
    assert api_response.data.avatar_url == "/static/avatars/user_custom_abc.webp"


def test_update_me_updates_avatar_url(db_session: Session):
    """Kiểm tra API update_me cho phép cập nhật avatar_url cùng với full_name."""
    user = User(
        email="update_me@example.com",
        hashed_password=hash_password("Password123"),
        full_name="Old Name",
        role=UserRole.FREE,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    update_payload = UserUpdate(
        full_name="New Name",
        avatar_url="/static/avatars/new_profile.webp",
    )
    api_response = update_me(user_update=update_payload, current_user=user, db=db_session)
    assert api_response.success is True
    assert api_response.data.full_name == "New Name"
    assert api_response.data.avatar_url == "/static/avatars/new_profile.webp"

    # Kiểm tra cơ sở dữ liệu
    db_session.refresh(user)
    assert user.full_name == "New Name"
    assert user.avatar_url == "/static/avatars/new_profile.webp"


def test_update_me_clears_avatar_url(db_session: Session):
    """Kiểm tra API update_me cho phép xóa avatar_url về None khi truyền chuỗi rỗng."""
    user = User(
        email="clear_me@example.com",
        hashed_password=hash_password("Password123"),
        full_name="Has Avatar",
        role=UserRole.FREE,
        is_active=True,
        avatar_url="/static/avatars/existing.webp",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    clear_payload = UserUpdate(avatar_url="")
    api_response = update_me(user_update=clear_payload, current_user=user, db=db_session)
    assert api_response.success is True
    assert api_response.data.avatar_url is None

    # Kiểm tra cơ sở dữ liệu
    db_session.refresh(user)
    assert user.avatar_url is None


def test_get_current_user_resolves_avatar_url(db_session: Session):
    """Kiểm tra dependency get_current_user trả về đối tượng User chứa avatar_url chính xác."""
    user = User(
        email="jwt_user@example.com",
        hashed_password=hash_password("Password123"),
        full_name="JWT User",
        role=UserRole.FREE,
        is_active=True,
        avatar_url="/static/avatars/jwt_avatar.webp",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(subject=user.id)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    mock_request = MagicMock()
    mock_request.headers.get.return_value = f"Bearer {token}"

    authenticated_user = get_current_user(request=mock_request, credentials=credentials, db=db_session)
    assert authenticated_user.id == user.id
    assert authenticated_user.avatar_url == "/static/avatars/jwt_avatar.webp"
