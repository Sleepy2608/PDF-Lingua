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
    "SubscriptionService",
    "HistoryService",
    "history_service",
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
    elif name == "SubscriptionService":
        from app.services.subscription_service import SubscriptionService
        return SubscriptionService
    elif name == "HistoryService":
        from app.services.history_service import HistoryService
        return HistoryService
    elif name == "history_service":
        from app.services.history_service import history_service
        return history_service
    elif name == "JobManager":
        from app.services.job_service import JobManager
        return JobManager
    elif name == "job_manager":
        from app.services.job_service import job_manager
        return job_manager
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

