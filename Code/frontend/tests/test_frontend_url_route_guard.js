/**
 * Test Suite: Frontend URL Route Guard & Navigation Security (Anti-BFLA)
 * ----------------------------------------------------------------------
 * Verifies that:
 * 1. Non-admin users or guests cannot bypass into #adminSection via URL hash navigation.
 * 2. Unauthenticated attempts to access admin views redirect back to #translate and display toast.
 * 3. Authenticated Admin users can smoothly access the admin section.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../js/sidebar.js'), 'utf8');

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
    this.classList = new ClassList();
    this.style = {};
    this.attributes = {};
    this.listeners = {};
  }
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  removeAttribute(k) { delete this.attributes[k]; }
}

function createEnvironment(role = null, token = null) {
  const elements = {
    appSidebar: new MockElement('appSidebar'),
    sidebarBackdrop: new MockElement('sidebarBackdrop'),
    btnToggleSidebar: new MockElement('btnToggleSidebar'),
    sideNavHome: new MockElement('sideNavHome'),
    sideNavTranslate: new MockElement('sideNavTranslate'),
    sideNavDocuments: new MockElement('sideNavDocuments'),
    sideNavHistory: new MockElement('sideNavHistory'),
    sideNavAdmin: new MockElement('sideNavAdmin'),
    sideNavAdminItem: new MockElement('sideNavAdminItem'),
    sideNavAdminOverview: new MockElement('sideNavAdminOverview'),
    sideNavAdminUsers: new MockElement('sideNavAdminUsers'),
    sideNavAdminAccessLogs: new MockElement('sideNavAdminAccessLogs'),
    sideNavAdminTransactions: new MockElement('sideNavAdminTransactions'),
    sideNavAiCopilot: new MockElement('sideNavAiCopilot'),
    sideNavAiSummarize: new MockElement('sideNavAiSummarize'),
    sideNavPricing: new MockElement('sideNavPricing'),
    heroSection: new MockElement('heroSection'),
    workspaceSection: new MockElement('workspaceSection'),
    documentsSection: new MockElement('documentsSection'),
    historySection: new MockElement('historySection'),
    pricingSection: new MockElement('pricingSection'),
    adminSection: new MockElement('adminSection'),
  };

  elements.adminSection.style.display = 'none';

  const toasts = [];
  const historyCalls = [];

  const context = {
    document: {
      getElementById: (id) => elements[id] || null,
      querySelectorAll: (sel) => Object.values(elements),
      addEventListener: () => {},
    },
    window: {
      innerWidth: 1024,
      addEventListener: () => {},
      scrollTo: () => {},
      pdfLinguaAuth: {
        getStoredUser: () => (role ? { email: 'test@example.com', role: role } : null),
        getAuthToken: () => token,
      },
      i18n: {
        t: (k) => k,
      },
    },
    history: {
      replaceState: (state, title, url) => {
        historyCalls.push(url);
      },
    },
    sessionStorage: {
      removeItem: () => {},
      getItem: () => null,
      setItem: () => {},
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    showToast: (msg, type) => {
      toasts.push({ msg, type });
    },
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
  };

  context.window.pdfLinguaSidebar = {};
  vm.createContext(context);
  vm.runInContext(sidebarSource, context);

  return { context, elements, toasts, historyCalls };
}

console.log('Running Frontend URL Route Guard Tests...');

// 1. Guest/Unauthenticated user attempts to navigate to Admin subview
{
  const { context, elements, toasts, historyCalls } = createEnvironment(null, null);
  context.window.PDFLinguaSidebar.navigateToAdminSubView('users');
  assert.strictEqual(elements.adminSection.style.display, 'none', 'Admin section must remain hidden for guests');
  assert(toasts.length > 0, 'Toast warning must be triggered');
  assert(historyCalls.includes('#translate'), 'URL hash must be reset to #translate');
  console.log('  PASS: Guest user rejected from navigating to admin subview');
}

// 2. Free user attempts to navigate to Admin subview
{
  const { context, elements, toasts, historyCalls } = createEnvironment('free', 'jwt-token-free');
  context.window.PDFLinguaSidebar.navigateToAdminSubView('transactions');
  assert.strictEqual(elements.adminSection.style.display, 'none', 'Admin section must remain hidden for free users');
  assert(toasts.length > 0, 'Toast warning must be triggered');
  assert(historyCalls.includes('#translate'), 'URL hash must be reset to #translate');
  console.log('  PASS: Free user rejected from navigating to admin subview');
}

// 3. Admin user with valid token successfully navigates to Admin subview
{
  const { context, elements, toasts } = createEnvironment('admin', 'jwt-token-admin');
  context.window.PDFLinguaSidebar.navigateToAdminSubView('overview');
  assert.strictEqual(elements.adminSection.style.display, 'block', 'Admin section must be shown for admin user');
  assert.strictEqual(toasts.length, 0, 'No warning toast should be shown for admin');
  console.log('  PASS: Admin user with token successfully accesses admin subview');
}

console.log('All Frontend URL Route Guard Tests PASSED!');
