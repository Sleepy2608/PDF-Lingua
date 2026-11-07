/**
 * Regression Test Suite for BUG-01 & BUG-02 Fixes
 * --------------------------------------------------------------------------
 * BUG-01: Toast notifications deduplication, single toast enforcement,
 *         3-second auto-close, and rapid-click flood prevention.
 * BUG-02: Section navigation coordination between History, Documents,
 *         Workspace, and Hero sections, preventing overlapping views.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');
const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../js/sidebar.js'), 'utf8');
const historySource = fs.readFileSync(path.resolve(__dirname, '../js/history.js'), 'utf8');

class ClassList {
  constructor() { this.values = new Set(); }
  add(v) { this.values.add(v); }
  remove(v) { this.values.delete(v); }
  contains(v) { return this.values.has(v); }
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
    this.parentNode = null;
    this.dataset = {};
  }
  set innerHTML(val) {
    this._innerHTML = String(val);
    if (val === '') {
      this.children = [];
    }
  }
  get innerHTML() { return this._innerHTML; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }
  get firstChild() {
    return this.children.length > 0 ? this.children[0] : null;
  }
  click() {
    const handlers = this.listeners['click'] || [];
    const event = {
      defaultPrevented: false,
      preventDefault: () => { },
      stopPropagation: () => { },
      currentTarget: this,
      target: this,
    };
    for (const h of handlers) h(event);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('PDF-Lingua Regression Test Suite: BUG-01 & BUG-02 Fixes');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      console.error(err.stack);
      failed++;
    }
  }

  // ── TEST GROUP 1: BUG-01 Toast Notification ──────────────────────────────

  await test('BUG-01: Single toast notification displays correctly with 3s timer', () => {
    const toastContainer = new MockElement('toastContainer');
    let capturedTimeout = null;
    let capturedDelay = null;

    const mockWindow = {
      location: { protocol: 'http:', port: '5500', href: 'http://localhost:5500/' },
      addEventListener: () => { },
    };

    const sandbox = {
      document: {
        getElementById: (id) => (id === 'toastContainer' ? toastContainer : null),
        createElement: (tag) => new MockElement('', tag),
        addEventListener: () => { },
      },
      window: mockWindow,
      setTimeout: (fn, delay) => {
        capturedTimeout = fn;
        capturedDelay = delay;
        return 123;
      },
      clearTimeout: () => { },
      console,
    };

    vm.createContext(sandbox);
    vm.runInContext(workspaceSource, sandbox);

    sandbox.showToast('Vui lòng đăng nhập để xem lịch sử xử lý tài liệu của bạn.', 'error');

    assert.strictEqual(toastContainer.children.length, 1, 'Should have exactly 1 toast in container');
    const toast = toastContainer.children[0];
    assert.strictEqual(toast.className, 'toast error');
    assert.strictEqual(capturedDelay, 3000, 'Auto-close delay must be exactly 3000ms (3s)');

    // Trigger timer -> dismisses toast
    capturedTimeout();
    assert.strictEqual(toast.style.opacity, '0');
  });

  await test('BUG-01: Rapid clicks with identical message deduplicate and do NOT stack', () => {
    const toastContainer = new MockElement('toastContainer');
    let timeoutsSet = 0;

    const mockWindow = {
      location: { protocol: 'http:', port: '5500', href: 'http://localhost:5500/' },
      addEventListener: () => { },
    };

    const sandbox = {
      document: {
        getElementById: (id) => (id === 'toastContainer' ? toastContainer : null),
        createElement: (tag) => new MockElement('', tag),
        addEventListener: () => { },
      },
      window: mockWindow,
      setTimeout: (fn, delay) => {
        timeoutsSet++;
        return timeoutsSet;
      },
      clearTimeout: () => { },
      console,
    };

    vm.createContext(sandbox);
    vm.runInContext(workspaceSource, sandbox);

    const message = 'Vui lòng đăng nhập để xem lịch sử xử lý tài liệu của bạn.';

    // Simulate 10 rapid clicks from user
    for (let i = 0; i < 10; i++) {
      sandbox.showToast(message, 'error');
    }

    assert.strictEqual(
      toastContainer.children.length,
      1,
      'Container must NEVER stack identical toasts, must keep exactly 1'
    );
    assert.ok(timeoutsSet >= 10, 'Timer should have been reset on duplicate calls');
  });

  await test('BUG-01: New distinct toast replaces existing toast immediately', () => {
    const toastContainer = new MockElement('toastContainer');

    const mockWindow = {
      location: { protocol: 'http:', port: '5500', href: 'http://localhost:5500/' },
      addEventListener: () => { },
    };

    const sandbox = {
      document: {
        getElementById: (id) => (id === 'toastContainer' ? toastContainer : null),
        createElement: (tag) => new MockElement('', tag),
        addEventListener: () => { },
      },
      window: mockWindow,
      setTimeout: (fn) => fn,
      clearTimeout: () => { },
      console,
    };

    vm.createContext(sandbox);
    vm.runInContext(workspaceSource, sandbox);

    sandbox.showToast('Thông báo 1', 'info');
    assert.strictEqual(toastContainer.children.length, 1);
    assert.strictEqual(toastContainer.children[0].children[0].textContent, 'Thông báo 1');

    sandbox.showToast('Thông báo 2', 'success');
    assert.strictEqual(toastContainer.children.length, 1, 'Must maintain max 1 toast even when message changes');
    assert.strictEqual(toastContainer.children[0].children[0].textContent, 'Thông báo 2');
  });

  // ── TEST GROUP 2: BUG-02 Sidebar History & Documents Switching ────────────

  await test('BUG-02: Switching History -> Documents -> History properly hides Documents and reveals History', () => {
    const elements = {
      heroSection: new MockElement('heroSection', 'section'),
      workspaceSection: new MockElement('workspaceSection', 'section'),
      adminSection: new MockElement('adminSection', 'section'),
      documentsSection: new MockElement('documentsSection', 'section'),
      historySection: new MockElement('historySection', 'section'),
      sideNavHome: new MockElement('sideNavHome', 'a'),
      sideNavTranslate: new MockElement('sideNavTranslate', 'a'),
      sideNavDocuments: new MockElement('sideNavDocuments', 'a'),
      sideNavHistory: new MockElement('sideNavHistory', 'a'),
      sideNavAdmin: new MockElement('sideNavAdmin', 'a'),
      toastContainer: new MockElement('toastContainer'),
      sidebarToggleBtn: new MockElement('sidebarToggleBtn'),
      appSidebar: new MockElement('appSidebar'),
      mainAppLayout: new MockElement('mainAppLayout'),
      headerBrandCollapsed: new MockElement('headerBrandCollapsed'),
      sidebarMobileToggleBtn: new MockElement('sidebarMobileToggleBtn'),
      sidebarBackdrop: new MockElement('sidebarBackdrop'),
    };

    const storage = {};
    const mockSessionStorage = {
      getItem: (k) => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
    };

    const mockWindow = {
      location: { protocol: 'http:', port: '5500', href: 'http://localhost:5500/' },
      addEventListener: () => { },
      scrollTo: () => { },
      innerWidth: 1024,
      sessionStorage: mockSessionStorage,
      localStorage: mockSessionStorage,
    };

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelectorAll: (sel) => {
          if (sel === '.sidebar-nav-item') {
            return [
              elements.sideNavHome,
              elements.sideNavTranslate,
              elements.sideNavDocuments,
              elements.sideNavHistory,
              elements.sideNavAdmin,
            ];
          }
          return [];
        },
        addEventListener: () => { },
        body: new MockElement('body'),
      },
      sessionStorage: mockSessionStorage,
      localStorage: mockSessionStorage,
      window: mockWindow,
      setTimeout: () => 1,
      clearTimeout: () => { },
      URLSearchParams,
      console,
    };

    vm.createContext(sandbox);
    vm.runInContext(sidebarSource, sandbox);

    assert.ok(mockWindow.PDFLinguaSidebar, 'PDFLinguaSidebar should be defined');

    // Initial state: Start at Home
    mockWindow.PDFLinguaSidebar.navigateToHome();
    assert.strictEqual(elements.heroSection.style.display, 'block');
    assert.strictEqual(elements.historySection.style.display, 'none');
    assert.strictEqual(elements.documentsSection.style.display, 'none');

    // 1. User clicks "Lịch sử xử lý"
    mockWindow.PDFLinguaSidebar.openHistoryView();
    assert.strictEqual(elements.historySection.style.display, 'block', 'History should be visible');
    assert.strictEqual(elements.documentsSection.style.display, 'none', 'Documents must be hidden');
    assert.strictEqual(elements.heroSection.style.display, 'none');
    assert.strictEqual(elements.workspaceSection.style.display, 'none');
    assert.strictEqual(elements.sideNavHistory.classList.contains('active'), true);
    assert.strictEqual(storage['pdfl_active_view'], 'history');

    // 2. User clicks "Tài liệu"
    mockWindow.PDFLinguaSidebar.openDocumentsView();
    assert.strictEqual(elements.documentsSection.style.display, 'block', 'Documents should be visible');
    assert.strictEqual(elements.historySection.style.display, 'none', 'History must be hidden');
    assert.strictEqual(elements.sideNavDocuments.classList.contains('active'), true);
    assert.strictEqual(storage['pdfl_active_view'], 'documents');

    // 3. User clicks "Lịch sử xử lý" again
    mockWindow.PDFLinguaSidebar.openHistoryView();
    assert.strictEqual(elements.historySection.style.display, 'block', 'History should be visible again');
    assert.strictEqual(elements.documentsSection.style.display, 'none', 'Documents MUST be hidden, no overlapping');
    assert.strictEqual(elements.sideNavHistory.classList.contains('active'), true);
    assert.strictEqual(storage['pdfl_active_view'], 'history');
  });

  await test('BUG-02: history.js openHistoryView hides documentsSection and sets active nav', () => {
    const elements = {
      heroSection: new MockElement('heroSection', 'section'),
      workspaceSection: new MockElement('workspaceSection', 'section'),
      adminSection: new MockElement('adminSection', 'section'),
      documentsSection: new MockElement('documentsSection', 'section'),
      historySection: new MockElement('historySection', 'section'),
      sideNavHistory: new MockElement('sideNavHistory', 'a'),
      historyTableContainer: new MockElement('historyTableContainer'),
      historyLoadingState: new MockElement('historyLoadingState'),
      historyEmptyState: new MockElement('historyEmptyState'),
      historyErrorState: new MockElement('historyErrorState'),
      historyTableBody: new MockElement('historyTableBody'),
      historyCountBadge: new MockElement('historyCountBadge'),
      historyPaginationInfo: new MockElement('historyPaginationInfo'),
      historyCurrentPageBadge: new MockElement('historyCurrentPageBadge'),
      btnHistoryPrevPage: new MockElement('btnHistoryPrevPage', 'button'),
      btnHistoryNextPage: new MockElement('btnHistoryNextPage', 'button'),
      docNameDisplay: new MockElement('docNameDisplay'),
    };

    // Initially simulate Documents view is open
    elements.documentsSection.style.display = 'block';
    elements.historySection.style.display = 'none';

    const storage = {};
    const mockSessionStorage = {
      getItem: (k) => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
    };

    let activeNavSet = null;
    const mockWindow = {
      location: { protocol: 'http:', port: '5500', href: 'http://localhost:5500/' },
      addEventListener: () => { },
      scrollTo: () => { },
      sessionStorage: mockSessionStorage,
      localStorage: mockSessionStorage,
      PDFLinguaSidebar: {
        setActiveNav: (k) => { activeNavSet = k; },
      },
    };

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelectorAll: () => [elements.sideNavHistory],
        addEventListener: () => { },
      },
      sessionStorage: mockSessionStorage,
      localStorage: mockSessionStorage,
      window: mockWindow,
      fetch: async () => ({
        status: 200,
        ok: true,
        json: async () => ({ status: 'success', data: [] }),
      }),
      setTimeout: () => 1,
      clearTimeout: () => { },
      URLSearchParams,
      console,
    };

    vm.createContext(sandbox);
    vm.runInContext(historySource, sandbox);

    assert.ok(mockWindow.pdfLinguaHistory, 'pdfLinguaHistory should be defined on window');
    mockWindow.pdfLinguaHistory.openHistoryView();

    assert.strictEqual(elements.documentsSection.style.display, 'none', 'Documents must be hidden by history.js');
    assert.strictEqual(elements.historySection.style.display, 'block', 'History must be shown');
    assert.strictEqual(activeNavSet, 'history', 'Sidebar nav must highlight history');
    assert.strictEqual(storage['pdfl_active_view'], 'history');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${passed + failed} tests passed (${failed} failed).`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();