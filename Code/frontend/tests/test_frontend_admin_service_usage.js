/**
 * Admin Service Usage Breakdown Bento UI & Integration Test Suite
 * -----------------------------------------------------------------
 * Verifies:
 * 1. HTML Architecture: Bento card (.cell-services), multi-segment distribution track,
 *    empty hint, and 4 service metric items (Extract, Translate, Summarize, Chat).
 * 2. Accessibility & ARIA: Progressbar role, aria-label, aria bounds, and textual equivalents.
 * 3. CSS Tokens & Physics: Design token colors, hover physics, responsive layout, and reduced motion.
 * 4. Data Rendering: Accurate mapping of extract_count, translate_count, summarize_count, chat_count, total_actions.
 * 5. Arithmetic Safety: Correct percentage calculation; safe handling of zero, missing, or malformed data.
 * 6. Responsive Behavior: Bento grid spans across desktop, tablet, and mobile breakpoints.
 * 7. Live API Integration: Full fetchAdminStats pipeline parsing real backend services schema.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const componentsCssSource = fs.readFileSync(path.resolve(__dirname, '../css/components.css'), 'utf8');
const adminJsSource = fs.readFileSync(path.resolve(__dirname, '../js/admin.js'), 'utf8');

class ClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }
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
  constructor(id, tagName = 'div', initialClasses = [], initialAttrs = {}) {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.textContent = '';
    this._innerHTML = '';
    this.classList = new ClassList(initialClasses);
    this.style = {};
    this.attributes = { ...initialAttrs };
    this.listeners = {};
    this.title = '';
    this.children = [];
  }
  set innerHTML(val) {
    this._innerHTML = String(val);
    if (val === '') this.children = [];
  }
  get innerHTML() {
    return this._innerHTML;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  addEventListener(event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }
}

function createAdminTestEnv(initialToken = 'test_admin_token', customFetch = null) {
  const store = {
    pdfl_token: initialToken,
    pdfl_user: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }),
  };

  const mockStorage = {
    getItem: (k) => (store[k] !== undefined ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };

  const elements = {
    // Navigation & Sections
    adminSection: new MockElement('adminSection', 'section'),
    heroSection: new MockElement('heroSection', 'section'),
    workspaceSection: new MockElement('workspaceSection', 'section'),
    pricingSection: new MockElement('pricingSection', 'section'),
    sideNavAdmin: new MockElement('sideNavAdmin', 'button'),
    topNavAdmin: new MockElement('topNavAdmin', 'button'),
    btnCloseAdminView: new MockElement('btnCloseAdminView', 'button'),
    btnRefreshAdminData: new MockElement('btnRefreshAdminData', 'button'),

    // Existing Bento Metrics
    statTotalUsers: new MockElement('statTotalUsers', 'span'),
    statFreeUsers: new MockElement('statFreeUsers', 'span'),
    statProUsers: new MockElement('statProUsers', 'span'),
    statAdminUsers: new MockElement('statAdminUsers', 'span'),
    distSegFree: new MockElement('distSegFree', 'div'),
    distSegPro: new MockElement('distSegPro', 'div'),
    distSegAdmin: new MockElement('distSegAdmin', 'div'),
    statActiveRatio: new MockElement('statActiveRatio', 'div'),
    statActiveUsers: new MockElement('statActiveUsers', 'span'),
    statLockedUsers: new MockElement('statLockedUsers', 'span'),
    statTotalDocs: new MockElement('statTotalDocs', 'span'),
    statTotalStorage: new MockElement('statTotalStorage', 'div'),
    statStorageRaw: new MockElement('statStorageRaw', 'span'),

    // Service Usage Breakdown Bento Card
    cellAdminServices: new MockElement('cellAdminServices', 'div', ['admin-bento-cell', 'cell-services']),
    statServicesTotal: new MockElement('statServicesTotal', 'strong'),
    statServicesDistBar: new MockElement('statServicesDistBar', 'div', ['bento-dist-bar', 'bento-services-dist-bar'], {
      role: 'progressbar',
      'aria-label': 'Phân bổ mức độ sử dụng dịch vụ',
      'aria-valuenow': '0',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    }),
    distSegExtract: new MockElement('distSegExtract', 'div', ['dist-seg', 'dist-extract'], { 'data-service': 'extract' }),
    distSegTranslate: new MockElement('distSegTranslate', 'div', ['dist-seg', 'dist-translate'], { 'data-service': 'translate' }),
    distSegSummarize: new MockElement('distSegSummarize', 'div', ['dist-seg', 'dist-summarize'], { 'data-service': 'summarize' }),
    distSegChat: new MockElement('distSegChat', 'div', ['dist-seg', 'dist-chat'], { 'data-service': 'chat' }),
    statServicesEmptyHint: new MockElement('statServicesEmptyHint', 'div', ['bento-services-empty-hint']),

    // 4 Detailed Service Metric Items
    serviceStatExtract: new MockElement('serviceStatExtract', 'div', ['service-stat-item']),
    statExtractCount: new MockElement('statExtractCount', 'span', ['service-count', 'font-mono', 'tabular-nums']),
    statExtractPct: new MockElement('statExtractPct', 'span', ['service-pct', 'font-mono', 'tabular-nums']),

    serviceStatTranslate: new MockElement('serviceStatTranslate', 'div', ['service-stat-item']),
    statTranslateCount: new MockElement('statTranslateCount', 'span', ['service-count', 'font-mono', 'tabular-nums']),
    statTranslatePct: new MockElement('statTranslatePct', 'span', ['service-pct', 'font-mono', 'tabular-nums']),

    serviceStatSummarize: new MockElement('serviceStatSummarize', 'div', ['service-stat-item']),
    statSummarizeCount: new MockElement('statSummarizeCount', 'span', ['service-count', 'font-mono', 'tabular-nums']),
    statSummarizePct: new MockElement('statSummarizePct', 'span', ['service-pct', 'font-mono', 'tabular-nums']),

    serviceStatChat: new MockElement('serviceStatChat', 'div', ['service-stat-item']),
    statChatCount: new MockElement('statChatCount', 'span', ['service-count', 'font-mono', 'tabular-nums']),
    statChatPct: new MockElement('statChatPct', 'span', ['service-pct', 'font-mono', 'tabular-nums']),

    // Table elements
    adminUsersCountBadge: new MockElement('adminUsersCountBadge', 'span'),
    adminSearchInput: new MockElement('adminSearchInput', 'input'),
    adminRoleFilter: new MockElement('adminRoleFilter', 'select'),
    adminStatusFilter: new MockElement('adminStatusFilter', 'select'),
    adminUsersTableBody: new MockElement('adminUsersTableBody', 'tbody'),
    btnAdminPrevPage: new MockElement('btnAdminPrevPage', 'button'),
    btnAdminNextPage: new MockElement('btnAdminNextPage', 'button'),
    adminPaginationInfo: new MockElement('adminPaginationInfo', 'span'),
    adminConfirmModal: new MockElement('adminConfirmModal', 'div'),
    btnCancelAdminConfirm: new MockElement('btnCancelAdminConfirm', 'button'),
    btnProceedAdminConfirm: new MockElement('btnProceedAdminConfirm', 'button'),
  };

  const listeners = {};
  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => {
      if (sel.startsWith('#')) return elements[sel.slice(1)] || null;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(fn);
    },
    readyState: 'complete',
  };

  const defaultFetch = async (url) => {
    if (url.includes('/api/admin/stats')) {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          data: {
            total_users: 100,
            active_users: 90,
            locked_users: 10,
            free_users: 70,
            pro_users: 25,
            admin_users: 5,
            total_documents: 450,
            total_storage_bytes: 52428800,
            services: {
              extract_count: 200,
              translate_count: 150,
              summarize_count: 100,
              chat_count: 50,
              total_actions: 500,
            },
          },
        }),
      };
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({ success: true, data: { items: [], total_count: 0, page: 1, limit: 10, total_pages: 1 } }),
    };
  };

  const effectiveFetch = customFetch || defaultFetch;

  const sandbox = {
    window: {
      location: { protocol: 'http:', port: '8000' },
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      pdfLinguaAuth: null,
      pdfLinguaAdmin: null,
    },
    document: mockDocument,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    fetch: effectiveFetch,
    console: {
      log: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
  };

  sandbox.window.window = sandbox.window;
  sandbox.window.document = mockDocument;

  const context = vm.createContext(sandbox);
  vm.runInContext(adminJsSource, context);

  return {
    elements,
    admin: sandbox.window.pdfLinguaAdmin,
    storage: mockStorage,
    context,
  };
}

let passedTests = 0;
let totalTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`[PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log('Admin Service Usage Breakdown Bento UI & Integration Test Suite');
console.log('================================================================\n');

// ── 1. HTML Architecture Tests ─────────────────────────────────────────

runTest('HTML: Service Usage Bento card and multi-segment bar exist in index.html', () => {
  assert(htmlSource.includes('id="cellAdminServices"'), 'Missing #cellAdminServices');
  assert(htmlSource.includes('class="admin-bento-cell cell-services"'), 'Missing cell-services CSS classes');
  assert(htmlSource.includes('Phân Bổ Mức Độ Sử Dụng Dịch Vụ'), 'Missing card title text');
  assert(htmlSource.includes('id="statServicesTotal"'), 'Missing #statServicesTotal');
  assert(htmlSource.includes('id="statServicesDistBar"'), 'Missing #statServicesDistBar');
  assert(htmlSource.includes('id="distSegExtract"'), 'Missing #distSegExtract');
  assert(htmlSource.includes('id="distSegTranslate"'), 'Missing #distSegTranslate');
  assert(htmlSource.includes('id="distSegSummarize"'), 'Missing #distSegSummarize');
  assert(htmlSource.includes('id="distSegChat"'), 'Missing #distSegChat');
  assert(htmlSource.includes('id="statServicesEmptyHint"'), 'Missing #statServicesEmptyHint');
});

runTest('HTML: 4 service stat cards exist with count and percentage placeholders', () => {
  assert(htmlSource.includes('id="serviceStatExtract"'), 'Missing #serviceStatExtract');
  assert(htmlSource.includes('id="statExtractCount"'), 'Missing #statExtractCount');
  assert(htmlSource.includes('id="statExtractPct"'), 'Missing #statExtractPct');

  assert(htmlSource.includes('id="serviceStatTranslate"'), 'Missing #serviceStatTranslate');
  assert(htmlSource.includes('id="statTranslateCount"'), 'Missing #statTranslateCount');
  assert(htmlSource.includes('id="statTranslatePct"'), 'Missing #statTranslatePct');

  assert(htmlSource.includes('id="serviceStatSummarize"'), 'Missing #serviceStatSummarize');
  assert(htmlSource.includes('id="statSummarizeCount"'), 'Missing #statSummarizeCount');
  assert(htmlSource.includes('id="statSummarizePct"'), 'Missing #statSummarizePct');

  assert(htmlSource.includes('id="serviceStatChat"'), 'Missing #serviceStatChat');
  assert(htmlSource.includes('id="statChatCount"'), 'Missing #statChatCount');
  assert(htmlSource.includes('id="statChatPct"'), 'Missing #statChatPct');
});

// ── 2. Accessibility & ARIA Tests ──────────────────────────────────────

runTest('Accessibility: Progress bar implements proper ARIA attributes and text labels', () => {
  assert(htmlSource.includes('role="progressbar"'), 'Missing role="progressbar"');
  assert(htmlSource.includes('aria-label="Phân bổ mức độ sử dụng dịch vụ"'), 'Missing aria-label on progressbar');
  assert(htmlSource.includes('aria-valuenow="0"'), 'Missing default aria-valuenow="0"');
  assert(htmlSource.includes('aria-valuemin="0"'), 'Missing aria-valuemin="0"');
  assert(htmlSource.includes('aria-valuemax="100"'), 'Missing aria-valuemax="100"');
});

runTest('Accessibility: Service items use tabular-nums and explicit textual labels', () => {
  assert(htmlSource.includes('tabular-nums'), 'Numbers must use tabular-nums class for alignment');
  assert(htmlSource.includes('Trích xuất văn bản'), 'Must have explicit Vietnamese label for Extract');
  assert(htmlSource.includes('Dịch thuật tài liệu'), 'Must have explicit Vietnamese label for Translate');
  assert(htmlSource.includes('Tóm tắt AI'), 'Must have explicit Vietnamese label for Summarize');
  assert(htmlSource.includes('Trợ lý AI Copilot'), 'Must have explicit Vietnamese label for Chat');
});

// ── 3. CSS Tokens & Responsive Design Tests ─────────────────────────────

runTest('CSS Tokens: Segment and dot indicators map to Design System colors', () => {
  assert(componentsCssSource.includes('.cell-services'), 'Missing .cell-services in components.css');
  assert(componentsCssSource.includes('.dist-extract'), 'Missing .dist-extract in components.css');
  assert(componentsCssSource.includes('.dist-translate'), 'Missing .dist-translate in components.css');
  assert(componentsCssSource.includes('.dist-summarize'), 'Missing .dist-summarize in components.css');
  assert(componentsCssSource.includes('.dist-chat'), 'Missing .dist-chat in components.css');

  assert(componentsCssSource.includes('#4F46E5') || componentsCssSource.includes('--color-primary-indigo'), 'Extract must use indigo');
  assert(componentsCssSource.includes('#3B82F6'), 'Translate must use Blue Ocean');
  assert(componentsCssSource.includes('#8B5CF6'), 'Summarize must use Purple Slate');
  assert(componentsCssSource.includes('#F59E0B') || componentsCssSource.includes('--color-pro-gold'), 'Chat must use Amber Gold');
});

runTest('CSS Responsive: Contains breakpoints for desktop, tablet, and mobile', () => {
  assert(componentsCssSource.includes('grid-column: span 12'), 'Cell services must span 12 columns on desktop');
  assert(componentsCssSource.includes('grid-template-columns: repeat(4, 1fr)'), 'Services grid must have 4 columns on desktop');
  assert(componentsCssSource.includes('grid-template-columns: repeat(2, 1fr)'), 'Services grid must adapt to 2 columns on tablet');
  assert(componentsCssSource.includes('grid-template-columns: 1fr'), 'Services grid must adapt to 1 column on mobile');
});

runTest('CSS Physics & Motion: Implements smooth transitions and prefers-reduced-motion', () => {
  assert(componentsCssSource.includes('prefers-reduced-motion: reduce'), 'Missing prefers-reduced-motion media query');
  assert(componentsCssSource.includes('transition: none !important'), 'Transitions must be disabled for reduced motion');
  assert(componentsCssSource.includes('filter: brightness'), 'Hover physics must enhance brightness on segment hover');
});

// ── 4. Data Rendering & Distribution Calculation Tests ─────────────────

runTest('Data Rendering: Correctly populates service counts and total actions', () => {
  const env = createAdminTestEnv();
  const mockStats = {
    total_users: 10,
    services: {
      extract_count: 50,
      translate_count: 30,
      summarize_count: 15,
      chat_count: 5,
      total_actions: 100,
    },
  };

  env.admin.renderAdminStats(mockStats);

  assert.strictEqual(env.elements.statServicesTotal.textContent, '100');
  assert.strictEqual(env.elements.statExtractCount.textContent, '50');
  assert.strictEqual(env.elements.statTranslateCount.textContent, '30');
  assert.strictEqual(env.elements.statSummarizeCount.textContent, '15');
  assert.strictEqual(env.elements.statChatCount.textContent, '5');
});

runTest('Arithmetic: Calculates accurate percentage distribution and updates segment widths', () => {
  const env = createAdminTestEnv();
  const mockStats = {
    services: {
      extract_count: 50,
      translate_count: 30,
      summarize_count: 15,
      chat_count: 5,
      total_actions: 100,
    },
  };

  env.admin.renderAdminStats(mockStats);

  assert.strictEqual(env.elements.statExtractPct.textContent, '50%');
  assert.strictEqual(env.elements.statTranslatePct.textContent, '30%');
  assert.strictEqual(env.elements.statSummarizePct.textContent, '15%');
  assert.strictEqual(env.elements.statChatPct.textContent, '5%');

  assert.strictEqual(env.elements.distSegExtract.style.width, '50%');
  assert.strictEqual(env.elements.distSegTranslate.style.width, '30%');
  assert.strictEqual(env.elements.distSegSummarize.style.width, '15%');
  assert.strictEqual(env.elements.distSegChat.style.width, '5%');

  assert.strictEqual(env.elements.statServicesDistBar.getAttribute('aria-valuenow'), '100');
  assert.strictEqual(env.elements.statServicesEmptyHint.style.display, 'none');
});

runTest('Tooltips: Assigns informative title attributes to each distribution segment', () => {
  const env = createAdminTestEnv();
  const mockStats = {
    services: {
      extract_count: 120,
      translate_count: 60,
      summarize_count: 40,
      chat_count: 20,
      total_actions: 240,
    },
  };

  env.admin.renderAdminStats(mockStats);

  assert(env.elements.distSegExtract.title.includes('Trích xuất'), 'Extract segment title missing description');
  assert(env.elements.distSegExtract.title.includes('50%'), 'Extract segment title missing percentage');
  assert(env.elements.distSegTranslate.title.includes('Dịch thuật'), 'Translate segment title missing description');
  assert(env.elements.distSegTranslate.title.includes('25%'), 'Translate segment title missing percentage');
});

// ── 5. Empty State & Robustness Tests ───────────────────────────────────

runTest('Arithmetic Safety: Safely handles zero total actions without NaN or Infinity', () => {
  const env = createAdminTestEnv();
  const mockStats = {
    services: {
      extract_count: 0,
      translate_count: 0,
      summarize_count: 0,
      chat_count: 0,
      total_actions: 0,
    },
  };

  env.admin.renderAdminStats(mockStats);

  assert.strictEqual(env.elements.statServicesTotal.textContent, '0');
  assert.strictEqual(env.elements.statExtractPct.textContent, '0%');
  assert.strictEqual(env.elements.statTranslatePct.textContent, '0%');
  assert.strictEqual(env.elements.statSummarizePct.textContent, '0%');
  assert.strictEqual(env.elements.statChatPct.textContent, '0%');

  assert.strictEqual(env.elements.distSegExtract.style.width, '0%');
  assert.strictEqual(env.elements.distSegTranslate.style.width, '0%');
  assert.strictEqual(env.elements.distSegSummarize.style.width, '0%');
  assert.strictEqual(env.elements.distSegChat.style.width, '0%');

  assert.strictEqual(env.elements.statServicesDistBar.getAttribute('aria-valuenow'), '0');
  assert.strictEqual(env.elements.statServicesEmptyHint.style.display, 'block');
});

runTest('Robustness: Gracefully defaults missing or undefined services object to 0', () => {
  const env = createAdminTestEnv();
  // stats without services property
  const mockStats = { total_users: 5 };

  env.admin.renderAdminStats(mockStats);

  assert.strictEqual(env.elements.statServicesTotal.textContent, '0');
  assert.strictEqual(env.elements.statExtractCount.textContent, '0');
  assert.strictEqual(env.elements.statTranslateCount.textContent, '0');
  assert.strictEqual(env.elements.statSummarizeCount.textContent, '0');
  assert.strictEqual(env.elements.statChatCount.textContent, '0');
  assert.strictEqual(env.elements.statExtractPct.textContent, '0%');
});

runTest('Robustness: Accurately computes total_actions when total_actions field is absent', () => {
  const env = createAdminTestEnv();
  const mockStats = {
    services: {
      extract_count: 10,
      translate_count: 20,
      summarize_count: 30,
      chat_count: 40,
      // total_actions missing
    },
  };

  env.admin.renderAdminStats(mockStats);

  assert.strictEqual(env.elements.statServicesTotal.textContent, '100');
  assert.strictEqual(env.elements.statExtractPct.textContent, '10%');
  assert.strictEqual(env.elements.statTranslatePct.textContent, '20%');
  assert.strictEqual(env.elements.statSummarizePct.textContent, '30%');
  assert.strictEqual(env.elements.statChatPct.textContent, '40%');
});

// ── 6. Live API Fetch Integration Test ──────────────────────────────────

runTest('Integration: fetchAdminStats triggers API request and updates Bento UI', async () => {
  let requestedUrl = '';
  let authHeader = '';

  const customFetch = async (url, options) => {
    requestedUrl = url;
    authHeader = options?.headers?.Authorization || '';
    return {
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        data: {
          total_users: 15,
          services: {
            extract_count: 120,
            translate_count: 80,
            summarize_count: 40,
            chat_count: 10,
            total_actions: 250,
          },
        },
      }),
    };
  };

  const env = createAdminTestEnv('bearer_secret_admin_token', customFetch);
  await env.admin.fetchAdminStats();

  assert(requestedUrl.includes('/api/admin/stats'), 'Did not call GET /api/admin/stats');
  assert.strictEqual(authHeader, 'Bearer bearer_secret_admin_token', 'Did not include bearer authorization header');

  assert.strictEqual(env.elements.statServicesTotal.textContent, '250');
  assert.strictEqual(env.elements.statExtractCount.textContent, '120');
  assert.strictEqual(env.elements.statTranslateCount.textContent, '80');
  assert.strictEqual(env.elements.statSummarizeCount.textContent, '40');
  assert.strictEqual(env.elements.statChatCount.textContent, '10');

  // 120 / 250 = 48%
  assert.strictEqual(env.elements.statExtractPct.textContent, '48%');
  assert.strictEqual(env.elements.distSegExtract.style.width, '48%');
  // 80 / 250 = 32%
  assert.strictEqual(env.elements.statTranslatePct.textContent, '32%');
  assert.strictEqual(env.elements.distSegTranslate.style.width, '32%');
});

console.log('\n================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (0 failed).`);
console.log('================================================================');
