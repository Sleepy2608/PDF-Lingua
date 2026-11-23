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
        fn({ target: this, preventDefault: () => { }, stopPropagation: () => { } })
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
    documentsSection: new MockElement('documentsSection', 'section'),
    historySection: new MockElement('historySection', 'section'),
    sideNavPricingGroup: new MockElement('sideNavPricingGroup', 'li'),
    sideNavPricing: new MockElement('sideNavPricing', 'a', ['sidebar-nav-item']),
    sideNavPricingPlans: new MockElement('sideNavPricingPlans', 'a', ['sidebar-submenu-item']),
    sideNavPricingBilling: new MockElement('sideNavPricingBilling', 'a', ['sidebar-submenu-item']),
    sideNavPricingQuota: new MockElement('sideNavPricingQuota', 'a', ['sidebar-submenu-item']),
    sideNavHome: new MockElement('sideNavHome', 'a', ['sidebar-nav-item']),
    sideNavTranslate: new MockElement('sideNavTranslate', 'a', ['sidebar-nav-item']),
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
    quotaOcrThresholdBadge: new MockElement('quotaOcrThresholdBadge', 'span', ['quota-threshold-badge']),
    quotaOcrPercent: new MockElement('quotaOcrPercent', 'span', ['quota-percent-pill']),
    quotaOcrUsed: new MockElement('quotaOcrUsed', 'strong'),
    quotaOcrLimit: new MockElement('quotaOcrLimit', 'span'),
    quotaOcrRingFill: new MockElement('quotaOcrRingFill', 'circle', ['quota-ring-fill']),
    quotaOcrRingProgress: new MockElement('quotaOcrRingProgress', 'div', ['quota-ring-wrapper']),
    quotaOcrProgressFill: new MockElement('quotaOcrProgressFill', 'div', ['quota-progress-fill'], {
      role: 'progressbar',
      'aria-valuenow': '28',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    }),
    quotaOcrNote: new MockElement('quotaOcrNote', 'div'),
    quotaOcrCtaWrap: new MockElement('quotaOcrCtaWrap', 'div'),
    btnQuotaOcrCta: new MockElement('btnQuotaOcrCta', 'button'),

    // Meter 2: File Size
    meterFileSize: new MockElement('meterFileSize', 'div'),
    quotaFileSizeThresholdBadge: new MockElement('quotaFileSizeThresholdBadge', 'span', ['quota-threshold-badge']),
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
    quotaCopilotThresholdBadge: new MockElement('quotaCopilotThresholdBadge', 'span', ['quota-threshold-badge']),
    quotaCopilotPercent: new MockElement('quotaCopilotPercent', 'span', ['quota-percent-pill']),
    quotaCopilotUsed: new MockElement('quotaCopilotUsed', 'strong'),
    quotaCopilotLimit: new MockElement('quotaCopilotLimit', 'span'),
    quotaCopilotRingFill: new MockElement('quotaCopilotRingFill', 'circle', ['quota-ring-fill']),
    quotaCopilotRingProgress: new MockElement('quotaCopilotRingProgress', 'div', ['quota-ring-wrapper']),
    quotaCopilotProgressFill: new MockElement('quotaCopilotProgressFill', 'div', ['quota-progress-fill'], {
      role: 'progressbar',
      'aria-valuenow': '27',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    }),
    quotaCopilotNote: new MockElement('quotaCopilotNote', 'div'),
    quotaCopilotCtaWrap: new MockElement('quotaCopilotCtaWrap', 'div'),
    btnQuotaCopilotCta: new MockElement('btnQuotaCopilotCta', 'button'),

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
    pricingMainTitle: new MockElement('pricingMainTitle', 'h1'),
    pricingMainSubtitle: new MockElement('pricingMainSubtitle', 'p'),
    btnPricingBackToPlans: new MockElement('btnPricingBackToPlans', 'button'),
    pricingPlansContainer: new MockElement('pricingPlansContainer', 'div'),
    billingHistoryContainer: new MockElement('billingHistoryContainer', 'div'),
    quotaDashboardContainer: new MockElement('quotaDashboardContainer', 'div'),
    quotaGuestState: new MockElement('quotaGuestState', 'div'),
    btnQuotaGuestLogin: new MockElement('btnQuotaGuestLogin', 'button'),
    btnQuotaGuestViewPlans: new MockElement('btnQuotaGuestViewPlans', 'button'),
  };

  const documentListeners = {};
  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (selector) => {
      if (selector === '.sidebar-nav-item') {
        return [elements.sideNavHome, elements.sideNavTranslate, elements.sideNavPricing].filter(Boolean);
      }
      if (selector === '.sidebar-submenu-item') {
        return [
          elements.sideNavPricingPlans,
          elements.sideNavPricingBilling,
          elements.sideNavPricingQuota,
        ].filter(Boolean);
      }
      return [];
    },
    querySelector: () => null,
    addEventListener: (ev, fn) => {
      documentListeners[ev] = documentListeners[ev] || [];
      documentListeners[ev].push(fn);
    },
    createElement: (tag) => new MockElement('gen_' + Math.random(), tag),
  };

  const notifications = [];
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
    showToast: (msg, type) => { notifications.push({ msg, type }); },
  };

  const sandbox = {
    window: mockWindow,
    document: mockDocument,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    fetch: customFetch || (async () => ({ ok: true, json: async () => ({}) })),
    console: { log: () => { }, error: () => { }, warn: () => { } },
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: () => { },
    setInterval: () => 123,
    clearInterval: () => { },
    showToast: mockWindow.showToast,
    notifyUser: (msg, type) => { notifications.push({ msg, type }); },
  };

  vm.createContext(sandbox);
  vm.runInContext(pricingSource, sandbox);

  if (documentListeners['DOMContentLoaded']) {
    documentListeners['DOMContentLoaded'].forEach((fn) => fn());
  }

  return { sandbox, elements, documentListeners, windowListeners, notifications };
}

let passedCount = 0;
let failedCount = 0;

