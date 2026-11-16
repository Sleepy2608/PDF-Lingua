"""
Avatar Full Lifecycle & Multi-User Integration Tests
----------------------------------------------------
Verifies the end-to-end user avatar lifecycle across API, database, and filesystem:
1. Initial account state (no avatar configured).
2. First-time image upload (persistence, DB update, filesystem verification, profile sync).
3. Public static image retrieval with secure caching headers.
4. Avatar replacement (atomic write, old file cleanup, cache-busting URL shift).
5. Avatar deletion (DB reset to null, filesystem file removal, repeated delete rejection).
6. Multi-tenant isolation between distinct user accounts.
7. Resilience against filesystem and database faults.
"""

import io
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import UploadFile
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.auth as auth_module
import app.api.storage as storage_module
from app.api.auth import delete_avatar, get_me, upload_avatar
from app.api.storage import get_user_avatar
from app.core.database import Base
from app.core.exceptions import AppException, BadRequestException, NotFoundException
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.services.storage_service import StorageService

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_lifecycle_environment(tmp_path: Path):
    """Sets up an isolated database session and storage directory for each test run."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    test_storage = StorageService(avatar_dir=tmp_path / "avatars")
    orig_auth_storage = auth_module.storage_service
    orig_storage_storage = storage_module.storage_service

    auth_module.storage_service = test_storage
    storage_module.storage_service = test_storage

    yield session, test_storage, tmp_path

    session.close()
    Base.metadata.drop_all(bind=engine)
    auth_module.storage_service = orig_auth_storage
    storage_module.storage_service = orig_storage_storage


def generate_image_upload(fmt: str = "PNG", color: str = "red", size: tuple[int, int] = (64, 64)) -> tuple[UploadFile, bytes]:
    """Helper creating a test image UploadFile alongside raw binary content."""
    buf = io.BytesIO()
    mode = "RGBA" if fmt.upper() == "PNG" else "RGB"
    img = Image.new(mode, size, color=color)
    img.save(buf, format=fmt)
    raw_bytes = buf.getvalue()

    ext = fmt.lower()
    upload = UploadFile(
        filename=f"test_avatar.{ext}",
        file=io.BytesIO(raw_bytes),
        headers={"content-type": f"image/{ext}"},
    )
    return upload, raw_bytes


# ── Full Avatar Lifecycle Integration ─────────────────────────────────────────

def test_complete_avatar_lifecycle_with_db_and_disk_verification(setup_lifecycle_environment):
    """
    Executes and verifies the full lifecycle:
    - Step 1: Default state verification.
    - Step 2: First-time PNG upload & static serving.
    - Step 3: WebP avatar replacement & cache busting.
    - Step 4: Deletion & resource cleanup.
    """
    session, storage, _ = setup_lifecycle_environment

    # Create test user
    user = User(
        id=77,
        email="lifecycle_tester@example.com",
        hashed_password=hash_password("Password123"),
        full_name="Lifecycle Tester",
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    user_storage_dir = storage.avatars_dir / str(user.id)

    # ── Step 1: Initial State ─────────────────────────────────────────────────
    assert user.avatar_url is None
    profile_initial = get_me(current_user=user)
    assert profile_initial.data.avatar_url is None

    # ── Step 2: First-time Avatar Upload (PNG) ────────────────────────────────
    upload_1, bytes_1 = generate_image_upload(fmt="PNG", color="green")
    res_upload_1 = upload_avatar(file=upload_1, current_user=user, db=session)

    assert res_upload_1.success is True
    avatar_url_1 = res_upload_1.data.avatar_url
    assert avatar_url_1.startswith(f"/api/storage/avatars/{user.id}/")
    assert avatar_url_1.endswith(".png")

    # Verify Database state
    session.refresh(user)
    assert user.avatar_url == avatar_url_1

    # Verify Profile Endpoint state
    profile_1 = get_me(current_user=user)
    assert profile_1.data.avatar_url == avatar_url_1

    # Verify Physical Filesystem state
    filename_1 = avatar_url_1.split("/")[-1]
    disk_path_1 = user_storage_dir / filename_1
    assert disk_path_1.exists()
    assert disk_path_1.is_file()
    assert disk_path_1.read_bytes() == bytes_1

    # Verify Static File Serving endpoint
    served_1 = get_user_avatar(user_id=str(user.id), filename=filename_1)
    assert served_1.status_code == 200
    assert served_1.media_type == "image/png"
    assert dict(served_1.headers).get("x-content-type-options") == "nosniff"
    assert dict(served_1.headers).get("cache-control") == "public, max-age=86400"

    # ── Step 3: Avatar Replacement (WebP) ─────────────────────────────────────
    upload_2, bytes_2 = generate_image_upload(fmt="WEBP", color="yellow")
    res_upload_2 = upload_avatar(file=upload_2, current_user=user, db=session)

    assert res_upload_2.success is True
    avatar_url_2 = res_upload_2.data.avatar_url
    assert avatar_url_2.startswith(f"/api/storage/avatars/{user.id}/")
    assert avatar_url_2.endswith(".webp")
    assert avatar_url_1 != avatar_url_2

    # Verify Database state updated
    session.refresh(user)
    assert user.avatar_url == avatar_url_2

    # Verify Profile Endpoint state updated
    profile_2 = get_me(current_user=user)
    assert profile_2.data.avatar_url == avatar_url_2

    # Verify Physical Filesystem state: new file created, old file unlinked
    filename_2 = avatar_url_2.split("/")[-1]
    disk_path_2 = user_storage_dir / filename_2
    assert disk_path_2.exists()
    assert disk_path_2.read_bytes() == bytes_2
    assert not disk_path_1.exists()

    # Verify Cache Busting: old URL returns 404, new URL returns 200
    with pytest.raises(NotFoundException):
        get_user_avatar(user_id=str(user.id), filename=filename_1)

    served_2 = get_user_avatar(user_id=str(user.id), filename=filename_2)
    assert served_2.status_code == 200
    assert served_2.media_type == "image/webp"

    # ── Step 4: Avatar Deletion ───────────────────────────────────────────────
    res_delete = delete_avatar(current_user=user, db=session)
    assert res_delete.success is True

    # Verify Database state cleared
    session.refresh(user)
    assert user.avatar_url is None

    # Verify Profile Endpoint state cleared
    profile_deleted = get_me(current_user=user)
    assert profile_deleted.data.avatar_url is None

    # Verify Physical Filesystem state: file deleted
    assert not disk_path_2.exists()

    # Verify Static File Serving returns 404 for deleted avatar
    with pytest.raises(NotFoundException):
        get_user_avatar(user_id=str(user.id), filename=filename_2)

    # Verify repeated deletion returns HTTP 400
    with pytest.raises(BadRequestException, match="chưa thiết lập ảnh đại diện"):
        delete_avatar(current_user=user, db=session)


# ── Multi-Tenant Isolation & Cross-Account Boundaries ─────────────────────────

def test_multi_user_tenant_isolation(setup_lifecycle_environment):
    """
    Verifies that operations performed by User A cannot view, mutate,
    or delete User B's avatar files or database properties.
    """
    session, storage, _ = setup_lifecycle_environment

    user_a = User(
        id=1,
        email="user_a@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    user_b = User(
        id=2,
        email="user_b@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    session.add_all([user_a, user_b])
    session.commit()

    # User B uploads an avatar
    upload_b, bytes_b = generate_image_upload("PNG", color="cyan")
    res_b = upload_avatar(file=upload_b, current_user=user_b, db=session)
    session.refresh(user_b)
    filename_b = res_b.data.avatar_url.split("/")[-1]

    # User A tries to delete avatar while User A has none
    with pytest.raises(BadRequestException):
        delete_avatar(current_user=user_a, db=session)

    # User B's file on disk and DB record must remain untouched
    session.refresh(user_b)
    assert user_b.avatar_url == res_b.data.avatar_url

    path_b = storage.get_avatar_path(user_id=user_b.id, filename_or_path=filename_b)
    assert path_b is not None and path_b.exists()

    # User A cannot retrieve User B's avatar via User A's user_id route
    with pytest.raises(NotFoundException):
        get_user_avatar(user_id=str(user_a.id), filename=filename_b)


# ── Fault Tolerance & Transactional Consistency ───────────────────────────────

def test_fault_tolerance_during_avatar_replacement(setup_lifecycle_environment):
    """
    Verifies that when a database error interrupts an avatar replacement,
    the newly generated file is discarded and the old avatar file remains protected.
    """
    session, storage, _ = setup_lifecycle_environment

    user = User(
        id=55,
        email="fault_test@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()

    # 1. Successful first upload
    upload_1, _ = generate_image_upload("PNG", color="red")
    res_1 = upload_avatar(file=upload_1, current_user=user, db=session)
    filename_1 = res_1.data.avatar_url.split("/")[-1]
    disk_path_1 = storage.get_avatar_path(user_id=user.id, filename_or_path=filename_1)
    assert disk_path_1 is not None and disk_path_1.exists()

    # 2. Replacement upload with simulated database failure
    upload_2, _ = generate_image_upload("JPEG", color="blue")

    with patch.object(session, "commit", side_effect=Exception("Simulated DB Disk Crash")):
        with pytest.raises(AppException) as exc_err:
            upload_avatar(file=upload_2, current_user=user, db=session)
        assert exc_err.value.status_code == 500

    # Ensure previous file is STILL present on disk
    assert disk_path_1.exists()

    # Ensure user database record still points to the old avatar
    session.refresh(user)
    assert user.avatar_url == res_1.data.avatar_url
