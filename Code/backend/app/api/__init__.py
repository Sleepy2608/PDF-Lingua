"""
API Package
-----------
Exports all API routers.
"""

from app.api.auth import router as auth_router

__all__ = ["auth_router"]
