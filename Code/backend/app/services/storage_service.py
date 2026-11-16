"""
Storage Service
---------------
Handles physical file persistence, folder structure isolation by user,
safe filename sanitization, and path-traversal prevention.
"""

import io
import json
import os
import re
import unicodedata
import urllib.parse
import uuid
from pathlib import Path
from typing import Optional

from PIL import Image

from app.core.config import settings
from app.core.logger import logger

WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
}


class StorageService:
    """Manages secure file storage for uploaded documents."""

    def __init__(
        self,
        base_dir: Optional[str | Path] = None,
        avatar_dir: Optional[str | Path] = None,
    ):
        self.base_dir = Path(base_dir or settings.STORAGE_DIR).resolve()
        try:
            self.base_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"[StorageService] Could not create storage root: {e}")

        if avatar_dir is not None:
            self.avatars_dir = Path(avatar_dir).resolve()
        elif base_dir is not None:
            if self.base_dir.name == "documents":
                self.avatars_dir = (self.base_dir.parent / "avatars").resolve()
            else:
                self.avatars_dir = (self.base_dir / "avatars").resolve()
        else:
            self.avatars_dir = Path(
                getattr(settings, "AVATAR_STORAGE_DIR", "storage/avatars")
            ).resolve()

        try:
            self.avatars_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"[StorageService] Could not create avatar storage root: {e}")

    def is_safe_path(self, path: Path | str, base: Optional[Path] = None) -> bool:
        """
        Kiểm tra đường dẫn có an toàn và nằm trọn trong thư mục gốc cho phép hay không.
        Ngăn chặn toàn bộ nguy cơ Path Traversal hoặc thoát ra khỏi base directory.
        """
        try:
            base_dir = (base or self.base_dir).resolve()
            target = Path(path).resolve()
            target.relative_to(base_dir)
            return True
        except (ValueError, TypeError, RuntimeError):
            return False

    def sanitize_filename(self, filename: str) -> str:
        """
        Sanitize uploaded filename to eliminate directory traversal sequences,
        absolute path indicators, control characters, and special characters,
        while preserving valid alphanumeric and Unicode (e.g. Vietnamese) characters.
        """
        if not filename or not isinstance(filename, str):
            return "document.pdf"

        # 1. Iteratively unquote to handle single and multiple URL-encoding (e.g. %2e%2e%2f, %252e)
        decoded = str(filename)
        for _ in range(3):
            new_decoded = urllib.parse.unquote(decoded)
            if new_decoded == decoded:
                break
            decoded = new_decoded

        # 2. Unicode normalization (NFKC) & remove invisible / zero-width / directional override chars
        clean = unicodedata.normalize("NFKC", decoded)
        clean = re.sub(r"[\u200b-\u200f\u2028-\u202f\ufeff]", "", clean)

        # 3. Strip null bytes and control characters
        clean = clean.replace("\x00", "").replace("\0", "")
        clean = re.sub(r"[\x00-\x1f\x7f]", "", clean)

        # 4. Remove Windows drive letters (e.g. C:, D:) and UNC prefixes
        clean = re.sub(r"^[a-zA-Z]:", "", clean)
        clean = re.sub(r"^\\\\+", "", clean)

        # 5. Normalize path separators to forward slash, then extract basename
        clean = clean.replace("\\", "/")
        clean = os.path.basename(clean.strip())

        # 6. Eliminate path traversal sequences and multiple consecutive dots
        clean = re.sub(r"\.\.+", ".", clean)

        # 7. Remove non-standard filesystem dangerous characters (< > : " / \ | ? *)
        clean = re.sub(r'[\x00-\x1f\x7f<>:"/\\|?*]', "_", clean).strip(" ._")

        if not clean:
            return "document.pdf"

        # 8. Check Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
        stem = clean[:-4] if clean.lower().endswith(".pdf") else clean
        if stem.upper() in WINDOWS_RESERVED_NAMES:
            clean = f"safe_{clean}"

        # 9. Ensure .pdf extension
        if not clean.lower().endswith(".pdf"):
            clean = f"{clean}.pdf"

        # 10. Limit max length to 200 characters while preserving .pdf
        if len(clean) > 200:
            clean = clean[-200:]
            if not clean.lower().endswith(".pdf"):
                clean = f"{clean[:196]}.pdf"

        return clean

    def save_document_file(
        self,
        user_id: int | str,
        original_filename: str,
        content: bytes,
    ) -> tuple[str, str, Path]:
        """
        Saves a document file into the user's isolated storage directory with strict containment validation.

        Returns:
            tuple of (stored_filename, relative_path, absolute_path)
        """
        try:
            safe_user_id = int(user_id)
            if safe_user_id <= 0:
                raise ValueError(f"Invalid user_id: {user_id}")
        except (TypeError, ValueError) as err:
            raise ValueError(f"Invalid user_id for storage persistence: {user_id}") from err

        user_dir = (self.base_dir / str(safe_user_id)).resolve()
        if not self.is_safe_path(user_dir):
            raise ValueError("User directory escapes storage root.")
        user_dir.mkdir(parents=True, exist_ok=True)

        safe_name = self.sanitize_filename(original_filename)
        unique_token = uuid.uuid4().hex[:12]
        stored_filename = f"{unique_token}_{safe_name}"

        target_path = (user_dir / stored_filename).resolve()
        if not self.is_safe_path(target_path, base=user_dir):
            raise ValueError(f"Target file path escapes user storage directory: {target_path}")

        target_path.write_bytes(content)

        relative_path = f"{safe_user_id}/{stored_filename}"

        logger.info(
            f"[StorageService] Saved document for user_id={safe_user_id}: "
            f"file={stored_filename}, size={len(content)} bytes"
        )
        return stored_filename, relative_path, target_path

    def get_document_path(self, user_id: int | str, stored_filename: str) -> Optional[Path]:
        """
        Resolves physical file path with strict path-traversal validation.
        - Prevents directory traversal sequences (../, ..\\, encoded variants).
        - Blocks absolute paths (POSIX and Windows).
        - Enforces that the resolved path is strictly contained within the user's storage directory.
        - Returns None if the file is missing or attempts to escape user folder.
        """
        if not stored_filename or not isinstance(stored_filename, str):
            return None

        # Validate user_id: must be convertible to a positive integer
        try:
            safe_user_id = int(user_id)
            if safe_user_id <= 0:
                return None
        except (ValueError, TypeError):
            logger.warning(f"[StorageService] Invalid user_id for document path: {user_id}")
            return None

        # Check for null bytes or control characters in stored_filename
        if "\x00" in stored_filename or "\0" in stored_filename:
            logger.warning(f"[StorageService] Null byte in stored_filename: {stored_filename!r}")
            return None

        # Unquote stored_filename to detect encoded traversal
        unquoted = stored_filename
        for _ in range(3):
            new_unquoted = urllib.parse.unquote(unquoted)
            if new_unquoted == unquoted:
                break
            unquoted = new_unquoted

        if "\x00" in unquoted:
            return None

        # Block absolute paths (e.g. /etc/passwd, C:\\Windows, \\\\server\\share)
        if Path(stored_filename).is_absolute() or Path(unquoted).is_absolute():
            logger.warning(
                f"[StorageService] Absolute path traversal attempt: "
                f"user_id={safe_user_id}, path={stored_filename}"
            )
            return None

        if re.match(r"^[a-zA-Z]:", stored_filename) or re.match(r"^[a-zA-Z]:", unquoted):
            logger.warning(
                f"[StorageService] Windows drive letter traversal attempt: "
                f"user_id={safe_user_id}, path={stored_filename}"
            )
            return None

        # Block directory traversal sequences
        norm_unquoted = unquoted.replace("\\", "/")
        if (
            "../" in norm_unquoted
            or norm_unquoted.startswith("../")
            or norm_unquoted.endswith("/..")
            or norm_unquoted == ".."
            or "/../" in norm_unquoted
        ):
            logger.warning(
                f"[StorageService] Directory traversal attempt detected: "
                f"user_id={safe_user_id}, path={stored_filename}"
            )
            return None

        user_dir = (self.base_dir / str(safe_user_id)).resolve()

        # Resolve candidate path
        try:
            candidate = (user_dir / stored_filename).resolve()
        except Exception as resolve_err:
            logger.warning(f"[StorageService] Path resolution error: {resolve_err}")
            return None

        # Strict containment verification: candidate must be inside user_dir AND inside base_dir
        try:
            candidate.relative_to(user_dir)
            candidate.relative_to(self.base_dir)
        except ValueError:
            logger.warning(
                f"[StorageService] Path traversal escape attempt detected: "
                f"user_id={safe_user_id}, path={stored_filename}"
            )
            return None

        if candidate == user_dir or candidate == self.base_dir:
            return None

        if not candidate.is_file():
            return None

        return candidate

    def delete_document_file(self, user_id: int | str, stored_filename: str) -> bool:
        """
        Deletes a stored document file from disk with strict containment validation.
        """
        target_path = self.get_document_path(user_id, stored_filename)
        if not target_path or not target_path.exists():
            return False

        try:
            safe_user_id = int(user_id)
            user_dir = (self.base_dir / str(safe_user_id)).resolve()
            target_path.relative_to(user_dir)
            target_path.relative_to(self.base_dir)
            target_path.unlink()
            logger.info(f"[StorageService] Deleted file: {target_path}")
            return True
        except Exception as e:
            logger.error(f"[StorageService] Failed to delete file {target_path}: {e}")
            return False

    def save_result_file(
        self,
        user_id: int | str,
        history_id: int | str,
        result_data: dict,
    ) -> tuple[str, Path]:
        """
        Saves a processing history result dictionary as a JSON file in user's isolated results folder.

        Returns:
            tuple of (relative_path, absolute_path)
        """
        try:
            safe_user_id = int(user_id)
            safe_history_id = int(history_id)
            if safe_user_id <= 0 or safe_history_id <= 0:
                raise ValueError(f"Invalid user_id ({user_id}) or history_id ({history_id})")
        except (TypeError, ValueError) as err:
            raise ValueError(f"Invalid identifiers for result storage: {err}") from err

        user_dir = (self.base_dir / str(safe_user_id)).resolve()
        results_dir = (user_dir / "results").resolve()
        if not self.is_safe_path(results_dir):
            raise ValueError("Results directory escapes storage root.")
        results_dir.mkdir(parents=True, exist_ok=True)

        result_filename = f"{safe_history_id}_result.json"
        target_path = (results_dir / result_filename).resolve()
        if not self.is_safe_path(target_path, base=results_dir):
            raise ValueError(f"Target result path escapes storage directory: {target_path}")

        content = json.dumps(result_data, ensure_ascii=False, indent=2).encode("utf-8")
        target_path.write_bytes(content)

        relative_path = f"{safe_user_id}/results/{result_filename}"

        logger.info(
            f"[StorageService] Saved result for user_id={safe_user_id}, history_id={safe_history_id}: "
            f"path={relative_path}, size={len(content)} bytes"
        )
        return relative_path, target_path

    def get_result_path(self, user_id: int | str, result_path_or_filename: str) -> Optional[Path]:
        """
        Resolves physical path of a result JSON file with strict containment check against user_dir.
        Accepts either full relative path ('1/results/123_result.json') or filename ('123_result.json').
        Returns None if missing or if traversal attempt detected.
        """
        if not result_path_or_filename or not isinstance(result_path_or_filename, str):
            return None

        try:
            safe_user_id = int(user_id)
            if safe_user_id <= 0:
                return None
        except (ValueError, TypeError):
            return None

        # Check null byte
        if "\x00" in result_path_or_filename:
            return None

        # Unquote
        unquoted = result_path_or_filename
        for _ in range(3):
            new_unquoted = urllib.parse.unquote(unquoted)
            if new_unquoted == unquoted:
                break
            unquoted = new_unquoted

        if "\x00" in unquoted:
            return None

        # Absolute path check
        if Path(result_path_or_filename).is_absolute() or Path(unquoted).is_absolute():
            return None
        if re.match(r"^[a-zA-Z]:", result_path_or_filename) or re.match(r"^[a-zA-Z]:", unquoted):
            return None

        # Traversal check
        norm_unquoted = unquoted.replace("\\", "/")
        if (
            "../" in norm_unquoted
            or norm_unquoted.startswith("../")
            or norm_unquoted.endswith("/..")
            or norm_unquoted == ".."
            or "/../" in norm_unquoted
        ):
            return None

        user_dir = (self.base_dir / str(safe_user_id)).resolve()
        results_dir = (user_dir / "results").resolve()

        clean_path = norm_unquoted.strip()

        if "/" in clean_path:
            candidate = (self.base_dir / clean_path).resolve()
        else:
            candidate = (results_dir / clean_path).resolve()

        try:
            candidate.relative_to(user_dir)
            candidate.relative_to(self.base_dir)
        except ValueError:
            logger.warning(
                f"[StorageService] Path traversal attempt on result file: "
                f"user_id={safe_user_id}, path={result_path_or_filename}"
            )
            return None

        if candidate == user_dir or candidate == self.base_dir or candidate == results_dir:
            return None

        if not candidate.is_file():
            return None

        return candidate

    def read_result_file(self, user_id: int | str, result_path_or_filename: str) -> Optional[dict]:
        """
        Reads and parses stored result JSON file with strict containment validation.
        """
        target_path = self.get_result_path(user_id, result_path_or_filename)
        if not target_path:
            return None

        try:
            raw_text = target_path.read_text(encoding="utf-8")
            return json.loads(raw_text)
        except Exception as e:
            logger.error(
                f"[StorageService] Failed to read result file {target_path} for user_id={user_id}: {e}"
            )
            return None

    def delete_result_file(self, user_id: int | str, result_path_or_filename: str) -> bool:
        """
        Deletes a stored result JSON file from disk with strict containment validation.
        """
        target_path = self.get_result_path(user_id, result_path_or_filename)
        if target_path and target_path.exists():
            try:
                safe_user_id = int(user_id)
                user_dir = (self.base_dir / str(safe_user_id)).resolve()
                target_path.relative_to(user_dir)
                target_path.relative_to(self.base_dir)
                target_path.unlink()
                logger.info(f"[StorageService] Deleted result file: {target_path}")
                return True
            except Exception as e:
                logger.error(f"[StorageService] Failed to delete result file {target_path}: {e}")
                return False
        return False

    # ── User Profile Avatar Storage & Security ────────────────────────────────

    @staticmethod
    def detect_image_format(content: bytes) -> Optional[str]:
        """
        Xác định định dạng hình ảnh thực tế dựa trên Magic Bytes phần đầu và kiểm tra cấu trúc nhị phân.
        Chỉ chấp nhận các định dạng an toàn cho web: JPEG, PNG, WebP.
        Tuyệt đối không tin cậy đuôi mở rộng (extension) hoặc Content-Type từ phía client gửi lên.
        """
        if not content or len(content) < 12:
            return None

        # Kiểm tra chữ ký Magic Bytes phần đầu (Header Signatures)
        is_jpeg = content[:3] == b"\xff\xd8\xff"
        is_png = content[:8] == b"\x89PNG\r\n\x1a\n"
        is_webp = content[:4] == b"RIFF" and content[8:12] == b"WEBP"

        if not (is_jpeg or is_png or is_webp):
            return None

        # Xác thực cấu trúc hình ảnh toàn vẹn bằng Pillow để loại bỏ các tệp polyglot hoặc dữ liệu giả mạo
        try:
            with Image.open(io.BytesIO(content)) as img:
                img.verify()
                detected_fmt = (img.format or "").upper()
                if detected_fmt in ("JPEG", "JPG") and is_jpeg:
                    return "jpeg"
                elif detected_fmt == "PNG" and is_png:
                    return "png"
                elif detected_fmt == "WEBP" and is_webp:
                    return "webp"
        except Exception:
            return None

        return None

    def save_avatar_file(
        self,
        user_id: int | str,
        content: bytes,
        old_filename_or_path: Optional[str] = None,
    ) -> tuple[str, str, Path]:
        """
        Lưu tệp ảnh đại diện của người dùng vào thư mục lưu trữ cô lập theo user_id.
        - Kiểm tra định dạng nhị phân hợp lệ (JPEG, PNG, WebP).
        - Giới hạn dung lượng tối đa 2 MB và từ chối tệp rỗng.
        - Tạo tên tệp ngẫu nhiên bằng UUIDv4 với đuôi tệp chuẩn hóa (.jpg, .png, .webp).
        - Ghi tệp nguyên tử (atomic write qua tệp tạm .tmp và rename) để tránh lỗi hỏng tệp khi mất kết nối.
        - Tự động dọn dẹp ảnh đại diện cũ an toàn sau khi ghi tệp mới thành công.

        Returns:
            tuple of (stored_filename, relative_path, absolute_path)
        """
        try:
            safe_user_id = int(user_id)
            if safe_user_id <= 0:
                raise ValueError(f"Invalid user_id: {user_id}")
        except (TypeError, ValueError) as err:
            raise ValueError(f"Invalid user_id for avatar persistence: {user_id}") from err

        if not content or len(content) == 0:
            raise ValueError("Avatar file content cannot be empty.")

        max_allowed_bytes = getattr(settings, "MAX_AVATAR_SIZE_BYTES", 2 * 1024 * 1024)
        if len(content) > max_allowed_bytes:
            raise ValueError(
                f"Avatar file size ({len(content)} bytes) exceeds maximum limit of {max_allowed_bytes} bytes."
            )

        image_format = self.detect_image_format(content)
        if not image_format:
            raise ValueError("Invalid avatar image format. Only JPEG, PNG, and WebP images are allowed.")

        ext_map = {"jpeg": ".jpg", "png": ".png", "webp": ".webp"}
        normalized_ext = ext_map.get(image_format, ".jpg")

        user_avatar_dir = (self.avatars_dir / str(safe_user_id)).resolve()
        if not self.is_safe_path(user_avatar_dir, base=self.avatars_dir):
            raise ValueError("User avatar directory escapes storage root.")
        user_avatar_dir.mkdir(parents=True, exist_ok=True)

        stored_filename = f"{uuid.uuid4().hex}{normalized_ext}"
        target_path = (user_avatar_dir / stored_filename).resolve()
        if not self.is_safe_path(target_path, base=user_avatar_dir):
            raise ValueError("Target avatar path escapes user directory.")

        # Ghi tệp nguyên tử qua tệp tạm thời có tiền tố dấu chấm để tránh lộ tệp chưa hoàn tất
        temp_filename = f".{stored_filename}.{uuid.uuid4().hex[:8]}.tmp"
        temp_path = (user_avatar_dir / temp_filename).resolve()
        if not self.is_safe_path(temp_path, base=user_avatar_dir):
            raise ValueError("Temporary avatar path escapes user directory.")

        try:
            temp_path.write_bytes(content)
            os.replace(temp_path, target_path)
        except Exception as write_err:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass
            logger.error(f"[StorageService] Failed to write avatar file: {write_err}")
            raise write_err

        # Dọn dẹp an toàn tệp ảnh đại diện cũ nếu được chỉ định
        if old_filename_or_path:
            try:
                self.delete_avatar_file(user_id=safe_user_id, filename_or_path=old_filename_or_path)
            except Exception as del_err:
                logger.warning(
                    f"[StorageService] Failed to clean up old avatar for user_id={safe_user_id}: {del_err}"
                )

        relative_path = f"avatars/{safe_user_id}/{stored_filename}"
        logger.info(
            f"[StorageService] Saved avatar for user_id={safe_user_id}: "
            f"file={stored_filename}, size={len(content)} bytes"
        )
        return stored_filename, relative_path, target_path

    def get_avatar_path(self, user_id: int | str, filename_or_path: str) -> Optional[Path]:
        """
        Xác định đường dẫn vật lý tuyệt đối của tệp ảnh đại diện với cơ chế phòng thủ Path Traversal đa tầng:
        - Kiểm tra và từ chối các ký tự null byte hoặc chuỗi điều khiển.
        - Giải mã lặp URL-encoding nhằm phát hiện các biến thể mã hóa (ví dụ: %2e%2e%2f, %252e%252e).
        - Chặn đường dẫn tuyệt đối (POSIX root, Windows Drive Letters, UNC paths).
        - Ngăn chặn truy cập chéo thư mục của người dùng khác (chỉ cho phép user_id tương ứng).
        - Ràng buộc nghiêm ngặt candidate.relative_to(user_avatar_dir) và relative_to(self.avatars_dir).
        - Trả về None nếu không tìm thấy tệp hoặc phát hiện hành vi truy cập bất hợp pháp.
        """
        if not filename_or_path or not isinstance(filename_or_path, str):
            return None

        try:
            safe_user_id = int(user_id)
            if safe_user_id <= 0:
                return None
        except (ValueError, TypeError):
            logger.warning(f"[StorageService] Invalid user_id for avatar path: {user_id}")
            return None

        # Kiểm tra ký tự null byte
        if "\x00" in filename_or_path or "\0" in filename_or_path:
            logger.warning(f"[StorageService] Null byte detected in avatar filename: {filename_or_path!r}")
            return None

        # Giải mã URL lặp để phát hiện chuỗi traversal bị che giấu
        unquoted = filename_or_path
        for _ in range(3):
            new_unquoted = urllib.parse.unquote(unquoted)
            if new_unquoted == unquoted:
                break
            unquoted = new_unquoted

        if "\x00" in unquoted or "\0" in unquoted:
            return None

        # Chặn đường dẫn tuyệt đối và định danh ổ đĩa
        if Path(filename_or_path).is_absolute() or Path(unquoted).is_absolute():
            logger.warning(f"[StorageService] Absolute path traversal rejected in avatar: {filename_or_path}")
            return None

        if re.match(r"^[a-zA-Z]:", filename_or_path) or re.match(r"^[a-zA-Z]:", unquoted):
            logger.warning(f"[StorageService] Windows drive traversal rejected in avatar: {filename_or_path}")
            return None

        if filename_or_path.startswith("\\\\") or unquoted.startswith("\\\\"):
            logger.warning(f"[StorageService] UNC path traversal rejected in avatar: {filename_or_path}")
            return None

        # Chuẩn hóa dấu phân cách và kiểm tra chuỗi traversal
        norm = unquoted.replace("\\", "/").strip().lstrip("/")
        parts = [p for p in norm.split("/") if p]
        if any(p == ".." or p.startswith("..") or ".." in p for p in parts):
            logger.warning(f"[StorageService] Directory traversal sequence rejected in avatar: {filename_or_path}")
            return None

        # Bóc tách tiền tố nếu client truyền đường dẫn đầy đủ dạng avatars/{user_id}/{filename}
        if parts and parts[0] == "avatars":
            parts = parts[1:]

        if len(parts) == 2:
            path_user_id, target_filename = parts
            if path_user_id != str(safe_user_id):
                logger.warning(
                    f"[StorageService] Cross-user avatar access denied: "
                    f"request_user={safe_user_id}, path_user={path_user_id}"
                )
                return None
        elif len(parts) == 1:
            target_filename = parts[0]
        else:
            logger.warning(f"[StorageService] Disallowed nested path depth in avatar: {filename_or_path}")
            return None

        if not target_filename or target_filename in (".", ".."):
            return None

        user_avatar_dir = (self.avatars_dir / str(safe_user_id)).resolve()

        try:
            candidate = (user_avatar_dir / target_filename).resolve()
            candidate.relative_to(user_avatar_dir)
            candidate.relative_to(self.avatars_dir)
        except (ValueError, RuntimeError):
            logger.warning(
                f"[StorageService] Path traversal escape attempt detected: "
                f"user_id={safe_user_id}, path={filename_or_path}"
            )
            return None

        if candidate == user_avatar_dir or candidate == self.avatars_dir:
            return None

        if not candidate.is_file():
            return None

        return candidate

    def delete_avatar_file(self, user_id: int | str, filename_or_path: str) -> bool:
        """
        Xóa tệp ảnh đại diện của người dùng khỏi hệ thống lưu trữ với kiểm soát quyền sở hữu nghiêm ngặt.
        Người dùng chỉ được phép xóa tệp thuộc thư mục của chính mình.
        """
        target_path = self.get_avatar_path(user_id, filename_or_path)
        if not target_path or not target_path.is_file():
            return False

        try:
            safe_user_id = int(user_id)
            user_avatar_dir = (self.avatars_dir / str(safe_user_id)).resolve()
            target_path.relative_to(user_avatar_dir)
            target_path.relative_to(self.avatars_dir)
            target_path.unlink()
            logger.info(f"[StorageService] Deleted avatar file: {target_path}")
            return True
        except Exception as e:
            logger.error(f"[StorageService] Failed to delete avatar file {target_path}: {e}")
            return False

    def cleanup_old_avatars(self, user_id: int | str, keep_filename: Optional[str] = None) -> int:
        """
        Dọn dẹp các tệp ảnh đại diện cũ và các tệp tạm (.tmp) còn sót lại trong thư mục của người dùng.
        Cho phép giữ lại một tệp đang hoạt động được chỉ định bởi keep_filename.
        Trả về số lượng tệp đã xóa thành công.
        """
        try:
            safe_user_id = int(user_id)
            if safe_user_id <= 0:
                return 0
        except (ValueError, TypeError):
            return 0

        user_avatar_dir = (self.avatars_dir / str(safe_user_id)).resolve()
        if not self.is_safe_path(user_avatar_dir, base=self.avatars_dir) or not user_avatar_dir.is_dir():
            return 0

        keep_name = Path(keep_filename).name if keep_filename else None
        deleted_count = 0

        try:
            for file_path in user_avatar_dir.iterdir():
                if file_path.is_file():
                    if keep_name and file_path.name == keep_name:
                        continue
                    try:
                        file_path.unlink()
                        deleted_count += 1
                    except Exception as del_err:
                        logger.warning(
                            f"[StorageService] Could not remove old avatar file {file_path}: {del_err}"
                        )
        except Exception as iter_err:
            logger.error(
                f"[StorageService] Error iterating user avatar directory {user_avatar_dir}: {iter_err}"
            )

        return deleted_count

