"""
Storage Service
---------------
Handles physical file persistence, folder structure isolation by user,
safe filename sanitization, and path-traversal prevention (PDFL-90, PDFL-95, PDFL-98).
"""

import json
import os
import re
import uuid
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.logger import logger


class StorageService:
    """Manages secure file storage for uploaded documents."""

    def __init__(self, base_dir: Optional[str | Path] = None):
        self.base_dir = Path(base_dir or settings.STORAGE_DIR).resolve()
        try:
            self.base_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"[StorageService] Could not create storage root: {e}")

    def sanitize_filename(self, filename: str) -> str:
        """
        Sanitize uploaded filename to eliminate directory traversal sequences
        and special characters, while preserving alphanumeric and valid unicode characters.
        """
        if not filename:
            return "document.pdf"

        # Extract only the base name (strip any leading directory paths)
        clean = os.path.basename(filename.strip())

        # Replace backslashes and slashes
        clean = clean.replace("\\", "_").replace("/", "_")

        # Remove null bytes and path traversal patterns
        clean = re.sub(r"\.\.+", ".", clean)

        # Remove control characters and non-standard shell/filesystem dangerous chars
        clean = re.sub(r'[\x00-\x1f\x7f<>:"/\\|?*]', "_", clean).strip(" ._")

        if not clean:
            return "document.pdf"

        # Ensure .pdf extension
        if not clean.lower().endswith(".pdf"):
            clean = f"{clean}.pdf"

        # Limit max length
        if len(clean) > 200:
            clean = clean[-200:]
            if not clean.lower().endswith(".pdf"):
                clean = f"{clean[:196]}.pdf"

        return clean

    def save_document_file(
        self,
        user_id: int,
        original_filename: str,
        content: bytes,
    ) -> tuple[str, str, Path]:
        """
        Saves a document file into the user's isolated storage directory.

        Returns:
            tuple of (stored_filename, relative_path, absolute_path)
        """
        user_dir = (self.base_dir / str(user_id)).resolve()
        user_dir.mkdir(parents=True, exist_ok=True)

        safe_name = self.sanitize_filename(original_filename)
        unique_token = uuid.uuid4().hex[:12]
        stored_filename = f"{unique_token}_{safe_name}"

        target_path = user_dir / stored_filename
        target_path.write_bytes(content)

        relative_path = f"{user_id}/{stored_filename}"

        logger.info(
            f"[StorageService] Saved document for user_id={user_id}: "
            f"file={stored_filename}, size={len(content)} bytes"
        )
        return stored_filename, relative_path, target_path

    def get_document_path(self, user_id: int, stored_filename: str) -> Optional[Path]:
        """
        Resolves physical file path with strict path-traversal validation.
        Returns None if file is missing or tries to escape user's folder.
        """
        user_dir = (self.base_dir / str(user_id)).resolve()
        candidate = (user_dir / stored_filename).resolve()

        # Strict containment verification
        try:
            candidate.relative_to(user_dir)
        except ValueError:
            logger.warning(
                f"[StorageService] Path traversal attempt detected: "
                f"user_id={user_id}, path={stored_filename}"
            )
            return None

        if not candidate.is_file():
            return None

        return candidate

    def delete_document_file(self, user_id: int, stored_filename: str) -> bool:
        """Deletes a stored document file from disk."""
        target_path = self.get_document_path(user_id, stored_filename)
        if target_path and target_path.exists():
            try:
                target_path.unlink()
                logger.info(f"[StorageService] Deleted file: {target_path}")
                return True
            except Exception as e:
                logger.error(f"[StorageService] Failed to delete file {target_path}: {e}")
                return False

    def save_result_file(
        self,
        user_id: int,
        history_id: int,
        result_data: dict,
    ) -> tuple[str, Path]:
        """
        Saves a processing history result dictionary as a JSON file in user's isolated results folder.

        Returns:
            tuple of (relative_path, absolute_path)
        """
        user_dir = (self.base_dir / str(user_id)).resolve()
        results_dir = (user_dir / "results").resolve()
        results_dir.mkdir(parents=True, exist_ok=True)

        result_filename = f"{history_id}_result.json"
        target_path = (results_dir / result_filename).resolve()

        content = json.dumps(result_data, ensure_ascii=False, indent=2).encode("utf-8")
        target_path.write_bytes(content)

        relative_path = f"{user_id}/results/{result_filename}"

        logger.info(
            f"[StorageService] Saved result for user_id={user_id}, history_id={history_id}: "
            f"path={relative_path}, size={len(content)} bytes"
        )
        return relative_path, target_path

    def get_result_path(self, user_id: int, result_path_or_filename: str) -> Optional[Path]:
        """
        Resolves physical path of a result JSON file with strict containment check against user_dir.
        Accepts either full relative path ('1/results/123_result.json') or filename ('123_result.json').
        Returns None if missing or if traversal attempt detected.
        """
        if not result_path_or_filename:
            return None

        user_dir = (self.base_dir / str(user_id)).resolve()
        results_dir = (user_dir / "results").resolve()

        clean_path = result_path_or_filename.strip().replace("\\", "/")

        if "/" in clean_path:
            # Check relative to base_dir
            candidate = (self.base_dir / clean_path).resolve()
        else:
            # Check relative to user's results directory
            candidate = (results_dir / clean_path).resolve()

        try:
            candidate.relative_to(user_dir)
        except ValueError:
            logger.warning(
                f"[StorageService] Path traversal attempt on result file: "
                f"user_id={user_id}, path={result_path_or_filename}"
            )
            return None

        if not candidate.is_file():
            return None

        return candidate

    def read_result_file(self, user_id: int, result_path_or_filename: str) -> Optional[dict]:
        """
        Reads and parses stored result JSON file.
        Returns parsed dict or None if file does not exist or JSON is invalid.
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

    def delete_result_file(self, user_id: int, result_path_or_filename: str) -> bool:
        """Deletes a stored result JSON file from disk."""
        target_path = self.get_result_path(user_id, result_path_or_filename)
        if target_path and target_path.exists():
            try:
                target_path.unlink()
                logger.info(f"[StorageService] Deleted result file: {target_path}")
                return True
            except Exception as e:
                logger.error(f"[StorageService] Failed to delete result file {target_path}: {e}")
                return False
        return False

