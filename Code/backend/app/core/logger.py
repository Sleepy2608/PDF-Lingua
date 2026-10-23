import logging
import sys
from pathlib import Path
from app.core.config import settings

# Create logs directory if it does not exist
LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "app.log"

# Define log format
LOG_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logger(name: str = "pdf_lingua") -> logging.Logger:
    """Configures and returns a structured logger with console and file handlers."""
    logger = logging.getLogger(name)

    # Avoid duplicate handlers if setup_logger is called multiple times
    if logger.handlers:
        return logger

    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    logger.setLevel(log_level)

    formatter = logging.Formatter(fmt=LOG_FORMAT, datefmt=DATE_FORMAT)

    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File Handler
    try:
        file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        print(f"[Logger Warning] Could not initialize file handler at {LOG_FILE}: {e}")

    logger.propagate = False
    return logger


logger = setup_logger()
