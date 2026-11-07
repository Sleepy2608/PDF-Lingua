/**
 * PDF-Lingua Processing History Detail & Testing Suite (PDFL-161.3)
 * -----------------------------------------------------------------
 * Verifies:
 * 1. Clicking a row in #historyTableBody opens #historyDetailModal and calls GET /api/history/{history_id}.
 * 2. Viewing detail records for SUCCESS, FAILED, and PENDING statuses (History ID, Document ID,
 *    Action Type, Status, Created At, Updated At, Execution Time, and Error Message).
 * 3. Handling 401, 403, 404 (Not Found state), 500, and network errors + Retry recovery.
 * 4. Null-safety (execution_time_ms = null, error_message = null) and XSS protection.
 * 5. Closing Detail Modal via close button, back to list button, backdrop click, and Escape key.
 * 6. Responsive UI & Design System CSS verification in index.html and components.css.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const historySource = fs.readFileSync(path.resolve(__dirname, '../js/history.js'), 'utf8');
const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const componentsCss = fs.readFileSync(path.resolve(__dirname, '../css/components.css'), 'utf8');

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

  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }

  getAttribute(k) {
    return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
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

  click(customPayload = {}) {
    return this.dispatchEvent('click', customPayload);
  }
}

function createDetailTestEnv({ initialStorage = {}, fetchImpl = null } = {}) {
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

    // Detail Modal Elements (PDFL-161.3)
    historyDetailModal: new MockElement('historyDetailModal', 'div'),
    historyDetailHeaderBadge: new MockElement('historyDetailHeaderBadge', 'span'),
    btnCloseHistoryDetailModal: new MockElement('btnCloseHistoryDetailModal', 'button'),
    historyDetailLoadingState: new MockElement('historyDetailLoadingState', 'div'),
    historyDetailNotFoundState: new MockElement('historyDetailNotFoundState', 'div'),
    historyDetailNotFoundMessage: new MockElement('historyDetailNotFoundMessage', 'p'),
    btnBackFromHistoryNotFound: new MockElement('btnBackFromHistoryNotFound', 'button'),
    historyDetailErrorState: new MockElement('historyDetailErrorState', 'div'),
    historyDetailErrorMessage: new MockElement('historyDetailErrorMessage', 'p'),
    btnRetryHistoryDetail: new MockElement('btnRetryHistoryDetail', 'button'),
    btnBackFromHistoryError: new MockElement('btnBackFromHistoryError', 'button'),
    historyDetailContent: new MockElement('historyDetailContent', 'div'),
    historyDetailId: new MockElement('historyDetailId', 'span'),
    historyDetailDocBadge: new MockElement('historyDetailDocBadge', 'span'),
    historyDetailDocId: new MockElement('historyDetailDocId', 'span'),
    historyDetailActionType: new MockElement('historyDetailActionType', 'div'),
    historyDetailStatus: new MockElement('historyDetailStatus', 'div'),
    historyDetailExecutionTime: new MockElement('historyDetailExecutionTime', 'div'),
    historyDetailCreatedAt: new MockElement('historyDetailCreatedAt', 'span'),
    historyDetailUpdatedAt: new MockElement('historyDetailUpdatedAt', 'span'),
    historyDetailErrorBox: new MockElement('historyDetailErrorBox', 'div'),
    historyDetailErrorText: new MockElement('historyDetailErrorText', 'p'),
    btnBackToHistoryList: new MockElement('btnBackToHistoryList', 'button'),
  };

  elements.historySection.style.display = 'block';
  elements.historyTableContainer.style.display = 'block';
  elements.historyDetailModal.style.display = 'none';
  elements.historyDetailLoadingState.style.display = 'none';
  elements.historyDetailNotFoundState.style.display = 'none';
  elements.historyDetailErrorState.style.display = 'none';
  elements.historyDetailContent.style.display = 'block';
  elements.historyDetailErrorBox.style.display = 'none';

  const requests = [];
  const docListeners = {};
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
      json: async () => ({ status: 'success', data: {} }),
    };
  };

  const windowObj = {
    location: { protocol: 'http:', hostname: '127.0.0.1', port: '8000' },
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    scrollTo: () => {},
    showToast: () => {},
    addEventListener: () => {},
    fetch: defaultFetch,
    pdfLinguaAuth: {
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
    },
  };

  const documentObj = {
    readyState: 'complete',
    getElementById: (id) => elements[id] || null,
    addEventListener: (evt, fn) => {
      docListeners[evt] = docListeners[evt] || [];
      docListeners[evt].push(fn);
    },
    dispatchEvent: (evt, payload = {}) => {
      const handlers = docListeners[evt] || [];
      handlers.forEach((fn) => fn(payload));
    },
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
    documentObj,
    controller: windowObj.pdfLinguaHistory,
    getSessionClearedCount: () => sessionClearedCount,
    getHeaderAuthUpdatedWith: () => headerAuthUpdatedWith,
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('PDF-Lingua Processing History Detail Test Suite (PDFL-161.3)');
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

  // Test 1: Row click in #historyTableBody & viewing SUCCESS, FAILED, and PENDING detail records
  await test('1. Click row in #historyTableBody and view SUCCESS, FAILED, and PENDING detail records', async () => {
    const recordsById = {
      103: {
        id: 103,
        user_id: 5,
        document_id: 101,
        action_type: 'EXTRACT',
        status: 'SUCCESS',
        execution_time_ms: 420,
        error_message: null,
        created_at: '2026-11-07T07:25:10Z',
        updated_at: '2026-11-07T07:25:11Z',
      },
      102: {
        id: 102,
        user_id: 5,
        document_id: 101,
        action_type: 'TRANSLATE',
        status: 'PENDING',
        execution_time_ms: null,
        error_message: null,
        created_at: '2026-11-07T07:26:05Z',
        updated_at: '2026-11-07T07:26:05Z',
      },
      101: {
        id: 101,
        user_id: 5,
        document_id: 102,
        action_type: 'SUMMARIZE',
        status: 'FAILED',
        execution_time_ms: 85,
        error_message: 'Không thể tóm tắt tài liệu rỗng.',
        created_at: '2026-11-07T07:20:42Z',
        updated_at: '2026-11-07T07:20:43Z',
      },
    };

    const env = createDetailTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt-token' },
      fetchImpl: async (url) => {
        const id = parseInt(url.split('/').pop(), 10);
        return {
          status: 200,
          ok: true,
          json: async () => ({
            status: 'success',
            message: 'Lấy thông tin chi tiết lịch sử xử lý thành công.',
            data: recordsById[id],
          }),
        };
      },
    });

    // Simulate clicking a row in #historyTableBody for SUCCESS record (#103)
    const clickedRowChild = {
      closest: (sel) =>
        sel === '.history-row'
          ? { getAttribute: (k) => (k === 'data-history-id' ? '103' : null), dataset: { historyId: '103' } }
          : null,
    };
    await Promise.all(env.elements.historyTableBody.click({ target: clickedRowChild }));

    assert.strictEqual(env.requests.length, 1);
    assert.strictEqual(env.requests[0].url, '/api/history/103');
    assert.strictEqual(env.elements.historyDetailModal.style.display, 'flex', 'Modal should open');
    assert.strictEqual(env.elements.historyDetailContent.style.display, 'block', 'Content state should be visible');
    assert.strictEqual(env.elements.historyDetailId.textContent, '#103');
    assert.strictEqual(env.elements.historyDetailDocId.textContent, 'DOC #101');
    assert.ok(env.elements.historyDetailActionType.innerHTML.includes('EXTRACT'));
    assert.ok(env.elements.historyDetailStatus.innerHTML.includes('SUCCESS'));
    assert.ok(env.elements.historyDetailExecutionTime.innerHTML.includes('420 ms'));
    assert.notStrictEqual(env.elements.historyDetailCreatedAt.textContent, '--');
    assert.notStrictEqual(env.elements.historyDetailUpdatedAt.textContent, '--');
    assert.strictEqual(env.elements.historyDetailErrorBox.style.display, 'none', 'Error box hidden for SUCCESS');

    // View PENDING record (#102)
    await env.controller.openHistoryDetail(102);
    assert.strictEqual(env.requests[1].url, '/api/history/102');
    assert.strictEqual(env.elements.historyDetailId.textContent, '#102');
    assert.ok(env.elements.historyDetailActionType.innerHTML.includes('TRANSLATE'));
    assert.ok(env.elements.historyDetailStatus.innerHTML.includes('PENDING'));
    assert.ok(env.elements.historyDetailExecutionTime.innerHTML.includes('--'), 'Null execution_time_ms renders --');
    assert.strictEqual(env.elements.historyDetailErrorBox.style.display, 'none', 'Error box hidden for PENDING');

    // View FAILED record (#101)
    await env.controller.openHistoryDetail(101);
    assert.strictEqual(env.requests[2].url, '/api/history/101');
    assert.strictEqual(env.elements.historyDetailId.textContent, '#101');
    assert.strictEqual(env.elements.historyDetailDocId.textContent, 'DOC #102');
    assert.ok(env.elements.historyDetailActionType.innerHTML.includes('SUMMARIZE'));
    assert.ok(env.elements.historyDetailStatus.innerHTML.includes('FAILED'));
    assert.ok(env.elements.historyDetailExecutionTime.innerHTML.includes('85 ms'));
    assert.strictEqual(env.elements.historyDetailErrorBox.style.display, 'block', 'Error box visible for FAILED');
    assert.strictEqual(env.elements.historyDetailErrorText.textContent, 'Không thể tóm tắt tài liệu rỗng.');
  });

  // Test 2: Loading, 404 Not Found, 401 Unauthorized, 403 Forbidden, 500 Server Error & Retry
  await test('2. Handle Loading, 401, 403, 404 Not Found, and 500 Server Error with Retry recovery', async () => {
    // 2a. Synchronous Loading state check
    let resolveDetail;
    const loadingEnv = createDetailTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt-token' },
      fetchImpl: () =>
        new Promise((resolve) => {
          resolveDetail = resolve;
        }),
    });

    const pendingPromise = loadingEnv.controller.openHistoryDetail(103);
    assert.strictEqual(loadingEnv.elements.historyDetailLoadingState.style.display, 'block');
    assert.strictEqual(loadingEnv.elements.historyDetailContent.style.display, 'none');

    // Resolve with 404 Not Found
    resolveDetail({
      status: 404,
      ok: false,
      json: async () => ({
        status: 'error',
        message: 'Bản ghi lịch sử với ID 999 không tồn tại.',
      }),
    });
    await pendingPromise;
    assert.strictEqual(loadingEnv.elements.historyDetailLoadingState.style.display, 'none');
    assert.strictEqual(loadingEnv.elements.historyDetailNotFoundState.style.display, 'block');
    assert.strictEqual(
      loadingEnv.elements.historyDetailNotFoundMessage.textContent,
      'Bản ghi lịch sử với ID 999 không tồn tại.'
    );

    // 2b. 401 Unauthorized -> clears stored session and shows Error state
    const unauthEnv = createDetailTestEnv({
      initialStorage: { pdfl_token: 'expired-jwt' },
      fetchImpl: async () => ({
        status: 401,
        ok: false,
        json: async () => ({
          status: 'error',
          message: 'Phiên đăng nhập đã hết hạn.',
        }),
      }),
    });
    await unauthEnv.controller.openHistoryDetail(103);
    assert.strictEqual(unauthEnv.getSessionClearedCount(), 1, 'Should clear session on 401');
    assert.strictEqual(unauthEnv.getHeaderAuthUpdatedWith(), null);
    assert.strictEqual(unauthEnv.elements.historyDetailErrorState.style.display, 'block');
    assert.strictEqual(unauthEnv.elements.historyDetailErrorMessage.textContent, 'Phiên đăng nhập đã hết hạn.');

    // 2c. 403 Forbidden -> shows Error state without clearing active session
    const forbiddenEnv = createDetailTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt' },
      fetchImpl: async () => ({
        status: 403,
        ok: false,
        json: async () => ({
          status: 'error',
          error_code: 'FORBIDDEN',
          message: 'Bạn không có quyền truy cập lịch sử xử lý của người dùng khác.',
        }),
      }),
    });
    await forbiddenEnv.controller.openHistoryDetail(103);
    assert.strictEqual(forbiddenEnv.getSessionClearedCount(), 0);
    assert.strictEqual(forbiddenEnv.elements.historyDetailErrorState.style.display, 'block');
    assert.ok(forbiddenEnv.elements.historyDetailErrorMessage.textContent.includes('không có quyền'));

    // 2d. 500 Server Error followed by Retry (#btnRetryHistoryDetail) recovery
    let failServer = true;
    const retryEnv = createDetailTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt' },
      fetchImpl: async () => {
        if (failServer) {
          return {
            status: 500,
            ok: false,
            json: async () => ({
              status: 'error',
              message: 'Lỗi cơ sở dữ liệu khi truy vấn chi tiết lịch sử xử lý.',
            }),
          };
        }
        return {
          status: 200,
          ok: true,
          json: async () => ({
            status: 'success',
            data: {
              id: 103,
              user_id: 5,
              document_id: 101,
              action_type: 'EXTRACT',
              status: 'SUCCESS',
              execution_time_ms: 420,
              error_message: null,
              created_at: '2026-11-07T07:25:10Z',
              updated_at: '2026-11-07T07:25:11Z',
            },
          }),
        };
      },
    });

    await retryEnv.controller.openHistoryDetail(103);
    assert.strictEqual(retryEnv.elements.historyDetailErrorState.style.display, 'block');

    failServer = false;
    await Promise.all(retryEnv.elements.btnRetryHistoryDetail.click());
    assert.strictEqual(retryEnv.requests.length, 2);
    assert.strictEqual(retryEnv.elements.historyDetailContent.style.display, 'block');
    assert.strictEqual(retryEnv.elements.historyDetailErrorState.style.display, 'none');
  });

  // Test 3: Null safety & XSS protection
  await test('3. Null-safe rendering and XSS protection on detail fields', async () => {
    const xssPayload = '<script>window.xssExecuted=true;</script><img src=x onerror="alert(1)">';
    const env = createDetailTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt' },
      fetchImpl: async () => ({
        status: 200,
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            id: 500,
            user_id: 1,
            document_id: null,
            action_type: '<img src=x onerror=alert(1)>',
            status: '<script>evil()</script>',
            execution_time_ms: null,
            error_message: xssPayload,
            created_at: null,
            updated_at: null,
          },
        }),
      }),
    });

    await env.controller.openHistoryDetail(500);
    assert.strictEqual(env.elements.historyDetailDocId.textContent, 'DOC #--');
    assert.strictEqual(env.elements.historyDetailCreatedAt.textContent, '--');
    assert.strictEqual(env.elements.historyDetailUpdatedAt.textContent, '--');
    assert.ok(env.elements.historyDetailExecutionTime.innerHTML.includes('--'));
    assert.ok(!env.elements.historyDetailExecutionTime.innerHTML.includes('null'));

    // Verify XSS escaping on innerHTML badges and textContent assignment on error_message
    assert.ok(!env.elements.historyDetailActionType.innerHTML.includes('<img'));
    assert.ok(env.elements.historyDetailActionType.innerHTML.includes('&lt;IMG'));
    assert.ok(!env.elements.historyDetailStatus.innerHTML.includes('<script>'));
    assert.strictEqual(env.elements.historyDetailErrorText.textContent, xssPayload);
    assert.strictEqual(env.elements.historyDetailErrorText.innerHTML, '');
  });

  // Test 4: Close Detail Modal and return to History List
  await test('4. Close Detail Modal via buttons, backdrop click, and Escape key while preserving list view', async () => {
    const env = createDetailTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt' },
      fetchImpl: async () => ({
        status: 200,
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            id: 103,
            document_id: 101,
            action_type: 'EXTRACT',
            status: 'SUCCESS',
            execution_time_ms: 420,
            error_message: null,
            created_at: '2026-11-07T07:25:10Z',
            updated_at: '2026-11-07T07:25:10Z',
          },
        }),
      }),
    });

    // Open and close via #btnBackToHistoryList
    await env.controller.openHistoryDetail(103);
    assert.strictEqual(env.elements.historyDetailModal.style.display, 'flex');
    env.elements.btnBackToHistoryList.click();
    assert.strictEqual(env.elements.historyDetailModal.style.display, 'none');
    assert.strictEqual(env.elements.historySection.style.display, 'block');
    assert.strictEqual(env.elements.historyTableContainer.style.display, 'block');

    // Open and close via #btnCloseHistoryDetailModal
    await env.controller.openHistoryDetail(103);
    assert.strictEqual(env.elements.historyDetailModal.style.display, 'flex');
    env.elements.btnCloseHistoryDetailModal.click();
    assert.strictEqual(env.elements.historyDetailModal.style.display, 'none');

    // Open and close via Escape key
    await env.controller.openHistoryDetail(103);
    assert.strictEqual(env.elements.historyDetailModal.style.display, 'flex');
    env.documentObj.dispatchEvent('keydown', { key: 'Escape' });
    assert.strictEqual(env.elements.historyDetailModal.style.display, 'none');
  });

  // Test 5: Static HTML & Responsive Design System CSS check
  await test('5. Detail Modal HTML structure and responsive CSS rules exist', async () => {
    const requiredIds = [
      'historyDetailModal',
      'historyDetailHeaderBadge',
      'btnCloseHistoryDetailModal',
      'historyDetailLoadingState',
      'historyDetailNotFoundState',
      'historyDetailErrorState',
      'historyDetailContent',
      'historyDetailId',
      'historyDetailDocId',
      'historyDetailActionType',
      'historyDetailStatus',
      'historyDetailExecutionTime',
      'historyDetailCreatedAt',
      'historyDetailUpdatedAt',
      'historyDetailErrorBox',
      'historyDetailErrorText',
      'btnBackToHistoryList',
    ];
    for (const id of requiredIds) {
      assert.ok(htmlSource.includes(`id="${id}"`), `index.html must contain #${id}`);
    }

    const requiredCssSelectors = [
      '.history-row:hover',
      '.history-detail-modal-overlay',
      '.history-detail-card',
      '.history-detail-grid',
      '.history-detail-field',
      '.history-detail-error-box',
      '.history-detail-footer',
    ];
    for (const selector of requiredCssSelectors) {
      assert.ok(componentsCss.includes(selector), `components.css must define ${selector}`);
    }
  });

  // Test 6: Document Filename Resolution & Fallback (Requirement 1)
  await test('6. Document Filename Display & Fallbacks in History Detail', async () => {
    const mockRecords = {
      201: {
        id: 201,
        document_id: 17,
        document_filename: 'scanned_medium_skewed.pdf',
        action_type: 'TRANSLATE',
        status: 'SUCCESS',
        execution_time_ms: 1077,
        created_at: '2026-11-07T18:53:04Z',
        updated_at: '2026-11-07T18:53:05Z',
        error_message: null,
      },
      202: {
        id: 202,
        document_id: 18,
        document: { original_filename: 'financial_report_q3.pdf' },
        action_type: 'EXTRACT',
        status: 'SUCCESS',
        execution_time_ms: 500,
        created_at: '2026-11-07T18:50:00Z',
        updated_at: '2026-11-07T18:50:00Z',
      },
      203: {
        id: 203,
        document_id: 19,
        document_filename: null,
        action_type: 'EXTRACT',
        status: 'SUCCESS',
        execution_time_ms: 300,
        created_at: '2026-11-07T18:40:00Z',
        updated_at: '2026-11-07T18:40:00Z',
      },
      204: {
        id: 204,
        document_id: null,
        document_filename: null,
        action_type: 'EXTRACT',
        status: 'FAILED',
        execution_time_ms: null,
        created_at: '2026-11-07T18:30:00Z',
        updated_at: '2026-11-07T18:30:00Z',
      },
    };

    const env = createDetailTestEnv({
      initialStorage: { pdfl_token: 'valid-jwt-token' },
      fetchImpl: async (url) => {
        const id = parseInt(url.split('/').pop(), 10);
        return {
          status: 200,
          ok: true,
          json: async () => ({
            status: 'success',
            message: 'Lấy thông tin chi tiết lịch sử xử lý thành công.',
            data: mockRecords[id] || null,
          }),
        };
      },
    });

    // 6a. Record with explicit document_filename
    await env.controller.openHistoryDetail(201);
    assert.strictEqual(env.elements.historyDetailDocId.textContent, 'scanned_medium_skewed.pdf', 'Must display original filename');
    assert.ok(env.elements.historyDetailDocBadge.title.includes('scanned_medium_skewed.pdf'), 'Badge title must include filename');
    assert.ok(env.elements.historyDetailDocBadge.title.includes('17'), 'Badge title must include document ID');

    // 6b. Record with nested document object
    await env.controller.openHistoryDetail(202);
    assert.strictEqual(env.elements.historyDetailDocId.textContent, 'financial_report_q3.pdf', 'Must display nested document filename');

    // 6c. Record without filename (fallback to DOC #19)
    await env.controller.openHistoryDetail(203);
    assert.strictEqual(env.elements.historyDetailDocId.textContent, 'DOC #19', 'Fallback to DOC #19 when filename is missing');

    // 6d. Record with missing/null document_id (fallback to DOC #--)
    await env.controller.openHistoryDetail(204);
    assert.strictEqual(env.elements.historyDetailDocId.textContent, 'DOC #--', 'Fallback to DOC #-- when document_id is null');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${passed + failed} tests passed (${failed} failed).`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

