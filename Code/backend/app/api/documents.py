"""
Document Management & Secure File Access Endpoints (PDFL-95, PDFL-98)
----------------------------------------------------------------------
Enforces:
- Strict authentication: only logged-in users can access saved documents.
- Multi-tenant data isolation & Anti-IDOR: Users can only view and download
  their own documents; requests for others' documents return 404 Not Found.
- Admins can access documents for administrative & audit purposes.
"""

import re
from typing import Optional
import unicodedata
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.logger import logger
from app.models.document import Document
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse
from app.schemas.document import DocumentResponse
from app.services.storage_service import StorageService

router = APIRouter(prefix="/api/documents", tags=["Documents"])
storage_service = StorageService()


@router.get("", response_model=ApiResponse[list[DocumentResponse]])
async def list_user_documents(
    user_id: Optional[int] = Query(None, description="Lọc theo User ID (chỉ dành cho ADMIN, người dùng thường bị bỏ qua)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all documents owned by the currently authenticated user.
    Admins can view all system documents or filter by specific user_id.
    Never trusts client-supplied user_id for non-admin callers (Anti-IDOR).
    """
    query = db.query(Document)
    if current_user.role != UserRole.ADMIN:
        # Strictly enforce current authenticated user ID for non-admins
        query = query.filter(Document.user_id == current_user.id)
    elif user_id is not None:
        query = query.filter(Document.user_id == user_id)

    documents = query.order_by(Document.created_at.desc()).all()
    data = [DocumentResponse.model_validate(doc) for doc in documents]
    return ApiResponse(
        data=data,
        message=f"Lấy danh sách {len(data)} tài liệu thành công.",
    )


@router.get("/{document_id}", response_model=ApiResponse[DocumentResponse])
async def get_document_details(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve document metadata by document ID.
    Enforces multi-tenant ownership check to prevent IDOR attacks (PDFL-98).
    """
    query = db.query(Document).filter(Document.id == document_id)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Document.user_id == current_user.id)

    doc = query.first()
    if not doc:
        # Standard OWASP guideline: Return 404 to avoid leaking resource existence
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài liệu không tồn tại hoặc bạn không có quyền truy cập.",
        )

    return ApiResponse(
        data=DocumentResponse.model_validate(doc),
        message="Lấy thông tin tài liệu thành công.",
    )


@router.get("/{document_id}/download")
async def download_document_file(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Securely download physical PDF document file (PDFL-95).
    Verifies ownership (PDFL-98) and guarantees path-traversal prevention.
    """
    query = db.query(Document).filter(Document.id == document_id)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Document.user_id == current_user.id)

    doc = query.first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài liệu không tồn tại hoặc bạn không có quyền truy cập.",
        )

    file_path = storage_service.get_document_path(
        user_id=doc.user_id,
        stored_filename=doc.stored_filename,
    )
    if not file_path or not file_path.is_file():
        logger.error(
            f"[Download] Physical file missing for document_id={document_id}, "
            f"user_id={doc.user_id}, file={doc.stored_filename}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tệp tin vật lý không tồn tại trên hệ thống lưu trữ.",
        )

    encoded_name = quote(doc.original_filename)
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"{encoded_name}\"; filename*=UTF-8''{encoded_name}"
        },
    )


compat_router = APIRouter(prefix="/documents", tags=["Documents Compat"])


@router.get("/{document_id}/file")
@router.get("/{document_id}/preview")
async def preview_document_file(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Securely stream inline PDF document for browser Canvas Preview & Dual/Split View (PDFL-256.2).
    - Returns Content-Type: application/pdf and Content-Disposition: inline.
    - Strict multi-tenant access control: only Owner or Admin can access.
    - Anti-IDOR: Returns 403 Forbidden if user attempts to access another user's document.
    - Path-traversal safe: Resolves storage path solely via storage_service.
    """
    query = db.query(Document).filter(Document.id == document_id)
    doc = query.first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài liệu không tồn tại.",
        )

    if current_user.role != UserRole.ADMIN and doc.user_id != current_user.id:
        logger.warning(
            f"[PDFPreview] Access denied: user_id={current_user.id} attempted to access "
            f"document_id={document_id} owned by user_id={doc.user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập tài liệu này.",
        )

    file_path = storage_service.get_document_path(
        user_id=doc.user_id,
        stored_filename=doc.stored_filename,
    )
    if not file_path or not file_path.is_file():
        logger.error(
            f"[PDFPreview] Physical file missing for document_id={document_id}, "
            f"user_id={doc.user_id}, file={doc.stored_filename}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tệp tin vật lý không tồn tại trên hệ thống lưu trữ.",
        )

    # Sanitize filename against CRLF / Header Injection (RFC 6266 & RFC 5987)
    raw_name = re.sub(r'[\r\n]+', '', doc.original_filename or '').strip() or "document.pdf"
    encoded_name = quote(raw_name)

    normalized = unicodedata.normalize('NFKD', raw_name)
    ascii_clean = normalized.encode('ascii', 'ignore').decode('ascii')
    ascii_clean = re.sub(r'["\\]', '', ascii_clean)
    ascii_clean = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', ascii_clean).strip() or "document.pdf"

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        headers={
            "Content-Type": "application/pdf",
            "Content-Disposition": f'inline; filename="{ascii_clean}"; filename*=UTF-8\'\'{encoded_name}',
            "X-Content-Type-Options": "nosniff",
        },
    )


