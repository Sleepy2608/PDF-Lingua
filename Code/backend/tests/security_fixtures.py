"""
Security Test Fixtures and Security Test Matrix (PDFL-185.1)
------------------------------------------------------------
Provides reusable test fixtures, factory generators, and test matrix definitions for:
1. Roles: Guest, FREE, PRO, ADMIN, and multi-tenant isolation pairs.
2. PDF Types:
   - Valid PDFs with arbitrary page counts (1, 100, 101, 500, 501, etc.).
   - Empty (0-byte) PDFs.
   - Corrupted PDFs (broken catalog / xref / trailer).
   - Password-protected encrypted PDFs.
   - Non-PDF files disguised as .pdf (TXT, EXE, PNG).
3. Security Test Matrix definitions:
   - Role vs Page Limits.
   - Role vs File Size Limits.
   - Upload Validation.
   - Path Traversal Protection.
   - IDOR & Document Ownership.
   - Authentication & Role Spoofing.
"""

from dataclasses import dataclass
import io
from pathlib import Path
from typing import Any, Callable, NamedTuple, Optional

import pypdf
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.user import User, UserRole


# ── 1. Reusable User & Authentication Fixtures ───────────────────────────────

@dataclass
class AuthUserFixture:
    """Encapsulates a test user, their raw JWT token, authorization headers, and role."""

    user: User
    token: str
    headers: dict[str, str]
    role: UserRole

    @property
    def id(self) -> int:
        return self.user.id

    @property
    def email(self) -> str:
        return self.user.email


def create_test_user_with_role(
    db: Session,
    email: str,
    role: UserRole,
    full_name: Optional[str] = None,
    password: str = "TestPassword123",
    is_active: bool = True,
) -> AuthUserFixture:
    """
    Creates a user in the provided DB session and generates their valid JWT Bearer header.
    Can be used directly in unit tests or via pytest fixtures.
    """
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name or f"Test User {role.value.upper()}",
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id)
    headers = {"Authorization": f"Bearer {token}"}
    return AuthUserFixture(user=user, token=token, headers=headers, role=role)


# ── 2. Reusable PDF Generators ───────────────────────────────────────────────

def create_custom_page_pdf_bytes(
    page_count: int = 1,
    text_prefix: str = "Tài liệu văn bản kỹ thuật số hợp lệ phục vụ kiểm thử bảo mật trang",
) -> bytes:
    """
    Generates a valid, standards-compliant %PDF-1.4 binary file with exact `page_count`
    and embedded text on each page (> 50 chars to be recognized as digital PDF).
    """
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    safe_count = max(1, page_count)
    for i in range(safe_count):
        c.drawString(50, 700, f"{text_prefix} {i + 1}. Nội dung tài liệu đầy đủ.")
        c.showPage()
    c.save()
    return buf.getvalue()


def create_empty_pdf_bytes() -> bytes:
    """Returns an empty 0-byte file payload."""
    return b""


def create_corrupted_pdf_bytes() -> bytes:
    """
    Returns bytes starting with valid PDF magic bytes (%PDF-1.4)
    but containing corrupted internal structures and invalid xref/trailer.
    """
    return b"%PDF-1.4\n%corrupted_body_without_valid_trailer_or_xref\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"


def create_password_protected_pdf_bytes(
    password: str = "SecretPassword123",
    page_count: int = 1,
) -> bytes:
    """Generates a password-encrypted PDF file."""
    writer = pypdf.PdfWriter()
    for _ in range(max(1, page_count)):
        writer.add_blank_page(width=612, height=792)
    writer.encrypt(password)

    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def create_fake_pdf_bytes(file_type: str = "exe") -> bytes:
    """
    Generates non-PDF file contents intended to be disguised with a .pdf extension:
    - 'exe': Windows Portable Executable (starts with 'MZ')
    - 'txt': Plain ASCII text
    - 'png': PNG image magic bytes
    - 'zip': PKZIP archive magic bytes
    """
    ft = file_type.lower().strip()
    if ft == "exe":
        return b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00\xb8\x00\x00\x00"
    elif ft == "png":
        return b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
    elif ft == "zip":
        return b"PK\x03\x04\x14\x00\x00\x00\x08\x00FakeZipArchiveContent"
    else:
        return b"This is plain text disguised with a .pdf extension. Not a real PDF."


