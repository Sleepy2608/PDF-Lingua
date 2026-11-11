"""
AI Intelligence API Router
--------------------------
Provides endpoints for AI-powered document summarization and interactive Copilot chat.
Enforces Role-Based Access Control (RBAC Pro VIP gate), request limits, document isolation,
and processing history audit trails.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import AppException, BadRequestException, ForbiddenException, NotFoundException
from app.core.logger import logger
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.user import User, UserRole
from app.schemas.ai import (
    ChatRequest,
    ChatResponseData,
    SummarizeRequest,
    SummarizeResponseData,
)
from app.schemas.common import ApiResponse
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/ai", tags=["AI Intelligence"])


@router.post(
    "/summarize",
    response_model=ApiResponse[SummarizeResponseData],
    status_code=status.HTTP_200_OK,
    summary="Tom tat noi dung van ban bang AI (Danh rieng cho Pro VIP)",
)
async def summarize_document(
    payload: SummarizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Summarize document text using AI (B.AI Gateway with multi-style prompts).

    Enforces:
    - Authentication via Bearer token (HTTP 401 if missing/invalid).
    - Pro VIP role requirement (HTTP 403 if role is FREE).
    - Ownership verification if document_id is provided (HTTP 403 / 404).
    - Max text limit (100,000 characters).
    - Automatic ProcessingHistory audit logging for tracked documents.
    """
    # 1. Enforce Pro role requirement
    user_role = current_user.role
    is_pro_or_admin = (
        user_role in (UserRole.PRO, UserRole.ADMIN)
        or (isinstance(user_role, str) and user_role.lower() in ("pro", "admin"))
    )

    if not is_pro_or_admin:
        logger.warning(
            f"[AI API] User id={current_user.id} with role='{user_role}' denied access to AI Summarize."
        )
        raise ForbiddenException(
            message="Tinh nang tom tat AI chi danh rieng cho tai khoan Pro VIP.",
            error_code="PRO_REQUIRED",
            details={"upgrade_url": "/#pricingSection"},
        )

    # 2. Verify document ownership if document_id is specified
    linked_document: Optional[Document] = None
    if payload.document_id is not None:
        linked_document = db.query(Document).filter(Document.id == payload.document_id).first()
        if not linked_document:
            raise NotFoundException(
                message=f"Tai lieu id={payload.document_id} khong ton tai.",
                details={"document_id": payload.document_id},
            )

        is_admin = (
            user_role == UserRole.ADMIN
            or (isinstance(user_role, str) and user_role.lower() == "admin")
        )
        if linked_document.user_id != current_user.id and not is_admin:
            raise ForbiddenException(
                message="Ban khong co quyen truy cap tai lieu nay.",
                details={"document_id": payload.document_id, "user_id": current_user.id},
            )

    # 3. Execute AI summarization
    logger.info(
        f"[AI API] User id={current_user.id} requested summary (style='{payload.style}', "
        f"length='{payload.length}', doc_id={payload.document_id})."
    )

    try:
        result = await ai_service.summarize_text(
            text=payload.text,
            style=payload.style,
            length=payload.length,
            custom_instruction=payload.custom_instruction or "",
            model=payload.model,
        )
    except Exception as exc:
        logger.error(f"[AI API] Summarization failure: {exc}")
        # Log failed history entry if document is tracked
        if linked_document is not None:
            failed_record = ProcessingHistory(
                user_id=current_user.id,
                document_id=linked_document.id,
                action_type=ActionType.SUMMARIZE,
                status=ProcessingStatus.FAILED,
                error_message=str(exc)[:500],
            )
            db.add(failed_record)
            db.commit()

        raise AppException(
            message=f"Loi xu ly tom tat AI: {exc}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="AI_PROCESSING_ERROR",
            details={"error": str(exc)},
        )

    # 4. Record successful audit history if document is tracked
    history_record: Optional[ProcessingHistory] = None
    if linked_document is not None:
        try:
            history_record = ProcessingHistory(
                user_id=current_user.id,
                document_id=linked_document.id,
                action_type=ActionType.SUMMARIZE,
                status=ProcessingStatus.SUCCESS,
                execution_time_ms=result.get("execution_time_ms", 0),
            )
            db.add(history_record)
            db.commit()
            db.refresh(history_record)
        except Exception as db_err:
            db.rollback()
            logger.warning(f"[AI API] Failed to create ProcessingHistory record: {db_err}")

    # 5. Build response
    response_data = SummarizeResponseData(
        summary=result["summary"],
        style=result["style"],
        length=result["length"],
        word_count=result["word_count"],
        model_used=result["model_used"],
        provider=result["provider"],
        fallback_used=result["fallback_used"],
        fallback_reason=result["fallback_reason"],
        execution_time_ms=result["execution_time_ms"],
        document_id=payload.document_id,
        history_id=history_record.id if history_record else None,
    )

    return ApiResponse(
        success=True,
        message="Tom tat noi dung van ban thanh cong.",
        data=response_data,
    )


