from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

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

if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass


def check_db_connection() -> bool:
    """Verify that the database engine can establish a working connection."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            return True
    except Exception as e:
        logger.warning(f"[DB] Could not connect to database: {e}")
        return False


def _migrate_db_schema(bind_engine=None) -> None:
    """
    Kiểm tra và tự động bổ sung các cột mới vào bảng nếu chưa tồn tại.
    Đảm bảo tương thích ngược và giữ nguyên dữ liệu tài khoản hiện có trong SQLite/PostgreSQL.
    """
    from sqlalchemy import inspect

    target = bind_engine or engine
    inspector = inspect(target)
    existing_tables = inspector.get_table_names()

    if "users" in existing_tables:
        columns = [col["name"] for col in inspector.get_columns("users")]
        if "avatar_url" not in columns:
            logger.info("[DB Migration] Bổ sung cột avatar_url vào bảng users...")
            with target.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) DEFAULT NULL"))
            logger.info("[DB Migration] Đã bổ sung cột avatar_url thành công.")


def init_db() -> None:
    """
    Create all database tables defined in ORM models.

    This function is called once during application startup (lifespan hook
    in main.py). It is idempotent — existing tables are never dropped or
    altered; only missing tables are created.

    Import order matters: all model modules must be imported BEFORE this
    call so SQLAlchemy's metadata registry knows about them.
    """
    import app.models  # noqa: F401 — registers User (and future models) with Base.metadata
    Base.metadata.create_all(bind=engine)
    _migrate_db_schema(engine)
    db = SessionLocal()
    try:
        app.models.seed_pricing_plans(db)
        app.models.seed_default_admin(db)
    finally:
        db.close()
    logger.info("[DB] Tables verified / created successfully.")
