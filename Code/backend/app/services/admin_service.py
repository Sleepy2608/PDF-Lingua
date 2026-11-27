"""
Admin Service Layer
-------------------
Encapsulates all administrative business logic:
- Metrics aggregation for system overview
- Filtered and paginated user directory querying
- Account locking / unlocking with safety guardrails
- User role transitions with administrator retention guards
"""

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.access_log import UserAccessLog
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.models.subscription import (
    PaymentStatus,
    PaymentTransaction,
    PricingPlan,
    Subscription,
    SubscriptionStatus,
)
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminAccessLogItem,
    AdminAccessLogListResponse,
    AdminAccessTrafficSummary,
    AdminServiceUsageStats,
    AdminStatsResponse,
    AdminTrafficDayPoint,
    AdminTransactionItem,
    AdminTransactionListResponse,
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

        service_counts = (
            db.query(ProcessingHistory.action_type, func.count(ProcessingHistory.id))
            .filter(ProcessingHistory.status == ProcessingStatus.SUCCESS)
            .group_by(ProcessingHistory.action_type)
            .all()
        )

        counts_map: dict[str, int] = {}
        for action, count in service_counts:
            key = action.value if hasattr(action, "value") else str(action)
            counts_map[key] = int(count)

        extract_count = counts_map.get(ActionType.EXTRACT.value, 0)
        translate_count = counts_map.get(ActionType.TRANSLATE.value, 0)
        summarize_count = counts_map.get(ActionType.SUMMARIZE.value, 0)
        chat_count = counts_map.get(ActionType.CHAT.value, 0)
        total_actions = extract_count + translate_count + summarize_count + chat_count

        services_stats = AdminServiceUsageStats(
            extract_count=extract_count,
            translate_count=translate_count,
            summarize_count=summarize_count,
            chat_count=chat_count,
            total_actions=total_actions,
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
            services=services_stats,
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

        # Batch query document counts and access log summaries to avoid N+1 queries
        user_ids = [u.id for u in users]
        doc_counts: dict[int, int] = {}
        latest_access_map: dict[int, UserAccessLog] = {}
        distinct_ip_24h_map: dict[int, int] = {}

        if user_ids:
            counts_query = (
                db.query(Document.user_id, func.count(Document.id))
                .filter(Document.user_id.in_(user_ids))
                .group_by(Document.user_id)
                .all()
            )
            doc_counts = {uid: count for uid, count in counts_query}

            # Latest access log per user
            recent_logs = (
                db.query(UserAccessLog)
                .filter(UserAccessLog.user_id.in_(user_ids))
                .order_by(UserAccessLog.created_at.desc(), UserAccessLog.id.desc())
                .all()
            )
            for log in recent_logs:
                if log.user_id not in latest_access_map:
                    latest_access_map[log.user_id] = log

            # Distinct IP count in last 24 hours per user
            since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
            ip_counts_query = (
                db.query(
                    UserAccessLog.user_id,
                    func.count(func.distinct(UserAccessLog.ip_address)),
                )
                .filter(
                    UserAccessLog.user_id.in_(user_ids),
                    UserAccessLog.created_at >= since_24h,
                )
                .group_by(UserAccessLog.user_id)
                .all()
            )
            distinct_ip_24h_map = {uid: int(cnt) for uid, cnt in ip_counts_query}

        items = []
        for u in users:
            last_log = latest_access_map.get(u.id)
            ip_cnt = distinct_ip_24h_map.get(u.id, 0)
            items.append(
                AdminUserListItem(
                    id=u.id,
                    email=u.email,
                    full_name=u.full_name,
                    role=u.role,
                    is_active=u.is_active,
                    document_count=doc_counts.get(u.id, 0),
                    last_ip=last_log.ip_address if last_log else None,
                    last_device=last_log.device_summary if last_log else None,
                    last_login_at=last_log.created_at if last_log else None,
                    distinct_ip_count_24h=ip_cnt,
                    multi_ip_warning=(ip_cnt >= 3),
                    created_at=u.created_at,
                    updated_at=u.updated_at,
                )
            )

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
        Suspend or reactivate a user account.

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
        Promote or demote a user role.

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

    # ── Payment & VietQR Transactions ──────────────────────────────────

    @staticmethod
    def _format_vnd(amount: int) -> str:
        return f"{amount:,}".replace(",", ".") + "đ"

    @staticmethod
    def list_transactions(
        db: Session,
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
    ) -> AdminTransactionListResponse:
        """Query all payment transactions with optional status filter, search, and revenue totals."""
        safe_page = max(1, page)
        safe_limit = min(max(1, limit), 100)

        # Global revenue & status counters
        total_revenue_vnd = (
            db.query(func.coalesce(func.sum(PaymentTransaction.amount_vnd), 0))
            .filter(PaymentTransaction.payment_status == PaymentStatus.COMPLETED.value)
            .scalar()
            or 0
        )
        pending_count = (
            db.query(func.count(PaymentTransaction.id))
            .filter(PaymentTransaction.payment_status == PaymentStatus.PENDING.value)
            .scalar()
            or 0
        )
        completed_count = (
            db.query(func.count(PaymentTransaction.id))
            .filter(PaymentTransaction.payment_status == PaymentStatus.COMPLETED.value)
            .scalar()
            or 0
        )

        query = db.query(PaymentTransaction).join(User, PaymentTransaction.user_id == User.id)

        if status and status.strip().lower() not in ("all", ""):
            query = query.filter(PaymentTransaction.payment_status == status.strip().lower())

        if search and search.strip():
            kw = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    PaymentTransaction.transaction_code.ilike(kw),
                    PaymentTransaction.payment_note.ilike(kw),
                    User.email.ilike(kw),
                    User.full_name.ilike(kw),
                )
            )

        total_count = query.count()
        total_pages = max(1, math.ceil(total_count / safe_limit))
        offset = (safe_page - 1) * safe_limit

        records = (
            query.order_by(PaymentTransaction.created_at.desc())
            .offset(offset)
            .limit(safe_limit)
            .all()
        )

        items: list[AdminTransactionItem] = []
        for tx in records:
            user = tx.user or db.query(User).filter(User.id == tx.user_id).first()
            plan = tx.plan or db.query(PricingPlan).filter(PricingPlan.id == tx.plan_id).first()
            items.append(
                AdminTransactionItem(
                    id=tx.id,
                    transaction_code=tx.transaction_code,
                    user_id=tx.user_id,
                    user_email=user.email if user else f"user-{tx.user_id}",
                    user_name=user.full_name if user else None,
                    plan_code=plan.code if plan else "pro_monthly",
                    plan_name=plan.name if plan else "Gói Pro VIP",
                    amount_vnd=tx.amount_vnd,
                    amount_display=AdminService._format_vnd(tx.amount_vnd),
                    payment_method=tx.payment_method,
                    payment_status=tx.payment_status,
                    payment_note=tx.payment_note,
                    paid_at=tx.paid_at,
                    created_at=tx.created_at,
                )
            )

        return AdminTransactionListResponse(
            items=items,
            total_count=total_count,
            page=safe_page,
            limit=safe_limit,
            total_pages=total_pages,
            total_revenue_vnd=int(total_revenue_vnd),
            total_revenue_display=AdminService._format_vnd(int(total_revenue_vnd)),
            pending_count=int(pending_count),
            completed_count=int(completed_count),
        )

    @staticmethod
    def reject_transaction(
        db: Session,
        transaction_code: str,
    ) -> PaymentTransaction:
        """Mark a pending payment transaction as failed/rejected."""
        code = (transaction_code or "").strip()
        tx = (
            db.query(PaymentTransaction)
            .filter(PaymentTransaction.transaction_code == code)
            .first()
        )
        if not tx:
            raise NotFoundException(
                message=f"Không tìm thấy giao dịch '{code}'.",
                details={"transaction_code": code},
            )
        if tx.payment_status != PaymentStatus.PENDING.value:
            raise BadRequestException(
                message=f"Chỉ có thể từ chối giao dịch đang ở trạng thái chờ duyệt (hiện tại: {tx.payment_status}).",
                error_code="INVALID_TRANSACTION_STATE",
            )
        tx.payment_status = PaymentStatus.FAILED.value
        now = datetime.now(timezone.utc)
        tx.updated_at = now

        db.commit()
        db.refresh(tx)
        return tx

    # ── User Access & IP Audit Logs ────────────────────────────────────

    @staticmethod
    def _build_access_traffic_summary(db: Session, window_days: int = 14) -> AdminAccessTrafficSummary:
        """
        Compute a continuous daily traffic time series for the last `window_days` days.
        Each unique IP address counts once per day (daily unique_visitors) and once
        across the entire window (overall unique_visitors), matching GitHub Traffic semantics.
        """
        today_utc = datetime.now(timezone.utc).date()
        start_date = today_utc - timedelta(days=window_days - 1)
        start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)

        rows = (
            db.query(UserAccessLog.created_at, UserAccessLog.ip_address)
            .filter(UserAccessLog.created_at >= start_dt)
            .all()
        )

        daily_counts: dict[str, int] = {}
        daily_ips: dict[str, set[str]] = {}
        overall_ips: set[str] = set()
        total_visits = 0

        for created_at, ip_address in rows:
            if created_at is None:
                continue
            dt_utc = (
                created_at.replace(tzinfo=timezone.utc)
                if created_at.tzinfo is None
                else created_at.astimezone(timezone.utc)
            )
            day_key = dt_utc.date().isoformat()
            if dt_utc.date() < start_date:
                continue
            total_visits += 1
            daily_counts[day_key] = daily_counts.get(day_key, 0) + 1
            clean_ip = (ip_address or "").strip()
            if clean_ip:
                overall_ips.add(clean_ip)
                daily_ips.setdefault(day_key, set()).add(clean_ip)

        daily_points: list[AdminTrafficDayPoint] = []
        for offset in range(window_days):
            day_key = (start_date + timedelta(days=offset)).isoformat()
            daily_points.append(
                AdminTrafficDayPoint(
                    date=day_key,
                    total_visits=daily_counts.get(day_key, 0),
                    unique_visitors=len(daily_ips.get(day_key, ())),
                )
            )

        return AdminAccessTrafficSummary(
            window_days=window_days,
            total_visits=total_visits,
            unique_visitors=len(overall_ips),
            daily=daily_points,
        )

    @staticmethod
    def list_access_logs(
        db: Session,
        page: int = 1,
        limit: int = 15,
        search: Optional[str] = None,
        user_id: Optional[int] = None,
        multi_ip_only: bool = False,
    ) -> AdminAccessLogListResponse:
        """
        Query paginated user access logs (IP, device, action, timestamp)
        along with 24-hour system-wide distinct IP, multi-IP anomaly summaries,
        and 14-day GitHub-Traffic-style daily visit and unique-IP metrics.
        """
        safe_page = max(1, page)
        safe_limit = min(max(1, limit), 100)
        now_utc = datetime.now(timezone.utc)
        since_24h = now_utc - timedelta(hours=24)
        traffic_summary = AdminService._build_access_traffic_summary(db=db, window_days=14)

        unique_ips_24h = (
            db.query(func.count(func.distinct(UserAccessLog.ip_address)))
            .filter(UserAccessLog.created_at >= since_24h)
            .scalar()
            or 0
        )

        # Find user IDs with >= 3 distinct IPs in last 24h
        multi_ip_rows = (
            db.query(UserAccessLog.user_id)
            .filter(UserAccessLog.created_at >= since_24h)
            .group_by(UserAccessLog.user_id)
            .having(func.count(func.distinct(UserAccessLog.ip_address)) >= 3)
            .all()
        )
        multi_ip_user_ids = [row[0] for row in multi_ip_rows]

        query = db.query(UserAccessLog).join(User, UserAccessLog.user_id == User.id)

        if user_id is not None:
            query = query.filter(UserAccessLog.user_id == user_id)

        if multi_ip_only:
            if not multi_ip_user_ids:
                return AdminAccessLogListResponse(
                    items=[],
                    total_count=0,
                    page=safe_page,
                    limit=safe_limit,
                    total_pages=1,
                    unique_ips_24h=int(unique_ips_24h),
                    multi_ip_users_count=0,
                    traffic=traffic_summary,
                )
            query = query.filter(UserAccessLog.user_id.in_(multi_ip_user_ids))

        if search and search.strip():
            kw = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    User.email.ilike(kw),
                    User.full_name.ilike(kw),
                    UserAccessLog.ip_address.ilike(kw),
                    UserAccessLog.device_summary.ilike(kw),
                )
            )

        total_count = query.count()
        total_pages = max(1, math.ceil(total_count / safe_limit)) if total_count > 0 else 1
        offset = (safe_page - 1) * safe_limit

        records = (
            query.order_by(UserAccessLog.created_at.desc(), UserAccessLog.id.desc())
            .offset(offset)
            .limit(safe_limit)
            .all()
        )

        items: list[AdminAccessLogItem] = []
        for log in records:
            u = log.user or db.query(User).filter(User.id == log.user_id).first()
            items.append(
                AdminAccessLogItem(
                    id=log.id,
                    user_id=log.user_id,
                    user_email=u.email if u else f"user-{log.user_id}",
                    user_name=u.full_name if u else None,
                    user_role=u.role if u else UserRole.FREE,
                    ip_address=log.ip_address,
                    device_summary=log.device_summary,
                    user_agent=log.user_agent,
                    action=log.action,
                    created_at=log.created_at,
                )
            )

        return AdminAccessLogListResponse(
            items=items,
            total_count=total_count,
            page=safe_page,
            limit=safe_limit,
            total_pages=total_pages,
            unique_ips_24h=int(unique_ips_24h),
            multi_ip_users_count=len(multi_ip_user_ids),
            traffic=traffic_summary,
        )

