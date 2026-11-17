/**
 * PDF-Lingua: Billing History UI & Tab Navigation Test Suite
 * -----------------------------------------------------------
 * Verifies:
 * 1. HTML & CSS architecture: Navigation tabs (#tabPricingPlans, #tabBillingHistory),
 *    containers (#pricingPlansContainer, #billingHistoryContainer), table, status filter,
 *    badges, action buttons, pagination footer, and card states.
 * 2. Tab switching: Toggling between Pricing Plans and Billing History views.
 * 3. Table rendering: Formats STT, transaction code, plan name, dates, amount in VND,
 *    VietQR method, and status badges (Completed, Pending, Failed, Expired).
 * 4. Status filter: Filtering by all, completed, pending, failed, and expired.
 * 5. Pagination: Page slicing (10 items/page), prev/next controls, page number buttons.
 * 6. Empty & Card states: Handling 0 items with clean empty state.
 * 7. Action trigger: "Xem hóa đơn" button dispatches invoice view event with transaction details.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const pricingSource = fs.readFileSync(path.resolve(__dirname, '../js/pricing.js'), 'utf8');
const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const pricingCssSource = fs.readFileSync(path.resolve(__dirname, '../css/pricing.css'), 'utf8');

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
    this.disabled = false;
    this.children = [];
  }
  set innerHTML(val) {
    this._innerHTML = String(val);
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
  click() {
    if (this.disabled) return;
    if (this.listeners['click']) {
      this.listeners['click'].forEach((fn) =>
        fn({ target: this, preventDefault: () => {}, stopPropagation: () => {} })
      );
    }
  }
  querySelectorAll(sel) {
    return [];
  }
  querySelector(sel) {
    return null;
  }
}

function createBillingTestEnv() {
  const elements = {};
  function reg(id, tag = 'div', classes = [], attrs = {}) {
    const el = new MockElement(id, tag, classes, attrs);
    elements[id] = el;
    return el;
  }

  // Navigation tabs & containers
  reg('pricingSection', 'section');
  reg('tabPricingPlans', 'button', ['pricing-tab-btn', 'active'], { 'aria-selected': 'true' });
  reg('tabBillingHistory', 'button', ['pricing-tab-btn'], { 'aria-selected': 'false' });
  reg('billingHistoryTabBadge', 'span');
  const plansContainer = reg('pricingPlansContainer', 'div');
  plansContainer.style.display = 'block';
  const historyContainer = reg('billingHistoryContainer', 'div', [], { style: 'display: none;' });
  historyContainer.style.display = 'none';

  // Billing History Card & Controls
  reg('billingHistoryCard', 'div');
  reg('billingHistoryCountChip', 'div');
  reg('billingStatusFilter', 'select');
  reg('billingHistoryTable', 'table');
  reg('billingHistoryTableBody', 'tbody');
  reg('billingHistoryLoadingState', 'div');
  reg('billingHistoryEmptyState', 'div');
  reg('billingHistoryErrorState', 'div');
  reg('billingHistoryErrorMessage', 'div');
  reg('btnRetryBillingHistory', 'button');

  // Pagination Footer
  reg('billingPaginationFooter', 'div');
  reg('billingPaginationInfo', 'div');
  reg('billingPaginationControls', 'div');
  reg('btnBillingPrevPage', 'button');
  reg('btnBillingNextPage', 'button');
  reg('billingPageNumbers', 'div');

  // Table wrapper
  const tableWrap = new MockElement('', 'div', ['billing-table-responsive']);

  const dispatchedEvents = [];

  const domListeners = {};
  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => {
      if (sel === '.billing-table-responsive') return tableWrap;
      return null;
    },
    querySelectorAll: (sel) => [],
    addEventListener: (event, fn) => {
      domListeners[event] = domListeners[event] || [];
      domListeners[event].push(fn);
    },
    dispatchEvent: (evt) => {
      dispatchedEvents.push(evt);
      return true;
    },
  };

  const windowListeners = {};
  const mockWindow = {
    PDFLinguaAuth: null,
    PDFLinguaPricing: null,
    location: { protocol: 'http:', port: '8000' },
    addEventListener: (event, fn) => {
      windowListeners[event] = windowListeners[event] || [];
      windowListeners[event].push(fn);
    },
    removeEventListener: (event, fn) => {
      if (windowListeners[event]) {
        windowListeners[event] = windowListeners[event].filter((f) => f !== fn);
      }
    },
    dispatchEvent: (evt) => true,
  };

  const context = {
    window: mockWindow,
    document: mockDocument,
    console: console,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail || {};
      }
    },
    setTimeout: (fn) => fn(),
    setInterval: () => 1,
    clearInterval: () => {},
    clearTimeout: () => {},
    showToast: (msg, type) => {},
  };

  vm.createContext(context);
  vm.runInContext(pricingSource, context);

  // Trigger DOMContentLoaded
  if (domListeners['DOMContentLoaded']) {
    domListeners['DOMContentLoaded'].forEach((fn) => fn());
  }

  return {
    elements,
    tableWrap,
    window: context.window,
    dispatchedEvents,
  };
}

console.log('================================================================');
console.log('PDF-Lingua Billing History UI & Tab Navigation Test Suite');
console.log('================================================================\n');

// 1. Static HTML & CSS Architecture
assert.ok(htmlSource.includes('id="tabPricingPlans"'), 'HTML must contain #tabPricingPlans');
assert.ok(htmlSource.includes('id="tabBillingHistory"'), 'HTML must contain #tabBillingHistory');
assert.ok(htmlSource.includes('id="pricingPlansContainer"'), 'HTML must contain #pricingPlansContainer');
assert.ok(htmlSource.includes('id="billingHistoryContainer"'), 'HTML must contain #billingHistoryContainer');
assert.ok(htmlSource.includes('id="billingHistoryTable"'), 'HTML must contain #billingHistoryTable');
assert.ok(htmlSource.includes('id="billingHistoryTableBody"'), 'HTML must contain #billingHistoryTableBody');
assert.ok(htmlSource.includes('id="billingStatusFilter"'), 'HTML must contain #billingStatusFilter');
assert.ok(htmlSource.includes('id="billingPaginationFooter"'), 'HTML must contain #billingPaginationFooter');
assert.ok(htmlSource.includes('id="billingHistoryEmptyState"'), 'HTML must contain #billingHistoryEmptyState');
assert.ok(htmlSource.includes('id="billingHistoryLoadingState"'), 'HTML must contain #billingHistoryLoadingState');
assert.ok(htmlSource.includes('id="billingHistoryErrorState"'), 'HTML must contain #billingHistoryErrorState');

// CSS checks
assert.ok(pricingCssSource.includes('.pricing-tabs-bar'), 'CSS must style .pricing-tabs-bar');
assert.ok(pricingCssSource.includes('.pricing-tab-btn'), 'CSS must style .pricing-tab-btn');
assert.ok(pricingCssSource.includes('.billing-history-card'), 'CSS must style .billing-history-card');
assert.ok(pricingCssSource.includes('.status-badge-completed'), 'CSS must style .status-badge-completed');
assert.ok(pricingCssSource.includes('.status-badge-pending'), 'CSS must style .status-badge-pending');
assert.ok(pricingCssSource.includes('.status-badge-failed'), 'CSS must style .status-badge-failed');
assert.ok(pricingCssSource.includes('.status-badge-expired'), 'CSS must style .status-badge-expired');
assert.ok(pricingCssSource.includes('.btn-view-invoice'), 'CSS must style .btn-view-invoice');
assert.ok(pricingCssSource.includes('var(--text-primary, #0F172A) !important'), 'CSS must style pagination active button black');
console.log('[PASS] HTML & CSS Architecture: All navigation tabs, containers, badges, and controls exist');

// 2. Tab Navigation
const env = createBillingTestEnv();
const { elements, window: win } = env;

assert.strictEqual(elements.pricingPlansContainer.style.display, 'block');
assert.strictEqual(elements.billingHistoryContainer.style.display, 'none');
assert.ok(elements.tabPricingPlans.classList.contains('active'));
assert.ok(!elements.tabBillingHistory.classList.contains('active'));

// Switch to Billing History
elements.tabBillingHistory.click();
assert.strictEqual(elements.pricingPlansContainer.style.display, 'none');
assert.strictEqual(elements.billingHistoryContainer.style.display, 'block');
assert.ok(!elements.tabPricingPlans.classList.contains('active'));
assert.ok(elements.tabBillingHistory.classList.contains('active'));
console.log('[PASS] Tab Navigation: Switching to #tabBillingHistory reveals billing container and hides plans');

// Switch back to Pricing Plans
elements.tabPricingPlans.click();
assert.strictEqual(elements.pricingPlansContainer.style.display, 'block');
assert.strictEqual(elements.billingHistoryContainer.style.display, 'none');
assert.ok(elements.tabPricingPlans.classList.contains('active'));
assert.ok(!elements.tabBillingHistory.classList.contains('active'));
console.log('[PASS] Tab Navigation: Switching back to #tabPricingPlans restores plans container and hides billing');

// 3. Billing Table Rendering with Mock Data
win.PDFLinguaPricing.switchPricingTab('history');
const initialHtml = elements.billingHistoryTableBody.innerHTML;
assert.ok(initialHtml.includes('TXN-20261117-001'), 'Must render first transaction code');
assert.ok(initialHtml.includes('Gói Pro Hàng Tháng'), 'Must render plan name');
assert.ok(initialHtml.includes('49.000 VNĐ'), 'Must render amount formatted');
assert.ok(initialHtml.includes('VietQR Napas247'), 'Must render payment method');
assert.ok(initialHtml.includes('status-badge-completed'), 'Must render completed badge');
assert.ok(initialHtml.includes('btn-view-invoice'), 'Must render view invoice action button');
assert.ok(initialHtml.includes('Xem hóa đơn'), 'Must render invoice button text');

// Page size is 10, total mock items is 12 -> 10 rows on page 1
const rowMatches = initialHtml.match(/<tr/g);
assert.strictEqual(rowMatches.length, 10, 'Page 1 must render exactly 10 transaction rows');
assert.strictEqual(elements.billingHistoryCountChip.textContent, '12 giao dịch');
assert.ok(elements.billingPaginationInfo.textContent.includes('Hiển thị 1 - 10 / 12 giao dịch'));
console.log('[PASS] Table Rendering: Renders exactly 10 rows on page 1 with complete metadata and action buttons');

// 4. Status Filtering
// Filter 'completed' (7 completed items in mock data)
win.PDFLinguaPricing.filterBillingHistory('completed');
let completedHtml = elements.billingHistoryTableBody.innerHTML;
assert.ok(completedHtml.includes('status-badge-completed'), 'Filtered table must have completed badges');
assert.ok(!completedHtml.includes('status-badge-pending'), 'Must not have pending badges');
assert.ok(!completedHtml.includes('status-badge-failed'), 'Must not have failed badges');
assert.ok(!completedHtml.includes('status-badge-expired'), 'Must not have expired badges');
assert.strictEqual(elements.billingHistoryCountChip.textContent, '7 giao dịch');
console.log('[PASS] Status Filter: Filtering by "completed" shows only completed transactions (7 items)');

// Filter 'pending' (1 pending item in mock data)
win.PDFLinguaPricing.filterBillingHistory('pending');
let pendingHtml = elements.billingHistoryTableBody.innerHTML;
assert.ok(pendingHtml.includes('TXN-20261115-003'), 'Must render pending transaction code');
assert.ok(pendingHtml.includes('status-badge-pending'), 'Must have pending badge');
assert.strictEqual(elements.billingHistoryCountChip.textContent, '1 giao dịch');
console.log('[PASS] Status Filter: Filtering by "pending" shows only pending transactions (1 item)');

// Filter 'failed' (2 failed items in mock data)
win.PDFLinguaPricing.filterBillingHistory('failed');
let failedHtml = elements.billingHistoryTableBody.innerHTML;
assert.ok(failedHtml.includes('status-badge-failed'), 'Must have failed badge');
assert.strictEqual(elements.billingHistoryCountChip.textContent, '2 giao dịch');
console.log('[PASS] Status Filter: Filtering by "failed" shows only failed transactions (2 items)');

// Filter 'expired' (2 expired items in mock data)
win.PDFLinguaPricing.filterBillingHistory('expired');
let expiredHtml = elements.billingHistoryTableBody.innerHTML;
assert.ok(expiredHtml.includes('status-badge-expired'), 'Must have expired badge');
assert.strictEqual(elements.billingHistoryCountChip.textContent, '2 giao dịch');
console.log('[PASS] Status Filter: Filtering by "expired" shows only expired transactions (2 items)');

// Filter 'all' -> restores all 12 items
win.PDFLinguaPricing.filterBillingHistory('all');
assert.strictEqual(elements.billingHistoryCountChip.textContent, '12 giao dịch');
console.log('[PASS] Status Filter: Resetting to "all" restores all 12 transactions');

// 5. Pagination Controls
// Page 1: prev is disabled, next is enabled
assert.strictEqual(elements.btnBillingPrevPage.disabled, true, 'Prev button must be disabled on page 1');
assert.strictEqual(elements.btnBillingNextPage.disabled, false, 'Next button must be enabled on page 1');
assert.ok(elements.billingPageNumbers.innerHTML.includes('pagination-current-page'), 'Must render active page indicator');

// Navigate to Page 2
win.PDFLinguaPricing.goToBillingHistoryPage(2);
const page2Html = elements.billingHistoryTableBody.innerHTML;
const page2Rows = page2Html.match(/<tr/g);
assert.strictEqual(page2Rows.length, 2, 'Page 2 must render remaining 2 transactions (11 and 12)');
assert.ok(page2Html.includes('TXN-20261025-011'), 'Must include 11th transaction');
assert.ok(page2Html.includes('TXN-20261020-012'), 'Must include 12th transaction');
assert.strictEqual(elements.btnBillingPrevPage.disabled, false, 'Prev button must be enabled on page 2');
assert.strictEqual(elements.btnBillingNextPage.disabled, true, 'Next button must be disabled on page 2');
assert.ok(elements.billingPaginationInfo.textContent.includes('Hiển thị 11 - 12 / 12 giao dịch'));
console.log('[PASS] Pagination Controls: Navigating to page 2 updates rows (2 items), prev/next button states, and info text');

// Navigate back to Page 1
win.PDFLinguaPricing.goToBillingHistoryPage(1);
assert.strictEqual(elements.btnBillingPrevPage.disabled, true);
assert.strictEqual(elements.btnBillingNextPage.disabled, false);
console.log('[PASS] Pagination Controls: Navigating back to page 1 restores first 10 items');

// 6. Empty State Handling
win.PDFLinguaPricing.setMockBillingTransactions([]);
assert.strictEqual(elements.billingHistoryEmptyState.style.display, 'flex');
assert.strictEqual(env.tableWrap.style.display, 'none');
assert.strictEqual(elements.billingPaginationFooter.style.display, 'none');
assert.strictEqual(elements.billingHistoryCountChip.textContent, '0 giao dịch');
console.log('[PASS] Empty State: When transaction list is empty, #billingHistoryEmptyState is displayed and table hidden');

// 7. Action Button Trigger
// Restore mock data
win.PDFLinguaPricing.setMockBillingTransactions(null); // resets to default mock items
win.PDFLinguaPricing.handleViewInvoiceClick('TXN-20261117-001');
assert.strictEqual(env.dispatchedEvents.length, 1);
const evt = env.dispatchedEvents[0];
assert.strictEqual(evt.type, 'pdfl:view-invoice');
assert.strictEqual(evt.detail.transactionCode, 'TXN-20261117-001');
assert.strictEqual(evt.detail.transaction.invoice_number, 'INV-TXN-20261117-001');
console.log('[PASS] Action Trigger: Clicking "Xem hóa đơn" dispatches pdfl:view-invoice event with transaction metadata');

console.log('\n================================================================');
console.log('SUMMARY: All 7/7 billing history tests passed (0 failed).');
console.log('================================================================');
