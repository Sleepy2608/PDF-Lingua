"""
System Administration API Endpoints (EPIC 14)
---------------------------------------------
Exposes endpoints for system metrics, user directory management,
and account security moderation:
- GET   /api/admin/stats         : System overview statistics (PDFL-188)
- GET   /api/admin/users         : Paginated & filtered user directory (PDFL-189)
- PATCH /api/admin/users/{id}/status : Account lock/unlock moderation (PDFL-194)
- PATCH /api/admin/users/{id}/role   : Privilege tier mutation (PDFL-197)

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
    AdminUserListItem,
    AdminUserListResponse,
    UserRoleUpdateRequest,
    UserStatusUpdateRequest,
)
from app.schemas.common import ApiResponse
from app.services.admin_service import AdminService

router = APIRouter(
    prefix="/api/admin",
    tags=["Administration"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)


# ── System Overview Stats (PDFL-188) ─────────────────────────────────────────

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


# ── User Directory & Filtering (PDFL-189) ─────────────────────────────────────

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


# ── Account Lock / Unlock (PDFL-194) ──────────────────────────────────────────

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


# ── User Role Elevation / Demotion (PDFL-197) ─────────────────────────────────

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

