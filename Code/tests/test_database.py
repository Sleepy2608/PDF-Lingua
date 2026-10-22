import sys
from pathlib import Path

# Add backend directory to sys.path so app can be imported
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from app.core.database import engine, SessionLocal, check_db_connection
from app.core.dependencies import get_db


def test_database_connection():
    """Verify that the database engine can successfully execute a query."""
    assert check_db_connection() is True


def test_session_lifecycle():
    """Verify that a database session can be created, run a query, and closed."""
    session = SessionLocal()
    try:
        result = session.execute(text("SELECT 1")).scalar()
        assert result == 1
    finally:
        session.close()


def test_get_db_dependency():
    """Verify that the get_db dependency yields a valid active session."""
    db_gen = get_db()
    db = next(db_gen)
    try:
        result = db.execute(text("SELECT 1")).scalar()
        assert result == 1
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass
