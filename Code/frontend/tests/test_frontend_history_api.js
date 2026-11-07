/**
 * PDF-Lingua Processing History API Integration Test Suite (PDFL-161.2)
 * ---------------------------------------------------------------------
 * Verifies:
 * 1. Successful history list loading via GET /api/history and rendering into #historyTableBody.
 * 2. Filtering by individual criteria (document_id, action_type, status) and combined filters + Reset.
 * 3. Pagination with skip/limit, page navigation (Next/Prev), and empty page handling.
 * 4. UI state transitions: Loading, Empty, Error, and History List states.
 * 5. Authentication & expired token handling (missing token, 401 session clear, 403 forbidden).
 * 6. Refresh, Retry, and automatic reload when switching to History view.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const historySource = fs.readFileSync(path.resolve(__dirname, '../js/history.js'), 'utf8');
const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

class ClassList {
  constructor() {
    this.values = new Set();
  }
  add(v) {
    this.values.add(v);
  }
  remove(v) {
    this.values.delete(v);
  }
  contains(v) {
    return this.values.has(v);
  }
  toggle(v, force) {
    if (typeof force === 'boolean') {
      if (force) this.add(v);
      else this.remove(v);
    } else if (this.contains(v)) {
      this.remove(v);
    } else {
      this.add(v);
    }
  }
}

class MockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
    this.disabled = false;
    this.style = { display: '' };
    this.classList = new ClassList();
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
  }

  addEventListener(event, handler) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(handler);
  }

  dispatchEvent(event, payload = {}) {
    const handlers = this.listeners[event] || [];
    const evtObj = Object.assign(
      {
        target: this,
        preventDefault: () => {},
        stopPropagation: () => {},
      },
      payload
    );
    return handlers.map((fn) => fn(evtObj));
  }

  click() {
    return this.dispatchEvent('click');
  }
}

function createHistoryTestEnv({ initialStorage = {}, fetchImpl = null, useAuthModule = true } = {}) {
  const storageData = Object.assign({}, initialStorage);
  const mockStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(storageData, k) ? storageData[k] : null),
    setItem: (k, v) => {
      storageData[k] = String(v);
    },
    removeItem: (k) => {
      delete storageData[k];
    },
  };

  const elements = {
    heroSection: new MockElement('heroSection', 'section'),
    workspaceSection: new MockElement('workspaceSection', 'section'),
    adminSection: new MockElement('adminSection', 'section'),
    historySection: new MockElement('historySection', 'section'),
    docNameDisplay: new MockElement('docNameDisplay', 'span'),
    sideNavHistory: new MockElement('sideNavHistory', 'a'),
    btnRefreshHistory: new MockElement('btnRefreshHistory', 'button'),
    btnCloseHistoryView: new MockElement('btnCloseHistoryView', 'button'),
    btnRetryHistory: new MockElement('btnRetryHistory', 'button'),
    btnResetHistoryFilters: new MockElement('btnResetHistoryFilters', 'button'),
    historyDocumentIdFilter: new MockElement('historyDocumentIdFilter', 'input'),
    historyActionFilter: new MockElement('historyActionFilter', 'select'),
    historyStatusFilter: new MockElement('historyStatusFilter', 'select'),
    historyCountBadge: new MockElement('historyCountBadge', 'span'),
    historyLoadingState: new MockElement('historyLoadingState', 'div'),
    historyEmptyState: new MockElement('historyEmptyState', 'div'),
    historyErrorState: new MockElement('historyErrorState', 'div'),
    historyErrorMessage: new MockElement('historyErrorMessage', 'p'),
    historyTableContainer: new MockElement('historyTableContainer', 'div'),
    historyTable: new MockElement('historyTable', 'table'),
    historyTableBody: new MockElement('historyTableBody', 'tbody'),
    historyPagination: new MockElement('historyPagination', 'div'),
    historyPaginationInfo: new MockElement('historyPaginationInfo', 'div'),
    btnHistoryPrevPage: new MockElement('btnHistoryPrevPage', 'button'),
    historyCurrentPageBadge: new MockElement('historyCurrentPageBadge', 'span'),
    btnHistoryNextPage: new MockElement('btnHistoryNextPage', 'button'),
  };

  elements.historySection.style.display = 'none';
  elements.historyLoadingState.style.display = 'none';
  elements.historyEmptyState.style.display = 'none';
  elements.historyErrorState.style.display = 'none';
  elements.historyTableContainer.style.display = 'block';

  const requests = [];
  const toasts = [];
  const windowListeners = {};
  let sessionClearedCount = 0;
  let headerAuthUpdatedWith = undefined;

  const defaultFetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (typeof fetchImpl === 'function') {
      return fetchImpl(url, options);
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({
        status: 'success',
        message: 'OK',
        data: [],
      }),
    };
  };

  const windowObj = {
    location: { protocol: 'http:', hostname: '127.0.0.1', port: '8000' },
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    scrollTo: () => {},
    showToast: (message, type) => {
      toasts.push({ message, type });
    },
    addEventListener: (evt, fn) => {
      windowListeners[evt] = windowListeners[evt] || [];
      windowListeners[evt].push(fn);
    },
    dispatchEvent: (evt, detail = {}) => {
      const list = windowListeners[evt] || [];
      list.forEach((fn) => fn({ detail }));
    },
    fetch: defaultFetch,
  };

  if (useAuthModule) {
    windowObj.pdfLinguaAuth = {
      getStoredToken: () => mockStorage.getItem('pdfl_token'),
      clearStoredSession: () => {
        sessionClearedCount += 1;
        mockStorage.removeItem('pdfl_token');
        mockStorage.removeItem('pdfl_user');
      },
      updateHeaderAuthState: (user) => {
        headerAuthUpdatedWith = user;
      },
      authFetch: async (url, options = {}) => {
        const headers = Object.assign({}, options.headers || {});
        const token = mockStorage.getItem('pdfl_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return defaultFetch(url, Object.assign({}, options, { headers }));
      },
    };
  }

  const documentObj = {
    readyState: 'complete',
    getElementById: (id) => elements[id] || null,
    addEventListener: () => {},
  };

  const sandbox = {
    window: windowObj,
    document: documentObj,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    fetch: defaultFetch,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(historySource, sandbox);

  return {
    elements,
    requests,
    toasts,
    storageData,
    windowObj,
    controller: windowObj.pdfLinguaHistory,
    getSessionClearedCount: () => sessionClearedCount,
    getHeaderAuthUpdatedWith: () => headerAuthUpdatedWith,
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('PDF-Lingua Processing History API Integration Tests (PDFL-161.2)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed += 1;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error('       Reason:', err.message);
      failed += 1;
    }
  }

  const sampleRecords = [
    {
      id: 201,
      user_id: 7,
      document_id: 55,
      action_type: 'EXTRACT',
      status: 'SUCCESS',
      execution_time_ms: 340,
      error_message: null,
      created_at: '2026-11-07T08:15:30Z',
      updated_at: '2026-11-07T08:15:31Z',
    },
    {
      id: 202,
      user_id: 7,
      document_id: 55,
      action_type: 'TRANSLATE',
      status: 'PENDING',
      execution_time_ms: null,
      error_message: null,
      created_at: '2026-11-07T08:16:00Z',
      updated_at: '2026-11-07T08:16:00Z',
    },
    {
      id: 203,
      user_id: 7,
      document_id: 56,
      action_type: 'SUMMARIZE',
      status: 'FAILED',
      execution_time_ms: 120,
      error_message: 'Tài liệu không có nội dung văn bản để tóm tắt.',
      created_at: '2026-11-07T08:17:10Z',
      updated_at: '2026-11-07T08:17:11Z',
    },
  ];

  // Test 1: Script registration in index.html & successful list fetch + table rendering
  await test('1. Fetch history list successfully via GET /api/history and render into #historyTableBody', async () => {
    assert.ok(htmlSource.includes('<script src="js/history.js"></script>'), 'index.html must include js/history.js');

    const env = createHistoryTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt-token' },
      fetchImpl: async () => ({
        status: 200,
        ok: true,
        json: async () => ({
          status: 'success',
          message: 'Lấy danh sách 3 bản ghi lịch sử xử lý thành công.',
          data: sampleRecords,
        }),
      }),
    });

    const data = await env.controller.fetchHistoryList(1);
    assert.strictEqual(data.length, 3, 'Should return 3 history items');
    assert.strictEqual(env.requests.length, 1, 'Should make 1 API request');
    assert.strictEqual(env.requests[0].url, '/api/history?skip=0&limit=10');
    assert.strictEqual(env.requests[0].options.headers['Authorization'], 'Bearer valid-jwt-token');

    // Check UI state is 'list'
    assert.strictEqual(env.elements.historyTableContainer.style.display, 'block');
    assert.strictEqual(env.elements.historyLoadingState.style.display, 'none');
    assert.strictEqual(env.elements.historyEmptyState.style.display, 'none');
    assert.strictEqual(env.elements.historyErrorState.style.display, 'none');

    // Check rendered table content
    const tbodyHtml = env.elements.historyTableBody.innerHTML;
    assert.ok(tbodyHtml.includes('#201') && tbodyHtml.includes('#202') && tbodyHtml.includes('#203'));
    assert.ok(tbodyHtml.includes('DOC #55') && tbodyHtml.includes('DOC #56'));
    assert.ok(tbodyHtml.includes('action-extract') && tbodyHtml.includes('EXTRACT'));
    assert.ok(tbodyHtml.includes('action-translate') && tbodyHtml.includes('TRANSLATE'));
    assert.ok(tbodyHtml.includes('action-summarize') && tbodyHtml.includes('SUMMARIZE'));
    assert.ok(tbodyHtml.includes('status-success') && tbodyHtml.includes('status-pending') && tbodyHtml.includes('status-failed'));
    assert.ok(tbodyHtml.includes('340 ms') && tbodyHtml.includes('120 ms') && tbodyHtml.includes('--'));
    assert.ok(tbodyHtml.includes('Tài liệu không có nội dung văn bản để tóm tắt.'));
    assert.strictEqual(env.elements.historyCountBadge.textContent, '3 bản ghi');
  });

  // Test 2: Individual filters, combined filters, and Reset Filters button
  await test('2. Filter by Document ID, Action Type, Status (single & combined) and Reset Filters', async () => {
    const env = createHistoryTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt-token' },
      fetchImpl: async () => ({
        status: 200,
        ok: true,
        json: async () => ({ status: 'success', data: [sampleRecords[0]] }),
      }),
    });

    // Filter by Action Type = EXTRACT
    env.elements.historyActionFilter.value = 'EXTRACT';
    await Promise.all(env.elements.historyActionFilter.dispatchEvent('change'));
    assert.strictEqual(env.requests[env.requests.length - 1].url, '/api/history?skip=0&limit=10&action_type=EXTRACT');

    // Filter by Status = SUCCESS (combined with Action Type = EXTRACT)
    env.elements.historyStatusFilter.value = 'SUCCESS';
    await Promise.all(env.elements.historyStatusFilter.dispatchEvent('change'));
    assert.strictEqual(
      env.requests[env.requests.length - 1].url,
      '/api/history?skip=0&limit=10&action_type=EXTRACT&status=SUCCESS'
    );

    // Filter by Document ID = 55 (combined with Action Type + Status)
    env.elements.historyDocumentIdFilter.value = '55';
    await Promise.all(env.elements.historyDocumentIdFilter.dispatchEvent('change'));
    assert.strictEqual(
      env.requests[env.requests.length - 1].url,
      '/api/history?skip=0&limit=10&action_type=EXTRACT&status=SUCCESS&document_id=55'
    );

    // Invalid Document ID (<= 0) triggers client-side error state without calling API
    const reqCountBeforeInvalid = env.requests.length;
    env.elements.historyDocumentIdFilter.value = '0';
    await Promise.all(env.elements.historyDocumentIdFilter.dispatchEvent('change'));
    assert.strictEqual(env.requests.length, reqCountBeforeInvalid, 'Invalid document_id <= 0 should not call API');
    assert.strictEqual(env.elements.historyErrorState.style.display, 'block');

    // Reset Filters button clears all filter inputs and reloads page 1 with clean query
    await Promise.all(env.elements.btnResetHistoryFilters.click());
    assert.strictEqual(env.elements.historyDocumentIdFilter.value, '');
    assert.strictEqual(env.elements.historyActionFilter.value, '');
    assert.strictEqual(env.elements.historyStatusFilter.value, '');
    assert.strictEqual(env.requests[env.requests.length - 1].url, '/api/history?skip=0&limit=10');
    assert.strictEqual(env.elements.historyTableContainer.style.display, 'block');
  });

  // Test 3: Pagination (skip, limit), Next/Prev navigation, and Empty Page handling
  await test('3. Pagination with skip/limit, page navigation, and empty page recovery', async () => {
    const page1Items = [sampleRecords[0], sampleRecords[1]];
    let mockPageResponses = {
      0: page1Items, // skip=0, limit=2 (full page -> hasNextPage = true)
      2: [],         // skip=2, limit=2 (empty page 2)
    };

    const env = createHistoryTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt-token' },
      fetchImpl: async (url) => {
        const query = url.split('?')[1] || '';
        const params = new URLSearchParams(query);
        const skip = parseInt(params.get('skip'), 10);
        const data = mockPageResponses[skip] || [];
        return {
          status: 200,
          ok: true,
          json: async () => ({ status: 'success', data }),
        };
      },
    });

    env.controller.setPageLimit(2);

    // Load Page 1 (skip=0, limit=2) -> returns 2 items (full page)
    await env.controller.fetchHistoryList(1);
    assert.strictEqual(env.requests[0].url, '/api/history?skip=0&limit=2');
    assert.strictEqual(env.elements.historyCurrentPageBadge.textContent, '1');
    assert.strictEqual(env.elements.btnHistoryPrevPage.disabled, true, 'Prev disabled on page 1');
    assert.strictEqual(env.elements.btnHistoryNextPage.disabled, false, 'Next enabled when page is full');

    // Navigate to Page 2 (skip=2, limit=2) -> returns [] (empty page)
    await Promise.all(env.elements.btnHistoryNextPage.click());
    assert.strictEqual(env.requests[1].url, '/api/history?skip=2&limit=2');
    assert.strictEqual(env.elements.historyCurrentPageBadge.textContent, '2');
    assert.strictEqual(env.elements.historyEmptyState.style.display, 'block', 'Empty page displays empty state');
    assert.strictEqual(env.elements.btnHistoryNextPage.disabled, true, 'Next disabled on empty page');
    assert.strictEqual(env.elements.btnHistoryPrevPage.disabled, false, 'Prev remains enabled on empty page > 1');
    assert.strictEqual(env.elements.historyPaginationInfo.textContent, 'Trang 2 • Hiển thị 0 bản ghi');

    // Click Prev to return to Page 1 -> restores list state
    await Promise.all(env.elements.btnHistoryPrevPage.click());
    assert.strictEqual(env.requests[2].url, '/api/history?skip=0&limit=2');
    assert.strictEqual(env.elements.historyCurrentPageBadge.textContent, '1');
    assert.strictEqual(env.elements.historyTableContainer.style.display, 'block');
    assert.strictEqual(env.elements.historyEmptyState.style.display, 'none');
  });

  // Test 4: Loading, Empty, and Error UI states
  await test('4. Loading, Empty, and Error states transition accurately', async () => {
    let resolvePendingFetch;
    const env = createHistoryTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt-token' },
      fetchImpl: () =>
        new Promise((resolve) => {
          resolvePendingFetch = resolve;
        }),
    });

    // Start fetch and inspect synchronous Loading state before promise resolves
    const fetchPromise = env.controller.fetchHistoryList(1);
    assert.strictEqual(env.elements.historyLoadingState.style.display, 'block', 'Loading state visible while fetching');
    assert.strictEqual(env.elements.historyTableContainer.style.display, 'none');
    assert.strictEqual(env.elements.btnHistoryPrevPage.disabled, true);
    assert.strictEqual(env.elements.btnHistoryNextPage.disabled, true);

    // Resolve with empty list -> transitions to Empty state
    resolvePendingFetch({
      status: 200,
      ok: true,
      json: async () => ({ status: 'success', data: [] }),
    });
    await fetchPromise;

    assert.strictEqual(env.elements.historyLoadingState.style.display, 'none');
    assert.strictEqual(env.elements.historyEmptyState.style.display, 'block');
    assert.strictEqual(env.elements.historyTableContainer.style.display, 'none');
    assert.strictEqual(env.elements.historyCountBadge.textContent, '0 bản ghi');

    // Trigger server 500 error -> transitions to Error state
    const errEnv = createHistoryTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt-token' },
      fetchImpl: async () => ({
        status: 500,
        ok: false,
        json: async () => ({
          status: 'error',
          error_code: 'DATABASE_ERROR',
          message: 'Lỗi cơ sở dữ liệu khi truy vấn lịch sử xử lý. Vui lòng thử lại sau.',
        }),
      }),
    });

    await errEnv.controller.fetchHistoryList(1);
    assert.strictEqual(errEnv.elements.historyErrorState.style.display, 'block');
    assert.strictEqual(errEnv.elements.historyTableContainer.style.display, 'none');
    assert.strictEqual(
      errEnv.elements.historyErrorMessage.textContent,
      'Lỗi cơ sở dữ liệu khi truy vấn lịch sử xử lý. Vui lòng thử lại sau.'
    );
  });

  // Test 5: Expired token (401), unauthenticated guest, and forbidden document (403)
  await test('5. Handle missing token, expired token (401), and forbidden document (403)', async () => {
    // 5a. Guest with no token
    const guestEnv = createHistoryTestEnv({ initialStorage: {} });
    await guestEnv.controller.fetchHistoryList(1);
    assert.strictEqual(guestEnv.requests.length, 0, 'Should not call backend without token');
    assert.strictEqual(guestEnv.elements.historyErrorState.style.display, 'block');
    assert.ok(guestEnv.elements.historyErrorMessage.textContent.includes('Vui lòng đăng nhập'));

    // 5b. Expired token (401) -> clears stored session and shows error message
    const expiredEnv = createHistoryTestEnv({
      initialStorage: { pdfl_token: 'expired-jwt-token', pdfl_user: '{"id":7}' },
      fetchImpl: async () => ({
        status: 401,
        ok: false,
        json: async () => ({
          status: 'error',
          message: 'Token xác thực đã hết hạn. Vui lòng đăng nhập lại.',
        }),
      }),
    });

    await expiredEnv.controller.fetchHistoryList(1);
    assert.strictEqual(expiredEnv.getSessionClearedCount(), 1, 'Should call clearStoredSession on 401');
    assert.strictEqual(expiredEnv.getHeaderAuthUpdatedWith(), null, 'Should reset header auth state on 401');
    assert.strictEqual(expiredEnv.elements.historyErrorState.style.display, 'block');
    assert.strictEqual(
      expiredEnv.elements.historyErrorMessage.textContent,
      'Token xác thực đã hết hạn. Vui lòng đăng nhập lại.'
    );

    // 5c. Forbidden document filter (403 FORBIDDEN) -> shows error state without clearing active session
    const forbiddenEnv = createHistoryTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt-token' },
      fetchImpl: async () => ({
        status: 403,
        ok: false,
        json: async () => ({
          status: 'error',
          error_code: 'FORBIDDEN',
          message: 'Bạn không có quyền truy cập dữ liệu lịch sử xử lý của người dùng khác.',
        }),
      }),
    });

    await forbiddenEnv.controller.fetchHistoryList(1);
    assert.strictEqual(forbiddenEnv.getSessionClearedCount(), 0, 'Should not clear session on 403 FORBIDDEN document');
    assert.strictEqual(forbiddenEnv.elements.historyErrorState.style.display, 'block');
    assert.ok(forbiddenEnv.elements.historyErrorMessage.textContent.includes('không có quyền truy cập'));
  });

  // Test 6: Refresh, Retry, and automatic reload when switching to History view
  await test('6. Refresh, Retry, and automatic reload on switching to History view', async () => {
    let shouldFail = true;
    const env = createHistoryTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt-token' },
      fetchImpl: async () => {
        if (shouldFail) {
          throw new Error('Network disconnected');
        }
        return {
          status: 200,
          ok: true,
          json: async () => ({ status: 'success', data: sampleRecords }),
        };
      },
    });

    // Switching to History view via #sideNavHistory automatically triggers fetch (which fails first)
    await Promise.all(env.elements.sideNavHistory.click());
    assert.strictEqual(env.elements.historySection.style.display, 'block', 'History section should open');
    assert.strictEqual(env.requests.length, 1, 'Opening History view auto-fetches data');
    assert.strictEqual(env.elements.historyErrorState.style.display, 'block', 'Network error displays error state');

    // Clicking Retry (#btnRetryHistory) after connection restored loads data into table
    shouldFail = false;
    await Promise.all(env.elements.btnRetryHistory.click());
    assert.strictEqual(env.requests.length, 2, 'Retry button triggers a new fetch');
    assert.strictEqual(env.elements.historyTableContainer.style.display, 'block', 'Recovered to list state');
    assert.strictEqual(env.elements.historyErrorState.style.display, 'none');

    // Clicking Refresh (#btnRefreshHistory) reloads current view
    await Promise.all(env.elements.btnRefreshHistory.click());
    assert.strictEqual(env.requests.length, 3, 'Refresh button reloads history data');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${passed + failed} tests passed (${failed} failed).`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

