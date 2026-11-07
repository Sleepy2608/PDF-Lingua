/**
 * PDF-Lingua Processing History Controller (PDFL-161.2)
 * -----------------------------------------------------
 * Integrates Frontend Processing History UI with Backend History API:
 * - GET /api/history with pagination (`skip`, `limit`)
 * - Filtering by `document_id`, `action_type` (EXTRACT, TRANSLATE, SUMMARIZE),
 *   and `status` (PENDING, SUCCESS, FAILED)
 * - Dynamic rendering into `#historyTableBody`
 * - State management across Loading, Empty, Error, and History List states
 * - Refresh, Retry, and Reset Filters actions
 * - Automatic data reload when switching to the History view
 * - Token retrieval and authentication error handling via existing auth client
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

    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('limit', String(safeLimit));

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

    return { params, skip, limit: safeLimit, page: safePage, docValidation };
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
          <tr class="history-row" data-history-id="${id}" data-action-type="${escapeHtml(actionType)}" data-status="${escapeHtml(status)}" data-document-id="${docId}">
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

  // ── Core API Fetch: GET /api/history ────────────────────────────────────────
  async function fetchHistoryList(targetPage = currentPage) {
    const requestId = ++activeRequestId;
    const safeTargetPage = Math.max(1, parseInt(targetPage, 10) || 1);
    currentPage = safeTargetPage;

    const countBadge = document.getElementById('historyCountBadge');
    const tbody = document.getElementById('historyTableBody');

    // Validate Document ID filter client-side first
    const { params, docValidation } = buildHistoryQueryParams(currentPage, currentLimit);
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
        const records = responseData && Array.isArray(responseData.data) ? responseData.data : [];
        currentItems = records;
        hasNextPage = records.length >= currentLimit;
        renderHistoryTable(records);
        return records;
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
    const historySection = document.getElementById('historySection');
    if (historySection) historySection.style.display = 'none';

    const workspaceSection = document.getElementById('workspaceSection');
    const heroSection = document.getElementById('heroSection');
    const docNameDisplay = document.getElementById('docNameDisplay');

    if (workspaceSection && docNameDisplay && docNameDisplay.textContent.trim() !== '') {
      workspaceSection.style.display = 'block';
    } else if (heroSection) {
      heroSection.style.display = 'block';
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
    };
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

    // 5. Auth Change Listener: reload if History View is currently active
    window.addEventListener('pdfl:auth-change', () => {
      const historySection = document.getElementById('historySection');
      if (historySection && historySection.style.display !== 'none') {
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
  };
})();
