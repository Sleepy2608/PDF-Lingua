"""
Storage API Router
------------------
Endpoints for serving user avatars and public assets with strict containment
and secure cache headers.
"""

import os
import re
from pathlib import Path

from fastapi import APIRouter, status
from fastapi.responses import FileResponse

from app.core.exceptions import NotFoundException
from app.core.logger import logger
from app.services.storage_service import StorageService

router = APIRouter(prefix="/api/storage", tags=["Storage"])
storage_service = StorageService()

# Biểu thức chính quy cho tên tệp ảnh đại diện: chuỗi ký tự an toàn kết hợp đuôi mở rộng cho phép
VALID_AVATAR_FILENAME_PATTERN = re.compile(
    r"^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$",
    re.IGNORECASE,
)


# ── Avatar Static File Serving ────────────────────────────────────────────────

@router.get(
    "/avatars/{user_id}/{filename}",
    status_code=status.HTTP_200_OK,
    summary="Get user profile avatar image",
    description="Serves publicly viewable avatar images with strict path containment, format validation, and cache headers.",
)
def get_user_avatar(user_id: str, filename: str) -> FileResponse:
    """
    Phục vụ tệp hình ảnh đại diện của người dùng qua giao thức HTTP:
    - Kiểm tra tính hợp lệ của định danh user_id (số nguyên dương).
    - Kiểm tra tính hợp lệ của tên tệp (chỉ chấp nhận ký tự an toàn và đuôi mở rộng cho phép).
    - Ngăn chặn truy cập các tệp nhạy cảm (.env, .tmp, tệp ẩn, tệp mã nguồn).
    - Xác thực tính bao đóng bằng StorageService và chặn nguy cơ Path Traversal hoặc symbolic link ra ngoài thư mục.
    - Phân tích Magic Bytes thực tế để gắn Content-Type chính xác.
    - Thiết lập tiêu đề bảo mật X-Content-Type-Options: nosniff và Cache-Control: public, max-age=86400.
    """
    # 1. Kiểm tra user_id hợp lệ
    try:
        safe_user_id = int(user_id)
        if safe_user_id <= 0:
            raise NotFoundException("Tệp ảnh đại diện không tồn tại.")
    except (ValueError, TypeError):
        raise NotFoundException("Tệp ảnh đại diện không tồn tại.")

    # 2. Kiểm tra tên tệp hợp lệ theo biểu thức chính quy
    if not filename or not isinstance(filename, str):
        raise NotFoundException("Tệp ảnh đại diện không tồn tại.")

    # Từ chối tệp ẩn, tệp tạm hoặc tệp cấu hình
    if (
        filename.startswith(".")
        or filename.endswith(".tmp")
        or ".env" in filename
        or ".tmp" in filename
        or "\x00" in filename
    ):
        raise NotFoundException("Tệp ảnh đại diện không tồn tại.")

    if not VALID_AVATAR_FILENAME_PATTERN.match(filename):
        raise NotFoundException("Tệp ảnh đại diện không tồn tại.")

    # 3. Phân giải đường dẫn an toàn qua StorageService
    file_path = storage_service.get_avatar_path(user_id=safe_user_id, filename_or_path=filename)
    if not file_path or not file_path.exists():
        raise NotFoundException("Tệp ảnh đại diện không tồn tại.")

    # 4. Kiểm tra an toàn symbolic link và tính bao đóng tuyệt đối
    user_avatar_dir = (storage_service.avatars_dir / str(safe_user_id)).resolve()
    try:
        real_path = file_path.resolve(strict=True)
        real_path.relative_to(user_avatar_dir)
        real_path.relative_to(storage_service.avatars_dir)
    except (ValueError, FileNotFoundError, RuntimeError):
        logger.warning(
            f"[StorageAPI] Symbolic link or path escape attempt rejected: "
            f"user_id={safe_user_id}, filename={filename}"
        )
        raise NotFoundException("Tệp ảnh đại diện không tồn tại.")

    if not real_path.is_file():
        raise NotFoundException("Tệp ảnh đại diện không tồn tại.")

    # 5. Xác định định dạng tệp thực tế qua Magic Bytes
    try:
        with open(real_path, "rb") as f:
            header_bytes = f.read(16)
    except Exception as read_err:
        logger.error(f"[StorageAPI] Could not read header bytes for {real_path}: {read_err}")
        raise NotFoundException("Tệp ảnh đại diện không tồn tại.")

    if header_bytes[:3] == b"\xff\xd8\xff":
        media_type = "image/jpeg"
    elif header_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        media_type = "image/png"
    elif header_bytes[:4] == b"RIFF" and header_bytes[8:12] == b"WEBP":
        media_type = "image/webp"
    else:
        logger.warning(f"[StorageAPI] Avatar file has invalid magic signature: {real_path}")
        raise NotFoundException("Tệp ảnh đại diện không tồn tại.")

    # 6. Thiết lập tiêu đề bảo mật và bộ nhớ đệm
    headers = {
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=86400",
    }

    return FileResponse(
        path=str(real_path),
        media_type=media_type,
        headers=headers,
    )
