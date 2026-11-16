"""
Unit and Integration Tests for User Avatar Storage & Security
-------------------------------------------------------------
Verifies:
- Magic bytes detection and image structural integrity verification (JPEG, PNG, WebP).
- Rejection of oversized files (> 2 MB), empty files (0 bytes), and disallowed formats (GIF, PDF, text).
- Rejection of spoofed files (valid signature header with malicious or corrupted body).
- Normalized filename extension generation via UUIDv4.
- Path traversal defense across directory traversal, URL encoding, absolute paths, and null bytes.
- Strict tenant isolation preventing cross-user avatar access and deletion.
- Atomic file writes and safe old avatar replacement and directory cleanup.
"""

import io
from pathlib import Path
from unittest.mock import patch
import pytest
from PIL import Image

from app.services.storage_service import StorageService


def create_test_image_bytes(fmt: str = "PNG", size: tuple[int, int] = (64, 64), color: str = "red") -> bytes:
    """Helper to generate valid binary image content for tests."""
    buf = io.BytesIO()
    mode = "RGBA" if fmt.upper() == "PNG" else "RGB"
    img = Image.new(mode, size, color=color)
    img.save(buf, format=fmt)
    return buf.getvalue()


# ── Valid Formats & Persistence ───────────────────────────────────────────────

def test_save_and_retrieve_valid_formats(tmp_path: Path):
    """Verifies that valid JPEG, PNG, and WebP files can be saved and retrieved accurately."""
    service = StorageService(avatar_dir=tmp_path / "avatars")
    user_id = 101

    for fmt, expected_ext in [("PNG", ".png"), ("JPEG", ".jpg"), ("WEBP", ".webp")]:
        content = create_test_image_bytes(fmt=fmt, color="blue")
        stored_name, rel_path, abs_path = service.save_avatar_file(user_id=user_id, content=content)

        assert abs_path.exists()
        assert abs_path.read_bytes() == content
        assert stored_name.endswith(expected_ext)
        assert rel_path == f"avatars/{user_id}/{stored_name}"

        # Retrieve using stored filename
        retrieved_by_name = service.get_avatar_path(user_id=user_id, filename_or_path=stored_name)
        assert retrieved_by_name == abs_path

        # Retrieve using relative path
        retrieved_by_rel = service.get_avatar_path(user_id=user_id, filename_or_path=rel_path)
        assert retrieved_by_rel == abs_path


def test_detect_image_format_exact_magic_bytes():
    """Verifies format detection accurately discriminates based on binary signatures."""
    png_bytes = create_test_image_bytes("PNG")
    jpg_bytes = create_test_image_bytes("JPEG")
    webp_bytes = create_test_image_bytes("WEBP")

    assert StorageService.detect_image_format(png_bytes) == "png"
    assert StorageService.detect_image_format(jpg_bytes) == "jpeg"
    assert StorageService.detect_image_format(webp_bytes) == "webp"


# ── File Size & Boundary Validations ──────────────────────────────────────────

def test_reject_empty_file(tmp_path: Path):
    """Verifies that 0-byte files are rejected."""
    service = StorageService(avatar_dir=tmp_path / "avatars")
    with pytest.raises(ValueError, match="cannot be empty"):
        service.save_avatar_file(user_id=1, content=b"")


def test_reject_file_exceeding_max_size(tmp_path: Path):
    """Verifies that files exceeding 2 MB are rejected."""
    service = StorageService(avatar_dir=tmp_path / "avatars")
    oversized_content = b"\x00" * (2 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="exceeds maximum limit"):
        service.save_avatar_file(user_id=1, content=oversized_content)


def test_reject_disallowed_formats(tmp_path: Path):
    """Verifies that non-supported image types like GIF, PDF, or text are rejected."""
    service = StorageService(avatar_dir=tmp_path / "avatars")

    # GIF image
    gif_bytes = create_test_image_bytes("GIF")
    with pytest.raises(ValueError, match="Invalid avatar image format"):
        service.save_avatar_file(user_id=1, content=gif_bytes)

    # PDF header
    pdf_bytes = b"%PDF-1.4 mock pdf content exceeding 12 bytes long"
    with pytest.raises(ValueError, match="Invalid avatar image format"):
        service.save_avatar_file(user_id=1, content=pdf_bytes)

    # Plain text
    text_bytes = b"Hello, this is just plain text content."
    with pytest.raises(ValueError, match="Invalid avatar image format"):
        service.save_avatar_file(user_id=1, content=text_bytes)


def test_reject_spoofed_magic_bytes(tmp_path: Path):
    """Verifies that files with forged magic headers but invalid/malicious payloads fail Pillow verification."""
    service = StorageService(avatar_dir=tmp_path / "avatars")

    # Forged PNG header with malicious script payload
    spoofed_png = b"\x89PNG\r\n\x1a\n<script>alert('xss')</script>"
    with pytest.raises(ValueError, match="Invalid avatar image format"):
        service.save_avatar_file(user_id=1, content=spoofed_png)

    # Forged JPEG header with truncated corrupt bytes
    spoofed_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01corrupted_payload"
    with pytest.raises(ValueError, match="Invalid avatar image format"):
        service.save_avatar_file(user_id=1, content=spoofed_jpeg)

    # Forged WebP header with invalid chunk structure
    spoofed_webp = b"RIFF\x20\x00\x00\x00WEBPbadpayload"
    with pytest.raises(ValueError, match="Invalid avatar image format"):
        service.save_avatar_file(user_id=1, content=spoofed_webp)


