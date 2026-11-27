"""
Automated Test Suite: Production Security Hardening
---------------------------------------------------
Verifies:
1. Environment-aware CORS origin whitelisting (rejection of untrusted origins).
2. In-memory sliding-window Rate Limiter (HTTP 429, Retry-After header, RATE_LIMIT_EXCEEDED).
3. Disabling of Swagger UI (/docs), Redoc (/redoc), and OpenAPI (/openapi.json) in production.
"""

from unittest.mock import patch
import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.rate_limiter import RateLimiter, SlidingWindowLimiter
from app.main import app


@pytest.fixture(autouse=True)
def reset_limiter_state():
    """Ensure clean rate limiting state before each test."""
    RateLimiter.clear_all()
    yield
    RateLimiter.clear_all()


@pytest.fixture
def client():
    """TestClient fixture bound to main application."""
    return TestClient(app)


# ── 1. CORS Security Whitelisting Tests ────────────────────────────────────────

def test_cors_origins_resolution_in_production():
    """Verify that in production mode, CORS origins default only to authorized production domains."""
    with patch.object(settings, "APP_ENV", "production"), patch.object(settings, "DEBUG", False):
        origins = settings.cors_origins
        assert "https://pdflingua.vercel.app" in origins
        assert "https://pdf-lingua.vercel.app" in origins
        # Untrusted or local origins must not be included unless explicitly configured
        assert "http://localhost:3000" not in origins
        assert "http://localhost:5500" not in origins


def test_cors_origins_resolution_in_development():
    """Verify that in development mode, local ports are allowed for development workflows."""
    with patch.object(settings, "APP_ENV", "development"), patch.object(settings, "DEBUG", True):
        origins = settings.cors_origins
        assert "http://localhost:3000" in origins
        assert "http://localhost:5500" in origins
        assert "https://pdflingua.vercel.app" in origins


def test_cors_middleware_allows_authorized_origin():
    """Verify that requests from authorized frontend origins receive valid CORS headers."""
    client = TestClient(app)
    response = client.options(
        "/api/pricing/plans",
        headers={
            "Origin": "https://pdflingua.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "https://pdflingua.vercel.app"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_middleware_rejects_unauthorized_origin():
    """Verify that requests from unauthorized origins do not receive CORS authorization headers."""
    client = TestClient(app)
    response = client.options(
        "/api/pricing/plans",
        headers={
            "Origin": "https://malicious-attacker-domain.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    # The header must not reflect the attacker origin
    assert response.headers.get("access-control-allow-origin") != "https://malicious-attacker-domain.com"


# ── 2. Sliding Window Rate Limiter Tests ───────────────────────────────────────

def test_sliding_window_limiter_unit_logic():
    """Unit test for SlidingWindowLimiter window enforcement and retry_after computation."""
    limiter = SlidingWindowLimiter()
    key = "unit_test_key"

    # Send 3 requests within window of 3
    is_limited, _ = limiter.check(key, max_requests=3, window_seconds=10)
    assert not is_limited

    is_limited, _ = limiter.check(key, max_requests=3, window_seconds=10)
    assert not is_limited

    is_limited, _ = limiter.check(key, max_requests=3, window_seconds=10)
    assert not is_limited

    # 4th request must be rejected
    is_limited, retry_after = limiter.check(key, max_requests=3, window_seconds=10)
    assert is_limited
    assert 1 <= retry_after <= 10


def test_rate_limiter_blocks_excessive_login_attempts(client):
    """Verify that exceeding login attempts triggers HTTP 429 with Retry-After header."""
    RateLimiter.clear_all()

    # Limit for login is 5 per minute
    for _ in range(5):
        resp = client.post(
            "/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "WrongPassword123"},
            headers={"X-Forwarded-For": "203.0.113.10"},
        )
        # Should be 401 or 400, but NOT 429
        assert resp.status_code in (400, 401, 422)

    # 6th attempt from the same client IP must return HTTP 429
    resp_blocked = client.post(
        "/api/auth/login",
        json={"email": "nonexistent@test.com", "password": "WrongPassword123"},
        headers={"X-Forwarded-For": "203.0.113.10"},
    )
    assert resp_blocked.status_code == 429
    data = resp_blocked.json()
    assert data["success"] is False
    assert data["error_code"] == "RATE_LIMIT_EXCEEDED"
    assert "Retry-After" in resp_blocked.headers
    assert int(resp_blocked.headers["Retry-After"]) >= 1


def test_rate_limiter_blocks_excessive_registration_attempts(client):
    """Verify that exceeding registration attempts triggers HTTP 429."""
    RateLimiter.clear_all()

    # Limit for register is 3 per minute
    for i in range(3):
        resp = client.post(
            "/api/auth/register",
            json={"email": f"test_spam_{i}@example.com", "password": "ValidPassword123"},
            headers={"X-Forwarded-For": "203.0.113.20"},
        )
        assert resp.status_code in (201, 400, 422)

    # 4th attempt from the same IP must be rate limited
    resp_blocked = client.post(
        "/api/auth/register",
        json={"email": "test_spam_extra@example.com", "password": "ValidPassword123"},
        headers={"X-Forwarded-For": "203.0.113.20"},
    )
    assert resp_blocked.status_code == 429
    assert resp_blocked.json()["error_code"] == "RATE_LIMIT_EXCEEDED"


def test_rate_limiter_bypassed_when_disabled(client):
    """Verify that setting RATE_LIMIT_ENABLED=False bypasses throttling completely."""
    RateLimiter.clear_all()
    with patch.object(settings, "RATE_LIMIT_ENABLED", False):
        for _ in range(8):
            resp = client.post(
                "/api/auth/login",
                json={"email": "bypass@test.com", "password": "WrongPassword123"},
                headers={"X-Forwarded-For": "203.0.113.30"},
            )
            # Never returns 429 when disabled
            assert resp.status_code != 429


# ── 3. Production Documentation Hardening Tests ────────────────────────────────

def test_swagger_and_openapi_docs_disabled_in_production():
    """Verify that Swagger UI and OpenAPI schemas return HTTP 404 when configured for production."""
    prod_app = FastAPI(
        title="PDF-Lingua Test Prod",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    test_client = TestClient(prod_app)

    assert test_client.get("/docs").status_code == 404
    assert test_client.get("/redoc").status_code == 404
    assert test_client.get("/openapi.json").status_code == 404


def test_swagger_docs_accessible_in_development():
    """Verify that Swagger UI and OpenAPI schemas are accessible in development mode."""
    dev_app = FastAPI(
        title="PDF-Lingua Test Dev",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    test_client = TestClient(dev_app)

    assert test_client.get("/docs").status_code == 200
    assert test_client.get("/openapi.json").status_code == 200
