"""
Document ORM Model
------------------
Defines the `documents` table schema for the PDF-Lingua database.
Supports persistent file storage, user ownership, and document metadata tracking
(PDFL-90, PDFL-91, PDFL-95, PDFL-98).

Columns
-------
id                : Integer primary key (auto-increment).
user_id           : Foreign key to `users.id` — owner of this document.
original_filename : Name of the uploaded file as provided by the user.
stored_filename   : Unique physical filename stored on disk ({uuid}_{safe_name}).
stored_path       : Relative path to the file inside the storage root directory.
file_size_bytes   : Total size of the file in bytes.
page_count        : Total number of pages in the PDF document.
target_lang       : Target language code for translation (e.g. 'vi', 'en', 'ja').
is_ocr_used       : Whether OCR extraction was applied for this document.
created_at        : UTC timestamp when the document was uploaded.
updated_at        : UTC timestamp of the last document update.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Document(Base):
    """SQLAlchemy ORM model for the `documents` table."""

    __tablename__ = "documents"

    # ── Primary Key ─────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)

    # ── Ownership ────────────────────────────────────────────────────────────
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Owner user ID. Enforces multi-tenant data isolation.",
    )

    # ── Metadata ─────────────────────────────────────────────────────────────
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original filename uploaded by the user.",
    )
    stored_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
        comment="Unique file identifier on server filesystem.",
    )
    stored_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Relative path from storage root (e.g. '1/a1b2c3d4_report.pdf').",
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Document file size in bytes.",
    )
    page_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        server_default="1",
        comment="Total number of pages.",
    )
    target_lang: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="vi",
        server_default="vi",
        comment="Target language code selected during processing.",
    )
    is_ocr_used: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
        comment="True if Tesseract OCR was invoked for scanned pages.",
    )

    # ── Audit Timestamps ──────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
        comment="UTC timestamp when the file was uploaded and recorded.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the document record was last updated.",
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    owner: Mapped[Any] = relationship("User", back_populates="documents")

    def __repr__(self) -> str:
        return (
            f"<Document id={self.id} user_id={self.user_id} "
            f"name={self.original_filename!r} pages={self.page_count}>"
        )
