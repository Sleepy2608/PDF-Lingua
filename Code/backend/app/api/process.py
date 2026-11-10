import asyncio
import json
import os
import re
import tempfile
import threading
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.dependencies import get_db, get_max_pages_by_role, get_optional_current_user
from app.core.logger import logger
from app.models.document import Document
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse
from app.schemas.process import (
    DownloadRequest,
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
) -> None:
    """
    Thực thi xử lý PDF trong Background Thread riêng biệt.
    Tận dụng Hybrid Fast Path, Lazy Loading và Parallel Processing.
    Được kiểm soát giới hạn tài nguyên bởi Semaphore (PDFL-111.4.5).
    Nếu người dùng đã đăng nhập (user_id != None), tự động lưu file vật lý
    và bản ghi Document vào cơ sở dữ liệu sau khi dịch thành công (PDFL-90, PDFL-91).
    """
    try:
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

            if page_count > max_allowed_pages:
                job_manager.set_failed(
                    job_id,
                    f"Tài liệu có {page_count} trang, vượt quá giới hạn ({max_allowed_pages} trang).",
                )
                return

            job_manager.set_processing(
                job_id,
                total_pages=page_count,
                message=f"Đang phân tích {page_count} trang PDF...",
            )

            def on_progress(processed: int, total: int, msg: str) -> None:
                job_manager.update_progress(job_id, processed_pages=processed, total_pages=total, message=msg)

            # Sử dụng Hybrid Fast Path đã tối ưu bộ nhớ và đa luồng
            extract_res = pdf_service.extract_hybrid_fast_path(
                tmp_path,
                ocr_service=ocr_service,
                max_pages=max_allowed_pages,
                progress_callback=on_progress,
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
                        page_count=page_count,
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

            result_data = {
                "document_id": document_id,
                "filename": filename,
                "page_count": page_count,
                "file_size_mb": file_size_mb,
                "target_lang": target_lang,
                "is_ocr_used": is_ocr_used,
                "original_text": original_text,
                "translated_text": trans_res["translated_text"],
                "engine_used": trans_res["engine_used"],
            }

            # Lưu Processing History và kết quả xử lý lâu dài cho người dùng đã đăng nhập (PDFL-165.1)
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
                        ),
                        reuse_pending=False,
                    )
                    history_id = hist_record.id
                    history_service.save_history_result(
                        hist_session,
                        history_id=history_id,
                        user_id=user_id,
                        result_data=result_data,
                    )
                    result_data["history_id"] = history_id
                    logger.info(
                        f"[Job {job_id}] Persisted processing history id={history_id} and result file for user_id={user_id}"
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
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Khởi tạo Background Job xử lý PDF (PDFL-111.4).
    Trả về ngay Job ID mà không giữ kết nối HTTP chờ toàn bộ quá trình OCR.
    Thực thi kiểm tra tính hợp lệ và hạn mức số trang trước khi cấp Job ID (PDFL-178.3).
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

        if page_count > max_allowed_pages:
            role_label = (
                "Guest"
                if current_user is None
                else getattr(current_user.role, "value", str(current_user.role)).upper()
            )
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=(
                    f"Tài liệu có {page_count} trang, vượt quá giới hạn {max_allowed_pages} trang của gói {role_label}."
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

    job = job_manager.create_job(filename=file.filename, target_lang=target_lang)
    file_size_bytes = len(content)
    file_size_mb = round(file_size_bytes / (1024 * 1024), 2)
    authenticated_user_id = current_user.id if current_user is not None else None

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
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
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

        max_allowed_pages = get_max_pages_by_role(current_user)
        if page_count > max_allowed_pages:
            role_label = (
                "Guest"
                if current_user is None
                else getattr(current_user.role, "value", str(current_user.role)).upper()
            )
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=(
                    f"Tài liệu có {page_count} trang, vượt quá giới hạn {max_allowed_pages} trang của gói {role_label}."
                ),
            )

        is_scanned = pdf_service.is_scanned_pdf(tmp_path, max_pages=max_allowed_pages)
        is_ocr_used = False
        original_text = ""

        if not is_scanned:
            original_text = pdf_service.extract_text(tmp_path, max_pages=max_allowed_pages)

        if not original_text.strip():
            is_ocr_used = True
            logger.info(f"[Process] Fallback to OCR for scanned document (max_pages={max_allowed_pages})...")
            ocr_res = ocr_service.extract_text_from_scanned_pdf(
                tmp_path,
                max_pages=max_allowed_pages,
            )
            original_text = ocr_res.get("text", "")

        if not original_text.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Không thể trích xuất văn bản từ tài liệu này (tài liệu rỗng hoặc máy chủ chưa bật OCR).",
            )

        logger.info(
            f"[Upload-and-Translate Request] file={file.filename!r}, target_lang={target_lang!r}, "
            f"text_len={len(original_text)}, text_preview={original_text[:80]!r}"
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
                    page_count=page_count,
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

                # Persist processing history & result (PDFL-165.1)
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
                            "page_count": page_count,
                            "file_size_mb": round(len(content) / (1024 * 1024), 2),
                            "target_lang": target_lang,
                            "is_ocr_used": is_ocr_used,
                            "original_text": original_text,
                            "translated_text": translation_result["translated_text"],
                            "engine_used": translation_result["engine_used"],
                        },
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
            page_count=page_count,
            file_size_mb=round(len(content) / (1024 * 1024), 2),
            target_lang=target_lang,
            is_ocr_used=is_ocr_used,
            original_text=original_text,
            translated_text=translation_result["translated_text"],
            engine_used=translation_result["engine_used"],
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


@router.post("/download")
async def download_result(
    request: DownloadRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    if not request.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nội dung tệp xuất không được để trống.",
        )

    safe_name = storage_service.sanitize_filename(request.filename or "translated_document")
    stem = safe_name[:-4] if safe_name.lower().endswith(".pdf") else safe_name
    base_name = stem.strip(" ._") or "translated_document"
    fmt = request.format.strip().lower()

    if fmt == "pdf":
        file_bytes = export_service.export_to_pdf(
            content=request.content,
            title=request.title or "PDF-Lingua Translation",
            original_content=request.original_content,
        )
        media_type = "application/pdf"
        download_name = f"{base_name}.pdf"
    else:
        file_bytes = export_service.export_to_txt(
            content=request.content,
            title=request.title,
        )
        media_type = "text/plain; charset=utf-8"
        download_name = f"{base_name}.txt"

    encoded_name = quote(download_name)
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}",
        "Access-Control-Expose-Headers": "Content-Disposition",
    }

    return Response(
        content=file_bytes,
        media_type=media_type,
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
