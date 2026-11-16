"""
Avatar Upload & Delete API Integration Tests
--------------------------------------------
Verifies:
- Authenticated avatar upload supporting JPEG, PNG, and WebP.
- Rejection of empty files, oversized files (> 2 MB), and invalid/spoofed formats.
- Unauthorized access rejection when JWT credentials are missing or invalid.
- Safe avatar replacement: old file is deleted and replaced with new file.
- Avatar deletion for users with an avatar and rejection when no avatar is set.
- Database and filesystem consistency: rollback and orphaned file cleanup on DB failure.
- Protection of existing avatar during replacement when database update fails.
- Strict tenant isolation: user can only modify/delete their own avatar.
- Profile endpoint GET /api/auth/me reflection and rejection of manual avatar_url updates.
"""

import io
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import UploadFile
from fastapi.security import HTTPAuthorizationCredentials
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.auth as auth_module
from app.api.auth import delete_avatar, get_me, update_me, upload_avatar
from app.core.database import Base
from app.core.dependencies import get_current_user
from app.core.exceptions import (
    AppException,
    BadRequestException,
    PayloadTooLargeException,
    UnauthorizedException,
    UnsupportedMediaTypeException,
)
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.user import UserUpdate
from app.services.storage_service import StorageService

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path: Path):
    """Set up clean in-memory tables and isolated storage service for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    # Configure isolated storage service for the test run
    test_storage = StorageService(avatar_dir=tmp_path / "avatars")
    original_storage = auth_module.storage_service
    auth_module.storage_service = test_storage

    yield session, test_storage

    session.close()
    Base.metadata.drop_all(bind=engine)
    auth_module.storage_service = original_storage


def create_image_upload(fmt: str = "PNG", size: tuple[int, int] = (64, 64), color: str = "blue") -> UploadFile:
    """Helper to generate a valid in-memory UploadFile instance."""
    buf = io.BytesIO()
    mode = "RGBA" if fmt.upper() == "PNG" else "RGB"
    img = Image.new(mode, size, color=color)
    img.save(buf, format=fmt)
    data = buf.getvalue()

    ext = fmt.lower()
    return UploadFile(
        filename=f"test_avatar.{ext}",
        file=io.BytesIO(data),
        headers={"content-type": f"image/{ext}"},
    )


# ── Upload API Verification ───────────────────────────────────────────────────

def test_upload_avatar_valid_formats(setup_test_db):
    """Verifies that valid JPEG, PNG, and WebP images are uploaded, persisted, and updated in DB."""
    session, storage = setup_test_db

    user = User(
        email="avatar_user@example.com",
        hashed_password=hash_password("Password123"),
        full_name="Avatar User",
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    for fmt, ext in [("PNG", ".png"), ("JPEG", ".jpg"), ("WEBP", ".webp")]:
        upload_file = create_image_upload(fmt=fmt)
        response = upload_avatar(file=upload_file, current_user=user, db=session)

        assert response.success is True
        assert response.data.avatar_url.startswith(f"/api/storage/avatars/{user.id}/")
        assert response.data.avatar_url.endswith(ext)

        # Check DB updated
        session.refresh(user)
        assert user.avatar_url == response.data.avatar_url

        # Check file exists on filesystem
        stored_path = storage.get_avatar_path(user_id=user.id, filename_or_path=response.data.avatar_url)
        assert stored_path is not None
        assert stored_path.is_file()


def test_upload_avatar_empty_file_rejected(setup_test_db):
    """Verifies that 0-byte uploaded files are rejected with HTTP 400 BadRequestException."""
    session, _ = setup_test_db
    user = User(
        email="empty_test@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()

    empty_upload = UploadFile(filename="empty.png", file=io.BytesIO(b""))
    with pytest.raises(BadRequestException, match="không được để rỗng"):
        upload_avatar(file=empty_upload, current_user=user, db=session)


def test_upload_avatar_oversized_file_rejected(setup_test_db):
    """Verifies that files exceeding 2 MB are rejected with HTTP 413 PayloadTooLargeException."""
    session, _ = setup_test_db
    user = User(
        email="oversized_test@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()

    large_bytes = b"\x00" * (2 * 1024 * 1024 + 1)
    large_upload = UploadFile(filename="large.png", file=io.BytesIO(large_bytes))
    with pytest.raises(PayloadTooLargeException, match="vượt quá giới hạn tối đa"):
        upload_avatar(file=large_upload, current_user=user, db=session)


def test_upload_avatar_unsupported_formats_rejected(setup_test_db):
    """Verifies that non-supported formats (GIF, PDF, plain text) trigger HTTP 415."""
    session, _ = setup_test_db
    user = User(
        email="bad_format@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()

    # GIF file
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color="purple").save(buf, format="GIF")
    gif_upload = UploadFile(filename="test.gif", file=io.BytesIO(buf.getvalue()))
    with pytest.raises(UnsupportedMediaTypeException, match="không được hỗ trợ"):
        upload_avatar(file=gif_upload, current_user=user, db=session)

    # PDF file
    pdf_upload = UploadFile(filename="doc.pdf", file=io.BytesIO(b"%PDF-1.4 mock content"))
    with pytest.raises(UnsupportedMediaTypeException, match="không được hỗ trợ"):
        upload_avatar(file=pdf_upload, current_user=user, db=session)

    # Plain text file
    txt_upload = UploadFile(filename="note.txt", file=io.BytesIO(b"Just plain text string."))
    with pytest.raises(UnsupportedMediaTypeException, match="không được hỗ trợ"):
        upload_avatar(file=txt_upload, current_user=user, db=session)


def test_upload_avatar_spoofed_content_rejected(setup_test_db):
    """Verifies that files with forged PNG magic headers but corrupt bodies fail validation."""
    session, _ = setup_test_db
    user = User(
        email="spoofed@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()

    spoofed_bytes = b"\x89PNG\r\n\x1a\n<script>alert('xss')</script>"
    spoofed_upload = UploadFile(filename="fake.png", file=io.BytesIO(spoofed_bytes))
    with pytest.raises(UnsupportedMediaTypeException, match="không được hỗ trợ"):
        upload_avatar(file=spoofed_upload, current_user=user, db=session)


# ── Authentication & Authorization Checks ─────────────────────────────────────

def test_missing_or_invalid_jwt_rejected(setup_test_db):
    """Verifies that requests without credentials or with forged tokens are rejected with 401."""
    session, _ = setup_test_db

    # Missing credentials and missing header
    mock_request_none = MagicMock()
    mock_request_none.headers.get.return_value = None
    with pytest.raises(UnauthorizedException, match="Yêu cầu xác thực"):
        get_current_user(request=mock_request_none, credentials=None, db=session)

    # Invalid token string
    mock_request_bad = MagicMock()
    mock_request_bad.headers.get.return_value = "Bearer invalid.token.here"
    bad_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token.here")
    with pytest.raises(UnauthorizedException):
        get_current_user(request=mock_request_bad, credentials=bad_creds, db=session)


# ── Replacement & Safe Deletion ───────────────────────────────────────────────

def test_replace_existing_avatar_deletes_old_file(setup_test_db):
    """Verifies that uploading a new avatar safely deletes the previous avatar file."""
    session, storage = setup_test_db
    user = User(
        email="replace_user@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()

    # 1. Upload first avatar (PNG)
    res_1 = upload_avatar(file=create_image_upload("PNG", color="red"), current_user=user, db=session)
    path_1 = storage.get_avatar_path(user_id=user.id, filename_or_path=res_1.data.avatar_url)
    assert path_1 is not None and path_1.exists()

    # 2. Upload second avatar (JPEG) replacing first
    res_2 = upload_avatar(file=create_image_upload("JPEG", color="blue"), current_user=user, db=session)
    path_2 = storage.get_avatar_path(user_id=user.id, filename_or_path=res_2.data.avatar_url)

    assert path_2 is not None and path_2.exists()
    assert not path_1.exists()
    assert res_1.data.avatar_url != res_2.data.avatar_url


def test_delete_avatar_success(setup_test_db):
    """Verifies deleting an existing avatar unlinks file and clears avatar_url in DB."""
    session, storage = setup_test_db

    # Seed an avatar file on disk
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color="green").save(buf, format="PNG")
    stored_name, rel_path, abs_path = storage.save_avatar_file(user_id=88, content=buf.getvalue())

    user = User(
        id=88,
        email="delete_user@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
        avatar_url=f"/api/storage/{rel_path}",
    )
    session.add(user)
    session.commit()

    assert abs_path.exists()

    # Call delete avatar
    res = delete_avatar(current_user=user, db=session)
    assert res.success is True

    # Verify file is deleted
    assert not abs_path.exists()

    # Verify database avatar_url is cleared
    session.refresh(user)
    assert user.avatar_url is None


def test_delete_avatar_when_none_exists_raises_400(setup_test_db):
    """Verifies that attempting to delete an avatar when user has none raises 400 BadRequest."""
    session, _ = setup_test_db
    user = User(
        email="no_avatar@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
        avatar_url=None,
    )
    session.add(user)
    session.commit()

    with pytest.raises(BadRequestException, match="chưa thiết lập ảnh đại diện"):
        delete_avatar(current_user=user, db=session)


# ── Consistency & Failure Recovery ────────────────────────────────────────────

def test_upload_avatar_db_error_cleans_up_new_file(setup_test_db):
    """Verifies that if a database commit fails, the newly written file is deleted to avoid orphaned files."""
    session, storage = setup_test_db
    user = User(
        id=201,
        email="db_fail@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()

    upload_file = create_image_upload("PNG")

    user_avatar_dir = storage.avatars_dir / str(user.id)

    with patch.object(session, "commit", side_effect=Exception("Database connection terminated")):
        with pytest.raises(AppException) as exc_info:
            upload_avatar(file=upload_file, current_user=user, db=session)

        assert exc_info.value.status_code == 500

    # Ensure no leftover files were orphaned in the user directory
    if user_avatar_dir.exists():
        files = list(user_avatar_dir.iterdir())
        assert len(files) == 0


def test_replace_avatar_db_error_preserves_old_file(setup_test_db):
    """Verifies that if DB commit fails during replacement, the user's old avatar file is preserved."""
    session, storage = setup_test_db

    # Create initial avatar
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color="red").save(buf, format="PNG")
    stored_name_1, rel_path_1, path_1 = storage.save_avatar_file(user_id=301, content=buf.getvalue())

    user = User(
        id=301,
        email="preserve_old@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
        avatar_url=f"/api/storage/{rel_path_1}",
    )
    session.add(user)
    session.commit()

    assert path_1.exists()

    # Upload new avatar with simulated DB failure
    upload_file = create_image_upload("JPEG", color="yellow")
    with patch.object(session, "commit", side_effect=Exception("Simulated commit crash")):
        with pytest.raises(AppException) as exc_info:
            upload_avatar(file=upload_file, current_user=user, db=session)

        assert exc_info.value.status_code == 500

    # Verify old file is still preserved on disk
    assert path_1.exists()
    # Verify user avatar_url in DB was not overwritten
    session.refresh(user)
    assert user.avatar_url == f"/api/storage/{rel_path_1}"


