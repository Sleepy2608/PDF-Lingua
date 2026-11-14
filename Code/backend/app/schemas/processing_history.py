"""
Processing History Pydantic Schemas
-----------------------------------
Defines request, update, and response data validation schemas for
document processing history records (PDFL-159.3, PDFL-162.1).

Schema hierarchy
----------------
ProcessingHistoryBase      — shared validated fields (action_type, status, metrics)
  └─ ProcessingHistoryCreate — payload for creating a new history entry
ProcessingHistoryUpdate    — payload for updating status, duration, and error diagnostics
ProcessingHistoryResponse  — read-safe response schema mapped from ORM attributes
"""

import re
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

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
    """Read-safe response schema for ProcessingHistory records (PDFL-162.1)."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., gt=0, description="ID định danh bản ghi lịch sử.")
    user_id: int = Field(..., gt=0, description="ID chủ sở hữu thao tác.")
    document_id: int = Field(..., gt=0, description="ID tài liệu được xử lý.")
    document_filename: Optional[str] = Field(
        default=None,
        description="Tên file gốc của tài liệu (original_filename).",
    )
    created_at: datetime = Field(..., description="Thời điểm khởi tạo bản ghi (UTC).")
    updated_at: datetime = Field(..., description="Thời điểm cập nhật gần nhất (UTC).")

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime, _info) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    @model_validator(mode="after")
    def validate_timestamps(self) -> "ProcessingHistoryResponse":
        if self.created_at and self.updated_at:
            try:
                if self.updated_at < self.created_at:
                    raise ValueError("updated_at không được nhỏ hơn created_at.")
            except TypeError:
                pass
        return self


class ProcessingResultResponse(BaseModel):
    """Schema for retrieved document processing result (PDFL-165.1)."""

    history_id: int = Field(..., gt=0, description="ID bản ghi lịch sử xử lý.")
    document_id: int = Field(..., gt=0, description="ID tài liệu gốc.")
    document_filename: Optional[str] = Field(default=None, description="Tên tệp tài liệu gốc.")
    action_type: ActionType = Field(..., description="Loại thao tác: EXTRACT | TRANSLATE | SUMMARIZE.")
    target_lang: Optional[str] = Field(default="vi", description="Mã ngôn ngữ đích.")
    original_text: str = Field(default="", description="Văn bản gốc được trích xuất từ PDF.")
    translated_text: Optional[str] = Field(default=None, description="Văn bản đã dịch sang ngôn ngữ đích.")
    summary_text: Optional[str] = Field(default=None, description="Văn bản tóm tắt.")
    engine_used: Optional[str] = Field(default=None, description="Công cụ dịch thuật hoặc AI provider.")
    page_count: Optional[int] = Field(default=1, ge=1, description="Tổng số trang tài liệu.")
    file_size_mb: Optional[float] = Field(default=None, ge=0, description="Kích thước tệp tài liệu (MB).")
    is_ocr_used: Optional[bool] = Field(default=False, description="Xác định có sử dụng OCR nhận dạng quang học.")
    execution_time_ms: Optional[int] = Field(default=None, ge=0, description="Thời gian thực thi tính bằng mili-giây.")
    created_at: Optional[datetime] = Field(default=None, description="Thời điểm hoàn tất xử lý (UTC).")

    @field_serializer("created_at")
    def serialize_created_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class HistoryDeleteResponse(BaseModel):
    """Schema for single history record deletion (PDFL-166.1)."""

    id: int = Field(..., gt=0, description="ID bản ghi lịch sử đã xóa.")
    deleted: bool = Field(default=True, description="Trạng thái xóa thành công.")


class HistoryCleanupResponse(BaseModel):
    """Schema for retention cleanup summary (PDFL-166.1)."""

    deleted_count: int = Field(..., ge=0, description="Số lượng bản ghi lịch sử đã được dọn dẹp.")
    older_than_days: int = Field(..., ge=1, description="Số ngày chính sách lưu trữ áp dụng.")
    cutoff_date: str = Field(..., description="Mốc thời gian UTC dùng để lọc bản ghi hết hạn.")


