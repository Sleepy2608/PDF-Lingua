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
        'Trợ lý AI Hỏi đáp (AI Copilot) không giới hạn',
        'Tóm tắt thông minh AI Summary & bảng thuật ngữ',
        'Hàng đợi ưu tiên tốc độ cao (Fast-track Worker)',
        'Kho lưu trữ tài liệu cá nhân không giới hạn',
        'Huy hiệu Pro VIP ánh kim trên hồ sơ và giao diện',
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

  function buildFallbackCheckoutData(planCode) {
    const isYearly = planCode === 'pro_yearly';
    const amountVnd = isYearly ? 399000 : 49000;
    const durationDays = isYearly ? 365 : 30;
    const txCode = `PDL-SUB-${String(Date.now()).slice(-6)}`;
    const transferNote = txCode.replace(/-/g, ' ');
    const qrUrl = `https://img.vietqr.io/image/MB-0345678999-compact2.png?amount=${amountVnd}&addInfo=${encodeURIComponent(
      transferNote
    )}&accountName=${encodeURIComponent('PDF LINGUA PROJECT')}`;

    return {
      transaction_code: txCode,
      plan_code: isYearly ? 'pro_yearly' : 'pro_monthly',
      plan_name: isYearly ? 'Gói Pro Hàng Năm' : 'Gói Pro Hàng Tháng',
      duration_days: durationDays,
      amount_vnd: amountVnd,
      amount_display: `${amountVnd.toLocaleString('vi-VN').replace(/,/g, '.')} VNĐ`,
      payment_method: 'vietqr',
      payment_status: 'pending',
      qr_code_url: qrUrl,
      bank_info: {
        bank_name: 'MB Bank (Ngân hàng Quân Đội)',
        account_number: '0345678999',
        account_name: 'PDF LINGUA PROJECT',
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
      bankNameEl.textContent = bank.bank_name || 'MB Bank (Ngân hàng Quân Đội)';
    }
    if (accountNameEl) {
      accountNameEl.textContent = bank.account_name || 'PDF LINGUA PROJECT';
    }
    if (accountNumEl) {
      accountNumEl.textContent = bank.account_number || '0345678999';
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
      if (txData.qr_code_url) {
        qrImg.src = txData.qr_code_url;
        qrImg.style.display = 'block';
        if (qrFallback) qrFallback.style.display = 'none';
      } else {
        qrImg.style.display = 'none';
        if (qrFallback) qrFallback.style.display = 'flex';
      }
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
    const adminSection = document.getElementById('adminSection');
    const pricingSection = document.getElementById('pricingSection');

    if (heroSection) heroSection.style.display = 'none';
    if (workspaceSection) workspaceSection.style.display = 'none';
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
    const workspaceSection = document.getElementById('workspaceSection');
    const heroSection = document.getElementById('heroSection');

    if (pricingSection) pricingSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';

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
    };
  }
})();