# ── Tenant Isolation ──────────────────────────────────────────────────────────

def test_tenant_isolation_cross_user_file_unmodifiable(setup_test_db):
    """Verifies that a user cannot access or delete another user's avatar."""
    session, storage = setup_test_db

    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color="blue").save(buf, format="PNG")
    _, rel_path_user2, path_user2 = storage.save_avatar_file(user_id=2, content=buf.getvalue())

    # User 1 cannot access User 2's file
    assert storage.get_avatar_path(user_id=1, filename_or_path=rel_path_user2) is None
    # User 1 cannot delete User 2's file
    assert storage.delete_avatar_file(user_id=1, filename_or_path=rel_path_user2) is False
    assert path_user2.exists()


# ── Profile Integration & Forbidden Manual Update ─────────────────────────────

def test_get_me_accurately_reflects_avatar_lifecycle(setup_test_db):
    """Verifies that GET /api/auth/me returns null, updated URL, and null through the full lifecycle."""
    session, _ = setup_test_db
    user = User(
        email="lifecycle@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()

    # Initial state
    me_res1 = get_me(current_user=user)
    assert me_res1.data.avatar_url is None

    # After upload
    upload_res = upload_avatar(file=create_image_upload("PNG"), current_user=user, db=session)
    session.refresh(user)
    me_res2 = get_me(current_user=user)
    assert me_res2.data.avatar_url == upload_res.data.avatar_url

    # After delete
    delete_avatar(current_user=user, db=session)
    session.refresh(user)
    me_res3 = get_me(current_user=user)
    assert me_res3.data.avatar_url is None


def test_manual_avatar_url_update_via_profile_rejected(setup_test_db):
    """Verifies that PATCH /api/auth/me rejects attempts to modify avatar_url directly."""
    session, _ = setup_test_db
    user = User(
        email="tamper@example.com",
        hashed_password=hash_password("Password123"),
        full_name="Original Name",
        role=UserRole.FREE,
        is_active=True,
        avatar_url="/api/storage/avatars/1/valid.png",
    )
    session.add(user)
    session.commit()

    tamper_payload = UserUpdate(
        avatar_url="http://malicious.example.com/hacked.png",
    )
    with pytest.raises(BadRequestException, match="Không được phép cập nhật avatar_url trực tiếp"):
        update_me(user_update=tamper_payload, current_user=user, db=session)

    session.refresh(user)
    assert user.avatar_url == "/api/storage/avatars/1/valid.png"
