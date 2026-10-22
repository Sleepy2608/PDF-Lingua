import sys
from pathlib import Path

# Add backend directory to sys.path so app can be imported
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel
from app.core.exceptions import (
    AppException,
    NotFoundException,
    BadRequestException,
    UnauthorizedException,
    setup_exception_handlers,
)
from app.core.logger import logger, LOG_FILE

# Create a sample app with exception handlers to test exception flows
sample_app = FastAPI()
setup_exception_handlers(sample_app)


class SamplePayload(BaseModel):
    name: str
    age: int


@sample_app.get("/test-not-found")
async def trigger_not_found():
    raise NotFoundException("User not found")


@sample_app.get("/test-bad-request")
async def trigger_bad_request():
    raise BadRequestException("Invalid input parameters", details={"field": "query"})


@sample_app.get("/test-unauthorized")
async def trigger_unauthorized():
    raise UnauthorizedException("Invalid or expired token")


@sample_app.post("/test-validation")
async def trigger_validation(payload: SamplePayload):
    return {"message": "ok"}


@sample_app.get("/test-unhandled")
async def trigger_unhandled():
    raise ZeroDivisionError("Simulated server crash")


# raise_server_exceptions=False ensures TestClient returns HTTP 500 JSON instead of re-raising
client = TestClient(sample_app, raise_server_exceptions=False)


def test_not_found_exception_handling():
    """Verify that NotFoundException produces HTTP 404 with standardized error JSON."""
    response = client.get("/test-not-found")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "NOT_FOUND"
    assert "User not found" in data["message"]


def test_bad_request_exception_handling():
    """Verify that BadRequestException produces HTTP 400 with details."""
    response = client.get("/test-bad-request")
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "BAD_REQUEST"
    assert data["details"] == {"field": "query"}


def test_unauthorized_exception_handling():
    """Verify that UnauthorizedException produces HTTP 401."""
    response = client.get("/test-unauthorized")
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "UNAUTHORIZED"


def test_validation_error_handling():
    """Verify that Pydantic validation errors return HTTP 422 with field-level details."""
    response = client.post("/test-validation", json={"name": 123})
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "VALIDATION_ERROR"
    assert isinstance(data["details"], list)


def test_unhandled_exception_handling():
    """Verify that unexpected exceptions return HTTP 500 without leaking sensitive trace."""
    response = client.get("/test-unhandled")
    assert response.status_code == 500
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "INTERNAL_SERVER_ERROR"
    assert "unexpected internal server error" in data["message"].lower()


def test_logger_initialization():
    """Verify that the logger writes to the configured log file."""
    logger.info("Test logging message for pytest")
    for handler in logger.handlers:
        handler.flush()
    assert LOG_FILE.exists()
    content = LOG_FILE.read_text(encoding="utf-8")
    assert "Test logging message for pytest" in content
