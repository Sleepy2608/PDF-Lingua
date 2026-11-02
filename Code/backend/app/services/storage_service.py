"""
Storage Service
---------------
Handles physical file persistence, folder structure isolation by user,
safe filename sanitization, and path-traversal prevention (PDFL-90, PDFL-95, PDFL-98).
"""

import os
from pathlib import Path
import re
from typing import Optional
import uuid

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
        return False

