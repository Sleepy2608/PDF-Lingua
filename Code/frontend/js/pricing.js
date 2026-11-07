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

  document.addEventListener('DOMContentLoaded', () => {
    initPricingModule();
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

    const effectiveRole =
      (subData && subData.current_role) ||
      (user && user.role ? String(user.role).toLowerCase() : null);
    const activeSub = subData ? subData.active_subscription : null;

    if (!user && !effectiveRole) {
      // Guest state
      if (activeBanner) activeBanner.style.display = 'none';
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

    // If Checkout controller is attached, open the VietQR checkout modal
    if (
      typeof window !== 'undefined' &&
      window.PDFLinguaCheckout &&
      typeof window.PDFLinguaCheckout.openCheckout === 'function'
    ) {
      window.PDFLinguaCheckout.openCheckout(planCode);
      return;
    }

    // Dispatch custom event for checkout integration
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('pdfl:open-checkout', {
          detail: { planCode, billingCycle: currentCycle },
        })
      );
    }

    const label =
      planCode === 'pro_yearly'
        ? 'Gói Pro Hàng Năm (399.000đ/năm)'
        : 'Gói Pro Hàng Tháng (49.000đ/tháng)';
    notifyUser(`Đã chọn ${label}. Đang khởi tạo cổng thanh toán VietQR...`, 'info');
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

  if (typeof window !== 'undefined') {
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
    };
  }
})();

