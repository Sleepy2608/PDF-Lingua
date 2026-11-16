"""
Avatar Static File Serving & Security Headers Integration Tests
---------------------------------------------------------------
Verifies:
- Accurate binary avatar serving for JPEG, PNG, and WebP.
- Precision Content-Type assignment matching actual image magic bytes.
- HTTP security and caching headers: X-Content-Type-Options and Cache-Control.
- Cache-busting behavior via unique UUIDv4 filenames upon avatar replacement.
- Rejection and 404 response for missing files, invalid user IDs, and disallowed filenames.
- Path traversal defense across directory navigation sequences, URL encodings, and root paths.
- Defense against symbolic links pointing outside the user's isolated avatar directory.
- Rejection of hidden files, .env files, and temporary (.tmp) files.
- End-to-end lifecycle regression with upload and delete operations.
"""

import io
import os
from pathlib import Path

import pytest
from fastapi import UploadFile
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.auth as auth_module
import app.api.storage as storage_module
from app.api.auth import delete_avatar, upload_avatar
from app.api.storage import get_user_avatar
from app.core.database import Base
from app.core.exceptions import NotFoundException
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
def setup_isolated_storage_and_db(tmp_path: Path):
    """Provides isolated temporary storage directories and clean in-memory database for each test."""
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


def create_image_bytes(fmt: str = "PNG", size: tuple[int, int] = (48, 48), color: str = "blue") -> bytes:
    """Helper to generate binary bytes of valid test images."""
    buf = io.BytesIO()
    mode = "RGBA" if fmt.upper() == "PNG" else "RGB"
    img = Image.new(mode, size, color=color)
    img.save(buf, format=fmt)
    return buf.getvalue()


# ── Static File Serving & Format Headers ──────────────────────────────────────

def test_serve_avatar_valid_formats(setup_isolated_storage_and_db):
    """Verifies that saved JPEG, PNG, and WebP avatars are served with status 200 and correct Content-Type."""
    session, storage, _ = setup_isolated_storage_and_db
    user_id = 42

    for fmt, expected_type in [
        ("PNG", "image/png"),
        ("JPEG", "image/jpeg"),
        ("WEBP", "image/webp"),
    ]:
        content = create_image_bytes(fmt=fmt)
        stored_name, _, abs_path = storage.save_avatar_file(user_id=user_id, content=content)

        response = get_user_avatar(user_id=str(user_id), filename=stored_name)

        assert response.status_code == 200
        assert response.media_type == expected_type
        assert Path(response.path).read_bytes() == content


def test_serve_avatar_security_and_caching_headers(setup_isolated_storage_and_db):
    """Verifies that served avatar responses include X-Content-Type-Options and Cache-Control headers."""
    session, storage, _ = setup_isolated_storage_and_db
    user_id = 10

    content = create_image_bytes("PNG")
    stored_name, _, _ = storage.save_avatar_file(user_id=user_id, content=content)

    response = get_user_avatar(user_id=str(user_id), filename=stored_name)
    headers_dict = dict(response.headers)

    # Security header to prevent MIME sniffing
    assert headers_dict.get("x-content-type-options") == "nosniff"

    # Cache control: cached for 24 hours (86400 seconds)
    assert headers_dict.get("cache-control") == "public, max-age=86400"


# ── Non-Existent & Invalid Target Handling ────────────────────────────────────

def test_serve_avatar_non_existent_file_raises_404(setup_isolated_storage_and_db):
    """Verifies that requesting a file that does not exist returns HTTP 404."""
    with pytest.raises(NotFoundException, match="không tồn tại"):
        get_user_avatar(user_id="1", filename="non_existent_avatar.png")


def test_serve_avatar_invalid_user_id_raises_404(setup_isolated_storage_and_db):
    """Verifies that invalid, negative, or non-integer user_id values raise HTTP 404."""
    for bad_id in ["0", "-1", "-99", "admin", "null", "undefined"]:
        with pytest.raises(NotFoundException, match="không tồn tại"):
            get_user_avatar(user_id=bad_id, filename="photo.png")


# ── Path Traversal & Out-of-Bounds Defense ─────────────────────────────────────

def test_serve_avatar_path_traversal_attempts_blocked(setup_isolated_storage_and_db):
    """Verifies that directory traversal patterns are blocked and return 404."""
    user_id = "1"
    traversal_attacks = [
        "../photo.png",
        "../../etc/passwd.png",
        "..\\..\\windows\\system32.png",
        "%2e%2e/photo.png",
        "/etc/passwd.png",
        "C:\\Windows\\system32\\calc.png",
        "nested/subfolder/photo.png",
        "valid.png\x00.jpg",
    ]

    for attack in traversal_attacks:
        with pytest.raises(NotFoundException, match="không tồn tại"):
            get_user_avatar(user_id=user_id, filename=attack)