# ── 3. Security Test Matrix Definitions ──────────────────────────────────────

class PageLimitTestCase(NamedTuple):
    role_label: str
    role_enum: Optional[UserRole]
    page_count: int
    expected_allowed: bool
    expected_status: int
    description: str


class SizeLimitTestCase(NamedTuple):
    role_label: str
    role_enum: Optional[UserRole]
    expected_mb: int
    description: str


class UploadValidationTestCase(NamedTuple):
    case_name: str
    filename: str
    content_type: str
    content_generator: Callable[[], bytes]
    expected_status: int
    error_keyword: str


class PathTraversalTestCase(NamedTuple):
    filename_vector: str
    description: str
    expected_safe: bool


class IdorOwnershipTestCase(NamedTuple):
    endpoint_template: str
    method: str
    description: str


# Matrix 1: Role vs Page Limits (PDFL-178 Standardized Policy)
ROLE_PAGE_LIMIT_MATRIX: list[PageLimitTestCase] = [
    # GUEST (None): Limit 100 pages
    PageLimitTestCase(
        role_label="GUEST",
        role_enum=None,
        page_count=100,
        expected_allowed=True,
        expected_status=200,
        description="Guest exactly 100 pages is accepted",
    ),
    PageLimitTestCase(
        role_label="GUEST",
        role_enum=None,
        page_count=101,
        expected_allowed=False,
        expected_status=413,
        description="Guest 101 pages exceeds limit and is rejected",
    ),
    # FREE: Limit 100 pages
    PageLimitTestCase(
        role_label="FREE",
        role_enum=UserRole.FREE,
        page_count=100,
        expected_allowed=True,
        expected_status=200,
        description="FREE user exactly 100 pages is accepted",
    ),
    PageLimitTestCase(
        role_label="FREE",
        role_enum=UserRole.FREE,
        page_count=101,
        expected_allowed=False,
        expected_status=413,
        description="FREE user 101 pages exceeds limit and is rejected",
    ),
    # PRO: Limit 500 pages
    PageLimitTestCase(
        role_label="PRO",
        role_enum=UserRole.PRO,
        page_count=500,
        expected_allowed=True,
        expected_status=200,
        description="PRO user exactly 500 pages is accepted",
    ),
    PageLimitTestCase(
        role_label="PRO",
        role_enum=UserRole.PRO,
        page_count=501,
        expected_allowed=False,
        expected_status=413,
        description="PRO user 501 pages exceeds limit and is rejected",
    ),
    # ADMIN: Limit 500 pages
    PageLimitTestCase(
        role_label="ADMIN",
        role_enum=UserRole.ADMIN,
        page_count=500,
        expected_allowed=True,
        expected_status=200,
        description="ADMIN user exactly 500 pages is accepted",
    ),
    PageLimitTestCase(
        role_label="ADMIN",
        role_enum=UserRole.ADMIN,
        page_count=501,
        expected_allowed=False,
        expected_status=413,
        description="ADMIN user 501 pages exceeds limit and is rejected",
    ),
]


# Matrix 2: Role vs File Size Limits (PDFL-81 Policy)
ROLE_SIZE_LIMIT_MATRIX: list[SizeLimitTestCase] = [
    SizeLimitTestCase("GUEST", None, 20, "Guest has 20MB upload limit"),
    SizeLimitTestCase("FREE", UserRole.FREE, 20, "FREE user has 20MB upload limit"),
    SizeLimitTestCase("PRO", UserRole.PRO, 100, "PRO user has 100MB upload limit"),
    SizeLimitTestCase("ADMIN", UserRole.ADMIN, 100, "ADMIN user has 100MB upload limit"),
]


