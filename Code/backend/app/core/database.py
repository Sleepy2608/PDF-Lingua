from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings
from app.core.logger import logger

# Configure connection arguments based on database dialect
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def check_db_connection() -> bool:
    """Verify that the database engine can establish a working connection."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            return True
    except Exception as e:
        logger.warning(f"[DB] Could not connect to database: {e}")
        return False


def init_db() -> None:
    """
    Create all database tables defined in ORM models (PDFL-72).

    This function is called once during application startup (lifespan hook
    in main.py). It is idempotent — existing tables are never dropped or
    altered; only missing tables are created.

    Import order matters: all model modules must be imported BEFORE this
    call so SQLAlchemy's metadata registry knows about them.
    """
    import app.models  # noqa: F401 — registers User (and future models) with Base.metadata
    Base.metadata.create_all(bind=engine)
    logger.info("[DB] Tables verified / created successfully.")