# ── Path Traversal & Tenant Isolation ─────────────────────────────────────────

def test_path_traversal_attempts_blocked(tmp_path: Path):
    """Verifies that directory traversal patterns are blocked during retrieval and deletion."""
    service = StorageService(avatar_dir=tmp_path / "avatars")
    user_id = 42

    traversal_payloads = [
        "../other/file.png",
        "../../etc/passwd",
        "..\\..\\windows\\system32\\calc.exe",
        "%2e%2e/%2e%2e/etc/passwd",
        "%252e%252e%252fetc%252fpasswd",
        "/etc/shadow",
        "C:\\Windows\\win.ini",
        "\\\\server\\share\\avatar.png",
        "avatar.png\x00.jpg",
        "sub/folder/nested/avatar.png",
    ]

    for payload in traversal_payloads:
        assert service.get_avatar_path(user_id=user_id, filename_or_path=payload) is None
        assert service.delete_avatar_file(user_id=user_id, filename_or_path=payload) is False


def test_cross_tenant_avatar_access_isolation(tmp_path: Path):
    """Verifies that User A cannot read or delete User B's avatar even if passing correct relative path."""
    service = StorageService(avatar_dir=tmp_path / "avatars")
    user_a = 1
    user_b = 2

    # User B uploads an avatar
    content_b = create_test_image_bytes("PNG", color="green")
    stored_name_b, rel_path_b, abs_path_b = service.save_avatar_file(user_id=user_b, content=content_b)

    # User A tries to access User B's avatar by relative path or directory prefix
    assert service.get_avatar_path(user_id=user_a, filename_or_path=rel_path_b) is None
    assert service.get_avatar_path(user_id=user_a, filename_or_path=f"2/{stored_name_b}") is None

    # User A tries to delete User B's avatar
    assert service.delete_avatar_file(user_id=user_a, filename_or_path=rel_path_b) is False
    assert abs_path_b.exists()

    # User B can access their own avatar
    assert service.get_avatar_path(user_id=user_b, filename_or_path=rel_path_b) == abs_path_b


def test_invalid_user_id_rejected(tmp_path: Path):
    """Verifies that invalid or non-positive user_id values are rejected."""
    service = StorageService(avatar_dir=tmp_path / "avatars")
    valid_content = create_test_image_bytes("PNG")

    for bad_id in [0, -1, -99, "invalid", None, ""]:
        with pytest.raises(ValueError, match="Invalid user_id"):
            service.save_avatar_file(user_id=bad_id, content=valid_content)

        assert service.get_avatar_path(user_id=bad_id, filename_or_path="photo.png") is None
        assert service.delete_avatar_file(user_id=bad_id, filename_or_path="photo.png") is False


# ── Avatar Replacement & Directory Cleanup ────────────────────────────────────

def test_safe_avatar_replacement(tmp_path: Path):
    """Verifies that uploading a new avatar safely removes the previous avatar file."""
    service = StorageService(avatar_dir=tmp_path / "avatars")
    user_id = 7

    # First avatar upload
    content_1 = create_test_image_bytes("PNG", color="red")
    name_1, rel_path_1, path_1 = service.save_avatar_file(user_id=user_id, content=content_1)
    assert path_1.exists()

    # Second avatar upload replacing the first one
    content_2 = create_test_image_bytes("JPEG", color="blue")
    name_2, rel_path_2, path_2 = service.save_avatar_file(
        user_id=user_id,
        content=content_2,
        old_filename_or_path=rel_path_1,
    )

    assert path_2.exists()
    assert not path_1.exists()
    assert path_2.read_bytes() == content_2
    assert name_1 != name_2


def test_cleanup_old_avatars(tmp_path: Path):
    """Verifies that cleanup_old_avatars purges obsolete avatar files while retaining current active avatar."""
    service = StorageService(avatar_dir=tmp_path / "avatars")
    user_id = 9

    # Create 3 avatar files without immediate cleanup
    _, _, path_1 = service.save_avatar_file(user_id=user_id, content=create_test_image_bytes("PNG"))
    _, _, path_2 = service.save_avatar_file(user_id=user_id, content=create_test_image_bytes("JPEG"))
    name_3, _, path_3 = service.save_avatar_file(user_id=user_id, content=create_test_image_bytes("WEBP"))

    assert path_1.exists()
    assert path_2.exists()
    assert path_3.exists()

    # Clean up keeping path_3
    removed_count = service.cleanup_old_avatars(user_id=user_id, keep_filename=name_3)
    assert removed_count == 2
    assert not path_1.exists()
    assert not path_2.exists()
    assert path_3.exists()


# ── Filesystem Error Handling & Atomic Writes ─────────────────────────────────

def test_atomic_write_cleans_up_on_failure(tmp_path: Path):
    """Verifies that if writing or renaming encounters a filesystem error, partial files are removed cleanly."""
    service = StorageService(avatar_dir=tmp_path / "avatars")
    user_id = 15
    content = create_test_image_bytes("PNG")

    user_dir = (tmp_path / "avatars" / str(user_id))
    user_dir.mkdir(parents=True, exist_ok=True)

    with patch("os.replace", side_effect=OSError("Simulated disk replacement failure")):
        with pytest.raises(OSError, match="Simulated disk replacement failure"):
            service.save_avatar_file(user_id=user_id, content=content)

    # Verify no dangling temporary files remained
    remaining_files = list(user_dir.glob("*.tmp"))
    assert len(remaining_files) == 0
