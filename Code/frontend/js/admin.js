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

    const total = stats.total_users || 0;
    const freeCount = stats.free_users || 0;
    const proCount = stats.pro_users || 0;
    const adminCount = stats.admin_users || 0;

    if (elTotalUsers) elTotalUsers.textContent = total.toLocaleString('vi-VN');
    if (elFreeUsers) elFreeUsers.textContent = `Free: ${freeCount}`;
    if (elProUsers) elProUsers.textContent = `Pro: ${proCount}`;
    if (elAdminUsers) elAdminUsers.textContent = `Admin: ${adminCount}`;

    // Bento Distribution Bar segments
    const segFree = document.getElementById('distSegFree');
    const segPro = document.getElementById('distSegPro');
    const segAdmin = document.getElementById('distSegAdmin');

    if (total > 0) {
      const freePct = Math.round((freeCount / total) * 100);
      const proPct = Math.round((proCount / total) * 100);
      const adminPct = Math.round((adminCount / total) * 100);

      if (segFree) segFree.style.width = `${Math.max(freePct, freeCount > 0 ? 5 : 0)}%`;
      if (segPro) segPro.style.width = `${Math.max(proPct, proCount > 0 ? 5 : 0)}%`;
      if (segAdmin) segAdmin.style.width = `${Math.max(adminPct, adminCount > 0 ? 5 : 0)}%`;
    }

    // Card 2: Account Status
    const elActiveRatio = document.getElementById('statActiveRatio');
    const elActiveUsers = document.getElementById('statActiveUsers');
    const elLockedUsers = document.getElementById('statLockedUsers');

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

  function renderSkeletonRows(count = 5) {
    return Array.from({ length: count }).map(() => `
      <tr class="admin-skeleton-row">
        <td><div class="skeleton-pill" style="width: 28px; height: 16px;"></div></td>
        <td>
          <div class="user-cell-meta">
            <div class="skeleton-circle" style="width: 38px; height: 38px;"></div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div class="skeleton-pill" style="width: 120px; height: 14px;"></div>
              <div class="skeleton-pill" style="width: 170px; height: 12px;"></div>
            </div>
          </div>
        </td>
        <td><div class="skeleton-pill" style="width: 72px; height: 22px; border-radius: 9999px;"></div></td>
        <td><div class="skeleton-pill" style="width: 80px; height: 22px; border-radius: 9999px;"></div></td>
        <td><div class="skeleton-pill" style="width: 44px; height: 16px;"></div></td>
        <td><div class="skeleton-pill" style="width: 110px; height: 14px;"></div></td>
        <td class="text-right"><div class="skeleton-pill" style="width: 130px; height: 26px; border-radius: 6px; margin-left: auto;"></div></td>
      </tr>
    `).join('');
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
      tbody.innerHTML = renderSkeletonRows(5);
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

      // Role badge with sleek inline SVG
      let roleBadgeClass = 'role-badge free';
      let roleAvatarClass = 'role-avatar-free';
      let roleLabel = '<svg class="badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>Free';
      if (u.role === 'pro') {
        roleBadgeClass = 'role-badge pro';
        roleAvatarClass = 'role-avatar-pro';
        roleLabel = '<svg class="badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>Pro VIP';
      } else if (u.role === 'admin') {
        roleBadgeClass = 'role-badge admin';
        roleAvatarClass = 'role-avatar-admin';
        roleLabel = '<svg class="badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>Admin';
      }

      // Status pill with pulsing dot or locked icon
      const statusPillClass = u.is_active ? 'status-pill active' : 'status-pill locked';
      const statusLabel = u.is_active
        ? '<span class="status-dot"></span>Hoạt động'
        : '<svg class="status-lock-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>Đã khóa';

      // Action buttons with tactile feedback and crisp SVG icons
      let actionButtons = '';
      if (isSelf) {
        actionButtons = `<span class="admin-self-tag">(Tài khoản hiện tại)</span>`;
      } else {
        const toggleStatusBtn = u.is_active
          ? `<button type="button" class="btn-action btn-action-lock" data-action="lock" data-user-id="${u.id}" data-user-email="${email}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Khóa</button>`
          : `<button type="button" class="btn-action btn-action-unlock" data-action="unlock" data-user-id="${u.id}" data-user-email="${email}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg> Mở khóa</button>`;

        const nextRole = u.role === 'pro' ? 'free' : 'pro';
        const roleBtnLabel = u.role === 'pro' ? 'Hạ Free' : 'Cấp Pro';
        const roleBtnClass = u.role === 'pro' ? 'btn-action-role action-to-free' : 'btn-action-role action-to-pro';
        const changeRoleBtn = `<button type="button" class="btn-action ${roleBtnClass}" data-action="change-role" data-user-id="${u.id}" data-user-email="${email}" data-target-role="${nextRole}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> ${roleBtnLabel}</button>`;

        actionButtons = `
          <div class="user-actions-group">
            ${changeRoleBtn}
            ${toggleStatusBtn}
          </div>
        `;
      }

      html += `
        <tr>
          <td><span class="user-id-mono">#${u.id}</span></td>
          <td>
            <div class="user-cell-meta">
              <div class="user-cell-avatar ${roleAvatarClass}">${escapeHtml(initial)}</div>
              <div>
                <div class="user-cell-name">${displayName}</div>
                <div class="user-cell-email">${email}</div>
              </div>
            </div>
          </td>
          <td><span class="${roleBadgeClass}">${roleLabel}</span></td>
          <td><span class="${statusPillClass}">${statusLabel}</span></td>
          <td><span class="doc-count-mono">${u.document_count || 0}</span> <span class="doc-unit">tệp</span></td>
          <td><span class="date-mono">${formatDate(u.created_at)}</span></td>
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
        iconWrap.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E11D48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';
      }
      if (proceedBtn) {
        proceedBtn.className = 'btn btn-danger';
        proceedBtn.textContent = 'Khóa tài khoản này';
      }
    } else if (config.actionType === 'success') {
      if (iconWrap) {
        iconWrap.style.background = '#ECFDF5';
        iconWrap.style.borderColor = '#A7F3D0';
        iconWrap.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
      }
      if (proceedBtn) {
        proceedBtn.className = 'btn btn-gradient';
        proceedBtn.textContent = 'Mở khóa tài khoản';
      }
    } else {
      if (iconWrap) {
        iconWrap.style.background = '#FEF3C7';
        iconWrap.style.borderColor = '#FDE68A';
        iconWrap.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
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
    // 1. Navigation Buttons (Admin navigation handled via left sidebar #sideNavAdmin)
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