# Matrix 3: Upload Validation Hardening (PDFL-214.1)
UPLOAD_VALIDATION_MATRIX: list[UploadValidationTestCase] = [
    UploadValidationTestCase(
        case_name="valid_pdf",
        filename="document.pdf",
        content_type="application/pdf",
        content_generator=lambda: create_custom_page_pdf_bytes(1),
        expected_status=200,
        error_keyword="",
    ),
    UploadValidationTestCase(
        case_name="empty_file",
        filename="empty.pdf",
        content_type="application/pdf",
        content_generator=create_empty_pdf_bytes,
        expected_status=400,
        error_keyword="rỗng",
    ),
    UploadValidationTestCase(
        case_name="corrupted_pdf",
        filename="corrupted.pdf",
        content_type="application/pdf",
        content_generator=create_corrupted_pdf_bytes,
        expected_status=400,
        error_keyword="Lỗi đọc tệp PDF",
    ),
    UploadValidationTestCase(
        case_name="password_encrypted_pdf",
        filename="protected.pdf",
        content_type="application/pdf",
        content_generator=lambda: create_password_protected_pdf_bytes("pwd123"),
        expected_status=400,
        error_keyword="mật khẩu bảo vệ",
    ),
    UploadValidationTestCase(
        case_name="fake_pdf_exe",
        filename="executable.pdf",
        content_type="application/pdf",
        content_generator=lambda: create_fake_pdf_bytes("exe"),
        expected_status=400,
        error_keyword="Magic Bytes",
    ),
    UploadValidationTestCase(
        case_name="fake_pdf_txt",
        filename="plaintext.pdf",
        content_type="application/pdf",
        content_generator=lambda: create_fake_pdf_bytes("txt"),
        expected_status=400,
        error_keyword="Magic Bytes",
    ),
    UploadValidationTestCase(
        case_name="fake_pdf_png",
        filename="image.pdf",
        content_type="application/pdf",
        content_generator=lambda: create_fake_pdf_bytes("png"),
        expected_status=400,
        error_keyword="Magic Bytes",
    ),
    UploadValidationTestCase(
        case_name="double_extension_exe_pdf",
        filename="exploit.exe.pdf",
        content_type="application/pdf",
        content_generator=lambda: create_custom_page_pdf_bytes(1),
        expected_status=400,
        error_keyword="double extension",
    ),
    UploadValidationTestCase(
        case_name="double_extension_php_pdf",
        filename="shell.php.pdf",
        content_type="application/pdf",
        content_generator=lambda: create_custom_page_pdf_bytes(1),
        expected_status=400,
        error_keyword="double extension",
    ),
    UploadValidationTestCase(
        case_name="null_byte_filename",
        filename="document\x00.pdf",
        content_type="application/pdf",
        content_generator=lambda: create_custom_page_pdf_bytes(1),
        expected_status=400,
        error_keyword="null byte",
    ),
]


# Matrix 4: Path Traversal Vectors (PDFL-214.2)
PATH_TRAVERSAL_MATRIX: list[PathTraversalTestCase] = [
    PathTraversalTestCase("../malicious.pdf", "Relative directory traversal up one level", True),
    PathTraversalTestCase("..\\malicious.pdf", "Windows backslash relative traversal", True),
    PathTraversalTestCase("../../etc/passwd", "Multi-level relative traversal", True),
    PathTraversalTestCase("/etc/passwd", "Unix root absolute path traversal", True),
    PathTraversalTestCase("C:\\Windows\\System32\\cmd.exe", "Windows absolute path with drive letter", True),
    PathTraversalTestCase("%2e%2e%2fmalicious.pdf", "URL encoded relative directory traversal", True),
    PathTraversalTestCase("safe_dir/../../escaped.pdf", "Nested directory traversal escape", True),
]


# Matrix 5: IDOR & Document Ownership Matrix (PDFL-214.3)
IDOR_OWNERSHIP_MATRIX: list[IdorOwnershipTestCase] = [
    IdorOwnershipTestCase("/api/documents/{id}", "GET", "Document metadata access"),
    IdorOwnershipTestCase("/api/documents/{id}/download", "GET", "Document binary download"),
    IdorOwnershipTestCase("/api/documents/{id}", "DELETE", "Document and physical file deletion"),
    IdorOwnershipTestCase("/api/history/{id}", "GET", "Processing history detail inspection"),
    IdorOwnershipTestCase("/api/history/{id}/result", "GET", "Processing history result extraction"),
    IdorOwnershipTestCase("/api/history/{id}", "DELETE", "Processing history record deletion"),
]

