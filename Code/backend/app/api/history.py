"""
Processing History API Endpoints (PDFL-160.2, PDFL-160.3)
---------------------------------------------------------
Exposes endpoints for querying document processing history:
- GET /api/history               : List processing histories for the current user (paginated & filterable).
- GET /api/history/{history_id}  : Retrieve details of a specific processing history record.

Security & Access Control:
- Strict authentication required via `get_current_user`.
- Multi-tenant ownership isolation (Anti-IDOR): Users can only view their own processing histories
  and can only filter by documents they own.
- Boundary validation on pagination (`skip >= 0`, `1 <= limit <= 100`) and identifiers (`> 0`).
- Error messages are sanitized; internal stack traces, SQL errors, and system details are never exposed.
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Path, Query, status as http_status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import AppException, BadRequestException, NotFoundException
from app.core.logger import logger
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.processing_history import ProcessingHistoryResponse
from app.services.history_service import history_service

router = APIRouter(prefix="/api/history", tags=["Processing History"])


@router.get("", response_model=ApiResponse[list[ProcessingHistoryResponse]])
async def list_user_histories(
    skip: Annotated[int, Query(ge=0, description="Số lượng bản ghi bỏ qua (>= 0).")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="Số lượng bản ghi tối đa trên một trang (1 - 100).")] = 50,
    action_type: Annotated[
        Optional[str],
        Query(description="Lọc theo loại thao tác: EXTRACT | TRANSLATE | SUMMARIZE."),
    ] = None,
    status: Annotated[
        Optional[str],
        Query(description="Lọc theo trạng thái thực thi: PENDING | SUCCESS | FAILED."),
    ] = None,
    document_id: Annotated[
        Optional[int],
        Query(gt=0, description="Lọc theo ID tài liệu (> 0)."),
    ] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lấy danh sách lịch sử xử lý tài liệu của người dùng đang đăng nhập.
    Hỗ trợ phân trang (`skip`, `limit`) và lọc theo `action_type`, `status`, `document_id`.
    """
    if skip < 0:
        raise BadRequestException(
            message="Tham số skip phải lớn hơn hoặc bằng 0.",
            error_code="INVALID_PAGINATION",
            details={"skip": skip},
        )
    if limit < 1 or limit > 100:
        raise BadRequestException(
            message="Tham số limit phải nằm trong khoảng từ 1 đến 100.",
            error_code="INVALID_PAGINATION",
            details={"limit": limit},
        )
    if document_id is not None and document_id <= 0:
        raise BadRequestException(
            message="document_id phải là số nguyên dương (> 0).",
            error_code="INVALID_DOCUMENT_ID",
            details={"document_id": document_id},
        )

    logger.info(
        f"[HistoryAPI] User {current_user.email} (id={current_user.id}) listing histories "
        f"(skip={skip}, limit={limit}, action_type={action_type}, status={status}, document_id={document_id})."
    )

    try:
        records = history_service.get_histories_by_user(
            db=db,
            user_id=current_user.id,
            current_user_id=current_user.id,
            skip=skip,
            limit=limit,
            action_type=action_type,
            status=status,
            document_id=document_id,
        )
    except SQLAlchemyError as exc:
        logger.error(f"[HistoryAPI] Database error listing histories for user_id={current_user.id}: {exc}")
        raise AppException(
            message="Lỗi cơ sở dữ liệu khi truy vấn lịch sử xử lý. Vui lòng thử lại sau.",
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
            details=None,
        ) from exc

    data = [ProcessingHistoryResponse.model_validate(record) for record in records]
    return ApiResponse(
        data=data,
        message=f"Lấy danh sách {len(data)} bản ghi lịch sử xử lý thành công.",
    )


@router.get("/{history_id}", response_model=ApiResponse[ProcessingHistoryResponse])
async def get_history_detail(
    history_id: Annotated[int, Path(gt=0, description="ID định danh bản ghi lịch sử (> 0).")],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lấy thông tin chi tiết một bản ghi lịch sử xử lý tài liệu theo ID.
    Đảm bảo chỉ chủ sở hữu bản ghi mới được phép truy cập (Anti-IDOR).
    """
    if history_id <= 0:
        raise BadRequestException(
            message="history_id phải là số nguyên dương (> 0).",
            error_code="INVALID_HISTORY_ID",
            details={"history_id": history_id},
        )

    logger.info(
        f"[HistoryAPI] User {current_user.email} (id={current_user.id}) requesting history_id={history_id}."
    )

    try:
        record = history_service.get_history_by_id(
            db=db,
            history_id=history_id,
            current_user_id=current_user.id,
        )
    except SQLAlchemyError as exc:
        logger.error(f"[HistoryAPI] Database error fetching history_id={history_id}: {exc}")
        raise AppException(
            message="Lỗi cơ sở dữ liệu khi truy vấn chi tiết lịch sử xử lý. Vui lòng thử lại sau.",
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
            details=None,
        ) from exc

    if record is None:
        raise NotFoundException(
            message=f"Bản ghi lịch sử với ID {history_id} không tồn tại.",
            details={"history_id": history_id},
        )

    return ApiResponse(
        data=ProcessingHistoryResponse.model_validate(record),
        message="Lấy thông tin chi tiết lịch sử xử lý thành công.",
    )
