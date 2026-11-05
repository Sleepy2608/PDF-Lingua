"""
Admin Service Layer
-------------------
Encapsulates all administrative business logic:
- Metrics aggregation for system overview (PDFL-188)
- Filtered and paginated user directory querying (PDFL-189)
- Account locking / unlocking with safety guardrails (PDFL-194)
- User role transitions with administrator retention guards (PDFL-197)
"""

import math
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.document import Document
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminStatsResponse,
    AdminUserListItem,
    AdminUserListResponse,
)


class AdminService:
    """Service handling administrative dashboard actions and account moderation."""

    @staticmethod
    def get_system_stats(db: Session) -> AdminStatsResponse:
        """
        Aggregate high-level system metrics across users and documents.

        Computes:
        - Total registered users broken down by activation status and role tier.
        - Total documents stored in the system and total disk storage in bytes.
        """
        total_users = db.query(func.count(User.id)).scalar() or 0
        active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
        locked_users = db.query(func.count(User.id)).filter(User.is_active.is_(False)).scalar() or 0

        free_users = db.query(func.count(User.id)).filter(User.role == UserRole.FREE).scalar() or 0
        pro_users = db.query(func.count(User.id)).filter(User.role == UserRole.PRO).scalar() or 0
        admin_users = db.query(func.count(User.id)).filter(User.role == UserRole.ADMIN).scalar() or 0

        total_documents = db.query(func.count(Document.id)).scalar() or 0
        total_storage_bytes = (
            db.query(func.coalesce(func.sum(Document.file_size_bytes), 0)).scalar() or 0
        )

        return AdminStatsResponse(
            total_users=total_users,
            active_users=active_users,
            locked_users=locked_users,
            free_users=free_users,
            pro_users=pro_users,
            admin_users=admin_users,
            total_documents=total_documents,
            total_storage_bytes=int(total_storage_bytes),
        )

    @staticmethod
    def list_users(
        db: Session,
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> AdminUserListResponse:
        """
        Query user accounts with optional filtering, search, and pagination.

        Parameters
        ----------
        db        : Active SQLAlchemy database session.
        page      : Page number (1-indexed).
        limit     : Maximum records to return per page (clamped between 1 and 100).
        search    : Text search filtering on email or full_name.
        role      : Filter by privilege role ('free', 'pro', 'admin' or 'all').
        is_active : Filter by account active status (True, False, or None for all).
        """
        safe_page = max(1, page)
        safe_limit = min(max(1, limit), 100)

        query = db.query(User)

        # Search filter (case-insensitive substring)
        if search and search.strip():
            kw = f"%{search.strip()}%"
            query = query.filter(or_(User.email.ilike(kw), User.full_name.ilike(kw)))

        # Role filter
        if role and role.strip() and role.strip().lower() != "all":
            try:
                role_enum = UserRole(role.strip().lower())
                query = query.filter(User.role == role_enum)
            except ValueError:
                pass  # Ignore invalid role filters

        # Active status filter
        if is_active is not None:
            query = query.filter(User.is_active == is_active)

        total_count = query.count()
        total_pages = max(1, math.ceil(total_count / safe_limit)) if total_count > 0 else 1
        offset = (safe_page - 1) * safe_limit

        users = query.order_by(User.id.desc()).offset(offset).limit(safe_limit).all()

        # Batch query document counts to avoid N+1 queries
        user_ids = [u.id for u in users]
        doc_counts: dict[int, int] = {}
        if user_ids:
            counts_query = (
                db.query(Document.user_id, func.count(Document.id))
                .filter(Document.user_id.in_(user_ids))
                .group_by(Document.user_id)
                .all()
            )
            doc_counts = {uid: count for uid, count in counts_query}

        items = [
            AdminUserListItem(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                document_count=doc_counts.get(u.id, 0),
                created_at=u.created_at,
                updated_at=u.updated_at,
            )
            for u in users
        ]

        return AdminUserListResponse(
            items=items,
            total_count=total_count,
            page=safe_page,
            limit=safe_limit,
            total_pages=total_pages,
        )

    @staticmethod
    def update_user_status(
        db: Session,
        current_admin: User,
        target_user_id: int,
        is_active: bool,
    ) -> User:
        """
        Suspend or reactivate a user account (PDFL-194).

        Enforces safety guardrails:
        - Admin cannot suspend/lock their own account.
        - Raises NotFoundException if the target user does not exist.
        """
        if current_admin.id == target_user_id and not is_active:
            raise BadRequestException(
                message="Quản trị viên không thể tự khóa tài khoản của chính mình.",
                error_code="CANNOT_LOCK_SELF",
            )

        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            raise NotFoundException(
                message=f"Không tìm thấy người dùng với ID {target_user_id}.",
                details={"user_id": target_user_id},
            )

        target_user.is_active = is_active
        db.commit()
        db.refresh(target_user)
        return target_user

    @staticmethod
    def update_user_role(
        db: Session,
        current_admin: User,
        target_user_id: int,
        new_role: UserRole,
    ) -> User:
        """
        Promote or demote a user role (PDFL-197).

        Enforces safety guardrails:
        - Admin cannot demote their own admin role to prevent system lockout.
        - Raises NotFoundException if the target user does not exist.
        """
        if current_admin.id == target_user_id and new_role != UserRole.ADMIN:
            raise BadRequestException(
                message="Quản trị viên không thể tự hạ cấp vai trò của chính mình.",
                error_code="CANNOT_DEMOTE_SELF",
            )

        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            raise NotFoundException(
                message=f"Không tìm thấy người dùng với ID {target_user_id}.",
                details={"user_id": target_user_id},
            )

        target_user.role = new_role
        db.commit()
        db.refresh(target_user)
        return target_user

