/**
 * PDF-Lingua: Collapsible Sidebar Navigation & Document Management Test Suite
 * -------------------------------------------------------------------------
 * Verifies:
 * 1. Static HTML structure: Presence of app shell, sidebar, primary "Tải PDF lên" button,
 *    nav items, clean empty docs state, and user profile card.
 * 2. Branding isolation: Main header does NOT contain redundant brand-link (single brand in sidebar).
 * 3. Removal of fake data: Zero mock pinned items, zero mock projects, zero mock papers.
 * 4. Primary Upload Action: Clicking "Tải PDF lên" opens native file picker and resets workspace view.
 * 5. Navigation Items: All 6 main items + admin toggle active state appropriately.
 * 6. Dynamic Documents & Empty State: Handles authenticated document retrieval, rendering, and empty state.
 * 7. User Profile Synchronization: Guest default ("Người dùng" / "Free / Pro"), Free, Pro, and Admin roles.
 * 8. Toggle & Responsive behavior: Desktop collapse/expand, localStorage persistence, Ctrl+B, mobile drawer & Escape.
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
  }
  set innerHTML(val) {
    this._innerHTML = String(val);
    if (val === '') {
      this.children = [];
    }
  }
  get innerHTML() {
    return this._innerHTML;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
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
    if (sel === '.sidebar-doc-download-btn' || sel === '.doc-table-download-btn' || sel === '.doc-table-detail-btn') {
      const cls = sel.slice(1);
      const found = this.children.find((c) => c.className && c.className.includes(cls));
      if (found) return found;
      if (this._innerHTML && this._innerHTML.includes(cls)) {
        this._queryCache = this._queryCache || {};
        if (!this._queryCache[sel]) {
          const btn = new MockElement('', 'button');
          btn.className = cls;
          this._queryCache[sel] = btn;
        }
        return this._queryCache[sel];
      }
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
    adminSection: new MockElement('adminSection', 'section'),
    btnCloseDocumentsView: new MockElement('btnCloseDocumentsView', 'button'),
    btnDocsUploadNew: new MockElement('btnDocsUploadNew', 'button'),
    documentsCountBadge: new MockElement('documentsCountBadge', 'span'),
    documentsTable: new MockElement('documentsTable', 'table'),
    documentsTableBody: new MockElement('documentsTableBody', 'tbody'),
    documentsLoadingState: new MockElement('documentsLoadingState', 'div'),
    documentsErrorState: new MockElement('documentsErrorState', 'div'),
    documentsErrorText: new MockElement('documentsErrorText', 'p'),
    btnDocsRetry: new MockElement('btnDocsRetry', 'button'),
    documentsUnauthState: new MockElement('documentsUnauthState', 'div'),
    btnDocsLoginPrompt: new MockElement('btnDocsLoginPrompt', 'button'),
    documentsEmptyState: new MockElement('documentsEmptyState', 'div'),
    documentsSearchInput: new MockElement('documentsSearchInput', 'input'),
    documentDetailModal: new MockElement('documentDetailModal', 'div'),
    documentDetailAlert: new MockElement('documentDetailAlert', 'div'),
    documentDetailLoading: new MockElement('documentDetailLoading', 'div'),
    documentDetailContent: new MockElement('documentDetailContent', 'div'),
    btnCloseDocumentDetailModal: new MockElement('btnCloseDocumentDetailModal', 'button'),
    btnCloseDocumentDetailFooter: new MockElement('btnCloseDocumentDetailFooter', 'button'),
    btnDocDetailDownload: new MockElement('btnDocDetailDownload', 'button'),
    docDetailDownloadSpinner: new MockElement('docDetailDownloadSpinner', 'span'),
    docDetailDownloadIcon: new MockElement('docDetailDownloadIcon', 'svg'),
    docDetailDownloadText: new MockElement('docDetailDownloadText', 'span'),
    btnDocDetailDelete: new MockElement('btnDocDetailDelete', 'button'),
    documentDeleteConfirmModal: new MockElement('documentDeleteConfirmModal', 'div'),
    docDeleteConfirmTitle: new MockElement('docDeleteConfirmTitle', 'h3'),
    docDeleteConfirmDesc: new MockElement('docDeleteConfirmDesc', 'p'),
    docDeleteConfirmFilename: new MockElement('docDeleteConfirmFilename', 'strong'),
    docDeleteConfirmAlert: new MockElement('docDeleteConfirmAlert', 'div'),
    btnCancelDocDelete: new MockElement('btnCancelDocDelete', 'button'),
    btnConfirmDocDelete: new MockElement('btnConfirmDocDelete', 'button'),
    docDeleteSpinner: new MockElement('docDeleteSpinner', 'span'),
    docDeleteBtnText: new MockElement('docDeleteBtnText', 'span'),
    docDetailHeroFilename: new MockElement('docDetailHeroFilename', 'h3'),
    docDetailHeroSub: new MockElement('docDetailHeroSub', 'p'),
    docDetailFilename: new MockElement('docDetailFilename', 'span'),
    docDetailId: new MockElement('docDetailId', 'span'),
    docDetailSize: new MockElement('docDetailSize', 'span'),
    docDetailPageCount: new MockElement('docDetailPageCount', 'span'),
    docDetailTargetLang: new MockElement('docDetailTargetLang', 'span'),
    docDetailOcrStatus: new MockElement('docDetailOcrStatus', 'span'),
    docDetailCreatedAt: new MockElement('docDetailCreatedAt', 'span'),
    btnOpenAdmin: new MockElement('btnOpenAdmin', 'button'),
  };

  elements.sidebarRecentDocs.appendChild(elements.sidebarEmptyDocsState);
  elements.sidebarRecentDocs.appendChild(elements.sidebarDocList);

  const docListeners = {};
  const winListeners = {};

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

  const mockWindow = {
    innerWidth: 1200,
    addEventListener: (event, fn) => {
      winListeners[event] = winListeners[event] || [];
      winListeners[event].push(fn);
    },
    dispatchEvent: (event) => {
      if (winListeners[event.type]) {
        winListeners[event.type].forEach((fn) => fn(event));
      }
    },
    scrollTo: () => {},
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    URL: {
      createObjectURL: () => 'blob:mock-url',
      revokeObjectURL: () => {},
    },
    pdfLinguaAdmin: {
      openAdminView: () => {},
      closeAdminView: () => {},
    },
  };

  const defaultFetch = async (url, options = {}) => {
    if (mockFetchHandler) return mockFetchHandler(url, options);
    return {
      ok: true,
      json: async () => ({ success: true, data: [] }),
      blob: async () => ({ size: 1024 }),
    };
  };

  const sandbox = {
    document: mockDocument,
    window: mockWindow,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    fetch: defaultFetch,
    CustomEvent: class CustomEvent {
      constructor(type, params = {}) {
        this.type = type;
        this.detail = params.detail || null;
      }
    },
    showToast: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
  };

  const context = vm.createContext(sandbox);
  vm.runInContext(sidebarSource, context);

  // Trigger DOMContentLoaded
  if (docListeners['DOMContentLoaded']) {
    docListeners['DOMContentLoaded'].forEach((fn) => fn());
  }

  return {
    elements,
    store,
    sandbox,
    docListeners,
    winListeners,
    triggerDocKeydown: (eventData) => {
      if (docListeners['keydown']) {
        docListeners['keydown'].forEach((fn) => fn(eventData));
      }
    },
    dispatchAuthChange: (user) => {
      sandbox.window.dispatchEvent(new sandbox.CustomEvent('pdfl:auth-change', { detail: { user } }));
    },
  };
}

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
  }
}

async function main() {
  console.log('================================================================');
  console.log('PDF-Lingua Sidebar Navigation & Document Management Test Suite');
  console.log('================================================================\n');

  // 1. Static HTML Markup: Single Brand & Required Elements
  await runTest('HTML: App Shell and Sidebar elements exist', () => {
    assert.ok(htmlSource.includes('id="appShell"'), 'appShell must exist');
    assert.ok(htmlSource.includes('id="appSidebar"'), 'appSidebar must exist');
    assert.ok(htmlSource.includes('id="appMainViewport"'), 'appMainViewport must exist');
    assert.ok(htmlSource.includes('id="sidebarBackdrop"'), 'sidebarBackdrop must exist');
    assert.ok(htmlSource.includes('id="btnToggleSidebar"'), 'btnToggleSidebar must exist');
    assert.ok(htmlSource.includes('id="btnMobileSidebarToggle"'), 'btnMobileSidebarToggle must exist');
    assert.ok(htmlSource.includes('id="btnSidebarUpload"'), 'btnSidebarUpload must exist');
    assert.ok(htmlSource.includes('id="sidebarUserProfile"'), 'sidebarUserProfile must exist');
  });

  await runTest('HTML: Single branding in sidebar and no redundant brand in main header', () => {
    // Sidebar has brand
    assert.ok(htmlSource.includes('class="sidebar-brand"'), 'sidebar-brand must exist in sidebar');
    // Site header should not contain brand-link
    const siteHeaderMatch = htmlSource.match(/<header class="site-header">([\s\S]*?)<\/header>/);
    assert.ok(siteHeaderMatch, 'site-header must be present');
    assert.ok(!siteHeaderMatch[1].includes('class="brand-link"'), 'site-header must NOT contain duplicate brand-link');
  });

  await runTest('HTML & CSS: Header brand appears when sidebar is collapsed', () => {
    assert.ok(htmlSource.includes('class="header-collapsed-brand"'), 'header-collapsed-brand must exist in site-header');
    const sidebarCss = fs.readFileSync(path.resolve(__dirname, '../css/sidebar.css'), 'utf8');
    assert.ok(sidebarCss.includes('.app-shell.sidebar-collapsed .header-collapsed-brand'), 'sidebar.css must show header-collapsed-brand when collapsed');
  });

  await runTest('Layout: Sidebar footer and site footer share synchronized height and border alignment', () => {
    const sidebarCss = fs.readFileSync(path.resolve(__dirname, '../css/sidebar.css'), 'utf8');
    const layoutCss = fs.readFileSync(path.resolve(__dirname, '../css/layout.css'), 'utf8');

    assert.ok(sidebarCss.includes('--footer-height: 68px'), 'sidebar.css must define synchronized --footer-height');
    assert.ok(sidebarCss.includes('height: var(--footer-height, 68px)'), '.sidebar-footer must use --footer-height');
    assert.ok(layoutCss.includes('height: var(--footer-height, 68px)'), '.site-footer must use --footer-height');
  });

  await runTest('HTML: Clean empty state for recent docs and zero mock items', () => {
    assert.ok(htmlSource.includes('TÀI LIỆU GẦN ĐÂY'), 'TÀI LIỆU GẦN ĐÂY section must exist');
    assert.ok(htmlSource.includes('Bạn chưa có tài liệu nào.'), 'Empty state main text must exist');
    assert.ok(htmlSource.includes('Hãy tải tài liệu đầu tiên của bạn!'), 'Empty state sub text must exist');

    // Must not have mock pinned items or fake papers
    assert.ok(!htmlSource.includes('Attention Is All You Need'), 'Mock paper 1 must be removed');
    assert.ok(!htmlSource.includes('Deep Learning Benchmark'), 'Mock paper 2 must be removed');
    assert.ok(!htmlSource.includes('Báo cáo tài chính song ngữ'), 'Mock paper 3 must be removed');
    assert.ok(!htmlSource.includes('Dự án Nghiên cứu AI'), 'Mock project 1 must be removed');
    assert.ok(!htmlSource.includes('Luận văn Tốt nghiệp'), 'Mock project 2 must be removed');
  });

  await runTest('Action: Clicking empty state triggers file picker and upload', () => {
    const env = createTestEnvironment();
    let fileInputClicked = false;
    env.elements.pdfFileInput.click = () => { fileInputClicked = true; };

    env.elements.sidebarEmptyDocsState.click();
    assert.strictEqual(fileInputClicked, true, 'Clicking empty state must trigger file picker');
  });

  await runTest('HTML: Main navigation contains all 6 core items + admin item', () => {
    assert.ok(htmlSource.includes('id="sideNavHome"'), 'sideNavHome must exist');
    assert.ok(htmlSource.includes('id="sideNavTranslate"'), 'sideNavTranslate must exist');
    assert.ok(htmlSource.includes('id="sideNavAiCopilot"'), 'sideNavAiCopilot must exist');
    assert.ok(htmlSource.includes('id="sideNavAiSummarize"'), 'sideNavAiSummarize must exist');
    assert.ok(htmlSource.includes('id="sideNavDocuments"'), 'sideNavDocuments must exist');
    assert.ok(htmlSource.includes('id="sideNavPricing"'), 'sideNavPricing must exist');
    assert.ok(htmlSource.includes('id="sideNavAdminItem"'), 'sideNavAdminItem must exist');
  });

  // 2. Primary Upload Action
  await runTest('Action: Upload PDF button triggers file picker and resets workspace', () => {
    const env = createTestEnvironment();
    let fileInputClicked = false;
    let newFileClicked = false;
    env.elements.pdfFileInput.click = () => { fileInputClicked = true; };
    env.elements.btnNewFile.click = () => { newFileClicked = true; };
    env.elements.btnNewFile.offsetParent = {}; // simulate visible
    env.elements.adminSection.style.display = 'block';

    env.elements.btnSidebarUpload.click();

    assert.strictEqual(fileInputClicked, true, 'pdfFileInput click must be triggered');
    assert.strictEqual(newFileClicked, true, 'btnNewFile reset must be triggered');
    assert.strictEqual(env.elements.adminSection.style.display, 'none', 'adminSection must be hidden');
    assert.strictEqual(env.elements.heroSection.style.display, 'block', 'heroSection must be visible');
  });

  // 3. User Profile Sync & Roles
  await runTest('User Sync: Guest user renders default profile as Khách', () => {
    const env = createTestEnvironment();
    assert.strictEqual(env.elements.sidebarUserName.textContent, 'Khách');
    assert.strictEqual(env.elements.sidebarUserRole.textContent, '');
    assert.strictEqual(env.elements.sidebarUserRole.style.display, 'none');
    assert.strictEqual(env.elements.sideNavAdminItem.style.display, 'none');
    assert.strictEqual(env.elements.appShell.classList.contains('guest-mode'), false);
  });

  await runTest('User Sync: Pro VIP user renders amber role and user name', () => {
    const env = createTestEnvironment();
    env.dispatchAuthChange({ full_name: 'Nguyen Van A', email: 'a@example.com', role: 'pro' });

    assert.strictEqual(env.elements.sidebarUserAvatar.textContent, 'N');
    assert.strictEqual(env.elements.sidebarUserName.textContent, 'Nguyen Van A');
    assert.strictEqual(env.elements.sidebarUserRole.textContent, 'Gói Pro VIP');
    assert.strictEqual(env.elements.sidebarUserRole.style.color, '#F59E0B');
    assert.strictEqual(env.elements.sideNavAdminItem.style.display, 'none');
  });

  await runTest('User Sync: Admin user renders son red role and reveals admin menu item', () => {
    const env = createTestEnvironment();
    env.dispatchAuthChange({ full_name: 'Quản Trị Viên', email: 'admin@pdf-lingua.vn', role: 'admin' });

    assert.strictEqual(env.elements.sidebarUserAvatar.textContent, 'Q');
    assert.strictEqual(env.elements.sidebarUserName.textContent, 'Quản Trị Viên');
    assert.strictEqual(env.elements.sidebarUserRole.textContent, 'Quản trị viên');
    assert.strictEqual(env.elements.sidebarUserRole.style.color, '#C9201C');
    assert.strictEqual(env.elements.sideNavAdminItem.style.display, 'block');
  });

  await runTest('Action: User Profile click opens Login modal for guest', () => {
    const env = createTestEnvironment();
    let loginModalOpened = false;
    env.elements.btnLogin.click = () => { loginModalOpened = true; };

    env.elements.sidebarUserProfile.click();
    assert.strictEqual(loginModalOpened, true);
  });

  await runTest('Action: User Profile click opens Account modal for logged-in user', () => {
    const env = createTestEnvironment({
      pdfl_user: JSON.stringify({ id: 1, email: 'user@example.com', role: 'free' }),
    });
    let accountModalOpened = false;
    env.elements.btnOpenAccountModal.click = () => { accountModalOpened = true; };

    env.elements.sidebarUserProfile.click();
    assert.strictEqual(accountModalOpened, true);
  });

  // 4. Navigation Interactions
  await runTest('Navigation: Nav item clicks activate target and trigger actions', () => {
    const env = createTestEnvironment();

    // Click sideNavHome
    env.elements.sideNavHome.click();
    assert.strictEqual(env.elements.sideNavHome.classList.contains('active'), true);
    assert.strictEqual(env.elements.sideNavTranslate.classList.contains('active'), false);

    // Click sideNavTranslate without active doc -> prompts user and keeps sideNavHome active
    env.elements.sideNavTranslate.click();
    assert.strictEqual(env.elements.sideNavHome.classList.contains('active'), true);
    assert.strictEqual(env.elements.sideNavTranslate.classList.contains('active'), false);

    // Click sideNavTranslate with active doc -> activates sideNavTranslate and opens workspace
    env.sandbox.window.pdfLinguaWorkspace = {
      getCurrentDocData: () => ({ filename: 'sample.pdf', translated_text: 'sample translation' }),
    };
    env.elements.sideNavTranslate.click();
    assert.strictEqual(env.elements.sideNavTranslate.classList.contains('active'), true);
    assert.strictEqual(env.elements.sideNavHome.classList.contains('active'), false);

    // Click sideNavAdmin
    let adminOpened = false;
    env.sandbox.window.pdfLinguaAdmin = {
      openAdminView: () => { adminOpened = true; },
    };
    env.elements.sideNavAdmin.click();
    assert.strictEqual(env.elements.sideNavAdmin.classList.contains('active'), true);
    assert.strictEqual(adminOpened, true);
  });

  await runTest('PDFL-92.1: Sidebar item renamed to "Tài liệu" and main #documentsSection layout exists', () => {
    assert.ok(
      htmlSource.includes('id="sideNavDocuments" data-tooltip="Tài liệu"'),
      'sideNavDocuments must have data-tooltip="Tài liệu"'
    );
    assert.ok(
      htmlSource.includes('<span class="nav-item-text">Tài liệu</span>'),
      'sideNavDocuments label must be "Tài liệu"'
    );
    assert.ok(
      !htmlSource.includes('<span class="nav-item-text">Quản lý tài liệu</span>'),
      'Old label "Quản lý tài liệu" must be replaced'
    );
    assert.ok(
      htmlSource.includes('id="documentsSection"'),
      'Main content area must include #documentsSection'
    );
  });

  await runTest('PDFL-92.1: Clicking "Tài liệu" opens #documentsSection in main content and preserves workspace translation state', () => {
    const env = createTestEnvironment();

    // Click "Tài liệu" (#sideNavDocuments)
    env.elements.sideNavDocuments.click();
    assert.strictEqual(env.elements.sideNavDocuments.classList.contains('active'), true);
    assert.strictEqual(env.elements.documentsSection.style.display, 'block');
    assert.strictEqual(env.elements.heroSection.style.display, 'none');
    assert.strictEqual(env.elements.workspaceSection.style.display, 'none');
    assert.strictEqual(env.elements.adminSection.style.display, 'none');

    // Click "Quay lại Dịch PDF" (#btnCloseDocumentsView) when no active translation -> shows heroSection & activates sideNavHome
    env.elements.btnCloseDocumentsView.click();
    assert.strictEqual(env.elements.sideNavHome.classList.contains('active'), true);
    assert.strictEqual(env.elements.sideNavTranslate.classList.contains('active'), false);
    assert.strictEqual(env.elements.documentsSection.style.display, 'none');
    assert.strictEqual(env.elements.heroSection.style.display, 'block');

    // Simulate active translated document in workspace
    env.sandbox.window.pdfLinguaWorkspace = {
      getCurrentDocData: () => ({ filename: 'translated.pdf', translated_text: 'Xin chào' }),
    };

    // Switch to "Tài liệu" and back to "Dịch PDF" -> restores workspaceSection with translation
    env.elements.sideNavDocuments.click();
    assert.strictEqual(env.elements.documentsSection.style.display, 'block');
    assert.strictEqual(env.elements.workspaceSection.style.display, 'none');

    env.elements.sideNavTranslate.click();
    assert.strictEqual(env.elements.documentsSection.style.display, 'none');
    assert.strictEqual(env.elements.heroSection.style.display, 'none');
    assert.strictEqual(env.elements.workspaceSection.style.display, 'block');
  });

  await runTest('HTML: Admin button in account modal is removed', () => {
    assert.ok(!htmlSource.includes('id="btnAdminModalShortcut"'), 'btnAdminModalShortcut must be removed');
  });

  // 5. Dynamic Document Fetching & Rendering
  await runTest('Documents: Unauthenticated user displays empty state and hides doc list', async () => {
    const env = createTestEnvironment();
    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();

    assert.strictEqual(env.elements.sidebarEmptyDocsState.style.display, 'block');
    assert.strictEqual(env.elements.sidebarDocList.style.display, 'none');
  });

  await runTest('Documents: Authenticated user with documents renders dynamic list', async () => {
    const mockDocs = [
      {
        id: 101,
        original_filename: 'Artificial_Intelligence_Report.pdf',
        file_size_bytes: 2048576,
        created_at: '2026-11-05T10:00:00',
      },
      {
        id: 102,
        original_filename: 'Financial_Statement_Q3.pdf',
        file_size_bytes: 524288,
        created_at: '2026-11-04T15:30:00',
      },
    ];

    const env = createTestEnvironment(
      {
        pdfl_token: 'valid-jwt-token',
        pdfl_user: JSON.stringify({ id: 1, email: 'user@test.com' }),
      },
      async (url) => {
        if (url.includes('/api/documents')) {
          return {
            ok: true,
            json: async () => ({ success: true, data: mockDocs }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();

    assert.strictEqual(env.elements.sidebarEmptyDocsState.style.display, 'none');
    assert.strictEqual(env.elements.sidebarDocList.style.display, 'flex');
    assert.strictEqual(env.elements.sidebarDocList.children.length, 2);
    assert.ok(env.elements.sidebarDocList.children[0].innerHTML.includes('Artificial_Intelligence_Report.pdf'));
    assert.ok(env.elements.sidebarDocList.children[1].innerHTML.includes('Financial_Statement_Q3.pdf'));
  });

  await runTest('PDFL-92.2 & PDFL-92.3: Unauthenticated user displays #documentsUnauthState and 0 count', async () => {
    const env = createTestEnvironment();
    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();

    assert.strictEqual(env.elements.documentsCountBadge.textContent, '0 tài liệu');
    assert.strictEqual(env.elements.documentsTable.style.display, 'none');
    assert.strictEqual(env.elements.documentsLoadingState.style.display, 'none');
    assert.strictEqual(env.elements.documentsErrorState.style.display, 'none');
    assert.strictEqual(env.elements.documentsEmptyState.style.display, 'none');
    assert.strictEqual(env.elements.documentsUnauthState.style.display, 'block');
    assert.strictEqual(env.elements.documentsTableBody.children.length, 0);

    // Clicking login prompt button triggers #btnLogin
    let loginClicked = false;
    env.elements.btnLogin.click = () => { loginClicked = true; };
    env.elements.btnDocsLoginPrompt.click();
    assert.strictEqual(loginClicked, true, 'btnDocsLoginPrompt must trigger btnLogin.click()');
  });

  await runTest('PDFL-92.3: Authenticated user with 0 documents displays #documentsEmptyState', async () => {
    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-empty-docs-token',
        pdfl_user: JSON.stringify({ id: 1, email: 'empty@test.com' }),
      },
      async () => ({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      })
    );

    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();

    assert.strictEqual(env.elements.documentsCountBadge.textContent, '0 tài liệu');
    assert.strictEqual(env.elements.documentsTable.style.display, 'none');
    assert.strictEqual(env.elements.documentsLoadingState.style.display, 'none');
    assert.strictEqual(env.elements.documentsErrorState.style.display, 'none');
    assert.strictEqual(env.elements.documentsUnauthState.style.display, 'none');
    assert.strictEqual(env.elements.documentsEmptyState.style.display, 'block');
    assert.strictEqual(env.elements.documentsTableBody.children.length, 0);
  });

  await runTest('PDFL-92.2: Authenticated user populates #documentsTableBody with full metadata and updates #documentsCountBadge', async () => {
    const mockDocs = [
      {
        id: 201,
        original_filename: 'IEEE_Paper_2026.pdf',
        file_size_bytes: 2097152, // 2 MB
        page_count: 14,
        target_lang: 'vi',
        is_ocr_used: false,
        created_at: '2026-11-05T08:30:00Z',
      },
      {
        id: 202,
        original_filename: 'Scanned_Contract.pdf',
        file_size_bytes: 512000, // 500 KB
        page_count: 5,
        target_lang: 'en',
        is_ocr_used: true,
        created_at: '2026-11-04T14:15:00Z',
      },
    ];

    let capturedAuthHeader = null;
    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-test-token-92-2',
        pdfl_user: JSON.stringify({ id: 1, email: 'user@test.com' }),
      },
      async (url, options = {}) => {
        if (url.includes('/api/documents')) {
          capturedAuthHeader = options.headers ? options.headers['Authorization'] : null;
          return {
            ok: true,
            json: async () => ({ success: true, data: mockDocs }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();

    assert.strictEqual(capturedAuthHeader, 'Bearer jwt-test-token-92-2', 'Must send Bearer token');
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '2 tài liệu');
    assert.strictEqual(env.elements.documentsEmptyState.style.display, 'none');
    assert.strictEqual(env.elements.documentsLoadingState.style.display, 'none');
    assert.strictEqual(env.elements.documentsErrorState.style.display, 'none');
    assert.strictEqual(env.elements.documentsUnauthState.style.display, 'none');
    assert.strictEqual(env.elements.documentsTable.style.display, 'table');
    assert.strictEqual(env.elements.documentsTableBody.children.length, 2);

    const row1Html = env.elements.documentsTableBody.children[0].innerHTML;
    assert.ok(row1Html.includes('IEEE_Paper_2026.pdf'), 'Row 1 must include original_filename');
    assert.ok(row1Html.includes('2 MB'), 'Row 1 must include formatted size in MB');
    assert.ok(row1Html.includes('14'), 'Row 1 must include page_count');
    assert.ok(row1Html.includes('Tiếng Việt (vi)'), 'Row 1 must include target_lang');
    assert.ok(row1Html.includes('PDF Số'), 'Row 1 must indicate digital PDF (is_ocr_used: false)');
    assert.ok(row1Html.includes('05/11/2026'), 'Row 1 must include formatted created_at');

    const row2Html = env.elements.documentsTableBody.children[1].innerHTML;
    assert.ok(row2Html.includes('Scanned_Contract.pdf'), 'Row 2 must include original_filename');
    assert.ok(row2Html.includes('500 KB'), 'Row 2 must include formatted size in KB');
    assert.ok(row2Html.includes('5'), 'Row 2 must include page_count');
    assert.ok(row2Html.includes('Tiếng Anh (en)'), 'Row 2 must include target_lang');
    assert.ok(row2Html.includes('Quét OCR'), 'Row 2 must indicate OCR status (is_ocr_used: true)');
    assert.ok(row2Html.includes('04/11/2026'), 'Row 2 must include formatted created_at');
  });

  await runTest('PDFL-92.3: Loading state displays while GET /api/documents is in-flight and deduplicates concurrent calls', async () => {
    let resolveFetch = null;
    let fetchCallCount = 0;

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-loading-token',
      },
      (url) => {
        if (url.includes('/api/documents')) {
          fetchCallCount++;
          return new Promise((resolve) => {
            resolveFetch = resolve;
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
    );

    // Note: DOMContentLoaded already triggered 1 call in createTestEnvironment
    assert.strictEqual(fetchCallCount, 1, 'Initial DOMContentLoaded fetch is in-flight');
    assert.strictEqual(env.elements.documentsLoadingState.style.display, 'block', 'Loading state must be visible while in-flight');
    assert.strictEqual(env.elements.documentsTable.style.display, 'none');
    assert.strictEqual(env.elements.documentsEmptyState.style.display, 'none');
    assert.strictEqual(env.elements.documentsErrorState.style.display, 'none');
    assert.strictEqual(env.elements.documentsUnauthState.style.display, 'none');

    // Concurrent calls while in-flight must reuse the same promise and NOT increment fetchCallCount
    const p1 = env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();
    const p2 = env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();
    assert.strictEqual(fetchCallCount, 1, 'Concurrent calls must be deduplicated');

    // Resolve the in-flight request
    resolveFetch({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 301,
            original_filename: 'Loaded_Doc.pdf',
            file_size_bytes: 102400,
            page_count: 3,
            target_lang: 'vi',
            is_ocr_used: false,
            created_at: '2026-11-05T12:00:00Z',
          },
        ],
      }),
    });

    await Promise.all([p1, p2]);

    assert.strictEqual(env.elements.documentsLoadingState.style.display, 'none', 'Loading state hidden after completion');
    assert.strictEqual(env.elements.documentsTable.style.display, 'table', 'Table displayed after completion');
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '1 tài liệu');
  });

  await runTest('PDFL-92.3: Error state displays on API/network failure and retry button (#btnDocsRetry) recovers list', async () => {
    let shouldFail = true;
    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-test-token-err',
      },
      async () => {
        if (shouldFail) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ detail: 'Máy chủ đang bảo trì tạm thời.' }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 401,
                original_filename: 'Recovered_Doc.pdf',
                file_size_bytes: 204800,
                page_count: 7,
                target_lang: 'vi',
                is_ocr_used: false,
                created_at: '2026-11-05T15:00:00Z',
              },
            ],
          }),
        };
      }
    );

    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();

    assert.strictEqual(env.elements.documentsCountBadge.textContent, '0 tài liệu');
    assert.strictEqual(env.elements.documentsTable.style.display, 'none');
    assert.strictEqual(env.elements.documentsEmptyState.style.display, 'none');
    assert.strictEqual(env.elements.documentsLoadingState.style.display, 'none');
    assert.strictEqual(env.elements.documentsUnauthState.style.display, 'none');
    assert.strictEqual(env.elements.documentsErrorState.style.display, 'block');
    assert.ok(env.elements.documentsErrorText.textContent.includes('Máy chủ đang bảo trì tạm thời.'));
    assert.strictEqual(env.elements.documentsTableBody.children.length, 0);

    // Click Retry button (#btnDocsRetry) when backend recovers
    shouldFail = false;
    env.elements.btnDocsRetry.click();
    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();

    assert.strictEqual(env.elements.documentsErrorState.style.display, 'none');
    assert.strictEqual(env.elements.documentsTable.style.display, 'table');
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '1 tài liệu');
    assert.strictEqual(env.elements.documentsTableBody.children.length, 1);
  });

  await runTest('PDFL-92.3: Auto refresh on pdfl:document-processed event and returning to Documents page without losing currentDocData', async () => {
    const serverDocs = [
      {
        id: 501,
        original_filename: 'Initial_Doc.pdf',
        file_size_bytes: 102400,
        page_count: 2,
        target_lang: 'vi',
        is_ocr_used: false,
        created_at: '2026-11-05T09:00:00Z',
      },
    ];

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-autorefresh-token',
      },
      async () => ({
        ok: true,
        json: async () => ({ success: true, data: [...serverDocs] }),
      })
    );

    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '1 tài liệu');

    // Simulate active translation result in workspace
    const activeTranslation = {
      id: 502,
      filename: 'Newly_Translated.pdf',
      original_text: 'Hello World',
      translated_text: 'Xin chào thế giới',
    };
    env.sandbox.window.pdfLinguaWorkspace = {
      getCurrentDocData: () => activeTranslation,
    };

    // Backend now has 2 documents after upload & translation finishes
    serverDocs.unshift({
      id: 502,
      original_filename: 'Newly_Translated.pdf',
      file_size_bytes: 307200,
      page_count: 6,
      target_lang: 'vi',
      is_ocr_used: true,
      created_at: '2026-11-05T16:00:00Z',
    });

    // Dispatch pdfl:document-processed event (auto-refresh after upload + translation)
    env.sandbox.window.dispatchEvent(
      new env.sandbox.CustomEvent('pdfl:document-processed', { detail: { document: activeTranslation } })
    );
    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();

    assert.strictEqual(env.elements.documentsCountBadge.textContent, '2 tài liệu');
    assert.strictEqual(env.elements.documentsTableBody.children.length, 2);
    assert.ok(env.elements.documentsTableBody.children[0].innerHTML.includes('Newly_Translated.pdf'));

    // Verify currentDocData in workspace is untouched and preserved when switching views
    assert.strictEqual(
      env.sandbox.window.pdfLinguaWorkspace.getCurrentDocData().translated_text,
      'Xin chào thế giới',
      'currentDocData must remain intact after auto-refresh'
    );
  });

  // 5b. PDFL-93.1: Document Detail Modal UI
  await runTest('PDFL-93.1: HTML markup includes #documentDetailModal with all 7 metadata areas and action buttons', () => {
    assert.ok(htmlSource.includes('id="documentDetailModal"'), 'documentDetailModal must exist');
    assert.ok(htmlSource.includes('id="docDetailFilename"'), 'docDetailFilename must exist');
    assert.ok(htmlSource.includes('id="docDetailId"'), 'docDetailId must exist');
    assert.ok(htmlSource.includes('id="docDetailSize"'), 'docDetailSize must exist');
    assert.ok(htmlSource.includes('id="docDetailPageCount"'), 'docDetailPageCount must exist');
    assert.ok(htmlSource.includes('id="docDetailTargetLang"'), 'docDetailTargetLang must exist');
    assert.ok(htmlSource.includes('id="docDetailOcrStatus"'), 'docDetailOcrStatus must exist');
    assert.ok(htmlSource.includes('id="docDetailCreatedAt"'), 'docDetailCreatedAt must exist');
    assert.ok(htmlSource.includes('id="btnCloseDocumentDetailModal"'), 'Top close button must exist');
    assert.ok(htmlSource.includes('id="btnCloseDocumentDetailFooter"'), 'Footer close button must exist');
    assert.ok(htmlSource.includes('id="btnDocDetailDownload"'), 'Download action placeholder button must exist');
    assert.ok(htmlSource.includes('id="btnDocDetailDelete"'), 'Delete action placeholder button must exist');
  });

  await runTest('PDFL-93.1: Opening Document Detail Modal populates all 7 metadata fields and closing via close buttons works', () => {
    const env = createTestEnvironment();
    const sampleDoc = {
      id: 931,
      original_filename: 'Deep_Learning_Architecture.pdf',
      file_size_bytes: 3145728, // 3 MB
      page_count: 24,
      target_lang: 'vi',
      is_ocr_used: true,
      created_at: '2026-11-05T10:30:00Z',
    };

    // Open modal
    env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal(sampleDoc);

    assert.strictEqual(env.elements.documentDetailModal.hasAttribute('hidden'), false, 'Modal hidden attribute must be removed');
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'flex', 'Modal display must be flex');
    assert.strictEqual(env.elements.docDetailHeroFilename.textContent, 'Deep_Learning_Architecture.pdf');
    assert.strictEqual(env.elements.docDetailFilename.textContent, 'Deep_Learning_Architecture.pdf');
    assert.strictEqual(env.elements.docDetailId.textContent, '#931');
    assert.strictEqual(env.elements.docDetailSize.textContent, '3 MB');
    assert.strictEqual(env.elements.docDetailPageCount.textContent, '24 trang');
    assert.strictEqual(env.elements.docDetailTargetLang.textContent, 'Tiếng Việt (vi)');
    assert.ok(env.elements.docDetailOcrStatus.innerHTML.includes('Quét OCR'), 'OCR status must show Quét OCR');
    assert.strictEqual(env.elements.docDetailCreatedAt.textContent, '05/11/2026');
    assert.strictEqual(env.elements.btnDocDetailDownload.dataset.docId, '931');
    assert.strictEqual(env.elements.btnDocDetailDelete.dataset.docId, '931');

    // Close via top close button (#btnCloseDocumentDetailModal)
    env.elements.btnCloseDocumentDetailModal.click();
    assert.strictEqual(env.elements.documentDetailModal.hasAttribute('hidden'), true, 'Modal must have hidden attribute after close');
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'none', 'Modal display must be none after close');

    // Re-open and close via footer close button (#btnCloseDocumentDetailFooter)
    env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({
      ...sampleDoc,
      is_ocr_used: false,
    });
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'flex');
    assert.ok(env.elements.docDetailOcrStatus.innerHTML.includes('PDF Số'), 'OCR status must show PDF Số when is_ocr_used is false');

    env.elements.btnCloseDocumentDetailFooter.click();
    assert.strictEqual(env.elements.documentDetailModal.hasAttribute('hidden'), true);
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'none');
  });

  await runTest('PDFL-93.1: Pressing Escape key or clicking backdrop closes Document Detail Modal without disrupting workspace state', () => {
    const env = createTestEnvironment();
    env.sandbox.window.pdfLinguaWorkspace = {
      getCurrentDocData: () => ({ filename: 'active.pdf', translated_text: 'Bản dịch đang mở' }),
    };

    const sampleDoc = {
      id: 932,
      original_filename: 'Research_Notes.pdf',
      file_size_bytes: 512000,
      page_count: 8,
      target_lang: 'en',
      is_ocr_used: false,
      created_at: '2026-11-05T11:00:00Z',
    };

    // Open modal and press Escape
    env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal(sampleDoc);
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'flex');

    env.triggerDocKeydown({ key: 'Escape' });
    assert.strictEqual(env.elements.documentDetailModal.hasAttribute('hidden'), true, 'Escape key must close Document Detail Modal');
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'none');

    // Re-open modal and click backdrop
    env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal(sampleDoc);
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'flex');

    env.elements.documentDetailModal.click();
    assert.strictEqual(env.elements.documentDetailModal.hasAttribute('hidden'), true, 'Backdrop click must close Document Detail Modal');
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'none');

    // Verify workspace state is preserved
    assert.strictEqual(
      env.sandbox.window.pdfLinguaWorkspace.getCurrentDocData().translated_text,
      'Bản dịch đang mở'
    );
  });

  // 5c. PDFL-93.2: Document Detail API Integration
  await runTest('PDFL-93.2: Fetches GET /api/documents/{document_id} with Bearer token, shows loading state, and renders all 7 metadata fields from API response', async () => {
    let capturedUrl = null;
    let capturedAuthHeader = null;
    let resolveDetailFetch = null;

    const apiDetailDoc = {
      id: 9320,
      original_filename: 'Quantum_Computing_2026_Final.pdf',
      file_size_bytes: 4194304, // 4 MB
      page_count: 32,
      target_lang: 'en',
      is_ocr_used: true,
      created_at: '2026-11-06T09:15:00Z',
    };

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-detail-token-93-2',
      },
      (url, options = {}) => {
        if (url.includes('/api/documents/9320')) {
          capturedUrl = url;
          capturedAuthHeader = options.headers ? options.headers['Authorization'] : null;
          return new Promise((resolve) => {
            resolveDetailFetch = resolve;
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        });
      }
    );

    // Call openDocumentDetailModal with summary object that has older/partial values
    const openPromise = env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({
      id: 9320,
      original_filename: 'Old_Cached_Name.pdf',
    });

    // Verify Loading State while request is in-flight
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'flex');
    assert.strictEqual(env.elements.documentDetailLoading.style.display, 'flex', 'Loading indicator must be visible while fetching detail');
    assert.strictEqual(env.elements.documentDetailContent.style.display, 'none', 'Content card must be hidden while loading');
    assert.strictEqual(env.elements.documentDetailAlert.style.display, 'none');
    assert.strictEqual(env.elements.docDetailFilename.textContent, '---', 'Must not display unverified/old metadata while loading');
    assert.strictEqual(env.elements.btnDocDetailDownload.disabled, true, 'Download button disabled during loading');
    assert.strictEqual(env.elements.btnDocDetailDelete.disabled, true, 'Delete button disabled during loading');

    // Resolve API call
    resolveDetailFetch({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: apiDetailDoc,
      }),
    });

    await openPromise;

    assert.ok(capturedUrl.endsWith('/api/documents/9320'), 'Must request GET /api/documents/9320');
    assert.strictEqual(capturedAuthHeader, 'Bearer jwt-detail-token-93-2', 'Must attach Authorization Bearer token');
    assert.strictEqual(env.elements.documentDetailLoading.style.display, 'none', 'Loading state hidden after response');
    assert.strictEqual(env.elements.documentDetailContent.style.display, 'block', 'Content card displayed after response');
    assert.strictEqual(env.elements.documentDetailAlert.style.display, 'none');

    // Check all 7 metadata fields populated from actual API response
    assert.strictEqual(env.elements.docDetailFilename.textContent, 'Quantum_Computing_2026_Final.pdf');
    assert.strictEqual(env.elements.docDetailId.textContent, '#9320');
    assert.strictEqual(env.elements.docDetailSize.textContent, '4 MB');
    assert.strictEqual(env.elements.docDetailPageCount.textContent, '32 trang');
    assert.strictEqual(env.elements.docDetailTargetLang.textContent, 'Tiếng Anh (en)');
    assert.ok(env.elements.docDetailOcrStatus.innerHTML.includes('Quét OCR'));
    assert.strictEqual(env.elements.docDetailCreatedAt.textContent, '06/11/2026');
    assert.strictEqual(env.elements.btnDocDetailDownload.disabled, false);
    assert.strictEqual(env.elements.btnDocDetailDelete.disabled, false);
  });

  await runTest('PDFL-93.2: Handles 401, 404, and 500 errors gracefully and clears previous metadata so stale data is never shown', async () => {
    let mockStatus = 200;
    let mockDetail = '';

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-error-handling-token',
      },
      async (url) => {
        if (url.includes('/api/documents/')) {
          if (mockStatus === 200) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  id: 100,
                  original_filename: 'Valid_First_Doc.pdf',
                  file_size_bytes: 1048576,
                  page_count: 10,
                  target_lang: 'vi',
                  is_ocr_used: false,
                  created_at: '2026-11-05T08:00:00Z',
                },
              }),
            };
          }
          return {
            ok: false,
            status: mockStatus,
            json: async () => ({ detail: mockDetail }),
          };
        }
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      }
    );

    // 1. First load a valid document so metadata fields are populated
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 100 });
    assert.strictEqual(env.elements.docDetailFilename.textContent, 'Valid_First_Doc.pdf');
    assert.strictEqual(env.elements.docDetailId.textContent, '#100');

    // 2. Switch to another document that returns 404 Not Found
    mockStatus = 404;
    mockDetail = 'Tài liệu không tồn tại hoặc bạn không có quyền truy cập.';
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 404 });

    assert.strictEqual(env.elements.documentDetailLoading.style.display, 'none');
    assert.strictEqual(env.elements.documentDetailContent.style.display, 'none', 'Metadata content must be hidden on 404 error');
    assert.strictEqual(env.elements.documentDetailAlert.style.display, 'flex', 'Error alert must be displayed on 404');
    assert.ok(env.elements.documentDetailAlert.textContent.includes('404'), 'Alert must mention 404 not found');
    // Verify stale metadata from doc #100 was cleared
    assert.strictEqual(env.elements.docDetailFilename.textContent, '---', 'Stale filename must be cleared');
    assert.strictEqual(env.elements.docDetailId.textContent, '---', 'Stale ID must be cleared');
    assert.strictEqual(env.elements.btnDocDetailDownload.disabled, true);
    assert.strictEqual(env.elements.btnDocDetailDelete.disabled, true);

    // 3. Test 401 Unauthorized
    mockStatus = 401;
    mockDetail = 'Not authenticated';
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 401 });

    assert.strictEqual(env.elements.documentDetailContent.style.display, 'none');
    assert.strictEqual(env.elements.documentDetailAlert.style.display, 'flex');
    assert.ok(env.elements.documentDetailAlert.textContent.includes('401'), 'Alert must mention 401 unauthorized');
    assert.strictEqual(env.elements.docDetailFilename.textContent, '---');

    // 4. Test 500 Internal Server Error
    mockStatus = 500;
    mockDetail = 'Lỗi kết nối cơ sở dữ liệu máy chủ.';
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 500 });

    assert.strictEqual(env.elements.documentDetailContent.style.display, 'none');
    assert.strictEqual(env.elements.documentDetailAlert.style.display, 'flex');
    assert.ok(env.elements.documentDetailAlert.textContent.includes('Lỗi kết nối cơ sở dữ liệu máy chủ.'));
    assert.strictEqual(env.elements.docDetailFilename.textContent, '---');
  });

  await runTest('PDFL-93.2: Rapid switching between two documents ignores out-of-order responses from earlier requests', async () => {
    let resolveDocA = null;
    let resolveDocB = null;

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-race-condition-token',
      },
      (url) => {
        if (url.includes('/api/documents/701')) {
          return new Promise((resolve) => {
            resolveDocA = resolve;
          });
        }
        if (url.includes('/api/documents/702')) {
          return new Promise((resolve) => {
            resolveDocB = resolve;
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
      }
    );

    // User clicks Doc A (#701), then rapidly switches to Doc B (#702) before Doc A finishes
    const promiseA = env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 701 });
    const promiseB = env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 702 });

    // Doc B (#702) resolves FIRST
    resolveDocB({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 702,
          original_filename: 'Second_Selected_Doc_B.pdf',
          file_size_bytes: 2097152,
          page_count: 15,
          target_lang: 'fr',
          is_ocr_used: false,
          created_at: '2026-11-06T12:00:00Z',
        },
      }),
    });

    await promiseB;

    assert.strictEqual(env.elements.docDetailFilename.textContent, 'Second_Selected_Doc_B.pdf');
    assert.strictEqual(env.elements.docDetailId.textContent, '#702');

    // Now Doc A (#701) resolves LATE (out-of-order)
    resolveDocA({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 701,
          original_filename: 'Stale_First_Doc_A.pdf',
          file_size_bytes: 512000,
          page_count: 3,
          target_lang: 'vi',
          is_ocr_used: true,
          created_at: '2026-11-01T10:00:00Z',
        },
      }),
    });

    await promiseA;

    // UI must still display Doc B (#702) and NOT be overwritten by stale Doc A (#701)
    assert.strictEqual(env.elements.docDetailFilename.textContent, 'Second_Selected_Doc_B.pdf', 'Late response from Doc A must not overwrite Doc B');
    assert.strictEqual(env.elements.docDetailId.textContent, '#702');
    assert.strictEqual(env.elements.docDetailPageCount.textContent, '15 trang');
    assert.strictEqual(env.elements.docDetailTargetLang.textContent, 'Tiếng Pháp (fr)');
  });

  // 5d. PDFL-93.3: Document Detail Actions (Download & Delete Integration Point)
  await runTest('PDFL-93.3: Clicking #btnDocDetailDownload downloads the currently open document with loading state and does not affect table row download', async () => {
    const downloadCalls = [];
    let resolveModalDownload = null;

    const docsList = [
      {
        id: 801,
        original_filename: 'Doc_801_List.pdf',
        file_size_bytes: 102400,
        page_count: 4,
        target_lang: 'vi',
        is_ocr_used: false,
        created_at: '2026-11-05T08:00:00Z',
      },
      {
        id: 802,
        original_filename: 'Doc_802_Detail.pdf',
        file_size_bytes: 204800,
        page_count: 9,
        target_lang: 'en',
        is_ocr_used: true,
        created_at: '2026-11-05T09:00:00Z',
      },
    ];

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-detail-action-token',
      },
      (url, options = {}) => {
        if (url.endsWith('/api/documents')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: docsList }),
          });
        }
        if (url.endsWith('/api/documents/802')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: docsList[1] }),
          });
        }
        if (url.includes('/api/documents/802/download')) {
          downloadCalls.push({ url, auth: options.headers ? options.headers['Authorization'] : null });
          return new Promise((resolve) => {
            resolveModalDownload = resolve;
          });
        }
        if (url.includes('/api/documents/801/download')) {
          downloadCalls.push({ url, auth: options.headers ? options.headers['Authorization'] : null });
          return Promise.resolve({
            ok: true,
            status: 200,
            blob: async () => ({ size: 102400 }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      }
    );

    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();

    // 1. Open Detail Modal for Doc #802
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 802 });
    assert.strictEqual(env.elements.docDetailId.textContent, '#802');
    assert.strictEqual(env.elements.btnDocDetailDownload.disabled, false);

    // 2. Click #btnDocDetailDownload -> verify loading state and request to /api/documents/802/download
    env.elements.btnDocDetailDownload.click();
    assert.strictEqual(downloadCalls.length, 1, 'Must trigger download request for doc #802');
    assert.ok(downloadCalls[0].url.endsWith('/api/documents/802/download'));
    assert.strictEqual(downloadCalls[0].auth, 'Bearer jwt-detail-action-token');
    assert.strictEqual(env.elements.btnDocDetailDownload.disabled, true, 'Button must be disabled while downloading');
    assert.strictEqual(env.elements.docDetailDownloadSpinner.style.display, 'inline-block', 'Spinner must show while downloading');
    assert.strictEqual(env.elements.docDetailDownloadText.textContent, 'Đang tải xuống...');

    // Resolve download
    resolveModalDownload({
      ok: true,
      status: 200,
      blob: async () => ({ size: 204800 }),
    });
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(env.elements.btnDocDetailDownload.disabled, false, 'Button re-enabled after download completes');
    assert.strictEqual(env.elements.docDetailDownloadSpinner.style.display, 'none');
    assert.strictEqual(env.elements.docDetailDownloadText.textContent, 'Tải xuống PDF');

    // 3. Verify table row download button for Doc #801 still works independently
    const row801 = env.elements.documentsTableBody.children[0];
    const row801DownloadBtn = row801.querySelector('.doc-table-download-btn');
    assert.ok(row801DownloadBtn, 'Row download button must exist');
    row801DownloadBtn.click();
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(downloadCalls.length, 2, 'Table row download button must trigger its own download');
    assert.ok(downloadCalls[1].url.endsWith('/api/documents/801/download'));
  });

  await runTest('PDFL-93.3: Closing modal or switching documents prevents downloading stale document ID, and handles unauthenticated / missing ID safely', async () => {
    const downloadCalls = [];

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-switch-doc-token',
      },
      async (url) => {
        if (url.endsWith('/api/documents/901')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                id: 901,
                original_filename: 'First_Doc_901.pdf',
                file_size_bytes: 102400,
                page_count: 2,
                target_lang: 'vi',
                is_ocr_used: false,
                created_at: '2026-11-05T10:00:00Z',
              },
            }),
          };
        }
        if (url.endsWith('/api/documents/902')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                id: 902,
                original_filename: 'Second_Doc_902.pdf',
                file_size_bytes: 204800,
                page_count: 5,
                target_lang: 'en',
                is_ocr_used: true,
                created_at: '2026-11-05T11:00:00Z',
              },
            }),
          };
        }
        if (url.includes('/download')) {
          downloadCalls.push(url);
          return {
            ok: true,
            status: 200,
            blob: async () => ({ size: 1024 }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) };
      }
    );

    // 1. Open Doc #901, then switch to Doc #902 and click download -> must download #902, NEVER #901
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 901 });
    assert.strictEqual(env.elements.btnDocDetailDownload.dataset.docId, '901');

    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 902 });
    assert.strictEqual(env.elements.btnDocDetailDownload.dataset.docId, '902');

    env.elements.btnDocDetailDownload.click();
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(downloadCalls.length, 1);
    assert.ok(downloadCalls[0].endsWith('/api/documents/902/download'), 'Must download newly switched doc #902');

    // 2. Close modal -> dataset.docId is cleared and clicking download while closed does nothing
    env.sandbox.window.PDFLinguaSidebar.closeDocumentDetailModal();
    assert.strictEqual(env.elements.btnDocDetailDownload.dataset.docId, undefined, 'docId dataset must be cleared on close');
    env.elements.btnDocDetailDownload.click();
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(downloadCalls.length, 1, 'Clicking download when modal is closed must not trigger API call');

    // 3. Re-open Doc #902, then simulate token removal (unauthenticated) before clicking download
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 902 });
    delete env.store['pdfl_token'];
    env.elements.btnDocDetailDownload.click();
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(downloadCalls.length, 1, 'Unauthenticated download attempt must not call download endpoint');
    assert.strictEqual(env.elements.documentDetailAlert.style.display, 'flex');
    assert.ok(env.elements.documentDetailAlert.textContent.includes('đăng nhập'));

    // 4. Missing document ID when opening modal -> download button disabled and does not call API
    env.store['pdfl_token'] = 'jwt-switch-doc-token';
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({});
    assert.strictEqual(env.elements.btnDocDetailDownload.disabled, true);
    env.elements.btnDocDetailDownload.click();
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(downloadCalls.length, 1, 'Missing doc ID must not call download endpoint');
  });

  await runTest('PDFL-93.3: #btnDocDetailDelete emits integration event without calling DELETE API or mutating document list', async () => {
    let deleteApiCalled = false;
    let capturedDeleteIntent = null;

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-delete-intent-token',
      },
      async (url, options = {}) => {
        if (options.method === 'DELETE') {
          deleteApiCalled = true;
        }
        if (url.endsWith('/api/documents/999')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                id: 999,
                original_filename: 'Keep_Safe_Doc.pdf',
                file_size_bytes: 512000,
                page_count: 6,
                target_lang: 'vi',
                is_ocr_used: false,
                created_at: '2026-11-05T12:00:00Z',
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) };
      }
    );

    env.sandbox.window.addEventListener('pdfl:document-delete-intent', (e) => {
      capturedDeleteIntent = e.detail;
    });

    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 999 });
    env.elements.btnDocDetailDelete.click();

    assert.strictEqual(deleteApiCalled, false, 'Must NOT call DELETE API in PDFL-93.3');
    assert.ok(capturedDeleteIntent, 'Must emit pdfl:document-delete-intent for PDFL-94 integration');
    assert.strictEqual(capturedDeleteIntent.id, 999);
    assert.strictEqual(capturedDeleteIntent.original_filename, 'Keep_Safe_Doc.pdf');
  });

  // 5e. PDFL-94.2: Document Delete UI Integration
  await runTest('PDFL-94.2: Clicking #btnDocDetailDelete opens #documentDeleteConfirmModal with filename & irreversible warning, and Cancel does not call DELETE', async () => {
    let deleteApiCalled = false;
    const docsList = [
      {
        id: 941,
        original_filename: 'Important_Thesis_2026.pdf',
        file_size_bytes: 1048576,
        page_count: 12,
        target_lang: 'vi',
        is_ocr_used: false,
        created_at: '2026-11-05T10:00:00Z',
      },
    ];

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-delete-ui-token',
      },
      async (url, options = {}) => {
        if (options.method === 'DELETE') {
          deleteApiCalled = true;
        }
        if (url.endsWith('/api/documents')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: docsList }),
          };
        }
        if (url.endsWith('/api/documents/941')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: docsList[0] }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }
    );

    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 941 });

    // Verify static HTML contains irreversible warning and confirmation modal
    assert.ok(htmlSource.includes('id="documentDeleteConfirmModal"'), 'Confirmation modal must exist in HTML');
    assert.ok(htmlSource.includes('Thao tác này không thể hoàn tác'), 'Irreversible warning text must exist in HTML');

    // Click Delete button in Detail Modal -> opens Confirmation Modal
    env.elements.btnDocDetailDelete.click();
    assert.strictEqual(env.elements.documentDeleteConfirmModal.hasAttribute('hidden'), false);
    assert.strictEqual(env.elements.documentDeleteConfirmModal.style.display, 'flex');
    assert.strictEqual(env.elements.docDeleteConfirmFilename.textContent, 'Important_Thesis_2026.pdf');

    // Click Cancel (#btnCancelDocDelete) -> closes Confirmation Modal, keeps Detail Modal open, no DELETE call
    env.elements.btnCancelDocDelete.click();
    assert.strictEqual(env.elements.documentDeleteConfirmModal.hasAttribute('hidden'), true);
    assert.strictEqual(env.elements.documentDeleteConfirmModal.style.display, 'none');
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'flex', 'Detail modal remains open on cancel');
    assert.strictEqual(deleteApiCalled, false, 'Cancel must NOT call DELETE API');
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '1 tài liệu', 'Document count remains unchanged');
  });

  await runTest('PDFL-94.2: Confirming delete calls DELETE /api/documents/{id} with Bearer token, prevents double-click, closes modals, updates list/count, and preserves unrelated currentDocData', async () => {
    const deleteRequests = [];
    let resolveDeleteFetch = null;
    const toasts = [];

    const docsList = [
      {
        id: 9421,
        original_filename: 'Doc_To_Delete.pdf',
        file_size_bytes: 512000,
        page_count: 5,
        target_lang: 'vi',
        is_ocr_used: false,
        created_at: '2026-11-05T10:00:00Z',
      },
      {
        id: 9422,
        original_filename: 'Doc_To_Keep.pdf',
        file_size_bytes: 1024000,
        page_count: 10,
        target_lang: 'en',
        is_ocr_used: true,
        created_at: '2026-11-05T11:00:00Z',
      },
    ];

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-confirm-delete-token',
      },
      (url, options = {}) => {
        if (options.method === 'DELETE' && url.includes('/api/documents/9421')) {
          deleteRequests.push({
            url,
            method: options.method,
            auth: options.headers ? options.headers['Authorization'] : null,
          });
          return new Promise((resolve) => {
            resolveDeleteFetch = resolve;
          });
        }
        if (url.endsWith('/api/documents')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: docsList }),
          });
        }
        if (url.endsWith('/api/documents/9421')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: docsList[0] }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      }
    );

    env.sandbox.showToast = (msg, type) => {
      toasts.push({ msg, type });
    };

    // Simulate active translation of another document (#9422) in Workspace
    const activeWorkspaceDoc = {
      id: 9422,
      document_id: 9422,
      filename: 'Doc_To_Keep.pdf',
      translated_text: 'Nội dung bản dịch đang mở trong Workspace',
    };
    env.sandbox.window.pdfLinguaWorkspace = {
      getCurrentDocData: () => activeWorkspaceDoc,
    };

    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '2 tài liệu');
    assert.strictEqual(env.elements.documentsTableBody.children.length, 2);

    // Open Detail Modal for #9421 and click Delete -> opens Confirmation Modal
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 9421 });
    env.elements.btnDocDetailDelete.click();
    assert.strictEqual(env.elements.documentDeleteConfirmModal.style.display, 'flex');

    // Click Confirm (#btnConfirmDocDelete) twice rapidly to test double-click protection
    env.elements.btnConfirmDocDelete.click();
    env.elements.btnConfirmDocDelete.click();

    assert.strictEqual(deleteRequests.length, 1, 'Double-click must only dispatch 1 DELETE request');
    assert.ok(deleteRequests[0].url.endsWith('/api/documents/9421'));
    assert.strictEqual(deleteRequests[0].auth, 'Bearer jwt-confirm-delete-token');

    // Verify loading state while DELETE is in-flight
    assert.strictEqual(env.elements.btnConfirmDocDelete.disabled, true, 'Confirm button disabled during DELETE');
    assert.strictEqual(env.elements.btnCancelDocDelete.disabled, true, 'Cancel button disabled during DELETE');
    assert.strictEqual(env.elements.docDeleteSpinner.style.display, 'inline-block');
    assert.strictEqual(env.elements.docDeleteBtnText.textContent, 'Đang xóa...');

    // Resolve DELETE API with success
    resolveDeleteFetch({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Xóa tài liệu thành công.',
        data: { id: 9421, original_filename: 'Doc_To_Delete.pdf' },
      }),
    });
    await new Promise((r) => setTimeout(r, 15));

    // Both Confirmation Modal and Detail Modal must be closed
    assert.strictEqual(env.elements.documentDeleteConfirmModal.style.display, 'none');
    assert.strictEqual(env.elements.documentDeleteConfirmModal.hasAttribute('hidden'), true);
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'none');
    assert.strictEqual(env.elements.documentDetailModal.hasAttribute('hidden'), true);

    // Document #9421 removed from table and sidebar, count updated to 1
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '1 tài liệu');
    assert.strictEqual(env.elements.documentsTableBody.children.length, 1);
    assert.ok(env.elements.documentsTableBody.children[0].innerHTML.includes('Doc_To_Keep.pdf'));
    assert.strictEqual(env.elements.sidebarDocList.children.length, 1);

    // Success toast displayed
    assert.ok(toasts.some((t) => t.type === 'success' && t.msg.includes('Xóa tài liệu thành công')));

    // Unrelated currentDocData in Workspace is completely preserved
    assert.strictEqual(
      env.sandbox.window.pdfLinguaWorkspace.getCurrentDocData().translated_text,
      'Nội dung bản dịch đang mở trong Workspace'
    );
  });

  await runTest('PDFL-94.2: DELETE error handling (401, 404, 500, network failure) keeps modals open, displays error, and does not remove document from list', async () => {
    let deleteMode = '401';
    const docsList = [
      {
        id: 9429,
        original_filename: 'Protected_Doc.pdf',
        file_size_bytes: 409600,
        page_count: 7,
        target_lang: 'vi',
        is_ocr_used: false,
        created_at: '2026-11-05T15:00:00Z',
      },
    ];

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-delete-err-token',
      },
      async (url, options = {}) => {
        if (options.method === 'DELETE') {
          if (deleteMode === 'network') {
            throw new Error('Failed to fetch');
          }
          const statusMap = { '401': 401, '404': 404, '500': 500 };
          const detailMap = {
            '401': 'Not authenticated',
            '404': 'Tài liệu không tồn tại hoặc bạn không có quyền truy cập.',
            '500': 'Không thể xóa tệp tin vật lý trên hệ thống lưu trữ.',
          };
          return {
            ok: false,
            status: statusMap[deleteMode],
            json: async () => ({ detail: detailMap[deleteMode] }),
          };
        }
        if (url.endsWith('/api/documents')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: docsList }),
          };
        }
        if (url.endsWith('/api/documents/9429')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: docsList[0] }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }
    );

    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 9429 });
    env.elements.btnDocDetailDelete.click();

    // 1. Test 401
    deleteMode = '401';
    await env.sandbox.window.PDFLinguaSidebar.confirmDocumentDelete();
    assert.strictEqual(env.elements.documentDeleteConfirmModal.style.display, 'flex', 'Confirm modal stays open on 401');
    assert.strictEqual(env.elements.docDeleteConfirmAlert.style.display, 'flex');
    assert.ok(env.elements.docDeleteConfirmAlert.textContent.includes('401'));
    assert.strictEqual(env.elements.btnConfirmDocDelete.disabled, false, 'Confirm button re-enabled after error');
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '1 tài liệu', 'Document not removed on 401');

    // 2. Test 404
    deleteMode = '404';
    await env.sandbox.window.PDFLinguaSidebar.confirmDocumentDelete();
    assert.strictEqual(env.elements.docDeleteConfirmAlert.style.display, 'flex');
    assert.ok(env.elements.docDeleteConfirmAlert.textContent.includes('Tài liệu không tồn tại'));
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '1 tài liệu', 'Document not removed on 404');

    // 3. Test 500
    deleteMode = '500';
    await env.sandbox.window.PDFLinguaSidebar.confirmDocumentDelete();
    assert.strictEqual(env.elements.docDeleteConfirmAlert.style.display, 'flex');
    assert.ok(env.elements.docDeleteConfirmAlert.textContent.includes('Không thể xóa tệp tin vật lý'));
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '1 tài liệu', 'Document not removed on 500');

    // 4. Test Network Failure
    deleteMode = 'network';
    await env.sandbox.window.PDFLinguaSidebar.confirmDocumentDelete();
    assert.strictEqual(env.elements.docDeleteConfirmAlert.style.display, 'flex');
    assert.ok(env.elements.docDeleteConfirmAlert.textContent.includes('Không thể kết nối tới máy chủ'));
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '1 tài liệu', 'Document not removed on network error');
  });

  await runTest('PDFL-94.3: End-to-end integration when deleting the last remaining document transitions UI to Empty State while preserving Escape key hierarchy & search', async () => {
    const serverDocs = [
      {
        id: 9430,
        original_filename: 'Sole_Remaining_Document.pdf',
        file_size_bytes: 768000,
        page_count: 9,
        target_lang: 'vi',
        is_ocr_used: true,
        created_at: '2026-11-05T16:00:00Z',
      },
    ];

    const env = createTestEnvironment(
      {
        pdfl_token: 'jwt-e2e-94-3-token',
      },
      async (url, options = {}) => {
        if (options.method === 'DELETE' && url.endsWith('/api/documents/9430')) {
          const idx = serverDocs.findIndex((d) => d.id === 9430);
          if (idx === -1) {
            return {
              ok: false,
              status: 404,
              json: async () => ({
                success: false,
                error_code: 'HTTP_404',
                message: 'Tài liệu không tồn tại hoặc bạn không có quyền truy cập.',
              }),
            };
          }
          serverDocs.splice(idx, 1);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              message: 'Xóa tài liệu thành công.',
              data: { id: 9430, original_filename: 'Sole_Remaining_Document.pdf' },
            }),
          };
        }
        if (url.endsWith('/api/documents/9430')) {
          const doc = serverDocs.find((d) => d.id === 9430);
          if (!doc) {
            return {
              ok: false,
              status: 404,
              json: async () => ({ detail: 'Tài liệu không tồn tại.' }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: doc }),
          };
        }
        if (url.endsWith('/api/documents')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: [...serverDocs] }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }
    );

    await env.sandbox.window.PDFLinguaSidebar.fetchRecentDocuments();
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '1 tài liệu');
    assert.strictEqual(env.elements.documentsTable.style.display, 'table');
    assert.strictEqual(env.elements.sidebarDocList.style.display, 'flex');
    assert.strictEqual(env.elements.sidebarEmptyDocsState.style.display, 'none');

    // 1. Open Detail Modal -> click Delete -> press Escape -> closes ONLY Confirmation Modal, Detail Modal stays open
    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal({ id: 9430 });
    env.elements.btnDocDetailDelete.click();
    assert.strictEqual(env.elements.documentDeleteConfirmModal.style.display, 'flex');
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'flex');

    env.triggerDocKeydown({ key: 'Escape' });
    assert.strictEqual(env.elements.documentDeleteConfirmModal.style.display, 'none', 'Escape closes Confirm Modal first');
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'flex', 'Detail Modal remains open');

    // 2. Click Delete again and confirm -> deletes last document -> transitions both Sidebar and Documents Page to Empty State
    env.elements.btnDocDetailDelete.click();
    await env.sandbox.window.PDFLinguaSidebar.confirmDocumentDelete();

    assert.strictEqual(env.elements.documentDeleteConfirmModal.style.display, 'none');
    assert.strictEqual(env.elements.documentDetailModal.style.display, 'none');
    assert.strictEqual(env.elements.documentsCountBadge.textContent, '0 tài liệu');
    assert.strictEqual(env.elements.documentsTable.style.display, 'none');
    assert.strictEqual(env.elements.documentsEmptyState.style.display, 'block', 'Documents page transitions to Empty State');
    assert.strictEqual(env.elements.sidebarDocList.style.display, 'none', 'Sidebar doc list hides when empty');
    assert.strictEqual(env.elements.sidebarEmptyDocsState.style.display, 'block', 'Sidebar empty state displays when 0 docs remain');
  });

  // 6. Default & Toggle Behavior
  await runTest('Behavior: Default state is expanded', () => {
    const env = createTestEnvironment();
    assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), false);
    assert.strictEqual(env.elements.appShell.classList.contains('sidebar-collapsed'), false);
    assert.strictEqual(env.elements.btnToggleSidebar.getAttribute('aria-expanded'), 'true');
  });

  await runTest('Behavior: Clicking toggle collapses the sidebar and updates attributes', () => {
    const env = createTestEnvironment();
    env.elements.btnToggleSidebar.click();
    assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), true);
    assert.strictEqual(env.elements.appShell.classList.contains('sidebar-collapsed'), true);
    assert.strictEqual(env.elements.btnToggleSidebar.getAttribute('aria-expanded'), 'false');
    assert.strictEqual(env.store['pdf_lingua_sidebar_collapsed'], 'true');
  });

  await runTest('Behavior: Clicking toggle again expands the sidebar', () => {
    const env = createTestEnvironment({
      pdf_lingua_sidebar_collapsed: 'true',
    });
    assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), true);

    env.elements.btnToggleSidebar.click();
    assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), false);
    assert.strictEqual(env.elements.appShell.classList.contains('sidebar-collapsed'), false);
    assert.strictEqual(env.elements.btnToggleSidebar.getAttribute('aria-expanded'), 'true');
    assert.strictEqual(env.store['pdf_lingua_sidebar_collapsed'], 'false');
  });

  // 7. Keyboard Shortcuts
  await runTest('Keyboard: Ctrl+B toggles sidebar state', () => {
    const env = createTestEnvironment();
    assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), false);

    let defaultPrevented = false;
    env.triggerDocKeydown({
      key: 'b',
      ctrlKey: true,
      preventDefault: () => { defaultPrevented = true; },
    });

    assert.strictEqual(defaultPrevented, true);
    assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), true);

    env.triggerDocKeydown({
      key: 'B',
      ctrlKey: true,
      preventDefault: () => {},
    });
    assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), false);
  });

  // 8. Mobile Drawer & Backdrop
  await runTest('Mobile: Clicking mobile button opens drawer and backdrop', () => {
    const env = createTestEnvironment();
    env.elements.btnMobileSidebarToggle.click();

    assert.strictEqual(env.elements.appSidebar.classList.contains('mobile-open'), true);
    assert.strictEqual(env.elements.sidebarBackdrop.classList.contains('active'), true);
    assert.strictEqual(env.sandbox.document.body.style.overflow, 'hidden');
  });

  await runTest('Mobile: Clicking backdrop closes mobile drawer', () => {
    const env = createTestEnvironment();
    env.elements.btnMobileSidebarToggle.click();
    assert.strictEqual(env.elements.appSidebar.classList.contains('mobile-open'), true);

    env.elements.sidebarBackdrop.click();
    assert.strictEqual(env.elements.appSidebar.classList.contains('mobile-open'), false);
    assert.strictEqual(env.elements.sidebarBackdrop.classList.contains('active'), false);
    assert.strictEqual(env.sandbox.document.body.style.overflow, '');
  });

  await runTest('Mobile: Pressing Escape closes mobile drawer', () => {
    const env = createTestEnvironment();
    env.elements.btnMobileSidebarToggle.click();
    assert.strictEqual(env.elements.appSidebar.classList.contains('mobile-open'), true);

    env.triggerDocKeydown({ key: 'Escape' });
    assert.strictEqual(env.elements.appSidebar.classList.contains('mobile-open'), false);
    assert.strictEqual(env.elements.sidebarBackdrop.classList.contains('active'), false);
  });

  await runTest('PDFL-94.2: Deleting a document keeps user on Documents page (#documentsSection) instead of returning to Translate or Home, including across page reloads', async () => {
    const docs = [
      { id: 101, original_filename: 'keep_view_after_delete.pdf', file_size_bytes: 2048, page_count: 2, target_lang: 'vi', is_ocr_used: false, created_at: '2026-11-05T10:00:00Z' },
    ];
    const env = createTestEnvironment(
      {
        pdfl_user: JSON.stringify({ full_name: 'User', email: 'user@pdflingua.io', role: 'user' }),
        pdfl_token: 'valid-jwt-token',
      },
      async (url, options = {}) => {
        if (options.method === 'DELETE' && url.endsWith('/api/documents/101')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              message: 'Đã xóa tài liệu thành công.',
              data: { id: 101, deleted: true },
            }),
          };
        }
        if (url.endsWith('/api/documents/101')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: docs[0] }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: docs }),
        };
      }
    );

    await env.sandbox.window.PDFLinguaSidebar.openDocumentDetailModal(docs[0]);
    env.elements.btnDocDetailDelete.click();
    const deleteResult = await env.sandbox.window.PDFLinguaSidebar.confirmDocumentDelete();

    assert.strictEqual(deleteResult, true);
    assert.strictEqual(env.elements.documentsSection.style.display, 'block', 'Documents section must stay visible after delete');
    assert.strictEqual(env.elements.heroSection.style.display, 'none', 'Hero section must stay hidden after delete');
    assert.strictEqual(env.elements.workspaceSection.style.display, 'none', 'Workspace section must stay hidden after delete');
    assert.strictEqual(env.elements.sideNavDocuments.classList.contains('active'), true, 'Documents nav item must be active');
    assert.strictEqual(env.elements.sideNavTranslate.classList.contains('active'), false, 'Translate nav item must NOT be active');
    assert.strictEqual(env.elements.sideNavHome.classList.contains('active'), false, 'Home nav item must NOT be active');
    assert.strictEqual(env.store['pdfl_active_view'], 'documents', 'Active view must be saved as documents in sessionStorage');

    // Simulate Live Server reload with preserved sessionStorage
    const reloadedEnv = createTestEnvironment({
      pdfl_user: JSON.stringify({ full_name: 'User', email: 'user@pdflingua.io', role: 'user' }),
      pdfl_token: 'valid-jwt-token',
      pdfl_active_view: env.store['pdfl_active_view'],
    });
    assert.strictEqual(reloadedEnv.elements.documentsSection.style.display, 'block', 'Documents section must restore after reload');
    assert.strictEqual(reloadedEnv.elements.heroSection.style.display, 'none', 'Hero section must stay hidden after reload');
    assert.strictEqual(reloadedEnv.elements.workspaceSection.style.display, 'none', 'Workspace section must stay hidden after reload');
    assert.strictEqual(reloadedEnv.elements.sideNavDocuments.classList.contains('active'), true, 'Documents nav item must restore active state');
    assert.strictEqual(reloadedEnv.elements.sideNavTranslate.classList.contains('active'), false, 'Translate nav item must not be active after reload');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (${totalTests - passedTests} failed).`);
  console.log('================================================================');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

main();
