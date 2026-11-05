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
      this.listeners['click'].forEach((fn) => fn({ preventDefault: () => {}, stopPropagation: () => {} }));
    }
  }
  scrollIntoView() {}
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  querySelector(sel) {
    if (sel === '.sidebar-doc-download-btn') {
      return this.children.find((c) => c.className && c.className.includes('sidebar-doc-download-btn')) || null;
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
    adminSection: new MockElement('adminSection', 'section'),
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

  const defaultFetch = async (url) => {
    if (mockFetchHandler) return mockFetchHandler(url);
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
  await runTest('User Sync: Guest user renders default profile matching Image 2', () => {
    const env = createTestEnvironment();
    assert.strictEqual(env.elements.sidebarUserName.textContent, 'Người dùng');
    assert.strictEqual(env.elements.sidebarUserRole.textContent, 'Free / Pro');
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

    // Click sideNavTranslate
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

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (${totalTests - passedTests} failed).`);
  console.log('================================================================');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

main();
