"""
Storage Service
---------------
Handles physical file persistence, folder structure isolation by user,
safe filename sanitization, and path-traversal prevention (PDFL-90, PDFL-95, PDFL-98).
"""

import json
import os
import re
import unicodedata
import urllib.parse
import uuid
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.logger import logger

WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
}


class StorageService:
    """Manages secure file storage for uploaded documents."""

    def __init__(self, base_dir: Optional[str | Path] = None):
        self.base_dir = Path(base_dir or settings.STORAGE_DIR).resolve()
        try:
            self.base_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"[StorageService] Could not create storage root: {e}")

    def is_safe_path(self, path: Path | str, base: Optional[Path] = None) -> bool:
        """
        Kiểm tra đường dẫn có an toàn và nằm trọn trong thư mục gốc cho phép hay không (PDFL-214.2).
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
        (PDFL-214.2)
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
        (PDFL-214.2)

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
        (PDFL-214.2)
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
        (PDFL-214.2)
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
        (PDFL-214.2)

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
        (PDFL-214.2)
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
        (PDFL-214.2)
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
        (PDFL-214.2)
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

