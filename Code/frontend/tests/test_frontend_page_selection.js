/**
 * PDF-Lingua - Test Suite for PDFL-255.2: Page Selection UI & Quick Chips
 * =======================================================================
 * Tests:
 * 1. Static HTML structure (Card, Mode radios/labels, Custom wrap, Input, Quick chips).
 * 2. CSS rules & responsive design in layout.css.
 * 3. Page Selection Mode Switching (All vs Custom).
 * 4. Quick Chips interaction & synchronization with input value.
 * 5. Frontend Validation (empty, non-digit, invalid characters, valid ranges).
 * 6. Process PDF flow & FormData integration (omitted when 'all', present when 'custom').
 * 7. HTTP 400 backend rejection handling (stops modal, highlights input, shows error).
 * 8. Reset lifecycle (on resetToUpload, file drop, file remove).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('--- BẮT ĐẦU TEST SUITE PDFL-255.2 (Page Selection UI & Quick Chips) ---\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const layoutCssCode = fs.readFileSync(path.resolve(__dirname, '../css/layout.css'), 'utf8');
const workspaceJsCode = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');
const uploadJsCode = fs.readFileSync(path.resolve(__dirname, '../js/upload.js'), 'utf8');

// ============================================================================
// SUITE 1: Static HTML Structure & IDs (PDFL-255.2)
// ============================================================================
console.log('[Suite 1] Static HTML Structure & Component IDs');

runTest('1.1: index.html contains #pageSelectionCard in dropzoneSelected', () => {
  assert.ok(htmlContent.includes('id="pageSelectionCard"'), '#pageSelectionCard missing');
  const selCardIdx = htmlContent.indexOf('id="pageSelectionCard"');
  const btnProcessIdx = htmlContent.indexOf('id="btnProcessPdf"');
  assert.ok(selCardIdx > 0 && selCardIdx < btnProcessIdx, '#pageSelectionCard must appear before #btnProcessPdf');
});

runTest('1.2: index.html contains #radioPageModeAll and #radioPageModeCustom with proper values and labels', () => {
  assert.ok(htmlContent.includes('id="radioPageModeAll"'), '#radioPageModeAll missing');
  assert.ok(htmlContent.includes('id="radioPageModeCustom"'), '#radioPageModeCustom missing');
  assert.ok(htmlContent.includes('id="labelPageModeAll"'), '#labelPageModeAll missing');
  assert.ok(htmlContent.includes('id="labelPageModeCustom"'), '#labelPageModeCustom missing');
  assert.ok(htmlContent.includes('value="all"'), 'radio value="all" missing');
  assert.ok(htmlContent.includes('value="custom"'), 'radio value="custom" missing');
  assert.ok(htmlContent.includes('Toàn bộ tài liệu'), 'Text "Toàn bộ tài liệu" missing');
  assert.ok(htmlContent.includes('Chọn trang cụ thể'), 'Text "Chọn trang cụ thể" missing');
});

runTest('1.3: index.html contains #pageRangeCustomWrap (hidden by default) with #inputPageRange', () => {
  assert.ok(htmlContent.includes('id="pageRangeCustomWrap"'), '#pageRangeCustomWrap missing');
  assert.ok(htmlContent.includes('id="inputPageRange"'), '#inputPageRange missing');
  assert.ok(htmlContent.includes('placeholder="1-3, 5, 8-10"'), 'Placeholder 1-3, 5, 8-10 missing');
});

runTest('1.4: index.html contains 3 quick chips: Trang đầu (1), 5 trang đầu (1-5), Trang 1-10 (1-10)', () => {
  assert.ok(htmlContent.includes('id="chipFirstPage"'), '#chipFirstPage missing');
  assert.ok(htmlContent.includes('id="chipFirst5Pages"'), '#chipFirst5Pages missing');
  assert.ok(htmlContent.includes('id="chipFirst10Pages"'), '#chipFirst10Pages missing');
  assert.ok(htmlContent.includes('data-range="1"'), 'data-range="1" missing');
  assert.ok(htmlContent.includes('data-range="1-5"'), 'data-range="1-5" missing');
  assert.ok(htmlContent.includes('data-range="1-10"'), 'data-range="1-10" missing');
});

// ============================================================================
// SUITE 2: CSS Layout Rules & Design Taste (PDFL-255.2)
// ============================================================================
console.log('\n[Suite 2] CSS Layout Rules & Design Taste');

runTest('2.1: layout.css defines .page-selection-card and segmented .page-mode-group', () => {
  assert.ok(layoutCssCode.includes('.page-selection-card'), '.page-selection-card missing');
  assert.ok(layoutCssCode.includes('.page-mode-group'), '.page-mode-group missing');
  assert.ok(layoutCssCode.includes('.page-mode-option'), '.page-mode-option missing');
});

runTest('2.2: layout.css defines .page-range-input and .page-range-input.input-error styling', () => {
  assert.ok(layoutCssCode.includes('.page-range-input'), '.page-range-input missing');
  assert.ok(layoutCssCode.includes('.page-range-input.input-error'), '.page-range-input.input-error missing');
});

runTest('2.3: layout.css defines .quick-chip, .quick-chip.active, and responsive media query', () => {
  assert.ok(layoutCssCode.includes('.quick-chip'), '.quick-chip missing');
  assert.ok(layoutCssCode.includes('.quick-chip.active'), '.quick-chip.active missing');
  assert.ok(layoutCssCode.includes('@media (max-width: 480px)'), 'Mobile media query missing');
});

// ============================================================================
// DOM HARNESS HELPER
// ============================================================================
function createTestHarness() {
  const toastCalls = [];
  const elements = {};
  const classes = {};
  const attrs = {};
  const eventListeners = {};

  function makeEl(id, tagName = 'div') {
    classes[id] = new Set();
    attrs[id] = {};
    eventListeners[id] = {};

    const el = {
      id,
      tagName: tagName.toUpperCase(),
      style: {},
      value: '',
      checked: false,
      disabled: false,
      focusCalled: false,
      classList: {
        add: (...cls) => cls.forEach((c) => classes[id].add(c)),
        remove: (...cls) => cls.forEach((c) => classes[id].delete(c)),
        toggle: (c, force) => {
          if (force === undefined) {
            if (classes[id].has(c)) classes[id].delete(c);
            else classes[id].add(c);
          } else if (force) {
            classes[id].add(c);
          } else {
            classes[id].delete(c);
          }
        },
        contains: (c) => classes[id].has(c),
      },
      setAttribute: (k, v) => { attrs[id][k] = String(v); },
      getAttribute: (k) => (k in attrs[id] ? attrs[id][k] : null),
      addEventListener: (evt, fn) => {
        eventListeners[id][evt] = eventListeners[id][evt] || [];
        eventListeners[id][evt].push(fn);
      },
      dispatchEvent: (evt) => {
        const type = typeof evt === 'string' ? evt : evt.type;
        (eventListeners[id][type] || []).forEach((fn) => fn(evt));
      },
      click: () => {
        (eventListeners[id]['click'] || []).forEach((fn) => fn({
          preventDefault: () => {},
          stopPropagation: () => {},
          target: el,
        }));
      },
      focus: () => {
        el.focusCalled = true;
      },
      innerText: '',
      textContent: '',
      contains: () => false,
    };
    elements[id] = el;
    return el;
  }

  // Define required workspace & page-selection elements
  const radioAll = makeEl('radioPageModeAll', 'input');
  radioAll.checked = true;
  const radioCustom = makeEl('radioPageModeCustom', 'input');
  radioCustom.checked = false;

  const labelAll = makeEl('labelPageModeAll', 'label');
  labelAll.classList.add('active');
  const labelCustom = makeEl('labelPageModeCustom', 'label');

  const wrap = makeEl('pageRangeCustomWrap', 'div');
  wrap.style.display = 'none';

  const inputPageRange = makeEl('inputPageRange', 'input');

  const chip1 = makeEl('chipFirstPage', 'button');
  chip1.setAttribute('data-range', '1');
  chip1.classList.add('quick-chip');

  const chip5 = makeEl('chipFirst5Pages', 'button');
  chip5.setAttribute('data-range', '1-5');
  chip5.classList.add('quick-chip');

  const chip10 = makeEl('chipFirst10Pages', 'button');
  chip10.setAttribute('data-range', '1-10');
  chip10.classList.add('quick-chip');

  const chipsList = [chip1, chip5, chip10];

  const toastContainer = makeEl('toastContainer', 'div');
  toastContainer.appendChild = (child) => {
    toastCalls.push({
      msg: child.innerHTML || child.textContent || '',
      type: (child.className || '').replace('toast', '').trim(),
    });
  };

  const otherIds = [
    'btnProcessPdf',
    'btnRetranslate',
    'targetLangSelect',
    'btnCopyOriginal',
    'btnCopyTranslated',
    'btnDownloadMenu',
    'downloadDropdown',
    'btnDownloadTxt',
    'btnDownloadPdf',
    'btnDownloadDocx',
    'btnNewFile',
    'btnRemoveFile',
    'paneOriginal',
    'paneTranslated',
    'countOriginal',
    'countTranslated',
    'workspaceViewsWrapper',
    'btnViewModeText',
    'btnViewModePdf',
    'btnViewModeSplit',
    'btnSplitTabPdf',
    'btnSplitTabTranslated',
    'pdfPreviewContainer',
    'heroSection',
    'workspaceSection',
    'documentsSection',
    'historySection',
    'adminSection',
    'progressModal',
    'progressBar',
    'progressPercent',
    'progressStepText',
  ];
  otherIds.forEach((id) => makeEl(id));

  const mockStorageData = {};
  const mockStorage = {
    getItem: (k) => (k in mockStorageData ? mockStorageData[k] : null),
    setItem: (k, v) => { mockStorageData[k] = String(v); },
    removeItem: (k) => { delete mockStorageData[k]; },
    clear: () => { Object.keys(mockStorageData).forEach((k) => delete mockStorageData[k]); },
  };

  const windowMock = {
    sessionStorage: mockStorage,
    localStorage: mockStorage,
    scrollTo: () => {},
    showToast: (msg, type) => {
      toastCalls.push({ msg, type });
    },
    pdfLinguaPreview: {
      loadPdfPreview: () => Promise.resolve(),
      cleanupPdfPreview: () => {},
      zoomFit: () => {},
    },
    pdfLinguaAuth: {
      getStoredToken: () => 'mock-jwt-token',
      getStoredUser: () => ({ id: 1, email: 'test@example.com', role: 'free' }),
      clearStoredSession: () => {},
      updateHeaderAuthState: () => {},
    },
    pdfLinguaUpload: {
      getSelectedFile: () => null,
    },
    document: {
      getElementById: (id) => elements[id] || null,
      querySelectorAll: (sel) => {
        if (sel === '.quick-chip') return chipsList;
        return [];
      },
      createElement: (tag) => {
        return {
          tagName: tag.toUpperCase(),
          className: '',
          style: {},
          innerHTML: '',
          textContent: '',
          remove: () => {},
        };
      },
      addEventListener: () => {},
    },
    FormData: class MockFormData {
      constructor() {
        this.entries = {};
      }
      append(k, v) {
        this.entries[k] = v;
      }
      get(k) {
        return this.entries[k];
      }
    },
  };

  const sandbox = {
    window: windowMock,
    document: windowMock.document,
    sessionStorage: mockStorage,
    localStorage: mockStorage,
    showToast: windowMock.showToast,
    FormData: windowMock.FormData,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
  };

  vm.createContext(sandbox);
  vm.runInContext(workspaceJsCode, sandbox);

  return {
    windowMock,
    sandbox,
    elements,
    classes,
    attrs,
    toastCalls,
    chipsList,
  };
}

// ============================================================================
// SUITE 3: Page Selection Mode Switching Logic
// ============================================================================
console.log('\n[Suite 3] Page Selection Mode Switching (All vs Custom)');

runTest('3.1: Default mode is "all" and custom container is hidden', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.initPageSelection();

  assert.strictEqual(sandbox.window.pdfLinguaPageSelection.getSelectedPageMode(), 'all');
  assert.strictEqual(elements.radioPageModeAll.checked, true);
  assert.strictEqual(elements.radioPageModeCustom.checked, false);
  assert.strictEqual(elements.pageRangeCustomWrap.style.display, 'none');
  assert.strictEqual(elements.labelPageModeAll.classList.contains('active'), true);
  assert.strictEqual(elements.labelPageModeCustom.classList.contains('active'), false);
});

runTest('3.2: Toggling to "custom" displays container and activates custom label', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.initPageSelection();

  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');
  assert.strictEqual(sandbox.window.pdfLinguaPageSelection.getSelectedPageMode(), 'custom');
  assert.strictEqual(elements.radioPageModeCustom.checked, true);
  assert.strictEqual(elements.radioPageModeAll.checked, false);
  assert.strictEqual(elements.pageRangeCustomWrap.style.display, 'block');
  assert.strictEqual(elements.labelPageModeCustom.classList.contains('active'), true);
  assert.strictEqual(elements.labelPageModeAll.classList.contains('active'), false);
});

runTest('3.3: Toggling back to "all" hides container and clears input error', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.initPageSelection();

  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');
  elements.inputPageRange.classList.add('input-error');

  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('all');
  assert.strictEqual(sandbox.window.pdfLinguaPageSelection.getSelectedPageMode(), 'all');
  assert.strictEqual(elements.pageRangeCustomWrap.style.display, 'none');
  assert.strictEqual(elements.inputPageRange.classList.contains('input-error'), false);
});

// ============================================================================
// SUITE 4: Quick Chips Interaction & Sync
// ============================================================================
console.log('\n[Suite 4] Quick Chips Interaction & Input Sync');

runTest('4.1: Clicking chipFirstPage sets input to "1" and marks chip active', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.initPageSelection();

  elements.chipFirstPage.click();
  assert.strictEqual(elements.inputPageRange.value, '1');
  assert.strictEqual(elements.chipFirstPage.classList.contains('active'), true);
  assert.strictEqual(elements.chipFirst5Pages.classList.contains('active'), false);
  assert.strictEqual(elements.chipFirst10Pages.classList.contains('active'), false);
});

runTest('4.2: Clicking chipFirst5Pages sets input to "1-5" and switches active chip', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.initPageSelection();

  elements.chipFirst5Pages.click();
  assert.strictEqual(elements.inputPageRange.value, '1-5');
  assert.strictEqual(elements.chipFirstPage.classList.contains('active'), false);
  assert.strictEqual(elements.chipFirst5Pages.classList.contains('active'), true);
  assert.strictEqual(elements.chipFirst10Pages.classList.contains('active'), false);
});

runTest('4.3: Clicking chipFirst10Pages sets input to "1-10" and switches active chip', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.initPageSelection();

  elements.chipFirst10Pages.click();
  assert.strictEqual(elements.inputPageRange.value, '1-10');
  assert.strictEqual(elements.chipFirst10Pages.classList.contains('active'), true);
});

runTest('4.4: Manual typing syncs matching quick chip', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.initPageSelection();

  elements.inputPageRange.value = '1-5';
  elements.inputPageRange.dispatchEvent({ type: 'input' });
  assert.strictEqual(elements.chipFirst5Pages.classList.contains('active'), true);

  elements.inputPageRange.value = '2-7';
  elements.inputPageRange.dispatchEvent({ type: 'input' });
  assert.strictEqual(elements.chipFirst5Pages.classList.contains('active'), false);
  assert.strictEqual(elements.chipFirstPage.classList.contains('active'), false);
  assert.strictEqual(elements.chipFirst10Pages.classList.contains('active'), false);
});

// ============================================================================
// SUITE 5: Frontend Validation (PDFL-255.2)
// ============================================================================
console.log('\n[Suite 5] Frontend Validation');

runTest('5.1: Mode "all" is always valid and returns pages = null', () => {
  const { sandbox } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('all');

  const res = sandbox.window.pdfLinguaPageSelection.validatePageSelection();
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.mode, 'all');
  assert.strictEqual(res.pages, null);
});

runTest('5.2: Empty or whitespace input in "custom" mode fails validation', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');

  elements.inputPageRange.value = '';
  let res = sandbox.window.pdfLinguaPageSelection.validatePageSelection();
  assert.strictEqual(res.valid, false);
  assert.ok(res.error.includes('Vui lòng nhập số trang'));

  elements.inputPageRange.value = '   ';
  res = sandbox.window.pdfLinguaPageSelection.validatePageSelection();
  assert.strictEqual(res.valid, false);
});

runTest('5.3: Input without any digits (e.g. ", - ,") fails validation', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');

  elements.inputPageRange.value = ', - ,';
  const res = sandbox.window.pdfLinguaPageSelection.validatePageSelection();
  assert.strictEqual(res.valid, false);
  assert.ok(res.error.includes('Dải trang không hợp lệ'));
});

runTest('5.4: Input with illegal characters (e.g. "abc", "1; drop") fails validation', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');

  elements.inputPageRange.value = '1-3, abc';
  const res = sandbox.window.pdfLinguaPageSelection.validatePageSelection();
  assert.strictEqual(res.valid, false);
  assert.ok(res.error.includes('chứa ký tự không hợp lệ'));
});

runTest('5.5: Valid syntax (e.g. "1-3, 5, 8-10") passes validation', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');

  elements.inputPageRange.value = '1-3, 5, 8-10';
  const res = sandbox.window.pdfLinguaPageSelection.validatePageSelection();
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.pages, '1-3, 5, 8-10');
});

// ============================================================================
// SUITE 6: Process PDF Flow & FormData Integration
// ============================================================================
console.log('\n[Suite 6] Process PDF Flow & FormData Integration');

runAsyncTest('6.1: When mode is "all", FormData does not contain "pages"', async () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.selectedFile = { name: 'sample.pdf', size: 1024 * 50 };

  let capturedFormData = null;
  sandbox.fetch = async (url, options) => {
    capturedFormData = options.body;
    return {
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        data: { job_id: 'job-123' },
      }),
    };
  };

  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('all');
  await sandbox.window.pdfLinguaWorkspace.handleProcessPdf();

  assert.ok(capturedFormData, 'FormData was not created');
  assert.strictEqual(capturedFormData.get('pages'), undefined, 'Field "pages" should not be appended for "all" mode');
});

runAsyncTest('6.2: When mode is "custom" with valid range, FormData includes "pages"', async () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.selectedFile = { name: 'sample.pdf', size: 1024 * 50 };

  let capturedFormData = null;
  sandbox.fetch = async (url, options) => {
    capturedFormData = options.body;
    return {
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        data: { job_id: 'job-custom-123' },
      }),
    };
  };

  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');
  elements.inputPageRange.value = '2, 4-6';

  await sandbox.window.pdfLinguaWorkspace.handleProcessPdf();

  assert.ok(capturedFormData, 'FormData was not created');
  assert.strictEqual(capturedFormData.get('pages'), '2, 4-6', 'FormData should contain pages="2, 4-6"');
});

runAsyncTest('6.3: When mode is "custom" with invalid input, handleProcessPdf stops before fetch and warns user', async () => {
  const { sandbox, elements, toastCalls } = createTestHarness();
  sandbox.selectedFile = { name: 'sample.pdf', size: 1024 * 50 };

  let fetchCalled = false;
  sandbox.fetch = async () => {
    fetchCalled = true;
    return { status: 200, ok: true, json: async () => ({}) };
  };

  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');
  elements.inputPageRange.value = ''; // Invalid empty input

  await sandbox.window.pdfLinguaWorkspace.handleProcessPdf();

  assert.strictEqual(fetchCalled, false, 'fetch should not be called when validation fails');
  assert.strictEqual(elements.btnProcessPdf.disabled, false, 'btnProcessPdf should remain enabled');
  assert.strictEqual(elements.inputPageRange.classList.contains('input-error'), true, 'input should have .input-error');
  assert.strictEqual(elements.inputPageRange.focusCalled, true, 'input should be focused');
  assert.ok(toastCalls.some((t) => t.type === 'warning'), 'Warning toast should be triggered');
});

// ============================================================================
// SUITE 7: HTTP 400 Backend Error Handling
// ============================================================================
console.log('\n[Suite 7] HTTP 400 Backend Error Handling');

runAsyncTest('7.1: Backend 400 rejection displays error toast, closes progress modal, and highlights input', async () => {
  const { sandbox, elements, toastCalls } = createTestHarness();
  sandbox.selectedFile = { name: 'sample.pdf', size: 1024 * 50 };

  sandbox.fetch = async () => ({
    status: 400,
    ok: false,
    json: async () => ({
      detail: 'Số trang vượt quá tổng số trang của tài liệu (50 > 12).',
    }),
  });

  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');
  elements.inputPageRange.value = '50';

  await sandbox.window.pdfLinguaWorkspace.handleProcessPdf();

  assert.strictEqual(elements.btnProcessPdf.disabled, false, 'btnProcessPdf should be re-enabled');
  assert.strictEqual(elements.inputPageRange.classList.contains('input-error'), true, 'input should have .input-error');
  assert.strictEqual(elements.inputPageRange.focusCalled, true, 'input should be focused');
  assert.ok(
    toastCalls.some((t) => t.type === 'error' && t.msg.includes('Số trang vượt quá tổng số trang')),
    'Error toast with backend message should be displayed'
  );
});

// ============================================================================
// SUITE 8: Reset Lifecycle
// ============================================================================
console.log('\n[Suite 8] Reset Lifecycle');

runTest('8.1: resetPageSelection restores mode to "all", clears input, chips, and error state', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');
  elements.inputPageRange.value = '1-5';
  elements.chipFirst5Pages.classList.add('active');
  elements.inputPageRange.classList.add('input-error');

  sandbox.window.pdfLinguaPageSelection.resetPageSelection();

  assert.strictEqual(sandbox.window.pdfLinguaPageSelection.getSelectedPageMode(), 'all');
  assert.strictEqual(elements.inputPageRange.value, '');
  assert.strictEqual(elements.inputPageRange.classList.contains('input-error'), false);
  assert.strictEqual(elements.chipFirst5Pages.classList.contains('active'), false);
  assert.strictEqual(elements.pageRangeCustomWrap.style.display, 'none');
});

runTest('8.2: resetToUpload invokes resetPageSelection', () => {
  const { sandbox, elements } = createTestHarness();
  sandbox.window.pdfLinguaPageSelection.setPageSelectionMode('custom');
  elements.inputPageRange.value = '3-4';

  sandbox.window.pdfLinguaWorkspace.resetToUpload();

  assert.strictEqual(sandbox.window.pdfLinguaPageSelection.getSelectedPageMode(), 'all');
  assert.strictEqual(elements.inputPageRange.value, '');
});

runTest('8.3: upload.js resetFileSelection invokes resetPageSelection', () => {
  assert.ok(
    uploadJsCode.includes('window.pdfLinguaPageSelection.resetPageSelection()'),
    'upload.js must call resetPageSelection()'
  );
});

// ============================================================================
// SUMMARY
// ============================================================================
setTimeout(() => {
  console.log('\n=======================================================');
  console.log(`KẾT QUẢ TEST SUITE PDFL-255.2: ${passedTests}/${totalTests} tests passed`);
  console.log('=======================================================');
  if (passedTests === totalTests) {
    console.log('>>> TẤT CẢ TEST ĐỀU ĐẠT! SẴN SÀNG HOÀN THÀNH TASK PDFL-255.2.\n');
  } else {
    console.error(`>>> CÓ ${totalTests - passedTests} TEST THẤT BẠI!\n`);
    process.exit(1);
  }
}, 50);
