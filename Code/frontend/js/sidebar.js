/**
 * PDF-Lingua: Collapsible Sidebar Navigation Controller
 * ---------------------------------------------------
 * Manages responsive behavior, collapsed/expanded states,
 * localStorage persistence, keyboard accessibility, and user state sync.
 * Completely hides the sidebar for unauthenticated (guest) users.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'pdf_lingua_sidebar_collapsed';

  let isCollapsed = false;
  let isMobileOpen = false;

  document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
  });

  function initSidebar() {
    const appShell = document.getElementById('appShell');
    const appSidebar = document.getElementById('appSidebar');
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    const btnMobileSidebarToggle = document.getElementById('btnMobileSidebarToggle');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const btnSidebarNewChat = document.getElementById('btnSidebarNewChat');
    const sidebarUserProfile = document.getElementById('sidebarUserProfile');

    if (!appSidebar) return;

    // Initial check: if no logged-in user, ensure guest-mode is active
    let initialUser = null;
    try {
      const raw = localStorage.getItem('pdfl_user') || sessionStorage.getItem('pdfl_user');
      if (raw) initialUser = JSON.parse(raw);
    } catch (_err) {}

    syncUserProfile(initialUser);

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

    // Keyboard navigation (Escape to close mobile drawer, Ctrl+B to toggle sidebar)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        closeMobileSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        // Prevent default browser bookmark shortcut
        e.preventDefault();
        toggleSidebar();
      }
    });

    // New Chat / Create button handler
    if (btnSidebarNewChat) {
      btnSidebarNewChat.addEventListener('click', () => {
        // If workspace is open, reset to upload or scroll to dropzone
        const btnNewFile = document.getElementById('btnNewFile');
        const heroSection = document.getElementById('heroSection');
        const adminSection = document.getElementById('adminSection');

        if (adminSection && adminSection.style.display !== 'none') {
          adminSection.style.display = 'none';
          if (heroSection) heroSection.style.display = 'block';
        }

        if (btnNewFile && typeof btnNewFile.click === 'function') {
          btnNewFile.click();
        }

        if (heroSection) {
          heroSection.scrollIntoView({ behavior: 'smooth' });
        }

        if (window.innerWidth < 768) {
          closeMobileSidebar();
        }
      });
    }

    // User profile click in sidebar -> open Account modal or Login modal
    if (sidebarUserProfile) {
      sidebarUserProfile.addEventListener('click', () => {
        const btnOpenAccountModal = document.getElementById('btnOpenAccountModal');
        const btnLogin = document.getElementById('btnLogin');

        // Check if user is logged in
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
      });
    }

    // Main navigation items
    initNavItems();

    // Listen to custom auth events from auth.js
    window.addEventListener('pdfl:auth-change', (e) => {
      syncUserProfile(e.detail ? e.detail.user : null);
    });
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
    const sideNavTranslate = document.getElementById('sideNavTranslate');
    const sideNavAiCopilot = document.getElementById('sideNavAiCopilot');
    const sideNavAdmin = document.getElementById('sideNavAdmin');
    const sideNavPricing = document.getElementById('sideNavPricing');

    if (sideNavTranslate) {
      sideNavTranslate.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNavItem(sideNavTranslate);
        const adminSection = document.getElementById('adminSection');
        const heroSection = document.getElementById('heroSection');
        if (adminSection) adminSection.style.display = 'none';
        if (heroSection) heroSection.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (window.innerWidth < 768) closeMobileSidebar();
      });
    }

    if (sideNavAiCopilot) {
      sideNavAiCopilot.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNavItem(sideNavAiCopilot);
        if (typeof showToast === 'function') {
          showToast('Trợ lý AI Copilot sẵn sàng tương tác khi mở tài liệu song ngữ!', 'info');
        }
        if (window.innerWidth < 768) closeMobileSidebar();
      });
    }

    if (sideNavAdmin) {
      sideNavAdmin.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNavItem(sideNavAdmin);
        const btnOpenAdmin = document.getElementById('btnOpenAdmin');
        if (btnOpenAdmin && typeof btnOpenAdmin.click === 'function') {
          btnOpenAdmin.click();
        }
        if (window.innerWidth < 768) closeMobileSidebar();
      });
    }

    if (sideNavPricing) {
      sideNavPricing.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNavItem(sideNavPricing);
        if (typeof showToast === 'function') {
          showToast('Bảng giá: Gói Free (20MB / 100 trang), Gói Pro VIP (100MB / 500 trang).', 'info');
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

    if (currentUser && (currentUser.email || currentUser.id)) {
      // Authenticated User: Reveal Sidebar
      if (appShell) {
        appShell.classList.remove('guest-mode');
      }

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
          avatarEl.style.color = '#475569';
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
          roleEl.style.color = '#B45309';
        } else {
          roleEl.textContent = 'Gói Miễn phí';
          roleEl.style.color = '#64748B';
        }
      }

      if (sideNavAdminItem) {
        sideNavAdminItem.style.display = role === 'admin' ? 'block' : 'none';
      }
    } else {
      // Guest User: Completely Hide Sidebar
      if (appShell) {
        appShell.classList.add('guest-mode');
      }

      closeMobileSidebar();

      if (avatarEl) {
        avatarEl.textContent = 'K';
        avatarEl.style.background = '#F1F5F9';
        avatarEl.style.color = '#64748B';
        avatarEl.style.borderColor = '#CBD5E1';
      }
      if (nameEl) nameEl.textContent = 'Khách vãng lai';
      if (roleEl) {
        roleEl.textContent = 'Gói Miễn phí';
        roleEl.style.color = '#94A3B8';
      }
      if (sideNavAdminItem) {
        sideNavAdminItem.style.display = 'none';
      }
    }
  }

  // Export globally for testing and integration
  window.PDFLinguaSidebar = {
    toggle: toggleSidebar,
    setCollapsed: setCollapsed,
    openMobile: openMobileSidebar,
    closeMobile: closeMobileSidebar,
    syncUser: syncUserProfile,
  };
})();
