"""
Processing History Pydantic Schemas
-----------------------------------
Defines request, update, and response data validation schemas for
document processing history records (PDFL-159.3).

Schema hierarchy
----------------
ProcessingHistoryBase      — shared validated fields (action_type, status, metrics)
  └─ ProcessingHistoryCreate — payload for creating a new history entry
ProcessingHistoryUpdate    — payload for updating status, duration, and error diagnostics
ProcessingHistoryResponse  — read-safe response schema mapped from ORM attributes
"""

import re
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.processing_history import ActionType, ProcessingStatus

MAX_ERROR_MESSAGE_LENGTH = 1000

# Regex patterns to strip sensitive local file system paths or credentials from error messages
_WINDOWS_PATH_PATTERN = re.compile(r"[A-Za-z]:\\[^\s'\"]+")
_UNIX_PATH_PATTERN = re.compile(r"(?:/Users/|/home/|/var/|/tmp/|/etc/)[^\s'\"]+")


def sanitize_error_message(value: Optional[str]) -> Optional[str]:
    """
    Clean and truncate error messages so internal file paths, stack traces,
    or sensitive system details are not persisted or exposed.
    """
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None

    # Keep only the first meaningful line if a multi-line traceback was passed
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    summary = lines[-1] if lines and lines[0].startswith("Traceback") else (lines[0] if lines else cleaned)

    # Redact local filesystem paths
    summary = _WINDOWS_PATH_PATTERN.sub("[redacted-path]", summary)
    summary = _UNIX_PATH_PATTERN.sub("[redacted-path]", summary)

    if len(summary) > MAX_ERROR_MESSAGE_LENGTH:
        summary = summary[: MAX_ERROR_MESSAGE_LENGTH - 3] + "..."
    return summary


class ProcessingHistoryBase(BaseModel):
    """Shared base fields for ProcessingHistory validation."""

    action_type: ActionType = Field(
        ...,
        description="Loại thao tác xử lý: EXTRACT | TRANSLATE | SUMMARIZE.",
    )
    status: ProcessingStatus = Field(
        default=ProcessingStatus.PENDING,
        description="Trạng thái thực thi: PENDING | SUCCESS | FAILED.",
    )
    execution_time_ms: Optional[int] = Field(
        default=None,
        ge=0,
        description="Thời gian thực thi tính bằng mili-giây (>= 0).",
    )
    error_message: Optional[str] = Field(
        default=None,
        max_length=MAX_ERROR_MESSAGE_LENGTH,
        description="Thông báo lỗi đã được làm sạch khi trạng thái là FAILED.",
    )

    @field_validator("action_type", mode="before")
    @classmethod
    def validate_action_type(cls, value: Any) -> ActionType:
        if isinstance(value, ActionType):
            return value
        if isinstance(value, str):
            normalized = value.strip().upper()
            try:
                return ActionType(normalized)
            except ValueError as exc:
                allowed = ", ".join(item.value for item in ActionType)
                raise ValueError(f"action_type không hợp lệ '{value}'. Giá trị hợp lệ: {allowed}.") from exc
        raise ValueError("action_type phải là chuỗi hoặc ActionType hợp lệ.")

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, value: Any) -> ProcessingStatus:
        if isinstance(value, ProcessingStatus):
            return value
        if isinstance(value, str):
            normalized = value.strip().upper()
            try:
                return ProcessingStatus(normalized)
            except ValueError as exc:
                allowed = ", ".join(item.value for item in ProcessingStatus)
                raise ValueError(f"status không hợp lệ '{value}'. Giá trị hợp lệ: {allowed}.") from exc
        raise ValueError("status phải là chuỗi hoặc ProcessingStatus hợp lệ.")

    @field_validator("error_message", mode="before")
    @classmethod
    def clean_error_message(cls, value: Optional[str]) -> Optional[str]:
        return sanitize_error_message(value)

    @model_validator(mode="after")
    def check_status_error_consistency(self) -> "ProcessingHistoryBase":
        if self.status == ProcessingStatus.SUCCESS and self.error_message is not None:
            self.error_message = None
        return self


class ProcessingHistoryCreate(ProcessingHistoryBase):
    """Payload schema for creating a new processing history entry."""

    user_id: int = Field(
        ...,
        gt=0,
        description="ID của người dùng thực hiện thao tác (> 0).",
    )
    document_id: int = Field(
        ...,
        gt=0,
        description="ID của tài liệu được xử lý (> 0).",
    )


class ProcessingHistoryUpdate(BaseModel):
    """Payload schema for updating an existing processing history entry."""

    status: ProcessingStatus = Field(
        ...,
        description="Trạng thái cập nhật: PENDING | SUCCESS | FAILED.",
    )
    execution_time_ms: Optional[int] = Field(
        default=None,
        ge=0,
        description="Thời gian thực thi tính bằng mili-giây (>= 0).",
    )
    error_message: Optional[str] = Field(
        default=None,
        max_length=MAX_ERROR_MESSAGE_LENGTH,
        description="Thông báo lỗi nếu trạng thái là FAILED.",
    )

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, value: Any) -> ProcessingStatus:
        if isinstance(value, ProcessingStatus):
            return value
        if isinstance(value, str):
            normalized = value.strip().upper()
            try:
                return ProcessingStatus(normalized)
            except ValueError as exc:
                allowed = ", ".join(item.value for item in ProcessingStatus)
                raise ValueError(f"status không hợp lệ '{value}'. Giá trị hợp lệ: {allowed}.") from exc
        raise ValueError("status phải là chuỗi hoặc ProcessingStatus hợp lệ.")

    @field_validator("error_message", mode="before")
    @classmethod
    def clean_error_message(cls, value: Optional[str]) -> Optional[str]:
        return sanitize_error_message(value)

    @model_validator(mode="after")
    def validate_update_consistency(self) -> "ProcessingHistoryUpdate":
        if self.status == ProcessingStatus.SUCCESS:
            self.error_message = None
        elif self.status == ProcessingStatus.FAILED and not self.error_message:
            self.error_message = "Thao tác xử lý tài liệu thất bại."
        return self


class ProcessingHistoryResponse(ProcessingHistoryBase):
    """Read-safe response schema for ProcessingHistory records."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., gt=0, description="ID định danh bản ghi lịch sử.")
    user_id: int = Field(..., gt=0, description="ID chủ sở hữu thao tác.")
    document_id: int = Field(..., gt=0, description="ID tài liệu được xử lý.")
    created_at: datetime = Field(..., description="Thời điểm khởi tạo bản ghi (UTC).")
    updated_at: datetime = Field(..., description="Thời điểm cập nhật gần nhất (UTC).")

    @model_validator(mode="after")
    def validate_timestamps(self) -> "ProcessingHistoryResponse":
        if self.created_at and self.updated_at:
            try:
                if self.updated_at < self.created_at:
                    raise ValueError("updated_at không được nhỏ hơn created_at.")
            except TypeError:
                pass
        return self

