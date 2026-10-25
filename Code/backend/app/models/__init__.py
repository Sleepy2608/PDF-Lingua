"""
PDF-Lingua ORM Models Package
------------------------------
Import all models here so that SQLAlchemy's Base.metadata
can discover them during create_all() at application startup.
"""

from app.models.user import User  # noqa: F401

__all__ = ["User"]
