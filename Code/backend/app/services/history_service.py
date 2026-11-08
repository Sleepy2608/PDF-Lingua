"""
Processing History Service Layer
--------------------------------
Encapsulates business operations for tracking, querying, and managing
document processing histories (PDFL-159.3):
- Persistence and state transitions (PENDING -> SUCCESS | FAILED).
- Execution timing and sanitized error logging.
- Strict multi-tenant data ownership verification (Anti-IDOR).
- Transaction safety with automatic rollback on database errors.
"""

import time
from datetime import datetime, timezone
from typing import Callable, Optional, TypeVar

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.core.logger import logger
from app.models.document import Document
from app.models.processing_history import ActionType, ProcessingHistory, ProcessingStatus
from app.schemas.processing_history import (
    ProcessingHistoryCreate,
    ProcessingHistoryUpdate,
    sanitize_error_message,
)
from app.services.storage_service import StorageService

T = TypeVar("T")


class HistoryService:
    """Service handling ProcessingHistory persistence, lifecycle, and access control."""

    storage_service = StorageService()

    @staticmethod
    def verify_document_ownership(
        db: Session,
        document_id: int,
        user_id: int,
    ) -> Document:
        """
        Verify that `document_id` exists and is owned by `user_id`.

        Raises
        ------
        NotFoundException : If document with `document_id` does not exist.
        ForbiddenException: If document is owned by a different user.
        """
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc is None:
            raise NotFoundException(
                message=f"Tài liệu id={document_id} không tồn tại.",
                details={"document_id": document_id},
            )
        if doc.user_id != user_id:
            raise ForbiddenException(
                message=f"Người dùng id={user_id} không có quyền truy cập tài liệu id={document_id}.",
                details={"document_id": document_id, "user_id": user_id},
            )
        return doc

    @classmethod
    def create_history(
        cls,
        db: Session,
        data: ProcessingHistoryCreate,
        current_user_id: Optional[int] = None,
        *,
        reuse_pending: bool = True,
    ) -> ProcessingHistory:
        """
        Create a new ProcessingHistory record with strict ownership validation.

        Parameters
        ----------
        db              : Active database session.
        data            : Validated creation payload.
        current_user_id : ID of the authenticated user performing this action.
        reuse_pending   : If True, reuses an existing in-flight PENDING record
                          for the same (user_id, document_id, action_type).
        """
        if current_user_id is not None and current_user_id != data.user_id:
            raise ForbiddenException(
                message="Bạn không có quyền tạo bản ghi lịch sử cho người dùng khác.",
                details={"requested_user_id": data.user_id, "current_user_id": current_user_id},
            )

        try:
            # Enforce that the target document belongs to the requesting user
            cls.verify_document_ownership(db, document_id=data.document_id, user_id=data.user_id)

            if reuse_pending and data.status == ProcessingStatus.PENDING:
                existing_pending = (
                    db.query(ProcessingHistory)
                    .filter(
                        ProcessingHistory.user_id == data.user_id,
                        ProcessingHistory.document_id == data.document_id,
                        ProcessingHistory.action_type == data.action_type,
                        ProcessingHistory.status == ProcessingStatus.PENDING,
                    )
                    .order_by(ProcessingHistory.id.desc())
                    .first()
                )
                if existing_pending is not None:
                    return existing_pending

            record = ProcessingHistory(
                user_id=data.user_id,
                document_id=data.document_id,
                action_type=data.action_type,
                status=data.status,
                execution_time_ms=data.execution_time_ms,
                error_message=data.error_message,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            return record
        except SQLAlchemyError as exc:
            db.rollback()
            logger.error(f"[HistoryService] DB error creating history record: {exc}")
            raise

    @classmethod
    def update_status(
        cls,
        db: Session,
        history_id: int,
        status: ProcessingStatus | str,
        execution_time_ms: Optional[int] = None,
        error_message: Optional[str] = None,
        current_user_id: Optional[int] = None,
    ) -> ProcessingHistory:
        """
        Update the status, execution duration, and error message of a history entry.

        Validates status transitions and ownership before persisting.
        """
        try:
            record = (
                db.query(ProcessingHistory)
                .filter(ProcessingHistory.id == history_id)
                .first()
            )
            if record is None:
                raise NotFoundException(
                    message=f"Bản ghi lịch sử xử lý id={history_id} không tồn tại.",
                    details={"history_id": history_id},
                )

            if current_user_id is not None and record.user_id != current_user_id:
                raise ForbiddenException(
                    message="Bạn không có quyền cập nhật bản ghi lịch sử của người dùng khác.",
                    details={"history_id": history_id, "owner_id": record.user_id},
                )

            update_payload = ProcessingHistoryUpdate(
                status=status,
                execution_time_ms=execution_time_ms,
                error_message=error_message,
            )

            record.status = update_payload.status
            if update_payload.execution_time_ms is not None:
                record.execution_time_ms = update_payload.execution_time_ms
            record.error_message = update_payload.error_message
            record.updated_at = datetime.now(timezone.utc)

            db.commit()
            db.refresh(record)
            return record
        except SQLAlchemyError as exc:
            db.rollback()
            logger.error(f"[HistoryService] DB error updating history_id={history_id}: {exc}")
            raise

    @classmethod
    def mark_success(
        cls,
        db: Session,
        history_id: int,
        execution_time_ms: Optional[int] = None,
        current_user_id: Optional[int] = None,
    ) -> ProcessingHistory:
        """Transition a history record to SUCCESS and clear any prior error message."""
        return cls.update_status(
            db=db,
            history_id=history_id,
            status=ProcessingStatus.SUCCESS,
            execution_time_ms=execution_time_ms,
            error_message=None,
            current_user_id=current_user_id,
        )

    @classmethod
    def mark_failed(
        cls,
        db: Session,
        history_id: int,
        error_message: str,
        execution_time_ms: Optional[int] = None,
        current_user_id: Optional[int] = None,
    ) -> ProcessingHistory:
        """Transition a history record to FAILED with a sanitized error message."""
        cleaned = sanitize_error_message(error_message) or "Thao tác xử lý tài liệu thất bại."
        return cls.update_status(
            db=db,
            history_id=history_id,
            status=ProcessingStatus.FAILED,
            execution_time_ms=execution_time_ms,
            error_message=cleaned,
            current_user_id=current_user_id,
        )

    # ── Result Persistence & Retrieval (PDFL-165.1) ──────────────────────────

    @classmethod
    def save_history_result(
        cls,
        db: Session,
        history_id: int,
        user_id: int,
        result_data: dict,
        execution_time_ms: Optional[int] = None,
    ) -> ProcessingHistory:
        """
        Persist result data as a JSON file and link it to the ProcessingHistory record (PDFL-165.1).
        Transitions status to SUCCESS and updates execution_time_ms if provided.
        """
        try:
            record = (
                db.query(ProcessingHistory)
                .options(joinedload(ProcessingHistory.document))
                .filter(ProcessingHistory.id == history_id)
                .first()
            )
            if record is None:
                raise NotFoundException(
                    message=f"Bản ghi lịch sử xử lý id={history_id} không tồn tại.",
                    details={"history_id": history_id},
                )
            if record.user_id != user_id:
                raise ForbiddenException(
                    message="Bạn không có quyền lưu kết quả cho bản ghi lịch sử của người dùng khác.",
                    details={"history_id": history_id, "user_id": user_id, "owner_id": record.user_id},
                )

            enriched_result = {
                "history_id": history_id,
                "document_id": record.document_id,
                "document_filename": record.document_filename or (record.document.original_filename if record.document else None),
                "action_type": record.action_type.value if hasattr(record.action_type, "value") else str(record.action_type),
                **result_data,
            }

            rel_path, _ = cls.storage_service.save_result_file(
                user_id=user_id,
                history_id=history_id,
                result_data=enriched_result,
            )

            record.result_path = rel_path
            record.status = ProcessingStatus.SUCCESS
            record.error_message = None
            if execution_time_ms is not None and execution_time_ms >= 0:
                record.execution_time_ms = execution_time_ms
            record.updated_at = datetime.now(timezone.utc)

            db.commit()
            db.refresh(record)
            return record
        except SQLAlchemyError as exc:
            db.rollback()
            logger.error(f"[HistoryService] DB error saving result for history_id={history_id}: {exc}")
            raise

    @classmethod
    def get_history_result(
        cls,
        db: Session,
        history_id: int,
        current_user_id: int,
    ) -> dict:
        """
        Retrieve persisted result data for a specific ProcessingHistory record (PDFL-165.1).
        Enforces strict multi-tenant ownership verification (Anti-IDOR).
        Validates status and file existence.
        """
        try:
            record = (
                db.query(ProcessingHistory)
                .options(joinedload(ProcessingHistory.document))
                .filter(ProcessingHistory.id == history_id)
                .first()
            )
        except SQLAlchemyError as exc:
            db.rollback()
            logger.error(f"[HistoryService] DB error querying history_id={history_id}: {exc}")
            raise

        if record is None or record.user_id != current_user_id:
            raise NotFoundException(
                message=f"Bản ghi lịch sử với ID {history_id} không tồn tại.",
                details={"history_id": history_id},
            )

        if record.status == ProcessingStatus.PENDING:
            raise BadRequestException(
                message="Bản ghi lịch sử đang trong quá trình xử lý, chưa có kết quả.",
                error_code="RESULT_PENDING",
                details={"history_id": history_id, "status": record.status.value},
            )

        if record.status == ProcessingStatus.FAILED:
            raise BadRequestException(
                message="Bản ghi lịch sử xử lý thất bại, không có kết quả hợp lệ.",
                error_code="RESULT_FAILED",
                details={
                    "history_id": history_id,
                    "status": record.status.value,
                    "error_message": record.error_message,
                },
            )

        if not record.result_path:
            raise NotFoundException(
                message="Bản ghi lịch sử chưa có dữ liệu kết quả được lưu trữ.",
                details={"history_id": history_id, "error_code": "RESULT_NOT_FOUND"},
            )

        result_data = cls.storage_service.read_result_file(
            user_id=record.user_id,
            result_path_or_filename=record.result_path,
        )

        if result_data is None:
            raise NotFoundException(
                message="Dữ liệu kết quả không tồn tại trên hệ thống lưu trữ hoặc đã bị xóa.",
                details={"history_id": history_id, "result_path": record.result_path, "error_code": "RESULT_FILE_MISSING"},
            )

        result_data.setdefault("history_id", record.id)
        result_data.setdefault("document_id", record.document_id)
        result_data.setdefault("document_filename", record.document_filename or (record.document.original_filename if record.document else None))
        result_data.setdefault("action_type", record.action_type.value if hasattr(record.action_type, "value") else str(record.action_type))
        result_data.setdefault("created_at", record.created_at)

        return result_data

    @staticmethod
    def get_history_by_id(
        db: Session,
        history_id: int,
        current_user_id: Optional[int] = None,
    ) -> Optional[ProcessingHistory]:
        """
        Query a single history record by ID.
        Raises NotFoundException if the record does not exist or if requested by an unauthorized user
        (enforcing Anti-IDOR by not leaking resource existence).
        """
        try:
            record = (
                db.query(ProcessingHistory)
                .options(joinedload(ProcessingHistory.document))
                .filter(ProcessingHistory.id == history_id)
                .first()
            )
        except SQLAlchemyError as exc:
            db.rollback()
            logger.error(f"[HistoryService] DB error querying history_id={history_id}: {exc}")
            raise

        if record is None or (current_user_id is not None and record.user_id != current_user_id):
            raise NotFoundException(
                message=f"Bản ghi lịch sử với ID {history_id} không tồn tại.",
                details={"history_id": history_id},
            )
        return record

    @classmethod
    def get_histories_by_user(
        cls,
        db: Session,
        user_id: int,
        current_user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
        action_type: Optional[ActionType | str] = None,
        status: Optional[ProcessingStatus | str] = None,
        document_id: Optional[int] = None,
    ) -> list[ProcessingHistory]:
        """
        Query paginated processing history for a specific user.
        Enforces tenant isolation by checking `current_user_id == user_id`
        and verifying `document_id` ownership when filtered by document.
        """
        if current_user_id is not None and current_user_id != user_id:
            raise ForbiddenException(
                message="Bạn không có quyền truy cập lịch sử của người dùng khác.",
                details={"target_user_id": user_id, "current_user_id": current_user_id},
            )

        if document_id is not None and document_id <= 0:
            raise BadRequestException(
                message="document_id phải là số nguyên dương (> 0).",
                error_code="INVALID_DOCUMENT_ID",
                details={"document_id": document_id},
            )

        norm_action: Optional[ActionType] = None
        if action_type is not None:
            if isinstance(action_type, str):
                try:
                    norm_action = ActionType(action_type.strip().upper())
                except ValueError as exc:
                    allowed = ", ".join(item.value for item in ActionType)
                    raise BadRequestException(
                        message=f"action_type không hợp lệ '{action_type}'. Giá trị hợp lệ: {allowed}.",
                        error_code="INVALID_ACTION_TYPE",
                        details={"allowed": [item.value for item in ActionType], "provided": action_type},
                    ) from exc
            else:
                norm_action = action_type

        norm_status: Optional[ProcessingStatus] = None
        if status is not None:
            if isinstance(status, str):
                try:
                    norm_status = ProcessingStatus(status.strip().upper())
                except ValueError as exc:
                    allowed = ", ".join(item.value for item in ProcessingStatus)
                    raise BadRequestException(
                        message=f"status không hợp lệ '{status}'. Giá trị hợp lệ: {allowed}.",
                        error_code="INVALID_PROCESSING_STATUS",
                        details={"allowed": [item.value for item in ProcessingStatus], "provided": status},
                    ) from exc
            else:
                norm_status = status

        safe_skip = max(0, skip)
        safe_limit = max(1, min(limit, 100))

        try:
            if document_id is not None:
                cls.verify_document_ownership(db, document_id=document_id, user_id=user_id)

            query = (
                db.query(ProcessingHistory)
                .options(joinedload(ProcessingHistory.document))
                .filter(ProcessingHistory.user_id == user_id)
            )

            if document_id is not None:
                query = query.filter(ProcessingHistory.document_id == document_id)

            if norm_action is not None:
                query = query.filter(ProcessingHistory.action_type == norm_action)

            if norm_status is not None:
                query = query.filter(ProcessingHistory.status == norm_status)

            return (
                query.order_by(ProcessingHistory.created_at.desc(), ProcessingHistory.id.desc())
                .offset(safe_skip)
                .limit(safe_limit)
                .all()
            )
        except SQLAlchemyError as exc:
            db.rollback()
            logger.error(f"[HistoryService] DB error querying histories for user_id={user_id}: {exc}")
            raise

    @classmethod
    def get_histories_by_document(
        cls,
        db: Session,
        document_id: int,
        current_user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[ProcessingHistory]:
        """
        Query paginated processing history for a specific document.
        First verifies document ownership if `current_user_id` is supplied.
        """
        safe_skip = max(0, skip)
        safe_limit = max(1, min(limit, 100))

        try:
            if current_user_id is not None:
                cls.verify_document_ownership(db, document_id=document_id, user_id=current_user_id)
            else:
                doc = db.query(Document).filter(Document.id == document_id).first()
                if doc is None:
                    raise NotFoundException(
                        message=f"Tài liệu id={document_id} không tồn tại.",
                        details={"document_id": document_id},
                    )

            return (
                db.query(ProcessingHistory)
                .options(joinedload(ProcessingHistory.document))
                .filter(ProcessingHistory.document_id == document_id)
                .order_by(ProcessingHistory.created_at.desc(), ProcessingHistory.id.desc())
                .offset(safe_skip)
                .limit(safe_limit)
                .all()
            )
        except SQLAlchemyError as exc:
            db.rollback()
            logger.error(f"[HistoryService] DB error querying histories for document_id={document_id}: {exc}")
            raise

    @staticmethod
    def count_histories_by_user(
        db: Session,
        user_id: int,
        current_user_id: Optional[int] = None,
    ) -> int:
        """Count total processing histories for a given user."""
        if current_user_id is not None and current_user_id != user_id:
            raise ForbiddenException(
                message="Bạn không có quyền truy cập lịch sử của người dùng khác.",
                details={"target_user_id": user_id, "current_user_id": current_user_id},
            )
        try:
            return (
                db.query(ProcessingHistory)
                .filter(ProcessingHistory.user_id == user_id)
                .count()
            )
        except SQLAlchemyError as exc:
            db.rollback()
            logger.error(f"[HistoryService] DB error counting histories for user_id={user_id}: {exc}")
            raise

    # ── Workflow Automation & Fault Isolation (PDFL-160.1) ───────────────────

    @classmethod
    def safe_start_action(
        cls,
        db: Optional[Session],
        user_id: Optional[int],
        document_id: Optional[int],
        action_type: ActionType | str,
    ) -> Optional[ProcessingHistory]:
        """
        Safely create (or reuse) a PENDING history record for a workflow step.
        Returns None without raising if user is unauthenticated (guest) or if any DB error occurs.
        """
        if db is None or user_id is None or document_id is None:
            return None
        try:
            create_payload = ProcessingHistoryCreate(
                user_id=user_id,
                document_id=document_id,
                action_type=action_type,
                status=ProcessingStatus.PENDING,
            )
            return cls.create_history(db, create_payload, reuse_pending=True)
        except Exception as exc:
            try:
                db.rollback()
            except Exception:
                pass
            logger.error(
                f"[HistoryService] Failed to start history for user_id={user_id}, "
                f"document_id={document_id}, action={action_type}: {exc}"
            )
            return None

    @classmethod
    def safe_complete_action(
        cls,
        db: Optional[Session],
        history_id: Optional[int],
        execution_time_ms: Optional[int] = None,
        *,
        user_id: Optional[int] = None,
    ) -> Optional[ProcessingHistory]:
        """
        Safely mark a history record as SUCCESS without interrupting document processing
        if a database error occurs.
        """
        if db is None or history_id is None:
            return None
        try:
            safe_ms = max(0, int(execution_time_ms)) if execution_time_ms is not None else 0
            return cls.mark_success(db, history_id, execution_time_ms=safe_ms, current_user_id=user_id)
        except Exception as exc:
            try:
                db.rollback()
            except Exception:
                pass
            logger.error(
                f"[HistoryService] Failed to mark history_id={history_id} as SUCCESS: {exc}"
            )
            return None

    @classmethod
    def safe_fail_action(
        cls,
        db: Optional[Session],
        history_id: Optional[int],
        error_message: str,
        execution_time_ms: Optional[int] = None,
        *,
        user_id: Optional[int] = None,
    ) -> Optional[ProcessingHistory]:
        """
        Safely mark a history record as FAILED without masking or altering the
        caller's original processing error.
        """
        if db is None or history_id is None:
            return None
        try:
            safe_ms = max(0, int(execution_time_ms)) if execution_time_ms is not None else 0
            return cls.mark_failed(
                db,
                history_id,
                error_message=error_message,
                execution_time_ms=safe_ms,
                current_user_id=user_id,
            )
        except Exception as exc:
            try:
                db.rollback()
            except Exception:
                pass
            logger.error(
                f"[HistoryService] Failed to mark history_id={history_id} as FAILED: {exc}"
            )
            return None

    @classmethod
    def execute_tracked_action(
        cls,
        db: Optional[Session],
        user_id: Optional[int],
        document_id: Optional[int],
        action_type: ActionType | str,
        operation: Callable[[], T],
    ) -> T:
        """
        Execute a document processing step (`EXTRACT`, `TRANSLATE`, or `SUMMARIZE`)
        while automatically managing its ProcessingHistory lifecycle:
        - Records `PENDING` before execution (if authenticated and `document_id` is valid).
        - Measures `execution_time_ms` using monotonic performance counter.
        - Updates status to `SUCCESS` on normal completion.
        - Updates status to `FAILED` with sanitized `error_message` if `operation` raises,
          then re-raises the original exception untouched.
        - Any internal history logging error is isolated and never alters `operation` output.
        """
        history_record = cls.safe_start_action(
            db=db,
            user_id=user_id,
            document_id=document_id,
            action_type=action_type,
        )
        history_id = history_record.id if history_record is not None else None
        start_perf = time.perf_counter()

        try:
            result = operation()
        except Exception as exc:
            elapsed_ms = max(0, int((time.perf_counter() - start_perf) * 1000))
            err_detail = getattr(exc, "detail", None) or str(exc) or exc.__class__.__name__
            cls.safe_fail_action(
                db=db,
                history_id=history_id,
                error_message=str(err_detail),
                execution_time_ms=elapsed_ms,
                user_id=user_id,
            )
            raise

        elapsed_ms = max(0, int((time.perf_counter() - start_perf) * 1000))
        cls.safe_complete_action(
            db=db,
            history_id=history_id,
            execution_time_ms=elapsed_ms,
            user_id=user_id,
        )
        return result


history_service = HistoryService()

