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

  // Cached payloads for instant re-render on language change
  let lastStatsData = null;
  let lastUsersItems = null;
  let lastAccessLogsData = null;
  let lastTransactionsData = null;

  // ── Helper Utilities ────────────────────────────────────────────────────────
  function t(key, fallback, params) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const translated = window.i18n.t(key, params);
      if (translated && translated !== key) return translated;
    }
    let result = fallback;
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((paramKey) => {
        result = result.replace(new RegExp('\\{' + paramKey + '\\}', 'g'), params[paramKey]);
      });
    }
    return result;
  }

  function getLocale() {
    const lang = (window.i18n && typeof window.i18n.getLanguage === 'function')
      ? window.i18n.getLanguage()
      : 'vi';
    return lang === 'en' ? 'en-US' : 'vi-VN';
  }
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
  function openAdminView(initialTab) {
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

    // Switch to requested tab and load fresh data
    if (initialTab) {
      switchAdminTab(initialTab);
    } else {
      switchAdminTab(activeAdminTab || 'overview');
    }
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
        notifyUser(t('admin_session_expired_toast', 'Phiên làm việc hết hạn hoặc bạn không có quyền Admin.'), 'error');
        closeAdminView();
      }
    } catch (err) {
      console.error('[PDF-Lingua Admin] Error loading stats:', err);
      notifyUser(t('admin_stats_conn_error', 'Không thể kết nối đến máy chủ để tải số liệu thống kê.'), 'error');
    }
  }

  function renderAdminStats(stats) {
    if (!stats) return;
    lastStatsData = stats;
    const locale = getLocale();

    const freeLabel = t('common_free', 'Miễn phí');
    const adminLabel = t('common_admin', 'Quản trị');
    const activeLabel = t('admin_status_active', 'Hoạt động');
    const lockedLabel = t('admin_status_locked', 'Đã khóa');
    const bytesLabel = t('admin_bytes_label', 'byte dữ liệu');
    const extractShort = t('admin_service_extract_short', 'Trích xuất');
    const translateShort = t('admin_service_translate_short', 'Dịch thuật');
    const summarizeShort = t('admin_service_summarize', 'Tóm tắt AI');
    const chatShort = t('admin_service_chat', 'Trợ lý AI Copilot');

    // Card 1: Users
    const elTotalUsers = document.getElementById('statTotalUsers');
    const elFreeUsers = document.getElementById('statFreeUsers');
    const elProUsers = document.getElementById('statProUsers');
    const elAdminUsers = document.getElementById('statAdminUsers');

    const total = stats.total_users || 0;
    const freeCount = stats.free_users || 0;
    const proCount = stats.pro_users || 0;
    const adminCount = stats.admin_users || 0;

    if (elTotalUsers) elTotalUsers.textContent = total.toLocaleString(locale);
    if (elFreeUsers) elFreeUsers.textContent = `${freeLabel}: ${freeCount}`;
    if (elProUsers) elProUsers.textContent = `Pro: ${proCount}`;
    if (elAdminUsers) elAdminUsers.textContent = `${adminLabel}: ${adminCount}`;

    // Bento Distribution Bar segments
    const segFree = document.getElementById('distSegFree');
    const segPro = document.getElementById('distSegPro');
    const segAdmin = document.getElementById('distSegAdmin');
    if (segFree) segFree.title = t('admin_seg_free_title', 'Tài khoản Miễn phí');
    if (segPro) segPro.title = t('admin_seg_pro_title', 'Tài khoản Pro');
    if (segAdmin) segAdmin.title = t('admin_seg_admin_title', 'Tài khoản Quản trị');

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
    if (elTotalDocs) elTotalDocs.textContent = (stats.total_documents || 0).toLocaleString(locale);

    // Card 4: Storage
    const elTotalStorage = document.getElementById('statTotalStorage');
    const elStorageRaw = document.getElementById('statStorageRaw');

    const bytes = stats.total_storage_bytes || 0;
    if (elTotalStorage) elTotalStorage.textContent = formatBytes(bytes);
    if (elStorageRaw) elStorageRaw.textContent = `${bytes.toLocaleString(locale)} ${bytesLabel}`;

    // Card 5: Service Usage Breakdown
    const services = stats.services || {};
    const extractCount = Number(services.extract_count) || 0;
    const translateCount = Number(services.translate_count) || 0;
    const summarizeCount = Number(services.summarize_count) || 0;
    const chatCount = Number(services.chat_count) || 0;
    const totalActions = Number(services.total_actions) || (extractCount + translateCount + summarizeCount + chatCount);

    const elServicesTotal = document.getElementById('statServicesTotal');
    if (elServicesTotal) {
      elServicesTotal.textContent = totalActions.toLocaleString(locale);
    }

    const elExtractCount = document.getElementById('statExtractCount');
    const elTranslateCount = document.getElementById('statTranslateCount');
    const elSummarizeCount = document.getElementById('statSummarizeCount');
    const elChatCount = document.getElementById('statChatCount');

    if (elExtractCount) elExtractCount.textContent = extractCount.toLocaleString(locale);
    if (elTranslateCount) elTranslateCount.textContent = translateCount.toLocaleString(locale);
    if (elSummarizeCount) elSummarizeCount.textContent = summarizeCount.toLocaleString(locale);
    if (elChatCount) elChatCount.textContent = chatCount.toLocaleString(locale);

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
        segExtract.title = t('admin_services_tooltip', `${extractShort}: ${extractCount.toLocaleString(locale)} lượt (${extractPct}%)`, {
          name: extractShort,
          count: extractCount.toLocaleString(locale),
          pct: extractPct,
        });
      }
      if (segTranslate) {
        segTranslate.style.width = `${rawTranslatePct}%`;
        segTranslate.title = t('admin_services_tooltip', `${translateShort}: ${translateCount.toLocaleString(locale)} lượt (${translatePct}%)`, {
          name: translateShort,
          count: translateCount.toLocaleString(locale),
          pct: translatePct,
        });
      }
      if (segSummarize) {
        segSummarize.style.width = `${rawSummarizePct}%`;
        segSummarize.title = t('admin_services_tooltip', `${summarizeShort}: ${summarizeCount.toLocaleString(locale)} lượt (${summarizePct}%)`, {
          name: summarizeShort,
          count: summarizeCount.toLocaleString(locale),
          pct: summarizePct,
        });
      }
      if (segChat) {
        segChat.style.width = `${rawChatPct}%`;
        segChat.title = t('admin_services_tooltip', `${chatShort}: ${chatCount.toLocaleString(locale)} lượt (${chatPct}%)`, {
          name: chatShort,
          count: chatCount.toLocaleString(locale),
          pct: chatPct,
        });
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
        segExtract.title = t('admin_services_tooltip', `${extractShort}: 0 lượt (0%)`, { name: extractShort, count: 0, pct: 0 });
      }
      if (segTranslate) {
        segTranslate.style.width = '0%';
        segTranslate.title = t('admin_services_tooltip', `${translateShort}: 0 lượt (0%)`, { name: translateShort, count: 0, pct: 0 });
      }
      if (segSummarize) {
        segSummarize.style.width = '0%';
        segSummarize.title = t('admin_services_tooltip', `${summarizeShort}: 0 lượt (0%)`, { name: summarizeShort, count: 0, pct: 0 });
      }
      if (segChat) {
        segChat.style.width = '0%';
        segChat.title = t('admin_services_tooltip', `${chatShort}: 0 lượt (0%)`, { name: chatShort, count: 0, pct: 0 });
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
        notifyUser(t('admin_session_expired_toast', 'Phiên làm việc hết hạn hoặc bạn không có quyền Admin.'), 'error');
        closeAdminView();
      } else {
        notifyUser(t('admin_load_users_failed', 'Không thể tải danh sách người dùng.'), 'error');
      }
    } catch (err) {
      console.error('[PDF-Lingua Admin] Error loading user list:', err);
      notifyUser(t('admin_load_users_conn_error', 'Lỗi kết nối khi tải danh sách người dùng.'), 'error');
    } finally {
      isFetching = false;
    }
  }

  function renderAdminUsersTable(users) {
    lastUsersItems = users || [];
    const locale = getLocale();
    const tbody = document.getElementById('adminUsersTableBody');
    const emptyState = document.getElementById('adminTableEmptyState');
    const tableEl = document.getElementById('adminUsersTable');
    const countBadge = document.getElementById('adminUsersCountBadge');

    const accountsUnit = t('admin_accounts_count_unit', 'tài khoản');
    if (countBadge) {
      countBadge.textContent = `${totalCount.toLocaleString(locale)} ${accountsUnit}`;
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

    const unnamedText = t('admin_unnamed_user', 'Chưa đặt tên');
    const freeText = t('common_free', 'Miễn phí');
    const adminText = t('common_admin', 'Quản trị');
    const activeText = t('admin_status_active', 'Hoạt động');
    const lockedText = t('admin_status_locked', 'Đã khóa');
    const btnLockText = t('admin_btn_lock', 'Khóa');
    const btnUnlockText = t('admin_btn_unlock', 'Mở khóa');
    const btnDemoteFreeText = t('admin_btn_demote_free', 'Hạ Miễn phí');
    const btnGrantProText = t('admin_btn_grant_pro', 'Cấp Pro');
    const selfAccountText = t('admin_self_account_tag', '(Tài khoản hiện tại)');
    const ipNotRecordedText = t('admin_ip_not_recorded', 'Chưa ghi nhận');
    const unknownDeviceText = t('admin_unknown_device', 'Thiết bị chưa rõ');
    const ipBadgeTitle = t('admin_ip_badge_title', 'Nhấn để xem lịch sử IP');
    const viewIpText = t('admin_btn_view_ip', 'Xem IP');
    const viewIpTitle = t('admin_btn_view_ip_title', 'Xem lịch sử IP');
    const docUnitText = t('admin_doc_unit', 'tệp');

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
        actionButtons = `<span class="admin-self-tag">${selfAccountText}</span>`;
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

      let ipCellHtml = `<span class="admin-ip-none">${ipNotRecordedText}</span>`;
      if (u.last_ip) {
        const safeIp = escapeHtml(u.last_ip);
        const safeDev = escapeHtml(u.last_device || unknownDeviceText);
        const warnBadge = u.multi_ip_warning
          ? `<button type="button" class="admin-multi-ip-badge font-mono" data-action="filter-ip" data-user-id="${u.id}" data-user-email="${email}" title="${ipBadgeTitle}">${u.distinct_ip_count_24h || 0} IP / 24h</button>`
          : `<button type="button" class="btn-view-ip" data-action="filter-ip" data-user-id="${u.id}" data-user-email="${email}" title="${viewIpTitle}">${viewIpText}</button>`;
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
          <td><span class="doc-count-mono">${u.document_count || 0}</span> <span class="doc-unit">${docUnitText}</span></td>
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

    if (titleEl) titleEl.textContent = config.title || t('admin_confirm_title', 'Xác nhận thao tác trọng yếu');
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
        const errMsg = json.message || t('admin_action_failed', 'Thao tác không thành công.');
        notifyUser(errMsg, 'error');
      }
    } catch (err) {
      console.error('[PDF-Lingua Admin] Status update error:', err);
      notifyUser(t('admin_status_conn_error', 'Lỗi kết nối máy chủ khi cập nhật trạng thái.'), 'error');
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
        const toastMsg = t('admin_toast_role_updated', `Đã cập nhật vai trò ${userEmail} thành ${newRole.toUpperCase()}!`, {
          email: userEmail,
          role: newRole.toUpperCase(),
        });
        notifyUser(toastMsg, 'success');
        // Refresh table & stats
        fetchAdminUsers(currentPage);
        fetchAdminStats();
      } else {
        const errMsg = json.message || t('admin_role_action_failed', 'Thao tác đổi quyền không thành công.');
        notifyUser(errMsg, 'error');
      }
    } catch (err) {
      console.error('[PDF-Lingua Admin] Role update error:', err);
      notifyUser(t('admin_role_conn_error', 'Lỗi kết nối máy chủ khi cập nhật vai trò.'), 'error');
    }
  }

  // ── Master Loader ───────────────────────────────────────────────────────────
  function switchAdminTab(tabName) {
    const validTabs = ['overview', 'users', 'access-logs', 'transactions'];
    const targetTab = validTabs.includes(tabName) ? tabName : 'overview';
    activeAdminTab = targetTab;

    const panelMap = {
      overview: document.getElementById('adminTabOverview'),
      users: document.getElementById('adminTabUsers'),
      'access-logs': document.getElementById('adminTabAccessLogs'),
      transactions: document.getElementById('adminTabTransactions'),
    };
    const btnMap = {
      overview: document.getElementById('sideNavAdminOverview'),
      users: document.getElementById('sideNavAdminUsers'),
      'access-logs': document.getElementById('sideNavAdminAccessLogs'),
      transactions: document.getElementById('sideNavAdminTransactions'),
    };

    validTabs.forEach((key) => {
      if (panelMap[key]) {
        panelMap[key].style.display = key === targetTab ? 'block' : 'none';
      }
      if (btnMap[key]) {
        const isActive = key === targetTab;
        btnMap[key].classList.toggle('active', isActive);
        if (isActive) {
          btnMap[key].setAttribute('aria-current', 'page');
        } else {
          btnMap[key].removeAttribute('aria-current');
        }
      }
    });

    if (window.PDFLinguaSidebar && typeof window.PDFLinguaSidebar.setActiveAdminSubmenu === 'function') {
      window.PDFLinguaSidebar.setActiveAdminSubmenu(targetTab);
    }
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
    lastAccessLogsData = data;
    const locale = getLocale();

    const uniqueBadge = document.getElementById('adminUniqueIps24hBadge');
    const multiBadge = document.getElementById('adminMultiIpUsersBadge');
    const tabMultiBadge = document.getElementById('adminTabMultiIpBadge');
    const multiCount = data.multi_ip_users_count || 0;

    if (uniqueBadge) {
      uniqueBadge.textContent = t('admin_ip_unique_badge', `IP duy nhất (24h): ${data.unique_ips_24h || 0}`, {
        count: data.unique_ips_24h || 0,
      });
    }
    if (multiBadge) {
      multiBadge.textContent = t('admin_ip_multi_badge', `Cảnh báo đa IP: ${multiCount}`, {
        count: multiCount,
      });
    }
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
    if (pageInfo) {
      pageInfo.textContent = t(
        'admin_ip_pagination_info',
        `Trang ${data.page || 1} / ${logTotalPages} (Tổng ${data.total_count || 0} lượt)`,
        { current: data.page || 1, total: logTotalPages, count: data.total_count || 0 }
      );
    }
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

    const unknownDevText = t('admin_unknown_device', 'Thiết bị chưa rõ');
    const registerActionText = t('admin_action_register', 'Đăng ký');
    const loginActionText = t('admin_action_login', 'Đăng nhập');

    items.forEach((log) => {
      const tr = document.createElement('tr');
      const safeEmail = escapeHtml(log.user_email || '');
      const safeName = log.user_name ? escapeHtml(log.user_name) : '';
      const initial = (log.user_name ? log.user_name.charAt(0) : (log.user_email ? log.user_email.charAt(0) : 'U')).toUpperCase();
      const safeIp = escapeHtml(log.ip_address || 'unknown');
      const safeDevice = escapeHtml(log.device_summary || unknownDevText);
      const actionCls = log.action === 'register' ? 'register' : 'login';
      const actionLabel = log.action === 'register' ? registerActionText : loginActionText;
      const dateStr = log.created_at ? new Date(log.created_at).toLocaleString(locale) : '-';

      tr.innerHTML = `
        <td>
          <div class="user-cell-meta">
            <div class="user-cell-avatar role-avatar-free">${escapeHtml(initial)}</div>
            <div>
              <div class="user-cell-name">${safeName || safeEmail}</div>
              <div class="user-cell-email">${safeEmail}</div>
            </div>
          </div>
        </td>
        <td><span class="admin-ip-address font-mono">${safeIp}</span></td>
        <td><span class="admin-ip-device">${safeDevice}</span></td>
        <td><span class="admin-log-action-pill ${actionCls}"><span class="tx-status-dot"></span>${actionLabel}</span></td>
        <td class="text-right"><span class="date-mono">${dateStr}</span></td>
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
    if (chipLabel) {
      chipLabel.textContent = t('admin_ip_filter_chip', `Lọc: ${logFilterUserEmail}`, { email: logFilterUserEmail });
    }
    switchAdminTab('access-logs');
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
    lastTransactionsData = data;
    const locale = getLocale();

    const revBadge = document.getElementById('adminTxRevenueBadge');
    const pendBadge = document.getElementById('adminTxPendingBadge');
    const tabPendingBadge = document.getElementById('adminTabPendingTxBadge');
    const pendingCnt = data.pending_count || 0;
    if (revBadge) {
      revBadge.textContent = t('admin_tx_revenue_badge', `Doanh thu: ${data.total_revenue_display || '0đ'}`, {
        amount: data.total_revenue_display || '0đ',
      });
    }
    if (pendBadge) {
      pendBadge.textContent = t('admin_tx_pending_badge', `Chờ duyệt: ${pendingCnt}`, {
        count: pendingCnt,
      });
    }
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
    if (pageInfo) {
      pageInfo.textContent = t(
        'admin_tx_pagination_info',
        `Trang ${data.page || 1} / ${txTotalPages} (Tổng ${data.total_count || 0} giao dịch)`,
        { current: data.page || 1, total: txTotalPages, count: data.total_count || 0 }
      );
    }
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
      pending: { label: t('admin_tx_status_pending', 'Chờ duyệt'), cls: 'pending' },
      completed: { label: t('admin_tx_status_completed', 'Thành công'), cls: 'completed' },
      failed: { label: t('admin_tx_status_failed', 'Đã từ chối'), cls: 'failed' },
      expired: { label: t('admin_tx_status_expired', 'Hết hạn'), cls: 'expired' },
    };
    const processedText = t('admin_tx_processed', 'Đã xử lý');
    const approveBtnText = t('admin_tx_btn_approve', 'Duyệt Pro');
    const rejectBtnText = t('admin_tx_btn_reject', 'Từ chối');

    items.forEach((tx) => {
      const tr = document.createElement('tr');
      const st = statusMap[tx.payment_status] || { label: tx.payment_status, cls: 'pending' };
      const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleString(locale) : '-';
      const safeCode = escapeHtml(tx.transaction_code || '');
      const safeEmail = escapeHtml(tx.user_email || '');
      const rawPlan = String(tx.plan_name || '');
      const isYearlyPlan = /năm|year/i.test(rawPlan) || String(tx.billing_cycle || '').toLowerCase() === 'yearly';
      const isMonthlyPlan = /tháng|month/i.test(rawPlan) || String(tx.billing_cycle || '').toLowerCase() === 'monthly';
      const localizedPlan = isYearlyPlan
        ? t('admin_tx_plan_yearly', rawPlan || 'Gói Pro Hàng Năm')
        : (isMonthlyPlan ? t('admin_tx_plan_monthly', rawPlan || 'Gói Pro Hàng Tháng') : rawPlan);
      const safePlan = escapeHtml(localizedPlan);

      let actionsHtml = `<span class="admin-self-tag font-mono">${processedText}</span>`;
      if (tx.payment_status === 'pending') {
        actionsHtml = `
          <div class="user-actions-group">
            <button type="button" class="btn-tx-approve" data-tx-action="approve" data-tx-code="${safeCode}" data-tx-email="${safeEmail}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ${approveBtnText}
            </button>
            <button type="button" class="btn-tx-reject" data-tx-action="reject" data-tx-code="${safeCode}" data-tx-email="${safeEmail}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              ${rejectBtnText}
            </button>
          </div>
        `;
      }

      tr.innerHTML = `
        <td><span class="tx-code-chip font-mono">${safeCode}</span></td>
        <td>
          <div class="user-cell-email">${safeEmail}</div>
        </td>
        <td><span class="tx-plan-pill ${isYearlyPlan ? 'yearly' : ''}">${safePlan}</span></td>
        <td><span class="tx-amount-mono">${escapeHtml(tx.amount_display || '')}</span></td>
        <td><span class="tx-status-pill ${st.cls}"><span class="tx-status-dot"></span>${st.label}</span></td>
        <td><span class="date-mono">${dateStr}</span></td>
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
        notifyUser(json.message || t('admin_tx_approve_success', `Đã duyệt giao dịch ${transactionCode} thành công.`, { code: transactionCode }), 'success');
        loadAllAdminData();
      } else {
        notifyUser(json.message || t('admin_tx_approve_failed', 'Không thể duyệt giao dịch.'), 'error');
      }
    } catch (err) {
      notifyUser(t('admin_tx_approve_conn_error', 'Lỗi kết nối máy chủ khi duyệt giao dịch.'), 'error');
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
        notifyUser(json.message || t('admin_tx_reject_success', `Đã từ chối giao dịch ${transactionCode}.`, { code: transactionCode }), 'info');
        fetchAdminTransactions(txPage);
      } else {
        notifyUser(json.message || t('admin_tx_reject_failed', 'Không thể từ chối giao dịch.'), 'error');
      }
    } catch (err) {
      notifyUser(t('admin_tx_reject_conn_error', 'Lỗi kết nối máy chủ khi từ chối giao dịch.'), 'error');
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
            title: t('admin_confirm_lock_title', 'Khóa tài khoản người dùng'),
            desc: t(
              'admin_confirm_lock_desc',
              'Bạn có chắc chắn muốn KHÓA tài khoản này? Người dùng sẽ bị thu hồi quyền truy cập và bị từ chối mọi yêu cầu xử lý tài liệu ngay lập tức.'
            ),
            email: email,
            actionType: 'danger',
            onConfirm: async () => {
              await executeStatusUpdate(userId, false, email);
            },
          });
        } else if (action === 'unlock') {
          openConfirmModal({
            title: t('admin_confirm_unlock_title', 'Mở khóa tài khoản người dùng'),
            desc: t(
              'admin_confirm_unlock_desc',
              'Bạn có chắc chắn muốn MỞ KHÓA tài khoản này? Người dùng sẽ được phục hồi quyền đăng nhập và xử lý tài liệu.'
            ),
            email: email,
            actionType: 'success',
            onConfirm: async () => {
              await executeStatusUpdate(userId, true, email);
            },
          });
        } else if (action === 'change-role') {
          const targetRole = btn.getAttribute('data-target-role') || 'pro';
          const roleDisplayName = targetRole === 'pro'
            ? t('admin_plan_pro', 'Gói Pro')
            : t('admin_plan_free', 'Gói Miễn phí');
          openConfirmModal({
            title: t('admin_confirm_role_title', 'Thay đổi cấp bậc tài khoản'),
            desc: t(
              'admin_confirm_role_desc',
              `Bạn có chắc chắn muốn chuyển vai trò của tài khoản này sang "${roleDisplayName}"?`,
              { role: roleDisplayName }
            ),
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
            title: t('admin_confirm_tx_approve_title', 'Duyệt thanh toán & Kích hoạt gói Pro'),
            desc: t(
              'admin_confirm_tx_approve_desc',
              `Xác nhận đã nhận chuyển khoản cho mã giao dịch "${txCode}" và nâng cấp tài khoản lên Pro VIP?`,
              { code: txCode }
            ),
            email: email,
            actionType: 'warning',
            onConfirm: async () => {
              await executeApproveTransaction(txCode);
            },
          });
        } else if (action === 'reject') {
          openConfirmModal({
            title: t('admin_confirm_tx_reject_title', 'Từ chối giao dịch thanh toán'),
            desc: t(
              'admin_confirm_tx_reject_desc',
              `Bạn có chắc muốn đánh dấu giao dịch "${txCode}" là thất bại / từ chối?`,
              { code: txCode }
            ),
            email: email,
            actionType: 'danger',
            onConfirm: async () => {
              await executeRejectTransaction(txCode);
            },
          });
        }
      });
    }

    // 8. Access Logs Toolbar & Pagination
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

    // Re-render dynamic admin tables & stats immediately when language changes
    document.addEventListener('languageChanged', () => {
      if (lastStatsData) renderAdminStats(lastStatsData);
      if (lastUsersItems) {
        renderAdminUsersTable(lastUsersItems);
        renderPaginationControls();
      }
      if (lastAccessLogsData) renderAdminAccessLogs(lastAccessLogsData);
      if (lastTransactionsData) renderAdminTransactions(lastTransactionsData);
      if (logFilterUserId) {
        const chipLabel = document.getElementById('adminLogUserFilterLabel');
        if (chipLabel) {
          chipLabel.textContent = t('admin_ip_filter_chip', `Lọc: ${logFilterUserEmail}`, { email: logFilterUserEmail });
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
    renderAdminStats,
    fetchAdminUsers,
    renderAdminUsersTable,
    loadAllAdminData,
    openConfirmModal,
    closeConfirmModal,
    executeStatusUpdate,
    executeRoleUpdate,
    fetchAdminTransactions,
    renderAdminTransactions,
    executeApproveTransaction,
    executeRejectTransaction,
    switchAdminTab,
    fetchAdminAccessLogs,
    renderAdminAccessLogs,
    filterLogsByUser,
    clearLogUserFilter,
  };
})();

