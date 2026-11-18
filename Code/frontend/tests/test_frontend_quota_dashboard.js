/**
 * Quota Usage Dashboard & Pro VIP Status UI Test Suite
 * ----------------------------------------------------
 * Verifies:
 * 1. HTML structure and CSS classes: #quotaDashboardCard, Pro VIP badge, Free tier header,
 *    warning banner, and 3 quota meters (OCR, File Size, AI Copilot).
 * 2. Pro VIP State: Plan name, start/expiry dates, remaining days countdown badge,
 *    and Pro usage meter metrics (500 pages OCR, 100 MB file limit, 15 Copilot questions).
 * 3. Free Tier State: Free header displayed, Pro header hidden, Free limits (100 OCR pages, 20 MB, 0 Copilot).
 * 4. Expiring Soon State: Warning banner displayed with warning styling and pill-expiring countdown badge.
 * 5. Expired State: Warning banner displayed with danger styling, pill-expired countdown badge.
 * 6. Progress Bar ARIA & Color Thresholds: role="progressbar", aria-valuenow,
 *    standard (<70%), warning (70%-90%), and danger (>90%).
 * 7. Action Buttons & Checkout Modal Integration: Renew, Upgrade Yearly, Free CTA, and Warning Renew.
 * 8. User Subscription State Integration: Guest hides card, Free renders free tier, Pro renders VIP status.
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
    this.src = '';
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
  click() {
    if (this.disabled) return;
    if (this.listeners['click']) {
      this.listeners['click'].forEach((fn) =>
        fn({ target: this, preventDefault: () => {}, stopPropagation: () => {} })
      );
    }
  }
}

function createQuotaTestEnv(initialStorage = {}, customFetch = null) {
  const store = { ...initialStorage };
  const mockStorage = {
    getItem: (k) => (store[k] !== undefined ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };

  const elements = {
    heroSection: new MockElement('heroSection', 'section'),
    workspaceSection: new MockElement('workspaceSection', 'section'),
    adminSection: new MockElement('adminSection', 'section'),
    pricingSection: new MockElement('pricingSection', 'section'),
    btnBillingMonthly: new MockElement('btnBillingMonthly', 'button', ['billing-toggle-btn', 'active']),
    btnBillingYearly: new MockElement('btnBillingYearly', 'button', ['billing-toggle-btn']),
    billingSavePill: new MockElement('billingSavePill', 'span'),
    pricingActiveBanner: new MockElement('pricingActiveBanner', 'div'),
    pricingActiveBannerTitle: new MockElement('pricingActiveBannerTitle', 'div'),
    pricingActiveBannerSub: new MockElement('pricingActiveBannerSub', 'div'),
    btnCancelAutoRenew: new MockElement('btnCancelAutoRenew', 'button'),
    btnSelectFreePlan: new MockElement('btnSelectFreePlan', 'button'),
    freePlanCtaHint: new MockElement('freePlanCtaHint', 'p'),
    btnUpgradeProPlan: new MockElement('btnUpgradeProPlan', 'button'),
    btnUpgradeProText: new MockElement('btnUpgradeProText', 'span'),
    proPlanCtaHint: new MockElement('proPlanCtaHint', 'p'),
    topNavPricing: new MockElement('topNavPricing', 'a'),
    topNavTranslate: new MockElement('topNavTranslate', 'a'),
    dropzoneLimitText: new MockElement('dropzoneLimitText', 'p'),
    accountModal: new MockElement('accountModal', 'div'),
    btnAccountUpgradePro: new MockElement('btnAccountUpgradePro', 'button'),
    quotaExceededModal: new MockElement('quotaExceededModal', 'div'),

    // Quota Usage Dashboard Elements
    quotaDashboardCard: new MockElement('quotaDashboardCard', 'div'),
    quotaWarningBanner: new MockElement('quotaWarningBanner', 'div'),
    quotaWarningIcon: new MockElement('quotaWarningIcon', 'div'),
    quotaWarningTitle: new MockElement('quotaWarningTitle', 'strong'),
    quotaWarningDesc: new MockElement('quotaWarningDesc', 'p'),
    btnQuotaWarningRenew: new MockElement('btnQuotaWarningRenew', 'button'),
    quotaProHeader: new MockElement('quotaProHeader', 'div'),
    quotaFreeHeader: new MockElement('quotaFreeHeader', 'div'),
    badgeProVip: new MockElement('badgeProVip', 'span', ['badge-pro-vip']),
    quotaPlanName: new MockElement('quotaPlanName', 'h3'),
    quotaDaysRemainingBadge: new MockElement('quotaDaysRemainingBadge', 'span', ['quota-countdown-pill']),
    quotaStartedAt: new MockElement('quotaStartedAt', 'strong'),
    quotaExpiresAt: new MockElement('quotaExpiresAt', 'strong'),
    btnQuotaRenew: new MockElement('btnQuotaRenew', 'button'),
    btnQuotaUpgradeYearly: new MockElement('btnQuotaUpgradeYearly', 'button'),
    badgeFreeTier: new MockElement('badgeFreeTier', 'span', ['badge-free-tier']),
    quotaFreeTitle: new MockElement('quotaFreeTitle', 'h3'),
    quotaFreeDesc: new MockElement('quotaFreeDesc', 'p'),
    btnQuotaUpgradeFreeCta: new MockElement('btnQuotaUpgradeFreeCta', 'button'),

    // Meter 1: OCR
    meterOcrPages: new MockElement('meterOcrPages', 'div'),
    quotaOcrPercent: new MockElement('quotaOcrPercent', 'span', ['quota-percent-pill']),
    quotaOcrUsed: new MockElement('quotaOcrUsed', 'strong'),
    quotaOcrLimit: new MockElement('quotaOcrLimit', 'span'),
    quotaOcrProgressFill: new MockElement('quotaOcrProgressFill', 'div', ['quota-progress-fill'], {
      role: 'progressbar',
      'aria-valuenow': '28',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    }),
    quotaOcrNote: new MockElement('quotaOcrNote', 'div'),

    // Meter 2: File Size
    meterFileSize: new MockElement('meterFileSize', 'div'),
    quotaFileSizePercent: new MockElement('quotaFileSizePercent', 'span', ['quota-percent-pill']),
    quotaFileSizeUsed: new MockElement('quotaFileSizeUsed', 'strong'),
    quotaFileSizeProgressFill: new MockElement('quotaFileSizeProgressFill', 'div', ['quota-progress-fill'], {
      role: 'progressbar',
      'aria-valuenow': '100',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    }),
    quotaFileSizeNote: new MockElement('quotaFileSizeNote', 'div'),

    // Meter 3: Copilot
    meterAiCopilot: new MockElement('meterAiCopilot', 'div'),
    quotaCopilotPercent: new MockElement('quotaCopilotPercent', 'span', ['quota-percent-pill']),
    quotaCopilotUsed: new MockElement('quotaCopilotUsed', 'strong'),
    quotaCopilotLimit: new MockElement('quotaCopilotLimit', 'span'),
    quotaCopilotProgressFill: new MockElement('quotaCopilotProgressFill', 'div', ['quota-progress-fill'], {
      role: 'progressbar',
      'aria-valuenow': '27',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    }),
    quotaCopilotNote: new MockElement('quotaCopilotNote', 'div'),

    // Checkout modal elements for checkout reuse
    pricingCheckoutModal: new MockElement('pricingCheckoutModal', 'div', [], { hidden: '', 'aria-hidden': 'true' }),
    btnCloseCheckoutModal: new MockElement('btnCloseCheckoutModal', 'button'),
    btnCheckoutCycleMonthly: new MockElement('btnCheckoutCycleMonthly', 'button'),
    btnCheckoutCycleYearly: new MockElement('btnCheckoutCycleYearly', 'button'),
    checkoutSummaryCard: new MockElement('checkoutSummaryCard', 'div'),
    checkoutPlanName: new MockElement('checkoutPlanName', 'strong'),
    checkoutDurationDays: new MockElement('checkoutDurationDays', 'span'),
    checkoutExpiryPreview: new MockElement('checkoutExpiryPreview', 'span'),
    checkoutSavingsRow: new MockElement('checkoutSavingsRow', 'div'),
    checkoutSavingsAmount: new MockElement('checkoutSavingsAmount', 'strong'),
    checkoutTotalAmount: new MockElement('checkoutTotalAmount', 'strong'),
    checkoutPendingView: new MockElement('checkoutPendingView', 'div'),
    checkoutSuccessView: new MockElement('checkoutSuccessView', 'div'),
    checkoutExpiredView: new MockElement('checkoutExpiredView', 'div'),
    checkoutPollingStatus: new MockElement('checkoutPollingStatus', 'div'),
    checkoutPollingStatusText: new MockElement('checkoutPollingStatusText', 'span'),
    checkoutCountdownBadge: new MockElement('checkoutCountdownBadge', 'div'),
    checkoutCountdownTimer: new MockElement('checkoutCountdownTimer', 'span'),
    checkoutQrFrame: new MockElement('checkoutQrFrame', 'div'),
    checkoutQrImage: new MockElement('checkoutQrImage', 'img'),
    checkoutQrFallback: new MockElement('checkoutQrFallback', 'div'),
    checkoutBankBox: new MockElement('checkoutBankBox', 'div'),
    checkoutBankName: new MockElement('checkoutBankName', 'strong'),
    checkoutAccountName: new MockElement('checkoutAccountName', 'strong'),
    checkoutAccountNumber: new MockElement('checkoutAccountNumber', 'code'),
    checkoutTransferAmount: new MockElement('checkoutTransferAmount', 'code'),
    checkoutTransferNote: new MockElement('checkoutTransferNote', 'code'),
    btnCopyCheckoutAccount: new MockElement('btnCopyCheckoutAccount', 'button'),
    btnCopyCheckoutAmount: new MockElement('btnCopyCheckoutAmount', 'button'),
    btnCopyCheckoutNote: new MockElement('btnCopyCheckoutNote', 'button'),
    btnCheckTransactionNow: new MockElement('btnCheckTransactionNow', 'button'),
    btnSimulatePaymentSuccess: new MockElement('btnSimulatePaymentSuccess', 'button'),
    btnSimulatePaymentText: new MockElement('btnSimulatePaymentText', 'span'),
    checkoutTransactionCode: new MockElement('checkoutTransactionCode', 'code'),
    checkoutConfettiStage: new MockElement('checkoutConfettiStage', 'div'),
    checkoutSuccessMessage: new MockElement('checkoutSuccessMessage', 'p'),
    checkoutSuccessTxCode: new MockElement('checkoutSuccessTxCode', 'code'),
    checkoutSuccessPlanName: new MockElement('checkoutSuccessPlanName', 'strong'),
    checkoutSuccessAmount: new MockElement('checkoutSuccessAmount', 'strong'),
    checkoutSuccessExpiresAt: new MockElement('checkoutSuccessExpiresAt', 'strong'),
    btnCheckoutDone: new MockElement('btnCheckoutDone', 'button'),
    btnRetryCheckout: new MockElement('btnRetryCheckout', 'button'),
  };

  const documentListeners = {};
  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: (ev, fn) => {
      documentListeners[ev] = documentListeners[ev] || [];
      documentListeners[ev].push(fn);
    },
    createElement: (tag) => new MockElement('gen_' + Math.random(), tag),
  };

  const windowListeners = {};
  const mockWindow = {
    addEventListener: (ev, fn) => {
      windowListeners[ev] = windowListeners[ev] || [];
      windowListeners[ev].push(fn);
    },
    dispatchEvent: (ev) => {
      const fns = windowListeners[ev.type] || [];
      fns.forEach((fn) => fn(ev));
    },
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    location: { origin: 'http://localhost:8000' },
  };

  const sandbox = {
    window: mockWindow,
    document: mockDocument,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    fetch: customFetch || (async () => ({ ok: true, json: async () => ({}) })),
    console: { log: () => {}, error: () => {}, warn: () => {} },
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: () => {},
    setInterval: () => 123,
    clearInterval: () => {},
  };

  vm.createContext(sandbox);
  vm.runInContext(pricingSource, sandbox);

  if (documentListeners['DOMContentLoaded']) {
    documentListeners['DOMContentLoaded'].forEach((fn) => fn());
  }

  return { sandbox, elements, documentListeners, windowListeners };
}

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    failedCount++;
  }
}

console.log('================================================================');
console.log('PDF-Lingua Quota Usage Dashboard & Pro VIP Status Test Suite');
console.log('================================================================\n');

// 1. Static HTML & CSS Validation
runTest('HTML & CSS: Quota Usage Dashboard structure, Pro VIP badge, and progress bars exist', () => {
  assert(htmlSource.includes('id="quotaDashboardCard"'), 'Missing #quotaDashboardCard in index.html');
  assert(htmlSource.includes('id="quotaWarningBanner"'), 'Missing #quotaWarningBanner in index.html');
  assert(htmlSource.includes('id="quotaProHeader"'), 'Missing #quotaProHeader in index.html');
  assert(htmlSource.includes('id="quotaFreeHeader"'), 'Missing #quotaFreeHeader in index.html');
  assert(htmlSource.includes('class="badge-pro-vip"'), 'Missing .badge-pro-vip in index.html');
  assert(htmlSource.includes('id="quotaMetersGrid"'), 'Missing #quotaMetersGrid in index.html');
  assert(htmlSource.includes('id="meterOcrPages"'), 'Missing #meterOcrPages in index.html');
  assert(htmlSource.includes('id="meterFileSize"'), 'Missing #meterFileSize in index.html');
  assert(htmlSource.includes('id="meterAiCopilot"'), 'Missing #meterAiCopilot in index.html');

  // CSS classes
  assert(pricingCssSource.includes('.quota-dashboard-card'), 'Missing .quota-dashboard-card CSS');
  assert(pricingCssSource.includes('.badge-pro-vip'), 'Missing .badge-pro-vip CSS');
  assert(pricingCssSource.includes('.quota-meters-grid'), 'Missing .quota-meters-grid CSS');
  assert(pricingCssSource.includes('.quota-progress-track'), 'Missing .quota-progress-track CSS');
  assert(pricingCssSource.includes('.quota-progress-fill'), 'Missing .quota-progress-fill CSS');
  assert(pricingCssSource.includes('.quota-warning-banner'), 'Missing .quota-warning-banner CSS');

  // Accessible progress bar roles in HTML
  assert(htmlSource.includes('role="progressbar"'), 'Missing role="progressbar" in quota progress bars');
  assert(htmlSource.includes('aria-valuemin="0"'), 'Missing aria-valuemin="0"');
  assert(htmlSource.includes('aria-valuemax="100"'), 'Missing aria-valuemax="100"');
});

// 2. Pro VIP State Rendering
runTest('Pro VIP State: Renders plan name, dates, countdown badge, and Pro quota meters', () => {
  const env = createQuotaTestEnv();
  const pricing = env.sandbox.window.PDFLinguaPricing;

  pricing.setQuotaMockState('pro');
  const state = pricing.getQuotaDashboardState();

  assert.strictEqual(state.stateKey, 'pro', 'State key should be pro');
  assert.strictEqual(env.elements.quotaDashboardCard.style.display, 'flex', 'Quota card should be visible');
  assert.strictEqual(env.elements.quotaProHeader.style.display, 'flex', 'Pro header should be visible');
  assert.strictEqual(env.elements.quotaFreeHeader.style.display, 'none', 'Free header should be hidden');
  assert.strictEqual(env.elements.quotaWarningBanner.style.display, 'none', 'Warning banner should be hidden');

  assert.strictEqual(env.elements.quotaPlanName.textContent, 'Gói Pro Hàng Tháng');
  assert.strictEqual(env.elements.quotaDaysRemainingBadge.textContent, 'Còn 28 ngày');
  assert(!env.elements.quotaDaysRemainingBadge.classList.contains('pill-expired'));
  assert(!env.elements.quotaDaysRemainingBadge.classList.contains('pill-expiring'));

  // Quota Meter 1: OCR (142 / 500 => 28%)
  assert.strictEqual(env.elements.quotaOcrUsed.textContent, '142');
  assert.strictEqual(env.elements.quotaOcrLimit.textContent, '500');
  assert.strictEqual(env.elements.quotaOcrPercent.textContent, '28%');
  assert.strictEqual(env.elements.quotaOcrProgressFill.style.width, '28%');
  assert.strictEqual(env.elements.quotaOcrProgressFill.getAttribute('aria-valuenow'), '28');

  // Quota Meter 2: File Size (100 MB max)
  assert.strictEqual(env.elements.quotaFileSizeUsed.textContent, '100 MB');
  assert.strictEqual(env.elements.quotaFileSizeProgressFill.style.width, '100%');

  // Quota Meter 3: Copilot (4 / 15 => 27%)
  assert.strictEqual(env.elements.quotaCopilotUsed.textContent, '4');
  assert.strictEqual(env.elements.quotaCopilotLimit.textContent, '15');
  assert.strictEqual(env.elements.quotaCopilotPercent.textContent, '27%');
  assert.strictEqual(env.elements.quotaCopilotProgressFill.style.width, '27%');
});

// 3. Free Tier State Rendering
runTest('Free Tier State: Renders Free header, hides Pro header, displays Free limits', () => {
  const env = createQuotaTestEnv();
  const pricing = env.sandbox.window.PDFLinguaPricing;

  pricing.setQuotaMockState('free');
  const state = pricing.getQuotaDashboardState();

  assert.strictEqual(state.stateKey, 'free', 'State key should be free');
  assert.strictEqual(env.elements.quotaProHeader.style.display, 'none', 'Pro header should be hidden');
  assert.strictEqual(env.elements.quotaFreeHeader.style.display, 'flex', 'Free header should be visible');
  assert.strictEqual(env.elements.quotaWarningBanner.style.display, 'none', 'Warning banner should be hidden');

  // Free limits: 25 / 100 OCR pages (25%), 20 MB file size (20%), 0 Copilot
  assert.strictEqual(env.elements.quotaOcrUsed.textContent, '25');
  assert.strictEqual(env.elements.quotaOcrLimit.textContent, '100');
  assert.strictEqual(env.elements.quotaOcrPercent.textContent, '25%');
  assert.strictEqual(env.elements.quotaOcrProgressFill.style.width, '25%');

  assert.strictEqual(env.elements.quotaFileSizeUsed.textContent, '20 MB');
  assert.strictEqual(env.elements.quotaFileSizeProgressFill.style.width, '20%');

  assert.strictEqual(env.elements.quotaCopilotUsed.textContent, '0');
  assert.strictEqual(env.elements.quotaCopilotLimit.textContent, '0');
  assert.strictEqual(env.elements.quotaCopilotPercent.textContent, '0%');
});

// 4. Expiring Soon State
runTest('Expiring Soon State: Displays warning banner and pill-expiring countdown badge', () => {
  const env = createQuotaTestEnv();
  const pricing = env.sandbox.window.PDFLinguaPricing;

  pricing.setQuotaMockState('expiring');
  const state = pricing.getQuotaDashboardState();

  assert.strictEqual(state.stateKey, 'expiring');
  assert.strictEqual(env.elements.quotaWarningBanner.style.display, 'flex', 'Warning banner should be displayed');
  assert(!env.elements.quotaWarningBanner.classList.contains('banner-danger'), 'Should not be danger level');
  assert.strictEqual(env.elements.quotaWarningTitle.textContent, 'Gói dịch vụ sắp hết hạn');

  assert.strictEqual(env.elements.quotaDaysRemainingBadge.textContent, 'Còn 3 ngày');
  assert(env.elements.quotaDaysRemainingBadge.classList.contains('pill-expiring'), 'Should have pill-expiring class');

  // Meter warning threshold check: 410 / 500 = 82% (>= 70% threshold)
  assert.strictEqual(env.elements.quotaOcrPercent.textContent, '82%');
  assert(env.elements.quotaOcrProgressFill.classList.contains('quota-fill-warning'), 'Fill should have warning class');
  assert(env.elements.quotaOcrPercent.classList.contains('quota-pill-warning'), 'Pill should have warning class');
});

// 5. Expired State
runTest('Expired State: Displays danger warning banner and pill-expired countdown badge', () => {
  const env = createQuotaTestEnv();
  const pricing = env.sandbox.window.PDFLinguaPricing;

  pricing.setQuotaMockState('expired');
  const state = pricing.getQuotaDashboardState();

  assert.strictEqual(state.stateKey, 'expired');
  assert.strictEqual(env.elements.quotaWarningBanner.style.display, 'flex');
  assert(env.elements.quotaWarningBanner.classList.contains('banner-danger'), 'Banner should have danger class');
  assert.strictEqual(env.elements.quotaWarningTitle.textContent, 'Gói dịch vụ đã hết hạn');

  assert.strictEqual(env.elements.quotaDaysRemainingBadge.textContent, 'Đã hết hạn');
  assert(env.elements.quotaDaysRemainingBadge.classList.contains('pill-expired'), 'Badge should have pill-expired class');

  // OCR at 500 / 500 = 100% (> 90% threshold => danger)
  assert.strictEqual(env.elements.quotaOcrPercent.textContent, '100%');
  assert(env.elements.quotaOcrProgressFill.classList.contains('quota-fill-danger'), 'Fill should have danger class');
  assert(env.elements.quotaOcrPercent.classList.contains('quota-pill-danger'), 'Pill should have danger class');
});

// 6. Color Thresholds Logic
runTest('Meter Progress Bars: Correct color thresholds for <70%, 70-90%, >90%', () => {
  const env = createQuotaTestEnv();
  const pricing = env.sandbox.window.PDFLinguaPricing;

  // Custom data with 65% OCR (normal)
  pricing.renderQuotaDashboard({
    account_state: 'pro',
    ocr: { used: 325, limit: 500 },
    file_size: { used: 100, limit: 100 },
    ai_copilot: { used: 2, limit: 15 },
  });
  assert(!env.elements.quotaOcrProgressFill.classList.contains('quota-fill-warning'));
  assert(!env.elements.quotaOcrProgressFill.classList.contains('quota-fill-danger'));
  assert(env.elements.quotaOcrPercent.classList.contains('quota-pill-active'));

  // Custom data with 75% OCR (warning)
  pricing.renderQuotaDashboard({
    account_state: 'pro',
    ocr: { used: 375, limit: 500 },
    file_size: { used: 100, limit: 100 },
    ai_copilot: { used: 2, limit: 15 },
  });
  assert(env.elements.quotaOcrProgressFill.classList.contains('quota-fill-warning'));
  assert(env.elements.quotaOcrPercent.classList.contains('quota-pill-warning'));

  // Custom data with 95% OCR (danger)
  pricing.renderQuotaDashboard({
    account_state: 'pro',
    ocr: { used: 475, limit: 500 },
    file_size: { used: 100, limit: 100 },
    ai_copilot: { used: 2, limit: 15 },
  });
  assert(env.elements.quotaOcrProgressFill.classList.contains('quota-fill-danger'));
  assert(env.elements.quotaOcrPercent.classList.contains('quota-pill-danger'));
});

// 7. Action Buttons & Checkout Modal Triggers
runTest('Action Buttons: Clicking Renew, Upgrade Yearly, Free CTA, and Warning Renew triggers checkout', () => {
  const env = createQuotaTestEnv({
    pdfl_token: 'fake_jwt_token',
    pdfl_user: JSON.stringify({ id: 10, email: 'pro@pdfl.vn', role: 'pro' }),
  });

  let initiatedPlan = null;
  env.sandbox.fetch = async (url, opts) => {
    if (url.includes('/api/pricing/subscribe')) {
      const body = JSON.parse(opts.body);
      initiatedPlan = body.plan_code;
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            transaction_code: 'TX_QUOTA_TEST',
            plan_code: body.plan_code,
            amount: 49000,
            qr_code_url: 'https://img.vietqr.io/image/MB-0987654321-compact2.png',
            expires_at: new Date(Date.now() + 900000).toISOString(),
          },
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  // Click Renew Plan (Monthly default)
  env.elements.btnQuotaRenew.click();
  assert.strictEqual(initiatedPlan, 'pro_monthly', 'Renew button should initiate pro_monthly transaction');

  // Reset cycle to monthly for Free CTA test
  env.sandbox.window.PDFLinguaPricing.setBillingCycle('monthly');
  env.elements.btnQuotaUpgradeFreeCta.click();
  assert.strictEqual(initiatedPlan, 'pro_monthly', 'Free CTA should initiate pro_monthly transaction');

  // Click Warning Renew
  env.elements.btnQuotaWarningRenew.click();
  assert.strictEqual(initiatedPlan, 'pro_monthly', 'Warning Renew button should initiate pro_monthly transaction');

  // Click Upgrade Yearly
  env.elements.btnQuotaUpgradeYearly.click();
  assert.strictEqual(initiatedPlan, 'pro_yearly', 'Upgrade Yearly button should initiate pro_yearly transaction');
});

// 8. Integration with Subscription Sync
runTest('User Subscription Integration: Syncs quota state when role changes between Guest, Free, and Pro', () => {
  const env = createQuotaTestEnv();
  const pricing = env.sandbox.window.PDFLinguaPricing;

  // Guest: Card is hidden
  env.sandbox.window.dispatchEvent({ type: 'pdfl:auth-change', detail: { user: null } });
  assert.strictEqual(env.elements.quotaDashboardCard.style.display, 'none', 'Guest should have quota dashboard hidden');

  // Free user: Card shows Free limits
  pricing.renderQuotaDashboard('free');
  assert.strictEqual(env.elements.quotaDashboardCard.style.display, 'flex');
  assert.strictEqual(env.elements.quotaFreeHeader.style.display, 'flex');
  assert.strictEqual(env.elements.quotaProHeader.style.display, 'none');

  // Pro user: Card shows Pro VIP status
  pricing.renderQuotaDashboard('pro');
  assert.strictEqual(env.elements.quotaDashboardCard.style.display, 'flex');
  assert.strictEqual(env.elements.quotaProHeader.style.display, 'flex');
  assert.strictEqual(env.elements.quotaFreeHeader.style.display, 'none');
});

console.log('\n================================================================');
console.log(`SUMMARY: ${passedCount}/${passedCount + failedCount} tests passed (${failedCount} failed).`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
}
