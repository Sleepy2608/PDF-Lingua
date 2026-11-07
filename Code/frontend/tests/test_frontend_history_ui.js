/**
 * PDF-Lingua: Processing History UI Verification Suite (PDFL-161.1)
 * -----------------------------------------------------------------
 * Verifies:
 * 1. Sidebar navigation item `#sideNavHistory` ("Lịch sử xử lý") and `#historySection` container.
 * 2. Display of all required fields:
 *    - Action types: EXTRACT, TRANSLATE, SUMMARIZE (`.action-badge`).
 *    - Statuses: PENDING, SUCCESS, FAILED (`.history-status-pill`).
 *    - Document ID (`.history-doc-badge`).
 *    - Created timestamp (`.history-created-mono`).
 *    - Execution time in ms (`.history-duration-mono`).
 * 3. Filter controls for action type (`#historyActionFilter`), status (`#historyStatusFilter`),
 *    Document ID (`#historyDocumentIdFilter`), and reset (`#btnResetHistoryFilters`).
 * 4. All 4 UI states present in DOM:
 *    - Loading state (`#historyLoadingState` with `.history-skeleton-row`).
 *    - Empty state (`#historyEmptyState` with `#btnHistoryEmptyUpload`).
 *    - Error state (`#historyErrorState` with `#historyErrorMessage` and `#btnRetryHistory`).
 *    - History list state (`#historyTableContainer`, `#historyTable`, `#historyTableBody`).
 * 5. Pagination controls (`#historyPagination`, `#historyPaginationInfo`, `#btnHistoryPrevPage`,
 *    `#historyCurrentPageBadge`, `#btnHistoryNextPage`).
 * 6. Design System CSS classes defined in `components.css`.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const componentsCss = fs.readFileSync(path.resolve(__dirname, '../css/components.css'), 'utf8');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
  }
}

console.log('================================================================');
console.log('PDF-Lingua Processing History UI Test Suite (PDFL-161.1)');
console.log('================================================================\n');

runTest('1. Navigation & Section Container: #sideNavHistory and #historySection exist', () => {
  assert.ok(htmlSource.includes('id="sideNavHistory"'), 'sideNavHistory must exist in sidebar');
  assert.ok(htmlSource.includes('Lịch sử xử lý'), 'Sidebar label "Lịch sử xử lý" must exist');
  assert.ok(htmlSource.includes('id="historySection"'), 'historySection must exist in main');
  assert.ok(htmlSource.includes('id="btnRefreshHistory"'), 'btnRefreshHistory must exist');
  assert.ok(htmlSource.includes('id="btnCloseHistoryView"'), 'btnCloseHistoryView must exist');
});

runTest('2. Required Information Columns & Badges: EXTRACT, TRANSLATE, SUMMARIZE, PENDING, SUCCESS, FAILED, Document ID, Timestamps', () => {
  assert.ok(htmlSource.includes('<th>Mã thực thi</th>') || htmlSource.includes('<th>Mã lịch sử</th>'), 'Execution ID column header must exist');
  assert.ok(htmlSource.includes('<th>Document ID</th>'), 'Document ID column header must exist');
  assert.ok(htmlSource.includes('<th>Loại xử lý</th>'), 'Action type column header must exist');
  assert.ok(htmlSource.includes('<th>Trạng thái</th>'), 'Status column header must exist');
  assert.ok(htmlSource.includes('<th>Thời gian thực thi</th>'), 'Execution time column header must exist');
  assert.ok(htmlSource.includes('<th>Thời gian tạo</th>'), 'Created time column header must exist');

  // Action types
  assert.ok(htmlSource.includes('action-extract') && htmlSource.includes('EXTRACT'), 'EXTRACT badge must exist');
  assert.ok(htmlSource.includes('action-translate') && htmlSource.includes('TRANSLATE'), 'TRANSLATE badge must exist');
  assert.ok(htmlSource.includes('action-summarize') && htmlSource.includes('SUMMARIZE'), 'SUMMARIZE badge must exist');

  // Statuses
  assert.ok(htmlSource.includes('status-pending') && htmlSource.includes('PENDING'), 'PENDING status pill must exist');
  assert.ok(htmlSource.includes('status-success') && htmlSource.includes('SUCCESS'), 'SUCCESS status pill must exist');
  assert.ok(htmlSource.includes('status-failed') && htmlSource.includes('FAILED'), 'FAILED status pill must exist');

  // Document ID & metrics classes
  assert.ok(htmlSource.includes('history-doc-badge'), 'Document ID badge class must exist');
  assert.ok(htmlSource.includes('history-duration-mono'), 'Execution duration class must exist');
  assert.ok(htmlSource.includes('history-created-mono'), 'Created timestamp class must exist');
});

runTest('3. Filter Controls: Action Type, Status, Document ID and Reset button exist', () => {
  assert.ok(htmlSource.includes('id="historyActionFilter"'), 'historyActionFilter select must exist');
  assert.ok(htmlSource.includes('<option value="EXTRACT">'), 'EXTRACT filter option must exist');
  assert.ok(htmlSource.includes('<option value="TRANSLATE">'), 'TRANSLATE filter option must exist');
  assert.ok(htmlSource.includes('<option value="SUMMARIZE">'), 'SUMMARIZE filter option must exist');

  assert.ok(htmlSource.includes('id="historyStatusFilter"'), 'historyStatusFilter select must exist');
  assert.ok(htmlSource.includes('<option value="PENDING">'), 'PENDING filter option must exist');
  assert.ok(htmlSource.includes('<option value="SUCCESS">'), 'SUCCESS filter option must exist');
  assert.ok(htmlSource.includes('<option value="FAILED">'), 'FAILED filter option must exist');

  assert.ok(htmlSource.includes('id="historyDocumentIdFilter"'), 'historyDocumentIdFilter input must exist');
  assert.ok(htmlSource.includes('id="btnResetHistoryFilters"'), 'btnResetHistoryFilters button must exist');
});

runTest('4. Four UI States: Loading, Empty, Error, and History List exist', () => {
  assert.ok(htmlSource.includes('id="historyLoadingState"'), 'Loading state container must exist');
  assert.ok(htmlSource.includes('history-skeleton-row'), 'Loading skeleton rows must exist');

  assert.ok(htmlSource.includes('id="historyEmptyState"'), 'Empty state container must exist');
  assert.ok(htmlSource.includes('id="btnHistoryEmptyUpload"'), 'Empty state upload CTA must exist');

  assert.ok(htmlSource.includes('id="historyErrorState"'), 'Error state container must exist');
  assert.ok(htmlSource.includes('id="historyErrorMessage"'), 'Error message element must exist');
  assert.ok(htmlSource.includes('id="btnRetryHistory"'), 'Error retry button must exist');

  assert.ok(htmlSource.includes('id="historyTableContainer"'), 'History table container must exist');
  assert.ok(htmlSource.includes('id="historyTable"'), 'History table must exist');
  assert.ok(htmlSource.includes('id="historyTableBody"'), 'History table body must exist');
});

runTest('5. Pagination Controls: Prev, Current Page Badge, Next, and Info exist', () => {
  assert.ok(htmlSource.includes('id="historyPagination"'), 'historyPagination footer must exist');
  assert.ok(htmlSource.includes('id="historyPaginationInfo"'), 'historyPaginationInfo must exist');
  assert.ok(htmlSource.includes('id="btnHistoryPrevPage"'), 'btnHistoryPrevPage must exist');
  assert.ok(htmlSource.includes('id="historyCurrentPageBadge"'), 'historyCurrentPageBadge must exist');
  assert.ok(htmlSource.includes('id="btnHistoryNextPage"'), 'btnHistoryNextPage must exist');
});

runTest('6. Design System CSS: All history classes styled consistently in components.css', () => {
  const requiredSelectors = [
    '.history-section',
    '.history-live-badge',
    '.history-doc-badge',
    '.action-badge',
    '.action-badge.action-extract',
    '.action-badge.action-translate',
    '.action-badge.action-summarize',
    '.history-status-pill.status-success',
    '.history-status-pill.status-pending',
    '.history-status-pill.status-failed',
    '.history-duration-mono',
    '.history-loading-state',
    '.history-skeleton-row',
    '.error-icon-wrap',
    '.history-current-page',
  ];

  for (const selector of requiredSelectors) {
    assert.ok(componentsCss.includes(selector), `CSS selector ${selector} must be defined in components.css`);
  }
});

runTest('7. Execution ID & Detail Modal renaming (Requirement 3 & 4)', () => {
  assert.ok(htmlSource.includes('Chi Tiết Bản Ghi Thực Thi'), 'Modal title "Chi Tiết Bản Ghi Thực Thi" must exist');
  assert.ok(htmlSource.includes('Mã thực thi (Execution ID)'), 'Modal field "Mã thực thi (Execution ID)" must exist');
  assert.ok(componentsCss.includes('.doc-badge-filename'), 'CSS class .doc-badge-filename must exist in components.css');
});

runTest('8. No Duplicate Labels or Elements in History Detail Modal', () => {
  // Count helper
  function countMatches(str, pattern) {
    const matches = str.match(new RegExp(pattern, 'g'));
    return matches ? matches.length : 0;
  }

  // 1. Modal Title
  assert.strictEqual(countMatches(htmlSource, 'Chi Tiết Bản Ghi Thực Thi'), 1, 'Modal title "Chi Tiết Bản Ghi Thực Thi" must appear exactly once');
  assert.strictEqual(countMatches(htmlSource, 'Chi Tiết Bản Ghi Lịch Sử'), 0, 'Old modal title "Chi Tiết Bản Ghi Lịch Sử" must be completely removed');

  // 2. Execution ID label
  assert.strictEqual(countMatches(htmlSource, 'Mã thực thi \\(Execution ID\\)'), 1, 'Label "Mã thực thi (Execution ID)" must appear exactly once');
  assert.strictEqual(countMatches(htmlSource, 'Mã lịch sử \\(History ID\\)'), 0, 'Old label "Mã lịch sử (History ID)" must be completely removed');

  // 3. Back Button
  const backBtnMatch = htmlSource.match(/id="btnBackToHistoryList"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(backBtnMatch, '#btnBackToHistoryList must exist');
  const backBtnInner = backBtnMatch[1];
  const spanMatches = backBtnInner.match(/<span>[\s\S]*?<\/span>/g);
  assert.strictEqual(spanMatches.length, 1, '#btnBackToHistoryList must contain exactly one span');
  assert.ok(spanMatches[0].includes('Quay lại danh sách lịch sử'), 'Span text must be "Quay lại danh sách lịch sử"');

  // 4. No duplicate element IDs in modal
  const uniqueModalIds = [
    'historyDetailModalTitle',
    'btnCloseHistoryDetailModal',
    'historyDetailNotFoundMessage',
    'historyDetailErrorMessage',
    'historyDetailId',
    'historyDetailDocId',
    'historyDetailDocBadge',
    'btnBackToHistoryList',
  ];
  for (const id of uniqueModalIds) {
    assert.strictEqual(countMatches(htmlSource, `id="${id}"`), 1, `Element ID #${id} must be unique`);
  }
});

console.log('\n================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (${totalTests - passedTests} failed).`);
console.log('================================================================');

if (passedTests < totalTests) {
  process.exit(1);
}

