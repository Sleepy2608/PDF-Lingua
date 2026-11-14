import asyncio
import io
import json
import os
import re
import tempfile
import threading
import time
import unicodedata
import zipfile
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.dependencies import (
    get_current_user,
    get_db,
    get_max_pages_by_role,
    get_optional_current_user,
    http_bearer,
)
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.logger import logger
from app.models.document import Document
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse
from app.schemas.process import (
    BatchDownloadRequest,
    DownloadRequest,
    ExportTargetType,
    FeedbackRequest,
    JobProgressData,
    ProcessResponseData,
    RetranslateRequest,
)
from app.services.export_service import ExportService
from app.services.job_service import JobStatus, job_manager
from app.services.ocr_service import OCRService
from app.services.pdf_service import PDFService
from app.services.storage_service import StorageService
from app.services.translation_service import TranslationService

router = APIRouter(prefix="/api/process", tags=["Document Processing"])

pdf_service = PDFService()
ocr_service = OCRService()
translation_service = TranslationService()
export_service = ExportService()
storage_service = StorageService()

# Giới hạn số lượng Background Jobs xử lý đồng thời để kiểm soát RAM và CPU (PDFL-111.4.5)
MAX_CONCURRENT_BACKGROUND_JOBS = 4
_job_semaphore = threading.Semaphore(MAX_CONCURRENT_BACKGROUND_JOBS)


def get_user_limits(user: Optional[User]) -> tuple[int, int]:
    """
    Determine (max_upload_size_mb, max_ocr_pages) based on authenticated user role.

    Limits:
    - Guest (None) & Free (UserRole.FREE): 20 MB, 100 pages
    - Pro (UserRole.PRO) & Admin (UserRole.ADMIN): 100 MB, 500 pages
    """
    max_pages = get_max_pages_by_role(user)
    if max_pages >= settings.MAX_PAGES_PRO:
        return settings.MAX_UPLOAD_SIZE_PRO_MB, max_pages
    return settings.MAX_UPLOAD_SIZE_FREE_MB, max_pages


