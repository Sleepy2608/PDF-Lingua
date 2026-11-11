"""
Processing History ORM Model
----------------------------
Defines the `processing_histories` table schema for the PDF-Lingua database.
Supports tracking of document operations (EXTRACT, TRANSLATE, SUMMARIZE),
execution statuses, performance metrics, and error diagnostics (PDFL-159.1).

Columns
-------
id                : Integer primary key (auto-increment).
user_id           : Foreign key to `users.id` - owner who requested the action.
document_id       : Foreign key to `documents.id` - document processed.
action_type       : Enum(EXTRACT | TRANSLATE | SUMMARIZE) - type of action.
status            : Enum(PENDING | SUCCESS | FAILED) - processing state.
execution_time_ms : Optional execution duration in milliseconds.
error_message     : Diagnostic error message / stack trace if failed.
created_at        : UTC timestamp when the operation record was created.
updated_at        : UTC timestamp when the record was last modified.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class ActionType(str, enum.Enum):
    """Supported processing action types for PDF documents."""

    EXTRACT = "EXTRACT"
    TRANSLATE = "TRANSLATE"
    SUMMARIZE = "SUMMARIZE"
    CHAT = "CHAT"


class ProcessingStatus(str, enum.Enum):
    """Execution status states for document processing tasks."""

    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class ProcessingHistory(Base):
    """SQLAlchemy ORM model for the `processing_histories` table."""

    __tablename__ = "processing_histories"
    __table_args__ = (
        Index(
            "ix_processing_histories_user_created_id",
            "user_id",
            "created_at",
            "id",
        ),
    )

    # ── Primary Key ─────────────────────────────────────────────────────────
    id: int = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # ── Foreign Keys ────────────────────────────────────────────────────────
    user_id: int = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Owner user ID who initiated the processing action.",
    )
    document_id: int = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="Target document ID on which the action was performed.",
    )

    # ── Operation Details ───────────────────────────────────────────────────
    action_type: ActionType = Column(
        Enum(ActionType, name="processing_action_type"),
        nullable=False,
        index=True,
        comment="Operation type: EXTRACT | TRANSLATE | SUMMARIZE.",
    )
    status: ProcessingStatus = Column(
        Enum(ProcessingStatus, name="processing_status"),
        nullable=False,
        default=ProcessingStatus.PENDING,
        server_default=ProcessingStatus.PENDING.value,
        index=True,
        comment="Current execution status: PENDING | SUCCESS | FAILED.",
    )

    # ── Diagnostics & Performance Metrics ───────────────────────────────────
    execution_time_ms: int | None = Column(
        Integer,
        nullable=True,
        default=None,
        comment="Total processing time in milliseconds.",
    )
    error_message: str | None = Column(
        Text,
        nullable=True,
        default=None,
        comment="Failure reason or error trace if processing failed.",
    )
    result_path: str | None = Column(
        String(500),
        nullable=True,
        default=None,
        comment="Relative path from storage root to the persistent result JSON file.",
    )

    # ── Audit Timestamps ────────────────────────────────────────────────────
    created_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
        comment="UTC timestamp when processing was initiated.",
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when this record was last updated.",
    )

    # ── Relationships ───────────────────────────────────────────────────────
    user = relationship("User", back_populates="processing_histories")
    document = relationship("Document", back_populates="processing_histories")

    @property
    def document_filename(self) -> str | None:
        """Returns the original filename of the associated document if loaded."""
        if self.document:
            return getattr(self.document, "original_filename", None)
        return None

    def __repr__(self) -> str:
        return (
            f"<ProcessingHistory id={self.id} user_id={self.user_id} "
            f"document_id={self.document_id} action_type={self.action_type.value} "
            f"status={self.status.value}>"
        )

