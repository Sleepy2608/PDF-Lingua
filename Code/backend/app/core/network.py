"""
Network & Client Metadata Helpers
---------------------------------
Extracts the real client IP address safely behind reverse proxies (Render, Vercel, Nginx)
and parses human-readable browser / OS summaries from HTTP User-Agent headers.
"""

from fastapi import Request


def extract_client_ip(request: Request) -> str:
    """
    Resolve the client's real IP address.
    Priority:
      1. First address in `X-Forwarded-For` header (standard proxy chain)
      2. `X-Real-IP` header
      3. `request.client.host`
      4. Fallback `'unknown'`
    """
    if request is None:
        return "unknown"

    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        first_ip = xff.split(",")[0].strip()
        if first_ip:
            return first_ip[:64]

    real_ip = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    if real_ip and real_ip.strip():
        return real_ip.strip()[:64]

    if request.client and request.client.host:
        return str(request.client.host).strip()[:64]

    return "unknown"


def parse_device_summary(user_agent: str | None) -> str:
    """
    Derive a concise browser + OS label from a raw User-Agent header string.
    Example: 'Chrome / Windows', 'Safari / iOS', 'Firefox / Linux'.
    """
    if not user_agent or not user_agent.strip():
        return "Unknown Device"

    ua = user_agent.lower()

    # Detect Browser / Client
    if "edg/" in ua or "edge/" in ua:
        browser = "Edge"
    elif "opr/" in ua or "opera" in ua:
        browser = "Opera"
    elif "chrome/" in ua or "crios/" in ua:
        browser = "Chrome"
    elif "firefox/" in ua or "fxios/" in ua:
        browser = "Firefox"
    elif "safari/" in ua and "chrome/" not in ua:
        browser = "Safari"
    elif "postman" in ua:
        browser = "Postman"
    elif "curl/" in ua:
        browser = "cURL"
    elif "python" in ua or "httpx" in ua:
        browser = "API Client"
    else:
        browser = "Browser"

    # Detect OS / Platform (check iOS/Android before macOS/Linux)
    if "iphone" in ua or "ipad" in ua or "ipod" in ua:
        os_name = "iOS"
    elif "android" in ua:
        os_name = "Android"
    elif "windows" in ua:
        os_name = "Windows"
    elif "mac os x" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Unknown OS"

    return f"{browser} / {os_name}"
