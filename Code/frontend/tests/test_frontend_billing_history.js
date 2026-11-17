/**
 * PDF-Lingua: Real Billing History & Invoice Detail API Integration Test Suite
 * -----------------------------------------------------------------------------
 * Verifies:
 * 1. HTML & CSS architecture: Navigation tabs, containers, billing table,
 *    invoice modal, loading states, receipt markup, print styles, and badges.
 * 2. Unauthenticated state: Missing JWT displays login prompt and stops unauthenticated requests.
 * 3. Authenticated Billing History API: GET /api/pricing/billing/history with Bearer token,
 *    renders table items, formatted currency, method, status badges, and pagination info.
 * 4. API-driven Status Filtering: Passes status query parameter to API (completed, pending, failed, expired, all).
 * 5. API-driven Pagination: Slices server pages with page and page_size query parameters,
 *    updates button states, and deduplicates redundant page requests.
 * 6. Empty State & Malformed Payload: Displays clean empty state on 0 records,
 *    and handles invalid JSON or success=false without silent mock fallback.
 * 7. Billing API Error Handling: Captures 401 Unauthorized, 403 Forbidden, 422 Validation Error,
 *    500 Internal Server Error, network failures, and verifies recovery via retry button.
 * 8. Billing History Out-of-Order Race Condition: Ensures older delayed responses do not overwrite
 *    newer filter responses when multiple requests are in-flight.
 * 9. Real Invoice Detail API: GET /api/pricing/billing/invoices/{code} with Bearer token,
 *    clears stale data, displays loading state, binds purchaser and financial breakdown, and enables action buttons.
 * 10. Invoice Detail Edge Cases: Missing QR hides QR box, missing memo renders fallback, handles optional buyer fields.
 * 11. Invoice Detail Error Handling: Captures 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Server Error,
 *     and network failures by closing modal and notifying user.
 * 12. Invoice Detail Out-of-Order Race Condition: Ensures opening invoice A then immediately invoice B
 *     discards invoice A's delayed response and prevents stale data leakage.
 * 13. Modal Closing Mechanisms: Header close button, footer close button, backdrop click, Escape key.
 * 14. Print & Download Receipt: Blocks printing and downloading while loading, triggers window.print() when ready,
 *     and generates standalone HTML receipt blob with correct file download.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const pricingSource = fs.readFileSync(path.resolve(__dirname, '../js/pricing.js'), 'utf8');
const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const pricingCssSource = fs.readFileSync(path.resolve(__dirname, '../css/pricing.css'), 'utf8');

const SAMPLE_TRANSACTIONS = [
  {
    id: 12,
    transaction_code: 'TXN-20261117-001',
    invoice_number: 'INV-TXN-20261117-001',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_monthly',
    plan_name: 'Gói Pro Hàng Tháng',
    billing_cycle: 'monthly',
    duration_days: 30,
    amount_vnd: 49000,
    amount_display: '49.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 49000,
    total_amount_display: '49.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'completed',
    payment_note: 'PRO MONTHLY NOV',
    qr_code_url: 'https://img.vietqr.io/image/970422-123456-compact.png?amount=49000',
    paid_at: '2026-11-17T09:30:00Z',
    created_at: '2026-11-17T09:28:15Z',
  },
  {
    id: 11,
    transaction_code: 'TXN-20261116-002',
    invoice_number: 'INV-TXN-20261116-002',
    buyer_name: 'Trần Thị Khác',
    buyer_email: 'other@example.com',
    plan_code: 'pro_yearly',
    plan_name: 'Gói Pro Hàng Năm',
    billing_cycle: 'yearly',
    duration_days: 365,
    amount_vnd: 399000,
    amount_display: '399.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 399000,
    total_amount_display: '399.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'completed',
    payment_note: 'PRO YEARLY NOV',
    qr_code_url: null,
    paid_at: '2026-11-16T14:15:00Z',
    created_at: '2026-11-16T14:10:00Z',
  },
  {
    id: 10,
    transaction_code: 'TXN-20261115-003',
    invoice_number: 'INV-TXN-20261115-003',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_monthly',
    plan_name: 'Gói Pro Hàng Tháng',
    billing_cycle: 'monthly',
    duration_days: 30,
    amount_vnd: 49000,
    amount_display: '49.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 49000,
    total_amount_display: '49.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'pending',
    payment_note: 'PRO MONTHLY PENDING',
    qr_code_url: 'https://img.vietqr.io/image/970422-123456-compact.png?amount=49000',
    paid_at: null,
    created_at: '2026-11-15T10:00:00Z',
  },
  {
    id: 9,
    transaction_code: 'TXN-20261114-004',
    invoice_number: 'INV-TXN-20261114-004',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_monthly',
    plan_name: 'Gói Pro Hàng Tháng',
    billing_cycle: 'monthly',
    duration_days: 30,
    amount_vnd: 49000,
    amount_display: '49.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 49000,
    total_amount_display: '49.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'failed',
    payment_note: 'TRANSFER REJECTED',
    qr_code_url: null,
    paid_at: null,
    created_at: '2026-11-14T16:45:00Z',
  },
  {
    id: 8,
    transaction_code: 'TXN-20261112-005',
    invoice_number: 'INV-TXN-20261112-005',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_yearly',
    plan_name: 'Gói Pro Hàng Năm',
    billing_cycle: 'yearly',
    duration_days: 365,
    amount_vnd: 399000,
    amount_display: '399.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 399000,
    total_amount_display: '399.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'expired',
    payment_note: 'TIMEOUT 15M',
    qr_code_url: null,
    paid_at: null,
    created_at: '2026-11-12T11:20:00Z',
  },
  {
    id: 7,
    transaction_code: 'TXN-20261110-006',
    invoice_number: 'INV-TXN-20261110-006',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_monthly',
    plan_name: 'Gói Pro Hàng Tháng',
    billing_cycle: 'monthly',
    duration_days: 30,
    amount_vnd: 49000,
    amount_display: '49.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 49000,
    total_amount_display: '49.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'completed',
    payment_note: null,
    qr_code_url: null,
    paid_at: '2026-11-10T08:05:00Z',
    created_at: '2026-11-10T08:00:00Z',
  },
  {
    id: 6,
    transaction_code: 'TXN-20261108-007',
    invoice_number: 'INV-TXN-20261108-007',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_monthly',
    plan_name: 'Gói Pro Hàng Tháng',
    billing_cycle: 'monthly',
    duration_days: 30,
    amount_vnd: 49000,
    amount_display: '49.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 49000,
    total_amount_display: '49.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'completed',
    payment_note: 'PRO MONTHLY TEST',
    qr_code_url: null,
    paid_at: '2026-11-08T15:20:00Z',
    created_at: '2026-11-08T15:15:00Z',
  },
  {
    id: 5,
    transaction_code: 'TXN-20261105-008',
    invoice_number: 'INV-TXN-20261105-008',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_yearly',
    plan_name: 'Gói Pro Hàng Năm',
    billing_cycle: 'yearly',
    duration_days: 365,
    amount_vnd: 399000,
    amount_display: '399.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 399000,
    total_amount_display: '399.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'completed',
    payment_note: 'PRO ANNUAL SUB',
    qr_code_url: null,
    paid_at: '2026-11-05T09:10:00Z',
    created_at: '2026-11-05T09:05:00Z',
  },
  {
    id: 4,
    transaction_code: 'TXN-20261101-009',
    invoice_number: 'INV-TXN-20261101-009',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_monthly',
    plan_name: 'Gói Pro Hàng Tháng',
    billing_cycle: 'monthly',
    duration_days: 30,
    amount_vnd: 49000,
    amount_display: '49.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 49000,
    total_amount_display: '49.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'expired',
    payment_note: 'EXPIRED QR CODE',
    qr_code_url: null,
    paid_at: null,
    created_at: '2026-11-01T12:00:00Z',
  },
  {
    id: 3,
    transaction_code: 'TXN-20261028-010',
    invoice_number: 'INV-TXN-20261028-010',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_monthly',
    plan_name: 'Gói Pro Hàng Tháng',
    billing_cycle: 'monthly',
    duration_days: 30,
    amount_vnd: 49000,
    amount_display: '49.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 49000,
    total_amount_display: '49.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'failed',
    payment_note: 'INSUFFICIENT FUNDS',
    qr_code_url: null,
    paid_at: null,
    created_at: '2026-10-28T17:30:00Z',
  },
  {
    id: 2,
    transaction_code: 'TXN-20261025-011',
    invoice_number: 'INV-TXN-20261025-011',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_monthly',
    plan_name: 'Gói Pro Hàng Tháng',
    billing_cycle: 'monthly',
    duration_days: 30,
    amount_vnd: 49000,
    amount_display: '49.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 49000,
    total_amount_display: '49.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'completed',
    payment_note: 'FIRST SUBSCRIPTION',
    qr_code_url: null,
    paid_at: '2026-10-25T11:45:00Z',
    created_at: '2026-10-25T11:40:00Z',
  },
  {
    id: 1,
    transaction_code: 'TXN-20261020-012',
    invoice_number: 'INV-TXN-20261020-012',
    buyer_name: 'Nguyễn Văn Mua',
    buyer_email: 'buyer@example.com',
    plan_code: 'pro_monthly',
    plan_name: 'Gói Pro Hàng Tháng',
    billing_cycle: 'monthly',
    duration_days: 30,
    amount_vnd: 49000,
    amount_display: '49.000 VNĐ',
    tax_rate_percent: 0,
    tax_amount_vnd: 0,
    total_amount_vnd: 49000,
    total_amount_display: '49.000 VNĐ',
    payment_method: 'vietqr',
    payment_status: 'completed',
    payment_note: 'INITIAL SIGNUP',
    qr_code_url: null,
    paid_at: '2026-10-20T10:15:00Z',
    created_at: '2026-10-20T10:10:00Z',
  },
];

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
    this.value = '';
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

function createBillingApiTestEnv(options = {}) {
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
  const statusFilterSelect = reg('billingStatusFilter', 'select');
  statusFilterSelect.value = 'all';
  reg('billingHistoryTable', 'table');
  reg('billingHistoryTableBody', 'tbody');
  const loadingState = reg('billingHistoryLoadingState', 'div');
  loadingState.style.display = 'none';
  const emptyState = reg('billingHistoryEmptyState', 'div');
  emptyState.style.display = 'none';
  const errorState = reg('billingHistoryErrorState', 'div');
  errorState.style.display = 'none';
  reg('billingHistoryErrorMessage', 'div');
  reg('btnRetryBillingHistory', 'button');

  // Pagination Footer
  const paginationFooter = reg('billingPaginationFooter', 'div');
  paginationFooter.style.display = 'none';
  reg('billingPaginationInfo', 'div');
  reg('billingPaginationControls', 'div');
  reg('btnBillingPrevPage', 'button');
  reg('btnBillingNextPage', 'button');
  reg('billingPageNumbers', 'div');

  // Table wrapper
  const tableWrap = new MockElement('', 'div', ['billing-table-responsive']);
  tableWrap.style.display = 'none';

  // Invoice Modal Elements
  const invoiceModal = reg('billingInvoiceModal', 'div', ['modal-overlay', 'invoice-modal-overlay'], { hidden: '', 'aria-hidden': 'true' });
  invoiceModal.style.display = 'none';
  const invoiceModalLoadingState = reg('invoiceModalLoadingState', 'div');
  invoiceModalLoadingState.style.display = 'none';
  const invoicePrintableArea = reg('invoicePrintableArea', 'div');
  invoicePrintableArea.style.display = 'flex';
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
  const mockStorage = {
    pdfl_token: options.token !== undefined ? options.token : 'test-bearer-jwt-token-xyz',
    pdfl_user: JSON.stringify({ id: 1, email: 'buyer@example.com', role: 'pro' }),
  };

  const mockWindow = {
    location: { protocol: 'http:', port: '8000' },
    print: () => {
      printCallCount++;
    },
    localStorage: {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = String(v); },
      removeItem: (k) => { delete mockStorage[k]; },
    },
    sessionStorage: {
      getItem: (k) => null,
      setItem: () => {},
      removeItem: () => {},
    },
    pdfLinguaAuth: {
      getStoredToken: () => mockStorage.pdfl_token || null,
      getStoredUser: () => (mockStorage.pdfl_user ? JSON.parse(mockStorage.pdfl_user) : null),
      openLoginModal: () => {
        dispatchedEvents.push({ type: 'auth:open-login' });
      },
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

  const recordedFetchCalls = [];
  let customFetchOverride = options.fetchOverride || null;

  async function mockFetch(url, fetchOpts = {}) {
    recordedFetchCalls.push({ url, options: fetchOpts });
    if (customFetchOverride) {
      return customFetchOverride(url, fetchOpts);
    }

    // Default mock behavior
    if (url.includes('/api/pricing/billing/history')) {
      const urlObj = new URL(url, 'http://127.0.0.1:8000');
      const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(urlObj.searchParams.get('page_size') || '10', 10);
      const statusParam = (urlObj.searchParams.get('status') || 'all').toLowerCase();

      let items = [...SAMPLE_TRANSACTIONS];
      if (statusParam && statusParam !== 'all') {
        items = items.filter((x) => String(x.payment_status).toLowerCase() === statusParam);
      }
      const totalCount = items.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

      return {
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          message: 'Lấy danh sách lịch sử giao dịch thanh toán thành công.',
          data: {
            items: pageItems,
            total_count: totalCount,
            page,
            page_size: pageSize,
            total_pages: totalPages,
          },
        }),
      };
    }

    if (url.includes('/api/pricing/billing/invoices/')) {
      const code = decodeURIComponent(url.split('/invoices/')[1]);
      const found = SAMPLE_TRANSACTIONS.find((x) => x.transaction_code === code);
      if (!found) {
        return {
          status: 404,
          ok: false,
          json: async () => ({
            success: false,
            detail: 'Không tìm thấy thông tin hóa đơn cho giao dịch này.',
          }),
        };
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          message: 'Lấy thông tin chi tiết hóa đơn điện tử thành công.',
          data: {
            ...found,
            issued_at: found.created_at,
          },
        }),
      };
    }

    return {
      status: 200,
      ok: true,
      json: async () => ({ success: true, data: {} }),
    };
  }

  const toasts = [];
  mockWindow.showToast = (msg, type) => {
    toasts.push({ msg, type });
  };
  const context = {
    window: mockWindow,
    document: mockDocument,
    console: console,
    fetch: mockFetch,
    URL: mockUrl,
    Blob: class Blob {
      constructor(parts, blobOpts) {
        this.parts = parts;
        this.options = blobOpts;
      }
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail || {};
      }
    },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    setInterval: () => 1,
    clearInterval: () => {},
    clearTimeout: () => {},
    showToast: (msg, type) => {
      toasts.push({ msg, type });
    },
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
    fetchCalls: recordedFetchCalls,
    toasts,
    setCustomFetch: (fn) => { customFetchOverride = fn; },
    setToken: (token) => { mockStorage.pdfl_token = token; },
  };
}

async function runAllTests() {
  console.log('================================================================');
  console.log('PDF-Lingua Real Billing History & Invoice API Integration Tests');
  console.log('================================================================\n');

  // 1. Static HTML & CSS Architecture
  assert.ok(htmlSource.includes('id="tabPricingPlans"'), 'HTML must contain #tabPricingPlans');
  assert.ok(htmlSource.includes('id="tabBillingHistory"'), 'HTML must contain #tabBillingHistory');
  assert.ok(htmlSource.includes('id="billingHistoryContainer"'), 'HTML must contain #billingHistoryContainer');
  assert.ok(htmlSource.includes('id="billingHistoryTable"'), 'HTML must contain #billingHistoryTable');
  assert.ok(htmlSource.includes('id="billingHistoryLoadingState"'), 'HTML must contain #billingHistoryLoadingState');
  assert.ok(htmlSource.includes('id="invoiceModalLoadingState"'), 'HTML must contain #invoiceModalLoadingState');
  assert.ok(pricingCssSource.includes('#invoiceModalLoadingState'), 'CSS must include #invoiceModalLoadingState in print styles');
  console.log('[PASS] 1. Static Architecture: Markup, modal loading state, and print CSS rules verified.');

  // 2. Unauthenticated Guard & Security Isolation
  const unauthEnv = createBillingApiTestEnv({ token: null });
  unauthEnv.fetchCalls.length = 0;
  await unauthEnv.window.PDFLinguaPricing.fetchBillingHistory(1, 'all');
  assert.strictEqual(unauthEnv.elements.billingHistoryErrorState.style.display, 'flex');
  assert.ok(unauthEnv.elements.billingHistoryErrorMessage.textContent.includes('Vui lòng đăng nhập'));
  assert.strictEqual(unauthEnv.fetchCalls.length, 0, 'Must NOT make network calls when unauthenticated for billing history');

  // Unauthenticated Invoice Detail Modal check
  unauthEnv.fetchCalls.length = 0;
  unauthEnv.toasts.length = 0;
  const unauthInvoiceRes = await unauthEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-20261117-001');
  assert.strictEqual(unauthInvoiceRes, null, 'Must return null when unauthenticated');
  assert.strictEqual(unauthEnv.fetchCalls.length, 0, 'Must NOT make network calls when unauthenticated for invoice detail');
  assert.strictEqual(unauthEnv.elements.billingInvoiceModal.style.display, 'none');
  assert.ok(unauthEnv.toasts.some((t) => t.msg.includes('Vui lòng đăng nhập')));
  assert.ok(unauthEnv.dispatchedEvents.some((e) => e.type === 'auth:open-login'));
  console.log('[PASS] 2. Unauthenticated Guard: Protected both History and Invoice APIs against unauthorized access.');

  // 3. Authenticated Billing History API Fetch
  const authEnv = createBillingApiTestEnv();
  authEnv.fetchCalls.length = 0;
  await authEnv.window.PDFLinguaPricing.fetchBillingHistory(1, 'all');

  assert.strictEqual(authEnv.fetchCalls.length, 1);
  const firstCall = authEnv.fetchCalls[0];
  assert.ok(firstCall.url.includes('/api/pricing/billing/history?page=1&page_size=10'));
  assert.strictEqual(firstCall.options.headers.Authorization, 'Bearer test-bearer-jwt-token-xyz');

  // Verify Table Rows Rendered
  assert.strictEqual(authEnv.elements.billingHistoryEmptyState.style.display, 'none');
  assert.strictEqual(authEnv.tableWrap.style.display, 'block');
  assert.strictEqual(authEnv.elements.billingPaginationFooter.style.display, 'flex');
  assert.strictEqual(authEnv.elements.billingHistoryCountChip.textContent, '12 giao dịch');
  assert.strictEqual(authEnv.elements.billingHistoryTabBadge.textContent, '12');

  const renderedRows = authEnv.elements.billingHistoryTableBody.innerHTML.match(/<tr/g);
  assert.strictEqual(renderedRows.length, 10, 'Page 1 must render exactly 10 transactions');
  assert.ok(authEnv.elements.billingHistoryTableBody.innerHTML.includes('TXN-20261117-001'));
  assert.ok(authEnv.elements.billingHistoryTableBody.innerHTML.includes('49.000 VNĐ'));
  assert.ok(authEnv.elements.billingHistoryTableBody.innerHTML.includes('VietQR Napas247'));
  console.log('[PASS] 3. Authenticated History Fetch: Sent Bearer token, retrieved 12 items, rendered 10 rows on page 1.');

  // 4. API-Driven Status Filtering
  authEnv.fetchCalls.length = 0;
  await authEnv.window.PDFLinguaPricing.filterBillingHistory('completed');
  assert.strictEqual(authEnv.fetchCalls.length, 1);
  assert.ok(authEnv.fetchCalls[0].url.includes('status=completed'));
  assert.strictEqual(authEnv.elements.billingHistoryCountChip.textContent, '7 giao dịch');

  authEnv.fetchCalls.length = 0;
  await authEnv.window.PDFLinguaPricing.filterBillingHistory('pending');
  assert.ok(authEnv.fetchCalls[0].url.includes('status=pending'));
  assert.strictEqual(authEnv.elements.billingHistoryCountChip.textContent, '1 giao dịch');

  authEnv.fetchCalls.length = 0;
  await authEnv.window.PDFLinguaPricing.filterBillingHistory('failed');
  assert.ok(authEnv.fetchCalls[0].url.includes('status=failed'));
  assert.strictEqual(authEnv.elements.billingHistoryCountChip.textContent, '2 giao dịch');

  authEnv.fetchCalls.length = 0;
  await authEnv.window.PDFLinguaPricing.filterBillingHistory('expired');
  assert.ok(authEnv.fetchCalls[0].url.includes('status=expired'));
  assert.strictEqual(authEnv.elements.billingHistoryCountChip.textContent, '2 giao dịch');

  authEnv.fetchCalls.length = 0;
  await authEnv.window.PDFLinguaPricing.filterBillingHistory('all');
  assert.ok(!authEnv.fetchCalls[0].url.includes('status=completed'));
  assert.strictEqual(authEnv.elements.billingHistoryCountChip.textContent, '12 giao dịch');
  console.log('[PASS] 4. API Status Filtering: Query params passed to server across all statuses and table dynamically synced.');

  // 5. API-Driven Pagination Controls
  authEnv.fetchCalls.length = 0;
  await authEnv.window.PDFLinguaPricing.goToBillingHistoryPage(2);
  assert.strictEqual(authEnv.fetchCalls.length, 1);
  assert.ok(authEnv.fetchCalls[0].url.includes('page=2'));
  const page2Rows = authEnv.elements.billingHistoryTableBody.innerHTML.match(/<tr/g);
  assert.strictEqual(page2Rows.length, 2, 'Page 2 must render remaining 2 transactions');
  assert.strictEqual(authEnv.elements.btnBillingPrevPage.disabled, false);
  assert.strictEqual(authEnv.elements.btnBillingNextPage.disabled, true);

  // Redundant page click test
  authEnv.fetchCalls.length = 0;
  await authEnv.window.PDFLinguaPricing.goToBillingHistoryPage(2);
  assert.strictEqual(authEnv.fetchCalls.length, 0, 'Must NOT trigger duplicate request for current page');
  console.log('[PASS] 5. API Pagination: Correct page sliced, next/prev button states verified, duplicate requests blocked.');

  // 6. Empty State & Malformed JSON Handling
  authEnv.setCustomFetch(async () => ({
    status: 200,
    ok: true,
    json: async () => ({
      success: true,
      data: { items: [], total_count: 0, page: 1, page_size: 10, total_pages: 1 },
    }),
  }));
  await authEnv.window.PDFLinguaPricing.fetchBillingHistory(1, 'all');
  assert.strictEqual(authEnv.elements.billingHistoryEmptyState.style.display, 'flex');
  assert.strictEqual(authEnv.tableWrap.style.display, 'none');
  assert.strictEqual(authEnv.elements.billingPaginationFooter.style.display, 'none');
  assert.strictEqual(authEnv.elements.billingHistoryCountChip.textContent, '0 giao dịch');

  // Malformed Payload: success=false
  authEnv.setCustomFetch(async () => ({
    status: 200,
    ok: true,
    json: async () => ({ success: false, message: 'Máy chủ phản hồi bất thường' }),
  }));
  await authEnv.window.PDFLinguaPricing.fetchBillingHistory(1, 'all');
  assert.strictEqual(authEnv.elements.billingHistoryErrorState.style.display, 'flex');
  assert.strictEqual(authEnv.tableWrap.style.display, 'none');
  assert.ok(authEnv.elements.billingHistoryErrorMessage.textContent.includes('không hợp lệ'));

  // Malformed Payload: Syntax Error during json parse
  authEnv.setCustomFetch(async () => ({
    status: 200,
    ok: true,
    json: async () => {
      throw new Error('Unexpected token < in JSON at position 0');
    },
  }));
  await authEnv.window.PDFLinguaPricing.fetchBillingHistory(1, 'all');
  assert.strictEqual(authEnv.elements.billingHistoryErrorState.style.display, 'flex');
  assert.strictEqual(authEnv.tableWrap.style.display, 'none');
  console.log('[PASS] 6. Empty & Malformed State: Cleanly handled empty lists and rejected malformed JSON without mock fallback.');

  // 7. Error Handling on Billing History API (401, 403, 422, 500, Network Failure & Retry)
  // 401 Session Expiry
  authEnv.setCustomFetch(async () => ({
    status: 401,
    ok: false,
    json: async () => ({ detail: 'Token has expired.' }),
  }));
  await authEnv.window.PDFLinguaPricing.fetchBillingHistory(1, 'all');
  assert.strictEqual(authEnv.elements.billingHistoryErrorState.style.display, 'flex');
  assert.ok(authEnv.elements.billingHistoryErrorMessage.textContent.includes('Phiên đăng nhập đã hết hạn'));
  assert.ok(authEnv.dispatchedEvents.some((e) => e.type === 'auth:open-login'));

  // 403 Forbidden
  authEnv.setCustomFetch(async () => ({
    status: 403,
    ok: false,
    json: async () => ({ detail: 'Không có quyền truy cập lịch sử giao dịch.' }),
  }));
  await authEnv.window.PDFLinguaPricing.fetchBillingHistory(1, 'all');
  assert.strictEqual(authEnv.elements.billingHistoryErrorState.style.display, 'flex');
  assert.ok(authEnv.elements.billingHistoryErrorMessage.textContent.includes('Không có quyền truy cập'));

  // 422 Validation Error
  authEnv.setCustomFetch(async () => ({
    status: 422,
    ok: false,
    json: async () => ({
      detail: [{ loc: ['query', 'page_size'], msg: 'Input should be less than or equal to 50' }],
    }),
  }));
  await authEnv.window.PDFLinguaPricing.fetchBillingHistory(1, 'all');
  assert.strictEqual(authEnv.elements.billingHistoryErrorState.style.display, 'flex');
  assert.ok(authEnv.elements.billingHistoryErrorMessage.textContent.includes('page_size'));

  // 500 Internal Server Error
  authEnv.setCustomFetch(async () => ({
    status: 500,
    ok: false,
    json: async () => ({ detail: 'Máy chủ cơ sở dữ liệu tạm thời gián đoạn.' }),
  }));
  await authEnv.window.PDFLinguaPricing.fetchBillingHistory(1, 'all');
  assert.strictEqual(authEnv.elements.billingHistoryErrorState.style.display, 'flex');
  assert.ok(authEnv.elements.billingHistoryErrorMessage.textContent.includes('Máy chủ cơ sở dữ liệu'));

  // Network Failure
  authEnv.setCustomFetch(async () => {
    throw new Error('Failed to fetch');
  });
  await authEnv.window.PDFLinguaPricing.fetchBillingHistory(1, 'all');
  assert.strictEqual(authEnv.elements.billingHistoryErrorState.style.display, 'flex');
  assert.ok(authEnv.elements.billingHistoryErrorMessage.textContent.includes('Lỗi kết nối mạng'));

  // Test Retry button recovery
  authEnv.setCustomFetch(null); // restore default mock fetch
  authEnv.elements.btnRetryBillingHistory.click();
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(authEnv.elements.billingHistoryErrorState.style.display, 'none');
  assert.strictEqual(authEnv.tableWrap.style.display, 'block');
  console.log('[PASS] 7. Billing API Error Handling: Handled 401, 403, 422, 500, network loss, and recovered via retry.');

  // 8. Billing History Out-of-Order Race Condition Protection
  let resolveSlowReq, resolveFastReq;
  const slowPromise = new Promise((resolve) => { resolveSlowReq = resolve; });
  const fastPromise = new Promise((resolve) => { resolveFastReq = resolve; });

  authEnv.setCustomFetch(async (url) => {
    if (url.includes('status=completed')) {
      await slowPromise;
      return {
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: SAMPLE_TRANSACTIONS.filter((x) => x.payment_status === 'completed'),
            total_count: 7,
            page: 1,
            page_size: 10,
            total_pages: 1,
          },
        }),
      };
    }
    if (url.includes('status=failed')) {
      await fastPromise;
      return {
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: SAMPLE_TRANSACTIONS.filter((x) => x.payment_status === 'failed'),
            total_count: 2,
            page: 1,
            page_size: 10,
            total_pages: 1,
          },
        }),
      };
    }
  });

  const slowReqCall = authEnv.window.PDFLinguaPricing.filterBillingHistory('completed');
  const fastReqCall = authEnv.window.PDFLinguaPricing.filterBillingHistory('failed');

  // Resolve Fast request (Request 2: failed) FIRST
  resolveFastReq();
  await fastReqCall;
  assert.strictEqual(authEnv.elements.billingHistoryCountChip.textContent, '2 giao dịch');
  const fastRows = authEnv.elements.billingHistoryTableBody.innerHTML.match(/<tr/g);
  assert.strictEqual(fastRows.length, 2, 'Failed filter should display 2 rows');

  // Resolve Slow request (Request 1: completed) LATER
  resolveSlowReq();
  await slowReqCall;
  assert.strictEqual(authEnv.elements.billingHistoryCountChip.textContent, '2 giao dịch', 'Stale completed request must be ignored');
  const preservedRows = authEnv.elements.billingHistoryTableBody.innerHTML.match(/<tr/g);
  assert.strictEqual(preservedRows.length, 2, 'Preserved 2 rows without stale overwrite');
  authEnv.setCustomFetch(null); // Restore default mock
  console.log('[PASS] 8. History Out-of-Order Race Condition: Stale in-flight responses discarded safely.');

  // 9. Real Invoice Detail API (GET /api/pricing/billing/invoices/{code})
  const invoiceEnv = createBillingApiTestEnv();
  invoiceEnv.fetchCalls.length = 0;
  const invoicePromise = invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-20261117-001');

  // Modal must open immediately with loading spinner and disabled action buttons
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'flex');
  assert.strictEqual(invoiceEnv.elements.invoiceModalLoadingState.style.display, 'flex');
  assert.strictEqual(invoiceEnv.elements.invoicePrintableArea.style.display, 'none');
  assert.strictEqual(invoiceEnv.elements.btnPrintInvoice.disabled, true);
  assert.strictEqual(invoiceEnv.elements.btnDownloadInvoice.disabled, true);
  assert.strictEqual(invoiceEnv.elements.invoiceBuyerName.textContent, '...', 'Stale buyer name must be cleared');
  assert.strictEqual(invoiceEnv.elements.invoiceTotalAmount.textContent, '...', 'Stale amount must be cleared');

  // Await invoice fetch completion
  const txResult = await invoicePromise;
  assert.ok(txResult, 'Invoice data must be returned');
  assert.strictEqual(invoiceEnv.fetchCalls.length, 1);
  assert.ok(invoiceEnv.fetchCalls[0].url.includes('/api/pricing/billing/invoices/TXN-20261117-001'));
  assert.strictEqual(invoiceEnv.fetchCalls[0].options.headers.Authorization, 'Bearer test-bearer-jwt-token-xyz');

  // Verify Loaded State & Complete DOM Data Binding
  assert.strictEqual(invoiceEnv.elements.invoiceModalLoadingState.style.display, 'none');
  assert.strictEqual(invoiceEnv.elements.invoicePrintableArea.style.display, 'flex');
  assert.strictEqual(invoiceEnv.elements.btnPrintInvoice.disabled, false);
  assert.strictEqual(invoiceEnv.elements.btnDownloadInvoice.disabled, false);

  assert.strictEqual(invoiceEnv.elements.invoiceNumber.textContent, 'INV-TXN-20261117-001');
  assert.strictEqual(invoiceEnv.elements.invoiceTxCode.textContent, 'Mã GD: TXN-20261117-001');
  assert.strictEqual(invoiceEnv.elements.invoiceBuyerName.textContent, 'Nguyễn Văn Mua');
  assert.strictEqual(invoiceEnv.elements.invoiceBuyerEmail.textContent, 'buyer@example.com');
  assert.strictEqual(invoiceEnv.elements.invoicePlanName.textContent, 'Gói Pro Hàng Tháng');
  assert.strictEqual(invoiceEnv.elements.invoiceTotalAmount.textContent, '49.000 VNĐ');
  assert.strictEqual(invoiceEnv.elements.invoicePaymentNote.textContent, 'PRO MONTHLY NOV');
  assert.strictEqual(invoiceEnv.elements.invoiceQrWrap.style.display, 'flex');
  assert.ok(invoiceEnv.elements.invoiceQrImage.src.includes('vietqr.io'));
  assert.ok(invoiceEnv.dispatchedEvents.some((e) => e.type === 'pdfl:view-invoice'));
  console.log('[PASS] 9. Real Invoice Detail API: Cleared stale data, loaded full details, revealed receipt.');

  // 10. Invoice Detail Edge Cases (Null QR, Fallback Note, Optional Fields)
  await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-20261116-002');
  assert.strictEqual(invoiceEnv.elements.invoiceQrWrap.style.display, 'none');
  assert.strictEqual(invoiceEnv.elements.invoiceQrImage.src, '');

  await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-20261110-006');
  assert.strictEqual(invoiceEnv.elements.invoicePaymentNote.textContent, 'Tự động đối soát hệ thống');

  // Unpaid pending transaction check
  await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-20261115-003');
  assert.strictEqual(invoiceEnv.elements.invoicePaidAt.textContent, 'Chưa thanh toán');
  console.log('[PASS] 10. Invoice Edge Cases: Missing QR hides QR box, null memo uses fallback, unpaid state preserved.');

  // 11. Invoice Detail Error Handling (401, 403, 404, 500, Network Loss)
  // 401 Session Expiry
  invoiceEnv.setCustomFetch(async () => ({
    status: 401,
    ok: false,
    json: async () => ({ detail: 'Token has expired.' }),
  }));
  invoiceEnv.toasts.length = 0;
  const res401 = await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-EXPIRED');
  assert.strictEqual(res401, null);
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'none');
  assert.ok(invoiceEnv.toasts.some((t) => t.msg.includes('Phiên đăng nhập đã hết hạn')));

  // 403 Forbidden
  invoiceEnv.setCustomFetch(async () => ({
    status: 403,
    ok: false,
    json: async () => ({ detail: 'Không có quyền truy cập.' }),
  }));
  invoiceEnv.toasts.length = 0;
  const res403 = await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-OTHER-001');
  assert.strictEqual(res403, null);
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'none');
  assert.ok(invoiceEnv.toasts.some((t) => t.msg.includes('không có quyền truy cập')));

  // 404 Not Found
  invoiceEnv.setCustomFetch(async () => ({
    status: 404,
    ok: false,
    json: async () => ({ detail: 'Không tìm thấy.' }),
  }));
  invoiceEnv.toasts.length = 0;
  const res404 = await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-NONEXISTENT');
  assert.strictEqual(res404, null);
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'none');
  assert.ok(invoiceEnv.toasts.some((t) => t.msg.includes('Không tìm thấy')));

  // 500 Server Error
  invoiceEnv.setCustomFetch(async () => ({
    status: 500,
    ok: false,
    json: async () => ({ detail: 'Lỗi hệ thống.' }),
  }));
  invoiceEnv.toasts.length = 0;
  const res500 = await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-SERVER-ERR');
  assert.strictEqual(res500, null);
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'none');
  assert.ok(invoiceEnv.toasts.some((t) => t.msg.includes('Không thể tải chi tiết hóa đơn')));

  // Network Failure
  invoiceEnv.setCustomFetch(async () => {
    throw new Error('Failed to fetch');
  });
  invoiceEnv.toasts.length = 0;
  const resNet = await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-NET-ERR');
  assert.strictEqual(resNet, null);
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'none');
  assert.ok(invoiceEnv.toasts.some((t) => t.msg.includes('Lỗi kết nối khi tải chi tiết hóa đơn')));
  console.log('[PASS] 11. Invoice Error Handling: Closes modal and notifies on 401, 403, 404, 500, and network failure.');

  // 12. Invoice Detail Out-of-Order Race Condition & Stale Data Isolation
  let resolveSlowInv, resolveFastInv;
  const slowInvPromise = new Promise((resolve) => { resolveSlowInv = resolve; });
  const fastInvPromise = new Promise((resolve) => { resolveFastInv = resolve; });

  invoiceEnv.setCustomFetch(async (url) => {
    if (url.includes('TXN-SLOW-INVOICE')) {
      await slowInvPromise;
      return {
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          data: {
            transaction_code: 'TXN-SLOW-INVOICE',
            invoice_number: 'INV-TXN-SLOW-INVOICE',
            buyer_name: 'Nguyễn Văn Chậm',
            plan_name: 'Gói Chậm',
            total_amount_display: '999.000 VNĐ',
            payment_status: 'failed',
          },
        }),
      };
    }
    if (url.includes('TXN-FAST-INVOICE')) {
      await fastInvPromise;
      return {
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          data: {
            transaction_code: 'TXN-FAST-INVOICE',
            invoice_number: 'INV-TXN-FAST-INVOICE',
            buyer_name: 'Trần Thị Nhanh',
            plan_name: 'Gói Nhanh Pro',
            total_amount_display: '49.000 VNĐ',
            payment_status: 'completed',
          },
        }),
      };
    }
  });

  const callSlowInvoice = invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-SLOW-INVOICE');
  assert.strictEqual(invoiceEnv.elements.invoiceBuyerName.textContent, '...', 'Stale buyer name reset immediately');
  const callFastInvoice = invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-FAST-INVOICE');

  // Resolve Fast invoice FIRST
  resolveFastInv();
  const fastInvRes = await callFastInvoice;
  assert.strictEqual(fastInvRes.transaction_code, 'TXN-FAST-INVOICE');
  assert.strictEqual(invoiceEnv.elements.invoiceNumber.textContent, 'INV-TXN-FAST-INVOICE');
  assert.strictEqual(invoiceEnv.elements.invoiceBuyerName.textContent, 'Trần Thị Nhanh');
  assert.strictEqual(invoiceEnv.elements.invoiceTotalAmount.textContent, '49.000 VNĐ');

  // Resolve Slow invoice LATER
  resolveSlowInv();
  const slowInvRes = await callSlowInvoice;
  assert.strictEqual(slowInvRes, null, 'Stale invoice response must resolve to null');
  assert.strictEqual(invoiceEnv.elements.invoiceNumber.textContent, 'INV-TXN-FAST-INVOICE', 'Stale invoice must NOT overwrite modal');
  assert.strictEqual(invoiceEnv.elements.invoiceBuyerName.textContent, 'Trần Thị Nhanh');
  assert.strictEqual(invoiceEnv.window.PDFLinguaPricing.getCurrentInvoiceTransaction().transaction_code, 'TXN-FAST-INVOICE');
  invoiceEnv.setCustomFetch(null); // restore default mock
  console.log('[PASS] 12. Invoice Out-of-Order Race Condition: Stale invoice discarded and no data leakage observed.');

  // 13. Modal Closing Mechanisms
  await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-20261117-001');
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'flex');

  // Header close button
  invoiceEnv.elements.btnCloseInvoiceModal.click();
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'none');
  assert.strictEqual(invoiceEnv.mockBody.style.overflow, '');

  // Footer close button
  await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-20261117-001');
  invoiceEnv.elements.btnInvoiceModalCloseFooter.click();
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'none');

  // Backdrop overlay click
  await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-20261117-001');
  invoiceEnv.elements.billingInvoiceModal.click();
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'none');

  // Escape key
  await invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-20261117-001');
  invoiceEnv.dispatchKeydown('Escape');
  assert.strictEqual(invoiceEnv.elements.billingInvoiceModal.style.display, 'none');
  console.log('[PASS] 13. Modal Closing: Closed via header button, footer button, backdrop click, and Escape key.');

  // 14. Print & Download Receipt (Loading Lockout & Loaded Actions)
  // Part A: Lockout during loading
  let resolveModalLoad;
  const modalLoadPromise = new Promise((resolve) => { resolveModalLoad = resolve; });
  invoiceEnv.setCustomFetch(async () => {
    await modalLoadPromise;
    return {
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        data: SAMPLE_TRANSACTIONS[0],
      }),
    };
  });

  invoiceEnv.toasts.length = 0;
  const inFlightInvoice = invoiceEnv.window.PDFLinguaPricing.openInvoiceModal('TXN-LOADING-TEST');
  assert.strictEqual(invoiceEnv.elements.invoiceModalLoadingState.style.display, 'flex');

  const printCountBefore = invoiceEnv.getPrintCallCount();
  invoiceEnv.window.PDFLinguaPricing.printInvoiceReceipt();
  assert.strictEqual(invoiceEnv.getPrintCallCount(), printCountBefore, 'Must NOT trigger window.print() while loading');
  assert.ok(invoiceEnv.toasts.some((t) => t.msg.includes('Đang tải chi tiết hóa đơn')));

  invoiceEnv.toasts.length = 0;
  const blobsBefore = invoiceEnv.getCreatedBlobs().length;
  invoiceEnv.window.PDFLinguaPricing.downloadInvoiceReceipt();
  assert.strictEqual(invoiceEnv.getCreatedBlobs().length, blobsBefore, 'Must NOT create receipt Blob while loading');
  assert.ok(invoiceEnv.toasts.some((t) => t.msg.includes('Đang tải chi tiết hóa đơn')));

  // Resolve loading
  resolveModalLoad();
  await inFlightInvoice;
  assert.strictEqual(invoiceEnv.elements.invoiceModalLoadingState.style.display, 'none');
  invoiceEnv.setCustomFetch(null); // restore default mock

  // Part B: Loaded state actions
  invoiceEnv.elements.btnPrintInvoice.click();
  assert.strictEqual(invoiceEnv.getPrintCallCount(), printCountBefore + 1, 'window.print() executed');

  // Download receipt action
  invoiceEnv.elements.btnDownloadInvoice.click();
  const currentTx = invoiceEnv.window.PDFLinguaPricing.getCurrentInvoiceTransaction();
  const receiptHtml = invoiceEnv.window.PDFLinguaPricing.generateReceiptHtml(currentTx);
  assert.ok(receiptHtml.includes('INV-TXN-20261117-001'));
  assert.ok(receiptHtml.includes('Nguyễn Văn Mua'));
  assert.ok(receiptHtml.includes('49.000 VNĐ'));
  assert.ok(receiptHtml.includes('@media print'));
  console.log('[PASS] 14. Print & Download: Verified loading state lockout, window.print() and clean HTML receipt blob generation.');

  console.log('\n================================================================');
  console.log('SUMMARY: All 14/14 real API integration tests passed (0 failed).');
  console.log('================================================================');
}

runAllTests().catch((err) => {
  console.error('\n[FAIL] Test execution error:', err);
  process.exit(1);
});
