"""
Document Management & Secure File Access Endpoints (PDFL-95, PDFL-98)
----------------------------------------------------------------------
Enforces:
- Strict authentication: only logged-in users can access saved documents.
- Multi-tenant data isolation & Anti-IDOR: Users can only view and download
  their own documents; requests for others' documents return 404 Not Found.
- Admins can access documents for administrative & audit purposes.
"""

from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all documents owned by the currently authenticated user.
    Admins can view all system documents.
    """
    query = db.query(Document)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Document.user_id == current_user.id)

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

