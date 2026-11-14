from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


class ExportFormat(str, Enum):
    TXT = "txt"
    PDF = "pdf"
    DOCX = "docx"


class ExportTargetType(str, Enum):
    ORIGINAL = "original"
    TRANSLATED = "translated"
    SUMMARY = "summary"
    BILINGUAL = "bilingual"


class JobProgressData(BaseModel):
    job_id: str = Field(..., description="Mã định danh duy nhất của tác vụ")
    filename: str = Field(..., description="Tên tệp PDF được xử lý")
    target_lang: str = Field(..., description="Ngôn ngữ đích")
    status: str = Field(..., description="Trạng thái: PENDING | PROCESSING | COMPLETED | FAILED")
    total_pages: int = Field(default=0, description="Tổng số trang của tài liệu")
    processed_pages: int = Field(default=0, description="Số trang đã xử lý xong")
    progress_percentage: float = Field(default=0.0, description="Phần trăm tiến độ hoàn thành (0 - 100)")
    current_step: int = Field(default=1, description="Bước hiện tại (1: Upload, 2: Phân tích/OCR, 3: Dịch thuật, 4: Hoàn thành)")
    message: str = Field(default="", description="Thông điệp tiến độ hiển thị cho người dùng")
    result: Optional[dict[str, Any]] = Field(default=None, description="Kết quả chi tiết khi xử lý thành công")
    error: Optional[str] = Field(default=None, description="Thông điệp lỗi nếu xử lý thất bại")
    created_at: float = Field(..., description="Thời điểm khởi tạo tác vụ (timestamp)")
    updated_at: float = Field(..., description="Thời điểm cập nhật trạng thái gần nhất (timestamp)")
    completed_at: Optional[float] = Field(default=None, description="Thời điểm hoàn thành hoặc thất bại (timestamp)")


class ProcessResponseData(BaseModel):
    document_id: Optional[int] = Field(default=None, description="ID tài liệu lưu trong CSDL nếu đã đăng nhập")
    history_id: Optional[int] = Field(default=None, description="ID bản ghi lịch sử xử lý nếu đã đăng nhập")
    filename: str
    page_count: int
    file_size_mb: float
    target_lang: str
    is_ocr_used: bool
    original_text: str
    translated_text: str
    engine_used: str


class RetranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Văn bản cần dịch lại")
    target_lang: str = Field(default="vi", description="Mã ngôn ngữ đích")
    source_lang: str = Field(default="auto", description="Mã ngôn ngữ nguồn")


class DownloadRequest(BaseModel):
    content: Optional[str] = Field(default=None, description="Nội dung cần xuất file")
    format: ExportFormat = Field(
        default=ExportFormat.TXT,
        description="Định dạng tệp: txt, pdf hoặc docx",
    )
    export_type: ExportTargetType = Field(
        default=ExportTargetType.TRANSLATED,
        description="Loại nội dung cần xuất: original | translated | summary | bilingual",
    )
    filename: str = Field(default="translated_document", description="Tên tệp tải về không gồm đuôi")
    title: Optional[str] = Field(default=None, description="Tiêu đề tài liệu")
    original_content: Optional[str] = Field(default=None, description="Nội dung văn bản gốc nếu muốn xuất song ngữ")

    @field_validator("format", mode="before")
    @classmethod
    def validate_format(cls, v: Any) -> Any:
        """PDFL-254.1: Kiểm tra định dạng tệp xuất chỉ chấp nhận: txt, pdf, docx."""
        if not v or not isinstance(v, (str, ExportFormat)):
            raise ValueError("Định dạng tệp không được để trống và phải là chuỗi ký tự hợp lệ.")
        if isinstance(v, str):
            clean = v.strip().lower()
            allowed = {f.value for f in ExportFormat}
            if clean not in allowed:
                raise ValueError(
                    f"Định dạng tệp '{v}' không hợp lệ. Chỉ chấp nhận các định dạng: {', '.join(sorted(allowed))}."
                )
            return clean
        return v


class FeedbackRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="Họ và tên người gửi")
    email: str = Field(..., min_length=5, max_length=255, description="Email người gửi")
    topic: str = Field(default="support", description="Chủ đề góp ý: bug | feature | support | other")
    message: str = Field(..., min_length=5, max_length=3000, description="Nội dung phản hồi")
