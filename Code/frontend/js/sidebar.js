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

    // Keyboard navigation (Escape to close mobile drawer, Ctrl+B to toggle sidebar)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        closeMobileSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
      }
    });

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
  }

  function triggerPdfUpload() {
    const adminSection = document.getElementById('adminSection');
    const heroSection = document.getElementById('heroSection');
    const btnNewFile = document.getElementById('btnNewFile');
    const pdfFileInput = document.getElementById('pdfFileInput');

    // If currently in admin view, return to user workspace
    if (adminSection && adminSection.style.display !== 'none') {
      adminSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
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

    if (sideNavHome) {
      sideNavHome.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNavItem(sideNavHome);
        const adminSection = document.getElementById('adminSection');
        const heroSection = document.getElementById('heroSection');
        if (adminSection) adminSection.style.display = 'none';
        if (heroSection) heroSection.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (window.innerWidth < 768) closeMobileSidebar();
      });
    }

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
        setActiveNavItem(sideNavDocuments);
        const recentSection = document.getElementById('sidebarRecentSection');
        if (recentSection) {
          recentSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (typeof showToast === 'function') {
          showToast('Danh mục Quản lý tài liệu: Xem danh sách tài liệu PDF đã xử lý.', 'info');
        }
        if (window.innerWidth < 768) closeMobileSidebar();
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
        const btnOpenAdmin = document.getElementById('btnOpenAdmin');
        if (btnOpenAdmin && typeof btnOpenAdmin.click === 'function') {
          btnOpenAdmin.click();
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
   * Fetch and Render Recent Documents from Backend
   * Displays dynamic documents or clean empty state matching Image 2.
   */
  async function fetchRecentDocuments() {
    const emptyStateEl = document.getElementById('sidebarEmptyDocsState');
    let docListEl = document.getElementById('sidebarDocList');
    const container = document.getElementById('sidebarRecentDocs');

    if (!container) return;

    if (!docListEl) {
      docListEl = document.createElement('ul');
      docListEl.className = 'sidebar-doc-list';
      docListEl.id = 'sidebarDocList';
      container.appendChild(docListEl);
    }

    const token = localStorage.getItem('pdfl_token') || sessionStorage.getItem('pdfl_token');

    if (!token) {
      // Unauthenticated: Show clean empty state
      if (emptyStateEl) emptyStateEl.style.display = 'block';
      if (docListEl) {
        docListEl.style.display = 'none';
        docListEl.innerHTML = '';
      }
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Không thể tải danh sách tài liệu');
      }

      const result = await response.json();
      const docs = result && Array.isArray(result.data) ? result.data : [];

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

          // Display up to 8 recent documents
          const recentDocs = docs.slice(0, 8);
          recentDocs.forEach((doc) => {
            const item = createDocumentItem(doc, token);
            docListEl.appendChild(item);
          });
        }
      }
    } catch (_err) {
      if (emptyStateEl) emptyStateEl.style.display = 'block';
      if (docListEl) docListEl.style.display = 'none';
    }
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
  };
})();
