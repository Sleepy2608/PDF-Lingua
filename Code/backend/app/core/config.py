import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        pass

# Search for .env file in backend directory or root directory
_backend_dir = Path(__file__).resolve().parent.parent.parent
_root_dir = _backend_dir.parent

_env_candidates = [
    _backend_dir / ".env",
    _root_dir / ".env",
    _backend_dir / ".env.example",
    _root_dir / ".env.example",
]

for env_path in _env_candidates:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break


DEFAULT_DEV_SECRET_KEY: str = "dev-secret-key-pdf-lingua-min-32-chars"
DEFAULT_DEV_WEBHOOK_SECRET: str = "dev-webhook-secret-pdf-lingua"


def _resolve_database_url() -> str:
    raw_url = os.getenv("DATABASE_URL", "sqlite:///./pdf_lingua.db")
    if raw_url.startswith("sqlite:///./"):
        rel_path = raw_url[len("sqlite:///./") :]
        abs_path = (_backend_dir / rel_path).resolve().as_posix()
        return f"sqlite:///{abs_path}"
    return raw_url


class Settings:
    # Application Configuration
    APP_NAME: str = os.getenv("APP_NAME", "PDF-Lingua")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Security & JWT
    DEFAULT_DEV_SECRET_KEY: str = DEFAULT_DEV_SECRET_KEY
    SECRET_KEY: str = os.getenv("SECRET_KEY", DEFAULT_DEV_SECRET_KEY)
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # Database
    DATABASE_URL: str = _resolve_database_url()

    # Initial Admin Seeding (via environment variables, never hardcoded)
    ADMIN_EMAIL: str | None = os.getenv("ADMIN_EMAIL", None)
    ADMIN_PASSWORD: str | None = os.getenv("ADMIN_PASSWORD", None)

    # File Upload Constraints
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "temp_uploads/")
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "storage/documents")
    AVATAR_STORAGE_DIR: str = os.getenv("AVATAR_STORAGE_DIR", "storage/avatars")
    MAX_UPLOAD_SIZE_FREE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_FREE_MB", "20"))
    MAX_UPLOAD_SIZE_PRO_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_PRO_MB", "100"))
    MAX_PAGES_FREE: int = int(os.getenv("MAX_PAGES_FREE", "100"))
    MAX_PAGES_PRO: int = int(os.getenv("MAX_PAGES_PRO", "500"))
    MAX_AVATAR_SIZE_BYTES: int = int(os.getenv("MAX_AVATAR_SIZE_BYTES", str(2 * 1024 * 1024)))

    # OCR
    TESSERACT_CMD: str = os.getenv("TESSERACT_CMD", "")
    DEFAULT_OCR_LANG: str = os.getenv("DEFAULT_OCR_LANG", "vie+eng")

    # Processing History & Retention
    HISTORY_RETENTION_DAYS: int = int(os.getenv("HISTORY_RETENTION_DAYS", "30"))

    # Translation
    TRANSLATION_ENGINE: str = os.getenv("TRANSLATION_ENGINE", "deep-translator")
    TRANSLATION_DEFAULT_TARGET: str = os.getenv("TRANSLATION_DEFAULT_TARGET", "vi")

    # AI Services (B.AI Multi-model Gateway / OpenAI / Gemini)
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "b.ai")
    BAI_API_KEY: str = os.getenv("BAI_API_KEY", "")
    BAI_BASE_URL: str = os.getenv("BAI_BASE_URL", "https://api.b.ai/v1")
    BAI_MODEL_SUMMARIZE: str = os.getenv("BAI_MODEL_SUMMARIZE", "gpt-5-mini")
    BAI_MODEL_CHAT: str = os.getenv("BAI_MODEL_CHAT", "gpt-5-mini")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_BASE_URL: str = os.getenv(
        "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"
    )
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.0-flash-lite")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # CORS Configuration
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5500")
    CORS_ALLOWED_ORIGINS: str = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "https://pdflingua.vercel.app,https://pdf-lingua.vercel.app,http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000",
    )

    @property
    def cors_origins(self) -> list[str]:
        """Resolve list of allowed CORS origins based on environment."""
        raw_env = os.getenv("CORS_ALLOWED_ORIGINS")
        if raw_env:
            return [orig.strip() for orig in raw_env.split(",") if orig.strip()]

        is_prod = self.APP_ENV.lower() in ("production", "prod") or not self.DEBUG
        if is_prod:
            prod_origins = [
                "https://pdflingua.vercel.app",
                "https://pdf-lingua.vercel.app",
            ]
            if self.FRONTEND_ORIGIN and self.FRONTEND_ORIGIN.startswith("https://"):
                if self.FRONTEND_ORIGIN not in prod_origins:
                    prod_origins.append(self.FRONTEND_ORIGIN)
            return prod_origins

        dev_origins = [
            "https://pdflingua.vercel.app",
            "https://pdf-lingua.vercel.app",
            "http://localhost:3000",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ]
        if self.FRONTEND_ORIGIN and self.FRONTEND_ORIGIN not in dev_origins:
            dev_origins.append(self.FRONTEND_ORIGIN)
        return dev_origins

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() in ("true", "1", "yes")

    # Payment & VietQR Configuration
    DEFAULT_DEV_WEBHOOK_SECRET: str = DEFAULT_DEV_WEBHOOK_SECRET
    PAYMENT_WEBHOOK_SECRET: str = os.getenv(
        "PAYMENT_WEBHOOK_SECRET", DEFAULT_DEV_WEBHOOK_SECRET
    )
    VIETQR_BANK_ID: str = os.getenv("VIETQR_BANK_ID", "ICB")
    VIETQR_BANK_NAME: str = os.getenv("VIETQR_BANK_NAME", "VietinBank (CN Thủ Thiêm - Hội Sở)")
    VIETQR_ACCOUNT_NUMBER: str = os.getenv("VIETQR_ACCOUNT_NUMBER", "107882760609")
    VIETQR_ACCOUNT_NAME: str = os.getenv("VIETQR_ACCOUNT_NAME", "NGUYEN LE HUY TAM")
    TRANSACTION_EXPIRE_SECONDS: int = int(os.getenv("TRANSACTION_EXPIRE_SECONDS", "900"))


settings = Settings()


def validate_security_configuration() -> None:
    """
    Validate critical security settings on startup.
    In production mode (APP_ENV == 'production' or not DEBUG):
    Strictly forbids default or weak secret keys to prevent token forgery and webhook spoofing.
    """
    is_prod = settings.APP_ENV.lower() == "production" or not settings.DEBUG
    if is_prod:
        if settings.SECRET_KEY == DEFAULT_DEV_SECRET_KEY or len(settings.SECRET_KEY) < 32:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: SECRET_KEY is missing, too short (<32 chars), "
                "or using the default development secret in production. "
                "Configure a secure, random SECRET_KEY in your environment variables."
            )
        if (
            settings.PAYMENT_WEBHOOK_SECRET == DEFAULT_DEV_WEBHOOK_SECRET
            or len(settings.PAYMENT_WEBHOOK_SECRET) < 16
        ):
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: PAYMENT_WEBHOOK_SECRET is missing, too short (<16 chars), "
                "or using the default development secret in production. "
                "Configure a unique PAYMENT_WEBHOOK_SECRET in your environment variables."
            )

