/**
 * PDF-Lingua — Main Frontend Logic
 * Handles connection checks with FastAPI backend and system status verification.
 */

const API_BASE_URL = 'http://localhost:8000';

/**
 * Checks connection health with the FastAPI backend.
 */
async function checkBackendHealth() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('statusText');
    const apiStatusValue = document.getElementById('apiStatusValue');
    const dbStatusValue = document.getElementById('dbStatusValue');
    const corsStatusValue = document.getElementById('corsStatusValue');

    if (statusDot) {
        statusDot.className = 'status-dot checking';
        statusText.textContent = 'Đang kiểm tra kết nối Backend...';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        // Update header status badge
        if (statusDot) {
            statusDot.className = 'status-dot online';
            statusText.textContent = `🟢 Backend Sẵn sàng (v${data.version || '1.0.0'})`;
        }

        // Update system info card
        if (apiStatusValue) {
            apiStatusValue.textContent = `Hoạt động bình thường (${data.status})`;
            apiStatusValue.className = 'status-value text-success';
        }
        if (dbStatusValue) {
            const isDbOk = data.database === 'connected';
            dbStatusValue.textContent = isDbOk ? 'Đã kết nối (SQLite)' : 'Mất kết nối';
            dbStatusValue.className = isDbOk ? 'status-value text-success' : 'status-value text-danger';
        }
        if (corsStatusValue) {
            corsStatusValue.textContent = 'Thông suốt (CORS cho phép)';
            corsStatusValue.className = 'status-value text-success';
        }

        console.log('[PDF-Lingua] Backend health check passed:', data);
    } catch (error) {
        console.error('[PDF-Lingua] Backend health check failed:', error);

        if (statusDot) {
            statusDot.className = 'status-dot offline';
            statusText.textContent = '🔴 Chưa kết nối Backend (Port 8000)';
        }

        if (apiStatusValue) {
            apiStatusValue.textContent = 'Không phản hồi (Chưa bật uvicorn)';
            apiStatusValue.className = 'status-value text-danger';
        }
        if (dbStatusValue) {
            dbStatusValue.textContent = 'Chờ khởi động Backend';
            dbStatusValue.className = 'status-value text-warning';
        }
        if (corsStatusValue) {
            corsStatusValue.textContent = 'Không thể kiểm tra';
            corsStatusValue.className = 'status-value text-warning';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[PDF-Lingua] Frontend initialized.');

    // Run health check on initial load
    checkBackendHealth();

    // Hook retry button
    const retryBtn = document.getElementById('btnRetryCheck');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            checkBackendHealth();
        });
    }
});