# Attach routes to compat_router so GET /documents/{document_id}/file works directly
compat_router.add_api_route(
    "/{document_id}/file",
    preview_document_file,
    methods=["GET"],
    summary="Secure Inline PDF Stream Compat Route",
)
compat_router.add_api_route(
    "/{document_id}/preview",
    preview_document_file,
    methods=["GET"],
    summary="Secure Inline PDF Stream Compat Preview Route",
)


@router.delete("/{document_id}", response_model=ApiResponse[dict])
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a document record and its corresponding physical PDF file (PDFL-94.1).
    Enforces ownership / ADMIN permission (Anti-IDOR) and transactional safety
    between database and filesystem storage.
    """
    query = db.query(Document).filter(Document.id == document_id)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Document.user_id == current_user.id)

    doc = query.first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài liệu không tồn tại hoặc bạn không có quyền truy cập.",
        )

    owner_user_id = doc.user_id
    stored_filename = doc.stored_filename
    original_filename = doc.original_filename

    # Read physical file backup before deletion so we can restore if DB commit fails
    file_path = storage_service.get_document_path(
        user_id=owner_user_id,
        stored_filename=stored_filename,
    )
    file_existed = bool(file_path and file_path.is_file())
    file_backup_bytes: bytes | None = None

    if file_existed and file_path is not None:
        try:
            file_backup_bytes = file_path.read_bytes()
        except Exception as e:
            logger.error(
                f"[DeleteDocument] Cannot read physical file prior to deletion "
                f"(document_id={document_id}, file={stored_filename}): {e}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể truy cập tệp tin lưu trữ để xóa tài liệu.",
            ) from e

        deleted_ok = storage_service.delete_document_file(
            user_id=owner_user_id,
            stored_filename=stored_filename,
        )
        if not deleted_ok:
            logger.error(
                f"[DeleteDocument] Storage deletion failed for document_id={document_id}, "
                f"user_id={owner_user_id}, file={stored_filename}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể xóa tệp tin vật lý trên hệ thống lưu trữ.",
            )

    try:
        db.delete(doc)
        db.commit()
    except Exception as e:
        db.rollback()
        # Restore physical file if it was deleted before the DB commit failure
        if file_existed and file_backup_bytes is not None and file_path is not None:
            try:
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_bytes(file_backup_bytes)
                logger.info(
                    f"[DeleteDocument] Restored physical file after DB rollback: {file_path}"
                )
            except Exception as restore_err:
                logger.error(
                    f"[DeleteDocument] Failed to restore physical file {file_path}: {restore_err}"
                )

        logger.error(
            f"[DeleteDocument] Database commit failed for document_id={document_id}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi cơ sở dữ liệu khi xóa tài liệu. Đã hoàn tác thao tác.",
        ) from e

    logger.info(
        f"[DeleteDocument] User {current_user.id} (role={current_user.role}) deleted "
        f"document_id={document_id} (owner={owner_user_id}, file={original_filename!r})"
    )

    return ApiResponse(
        data={
            "id": document_id,
            "original_filename": original_filename,
        },
        message="Xóa tài liệu thành công.",
    )