async function runTest(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    failedCount++;
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('PDF-Lingua Quota Usage Dashboard & Pro VIP Status Test Suite');
  console.log('================================================================\n');

  // 1. Static HTML & CSS Validation
  await runTest('HTML & CSS: Quota Usage Dashboard structure, Pro VIP badge, and progress bars exist', () => {
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

    // Circular Progress Ring SVG & CSS validation
    assert(htmlSource.includes('id="quotaOcrRingFill"'), 'Missing #quotaOcrRingFill in index.html');
    assert(htmlSource.includes('id="quotaCopilotRingFill"'), 'Missing #quotaCopilotRingFill in index.html');
    assert(htmlSource.includes('class="quota-ring-svg"'), 'Missing .quota-ring-svg in index.html');
    assert(pricingCssSource.includes('.quota-ring-wrapper'), 'Missing .quota-ring-wrapper CSS');
    assert(pricingCssSource.includes('.quota-ring-svg'), 'Missing .quota-ring-svg CSS');
    assert(pricingCssSource.includes('.quota-ring-track'), 'Missing .quota-ring-track CSS');
    assert(pricingCssSource.includes('.quota-ring-fill'), 'Missing .quota-ring-fill CSS');
  });

  // 2. Pro VIP State Rendering
  await runTest('Pro VIP State: Renders plan name, dates, countdown badge, and Pro quota meters', () => {
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
  await runTest('Free Tier State: Renders Free header, hides Pro header, displays Free limits', () => {
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
  await runTest('Expiring Soon State: Displays warning banner and pill-expiring countdown badge', () => {
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
  await runTest('Expired State: Displays danger warning banner and pill-expired countdown badge', () => {
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
  await runTest('Meter Progress Bars: Correct color thresholds for <70%, 70-90%, >90%', () => {
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
    assert(!env.elements.quotaOcrRingFill.classList.contains('ring-fill-warning'));
    assert(!env.elements.quotaOcrRingFill.classList.contains('ring-fill-danger'));
    assert(env.elements.quotaOcrPercent.classList.contains('quota-pill-active'));

    // Custom data with 75% OCR (warning)
    pricing.renderQuotaDashboard({
      account_state: 'pro',
      ocr: { used: 375, limit: 500 },
      file_size: { used: 100, limit: 100 },
      ai_copilot: { used: 2, limit: 15 },
    });
    assert(env.elements.quotaOcrProgressFill.classList.contains('quota-fill-warning'));
    assert(env.elements.quotaOcrRingFill.classList.contains('ring-fill-warning'));
    assert(env.elements.quotaOcrPercent.classList.contains('quota-pill-warning'));

    // Custom data with 95% OCR (danger)
    pricing.renderQuotaDashboard({
      account_state: 'pro',
      ocr: { used: 475, limit: 500 },
      file_size: { used: 100, limit: 100 },
      ai_copilot: { used: 2, limit: 15 },
    });
    assert(env.elements.quotaOcrProgressFill.classList.contains('quota-fill-danger'));
    assert(env.elements.quotaOcrRingFill.classList.contains('ring-fill-danger'));
    assert(env.elements.quotaOcrPercent.classList.contains('quota-pill-danger'));
  });

  // 7. Action Buttons & Checkout Modal Triggers
  await runTest('Action Buttons: Clicking Renew, Upgrade Yearly, Free CTA, and Warning Renew triggers checkout', () => {
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
  await runTest('User Subscription Integration: Syncs quota state when role changes between Guest, Free, and Pro', () => {
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

  // 9. Exact Thresholds & Arithmetic Safety
  await runTest('Arithmetic Safety: 0%, 50%, 69%, 70%, 80%, 90%, 91%, 100%, limit=0, NaN, and Infinity', () => {
    const env = createQuotaTestEnv();
    const pricing = env.sandbox.window.PDFLinguaPricing;

    // Threshold calculations
    assert.strictEqual(pricing.calculateQuotaPercent(0, 500), 0, '0 / 500 => 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(250, 500), 50, '250 / 500 => 50%');
    assert.strictEqual(pricing.calculateQuotaPercent(345, 500), 69, '345 / 500 => 69%');
    assert.strictEqual(pricing.calculateQuotaPercent(350, 500), 70, '350 / 500 => 70%');
    assert.strictEqual(pricing.calculateQuotaPercent(400, 500), 80, '400 / 500 => 80%');
    assert.strictEqual(pricing.calculateQuotaPercent(450, 500), 90, '450 / 500 => 90%');
    assert.strictEqual(pricing.calculateQuotaPercent(455, 500), 91, '455 / 500 => 91%');
    assert.strictEqual(pricing.calculateQuotaPercent(500, 500), 100, '500 / 500 => 100%');
    assert.strictEqual(pricing.calculateQuotaPercent(550, 500), 100, 'Clamped at 100%');

    // Edge cases: 0 limit, negative, null, NaN, Infinity
    assert.strictEqual(pricing.calculateQuotaPercent(0, 0), 0, '0 / 0 => safe 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(10, 0), 0, 'Limit 0 => safe 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(-5, 100), 0, 'Negative used => safe 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(null, undefined), 0, 'Missing values => safe 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(NaN, 100), 0, 'NaN used => safe 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(100, Infinity), 0, 'Infinity limit => safe 0%');
  });

  // 10. Threshold Badges & 100% State UI
  await runTest('Threshold Badges: Shows warning badge for 70-90% and danger badge for >90% and 100%', () => {
    const env = createQuotaTestEnv();
    const pricing = env.sandbox.window.PDFLinguaPricing;

    // 69% (Under 70%): Badge hidden
    pricing.renderQuotaDashboard({
      account_state: 'pro',
      ocr: { used: 345, limit: 500 },
      file_size: { used: 100, limit: 100 },
      ai_copilot: { used: 2, limit: 15 },
    });
    assert.strictEqual(env.elements.quotaOcrPercent.textContent, '69%');
    assert.strictEqual(env.elements.quotaOcrThresholdBadge.style.display, 'none');
    assert(!env.elements.quotaOcrProgressFill.classList.contains('quota-fill-warning'));
    assert(!env.elements.quotaOcrProgressFill.classList.contains('quota-fill-danger'));

    // 70% (Warning threshold): Badge visible
    pricing.renderQuotaDashboard({
      account_state: 'pro',
      ocr: { used: 350, limit: 500 },
      file_size: { used: 100, limit: 100 },
      ai_copilot: { used: 2, limit: 15 },
    });
    assert.strictEqual(env.elements.quotaOcrPercent.textContent, '70%');
    assert.strictEqual(env.elements.quotaOcrThresholdBadge.style.display, 'inline-flex');
    assert.strictEqual(env.elements.quotaOcrThresholdBadge.textContent, 'Sắp đạt hạn mức');
    assert(env.elements.quotaOcrProgressFill.classList.contains('quota-fill-warning'));
    assert(env.elements.quotaOcrPercent.classList.contains('quota-pill-warning'));

    // 90% (Warning upper bound): Badge visible
    pricing.renderQuotaDashboard({
      account_state: 'pro',
      ocr: { used: 450, limit: 500 },
      file_size: { used: 100, limit: 100 },
      ai_copilot: { used: 2, limit: 15 },
    });
    assert.strictEqual(env.elements.quotaOcrPercent.textContent, '90%');
    assert.strictEqual(env.elements.quotaOcrThresholdBadge.style.display, 'inline-flex');
    assert.strictEqual(env.elements.quotaOcrThresholdBadge.textContent, 'Sắp đạt hạn mức');

    // 91% (Over 90% threshold): Danger badge & CTA visible
    pricing.renderQuotaDashboard({
      account_state: 'pro',
      ocr: { used: 455, limit: 500 },
      file_size: { used: 100, limit: 100 },
      ai_copilot: { used: 2, limit: 15 },
    });
    assert.strictEqual(env.elements.quotaOcrPercent.textContent, '91%');
    assert.strictEqual(env.elements.quotaOcrThresholdBadge.style.display, 'inline-flex');
    assert.strictEqual(env.elements.quotaOcrThresholdBadge.textContent, 'Sắp hết hạn mức');
    assert(env.elements.quotaOcrProgressFill.classList.contains('quota-fill-danger'));
    assert(env.elements.quotaOcrPercent.classList.contains('quota-pill-danger'));
    assert.strictEqual(env.elements.quotaOcrCtaWrap.style.display, 'flex');

    // 100% (Limit reached): Danger badge "Đã đạt giới hạn"
    pricing.renderQuotaDashboard({
      account_state: 'pro',
      ocr: { used: 500, limit: 500 },
      file_size: { used: 100, limit: 100 },
      ai_copilot: { used: 2, limit: 15 },
    });
    assert.strictEqual(env.elements.quotaOcrPercent.textContent, '100%');
    assert.strictEqual(env.elements.quotaOcrThresholdBadge.style.display, 'inline-flex');
    assert.strictEqual(env.elements.quotaOcrThresholdBadge.textContent, 'Đã đạt giới hạn');
    assert.strictEqual(env.elements.quotaOcrProgressFill.style.width, '100%');
    assert.strictEqual(env.elements.quotaOcrProgressFill.getAttribute('aria-valuenow'), '100');
  });

  // 11. Responsive Layout Breakpoints
  await runTest('Responsive Layout: Desktop 3 cols (>1024px), Tablet 2 cols (768-1024px), Mobile 1 col (<=768px)', () => {
    // Desktop base grid: 3 columns
    assert(pricingCssSource.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), 'Missing 3-col Desktop layout');

    // Tablet media query (<= 1024px): 2 columns
    assert(pricingCssSource.includes('@media (max-width: 1024px)'), 'Missing 1024px tablet media query');
    const tabletIndex = pricingCssSource.lastIndexOf('@media (max-width: 1024px)');
    const tabletBlock = pricingCssSource.substring(tabletIndex, tabletIndex + 200);
    assert(tabletBlock.includes('repeat(2, minmax(0, 1fr))'), 'Tablet query should have 2 columns');

    // Mobile media query (<= 768px): 1 column
    assert(pricingCssSource.includes('@media (max-width: 768px)'), 'Missing 768px mobile media query');
    const mobileIndex = pricingCssSource.lastIndexOf('@media (max-width: 768px)');
    const mobileBlock = pricingCssSource.substring(mobileIndex, mobileIndex + 1200);
    assert(mobileBlock.includes('grid-template-columns: 1fr'), 'Mobile query should have 1 column');
    assert(mobileBlock.includes('flex-direction: column'), 'Mobile query should stack header row');

    // Small mobile media query (<= 480px)
    assert(pricingCssSource.includes('@media (max-width: 480px)'), 'Missing 480px extra small mobile media query');
  });

  // 12. Accessibility, Tabular Numbers & Progress Motion
  await runTest('Accessibility & Motion: Tabular nums, smooth cubic-bezier easing, and reduced motion override', () => {
    // Tabular nums font variant
    assert(pricingCssSource.includes('font-variant-numeric: tabular-nums'), 'Missing font-variant-numeric: tabular-nums');

    // Motion physics: smooth cubic-bezier easing
    assert(pricingCssSource.includes('cubic-bezier(0.16, 1, 0.3, 1)'), 'Missing smooth cubic-bezier motion physics');

    // Reduced motion overrides
    const reducedMotionIndex = pricingCssSource.lastIndexOf('@media (prefers-reduced-motion: reduce)');
    assert(reducedMotionIndex !== -1, 'Missing @media (prefers-reduced-motion: reduce)');
    const reducedBlock = pricingCssSource.substring(reducedMotionIndex, reducedMotionIndex + 400);
    assert(reducedBlock.includes('.quota-progress-fill'), 'Reduced motion must include .quota-progress-fill');
    assert(reducedBlock.includes('.quota-dashboard-card'), 'Reduced motion must include .quota-dashboard-card');
    assert(reducedBlock.includes('transition: none !important'), 'Reduced motion must disable transitions');
  });

  // 13. Inline Meter Action Triggers
  await runTest('Inline Meter Actions: Clicking inline quota CTA buttons triggers checkout modal', () => {
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
              transaction_code: 'TX_INLINE_CTA',
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

    // Click inline OCR CTA
    env.elements.btnQuotaOcrCta.click();
    assert.strictEqual(initiatedPlan, 'pro_monthly', 'Inline OCR CTA should initiate checkout');

    // Click inline Copilot CTA
    initiatedPlan = null;
    env.elements.btnQuotaCopilotCta.click();
    assert.strictEqual(initiatedPlan, 'pro_monthly', 'Inline Copilot CTA should initiate checkout');
  });


  // 14. Real Subscription API Integration - Free Account
  await runTest('Subscription API: Free account mapping with real backend limits', async () => {
    let capturedUrl = null;
    let capturedHeaders = null;

    const env = createQuotaTestEnv(
      {
        pdfl_token: 'fake_jwt_token_free',
        pdfl_user: JSON.stringify({ id: 101, email: 'free_user@pdfl.vn', role: 'free' }),
      },
      async (url, opts) => {
        capturedUrl = url;
        capturedHeaders = opts && opts.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              current_role: 'free',
              is_pro: false,
              max_file_size_mb: 20,
              max_ocr_pages: 100,
              active_subscription: null,
            },
          }),
        };
      }
    );

    const pricing = env.sandbox.window.PDFLinguaPricing;
    const res = await pricing.fetchMySubscription();

    assert(capturedUrl && capturedUrl.includes('/api/pricing/my-subscription'), 'Must call /api/pricing/my-subscription');
    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer fake_jwt_token_free', 'Must send Bearer JWT');
    assert.strictEqual(res.current_role, 'free');
    assert.strictEqual(res.is_pro, false);

    // Verify rendered state
    assert.strictEqual(env.elements.quotaDashboardCard.style.display, 'flex');
    assert.strictEqual(env.elements.quotaFreeHeader.style.display, 'flex');
    assert.strictEqual(env.elements.quotaProHeader.style.display, 'none');
    assert.strictEqual(env.elements.quotaOcrLimit.textContent, '100');
    assert.strictEqual(env.elements.quotaFileSizeUsed.textContent, '20 MB');
    assert.strictEqual(env.elements.quotaCopilotLimit.textContent, '0');
  });

  // 15. Real Subscription API Integration - Pro Account with Active Subscription
  await runTest('Subscription API: Pro account mapping with active subscription metadata', async () => {
    const env = createQuotaTestEnv(
      {
        pdfl_token: 'fake_jwt_token_pro',
        pdfl_user: JSON.stringify({ id: 102, email: 'pro_user@pdfl.vn', role: 'pro' }),
      },
      async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              current_role: 'pro',
              is_pro: true,
              max_file_size_mb: 100,
              max_ocr_pages: 500,
              active_subscription: {
                id: 88,
                user_id: 102,
                plan_code: 'pro_monthly',
                plan_name: 'Gói Pro Hàng Tháng',
                billing_cycle: 'monthly',
                status: 'active',
                started_at: '2026-11-01T00:00:00Z',
                expires_at: '2026-12-01T00:00:00Z',
                days_remaining: 14,
                auto_renew: true,
              },
            },
          }),
        };
      }
    );

    const pricing = env.sandbox.window.PDFLinguaPricing;
    const res = await pricing.fetchMySubscription();

    assert.strictEqual(res.is_pro, true);
    assert.strictEqual(res.active_subscription.plan_name, 'Gói Pro Hàng Tháng');

    // UI elements assertion
    assert.strictEqual(env.elements.quotaDashboardCard.style.display, 'flex');
    assert.strictEqual(env.elements.quotaProHeader.style.display, 'flex');
    assert.strictEqual(env.elements.quotaFreeHeader.style.display, 'none');
    assert.strictEqual(env.elements.quotaPlanName.textContent, 'Gói Pro Hàng Tháng');
    assert.strictEqual(env.elements.quotaDaysRemainingBadge.textContent, 'Còn 14 ngày');
    assert.strictEqual(env.elements.quotaOcrLimit.textContent, '500');
    assert.strictEqual(env.elements.quotaFileSizeUsed.textContent, '100 MB');
    assert.strictEqual(env.elements.quotaCopilotLimit.textContent, '15');
  });

  // 16. Event Synchronization (pdfl:auth-change, tab switch, pdfl:job-completed, pdfl:document-processed)
  await runTest('Event Synchronization: Auth changes, tab switches, and document processing trigger quota sync', async () => {
    let fetchCalls = 0;
    const env = createQuotaTestEnv(
      {
        pdfl_token: 'fake_jwt_token_sync',
        pdfl_user: JSON.stringify({ id: 103, email: 'sync_user@pdfl.vn', role: 'pro' }),
      },
      async (url) => {
        if (url.includes('/api/pricing/my-subscription')) {
          fetchCalls++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                current_role: 'pro',
                is_pro: true,
                max_file_size_mb: 100,
                max_ocr_pages: 500,
                active_subscription: {
                  plan_name: 'Gói Pro Sync',
                  days_remaining: 20,
                  expires_at: '2026-12-10T00:00:00Z',
                },
              },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    const pricing = env.sandbox.window.PDFLinguaPricing;
    const initialCalls = fetchCalls;

    // 1. pdfl:auth-change event
    env.sandbox.window.dispatchEvent({
      type: 'pdfl:auth-change',
      detail: { user: { id: 103, email: 'sync_user@pdfl.vn', role: 'pro' } },
    });
    await new Promise((r) => setTimeout(r, 10));
    assert(fetchCalls > initialCalls, 'pdfl:auth-change must trigger subscription fetch');

    const afterAuthCalls = fetchCalls;

    // 2. Tab switch to plans
    pricing.switchPricingTab('plans');
    await new Promise((r) => setTimeout(r, 10));
    assert(fetchCalls > afterAuthCalls, 'Switching to plans tab must trigger subscription fetch');

    const afterTabCalls = fetchCalls;

    // 3. pdfl:job-completed event
    env.sandbox.window.dispatchEvent({
      type: 'pdfl:job-completed',
      detail: { jobId: 'job-999' },
    });
    await new Promise((r) => setTimeout(r, 10));
    assert(fetchCalls > afterTabCalls, 'pdfl:job-completed must trigger subscription fetch');

    const afterJobCalls = fetchCalls;

    // 4. Duplicate binding guard
    pricing.bindGlobalSyncEvents();
    pricing.bindGlobalSyncEvents();
    env.sandbox.window.dispatchEvent({
      type: 'pdfl:document-processed',
      detail: { docId: 'doc-888' },
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(fetchCalls, afterJobCalls + 1, 'Duplicate bindings must not cause multiple fetches');
  });

  // 17. Error Handling & Loading State (HTTP 401, 403, 500, Network Failure, Invalid JSON, Loading Skeleton)
  await runTest('Error Handling & Loading: Skeleton states, HTTP 401, 403, 500, and network failures', async () => {
    // 1. Loading Skeleton
    const env = createQuotaTestEnv({
      pdfl_token: 'fake_jwt_token',
      pdfl_user: JSON.stringify({ id: 104, email: 'err_user@pdfl.vn', role: 'pro' }),
    });
    const pricing = env.sandbox.window.PDFLinguaPricing;

    pricing.setQuotaDashboardLoading(true);
    assert(env.elements.quotaDashboardCard.classList.contains('is-loading'), 'Card must have is-loading class');
    assert.strictEqual(env.elements.quotaDashboardCard.getAttribute('aria-busy'), 'true', 'Card must have aria-busy="true"');

    pricing.setQuotaDashboardLoading(false);
    assert(!env.elements.quotaDashboardCard.classList.contains('is-loading'), 'is-loading must be removed');
    assert.strictEqual(env.elements.quotaDashboardCard.getAttribute('aria-busy'), 'false', 'aria-busy must be false');

    // 2. HTTP 401 Session Expiry
    env.sandbox.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Token expired' }),
    });

    const res401 = await pricing.fetchMySubscription();
    assert.strictEqual(res401, null, '401 should return null');
    assert(env.notifications.some((n) => n.type === 'warning' && n.msg.includes('Phiên đăng nhập đã hết hạn')), '401 should notify user');
    assert.strictEqual(env.elements.quotaDashboardCard.style.display, 'none', '401 should reset quota card');

    // 3. HTTP 403 Forbidden
    env.sandbox.fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ detail: 'Forbidden' }),
    });
    const res403 = await pricing.fetchMySubscription();
    assert.strictEqual(res403, null, '403 should return null');
    assert(env.notifications.some((n) => n.type === 'error' && n.msg.includes('quyền truy cập')), '403 should notify user');

    // 4. HTTP 500 Internal Error
    env.sandbox.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Server error' }),
    });
    const res500 = await pricing.fetchMySubscription();
    assert.strictEqual(res500, null, '500 should return null');
    assert(pricing.getSubscriptionRequestState().error.includes('500'), 'State should record 500 error');

    // 5. Network Failure
    env.sandbox.fetch = async () => {
      throw new Error('Failed to fetch');
    };
    const resNetwork = await pricing.fetchMySubscription();
    assert.strictEqual(resNetwork, null, 'Network error should return null without crashing');
    assert(pricing.getSubscriptionRequestState().error.includes('Lỗi kết nối'), 'State should record network error');
  });

  // 18. Race Condition Prevention
  await runTest('Race Condition Prevention: Slower stale request does not overwrite newer response', async () => {
    let resolveFirstReq = null;
    let resolveSecondReq = null;

    let subReqCount = 0;
    const env = createQuotaTestEnv({}, async (url) => {
      if (!url.includes('/api/pricing/my-subscription')) {
        return { ok: true, json: async () => ({ success: true, data: {} }) };
      }
      subReqCount++;
      if (subReqCount === 1) {
        // Slow first request (Free data)
        return new Promise((resolve) => {
          resolveFirstReq = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  current_role: 'free',
                  is_pro: false,
                  max_file_size_mb: 20,
                  max_ocr_pages: 100,
                  active_subscription: null,
                },
              }),
            });
        });
      } else {
        // Fast second request (Pro data)
        return new Promise((resolve) => {
          resolveSecondReq = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  current_role: 'pro',
                  is_pro: true,
                  max_file_size_mb: 100,
                  max_ocr_pages: 500,
                  active_subscription: {
                    plan_name: 'Gói Pro Mới Nhất',
                    days_remaining: 30,
                  },
                },
              }),
            });
        });
      }
    });

    env.sandbox.localStorage.setItem('pdfl_token', 'fake_jwt_token');
    env.sandbox.localStorage.setItem(
      'pdfl_user',
      JSON.stringify({ id: 105, email: 'race@pdfl.vn', role: 'free' })
    );

    const pricing = env.sandbox.window.PDFLinguaPricing;

    // Trigger Request 1 (Slow)
    const p1 = pricing.fetchMySubscription();

    // Trigger Request 2 (Fast newer request)
    const p2 = pricing.fetchMySubscription();

    // Resolve Request 2 FIRST
    resolveSecondReq();
    await p2;

    assert.strictEqual(env.elements.quotaProHeader.style.display, 'flex', 'Pro header should be displayed from req 2');
    assert.strictEqual(env.elements.quotaPlanName.textContent, 'Gói Pro Mới Nhất');

    // Now resolve Request 1 (Stale)
    resolveFirstReq();
    await p1;

    // Verify Request 1 did NOT overwrite Request 2
    assert.strictEqual(env.elements.quotaProHeader.style.display, 'flex', 'Stale req 1 must not overwrite Pro state');
    assert.strictEqual(env.elements.quotaPlanName.textContent, 'Gói Pro Mới Nhất', 'Plan name must not be overwritten');
    assert.strictEqual(pricing.getMySubscriptionData().current_role, 'pro', 'Subscription data must remain Pro');
  });


  // 19. Extended Quota Arithmetic & Extreme Boundary Safety
  await runTest('Arithmetic Safety: Negative limit, non-numeric strings, float rounding, and extreme clamping', () => {
    const env = createQuotaTestEnv();
    const pricing = env.sandbox.window.PDFLinguaPricing;

    // Negative limits
    assert.strictEqual(pricing.calculateQuotaPercent(50, -100), 0, 'Negative limit => 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(-10, -50), 0, 'Negative used and limit => 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(0, -1), 0, 'Zero used with negative limit => 0%');

    // String coercion
    assert.strictEqual(pricing.calculateQuotaPercent('50', '100'), 50, 'String numbers => 50%');
    assert.strictEqual(pricing.calculateQuotaPercent('abc', '100'), 0, 'Invalid used string => 0%');
    assert.strictEqual(pricing.calculateQuotaPercent('50', 'xyz'), 0, 'Invalid limit string => 0%');
    assert.strictEqual(pricing.calculateQuotaPercent('', ''), 0, 'Empty string => 0%');

    // Floating point rounding
    assert.strictEqual(pricing.calculateQuotaPercent(347, 500), 69, '69.4% rounds down to 69%');
    assert.strictEqual(pricing.calculateQuotaPercent(348, 500), 70, '69.6% rounds up to 70%');
    assert.strictEqual(pricing.calculateQuotaPercent(454, 500), 91, '90.8% rounds up to 91%');

    // Infinity and extreme values
    assert.strictEqual(pricing.calculateQuotaPercent(-Infinity, 100), 0, '-Infinity used => 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(50, Infinity), 0, 'Infinity limit => 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(10000, 500), 100, 'Extreme usage clamped to 100%');
    assert.strictEqual(pricing.calculateQuotaPercent(null, null), 0, 'Null values => 0%');
    assert.strictEqual(pricing.calculateQuotaPercent(undefined, 100), 0, 'Undefined used => 0%');
    assert.strictEqual(pricing.calculateQuotaPercent({}, []), 0, 'Object/array => 0%');
  });

  // 20. Malformed & Missing API Response Schemas
  await runTest('API Error Handling: Malformed responses, missing data, and backend error messages', async () => {
    const env = createQuotaTestEnv({
      pdfl_token: 'fake_jwt_token',
      pdfl_user: JSON.stringify({ id: 106, email: 'malformed@pdfl.vn', role: 'pro' }),
    });
    const pricing = env.sandbox.window.PDFLinguaPricing;

    // 1. success: false with custom backend message
    env.sandbox.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        message: 'Hệ thống bảo trì hạn mức tài khoản.',
      }),
    });
    const res1 = await pricing.fetchMySubscription();
    assert.strictEqual(res1, null, 'Should return null when success is false');
    assert.strictEqual(
      pricing.getSubscriptionRequestState().error,
      'Hệ thống bảo trì hạn mức tài khoản.',
      'Must record backend error message'
    );

    // 2. Missing data property
    env.sandbox.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
      }),
    });
    const res2 = await pricing.fetchMySubscription();
    assert.strictEqual(res2, null, 'Should return null when data is missing');
    assert.strictEqual(
      pricing.getSubscriptionRequestState().error,
      'Dữ liệu phản hồi không hợp lệ.',
      'Must record invalid response data error'
    );

    // 3. Null response body
    env.sandbox.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => null,
    });
    const res3 = await pricing.fetchMySubscription();
    assert.strictEqual(res3, null, 'Should return null on null body');

    // 4. Empty object response body
    env.sandbox.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const res4 = await pricing.fetchMySubscription();
    assert.strictEqual(res4, null, 'Should return null on empty object');
  });

  // 21. Subscription Contract Semantics - Per-Document vs Cumulative & Copilot Distinction
  await runTest('Subscription Contract: Per-document limits, Copilot recovery, and active subscription metadata', async () => {
    const env = createQuotaTestEnv(
      {
        pdfl_token: 'contract_token',
        pdfl_user: JSON.stringify({ id: 107, email: 'pro_contract@pdfl.vn', role: 'pro' }),
      },
      async (url) => {
        if (url.includes('/api/pricing/my-subscription')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                current_role: 'pro',
                is_pro: true,
                max_file_size_mb: 100,
                max_ocr_pages: 500,
                active_subscription: {
                  id: 99,
                  user_id: 107,
                  plan_code: 'pro_monthly',
                  plan_name: 'Gói Pro Hàng Tháng',
                  billing_cycle: 'monthly',
                  status: 'active',
                  started_at: '2026-11-01T08:00:00Z',
                  expires_at: '2026-12-01T08:00:00Z',
                  days_remaining: 13,
                  auto_renew: true,
                  cancelled_at: null,
                },
              },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    const pricing = env.sandbox.window.PDFLinguaPricing;
    await pricing.fetchMySubscription();

    // 1. max_ocr_pages is per-document limit, not cumulative
    assert.strictEqual(env.elements.quotaOcrLimit.textContent, '500');
    assert(
      env.elements.quotaOcrNote.textContent.includes('Tối đa 500 trang OCR / tài liệu theo gói Pro'),
      'OCR note must specify per-document limit semantics'
    );

    // 2. Copilot meter recovery note (does not claim server-side cumulative usage)
    assert.strictEqual(env.elements.quotaCopilotLimit.textContent, '15');
    assert.strictEqual(
      env.elements.quotaCopilotNote.textContent,
      'Hồi phục 15 câu sau mỗi 24 giờ',
      'Copilot note must reflect daily recovery without claiming cumulative server counters'
    );

    // 3. File size meter displays 100 MB
    assert.strictEqual(env.elements.quotaFileSizeUsed.textContent, '100 MB');
    assert.strictEqual(env.elements.quotaFileSizePercent.textContent, '100 MB');
    assert(
      env.elements.quotaFileSizeNote.textContent.includes('Tối đa 100 MB / tệp theo gói Pro'),
      'File size note must reflect 100 MB limit'
    );

    // 4. Auto-renew control visibility
    assert.strictEqual(env.elements.btnCancelAutoRenew.style.display, 'inline-flex', 'Auto renew button should be visible when auto_renew is true');

    // 5. Test Free user contract semantics
    env.sandbox.fetch = async (url) => {
      if (url.includes('/api/pricing/my-subscription')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              current_role: 'free',
              is_pro: false,
              max_file_size_mb: 20,
              max_ocr_pages: 100,
              active_subscription: null,
            },
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    };

    await pricing.fetchMySubscription();
    assert.strictEqual(env.elements.quotaOcrLimit.textContent, '100');
    assert(
      env.elements.quotaOcrNote.textContent.includes('Tối đa 100 trang OCR / tài liệu cho gói Miễn phí'),
      'Free OCR note must specify per-document limit'
    );
    assert.strictEqual(env.elements.quotaCopilotLimit.textContent, '0');
    assert.strictEqual(
      env.elements.quotaCopilotNote.textContent,
      'Nâng cấp lên Pro để mở khóa AI Copilot 15 câu/ngày',
      'Free Copilot note must prompt upgrade to Pro'
    );
  });

  // 22. Concurrency & Duplicate Event Listener Guard
  await runTest('Event Concurrency: Multiple bind calls do not create duplicate listeners or duplicate fetches', async () => {
    let fetchCounter = 0;
    const env = createQuotaTestEnv(
      {
        pdfl_token: 'guard_token',
        pdfl_user: JSON.stringify({ id: 108, email: 'guard@pdfl.vn', role: 'pro' }),
      },
      async (url) => {
        if (url.includes('/api/pricing/my-subscription')) {
          fetchCounter++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                current_role: 'pro',
                is_pro: true,
                max_file_size_mb: 100,
                max_ocr_pages: 500,
                active_subscription: { plan_name: 'Gói Pro Guard', days_remaining: 25 },
              },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }
    );

    const pricing = env.sandbox.window.PDFLinguaPricing;

    // Call bindGlobalSyncEvents multiple times
    pricing.bindGlobalSyncEvents();
    pricing.bindGlobalSyncEvents();
    pricing.bindGlobalSyncEvents();

    const baselineFetches = fetchCounter;

    // Dispatch job-completed once
    env.sandbox.window.dispatchEvent({ type: 'pdfl:job-completed', detail: { jobId: 'job-1' } });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(fetchCounter, baselineFetches + 1, 'job-completed must trigger exactly 1 fetch');

    // Dispatch document-processed once
    env.sandbox.window.dispatchEvent({ type: 'pdfl:document-processed', detail: { docId: 'doc-1' } });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(fetchCounter, baselineFetches + 2, 'document-processed must trigger exactly 1 fetch');

    // Logout via pdfl:auth-change with user null
    env.sandbox.window.dispatchEvent({ type: 'pdfl:auth-change', detail: { user: null } });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(env.elements.quotaDashboardCard.style.display, 'none', 'Logging out must hide Quota Dashboard');
    assert.strictEqual(pricing.getMySubscriptionData(), null, 'Subscription data must be cleared on logout');
  });

  // 23. Regression: Pricing View Navigation & Workspace Restoral
  await runTest('Regression: Opening and closing pricing view preserves section states and restores workspace', () => {
    const env = createQuotaTestEnv();
    const pricing = env.sandbox.window.PDFLinguaPricing;

    // Initially open pricing view
    pricing.openPricingView();
    assert.strictEqual(env.elements.pricingSection.style.display, 'block', 'Pricing section should be visible');
    assert.strictEqual(env.elements.heroSection.style.display, 'none', 'Hero section should be hidden');
    assert.strictEqual(env.elements.workspaceSection.style.display, 'none', 'Workspace section should be hidden');
    assert.strictEqual(env.elements.adminSection.style.display, 'none', 'Admin section should be hidden');
    assert(env.elements.sideNavPricing.classList.contains('active'), 'sideNavPricing should have active class');

    // Close pricing view without loaded doc -> restores hero and sideNavHome
    pricing.closePricingView();
    assert.strictEqual(env.elements.pricingSection.style.display, 'none', 'Pricing section should be hidden after closing');
    assert.strictEqual(env.elements.heroSection.style.display, 'block', 'Hero section should be restored');
    assert(env.elements.sideNavHome.classList.contains('active'), 'sideNavHome should have active class');

    // Close pricing view WITH loaded doc -> restores workspace and sideNavTranslate
    env.sandbox.window.pdfLinguaWorkspace = {
      getCurrentDocData: () => ({ id: 'doc-123', name: 'sample.pdf' }),
    };
    pricing.openPricingView();
    assert.strictEqual(env.elements.pricingSection.style.display, 'block');
    pricing.closePricingView();
    assert.strictEqual(env.elements.pricingSection.style.display, 'none');
    assert.strictEqual(env.elements.workspaceSection.style.display, 'block', 'Workspace section should be restored');
    assert(env.elements.sideNavTranslate.classList.contains('active'), 'sideNavTranslate should have active class when doc loaded');

    // Clicking topNavPricing opens pricing view
    env.elements.topNavPricing.click();
    assert.strictEqual(env.elements.pricingSection.style.display, 'block', 'Clicking topNavPricing should open pricing view');

    // Clicking topNavTranslate closes pricing view and restores workspace
    env.elements.topNavTranslate.click();
    assert.strictEqual(env.elements.pricingSection.style.display, 'none', 'Clicking topNavTranslate should close pricing view');
  });

  // 24. Regression: Checkout Modal Activation from all Quota Touchpoints
  await runTest('Regression: Quota touchpoints trigger checkout modal with correct cycle and plan code', () => {
    const env = createQuotaTestEnv({
      pdfl_token: 'fake_jwt_token',
      pdfl_user: JSON.stringify({ id: 109, email: 'checkout_user@pdfl.vn', role: 'pro' }),
    });

    let requestedPlanCode = null;
    env.sandbox.fetch = async (url, opts) => {
      if (url.includes('/api/pricing/subscribe')) {
        const body = JSON.parse(opts.body);
        requestedPlanCode = body.plan_code;
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              transaction_code: 'TX_REGRESSION_TEST',
              plan_code: body.plan_code,
              amount: body.plan_code === 'pro_yearly' ? 399000 : 49000,
              qr_code_url: 'https://img.vietqr.io/image/MB-0987654321-compact2.png',
              expires_at: new Date(Date.now() + 900000).toISOString(),
            },
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    };

    const pricing = env.sandbox.window.PDFLinguaPricing;

    // 1. Pro Header: Renew Plan (Monthly default)
    pricing.setBillingCycle('monthly');
    requestedPlanCode = null;
    env.elements.btnQuotaRenew.click();
    assert.strictEqual(requestedPlanCode, 'pro_monthly', 'btnQuotaRenew initiates pro_monthly');
    assert.strictEqual(env.elements.pricingCheckoutModal.hasAttribute('hidden'), false, 'Modal hidden must be removed');
    assert.strictEqual(env.elements.pricingCheckoutModal.style.display, 'flex');
    assert.strictEqual(env.elements.pricingCheckoutModal.getAttribute('aria-hidden'), 'false');

    // 2. Pro Header: Upgrade to Yearly Plan
    requestedPlanCode = null;
    env.elements.btnQuotaUpgradeYearly.click();
    assert.strictEqual(requestedPlanCode, 'pro_yearly', 'btnQuotaUpgradeYearly initiates pro_yearly');

    // 3. Warning Banner: Warning Renew Button
    pricing.setBillingCycle('monthly');
    requestedPlanCode = null;
    env.elements.btnQuotaWarningRenew.click();
    assert.strictEqual(requestedPlanCode, 'pro_monthly', 'btnQuotaWarningRenew initiates pro_monthly');

    // 4. Free Header: Free Upgrade CTA Button
    pricing.setBillingCycle('yearly');
    requestedPlanCode = null;
    env.elements.btnQuotaUpgradeFreeCta.click();
    assert.strictEqual(requestedPlanCode, 'pro_yearly', 'btnQuotaUpgradeFreeCta initiates pro_yearly when cycle is yearly');

    // 5. Close Checkout Modal
    pricing.closeCheckoutModal();
    assert.strictEqual(env.elements.pricingCheckoutModal.hasAttribute('hidden'), true, 'Modal hidden must be true after closing');
    assert.strictEqual(env.elements.pricingCheckoutModal.style.display, 'none');
    assert.strictEqual(env.elements.pricingCheckoutModal.getAttribute('aria-hidden'), 'true');

    // 6. Escape key accessibility closes Checkout Modal
    pricing.openCheckoutModal('pro_monthly');
    assert.strictEqual(env.elements.pricingCheckoutModal.hasAttribute('hidden'), false);
    if (env.documentListeners['keydown']) {
      env.documentListeners['keydown'].forEach((fn) => fn({ key: 'Escape' }));
    }
    assert.strictEqual(env.elements.pricingCheckoutModal.hasAttribute('hidden'), true, 'Escape key must close checkout modal');
  });

  // 25. HTML & CSS Structure: 3 Isolated Sub-pages under Pricing Section
  await runTest('Structure: Pricing plans, Billing history, and Quota dashboard occupy 3 sibling sub-view containers', () => {
    const idxPlans = htmlSource.indexOf('id="pricingPlansContainer"');
    const idxBilling = htmlSource.indexOf('id="billingHistoryContainer"');
    const idxQuotaContainer = htmlSource.indexOf('id="quotaDashboardContainer"');
    const idxQuotaCard = htmlSource.indexOf('id="quotaDashboardCard"');
    const idxGuestState = htmlSource.indexOf('id="quotaGuestState"');

    assert.ok(idxPlans !== -1, 'pricingPlansContainer must exist in index.html');
    assert.ok(idxBilling !== -1, 'billingHistoryContainer must exist in index.html');
    assert.ok(idxQuotaContainer !== -1, 'quotaDashboardContainer must exist in index.html');
    assert.ok(idxQuotaCard !== -1, 'quotaDashboardCard must exist in index.html');
    assert.ok(idxGuestState !== -1, 'quotaGuestState must exist in index.html');

    assert.ok(idxPlans < idxBilling, 'pricingPlansContainer must close before billingHistoryContainer begins');
    assert.ok(idxBilling < idxQuotaContainer, 'billingHistoryContainer must precede quotaDashboardContainer');
    assert.ok(idxQuotaContainer < idxQuotaCard, 'quotaDashboardCard must reside inside quotaDashboardContainer, separate from Plans page');
    assert.ok(idxQuotaContainer < idxGuestState, 'quotaGuestState must reside inside quotaDashboardContainer');

    assert.strictEqual(htmlSource.includes('class="pricing-tabs-bar"'), false, 'Duplicate 3-tab bar must be removed from HTML');
    assert.strictEqual(htmlSource.includes('id="tabPricingPlans"'), false, 'tabPricingPlans must be removed from HTML');
    assert.strictEqual(htmlSource.includes('id="tabBillingHistory"'), false, 'tabBillingHistory must be removed from HTML');
    assert.strictEqual(htmlSource.includes('id="tabQuotaDashboard"'), false, 'tabQuotaDashboard must be removed from HTML');
    assert.strictEqual(htmlSource.includes('id="billingHistoryTabBadge"'), false, 'billingHistoryTabBadge must be removed from HTML');
    assert.strictEqual(htmlSource.includes('class="billing-history-header"'), false, 'Redundant sub-eyebrow billing-history-header must be removed');
    assert.strictEqual(htmlSource.includes('class="quota-page-eyebrow-row"'), false, 'Redundant sub-eyebrow quota-page-eyebrow-row must be removed');
    assert.ok(htmlSource.includes('id="btnPricingBackToPlans"'), 'Back-to-plans header CTA must exist in index.html');
    assert.strictEqual(pricingCssSource.includes('.pricing-tabs-bar'), false, 'Removed 3-tab bar CSS must not remain in pricing.css');
    assert.strictEqual(pricingCssSource.includes('--radius-xl'), false, 'Undefined --radius-xl token must be replaced by --radius-lg');
    assert.strictEqual(pricingCssSource.includes('--border-medium'), false, 'Undefined --border-medium token must not remain in pricing.css');
    assert.ok(pricingCssSource.includes('.quota-dashboard-container'), 'pricing.css must style .quota-dashboard-container');
    assert.ok(pricingCssSource.includes('.quota-guest-state-card'), 'pricing.css must style .quota-guest-state-card');
    assert.ok(pricingCssSource.includes('.pricing-section .btn-primary'), 'pricing.css must define Pricing-themed .btn-primary CTA');
    assert.ok(pricingCssSource.includes('.quota-free-desc'), 'pricing.css must style .quota-free-desc');
  });

  // 26. Multi-page Navigation, Guest State & Sidebar Submenu Synchronization
  await runTest('Navigation: Switching between Plans, Billing History, and Quota pages syncs header, guest state, and Sidebar submenu', () => {
    const env = createQuotaTestEnv();
    const pricing = env.sandbox.window.PDFLinguaPricing;

    // Default openPricingView shows Plans page and activates sideNavPricingPlans
    pricing.openPricingView();
    assert.strictEqual(env.elements.pricingSection.style.display, 'block', 'Pricing section opens');
    assert.strictEqual(env.elements.pricingPlansContainer.style.display, 'block', 'Plans container visible on Plans page');
    assert.strictEqual(env.elements.billingHistoryContainer.style.display, 'none', 'Billing container hidden on Plans page');
    assert.strictEqual(env.elements.quotaDashboardContainer.style.display, 'none', 'Quota container hidden on Plans page');
    assert.strictEqual(env.elements.btnPricingBackToPlans.style.display, 'none', 'Back-to-plans button hidden while already on Plans page');
    assert.strictEqual(env.elements.sideNavPricingGroup.classList.contains('is-expanded'), true, 'Sidebar pricing group expands');
    assert.strictEqual(env.elements.sideNavPricingPlans.classList.contains('active'), true, 'Sidebar Plans sub-item active');
    assert.strictEqual(env.elements.sideNavPricingPlans.getAttribute('aria-current'), 'page', 'Sidebar Plans sub-item sets aria-current');
    assert.strictEqual(env.elements.pricingMainTitle.textContent, 'Bảng giá gói dịch vụ', 'Plans header title stays synchronized');

    // Open Billing History view
    pricing.openBillingHistoryView();
    assert.strictEqual(env.elements.pricingPlansContainer.style.display, 'none', 'Plans container hides on Billing page');
    assert.strictEqual(env.elements.billingHistoryContainer.style.display, 'block', 'Billing container visible on Billing page');
    assert.strictEqual(env.elements.quotaDashboardContainer.style.display, 'none', 'Quota container hidden on Billing page');
    assert.strictEqual(env.elements.btnPricingBackToPlans.style.display, 'inline-flex', 'Back-to-plans button shows on Billing page');
    assert.strictEqual(env.elements.sideNavPricingBilling.classList.contains('active'), true, 'Sidebar Billing sub-item active');
    assert.strictEqual(env.elements.sideNavPricingPlans.classList.contains('active'), false, 'Sidebar Plans sub-item deactivated');
    assert.strictEqual(env.elements.pricingMainTitle.textContent, 'Lịch sử thanh toán & Hóa đơn', 'Dynamic header title updates on Billing page');

    // Open Quota Dashboard view as Guest -> shows quotaGuestState and hides quotaDashboardCard
    pricing.openQuotaDashboardView();
    assert.strictEqual(env.elements.pricingPlansContainer.style.display, 'none', 'Plans container hides on Quota page');
    assert.strictEqual(env.elements.billingHistoryContainer.style.display, 'none', 'Billing container hides on Quota page');
    assert.strictEqual(env.elements.quotaDashboardContainer.style.display, 'block', 'Quota container visible on Quota page');
    assert.strictEqual(env.elements.btnPricingBackToPlans.style.display, 'inline-flex', 'Back-to-plans button shows on Quota page');
    assert.strictEqual(env.elements.sideNavPricingQuota.classList.contains('active'), true, 'Sidebar Quota sub-item active');
    assert.strictEqual(env.elements.sideNavPricingQuota.getAttribute('aria-current'), 'page', 'Sidebar Quota sub-item sets aria-current');
    assert.strictEqual(env.elements.pricingMainTitle.textContent, 'Quản lý gói & Hạn mức', 'Dynamic header title updates on Quota page');
    assert.strictEqual(env.elements.quotaGuestState.style.display, 'flex', 'Guest sees login prompt card on Quota page');
    assert.strictEqual(env.elements.quotaDashboardCard.style.display, 'none', 'Guest does not see authenticated quota card');

    // Clicking Guest View Plans button returns cleanly to Plans view
    env.elements.btnQuotaGuestViewPlans.click();
    assert.strictEqual(env.elements.pricingPlansContainer.style.display, 'block', 'btnQuotaGuestViewPlans returns to Plans view');
    assert.strictEqual(env.elements.quotaDashboardContainer.style.display, 'none', 'Quota container hides when returning to Plans');

    // Switching via switchPricingTab then clicking btnPricingBackToPlans returns to Plans view
    pricing.switchPricingTab('quota');
    assert.strictEqual(env.elements.quotaDashboardContainer.style.display, 'block', 'switchPricingTab switches to Quota view');
    env.elements.btnPricingBackToPlans.click();
    assert.strictEqual(env.elements.pricingPlansContainer.style.display, 'block', 'btnPricingBackToPlans returns to Plans view');
    assert.strictEqual(env.elements.sideNavPricingPlans.classList.contains('active'), true, 'Sidebar Plans sub-item re-activated');
  });

  // --------------------------------------------------------------------------
  // TEST 27: Bilingual i18n and Red Color Theme Compliance for Quota Dashboard
  // --------------------------------------------------------------------------
  await runTest('Bilingual i18n and Red Color Theme Compliance for Quota Dashboard', async () => {
    const fs = require('fs');
    const path = require('path');
    const i18nContent = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');

    const requiredQuotaKeys = [
      'pricing_nav_quota_dashboard',
      'pricing_quota_dashboard_title',
      'pricing_quota_dashboard_subtitle',
      'quota_guest_title',
      'quota_guest_desc',
      'quota_guest_btn_login',
      'quota_guest_btn_plans',
      'quota_warn_expiring_title',
      'quota_warn_expiring_desc',
      'quota_warn_expiring_cta',
      'quota_warn_expired_title',
      'quota_warn_expired_desc',
      'quota_badge_pro_vip',
      'quota_pill_remaining_days',
      'quota_pill_expired',
      'quota_pill_active',
      'quota_lbl_activated',
      'quota_lbl_expires',
      'quota_btn_renew',
      'quota_btn_upgrade_yearly',
      'quota_save_yearly_pill',
      'quota_badge_free_tier',
      'quota_free_plan_name',
      'quota_free_desc',
      'quota_btn_upgrade_free_cta',
      'quota_meter_ocr_title',
      'quota_meter_ocr_note',
      'quota_meter_ocr_cta',
      'quota_meter_filesize_title',
      'quota_meter_filesize_note',
      'quota_meter_copilot_title',
      'quota_meter_copilot_note',
      'quota_unit_pages',
      'quota_unit_per_file',
      'quota_unit_queries',
      'quota_threshold_near_limit',
      'quota_threshold_almost_out',
      'quota_threshold_reached',
    ];

    for (const k of requiredQuotaKeys) {
      assert.ok(i18nContent.includes(`"${k}"`), `i18n.js must define key ${k}`);
    }

    const pricingCss = fs.readFileSync(path.join(__dirname, '../css/pricing.css'), 'utf8');
    assert.strictEqual(
      (pricingCss.match(/#4F46E5/gi) || []).length,
      0,
      'pricing.css must have zero #4F46E5 purple/indigo tokens'
    );
    assert.strictEqual(
      (pricingCss.match(/#C7D2FE/gi) || []).length,
      0,
      'pricing.css must have zero #C7D2FE purple/indigo tokens'
    );
    assert.strictEqual(
      (pricingCss.match(/#EEF2FF/gi) || []).length,
      0,
      'pricing.css must have zero #EEF2FF purple/indigo tokens'
    );
    assert.ok(pricingCss.includes('#DC2626'), 'pricing.css must use brand red #DC2626');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedCount}/${passedCount + failedCount} tests passed (${failedCount} failed).`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests();
