from typing import Optional
from pydantic import BaseModel, Field


class ProcessResponseData(BaseModel):
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
    content: str = Field(..., min_length=1, description="Nội dung cần xuất file")
    format: str = Field(default="txt", description="Định dạng tệp: txt hoặc pdf")
    filename: str = Field(default="translated_document", description="Tên tệp tải về không gồm đuôi")
    title: Optional[str] = Field(default="PDF-Lingua Translation", description="Tiêu đề tài liệu")
    original_content: Optional[str] = Field(default=None, description="Nội dung văn bản gốc nếu muốn xuất song ngữ")


class FeedbackRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="Họ và tên người gửi")
    email: str = Field(..., min_length=5, max_length=255, description="Email người gửi")
    topic: str = Field(default="support", description="Chủ đề góp ý: bug | feature | support | other")
    message: str = Field(..., min_length=5, max_length=3000, description="Nội dung phản hồi")
