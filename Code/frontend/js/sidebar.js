/**
 * PDF-Lingua: Collapsible Sidebar Navigation Controller
 * ---------------------------------------------------
 * Manages responsive behavior, collapsed/expanded states,
 * localStorage persistence, keyboard accessibility, user profile sync,
 * document management (dynamic recent documents, empty state, secure download).
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'pdf_lingua_sidebar_collapsed';
  const ACTIVE_VIEW_KEY = 'pdfl_active_view';
  const PENDING_TOAST_KEY = 'pdfl_pending_toast';
  const API_BASE_URL = 'http://localhost:8000';

  let isCollapsed = false;
  let isMobileOpen = false;
  let isDocDetailOpen = false;
  let isDetailDownloading = false;
  let isDocDeleteConfirmOpen = false;
  let isDocDeleting = false;
  let pendingDeleteDoc = null;
  let currentDetailDoc = null;
  let detailRequestSequence = 0;
  let cachedDocuments = [];
  let cachedToken = null;
  let inFlightDocsPromise = null;
  let inFlightToken = null;

  document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
  });

  function initSidebar() {
    const appSidebar = document.getElementById('appSidebar');
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    const btnMobileSidebarToggle = document.getElementById('btnMobileSidebarToggle');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const btnSidebarUpload = document.getElementById('btnSidebarUpload');
    const sidebarUserProfile = document.getElementById('sidebarUserProfile');
    const btnSidebarMore = document.getElementById('btnSidebarMore');

    if (!appSidebar) return;

    // Initial check: sync user profile (guest or authenticated)
    let initialUser = null;
    try {
      const raw = localStorage.getItem('pdfl_user') || sessionStorage.getItem('pdfl_user');
      if (raw) initialUser = JSON.parse(raw);
    } catch (_err) {}

    syncUserProfile(initialUser);

    // Initial fetch of recent documents
    fetchRecentDocuments();

    // Restore saved collapse state from localStorage
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState === 'true') {
        setCollapsed(true, false);
      } else {
        setCollapsed(false, false);
      }
    } catch (_err) {
      setCollapsed(false, false);
    }

    // Toggle button handler
    if (btnToggleSidebar) {
      btnToggleSidebar.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar();
      });
    }

    // Mobile toggle button in header
    if (btnMobileSidebarToggle) {
      btnMobileSidebarToggle.addEventListener('click', (e) => {
        e.preventDefault();
        openMobileSidebar();
      });
    }

    // Backdrop click closes mobile drawer
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', () => {
        closeMobileSidebar();
      });
    }

    // Keyboard navigation (Escape to close delete confirm modal, detail modal, error modal, or mobile drawer, Ctrl+B to toggle sidebar)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isDocDeleteConfirmOpen) {
          if (!isDocDeleting) {
            closeDocumentDeleteConfirmModal();
          }
          return;
        }
        if (isDocDetailOpen) {
          closeDocumentDetailModal();
          return;
        }
        const historyErrorModal = document.getElementById('historyErrorModal');
        if (historyErrorModal && historyErrorModal.style.display !== 'none' && !historyErrorModal.hasAttribute('hidden')) {
          historyErrorModal.style.display = 'none';
          historyErrorModal.setAttribute('hidden', '');
          return;
        }
        if (isMobileOpen) {
          closeMobileSidebar();
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
      }
    });

    // Document Detail, Delete Confirmation & History Error Modal controls (PDFL-93.1, PDFL-94.2 & PDFL-164.1)
    initDocumentDetailModal();
    initDocumentDeleteConfirmModal();
    initHistoryErrorModal();
    initHistoryEventListeners();

    // Brand click: returns to Trang chủ (home/upload view)
    const sidebarBrandLink = document.getElementById('sidebarBrandLink');
    if (sidebarBrandLink) {
      sidebarBrandLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToHome();
      });
    }

    const headerCollapsedBrand = document.getElementById('headerCollapsedBrand');
    if (headerCollapsedBrand) {
      headerCollapsedBrand.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToHome();
      });
    }

    // Upload PDF Primary Action button handler
    if (btnSidebarUpload) {
      btnSidebarUpload.addEventListener('click', (e) => {
        e.preventDefault();
        triggerPdfUpload();
      });
    }

    // Empty state click to trigger upload
    const sidebarEmptyDocsState = document.getElementById('sidebarEmptyDocsState');
    if (sidebarEmptyDocsState) {
      sidebarEmptyDocsState.addEventListener('click', () => {
        triggerPdfUpload();
      });
    }

    // User profile click & keyboard accessibility in sidebar -> open Account modal or Login modal
    if (sidebarUserProfile) {
      sidebarUserProfile.addEventListener('click', () => {
        handleProfileClick();
      });
      sidebarUserProfile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          if (typeof e.preventDefault === 'function') {
            e.preventDefault();
          }
          handleProfileClick();
        }
      });
    }

    if (btnSidebarMore) {
      btnSidebarMore.addEventListener('click', (e) => {
        e.stopPropagation();
        handleProfileClick();
      });
    }

    // Main navigation items
    initNavItems();

    // Restore active view if page reloaded
    try {
      const activeView = sessionStorage.getItem(ACTIVE_VIEW_KEY);
      if (activeView === 'documents') {
        const sideNavDocuments = document.getElementById('sideNavDocuments');
        const heroSection = document.getElementById('heroSection');
        const workspaceSection = document.getElementById('workspaceSection');
        const adminSection = document.getElementById('adminSection');
        const documentsSection = document.getElementById('documentsSection');
        const historySection = document.getElementById('historySection');
        if (sideNavDocuments) setActiveNavItem(sideNavDocuments);
        if (heroSection) heroSection.style.display = 'none';
        if (workspaceSection) workspaceSection.style.display = 'none';
        if (adminSection) adminSection.style.display = 'none';
        if (historySection) historySection.style.display = 'none';
        if (documentsSection) documentsSection.style.display = 'block';

        const pendingToastRaw = sessionStorage.getItem(PENDING_TOAST_KEY);
        if (pendingToastRaw) {
          sessionStorage.removeItem(PENDING_TOAST_KEY);
          const pendingToast = JSON.parse(pendingToastRaw);
          if (pendingToast && pendingToast.msg && Date.now() - (pendingToast.ts || 0) < 5000 && typeof showToast === 'function') {
            showToast(pendingToast.msg, pendingToast.type || 'success');
          }
        }
      } else if (activeView === 'history') {
        const sideNavHistory = document.getElementById('sideNavHistory');
        const heroSection = document.getElementById('heroSection');
        const workspaceSection = document.getElementById('workspaceSection');
        const adminSection = document.getElementById('adminSection');
        const documentsSection = document.getElementById('documentsSection');
        const historySection = document.getElementById('historySection');
        if (sideNavHistory) setActiveNavItem(sideNavHistory);
        if (heroSection) heroSection.style.display = 'none';
        if (workspaceSection) workspaceSection.style.display = 'none';
        if (adminSection) adminSection.style.display = 'none';
        if (documentsSection) documentsSection.style.display = 'none';
        if (historySection) historySection.style.display = 'block';
        fetchProcessingHistories();
      } else if (activeView === 'workspace') {
        const sideNavTranslate = document.getElementById('sideNavTranslate');
        if (sideNavTranslate) setActiveNavItem(sideNavTranslate);
      } else {
        const sideNavHome = document.getElementById('sideNavHome');
        if (sideNavHome) setActiveNavItem(sideNavHome);
      }
    } catch (_err) {}

    // Listen to custom auth events from auth.js
    window.addEventListener('pdfl:auth-change', (e) => {
      const user = e.detail ? e.detail.user : null;
      syncUserProfile(user);
      fetchRecentDocuments();
      const historySection = document.getElementById('historySection');
      if (historySection && historySection.style.display !== 'none') {
        historyCurrentPage = 1;
        fetchProcessingHistories();
      }
    });

    // Listen to document processed events from workspace.js for auto-refresh (PDFL-92.3 & PDFL-164.2)
    window.addEventListener('pdfl:document-processed', () => {
      fetchRecentDocuments();
      const historySection = document.getElementById('historySection');
      if (historySection && historySection.style.display !== 'none') {
        fetchProcessingHistories();
      }
    });
  }

  function triggerPdfUpload() {
    const adminSection = document.getElementById('adminSection');
    const documentsSection = document.getElementById('documentsSection');
    const historySection = document.getElementById('historySection');
    const heroSection = document.getElementById('heroSection');
    const workspaceSection = document.getElementById('workspaceSection');
    const sideNavHome = document.getElementById('sideNavHome');
    const btnNewFile = document.getElementById('btnNewFile');
    const pdfFileInput = document.getElementById('pdfFileInput');

    // If currently in admin, documents, or history view, return to user workspace
    if (adminSection && adminSection.style.display !== 'none') {
      adminSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
    }

    if (documentsSection && documentsSection.style.display !== 'none') {
      documentsSection.style.display = 'none';
      if (workspaceSection) workspaceSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
    }

    if (historySection && historySection.style.display !== 'none') {
      historySection.style.display = 'none';
      if (workspaceSection) workspaceSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
    }

    try {
      sessionStorage.removeItem(ACTIVE_VIEW_KEY);
    } catch (_err) {}

    if (sideNavHome) {
      setActiveNavItem(sideNavHome);
    }

    // If workspace is active with previous file, trigger reset
    if (btnNewFile && typeof btnNewFile.click === 'function' && btnNewFile.offsetParent !== null) {
      btnNewFile.click();
    }

    // Scroll to hero section
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Open native file selector
    if (pdfFileInput && typeof pdfFileInput.click === 'function') {
      pdfFileInput.click();
    }

    if (window.innerWidth < 768) {
      closeMobileSidebar();
    }
  }

  function openDocumentsView() {
    const sideNavDocuments = document.getElementById('sideNavDocuments');
    const heroSection = document.getElementById('heroSection');
    const workspaceSection = document.getElementById('workspaceSection');
    const adminSection = document.getElementById('adminSection');
    const documentsSection = document.getElementById('documentsSection');
    const historySection = document.getElementById('historySection');

    if (sideNavDocuments) setActiveNavItem(sideNavDocuments);
    if (heroSection) heroSection.style.display = 'none';
    if (workspaceSection) workspaceSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    if (documentsSection) documentsSection.style.display = 'block';

    try {
      sessionStorage.setItem(ACTIVE_VIEW_KEY, 'documents');
    } catch (_err) {}

    fetchRecentDocuments();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth < 768) {
      closeMobileSidebar();
    }
  }

  function openHistoryView() {
    const sideNavHistory = document.getElementById('sideNavHistory');
    const heroSection = document.getElementById('heroSection');
    const workspaceSection = document.getElementById('workspaceSection');
    const adminSection = document.getElementById('adminSection');
    const documentsSection = document.getElementById('documentsSection');
    const historySection = document.getElementById('historySection');

    if (sideNavHistory) setActiveNavItem(sideNavHistory);
    if (heroSection) heroSection.style.display = 'none';
    if (workspaceSection) workspaceSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';
    if (documentsSection) documentsSection.style.display = 'none';
    if (historySection) historySection.style.display = 'block';

    try {
      sessionStorage.setItem(ACTIVE_VIEW_KEY, 'history');
    } catch (_err) {}

    fetchProcessingHistories();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth < 768) {
      closeMobileSidebar();
    }
  }

  function navigateToHome() {
    try {
      sessionStorage.removeItem(ACTIVE_VIEW_KEY);
    } catch (_err) {}
    const sideNavHome = document.getElementById('sideNavHome');
    if (sideNavHome) setActiveNavItem(sideNavHome);
    const adminSection = document.getElementById('adminSection');
    const documentsSection = document.getElementById('documentsSection');
    const historySection = document.getElementById('historySection');
    const workspaceSection = document.getElementById('workspaceSection');
    const heroSection = document.getElementById('heroSection');
    if (adminSection) adminSection.style.display = 'none';
    if (documentsSection) documentsSection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    if (workspaceSection) workspaceSection.style.display = 'none';
    if (heroSection) heroSection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth < 768) closeMobileSidebar();
  }

  function closeDocumentsView() {
    const sideNavHome = document.getElementById('sideNavHome');
    const sideNavTranslate = document.getElementById('sideNavTranslate');
    const heroSection = document.getElementById('heroSection');
    const workspaceSection = document.getElementById('workspaceSection');
    const adminSection = document.getElementById('adminSection');
    const documentsSection = document.getElementById('documentsSection');
    const historySection = document.getElementById('historySection');

    if (documentsSection) documentsSection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';

    const hasActiveDoc = window.pdfLinguaWorkspace
      && typeof window.pdfLinguaWorkspace.getCurrentDocData === 'function'
      && Boolean(window.pdfLinguaWorkspace.getCurrentDocData());

    try {
      if (hasActiveDoc) {
        sessionStorage.setItem(ACTIVE_VIEW_KEY, 'workspace');
      } else {
        sessionStorage.removeItem(ACTIVE_VIEW_KEY);
      }
    } catch (_err) {}

    if (hasActiveDoc && workspaceSection) {
      if (heroSection) heroSection.style.display = 'none';
      workspaceSection.style.display = 'block';
      if (sideNavTranslate) setActiveNavItem(sideNavTranslate);
    } else {
      if (workspaceSection) workspaceSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
      if (sideNavHome) setActiveNavItem(sideNavHome);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth < 768) {
      closeMobileSidebar();
    }
  }

  function closeHistoryView() {
    const historySection = document.getElementById('historySection');
    if (historySection) historySection.style.display = 'none';
    closeDocumentsView();
  }

  function handleProfileClick() {
    const btnOpenAccountModal = document.getElementById('btnOpenAccountModal');
    const btnLogin = document.getElementById('btnLogin');

    let currentUser = null;
    try {
      const raw = localStorage.getItem('pdfl_user') || sessionStorage.getItem('pdfl_user');
      if (raw) currentUser = JSON.parse(raw);
    } catch (_err) {}

    if (currentUser && btnOpenAccountModal) {
      btnOpenAccountModal.click();
    } else if (btnLogin) {
      btnLogin.click();
    }

    if (window.innerWidth < 768) {
      closeMobileSidebar();
    }
  }

  function toggleSidebar() {
    setCollapsed(!isCollapsed, true);
  }

  function setCollapsed(collapsed, save = true) {
    isCollapsed = Boolean(collapsed);
    const appShell = document.getElementById('appShell');
    const appSidebar = document.getElementById('appSidebar');
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');

    if (appSidebar) {
      appSidebar.classList.toggle('collapsed', isCollapsed);
    }

    if (appShell) {
      appShell.classList.toggle('sidebar-collapsed', isCollapsed);
    }

    if (btnToggleSidebar) {
      btnToggleSidebar.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      btnToggleSidebar.setAttribute(
        'data-tooltip',
        isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'
      );
      btnToggleSidebar.setAttribute(
        'aria-label',
        isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'
      );
    }

    if (save) {
      try {
        localStorage.setItem(STORAGE_KEY, String(isCollapsed));
      } catch (_err) {}
    }
  }

  function openMobileSidebar() {
    isMobileOpen = true;
    const appSidebar = document.getElementById('appSidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    if (appSidebar) appSidebar.classList.add('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileSidebar() {
    isMobileOpen = false;
    const appSidebar = document.getElementById('appSidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    if (appSidebar) appSidebar.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  function initNavItems() {
    const sideNavHome = document.getElementById('sideNavHome');
    const sideNavTranslate = document.getElementById('sideNavTranslate');
    const sideNavAiCopilot = document.getElementById('sideNavAiCopilot');
    const sideNavAiSummarize = document.getElementById('sideNavAiSummarize');
    const sideNavDocuments = document.getElementById('sideNavDocuments');
    const sideNavHistory = document.getElementById('sideNavHistory');
    const sideNavPricing = document.getElementById('sideNavPricing');
    const sideNavAdmin = document.getElementById('sideNavAdmin');
    const btnCloseDocumentsView = document.getElementById('btnCloseDocumentsView');
    const btnCloseHistoryView = document.getElementById('btnCloseHistoryView');
    const btnDocsUploadNew = document.getElementById('btnDocsUploadNew');
    const btnHistoryUploadPrompt = document.getElementById('btnHistoryUploadPrompt');
    const btnHistoryLoginPrompt = document.getElementById('btnHistoryLoginPrompt');
    const documentsSearchInput = document.getElementById('documentsSearchInput');
    const btnDocsRetry = document.getElementById('btnDocsRetry');
    const btnDocsLoginPrompt = document.getElementById('btnDocsLoginPrompt');

    if (documentsSearchInput) {
      documentsSearchInput.addEventListener('input', () => {
        renderDocumentsPageList(cachedDocuments, cachedToken);
      });
    }

    if (btnDocsRetry) {
      btnDocsRetry.addEventListener('click', (e) => {
        e.preventDefault();
        fetchRecentDocuments();
      });
    }

    if (btnDocsLoginPrompt) {
      btnDocsLoginPrompt.addEventListener('click', (e) => {
        e.preventDefault();
        const btnLogin = document.getElementById('btnLogin');
        if (btnLogin && typeof btnLogin.click === 'function') {
          btnLogin.click();
        }
      });
    }

    if (sideNavHome) {
      sideNavHome.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToHome();
      });
    }

    if (sideNavTranslate) {
      sideNavTranslate.addEventListener('click', (e) => {
        e.preventDefault();
        const hasActiveDoc = window.pdfLinguaWorkspace
          && typeof window.pdfLinguaWorkspace.getCurrentDocData === 'function'
          && Boolean(window.pdfLinguaWorkspace.getCurrentDocData());

        if (hasActiveDoc) {
          const adminSection = document.getElementById('adminSection');
          const documentsSection = document.getElementById('documentsSection');
          const heroSection = document.getElementById('heroSection');
          const workspaceSection = document.getElementById('workspaceSection');
          if (adminSection) adminSection.style.display = 'none';
          if (documentsSection) documentsSection.style.display = 'none';
          if (heroSection) heroSection.style.display = 'none';
          if (workspaceSection) workspaceSection.style.display = 'block';
          setActiveNavItem(sideNavTranslate);
          try {
            sessionStorage.setItem(ACTIVE_VIEW_KEY, 'workspace');
          } catch (_err) {}
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          // If no document has been translated yet, prompt user and stay on Trang chủ
          if (typeof showToast === 'function') {
            showToast('Chưa có tài liệu dịch thuật nào. Vui lòng tải lên tệp PDF tại Trang chủ để bắt đầu dịch!', 'info');
          }
          navigateToHome();
        }
        if (window.innerWidth < 768) closeMobileSidebar();
      });
    }

    if (sideNavAiCopilot) {
      sideNavAiCopilot.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNavItem(sideNavAiCopilot);
        if (typeof showToast === 'function') {
          showToast('Trợ lý Hỏi đáp AI sẵn sàng giải đáp mọi thắc mắc trong tài liệu song ngữ!', 'info');
        }
        if (window.innerWidth < 768) closeMobileSidebar();
      });
    }

    if (sideNavAiSummarize) {
      sideNavAiSummarize.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNavItem(sideNavAiSummarize);
        if (typeof showToast === 'function') {
          showToast('Tính năng Tóm tắt văn bản thông minh bằng AI đang được phát triển!', 'info');
        }
        if (window.innerWidth < 768) closeMobileSidebar();
      });
    }

    if (sideNavDocuments) {
      sideNavDocuments.addEventListener('click', (e) => {
        e.preventDefault();
        openDocumentsView();
      });
    }

    if (sideNavHistory) {
      sideNavHistory.addEventListener('click', (e) => {
        e.preventDefault();
        openHistoryView();
      });
    }

    if (btnCloseDocumentsView) {
      btnCloseDocumentsView.addEventListener('click', (e) => {
        e.preventDefault();
        closeDocumentsView();
      });
    }

    if (btnCloseHistoryView) {
      btnCloseHistoryView.addEventListener('click', (e) => {
        e.preventDefault();
        closeHistoryView();
      });
    }

    if (btnDocsUploadNew) {
      btnDocsUploadNew.addEventListener('click', (e) => {
        e.preventDefault();
        triggerPdfUpload();
      });
    }

    if (btnHistoryUploadPrompt) {
      btnHistoryUploadPrompt.addEventListener('click', (e) => {
        e.preventDefault();
        triggerPdfUpload();
      });
    }

    if (btnHistoryLoginPrompt) {
      btnHistoryLoginPrompt.addEventListener('click', (e) => {
        e.preventDefault();
        handleProfileClick();
      });
    }

    if (sideNavPricing) {
      sideNavPricing.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNavItem(sideNavPricing);
        if (typeof showToast === 'function') {
          showToast('Bảng giá gói: Gói Free (20MB / 100 trang), Gói Pro VIP (100MB / 500 trang).', 'info');
        }
        if (window.innerWidth < 768) closeMobileSidebar();
      });
    }

    if (sideNavAdmin) {
      sideNavAdmin.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          sessionStorage.removeItem(ACTIVE_VIEW_KEY);
        } catch (_err) {}
        setActiveNavItem(sideNavAdmin);
        const documentsSection = document.getElementById('documentsSection');
        const historySection = document.getElementById('historySection');
        if (documentsSection) documentsSection.style.display = 'none';
        if (historySection) historySection.style.display = 'none';
        if (window.pdfLinguaAdmin && typeof window.pdfLinguaAdmin.openAdminView === 'function') {
          window.pdfLinguaAdmin.openAdminView();
        } else {
          const adminSection = document.getElementById('adminSection');
          const heroSection = document.getElementById('heroSection');
          const workspaceSection = document.getElementById('workspaceSection');
          if (workspaceSection) workspaceSection.style.display = 'none';
          if (adminSection) adminSection.style.display = 'block';
          if (heroSection) heroSection.style.display = 'none';
        }
        if (window.innerWidth < 768) closeMobileSidebar();
      });
    }

    // Top header navigation links delegation
    if (typeof document.querySelectorAll === 'function') {
      const headerNavLinks = document.querySelectorAll('.nav-menu .nav-link');
      if (headerNavLinks && typeof headerNavLinks.forEach === 'function') {
        headerNavLinks.forEach((link) => {
          link.addEventListener('click', (e) => {
            const href = typeof link.getAttribute === 'function' ? link.getAttribute('href') : null;
            if (href === '#home') {
              e.preventDefault();
              navigateToHome();
            } else if (href === '#translate') {
              e.preventDefault();
              if (sideNavTranslate) sideNavTranslate.click();
            } else if (href === '#ai-copilot') {
              e.preventDefault();
              if (sideNavAiCopilot) sideNavAiCopilot.click();
            } else if (href === '#pricing') {
              e.preventDefault();
              if (sideNavPricing) sideNavPricing.click();
            }
          });
        });
      }
    }
  }

  function setActiveNavItem(targetItem) {
    const allItems = document.querySelectorAll('.sidebar-nav-item');
    allItems.forEach((item) => item.classList.remove('active'));
    if (targetItem) targetItem.classList.add('active');

    if (typeof document.querySelectorAll === 'function') {
      const headerLinks = document.querySelectorAll('.nav-menu .nav-link');
      if (headerLinks && typeof headerLinks.forEach === 'function') {
        const targetHref = targetItem && typeof targetItem.getAttribute === 'function'
          ? targetItem.getAttribute('href')
          : null;
        headerLinks.forEach((link) => {
          const linkHref = typeof link.getAttribute === 'function' ? link.getAttribute('href') : null;
          if (targetHref && linkHref === targetHref) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    }
  }

  /**
   * Synchronize User Profile in Sidebar
   * Matches target specifications:
   * - Guest: "Khách", SVG user avatar.
   * - Pro: User name, "Gói Pro VIP" (amber/gold), initial letter avatar.
   * - Admin: Admin name, "Quản trị viên" (son red), initial letter avatar, reveal admin nav item.
   */
  function syncUserProfile(user) {
    let currentUser = user;
    if (currentUser === undefined) {
      try {
        const raw = localStorage.getItem('pdfl_user') || sessionStorage.getItem('pdfl_user');
        if (raw) currentUser = JSON.parse(raw);
      } catch (_err) {}
    }

    const appShell = document.getElementById('appShell');
    const avatarEl = document.getElementById('sidebarUserAvatar');
    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');
    const sideNavAdminItem = document.getElementById('sideNavAdminItem');
    const profileCard = document.getElementById('sidebarUserProfile');

    if (appShell) {
      appShell.classList.remove('guest-mode');
    }

    if (profileCard) {
      profileCard.setAttribute('data-tooltip', currentUser && (currentUser.email || currentUser.id) ? 'Tài khoản cá nhân' : 'Khách');
    }

    if (currentUser && (currentUser.email || currentUser.id)) {
      const displayName = currentUser.full_name || currentUser.email || 'Người dùng';
      const initial = (currentUser.full_name || currentUser.email || 'U').charAt(0).toUpperCase();
      const role = currentUser.role || 'free';

      if (avatarEl) {
        avatarEl.textContent = initial;
        if (role === 'admin') {
          avatarEl.style.background = '#FFF1F0';
          avatarEl.style.color = '#C9201C';
          avatarEl.style.borderColor = '#FFCDD2';
        } else if (role === 'pro') {
          avatarEl.style.background = '#FEF3C7';
          avatarEl.style.color = '#B45309';
          avatarEl.style.borderColor = '#FCD34D';
        } else {
          avatarEl.style.background = '#F1F5F9';
          avatarEl.style.color = '#334155';
          avatarEl.style.borderColor = '#CBD5E1';
        }
      }

      if (nameEl) nameEl.textContent = displayName;

      if (roleEl) {
        roleEl.style.display = '';
        if (role === 'admin') {
          roleEl.textContent = 'Quản trị viên';
          roleEl.style.color = '#C9201C';
        } else if (role === 'pro') {
          roleEl.textContent = 'Gói Pro VIP';
          roleEl.style.color = '#F59E0B';
        } else {
          roleEl.textContent = 'Gói Miễn phí';
          roleEl.style.color = '#64748B';
        }
      }

      if (sideNavAdminItem) {
        sideNavAdminItem.style.display = role === 'admin' ? 'block' : 'none';
      }
    } else {
      // Guest mode: default values matching white theme
      if (avatarEl) {
        avatarEl.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        `;
        avatarEl.style.background = '#F8FAFC';
        avatarEl.style.color = '#64748B';
        avatarEl.style.borderColor = '#CBD5E1';
      }

      if (nameEl) nameEl.textContent = 'Khách';
      if (roleEl) {
        roleEl.textContent = '';
        roleEl.style.display = 'none';
      }

      if (sideNavAdminItem) {
        sideNavAdminItem.style.display = 'none';
      }
    }
  }

  /**
   * Retrieve stored JWT token using existing auth mechanism
   */
  function getStoredAuthToken() {
    if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredToken === 'function') {
      const authToken = window.pdfLinguaAuth.getStoredToken();
      if (authToken && authToken !== 'null' && authToken !== 'undefined') {
        return authToken;
      }
    }
    try {
      const token = localStorage.getItem('pdfl_token') || sessionStorage.getItem('pdfl_token');
      if (token && token !== 'null' && token !== 'undefined') {
        return token;
      }
    } catch (_err) {}
    return null;
  }

  /**
   * Helper to switch UI states in #documentsSection (PDFL-92.3)
   * Supported states: 'loading' | 'empty' | 'error' | 'unauthenticated' | 'content'
   */
  function setDocumentsSectionState(state, errorMessage) {
    const tableEl = document.getElementById('documentsTable');
    const tbodyEl = document.getElementById('documentsTableBody');
    const loadingStateEl = document.getElementById('documentsLoadingState');
    const emptyStateEl = document.getElementById('documentsEmptyState');
    const errorStateEl = document.getElementById('documentsErrorState');
    const errorTextEl = document.getElementById('documentsErrorText');
    const unauthStateEl = document.getElementById('documentsUnauthState');
    const countBadge = document.getElementById('documentsCountBadge');

    if (loadingStateEl) loadingStateEl.style.display = state === 'loading' ? 'block' : 'none';
    if (emptyStateEl) emptyStateEl.style.display = state === 'empty' ? 'block' : 'none';
    if (errorStateEl) errorStateEl.style.display = state === 'error' ? 'block' : 'none';
    if (unauthStateEl) unauthStateEl.style.display = state === 'unauthenticated' ? 'block' : 'none';

    if (state === 'error' && errorTextEl && errorMessage) {
      errorTextEl.textContent = errorMessage;
    }

    if (state !== 'content') {
      if (tableEl) tableEl.style.display = 'none';
      if (tbodyEl && state !== 'loading') tbodyEl.innerHTML = '';
      if (countBadge && (state === 'unauthenticated' || state === 'error' || state === 'empty')) {
        if (state !== 'empty') {
          countBadge.textContent = '0 tài liệu';
        }
      }
    }
  }

  /**
   * Fetch and Render User Documents from Backend (PDFL-92.2 & PDFL-92.3)
   * Updates both Sidebar recent list and Main #documentsSection table.
   * Deduplicates concurrent requests for the same auth token.
   */
  async function fetchRecentDocuments() {
    const token = getStoredAuthToken();

    if (inFlightDocsPromise && inFlightToken === token) {
      return inFlightDocsPromise;
    }

    const emptyStateEl = document.getElementById('sidebarEmptyDocsState');
    let docListEl = document.getElementById('sidebarDocList');
    const container = document.getElementById('sidebarRecentDocs');

    if (container && !docListEl) {
      docListEl = document.createElement('ul');
      docListEl.className = 'sidebar-doc-list';
      docListEl.id = 'sidebarDocList';
      container.appendChild(docListEl);
    }

    if (!token) {
      // Unauthenticated State
      cachedDocuments = [];
      cachedToken = null;
      if (emptyStateEl) emptyStateEl.style.display = 'block';
      if (docListEl) {
        docListEl.style.display = 'none';
        docListEl.innerHTML = '';
      }
      const countBadge = document.getElementById('documentsCountBadge');
      if (countBadge) countBadge.textContent = '0 tài liệu';
      setDocumentsSectionState('unauthenticated');
      return Promise.resolve([]);
    }

    inFlightToken = token;
    setDocumentsSectionState('loading');

    inFlightDocsPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/documents`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          cachedDocuments = [];
          cachedToken = null;
          if (emptyStateEl) emptyStateEl.style.display = 'block';
          if (docListEl) {
            docListEl.style.display = 'none';
            docListEl.innerHTML = '';
          }
          const countBadge = document.getElementById('documentsCountBadge');
          if (countBadge) countBadge.textContent = '0 tài liệu';
          setDocumentsSectionState('unauthenticated');
          return [];
        }

        if (!response.ok) {
          let errMsg = 'Không thể tải danh sách tài liệu từ máy chủ.';
          try {
            const errData = await response.json();
            if (errData && errData.detail) errMsg = errData.detail;
          } catch (_e) {}
          throw new Error(errMsg);
        }

        const result = await response.json();
        const docs = result && Array.isArray(result.data) ? result.data : [];

        cachedDocuments = docs;
        cachedToken = token;

        if (docs.length === 0) {
          if (emptyStateEl) emptyStateEl.style.display = 'block';
          if (docListEl) {
            docListEl.style.display = 'none';
            docListEl.innerHTML = '';
          }
        } else {
          if (emptyStateEl) emptyStateEl.style.display = 'none';
          if (docListEl) {
            docListEl.style.display = 'flex';
            docListEl.innerHTML = '';

            // Display up to 8 recent documents in Sidebar
            const recentDocs = docs.slice(0, 8);
            recentDocs.forEach((doc) => {
              const item = createDocumentItem(doc, token);
              docListEl.appendChild(item);
            });
          }
        }

        renderDocumentsPageList(docs, token);
        return docs;
      } catch (err) {
        cachedDocuments = [];
        cachedToken = null;
        if (emptyStateEl) emptyStateEl.style.display = 'block';
        if (docListEl) docListEl.style.display = 'none';
        const errorMsg = (err && err.message && err.message !== 'Failed to fetch')
          ? err.message
          : 'Đã xảy ra lỗi kết nối khi tải dữ liệu từ máy chủ. Vui lòng thử lại.';
        setDocumentsSectionState('error', errorMsg);
        return [];
      } finally {
        inFlightDocsPromise = null;
        inFlightToken = null;
      }
    })();

    return inFlightDocsPromise;
  }

  /**
   * Render user documents into #documentsSection table (#documentsTableBody & #documentsCountBadge)
   */
  function renderDocumentsPageList(docs, token) {
    const countBadge = document.getElementById('documentsCountBadge');
    const tableEl = document.getElementById('documentsTable');
    const tbodyEl = document.getElementById('documentsTableBody');
    const searchInput = document.getElementById('documentsSearchInput');

    const allDocs = Array.isArray(docs) ? docs : [];
    if (countBadge) {
      countBadge.textContent = `${allDocs.length} tài liệu`;
    }

    if (!tableEl || !tbodyEl) return;

    const query = searchInput && typeof searchInput.value === 'string'
      ? searchInput.value.trim().toLowerCase()
      : '';

    const filteredDocs = query
      ? allDocs.filter((d) => String(d.original_filename || '').toLowerCase().includes(query))
      : allDocs;

    if (filteredDocs.length === 0) {
      setDocumentsSectionState('empty');
      return;
    }

    setDocumentsSectionState('content');
    tableEl.style.display = 'table';
    tbodyEl.innerHTML = '';

    filteredDocs.forEach((doc) => {
      const row = createDocumentTableRow(doc, token);
      tbodyEl.appendChild(row);
    });
  }

  function createDocumentTableRow(doc, token) {
    const tr = document.createElement('tr');
    tr.className = 'documents-table-row';
    tr.dataset.docId = String(doc.id);

    const filename = doc.original_filename || 'document.pdf';
    const formattedSize = formatFileSize(doc.file_size_bytes) || '0 B';
    const pageCount = doc.page_count !== undefined && doc.page_count !== null ? doc.page_count : 1;
    const formattedLang = formatTargetLang(doc.target_lang);
    const isOcr = Boolean(doc.is_ocr_used);
    const ocrBadgeHtml = isOcr
      ? '<span class="doc-method-badge doc-method-ocr"><span class="doc-method-dot"></span>Quét OCR</span>'
      : '<span class="doc-method-badge doc-method-digital"><span class="doc-method-dot"></span>PDF Số</span>';
    const formattedDate = formatDate(doc.created_at) || '--';

    tr.innerHTML = `
      <td>
        <div class="doc-file-cell user-cell-meta">
          <div class="doc-icon-badge" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div class="doc-file-info">
            <span class="user-cell-name doc-cell-filename" title="${escapeHtml(filename)}">${escapeHtml(filename)}</span>
          </div>
        </div>
      </td>
      <td class="font-mono doc-cell-size">${escapeHtml(formattedSize)}</td>
      <td class="doc-cell-pages"><span class="doc-count-mono">${escapeHtml(String(pageCount))}</span><span class="doc-unit"> trang</span></td>
      <td class="doc-cell-lang">${escapeHtml(formattedLang)}</td>
      <td class="doc-cell-ocr">${ocrBadgeHtml}</td>
      <td class="date-mono doc-cell-date">${escapeHtml(formattedDate)}</td>
      <td class="text-right">
        <div class="doc-row-actions user-actions-group">
          <button type="button" class="btn btn-secondary btn-sm doc-action-btn doc-table-detail-btn" title="Xem chi tiết tài liệu" aria-label="Chi tiết ${escapeHtml(filename)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Chi tiết</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm doc-action-btn doc-table-download-btn" title="Tải xuống PDF" aria-label="Tải xuống ${escapeHtml(filename)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Tải xuống</span>
          </button>
        </div>
      </td>
    `;

    const detailBtn = tr.querySelector('.doc-table-detail-btn');
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDocumentDetailModal(doc);
      });
    }

    const downloadBtn = tr.querySelector('.doc-table-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDocumentFile(doc.id, filename, token);
      });
    }

    tr.addEventListener('click', () => {
      openDocumentDetailModal(doc);
    });

    return tr;
  }

  /**
   * Initialize Document Detail Modal events (PDFL-93.1 & PDFL-93.3)
   */
  function initDocumentDetailModal() {
    const modalEl = document.getElementById('documentDetailModal');
    const btnCloseTop = document.getElementById('btnCloseDocumentDetailModal');
    const btnCloseFooter = document.getElementById('btnCloseDocumentDetailFooter');
    const btnDownload = document.getElementById('btnDocDetailDownload');
    const btnDelete = document.getElementById('btnDocDetailDelete');

    if (btnCloseTop) {
      btnCloseTop.addEventListener('click', (e) => {
        e.preventDefault();
        closeDocumentDetailModal();
      });
    }

    if (btnCloseFooter) {
      btnCloseFooter.addEventListener('click', (e) => {
        e.preventDefault();
        closeDocumentDetailModal();
      });
    }

    if (modalEl) {
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
          closeDocumentDetailModal();
        }
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener('click', (e) => {
        e.preventDefault();
        handleDocumentDetailDownload();
      });
    }

    if (btnDelete) {
      btnDelete.addEventListener('click', (e) => {
        e.preventDefault();
        handleDocumentDetailDeleteIntent();
      });
    }
  }

  /**
   * Update loading UI state for #btnDocDetailDownload (PDFL-93.3)
   */
  function setDetailDownloadLoadingState(loading) {
    isDetailDownloading = Boolean(loading);
    const btnDownload = document.getElementById('btnDocDetailDownload');
    const spinnerEl = document.getElementById('docDetailDownloadSpinner');
    const iconEl = document.getElementById('docDetailDownloadIcon');
    const textEl = document.getElementById('docDetailDownloadText');

    if (spinnerEl) spinnerEl.style.display = isDetailDownloading ? 'inline-block' : 'none';
    if (iconEl) iconEl.style.display = isDetailDownloading ? 'none' : '';
    if (textEl) textEl.textContent = isDetailDownloading ? 'Đang tải xuống...' : 'Tải xuống PDF';

    if (btnDownload) {
      if (isDetailDownloading) {
        btnDownload.disabled = true;
      } else {
        const hasValidOpenDoc = Boolean(
          isDocDetailOpen &&
          currentDetailDoc &&
          currentDetailDoc.id !== undefined &&
          currentDetailDoc.id !== null &&
          currentDetailDoc.id !== ''
        );
        btnDownload.disabled = !hasValidOpenDoc;
      }
    }
  }

  /**
   * Handle download action inside Document Detail Modal (PDFL-93.3)
   * Guarantees downloading the exact currently open document ID and handles missing auth/ID or errors.
   */
  async function handleDocumentDetailDownload() {
    if (!isDocDetailOpen || isDetailDownloading) {
      return false;
    }

    const activeDoc = currentDetailDoc;
    const docId = activeDoc && activeDoc.id !== undefined && activeDoc.id !== null && activeDoc.id !== ''
      ? activeDoc.id
      : null;

    if (docId === null) {
      setDocumentDetailModalState('error', 'Không xác định được ID tài liệu để tải xuống.');
      if (typeof showToast === 'function') {
        showToast('Không xác định được ID tài liệu để tải xuống.', 'error');
      }
      return false;
    }

    const token = getStoredAuthToken();
    if (!token) {
      const alertEl = document.getElementById('documentDetailAlert');
      if (alertEl) {
        alertEl.style.display = 'flex';
        alertEl.textContent = 'Vui lòng đăng nhập để tải xuống tài liệu PDF.';
      }
      if (typeof showToast === 'function') {
        showToast('Vui lòng đăng nhập để tải xuống tài liệu PDF.', 'error');
      }
      return false;
    }

    const requestSeqAtStart = detailRequestSequence;
    const filename = activeDoc.original_filename || `document_${docId}.pdf`;

    setDetailDownloadLoadingState(true);

    try {
      const ok = await downloadDocumentFile(docId, filename, token);
      if (requestSeqAtStart === detailRequestSequence && isDocDetailOpen) {
        setDetailDownloadLoadingState(false);
        if (!ok) {
          const alertEl = document.getElementById('documentDetailAlert');
          if (alertEl) {
            alertEl.style.display = 'flex';
            alertEl.textContent = 'Không thể tải xuống tệp PDF. Vui lòng thử lại sau.';
          }
        }
      }
      return ok;
    } catch (_err) {
      if (requestSeqAtStart === detailRequestSequence && isDocDetailOpen) {
        setDetailDownloadLoadingState(false);
      }
      return false;
    }
  }

  /**
   * Integration hook for #btnDocDetailDelete (PDFL-93.3 -> PDFL-94.2)
   * Dispatches pdfl:document-delete-intent to open the Delete Confirmation Modal.
   */
  function handleDocumentDetailDeleteIntent() {
    if (!isDocDetailOpen || !currentDetailDoc || currentDetailDoc.id === undefined || currentDetailDoc.id === null) {
      return null;
    }

    const targetPayload = {
      id: currentDetailDoc.id,
      original_filename: currentDetailDoc.original_filename || `document_${currentDetailDoc.id}.pdf`,
    };

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('pdfl:document-delete-intent', {
          detail: targetPayload,
        })
      );
    } else {
      openDocumentDeleteConfirmModal(targetPayload);
    }

    return targetPayload;
  }

  /**
   * Initialize Document Delete Confirmation Modal events and pdfl:document-delete-intent listener (PDFL-94.2)
   */
  function initDocumentDeleteConfirmModal() {
    const confirmModalEl = document.getElementById('documentDeleteConfirmModal');
    const btnCancel = document.getElementById('btnCancelDocDelete');
    const btnConfirm = document.getElementById('btnConfirmDocDelete');

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pdfl:document-delete-intent', (e) => {
        const target = e && e.detail ? e.detail : null;
        if (target && target.id !== undefined && target.id !== null) {
          openDocumentDeleteConfirmModal(target);
        }
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isDocDeleting) {
          closeDocumentDeleteConfirmModal();
        }
      });
    }

    if (btnConfirm) {
      btnConfirm.addEventListener('click', (e) => {
        e.preventDefault();
        confirmDocumentDelete();
      });
    }

    if (confirmModalEl) {
      confirmModalEl.addEventListener('click', (e) => {
        if (e.target === confirmModalEl && !isDocDeleting) {
          closeDocumentDeleteConfirmModal();
        }
      });
    }
  }

  /**
   * Toggle loading state inside #documentDeleteConfirmModal and prevent double-clicks (PDFL-94.2)
   */
  function setDocumentDeleteLoadingState(loading) {
    isDocDeleting = Boolean(loading);
    const btnConfirm = document.getElementById('btnConfirmDocDelete');
    const btnCancel = document.getElementById('btnCancelDocDelete');
    const spinnerEl = document.getElementById('docDeleteSpinner');
    const btnTextEl = document.getElementById('docDeleteBtnText');

    if (btnConfirm) btnConfirm.disabled = isDocDeleting;
    if (btnCancel) btnCancel.disabled = isDocDeleting;
    if (spinnerEl) spinnerEl.style.display = isDocDeleting ? 'inline-block' : 'none';
    if (btnTextEl) btnTextEl.textContent = isDocDeleting ? 'Đang xóa...' : 'Xác nhận xóa';
  }

  /**
   * Open Document Delete Confirmation Modal with target document filename and irreversible warning (PDFL-94.2)
   */
  function openDocumentDeleteConfirmModal(docTarget) {
    const confirmModalEl = document.getElementById('documentDeleteConfirmModal');
    if (!confirmModalEl || !docTarget || docTarget.id === undefined || docTarget.id === null) {
      return;
    }

    pendingDeleteDoc = {
      id: docTarget.id,
      original_filename: docTarget.original_filename || `document_${docTarget.id}.pdf`,
    };
    isDocDeleteConfirmOpen = true;
    setDocumentDeleteLoadingState(false);

    const filenameEl = document.getElementById('docDeleteConfirmFilename');
    const alertEl = document.getElementById('docDeleteConfirmAlert');

    if (filenameEl) {
      filenameEl.textContent = pendingDeleteDoc.original_filename;
    }
    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.textContent = '';
    }

    confirmModalEl.removeAttribute('hidden');
    confirmModalEl.style.display = 'flex';
  }

  /**
   * Close Document Delete Confirmation Modal without mutating document data (PDFL-94.2)
   */
  function closeDocumentDeleteConfirmModal() {
    const confirmModalEl = document.getElementById('documentDeleteConfirmModal');
    isDocDeleteConfirmOpen = false;
    pendingDeleteDoc = null;
    setDocumentDeleteLoadingState(false);

    const alertEl = document.getElementById('docDeleteConfirmAlert');
    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.textContent = '';
    }

    if (confirmModalEl) {
      confirmModalEl.setAttribute('hidden', '');
      confirmModalEl.style.display = 'none';
    }
  }

  /**
   * Sync Sidebar recent list and #documentsSection table after removing a document locally (PDFL-94.2)
   */
  function removeDocumentFromLocalLists(deletedDocId) {
    cachedDocuments = cachedDocuments.filter((d) => String(d.id) !== String(deletedDocId));
    const token = getStoredAuthToken() || cachedToken;

    const emptyStateEl = document.getElementById('sidebarEmptyDocsState');
    let docListEl = document.getElementById('sidebarDocList');
    const container = document.getElementById('sidebarRecentDocs');

    if (container && !docListEl) {
      docListEl = document.createElement('ul');
      docListEl.className = 'sidebar-doc-list';
      docListEl.id = 'sidebarDocList';
      container.appendChild(docListEl);
    }

    if (cachedDocuments.length === 0) {
      if (emptyStateEl) emptyStateEl.style.display = 'block';
      if (docListEl) {
        docListEl.style.display = 'none';
        docListEl.innerHTML = '';
      }
    } else {
      if (emptyStateEl) emptyStateEl.style.display = 'none';
      if (docListEl) {
        docListEl.style.display = 'flex';
        docListEl.innerHTML = '';
        const recentDocs = cachedDocuments.slice(0, 8);
        recentDocs.forEach((doc) => {
          const item = createDocumentItem(doc, token);
          docListEl.appendChild(item);
        });
      }
    }

    renderDocumentsPageList(cachedDocuments, token);
  }

  /**
   * Execute DELETE /api/documents/{document_id} on user confirmation (PDFL-94.2)
   */
  async function confirmDocumentDelete() {
    if (!isDocDeleteConfirmOpen || isDocDeleting || !pendingDeleteDoc || pendingDeleteDoc.id === undefined || pendingDeleteDoc.id === null) {
      return false;
    }

    const targetId = pendingDeleteDoc.id;
    const targetFilename = pendingDeleteDoc.original_filename || `document_${targetId}.pdf`;
    const alertEl = document.getElementById('docDeleteConfirmAlert');

    const token = getStoredAuthToken();
    if (!token) {
      const msg = 'Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập (401). Vui lòng đăng nhập lại.';
      if (alertEl) {
        alertEl.style.display = 'flex';
        alertEl.textContent = msg;
      }
      if (typeof showToast === 'function') {
        showToast(msg, 'error');
      }
      return false;
    }

    setDocumentDeleteLoadingState(true);
    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.textContent = '';
    }

    // Persist active Documents view before DELETE request so any Live Server file-watcher reload stays on Documents page
    try {
      sessionStorage.setItem(ACTIVE_VIEW_KEY, 'documents');
      sessionStorage.setItem(
        PENDING_TOAST_KEY,
        JSON.stringify({ msg: `Đã xóa tài liệu "${targetFilename}" thành công.`, type: 'success', ts: Date.now() })
      );
    } catch (_err) {}

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        try { sessionStorage.removeItem(PENDING_TOAST_KEY); } catch (_e) {}
        const msg = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn (401). Vui lòng đăng nhập lại.';
        setDocumentDeleteLoadingState(false);
        if (alertEl) {
          alertEl.style.display = 'flex';
          alertEl.textContent = msg;
        }
        if (typeof showToast === 'function') {
          showToast(msg, 'error');
        }
        return false;
      }

      if (response.status === 404) {
        try { sessionStorage.removeItem(PENDING_TOAST_KEY); } catch (_e) {}
        let msg = 'Tài liệu không tồn tại hoặc bạn không có quyền xóa (404).';
        try {
          const errData = await response.json();
          if (errData && (errData.detail || errData.message)) {
            msg = errData.detail || errData.message;
          }
        } catch (_e) {}
        setDocumentDeleteLoadingState(false);
        if (alertEl) {
          alertEl.style.display = 'flex';
          alertEl.textContent = msg;
        }
        if (typeof showToast === 'function') {
          showToast(msg, 'error');
        }
        return false;
      }

      if (!response.ok) {
        try { sessionStorage.removeItem(PENDING_TOAST_KEY); } catch (_e) {}
        let msg = 'Lỗi máy chủ khi xóa tài liệu. Vui lòng thử lại.';
        try {
          const errData = await response.json();
          if (errData && (errData.detail || errData.message)) {
            msg = errData.detail || errData.message;
          }
        } catch (_e) {}
        setDocumentDeleteLoadingState(false);
        if (alertEl) {
          alertEl.style.display = 'flex';
          alertEl.textContent = msg;
        }
        if (typeof showToast === 'function') {
          showToast(msg, 'error');
        }
        return false;
      }

      let successMessage = `Đã xóa tài liệu "${targetFilename}" thành công.`;
      try {
        const result = await response.json();
        if (result && result.message) {
          successMessage = result.message;
        }
      } catch (_e) {}

      // Only on successful DELETE:
      // 1. Close Delete Confirmation Modal and Detail Modal
      closeDocumentDeleteConfirmModal();
      closeDocumentDetailModal();

      // 2. Remove deleted document from current list & update count badge
      removeDocumentFromLocalLists(targetId);

      // 3. Keep user on the Documents page (#documentsSection) after deletion (not Translate or Home)
      try {
        sessionStorage.setItem(ACTIVE_VIEW_KEY, 'documents');
      } catch (_err) {}
      const sideNavDocuments = document.getElementById('sideNavDocuments');
      const heroSection = document.getElementById('heroSection');
      const workspaceSection = document.getElementById('workspaceSection');
      const adminSection = document.getElementById('adminSection');
      const documentsSection = document.getElementById('documentsSection');
      if (sideNavDocuments) setActiveNavItem(sideNavDocuments);
      if (heroSection) heroSection.style.display = 'none';
      if (workspaceSection) workspaceSection.style.display = 'none';
      if (adminSection) adminSection.style.display = 'none';
      if (documentsSection) documentsSection.style.display = 'block';

      // 4. Display success toast notification
      if (typeof showToast === 'function') {
        showToast(successMessage, 'success');
      }

      return true;
    } catch (err) {
      try { sessionStorage.removeItem(PENDING_TOAST_KEY); } catch (_e) {}
      setDocumentDeleteLoadingState(false);
      const msg = (err && err.message && err.message !== 'Failed to fetch')
        ? err.message
        : 'Không thể kết nối tới máy chủ để xóa tài liệu. Vui lòng kiểm tra mạng và thử lại.';
      if (alertEl) {
        alertEl.style.display = 'flex';
        alertEl.textContent = msg;
      }
      if (typeof showToast === 'function') {
        showToast(msg, 'error');
      }
      return false;
    }
  }

  /**
   * Reset all 7 metadata display fields in #documentDetailModal to prevent stale data (PDFL-93.2)
   */
  function resetDocumentDetailMetadata() {
    const heroFilenameEl = document.getElementById('docDetailHeroFilename');
    const heroSubEl = document.getElementById('docDetailHeroSub');
    const filenameEl = document.getElementById('docDetailFilename');
    const idEl = document.getElementById('docDetailId');
    const sizeEl = document.getElementById('docDetailSize');
    const pageCountEl = document.getElementById('docDetailPageCount');
    const targetLangEl = document.getElementById('docDetailTargetLang');
    const ocrStatusEl = document.getElementById('docDetailOcrStatus');
    const createdAtEl = document.getElementById('docDetailCreatedAt');
    const btnDownload = document.getElementById('btnDocDetailDownload');
    const btnDelete = document.getElementById('btnDocDetailDelete');

    if (heroFilenameEl) heroFilenameEl.textContent = '---';
    if (heroSubEl) heroSubEl.textContent = 'Mã tài liệu: #---';
    if (filenameEl) filenameEl.textContent = '---';
    if (idEl) idEl.textContent = '---';
    if (sizeEl) sizeEl.textContent = '---';
    if (pageCountEl) pageCountEl.textContent = '---';
    if (targetLangEl) targetLangEl.textContent = '---';
    if (ocrStatusEl) ocrStatusEl.innerHTML = '---';
    if (createdAtEl) createdAtEl.textContent = '---';
    if (btnDownload && btnDownload.dataset) delete btnDownload.dataset.docId;
    if (btnDelete && btnDelete.dataset) delete btnDelete.dataset.docId;
  }

  /**
   * Render document metadata into the 7 fields of #documentDetailModal (PDFL-93.1 & PDFL-93.2)
   */
  function populateDocumentDetailMetadata(targetDoc) {
    const docData = targetDoc || {};
    const filename = docData.original_filename || 'document.pdf';
    const docIdText = docData.id !== undefined && docData.id !== null ? `#${docData.id}` : '---';
    const formattedSize = formatFileSize(docData.file_size_bytes) || '0 B';
    const pageCountVal = docData.page_count !== undefined && docData.page_count !== null
      ? `${docData.page_count} trang`
      : '1 trang';
    const formattedLang = formatTargetLang(docData.target_lang);
    const isOcr = Boolean(docData.is_ocr_used);
    const formattedDate = formatDate(docData.created_at) || '---';

    const heroFilenameEl = document.getElementById('docDetailHeroFilename');
    const heroSubEl = document.getElementById('docDetailHeroSub');
    const filenameEl = document.getElementById('docDetailFilename');
    const idEl = document.getElementById('docDetailId');
    const sizeEl = document.getElementById('docDetailSize');
    const pageCountEl = document.getElementById('docDetailPageCount');
    const targetLangEl = document.getElementById('docDetailTargetLang');
    const ocrStatusEl = document.getElementById('docDetailOcrStatus');
    const createdAtEl = document.getElementById('docDetailCreatedAt');
    const btnDownload = document.getElementById('btnDocDetailDownload');
    const btnDelete = document.getElementById('btnDocDetailDelete');

    if (heroFilenameEl) heroFilenameEl.textContent = filename;
    if (heroSubEl) heroSubEl.textContent = `Mã tài liệu: ${docIdText}`;
    if (filenameEl) filenameEl.textContent = filename;
    if (idEl) idEl.textContent = docIdText;
    if (sizeEl) sizeEl.textContent = formattedSize;
    if (pageCountEl) pageCountEl.textContent = pageCountVal;
    if (targetLangEl) targetLangEl.textContent = formattedLang;
    if (ocrStatusEl) {
      ocrStatusEl.innerHTML = isOcr
        ? '<span class="meta-pill ocr">Quét OCR</span>'
        : '<span class="meta-pill digital">PDF Số</span>';
    }
    if (createdAtEl) createdAtEl.textContent = formattedDate;

    if (btnDownload && docData.id !== undefined && docData.id !== null) {
      btnDownload.dataset.docId = String(docData.id);
    }
    if (btnDelete && docData.id !== undefined && docData.id !== null) {
      btnDelete.dataset.docId = String(docData.id);
    }
  }

  /**
   * Toggle UI states inside #documentDetailModal: 'loading' | 'content' | 'error' (PDFL-93.2)
   */
  function setDocumentDetailModalState(state, errorMessage) {
    const loadingEl = document.getElementById('documentDetailLoading');
    const alertEl = document.getElementById('documentDetailAlert');
    const contentEl = document.getElementById('documentDetailContent');
    const btnDownload = document.getElementById('btnDocDetailDownload');
    const btnDelete = document.getElementById('btnDocDetailDelete');

    if (loadingEl) loadingEl.style.display = state === 'loading' ? 'flex' : 'none';
    if (contentEl) contentEl.style.display = state === 'content' ? 'block' : 'none';

    if (alertEl) {
      if (state === 'error') {
        alertEl.style.display = 'flex';
        alertEl.textContent = errorMessage || 'Không thể tải thông tin chi tiết tài liệu.';
      } else {
        alertEl.style.display = 'none';
        alertEl.textContent = '';
      }
    }

    const disableActions = state !== 'content';
    if (btnDownload) btnDownload.disabled = disableActions;
    if (btnDelete) btnDelete.disabled = disableActions;
  }

  /**
   * Open Document Detail Modal and fetch latest detail from GET /api/documents/{document_id}
   * Prevents stale metadata display and out-of-order response overwriting (PDFL-93.1 & PDFL-93.2)
   */
  async function openDocumentDetailModal(docOrId) {
    const modalEl = document.getElementById('documentDetailModal');
    if (!modalEl) return null;

    const isObj = docOrId && typeof docOrId === 'object';
    const docId = isObj ? docOrId.id : docOrId;

    detailRequestSequence += 1;
    const requestSeq = detailRequestSequence;

    isDocDetailOpen = true;
    currentDetailDoc = null;
    setDetailDownloadLoadingState(false);

    // Clear previous document metadata immediately so old data is never shown
    resetDocumentDetailMetadata();

    modalEl.removeAttribute('hidden');
    modalEl.style.display = 'flex';

    const token = getStoredAuthToken() || cachedToken;

    // Fallback when invoked without a valid token and with a static object (offline/UI-only preview)
    if (!token) {
      if (isObj && docOrId.original_filename && !cachedToken) {
        currentDetailDoc = docOrId;
        populateDocumentDetailMetadata(docOrId);
        setDocumentDetailModalState('content');
        return docOrId;
      }
      setDocumentDetailModalState('error', 'Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Vui lòng đăng nhập lại.');
      return null;
    }

    if (docId === undefined || docId === null || docId === '') {
      setDocumentDetailModalState('error', 'Không xác định được ID tài liệu.');
      return null;
    }

    setDocumentDetailModalState('loading');

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(docId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Discard out-of-order response or if modal was closed
      if (requestSeq !== detailRequestSequence || !isDocDetailOpen) {
        return null;
      }

      if (response.status === 401) {
        resetDocumentDetailMetadata();
        setDocumentDetailModalState('error', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn (401). Vui lòng đăng nhập lại.');
        return null;
      }

      if (response.status === 404) {
        resetDocumentDetailMetadata();
        setDocumentDetailModalState('error', 'Tài liệu không tồn tại hoặc bạn không có quyền truy cập (404).');
        return null;
      }

      if (!response.ok) {
        let errMsg = 'Lỗi máy chủ khi tải thông tin chi tiết tài liệu.';
        try {
          const errData = await response.json();
          if (errData && errData.detail) errMsg = errData.detail;
        } catch (_e) {}
        resetDocumentDetailMetadata();
        setDocumentDetailModalState('error', errMsg);
        return null;
      }

      const result = await response.json();

      // Re-check sequence after awaiting JSON parsing
      if (requestSeq !== detailRequestSequence || !isDocDetailOpen) {
        return null;
      }

      const detailData = result && result.data ? result.data : (isObj ? docOrId : null);
      if (!detailData || typeof detailData !== 'object') {
        resetDocumentDetailMetadata();
        setDocumentDetailModalState('error', 'Dữ liệu tài liệu trả về không hợp lệ.');
        return null;
      }

      currentDetailDoc = detailData;
      populateDocumentDetailMetadata(detailData);
      setDocumentDetailModalState('content');
      return detailData;
    } catch (err) {
      if (requestSeq !== detailRequestSequence || !isDocDetailOpen) {
        return null;
      }
      resetDocumentDetailMetadata();
      const errMsg = err && err.message
        ? err.message
        : 'Không thể kết nối tới máy chủ để lấy chi tiết tài liệu.';
      setDocumentDetailModalState('error', errMsg);
      return null;
    }
  }

  /**
   * Close Document Detail Modal (PDFL-93.1, PDFL-93.2 & PDFL-93.3)
   */
  function closeDocumentDetailModal() {
    const modalEl = document.getElementById('documentDetailModal');
    detailRequestSequence += 1;
    isDocDetailOpen = false;
    currentDetailDoc = null;
    setDetailDownloadLoadingState(false);
    resetDocumentDetailMetadata();

    if (modalEl) {
      modalEl.setAttribute('hidden', '');
      modalEl.style.display = 'none';
    }
  }

  function formatTargetLang(code) {
    if (!code) return 'Tiếng Việt (vi)';
    const names = {
      vi: 'Tiếng Việt',
      en: 'Tiếng Anh',
      fr: 'Tiếng Pháp',
      zh: 'Tiếng Trung',
      'zh-CN': 'Tiếng Trung',
      ja: 'Tiếng Nhật',
      ko: 'Tiếng Hàn',
      de: 'Tiếng Đức',
      es: 'Tiếng Tây Ban Nha',
      ru: 'Tiếng Nga',
    };
    const label = names[code];
    return label ? `${label} (${code})` : String(code);
  }

  function createDocumentItem(doc, token) {
    const li = document.createElement('li');
    li.className = 'sidebar-doc-item';
    li.dataset.docId = String(doc.id);
    li.setAttribute('data-tooltip', doc.original_filename || 'Tài liệu PDF');

    const formattedDate = formatDate(doc.created_at);
    const formattedSize = formatFileSize(doc.file_size_bytes);
    const metaText = formattedDate && formattedSize ? `${formattedDate} • ${formattedSize}` : (formattedDate || formattedSize);

    li.innerHTML = `
      <span class="sidebar-doc-icon">PDF</span>
      <div class="sidebar-doc-info">
        <span class="sidebar-doc-name" title="${escapeHtml(doc.original_filename)}">${escapeHtml(doc.original_filename)}</span>
        <span class="sidebar-doc-meta">${escapeHtml(metaText)}</span>
      </div>
      <button type="button" class="sidebar-doc-download-btn" title="Tải xuống PDF" aria-label="Tải xuống ${escapeHtml(doc.original_filename)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
    `;

    const downloadBtn = li.querySelector('.sidebar-doc-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDocumentFile(doc.id, doc.original_filename, token);
      });
    }

    li.addEventListener('click', () => {
      downloadDocumentFile(doc.id, doc.original_filename, token);
    });

    return li;
  }

  async function downloadDocumentFile(docId, filename, token) {
    if (docId === undefined || docId === null || docId === '') {
      if (typeof showToast === 'function') {
        showToast('Không xác định được ID tài liệu để tải xuống!', 'error');
      }
      return false;
    }

    try {
      if (typeof showToast === 'function') {
        showToast(`Đang tải xuống tài liệu ${filename}...`, 'info');
      }

      const response = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(docId)}/download`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error('Tải xuống thất bại');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `document_${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      if (typeof a.remove === 'function') {
        a.remove();
      }
      window.URL.revokeObjectURL(url);
      return true;
    } catch (_err) {
      if (typeof showToast === 'function') {
        showToast('Có lỗi xảy ra khi tải xuống tệp PDF!', 'error');
      }
      return false;
    }
  }

  function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (_e) {
      return '';
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

  // ── Processing History Controller (PDFL-164.2) ──────────────────────────
  let cachedHistories = [];
  let cachedHistoryToken = null;
  let historyCurrentPage = 1;
  const HISTORY_PAGE_SIZE = 10;
  let hasNextHistoryPage = false;
  let historyRequestSequence = 0;
  let isHistoryListenersInitialized = false;

  /**
   * Helper to switch UI states in #historySection (PDFL-164.2)
   * Supported states: 'loading' | 'empty' | 'error' | 'unauthenticated' | 'content'
   */
  function setHistorySectionState(state, errorMessage) {
    const tableEl = document.getElementById('historyTable');
    const loadingStateEl = document.getElementById('historyLoadingState');
    const emptyStateEl = document.getElementById('historyEmptyState');
    const errorStateEl = document.getElementById('historyErrorState');
    const errorTextEl = document.getElementById('historyErrorText');
    const unauthStateEl = document.getElementById('historyUnauthState');
    const paginationFooterEl = document.getElementById('historyPaginationFooter');

    if (loadingStateEl) loadingStateEl.style.display = state === 'loading' ? 'block' : 'none';
    if (emptyStateEl) emptyStateEl.style.display = state === 'empty' ? 'block' : 'none';
    if (errorStateEl) errorStateEl.style.display = state === 'error' ? 'block' : 'none';
    if (unauthStateEl) unauthStateEl.style.display = state === 'unauthenticated' ? 'block' : 'none';

    if (state === 'error' && errorTextEl && errorMessage) {
      errorTextEl.textContent = errorMessage;
    }

    if (state !== 'content') {
      if (tableEl) tableEl.style.display = 'none';
      if (paginationFooterEl) paginationFooterEl.style.display = 'none';
    }
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '--';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes} - ${day}/${month}/${year}`;
    } catch (_e) {
      return '--';
    }
  }

  function formatExecutionTime(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return '--';
    const num = Number(ms);
    if (num < 0) return '--';
    if (num >= 1000) {
      return (num / 1000).toFixed(2) + 's';
    }
    return num + ' ms';
  }

  /**
   * Fetch paginated processing histories from GET /api/history (PDFL-164.2)
   */
  async function fetchProcessingHistories() {
    const token = getStoredAuthToken();
    const countBadge = document.getElementById('historyCountBadge');
    const btnRefresh = document.getElementById('btnHistoryRefresh');
    const actionFilterEl = document.getElementById('historyActionFilter');
    const statusFilterEl = document.getElementById('historyStatusFilter');

    if (!token) {
      cachedHistories = [];
      cachedHistoryToken = null;
      if (countBadge) countBadge.textContent = '0 bản ghi';
      setHistorySectionState('unauthenticated');
      return Promise.resolve([]);
    }

    const actionType = actionFilterEl && actionFilterEl.value !== 'all' ? actionFilterEl.value : null;
    const status = statusFilterEl && statusFilterEl.value !== 'all' ? statusFilterEl.value : null;

    const skip = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE;
    const fetchLimit = HISTORY_PAGE_SIZE + 1; // Fetch 1 extra to detect next page

    let queryParts = [
      `skip=${encodeURIComponent(skip)}`,
      `limit=${encodeURIComponent(fetchLimit)}`,
    ];
    if (actionType) queryParts.push(`action_type=${encodeURIComponent(actionType)}`);
    if (status) queryParts.push(`status=${encodeURIComponent(status)}`);
    const queryString = queryParts.join('&');

    const requestSeq = ++historyRequestSequence;
    setHistorySectionState('loading');
    if (btnRefresh && btnRefresh.classList) btnRefresh.classList.add('loading');

    try {
      const response = await fetch(`${API_BASE_URL}/api/history?${queryString}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (requestSeq !== historyRequestSequence) {
        return []; // Ignore out-of-order response
      }

      if (response.status === 401) {
        cachedHistories = [];
        cachedHistoryToken = null;
        if (countBadge) countBadge.textContent = '0 bản ghi';
        setHistorySectionState('unauthenticated');
        return [];
      }

      if (!response.ok) {
        let errMsg = 'Không thể tải lịch sử xử lý từ máy chủ.';
        try {
          const errData = await response.json();
          if (errData && (errData.detail || errData.message)) {
            errMsg = errData.detail || errData.message;
          }
        } catch (_e) {}
        throw new Error(errMsg);
      }

      const result = await response.json();
      const rawList = result && Array.isArray(result.data) ? result.data : [];

      hasNextHistoryPage = rawList.length > HISTORY_PAGE_SIZE;
      const pageRecords = hasNextHistoryPage ? rawList.slice(0, HISTORY_PAGE_SIZE) : rawList;

      cachedHistories = pageRecords;
      cachedHistoryToken = token;

      renderHistoryPageList(cachedHistories, token);
      return cachedHistories;
    } catch (err) {
      if (requestSeq !== historyRequestSequence) {
        return [];
      }
      cachedHistories = [];
      cachedHistoryToken = null;
      if (countBadge) countBadge.textContent = '0 bản ghi';
      const errorMsg = (err && err.message && err.message !== 'Failed to fetch')
        ? err.message
        : 'Đã xảy ra lỗi kết nối khi tải dữ liệu từ máy chủ. Vui lòng thử lại.';
      setHistorySectionState('error', errorMsg);
      return [];
    } finally {
      if (btnRefresh && btnRefresh.classList) btnRefresh.classList.remove('loading');
    }
  }

  /**
   * Render history list into #historyTable (#historyTableBody & #historyCountBadge)
   */
  function renderHistoryPageList(records, token) {
    const tableEl = document.getElementById('historyTable');
    const tbodyEl = document.getElementById('historyTableBody');
    const countBadge = document.getElementById('historyCountBadge');
    const searchInput = document.getElementById('historySearchInput');
    const emptyTitleEl = document.getElementById('historyEmptyTitle');
    const emptyTextEl = document.getElementById('historyEmptyText');
    const paginationFooterEl = document.getElementById('historyPaginationFooter');
    const paginationInfoEl = document.getElementById('historyPaginationInfo');
    const currentPageBadge = document.getElementById('historyCurrentPageBadge');
    const btnPrevPage = document.getElementById('btnHistoryPrevPage');
    const btnNextPage = document.getElementById('btnHistoryNextPage');

    const rawList = Array.isArray(records) ? records : [];
    const query = searchInput && typeof searchInput.value === 'string'
      ? searchInput.value.trim().toLowerCase()
      : '';

    // Client-side search filtering by filename
    const filtered = query
      ? rawList.filter((item) => String(item.document_filename || '').toLowerCase().includes(query))
      : rawList;

    if (countBadge) {
      countBadge.textContent = `${filtered.length} bản ghi`;
    }

    if (filtered.length === 0) {
      if (emptyTitleEl && emptyTextEl) {
        if (query) {
          emptyTitleEl.textContent = 'Không tìm thấy bản ghi';
          emptyTextEl.textContent = `Không có bản ghi lịch sử nào khớp với từ khóa "${query}".`;
        } else {
          emptyTitleEl.textContent = 'Bạn chưa có lịch sử xử lý nào';
          emptyTextEl.textContent = 'Các thao tác trích xuất và dịch tài liệu PDF của bạn sẽ được tự động ghi nhận tại đây.';
        }
      }
      setHistorySectionState('empty');
      return;
    }

    setHistorySectionState('content');
    if (tableEl) tableEl.style.display = 'table';
    if (tbodyEl) tbodyEl.innerHTML = '';

    filtered.forEach((rec) => {
      const row = createHistoryTableRow(rec, token);
      if (tbodyEl) tbodyEl.appendChild(row);
    });

    // Update pagination controls
    if (paginationFooterEl) paginationFooterEl.style.display = 'flex';
    if (currentPageBadge) currentPageBadge.textContent = String(historyCurrentPage);
    if (btnPrevPage) btnPrevPage.disabled = historyCurrentPage <= 1;
    if (btnNextPage) btnNextPage.disabled = !hasNextHistoryPage;

    if (paginationInfoEl) {
      const startItem = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE + 1;
      const endItem = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE + filtered.length;
      paginationInfoEl.textContent = `Hiển thị ${startItem} - ${endItem} bản ghi (Trang ${historyCurrentPage})`;
    }
  }

  function createHistoryTableRow(record, token) {
    const tr = document.createElement('tr');
    tr.className = 'history-table-row';
    tr.dataset.historyId = String(record.id);

    const filename = record.document_filename || ('Tài liệu #' + record.document_id);
    const actionType = String(record.action_type || 'EXTRACT').toUpperCase();
    const status = String(record.status || 'PENDING').toUpperCase();
    const executionTime = formatExecutionTime(record.execution_time_ms);
    const formattedDate = formatDateTime(record.created_at);

    // Action Badge
    let actionBadgeHtml = '';
    if (actionType === 'TRANSLATE') {
      actionBadgeHtml = '<span class="badge-sub pro font-mono">Dịch thuật</span>';
    } else if (actionType === 'SUMMARIZE') {
      actionBadgeHtml = '<span class="badge-sub font-mono" style="background: #F0FDF4; color: #166534;">Tóm tắt</span>';
    } else {
      actionBadgeHtml = '<span class="badge-sub font-mono" style="background: #F1F5F9; color: #334155;">Trích xuất</span>';
    }

    // Status Badge & Action Buttons
    let statusBadgeHtml = '';
    let actionBtnHtml = '';

    if (status === 'SUCCESS') {
      statusBadgeHtml = '<span class="status-pill active" title="Thao tác hoàn tất thành công"><span class="status-dot"></span>Thành công</span>';
      actionBtnHtml = `
        <button type="button" class="doc-action-btn doc-table-download-btn history-btn-reopen" data-history-id="${record.id}" data-doc-id="${record.document_id}" title="Mở lại kết quả">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span>Xem kết quả</span>
        </button>
      `;
    } else if (status === 'FAILED') {
      statusBadgeHtml = `
        <span class="status-pill locked history-status-pill-failed" data-history-id="${record.id}" style="cursor: pointer;" title="Nhấn để xem chi tiết lỗi">
          <svg class="status-lock-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          Thất bại
        </span>
      `;
      actionBtnHtml = `
        <button type="button" class="doc-action-btn history-btn-error" data-history-id="${record.id}" title="Xem chi tiết sự cố">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>Chi tiết lỗi</span>
        </button>
      `;
    } else {
      statusBadgeHtml = '<span class="status-pill pending" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A;" title="Đang thực thi"><span class="status-dot" style="background: #F59E0B; animation: adminPulse 1.5s infinite;"></span>Đang xử lý</span>';
      actionBtnHtml = '<span class="font-mono" style="font-size: 0.75rem; color: #94A3B8;">Đang chạy...</span>';
    }

    tr.innerHTML = `
      <td>
        <div class="doc-file-cell user-cell-meta">
          <div class="doc-icon-badge" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div class="doc-file-info">
            <span class="user-cell-name doc-cell-filename" title="${escapeHtml(filename)}">${escapeHtml(filename)}</span>
            <span class="doc-cell-id font-mono" style="font-size: 0.72rem; color: #94A3B8;">Tài liệu #${record.document_id}</span>
          </div>
        </div>
      </td>
      <td class="history-cell-action">${actionBadgeHtml}</td>
      <td class="history-cell-status">${statusBadgeHtml}</td>
      <td class="font-mono text-muted history-cell-duration">${escapeHtml(executionTime)}</td>
      <td class="date-mono history-cell-date">${escapeHtml(formattedDate)}</td>
      <td class="text-right">
        <div class="doc-actions-group" style="justify-content: flex-end; display: flex; gap: 0.4rem;">
          ${actionBtnHtml}
        </div>
      </td>
    `;

    // Click handler for opening Error Modal
    const btnError = tr.querySelector('.history-btn-error');
    if (btnError) {
      btnError.addEventListener('click', (e) => {
        e.stopPropagation();
        openHistoryErrorModal(record.id);
      });
    }

    const pillError = tr.querySelector('.history-status-pill-failed');
    if (pillError) {
      pillError.addEventListener('click', (e) => {
        e.stopPropagation();
        openHistoryErrorModal(record.id);
      });
    }

    return tr;
  }

  /**
   * Open #historyErrorModal to display diagnostics for a failed processing history (PDFL-164.2)
   */
  async function openHistoryErrorModal(historyId) {
    const historyErrorModal = document.getElementById('historyErrorModal');
    const modalSub = document.getElementById('historyErrorModalSub');
    const docNameEl = document.getElementById('historyErrorDocName');
    const actionTypeEl = document.getElementById('historyErrorActionType');
    const timestampEl = document.getElementById('historyErrorTimestamp');
    const errorMsgEl = document.getElementById('historyErrorMessage');

    if (!historyErrorModal) return;

    const record = cachedHistories.find((h) => Number(h.id) === Number(historyId));

    if (modalSub) modalSub.textContent = `Mã bản ghi lịch sử: #${historyId}`;
    if (docNameEl) docNameEl.textContent = record ? (record.document_filename || `Tài liệu #${record.document_id}`) : `Bản ghi #${historyId}`;
    if (actionTypeEl) actionTypeEl.textContent = record ? record.action_type : '---';
    if (timestampEl) timestampEl.textContent = record ? formatDateTime(record.created_at) : '---';
    if (errorMsgEl) errorMsgEl.textContent = (record && record.error_message) ? record.error_message : 'Đang tải thông tin lỗi chi tiết...';

    historyErrorModal.style.display = 'flex';
    historyErrorModal.removeAttribute('hidden');

    // Optionally query detail endpoint for fresh or full error message
    const token = getStoredAuthToken();
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/history/${encodeURIComponent(historyId)}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const resData = await response.json();
          const detail = resData && resData.data ? resData.data : null;
          if (detail && errorMsgEl) {
            errorMsgEl.textContent = detail.error_message || 'Không có thông tin lỗi chi tiết.';
            if (docNameEl && detail.document_filename) docNameEl.textContent = detail.document_filename;
          }
        }
      } catch (_err) {
        // Fallback to record error_message
      }
    }
  }

  function initHistoryErrorModal() {
    const historyErrorModal = document.getElementById('historyErrorModal');
    const btnCloseHistoryErrorModal = document.getElementById('btnCloseHistoryErrorModal');
    const btnCloseHistoryErrorFooter = document.getElementById('btnCloseHistoryErrorFooter');

    function closeErrorModal() {
      if (historyErrorModal) {
        historyErrorModal.style.display = 'none';
        historyErrorModal.setAttribute('hidden', '');
      }
    }

    if (btnCloseHistoryErrorModal) {
      btnCloseHistoryErrorModal.addEventListener('click', closeErrorModal);
    }
    if (btnCloseHistoryErrorFooter) {
      btnCloseHistoryErrorFooter.addEventListener('click', closeErrorModal);
    }
    if (historyErrorModal) {
      historyErrorModal.addEventListener('click', (e) => {
        if (e.target === historyErrorModal) {
          closeErrorModal();
        }
      });
    }
  }

  function initHistoryEventListeners() {
    if (isHistoryListenersInitialized) return;
    isHistoryListenersInitialized = true;

    const btnRefresh = document.getElementById('btnHistoryRefresh');
    const btnRetry = document.getElementById('btnHistoryRetry');
    const actionFilter = document.getElementById('historyActionFilter');
    const statusFilter = document.getElementById('historyStatusFilter');
    const searchInput = document.getElementById('historySearchInput');
    const btnPrevPage = document.getElementById('btnHistoryPrevPage');
    const btnNextPage = document.getElementById('btnHistoryNextPage');

    if (btnRefresh) {
      btnRefresh.addEventListener('click', (e) => {
        e.preventDefault();
        fetchProcessingHistories();
      });
    }

    if (btnRetry) {
      btnRetry.addEventListener('click', (e) => {
        e.preventDefault();
        fetchProcessingHistories();
      });
    }

    if (actionFilter) {
      actionFilter.addEventListener('change', () => {
        historyCurrentPage = 1;
        fetchProcessingHistories();
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        historyCurrentPage = 1;
        fetchProcessingHistories();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderHistoryPageList(cachedHistories, getStoredAuthToken());
      });
    }

    if (btnPrevPage) {
      btnPrevPage.addEventListener('click', (e) => {
        e.preventDefault();
        if (historyCurrentPage > 1) {
          historyCurrentPage--;
          fetchProcessingHistories();
        }
      });
    }

    if (btnNextPage) {
      btnNextPage.addEventListener('click', (e) => {
        e.preventDefault();
        if (hasNextHistoryPage) {
          historyCurrentPage++;
          fetchProcessingHistories();
        }
      });
    }
  }

  function setActiveNav(navKey) {
    if (navKey === 'home') {
      const el = document.getElementById('sideNavHome');
      if (el) setActiveNavItem(el);
    } else if (navKey === 'translate') {
      const el = document.getElementById('sideNavTranslate');
      if (el) setActiveNavItem(el);
    } else if (navKey === 'documents') {
      const el = document.getElementById('sideNavDocuments');
      if (el) setActiveNavItem(el);
    } else if (navKey === 'history') {
      const el = document.getElementById('sideNavHistory');
      if (el) setActiveNavItem(el);
    } else if (navKey === 'admin') {
      const el = document.getElementById('sideNavAdmin');
      if (el) setActiveNavItem(el);
    }
  }

  // Export globally for testing and integration
  window.PDFLinguaSidebar = {
    toggle: toggleSidebar,
    setCollapsed: setCollapsed,
    openMobile: openMobileSidebar,
    closeMobile: closeMobileSidebar,
    syncUser: syncUserProfile,
    fetchRecentDocuments: fetchRecentDocuments,
    triggerUpload: triggerPdfUpload,
    openDocumentsView: openDocumentsView,
    closeDocumentsView: closeDocumentsView,
    openHistoryView: openHistoryView,
    closeHistoryView: closeHistoryView,
    navigateToHome: navigateToHome,
    setActiveNav: setActiveNav,
    setActiveNavItem: setActiveNavItem,
    openDocumentDetailModal: openDocumentDetailModal,
    closeDocumentDetailModal: closeDocumentDetailModal,
    openDocumentDeleteConfirmModal: openDocumentDeleteConfirmModal,
    closeDocumentDeleteConfirmModal: closeDocumentDeleteConfirmModal,
    confirmDocumentDelete: confirmDocumentDelete,
    fetchProcessingHistories: fetchProcessingHistories,
    renderHistoryPageList: renderHistoryPageList,
    openHistoryErrorModal: openHistoryErrorModal,
    setHistorySectionState: setHistorySectionState,
    getHistoryCurrentPage: () => historyCurrentPage,
    setHistoryCurrentPage: (p) => { historyCurrentPage = p; },
    getCachedHistories: () => cachedHistories,
  };
})();