def test_serve_avatar_cannot_access_files_outside_user_directory(setup_isolated_storage_and_db):
    """Verifies that a user cannot access another user's avatar file."""
    session, storage, _ = setup_isolated_storage_and_db

    # User 2 uploads an avatar
    content = create_image_bytes("PNG")
    stored_name_2, _, _ = storage.save_avatar_file(user_id=2, content=content)

    # Requesting User 2's file under User 1's route must fail
    with pytest.raises(NotFoundException, match="không tồn tại"):
        get_user_avatar(user_id="1", filename=stored_name_2)


# ── Restricted Files (.env, .tmp, hidden files) ───────────────────────────────

def test_serve_avatar_blocks_hidden_and_tmp_and_env_files(setup_isolated_storage_and_db):
    """Verifies that .env, temporary (.tmp), and dot-prefixed hidden files are strictly rejected."""
    session, storage, tmp_path = setup_isolated_storage_and_db
    user_id = 5

    user_dir = storage.avatars_dir / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)

    # Place forbidden files in the user's directory
    (user_dir / ".env").write_text("DATABASE_URL=sqlite:///secret.db", encoding="utf-8")
    (user_dir / ".hidden_file.png").write_bytes(create_image_bytes("PNG"))
    (user_dir / "temp_avatar.tmp").write_bytes(create_image_bytes("PNG"))

    blocked_names = [".env", ".hidden_file.png", "temp_avatar.tmp", "test.env.png"]
    for blocked_name in blocked_names:
        with pytest.raises(NotFoundException, match="không tồn tại"):
            get_user_avatar(user_id=str(user_id), filename=blocked_name)


# ── Symbolic Link Security ────────────────────────────────────────────────────

def test_serve_avatar_symlink_pointing_outside_directory_rejected(setup_isolated_storage_and_db):
    """Verifies that a symbolic link pointing to an external file outside the avatar directory is rejected."""
    session, storage, tmp_path = setup_isolated_storage_and_db
    user_id = 7

    content = create_image_bytes("PNG")
    stored_name, _, abs_path = storage.save_avatar_file(user_id=user_id, content=content)

    user_dir = storage.avatars_dir / str(user_id)
    outside_file = tmp_path / "outside_secret.png"
    outside_file.write_bytes(content)

    # Attempt actual symlink creation if OS privileges permit
    try:
        symlink_path = user_dir / "symlink_avatar.png"
        symlink_path.symlink_to(outside_file)
        with pytest.raises(NotFoundException, match="không tồn tại"):
            get_user_avatar(user_id=str(user_id), filename="symlink_avatar.png")
    except (OSError, NotImplementedError):
        pass

    # Deterministic simulation of a symlink resolving outside the user avatar directory
    from unittest.mock import patch
    with patch.object(Path, "resolve", return_value=outside_file.resolve()):
        with pytest.raises(NotFoundException, match="không tồn tại"):
            get_user_avatar(user_id=str(user_id), filename=stored_name)


# ── Full End-to-End Regression & Cache-Busting ────────────────────────────────

def test_end_to_end_avatar_lifecycle_and_cache_busting(setup_isolated_storage_and_db):
    """
    Verifies full lifecycle:
    1. Upload initial avatar -> served successfully via generated URL.
    2. Upload replacement avatar -> URL changes (cache-busting), old URL returns 404, new URL returns 200.
    3. Delete avatar -> avatar URL returns 404.
    """
    session, _, _ = setup_isolated_storage_and_db

    user = User(
        email="e2e_user@example.com",
        hashed_password=hash_password("Password123"),
        role=UserRole.FREE,
        is_active=True,
    )
    session.add(user)
    session.commit()

    # 1. Upload initial avatar (PNG)
    upload_1 = UploadFile(
        filename="avatar_first.png",
        file=io.BytesIO(create_image_bytes("PNG", color="red")),
    )
    res_1 = upload_avatar(file=upload_1, current_user=user, db=session)
    url_1 = res_1.data.avatar_url
    filename_1 = url_1.split("/")[-1]

    # Verify serving initial avatar
    served_1 = get_user_avatar(user_id=str(user.id), filename=filename_1)
    assert served_1.status_code == 200
    assert served_1.media_type == "image/png"

    # 2. Upload replacement avatar (JPEG) -> URL changes (automatic cache busting)
    upload_2 = UploadFile(
        filename="avatar_second.jpg",
        file=io.BytesIO(create_image_bytes("JPEG", color="blue")),
    )
    res_2 = upload_avatar(file=upload_2, current_user=user, db=session)
    url_2 = res_2.data.avatar_url
    filename_2 = url_2.split("/")[-1]

    assert url_1 != url_2
    assert filename_1 != filename_2

    # Old avatar URL now returns 404
    with pytest.raises(NotFoundException, match="không tồn tại"):
        get_user_avatar(user_id=str(user.id), filename=filename_1)

    # New avatar URL returns 200 with updated Content-Type
    served_2 = get_user_avatar(user_id=str(user.id), filename=filename_2)
    assert served_2.status_code == 200
    assert served_2.media_type == "image/jpeg"

    # 3. Delete avatar
    delete_avatar(current_user=user, db=session)

    # Both old and new URLs return 404
    with pytest.raises(NotFoundException, match="không tồn tại"):
        get_user_avatar(user_id=str(user.id), filename=filename_2)
