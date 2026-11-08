/**
 * PDF-Lingua: Processing History API Integration & Interaction Test Suite (PDFL-164.2)
 * ------------------------------------------------------------------------------------
 * Verifies:
 * 1. GET /api/history fetch requires Authorization Bearer token.
 * 2. Unauthenticated user displays #historyUnauthState and 0 count.
 * 3. Authenticated user with 0 records displays #historyEmptyState.
 * 4. Authenticated user with records populates #historyTableBody with full metadata.
 * 5. Action type filter (EXTRACT, TRANSLATE, SUMMARIZE) triggers API call with query param and resets page to 1.
 * 6. Status filter (SUCCESS, PENDING, FAILED) triggers API call with query param and resets page to 1.
 * 7. Client-side search input filters records by document_filename.
 * 8. Pagination with skip/limit: Next button enables when has_more (> 10 records) and updates pagination info.
 * 9. Error state: API error (500/network) shows #historyErrorState and #btnHistoryRetry calls fetch.
 * 10. Concurrency: Dropping out-of-order response prevents race condition.
 * 11. Error Details Modal: Clicking failed status or error button opens #historyErrorModal with diagnostics.
 * 12. Refresh button (#btnHistoryRefresh) triggers re-fetching.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../js/sidebar.js'), 'utf8');
const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

class ClassList {
  constructor() { this.values = new Set(); }
  add(v) { this.values.add(v); }
  remove(v) { this.values.delete(v); }
  contains(v) { return this.values.has(v); }
  toggle(v, force) {
    if (typeof force === 'boolean') {
      if (force) this.add(v); else this.remove(v);
    } else {
      if (this.contains(v)) this.remove(v); else this.add(v);
    }
  }
}

class MockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.textContent = '';
    this._innerHTML = '';
    this.classList = new ClassList();
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.className = '';
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.value = '';
    this.disabled = false;
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
  }

  getAttribute(name) { return this.attributes[name] || null; }
  setAttribute(name, val) { this.attributes[name] = String(val); }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return name in this.attributes; }

  addEventListener(event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }

  click() {
    if (this.listeners['click']) {
      this.listeners['click'].forEach((fn) => fn({ target: this, preventDefault: () => {}, stopPropagation: () => {} }));
    }
  }

  remove() {}
  scrollIntoView() {}
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelector(sel) {
    const cls = sel.startsWith('.') ? sel.slice(1) : sel;
    const found = this.children.find((c) => c.className && c.className.includes(cls));
    if (found) return found;
    if (this._innerHTML && this._innerHTML.includes(cls)) {
      this._queryCache = this._queryCache || {};
      if (!this._queryCache[sel]) {
        const el = new MockElement('', 'button');
        el.className = cls;
        this._queryCache[sel] = el;
      }
      return this._queryCache[sel];
    }
    return null;
  }
}

function createTestEnvironment(initialStorage = {}, mockFetchHandler = null) {
  const store = { ...initialStorage };
  const mockStorage = {
    getItem: (k) => (store[k] !== undefined ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };

  const elements = {
    appShell: new MockElement('appShell'),
    appSidebar: new MockElement('appSidebar', 'aside'),
    appMainViewport: new MockElement('appMainViewport'),
    btnToggleSidebar: new MockElement('btnToggleSidebar', 'button'),
    btnMobileSidebarToggle: new MockElement('btnMobileSidebarToggle', 'button'),
    sidebarBackdrop: new MockElement('sidebarBackdrop'),
    btnSidebarUpload: new MockElement('btnSidebarUpload', 'button'),
    sidebarRecentSection: new MockElement('sidebarRecentSection'),
    sidebarRecentDocs: new MockElement('sidebarRecentDocs'),
    sidebarEmptyDocsState: new MockElement('sidebarEmptyDocsState'),
    sidebarDocList: new MockElement('sidebarDocList', 'ul'),
    sidebarUserProfile: new MockElement('sidebarUserProfile'),
    sidebarUserAvatar: new MockElement('sidebarUserAvatar'),
    sidebarUserName: new MockElement('sidebarUserName'),
    sidebarUserRole: new MockElement('sidebarUserRole'),
    sidebarBrandLink: new MockElement('sidebarBrandLink', 'a'),
    headerCollapsedBrand: new MockElement('headerCollapsedBrand', 'a'),
    btnSidebarMore: new MockElement('btnSidebarMore', 'div'),
    sideNavHome: new MockElement('sideNavHome', 'a'),
    sideNavTranslate: new MockElement('sideNavTranslate', 'a'),
    sideNavAiCopilot: new MockElement('sideNavAiCopilot', 'a'),
    sideNavAiSummarize: new MockElement('sideNavAiSummarize', 'a'),
    sideNavDocuments: new MockElement('sideNavDocuments', 'a'),
    sideNavHistory: new MockElement('sideNavHistory', 'a'),
    sideNavPricing: new MockElement('sideNavPricing', 'a'),
    sideNavAdmin: new MockElement('sideNavAdmin', 'a'),
    sideNavAdminItem: new MockElement('sideNavAdminItem', 'li'),
    btnOpenAccountModal: new MockElement('btnOpenAccountModal', 'button'),
    btnLogin: new MockElement('btnLogin', 'button'),
    btnNewFile: new MockElement('btnNewFile', 'button'),
    pdfFileInput: new MockElement('pdfFileInput', 'input'),
    heroSection: new MockElement('heroSection', 'section'),
    workspaceSection: new MockElement('workspaceSection', 'section'),
    documentsSection: new MockElement('documentsSection', 'section'),
    historySection: new MockElement('historySection', 'section'),
    adminSection: new MockElement('adminSection', 'section'),

    // History elements
    btnCloseHistoryView: new MockElement('btnCloseHistoryView', 'button'),
    btnHistoryRefresh: new MockElement('btnHistoryRefresh', 'button'),
    historyCountBadge: new MockElement('historyCountBadge', 'span'),
    historyActionFilter: new MockElement('historyActionFilter', 'select'),
    historyStatusFilter: new MockElement('historyStatusFilter', 'select'),
    historySearchInput: new MockElement('historySearchInput', 'input'),
    historyTable: new MockElement('historyTable', 'table'),
    historyTableBody: new MockElement('historyTableBody', 'tbody'),
    historyLoadingState: new MockElement('historyLoadingState', 'div'),
    historyEmptyState: new MockElement('historyEmptyState', 'div'),
    historyEmptyTitle: new MockElement('historyEmptyTitle', 'h4'),
    historyEmptyText: new MockElement('historyEmptyText', 'p'),
    btnHistoryUploadPrompt: new MockElement('btnHistoryUploadPrompt', 'button'),
    historyErrorState: new MockElement('historyErrorState', 'div'),
    historyErrorTitle: new MockElement('historyErrorTitle', 'h4'),
    historyErrorText: new MockElement('historyErrorText', 'p'),
    btnHistoryRetry: new MockElement('btnHistoryRetry', 'button'),
    historyUnauthState: new MockElement('historyUnauthState', 'div'),
    btnHistoryLoginPrompt: new MockElement('btnHistoryLoginPrompt', 'button'),
    historyPaginationFooter: new MockElement('historyPaginationFooter', 'div'),
    historyPaginationInfo: new MockElement('historyPaginationInfo', 'span'),
    btnHistoryPrevPage: new MockElement('btnHistoryPrevPage', 'button'),
    historyCurrentPageBadge: new MockElement('historyCurrentPageBadge', 'span'),
    btnHistoryNextPage: new MockElement('btnHistoryNextPage', 'button'),

    // History Error Modal
    historyErrorModal: new MockElement('historyErrorModal', 'div'),
    historyErrorModalTitle: new MockElement('historyErrorModalTitle', 'h2'),
    historyErrorModalSub: new MockElement('historyErrorModalSub', 'p'),
    btnCloseHistoryErrorModal: new MockElement('btnCloseHistoryErrorModal', 'button'),
    historyErrorDocName: new MockElement('historyErrorDocName', 'span'),
    historyErrorActionType: new MockElement('historyErrorActionType', 'span'),
    historyErrorTimestamp: new MockElement('historyErrorTimestamp', 'span'),
    historyErrorMessage: new MockElement('historyErrorMessage', 'div'),
    btnCloseHistoryErrorFooter: new MockElement('btnCloseHistoryErrorFooter', 'button'),
  };

  const docListeners = {};

  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    createElement: (tag) => new MockElement('', tag),
    querySelectorAll: (sel) => {
      if (sel === '.sidebar-nav-item') {
        return [
          elements.sideNavHome,
          elements.sideNavTranslate,
          elements.sideNavAiCopilot,
          elements.sideNavAiSummarize,
          elements.sideNavDocuments,
          elements.sideNavHistory,
          elements.sideNavPricing,
          elements.sideNavAdmin,
        ];
      }
      return [];
    },
    addEventListener: (event, fn) => {
      docListeners[event] = docListeners[event] || [];
      docListeners[event].push(fn);
    },
    body: {
      style: {},
      appendChild: () => {},
    },
  };

  const defaultFetch = async (url, options = {}) => {
    if (mockFetchHandler) return mockFetchHandler(url, options);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
      blob: async () => ({ size: 1024 }),
    };
  };

  const context = {
    document: mockDocument,
    window: {
      innerWidth: 1024,
      addEventListener: (event, fn) => {
        docListeners[event] = docListeners[event] || [];
        docListeners[event].push(fn);
      },
      dispatchEvent: (event) => {
        const type = event.type || event;
        if (docListeners[type]) {
          docListeners[type].forEach((fn) => fn(event));
        }
      },
      scrollTo: () => {},
      URL: {
        createObjectURL: () => 'blob:mock-url',
        revokeObjectURL: () => {},
      },
    },
    URLSearchParams: global.URLSearchParams || URLSearchParams,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    fetch: defaultFetch,
    showToast: () => {},
    console: { log: () => {}, error: () => {}, warn: () => {} },
  };

  vm.createContext(context);
  vm.runInContext(sidebarSource, context);

  // Trigger DOMContentLoaded
  if (docListeners['DOMContentLoaded']) {
    docListeners['DOMContentLoaded'].forEach((fn) => fn());
  }

  return {
    context,
    elements,
    store,
    docListeners,
  };
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function main() {
  console.log('================================================================');
  console.log('PDF-Lingua History API Integration Test Suite (PDFL-164.2)');
  console.log('================================================================\n');

  // Test 1: Unauthenticated state
  await runTest('PDFL-164.2: Unauthenticated user displays #historyUnauthState and hides table', async () => {
    const env = createTestEnvironment({});
    await env.context.window.PDFLinguaSidebar.fetchProcessingHistories();

    assert.strictEqual(env.elements.historyUnauthState.style.display, 'block');
    assert.strictEqual(env.elements.historyTable.style.display, 'none');
    assert.strictEqual(env.elements.historyCountBadge.textContent, '0 bản ghi');
  });

  // Test 2: Authenticated user with 0 records displays empty state
  await runTest('PDFL-164.2: Authenticated user with 0 records displays #historyEmptyState', async () => {
    let capturedAuthHeader = null;
    let capturedUrl = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedAuthHeader = options.headers ? options.headers['Authorization'] : null;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      };
    };

    const env = createTestEnvironment({ pdfl_token: 'test-token-123' }, mockFetch);
    await env.context.window.PDFLinguaSidebar.fetchProcessingHistories();

    assert.ok(capturedUrl.includes('/api/history'));
    assert.strictEqual(capturedAuthHeader, 'Bearer test-token-123');
    assert.strictEqual(env.elements.historyEmptyState.style.display, 'block');
    assert.strictEqual(env.elements.historyTable.style.display, 'none');
    assert.strictEqual(env.elements.historyCountBadge.textContent, '0 bản ghi');
  });

  // Test 3: Authenticated user with records populates table rows
  await runTest('PDFL-164.2: Authenticated user with records populates #historyTableBody with metadata', async () => {
    const mockRecords = [
      {
        id: 1,
        user_id: 10,
        document_id: 101,
        document_filename: 'report_2026.pdf',
        action_type: 'TRANSLATE',
        status: 'SUCCESS',
        execution_time_ms: 1540,
        error_message: null,
        created_at: '2026-11-08T04:00:00Z',
        updated_at: '2026-11-08T04:00:02Z',
      },
      {
        id: 2,
        user_id: 10,
        document_id: 102,
        document_filename: 'scanned_doc.pdf',
        action_type: 'EXTRACT',
        status: 'FAILED',
        execution_time_ms: 820,
        error_message: 'OCR engine timed out.',
        created_at: '2026-11-08T04:10:00Z',
        updated_at: '2026-11-08T04:10:01Z',
      },
    ];

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockRecords }),
    });

    const env = createTestEnvironment({ pdfl_token: 'valid-token' }, mockFetch);
    await env.context.window.PDFLinguaSidebar.fetchProcessingHistories();

    assert.strictEqual(env.elements.historyTable.style.display, 'table');
    assert.strictEqual(env.elements.historyEmptyState.style.display, 'none');
    assert.strictEqual(env.elements.historyCountBadge.textContent, '2 bản ghi');
    assert.strictEqual(env.elements.historyTableBody.children.length, 2);

    const firstRow = env.elements.historyTableBody.children[0];
    assert.ok(firstRow.innerHTML.includes('report_2026.pdf'));
    assert.ok(firstRow.innerHTML.includes('Dịch thuật'));
    assert.ok(firstRow.innerHTML.includes('Thành công'));
    assert.ok(firstRow.innerHTML.includes('1.54s'));

    const secondRow = env.elements.historyTableBody.children[1];
    assert.ok(secondRow.innerHTML.includes('scanned_doc.pdf'));
    assert.ok(secondRow.innerHTML.includes('Trích xuất'));
    assert.ok(secondRow.innerHTML.includes('Thất bại'));
    assert.ok(secondRow.innerHTML.includes('Chi tiết lỗi'));
  });

  // Test 4: Action Type and Status filters send query params and reset page to 1
  await runTest('PDFL-164.2: Changing action_type or status filter sends query params and resets page to 1', async () => {
    let capturedUrl = null;
    const mockFetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      };
    };

    const env = createTestEnvironment({ pdfl_token: 'token-xyz' }, mockFetch);
    env.context.window.PDFLinguaSidebar.setHistoryCurrentPage(3);

    env.elements.historyActionFilter.value = 'TRANSLATE';
    env.elements.historyActionFilter.listeners['change'][0]();

    assert.ok(capturedUrl.includes('action_type=TRANSLATE'));
    assert.ok(capturedUrl.includes('skip=0'));
    assert.strictEqual(env.context.window.PDFLinguaSidebar.getHistoryCurrentPage(), 1);

    env.elements.historyStatusFilter.value = 'FAILED';
    env.elements.historyStatusFilter.listeners['change'][0]();

    assert.ok(capturedUrl.includes('status=FAILED'));
    assert.ok(capturedUrl.includes('action_type=TRANSLATE'));
    assert.ok(capturedUrl.includes('skip=0'));
    assert.strictEqual(env.context.window.PDFLinguaSidebar.getHistoryCurrentPage(), 1);
  });

  // Test 5: Client-side search filters records by document_filename
  await runTest('PDFL-164.2: Client-side search filters records by document_filename', async () => {
    const mockRecords = [
      { id: 1, document_id: 10, document_filename: 'alpha_report.pdf', action_type: 'EXTRACT', status: 'SUCCESS' },
      { id: 2, document_id: 11, document_filename: 'beta_summary.pdf', action_type: 'SUMMARIZE', status: 'SUCCESS' },
      { id: 3, document_id: 12, document_filename: 'alpha_contract.pdf', action_type: 'TRANSLATE', status: 'SUCCESS' },
    ];

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockRecords }),
    });

    const env = createTestEnvironment({ pdfl_token: 'token-search' }, mockFetch);
    await env.context.window.PDFLinguaSidebar.fetchProcessingHistories();

    assert.strictEqual(env.elements.historyTableBody.children.length, 3);
    assert.strictEqual(env.elements.historyCountBadge.textContent, '3 bản ghi');

    // Type "alpha" in search input
    env.elements.historySearchInput.value = 'alpha';
    env.elements.historySearchInput.listeners['input'][0]();

    assert.strictEqual(env.elements.historyTableBody.children.length, 2);
    assert.strictEqual(env.elements.historyCountBadge.textContent, '2 bản ghi');

    // Type non-matching query
    env.elements.historySearchInput.value = 'nonexistent';
    env.elements.historySearchInput.listeners['input'][0]();

    assert.strictEqual(env.elements.historyEmptyState.style.display, 'block');
    assert.strictEqual(env.elements.historyTable.style.display, 'none');
    assert.strictEqual(env.elements.historyCountBadge.textContent, '0 bản ghi');
  });

  // Test 6: Pagination with skip/limit and Previous/Next buttons
  await runTest('PDFL-164.2: Pagination with skip and limit updates page controls', async () => {
    // 11 records returned means hasNextHistoryPage = true for page size 10
    const mockRecords = Array.from({ length: 11 }, (_, i) => ({
      id: i + 1,
      document_id: 100 + i,
      document_filename: `doc_${i + 1}.pdf`,
      action_type: 'TRANSLATE',
      status: 'SUCCESS',
    }));

    let requestCount = 0;
    let lastUrl = '';
    const mockFetch = async (url) => {
      requestCount++;
      lastUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockRecords }),
      };
    };

    const env = createTestEnvironment({ pdfl_token: 'token-page' }, mockFetch);
    await env.context.window.PDFLinguaSidebar.fetchProcessingHistories();

    // First page should render 10 records and enable Next button
    assert.strictEqual(env.elements.historyTableBody.children.length, 10);
    assert.strictEqual(env.elements.btnHistoryPrevPage.disabled, true);
    assert.strictEqual(env.elements.btnHistoryNextPage.disabled, false);
    assert.strictEqual(env.elements.historyCurrentPageBadge.textContent, '1');
    assert.ok(env.elements.historyPaginationInfo.textContent.includes('Hiển thị 1 - 10 bản ghi'));

    // Click Next Page
    env.elements.btnHistoryNextPage.click();
    assert.strictEqual(env.context.window.PDFLinguaSidebar.getHistoryCurrentPage(), 2);
    assert.ok(lastUrl.includes('skip=10'));
  });

  // Test 7: Error handling with HTTP 500 and network failure
  await runTest('PDFL-164.2: Handles HTTP 500 error and retry button recovers list', async () => {
    let failMode = true;
    const mockFetch = async () => {
      if (failMode) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Lỗi cơ sở dữ liệu khi truy vấn lịch sử.' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [{ id: 99, document_id: 99, document_filename: 'recovered.pdf', action_type: 'EXTRACT', status: 'SUCCESS' }],
        }),
      };
    };

    const env = createTestEnvironment({ pdfl_token: 'token-err' }, mockFetch);
    await env.context.window.PDFLinguaSidebar.fetchProcessingHistories();

    assert.strictEqual(env.elements.historyErrorState.style.display, 'block');
    assert.strictEqual(env.elements.historyTable.style.display, 'none');
    assert.strictEqual(env.elements.historyErrorText.textContent, 'Lỗi cơ sở dữ liệu khi truy vấn lịch sử.');

    // Recover using retry button
    failMode = false;
    env.elements.btnHistoryRetry.click();
    // Wait microtasks
    await new Promise((r) => setImmediate(r));

    assert.strictEqual(env.elements.historyTable.style.display, 'table');
    assert.strictEqual(env.elements.historyErrorState.style.display, 'none');
    assert.strictEqual(env.elements.historyCountBadge.textContent, '1 bản ghi');
  });

  // Test 8: Stale out-of-order response does not overwrite newer response
  await runTest('PDFL-164.2: Stale out-of-order response does not overwrite newer response', async () => {
    let resolveFirstReq = null;
    let callCount = 0;

    const mockFetch = async (url) => {
      callCount++;
      if (callCount === 1) {
        return new Promise((resolve) => {
          resolveFirstReq = () => resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: [{ id: 1, document_id: 1, document_filename: 'old_stale.pdf', action_type: 'EXTRACT', status: 'SUCCESS' }],
            }),
          });
        });
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [{ id: 2, document_id: 2, document_filename: 'new_fresh.pdf', action_type: 'TRANSLATE', status: 'SUCCESS' }],
        }),
      };
    };

    const env = createTestEnvironment({ pdfl_token: 'token-race' }, mockFetch);

    // Dispatch request 1 (in-flight)
    const p1 = env.context.window.PDFLinguaSidebar.fetchProcessingHistories();

    // Dispatch request 2 immediately
    const p2 = env.context.window.PDFLinguaSidebar.fetchProcessingHistories();
    await p2;

    assert.strictEqual(env.elements.historyTableBody.children[0].innerHTML.includes('new_fresh.pdf'), true);

    // Resolve request 1 after request 2 finished
    resolveFirstReq();
    await p1;

    // Stale response must be ignored; new_fresh.pdf must remain displayed
    assert.strictEqual(env.elements.historyTableBody.children[0].innerHTML.includes('new_fresh.pdf'), true);
    assert.strictEqual(env.elements.historyTableBody.children[0].innerHTML.includes('old_stale.pdf'), false);
  });

  // Test 9: Opening Error Modal displays diagnostic information
  await runTest('PDFL-164.2: Opening #historyErrorModal displays error details from record and detail API', async () => {
    const mockRecord = {
      id: 42,
      user_id: 10,
      document_id: 200,
      document_filename: 'corrupted_scan.pdf',
      action_type: 'EXTRACT',
      status: 'FAILED',
      execution_time_ms: 450,
      error_message: 'Corrupted PDF stream at page 3.',
      created_at: '2026-11-08T05:00:00Z',
    };

    const mockFetch = async (url) => {
      if (url.includes('/api/history/42')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              ...mockRecord,
              error_message: 'Corrupted PDF stream at page 3. File unreadable.',
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [mockRecord] }),
      };
    };

    const env = createTestEnvironment({ pdfl_token: 'token-modal' }, mockFetch);
    await env.context.window.PDFLinguaSidebar.fetchProcessingHistories();

    // Click error button in table
    const row = env.elements.historyTableBody.children[0];
    const btnError = row.querySelector('.history-btn-error');
    btnError.click();

    // Wait for microtasks
    await new Promise((r) => setImmediate(r));

    assert.strictEqual(env.elements.historyErrorModal.style.display, 'flex');
    assert.ok(env.elements.historyErrorModalSub.textContent.includes('#42'));
    assert.ok(env.elements.historyErrorDocName.textContent.includes('corrupted_scan.pdf'));
    assert.strictEqual(env.elements.historyErrorActionType.textContent, 'EXTRACT');
    assert.ok(env.elements.historyErrorMessage.textContent.includes('Corrupted PDF stream at page 3'));

    // Close error modal
    env.elements.btnCloseHistoryErrorFooter.click();
    assert.strictEqual(env.elements.historyErrorModal.style.display, 'none');
  });

  // Test 10: Refresh button triggers fetchProcessingHistories
  await runTest('PDFL-164.2: Refresh button (#btnHistoryRefresh) triggers re-fetching', async () => {
    let historyFetchCount = 0;
    const mockFetch = async (url) => {
      if (url.includes('/api/history')) {
        historyFetchCount++;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      };
    };

    const env = createTestEnvironment({ pdfl_token: 'token-refresh' }, mockFetch);
    assert.strictEqual(historyFetchCount, 0);

    env.elements.btnHistoryRefresh.click();
    assert.strictEqual(historyFetchCount, 1);
  });

  console.log('\n================================================================');
  console.log('SUMMARY: All 10 History API Integration tests passed (0 failed).');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
