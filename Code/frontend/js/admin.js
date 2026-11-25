/**
 * PDF-Lingua Admin Console Controller
 * --------------------------------------------
 * Handles:
 * - System Overview Statistics loading & card rendering
 * - User directory listing, real-time search, filtering, and pagination
 * - Account locking and unlocking lifecycle with immediate feedback
 * - High-impact action confirmation modal before dangerous operations
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

  // Transaction table state
  let txPage = 1;
  let txTotalPages = 1;
  let txSearch = '';
  let txStatusFilter = 'all';
  let txSearchDebounceTimer = null;

  // Tabs & Access Logs state
  let activeAdminTab = 'overview';
  let logPage = 1;
  let logTotalPages = 1;
  let logSearch = '';
  let logMultiIpOnly = false;
  let logFilterUserId = null;
  let logFilterUserEmail = '';
  let logSearchDebounceTimer = null;

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
      const msg = (window.i18n && typeof window.i18n.t === 'function')
        ? window.i18n.t('admin_forbidden_toast')
        : 'Bạn không có quyền truy cập bảng quản trị.';
      notifyUser(msg, 'error');
      return;
    }

    const heroSection = document.getElementById('heroSection');
    const workspaceSection = document.getElementById('workspaceSection');
    const documentsSection = document.getElementById('documentsSection');
    const historySection = document.getElementById('historySection');
    const pricingSection = document.getElementById('pricingSection');
    const adminSection = document.getElementById('adminSection');

    if (heroSection) heroSection.style.display = 'none';
    if (workspaceSection) workspaceSection.style.display = 'none';
    if (documentsSection) documentsSection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    if (pricingSection) pricingSection.style.display = 'none';
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

  // ── API Fetch: Statistics ─────────────────────────────────────────
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
      const msg = (window.i18n && typeof window.i18n.t === 'function')
        ? window.i18n.t('admin_stats_conn_error')
        : 'Không thể kết nối đến máy chủ để tải số liệu thống kê.';
      notifyUser(msg, 'error');
    }
  }

  function renderAdminStats(stats) {
    if (!stats) return;

    const freeLabel = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('common_free') : 'Miễn phí';
    const adminLabel = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('common_admin') : 'Quản trị';
    const activeLabel = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_status_active') : 'Hoạt động';
    const lockedLabel = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_status_locked') : 'Đã khóa';
    const bytesLabel = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_bytes_label') : 'byte dữ liệu';

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
    if (elFreeUsers) elFreeUsers.textContent = `${freeLabel}: ${freeCount}`;
    if (elProUsers) elProUsers.textContent = `Pro: ${proCount}`;
    if (elAdminUsers) elAdminUsers.textContent = `${adminLabel}: ${adminCount}`;

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
    if (elActiveUsers) elActiveUsers.textContent = `${activeLabel}: ${active}`;
    if (elLockedUsers) elLockedUsers.textContent = `${lockedLabel}: ${stats.locked_users || 0}`;

    // Card 3: Documents
    const elTotalDocs = document.getElementById('statTotalDocs');
    if (elTotalDocs) elTotalDocs.textContent = (stats.total_documents || 0).toLocaleString('vi-VN');

    // Card 4: Storage
    const elTotalStorage = document.getElementById('statTotalStorage');
    const elStorageRaw = document.getElementById('statStorageRaw');

    const bytes = stats.total_storage_bytes || 0;
    if (elTotalStorage) elTotalStorage.textContent = formatBytes(bytes);
    if (elStorageRaw) elStorageRaw.textContent = `${bytes.toLocaleString('vi-VN')} ${bytesLabel}`;

    // Card 5: Service Usage Breakdown
    const services = stats.services || {};
    const extractCount = Number(services.extract_count) || 0;
    const translateCount = Number(services.translate_count) || 0;
    const summarizeCount = Number(services.summarize_count) || 0;
    const chatCount = Number(services.chat_count) || 0;
    const totalActions = Number(services.total_actions) || (extractCount + translateCount + summarizeCount + chatCount);

    const elServicesTotal = document.getElementById('statServicesTotal');
    if (elServicesTotal) {
      elServicesTotal.textContent = totalActions.toLocaleString('vi-VN');
    }

    const elExtractCount = document.getElementById('statExtractCount');
    const elTranslateCount = document.getElementById('statTranslateCount');
    const elSummarizeCount = document.getElementById('statSummarizeCount');
    const elChatCount = document.getElementById('statChatCount');

    if (elExtractCount) elExtractCount.textContent = extractCount.toLocaleString('vi-VN');
    if (elTranslateCount) elTranslateCount.textContent = translateCount.toLocaleString('vi-VN');
    if (elSummarizeCount) elSummarizeCount.textContent = summarizeCount.toLocaleString('vi-VN');
    if (elChatCount) elChatCount.textContent = chatCount.toLocaleString('vi-VN');

    const elExtractPct = document.getElementById('statExtractPct');
    const elTranslatePct = document.getElementById('statTranslatePct');
    const elSummarizePct = document.getElementById('statSummarizePct');
    const elChatPct = document.getElementById('statChatPct');

    const segExtract = document.getElementById('distSegExtract');
    const segTranslate = document.getElementById('distSegTranslate');
    const segSummarize = document.getElementById('distSegSummarize');
    const segChat = document.getElementById('distSegChat');
    const servicesProgressBar = document.getElementById('statServicesDistBar');
    const emptyHint = document.getElementById('statServicesEmptyHint');

    if (totalActions > 0) {
      const rawExtractPct = (extractCount / totalActions) * 100;
      const rawTranslatePct = (translateCount / totalActions) * 100;
      const rawSummarizePct = (summarizeCount / totalActions) * 100;
      const rawChatPct = (chatCount / totalActions) * 100;

      const extractPct = Math.round(rawExtractPct);
      const translatePct = Math.round(rawTranslatePct);
      const summarizePct = Math.round(rawSummarizePct);
      const chatPct = Math.round(rawChatPct);

      if (elExtractPct) elExtractPct.textContent = `${extractPct}%`;
      if (elTranslatePct) elTranslatePct.textContent = `${translatePct}%`;
      if (elSummarizePct) elSummarizePct.textContent = `${summarizePct}%`;
      if (elChatPct) elChatPct.textContent = `${chatPct}%`;

      if (segExtract) {
        segExtract.style.width = `${rawExtractPct}%`;
        segExtract.title = `Trích xuất: ${extractCount.toLocaleString('vi-VN')} lượt (${extractPct}%)`;
      }
      if (segTranslate) {
        segTranslate.style.width = `${rawTranslatePct}%`;
        segTranslate.title = `Dịch thuật: ${translateCount.toLocaleString('vi-VN')} lượt (${translatePct}%)`;
      }
      if (segSummarize) {
        segSummarize.style.width = `${rawSummarizePct}%`;
        segSummarize.title = `Tóm tắt AI: ${summarizeCount.toLocaleString('vi-VN')} lượt (${summarizePct}%)`;
      }
      if (segChat) {
        segChat.style.width = `${rawChatPct}%`;
        segChat.title = `Trợ lý AI Copilot: ${chatCount.toLocaleString('vi-VN')} lượt (${chatPct}%)`;
      }

      if (servicesProgressBar) {
        servicesProgressBar.setAttribute('aria-valuenow', '100');
      }
      if (emptyHint) emptyHint.style.display = 'none';
    } else {
      if (elExtractPct) elExtractPct.textContent = '0%';
      if (elTranslatePct) elTranslatePct.textContent = '0%';
      if (elSummarizePct) elSummarizePct.textContent = '0%';
      if (elChatPct) elChatPct.textContent = '0%';

      if (segExtract) {
        segExtract.style.width = '0%';
        segExtract.title = 'Trích xuất: 0 lượt (0%)';
      }
      if (segTranslate) {
        segTranslate.style.width = '0%';
        segTranslate.title = 'Dịch thuật: 0 lượt (0%)';
      }
      if (segSummarize) {
        segSummarize.style.width = '0%';
        segSummarize.title = 'Tóm tắt AI: 0 lượt (0%)';
      }
      if (segChat) {
        segChat.style.width = '0%';
        segChat.title = 'Trợ lý AI Copilot: 0 lượt (0%)';
      }

      if (servicesProgressBar) {
        servicesProgressBar.setAttribute('aria-valuenow', '0');
      }
      if (emptyHint) emptyHint.style.display = 'block';
    }
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
        <td><div class="skeleton-pill" style="width: 110px; height: 14px;"></div></td>
        <td class="text-right"><div class="skeleton-pill" style="width: 130px; height: 26px; border-radius: 6px; margin-left: auto;"></div></td>
      </tr>
    `).join('');
  }

  // ── API Fetch: User Directory ─────────────────────────────────────
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
        const loadUsersFailMsg = (window.i18n && typeof window.i18n.t === 'function')
          ? window.i18n.t('admin_load_users_failed')
          : 'Không thể tải danh sách người dùng.';
        notifyUser(loadUsersFailMsg, 'error');
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

    const accountsUnit = (window.i18n && typeof window.i18n.t === 'function')
      ? window.i18n.t('admin_accounts_count_unit')
      : 'tài khoản';
    if (countBadge) {
      countBadge.textContent = `${totalCount.toLocaleString('vi-VN')} ${accountsUnit}`;
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

    const unnamedText = (window.i18n && typeof window.i18n.t === 'function')
      ? window.i18n.t('admin_unnamed_user')
      : 'Chưa đặt tên';
    const freeText = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('common_free') : 'Miễn phí';
    const adminText = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('common_admin') : 'Quản trị';
    const activeText = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_status_active') : 'Hoạt động';
    const lockedText = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_status_locked') : 'Đã khóa';
    const btnLockText = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_btn_lock') : 'Khóa';
    const btnUnlockText = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_btn_unlock') : 'Mở khóa';
    const btnDemoteFreeText = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_btn_demote_free') : 'Hạ Miễn phí';
    const btnGrantProText = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_btn_grant_pro') : 'Cấp Pro';

    let html = '';
    users.forEach((u) => {
      const isSelf = u.id === currentAdminId;
      const initial = (u.full_name ? u.full_name.charAt(0) : (u.email ? u.email.charAt(0) : 'U')).toUpperCase();
      const displayName = u.full_name ? escapeHtml(u.full_name) : `<em>${unnamedText}</em>`;
      const email = escapeHtml(u.email);

      // Role badge with sleek inline SVG
      let roleBadgeClass = 'role-badge free';
      let roleAvatarClass = 'role-avatar-free';
      let roleLabel = `<svg class="badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${freeText}`;
      if (u.role === 'pro') {
        roleBadgeClass = 'role-badge pro';
        roleAvatarClass = 'role-avatar-pro';
        roleLabel = '<svg class="badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>Pro';
      } else if (u.role === 'admin') {
        roleBadgeClass = 'role-badge admin';
        roleAvatarClass = 'role-avatar-admin';
        roleLabel = `<svg class="badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>${adminText}`;
      }

      // Status pill with pulsing dot or locked icon
      const statusPillClass = u.is_active ? 'status-pill active' : 'status-pill locked';
      const statusLabel = u.is_active
        ? `<span class="status-dot"></span>${activeText}`
        : `<svg class="status-lock-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>${lockedText}`;

      // Action buttons with tactile feedback and crisp SVG icons
      let actionButtons = '';
      if (isSelf) {
        actionButtons = `<span class="admin-self-tag">(Tài khoản hiện tại)</span>`;
      } else {
        const toggleStatusBtn = u.is_active
          ? `<button type="button" class="btn-action btn-action-lock" data-action="lock" data-user-id="${u.id}" data-user-email="${email}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> ${btnLockText}</button>`
          : `<button type="button" class="btn-action btn-action-unlock" data-action="unlock" data-user-id="${u.id}" data-user-email="${email}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg> ${btnUnlockText}</button>`;

        const nextRole = u.role === 'pro' ? 'free' : 'pro';
        const roleBtnLabel = u.role === 'pro' ? btnDemoteFreeText : btnGrantProText;
        const roleBtnClass = u.role === 'pro' ? 'btn-action-role action-to-free' : 'btn-action-role action-to-pro';
        const changeRoleBtn = `<button type="button" class="btn-action ${roleBtnClass}" data-action="change-role" data-user-id="${u.id}" data-user-email="${email}" data-target-role="${nextRole}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> ${roleBtnLabel}</button>`;

        actionButtons = `
          <div class="user-actions-group">
            ${changeRoleBtn}
            ${toggleStatusBtn}
          </div>
        `;
      }

      let ipCellHtml = '<span class="admin-ip-none">Chưa ghi nhận</span>';
      if (u.last_ip) {
        const safeIp = escapeHtml(u.last_ip);
        const safeDev = escapeHtml(u.last_device || 'Unknown Device');
        const warnBadge = u.multi_ip_warning
          ? `<button type="button" class="admin-multi-ip-badge font-mono" data-action="filter-ip" data-user-id="${u.id}" data-user-email="${email}" title="Nhấn để xem lịch sử IP">${u.distinct_ip_count_24h || 0} IP / 24h</button>`
          : `<button type="button" class="btn-view-ip" data-action="filter-ip" data-user-id="${u.id}" data-user-email="${email}" title="Xem lịch sử IP">Xem IP</button>`;
        ipCellHtml = `
          <div class="admin-ip-cell">
            <div class="admin-ip-top">
              <span class="admin-ip-address font-mono">${safeIp}</span>
              ${warnBadge}
            </div>
            <div class="admin-ip-device">${safeDev}</div>
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
          <td>${ipCellHtml}</td>
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
      pageInfo.textContent = (window.i18n && typeof window.i18n.t === 'function')
        ? window.i18n.t('admin_pagination_info', { current: currentPage, total: totalPages, count: totalCount })
        : `Trang ${currentPage} / ${totalPages} (Tổng ${totalCount} tài khoản)`;
    }
  }

  // ── High-Impact Action Confirmation Modal ────────────────────────
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
        proceedBtn.textContent = (window.i18n && typeof window.i18n.t === 'function')
          ? window.i18n.t('admin_confirm_lock_btn')
          : 'Khóa tài khoản này';
      }
    } else if (config.actionType === 'success') {
      if (iconWrap) {
        iconWrap.style.background = '#ECFDF5';
        iconWrap.style.borderColor = '#A7F3D0';
        iconWrap.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
      }
      if (proceedBtn) {
        proceedBtn.className = 'btn btn-gradient';
        proceedBtn.textContent = (window.i18n && typeof window.i18n.t === 'function')
          ? window.i18n.t('admin_confirm_unlock_btn')
          : 'Mở khóa tài khoản';
      }
    } else {
      if (iconWrap) {
        iconWrap.style.background = '#FEF3C7';
        iconWrap.style.borderColor = '#FDE68A';
        iconWrap.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
      }
      if (proceedBtn) {
        proceedBtn.className = 'btn btn-gradient';
        proceedBtn.textContent = (window.i18n && typeof window.i18n.t === 'function')
          ? window.i18n.t('admin_confirm_change_btn')
          : 'Xác nhận thay đổi';
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

  // ── Action Handlers: Status & Role ──────────────────────
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
        const actionLabel = newActiveStatus
          ? ((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_btn_unlock') : 'Mở khóa')
          : ((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('admin_btn_lock') : 'Khóa');
        const toastMsg = (window.i18n && typeof window.i18n.t === 'function')
          ? window.i18n.t('admin_toast_user_status_updated', { action: actionLabel, email: userEmail })
          : `${actionLabel} tài khoản ${userEmail} thành công!`;
        notifyUser(toastMsg, 'success');
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
        const toastMsg = (window.i18n && typeof window.i18n.t === 'function')
          ? window.i18n.t('admin_toast_role_updated', { email: userEmail, role: newRole.toUpperCase() })
          : `Đã cập nhật vai trò ${userEmail} thành ${newRole.toUpperCase()}!`;
        notifyUser(toastMsg, 'success');
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
  function switchAdminTab(tabName) {
    const validTabs = ['overview', 'users', 'transactions'];
    const targetTab = validTabs.includes(tabName) ? tabName : 'overview';
    activeAdminTab = targetTab;

    const panelMap = {
      overview: document.getElementById('adminTabOverview'),
      users: document.getElementById('adminTabUsers'),
      transactions: document.getElementById('adminTabTransactions'),
    };
    const btnMap = {
      overview: document.getElementById('adminTabBtnOverview'),
      users: document.getElementById('adminTabBtnUsers'),
      transactions: document.getElementById('adminTabBtnTransactions'),
    };

    validTabs.forEach((key) => {
      if (panelMap[key]) {
        panelMap[key].style.display = key === targetTab ? 'block' : 'none';
      }
      if (btnMap[key]) {
        const isActive = key === targetTab;
        btnMap[key].classList.toggle('active', isActive);
        btnMap[key].setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
    });
  }

  function loadAllAdminData() {
    fetchAdminStats();
    fetchAdminUsers(1);
    fetchAdminAccessLogs(1);
    fetchAdminTransactions(1);
  }

  // ── API Fetch & Actions: User Access & IP Audit Logs ───────────────────────
  async function fetchAdminAccessLogs(page = 1) {
    const token = getStoredToken();
    if (!token) return;

    logPage = page;
    const params = new URLSearchParams({
      page: String(logPage),
      limit: '10',
    });
    if (logSearch && logSearch.trim()) params.append('search', logSearch.trim());
    if (logMultiIpOnly) params.append('multi_ip_only', 'true');
    if (logFilterUserId) params.append('user_id', String(logFilterUserId));

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/access-logs?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (res.status === 200) {
        const json = await res.json();
        renderAdminAccessLogs(json.data);
      }
    } catch (err) {
      console.error('[PDF-Lingua Admin] Error loading access logs:', err);
    }
  }

  function renderAdminAccessLogs(data) {
    if (!data) return;

    const uniqueBadge = document.getElementById('adminUniqueIps24hBadge');
    const multiBadge = document.getElementById('adminMultiIpUsersBadge');
    const tabMultiBadge = document.getElementById('adminTabMultiIpBadge');
    const multiCount = data.multi_ip_users_count || 0;

    if (uniqueBadge) uniqueBadge.textContent = `IP duy nhất (24h): ${data.unique_ips_24h || 0}`;
    if (multiBadge) multiBadge.textContent = `Cảnh báo đa IP: ${multiCount}`;
    if (tabMultiBadge) {
      tabMultiBadge.textContent = String(multiCount);
      tabMultiBadge.style.display = multiCount > 0 ? 'inline-flex' : 'none';
    }

    const tbody = document.getElementById('adminAccessLogsTableBody');
    const emptyEl = document.getElementById('adminAccessLogsEmpty');
    const tableEl = document.getElementById('adminAccessLogsTable');
    const pageInfo = document.getElementById('adminLogPaginationInfo');
    const pageBadge = document.getElementById('adminLogCurrentPageBadge');
    const prevBtn = document.getElementById('btnAdminLogPrevPage');
    const nextBtn = document.getElementById('btnAdminLogNextPage');

    logTotalPages = data.total_pages || 1;
    if (pageInfo) pageInfo.textContent = `Trang ${data.page || 1} / ${logTotalPages} (Tổng ${data.total_count || 0} lượt)`;
    if (pageBadge) pageBadge.textContent = String(data.page || 1);
    if (prevBtn) prevBtn.disabled = (data.page || 1) <= 1;
    if (nextBtn) nextBtn.disabled = (data.page || 1) >= logTotalPages;

    if (!tbody) return;
    tbody.innerHTML = '';

    const items = data.items || [];
    if (items.length === 0) {
      if (tableEl) tableEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (tableEl) tableEl.style.display = 'table';
    if (emptyEl) emptyEl.style.display = 'none';

    items.forEach((log) => {
      const tr = document.createElement('tr');
      const safeEmail = escapeHtml(log.user_email || '');
      const safeName = log.user_name ? escapeHtml(log.user_name) : '';
      const safeIp = escapeHtml(log.ip_address || 'unknown');
      const safeDevice = escapeHtml(log.device_summary || 'Unknown Device');
      const actionCls = log.action === 'register' ? 'register' : 'login';
      const actionLabel = log.action === 'register' ? 'Đăng ký' : 'Đăng nhập';
      const dateStr = log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : '-';

      tr.innerHTML = `
        <td>
          <div class="user-cell-name">${safeName || safeEmail}</div>
          <div class="user-cell-email">${safeEmail}</div>
        </td>
        <td><span class="admin-ip-address font-mono">${safeIp}</span></td>
        <td><span class="admin-ip-device" style="color:#334155; font-size:0.8125rem;">${safeDevice}</span></td>
        <td><span class="admin-log-action-pill ${actionCls}">${actionLabel}</span></td>
        <td class="text-right font-mono" style="font-size:0.78rem; color:#64748B;">${dateStr}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function filterLogsByUser(userId, email) {
    logFilterUserId = userId;
    logFilterUserEmail = email || `User #${userId}`;
    const chip = document.getElementById('adminLogUserFilterChip');
    const chipLabel = document.getElementById('adminLogUserFilterLabel');
    if (chip) chip.style.display = 'inline-flex';
    if (chipLabel) chipLabel.textContent = `Lọc: ${logFilterUserEmail}`;
    fetchAdminAccessLogs(1);
    const logsCard = document.getElementById('adminAccessLogsCard');
    if (logsCard && typeof logsCard.scrollIntoView === 'function') {
      logsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function clearLogUserFilter() {
    logFilterUserId = null;
    logFilterUserEmail = '';
    const chip = document.getElementById('adminLogUserFilterChip');
    if (chip) chip.style.display = 'none';
    fetchAdminAccessLogs(1);
  }

  // ── API Fetch & Actions: VietQR Transactions ───────────────────────────────
  async function fetchAdminTransactions(page = 1) {
    const token = getStoredToken();
    if (!token) return;

    txPage = page;
    const params = new URLSearchParams({
      page: String(txPage),
      limit: String(currentLimit),
    });
    if (txSearch && txSearch.trim()) params.append('search', txSearch.trim());
    if (txStatusFilter && txStatusFilter !== 'all') params.append('status', txStatusFilter);

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/transactions?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (res.status === 200) {
        const json = await res.json();
        renderAdminTransactions(json.data);
      }
    } catch (err) {
      console.error('[PDF-Lingua Admin] Error loading transactions:', err);
    }
  }

  function renderAdminTransactions(data) {
    if (!data) return;

    const revBadge = document.getElementById('adminTxRevenueBadge');
    const pendBadge = document.getElementById('adminTxPendingBadge');
    const tabPendingBadge = document.getElementById('adminTabPendingTxBadge');
    const pendingCnt = data.pending_count || 0;
    if (revBadge) revBadge.textContent = `Doanh thu: ${data.total_revenue_display || '0đ'}`;
    if (pendBadge) pendBadge.textContent = `Chờ duyệt: ${pendingCnt}`;
    if (tabPendingBadge) {
      tabPendingBadge.textContent = String(pendingCnt);
      tabPendingBadge.style.display = pendingCnt > 0 ? 'inline-flex' : 'none';
    }

    const tbody = document.getElementById('adminTxTableBody');
    const emptyEl = document.getElementById('adminTxTableEmpty');
    const tableEl = document.getElementById('adminTxTable');
    const pageInfo = document.getElementById('adminTxPaginationInfo');
    const pageBadge = document.getElementById('adminTxCurrentPageBadge');
    const prevBtn = document.getElementById('btnAdminTxPrevPage');
    const nextBtn = document.getElementById('btnAdminTxNextPage');

    txTotalPages = data.total_pages || 1;
    if (pageInfo) pageInfo.textContent = `Trang ${data.page || 1} / ${txTotalPages} (Tổng ${data.total_count || 0} giao dịch)`;
    if (pageBadge) pageBadge.textContent = String(data.page || 1);
    if (prevBtn) prevBtn.disabled = (data.page || 1) <= 1;
    if (nextBtn) nextBtn.disabled = (data.page || 1) >= txTotalPages;

    if (!tbody) return;
    tbody.innerHTML = '';

    const items = data.items || [];
    if (items.length === 0) {
      if (tableEl) tableEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (tableEl) tableEl.style.display = 'table';
    if (emptyEl) emptyEl.style.display = 'none';

    const statusMap = {
      pending: { label: 'Chờ duyệt', cls: 'pending' },
      completed: { label: 'Thành công', cls: 'completed' },
      failed: { label: 'Đã từ chối', cls: 'failed' },
      expired: { label: 'Hết hạn', cls: 'expired' },
    };

    items.forEach((tx) => {
      const tr = document.createElement('tr');
      const st = statusMap[tx.payment_status] || { label: tx.payment_status, cls: 'pending' };
      const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleString('vi-VN') : '-';
      const safeCode = String(tx.transaction_code || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeEmail = String(tx.user_email || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safePlan = String(tx.plan_name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      let actionsHtml = '<span class="admin-self-tag font-mono">Đã xử lý</span>';
      if (tx.payment_status === 'pending') {
        actionsHtml = `
          <div style="display:inline-flex; gap:0.4rem; justify-content:flex-end;">
            <button type="button" class="btn-tx-approve" data-tx-action="approve" data-tx-code="${safeCode}" data-tx-email="${safeEmail}">
              Duyệt Pro
            </button>
            <button type="button" class="btn-tx-reject" data-tx-action="reject" data-tx-code="${safeCode}" data-tx-email="${safeEmail}">
              Từ chối
            </button>
          </div>
        `;
      }

      tr.innerHTML = `
        <td class="font-mono">${safeCode}</td>
        <td>
          <div class="user-cell-email">${safeEmail}</div>
        </td>
        <td>${safePlan}</td>
        <td class="font-mono"><strong>${tx.amount_display}</strong></td>
        <td><span class="tx-status-pill ${st.cls}">${st.label}</span></td>
        <td class="font-mono" style="font-size:0.78rem; color:#64748B;">${dateStr}</td>
        <td class="text-right">${actionsHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function executeApproveTransaction(transactionCode) {
    const token = getStoredToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/transactions/${encodeURIComponent(transactionCode)}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const json = await res.json();
      if (res.ok) {
        notifyUser(json.message || `Đã duyệt giao dịch ${transactionCode} thành công.`, 'success');
        loadAllAdminData();
      } else {
        notifyUser(json.message || 'Không thể duyệt giao dịch.', 'error');
      }
    } catch (err) {
      notifyUser('Lỗi kết nối máy chủ khi duyệt giao dịch.', 'error');
    }
  }

  async function executeRejectTransaction(transactionCode) {
    const token = getStoredToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/transactions/${encodeURIComponent(transactionCode)}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const json = await res.json();
      if (res.ok) {
        notifyUser(json.message || `Đã từ chối giao dịch ${transactionCode}.`, 'info');
        fetchAdminTransactions(txPage);
      } else {
        notifyUser(json.message || 'Không thể từ chối giao dịch.', 'error');
      }
    } catch (err) {
      notifyUser('Lỗi kết nối máy chủ khi từ chối giao dịch.', 'error');
    }
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
          const roleDisplayName = targetRole === 'pro' ? 'Gói Pro' : 'Gói Miễn phí';
          openConfirmModal({
            title: 'Thay đổi cấp bậc tài khoản',
            desc: `Bạn có chắc chắn muốn chuyển vai trò của tài khoản này sang "${roleDisplayName}"?`,
            email: email,
            actionType: 'warning',
            onConfirm: async () => {
              await executeRoleUpdate(userId, targetRole, email);
            },
          });
        } else if (action === 'filter-ip') {
          filterLogsByUser(userId, email);
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

    // 7. VietQR Transaction Toolbar, Pagination & Action Delegation
    const txSearchInput = document.getElementById('adminTxSearchInput');
    if (txSearchInput) {
      txSearchInput.addEventListener('input', (e) => {
        txSearch = e.target.value;
        clearTimeout(txSearchDebounceTimer);
        txSearchDebounceTimer = setTimeout(() => fetchAdminTransactions(1), 350);
      });
    }

    const txStatusSelect = document.getElementById('adminTxStatusFilter');
    if (txStatusSelect) {
      txStatusSelect.addEventListener('change', (e) => {
        txStatusFilter = e.target.value;
        fetchAdminTransactions(1);
      });
    }

    const btnTxPrev = document.getElementById('btnAdminTxPrevPage');
    if (btnTxPrev) {
      btnTxPrev.addEventListener('click', () => {
        if (txPage > 1) fetchAdminTransactions(txPage - 1);
      });
    }

    const btnTxNext = document.getElementById('btnAdminTxNextPage');
    if (btnTxNext) {
      btnTxNext.addEventListener('click', () => {
        if (txPage < txTotalPages) fetchAdminTransactions(txPage + 1);
      });
    }

    const txTableBody = document.getElementById('adminTxTableBody');
    if (txTableBody) {
      txTableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-tx-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-tx-action');
        const txCode = btn.getAttribute('data-tx-code');
        const email = btn.getAttribute('data-tx-email');
        if (!txCode) return;

        if (action === 'approve') {
          openConfirmModal({
            title: 'Duyệt thanh toán & Kích hoạt gói Pro',
            desc: `Xác nhận đã nhận chuyển khoản cho mã giao dịch "${txCode}" và nâng cấp tài khoản lên Pro VIP?`,
            email: email,
            actionType: 'warning',
            onConfirm: async () => {
              await executeApproveTransaction(txCode);
            },
          });
        } else if (action === 'reject') {
          openConfirmModal({
            title: 'Từ chối giao dịch thanh toán',
            desc: `Bạn có chắc muốn đánh dấu giao dịch "${txCode}" là thất bại / từ chối?`,
            email: email,
            actionType: 'danger',
            onConfirm: async () => {
              await executeRejectTransaction(txCode);
            },
          });
        }
      });
    }

    // 8. Admin Navigation Tabs Switcher
    const adminTabsBar = document.getElementById('adminTabsBar');
    if (adminTabsBar) {
      adminTabsBar.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('button[data-admin-tab]');
        if (!tabBtn) return;
        const tabName = tabBtn.getAttribute('data-admin-tab');
        switchAdminTab(tabName);
      });
    }

    // 9. Access Logs Toolbar & Pagination
    const logSearchInput = document.getElementById('adminLogSearchInput');
    if (logSearchInput) {
      logSearchInput.addEventListener('input', (e) => {
        logSearch = e.target.value;
        clearTimeout(logSearchDebounceTimer);
        logSearchDebounceTimer = setTimeout(() => fetchAdminAccessLogs(1), 350);
      });
    }

    const logMultiSelect = document.getElementById('adminLogMultiIpFilter');
    if (logMultiSelect) {
      logMultiSelect.addEventListener('change', (e) => {
        logMultiIpOnly = e.target.value === 'true';
        fetchAdminAccessLogs(1);
      });
    }

    const btnClearLogChip = document.getElementById('btnClearLogUserFilter');
    if (btnClearLogChip) {
      btnClearLogChip.addEventListener('click', clearLogUserFilter);
    }

    const btnLogPrev = document.getElementById('btnAdminLogPrevPage');
    if (btnLogPrev) {
      btnLogPrev.addEventListener('click', () => {
        if (logPage > 1) fetchAdminAccessLogs(logPage - 1);
      });
    }

    const btnLogNext = document.getElementById('btnAdminLogNextPage');
    if (btnLogNext) {
      btnLogNext.addEventListener('click', () => {
        if (logPage < logTotalPages) fetchAdminAccessLogs(logPage + 1);
      });
    }
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
    renderAdminStats,
    fetchAdminUsers,
    loadAllAdminData,
    openConfirmModal,
    closeConfirmModal,
    executeStatusUpdate,
    executeRoleUpdate,
    fetchAdminTransactions,
    executeApproveTransaction,
    executeRejectTransaction,
    switchAdminTab,
    fetchAdminAccessLogs,
    filterLogsByUser,
    clearLogUserFilter,
  };
})();

