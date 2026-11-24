"""
Unit Tests for Secure Administrator Seeding
-------------------------------------------
Verifies that the initial administrator account is idempotently seeded or elevated
based on environment variables, without exposing hardcoded credentials.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base
from app.core.security import verify_password
from app.models.user import User, UserRole, seed_default_admin


@pytest.fixture
def test_db_session():
    """Create an isolated in-memory SQLite database session for seeding tests."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_seed_admin_noop_when_env_unset(test_db_session, monkeypatch):
    """When ADMIN_EMAIL or ADMIN_PASSWORD is unset, seeding must be a no-op."""
    monkeypatch.setattr(settings, "ADMIN_EMAIL", None)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", None)

    result = seed_default_admin(test_db_session)
    assert result is None
    assert test_db_session.query(User).count() == 0


def test_seed_admin_creates_new_admin_user(test_db_session, monkeypatch):
    """When credentials are provided in env, seed_default_admin creates an active admin user."""
    test_email = "secure_admin@pdf-lingua.vn"
    test_password = "SecureAdminPassword!2026"

    monkeypatch.setattr(settings, "ADMIN_EMAIL", test_email)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", test_password)

    admin_user = seed_default_admin(test_db_session)
    assert admin_user is not None
    assert admin_user.email == test_email
    assert admin_user.role == UserRole.ADMIN
    assert admin_user.is_active is True
    assert verify_password(test_password, admin_user.hashed_password) is True

    # Verify persisted in database
    db_user = test_db_session.query(User).filter(User.email == test_email).first()
    assert db_user is not None
    assert db_user.id == admin_user.id
    assert db_user.role == UserRole.ADMIN


def test_seed_admin_elevates_existing_free_user(test_db_session, monkeypatch):
    """If an account with the admin email already exists with 'free' role, elevate to 'admin'."""
    from app.core.security import hash_password

    target_email = "regular_user@example.com"
    old_password = "OldFreePassword123"
    new_admin_password = "UpgradedAdminPassword!2026"

    # Pre-create free user
    free_user = User(
        email=target_email,
        hashed_password=hash_password(old_password),
        full_name="Regular Person",
        role=UserRole.FREE,
        is_active=True,
    )
    test_db_session.add(free_user)
    test_db_session.commit()
    assert free_user.role == UserRole.FREE

    # Run seed with target email and new admin password
    monkeypatch.setattr(settings, "ADMIN_EMAIL", target_email)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", new_admin_password)

    elevated_user = seed_default_admin(test_db_session)
    assert elevated_user is not None
    assert elevated_user.id == free_user.id
    assert elevated_user.role == UserRole.ADMIN
    assert verify_password(new_admin_password, elevated_user.hashed_password) is True


def test_seed_admin_is_idempotent(test_db_session, monkeypatch):
    """Multiple sequential calls must not create duplicate users or raise exceptions."""
    test_email = "idempotent_admin@example.com"
    test_password = "SafePassword999"

    monkeypatch.setattr(settings, "ADMIN_EMAIL", test_email)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", test_password)

    first_run = seed_default_admin(test_db_session)
    second_run = seed_default_admin(test_db_session)

    assert first_run.id == second_run.id
    assert test_db_session.query(User).filter(User.email == test_email).count() == 1
