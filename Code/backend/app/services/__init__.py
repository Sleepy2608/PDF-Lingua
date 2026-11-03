"""
Services Package
----------------
Exports all domain services.
"""

__all__ = [
    "AuthService",
    "PDFService",
    "OCRService",
    "TranslationService",
    "ExportService",
    "StorageService",
    "JobManager",
    "job_manager",
]

def __getattr__(name: str):
    if name == "AuthService":
        from app.services.auth_service import AuthService
        return AuthService
    elif name == "PDFService":
        from app.services.pdf_service import PDFService
        return PDFService
    elif name == "OCRService":
        from app.services.ocr_service import OCRService
        return OCRService
    elif name == "TranslationService":
        from app.services.translation_service import TranslationService
        return TranslationService
    elif name == "ExportService":
        from app.services.export_service import ExportService
        return ExportService
    elif name == "StorageService":
        from app.services.storage_service import StorageService
        return StorageService
    elif name == "JobManager":
        from app.services.job_service import JobManager
        return JobManager
    elif name == "job_manager":
        from app.services.job_service import job_manager
        return job_manager
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