@router.post(
    "/chat",
    response_model=ApiResponse[ChatResponseData],
    status_code=status.HTTP_200_OK,
    summary="Hoi dap thong minh voi AI Copilot ve tai lieu (Danh rieng cho Pro VIP)",
)
async def chat_copilot(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Interactive Copilot question-answering over document text with RAG context and anti-hallucination.

    Enforces:
    - Authentication via Bearer token (HTTP 401).
    - Pro VIP role requirement (HTTP 403 if role is FREE).
    - Daily question quota limit (15 questions/day for Pro users).
    - Document ownership isolation if document_id is provided.
    - Anti-hallucination guardrails (PDFL-147).
    - ProcessingHistory audit logging with ActionType.CHAT.
    """
    # 1. Enforce Pro role requirement
    user_role = current_user.role
    is_pro_or_admin = (
        user_role in (UserRole.PRO, UserRole.ADMIN)
        or (isinstance(user_role, str) and user_role.lower() in ("pro", "admin"))
    )

    if not is_pro_or_admin:
        logger.warning(
            f"[AI API Chat] User id={current_user.id} with role='{user_role}' denied access to Copilot Chat."
        )
        raise ForbiddenException(
            message="Tinh nang tro ly AI Copilot chi danh rieng cho tai khoan Pro VIP.",
            error_code="PRO_REQUIRED",
            details={"upgrade_url": "/#pricingSection"},
        )

    is_admin = (
        user_role == UserRole.ADMIN
        or (isinstance(user_role, str) and user_role.lower() == "admin")
    )

    # 2. Daily question quota check (PDFL-145: 15 questions/day for Pro)
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    daily_limit = 15
    used_today = (
        db.query(ProcessingHistory)
        .filter(
            ProcessingHistory.user_id == current_user.id,
            ProcessingHistory.action_type == ActionType.CHAT,
            ProcessingHistory.created_at >= today_start,
        )
        .count()
    )

    if not is_admin and used_today >= daily_limit:
        logger.warning(
            f"[AI API Chat] User id={current_user.id} reached daily question limit ({used_today}/{daily_limit})."
        )
        raise ForbiddenException(
            message=f"Ban da su dung het han ngach {daily_limit} cau hoi/ngay cua goi Pro.",
            error_code="DAILY_QUOTA_EXCEEDED",
            details={
                "daily_limit": daily_limit,
                "used_today": used_today,
                "resets_at": "00:00 UTC",
            },
        )

    # 3. Document ownership and context resolution (PDFL-148)
    linked_document: Optional[Document] = None
    source_text: str = payload.document_text or ""

    if payload.document_id is not None:
        linked_document = db.query(Document).filter(Document.id == payload.document_id).first()
        if not linked_document:
            raise NotFoundException(
                message=f"Tai lieu id={payload.document_id} khong ton tai.",
                details={"document_id": payload.document_id},
            )

        if linked_document.user_id != current_user.id and not is_admin:
            raise ForbiddenException(
                message="Ban khong co quyen truy cap tai lieu nay.",
                details={"document_id": payload.document_id, "user_id": current_user.id},
            )

    if not source_text.strip():
        if linked_document is not None and hasattr(linked_document, "original_filename"):
            source_text = f"Tai lieu: {linked_document.original_filename}"
        else:
            raise BadRequestException(
                message="Khong tim thay noi dung van ban de hoi dap.",
                error_code="EMPTY_DOCUMENT_TEXT",
            )

    # 4. Invoke AI Copilot service
    logger.info(
        f"[AI API Chat] User id={current_user.id} query='{payload.query[:60]}...' "
        f"(doc_id={payload.document_id}, used_today={used_today})."
    )

    history_dicts = (
        [turn.model_dump() for turn in payload.conversation_history]
        if payload.conversation_history
        else None
    )

    try:
        result = await ai_service.chat_with_document(
            query=payload.query,
            document_text=source_text,
            conversation_history=history_dicts,
            model=payload.model,
        )
    except Exception as exc:
        logger.error(f"[AI API Chat] Service error: {exc}")
        if linked_document is not None:
            failed_record = ProcessingHistory(
                user_id=current_user.id,
                document_id=linked_document.id,
                action_type=ActionType.CHAT,
                status=ProcessingStatus.FAILED,
                error_message=str(exc)[:500],
            )
            db.add(failed_record)
            db.commit()

        raise AppException(
            message=f"Loi xu ly hoi dap AI Copilot: {exc}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="AI_PROCESSING_ERROR",
            details={"error": str(exc)},
        )

    # 5. Record ProcessingHistory
    history_record: Optional[ProcessingHistory] = None
    try:
        history_record = ProcessingHistory(
            user_id=current_user.id,
            document_id=linked_document.id if linked_document else None,
            action_type=ActionType.CHAT,
            status=ProcessingStatus.SUCCESS,
            execution_time_ms=result.get("execution_time_ms", 0),
        )
        db.add(history_record)
        db.commit()
        db.refresh(history_record)
    except Exception as db_err:
        db.rollback()
        logger.warning(f"[AI API Chat] Failed to save ProcessingHistory: {db_err}")

    remaining_questions = None if is_admin else max(0, daily_limit - (used_today + 1))

    # 6. Build response
    response_data = ChatResponseData(
        answer=result["answer"],
        relevant_chunks=result.get("relevant_chunks", []),
        model_used=result["model_used"],
        provider=result["provider"],
        fallback_used=result["fallback_used"],
        fallback_reason=result["fallback_reason"],
        execution_time_ms=result["execution_time_ms"],
        document_id=payload.document_id,
        history_id=history_record.id if history_record else None,
        daily_questions_remaining=remaining_questions,
    )

    return ApiResponse(
        success=True,
        message="Tra loi cau hoi thanh cong.",
        data=response_data,
    )
