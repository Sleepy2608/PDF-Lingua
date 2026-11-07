/**
 * PDF-Lingua Processing History Controller (PDFL-161.2 & PDFL-161.3)
 * ------------------------------------------------------------------
 * Integrates Frontend Processing History UI with Backend History API:
 * - GET /api/history with pagination (`skip`, `limit`)
 * - Filtering by `document_id`, `action_type` (EXTRACT, TRANSLATE, SUMMARIZE),
 *   and `status` (PENDING, SUCCESS, FAILED)
 * - Dynamic rendering into `#historyTableBody`
 * - State management across Loading, Empty, Error, and History List states
 * - Refresh, Retry, and Reset Filters actions
 * - Automatic data reload when switching to the History view
 * - Processing History Detail Modal via `GET /api/history/{history_id}` (PDFL-161.3)
 *   with Loading, Not Found (404), Error (401/403/500), and Content states,
 *   null-safe `execution_time_ms` / `error_message` rendering, and XSS protection.
 */

(function () {
  'use strict';

  const API_BASE_URL = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8000'))
    ? `${window.location.protocol === 'https:' ? 'https:' : 'http:'}//${(window.location.hostname && window.location.hostname !== '') ? window.location.hostname : '127.0.0.1'}:8000`
    : '';

  const DEFAULT_PAGE_LIMIT = 10;
  const VALID_ACTION_TYPES = ['EXTRACT', 'TRANSLATE', 'SUMMARIZE'];
  const VALID_STATUSES = ['PENDING', 'SUCCESS', 'FAILED'];

  // ── State Management ────────────────────────────────────────────────────────
  let currentPage = 1;
  let currentLimit = DEFAULT_PAGE_LIMIT;
  let currentDocumentId = '';
  let currentActionType = '';
  let currentStatus = '';
  let currentItems = [];
  let hasNextPage = false;
  let isFetching = false;
  let activeRequestId = 0;
  let docFilterDebounceTimer = null;

  // Detail Modal State (PDFL-161.3)
  let currentDetailHistoryId = null;
  let currentDetailItem = null;
  let isFetchingDetail = false;
  let activeDetailRequestId = 0;

  // ── Helper Utilities ────────────────────────────────────────────────────────
  function getStoredToken() {
    if (window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredToken === 'function') {
      return window.pdfLinguaAuth.getStoredToken();
    }
    try {
      return localStorage.getItem('pdfl_token') || sessionStorage.getItem('pdfl_token');
    } catch (_err) {
      return null;
    }
  }

  function clearExpiredAuthSession() {
    if (window.pdfLinguaAuth && typeof window.pdfLinguaAuth.clearStoredSession === 'function') {
      window.pdfLinguaAuth.clearStoredSession();
    } else {
      try {
        localStorage.removeItem('pdfl_token');
        localStorage.removeItem('pdfl_user');
        sessionStorage.removeItem('pdfl_token');
        sessionStorage.removeItem('pdfl_user');
      } catch (_err) {}
    }

    if (window.pdfLinguaAuth && typeof window.pdfLinguaAuth.updateHeaderAuthState === 'function') {
      window.pdfLinguaAuth.updateHeaderAuthState(null);
    }
  }

  async function requestWithAuth(url, options = {}) {
    if (window.pdfLinguaAuth && typeof window.pdfLinguaAuth.authFetch === 'function') {
      return window.pdfLinguaAuth.authFetch(url, options);
    }
    const token = getStoredToken();
    const headers = Object.assign({}, options.headers || {});
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, Object.assign({}, options, { headers }));
  }

  function escapeHtml(str) {
    if (window.pdfLinguaAuth && typeof window.pdfLinguaAuth.escapeHtml === 'function') {
      return window.pdfLinguaAuth.escapeHtml(str);
    }
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatHistoryDate(isoString) {
    if (!isoString) return '--';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return String(isoString);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const secs = String(d.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
    } catch (_err) {
      return String(isoString);
    }
  }

  function formatExecutionTime(ms) {
    if (ms === null || ms === undefined || ms === '' || isNaN(Number(ms))) {
      return '<span class="history-duration-mono font-mono text-muted">--</span>';
    }
    const numericMs = Math.max(0, Math.round(Number(ms)));
    return `<span class="history-duration-mono font-mono">${numericMs} ms</span>`;
  }

  function notifyUser(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      try {
        window.showToast(message, type);
        return;
      } catch (_err) {}
    }
  }

  // ── UI State Transitions ────────────────────────────────────────────────────
  /**
   * Switch between the 4 History UI states: 'loading', 'empty', 'error', 'list'.
   */
  function setHistoryViewState(state, options = {}) {
    const loadingEl = document.getElementById('historyLoadingState');
    const emptyEl = document.getElementById('historyEmptyState');
    const errorEl = document.getElementById('historyErrorState');
    const errorMsgEl = document.getElementById('historyErrorMessage');
    const tableContainerEl = document.getElementById('historyTableContainer');

    if (loadingEl) loadingEl.style.display = state === 'loading' ? 'block' : 'none';
    if (emptyEl) emptyEl.style.display = state === 'empty' ? 'block' : 'none';
    if (errorEl) errorEl.style.display = state === 'error' ? 'block' : 'none';
    if (tableContainerEl) tableContainerEl.style.display = state === 'list' ? 'block' : 'none';

    if (state === 'error' && errorMsgEl) {
      errorMsgEl.textContent =
        options.message ||
        'Đã xảy ra sự cố khi tải danh sách lịch sử xử lý tài liệu. Vui lòng kiểm tra kết nối và thử lại.';
    }
  }

  /**
   * Switch between the 4 History Detail Modal states: 'loading', 'not-found', 'error', 'content'.
   */
  function setHistoryDetailState(state, options = {}) {
    const loadingEl = document.getElementById('historyDetailLoadingState');
    const notFoundEl = document.getElementById('historyDetailNotFoundState');
    const notFoundMsgEl = document.getElementById('historyDetailNotFoundMessage');
    const errorEl = document.getElementById('historyDetailErrorState');
    const errorMsgEl = document.getElementById('historyDetailErrorMessage');
    const contentEl = document.getElementById('historyDetailContent');

    if (loadingEl) loadingEl.style.display = state === 'loading' ? 'block' : 'none';
    if (notFoundEl) notFoundEl.style.display = state === 'not-found' ? 'block' : 'none';
    if (errorEl) errorEl.style.display = state === 'error' ? 'block' : 'none';
    if (contentEl) contentEl.style.display = state === 'content' ? 'block' : 'none';

    if (state === 'not-found' && notFoundMsgEl) {
      notFoundMsgEl.textContent =
        options.message || 'Bản ghi lịch sử này không tồn tại hoặc đã bị xóa.';
    }
    if (state === 'error' && errorMsgEl) {
      errorMsgEl.textContent =
        options.message || 'Đã xảy ra lỗi khi tải thông tin chi tiết bản ghi lịch sử.';
    }
  }

  // ── Query Parameter Builder & Validation ────────────────────────────────────
  function validateDocumentIdFilter(rawDocId) {
    if (rawDocId === null || rawDocId === undefined) return { valid: true, value: null };
    const trimmed = String(rawDocId).trim();
    if (trimmed === '') return { valid: true, value: null };

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return {
        valid: false,
        value: null,
        error: 'Mã tài liệu (Document ID) phải là số nguyên dương lớn hơn 0.',
      };
    }
    return { valid: true, value: parsed };
  }

  function buildHistoryQueryParams(page = currentPage, limit = currentLimit) {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (safePage - 1) * safeLimit;
    // Lookahead limit + 1 (capped at Backend max 100) to detect if a next page exists (AUDIT-04)
    const fetchLimit = safeLimit < 100 ? safeLimit + 1 : 100;

    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('limit', String(fetchLimit));

    const normalizedAction = String(currentActionType || '').trim().toUpperCase();
    if (normalizedAction && VALID_ACTION_TYPES.includes(normalizedAction)) {
      params.set('action_type', normalizedAction);
    }

    const normalizedStatus = String(currentStatus || '').trim().toUpperCase();
    if (normalizedStatus && VALID_STATUSES.includes(normalizedStatus)) {
      params.set('status', normalizedStatus);
    }

    const docValidation = validateDocumentIdFilter(currentDocumentId);
    if (docValidation.valid && docValidation.value !== null) {
      params.set('document_id', String(docValidation.value));
    }

    return { params, skip, limit: safeLimit, fetchLimit, page: safePage, docValidation };
  }

  // ── Table Row & Badge Rendering ─────────────────────────────────────────────
  function renderActionBadge(actionType) {
    const normalized = String(actionType || '').trim().toUpperCase();
    if (normalized === 'TRANSLATE') {
      return `
        <span class="action-badge action-translate">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 8l6 6"></path>
            <path d="M4 14l6-6 2-3"></path>
            <path d="M2 5h12"></path>
            <path d="M7 2h1"></path>
            <path d="M22 22l-5-10-5 10"></path>
            <path d="M14 18h6"></path>
          </svg>
          <span>TRANSLATE</span>
        </span>
      `;
    }
    if (normalized === 'SUMMARIZE') {
      return `
        <span class="action-badge action-summarize">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3c0 4.97-4.03 9-9 9 4.97 0 9 4.03 9 9 0-4.97 4.03-9 9-9-4.97 0-9-4.03-9-9z"></path>
          </svg>
          <span>SUMMARIZE</span>
        </span>
      `;
    }
    return `
      <span class="action-badge action-extract">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        <span>${escapeHtml(normalized || 'EXTRACT')}</span>
      </span>
    `;
  }

  function renderStatusBadge(status, errorMessage) {
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized === 'PENDING') {
      return `
        <span class="status-pill history-status-pill status-pending">
          <span class="status-dot status-dot-pending"></span>
          <span>PENDING</span>
        </span>
      `;
    }
    if (normalized === 'FAILED') {
      const safeError = errorMessage ? escapeHtml(errorMessage) : '';
      return `
        <div class="history-status-cell">
          <span class="status-pill history-status-pill status-failed">
            <span class="status-dot status-dot-failed"></span>
            <span>FAILED</span>
          </span>
          ${safeError ? `<span class="history-error-note" title="${safeError}">${safeError}</span>` : ''}
        </div>
      `;
    }
    return `
      <span class="status-pill history-status-pill status-success">
        <span class="status-dot"></span>
        <span>${escapeHtml(normalized || 'SUCCESS')}</span>
      </span>
    `;
  }

  function renderHistoryTable(records) {
    const tbody = document.getElementById('historyTableBody');
    const countBadge = document.getElementById('historyCountBadge');

    const items = Array.isArray(records) ? records : [];
    if (countBadge) {
      countBadge.textContent = `${items.length} bản ghi`;
    }

    if (items.length === 0) {
      if (tbody) tbody.innerHTML = '';
      setHistoryViewState('empty');
      return;
    }

    setHistoryViewState('list');

    const rowsHtml = items
      .map((item) => {
        const id = escapeHtml(item.id);
        const docId = escapeHtml(item.document_id);
        const actionType = String(item.action_type || '').trim().toUpperCase();
        const status = String(item.status || '').trim().toUpperCase();
        const durationHtml = formatExecutionTime(item.execution_time_ms);
        const createdText = escapeHtml(formatHistoryDate(item.created_at));

        return `
          <tr class="history-row" data-history-id="${id}" data-action-type="${escapeHtml(actionType)}" data-status="${escapeHtml(status)}" data-document-id="${docId}" tabindex="0" role="button" aria-label="Xem chi tiết bản ghi lịch sử #${id}">
            <td>
              <span class="user-id-mono history-id-mono">#${id}</span>
            </td>
            <td>
              <span class="history-doc-badge font-mono">
                <span class="doc-badge-pdf">PDF</span>
                <span>DOC #${docId}</span>
              </span>
            </td>
            <td>
              ${renderActionBadge(actionType)}
            </td>
            <td>
              ${renderStatusBadge(status, item.error_message)}
            </td>
            <td>
              ${durationHtml}
            </td>
            <td>
              <span class="date-mono history-created-mono">${createdText}</span>
            </td>
          </tr>
        `;
      })
      .join('');

    if (tbody) {
      tbody.innerHTML = rowsHtml;
    }
  }

  function renderHistoryPagination() {
    const btnPrev = document.getElementById('btnHistoryPrevPage');
    const btnNext = document.getElementById('btnHistoryNextPage');
    const pageBadge = document.getElementById('historyCurrentPageBadge');
    const pageInfo = document.getElementById('historyPaginationInfo');

    if (btnPrev) {
      btnPrev.disabled = isFetching || currentPage <= 1;
    }
    if (btnNext) {
      btnNext.disabled = isFetching || !hasNextPage;
    }
    if (pageBadge) {
      pageBadge.textContent = String(currentPage);
    }
    if (pageInfo) {
      const count = Array.isArray(currentItems) ? currentItems.length : 0;
      pageInfo.textContent = `Trang ${currentPage} • Hiển thị ${count} bản ghi`;
    }
  }

  // ── Detail View Rendering & API Fetch (PDFL-161.3) ──────────────────────────
  function renderHistoryDetail(record) {
    if (!record || typeof record !== 'object') return;

    const headerBadgeEl = document.getElementById('historyDetailHeaderBadge');
    const idEl = document.getElementById('historyDetailId');
    const docIdEl = document.getElementById('historyDetailDocId');
    const actionTypeEl = document.getElementById('historyDetailActionType');
    const statusEl = document.getElementById('historyDetailStatus');
    const execTimeEl = document.getElementById('historyDetailExecutionTime');
    const createdAtEl = document.getElementById('historyDetailCreatedAt');
    const updatedAtEl = document.getElementById('historyDetailUpdatedAt');
    const errorBoxEl = document.getElementById('historyDetailErrorBox');
    const errorTextEl = document.getElementById('historyDetailErrorText');

    const safeId = record.id !== null && record.id !== undefined ? String(record.id) : '--';
    const safeDocId = record.document_id !== null && record.document_id !== undefined ? String(record.document_id) : '--';
    const actionType = String(record.action_type || 'EXTRACT').trim().toUpperCase();
    const status = String(record.status || 'SUCCESS').trim().toUpperCase();

    if (headerBadgeEl) headerBadgeEl.textContent = `#${safeId}`;
    if (idEl) idEl.textContent = `#${safeId}`;
    if (docIdEl) docIdEl.textContent = `DOC #${safeDocId}`;
    if (actionTypeEl) actionTypeEl.innerHTML = renderActionBadge(actionType);
    if (statusEl) statusEl.innerHTML = renderStatusBadge(status, null);
    if (execTimeEl) execTimeEl.innerHTML = formatExecutionTime(record.execution_time_ms);
    if (createdAtEl) createdAtEl.textContent = formatHistoryDate(record.created_at);
    if (updatedAtEl) updatedAtEl.textContent = formatHistoryDate(record.updated_at);

    const hasErrorMessage =
      record.error_message !== null &&
      record.error_message !== undefined &&
      String(record.error_message).trim() !== '';

    if (errorBoxEl) {
      errorBoxEl.style.display = hasErrorMessage ? 'block' : 'none';
    }
    if (errorTextEl) {
      errorTextEl.textContent = hasErrorMessage ? String(record.error_message).trim() : '';
    }

    setHistoryDetailState('content');
  }

  async function fetchHistoryDetail(historyId) {
    const requestId = ++activeDetailRequestId;
    const parsedId = Number(historyId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      isFetchingDetail = false;
      currentDetailItem = null;
      setHistoryDetailState('error', { message: 'Mã bản ghi lịch sử không hợp lệ.' });
      return null;
    }

    currentDetailHistoryId = parsedId;

    const token = getStoredToken();
    if (!token) {
      isFetchingDetail = false;
      currentDetailItem = null;
      const unauthMsg = 'Vui lòng đăng nhập để xem chi tiết bản ghi lịch sử xử lý.';
      setHistoryDetailState('error', { message: unauthMsg });
      notifyUser(unauthMsg, 'error');
      return null;
    }

    isFetchingDetail = true;
    setHistoryDetailState('loading');

    try {
      const response = await requestWithAuth(`${API_BASE_URL}/api/history/${parsedId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (requestId !== activeDetailRequestId) {
        return null;
      }

      let responseData = null;
      try {
        responseData = await response.json();
      } catch (_parseErr) {
        responseData = null;
      }

      if (requestId !== activeDetailRequestId) {
        return null;
      }

      if (response.status === 200) {
        const record = responseData && responseData.data ? responseData.data : null;
        if (!record) {
          currentDetailItem = null;
          setHistoryDetailState('not-found', {
            message: `Bản ghi lịch sử với ID ${parsedId} không tồn tại.`,
          });
          return null;
        }
        currentDetailItem = record;
        renderHistoryDetail(record);
        return record;
      }

      currentDetailItem = null;

      if (response.status === 404) {
        const notFoundMsg =
          (responseData && responseData.message) ||
          `Bản ghi lịch sử với ID ${parsedId} không tồn tại.`;
        setHistoryDetailState('not-found', { message: notFoundMsg });
        return null;
      }

      if (response.status === 401) {
        clearExpiredAuthSession();
        const authErrMsg =
          (responseData && responseData.message) ||
          'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.';
        setHistoryDetailState('error', { message: authErrMsg });
        notifyUser(authErrMsg, 'error');
        return null;
      }

      if (response.status === 403) {
        if (responseData && responseData.error_code === 'ACCOUNT_INACTIVE') {
          clearExpiredAuthSession();
        }
        const forbiddenMsg =
          (responseData && responseData.message) ||
          'Bạn không có quyền truy cập bản ghi lịch sử xử lý này.';
        setHistoryDetailState('error', { message: forbiddenMsg });
        notifyUser(forbiddenMsg, 'error');
        return null;
      }

      if (response.status === 400 || response.status === 422) {
        const validationMsg =
          (responseData && responseData.message) ||
          'Mã bản ghi lịch sử không hợp lệ.';
        setHistoryDetailState('error', { message: validationMsg });
        return null;
      }

      const serverMsg =
        (responseData && responseData.message) ||
        'Đã xảy ra lỗi từ máy chủ khi tải chi tiết lịch sử xử lý. Vui lòng thử lại sau.';
      setHistoryDetailState('error', { message: serverMsg });
      notifyUser(serverMsg, 'error');
      return null;
    } catch (_networkErr) {
      if (requestId !== activeDetailRequestId) {
        return null;
      }
      currentDetailItem = null;
      const netMsg = 'Không thể kết nối đến máy chủ để tải chi tiết lịch sử. Vui lòng kiểm tra kết nối và thử lại.';
      setHistoryDetailState('error', { message: netMsg });
      notifyUser(netMsg, 'error');
      return null;
    } finally {
      if (requestId === activeDetailRequestId) {
        isFetchingDetail = false;
      }
    }
  }

  function openHistoryDetail(historyId) {
    const modal = document.getElementById('historyDetailModal');
    const headerBadgeEl = document.getElementById('historyDetailHeaderBadge');

    if (headerBadgeEl) {
      headerBadgeEl.textContent = historyId ? `#${historyId}` : '#--';
    }
    if (modal) {
      modal.style.display = 'flex';
    }

    return fetchHistoryDetail(historyId);
  }

  function closeHistoryDetailModal() {
    const modal = document.getElementById('historyDetailModal');
    if (modal) {
      modal.style.display = 'none';
    }
    activeDetailRequestId += 1;
    isFetchingDetail = false;
    currentDetailHistoryId = null;
    currentDetailItem = null;
  }

  function retryHistoryDetail() {
    if (currentDetailHistoryId !== null && currentDetailHistoryId !== undefined) {
      return fetchHistoryDetail(currentDetailHistoryId);
    }
    return null;
  }

  // ── Core API Fetch: GET /api/history ────────────────────────────────────────
  async function fetchHistoryList(targetPage = currentPage) {
    const requestId = ++activeRequestId;
    const safeTargetPage = Math.max(1, parseInt(targetPage, 10) || 1);
    currentPage = safeTargetPage;

    const countBadge = document.getElementById('historyCountBadge');
    const tbody = document.getElementById('historyTableBody');

    // Validate Document ID filter client-side first
    const { params, skip, limit: pageLimit, fetchLimit, docValidation } = buildHistoryQueryParams(
      currentPage,
      currentLimit
    );
    if (!docValidation.valid) {
      isFetching = false;
      currentItems = [];
      hasNextPage = false;
      if (tbody) tbody.innerHTML = '';
      if (countBadge) countBadge.textContent = '0 bản ghi';
      setHistoryViewState('error', { message: docValidation.error });
      renderHistoryPagination();
      return null;
    }

    const token = getStoredToken();
    if (!token) {
      isFetching = false;
      currentItems = [];
      hasNextPage = false;
      if (tbody) tbody.innerHTML = '';
      if (countBadge) countBadge.textContent = '0 bản ghi';
      const unauthMsg = 'Vui lòng đăng nhập để xem lịch sử xử lý tài liệu của bạn.';
      setHistoryViewState('error', { message: unauthMsg });
      renderHistoryPagination();
      notifyUser(unauthMsg, 'error');
      return null;
    }

    isFetching = true;
    setHistoryViewState('loading');
    renderHistoryPagination();

    try {
      const response = await requestWithAuth(`${API_BASE_URL}/api/history?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (requestId !== activeRequestId) {
        return null;
      }

      let responseData = null;
      try {
        responseData = await response.json();
      } catch (_parseErr) {
        responseData = null;
      }

      if (requestId !== activeRequestId) {
        return null;
      }

      if (response.status === 200) {
        const rawRecords = responseData && Array.isArray(responseData.data) ? responseData.data : [];
        if (fetchLimit > pageLimit) {
          hasNextPage = rawRecords.length > pageLimit;
        } else if (rawRecords.length < pageLimit) {
          hasNextPage = false;
        } else {
          // AUDIT-04: Khi pageLimit === 100 (chạm trần tối đa 100 của Backend) và trang hiện tại đủ 100 bản ghi,
          // thực hiện truy vấn thăm dò 1 bản ghi ở vị trí kế tiếp (skip + pageLimit, limit = 1)
          // để xác định chính xác trang tiếp theo có tồn tại hay không mà không cần đổi Backend API contract.
          const probeParams = new URLSearchParams(params.toString());
          probeParams.set('skip', String(skip + pageLimit));
          probeParams.set('limit', '1');

          let nextExists = false;
          try {
            const probeResponse = await requestWithAuth(`${API_BASE_URL}/api/history?${probeParams.toString()}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
              },
            });
            if (requestId !== activeRequestId) {
              return null;
            }
            if (probeResponse && probeResponse.status === 200) {
              const probeData = await probeResponse.json();
              if (requestId !== activeRequestId) {
                return null;
              }
              const probeRecords = probeData && Array.isArray(probeData.data) ? probeData.data : [];
              nextExists = probeRecords.length > 0;
            }
          } catch (_probeErr) {
            nextExists = false;
          }
          hasNextPage = nextExists;
        }
        const pageRecords = rawRecords.slice(0, pageLimit);
        currentItems = pageRecords;
        renderHistoryTable(pageRecords);
        return pageRecords;
      }

      // Reset items on error
      currentItems = [];
      hasNextPage = false;
      if (tbody) tbody.innerHTML = '';
      if (countBadge) countBadge.textContent = '0 bản ghi';

      if (response.status === 401) {
        clearExpiredAuthSession();
        const authErrMsg =
          (responseData && responseData.message) ||
          'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.';
        setHistoryViewState('error', { message: authErrMsg });
        notifyUser(authErrMsg, 'error');
        return null;
      }

      if (response.status === 403) {
        if (responseData && responseData.error_code === 'ACCOUNT_INACTIVE') {
          clearExpiredAuthSession();
        }
        const forbiddenMsg =
          (responseData && responseData.message) ||
          'Bạn không có quyền truy cập dữ liệu lịch sử xử lý này.';
        setHistoryViewState('error', { message: forbiddenMsg });
        notifyUser(forbiddenMsg, 'error');
        return null;
      }

      if (response.status === 400 || response.status === 422) {
        const validationMsg =
          (responseData && responseData.message) ||
          'Tham số lọc hoặc phân trang không hợp lệ.';
        setHistoryViewState('error', { message: validationMsg });
        notifyUser(validationMsg, 'error');
        return null;
      }

      const serverMsg =
        (responseData && responseData.message) ||
        'Đã xảy ra sự cố khi tải danh sách lịch sử xử lý tài liệu. Vui lòng thử lại sau.';
      setHistoryViewState('error', { message: serverMsg });
      notifyUser(serverMsg, 'error');
      return null;
    } catch (_networkErr) {
      if (requestId !== activeRequestId) {
        return null;
      }
      currentItems = [];
      hasNextPage = false;
      if (tbody) tbody.innerHTML = '';
      if (countBadge) countBadge.textContent = '0 bản ghi';
      const netMsg = 'Không thể kết nối đến máy chủ để tải lịch sử xử lý. Vui lòng kiểm tra kết nối và thử lại.';
      setHistoryViewState('error', { message: netMsg });
      notifyUser(netMsg, 'error');
      return null;
    } finally {
      if (requestId === activeRequestId) {
        isFetching = false;
        renderHistoryPagination();
      }
    }
  }

  // ── Filter & View Actions ───────────────────────────────────────────────────
  function syncFilterInputsFromState() {
    const docInput = document.getElementById('historyDocumentIdFilter');
    const actionSelect = document.getElementById('historyActionFilter');
    const statusSelect = document.getElementById('historyStatusFilter');

    if (docInput) docInput.value = currentDocumentId;
    if (actionSelect) actionSelect.value = currentActionType;
    if (statusSelect) statusSelect.value = currentStatus;
  }

  function resetHistoryFilters() {
    if (docFilterDebounceTimer) {
      clearTimeout(docFilterDebounceTimer);
      docFilterDebounceTimer = null;
    }
    currentDocumentId = '';
    currentActionType = '';
    currentStatus = '';
    currentPage = 1;
    syncFilterInputsFromState();
    return fetchHistoryList(1);
  }

  function refreshHistoryList() {
    const btnRefresh = document.getElementById('btnRefreshHistory');
    if (btnRefresh) {
      btnRefresh.classList.add('loading');
      setTimeout(() => btnRefresh.classList.remove('loading'), 500);
    }
    return fetchHistoryList(currentPage);
  }

  function retryHistoryList() {
    return fetchHistoryList(currentPage);
  }

  function openHistoryView() {
    const heroSection = document.getElementById('heroSection');
    const workspaceSection = document.getElementById('workspaceSection');
    const adminSection = document.getElementById('adminSection');
    const historySection = document.getElementById('historySection');

    if (heroSection) heroSection.style.display = 'none';
    if (workspaceSection) workspaceSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';
    if (historySection) {
      historySection.style.display = 'block';
      if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    return fetchHistoryList(currentPage);
  }

  function closeHistoryView() {
    closeHistoryDetailModal();
    const historySection = document.getElementById('historySection');
    if (historySection) historySection.style.display = 'none';

    const workspaceSection = document.getElementById('workspaceSection');
    const heroSection = document.getElementById('heroSection');
    const docNameDisplay = document.getElementById('docNameDisplay');
    const hasOpenDocument = Boolean(
      workspaceSection && docNameDisplay && docNameDisplay.textContent && docNameDisplay.textContent.trim() !== ''
    );

    if (hasOpenDocument) {
      workspaceSection.style.display = 'block';
      if (heroSection) heroSection.style.display = 'none';
    } else if (heroSection) {
      heroSection.style.display = 'block';
      if (workspaceSection) workspaceSection.style.display = 'none';
    }

    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function setPageLimit(newLimit) {
    const parsed = parseInt(newLimit, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
      currentLimit = parsed;
    }
  }

  function getState() {
    return {
      currentPage,
      currentLimit,
      currentDocumentId,
      currentActionType,
      currentStatus,
      currentItems: currentItems.slice(),
      hasNextPage,
      isFetching,
      currentDetailHistoryId,
      currentDetailItem,
      isFetchingDetail,
    };
  }

  function extractRowHistoryId(eventTarget) {
    if (!eventTarget) return null;
    if (typeof eventTarget.closest === 'function') {
      const row = eventTarget.closest('.history-row');
      if (row) {
        const attrId =
          (typeof row.getAttribute === 'function' && row.getAttribute('data-history-id')) ||
          (row.dataset && row.dataset.historyId);
        if (attrId) return attrId;
      }
    }
    if (typeof eventTarget.getAttribute === 'function' && eventTarget.getAttribute('data-history-id')) {
      return eventTarget.getAttribute('data-history-id');
    }
    if (eventTarget.dataset && eventTarget.dataset.historyId) {
      return eventTarget.dataset.historyId;
    }
    return null;
  }

  // ── Event Listeners Initialization ──────────────────────────────────────────
  function initHistoryEvents() {
    const sideNavHistory = document.getElementById('sideNavHistory');
    const btnRefreshHistory = document.getElementById('btnRefreshHistory');
    const btnCloseHistoryView = document.getElementById('btnCloseHistoryView');
    const btnRetryHistory = document.getElementById('btnRetryHistory');
    const btnResetHistoryFilters = document.getElementById('btnResetHistoryFilters');
    const docFilterInput = document.getElementById('historyDocumentIdFilter');
    const actionFilterSelect = document.getElementById('historyActionFilter');
    const statusFilterSelect = document.getElementById('historyStatusFilter');
    const btnPrevPage = document.getElementById('btnHistoryPrevPage');
    const btnNextPage = document.getElementById('btnHistoryNextPage');
    const historyTableBody = document.getElementById('historyTableBody');

    // Detail Modal controls (PDFL-161.3)
    const historyDetailModal = document.getElementById('historyDetailModal');
    const btnCloseHistoryDetailModal = document.getElementById('btnCloseHistoryDetailModal');
    const btnBackToHistoryList = document.getElementById('btnBackToHistoryList');
    const btnBackFromHistoryNotFound = document.getElementById('btnBackFromHistoryNotFound');
    const btnBackFromHistoryError = document.getElementById('btnBackFromHistoryError');
    const btnRetryHistoryDetail = document.getElementById('btnRetryHistoryDetail');

    // 1. Sidebar navigation fallback when sidebar.js does not invoke openHistoryView directly
    if (sideNavHistory) {
      sideNavHistory.addEventListener('click', (e) => {
        if (!window.PDFLinguaSidebar) {
          e.preventDefault();
          return openHistoryView();
        }
        return undefined;
      });
    }

    // 2. Header & Error Actions
    if (btnRefreshHistory) {
      btnRefreshHistory.addEventListener('click', (e) => {
        e.preventDefault();
        return refreshHistoryList();
      });
    }

    if (btnCloseHistoryView) {
      btnCloseHistoryView.addEventListener('click', (e) => {
        if (!window.PDFLinguaSidebar) {
          e.preventDefault();
          closeHistoryView();
        }
      });
    }

    if (btnRetryHistory) {
      btnRetryHistory.addEventListener('click', (e) => {
        e.preventDefault();
        return retryHistoryList();
      });
    }

    if (btnResetHistoryFilters) {
      btnResetHistoryFilters.addEventListener('click', (e) => {
        e.preventDefault();
        return resetHistoryFilters();
      });
    }

    // 3. Filters: Document ID, Action Type, Status
    if (docFilterInput) {
      docFilterInput.addEventListener('input', (e) => {
        if (docFilterDebounceTimer) clearTimeout(docFilterDebounceTimer);
        docFilterDebounceTimer = setTimeout(() => {
          currentDocumentId = e.target.value.trim();
          currentPage = 1;
          fetchHistoryList(1);
        }, 300);
      });

      docFilterInput.addEventListener('change', (e) => {
        if (docFilterDebounceTimer) {
          clearTimeout(docFilterDebounceTimer);
          docFilterDebounceTimer = null;
        }
        currentDocumentId = e.target.value.trim();
        currentPage = 1;
        return fetchHistoryList(1);
      });
    }

    if (actionFilterSelect) {
      actionFilterSelect.addEventListener('change', (e) => {
        currentActionType = e.target.value.trim().toUpperCase();
        currentPage = 1;
        return fetchHistoryList(1);
      });
    }

    if (statusFilterSelect) {
      statusFilterSelect.addEventListener('change', (e) => {
        currentStatus = e.target.value.trim().toUpperCase();
        currentPage = 1;
        return fetchHistoryList(1);
      });
    }

    // 4. Pagination Controls
    if (btnPrevPage) {
      btnPrevPage.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isFetching && currentPage > 1) {
          return fetchHistoryList(currentPage - 1);
        }
        return undefined;
      });
    }

    if (btnNextPage) {
      btnNextPage.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isFetching && hasNextPage) {
          return fetchHistoryList(currentPage + 1);
        }
        return undefined;
      });
    }

    // 5. Row Click & Keyboard Delegation in #historyTableBody -> Open Detail Modal (PDFL-161.3)
    if (historyTableBody) {
      historyTableBody.addEventListener('click', (e) => {
        const historyId = extractRowHistoryId(e.target);
        if (historyId) {
          return openHistoryDetail(historyId);
        }
        return undefined;
      });

      historyTableBody.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const historyId = extractRowHistoryId(e.target);
          if (historyId) {
            e.preventDefault();
            return openHistoryDetail(historyId);
          }
        }
        return undefined;
      });
    }

    // 6. Detail Modal Close, Back & Retry Controls (PDFL-161.3)
    const closeHandlers = [
      btnCloseHistoryDetailModal,
      btnBackToHistoryList,
      btnBackFromHistoryNotFound,
      btnBackFromHistoryError,
    ];
    closeHandlers.forEach((btn) => {
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          closeHistoryDetailModal();
        });
      }
    });

    if (btnRetryHistoryDetail) {
      btnRetryHistoryDetail.addEventListener('click', (e) => {
        e.preventDefault();
        return retryHistoryDetail();
      });
    }

    if (historyDetailModal) {
      historyDetailModal.addEventListener('click', (e) => {
        if (e.target === historyDetailModal) {
          closeHistoryDetailModal();
        }
      });
    }

    if (typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && historyDetailModal && historyDetailModal.style.display !== 'none') {
          closeHistoryDetailModal();
        }
      });
    }

    // 7. Auth Change Listener: reload if History View is currently active
    window.addEventListener('pdfl:auth-change', () => {
      const historySection = document.getElementById('historySection');
      if (historySection && historySection.style.display !== 'none') {
        closeHistoryDetailModal();
        currentPage = 1;
        fetchHistoryList(1);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHistoryEvents);
  } else {
    initHistoryEvents();
  }

  window.pdfLinguaHistory = {
    openHistoryView,
    closeHistoryView,
    fetchHistoryList,
    refreshHistoryList,
    retryHistoryList,
    resetHistoryFilters,
    setHistoryViewState,
    renderHistoryTable,
    renderHistoryPagination,
    buildHistoryQueryParams,
    setPageLimit,
    getState,
    // Detail API & Modal (PDFL-161.3)
    openHistoryDetail,
    closeHistoryDetailModal,
    fetchHistoryDetail,
    renderHistoryDetail,
    retryHistoryDetail,
    setHistoryDetailState,
  };
})();
