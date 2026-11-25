"""
User Access Log ORM Model
-------------------------
Tracks authentication events (login / register) with client IP address,
parsed device summary, and raw User-Agent for administrative security auditing
and multi-device / multi-IP anomaly visibility.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserAccessLog(Base):
    """SQLAlchemy ORM model for the `user_access_logs` table."""

    __tablename__ = "user_access_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Authenticated user ID.",
    )
    ip_address: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Client IPv4 or IPv6 address (resolved via X-Forwarded-For when behind proxy).",
    )
    user_agent: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        default=None,
        comment="Truncated HTTP User-Agent string.",
    )
    device_summary: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        default=None,
        comment="Human-readable browser and OS summary (e.g. Chrome / Windows).",
    )
    action: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="login",
        server_default="login",
        comment="Auth action type: login | register.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
        comment="UTC timestamp when the access event occurred.",
    )

    user = relationship("User")

    def __repr__(self) -> str:
        return (
            f"<UserAccessLog id={self.id} user_id={self.user_id} "
            f"ip={self.ip_address!r} action={self.action!r}>"
        )
