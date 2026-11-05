/**
 * PDF-Lingua: Collapsible Sidebar Navigation Test Suite
 * ---------------------------------------------------
 * Verifies:
 * 1. Static HTML structure: Presence of app shell, sidebar, sections, and items.
 * 2. Guest Mode: Sidebar is completely hidden for unauthenticated guests, revealed on login.
 * 3. Toggle behavior: Expands and collapses with CSS classes and ARIA attributes.
 * 4. LocalStorage persistence: Remembers collapsed state across reload.
 * 5. Keyboard shortcuts: Ctrl+B toggles sidebar, Escape closes mobile drawer.
 * 6. Mobile Drawer: Backdrop activation, open, close, and outside-click.
 * 7. User profile synchronization: Free, Pro, and Admin roles.
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
    this.innerHTML = '';
    this.classList = new ClassList();
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.className = '';
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
}

function createTestEnvironment(initialStorage = {}) {
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
    btnSidebarNewChat: new MockElement('btnSidebarNewChat', 'button'),
    sidebarUserProfile: new MockElement('sidebarUserProfile'),
    sidebarUserAvatar: new MockElement('sidebarUserAvatar'),
    sidebarUserName: new MockElement('sidebarUserName'),
    sidebarUserRole: new MockElement('sidebarUserRole'),
    sideNavTranslate: new MockElement('sideNavTranslate', 'a'),
    sideNavAiCopilot: new MockElement('sideNavAiCopilot', 'a'),
    sideNavAdmin: new MockElement('sideNavAdmin', 'a'),
    sideNavPricing: new MockElement('sideNavPricing', 'a'),
    sideNavAdminItem: new MockElement('sideNavAdminItem', 'li'),
    btnOpenAccountModal: new MockElement('btnOpenAccountModal', 'button'),
    btnLogin: new MockElement('btnLogin', 'button'),
    btnNewFile: new MockElement('btnNewFile', 'button'),
    heroSection: new MockElement('heroSection', 'section'),
    adminSection: new MockElement('adminSection', 'section'),
    btnOpenAdmin: new MockElement('btnOpenAdmin', 'button'),
  };

  const docListeners = {};
  const winListeners = {};

  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '.sidebar-nav-item') {
        return [elements.sideNavTranslate, elements.sideNavAiCopilot, elements.sideNavAdmin, elements.sideNavPricing];
      }
      return [];
    },
    addEventListener: (event, fn) => {
      docListeners[event] = docListeners[event] || [];
      docListeners[event].push(fn);
    },
    body: { style: {} },
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
  };

  const sandbox = {
    document: mockDocument,
    window: mockWindow,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
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

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
  }
}

console.log('================================================================');
console.log('PDF-Lingua Collapsible Sidebar Navigation Test Suite');
console.log('================================================================\n');

// 1. Static HTML Markup
runTest('HTML: App Shell and Sidebar elements exist', () => {
  assert.ok(htmlSource.includes('id="appShell"'), 'appShell must exist');
  assert.ok(htmlSource.includes('id="appSidebar"'), 'appSidebar must exist');
  assert.ok(htmlSource.includes('id="appMainViewport"'), 'appMainViewport must exist');
  assert.ok(htmlSource.includes('id="sidebarBackdrop"'), 'sidebarBackdrop must exist');
  assert.ok(htmlSource.includes('id="btnToggleSidebar"'), 'btnToggleSidebar must exist');
  assert.ok(htmlSource.includes('id="btnMobileSidebarToggle"'), 'btnMobileSidebarToggle must exist');
  assert.ok(htmlSource.includes('id="btnSidebarNewChat"'), 'btnSidebarNewChat must exist');
  assert.ok(htmlSource.includes('id="sidebarUserProfile"'), 'sidebarUserProfile must exist');
});

runTest('HTML: Sidebar contains all required sections', () => {
  assert.ok(htmlSource.includes('Đã ghim'), 'Pinned items section must exist');
  assert.ok(htmlSource.includes('Dự án'), 'Projects section must exist');
  assert.ok(htmlSource.includes('Gần đây'), 'Recent items section must exist');
  assert.ok(htmlSource.includes('data-tooltip='), 'data-tooltip attributes must exist for collapsed mode');
});

// 2. Guest Mode: Completely hide sidebar for unauthenticated users
runTest('Guest Mode: Unauthenticated guest activates guest-mode (sidebar hidden)', () => {
  const env = createTestEnvironment();
  assert.strictEqual(env.elements.appShell.classList.contains('guest-mode'), true);
  assert.strictEqual(env.elements.sideNavAdminItem.style.display, 'none');
});

runTest('Guest Mode: Login event removes guest-mode and reveals sidebar', () => {
  const env = createTestEnvironment();
  assert.strictEqual(env.elements.appShell.classList.contains('guest-mode'), true);

  env.dispatchAuthChange({ id: 10, email: 'user@example.com', full_name: 'Test User', role: 'free' });
  assert.strictEqual(env.elements.appShell.classList.contains('guest-mode'), false);
  assert.strictEqual(env.elements.sidebarUserName.textContent, 'Test User');
  assert.strictEqual(env.elements.sidebarUserRole.textContent, 'Gói Miễn phí');
});

runTest('Guest Mode: Logout event re-applies guest-mode to hide sidebar', () => {
  const env = createTestEnvironment({
    pdfl_user: JSON.stringify({ id: 10, email: 'user@example.com', role: 'pro' }),
  });
  assert.strictEqual(env.elements.appShell.classList.contains('guest-mode'), false);

  env.dispatchAuthChange(null);
  assert.strictEqual(env.elements.appShell.classList.contains('guest-mode'), true);
  assert.strictEqual(env.elements.sidebarUserName.textContent, 'Khách vãng lai');
});

// 3. Default & Toggle Behavior
runTest('Behavior: Default state is expanded', () => {
  const env = createTestEnvironment({
    pdfl_user: JSON.stringify({ id: 1, email: 'member@test.com', role: 'free' }),
  });
  assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), false);
  assert.strictEqual(env.elements.appShell.classList.contains('sidebar-collapsed'), false);
  assert.strictEqual(env.elements.btnToggleSidebar.getAttribute('aria-expanded'), 'true');
});

runTest('Behavior: Clicking toggle collapses the sidebar and updates attributes', () => {
  const env = createTestEnvironment({
    pdfl_user: JSON.stringify({ id: 1, email: 'member@test.com', role: 'free' }),
  });
  env.elements.btnToggleSidebar.click();
  assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), true);
  assert.strictEqual(env.elements.appShell.classList.contains('sidebar-collapsed'), true);
  assert.strictEqual(env.elements.btnToggleSidebar.getAttribute('aria-expanded'), 'false');
  assert.strictEqual(env.store['pdf_lingua_sidebar_collapsed'], 'true');
});

runTest('Behavior: Clicking toggle again expands the sidebar', () => {
  const env = createTestEnvironment({
    pdf_lingua_sidebar_collapsed: 'true',
    pdfl_user: JSON.stringify({ id: 1, email: 'member@test.com', role: 'free' }),
  });
  assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), true);

  env.elements.btnToggleSidebar.click();
  assert.strictEqual(env.elements.appSidebar.classList.contains('collapsed'), false);
  assert.strictEqual(env.elements.appShell.classList.contains('sidebar-collapsed'), false);
  assert.strictEqual(env.elements.btnToggleSidebar.getAttribute('aria-expanded'), 'true');
  assert.strictEqual(env.store['pdf_lingua_sidebar_collapsed'], 'false');
});

// 4. Keyboard Shortcuts
runTest('Keyboard: Ctrl+B toggles sidebar state', () => {
  const env = createTestEnvironment({
    pdfl_user: JSON.stringify({ id: 1, email: 'member@test.com', role: 'free' }),
  });
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

// 5. Mobile Drawer & Backdrop
runTest('Mobile: Clicking mobile button opens drawer and backdrop', () => {
  const env = createTestEnvironment({
    pdfl_user: JSON.stringify({ id: 1, email: 'member@test.com', role: 'free' }),
  });
  env.elements.btnMobileSidebarToggle.click();

  assert.strictEqual(env.elements.appSidebar.classList.contains('mobile-open'), true);
  assert.strictEqual(env.elements.sidebarBackdrop.classList.contains('active'), true);
  assert.strictEqual(env.sandbox.document.body.style.overflow, 'hidden');
});

runTest('Mobile: Clicking backdrop closes mobile drawer', () => {
  const env = createTestEnvironment({
    pdfl_user: JSON.stringify({ id: 1, email: 'member@test.com', role: 'free' }),
  });
  env.elements.btnMobileSidebarToggle.click();
  assert.strictEqual(env.elements.appSidebar.classList.contains('mobile-open'), true);

  env.elements.sidebarBackdrop.click();
  assert.strictEqual(env.elements.appSidebar.classList.contains('mobile-open'), false);
  assert.strictEqual(env.elements.sidebarBackdrop.classList.contains('active'), false);
  assert.strictEqual(env.sandbox.document.body.style.overflow, '');
});

runTest('Mobile: Pressing Escape closes mobile drawer', () => {
  const env = createTestEnvironment({
    pdfl_user: JSON.stringify({ id: 1, email: 'member@test.com', role: 'free' }),
  });
  env.elements.btnMobileSidebarToggle.click();
  assert.strictEqual(env.elements.appSidebar.classList.contains('mobile-open'), true);

  env.triggerDocKeydown({ key: 'Escape' });
  assert.strictEqual(env.elements.appSidebar.classList.contains('mobile-open'), false);
  assert.strictEqual(env.elements.sidebarBackdrop.classList.contains('active'), false);
});

// 6. User Profile Synchronization
runTest('User Sync: Pro user renders Pro VIP role', () => {
  const env = createTestEnvironment();
  env.dispatchAuthChange({ full_name: 'John Doe', email: 'john@example.com', role: 'pro' });

  assert.strictEqual(env.elements.sidebarUserAvatar.textContent, 'J');
  assert.strictEqual(env.elements.sidebarUserName.textContent, 'John Doe');
  assert.strictEqual(env.elements.sidebarUserRole.textContent, 'Gói Pro VIP');
  assert.strictEqual(env.elements.sideNavAdminItem.style.display, 'none');
});

runTest('User Sync: Admin user renders Admin role and displays admin menu item', () => {
  const env = createTestEnvironment();
  env.dispatchAuthChange({ full_name: 'Admin Boss', email: 'admin@example.com', role: 'admin' });

  assert.strictEqual(env.elements.sidebarUserAvatar.textContent, 'A');
  assert.strictEqual(env.elements.sidebarUserName.textContent, 'Admin Boss');
  assert.strictEqual(env.elements.sidebarUserRole.textContent, 'Quản trị viên');
  assert.strictEqual(env.elements.sideNavAdminItem.style.display, 'block');
});

// 7. Action Button & Profile Interaction
runTest('Action: New Chat button resets workspace and scrolls hero', () => {
  const env = createTestEnvironment({
    pdfl_user: JSON.stringify({ id: 1, email: 'member@test.com', role: 'free' }),
  });
  let newFileClicked = false;
  env.elements.btnNewFile.click = () => { newFileClicked = true; };
  env.elements.adminSection.style.display = 'block';

  env.elements.btnSidebarNewChat.click();
  assert.strictEqual(newFileClicked, true);
  assert.strictEqual(env.elements.adminSection.style.display, 'none');
});

runTest('Action: User Profile click opens Account modal for logged-in user', () => {
  const env = createTestEnvironment({
    pdfl_user: JSON.stringify({ id: 1, email: 'user@example.com', role: 'pro' }),
  });
  let accountModalOpened = false;
  env.elements.btnOpenAccountModal.click = () => { accountModalOpened = true; };

  env.elements.sidebarUserProfile.click();
  assert.strictEqual(accountModalOpened, true);
});

runTest('Action: User Profile click opens Login modal for guest', () => {
  const env = createTestEnvironment();
  let loginModalOpened = false;
  env.elements.btnLogin.click = () => { loginModalOpened = true; };

  env.elements.sidebarUserProfile.click();
  assert.strictEqual(loginModalOpened, true);
});

console.log('\n================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (${totalTests - passedTests} failed).`);
console.log('================================================================');

if (passedTests < totalTests) {
  process.exit(1);
}
