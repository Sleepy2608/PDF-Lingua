"""
Unit & Integration Tests for Document Model & Metadata Tracking (PDFL-91)
-------------------------------------------------------------------------
Verifies:
- Document model schema, columns, defaults and constraints.
- Foreign key relationship with User and cascade deletion.
- Safe serialization and metadata properties.
"""

from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.user import User, UserRole
from app.models.document import Document


@pytest.fixture
def in_memory_db():
    """Create a completely isolated in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_pdfl_91_document_creation_and_defaults(in_memory_db):
    """Verify Document record can be created with expected defaults."""
    # Arrange: Create test user
    user = User(
        email="author@example.com",
        hashed_password="hashed_secret_password",
        role=UserRole.FREE,
    )
    in_memory_db.add(user)
    in_memory_db.commit()
    in_memory_db.refresh(user)

    # Act: Create document record
    doc = Document(
        user_id=user.id,
        original_filename="Báo Cáo Nghiên Cứu.pdf",
        stored_filename="uuid123_safe_report.pdf",
        stored_path=f"storage/documents/{user.id}/uuid123_safe_report.pdf",
        file_size_bytes=1024 * 500,  # 500 KB
        page_count=12,
        target_lang="vi",
        is_ocr_used=False,
    )
    in_memory_db.add(doc)
    in_memory_db.commit()
    in_memory_db.refresh(doc)

    # Assert: Verify persisted values and defaults
    assert doc.id is not None
    assert doc.user_id == user.id
    assert doc.original_filename == "Báo Cáo Nghiên Cứu.pdf"
    assert doc.stored_filename == "uuid123_safe_report.pdf"
    assert doc.stored_path == f"storage/documents/{user.id}/uuid123_safe_report.pdf"
    assert doc.file_size_bytes == 512000
    assert doc.page_count == 12
    assert doc.target_lang == "vi"
    assert doc.is_ocr_used is False
    assert isinstance(doc.created_at, datetime)
    assert isinstance(doc.updated_at, datetime)
    assert "<Document id=" in repr(doc)


def test_pdfl_91_document_user_relationship(in_memory_db):
    """Verify bidirectional relationship between User and Document."""
    # Arrange: Create user
    user = User(
        email="researcher@example.com",
        hashed_password="secure_password_123",
        role=UserRole.PRO,
    )
    in_memory_db.add(user)
    in_memory_db.commit()

    # Act: Add multiple documents to user
    doc1 = Document(
        user_id=user.id,
        original_filename="doc1.pdf",
        stored_filename="uuid1_doc1.pdf",
        stored_path="storage/1/uuid1_doc1.pdf",
        file_size_bytes=1000,
        page_count=2,
    )
    doc2 = Document(
        user_id=user.id,
        original_filename="doc2.pdf",
        stored_filename="uuid2_doc2.pdf",
        stored_path="storage/1/uuid2_doc2.pdf",
        file_size_bytes=2500,
        page_count=5,
        is_ocr_used=True,
    )
    in_memory_db.add_all([doc1, doc2])
    in_memory_db.commit()
    in_memory_db.refresh(user)

    # Assert: User has both documents and document references back to user
    assert len(user.documents) == 2
    assert user.documents[0].original_filename in ("doc1.pdf", "doc2.pdf")
    assert doc1.owner.email == "researcher@example.com"
    assert doc2.owner.email == "researcher@example.com"


def test_pdfl_91_document_cascade_delete_with_user(in_memory_db):
    """Verify that deleting a User cascades to delete all their Documents."""
    # Arrange: Create user and document
    user = User(
        email="delete_me@example.com",
        hashed_password="temp_password",
        role=UserRole.FREE,
    )
    in_memory_db.add(user)
    in_memory_db.commit()

    doc = Document(
        user_id=user.id,
        original_filename="to_delete.pdf",
        stored_filename="uuid_del.pdf",
        stored_path="storage/del.pdf",
        file_size_bytes=5000,
        page_count=1,
    )
    in_memory_db.add(doc)
    in_memory_db.commit()

    doc_id = doc.id

    # Act: Delete user
    in_memory_db.delete(user)
    in_memory_db.commit()

    # Assert: Document must be deleted automatically
    remaining_doc = in_memory_db.query(Document).filter(Document.id == doc_id).first()
    assert remaining_doc is None
