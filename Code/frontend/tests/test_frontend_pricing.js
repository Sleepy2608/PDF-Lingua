/**
 * PDF-Lingua: Pricing Section & Billing Cycle Toggle Test Suite
 * -------------------------------------------------------------
 * Verifies:
 * 1. Static HTML & CSS architecture: `#pricingSection`, billing toggle buttons, Free & Pro cards,
 *    and 3 grouped capability comparison clusters.
 * 2. Billing cycle toggle: Switching between `monthly` (49.000đ/tháng) and `yearly` (399.000đ/năm)
 *    updates price, period, original price strikethrough (588.000đ), 32% discount badge,
 *    monthly equivalent (33.250đ / tháng), and `data-plan-code` attribute (`pro_monthly` / `pro_yearly`).
 * 3. Navigation & View Switching: Opening and closing `#pricingSection` hides/restores `#heroSection`,
 *    `#workspaceSection`, and `#adminSection`, and highlights `#sideNavPricing` + `#topNavPricing`.
 * 4. Role & Auth State Synchronization:
 *    - Guest user clicking upgrade opens the Login Modal (`openLoginModal`).
 *    - Free authenticated user sees "Gói hiện tại của bạn" disabled on Free card and active Pro CTA.
 *    - Pro authenticated user sees active subscription banner, days remaining, and renewal CTA.
 * 5. Live API catalog & subscription fetching (`/api/pricing/plans`, `/api/pricing/my-subscription`, `/api/pricing/cancel`).
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
  }
  set innerHTML(val) {
    this._innerHTML = String(val);
  }
  get innerHTML() {
    return this._innerHTML;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  addEventListener(event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }
  click() {
    if (this.disabled) return;
    if (this.listeners['click']) {
      this.listeners['click'].forEach((fn) => fn({ preventDefault: () => {}, stopPropagation: () => {} }));
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
  };

  elements.pricingSection.style.display = 'none';
  elements.workspaceSection.style.display = 'none';
  elements.adminSection.style.display = 'none';
  elements.heroSection.style.display = 'block';

  const docListeners = {};
  const winListeners = {};
  const toasts = [];
  let loginModalOpened = false;

  const mockDocument = {
    getElementById: (id) => elements[id] || null,
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
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    fetch: defaultFetch,
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
    dispatchAuthChange: (user) => {
      if (user) {
        mockStorage.setItem('pdfl_user', JSON.stringify(user));
      } else {
        mockStorage.removeItem('pdfl_user');
        mockStorage.removeItem('pdfl_token');
      }
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
  console.log('PDF-Lingua Pricing Plans & Billing Toggle Test Suite');
  console.log('================================================================\n');

  await runTest('HTML & CSS: Pricing section, toggle controls, cards, and comparison clusters exist', () => {
    assert.ok(htmlSource.includes('href="css/pricing.css"'), 'index.html must link css/pricing.css');
    assert.ok(htmlSource.includes('src="js/pricing.js"'), 'index.html must include js/pricing.js');
    assert.ok(htmlSource.includes('id="pricingSection"'), 'pricingSection must exist');
    assert.ok(htmlSource.includes('id="btnBillingMonthly"'), 'btnBillingMonthly must exist');
    assert.ok(htmlSource.includes('id="btnBillingYearly"'), 'btnBillingYearly must exist');
    assert.ok(htmlSource.includes('id="pricingCardFree"'), 'pricingCardFree must exist');
    assert.ok(htmlSource.includes('id="pricingCardPro"'), 'pricingCardPro must exist');
    assert.ok(htmlSource.includes('id="pricingComparisonMatrix"'), 'pricingComparisonMatrix must exist');
    assert.ok(pricingCssSource.includes('.pricing-bento-grid'), 'pricing.css must define .pricing-bento-grid');
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

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (${totalTests - passedTests} failed).`);
  console.log('================================================================');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

main();

