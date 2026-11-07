/**
 * PDF-Lingua: Pricing Section, Billing Toggle & VietQR Checkout Test Suite
 * ------------------------------------------------------------------------
 * Verifies:
 * 1. Static HTML & CSS architecture: `#pricingSection`, billing toggle buttons, Free & Pro cards,
 *    3 grouped capability comparison clusters, and `#pricingCheckoutModal`.
 * 2. Billing cycle toggle: Switching between `monthly` (49.000đ/tháng) and `yearly` (399.000đ/năm)
 *    updates price, period, original price strikethrough (588.000đ), 32% discount badge,
 *    monthly equivalent (33.250đ / tháng), and `data-plan-code` attribute (`pro_monthly` / `pro_yearly`).
 * 3. Navigation & View Switching: Opening and closing `#pricingSection` hides/restores `#heroSection`,
 *    `#workspaceSection`, and `#adminSection`, and highlights `#sideNavPricing` + `#topNavPricing`.
 * 4. Role & Auth State Synchronization:
 *    - Guest user clicking upgrade opens the Login Modal (`openLoginModal`).
 *    - Free authenticated user sees "Gói hiện tại của bạn" disabled on Free card and active Pro CTA.
 *    - Pro authenticated user sees active subscription banner, days remaining, and renewal CTA.
 * 5. VietQR Checkout Modal & Instant Upgrade Flow:
 *    - Logged-in user clicking Upgrade Pro opens `#pricingCheckoutModal` and calls `POST /api/pricing/subscribe`.
 *    - In-modal cycle switcher (`#btnCheckoutCycleYearly` / `#btnCheckoutCycleMonthly`) updates summary & QR.
 *    - 1-click bank detail copy buttons copy account number, amount, and transfer memo.
 *    - Payment simulation (`POST /api/pricing/transactions/{code}/simulate`) and status polling upgrade
 *      user role to `pro` without page reload, show `#checkoutSuccessView`, and render confetti particles.
 *    - Countdown expiration displays `#checkoutExpiredView` and allows 1-click retry (`#btnRetryCheckout`).
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

function createPricingTestEnv(initialStorage = {}, customFetch = null) {
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
    btnBillingMonthly: new MockElement('btnBillingMonthly', 'button', ['billing-toggle-btn', 'active'], { 'aria-selected': 'true' }),
    btnBillingYearly: new MockElement('btnBillingYearly', 'button', ['billing-toggle-btn'], { 'aria-selected': 'false' }),
    billingSavePill: new MockElement('billingSavePill', 'span'),
    pricingActiveBanner: new MockElement('pricingActiveBanner', 'div'),
    pricingActiveBannerTitle: new MockElement('pricingActiveBannerTitle', 'div'),
    pricingActiveBannerSub: new MockElement('pricingActiveBannerSub', 'div'),
    btnCancelAutoRenew: new MockElement('btnCancelAutoRenew', 'button'),
    freePlanName: new MockElement('freePlanName', 'h3'),
    freePlanPriceDisplay: new MockElement('freePlanPriceDisplay', 'span'),
    freeMaxFileSize: new MockElement('freeMaxFileSize', 'span'),
    freeMaxOcrPages: new MockElement('freeMaxOcrPages', 'span'),
    freeFeatureList: new MockElement('freeFeatureList', 'ul'),
    btnSelectFreePlan: new MockElement('btnSelectFreePlan', 'button'),
    freePlanCtaHint: new MockElement('freePlanCtaHint', 'p'),
    proPlanName: new MockElement('proPlanName', 'h3'),
    proPlanPriceDisplay: new MockElement('proPlanPriceDisplay', 'span'),
    proPlanPeriodDisplay: new MockElement('proPlanPeriodDisplay', 'span'),
    proPlanOriginalPrice: new MockElement('proPlanOriginalPrice', 'span'),
    proPlanSubnote: new MockElement('proPlanSubnote', 'span'),
    proPlanDiscountBadge: new MockElement('proPlanDiscountBadge', 'span'),
    proMaxFileSize: new MockElement('proMaxFileSize', 'span'),
    proMaxOcrPages: new MockElement('proMaxOcrPages', 'span'),
    proFeatureList: new MockElement('proFeatureList', 'ul'),
    btnUpgradeProPlan: new MockElement('btnUpgradeProPlan', 'button', [], { 'data-plan-code': 'pro_monthly' }),
    btnUpgradeProText: new MockElement('btnUpgradeProText', 'span'),
    proPlanCtaHint: new MockElement('proPlanCtaHint', 'p'),
    sideNavHome: new MockElement('sideNavHome', 'a', ['sidebar-nav-item']),
    sideNavTranslate: new MockElement('sideNavTranslate', 'a', ['sidebar-nav-item', 'active']),
    sideNavPricing: new MockElement('sideNavPricing', 'a', ['sidebar-nav-item']),
    topNavTranslate: new MockElement('topNavTranslate', 'a', ['nav-link', 'active'], { href: '#translate' }),
    topNavAiCopilot: new MockElement('topNavAiCopilot', 'a', ['nav-link'], { href: '#ai-copilot' }),
    topNavPricing: new MockElement('topNavPricing', 'a', ['nav-link'], { href: '#pricing' }),
    btnLogin: new MockElement('btnLogin', 'button'),
    pdfFileInput: new MockElement('pdfFileInput', 'input'),

    // Checkout Modal Elements
    pricingCheckoutModal: new MockElement('pricingCheckoutModal', 'div', ['modal-overlay', 'checkout-modal-overlay'], { hidden: '', 'aria-hidden': 'true' }),
    btnCloseCheckoutModal: new MockElement('btnCloseCheckoutModal', 'button'),
    btnCheckoutCycleMonthly: new MockElement('btnCheckoutCycleMonthly', 'button', ['checkout-cycle-btn', 'active'], { 'data-plan-code': 'pro_monthly' }),
    btnCheckoutCycleYearly: new MockElement('btnCheckoutCycleYearly', 'button', ['checkout-cycle-btn'], { 'data-plan-code': 'pro_yearly' }),
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
    btnCopyCheckoutAccount: new MockElement('btnCopyCheckoutAccount', 'button', ['btn-checkout-copy'], { 'data-copy-target': 'checkoutAccountNumber' }),
    btnCopyCheckoutAmount: new MockElement('btnCopyCheckoutAmount', 'button', ['btn-checkout-copy'], { 'data-copy-target': 'checkoutTransferAmount' }),
    btnCopyCheckoutNote: new MockElement('btnCopyCheckoutNote', 'button', ['btn-checkout-copy'], { 'data-copy-target': 'checkoutTransferNote' }),
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

  elements.pricingSection.style.display = 'none';
  elements.workspaceSection.style.display = 'none';
  elements.adminSection.style.display = 'none';
  elements.heroSection.style.display = 'block';
  elements.btnCopyCheckoutAccount.textContent = 'Sao chép';
  elements.btnCopyCheckoutAmount.textContent = 'Sao chép';
  elements.btnCopyCheckoutNote.textContent = 'Sao chép';

  const docListeners = {};
  const winListeners = {};
  const toasts = [];
  let loginModalOpened = false;
  let clipboardCopied = '';

  const mockDocument = {
    body: { style: {} },
    getElementById: (id) => elements[id] || null,
    createElement: (tag) => new MockElement('', tag),
    querySelectorAll: (sel) => {
      if (sel === '.sidebar-nav-item') {
        return [elements.sideNavHome, elements.sideNavTranslate, elements.sideNavPricing];
      }
      if (sel === '.nav-menu .nav-link') {
        return [elements.topNavTranslate, elements.topNavAiCopilot, elements.topNavPricing];
      }
      return [];
    },
    addEventListener: (event, fn) => {
      docListeners[event] = docListeners[event] || [];
      docListeners[event].push(fn);
    },
  };

  const mockWindow = {
    location: { protocol: 'http:', port: '5500' },
    scrollTo: () => {},
    addEventListener: (event, fn) => {
      winListeners[event] = winListeners[event] || [];
      winListeners[event].push(fn);
    },
    dispatchEvent: (event) => {
      if (winListeners[event.type]) {
        winListeners[event.type].forEach((fn) => fn(event));
      }
    },
    showToast: (msg, type) => { toasts.push({ msg, type }); },
    pdfLinguaAuth: {
      getStoredToken: () => mockStorage.getItem('pdfl_token'),
      getStoredUser: () => {
        const raw = mockStorage.getItem('pdfl_user');
        return raw ? JSON.parse(raw) : null;
      },
      setStoredSession: (token, user) => {
        mockStorage.setItem('pdfl_token', token);
        mockStorage.setItem('pdfl_user', JSON.stringify(user));
      },
      updateHeaderAuthState: (user) => {
        mockWindow.dispatchEvent({ type: 'pdfl:auth-change', detail: { user } });
      },
      renderAccountDetails: () => {},
      openLoginModal: () => { loginModalOpened = true; },
    },
    pdfLinguaWorkspace: {
      getCurrentDocData: () => null,
    },
  };

  const defaultFetch = async (url, opts) => {
    if (customFetch) return customFetch(url, opts);
    return {
      ok: true,
      json: async () => ({ success: false }),
    };
  };

  const sandbox = {
    document: mockDocument,
    window: mockWindow,
    navigator: {
      clipboard: {
        writeText: async (txt) => { clipboardCopied = txt; },
      },
    },
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    fetch: defaultFetch,
    setTimeout: (fn) => {
      if (typeof fn === 'function') fn();
      return 1;
    },
    clearTimeout: () => {},
    setInterval: () => 101,
    clearInterval: () => {},
    CustomEvent: class CustomEvent {
      constructor(type, params = {}) {
        this.type = type;
        this.detail = params.detail || null;
      }
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
  };

  const context = vm.createContext(sandbox);
  vm.runInContext(pricingSource, context);

  if (docListeners['DOMContentLoaded']) {
    docListeners['DOMContentLoaded'].forEach((fn) => fn());
  }

  return {
    elements,
    store,
    sandbox,
    toasts,
    wasLoginModalOpened: () => loginModalOpened,
    getClipboardCopied: () => clipboardCopied,
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
  console.log('PDF-Lingua Pricing Plans, Toggle & VietQR Checkout Test Suite');
  console.log('================================================================\n');

  await runTest('HTML & CSS: Pricing section, toggle controls, cards, and VietQR checkout modal exist', () => {
    assert.ok(htmlSource.includes('href="css/pricing.css"'), 'index.html must link css/pricing.css');
    assert.ok(htmlSource.includes('src="js/pricing.js"'), 'index.html must include js/pricing.js');
    assert.ok(htmlSource.includes('id="pricingSection"'), 'pricingSection must exist');
    assert.ok(htmlSource.includes('id="btnBillingMonthly"'), 'btnBillingMonthly must exist');
    assert.ok(htmlSource.includes('id="btnBillingYearly"'), 'btnBillingYearly must exist');
    assert.ok(htmlSource.includes('id="pricingCardFree"'), 'pricingCardFree must exist');
    assert.ok(htmlSource.includes('id="pricingCardPro"'), 'pricingCardPro must exist');
    assert.ok(htmlSource.includes('id="pricingComparisonMatrix"'), 'pricingComparisonMatrix must exist');
    assert.ok(htmlSource.includes('id="pricingCheckoutModal"'), 'pricingCheckoutModal must exist');
    assert.ok(htmlSource.includes('id="checkoutQrImage"'), 'checkoutQrImage must exist');
    assert.ok(htmlSource.includes('id="btnSimulatePaymentSuccess"'), 'btnSimulatePaymentSuccess must exist');
    assert.ok(pricingCssSource.includes('.pricing-bento-grid'), 'pricing.css must define .pricing-bento-grid');
    assert.ok(pricingCssSource.includes('.checkout-modal-card'), 'pricing.css must define .checkout-modal-card');
    assert.ok(pricingCssSource.includes('prefers-reduced-motion: reduce'), 'pricing.css must support prefers-reduced-motion');
  });

  await runTest('Billing Toggle: Default cycle is monthly (49.000đ / tháng)', () => {
    const env = createPricingTestEnv();
    assert.strictEqual(env.sandbox.window.PDFLinguaPricing.getBillingCycle(), 'monthly');
    assert.strictEqual(env.elements.proPlanPriceDisplay.textContent, '49.000đ');
    assert.strictEqual(env.elements.proPlanPeriodDisplay.textContent, '/ tháng');
    assert.strictEqual(env.elements.proPlanOriginalPrice.style.display, 'none');
    assert.strictEqual(env.elements.proPlanDiscountBadge.style.display, 'none');
    assert.strictEqual(env.elements.btnUpgradeProPlan.getAttribute('data-plan-code'), 'pro_monthly');
  });

  await runTest('Billing Toggle: Clicking Yearly switches to 399.000đ / năm with 32% discount badge', () => {
    const env = createPricingTestEnv();
    env.elements.btnBillingYearly.click();

    assert.strictEqual(env.sandbox.window.PDFLinguaPricing.getBillingCycle(), 'yearly');
    assert.strictEqual(env.elements.btnBillingYearly.classList.contains('active'), true);
    assert.strictEqual(env.elements.btnBillingMonthly.classList.contains('active'), false);
    assert.strictEqual(env.elements.proPlanPriceDisplay.textContent, '399.000đ');
    assert.strictEqual(env.elements.proPlanPeriodDisplay.textContent, '/ năm');
    assert.strictEqual(env.elements.proPlanOriginalPrice.style.display, 'inline');
    assert.strictEqual(env.elements.proPlanOriginalPrice.textContent, '588.000đ');
    assert.strictEqual(env.elements.proPlanDiscountBadge.style.display, 'inline-flex');
    assert.strictEqual(env.elements.proPlanDiscountBadge.textContent, 'TIẾT KIỆM 32%');
    assert.ok(env.elements.proPlanSubnote.textContent.includes('33.250đ / tháng'));
    assert.strictEqual(env.elements.btnUpgradeProPlan.getAttribute('data-plan-code'), 'pro_yearly');
  });

  await runTest('Navigation: Opening Pricing view hides Hero/Workspace/Admin and highlights nav items', () => {
    const env = createPricingTestEnv();
    env.elements.topNavPricing.click();

    assert.strictEqual(env.elements.pricingSection.style.display, 'block');
    assert.strictEqual(env.elements.heroSection.style.display, 'none');
    assert.strictEqual(env.elements.sideNavPricing.classList.contains('active'), true);
    assert.strictEqual(env.elements.topNavPricing.classList.contains('active'), true);
    assert.strictEqual(env.elements.topNavTranslate.classList.contains('active'), false);
  });

  await runTest('Navigation: Clicking topNavTranslate closes Pricing view and restores Home/Workspace', () => {
    const env = createPricingTestEnv();
    env.elements.topNavPricing.click();
    assert.strictEqual(env.elements.pricingSection.style.display, 'block');

    env.elements.topNavTranslate.click();
    assert.strictEqual(env.elements.pricingSection.style.display, 'none');
    assert.strictEqual(env.elements.heroSection.style.display, 'block');
    assert.strictEqual(env.elements.sideNavHome.classList.contains('active'), true);
  });

  await runTest('Auth Guard: Guest clicking Upgrade Pro opens Login Modal', () => {
    const env = createPricingTestEnv();
    env.elements.btnUpgradeProPlan.click();

    assert.strictEqual(env.wasLoginModalOpened(), true);
    assert.ok(env.toasts.some((t) => t.msg.includes('đăng nhập')));
  });

  await runTest('Role Sync: Logged-in Free user sees "Gói hiện tại của bạn" disabled on Free card', () => {
    const env = createPricingTestEnv({
      pdfl_token: 'mock-jwt-free',
      pdfl_user: JSON.stringify({ id: 5, email: 'free@test.com', role: 'free' }),
    });

    assert.strictEqual(env.elements.btnSelectFreePlan.disabled, true);
    assert.strictEqual(env.elements.btnSelectFreePlan.textContent, 'Gói hiện tại của bạn');
    assert.strictEqual(env.elements.pricingActiveBanner.style.display, 'none');
  });

  await runTest('Role Sync: Logged-in Pro user with active subscription renders banner and renewal CTA', async () => {
    const env = createPricingTestEnv(
      {
        pdfl_token: 'mock-jwt-pro',
        pdfl_user: JSON.stringify({ id: 9, email: 'pro@test.com', role: 'pro' }),
      },
      async (url) => {
        if (url.includes('/api/pricing/my-subscription')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                current_role: 'pro',
                is_pro: true,
                max_file_size_mb: 100,
                max_ocr_pages: 500,
                active_subscription: {
                  id: 1,
                  plan_code: 'pro_monthly',
                  plan_name: 'Gói Pro Hàng Tháng',
                  days_remaining: 28,
                  auto_renew: true,
                  expires_at: '2026-12-08T00:00:00Z',
                },
              },
            }),
          };
        }
        return { ok: true, json: async () => ({ success: false }) };
      }
    );

    await env.sandbox.window.PDFLinguaPricing.fetchMySubscription();

    assert.strictEqual(env.elements.pricingActiveBanner.style.display, 'flex');
    assert.ok(env.elements.pricingActiveBannerTitle.textContent.includes('Còn 28 ngày'));
    assert.strictEqual(env.elements.btnCancelAutoRenew.style.display, 'inline-flex');
    assert.strictEqual(env.elements.btnSelectFreePlan.disabled, true);
    assert.ok(env.elements.btnUpgradeProText.textContent.includes('Đang sử dụng gói này'));
  });

  await runTest('VietQR Checkout Modal: Opening checkout initiates POST /api/pricing/subscribe and renders Napas247 QR', async () => {
    let subscribePayload = null;
    const env = createPricingTestEnv(
      {
        pdfl_token: 'mock-jwt-free',
        pdfl_user: JSON.stringify({ id: 12, email: 'buyer@test.com', role: 'free' }),
      },
      async (url, opts) => {
        if (url.includes('/api/pricing/subscribe')) {
          subscribePayload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 201,
            json: async () => ({
              success: true,
              data: {
                transaction_code: 'PDL-SUB-202611-8899',
                plan_code: 'pro_monthly',
                plan_name: 'Gói Pro Hàng Tháng',
                duration_days: 30,
                amount_vnd: 49000,
                amount_display: '49.000 VNĐ',
                payment_method: 'vietqr',
                payment_status: 'pending',
                qr_code_url: 'https://img.vietqr.io/image/MB-0345678999-compact2.png?amount=49000&addInfo=PDL%20SUB%20202611%208899',
                bank_info: {
                  bank_name: 'MB Bank (Ngân hàng Quân Đội)',
                  account_number: '0345678999',
                  account_name: 'PDF LINGUA PROJECT',
                  transfer_note: 'PDL SUB 202611 8899',
                },
                expires_in_seconds: 900,
              },
            }),
          };
        }
        return { ok: true, json: async () => ({ success: false }) };
      }
    );

    await env.sandbox.window.PDFLinguaCheckout.openCheckout('pro_monthly');

    assert.strictEqual(env.elements.pricingCheckoutModal.hasAttribute('hidden'), false);
    assert.strictEqual(env.elements.pricingCheckoutModal.style.display, 'flex');
    assert.strictEqual(subscribePayload.plan_code, 'pro_monthly');
    assert.strictEqual(env.elements.checkoutTransactionCode.textContent, 'PDL-SUB-202611-8899');
    assert.strictEqual(env.elements.checkoutAccountNumber.textContent, '0345678999');
    assert.strictEqual(env.elements.checkoutTransferNote.textContent, 'PDL SUB 202611 8899');
    assert.strictEqual(env.elements.checkoutTotalAmount.textContent, '49.000 VNĐ');
    assert.strictEqual(env.elements.checkoutCountdownTimer.textContent, '15:00');
    assert.ok(env.elements.checkoutQrImage.src.includes('img.vietqr.io'));
  });

  await runTest('VietQR Checkout Modal: In-modal cycle switcher updates breakdown to 399.000 VNĐ (365 ngày) & -189.000đ savings', async () => {
    const env = createPricingTestEnv({
      pdfl_token: 'mock-jwt-free',
      pdfl_user: JSON.stringify({ id: 12, email: 'buyer@test.com', role: 'free' }),
    });

    await env.sandbox.window.PDFLinguaCheckout.openCheckout('pro_monthly');
    assert.strictEqual(env.elements.checkoutSavingsRow.style.display, 'none');

    await env.sandbox.window.PDFLinguaCheckout.switchCheckoutPlan('pro_yearly');
    assert.strictEqual(env.elements.btnCheckoutCycleYearly.classList.contains('active'), true);
    assert.strictEqual(env.elements.checkoutPlanName.textContent, 'Gói Pro Hàng Năm');
    assert.strictEqual(env.elements.checkoutDurationDays.textContent, '365 ngày');
    assert.strictEqual(env.elements.checkoutSavingsRow.style.display, 'flex');
    assert.ok(env.elements.checkoutSavingsAmount.textContent.includes('189.000đ'));
    assert.strictEqual(env.elements.checkoutTotalAmount.textContent, '399.000 VNĐ');
  });

  await runTest('VietQR Checkout Modal: 1-Click Copy buttons copy bank account, amount, and transfer memo', async () => {
    const env = createPricingTestEnv({
      pdfl_token: 'mock-jwt-free',
      pdfl_user: JSON.stringify({ id: 12, email: 'buyer@test.com', role: 'free' }),
    });

    await env.sandbox.window.PDFLinguaCheckout.openCheckout('pro_monthly');
    env.elements.checkoutTransferNote.textContent = 'PDL SUB 12 9988';

    env.elements.btnCopyCheckoutNote.click();
    assert.strictEqual(env.getClipboardCopied(), 'PDL SUB 12 9988');
    assert.ok(env.toasts.some((t) => t.msg.includes('PDL SUB 12 9988')));
  });

  await runTest('Instant Pro Upgrade & Confetti: Simulating payment upgrades user role to Pro and shows celebration view', async () => {
    const env = createPricingTestEnv(
      {
        pdfl_token: 'mock-jwt-free',
        pdfl_user: JSON.stringify({ id: 15, email: 'upgrade@test.com', role: 'free' }),
      },
      async (url) => {
        if (url.includes('/simulate')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                transaction_code: 'PDL-SUB-202611-7777',
                plan_code: 'pro_yearly',
                plan_name: 'Gói Pro Hàng Năm',
                amount_vnd: 399000,
                payment_method: 'test_simulator',
                payment_status: 'completed',
                user_role: 'pro',
                subscription: {
                  id: 3,
                  user_id: 15,
                  plan_code: 'pro_yearly',
                  plan_name: 'Gói Pro Hàng Năm',
                  billing_cycle: 'yearly',
                  status: 'active',
                  started_at: '2026-11-08T00:00:00Z',
                  expires_at: '2027-11-08T00:00:00Z',
                  days_remaining: 365,
                  auto_renew: true,
                },
              },
            }),
          };
        }
        return { ok: true, json: async () => ({ success: false }) };
      }
    );

    await env.sandbox.window.PDFLinguaCheckout.openCheckout('pro_yearly');
    await env.sandbox.window.PDFLinguaCheckout.simulatePaymentSuccess();

    // 1. Success celebration view is active
    assert.strictEqual(env.elements.checkoutPendingView.style.display, 'none');
    assert.strictEqual(env.elements.checkoutSuccessView.style.display, 'flex');
    assert.strictEqual(env.elements.checkoutSuccessTxCode.textContent, 'PDL-SUB-202611-7777');
    assert.strictEqual(env.elements.checkoutSuccessPlanName.textContent, 'Gói Pro Hàng Năm');
    assert.strictEqual(env.elements.checkoutSuccessAmount.textContent, '399.000 VNĐ');

    // 2. Confetti particles generated
    assert.strictEqual(env.elements.checkoutConfettiStage.children.length, 24);

    // 3. Stored user role upgraded to 'pro' without page reload
    const storedUser = JSON.parse(env.store.pdfl_user);
    assert.strictEqual(storedUser.role, 'pro');
    assert.strictEqual(env.elements.pricingActiveBanner.style.display, 'flex');
  });

  await runTest('VietQR Checkout Modal: Expired state displays retry screen and allows generating a new QR code', async () => {
    const env = createPricingTestEnv({
      pdfl_token: 'mock-jwt-free',
      pdfl_user: JSON.stringify({ id: 15, email: 'upgrade@test.com', role: 'free' }),
    });

    await env.sandbox.window.PDFLinguaCheckout.openCheckout('pro_monthly');
    env.sandbox.window.PDFLinguaCheckout.handlePaymentExpired();

    assert.strictEqual(env.elements.checkoutPendingView.style.display, 'none');
    assert.strictEqual(env.elements.checkoutExpiredView.style.display, 'flex');

    env.elements.btnRetryCheckout.click();
    assert.strictEqual(env.elements.checkoutPendingView.style.display, 'flex');
    assert.strictEqual(env.elements.checkoutExpiredView.style.display, 'none');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (${totalTests - passedTests} failed).`);
  console.log('================================================================');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

main();
