import os
import re
import tempfile
from pathlib import Path
from urllib.parse import quote
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status

from app.core.config import settings
from app.core.logger import logger
from app.schemas.common import ApiResponse
from app.schemas.process import DownloadRequest, FeedbackRequest, ProcessResponseData, RetranslateRequest
from app.services.export_service import ExportService
from app.services.ocr_service import OCRService
from app.services.pdf_service import PDFService
from app.services.translation_service import TranslationService

router = APIRouter(prefix="/api/process", tags=["Document Processing"])

pdf_service = PDFService()
ocr_service = OCRService()
translation_service = TranslationService()
export_service = ExportService()

MAX_BYTES = settings.MAX_UPLOAD_SIZE_FREE_MB * 1024 * 1024


@router.post("/upload-and-translate", response_model=ApiResponse[ProcessResponseData])
async def upload_and_translate(
    file: UploadFile = File(...),
    target_lang: str = Form("vi"),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp tải lên phải có định dạng .pdf.",
        )

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Dung lượng tệp vượt quá giới hạn {settings.MAX_UPLOAD_SIZE_FREE_MB}MB.",
        )

    if not content.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp không phải là tài liệu PDF hợp lệ (sai Magic Bytes).",
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

        max_allowed_pages = settings.MAX_PAGES_FREE
        if page_count > max_allowed_pages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Tài liệu có {page_count} trang, vượt quá giới hạn của gói Miễn phí "
                    f"(tối đa {max_allowed_pages} trang/tệp). Vui lòng nâng cấp gói Pro hoặc chia nhỏ tài liệu."
                ),
            )

        is_scanned = pdf_service.is_scanned_pdf(tmp_path, max_pages=max_allowed_pages)
        is_ocr_used = False
        original_text = ""

        if not is_scanned:
            original_text = pdf_service.extract_text(tmp_path, max_pages=max_allowed_pages)

        if not original_text.strip():
            is_ocr_used = True
            logger.info("[Process] Fallback to OCR for scanned document...")
            ocr_res = ocr_service.extract_text_from_scanned_pdf(
                tmp_path,
                max_pages=max_allowed_pages,
            )
            original_text = ocr_res.get("text", "")

        if not original_text.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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

        response_data = ProcessResponseData(
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

    finally:
        if tmp_path.exists():
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@router.post("/retranslate", response_model=ApiResponse[dict])
async def retranslate(request: RetranslateRequest):
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
async def download_result(request: DownloadRequest):
    if not request.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nội dung tệp xuất không được để trống.",
        )

    base_name = re.sub(r'[\\/*?:"<>|]', "", request.filename.strip()) or "translated_document"
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