def _execute_pdf_background_job(
    job_id: str,
    tmp_path: Path,
    filename: str,
    target_lang: str,
    max_allowed_pages: int,
    file_size_mb: float,
    user_id: Optional[int] = None,
    file_size_bytes: Optional[int] = None,
    selected_pages: Optional[list[int]] = None,
) -> None:
    """
    Thực thi xử lý PDF trong Background Thread riêng biệt.
    Tận dụng Hybrid Fast Path, Lazy Loading và Parallel Processing.
    Được kiểm soát giới hạn tài nguyên bởi Semaphore (PDFL-111.4.5).
    Nếu người dùng đã đăng nhập (user_id != None), tự động lưu file vật lý
    và bản ghi Document vào cơ sở dữ liệu sau khi dịch thành công (PDFL-90, PDFL-91).
    Hỗ trợ trích xuất theo dải trang chọn lọc selected_pages (PDFL-255.1).
    """
    try:
        start_time = time.time()
        job = job_manager.get_job(job_id)
        if job and getattr(job, "created_at", None):
            try:
                start_time = float(job.created_at)
            except (ValueError, TypeError):
                start_time = time.time()

        acquired = _job_semaphore.acquire(blocking=False)
        if not acquired:
            try:
                job_manager.update_progress(
                    job_id,
                    processed_pages=0,
                    message="Hệ thống đang bận. Đang xếp hàng chờ đến lượt xử lý...",
                    step=1,
                )
            except Exception:
                pass
            _job_semaphore.acquire(blocking=True)

        try:
            validation = pdf_service.validate_pdf(tmp_path)
            if not validation["is_valid"]:
                job_manager.set_failed(job_id, validation["error"] or "Tệp PDF không hợp lệ.")
                return

            page_count = validation["page_count"]
            if page_count <= 0:
                job_manager.set_failed(job_id, "Tài liệu PDF không có trang nào hợp lệ để xử lý.")
                return

            effective_total = len(selected_pages) if selected_pages is not None else page_count

            if effective_total > max_allowed_pages:
                job_manager.set_failed(
                    job_id,
                    f"Tài liệu yêu cầu xử lý {effective_total} trang, vượt quá giới hạn ({max_allowed_pages} trang).",
                )
                return

            job_manager.set_processing(
                job_id,
                total_pages=effective_total,
                message=f"Đang phân tích {effective_total} trang PDF...",
            )

            def on_progress(processed: int, total: int, msg: str) -> None:
                job_manager.update_progress(job_id, processed_pages=processed, total_pages=total, message=msg)

            # Sử dụng Hybrid Fast Path đã tối ưu bộ nhớ và đa luồng với selected_pages
            extract_res = pdf_service.extract_hybrid_fast_path(
                tmp_path,
                ocr_service=ocr_service,
                max_pages=max_allowed_pages,
                progress_callback=on_progress,
                selected_pages=selected_pages,
            )

            original_text = extract_res.get("text", "")
            if not original_text.strip():
                job_manager.set_failed(job_id, "Không thể trích xuất văn bản từ tài liệu này.")
                return

            job_manager.set_translating(job_id, message="Đang dịch thuật văn bản sang ngôn ngữ đích...")
            trans_res = translation_service.translate_text(
                original_text,
                target_lang=target_lang,
                source_lang="auto",
            )

            is_ocr_used = bool(
                extract_res.get("ocr_pages_count", 0) > 0 or extract_res.get("fast_path_used") is False
            )

            document_id: Optional[int] = None
            if user_id is not None:
                db_session = SessionLocal()
                try:
                    raw_bytes = tmp_path.read_bytes()
                    actual_size_bytes = file_size_bytes if file_size_bytes is not None else len(raw_bytes)
                    stored_filename, rel_path, _ = storage_service.save_document_file(
                        user_id=user_id,
                        original_filename=filename,
                        content=raw_bytes,
                    )
                    doc_record = Document(
                        user_id=user_id,
                        original_filename=filename,
                        stored_filename=stored_filename,
                        stored_path=rel_path,
                        file_size_bytes=actual_size_bytes,
                        page_count=effective_total,
                        target_lang=target_lang,
                        is_ocr_used=is_ocr_used,
                    )
                    db_session.add(doc_record)
                    db_session.commit()
                    db_session.refresh(doc_record)
                    document_id = doc_record.id
                    logger.info(
                        f"[Job {job_id}] Saved document id={document_id} for user_id={user_id}"
                    )
                except Exception as persist_err:
                    db_session.rollback()
                    logger.error(
                        f"[Job {job_id}] Failed to persist document record for user_id={user_id}: {persist_err}"
                    )
                finally:
                    db_session.close()

            execution_time_ms = max(1, int((time.time() - start_time) * 1000))

            result_data = {
                "document_id": document_id,
                "filename": filename,
                "page_count": effective_total,
                "file_size_mb": file_size_mb,
                "target_lang": target_lang,
                "is_ocr_used": is_ocr_used,
                "original_text": original_text,
                "translated_text": trans_res["translated_text"],
                "engine_used": trans_res["engine_used"],
                "execution_time_ms": execution_time_ms,
            }

            # Lưu Processing History và kết quả xử lý lâu dài cho người dùng đã đăng nhập (PDFL-165.1, PDFL-169)
            history_id: Optional[int] = None
            if user_id is not None and document_id is not None:
                hist_session = SessionLocal()
                try:
                    from app.models.processing_history import ActionType, ProcessingStatus
                    from app.schemas.processing_history import ProcessingHistoryCreate
                    from app.services.history_service import history_service

                    hist_record = history_service.create_history(
                        hist_session,
                        ProcessingHistoryCreate(
                            user_id=user_id,
                            document_id=document_id,
                            action_type=ActionType.TRANSLATE,
                            status=ProcessingStatus.PENDING,
                            execution_time_ms=execution_time_ms,
                        ),
                        reuse_pending=False,
                    )
                    history_id = hist_record.id
                    history_service.save_history_result(
                        hist_session,
                        history_id=history_id,
                        user_id=user_id,
                        result_data=result_data,
                        execution_time_ms=execution_time_ms,
                    )
                    result_data["history_id"] = history_id
                    logger.info(
                        f"[Job {job_id}] Persisted processing history id={history_id} (duration={execution_time_ms}ms) and result file for user_id={user_id}"
                    )
                except Exception as hist_err:
                    try:
                        hist_session.rollback()
                    except Exception:
                        pass
                    logger.error(
                        f"[Job {job_id}] Failed to persist history record for user_id={user_id}: {hist_err}"
                    )
                finally:
                    hist_session.close()

            job_manager.set_completed(job_id, result=result_data, message="Xử lý và dịch thuật hoàn tất!")

        except Exception as e:
            logger.error(f"[Job {job_id}] Lỗi xử lý nền: {e}")
            job_manager.set_failed(job_id, str(e))
            if user_id is not None and document_id is not None:
                fail_session = SessionLocal()
                try:
                    from app.models.processing_history import ActionType, ProcessingStatus
                    from app.schemas.processing_history import ProcessingHistoryCreate
                    from app.services.history_service import history_service

                    fail_time_ms = max(1, int((time.time() - start_time) * 1000))
                    history_service.create_history(
                        fail_session,
                        ProcessingHistoryCreate(
                            user_id=user_id,
                            document_id=document_id,
                            action_type=ActionType.TRANSLATE,
                            status=ProcessingStatus.FAILED,
                            execution_time_ms=fail_time_ms,
                            error_message=str(e),
                        ),
                        reuse_pending=False,
                    )
                except Exception as fail_hist_err:
                    try:
                        fail_session.rollback()
                    except Exception:
                        pass
                    logger.warning(f"[Job {job_id}] Could not log failed history: {fail_hist_err}")
                finally:
                    fail_session.close()
        finally:
            _job_semaphore.release()

    except Exception as outer_e:
        logger.error(f"[Job {job_id}] Lỗi chuẩn bị hoặc xếp hàng tác vụ: {outer_e}")
        job_manager.set_failed(job_id, str(outer_e))
    finally:
        if tmp_path.exists():
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@router.post("/jobs", response_model=ApiResponse[JobProgressData], status_code=status.HTTP_202_ACCEPTED)
async def create_processing_job(
    file: UploadFile = File(...),
    target_lang: str = Form("vi"),
    pages: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Khởi tạo Background Job xử lý PDF (PDFL-111.4).
    Trả về ngay Job ID mà không giữ kết nối HTTP chờ toàn bộ quá trình OCR.
    Thực thi kiểm tra tính hợp lệ và hạn mức số trang trước khi cấp Job ID (PDFL-178.3).
    Hỗ trợ lựa chọn dải trang pages (PDFL-255.1).
    """
    max_upload_mb, _ = get_user_limits(current_user)
    max_allowed_pages = get_max_pages_by_role(current_user)
    max_bytes = max_upload_mb * 1024 * 1024

    # 1. Kiểm tra filename (PDFL-214.1)
    valid_name, name_err = pdf_service.validate_filename(file.filename)
    if not valid_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=name_err or "Tệp tải lên phải có định dạng .pdf.",
        )

    # 2. Kiểm tra Content-Type (PDFL-214.1)
    valid_ct, ct_err = pdf_service.validate_content_type(file.content_type)
    if not valid_ct:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ct_err or "Content-Type không hợp lệ, yêu cầu application/pdf.",
        )

    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Dung lượng tệp vượt quá giới hạn {max_upload_mb}MB.",
        )

    # 3. Kiểm tra dữ liệu thô: không rỗng và đúng Magic Bytes %PDF-1. (PDFL-214.1)
    valid_raw, raw_err = pdf_service.validate_raw_pdf_content(content)
    if not valid_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=raw_err or "Tệp không phải là tài liệu PDF hợp lệ (sai Magic Bytes).",
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        validation = pdf_service.validate_pdf(tmp_path)
        if not validation["is_valid"]:
            error_msg = validation["error"] or "Tệp PDF không hợp lệ."
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

        page_count = validation["page_count"]
        if page_count <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tài liệu PDF không có trang nào hợp lệ để xử lý.",
            )

        # PDFL-255.1: Parse và validate dải trang nếu được truyền vào
        selected_pages: Optional[list[int]] = None
        if pages is not None and pages.strip() and pages.strip().lower() != "all":
            try:
                selected_pages = pdf_service.parse_page_selection(pages, total_pages=page_count)
            except ValueError as pe:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Dải trang không hợp lệ: {pe}",
                )

        effective_page_count = len(selected_pages) if selected_pages is not None else page_count

        if effective_page_count > max_allowed_pages:
            role_label = (
                "Guest"
                if current_user is None
                else getattr(current_user.role, "value", str(current_user.role)).upper()
            )
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=(
                    f"Tài liệu có {effective_page_count} trang cần xử lý, vượt quá giới hạn {max_allowed_pages} trang của gói {role_label}."
                ),
            )
    except HTTPException:
        if tmp_path.exists():
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        raise
    except Exception as exc:
        if tmp_path.exists():
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        logger.warning(f"Lỗi kiểm tra tệp PDF: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp PDF không hợp lệ hoặc bị lỗi không thể xử lý.",
        )

    authenticated_user_id = current_user.id if current_user is not None else None
    job = job_manager.create_job(
        filename=file.filename,
        target_lang=target_lang,
        user_id=authenticated_user_id,
    )
    file_size_bytes = len(content)
    file_size_mb = round(file_size_bytes / (1024 * 1024), 2)

    # Khởi chạy Worker trong luồng nền độc lập
    thread = threading.Thread(
        target=_execute_pdf_background_job,
        args=(
            job.job_id,
            tmp_path,
            file.filename,
            target_lang,
            max_allowed_pages,
            file_size_mb,
            authenticated_user_id,
            file_size_bytes,
            selected_pages,
        ),
        daemon=True,
    )
    thread.start()

    return ApiResponse(
        data=job.to_dict(),
        message="Tác vụ xử lý tài liệu đã được khởi tạo thành công.",
    )


@router.get("/jobs/{job_id}", response_model=ApiResponse[JobProgressData])
async def get_job_status(job_id: str):
    """Lấy thông tin và trạng thái tiến độ hiện tại của một Job"""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tác vụ.")
    return ApiResponse(data=job.to_dict(), message="Lấy trạng thái tác vụ thành công.")


@router.get("/jobs/{job_id}/events")
async def stream_job_events(job_id: str):
    """
    Server-Sent Events (SSE) stream tiến độ xử lý tài liệu theo thời gian thực (PDFL-111.4).
    Hỗ trợ ngắt kết nối và kết nối lại mà không làm mất trạng thái của Job.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tác vụ.")

    async def event_generator():
        q = job_manager.subscribe(job_id)
        try:
            while True:
                try:
                    data = await asyncio.wait_for(q.get(), timeout=10.0)
                    payload = json.dumps(data, ensure_ascii=False)
                    yield f"data: {payload}\n\n"
                    if data.get("status") in (JobStatus.COMPLETED.value, JobStatus.FAILED.value):
                        break
                except asyncio.TimeoutError:
                    # Gửi heartbeat giữ kết nối
                    yield ": keepalive\n\n"
        finally:
            job_manager.unsubscribe(job_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/upload-and-translate", response_model=ApiResponse[ProcessResponseData])
async def upload_and_translate(
    file: UploadFile = File(...),
    target_lang: str = Form("vi"),
    pages: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    start_time = time.time()
    max_upload_mb, max_ocr_pages = get_user_limits(current_user)
    max_bytes = max_upload_mb * 1024 * 1024

    # 1. Kiểm tra filename (PDFL-214.1)
    valid_name, name_err = pdf_service.validate_filename(file.filename)
    if not valid_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=name_err or "Tệp tải lên phải có định dạng .pdf.",
        )

    # 2. Kiểm tra Content-Type (PDFL-214.1)
    valid_ct, ct_err = pdf_service.validate_content_type(file.content_type)
    if not valid_ct:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ct_err or "Content-Type không hợp lệ, yêu cầu application/pdf.",
        )

    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Dung lượng tệp vượt quá giới hạn {max_upload_mb}MB.",
        )

    # 3. Kiểm tra dữ liệu thô: không rỗng và đúng Magic Bytes %PDF-1. (PDFL-214.1)
    valid_raw, raw_err = pdf_service.validate_raw_pdf_content(content)
    if not valid_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=raw_err or "Tệp không phải là tài liệu PDF hợp lệ (sai Magic Bytes).",
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        validation = pdf_service.validate_pdf(tmp_path)
        if not validation["is_valid"]:
            error_msg = validation["error"] or "Tệp PDF không hợp lệ."
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

        page_count = validation["page_count"]
        if page_count <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tài liệu PDF không có trang nào hợp lệ để xử lý.",
            )

        # PDFL-255.1: Parse và validate dải trang nếu được truyền vào
        selected_pages: Optional[list[int]] = None
        if pages is not None and pages.strip() and pages.strip().lower() != "all":
            try:
                selected_pages = pdf_service.parse_page_selection(pages, total_pages=page_count)
            except ValueError as pe:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Dải trang không hợp lệ: {pe}",
                )

        effective_page_count = len(selected_pages) if selected_pages is not None else page_count

        max_allowed_pages = get_max_pages_by_role(current_user)
        if effective_page_count > max_allowed_pages:
            role_label = (
                "Guest"
                if current_user is None
                else getattr(current_user.role, "value", str(current_user.role)).upper()
            )
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=(
                    f"Tài liệu có {effective_page_count} trang cần xử lý, vượt quá giới hạn {max_allowed_pages} trang của gói {role_label}."
                ),
            )

        is_scanned = pdf_service.is_scanned_pdf(tmp_path, max_pages=max_allowed_pages, selected_pages=selected_pages)
        is_ocr_used = False
        original_text = ""

        if not is_scanned:
            original_text = pdf_service.extract_text(tmp_path, max_pages=max_allowed_pages, selected_pages=selected_pages)

        if not original_text.strip():
            logger.info(f"[Process] Fallback to OCR / Hybrid for scanned document (max_pages={max_allowed_pages}, selected_pages={selected_pages})...")
            hybrid_res = pdf_service.extract_hybrid_fast_path(
                tmp_path,
                ocr_service=ocr_service,
                max_pages=max_allowed_pages,
                selected_pages=selected_pages,
            )
            original_text = hybrid_res.get("text", "")
            is_ocr_used = bool(
                hybrid_res.get("ocr_pages_count", 0) > 0 or hybrid_res.get("fast_path_used") is False
            )

        if not original_text.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Không thể trích xuất văn bản từ tài liệu này (tài liệu rỗng hoặc máy chủ chưa bật OCR).",
            )

        logger.info(
            f"[Upload-and-Translate Request] file={file.filename!r}, target_lang={target_lang!r}, "
            f"pages={pages!r}, text_len={len(original_text)}, text_preview={original_text[:80]!r}"
        )

        translation_result = translation_service.translate_text(
            original_text,
            target_lang=target_lang,
            source_lang="auto",
        )

        logger.info(
            f"[Upload-and-Translate Response] engine={translation_result.get('engine_used')!r}, "
            f"result_preview={translation_result.get('translated_text', '')[:80]!r}"
        )

        execution_time_ms = max(1, int((time.time() - start_time) * 1000))
        document_id: Optional[int] = None
        history_id: Optional[int] = None
        if current_user is not None:
            try:
                stored_filename, rel_path, _ = storage_service.save_document_file(
                    user_id=current_user.id,
                    original_filename=file.filename,
                    content=content,
                )
                doc_record = Document(
                    user_id=current_user.id,
                    original_filename=file.filename,
                    stored_filename=stored_filename,
                    stored_path=rel_path,
                    file_size_bytes=len(content),
                    page_count=effective_page_count,
                    target_lang=target_lang,
                    is_ocr_used=is_ocr_used,
                )
                db.add(doc_record)
                db.commit()
                db.refresh(doc_record)
                document_id = doc_record.id
                logger.info(
                    f"[Process] Saved document id={document_id} for user_id={current_user.id}"
                )

                # Persist processing history & result (PDFL-165.1, PDFL-169)
                try:
                    from app.models.processing_history import ActionType, ProcessingStatus
                    from app.schemas.processing_history import ProcessingHistoryCreate
                    from app.services.history_service import history_service

                    hist_rec = history_service.create_history(
                        db,
                        ProcessingHistoryCreate(
                            user_id=current_user.id,
                            document_id=document_id,
                            action_type=ActionType.TRANSLATE,
                            status=ProcessingStatus.PENDING,
                            execution_time_ms=execution_time_ms,
                        ),
                        reuse_pending=False,
                    )
                    history_id = hist_rec.id
                    history_service.save_history_result(
                        db,
                        history_id=history_id,
                        user_id=current_user.id,
                        result_data={
                            "document_id": document_id,
                            "filename": file.filename,
                            "page_count": effective_page_count,
                            "file_size_mb": round(len(content) / (1024 * 1024), 2),
                            "target_lang": target_lang,
                            "is_ocr_used": is_ocr_used,
                            "original_text": original_text,
                            "translated_text": translation_result["translated_text"],
                            "engine_used": translation_result["engine_used"],
                            "execution_time_ms": execution_time_ms,
                        },
                        execution_time_ms=execution_time_ms,
                    )
                except Exception as hist_err:
                    logger.error(f"[Process] Failed to persist history for user_id={current_user.id}: {hist_err}")
            except Exception as e:
                db.rollback()
                logger.error(
                    f"[Process] Failed to persist document record for user_id={current_user.id}: {e}"
                )

        response_data = ProcessResponseData(
            document_id=document_id,
            history_id=history_id,
            filename=file.filename,
            page_count=effective_page_count,
            file_size_mb=round(len(content) / (1024 * 1024), 2),
            target_lang=target_lang,
            is_ocr_used=is_ocr_used,
            original_text=original_text,
            translated_text=translation_result["translated_text"],
            engine_used=translation_result["engine_used"],
            execution_time_ms=execution_time_ms,
        )

        return ApiResponse(data=response_data, message="Xử lý và dịch thuật tài liệu thành công.")

    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"Lỗi xử lý tệp PDF tải lên: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp PDF không hợp lệ hoặc bị lỗi không thể xử lý.",
        )
    finally:
        if tmp_path.exists():
            try:
                os.remove(tmp_path)
            except Exception:
                pass


