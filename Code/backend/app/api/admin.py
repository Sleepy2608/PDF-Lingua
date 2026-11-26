"""
System Administration API Endpoints
---------------------------------------------
Exposes endpoints for system metrics, user directory management,
and account security moderation:
- GET   /api/admin/stats         : System overview statistics
- GET   /api/admin/users         : Paginated & filtered user directory
- PATCH /api/admin/users/{id}/status : Account lock/unlock moderation
- PATCH /api/admin/users/{id}/role   : Privilege tier mutation

Protected by: require_roles(UserRole.ADMIN)
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.logger import logger
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminStatsResponse,
    AdminTransactionListResponse,
    AdminUserListItem,
    AdminUserListResponse,
    UserRoleUpdateRequest,
    UserStatusUpdateRequest,
)
from app.schemas.common import ApiResponse
from app.schemas.pricing import TransactionStatusResponse
from app.services.admin_service import AdminService
from app.services.subscription_service import SubscriptionService

router = APIRouter(
    prefix="/api/admin",
    tags=["Administration"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)


# ── System Overview Stats ─────────────────────────────────────────

@router.get("/stats", response_model=ApiResponse[AdminStatsResponse])
async def get_system_stats(
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Retrieve high-level system overview statistics.
    Available strictly to system administrators.
    """
    logger.info(f"[Admin] Admin {current_admin.email} requested system overview stats.")
    stats = AdminService.get_system_stats(db=db)
    return ApiResponse(
        data=stats,
        message="Lấy dữ liệu thống kê tổng quan hệ thống thành công.",
    )


# ── User Directory & Filtering ─────────────────────────────────────

@router.get("/users", response_model=ApiResponse[AdminUserListResponse])
async def list_users(
    page: int = Query(1, ge=1, description="Page number (1-based index)."),
    limit: int = Query(10, ge=1, le=100, description="Items per page (1 to 100)."),
    search: Optional[str] = Query(None, description="Search term for email or full name."),
    role: Optional[str] = Query(None, description="Filter by role: free | pro | admin | all."),
    is_active: Optional[bool] = Query(None, description="Filter by status: true | false."),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Retrieve paginated user directory with text search and role/status filtering.
    """
    logger.info(
        f"[Admin] Admin {current_admin.email} querying user directory "
        f"(page={page}, limit={limit}, search={search}, role={role}, is_active={is_active})."
    )
    result = AdminService.list_users(
        db=db,
        page=page,
        limit=limit,
        search=search,
        role=role,
        is_active=is_active,
    )
    return ApiResponse(
        data=result,
        message=f"Lấy danh sách người dùng thành công (Trang {result.page}/{result.total_pages}).",
    )


# ── Account Lock / Unlock ──────────────────────────────────────────

@router.patch("/users/{user_id}/status", response_model=ApiResponse[AdminUserListItem])
async def update_user_status(
    user_id: int,
    body: UserStatusUpdateRequest,
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Suspend or reactivate a user account.
    Enforces that an administrator cannot lock their own account.
    """
    logger.info(
        f"[Admin] Admin {current_admin.email} modifying status of user ID {user_id} "
        f"to is_active={body.is_active}."
    )
    updated_user = AdminService.update_user_status(
        db=db,
        current_admin=current_admin,
        target_user_id=user_id,
        is_active=body.is_active,
    )
    status_label = "mở khóa" if body.is_active else "khóa"
    item = AdminUserListItem(
        id=updated_user.id,
        email=updated_user.email,
        full_name=updated_user.full_name,
        role=updated_user.role,
        is_active=updated_user.is_active,
        document_count=len(updated_user.documents),
        created_at=updated_user.created_at,
        updated_at=updated_user.updated_at,
    )
    return ApiResponse(
        data=item,
        message=f"Đã {status_label} tài khoản {updated_user.email} thành công.",
    )


# ── User Role Elevation / Demotion ─────────────────────────────────

@router.patch("/users/{user_id}/role", response_model=ApiResponse[AdminUserListItem])
async def update_user_role(
    user_id: int,
    body: UserRoleUpdateRequest,
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Promote or demote a user role (free, pro, admin).
    Enforces that an administrator cannot demote their own account.
    """
    logger.info(
        f"[Admin] Admin {current_admin.email} changing role of user ID {user_id} "
        f"to {body.role.value}."
    )
    updated_user = AdminService.update_user_role(
        db=db,
        current_admin=current_admin,
        target_user_id=user_id,
        new_role=body.role,
    )
    item = AdminUserListItem(
        id=updated_user.id,
        email=updated_user.email,
        full_name=updated_user.full_name,
        role=updated_user.role,
        is_active=updated_user.is_active,
        document_count=len(updated_user.documents),
        created_at=updated_user.created_at,
        updated_at=updated_user.updated_at,
    )
    return ApiResponse(
        data=item,
        message=f"Đã cập nhật vai trò của tài khoản {updated_user.email} thành {body.role.value.upper()}.",
    )


# ── Payment & VietQR Transaction Management ───────────────────────

@router.get("/transactions", response_model=ApiResponse[AdminTransactionListResponse])
async def list_transactions(
    page: int = Query(1, ge=1, description="Page number (1-based index)."),
    limit: int = Query(10, ge=1, le=100, description="Items per page (1 to 100)."),
    search: Optional[str] = Query(None, description="Search by transaction code, note, or user email."),
    status: Optional[str] = Query(None, description="Filter by status: pending | completed | failed | expired | all."),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Retrieve paginated payment transactions across all users for administrative review.
    """
    logger.info(
        f"[Admin] Admin {current_admin.email} querying transactions "
        f"(page={page}, limit={limit}, search={search}, status={status})."
    )
    result = AdminService.list_transactions(
        db=db,
        page=page,
        limit=limit,
        search=search,
        status=status,
    )
    return ApiResponse(
        data=result,
        message=f"Lấy danh sách giao dịch thành công ({result.total_count} giao dịch).",
    )


@router.post("/transactions/{transaction_code}/approve", response_model=ApiResponse[TransactionStatusResponse])
async def approve_transaction(
    transaction_code: str,
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Approve a pending VietQR payment transaction and activate the user's Pro subscription.
    """
    logger.info(f"[Admin] Admin {current_admin.email} approving transaction {transaction_code}.")
    result = SubscriptionService.confirm_transaction_payment(
        db=db,
        transaction_code=transaction_code,
        acting_user=current_admin,
    )
    return ApiResponse(
        data=result,
        message=f"Đã duyệt giao dịch {transaction_code} và kích hoạt gói Pro thành công.",
    )


@router.post("/transactions/{transaction_code}/reject", response_model=ApiResponse[dict])
async def reject_transaction(
    transaction_code: str,
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Reject/cancel a pending VietQR payment transaction.
    """
    logger.info(f"[Admin] Admin {current_admin.email} rejecting transaction {transaction_code}.")
    tx = AdminService.reject_transaction(db=db, transaction_code=transaction_code)
    return ApiResponse(
        data={"transaction_code": tx.transaction_code, "payment_status": tx.payment_status},
        message=f"Đã từ chối giao dịch {tx.transaction_code}.",
    )

