import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.documents import compat_router as documents_compat_router, router as documents_router
from app.api.history import router as history_router
from app.api.pricing import router as pricing_router
from app.api.process import compat_router as process_compat_router, router as process_router
from app.core.config import settings
from app.core.database import check_db_connection, init_db
from app.core.exceptions import setup_exception_handlers
from app.core.logger import logger


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Application lifespan: run startup tasks before serving requests."""
    logger.info("[Startup] Initialising database tables...")
    init_db()
    logger.info("[Startup] PDF-Lingua backend is ready.")
    yield
    logger.info("[Shutdown] PDF-Lingua backend shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for PDF text extraction, OCR, translation, and AI assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# HTTP Request Logging & Latency Middleware
@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    start_time = time.time()
    client_host = request.client.host if request.client else "unknown"
    logger.info(f"--> {request.method} {request.url.path} from {client_host}")

    try:
        response = await call_next(request)
        process_time_ms = (time.time() - start_time) * 1000
        logger.info(f"<-- {request.method} {request.url.path} {response.status_code} ({process_time_ms:.1f}ms)")
        return response
    except Exception as e:
        process_time_ms = (time.time() - start_time) * 1000
        logger.error(f"<-- {request.method} {request.url.path} failed after {process_time_ms:.1f}ms: {e}")
        raise



# Register Global Exception Handlers
setup_exception_handlers(app)

# Register API Routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(process_router)
app.include_router(process_compat_router)
app.include_router(documents_router)
app.include_router(documents_compat_router)
app.include_router(admin_router)
app.include_router(history_router)
app.include_router(pricing_router)
app.include_router(ai_router)


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "status": "online",
        "version": "1.0.0",
    }


@app.get("/health")
async def health_check():
    db_ok = check_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "version": "1.0.0",
    }
