from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class DocumentResponse(BaseModel):
    """Schema for document metadata responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="ID định danh duy nhất của tài liệu")
    user_id: int = Field(..., description="ID chủ sở hữu tài liệu")
    original_filename: str = Field(..., description="Tên file gốc do người dùng tải lên")
    file_size_bytes: int = Field(..., description="Dung lượng tệp (bytes)")
    page_count: int = Field(..., description="Tổng số trang của tài liệu")
    target_lang: str = Field(..., description="Mã ngôn ngữ đích đã chọn")
    is_ocr_used: bool = Field(..., description="Có sử dụng Tesseract OCR hay không")
    processing_status: Optional[str] = Field(
        default=None,
        description="Trạng thái xử lý gần nhất: SUCCESS | FAILED | CANCELLED | PROCESSING",
    )
    latest_error_message: Optional[str] = Field(
        default=None,
        description="Lý do thất bại hoặc hủy tác vụ gần nhất nếu có",
    )
    created_at: datetime = Field(..., description="Thời gian tải lên (UTC)")
    updated_at: datetime = Field(..., description="Thời gian cập nhật gần nhất (UTC)")

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime, _info) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

