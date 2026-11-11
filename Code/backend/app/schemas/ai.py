"""
AI Pydantic Schemas
-------------------
Defines request and response schemas for AI summarization and Copilot chat endpoints.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SummarizeRequest(BaseModel):
    """Payload for requesting text summarization."""

    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(
        ...,
        min_length=1,
        max_length=100000,
        description="Van ban nguon can tom tat (toi da 100,000 ky tu)",
    )
    style: str = Field(
        default="brief",
        pattern="^(brief|bullets|detailed)$",
        description="Phong cach tom tat: brief | bullets | detailed",
    )
    length: str = Field(
        default="medium",
        pattern="^(short|medium|long)$",
        description="Do dai ban tom tat: short | medium | long",
    )
    custom_instruction: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Chi dan bo sung tuy bien",
    )
    document_id: Optional[int] = Field(
        default=None,
        ge=1,
        description="ID tai lieu lien ket trong kho luu tru (neu co)",
    )
    model: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Mo hinh AI tuy chon (mac dinh theo he thong)",
    )


class SummarizeResponseData(BaseModel):
    """Response payload data for a completed summarization task."""

    summary: str = Field(..., description="Noi dung ban tom tat")
    style: str = Field(..., description="Phong cach da ap dung")
    length: str = Field(..., description="Do dai da ap dung")
    word_count: int = Field(..., ge=0, description="So tu cua ban tom tat")
    model_used: str = Field(..., description="Ten mo hinh AI duoc su dung")
    provider: str = Field(..., description="Nha cung cap dich vu AI (b.ai)")
    fallback_used: bool = Field(default=False, description="Co su dung co che du phong ngoai tuyen khong")
    fallback_reason: Optional[str] = Field(default=None, description="Ly do kich hoat du phong neu co")
    execution_time_ms: int = Field(default=0, ge=0, description="Thoi gian thuc thi tinh bang mili giay")
    document_id: Optional[int] = Field(default=None, description="ID tai lieu lien ket")
    history_id: Optional[int] = Field(default=None, description="ID ban ghi lich su xu ly")


class ChatTurn(BaseModel):
    """Single turn in a Copilot conversation."""

    model_config = ConfigDict(str_strip_whitespace=True)

    role: str = Field(..., pattern="^(user|assistant)$", description="Vai tro: user hoac assistant")
    content: str = Field(..., min_length=1, max_length=10000, description="Noi dung tin nhan")


class ChatRequest(BaseModel):
    """Payload for asking a question about a document to AI Copilot."""

    model_config = ConfigDict(str_strip_whitespace=True)

    query: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Cau hoi cua nguoi dung ve noi dung tai lieu",
    )
    document_id: Optional[int] = Field(
        default=None,
        ge=1,
        description="ID tai lieu lien ket trong co so du lieu",
    )
    document_text: Optional[str] = Field(
        default=None,
        max_length=100000,
        description="Van ban nguon cua tai lieu (neu truyen truc tiep)",
    )
    conversation_history: Optional[list[ChatTurn]] = Field(
        default=None,
        description="Lich su hoi dap truoc do",
    )
    model: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Mo hinh AI tuy chon (mac dinh theo he thong)",
    )


class ChatResponseData(BaseModel):
    """Response payload for an AI Copilot chat interaction."""

    answer: str = Field(..., description="Cau tra loi cua tro ly AI")
    relevant_chunks: list[str] = Field(
        default_factory=list,
        description="Cac doan van ban lien quan nhat duoc trinh trich lam ngu canh",
    )
    model_used: str = Field(..., description="Mo hinh AI duoc su dung")
    provider: str = Field(..., description="Nha cung cap AI (b.ai)")
    fallback_used: bool = Field(default=False, description="Co su dung che do du phong khong")
    fallback_reason: Optional[str] = Field(default=None, description="Ly do kich hoat du phong neu co")
    execution_time_ms: int = Field(default=0, ge=0, description="Thoi gian thuc thi tinh bang mili giay")
    document_id: Optional[int] = Field(default=None, description="ID tai lieu lien ket")
    history_id: Optional[int] = Field(default=None, description="ID ban ghi lich su xu ly")
    daily_questions_remaining: Optional[int] = Field(
        default=None,
        ge=0,
        description="So luot cau hoi con lai trong ngay cho tai khoan Pro",
    )
