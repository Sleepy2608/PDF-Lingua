"""
API Package
-----------
Exports all API routers.
"""

from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.history import router as history_router

__all__ = ["ai_router", "auth_router", "history_router"]
