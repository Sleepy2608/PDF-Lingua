"""
Sliding Window Rate Limiter Module
----------------------------------
Provides thread-safe in-memory rate limiting based on client IP or user ID.
Defends against brute-force attacks on authentication and DoS/resource exhaustion on AI services.
"""

from collections import deque
import threading
import time
from typing import Optional

from fastapi import Request

from app.core.config import settings
from app.core.exceptions import TooManyRequestsException
from app.core.logger import logger
from app.core.network import extract_client_ip


class SlidingWindowLimiter:
    """Thread-safe in-memory sliding window rate limiter."""

    def __init__(self) -> None:
        self._history: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._last_cleanup: float = time.time()
        self._cleanup_interval: float = 300.0  # 5 minutes

    def check(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, int]:
        """
        Check whether the given key has exceeded `max_requests` in `window_seconds`.
        Returns `(is_limited, retry_after_seconds)`.
        """
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            # Periodic cleanup of stale keys
            if now - self._last_cleanup > self._cleanup_interval:
                self._cleanup_stale_keys(now)
                self._last_cleanup = now

            timestamps = self._history.setdefault(key, deque())

            # Evict timestamps outside the active window
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()

            if len(timestamps) >= max_requests:
                oldest = timestamps[0]
                retry_after = max(1, int(oldest + window_seconds - now))
                return True, retry_after

            # Record this request
            timestamps.append(now)
            return False, 0

    def _cleanup_stale_keys(self, now: float) -> None:
        """Purge empty or inactive keys from memory."""
        stale_keys = [
            k for k, dq in self._history.items() if not dq or dq[-1] < (now - 600.0)
        ]
        for k in stale_keys:
            self._history.pop(k, None)

    def clear(self) -> None:
        """Clear all tracked request history (primarily for unit tests)."""
        with self._lock:
            self._history.clear()


# Global in-memory limiter instance
_global_limiter = SlidingWindowLimiter()


class RateLimiter:
    """
    FastAPI dependency for endpoint rate limiting.
    Example:
        @router.post("/login", dependencies=[Depends(RateLimiter(5, 60, "auth_login"))])
    """

    def __init__(
        self,
        max_requests: int,
        window_seconds: int = 60,
        scope: str = "default",
        use_user_id: bool = True,
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.scope = scope
        self.use_user_id = use_user_id

    async def __call__(self, request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return

        client_ip = extract_client_ip(request)
        identifier = client_ip

        if (
            self.use_user_id
            and hasattr(request.state, "user_id")
            and request.state.user_id
        ):
            identifier = f"user_{request.state.user_id}"

        rate_key = f"{self.scope}:{identifier}"
        is_limited, retry_after = _global_limiter.check(
            rate_key, self.max_requests, self.window_seconds
        )

        if is_limited:
            logger.warning(
                f"[RateLimiter] Rate limit exceeded on {request.method} {request.url.path} "
                f"for key='{rate_key}' (retry_after={retry_after}s)"
            )
            raise TooManyRequestsException(
                message=f"Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau {retry_after} giây.",
                error_code="RATE_LIMIT_EXCEEDED",
                retry_after=retry_after,
            )

    @classmethod
    def clear_all(cls) -> None:
        """Reset all rate limiter tracking records."""
        _global_limiter.clear()


def rate_limit(
    max_requests: int,
    window_seconds: int = 60,
    scope: str = "default",
    use_user_id: bool = True,
) -> RateLimiter:
    """Convenience factory returning a RateLimiter dependency."""
    return RateLimiter(
        max_requests=max_requests,
        window_seconds=window_seconds,
        scope=scope,
        use_user_id=use_user_id,
    )