compat_router = APIRouter(tags=["Document Processing Compat"])


@compat_router.post("/process", response_model=ApiResponse[ProcessResponseData], include_in_schema=False)
@router.post("", response_model=ApiResponse[ProcessResponseData], include_in_schema=False)
@router.post("/", response_model=ApiResponse[ProcessResponseData], include_in_schema=False)
@router.post("/process", response_model=ApiResponse[ProcessResponseData], include_in_schema=False)
async def process_compatibility_endpoint(
    file: UploadFile = File(...),
    target_lang: str = Form("vi"),
    pages: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """PDFL-255.1: Compatibility endpoint for /process and /api/process."""
    return await upload_and_translate(
        file=file,
        target_lang=target_lang,
        pages=pages,
        current_user=current_user,
        db=db,
    )


@router.post("/retranslate", response_model=ApiResponse[dict])
async def retranslate(
    request: RetranslateRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    if not request.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Văn bản cần dịch không được để trống.",
        )

    logger.info(
        f"[Retranslate Request] target_lang={request.target_lang!r}, source_lang={request.source_lang!r}, "
        f"text_len={len(request.text)}, text_preview={request.text[:80]!r}"
    )

    result = translation_service.translate_text(
        text=request.text,
        target_lang=request.target_lang,
        source_lang=request.source_lang,
    )

    logger.info(
        f"[Retranslate Response] target_lang={result.get('target_lang')!r}, engine={result.get('engine_used')!r}, "
        f"result_preview={result.get('translated_text', '')[:80]!r}"
    )

    return ApiResponse(
        data=result,
        message=f"Dịch lại sang ngôn ngữ '{request.target_lang}' thành công.",
    )


def get_download_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    PDFL-254.1: Xác định người dùng cho endpoint tải tài liệu (/download):
    - Tương thích ngược: Nếu app.dependency_overrides chứa get_current_user hoặc
      get_download_current_user (mock auth trong các test suite), sử dụng override đó.
    - Nếu request có Bearer token: xác thực chặt chẽ qua get_current_user (401 INVALID/EXPIRED, 403 INACTIVE).
    - Nếu không có token: trả về None (Guest).
    """
    if hasattr(request, "app") and getattr(request.app, "dependency_overrides", None):
        overrides = request.app.dependency_overrides
        if get_download_current_user in overrides:
            return overrides[get_download_current_user]()
        if get_current_user in overrides:
            return overrides[get_current_user]()
        if get_optional_current_user in overrides:
            return overrides[get_optional_current_user]()

    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.strip():
        return None

    return get_current_user(request=request, credentials=credentials, db=db)


@router.post("/download")
async def download_result(
    request: DownloadRequest,
    current_user: Optional[User] = Depends(get_download_current_user),
):
    export_type = request.export_type

    content_str = (request.content or "").strip()
    original_str = (request.original_content or "").strip()

    # PDFL-156.1: Kiểm tra nội dung không rỗng theo export_type
    # Xét đầy đủ các trường hợp: None, chuỗi rỗng và chuỗi chỉ chứa whitespace.
    if export_type == ExportTargetType.ORIGINAL:
        original_text = content_str or original_str
        if not original_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nội dung văn bản gốc không được để trống.",
            )
        export_content = original_text

    elif export_type == ExportTargetType.TRANSLATED:
        if not content_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nội dung bản dịch không được để trống.",
            )
        export_content = content_str

    elif export_type == ExportTargetType.SUMMARY:
        if not content_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nội dung tóm tắt không được để trống.",
            )
        export_content = content_str

    elif export_type == ExportTargetType.BILINGUAL:
        if not content_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nội dung bản dịch không được để trống khi xuất song ngữ.",
            )
        if not original_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nội dung văn bản gốc (original_content) không được để trống khi xuất song ngữ.",
            )
        export_content = content_str

    else:
        if not content_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nội dung tệp xuất không được để trống.",
            )
        export_content = content_str

    # Chuẩn hóa tiêu đề mặc định theo loại xuất
    default_titles = {
        ExportTargetType.ORIGINAL: "PDF-Lingua - Văn Bản Gốc",
        ExportTargetType.TRANSLATED: "PDF-Lingua - Bản Dịch",
        ExportTargetType.SUMMARY: "PDF-Lingua - Tóm Tắt Nội Dung",
        ExportTargetType.BILINGUAL: "PDF-Lingua - Bản Dịch Song Ngữ",
    }
    if request.title and request.title.strip() and request.title.strip() != "PDF-Lingua Translation":
        title = request.title.strip()
    elif request.title and request.title.strip() == "PDF-Lingua Translation" and export_type == ExportTargetType.TRANSLATED:
        title = request.title.strip()
    else:
        title = default_titles.get(export_type, "PDF-Lingua Translation")

    # Chuẩn hóa tên file theo loại xuất: original -> _goc, translated -> _dich, summary -> _tomtat, bilingual -> _songngu
    suffix_map = {
        ExportTargetType.ORIGINAL: "_goc",
        ExportTargetType.TRANSLATED: "_dich",
        ExportTargetType.SUMMARY: "_tomtat",
        ExportTargetType.BILINGUAL: "_songngu",
    }
    target_suffix = suffix_map.get(export_type, "_dich")

    # Loại bỏ ký tự CR/LF để chống CRLF Injection trong HTTP Headers
    raw_name_input = re.sub(r'[\r\n]+', '', request.filename or '').strip()
    raw_filename = re.sub(r'[\\/*?:"<>|]', "", raw_name_input).strip() or "document"
    raw_filename = re.sub(r'\.(pdf|txt|docx)$', '', raw_filename, flags=re.IGNORECASE).strip()
    for sfx in ("_goc", "_dich", "_tomtat", "_songngu"):
        if raw_filename.endswith(sfx):
            raw_filename = raw_filename[:-len(sfx)]
            break

    if raw_filename in ("translated_document", "document", ""):
        raw_filename = "document"

    base_name = f"{raw_filename}{target_suffix}"
    fmt = (request.format or "txt").strip().lower()
    if fmt == "docx":
        ext = "docx"
    elif fmt == "pdf":
        ext = "pdf"
    else:
        ext = "txt"

    # PDFL-254.1: Kiểm tra quyền tải file DOCX (chỉ dành riêng cho tài khoản Pro/Admin; Free/Guest trả về HTTP 403)
    if ext == "docx":
        user_role = current_user.role if current_user else None
        is_pro_or_admin = (
            user_role in (UserRole.PRO, UserRole.ADMIN)
            or (isinstance(user_role, str) and user_role.lower() in ("pro", "admin"))
            or getattr(current_user, "is_pro", False)
        )
        if not is_pro_or_admin:
            logger.warning(
                f"[Download] Caller (user_id={getattr(current_user, 'id', None)}, role='{user_role}') denied DOCX export."
            )
            raise ForbiddenException(
                message="Tính năng tải tệp DOCX chỉ dành riêng cho tài khoản Pro.",
                error_code="PRO_REQUIRED",
                details={"upgrade_url": "/#pricingSection"},
            )
    else:
        # Đối với các định dạng khác (txt, pdf): Nếu chưa đăng nhập (Guest không có Bearer token)
        # thì yêu cầu xác thực HTTP 401 theo chuẩn bảo mật hệ thống
        if current_user is None:
            raise UnauthorizedException(
                message="Yêu cầu xác thực. Vui lòng gửi kèm Bearer token.",
                error_code="NOT_AUTHENTICATED",
            )

    try:
        if ext == "pdf":
            file_bytes = export_service.export_to_pdf(
                content=export_content,
                title=title,
                original_content=original_str if export_type == ExportTargetType.BILINGUAL else None,
                export_type=export_type,
            )
            media_type = "application/pdf"
        elif ext == "docx":
            file_bytes = export_service.export_to_docx(
                content=export_content,
                title=title,
                original_content=original_str if export_type == ExportTargetType.BILINGUAL else None,
                export_type=export_type,
            )
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            file_bytes = export_service.export_to_txt(
                content=export_content,
                title=title,
                export_type=export_type,
                original_content=original_str if export_type == ExportTargetType.BILINGUAL else None,
            )
            media_type = "text/plain; charset=utf-8"
    except (ForbiddenException, HTTPException):
        raise
    except Exception as e:
        logger.exception(f"[Download] Export failed unexpectedly: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Đã xảy ra lỗi nội bộ khi tạo tệp xuất. Vui lòng thử lại sau.",
        ) from e

    # Chuẩn hóa tên file theo RFC 6266:
    # 1. UTF-8 filename (hỗ trợ đầy đủ tiếng Việt Unicode)
    download_name = f"{base_name}.{ext}"
    encoded_name = quote(download_name)

    # 2. ASCII fallback filename cho các trình duyệt hoặc client không hỗ trợ filename*
    normalized = unicodedata.normalize('NFKD', base_name)
    ascii_clean = normalized.encode('ascii', 'ignore').decode('ascii')
    # Loại bỏ dấu ngoặc kép, gạch chéo ngược để an toàn trong filename="..."
    ascii_clean = re.sub(r'["\\]', '', ascii_clean)
    # Giữ lại các ký tự ASCII an toàn (chữ cái, chữ số, gạch dưới, gạch ngang, chấm, khoảng trắng)
    ascii_clean = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', ascii_clean).strip()
    if not ascii_clean:
        ascii_clean = f"document{target_suffix}"
    ascii_filename = f"{ascii_clean}.{ext}"

    # Định dạng Content-Disposition có cả ASCII fallback và UTF-8 mở rộng
    content_disposition = f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_name}'

    headers = {
        "Content-Disposition": content_disposition,
        "Cache-Control": "no-cache, no-store, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
    }

    return Response(
        content=file_bytes,
        media_type=media_type,
        headers=headers,
    )


@router.post("/batch-download")
async def batch_download_results(
    request: BatchDownloadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    PDFL-252.2: Tải về trọn bộ file kết quả dịch dưới dạng tệp ZIP nén.
    - Yêu cầu xác thực tài khoản (Bearer Token).
    - Kiểm tra danh sách Job ID / History ID hợp lệ, không rỗng và không trùng lặp (400 Bad Request).
    - Kiểm tra quyền sở hữu (Anti-IDOR): Chỉ cho phép tải file của chính mình hoặc Admin (403/404).
    - Tạo nội dung tài liệu theo định dạng yêu cầu (PDF/TXT/DOCX).
    - Đóng gói file ZIP với cơ chế khử trùng lặp tên file (ví dụ: report (1).pdf).
    - Trả về application/zip với header Content-Disposition phù hợp.
    """
    raw_job_ids = request.job_ids
    raw_hist_ids = request.history_ids

    # 1. Kiểm tra danh sách không được rỗng (PDFL-252.2)
    has_job_ids = raw_job_ids is not None and len(raw_job_ids) > 0
    has_hist_ids = raw_hist_ids is not None and len(raw_hist_ids) > 0

    if not has_job_ids and not has_hist_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Danh sách mã tác vụ (job_ids) hoặc lịch sử (history_ids) không được để trống.",
        )

    if raw_job_ids is not None and len(raw_job_ids) == 0 and not has_hist_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Danh sách job_ids không được để trống.",
        )
    if raw_hist_ids is not None and len(raw_hist_ids) == 0 and not has_job_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Danh sách history_ids không được để trống.",
        )

    # 2. Kiểm tra trùng lặp ID (reject duplicates)
    if raw_job_ids and len(raw_job_ids) != len(set(raw_job_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Danh sách job_ids chứa mã định danh trùng lặp.",
        )
    if raw_hist_ids and len(raw_hist_ids) != len(set(raw_hist_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Danh sách history_ids chứa mã định danh trùng lặp.",
        )

    items_to_package: list[tuple[str, str, bytes]] = []
    is_admin = (current_user.role == UserRole.ADMIN or str(current_user.role).lower() == "admin")

    fmt = (request.format or "pdf").strip().lower()
    export_type = request.export_type or ExportTargetType.TRANSLATED

    # Kiểm tra quyền tải file DOCX (chỉ dành riêng cho Pro/Admin)
    if fmt == "docx":
        user_role = current_user.role
        is_pro_or_admin = (
            user_role in (UserRole.PRO, UserRole.ADMIN)
            or (isinstance(user_role, str) and user_role.lower() in ("pro", "admin"))
            or getattr(current_user, "is_pro", False)
        )
        if not is_pro_or_admin:
            logger.warning(
                f"[BatchDownload] Caller (user_id={current_user.id}, role='{user_role}') denied DOCX batch export."
            )
            raise ForbiddenException(
                message="Tính năng tải tệp DOCX chỉ dành riêng cho tài khoản Pro.",
                error_code="PRO_REQUIRED",
                details={"upgrade_url": "/#pricingSection"},
            )

    # Xử lý theo job_ids
    if raw_job_ids:
        for jid in raw_job_ids:
            job = job_manager.get_job(jid)
            if not job:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Không tìm thấy tác vụ xử lý có mã: {jid}.",
                )
            # Anti-IDOR: chỉ owner hoặc Admin mới được tải
            if not is_admin:
                if job.user_id is None or job.user_id != current_user.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Bạn không có quyền truy cập tác vụ {jid}.",
                    )
            if job.status != JobStatus.COMPLETED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tác vụ {jid} chưa hoàn thành thành công (trạng thái: {job.status.value}).",
                )

            res = job.result or {}
            raw_filename = res.get("filename") or job.filename or "document.pdf"
            translated_text = res.get("translated_text", "")
            original_text = res.get("original_text", "")

            if export_type == ExportTargetType.ORIGINAL:
                content_text = original_text or translated_text
            elif export_type == ExportTargetType.BILINGUAL:
                content_text = translated_text
            else:
                content_text = translated_text or original_text

            if not content_text:
                continue

            clean_stem = Path(raw_filename).stem or "document"
            title = f"PDF-Lingua - {clean_stem}"

            try:
                if fmt == "pdf":
                    file_bytes = export_service.export_to_pdf(
                        content=content_text,
                        title=title,
                        original_content=original_text if export_type == ExportTargetType.BILINGUAL else None,
                        export_type=export_type,
                    )
                    ext = ".pdf"
                elif fmt == "docx":
                    file_bytes = export_service.export_to_docx(
                        content=content_text,
                        title=title,
                        original_content=original_text if export_type == ExportTargetType.BILINGUAL else None,
                        export_type=export_type,
                    )
                    ext = ".docx"
                else:
                    file_bytes = export_service.export_to_txt(
                        content=content_text,
                        title=title,
                        export_type=export_type,
                        original_content=original_text if export_type == ExportTargetType.BILINGUAL else None,
                    )
                    ext = ".txt"
            except Exception as exp_err:
                logger.error(f"[BatchDownload] Export error for job {jid}: {exp_err}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Lỗi khi tạo định dạng xuất cho tác vụ {jid}.",
                ) from exp_err

            items_to_package.append((raw_filename, ext, file_bytes))

    # Xử lý theo history_ids
    if raw_hist_ids:
        from app.models.processing_history import ProcessingHistory, ProcessingStatus

        for hid in raw_hist_ids:
            hist = db.query(ProcessingHistory).filter(ProcessingHistory.id == hid).first()
            if not hist:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Không tìm thấy bản ghi lịch sử xử lý có mã: {hid}.",
                )
            if not is_admin and hist.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Bạn không có quyền truy cập bản ghi lịch sử {hid}.",
                )
            if hist.status != ProcessingStatus.SUCCESS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Bản ghi lịch sử {hid} chưa xử lý thành công.",
                )

            result_dict = None
            if hist.result_path:
                result_dict = storage_service.read_result_file(hist.user_id, hist.result_path)

            raw_filename = (
                (result_dict and result_dict.get("filename"))
                or (hist.document and hist.document.original_filename)
                or f"document_{hid}.pdf"
            )
            translated_text = (result_dict and result_dict.get("translated_text")) or ""
            original_text = (result_dict and result_dict.get("original_text")) or ""

            if export_type == ExportTargetType.ORIGINAL:
                content_text = original_text or translated_text
            elif export_type == ExportTargetType.BILINGUAL:
                content_text = translated_text
            else:
                content_text = translated_text or original_text

            if not content_text:
                continue

            clean_stem = Path(raw_filename).stem or f"document_{hid}"
            title = f"PDF-Lingua - {clean_stem}"

            try:
                if fmt == "pdf":
                    file_bytes = export_service.export_to_pdf(
                        content=content_text,
                        title=title,
                        original_content=original_text if export_type == ExportTargetType.BILINGUAL else None,
                        export_type=export_type,
                    )
                    ext = ".pdf"
                elif fmt == "docx":
                    file_bytes = export_service.export_to_docx(
                        content=content_text,
                        title=title,
                        original_content=original_text if export_type == ExportTargetType.BILINGUAL else None,
                        export_type=export_type,
                    )
                    ext = ".docx"
                else:
                    file_bytes = export_service.export_to_txt(
                        content=content_text,
                        title=title,
                        export_type=export_type,
                        original_content=original_text if export_type == ExportTargetType.BILINGUAL else None,
                    )
                    ext = ".txt"
            except Exception as exp_err:
                logger.error(f"[BatchDownload] Export error for history {hid}: {exp_err}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Lỗi khi tạo định dạng xuất cho bản ghi lịch sử {hid}.",
                ) from exp_err

            items_to_package.append((raw_filename, ext, file_bytes))

    if not items_to_package:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không có nội dung tệp hợp lệ để đóng gói vào tệp ZIP.",
        )

    # Đóng gói ZIP với cơ chế khử trùng lặp tên tệp
    zip_buffer = io.BytesIO()
    used_archive_names: set[str] = set()

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for raw_name, ext, file_data in items_to_package:
            sanitized_basename = os.path.basename(raw_name.replace("\\", "/"))
            stem = re.sub(r'\.(pdf|txt|docx)$', '', sanitized_basename, flags=re.IGNORECASE).strip() or "document"
            stem = re.sub(r'[\\/*?:"<>|]', "", stem).strip() or "document"

            candidate_name = f"{stem}{ext}"
            if candidate_name not in used_archive_names:
                used_archive_names.add(candidate_name)
                final_entry_name = candidate_name
            else:
                counter = 1
                while True:
                    candidate = f"{stem} ({counter}){ext}"
                    if candidate not in used_archive_names:
                        used_archive_names.add(candidate)
                        final_entry_name = candidate
                        break
                    counter += 1

            zf.writestr(final_entry_name, file_data)

    zip_bytes = zip_buffer.getvalue()

    headers = {
        "Content-Disposition": 'attachment; filename="PDFLingua_Batch_Results.zip"',
        "Content-Length": str(len(zip_bytes)),
        "Content-Type": "application/zip",
        "Cache-Control": "no-cache, no-store, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
    }

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers=headers,
    )


@router.post("/feedback", response_model=ApiResponse[dict])
async def submit_feedback(data: FeedbackRequest):
    """Receive and record user feedback or bug report."""
    logger.info(f"[Feedback] Nhận phản hồi từ {data.name} ({data.email}) - Chủ đề: {data.topic}")
    return ApiResponse(
        success=True,
        message="Cảm ơn bạn! Phản hồi đã được ghi nhận và gửi đến nhóm phát triển.",
        data={
            "name": data.name,
            "email": data.email,
            "topic": data.topic,
        },
    )
