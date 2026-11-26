/**
 * Admin Users, IP Access Audit Logs & VietQR Transactions UI Test Suite
 * ----------------------------------------------------------------------
 * Verifies:
 * 1. CSS & Layout Anti-Slop: single-line nowrap guards on pills/buttons, toolbar padding,
 *    no dashed self-tag boxes, no italic placeholder labels, custom filter chevrons.
 * 2. User Directory Rendering: role badges, active/locked pills, multi-IP warning vs view-IP,
 *    current admin self-tag, pagination info, and empty state.
 * 3. IP Access Audit Logs: 24h unique IP & multi-IP alert badges, login/register pills,
 *    user filter chip flow, and XSS escaping.
 * 4. VietQR Transactions: revenue/pending KPI pills, transaction code chips, yearly/monthly plan
 *    localization, pending approve/reject buttons, processed state, and confirm modal delegation.
 * 5. Live i18n Synchronization: switching VI -> EN re-renders dynamic tables and badges cleanly.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const componentsCssSource = fs.readFileSync(path.resolve(__dirname, '../css/components.css'), 'utf8');
const adminJsSource = fs.readFileSync(path.resolve(__dirname, '../js/admin.js'), 'utf8');
const i18nJsSource = fs.readFileSync(path.resolve(__dirname, '../js/i18n.js'), 'utf8');

class ClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }
  add(v) { this.values.add(v); }
  remove(v) { this.values.delete(v); }
  contains(v) { return this.values.has(v); }
  toggle(v, force) {
    if (typeof force === 'boolean') {
      if (force) this.add(v); else this.remove(v);
    } else {
      if (this.contains(v)) this.remove(v); else this.add(v);
    }
  }
}

class MockElement {
  constructor(id, tagName = 'div', initialClasses = []) {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.textContent = '';
    this._innerHTML = '';
    this.value = '';
    this.disabled = false;
    this.title = '';
    this.style = {};
    this.attributes = {};
    this.classList = new ClassList(initialClasses);
    this.listeners = {};
    this.children = [];
  }
  set innerHTML(val) {
    this._innerHTML = String(val);
    if (val === '') this.children = [];
  }
  get innerHTML() {
    return this._innerHTML;
  }
  appendChild(child) {
    this.children.push(child);
    this._innerHTML += `<${child.tagName.toLowerCase()}>${child.innerHTML}</${child.tagName.toLowerCase()}>`;
    return child;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(ev, fn) {
    this.listeners[ev] = this.listeners[ev] || [];
    this.listeners[ev].push(fn);
  }
  scrollIntoView() {}
}

function createEnv(lang = 'vi') {
  const store = {
    pdfl_token: 'admin_token_xyz',
    pdfl_user: JSON.stringify({ id: 9, email: 'admin@gmail.com', role: 'admin' }),
    pdfl_lang: lang,
  };
  const mockStorage = {
    getItem: (k) => (store[k] !== undefined ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };

  const i18nCtx = {
    window: {},
    document: {
      documentElement: {},
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {},
      dispatchEvent: () => {},
      readyState: 'complete',
    },
    localStorage: mockStorage,
    CustomEvent: function (name, opts) { this.type = name; this.detail = opts?.detail; },
  };
  i18nCtx.window = i18nCtx;
  vm.runInNewContext(i18nJsSource, i18nCtx);
  i18nCtx.window.i18n.setLanguage(lang);

  const ids = [
    'adminSection', 'adminTabOverview', 'adminTabUsers', 'adminTabAccessLogs', 'adminTabTransactions',
    'sideNavAdminOverview', 'sideNavAdminUsers', 'sideNavAdminAccessLogs', 'sideNavAdminTransactions',
    'adminUsersCountBadge', 'adminUsersTableBody', 'adminTableEmptyState', 'adminUsersTable',
    'adminPaginationInfo', 'adminCurrentPageBadge', 'btnAdminPrevPage', 'btnAdminNextPage',
    'adminUniqueIps24hBadge', 'adminMultiIpUsersBadge', 'adminTabMultiIpBadge',
    'adminTrafficSection', 'adminTrafficTotalCount', 'adminTrafficUniqueCount',
    'adminTrafficTotalSvg', 'adminTrafficTotalChart', 'adminTrafficTotalTooltip',
    'adminTrafficUniqueSvg', 'adminTrafficUniqueChart', 'adminTrafficUniqueTooltip',
    'adminAccessLogsCard', 'adminAccessLogsTableBody', 'adminAccessLogsEmpty', 'adminAccessLogsTable',
    'adminLogPaginationInfo', 'adminLogCurrentPageBadge', 'btnAdminLogPrevPage', 'btnAdminLogNextPage',
    'adminLogUserFilterChip', 'adminLogUserFilterLabel', 'btnClearLogUserFilter',
    'adminTxRevenueBadge', 'adminTxPendingBadge', 'adminTabPendingTxBadge',
    'adminTxTableBody', 'adminTxTableEmpty', 'adminTxTable',
    'adminTxPaginationInfo', 'adminTxCurrentPageBadge', 'btnAdminTxPrevPage', 'btnAdminTxNextPage',
    'adminConfirmModal', 'confirmModalTitle', 'confirmModalDesc', 'confirmModalTargetEmail',
    'confirmModalIconWrap', 'btnProceedAdminConfirm', 'btnCancelAdminConfirm',
  ];

  const elements = {};
  ids.forEach((id) => { elements[id] = new MockElement(id); });

  const docListeners = {};
  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    createElement: (tag) => new MockElement('', tag),
    querySelector: (sel) => (sel.startsWith('#') ? elements[sel.slice(1)] || null : null),
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => {
      docListeners[ev] = docListeners[ev] || [];
      docListeners[ev].push(fn);
    },
    dispatchEvent: (ev) => {
      (docListeners[ev.type] || []).forEach((fn) => fn(ev));
    },
    readyState: 'complete',
  };

  const sandbox = {
    window: {
      location: { protocol: 'http:', port: '8000' },
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      i18n: i18nCtx.window.i18n,
      pdfLinguaAuth: null,
      pdfLinguaAdmin: null,
    },
    document: mockDocument,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    fetch: async () => ({
      status: 200,
      ok: true,
      json: async () => ({ success: true, data: { items: [], total_count: 0, page: 1, total_pages: 1 } }),
    }),
    console: { log: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    URLSearchParams: URLSearchParams,
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = mockDocument;

  vm.runInNewContext(adminJsSource, vm.createContext(sandbox));
  return { elements, admin: sandbox.window.pdfLinguaAdmin, i18n: i18nCtx.window.i18n, docListeners };
}

let passed = 0;
let total = 0;
function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log('Admin Users, IP Access Audit & VietQR Transactions UI Test Suite');
console.log('================================================================\n');

test('CSS Anti-Slop: Single-line nowrap rules and padded toolbars enforced', () => {
  assert(componentsCssSource.includes('.role-badge'), 'Missing .role-badge rule');
  const extractRule = (sel) => {
    const idx = componentsCssSource.indexOf(sel);
    assert(idx !== -1, `Missing CSS block for ${sel}`);
    const end = componentsCssSource.indexOf('}', idx);
    return componentsCssSource.slice(idx, end);
  };

  [
    '.role-badge {',
    '.status-pill {',
    '.btn-action {',
    '.tx-status-pill {',
    '.btn-tx-approve {',
    '.btn-tx-reject {',
    '.admin-log-action-pill {',
    '.admin-multi-ip-badge {',
    '.btn-view-ip {',
  ].forEach((sel) => {
    assert(extractRule(sel).includes('white-space: nowrap'), `${sel} must set white-space: nowrap`);
  });

  const toolbarRule = extractRule('.admin-toolbar {');
  assert(toolbarRule.includes('padding:'), '.admin-toolbar must define padding so controls stay inside card edges');

  const selfTagRule = extractRule('.admin-self-tag {');
  assert(!selfTagRule.includes('dashed'), '.admin-self-tag must not look like a dashed button box');

  const ipNoneRule = extractRule('.admin-ip-none {');
  assert(!ipNoneRule.includes('font-style: italic'), '.admin-ip-none must not use italic styling');

  const statusDotRule = extractRule('.status-dot {');
  assert(!statusDotRule.includes('animation:'), '.status-dot must stay calm without infinite pulsing');

  assert(!htmlSource.includes('<div class="table-title-group">\n                                    <div class="table-icon-pill">\n                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"\n                                            stroke="currentColor" stroke-width="2" stroke-linecap="round"\n                                            stroke-linejoin="round">\n                                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>\n                                            <circle cx="8.5" cy="7" r="4"></circle>\n                                            <line x1="20" y1="8" x2="20" y2="14"></line>\n                                            <line x1="23" y1="11" x2="17" y2="11"></line>\n                                        </svg>\n                                    </div>\n                                    <div>\n                                        <h3 class="table-title" data-i18n="admin_table_title">Danh bạ Tài khoản Người\n                                            dùng</h3>\n                                        <p class="table-subtitle" data-i18n="admin_table_subtitle">Tra cứu, phân quyền\n                                            hạn và kiểm soát trạng thái hoạt động tài khoản</p>\n                                    </div>\n                                    <span class="table-count-badge'), 'Count badge should sit cleanly in right summary slot of header');
});

test('Users Directory: Renders roles, status pills, IP cells, self-tag, and count badge', () => {
  const env = createEnv('vi');
  env.admin.renderAdminUsersTable([
    {
      id: 9,
      email: 'admin@gmail.com',
      full_name: 'Quan Tri Vien',
      role: 'admin',
      is_active: true,
      document_count: 0,
      last_ip: '127.0.0.1',
      last_device: 'Edge / Windows',
      multi_ip_warning: false,
      created_at: '2026-11-04T06:50:00Z',
    },
    {
      id: 11,
      email: 'tam12@gmail.com',
      full_name: 'Tam',
      role: 'pro',
      is_active: true,
      document_count: 7,
      last_ip: '14.161.1.10',
      last_device: 'Chrome / macOS',
      multi_ip_warning: true,
      distinct_ip_count_24h: 4,
      created_at: '2026-11-13T06:04:00Z',
    },
    {
      id: 12,
      email: 'locked@example.com',
      full_name: null,
      role: 'free',
      is_active: false,
      document_count: 0,
      last_ip: null,
      created_at: '2026-10-30T08:18:00Z',
    },
  ]);

  const html = env.elements.adminUsersTableBody.innerHTML;
  assert(html.includes('role-badge admin'), 'Must render admin role badge');
  assert(html.includes('role-badge pro'), 'Must render pro role badge');
  assert(html.includes('role-badge free'), 'Must render free role badge');
  assert(html.includes('(Tài khoản hiện tại)'), 'Current admin row must show self tag');
  assert(html.includes('4 IP / 24h'), 'Multi-IP user must render warning badge');
  assert(html.includes('Xem IP'), 'Single-IP user must render view-IP button');
  assert(html.includes('Chưa ghi nhận'), 'User without IP must render muted fallback text');
  assert(html.includes('Hạ Miễn phí'), 'Pro user must show demote button');
  assert(html.includes('Cấp Pro'), 'Free user must show grant Pro button');
  assert(html.includes('Mở khóa'), 'Locked user must show unlock button');
});

test('Access Audit Logs: Renders badges, login/register pills, and filters by user safely', () => {
  const env = createEnv('vi');
  env.admin.renderAdminAccessLogs({
    unique_ips_24h: 3,
    multi_ip_users_count: 1,
    page: 1,
    total_pages: 2,
    total_count: 15,
    items: [
      {
        user_email: 'tam12@gmail.com',
        user_name: 'Tam <script>',
        ip_address: '10.0.0.5',
        device_summary: 'Chrome / Windows',
        action: 'register',
        created_at: '2026-11-26T03:00:00Z',
      },
      {
        user_email: 'admin@gmail.com',
        user_name: 'Admin',
        ip_address: '127.0.0.1',
        device_summary: 'Edge / Windows',
        action: 'login',
        created_at: '2026-11-26T04:00:00Z',
      },
    ],
  });

  assert.strictEqual(env.elements.adminUniqueIps24hBadge.textContent, 'IP duy nhất (24h): 3');
  assert.strictEqual(env.elements.adminMultiIpUsersBadge.textContent, 'Cảnh báo đa IP: 1');
  assert.strictEqual(env.elements.adminTabMultiIpBadge.textContent, '1');
  assert.strictEqual(env.elements.adminTabMultiIpBadge.style.display, 'inline-flex');
  assert.strictEqual(env.elements.adminLogPaginationInfo.textContent, 'Trang 1 / 2 (Tổng 15 lượt)');

  const html = env.elements.adminAccessLogsTableBody.innerHTML;
  assert(html.includes('&lt;script&gt;'), 'Must escape XSS payloads in user_name');
  assert(html.includes('admin-log-action-pill register'), 'Register log must use register pill');
  assert(html.includes('Đăng ký') && html.includes('Đăng nhập'), 'Must localize action labels');

  env.admin.switchAdminTab('users');
  assert.strictEqual(env.elements.adminTabUsers.style.display, 'block');
  assert.strictEqual(env.elements.adminTabAccessLogs.style.display, 'none');

  env.admin.filterLogsByUser(11, 'tam12@gmail.com');
  assert.strictEqual(env.elements.adminTabAccessLogs.style.display, 'block', 'filterLogsByUser must switch to dedicated access-logs tab');
  assert.strictEqual(env.elements.adminTabUsers.style.display, 'none', 'filterLogsByUser must hide users tab panel');
  assert.strictEqual(env.elements.sideNavAdminAccessLogs.classList.contains('active'), true, 'Access Logs sidebar item must become active');
  assert.strictEqual(env.elements.adminLogUserFilterChip.style.display, 'inline-flex');
  assert.strictEqual(env.elements.adminLogUserFilterLabel.textContent, 'Lọc: tam12@gmail.com');
});

test('VietQR Transactions: Renders summary KPIs, code chips, plan pills, and action buttons', () => {
  const env = createEnv('vi');
  env.admin.renderAdminTransactions({
    total_revenue_display: '448.000đ',
    pending_count: 2,
    page: 1,
    total_pages: 1,
    total_count: 2,
    items: [
      {
        transaction_code: 'SUB-11-66284-77',
        user_email: 'tam12@gmail.com',
        plan_name: 'Gói Pro Hàng Năm',
        amount_display: '399.000đ',
        payment_status: 'completed',
        created_at: '2026-11-14T04:31:38Z',
      },
      {
        transaction_code: 'SUB-11-87575-0F',
        user_email: 'tester@gmail.com',
        plan_name: 'Gói Pro Hàng Tháng',
        amount_display: '49.000đ',
        payment_status: 'pending',
        created_at: '2026-11-14T04:31:35Z',
      },
    ],
  });

  assert.strictEqual(env.elements.adminTxRevenueBadge.textContent, 'Doanh thu: 448.000đ');
  assert.strictEqual(env.elements.adminTxPendingBadge.textContent, 'Chờ duyệt: 2');
  assert.strictEqual(env.elements.adminTabPendingTxBadge.textContent, '2');
  assert.strictEqual(env.elements.adminTxPaginationInfo.textContent, 'Trang 1 / 1 (Tổng 2 giao dịch)');

  const html = env.elements.adminTxTableBody.innerHTML;
  assert(html.includes('tx-code-chip font-mono'), 'Transaction code must render inside styled chip');
  assert(html.includes('tx-plan-pill yearly'), 'Yearly plan must receive yearly accent pill class');
  assert(html.includes('Đã xử lý'), 'Completed transaction must render processed label');
  assert(html.includes('btn-tx-approve') && html.includes('Hoàn tất'), 'Pending transaction must render complete/approve CTA');
  assert(html.includes('btn-tx-reject') && html.includes('Từ chối'), 'Pending transaction must render reject CTA');
});

test('i18n Live Switch: Changing VI -> EN updates Users, IP Logs, and VietQR tables cleanly', () => {
  const env = createEnv('vi');
  env.admin.renderAdminUsersTable([
    {
      id: 1,
      email: 'pro@example.com',
      full_name: 'Pro User',
      role: 'pro',
      is_active: true,
      document_count: 5,
      last_ip: null,
      created_at: '2026-11-01T00:00:00Z',
    },
  ]);
  env.admin.renderAdminAccessLogs({
    unique_ips_24h: 2,
    multi_ip_users_count: 0,
    page: 1,
    total_pages: 1,
    total_count: 1,
    items: [
      {
        user_email: 'pro@example.com',
        user_name: 'Pro User',
        ip_address: '1.2.3.4',
        device_summary: 'Chrome / Linux',
        action: 'login',
        created_at: '2026-11-26T00:00:00Z',
      },
    ],
  });
  env.admin.renderAdminTransactions({
    total_revenue_display: '49.000đ',
    pending_count: 1,
    page: 1,
    total_pages: 1,
    total_count: 2,
    items: [
      {
        transaction_code: 'SUB-01',
        user_email: 'pro@example.com',
        plan_name: 'Gói Pro Hàng Năm',
        amount_display: '399.000đ',
        payment_status: 'pending',
        created_at: '2026-11-26T00:00:00Z',
      },
      {
        transaction_code: 'SUB-02',
        user_email: 'done@example.com',
        plan_name: 'Gói Pro Hàng Tháng',
        amount_display: '49.000đ',
        payment_status: 'completed',
        created_at: '2026-11-25T00:00:00Z',
      },
    ],
  });

  env.i18n.setLanguage('en');
  (env.docListeners.languageChanged || []).forEach((fn) => fn({ type: 'languageChanged', detail: { lang: 'en' } }));

  assert(env.elements.adminUsersTableBody.innerHTML.includes('Not recorded'), 'Users table must re-render in English');
  assert(env.elements.adminUsersTableBody.innerHTML.includes('Demote to Free'), 'Role action button must switch to English');
  assert.strictEqual(env.elements.adminUniqueIps24hBadge.textContent, 'Unique IPs (24h): 2');
  assert(env.elements.adminAccessLogsTableBody.innerHTML.includes('Login'), 'Access logs pill must switch to English');
  assert.strictEqual(env.elements.adminTxRevenueBadge.textContent, 'Revenue: 49.000đ');
  assert.strictEqual(env.elements.adminTxPendingBadge.textContent, 'Pending: 1');
  assert(env.elements.adminTxTableBody.innerHTML.includes('Pro Yearly Plan'), 'VietQR plan name must localize to English');
  assert(env.elements.adminTxTableBody.innerHTML.includes('Complete'), 'VietQR complete button must localize to English');
  assert(env.elements.adminTxTableBody.innerHTML.includes('Processed'), 'VietQR completed transaction status must localize to Processed');
});

test('Traffic Graphs: Renders 14-day Total Visits & Distinct-IP Unique Visitors SVG series and i18n labels', () => {
  const env = createEnv('vi');
  const dailySeries = Array.from({ length: 14 }, (_, idx) => {
    const day = String(idx + 10).padStart(2, '0');
    return {
      date: `2026-11-${day}`,
      total_visits: idx === 13 ? 7 : idx % 3,
      unique_visitors: idx === 13 ? 3 : (idx % 3 > 0 ? 1 : 0),
    };
  });

  env.admin.renderAdminAccessLogs({
    unique_ips_24h: 3,
    multi_ip_users_count: 0,
    page: 1,
    total_pages: 1,
    total_count: 1,
    traffic: {
      window_days: 14,
      total_visits: 19,
      unique_visitors: 4,
      daily: dailySeries,
    },
    items: [],
  });

  assert.strictEqual(env.elements.adminTrafficTotalCount.textContent, '19 Lượt truy cập');
  assert.strictEqual(env.elements.adminTrafficUniqueCount.textContent, '4 IP duy nhất');

  const totalSvg = env.elements.adminTrafficTotalSvg.innerHTML;
  const uniqueSvg = env.elements.adminTrafficUniqueSvg.innerHTML;
  assert(totalSvg.includes('class="traffic-line-path"'), 'Total visits SVG must render polyline path');
  assert(uniqueSvg.includes('class="traffic-line-path"'), 'Unique IP SVG must render polyline path');
  assert.strictEqual((uniqueSvg.match(/class="traffic-hit-zone"/g) || []).length, 14, 'Unique IP graph must render 14 interactive day zones');
  assert(uniqueSvg.includes('23/11'), 'Vietnamese locale must render DD/MM date ticks');

  env.i18n.setLanguage('en');
  (env.docListeners.languageChanged || []).forEach((fn) => fn({ type: 'languageChanged', detail: { lang: 'en' } }));

  assert.strictEqual(env.elements.adminTrafficTotalCount.textContent, '19 Visits');
  assert.strictEqual(env.elements.adminTrafficUniqueCount.textContent, '4 Unique visitors');
  assert(env.elements.adminTrafficUniqueSvg.innerHTML.includes('11/23'), 'English locale must switch date ticks to MM/DD');

  // Fallback aggregation when backend omits `traffic`
  const nowIso = new Date().toISOString();
  env.admin.renderAdminAccessTraffic({
    items: [
      { ip_address: '10.0.0.1', created_at: nowIso },
      { ip_address: '10.0.0.1', created_at: nowIso },
      { ip_address: '10.0.0.2', created_at: nowIso },
    ],
  });
  assert.strictEqual(env.elements.adminTrafficTotalCount.textContent, '3 Visits');
  assert.strictEqual(env.elements.adminTrafficUniqueCount.textContent, '2 Unique visitors');
});

test('Confirm Modal: Custom confirm button text for transaction approval and rejection', () => {
  const env = createEnv('vi');
  const proceedBtn = env.elements.btnProceedAdminConfirm;

  // 1. Transaction Approve
  env.admin.openConfirmModal({
    title: 'Hoàn tất xử lý giao dịch',
    desc: 'Xác nhận hoàn tất xử lý giao dịch?',
    email: 'user@example.com',
    actionType: 'warning',
    confirmBtnText: 'Hoàn tất',
    onConfirm: async () => {},
  });
  assert.strictEqual(proceedBtn.textContent, 'Hoàn tất', 'Approve modal confirm button must be Hoàn tất');

  // 2. Transaction Reject
  env.admin.openConfirmModal({
    title: 'Từ chối giao dịch thanh toán',
    desc: 'Bạn có chắc muốn từ chối giao dịch?',
    email: 'user@example.com',
    actionType: 'danger',
    confirmBtnText: 'Từ chối giao dịch',
    onConfirm: async () => {},
  });
  assert.strictEqual(proceedBtn.textContent, 'Từ chối giao dịch', 'Reject modal confirm button must be Từ chối giao dịch');

  // 3. Lock user default fallback
  env.admin.openConfirmModal({
    title: 'Khóa tài khoản',
    desc: 'Khóa tài khoản này?',
    email: 'user@example.com',
    actionType: 'danger',
    onConfirm: async () => {},
  });
  assert.strictEqual(proceedBtn.textContent, 'Khóa tài khoản này', 'Lock account modal should fall back to default lock button');
});

console.log('\n================================================================');
console.log(`SUMMARY: ${passed}/${total} tests passed (${total - passed} failed).`);
console.log('================================================================');
