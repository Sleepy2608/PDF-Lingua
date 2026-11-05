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
  const API_BASE_URL = 'http://localhost:8000';

  let isCollapsed = false;
  let isMobileOpen = false;
  let isDocDetailOpen = false;
  let currentDetailDoc = null;
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

    // Keyboard navigation (Escape to close detail modal or mobile drawer, Ctrl+B to toggle sidebar)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isDocDetailOpen) {
          closeDocumentDetailModal();
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

    // Document Detail Modal controls (PDFL-93.1)
    initDocumentDetailModal();

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

    // User profile click in sidebar -> open Account modal or Login modal
    if (sidebarUserProfile) {
      sidebarUserProfile.addEventListener('click', () => {
        handleProfileClick();
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

    // Listen to custom auth events from auth.js
    window.addEventListener('pdfl:auth-change', (e) => {
      const user = e.detail ? e.detail.user : null;
      syncUserProfile(user);
      fetchRecentDocuments();
    });

    // Listen to document processed events from workspace.js for auto-refresh (PDFL-92.3)
    window.addEventListener('pdfl:document-processed', () => {
      fetchRecentDocuments();
    });
  }

  function triggerPdfUpload() {
    const adminSection = document.getElementById('adminSection');
    const documentsSection = document.getElementById('documentsSection');
    const heroSection = document.getElementById('heroSection');
    const workspaceSection = document.getElementById('workspaceSection');
    const sideNavTranslate = document.getElementById('sideNavTranslate');
    const btnNewFile = document.getElementById('btnNewFile');
    const pdfFileInput = document.getElementById('pdfFileInput');

    // If currently in admin or documents view, return to user workspace
    if (adminSection && adminSection.style.display !== 'none') {
      adminSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
    }

    if (documentsSection && documentsSection.style.display !== 'none') {
      documentsSection.style.display = 'none';
      if (workspaceSection) workspaceSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
    }

    if (sideNavTranslate) {
      setActiveNavItem(sideNavTranslate);
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

    if (sideNavDocuments) setActiveNavItem(sideNavDocuments);
    if (heroSection) heroSection.style.display = 'none';
    if (workspaceSection) workspaceSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';
    if (documentsSection) documentsSection.style.display = 'block';

    fetchRecentDocuments();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth < 768) {
      closeMobileSidebar();
    }
  }

  function closeDocumentsView() {
    const sideNavTranslate = document.getElementById('sideNavTranslate');
    const heroSection = document.getElementById('heroSection');
    const workspaceSection = document.getElementById('workspaceSection');
    const adminSection = document.getElementById('adminSection');
    const documentsSection = document.getElementById('documentsSection');

    if (sideNavTranslate) setActiveNavItem(sideNavTranslate);
    if (documentsSection) documentsSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';

    const hasActiveDoc = window.pdfLinguaWorkspace
      && typeof window.pdfLinguaWorkspace.getCurrentDocData === 'function'
      && Boolean(window.pdfLinguaWorkspace.getCurrentDocData());

    if (hasActiveDoc && workspaceSection) {
      if (heroSection) heroSection.style.display = 'none';
      workspaceSection.style.display = 'block';
    } else {
      if (workspaceSection) workspaceSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth < 768) {
      closeMobileSidebar();
    }
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
    const sideNavPricing = document.getElementById('sideNavPricing');
    const sideNavAdmin = document.getElementById('sideNavAdmin');
    const btnCloseDocumentsView = document.getElementById('btnCloseDocumentsView');
    const btnDocsUploadNew = document.getElementById('btnDocsUploadNew');
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
        setActiveNavItem(sideNavHome);
        const adminSection = document.getElementById('adminSection');
        const documentsSection = document.getElementById('documentsSection');
        const workspaceSection = document.getElementById('workspaceSection');
        const heroSection = document.getElementById('heroSection');
        if (adminSection) adminSection.style.display = 'none';
        if (documentsSection) documentsSection.style.display = 'none';
        if (workspaceSection) workspaceSection.style.display = 'none';
        if (heroSection) heroSection.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (window.innerWidth < 768) closeMobileSidebar();
      });
    }

    if (sideNavTranslate) {
      sideNavTranslate.addEventListener('click', (e) => {
        e.preventDefault();
        closeDocumentsView();
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

    if (btnCloseDocumentsView) {
      btnCloseDocumentsView.addEventListener('click', (e) => {
        e.preventDefault();
        closeDocumentsView();
      });
    }

    if (btnDocsUploadNew) {
      btnDocsUploadNew.addEventListener('click', (e) => {
        e.preventDefault();
        triggerPdfUpload();
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
        setActiveNavItem(sideNavAdmin);
        const documentsSection = document.getElementById('documentsSection');
        if (documentsSection) documentsSection.style.display = 'none';
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
  }

  function setActiveNavItem(targetItem) {
    const allItems = document.querySelectorAll('.sidebar-nav-item');
    allItems.forEach((item) => item.classList.remove('active'));
    if (targetItem) targetItem.classList.add('active');
  }

  /**
   * Synchronize User Profile in Sidebar
   * Matches target specifications:
   * - Guest: "Người dùng", "Free / Pro", SVG user avatar.
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

    if (appShell) {
      appShell.classList.remove('guest-mode');
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

      if (nameEl) nameEl.textContent = 'Người dùng';
      if (roleEl) {
        roleEl.textContent = 'Free / Pro';
        roleEl.style.color = '#64748B';
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
      ? '<span class="meta-pill ocr">Quét OCR</span>'
      : '<span class="meta-pill digital">PDF Số</span>';
    const formattedDate = formatDate(doc.created_at) || '--';

    tr.innerHTML = `
      <td>
        <div class="user-cell-meta">
          <span class="badge badge-pdf">PDF</span>
          <span class="user-cell-name doc-cell-filename" title="${escapeHtml(filename)}">${escapeHtml(filename)}</span>
        </div>
      </td>
      <td class="font-mono doc-cell-size">${escapeHtml(formattedSize)}</td>
      <td class="doc-cell-pages"><span class="doc-count-mono">${escapeHtml(String(pageCount))}</span><span class="doc-unit"> trang</span></td>
      <td class="doc-cell-lang">${escapeHtml(formattedLang)}</td>
      <td class="doc-cell-ocr">${ocrBadgeHtml}</td>
      <td class="date-mono doc-cell-date">${escapeHtml(formattedDate)}</td>
      <td class="text-right">
        <div class="user-actions-group">
          <button type="button" class="btn btn-secondary btn-sm doc-table-detail-btn" title="Xem chi tiết tài liệu" aria-label="Chi tiết ${escapeHtml(filename)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Chi tiết</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm doc-table-download-btn" title="Tải xuống PDF" aria-label="Tải xuống ${escapeHtml(filename)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
   * Initialize Document Detail Modal events (PDFL-93.1)
   */
  function initDocumentDetailModal() {
    const modalEl = document.getElementById('documentDetailModal');
    const btnCloseTop = document.getElementById('btnCloseDocumentDetailModal');
    const btnCloseFooter = document.getElementById('btnCloseDocumentDetailFooter');
    const btnDownload = document.getElementById('btnDocDetailDownload');

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
        if (currentDetailDoc && currentDetailDoc.id) {
          downloadDocumentFile(
            currentDetailDoc.id,
            currentDetailDoc.original_filename || `document_${currentDetailDoc.id}.pdf`,
            cachedToken || getStoredAuthToken()
          );
        }
      });
    }
  }

  /**
   * Populate and open Document Detail Modal (PDFL-93.1)
   */
  function openDocumentDetailModal(doc) {
    const modalEl = document.getElementById('documentDetailModal');
    if (!modalEl) return;

    const targetDoc = doc || {};
    currentDetailDoc = targetDoc;
    isDocDetailOpen = true;

    const filename = targetDoc.original_filename || 'document.pdf';
    const docIdText = targetDoc.id !== undefined && targetDoc.id !== null ? `#${targetDoc.id}` : '---';
    const formattedSize = formatFileSize(targetDoc.file_size_bytes) || '0 B';
    const pageCountVal = targetDoc.page_count !== undefined && targetDoc.page_count !== null
      ? `${targetDoc.page_count} trang`
      : '1 trang';
    const formattedLang = formatTargetLang(targetDoc.target_lang);
    const isOcr = Boolean(targetDoc.is_ocr_used);
    const formattedDate = formatDate(targetDoc.created_at) || '---';

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

    if (btnDownload && targetDoc.id !== undefined && targetDoc.id !== null) {
      btnDownload.dataset.docId = String(targetDoc.id);
    }
    if (btnDelete && targetDoc.id !== undefined && targetDoc.id !== null) {
      btnDelete.dataset.docId = String(targetDoc.id);
    }

    modalEl.removeAttribute('hidden');
    modalEl.style.display = 'flex';
  }

  /**
   * Close Document Detail Modal (PDFL-93.1)
   */
  function closeDocumentDetailModal() {
    const modalEl = document.getElementById('documentDetailModal');
    isDocDetailOpen = false;
    currentDetailDoc = null;

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
    try {
      if (typeof showToast === 'function') {
        showToast(`Đang tải xuống tài liệu ${filename}...`, 'info');
      }

      const response = await fetch(`${API_BASE_URL}/api/documents/${docId}/download`, {
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
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_err) {
      if (typeof showToast === 'function') {
        showToast('Có lỗi xảy ra khi tải xuống tệp PDF!', 'error');
      }
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
    openDocumentDetailModal: openDocumentDetailModal,
    closeDocumentDetailModal: closeDocumentDetailModal,
  };
})();
