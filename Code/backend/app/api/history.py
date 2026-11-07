"""
Processing History API Endpoints (PDFL-160.2)
---------------------------------------------
Exposes endpoints for querying document processing history:
- GET /api/history               : List processing histories for the current user (paginated & filterable).
- GET /api/history/{history_id}  : Retrieve details of a specific processing history record.

Security & Access Control:
- Strict authentication required via `get_current_user`.
- Multi-tenant ownership isolation (Anti-IDOR): Users can only view their own processing histories.
- Error messages are sanitized; internal stack traces and system details are never exposed.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundException
from app.core.logger import logger
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.processing_history import ProcessingHistoryResponse
from app.services.history_service import history_service

router = APIRouter(prefix="/api/history", tags=["Processing History"])


@router.get("", response_model=ApiResponse[list[ProcessingHistoryResponse]])
async def list_user_histories(
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua (>= 0)."),
    limit: int = Query(50, ge=1, le=100, description="Số lượng bản ghi tối đa trên một trang (1 - 100)."),
    action_type: Optional[str] = Query(
        None,
        description="Lọc theo loại thao tác: EXTRACT | TRANSLATE | SUMMARIZE.",
    ),
    status: Optional[str] = Query(
        None,
        description="Lọc theo trạng thái thực thi: PENDING | SUCCESS | FAILED.",
    ),
    document_id: Optional[int] = Query(
        None,
        gt=0,
        description="Lọc theo ID tài liệu (> 0).",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lấy danh sách lịch sử xử lý tài liệu của người dùng đang đăng nhập.
    Hỗ trợ phân trang (`skip`, `limit`) và lọc theo `action_type`, `status`, `document_id`.
    """
    logger.info(
        f"[HistoryAPI] User {current_user.email} (id={current_user.id}) listing histories "
        f"(skip={skip}, limit={limit}, action_type={action_type}, status={status}, document_id={document_id})."
    )

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

    data = [ProcessingHistoryResponse.model_validate(record) for record in records]
    return ApiResponse(
        data=data,
        message=f"Lấy danh sách {len(data)} bản ghi lịch sử xử lý thành công.",
    )


@router.get("/{history_id}", response_model=ApiResponse[ProcessingHistoryResponse])
async def get_history_detail(
    history_id: int = Path(..., gt=0, description="ID định danh bản ghi lịch sử (> 0)."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lấy thông tin chi tiết một bản ghi lịch sử xử lý tài liệu theo ID.
    Đảm bảo chỉ chủ sở hữu bản ghi mới được phép truy cập (Anti-IDOR).
    """
    logger.info(
        f"[HistoryAPI] User {current_user.email} (id={current_user.id}) requesting history_id={history_id}."
    )

    record = history_service.get_history_by_id(
        db=db,
        history_id=history_id,
        current_user_id=current_user.id,
    )
    if record is None:
        raise NotFoundException(
            message=f"Bản ghi lịch sử với ID {history_id} không tồn tại.",
            details={"history_id": history_id},
        )

    return ApiResponse(
        data=ProcessingHistoryResponse.model_validate(record),
        message="Lấy thông tin chi tiết lịch sử xử lý thành công.",
    )

