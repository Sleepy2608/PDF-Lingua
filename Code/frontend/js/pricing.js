/**
 * PDF-Lingua: Pricing Plans & Billing Cycle Controller
 * ----------------------------------------------------
 * Manages:
 * - Fetching live pricing catalog (`GET /api/pricing/plans`) with graceful offline fallback
 * - Fetching current user's subscription state (`GET /api/pricing/my-subscription`)
 * - Segmented billing cycle toggle (`monthly`: 49.000đ/tháng vs `yearly`: 399.000đ/năm - Tiết kiệm 32%)
 * - Dynamic CTA state synchronization for Guest, Free, Pro, and Admin accounts
 * - View switching between `#pricingSection`, `#heroSection`, `#workspaceSection`, and `#adminSection`
 */

(function () {
  'use strict';

  const API_BASE_URL =
    typeof window !== 'undefined' &&
    window.location &&
    (window.location.protocol === 'file:' ||
      (window.location.port && window.location.port !== '8000'))
      ? 'http://127.0.0.1:8000'
      : '';

  const DEFAULT_CATALOG = {
    free_tier: {
      code: 'free',
      name: 'Gói Miễn Phí',
      price_vnd: 0,
      billing_cycle: 'forever',
      max_file_size_mb: 20,
      max_ocr_pages: 100,
      features: [
        'Tải lên tệp PDF tối đa 20 MB',
        'Nhận diện OCR tối đa 100 trang',
        'Dịch thuật song ngữ thông minh tiêu chuẩn',
        'Lưu trữ 5 tài liệu gần đây',
        'Hỗ trợ xuất tệp TXT và PDF Song ngữ',
      ],
    },
    pro_tier: {
      monthly: {
        code: 'pro_monthly',
        name: 'Gói Pro Hàng Tháng',
        price_vnd: 49000,
        original_price_vnd: 49000,
        discount_percent: 0,
        billing_cycle: 'monthly',
        duration_days: 30,
        price_display: '49.000đ',
        period_display: '/ tháng',
        monthly_equivalent: null,
        badge: null,
      },
      yearly: {
        code: 'pro_yearly',
        name: 'Gói Pro Hàng Năm',
        price_vnd: 399000,
        original_price_vnd: 588000,
        discount_percent: 32,
        billing_cycle: 'yearly',
        duration_days: 365,
        price_display: '399.000đ',
        period_display: '/ năm',
        monthly_equivalent: '33.250đ / tháng',
        badge: 'TIẾT KIỆM 32%',
      },
      shared_features: [
        'Tải lên tệp PDF siêu lớn đến 100 MB',
        'Nhận dạng OCR chuyên sâu đến 500 trang',
        'Trợ lý AI Hỏi đáp (AI Copilot) 15 câu / ngày',
        'Tóm tắt thông minh AI Summary & bảng thuật ngữ',
        'Hàng đợi ưu tiên tốc độ cao (Fast-track Worker)',
        'Kho lưu trữ tài liệu cá nhân không giới hạn',
        'Huy hiệu VIP trên hồ sơ và giao diện',
        'Hỗ trợ xuất tài liệu sang Microsoft Word (.docx)',
      ],
    },
  };

  let currentCycle = 'monthly';
  let catalogData = JSON.parse(JSON.stringify(DEFAULT_CATALOG));
  let mySubscriptionData = null;

  // Checkout Modal & Real-time Polling State
  let currentTransaction = null;
  let checkoutPollingTimer = null;
  let checkoutCountdownInterval = null;
  let remainingSeconds = 900;
  let isSimulatingPayment = false;

  document.addEventListener('DOMContentLoaded', () => {
    initPricingModule();
    initCheckoutModal();
    initMultiTouchpointsAndQuotaModal();
    initBillingHistory();
    initInvoiceModal();
  });

  function getStoredToken() {
    if (
      typeof window !== 'undefined' &&
      window.pdfLinguaAuth &&
      typeof window.pdfLinguaAuth.getStoredToken === 'function'
    ) {
      return window.pdfLinguaAuth.getStoredToken();
    }
    try {
      return (
        localStorage.getItem('pdfl_token') ||
        sessionStorage.getItem('pdfl_token')
      );
    } catch (_err) {
      return null;
    }
  }

  function getStoredUser() {
    if (
      typeof window !== 'undefined' &&
      window.pdfLinguaAuth &&
      typeof window.pdfLinguaAuth.getStoredUser === 'function'
    ) {
      return window.pdfLinguaAuth.getStoredUser();
    }
    try {
      const raw =
        localStorage.getItem('pdfl_user') ||
        sessionStorage.getItem('pdfl_user');
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatVnd(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) return '0đ';
    return `${amount.toLocaleString('vi-VN').replace(/,/g, '.')}đ`;
  }

  function notifyUser(message, type = 'info') {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(message, type);
    }
  }

  function initPricingModule() {
    const btnMonthly = document.getElementById('btnBillingMonthly');
    const btnYearly = document.getElementById('btnBillingYearly');
    const btnSelectFree = document.getElementById('btnSelectFreePlan');
    const btnUpgradePro = document.getElementById('btnUpgradeProPlan');
    const btnCancelAutoRenew = document.getElementById('btnCancelAutoRenew');
    const topNavPricing = document.getElementById('topNavPricing');
    const topNavTranslate = document.getElementById('topNavTranslate');

    if (btnMonthly) {
      btnMonthly.addEventListener('click', (e) => {
        e.preventDefault();
        setBillingCycle('monthly');
      });
    }

    if (btnYearly) {
      btnYearly.addEventListener('click', (e) => {
        e.preventDefault();
        setBillingCycle('yearly');
      });
    }

    if (btnSelectFree) {
      btnSelectFree.addEventListener('click', (e) => {
        e.preventDefault();
        handleFreePlanAction();
      });
    }

    if (btnUpgradePro) {
      btnUpgradePro.addEventListener('click', (e) => {
        e.preventDefault();
        handleUpgradeProAction();
      });
    }

    if (btnCancelAutoRenew) {
      btnCancelAutoRenew.addEventListener('click', (e) => {
        e.preventDefault();
        handleCancelSubscription();
      });
    }

    const btnPricingBackToWorkspace = document.getElementById('btnPricingBackToWorkspace');

    if (btnPricingBackToWorkspace) {
      btnPricingBackToWorkspace.addEventListener('click', (e) => {
        e.preventDefault();
        closePricingView();
      });
    }

    if (topNavPricing) {
      topNavPricing.addEventListener('click', (e) => {
        e.preventDefault();
        openPricingView();
      });
    }

    if (topNavTranslate) {
      topNavTranslate.addEventListener('click', (e) => {
        e.preventDefault();
        returnToMainWorkspace();
      });
    }

    // Listen to auth changes to refresh subscription & CTA state
    if (typeof window !== 'undefined') {
      window.addEventListener('pdfl:auth-change', (e) => {
        const user = e && e.detail ? e.detail.user : null;
        if (!user) {
          mySubscriptionData = null;
          renderUserSubscriptionState(null, null);
        } else {
          fetchMySubscription();
        }
      });
    }

    // Initial render & background fetch
    renderPricingCatalog();
    renderUserSubscriptionState(getStoredUser(), mySubscriptionData);
    fetchPricingCatalog();
    if (getStoredToken()) {
      fetchMySubscription();
    }
  }

  /**
   * Switch between 'monthly' (49.000đ) and 'yearly' (399.000đ - 32% discount)
   */
  function setBillingCycle(cycle) {
    currentCycle = cycle === 'yearly' ? 'yearly' : 'monthly';

    const btnMonthly = document.getElementById('btnBillingMonthly');
    const btnYearly = document.getElementById('btnBillingYearly');

    if (btnMonthly) {
      const isMonthly = currentCycle === 'monthly';
      btnMonthly.classList.toggle('active', isMonthly);
      btnMonthly.setAttribute('aria-selected', isMonthly ? 'true' : 'false');
    }

    if (btnYearly) {
      const isYearly = currentCycle === 'yearly';
      btnYearly.classList.toggle('active', isYearly);
      btnYearly.setAttribute('aria-selected', isYearly ? 'true' : 'false');
    }

    renderProCardForCycle();
    renderUserSubscriptionState(getStoredUser(), mySubscriptionData);
  }

  function renderProCardForCycle() {
    const proTier = (catalogData && catalogData.pro_tier) || DEFAULT_CATALOG.pro_tier;
    const activePlan =
      currentCycle === 'yearly' ? proTier.yearly : proTier.monthly;

    const proPlanName = document.getElementById('proPlanName');
    const proPlanPriceDisplay = document.getElementById('proPlanPriceDisplay');
    const proPlanPeriodDisplay = document.getElementById('proPlanPeriodDisplay');
    const proPlanOriginalPrice = document.getElementById('proPlanOriginalPrice');
    const proPlanSubnote = document.getElementById('proPlanSubnote');
    const proPlanDiscountBadge = document.getElementById('proPlanDiscountBadge');
    const btnUpgradePro = document.getElementById('btnUpgradeProPlan');

    if (proPlanName) {
      proPlanName.textContent = activePlan.name || (currentCycle === 'yearly' ? 'Gói Pro Hàng Năm' : 'Gói Pro Hàng Tháng');
    }

    if (proPlanPriceDisplay) {
      proPlanPriceDisplay.textContent =
        activePlan.price_display || formatVnd(activePlan.price_vnd);
    }

    if (proPlanPeriodDisplay) {
      proPlanPeriodDisplay.textContent =
        activePlan.period_display || (currentCycle === 'yearly' ? '/ năm' : '/ tháng');
    }

    if (proPlanOriginalPrice) {
      if (
        currentCycle === 'yearly' &&
        activePlan.original_price_vnd &&
        activePlan.original_price_vnd > activePlan.price_vnd
      ) {
        proPlanOriginalPrice.textContent = formatVnd(activePlan.original_price_vnd);
        proPlanOriginalPrice.style.display = 'inline';
      } else {
        proPlanOriginalPrice.style.display = 'none';
      }
    }

    if (proPlanSubnote) {
      if (currentCycle === 'yearly') {
        const eq = activePlan.monthly_equivalent || '33.250đ / tháng';
        proPlanSubnote.textContent = `Tương đương ${eq} (Hiệu lực 365 ngày)`;
      } else {
        proPlanSubnote.textContent = 'Thanh toán linh hoạt từng tháng (30 ngày)';
      }
    }

    if (proPlanDiscountBadge) {
      if (currentCycle === 'yearly' && (activePlan.discount_percent > 0 || activePlan.badge)) {
        proPlanDiscountBadge.textContent =
          activePlan.badge || `TIẾT KIỆM ${activePlan.discount_percent}%`;
        proPlanDiscountBadge.style.display = 'inline-flex';
      } else {
        proPlanDiscountBadge.style.display = 'none';
      }
    }

    if (btnUpgradePro) {
      btnUpgradePro.setAttribute('data-plan-code', activePlan.code || (currentCycle === 'yearly' ? 'pro_yearly' : 'pro_monthly'));
    }
  }

  function renderFeatureItems(listEl, features) {
    if (!listEl || !Array.isArray(features) || features.length === 0) return;
    listEl.innerHTML = features
      .map(
        (feat) => `
        <li class="pricing-feature-item">
          <span class="pricing-feature-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
          <span>${escapeHtml(feat)}</span>
        </li>
      `
      )
      .join('');
  }

  function renderPricingCatalog() {
    const freeTier =
      (catalogData && catalogData.free_tier) || DEFAULT_CATALOG.free_tier;
    const proTier =
      (catalogData && catalogData.pro_tier) || DEFAULT_CATALOG.pro_tier;

    const freeMaxFileSize = document.getElementById('freeMaxFileSize');
    const freeMaxOcrPages = document.getElementById('freeMaxOcrPages');
    const freeFeatureList = document.getElementById('freeFeatureList');
    const proFeatureList = document.getElementById('proFeatureList');
    const billingSavePill = document.getElementById('billingSavePill');

    if (freeMaxFileSize && freeTier.max_file_size_mb) {
      freeMaxFileSize.textContent = `${freeTier.max_file_size_mb} MB / tệp`;
    }
    if (freeMaxOcrPages && freeTier.max_ocr_pages) {
      freeMaxOcrPages.textContent = `${freeTier.max_ocr_pages} trang`;
    }
    if (freeFeatureList && Array.isArray(freeTier.features)) {
      renderFeatureItems(freeFeatureList, freeTier.features);
    }
    if (proFeatureList && Array.isArray(proTier.shared_features)) {
      renderFeatureItems(proFeatureList, proTier.shared_features);
    }
    if (billingSavePill && proTier.yearly && proTier.yearly.badge) {
      billingSavePill.textContent = proTier.yearly.badge;
    }

    renderProCardForCycle();
  }

  function renderUserSubscriptionState(user, subData) {
    const btnSelectFree = document.getElementById('btnSelectFreePlan');
    const freePlanCtaHint = document.getElementById('freePlanCtaHint');
    const btnUpgradePro = document.getElementById('btnUpgradeProPlan');
    const btnUpgradeProText = document.getElementById('btnUpgradeProText');
    const proPlanCtaHint = document.getElementById('proPlanCtaHint');
    const activeBanner = document.getElementById('pricingActiveBanner');
    const activeBannerTitle = document.getElementById('pricingActiveBannerTitle');
    const activeBannerSub = document.getElementById('pricingActiveBannerSub');
    const btnCancelAutoRenew = document.getElementById('btnCancelAutoRenew');
    const btnAccountUpgradePro = document.getElementById('btnAccountUpgradePro');
    const dropzoneLimitText = document.getElementById('dropzoneLimitText');

    const effectiveRole =
      (subData && subData.current_role) ||
      (user && user.role ? String(user.role).toLowerCase() : null);
    const activeSub = subData ? subData.active_subscription : null;

    if (!user && !effectiveRole) {
      // Guest state
      if (activeBanner) activeBanner.style.display = 'none';
      if (btnAccountUpgradePro) btnAccountUpgradePro.style.display = 'none';
      if (dropzoneLimitText && dropzoneLimitText.classList) {
        dropzoneLimitText.classList.add('dropzone-upgrade-clickable');
      }
      if (btnSelectFree) {
        btnSelectFree.disabled = false;
        btnSelectFree.textContent = 'Bắt đầu miễn phí';
      }
      if (freePlanCtaHint) {
        freePlanCtaHint.textContent = 'Sẵn sàng sử dụng ngay khi tải tệp PDF';
      }
      if (btnUpgradePro) {
        btnUpgradePro.disabled = false;
      }
      if (btnUpgradeProText) {
        btnUpgradeProText.textContent =
          currentCycle === 'yearly'
            ? 'Nâng cấp gói Năm (399.000đ)'
            : 'Nâng cấp lên Pro ngay';
      }
      if (proPlanCtaHint) {
        proPlanCtaHint.textContent =
          'Đăng nhập để kích hoạt qua mã VietQR ngân hàng 24/7';
      }
      return;
    }

    if (effectiveRole === 'pro' || effectiveRole === 'admin') {
      if (btnAccountUpgradePro) btnAccountUpgradePro.style.display = 'none';
      if (dropzoneLimitText && dropzoneLimitText.classList) {
        dropzoneLimitText.classList.remove('dropzone-upgrade-clickable');
      }
      if (activeBanner) {
        activeBanner.style.display = 'flex';
      }

      if (effectiveRole === 'admin') {
        if (activeBannerTitle) {
          activeBannerTitle.textContent =
            'Tài khoản Quản trị viên: Đã mở khóa toàn bộ đặc quyền Pro';
        }
        if (activeBannerSub) {
          activeBannerSub.textContent =
            'Hạn mức tối đa: 100 MB mỗi tệp và 500 trang OCR chuyên sâu.';
        }
        if (btnCancelAutoRenew) {
          btnCancelAutoRenew.style.display = 'none';
        }
      } else if (activeSub) {
        const expDateStr = formatShortDate(activeSub.expires_at);
        if (activeBannerTitle) {
          activeBannerTitle.textContent = `Đang sử dụng: ${activeSub.plan_name || 'Gói Pro'} (Còn ${activeSub.days_remaining} ngày)`;
        }
        if (activeBannerSub) {
          activeBannerSub.textContent = activeSub.auto_renew
            ? `Hiệu lực đến ngày ${expDateStr}. Tự động gia hạn đang bật.`
            : `Hiệu lực đến ngày ${expDateStr}. Đã tắt gia hạn tự động.`;
        }
        if (btnCancelAutoRenew) {
          btnCancelAutoRenew.style.display = activeSub.auto_renew
            ? 'inline-flex'
            : 'none';
        }
      } else {
        if (activeBannerTitle) {
          activeBannerTitle.textContent =
            'Tài khoản của bạn đang kích hoạt đặc quyền Gói Pro';
        }
        if (activeBannerSub) {
          activeBannerSub.textContent =
            'Hạn mức: 100 MB mỗi tệp và 500 trang OCR chuyên sâu.';
        }
        if (btnCancelAutoRenew) {
          btnCancelAutoRenew.style.display = 'none';
        }
      }

      if (btnSelectFree) {
        btnSelectFree.disabled = true;
        btnSelectFree.textContent = 'Đã bao gồm trong gói Pro';
      }
      if (freePlanCtaHint) {
        freePlanCtaHint.textContent =
          'Bạn đang sở hữu hạn mức cao hơn gói Miễn phí';
      }

      const selectedCode =
        currentCycle === 'yearly' ? 'pro_yearly' : 'pro_monthly';
      if (activeSub && activeSub.plan_code === selectedCode) {
        if (btnUpgradePro) btnUpgradePro.disabled = false;
        if (btnUpgradeProText) {
          btnUpgradeProText.textContent = 'Đang sử dụng gói này (Gia hạn thêm)';
        }
      } else {
        if (btnUpgradePro) btnUpgradePro.disabled = false;
        if (btnUpgradeProText) {
          btnUpgradeProText.textContent =
            currentCycle === 'yearly'
              ? 'Gia hạn thêm gói Năm (399.000đ)'
              : 'Gia hạn thêm gói Tháng (49.000đ)';
        }
      }
      if (proPlanCtaHint) {
        proPlanCtaHint.textContent =
          'Số ngày gia hạn mới sẽ được cộng dồn vào thời hạn hiện tại';
      }
    } else {
      // Authenticated Free user
      if (activeBanner) activeBanner.style.display = 'none';
      if (btnAccountUpgradePro) {
        btnAccountUpgradePro.style.display = 'inline-flex';
      }
      if (dropzoneLimitText && dropzoneLimitText.classList) {
        dropzoneLimitText.classList.add('dropzone-upgrade-clickable');
      }
      if (btnSelectFree) {
        btnSelectFree.disabled = true;
        btnSelectFree.textContent = 'Gói hiện tại của bạn';
      }
      if (freePlanCtaHint) {
        freePlanCtaHint.textContent =
          'Bạn đang sử dụng gói Miễn phí (20 MB / 100 trang)';
      }
      if (btnUpgradePro) {
        btnUpgradePro.disabled = false;
      }
      if (btnUpgradeProText) {
        btnUpgradeProText.textContent =
          currentCycle === 'yearly'
            ? 'Nâng cấp gói Năm (399.000đ)'
            : 'Nâng cấp lên Pro ngay';
      }
      if (proPlanCtaHint) {
        proPlanCtaHint.textContent =
          'Kích hoạt tức thì qua mã VietQR ngân hàng 24/7';
      }
    }
  }

  function formatShortDate(isoStr) {
    if (!isoStr) return '--/--/----';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (_e) {
      return isoStr;
    }
  }

  async function fetchPricingCatalog() {
    if (typeof fetch !== 'function') return catalogData;
    try {
      const res = await fetch(`${API_BASE_URL}/api/pricing/plans`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res || !res.ok) return catalogData;
      const body = await res.json();
      if (body && body.success && body.data) {
        catalogData = body.data;
        renderPricingCatalog();
      }
    } catch (_err) {
      // Keep default catalog when offline
    }
    return catalogData;
  }

  async function fetchMySubscription() {
    const token = getStoredToken();
    if (!token || typeof fetch !== 'function') return null;

    try {
      const res = await fetch(`${API_BASE_URL}/api/pricing/my-subscription`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res || !res.ok) return null;
      const body = await res.json();
      if (body && body.success && body.data) {
        mySubscriptionData = body.data;
        renderUserSubscriptionState(getStoredUser(), mySubscriptionData);
        return mySubscriptionData;
      }
    } catch (_err) {
      // Ignore network errors silently
    }
    return null;
  }

  function handleFreePlanAction() {
    const user = getStoredUser();
    if (!user) {
      // Return to upload dropzone on home section so guest can start immediately
      closePricingView();
      const pdfFileInput = document.getElementById('pdfFileInput');
      if (pdfFileInput && typeof pdfFileInput.click === 'function') {
        pdfFileInput.click();
      }
    }
  }

  function handleUpgradeProAction() {
    const user = getStoredUser();
    const token = getStoredToken();
    const planCode = currentCycle === 'yearly' ? 'pro_yearly' : 'pro_monthly';

    if (!user || !token) {
      notifyUser(
        'Vui lòng đăng nhập hoặc đăng ký tài khoản để nâng cấp gói Pro!',
        'info'
      );
      if (
        typeof window !== 'undefined' &&
        window.pdfLinguaAuth &&
        typeof window.pdfLinguaAuth.openLoginModal === 'function'
      ) {
        window.pdfLinguaAuth.openLoginModal();
      } else {
        const btnLogin = document.getElementById('btnLogin');
        if (btnLogin && typeof btnLogin.click === 'function') {
          btnLogin.click();
        }
      }
      return;
    }

    // Dispatch custom event for checkout listeners
    if (
      typeof window !== 'undefined' &&
      typeof window.dispatchEvent === 'function' &&
      typeof CustomEvent === 'function'
    ) {
      window.dispatchEvent(
        new CustomEvent('pdfl:open-checkout', {
          detail: { planCode, billingCycle: currentCycle },
        })
      );
    }

    openCheckoutModal(planCode);
  }

  // ---------------------------------------------------------------------------
  // VietQR Checkout Modal, Polling, Countdown & Confetti Celebration Controller
  // ---------------------------------------------------------------------------

  function initCheckoutModal() {
    const modal = document.getElementById('pricingCheckoutModal');
    const btnClose = document.getElementById('btnCloseCheckoutModal');
    const btnCycleMonthly = document.getElementById('btnCheckoutCycleMonthly');
    const btnCycleYearly = document.getElementById('btnCheckoutCycleYearly');
    const btnCheckNow = document.getElementById('btnCheckTransactionNow');
    const btnSimulate = document.getElementById('btnSimulatePaymentSuccess');
    const btnDone = document.getElementById('btnCheckoutDone');
    const btnRetry = document.getElementById('btnRetryCheckout');
    const qrImg = document.getElementById('checkoutQrImage');

    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        closeCheckoutModal();
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeCheckoutModal();
        }
      });
    }

    if (btnCycleMonthly) {
      btnCycleMonthly.addEventListener('click', (e) => {
        e.preventDefault();
        switchCheckoutPlan('pro_monthly');
      });
    }

    if (btnCycleYearly) {
      btnCycleYearly.addEventListener('click', (e) => {
        e.preventDefault();
        switchCheckoutPlan('pro_yearly');
      });
    }

    if (btnCheckNow) {
      btnCheckNow.addEventListener('click', (e) => {
        e.preventDefault();
        handleManualStatusCheck();
      });
    }

    if (btnSimulate) {
      btnSimulate.addEventListener('click', (e) => {
        e.preventDefault();
        simulatePaymentSuccess();
      });
    }

    if (btnDone) {
      btnDone.addEventListener('click', (e) => {
        e.preventDefault();
        closeCheckoutModal();
        closePricingView();
      });
    }

    if (btnRetry) {
      btnRetry.addEventListener('click', (e) => {
        e.preventDefault();
        const code = currentCycle === 'yearly' ? 'pro_yearly' : 'pro_monthly';
        openCheckoutModal(code);
      });
    }

    if (qrImg) {
      qrImg.addEventListener('error', () => {
        qrImg.style.display = 'none';
        const fallback = document.getElementById('checkoutQrFallback');
        if (fallback) fallback.style.display = 'flex';
      });
      qrImg.addEventListener('load', () => {
        qrImg.style.display = 'block';
        const fallback = document.getElementById('checkoutQrFallback');
        if (fallback) fallback.style.display = 'none';
      });
    }

    // 1-Click Copy buttons for bank details
    const copyButtons = [
      document.getElementById('btnCopyCheckoutAccount'),
      document.getElementById('btnCopyCheckoutAmount'),
      document.getElementById('btnCopyCheckoutNote'),
    ];
    copyButtons.forEach((btn) => {
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-copy-target');
        const targetEl = targetId ? document.getElementById(targetId) : null;
        const rawVal = targetEl ? (targetEl.textContent || '').trim() : '';
        copyBankDetailValue(rawVal, btn);
      });
    });
  }

  function copyBankDetailValue(text, btnEl) {
    if (!text) return;
    const cleanText = text.replace(/\s*đ$/i, '').replace(/\./g, (m) => {
      // If copying amount like "49.000đ", strip dots for bank paste convenience if numeric
      return /^\d+(\.\d{3})+$/.test(text.replace(/\s*đ$/i, '')) ? '' : m;
    });

    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        navigator.clipboard.writeText(cleanText).catch(() => {});
      }
    } catch (_e) {}

    if (btnEl) {
      const prevText = btnEl.textContent || 'Sao chép';
      btnEl.textContent = 'Đã chép';
      btnEl.classList.add('copied');
      setTimeout(() => {
        btnEl.textContent = prevText === 'Đã chép' ? 'Sao chép' : prevText;
        btnEl.classList.remove('copied');
      }, 1600);
    }

    notifyUser(`Đã sao chép: ${cleanText}`, 'success');
  }

  function computeEstimatedExpiryDate(durationDays) {
    const days = Number(durationDays) || 30;
    let baseTime = Date.now();
    if (
      mySubscriptionData &&
      mySubscriptionData.active_subscription &&
      mySubscriptionData.active_subscription.expires_at
    ) {
      const existingExp = new Date(
        mySubscriptionData.active_subscription.expires_at
      ).getTime();
      if (!isNaN(existingExp) && existingExp > baseTime) {
        baseTime = existingExp;
      }
    }
    const targetDate = new Date(baseTime + days * 24 * 60 * 60 * 1000);
    return formatShortDate(targetDate.toISOString());
  }

  function setCheckoutViewState(state) {
    const pendingView = document.getElementById('checkoutPendingView');
    const successView = document.getElementById('checkoutSuccessView');
    const expiredView = document.getElementById('checkoutExpiredView');

    if (pendingView) {
      pendingView.style.display = state === 'pending' ? 'flex' : 'none';
    }
    if (successView) {
      successView.style.display = state === 'success' ? 'flex' : 'none';
    }
    if (expiredView) {
      expiredView.style.display = state === 'expired' ? 'flex' : 'none';
    }
  }

  function renderCheckoutOrderSummary(planCode) {
    const isYearly = planCode === 'pro_yearly';
    const proTier =
      (catalogData && catalogData.pro_tier) || DEFAULT_CATALOG.pro_tier;
    const planObj = isYearly ? proTier.yearly : proTier.monthly;

    const btnCycleMonthly = document.getElementById('btnCheckoutCycleMonthly');
    const btnCycleYearly = document.getElementById('btnCheckoutCycleYearly');
    const planNameEl = document.getElementById('checkoutPlanName');
    const durationEl = document.getElementById('checkoutDurationDays');
    const expiryPreviewEl = document.getElementById('checkoutExpiryPreview');
    const savingsRowEl = document.getElementById('checkoutSavingsRow');
    const savingsAmountEl = document.getElementById('checkoutSavingsAmount');
    const totalAmountEl = document.getElementById('checkoutTotalAmount');

    if (btnCycleMonthly) {
      btnCycleMonthly.classList.toggle('active', !isYearly);
    }
    if (btnCycleYearly) {
      btnCycleYearly.classList.toggle('active', isYearly);
    }

    const durationDays = planObj.duration_days || (isYearly ? 365 : 30);
    const amountVnd = planObj.price_vnd || (isYearly ? 399000 : 49000);

    if (planNameEl) {
      planNameEl.textContent =
        planObj.name || (isYearly ? 'Gói Pro Hàng Năm' : 'Gói Pro Hàng Tháng');
    }
    if (durationEl) {
      durationEl.textContent = `${durationDays} ngày`;
    }
    if (expiryPreviewEl) {
      expiryPreviewEl.textContent = computeEstimatedExpiryDate(durationDays);
    }
    if (savingsRowEl) {
      if (isYearly) {
        const savedVnd =
          (planObj.original_price_vnd || 588000) - amountVnd;
        const pct = planObj.discount_percent || 32;
        if (savingsAmountEl) {
          savingsAmountEl.textContent = `-${formatVnd(savedVnd)} (Tiết kiệm ${pct}%)`;
        }
        savingsRowEl.style.display = 'flex';
      } else {
        savingsRowEl.style.display = 'none';
      }
    }
    if (totalAmountEl) {
      totalAmountEl.textContent = `${amountVnd.toLocaleString('vi-VN').replace(/,/g, '.')} VNĐ`;
    }
  }

  const DEFAULT_VIETQR_PRO_IMAGE = 'assets/images/vietqr-pro.png';
  const DEFAULT_BANK_INFO = {
    bank_name: 'VietinBank (CN Thủ Thiêm - Hội Sở)',
    account_number: '0779562608',
    account_name: 'NGUYEN LE HUY TAM',
  };

  function buildFallbackCheckoutData(planCode) {
    const isYearly = planCode === 'pro_yearly';
    const amountVnd = isYearly ? 399000 : 49000;
    const durationDays = isYearly ? 365 : 30;
    const txCode = `PDL-SUB-${String(Date.now()).slice(-6)}`;
    const transferNote = txCode.replace(/-/g, ' ');

    return {
      transaction_code: txCode,
      plan_code: isYearly ? 'pro_yearly' : 'pro_monthly',
      plan_name: isYearly ? 'Gói Pro Hàng Năm' : 'Gói Pro Hàng Tháng',
      duration_days: durationDays,
      amount_vnd: amountVnd,
      amount_display: `${amountVnd.toLocaleString('vi-VN').replace(/,/g, '.')} VNĐ`,
      payment_method: 'vietqr',
      payment_status: 'pending',
      qr_code_url: DEFAULT_VIETQR_PRO_IMAGE,
      bank_info: {
        bank_name: DEFAULT_BANK_INFO.bank_name,
        account_number: DEFAULT_BANK_INFO.account_number,
        account_name: DEFAULT_BANK_INFO.account_name,
        transfer_note: transferNote,
      },
      expires_in_seconds: 900,
    };
  }

  function renderTransactionDetails(txData) {
    if (!txData) return;
    currentTransaction = txData;

    const qrImg = document.getElementById('checkoutQrImage');
    const qrFallback = document.getElementById('checkoutQrFallback');
    const bankNameEl = document.getElementById('checkoutBankName');
    const accountNameEl = document.getElementById('checkoutAccountName');
    const accountNumEl = document.getElementById('checkoutAccountNumber');
    const transferAmountEl = document.getElementById('checkoutTransferAmount');
    const transferNoteEl = document.getElementById('checkoutTransferNote');
    const txCodeEl = document.getElementById('checkoutTransactionCode');
    const pollingTextEl = document.getElementById('checkoutPollingStatusText');

    const bank = txData.bank_info || {};
    if (bankNameEl) {
      bankNameEl.textContent = bank.bank_name || DEFAULT_BANK_INFO.bank_name;
    }
    if (accountNameEl) {
      accountNameEl.textContent = bank.account_name || DEFAULT_BANK_INFO.account_name;
    }
    if (accountNumEl) {
      accountNumEl.textContent = bank.account_number || DEFAULT_BANK_INFO.account_number;
    }
    if (transferAmountEl) {
      transferAmountEl.textContent = formatVnd(txData.amount_vnd || 49000);
    }
    if (transferNoteEl) {
      transferNoteEl.textContent =
        bank.transfer_note || txData.transaction_code || 'PDL SUB';
    }
    if (txCodeEl) {
      txCodeEl.textContent = txData.transaction_code || '---';
    }
    if (pollingTextEl) {
      pollingTextEl.textContent = 'Đang chờ thanh toán từ ngân hàng...';
    }

    if (qrImg) {
      const qrSource =
        txData.qr_code_url && !txData.qr_code_url.includes('img.vietqr.io')
          ? txData.qr_code_url
          : DEFAULT_VIETQR_PRO_IMAGE;
      qrImg.src = qrSource;
      qrImg.style.display = 'block';
      if (qrFallback) qrFallback.style.display = 'none';
    }

    const laser = document.getElementById('checkoutQrLaser');
    if (laser && laser.style) {
      laser.style.animation = 'none';
      if (typeof laser.offsetHeight !== 'undefined') {
        void laser.offsetHeight;
      }
      laser.style.animation = '';
    }
  }

  function formatCountdownSeconds(secs) {
    const safeSecs = Math.max(0, Math.floor(Number(secs) || 0));
    const mins = String(Math.floor(safeSecs / 60)).padStart(2, '0');
    const rem = String(safeSecs % 60).padStart(2, '0');
    return `${mins}:${rem}`;
  }

  function stopCheckoutTimers() {
    if (checkoutPollingTimer) {
      clearInterval(checkoutPollingTimer);
      checkoutPollingTimer = null;
    }
    if (checkoutCountdownInterval) {
      clearInterval(checkoutCountdownInterval);
      checkoutCountdownInterval = null;
    }
  }

  function startCountdownTimer(initialSeconds = 900) {
    if (checkoutCountdownInterval) {
      clearInterval(checkoutCountdownInterval);
      checkoutCountdownInterval = null;
    }

    remainingSeconds = Number(initialSeconds) > 0 ? Number(initialSeconds) : 900;
    const timerEl = document.getElementById('checkoutCountdownTimer');
    if (timerEl) {
      timerEl.textContent = formatCountdownSeconds(remainingSeconds);
    }

    if (typeof setInterval === 'function') {
      checkoutCountdownInterval = setInterval(() => {
        remainingSeconds = Math.max(0, remainingSeconds - 1);
        if (timerEl) {
          timerEl.textContent = formatCountdownSeconds(remainingSeconds);
        }
        if (remainingSeconds <= 0) {
          handlePaymentExpired();
        }
      }, 1000);
    }
  }

  function startTransactionPolling(transactionCode) {
    if (checkoutPollingTimer) {
      clearInterval(checkoutPollingTimer);
      checkoutPollingTimer = null;
    }
    if (!transactionCode || typeof setInterval !== 'function') return;

    checkoutPollingTimer = setInterval(() => {
      pollTransactionStatus(transactionCode, false);
    }, 3500);
  }

  async function openCheckoutModal(planCodeInput) {
    const normalizedCode =
      planCodeInput === 'pro_yearly' ||
      (!planCodeInput && currentCycle === 'yearly')
        ? 'pro_yearly'
        : 'pro_monthly';

    setBillingCycle(normalizedCode === 'pro_yearly' ? 'yearly' : 'monthly');

    const modal = document.getElementById('pricingCheckoutModal');
    if (modal) {
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      modal.style.display = 'flex';
    }
    if (document && document.body && document.body.style) {
      document.body.style.overflow = 'hidden';
    }

    stopCheckoutTimers();
    setCheckoutViewState('pending');
    renderCheckoutOrderSummary(normalizedCode);

    // Render immediate preview while requesting backend VietQR payload
    const fallbackData = buildFallbackCheckoutData(normalizedCode);
    renderTransactionDetails(fallbackData);
    startCountdownTimer(fallbackData.expires_in_seconds);

    await initiateSubscriptionTransaction(normalizedCode);
  }

  function closeCheckoutModal() {
    stopCheckoutTimers();
    const modal = document.getElementById('pricingCheckoutModal');
    if (modal) {
      modal.setAttribute('hidden', '');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.display = 'none';
    }
    if (document && document.body && document.body.style) {
      document.body.style.overflow = '';
    }
  }

  async function switchCheckoutPlan(newPlanCode) {
    const targetCode =
      newPlanCode === 'pro_yearly' ? 'pro_yearly' : 'pro_monthly';
    setBillingCycle(targetCode === 'pro_yearly' ? 'yearly' : 'monthly');
    stopCheckoutTimers();
    setCheckoutViewState('pending');
    renderCheckoutOrderSummary(targetCode);

    const fallbackData = buildFallbackCheckoutData(targetCode);
    renderTransactionDetails(fallbackData);
    startCountdownTimer(fallbackData.expires_in_seconds);

    await initiateSubscriptionTransaction(targetCode);
  }

  async function initiateSubscriptionTransaction(planCode) {
    const token = getStoredToken();
    if (!token || typeof fetch !== 'function') {
      return currentTransaction;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/pricing/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          plan_code: planCode,
          payment_method: 'vietqr',
        }),
      });

      if (res && res.ok) {
        const body = await res.json();
        if (body && body.success && body.data) {
          renderTransactionDetails(body.data);
          startCountdownTimer(body.data.expires_in_seconds || 900);
          startTransactionPolling(body.data.transaction_code);
          return body.data;
        }
      }
    } catch (_err) {
      // Offline / local preview fallback already rendered
    }
    return currentTransaction;
  }

  async function pollTransactionStatus(transactionCode, isManualCheck = false) {
    const code =
      transactionCode ||
      (currentTransaction && currentTransaction.transaction_code);
    const token = getStoredToken();
    if (!code || !token || typeof fetch !== 'function') return null;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/pricing/transactions/${encodeURIComponent(
          code
        )}/status`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (!res || !res.ok) return null;
      const body = await res.json();
      if (body && body.success && body.data) {
        const tx = body.data;
        if (tx.payment_status === 'completed') {
          handlePaymentCompleted(tx);
        } else if (tx.payment_status === 'expired') {
          handlePaymentExpired();
        } else if (isManualCheck) {
          notifyUser(
            'Giao dịch đang chờ ngân hàng xác nhận. Bạn có thể bấm "Giả lập thanh toán thành công" để kiểm thử ngay.',
            'info'
          );
        }
        return tx;
      }
    } catch (_err) {
      if (isManualCheck) {
        notifyUser(
          'Không thể kiểm tra trạng thái từ máy chủ lúc này.',
          'error'
        );
      }
    }
    return null;
  }

  async function handleManualStatusCheck() {
    if (!currentTransaction) return;
    await pollTransactionStatus(currentTransaction.transaction_code, true);
  }

  async function simulatePaymentSuccess() {
    if (isSimulatingPayment || !currentTransaction) return;
    isSimulatingPayment = true;

    const btnSimulate = document.getElementById('btnSimulatePaymentSuccess');
    const btnSimulateText = document.getElementById('btnSimulatePaymentText');
    if (btnSimulate) btnSimulate.disabled = true;
    if (btnSimulateText) btnSimulateText.textContent = 'Đang xác nhận...';

    const code = currentTransaction.transaction_code;
    const token = getStoredToken();

    try {
      if (token && typeof fetch === 'function') {
        const res = await fetch(
          `${API_BASE_URL}/api/pricing/transactions/${encodeURIComponent(
            code
          )}/simulate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          }
        );

        if (res && res.ok) {
          const body = await res.json();
          if (body && body.success && body.data) {
            handlePaymentCompleted(body.data);
            return body.data;
          }
        }
      }

      // Fallback simulation when running standalone / offline test
      const isYearly = currentTransaction.plan_code === 'pro_yearly';
      const durationDays = isYearly ? 365 : 30;
      const nowIso = new Date().toISOString();
      const expIso = new Date(
        Date.now() + durationDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const simulatedPayload = {
        transaction_code: code,
        plan_code: currentTransaction.plan_code,
        plan_name: currentTransaction.plan_name,
        amount_vnd: currentTransaction.amount_vnd,
        payment_method: 'test_simulator',
        payment_status: 'completed',
        paid_at: nowIso,
        user_role: 'pro',
        subscription: {
          id: 1,
          user_id: (getStoredUser() && getStoredUser().id) || 1,
          plan_code: currentTransaction.plan_code,
          plan_name: currentTransaction.plan_name,
          billing_cycle: isYearly ? 'yearly' : 'monthly',
          status: 'active',
          started_at: nowIso,
          expires_at: expIso,
          days_remaining: durationDays,
          auto_renew: true,
        },
      };

      handlePaymentCompleted(simulatedPayload);
      return simulatedPayload;
    } finally {
      isSimulatingPayment = false;
      if (btnSimulate) btnSimulate.disabled = false;
      if (btnSimulateText) {
        btnSimulateText.textContent = 'Giả lập thanh toán thành công';
      }
    }
  }

  function handlePaymentExpired() {
    stopCheckoutTimers();
    if (currentTransaction) {
      currentTransaction.payment_status = 'expired';
    }
    setCheckoutViewState('expired');
  }

  function handlePaymentCompleted(txData) {
    stopCheckoutTimers();
    if (currentTransaction) {
      currentTransaction.payment_status = 'completed';
    }

    const updatedRole = (txData && txData.user_role) || 'pro';
    const subInfo = txData ? txData.subscription : null;

    // 1. Update stored user session & broadcast role upgrade across Header, Sidebar, Account & Upload
    const currentUser = getStoredUser() || {};
    const token = getStoredToken();
    const upgradedUser = Object.assign({}, currentUser, {
      role: currentUser.role === 'admin' ? 'admin' : updatedRole,
    });

    if (
      typeof window !== 'undefined' &&
      window.pdfLinguaAuth &&
      typeof window.pdfLinguaAuth.setStoredSession === 'function' &&
      token
    ) {
      window.pdfLinguaAuth.setStoredSession(token, upgradedUser);
    } else {
      try {
        localStorage.setItem('pdfl_user', JSON.stringify(upgradedUser));
      } catch (_e) {}
    }

    if (
      typeof window !== 'undefined' &&
      window.pdfLinguaAuth &&
      typeof window.pdfLinguaAuth.updateHeaderAuthState === 'function'
    ) {
      window.pdfLinguaAuth.updateHeaderAuthState(upgradedUser);
    } else if (
      typeof window !== 'undefined' &&
      typeof window.dispatchEvent === 'function' &&
      typeof CustomEvent === 'function'
    ) {
      window.dispatchEvent(
        new CustomEvent('pdfl:auth-change', { detail: { user: upgradedUser } })
      );
    }

    if (
      typeof window !== 'undefined' &&
      window.pdfLinguaAuth &&
      typeof window.pdfLinguaAuth.renderAccountDetails === 'function'
    ) {
      window.pdfLinguaAuth.renderAccountDetails(upgradedUser);
    }

    // 2. Update subscription banner & CTA states on Pricing page
    mySubscriptionData = {
      current_role: upgradedUser.role,
      is_pro: true,
      max_file_size_mb: 100,
      max_ocr_pages: 500,
      active_subscription: subInfo || null,
    };
    renderUserSubscriptionState(upgradedUser, mySubscriptionData);

    // 3. Populate celebration receipt view
    const receiptCodeEl = document.getElementById('checkoutSuccessTxCode');
    const receiptPlanEl = document.getElementById('checkoutSuccessPlanName');
    const receiptAmountEl = document.getElementById('checkoutSuccessAmount');
    const receiptExpEl = document.getElementById('checkoutSuccessExpiresAt');

    const amountVnd =
      (txData && txData.amount_vnd) ||
      (currentTransaction && currentTransaction.amount_vnd) ||
      49000;

    if (receiptCodeEl) {
      receiptCodeEl.textContent =
        (txData && txData.transaction_code) ||
        (currentTransaction && currentTransaction.transaction_code) ||
        '---';
    }
    if (receiptPlanEl) {
      receiptPlanEl.textContent =
        (txData && txData.plan_name) ||
        (subInfo && subInfo.plan_name) ||
        (currentTransaction && currentTransaction.plan_name) ||
        'Gói Pro VIP';
    }
    if (receiptAmountEl) {
      receiptAmountEl.textContent = `${Number(amountVnd)
        .toLocaleString('vi-VN')
        .replace(/,/g, '.')} VNĐ`;
    }
    if (receiptExpEl) {
      const expStr =
        subInfo && subInfo.expires_at
          ? formatShortDate(subInfo.expires_at)
          : computeEstimatedExpiryDate(
              txData && txData.plan_code === 'pro_yearly' ? 365 : 30
            );
      receiptExpEl.textContent = expStr;
    }

    setCheckoutViewState('success');
    triggerCheckoutConfetti();
    notifyUser(
      'Chúc mừng! Tài khoản của bạn đã nâng cấp lên Gói Pro VIP thành công.',
      'success'
    );
  }

  function triggerCheckoutConfetti() {
    const stage = document.getElementById('checkoutConfettiStage');
    if (!stage || typeof document.createElement !== 'function') return;

    stage.innerHTML = '';
    const palette = ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'];
    const pieceCount = 24;

    for (let i = 0; i < pieceCount; i++) {
      const piece = document.createElement('span');
      piece.className = 'checkout-confetti-piece';
      const leftPct = Math.round(((i * 37) % 92) + 4);
      const delayMs = (i % 6) * 65;
      const color = palette[i % palette.length];
      piece.style.left = `${leftPct}%`;
      piece.style.backgroundColor = color;
      piece.style.animationDelay = `${delayMs}ms`;
      stage.appendChild(piece);
    }
  }

  async function handleCancelSubscription() {
    const token = getStoredToken();
    if (!token || typeof fetch !== 'function') return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/pricing/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const body = await res.json();
      if (res.ok && body && body.success) {
        notifyUser(
          body.message || 'Đã hủy gia hạn tự động gói dịch vụ Pro thành công.',
          'success'
        );
        await fetchMySubscription();
      } else {
        notifyUser(
          (body && body.message) || 'Không thể hủy gia hạn tự động lúc này.',
          'error'
        );
      }
    } catch (_err) {
      notifyUser('Lỗi kết nối khi gửi yêu cầu hủy gia hạn.', 'error');
    }
  }

  function syncHeaderAndSidebarNav(activeKey) {
    const sideNavPricing = document.getElementById('sideNavPricing');
    const sideNavHome = document.getElementById('sideNavHome');
    const sideNavTranslate = document.getElementById('sideNavTranslate');
    const allSideItems = document.querySelectorAll('.sidebar-nav-item');

    if (allSideItems && allSideItems.length > 0) {
      allSideItems.forEach((item) => item.classList.remove('active'));
    }

    if (activeKey === 'pricing' && sideNavPricing) {
      sideNavPricing.classList.add('active');
    } else if (activeKey === 'translate' && sideNavTranslate) {
      sideNavTranslate.classList.add('active');
    } else if (sideNavHome) {
      sideNavHome.classList.add('active');
    }

    const topLinks = document.querySelectorAll('.nav-menu .nav-link');
    if (topLinks && topLinks.length > 0) {
      topLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (activeKey === 'pricing') {
          link.classList.toggle('active', href === '#pricing');
        } else {
          link.classList.toggle('active', href === '#translate');
        }
      });
    }
  }

  function openPricingView(initialCycle) {
    if (initialCycle === 'monthly' || initialCycle === 'yearly') {
      setBillingCycle(initialCycle);
    }

    const heroSection = document.getElementById('heroSection');
    const workspaceSection = document.getElementById('workspaceSection');
    const documentsSection = document.getElementById('documentsSection');
    const historySection = document.getElementById('historySection');
    const adminSection = document.getElementById('adminSection');
    const pricingSection = document.getElementById('pricingSection');

    if (heroSection) heroSection.style.display = 'none';
    if (workspaceSection) workspaceSection.style.display = 'none';
    if (documentsSection) documentsSection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';
    if (pricingSection) {
      pricingSection.style.display = 'block';
    }

    syncHeaderAndSidebarNav('pricing');

    if (getStoredToken()) {
      fetchMySubscription();
    }

    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function closePricingView() {
    const pricingSection = document.getElementById('pricingSection');
    if (pricingSection) {
      pricingSection.style.display = 'none';
    }
    returnToMainWorkspace();
  }

  function returnToMainWorkspace() {
    const pricingSection = document.getElementById('pricingSection');
    const adminSection = document.getElementById('adminSection');
    const documentsSection = document.getElementById('documentsSection');
    const historySection = document.getElementById('historySection');
    const workspaceSection = document.getElementById('workspaceSection');
    const heroSection = document.getElementById('heroSection');

    if (pricingSection) pricingSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';
    if (documentsSection) documentsSection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';

    const hasLoadedDoc =
      typeof window !== 'undefined' &&
      window.pdfLinguaWorkspace &&
      typeof window.pdfLinguaWorkspace.getCurrentDocData === 'function' &&
      window.pdfLinguaWorkspace.getCurrentDocData() !== null;

    if (hasLoadedDoc && workspaceSection) {
      workspaceSection.style.display = 'block';
      if (heroSection) heroSection.style.display = 'none';
      syncHeaderAndSidebarNav('translate');
    } else {
      if (workspaceSection) workspaceSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
      syncHeaderAndSidebarNav('home');
    }

    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ---------------------------------------------------------------------------
  // Multi-Touchpoint Triggers & Quota Exceeded Upsell Modal
  // ---------------------------------------------------------------------------

  function initMultiTouchpointsAndQuotaModal() {
    const dropzoneLimitText = document.getElementById('dropzoneLimitText');
    const btnAccountUpgradePro = document.getElementById('btnAccountUpgradePro');
    const quotaModal = document.getElementById('quotaExceededModal');
    const btnCloseQuota = document.getElementById('btnCloseQuotaModal');
    const btnQuotaDismiss = document.getElementById('btnQuotaModalDismiss');
    const btnQuotaViewPricing = document.getElementById('btnQuotaModalViewPricing');
    const btnQuotaUpgradeNow = document.getElementById('btnQuotaModalUpgradeNow');

    // Touchpoint 3: Dropzone banner click opens Pricing view for Guest/Free users
    if (dropzoneLimitText) {
      dropzoneLimitText.addEventListener('click', (e) => {
        const user = getStoredUser();
        const role =
          (mySubscriptionData && mySubscriptionData.current_role) ||
          (user && user.role ? String(user.role).toLowerCase() : 'guest');
        if (role === 'pro' || role === 'admin') return;
        if (e && typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }
        if (e && typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
        openPricingView();
      });
    }

    // Touchpoint 4: Account modal upgrade button next to role badge
    if (btnAccountUpgradePro) {
      btnAccountUpgradePro.addEventListener('click', (e) => {
        e.preventDefault();
        if (
          typeof window !== 'undefined' &&
          window.pdfLinguaAuth &&
          typeof window.pdfLinguaAuth.closeAccountModal === 'function'
        ) {
          window.pdfLinguaAuth.closeAccountModal();
        } else {
          const accountModal = document.getElementById('accountModal');
          if (accountModal) accountModal.setAttribute('hidden', '');
        }
        openPricingView();
      });
    }

    // Touchpoint 5: Quota Exceeded Upsell Modal controls
    if (btnCloseQuota) {
      btnCloseQuota.addEventListener('click', (e) => {
        e.preventDefault();
        closeQuotaExceededModal();
      });
    }

    if (btnQuotaDismiss) {
      btnQuotaDismiss.addEventListener('click', (e) => {
        e.preventDefault();
        closeQuotaExceededModal();
      });
    }

    if (quotaModal) {
      quotaModal.addEventListener('click', (e) => {
        if (e.target === quotaModal) {
          closeQuotaExceededModal();
        }
      });
    }

    if (btnQuotaViewPricing) {
      btnQuotaViewPricing.addEventListener('click', (e) => {
        e.preventDefault();
        closeQuotaExceededModal();
        openPricingView('monthly');
      });
    }

    if (btnQuotaUpgradeNow) {
      btnQuotaUpgradeNow.addEventListener('click', (e) => {
        e.preventDefault();
        closeQuotaExceededModal();
        openPricingView('monthly');
        handleUpgradeProAction();
      });
    }
  }

  function openQuotaExceededModal(reasonMessage) {
    const user = getStoredUser();
    const role =
      (mySubscriptionData && mySubscriptionData.current_role) ||
      (user && user.role ? String(user.role).toLowerCase() : 'guest');

    // Only show upsell modal for Guest / Free tier users
    if (role === 'pro' || role === 'admin') return;

    const modal = document.getElementById('quotaExceededModal');
    const reasonEl = document.getElementById('quotaExceededReason');

    if (reasonEl && reasonMessage) {
      reasonEl.textContent = String(reasonMessage);
    }

    if (modal) {
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      modal.style.display = 'flex';
    }
  }

  function closeQuotaExceededModal() {
    const modal = document.getElementById('quotaExceededModal');
    if (modal) {
      modal.setAttribute('hidden', '');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.display = 'none';
    }
  }

  // ── User Billing Transaction History & Invoice API Integration ───────

  let billingTab = 'plans';
  let billingStatusFilter = 'all';
  let billingCurrentPage = 1;
  const billingPageSize = 10;
  let billingTotalCount = 0;
  let billingTotalPages = 1;
  let billingTransactions = [];
  let billingLoading = false;
  let billingRequestId = 0;
  let currentInvoiceRequestId = 0;
  let currentInvoiceTransaction = null;

  function initBillingHistory() {
    const tabPlans = document.getElementById('tabPricingPlans');
    const tabHistory = document.getElementById('tabBillingHistory');
    const statusSelect = document.getElementById('billingStatusFilter');
    const btnPrev = document.getElementById('btnBillingPrevPage');
    const btnNext = document.getElementById('btnBillingNextPage');
    const btnRetry = document.getElementById('btnRetryBillingHistory');

    if (tabPlans) {
      tabPlans.addEventListener('click', (e) => {
        e.preventDefault();
        switchPricingTab('plans');
      });
    }

    if (tabHistory) {
      tabHistory.addEventListener('click', (e) => {
        e.preventDefault();
        switchPricingTab('history');
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        filterBillingHistory(e.target.value);
      });
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', (e) => {
        e.preventDefault();
        if (billingCurrentPage > 1 && !billingLoading) {
          goToBillingHistoryPage(billingCurrentPage - 1);
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', (e) => {
        e.preventDefault();
        if (billingCurrentPage < billingTotalPages && !billingLoading) {
          goToBillingHistoryPage(billingCurrentPage + 1);
        }
      });
    }

    if (btnRetry) {
      btnRetry.addEventListener('click', (e) => {
        e.preventDefault();
        fetchBillingHistory(billingCurrentPage, billingStatusFilter);
      });
    }

    updateBillingTabBadge();
  }

  function updateBillingTabBadge(count) {
    const badge = document.getElementById('billingHistoryTabBadge');
    if (badge) {
      badge.textContent = String(typeof count === 'number' ? count : billingTotalCount);
    }
  }

  function switchPricingTab(tab) {
    billingTab = tab === 'history' ? 'history' : 'plans';

    const tabPlans = document.getElementById('tabPricingPlans');
    const tabHistory = document.getElementById('tabBillingHistory');
    const plansContainer = document.getElementById('pricingPlansContainer');
    const historyContainer = document.getElementById('billingHistoryContainer');

    if (tabPlans) {
      if (billingTab === 'plans') {
        tabPlans.classList.add('active');
        tabPlans.setAttribute('aria-selected', 'true');
      } else {
        tabPlans.classList.remove('active');
        tabPlans.setAttribute('aria-selected', 'false');
      }
    }

    if (tabHistory) {
      if (billingTab === 'history') {
        tabHistory.classList.add('active');
        tabHistory.setAttribute('aria-selected', 'true');
      } else {
        tabHistory.classList.remove('active');
        tabHistory.setAttribute('aria-selected', 'false');
      }
    }

    if (plansContainer) {
      plansContainer.style.display = billingTab === 'plans' ? 'block' : 'none';
    }

    if (historyContainer) {
      historyContainer.style.display = billingTab === 'history' ? 'block' : 'none';
    }

    if (billingTab === 'history') {
      return fetchBillingHistory(1, billingStatusFilter);
    }
  }

  function filterBillingHistory(status) {
    billingStatusFilter = (status || 'all').toLowerCase();
    billingCurrentPage = 1;
    return fetchBillingHistory(billingCurrentPage, billingStatusFilter);
  }

  function goToBillingHistoryPage(page) {
    const targetPage = Math.max(1, Math.min(page, billingTotalPages || 1));
    if (targetPage === billingCurrentPage && billingTransactions.length > 0) return Promise.resolve();
    billingCurrentPage = targetPage;
    return fetchBillingHistory(billingCurrentPage, billingStatusFilter);
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes} ${day}/${month}/${year}`;
    } catch (_e) {
      return dateStr;
    }
  }

  function renderStatusBadge(status) {
    const s = String(status || '').toLowerCase();
    switch (s) {
      case 'completed':
        return '<span class="billing-status-badge status-badge-completed"><span class="billing-status-dot"></span>Hoàn tất</span>';
      case 'pending':
        return '<span class="billing-status-badge status-badge-pending"><span class="billing-status-dot"></span>Đang xử lý</span>';
      case 'failed':
        return '<span class="billing-status-badge status-badge-failed"><span class="billing-status-dot"></span>Thất bại</span>';
      case 'expired':
        return '<span class="billing-status-badge status-badge-expired"><span class="billing-status-dot"></span>Hết hạn</span>';
      default:
        return `<span class="billing-status-badge status-badge-expired"><span class="billing-status-dot"></span>${escapeHtml(status)}</span>`;
    }
  }

  async function fetchBillingHistory(page = 1, status = 'all') {
    const reqId = ++billingRequestId;
    billingLoading = true;
    billingCurrentPage = Math.max(1, page);
    billingStatusFilter = (status || 'all').toLowerCase();

    const tbody = document.getElementById('billingHistoryTableBody');
    const tableWrap = document.querySelector('.billing-table-responsive');
    const emptyState = document.getElementById('billingHistoryEmptyState');
    const loadingState = document.getElementById('billingHistoryLoadingState');
    const errorState = document.getElementById('billingHistoryErrorState');
    const countChip = document.getElementById('billingHistoryCountChip');
    const paginationFooter = document.getElementById('billingPaginationFooter');
    const statusSelect = document.getElementById('billingStatusFilter');

    if (statusSelect && statusSelect.value !== billingStatusFilter) {
      statusSelect.value = billingStatusFilter;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'none';
    if (paginationFooter) paginationFooter.style.display = 'none';
    if (loadingState) loadingState.style.display = 'flex';

    const token = getStoredToken();
    if (!token) {
      if (loadingState) loadingState.style.display = 'none';
      if (errorState) {
        errorState.style.display = 'flex';
        const msgEl = document.getElementById('billingHistoryErrorMessage');
        if (msgEl) {
          msgEl.textContent = 'Vui lòng đăng nhập để xem lịch sử giao dịch thanh toán.';
        }
      }
      if (countChip) countChip.textContent = '0 giao dịch';
      updateBillingTabBadge(0);
      billingLoading = false;
      return;
    }

    try {
      let url = `${API_BASE_URL}/api/pricing/billing/history?page=${billingCurrentPage}&page_size=${billingPageSize}`;
      if (billingStatusFilter && billingStatusFilter !== 'all') {
        url += `&status=${encodeURIComponent(billingStatusFilter)}`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (reqId !== billingRequestId) return;

      if (res.status === 401) {
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) {
          errorState.style.display = 'flex';
          const msgEl = document.getElementById('billingHistoryErrorMessage');
          if (msgEl) {
            msgEl.textContent = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
          }
        }
        notifyUser('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.openLoginModal === 'function') {
          window.pdfLinguaAuth.openLoginModal();
        }
        billingLoading = false;
        return;
      }

      if (!res.ok) {
        let errMsg = 'Không thể tải lịch sử giao dịch từ máy chủ.';
        try {
          const errBody = await res.json();
          if (errBody && errBody.detail) {
            errMsg = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
          } else if (errBody && errBody.message) {
            errMsg = errBody.message;
          }
        } catch (_e) {}

        if (loadingState) loadingState.style.display = 'none';
        if (errorState) {
          errorState.style.display = 'flex';
          const msgEl = document.getElementById('billingHistoryErrorMessage');
          if (msgEl) msgEl.textContent = errMsg;
        }
        notifyUser(errMsg, 'error');
        billingLoading = false;
        return;
      }

      const body = await res.json();
      if (reqId !== billingRequestId) return;

      if (body && body.success && body.data) {
        const data = body.data;
        billingTransactions = Array.isArray(data.items) ? data.items : [];
        billingTotalCount = typeof data.total_count === 'number' ? data.total_count : billingTransactions.length;
        billingTotalPages = Math.max(1, typeof data.total_pages === 'number' ? data.total_pages : 1);
        billingCurrentPage = typeof data.page === 'number' ? data.page : billingCurrentPage;

        renderBillingHistoryData();
      } else {
        throw new Error('Dữ liệu trả về không hợp lệ.');
      }
    } catch (_err) {
      if (reqId !== billingRequestId) return;
      if (loadingState) loadingState.style.display = 'none';
      const errMsg =
        _err && _err.message && _err.message !== 'Failed to fetch'
          ? _err.message
          : 'Lỗi kết nối mạng đến máy chủ. Vui lòng thử lại.';
      if (errorState) {
        errorState.style.display = 'flex';
        const msgEl = document.getElementById('billingHistoryErrorMessage');
        if (msgEl) {
          msgEl.textContent = errMsg;
        }
      }
      notifyUser(errMsg, 'error');
    } finally {
      if (reqId === billingRequestId) {
        billingLoading = false;
      }
    }
  }

  function renderBillingHistoryData() {
    const tbody = document.getElementById('billingHistoryTableBody');
    const tableWrap = document.querySelector('.billing-table-responsive');
    const emptyState = document.getElementById('billingHistoryEmptyState');
    const loadingState = document.getElementById('billingHistoryLoadingState');
    const errorState = document.getElementById('billingHistoryErrorState');
    const countChip = document.getElementById('billingHistoryCountChip');
    const paginationFooter = document.getElementById('billingPaginationFooter');
    const paginationInfo = document.getElementById('billingPaginationInfo');
    const pageNumbersContainer = document.getElementById('billingPageNumbers');
    const btnPrev = document.getElementById('btnBillingPrevPage');
    const btnNext = document.getElementById('btnBillingNextPage');

    if (loadingState) loadingState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';

    if (countChip) {
      countChip.textContent = `${billingTotalCount} giao dịch`;
    }

    updateBillingTabBadge(billingTotalCount);

    if (billingTotalCount === 0 || billingTransactions.length === 0) {
      if (tableWrap) tableWrap.style.display = 'none';
      if (paginationFooter) paginationFooter.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      if (tbody) tbody.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';
    if (paginationFooter) paginationFooter.style.display = 'flex';

    const startIndex = (billingCurrentPage - 1) * billingPageSize;

    if (tbody) {
      tbody.innerHTML = billingTransactions
        .map((tx, idx) => {
          const stt = startIndex + idx + 1;
          const displayDate = formatDisplayDate(tx.paid_at || tx.created_at);
          const methodDisplay =
            tx.payment_method === 'vietqr' ? 'VietQR Napas247' : (tx.payment_method || 'VietQR');
          const cycleLabel =
            tx.billing_cycle === 'yearly' ? 'Chu kỳ 1 năm (365 ngày)' : 'Chu kỳ 1 tháng (30 ngày)';

          return `
            <tr>
              <td class="billing-cell-stt font-mono">${stt}</td>
              <td class="billing-cell-code font-mono">${escapeHtml(tx.transaction_code)}</td>
              <td>
                <span class="billing-cell-plan">${escapeHtml(tx.plan_name)}</span>
                <span class="billing-cell-cycle">${cycleLabel}</span>
              </td>
              <td class="billing-cell-date font-mono">${displayDate}</td>
              <td class="billing-cell-amount font-mono text-right">${escapeHtml(tx.amount_display)}</td>
              <td class="billing-cell-method">${escapeHtml(methodDisplay)}</td>
              <td>${renderStatusBadge(tx.payment_status)}</td>
              <td class="text-center">
                <button type="button" class="btn-view-invoice" data-tx="${escapeHtml(tx.transaction_code)}" title="Xem hóa đơn điện tử">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                  <span>Xem hóa đơn</span>
                </button>
              </td>
            </tr>
          `;
        })
        .join('');

      const viewInvoiceButtons = tbody.querySelectorAll('.btn-view-invoice');
      viewInvoiceButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const txCode = btn.getAttribute('data-tx');
          handleViewInvoiceClick(txCode);
        });
      });
    }

    if (paginationInfo) {
      const fromItem = startIndex + 1;
      const toItem = Math.min(startIndex + billingTransactions.length, billingTotalCount);
      paginationInfo.textContent = `Hiển thị ${fromItem} - ${toItem} / ${billingTotalCount} giao dịch`;
    }

    if (btnPrev) {
      btnPrev.disabled = billingCurrentPage <= 1;
    }

    if (btnNext) {
      btnNext.disabled = billingCurrentPage >= billingTotalPages;
    }

    if (pageNumbersContainer) {
      let pageButtonsHtml = '';
      for (let p = 1; p <= billingTotalPages; p++) {
        if (p === billingCurrentPage) {
          pageButtonsHtml += `<span class="pagination-current-page font-mono">${p}</span>`;
        } else {
          pageButtonsHtml += `<button type="button" class="btn-pagination font-mono" data-page="${p}">${p}</button>`;
        }
      }
      pageNumbersContainer.innerHTML = pageButtonsHtml;

      const numberButtons = pageNumbersContainer.querySelectorAll('.btn-pagination');
      numberButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const page = parseInt(btn.getAttribute('data-page'), 10);
          if (!isNaN(page)) {
            goToBillingHistoryPage(page);
          }
        });
      });
    }
  }

  function initInvoiceModal() {
    const modal = document.getElementById('billingInvoiceModal');
    const btnClose = document.getElementById('btnCloseInvoiceModal');
    const btnCloseFooter = document.getElementById('btnInvoiceModalCloseFooter');
    const btnPrint = document.getElementById('btnPrintInvoice');
    const btnDownload = document.getElementById('btnDownloadInvoice');

    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        closeInvoiceModal();
      });
    }

    if (btnCloseFooter) {
      btnCloseFooter.addEventListener('click', (e) => {
        e.preventDefault();
        closeInvoiceModal();
      });
    }

    if (btnPrint) {
      btnPrint.addEventListener('click', (e) => {
        e.preventDefault();
        printInvoiceReceipt();
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener('click', (e) => {
        e.preventDefault();
        downloadInvoiceReceipt();
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeInvoiceModal();
        }
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
          if (modal && !modal.hasAttribute('hidden') && modal.style.display !== 'none') {
            closeInvoiceModal();
          }
        }
      });
    }
  }

  async function openInvoiceModal(transactionCode) {
    if (!transactionCode) return null;

    const modal = document.getElementById('billingInvoiceModal');
    if (!modal) return null;

    const loadingState = document.getElementById('invoiceModalLoadingState');
    const printableArea = document.getElementById('invoicePrintableArea');
    const btnPrint = document.getElementById('btnPrintInvoice');
    const btnDownload = document.getElementById('btnDownloadInvoice');
    const statusBadge = document.getElementById('invoiceStatusBadge');
    const statusText = document.getElementById('invoiceStatusText');
    const invoiceNumberEl = document.getElementById('invoiceNumber');
    const invoiceTxCodeEl = document.getElementById('invoiceTxCode');
    const buyerNameEl = document.getElementById('invoiceBuyerName');
    const buyerEmailEl = document.getElementById('invoiceBuyerEmail');
    const paymentMethodEl = document.getElementById('invoicePaymentMethod');
    const planNameEl = document.getElementById('invoicePlanName');
    const cycleDurationEl = document.getElementById('invoiceCycleDuration');
    const createdAtEl = document.getElementById('invoiceCreatedAt');
    const paidAtEl = document.getElementById('invoicePaidAt');
    const itemDescEl = document.getElementById('invoiceItemDesc');
    const itemSubEl = document.getElementById('invoiceItemSub');
    const itemCycleEl = document.getElementById('invoiceItemCycle');
    const itemPriceEl = document.getElementById('invoiceItemPrice');
    const itemTaxRateEl = document.getElementById('invoiceItemTaxRate');
    const itemAmountEl = document.getElementById('invoiceItemAmount');
    const subtotalEl = document.getElementById('invoiceSubtotal');
    const taxAmountEl = document.getElementById('invoiceTaxAmount');
    const totalAmountEl = document.getElementById('invoiceTotalAmount');
    const paymentNoteEl = document.getElementById('invoicePaymentNote');
    const qrWrap = document.getElementById('invoiceQrWrap');
    const qrImage = document.getElementById('invoiceQrImage');

    // 1. Reset stale data immediately so previous invoice is never visible
    currentInvoiceTransaction = null;
    if (invoiceNumberEl) invoiceNumberEl.textContent = '...';
    if (invoiceTxCodeEl) invoiceTxCodeEl.textContent = `Mã GD: ${transactionCode}`;
    if (statusText) statusText.textContent = 'Đang tải...';
    if (statusBadge) statusBadge.className = 'billing-status-badge status-badge-pending';
    if (buyerNameEl) buyerNameEl.textContent = '...';
    if (buyerEmailEl) buyerEmailEl.textContent = '...';
    if (paymentMethodEl) paymentMethodEl.textContent = '...';
    if (planNameEl) planNameEl.textContent = '...';
    if (cycleDurationEl) cycleDurationEl.textContent = '...';
    if (createdAtEl) createdAtEl.textContent = '...';
    if (paidAtEl) paidAtEl.textContent = '...';
    if (itemDescEl) itemDescEl.textContent = '...';
    if (itemSubEl) itemSubEl.textContent = '...';
    if (itemCycleEl) itemCycleEl.textContent = '...';
    if (itemPriceEl) itemPriceEl.textContent = '...';
    if (itemTaxRateEl) itemTaxRateEl.textContent = '0% (VAT)';
    if (itemAmountEl) itemAmountEl.textContent = '...';
    if (subtotalEl) subtotalEl.textContent = '...';
    if (taxAmountEl) taxAmountEl.textContent = '0 VNĐ';
    if (totalAmountEl) totalAmountEl.textContent = '...';
    if (paymentNoteEl) paymentNoteEl.textContent = '...';
    if (qrWrap) qrWrap.style.display = 'none';
    if (qrImage) qrImage.src = '';

    // 2. Show modal with loading state
    if (loadingState) loadingState.style.display = 'flex';
    if (printableArea) printableArea.style.display = 'none';
    if (btnPrint) btnPrint.disabled = true;
    if (btnDownload) btnDownload.disabled = true;

    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';

    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = 'hidden';
    }

    const token = getStoredToken();
    if (!token) {
      closeInvoiceModal();
      notifyUser('Vui lòng đăng nhập để xem chi tiết hóa đơn.', 'warning');
      if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.openLoginModal === 'function') {
        window.pdfLinguaAuth.openLoginModal();
      }
      return null;
    }

    const reqId = ++currentInvoiceRequestId;

    try {
      const url = `${API_BASE_URL}/api/pricing/billing/invoices/${encodeURIComponent(transactionCode)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (reqId !== currentInvoiceRequestId) return null;

      if (res.status === 401) {
        closeInvoiceModal();
        notifyUser('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.openLoginModal === 'function') {
          window.pdfLinguaAuth.openLoginModal();
        }
        return null;
      }

      if (res.status === 403) {
        closeInvoiceModal();
        notifyUser('Bạn không có quyền truy cập hóa đơn giao dịch này (403 Forbidden).', 'error');
        return null;
      }

      if (res.status === 404) {
        closeInvoiceModal();
        notifyUser('Không tìm thấy thông tin hóa đơn cho giao dịch này (404 Not Found).', 'error');
        return null;
      }

      if (!res.ok) {
        closeInvoiceModal();
        notifyUser('Không thể tải chi tiết hóa đơn từ máy chủ.', 'error');
        return null;
      }

      const body = await res.json();
      if (reqId !== currentInvoiceRequestId) return null;

      if (body && body.success && body.data) {
        const tx = body.data;
        currentInvoiceTransaction = tx;

        const invoiceNum = tx.invoice_number || `INV-${tx.transaction_code}`;
        const status = String(tx.payment_status || 'completed').toLowerCase();

        if (invoiceNumberEl) invoiceNumberEl.textContent = invoiceNum;
        if (invoiceTxCodeEl) invoiceTxCodeEl.textContent = `Mã GD: ${tx.transaction_code}`;

        if (statusBadge) {
          statusBadge.className = `billing-status-badge status-badge-${status}`;
        }
        if (statusText) {
          switch (status) {
            case 'completed':
              statusText.textContent = 'Hoàn tất';
              break;
            case 'pending':
              statusText.textContent = 'Đang xử lý';
              break;
            case 'failed':
              statusText.textContent = 'Thất bại';
              break;
            case 'expired':
              statusText.textContent = 'Hết hạn';
              break;
            default:
              statusText.textContent = tx.payment_status;
          }
        }

        if (buyerNameEl) buyerNameEl.textContent = tx.buyer_name || 'Khách hàng PDF-Lingua';
        if (buyerEmailEl) buyerEmailEl.textContent = tx.buyer_email || 'Chưa cung cấp';
        if (paymentMethodEl) {
          paymentMethodEl.textContent =
            tx.payment_method === 'vietqr' ? 'VietQR Napas247' : (tx.payment_method || 'VietQR Napas247');
        }

        if (planNameEl) planNameEl.textContent = tx.plan_name || 'Gói Dịch Vụ Pro';
        if (cycleDurationEl) {
          cycleDurationEl.textContent =
            tx.billing_cycle === 'yearly' ? 'Theo năm (365 ngày)' : 'Theo tháng (30 ngày)';
        }

        if (createdAtEl) createdAtEl.textContent = formatDisplayDate(tx.issued_at || tx.created_at);
        if (paidAtEl) {
          paidAtEl.textContent = tx.paid_at
            ? formatDisplayDate(tx.paid_at)
            : (status === 'completed' ? formatDisplayDate(tx.issued_at || tx.created_at) : 'Chưa thanh toán');
        }

        if (itemDescEl) {
          itemDescEl.textContent =
            tx.billing_cycle === 'yearly'
              ? 'Đặc quyền Gói Pro Hàng Năm (100 MB / 500 trang OCR / AI Copilot)'
              : 'Đặc quyền Gói Pro Hàng Tháng (100 MB / 500 trang OCR / AI Copilot)';
        }
        if (itemSubEl) {
          itemSubEl.textContent = `Mã gói: ${tx.plan_code || 'pro'}`;
        }
        if (itemCycleEl) {
          itemCycleEl.textContent = tx.duration_days
            ? `${tx.duration_days} ngày`
            : (tx.billing_cycle === 'yearly' ? '365 ngày' : '30 ngày');
        }
        if (itemPriceEl) itemPriceEl.textContent = tx.amount_display;
        if (itemTaxRateEl) itemTaxRateEl.textContent = `${tx.tax_rate_percent !== undefined ? tx.tax_rate_percent : 0}% (VAT)`;
        if (itemAmountEl) itemAmountEl.textContent = tx.total_amount_display || tx.amount_display;

        if (subtotalEl) subtotalEl.textContent = tx.amount_display;
        if (taxAmountEl) {
          const taxAmt = typeof tx.tax_amount_vnd === 'number' ? tx.tax_amount_vnd : 0;
          taxAmountEl.textContent = `${taxAmt.toLocaleString('vi-VN').replace(/,/g, '.')} VNĐ`;
        }
        if (totalAmountEl) totalAmountEl.textContent = tx.total_amount_display || tx.amount_display;

        if (paymentNoteEl) {
          paymentNoteEl.textContent = tx.payment_note || 'Tự động đối soát hệ thống';
        }

        if (qrWrap && qrImage) {
          if (tx.qr_code_url) {
            qrImage.src = tx.qr_code_url;
            qrWrap.style.display = 'flex';
          } else {
            qrImage.src = '';
            qrWrap.style.display = 'none';
          }
        }

        if (loadingState) loadingState.style.display = 'none';
        if (printableArea) printableArea.style.display = 'flex';
        if (btnPrint) btnPrint.disabled = false;
        if (btnDownload) btnDownload.disabled = false;

        if (typeof document !== 'undefined') {
          const event = new CustomEvent('pdfl:view-invoice', {
            detail: {
              transactionCode: tx.transaction_code,
              transaction: tx,
            },
          });
          document.dispatchEvent(event);
        }

        return tx;
      } else {
        throw new Error('Dữ liệu chi tiết hóa đơn không hợp lệ.');
      }
    } catch (_err) {
      if (reqId !== currentInvoiceRequestId) return null;
      closeInvoiceModal();
      const errMsg =
        _err && _err.message && _err.message !== 'Failed to fetch'
          ? _err.message
          : 'Lỗi kết nối khi tải chi tiết hóa đơn. Vui lòng thử lại.';
      notifyUser(errMsg, 'error');
      return null;
    }
  }

  function closeInvoiceModal() {
    const modal = document.getElementById('billingInvoiceModal');
    if (modal) {
      modal.setAttribute('hidden', '');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.display = 'none';
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = '';
    }
  }

  function printInvoiceReceipt() {
    const loadingState = document.getElementById('invoiceModalLoadingState');
    if (loadingState && loadingState.style.display !== 'none') {
      notifyUser('Đang tải chi tiết hóa đơn, vui lòng chờ trong giây lát.', 'warning');
      return;
    }
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    } else {
      notifyUser('Trình duyệt không hỗ trợ in ấn trực tiếp.', 'warning');
    }
  }

  function generateReceiptHtml(tx) {
    const displayDate = formatDisplayDate(tx.paid_at || tx.issued_at || tx.created_at);
    const cycleLabel = tx.billing_cycle === 'yearly' ? 'Theo năm (365 ngày)' : 'Theo tháng (30 ngày)';
    const itemDesc =
      tx.billing_cycle === 'yearly'
        ? 'Đặc quyền Gói Pro Hàng Năm (100 MB / 500 trang OCR / AI Copilot)'
        : 'Đặc quyền Gói Pro Hàng Tháng (100 MB / 500 trang OCR / AI Copilot)';
    const methodDisplay =
      tx.payment_method === 'vietqr' ? 'VietQR Napas247' : (tx.payment_method || 'VietQR Napas247');
    const noteDisplay = tx.payment_note || 'Tự động đối soát hệ thống';
    const invoiceNumber = tx.invoice_number || `INV-${tx.transaction_code}`;

    return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hóa đơn thanh toán - ${escapeHtml(invoiceNumber)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px 20px; }
  .receipt-box { max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 24px; }
  .logo { font-size: 24px; font-weight: 800; color: #0f172a; }
  .logo span { background: #2563eb; color: #fff; padding: 2px 6px; border-radius: 4px; }
  .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
  .inv-num { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .inv-num-label { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.05em; }
  .inv-num-val { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  .meta-title { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em; }
  .meta-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
  .meta-label { color: #64748b; }
  .meta-val { font-weight: 600; color: #0f172a; text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
  th { text-align: left; padding: 10px 12px; background: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase; }
  td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .totals { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  .tot-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
  .tot-row.grand { font-size: 16px; font-weight: 800; color: #2563eb; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 6px; }
  .reconcile { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; margin-top: 24px; font-size: 12px; }
  .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  @media print {
    body { background: #fff; padding: 0; }
    .receipt-box { border: none; box-shadow: none; padding: 0; }
  }
</style>
</head>
<body>
<div class="receipt-box">
  <div class="header">
    <div>
      <div class="logo"><span>PDF</span>-Lingua</div>
      <div class="subtitle">Nền tảng OCR & Dịch thuật PDF Song Ngữ Chuyên Sâu</div>
    </div>
    <div class="inv-num">
      <div class="inv-num-label">SỐ HÓA ĐƠN</div>
      <div class="inv-num-val">${escapeHtml(invoiceNumber)}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Mã GD: ${escapeHtml(tx.transaction_code)}</div>
    </div>
  </div>
  <div class="meta-grid">
    <div class="meta-card">
      <div class="meta-title">Thông tin khách hàng</div>
      <div class="meta-row"><span class="meta-label">Người mua:</span><span class="meta-val">${escapeHtml(tx.buyer_name || 'Khách hàng')}</span></div>
      <div class="meta-row"><span class="meta-label">Email:</span><span class="meta-val">${escapeHtml(tx.buyer_email || 'Chưa cung cấp')}</span></div>
      <div class="meta-row"><span class="meta-label">Phương thức:</span><span class="meta-val">${escapeHtml(methodDisplay)}</span></div>
    </div>
    <div class="meta-card">
      <div class="meta-title">Chi tiết dịch vụ</div>
      <div class="meta-row"><span class="meta-label">Gói đăng ký:</span><span class="meta-val">${escapeHtml(tx.plan_name)}</span></div>
      <div class="meta-row"><span class="meta-label">Chu kỳ:</span><span class="meta-val">${escapeHtml(cycleLabel)}</span></div>
      <div class="meta-row"><span class="meta-label">Thời điểm thanh toán:</span><span class="meta-val">${escapeHtml(displayDate)}</span></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Mô tả khoản mục</th>
        <th class="text-center">Thời hạn</th>
        <th class="text-right">Đơn giá</th>
        <th class="text-right">Thuế suất</th>
        <th class="text-right">Thành tiền</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>${escapeHtml(itemDesc)}</strong><br><small style="color: #64748b;">Mã gói: ${escapeHtml(tx.plan_code || 'pro')}</small></td>
        <td class="text-center">${tx.duration_days ? `${tx.duration_days} ngày` : cycleLabel}</td>
        <td class="text-right">${escapeHtml(tx.amount_display)}</td>
        <td class="text-right">${tx.tax_rate_percent !== undefined ? tx.tax_rate_percent : 0}% (VAT)</td>
        <td class="text-right"><strong>${escapeHtml(tx.total_amount_display || tx.amount_display)}</strong></td>
      </tr>
    </tbody>
  </table>
  <div class="totals">
    <div class="tot-row"><span>Tạm tính:</span><span>${escapeHtml(tx.amount_display)}</span></div>
    <div class="tot-row"><span>Thuế GTGT (0%):</span><span>0 VNĐ</span></div>
    <div class="tot-row grand"><span>Tổng thanh toán:</span><span>${escapeHtml(tx.total_amount_display || tx.amount_display)}</span></div>
  </div>
  <div class="reconcile">
    <strong>NỘI DUNG CHUYỂN KHOẢN ĐỐI SOÁT:</strong> <code style="font-weight: 700; color: #2563eb;">${escapeHtml(noteDisplay)}</code>
    <div style="margin-top: 4px; color: #64748b;">Giao dịch điện tử được bảo vệ và tự động đối soát qua Napas247 / VietQR.</div>
  </div>
  <div class="footer">
    <p>Hóa đơn điện tử khởi tạo tự động từ hệ thống PDF-Lingua. Miễn thuế GTGT theo Thông tư 219/2013/TT-BTC.</p>
    <p>Hỗ trợ khách hàng: support@pdf-lingua.vn</p>
  </div>
</div>
</body>
</html>`;
  }

  function downloadInvoiceReceipt() {
    const loadingState = document.getElementById('invoiceModalLoadingState');
    if (loadingState && loadingState.style.display !== 'none') {
      notifyUser('Đang tải chi tiết hóa đơn, vui lòng chờ trong giây lát.', 'warning');
      return;
    }

    if (!currentInvoiceTransaction) {
      notifyUser('Không có thông tin giao dịch để tải biên lai.', 'warning');
      return;
    }

    const tx = currentInvoiceTransaction;
    const htmlContent = generateReceiptHtml(tx);
    const invoiceNumber = tx.invoice_number || `INV-${tx.transaction_code}`;
    const filename = `Bien-lai-${invoiceNumber}.html`;

    try {
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        if (typeof document !== 'undefined' && document.body) {
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      }
      notifyUser(`Đã tải xuống biên lai hóa đơn ${invoiceNumber}`, 'success');
    } catch (_err) {
      notifyUser('Không thể tải biên lai trên trình duyệt này.', 'error');
    }
  }

  function handleViewInvoiceClick(transactionCode) {
    if (!transactionCode) return Promise.resolve(null);
    return openInvoiceModal(transactionCode);
  }

  if (typeof window !== 'undefined') {
    window.PDFLinguaCheckout = {
      openCheckout: openCheckoutModal,
      closeCheckout: closeCheckoutModal,
      switchCheckoutPlan,
      pollTransactionStatus,
      simulatePaymentSuccess,
      handlePaymentCompleted,
      handlePaymentExpired,
      triggerCheckoutConfetti,
      getCurrentTransaction: () => currentTransaction,
      getRemainingSeconds: () => remainingSeconds,
    };

    window.PDFLinguaPricing = {
      openPricingView,
      closePricingView,
      setBillingCycle,
      getBillingCycle: () => currentCycle,
      getCatalogData: () => catalogData,
      fetchPricingCatalog,
      fetchMySubscription,
      handleUpgradeProAction,
      handleCancelSubscription,
      openCheckoutModal,
      closeCheckoutModal,
      openQuotaExceededModal,
      closeQuotaExceededModal,
      simulatePaymentSuccess,
      pollTransactionStatus,
      switchPricingTab,
      filterBillingHistory,
      goToBillingHistoryPage,
      fetchBillingHistory,
      renderBillingHistoryData,
      getBillingHistoryState: () => ({
        tab: billingTab,
        statusFilter: billingStatusFilter,
        page: billingCurrentPage,
        pageSize: billingPageSize,
        totalCount: billingTotalCount,
        totalPages: billingTotalPages,
        isLoading: billingLoading,
        items: billingTransactions,
      }),
      getBillingTransactions: () => billingTransactions,
      setMockBillingTransactions: (txs) => {
        billingTransactions = Array.isArray(txs) ? [...txs] : [];
        billingTotalCount = billingTransactions.length;
        billingTotalPages = Math.max(1, Math.ceil(billingTotalCount / billingPageSize));
        billingCurrentPage = 1;
        renderBillingHistoryData();
      },
      handleViewInvoiceClick,
      openInvoiceModal,
      closeInvoiceModal,
      printInvoiceReceipt,
      downloadInvoiceReceipt,
      getCurrentInvoiceTransaction: () => currentInvoiceTransaction,
      setCurrentInvoiceTransaction: (tx) => {
        currentInvoiceTransaction = tx;
      },
      generateReceiptHtml,
    };
  }
})();
