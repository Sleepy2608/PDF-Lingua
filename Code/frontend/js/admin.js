/**
 * PDF-Lingua Admin Console Controller (EPIC 14)
 * --------------------------------------------
 * Handles:
 * - PDFL-188: System Overview Statistics loading & card rendering
 * - PDFL-189: User directory listing, real-time search, filtering, and pagination
 * - PDFL-194: Account locking and unlocking lifecycle with immediate feedback
 * - PDFL-197: High-impact action confirmation modal before dangerous operations
 */

(function () {
  'use strict';

  const API_BASE_URL = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8000'))
    ? 'http://127.0.0.1:8000'
    : '';

  // ── State Management ────────────────────────────────────────────────────────
  let currentPage = 1;
  const currentLimit = 10;
  let currentSearch = '';
  let currentRole = 'all';
  let currentStatus = 'all';
  let totalPages = 1;
  let totalCount = 0;
  let isFetching = false;
  let searchDebounceTimer = null;
  let pendingConfirmAction = null;

  // ── Helper Utilities ────────────────────────────────────────────────────────
  function getStoredToken() {
    if (window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredToken === 'function') {
      return window.pdfLinguaAuth.getStoredToken();
    }
    try {
      return localStorage.getItem('pdfl_token') || sessionStorage.getItem('pdfl_token');
    } catch (e) {
      return null;
    }
  }

  function getCurrentUser() {
    if (window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredUser === 'function') {
      return window.pdfLinguaAuth.getStoredUser();
    }
    try {
      const raw = localStorage.getItem('pdfl_user') || sessionStorage.getItem('pdfl_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(isoString) {
    if (!isoString) return '--';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch (e) {
      return isoString;
    }
  }

  function notifyUser(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      try {
        window.showToast(message, type);
        return;
      } catch (e) {}
    }
    // Fallback notification
    console.log(`[Admin Alert - ${type.toUpperCase()}] ${message}`);
  }

  // ── Navigation & View Switching ─────────────────────────────────────────────
  function openAdminView() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
      notifyUser('Bạn không có quyền truy cập bảng quản trị.', 'error');
      return;
    }

    const heroSection = document.getElementById('heroSection');
    const workspaceSection = document.getElementById('workspaceSection');
    const adminSection = document.getElementById('adminSection');

    if (heroSection) heroSection.style.display = 'none';
    if (workspaceSection) workspaceSection.style.display = 'none';
    if (adminSection) {
      adminSection.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Close account modal if open
    if (window.pdfLinguaAuth && typeof window.pdfLinguaAuth.closeAccountModal === 'function') {
      window.pdfLinguaAuth.closeAccountModal();
    }

    // Load fresh data
    loadAllAdminData();
  }

  function closeAdminView() {
    const adminSection = document.getElementById('adminSection');
    if (adminSection) adminSection.style.display = 'none';

    // Return to previous view: workspace if document loaded, else hero
    const workspaceSection = document.getElementById('workspaceSection');
    const heroSection = document.getElementById('heroSection');
    const docNameDisplay = document.getElementById('docNameDisplay');

    if (workspaceSection && docNameDisplay && docNameDisplay.textContent.trim() !== '') {
      workspaceSection.style.display = 'block';
    } else if (heroSection) {
      heroSection.style.display = '';
    }
  }

  // ── API Fetch: Statistics (PDFL-188) ─────────────────────────────────────────
  async function fetchAdminStats() {
    const token = getStoredToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (res.status === 200) {
        const json = await res.json();
        const stats = json.data;
        renderAdminStats(stats);
      } else if (res.status === 401 || res.status === 403) {
        notifyUser('Phiên làm việc hết hạn hoặc bạn không có quyền Admin.', 'error');
        closeAdminView();
      }
    } catch (err) {
      console.error('[PDF-Lingua Admin] Error loading stats:', err);
      notifyUser('Không thể kết nối đến máy chủ để tải số liệu thống kê.', 'error');
    }
  }

  function renderAdminStats(stats) {
    if (!stats) return;

    // Card 1: Users
    const elTotalUsers = document.getElementById('statTotalUsers');
    const elFreeUsers = document.getElementById('statFreeUsers');
    const elProUsers = document.getElementById('statProUsers');
    const elAdminUsers = document.getElementById('statAdminUsers');

    if (elTotalUsers) elTotalUsers.textContent = (stats.total_users || 0).toLocaleString('vi-VN');
    if (elFreeUsers) elFreeUsers.textContent = `Free: ${stats.free_users || 0}`;
    if (elProUsers) elProUsers.textContent = `Pro: ${stats.pro_users || 0}`;
    if (elAdminUsers) elAdminUsers.textContent = `Admin: ${stats.admin_users || 0}`;

    // Card 2: Account Status
    const elActiveRatio = document.getElementById('statActiveRatio');
    const elActiveUsers = document.getElementById('statActiveUsers');
    const elLockedUsers = document.getElementById('statLockedUsers');

    const total = stats.total_users || 0;
    const active = stats.active_users || 0;
    const ratio = total > 0 ? Math.round((active / total) * 100) : 100;

    if (elActiveRatio) elActiveRatio.textContent = `${ratio}%`;
    if (elActiveUsers) elActiveUsers.textContent = `Hoạt động: ${active}`;
    if (elLockedUsers) elLockedUsers.textContent = `Đã khóa: ${stats.locked_users || 0}`;

    // Card 3: Documents
    const elTotalDocs = document.getElementById('statTotalDocs');
    if (elTotalDocs) elTotalDocs.textContent = (stats.total_documents || 0).toLocaleString('vi-VN');

    // Card 4: Storage
    const elTotalStorage = document.getElementById('statTotalStorage');
    const elStorageRaw = document.getElementById('statStorageRaw');

    const bytes = stats.total_storage_bytes || 0;
    if (elTotalStorage) elTotalStorage.textContent = formatBytes(bytes);
    if (elStorageRaw) elStorageRaw.textContent = `${bytes.toLocaleString('vi-VN')} Bytes dữ liệu`;
  }

  // ── API Fetch: User Directory (PDFL-189) ─────────────────────────────────────
  async function fetchAdminUsers(targetPage = 1) {
    if (isFetching) return;
    const token = getStoredToken();
    if (!token) return;

    isFetching = true;
    currentPage = targetPage;

    const tbody = document.getElementById('adminUsersTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
              <span class="account-spinner" style="width: 18px; height: 18px;"></span>
              <span>Đang tải danh sách người dùng...</span>
            </div>
          </td>
        </tr>
      `;
    }

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(currentLimit),
      });

      if (currentSearch && currentSearch.trim() !== '') {
        params.append('search', currentSearch.trim());
      }
      if (currentRole && currentRole !== 'all') {
        params.append('role', currentRole);
      }
      if (currentStatus && currentStatus !== 'all') {
        params.append('is_active', currentStatus);
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/users?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (res.status === 200) {
        const json = await res.json();
        const data = json.data;
        totalPages = data.total_pages || 1;
        totalCount = data.total_count || 0;
        renderAdminUsersTable(data.items || []);
        renderPaginationControls();
      } else if (res.status === 401 || res.status === 403) {
        notifyUser('Phiên làm việc hết hạn hoặc bạn không có quyền Admin.', 'error');
        closeAdminView();
      } else {
        notifyUser('Không thể tải danh sách người dùng.', 'error');
      }
    } catch (err) {
      console.error('[PDF-Lingua Admin] Error loading user list:', err);
      notifyUser('Lỗi kết nối khi tải danh sách người dùng.', 'error');
    } finally {
      isFetching = false;
    }
  }

  function renderAdminUsersTable(users) {
    const tbody = document.getElementById('adminUsersTableBody');
    const emptyState = document.getElementById('adminTableEmptyState');
    const tableEl = document.getElementById('adminUsersTable');
    const countBadge = document.getElementById('adminUsersCountBadge');

    if (countBadge) {
      countBadge.textContent = `${totalCount.toLocaleString('vi-VN')} tài khoản`;
    }

    if (!users || users.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (tableEl) tableEl.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableEl) tableEl.style.display = 'table';

    const currentAdmin = getCurrentUser();
    const currentAdminId = currentAdmin ? currentAdmin.id : -1;

    let html = '';
    users.forEach((u) => {
      const isSelf = u.id === currentAdminId;
      const initial = (u.full_name ? u.full_name.charAt(0) : (u.email ? u.email.charAt(0) : 'U')).toUpperCase();
      const displayName = u.full_name ? escapeHtml(u.full_name) : '<em>Chưa đặt tên</em>';
      const email = escapeHtml(u.email);

      // Role badge
      let roleBadgeClass = 'role-badge free';
      let roleLabel = 'Free';
      if (u.role === 'pro') {
        roleBadgeClass = 'role-badge pro';
        roleLabel = '👑 Pro VIP';
      } else if (u.role === 'admin') {
        roleBadgeClass = 'role-badge admin';
        roleLabel = '⭐ Admin';
      }

      // Status pill
      const statusPillClass = u.is_active ? 'status-pill active' : 'status-pill locked';
      const statusLabel = u.is_active ? 'Hoạt động' : 'Đã khóa';

      // Action buttons
      let actionButtons = '';
      if (isSelf) {
        actionButtons = `<span class="admin-self-tag">(Tài khoản của bạn)</span>`;
      } else {
        const toggleStatusBtn = u.is_active
          ? `<button type="button" class="btn-action btn-action-lock" data-action="lock" data-user-id="${u.id}" data-user-email="${email}">🔒 Khóa</button>`
          : `<button type="button" class="btn-action btn-action-unlock" data-action="unlock" data-user-id="${u.id}" data-user-email="${email}">🔓 Mở khóa</button>`;

        const nextRole = u.role === 'pro' ? 'free' : 'pro';
        const roleBtnLabel = u.role === 'pro' ? 'Hạ Free' : 'Cấp Pro';
        const changeRoleBtn = `<button type="button" class="btn-action btn-action-role" data-action="change-role" data-user-id="${u.id}" data-user-email="${email}" data-target-role="${nextRole}">⚡ ${roleBtnLabel}</button>`;

        actionButtons = `
          <div class="user-actions-group">
            ${changeRoleBtn}
            ${toggleStatusBtn}
          </div>
        `;
      }

      html += `
        <tr>
          <td><span style="font-weight: 700; color: var(--text-muted); font-size: 0.8125rem;">#${u.id}</span></td>
          <td>
            <div class="user-cell-meta">
              <div class="user-cell-avatar">${escapeHtml(initial)}</div>
              <div>
                <div class="user-cell-name">${displayName}</div>
                <div class="user-cell-email">${email}</div>
              </div>
            </div>
          </td>
          <td><span class="${roleBadgeClass}">${roleLabel}</span></td>
          <td><span class="${statusPillClass}"><span class="status-dot"></span>${statusLabel}</span></td>
          <td><span style="font-weight: 600;">${u.document_count || 0}</span> tệp</td>
          <td style="color: var(--text-muted); font-size: 0.8125rem;">${formatDate(u.created_at)}</td>
          <td class="text-right">${actionButtons}</td>
        </tr>
      `;
    });

    if (tbody) tbody.innerHTML = html;
  }

  function renderPaginationControls() {
    const btnPrev = document.getElementById('btnAdminPrevPage');
    const btnNext = document.getElementById('btnAdminNextPage');
    const pageBadge = document.getElementById('adminCurrentPageBadge');
    const pageInfo = document.getElementById('adminPaginationInfo');

    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;
    if (pageBadge) pageBadge.textContent = String(currentPage);
    if (pageInfo) {
      pageInfo.textContent = `Trang ${currentPage} / ${totalPages} (Tổng ${totalCount} tài khoản)`;
    }
  }

  // ── High-Impact Action Confirmation Modal (PDFL-197) ────────────────────────
  function openConfirmModal(config) {
    const modal = document.getElementById('adminConfirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const descEl = document.getElementById('confirmModalDesc');
    const targetEmailEl = document.getElementById('confirmModalTargetEmail');
    const iconWrap = document.getElementById('confirmModalIconWrap');
    const proceedBtn = document.getElementById('btnProceedAdminConfirm');

    if (!modal) return;

    if (titleEl) titleEl.textContent = config.title || 'Xác nhận thao tác trọng yếu';
    if (descEl) descEl.textContent = config.desc || '';
    if (targetEmailEl) targetEmailEl.textContent = config.email || '';

    // Style adjustments based on severity
    if (config.actionType === 'danger') {
      if (iconWrap) {
        iconWrap.style.background = '#FEF2F2';
        iconWrap.style.borderColor = '#FEE2E2';
        iconWrap.innerHTML = '<span class="confirm-warning-icon">🚫</span>';
      }
      if (proceedBtn) {
        proceedBtn.className = 'btn btn-danger';
        proceedBtn.textContent = 'Khóa tài khoản này';
      }
    } else if (config.actionType === 'success') {
      if (iconWrap) {
        iconWrap.style.background = '#F0FDF4';
        iconWrap.style.borderColor = '#DCFCE7';
        iconWrap.innerHTML = '<span class="confirm-warning-icon">🔓</span>';
      }
      if (proceedBtn) {
        proceedBtn.className = 'btn btn-gradient';
        proceedBtn.textContent = 'Mở khóa tài khoản';
      }
    } else {
      if (iconWrap) {
        iconWrap.style.background = '#FEF3C7';
        iconWrap.style.borderColor = '#FDE68A';
        iconWrap.innerHTML = '<span class="confirm-warning-icon">⚠️</span>';
      }
      if (proceedBtn) {
        proceedBtn.className = 'btn btn-gradient';
        proceedBtn.textContent = 'Xác nhận thay đổi';
      }
    }

    pendingConfirmAction = config.onConfirm;
    modal.style.display = 'flex';
  }

  function closeConfirmModal() {
    const modal = document.getElementById('adminConfirmModal');
    if (modal) modal.style.display = 'none';
    pendingConfirmAction = null;
  }

  // ── Action Handlers: Status & Role (PDFL-194, PDFL-197) ──────────────────────
  async function executeStatusUpdate(userId, newActiveStatus, userEmail) {
    const token = getStoredToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ is_active: newActiveStatus }),
      });

      const json = await res.json();
      if (res.status === 200) {
        const actionLabel = newActiveStatus ? 'Mở khóa' : 'Khóa';
        notifyUser(`${actionLabel} tài khoản ${userEmail} thành công!`, 'success');
        // Refresh table & stats
        fetchAdminUsers(currentPage);
        fetchAdminStats();
      } else {
        const errMsg = json.message || 'Thao tác không thành công.';
        notifyUser(errMsg, 'error');
      }
    } catch (err) {
      console.error('[PDF-Lingua Admin] Status update error:', err);
      notifyUser('Lỗi kết nối máy chủ khi cập nhật trạng thái.', 'error');
    }
  }

  async function executeRoleUpdate(userId, newRole, userEmail) {
    const token = getStoredToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      const json = await res.json();
      if (res.status === 200) {
        notifyUser(`Đã cập nhật vai trò ${userEmail} thành ${newRole.toUpperCase()}!`, 'success');
        // Refresh table & stats
        fetchAdminUsers(currentPage);
        fetchAdminStats();
      } else {
        const errMsg = json.message || 'Thao tác đổi quyền không thành công.';
        notifyUser(errMsg, 'error');
      }
    } catch (err) {
      console.error('[PDF-Lingua Admin] Role update error:', err);
      notifyUser('Lỗi kết nối máy chủ khi thay đổi vai trò.', 'error');
    }
  }

  // ── Master Loader ───────────────────────────────────────────────────────────
  function loadAllAdminData() {
    fetchAdminStats();
    fetchAdminUsers(1);
  }

  // ── Event Bindings ──────────────────────────────────────────────────────────
  function initAdminEvents() {
    // 1. Navigation Buttons
    const btnOpenAdmin = document.getElementById('btnOpenAdmin');
    if (btnOpenAdmin) {
      btnOpenAdmin.addEventListener('click', openAdminView);
    }

    const btnAdminModalShortcut = document.getElementById('btnAdminModalShortcut');
    if (btnAdminModalShortcut) {
      btnAdminModalShortcut.addEventListener('click', openAdminView);
    }

    const btnCloseAdminView = document.getElementById('btnCloseAdminView');
    if (btnCloseAdminView) {
      btnCloseAdminView.addEventListener('click', closeAdminView);
    }

    const btnRefresh = document.getElementById('btnRefreshAdminData');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        btnRefresh.classList.add('loading');
        loadAllAdminData();
        setTimeout(() => btnRefresh.classList.remove('loading'), 600);
      });
    }

    // 2. Search Debounce
    const searchInput = document.getElementById('adminSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          currentSearch = e.target.value.trim();
          fetchAdminUsers(1);
        }, 300);
      });
    }

    // 3. Role & Status Filters
    const roleFilter = document.getElementById('adminRoleFilter');
    if (roleFilter) {
      roleFilter.addEventListener('change', (e) => {
        currentRole = e.target.value;
        fetchAdminUsers(1);
      });
    }

    const statusFilter = document.getElementById('adminStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        currentStatus = e.target.value;
        fetchAdminUsers(1);
      });
    }

    // 4. Pagination
    const btnPrev = document.getElementById('btnAdminPrevPage');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
          fetchAdminUsers(currentPage - 1);
        }
      });
    }

    const btnNext = document.getElementById('btnAdminNextPage');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentPage < totalPages) {
          fetchAdminUsers(currentPage + 1);
        }
      });
    }

    // 5. Table Action Delegation (Lock/Unlock/Role)
    const tableBody = document.getElementById('adminUsersTableBody');
    if (tableBody) {
      tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-action');
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        const userId = parseInt(btn.getAttribute('data-user-id'), 10);
        const email = btn.getAttribute('data-user-email');

        if (!userId || isNaN(userId)) return;

        if (action === 'lock') {
          openConfirmModal({
            title: 'Khóa tài khoản người dùng',
            desc: `Bạn có chắc chắn muốn KHÓA tài khoản này? Người dùng sẽ bị thu hồi quyền truy cập và bị từ chối mọi yêu cầu xử lý tài liệu ngay lập tức.`,
            email: email,
            actionType: 'danger',
            onConfirm: async () => {
              await executeStatusUpdate(userId, false, email);
            },
          });
        } else if (action === 'unlock') {
          openConfirmModal({
            title: 'Mở khóa tài khoản người dùng',
            desc: `Bạn có chắc chắn muốn MỞ KHÓA tài khoản này? Người dùng sẽ được phục hồi quyền đăng nhập và xử lý tài liệu.`,
            email: email,
            actionType: 'success',
            onConfirm: async () => {
              await executeStatusUpdate(userId, true, email);
            },
          });
        } else if (action === 'change-role') {
          const targetRole = btn.getAttribute('data-target-role') || 'pro';
          const roleDisplayName = targetRole === 'pro' ? 'Pro VIP' : 'Miễn phí (Free)';
          openConfirmModal({
            title: 'Thay đổi cấp bậc tài khoản',
            desc: `Bạn có chắc chắn muốn chuyển vai trò của tài khoản này sang "${roleDisplayName}"?`,
            email: email,
            actionType: 'warning',
            onConfirm: async () => {
              await executeRoleUpdate(userId, targetRole, email);
            },
          });
        }
      });
    }

    // 6. Confirmation Modal Actions
    const btnCancelConfirm = document.getElementById('btnCancelAdminConfirm');
    if (btnCancelConfirm) {
      btnCancelConfirm.addEventListener('click', closeConfirmModal);
    }

    const btnProceedConfirm = document.getElementById('btnProceedAdminConfirm');
    if (btnProceedConfirm) {
      btnProceedConfirm.addEventListener('click', async () => {
        if (typeof pendingConfirmAction === 'function') {
          const action = pendingConfirmAction;
          closeConfirmModal();
          await action();
        } else {
          closeConfirmModal();
        }
      });
    }

    // Close confirm modal on backdrop click or ESC key
    const confirmModal = document.getElementById('adminConfirmModal');
    if (confirmModal) {
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
          closeConfirmModal();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('adminConfirmModal');
        if (modal && modal.style.display !== 'none') {
          closeConfirmModal();
        }
      }
    });
  }

  // ── Auto Initialization ─────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminEvents);
  } else {
    initAdminEvents();
  }

  // Expose admin controller globally for inspection or external calls
  window.pdfLinguaAdmin = {
    openAdminView,
    closeAdminView,
    fetchAdminStats,
    fetchAdminUsers,
    loadAllAdminData,
    openConfirmModal,
    closeConfirmModal,
    executeStatusUpdate,
    executeRoleUpdate,
  };
})();

