import os
from pathlib import Path
from dotenv import load_dotenv

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


class Settings:
    # Application Configuration
    APP_NAME: str = os.getenv("APP_NAME", "PDF-Lingua")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Security & JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-pdf-lingua-min-32-chars")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./pdf_lingua.db")

    # File Upload Constraints
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "temp_uploads/")
    MAX_UPLOAD_SIZE_FREE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_FREE_MB", "20"))
    MAX_UPLOAD_SIZE_PRO_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_PRO_MB", "100"))
    MAX_PAGES_FREE: int = int(os.getenv("MAX_PAGES_FREE", "100"))
    MAX_PAGES_PRO: int = int(os.getenv("MAX_PAGES_PRO", "500"))

    # OCR
    TESSERACT_CMD: str = os.getenv("TESSERACT_CMD", "")
    DEFAULT_OCR_LANG: str = os.getenv("DEFAULT_OCR_LANG", "vie+eng")

    # Translation
    TRANSLATION_ENGINE: str = os.getenv("TRANSLATION_ENGINE", "deep-translator")
    TRANSLATION_DEFAULT_TARGET: str = os.getenv("TRANSLATION_DEFAULT_TARGET", "vi")

    # AI Services
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "gemini")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # CORS
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5500")


settings = Settings()
