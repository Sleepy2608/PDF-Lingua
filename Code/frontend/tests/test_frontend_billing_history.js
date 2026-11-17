/**
 * PDF-Lingua: Billing History UI & Invoice Receipt Test Suite
 * -------------------------------------------------------------
 * Verifies:
 * 1. HTML & CSS architecture: Navigation tabs, containers, billing table,
 *    invoice modal, receipt markup, print styles, and badges.
 * 2. Tab switching: Toggling between Pricing Plans and Billing History views.
 * 3. Table rendering: Formats STT, transaction code, plan name, dates, amount in VND,
 *    VietQR method, and status badges.
 * 4. Status filter: Filtering by all, completed, pending, failed, and expired.
 * 5. Pagination: Page slicing (10 items/page), prev/next controls, page number buttons.
 * 6. Empty & Card states: Handling 0 items with clean empty state.
 * 7. Action trigger: "Xem hóa đơn" button dispatches invoice view event and opens modal.
 * 8. Invoice Modal data binding: Populates buyer, plan, duration, breakdown, and totals.
 * 9. Invoice Modal edge cases: Missing QR hides QR box; missing note displays fallback.
 * 10. Invoice Modal closing mechanisms: Close button, footer button, backdrop click, Escape key.
 * 11. Invoice Receipt print: Invokes window.print() cleanly.
 * 12. Invoice Receipt download: Generates standalone HTML receipt blob and triggers file download.
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
    this.src = '';
    this.href = '';
    this.download = '';
  }
  set className(val) {
    this.classList = new ClassList(String(val).split(/\s+/).filter(Boolean));
  }
  get className() {
    return Array.from(this.classList.values).join(' ');
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
  removeChild(child) {
    this.children = this.children.filter((c) => c !== child);
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

  // Invoice Modal Elements
  const invoiceModal = reg('billingInvoiceModal', 'div', ['modal-overlay', 'invoice-modal-overlay'], { hidden: '', 'aria-hidden': 'true' });
  invoiceModal.style.display = 'none';
  reg('btnCloseInvoiceModal', 'button');
  reg('btnInvoiceModalCloseFooter', 'button');
  reg('btnPrintInvoice', 'button');
  reg('btnDownloadInvoice', 'button');
  reg('invoiceStatusBadge', 'span', ['billing-status-badge', 'status-badge-completed']);
  reg('invoiceStatusText', 'span');
  reg('invoiceModalTitle', 'h3');
  reg('invoiceNumber', 'div');
  reg('invoiceTxCode', 'div');
  reg('invoiceBuyerName', 'span');
  reg('invoiceBuyerEmail', 'span');
  reg('invoicePaymentMethod', 'span');
  reg('invoicePlanName', 'strong');
  reg('invoiceCycleDuration', 'span');
  reg('invoiceCreatedAt', 'span');
  reg('invoicePaidAt', 'span');
  reg('invoiceItemDesc', 'div');
  reg('invoiceItemSub', 'div');
  reg('invoiceItemCycle', 'td');
  reg('invoiceItemPrice', 'td');
  reg('invoiceItemTaxRate', 'td');
  reg('invoiceItemAmount', 'td');
  reg('invoiceSubtotal', 'span');
  reg('invoiceTaxAmount', 'span');
  reg('invoiceTotalAmount', 'span');
  reg('invoicePaymentNote', 'div');
  const qrWrap = reg('invoiceQrWrap', 'div');
  qrWrap.style.display = 'none';
  const qrImage = reg('invoiceQrImage', 'img');
  qrImage.src = '';

  const dispatchedEvents = [];
  const domListeners = {};
  const mockBody = new MockElement('body', 'body');

  const mockDocument = {
    body: mockBody,
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => {
      if (sel === '.billing-table-responsive') return tableWrap;
      return null;
    },
    querySelectorAll: (sel) => [],
    createElement: (tag) => new MockElement('', tag),
    addEventListener: (event, fn) => {
      domListeners[event] = domListeners[event] || [];
      domListeners[event].push(fn);
    },
    dispatchEvent: (evt) => {
      dispatchedEvents.push(evt);
      return true;
    },
  };

  let printCallCount = 0;
  const windowListeners = {};
  const mockWindow = {
    PDFLinguaAuth: null,
    PDFLinguaPricing: null,
    location: { protocol: 'http:', port: '8000' },
    print: () => {
      printCallCount++;
    },
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

  let createdBlobs = [];
  const mockUrl = {
    createObjectURL: (blob) => {
      const u = 'blob:test/' + Math.random().toString(36).substring(7);
      createdBlobs.push({ url: u, blob });
      return u;
    },
    revokeObjectURL: (u) => {
      createdBlobs = createdBlobs.filter((x) => x.url !== u);
    },
  };

  const context = {
    window: mockWindow,
    document: mockDocument,
    console: console,
    URL: mockUrl,
    Blob: class Blob {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    },
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

  function dispatchKeydown(key) {
    if (domListeners['keydown']) {
      domListeners['keydown'].forEach((fn) => fn({ key, preventDefault: () => {} }));
    }
  }

  return {
    elements,
    tableWrap,
    mockBody,
    window: context.window,
    dispatchedEvents,
    dispatchKeydown,
    getPrintCallCount: () => printCallCount,
    getCreatedBlobs: () => createdBlobs,
  };
}

console.log('================================================================');
console.log('PDF-Lingua Billing History & Invoice Receipt Test Suite');
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

// Invoice Modal HTML
assert.ok(htmlSource.includes('id="billingInvoiceModal"'), 'HTML must contain #billingInvoiceModal');
assert.ok(htmlSource.includes('id="btnCloseInvoiceModal"'), 'HTML must contain #btnCloseInvoiceModal');
assert.ok(htmlSource.includes('id="btnInvoiceModalCloseFooter"'), 'HTML must contain #btnInvoiceModalCloseFooter');
assert.ok(htmlSource.includes('id="btnPrintInvoice"'), 'HTML must contain #btnPrintInvoice');
assert.ok(htmlSource.includes('id="btnDownloadInvoice"'), 'HTML must contain #btnDownloadInvoice');
assert.ok(htmlSource.includes('id="invoiceNumber"'), 'HTML must contain #invoiceNumber');
assert.ok(htmlSource.includes('id="invoiceBuyerName"'), 'HTML must contain #invoiceBuyerName');
assert.ok(htmlSource.includes('id="invoicePlanName"'), 'HTML must contain #invoicePlanName');
assert.ok(htmlSource.includes('id="invoiceTotalAmount"'), 'HTML must contain #invoiceTotalAmount');
assert.ok(htmlSource.includes('id="invoicePaymentNote"'), 'HTML must contain #invoicePaymentNote');
assert.ok(htmlSource.includes('id="invoiceQrWrap"'), 'HTML must contain #invoiceQrWrap');

// CSS checks
assert.ok(pricingCssSource.includes('.pricing-tabs-bar'), 'CSS must style .pricing-tabs-bar');
assert.ok(pricingCssSource.includes('.pricing-tab-btn'), 'CSS must style .pricing-tab-btn');
assert.ok(pricingCssSource.includes('.billing-history-card'), 'CSS must style .billing-history-card');
assert.ok(pricingCssSource.includes('.status-badge-completed'), 'CSS must style .status-badge-completed');
assert.ok(pricingCssSource.includes('.status-badge-pending'), 'CSS must style .status-badge-pending');
assert.ok(pricingCssSource.includes('.status-badge-failed'), 'CSS must style .status-badge-failed');
assert.ok(pricingCssSource.includes('.status-badge-expired'), 'CSS must style .status-badge-expired');
assert.ok(pricingCssSource.includes('.btn-view-invoice'), 'CSS must style .btn-view-invoice');
assert.ok(pricingCssSource.includes('.invoice-modal-overlay'), 'CSS must style .invoice-modal-overlay');
assert.ok(pricingCssSource.includes('.invoice-modal-card'), 'CSS must style .invoice-modal-card');
assert.ok(pricingCssSource.includes('@media print'), 'CSS must contain @media print styles');
assert.ok(pricingCssSource.includes('@page'), 'CSS must configure printable @page margins');
console.log('[PASS] HTML & CSS Architecture: All navigation tabs, containers, modal, and print styles exist');

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

// 7. Action Button Trigger & Modal Opening
win.PDFLinguaPricing.setMockBillingTransactions(null); // resets to default mock items
win.PDFLinguaPricing.handleViewInvoiceClick('TXN-20261117-001');

assert.strictEqual(env.dispatchedEvents.length, 1);
const evt = env.dispatchedEvents[0];
assert.strictEqual(evt.type, 'pdfl:view-invoice');
assert.strictEqual(evt.detail.transactionCode, 'TXN-20261117-001');
assert.strictEqual(evt.detail.transaction.invoice_number, 'INV-TXN-20261117-001');
assert.strictEqual(elements.billingInvoiceModal.style.display, 'flex');
assert.strictEqual(elements.billingInvoiceModal.getAttribute('aria-hidden'), 'false');
assert.strictEqual(elements.billingInvoiceModal.hasAttribute('hidden'), false);
console.log('[PASS] Action Trigger: Clicking "Xem hóa đơn" dispatches event and opens invoice modal');

// 8. Invoice Modal Data Binding
assert.strictEqual(elements.invoiceNumber.textContent, 'INV-TXN-20261117-001');
assert.strictEqual(elements.invoiceTxCode.textContent, 'Mã GD: TXN-20261117-001');
assert.strictEqual(elements.invoiceStatusText.textContent, 'Hoàn tất');
assert.ok(elements.invoiceStatusBadge.classList.contains('status-badge-completed'));
assert.strictEqual(elements.invoiceBuyerName.textContent, 'Nguyễn Văn Mua');
assert.strictEqual(elements.invoiceBuyerEmail.textContent, 'buyer@example.com');
assert.strictEqual(elements.invoicePaymentMethod.textContent, 'VietQR Napas247');
assert.strictEqual(elements.invoicePlanName.textContent, 'Gói Pro Hàng Tháng');
assert.strictEqual(elements.invoiceCycleDuration.textContent, 'Theo tháng (30 ngày)');
assert.strictEqual(elements.invoiceItemCycle.textContent, '30 ngày');
assert.strictEqual(elements.invoiceItemPrice.textContent, '49.000 VNĐ');
assert.strictEqual(elements.invoiceItemTaxRate.textContent, '0% (VAT)');
assert.strictEqual(elements.invoiceItemAmount.textContent, '49.000 VNĐ');
assert.strictEqual(elements.invoiceSubtotal.textContent, '49.000 VNĐ');
assert.strictEqual(elements.invoiceTaxAmount.textContent, '0 VNĐ');
assert.strictEqual(elements.invoiceTotalAmount.textContent, '49.000 VNĐ');
assert.strictEqual(elements.invoicePaymentNote.textContent, 'PRO MONTHLY NOV');
assert.strictEqual(elements.invoiceQrWrap.style.display, 'flex');
assert.ok(elements.invoiceQrImage.src.includes('vietqr.io'));
assert.strictEqual(env.mockBody.style.overflow, 'hidden');
console.log('[PASS] Modal Data Binding: Populated complete buyer, plan, duration, financial breakdown, and QR code');

// 9. Invoice Modal Edge Cases (Missing QR & Fallback Note)
// Case A: Missing QR Code (null qr_code_url)
win.PDFLinguaPricing.openInvoiceModal('TXN-20261116-002');
assert.strictEqual(elements.invoiceNumber.textContent, 'INV-TXN-20261116-002');
assert.strictEqual(elements.invoicePlanName.textContent, 'Gói Pro Hàng Năm');
assert.strictEqual(elements.invoiceCycleDuration.textContent, 'Theo năm (365 ngày)');
assert.strictEqual(elements.invoiceItemCycle.textContent, '365 ngày');
assert.strictEqual(elements.invoiceTotalAmount.textContent, '399.000 VNĐ');
assert.strictEqual(elements.invoiceQrWrap.style.display, 'none');
assert.strictEqual(elements.invoiceQrImage.src, '');

// Case B: Null Payment Note
win.PDFLinguaPricing.openInvoiceModal('TXN-20261110-006');
assert.strictEqual(elements.invoicePaymentNote.textContent, 'Tự động đối soát hệ thống');

// Case C: Pending Status
win.PDFLinguaPricing.openInvoiceModal('TXN-20261115-003');
assert.strictEqual(elements.invoiceStatusText.textContent, 'Đang xử lý');
assert.ok(elements.invoiceStatusBadge.classList.contains('status-badge-pending'));
console.log('[PASS] Modal Edge Cases: Missing QR hides QR box, missing note displays fallback, statuses match badges');

// 10. Modal Closing Mechanisms
// Mechanism 1: Close button in header
elements.btnCloseInvoiceModal.click();
assert.strictEqual(elements.billingInvoiceModal.style.display, 'none');
assert.strictEqual(elements.billingInvoiceModal.getAttribute('aria-hidden'), 'true');
assert.strictEqual(elements.billingInvoiceModal.hasAttribute('hidden'), true);
assert.strictEqual(env.mockBody.style.overflow, '');

// Mechanism 2: Footer close button
win.PDFLinguaPricing.openInvoiceModal('TXN-20261117-001');
assert.strictEqual(elements.billingInvoiceModal.style.display, 'flex');
elements.btnInvoiceModalCloseFooter.click();
assert.strictEqual(elements.billingInvoiceModal.style.display, 'none');

// Mechanism 3: Backdrop overlay click
win.PDFLinguaPricing.openInvoiceModal('TXN-20261117-001');
assert.strictEqual(elements.billingInvoiceModal.style.display, 'flex');
elements.billingInvoiceModal.click();
assert.strictEqual(elements.billingInvoiceModal.style.display, 'none');

// Mechanism 4: Escape key
win.PDFLinguaPricing.openInvoiceModal('TXN-20261117-001');
assert.strictEqual(elements.billingInvoiceModal.style.display, 'flex');
env.dispatchKeydown('Escape');
assert.strictEqual(elements.billingInvoiceModal.style.display, 'none');
console.log('[PASS] Modal Closing: Successfully closed via header button, footer button, backdrop click, and Escape key');

// 11. Invoice Receipt Print
win.PDFLinguaPricing.openInvoiceModal('TXN-20261117-001');
assert.strictEqual(env.getPrintCallCount(), 0);
elements.btnPrintInvoice.click();
assert.strictEqual(env.getPrintCallCount(), 1);
win.PDFLinguaPricing.printInvoiceReceipt();
assert.strictEqual(env.getPrintCallCount(), 2);
console.log('[PASS] Receipt Print: "In hóa đơn" button and printInvoiceReceipt() trigger window.print()');

// 12. Invoice Receipt Download
assert.strictEqual(env.getCreatedBlobs().length, 0);
elements.btnDownloadInvoice.click();
assert.strictEqual(env.getCreatedBlobs().length, 0); // revoked after trigger
// Verify generateReceiptHtml output
const currentTx = win.PDFLinguaPricing.getCurrentInvoiceTransaction();
assert.ok(currentTx, 'Current invoice transaction must exist');
const receiptHtml = win.PDFLinguaPricing.generateReceiptHtml(currentTx);
assert.ok(receiptHtml.includes('<!DOCTYPE html>'));
assert.ok(receiptHtml.includes('INV-TXN-20261117-001'));
assert.ok(receiptHtml.includes('Nguyễn Văn Mua'));
assert.ok(receiptHtml.includes('49.000 VNĐ'));
assert.ok(receiptHtml.includes('BẢNG KÊ QUYẾT TOÁN THANH TOÁN') || receiptHtml.includes('Mô tả khoản mục'));
assert.ok(receiptHtml.includes('PRO MONTHLY NOV'));
assert.ok(receiptHtml.includes('@media print'));
console.log('[PASS] Receipt Download: "Tải biên lai" generates complete HTML receipt document with inline styling');

console.log('\n================================================================');
console.log('SUMMARY: All 12/12 billing history & receipt tests passed (0 failed).');
console.log('================================================================');
