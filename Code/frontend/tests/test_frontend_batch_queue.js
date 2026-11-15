/**
 * PDF-Lingua - Test Suite for PDFL-252.1: Multi-file Dropzone & Batch Queue
 * =========================================================================
 * Tests:
 * 1. Static HTML & CSS markup (multiple input, batch queue card, actions, items, responsive).
 * 2. Multi-file upload via fileInput change & dropzone drop events.
 * 3. Adding files to queue and updating UI list, count badge, and statuses.
 * 4. Deduplication of files (by name + size).
 * 5. Validation: blocking non-PDF files and oversize files.
 * 6. Removing single file by index/id and clearing entire queue.
 * 7. Single-file upload flow backward compatibility & regression.
 * 8. Page selection lifecycle safety (no unwanted resets on append).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('--- BẮT ĐẦU TEST SUITE PDFL-252.1 (Multi-file Dropzone & Batch Queue) ---\n');

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
const uploadJsCode = fs.readFileSync(path.resolve(__dirname, '../js/upload.js'), 'utf8');
const workspaceJsCode = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');

// ============================================================================
// SUITE 1: Static HTML & CSS Markup
// ============================================================================
console.log('[Suite 1] Static HTML & CSS Analysis');

runTest('1.1: index.html has multiple attribute on #pdfFileInput', () => {
  assert.ok(
    htmlContent.includes('id="pdfFileInput"') && htmlContent.includes('multiple'),
    '#pdfFileInput must have multiple attribute'
  );
});

runTest('1.2: index.html contains #batchQueueCard inside #dropzoneSelected', () => {
  assert.ok(htmlContent.includes('id="batchQueueCard"'), '#batchQueueCard missing in HTML');
  const queueIdx = htmlContent.indexOf('id="batchQueueCard"');
  const selIdx = htmlContent.indexOf('id="dropzoneSelected"');
  const procIdx = htmlContent.indexOf('id="btnProcessPdf"');
  assert.ok(queueIdx > selIdx && queueIdx < procIdx, '#batchQueueCard must be inside #dropzoneSelected before #btnProcessPdf');
});

runTest('1.3: index.html contains queue components: count, add, clear, list, and empty', () => {
  assert.ok(htmlContent.includes('id="batchQueueCount"'), '#batchQueueCount missing');
  assert.ok(htmlContent.includes('id="btnAddMoreFiles"'), '#btnAddMoreFiles missing');
  assert.ok(htmlContent.includes('id="btnClearBatchQueue"'), '#btnClearBatchQueue missing');
  assert.ok(htmlContent.includes('id="batchQueueList"'), '#batchQueueList missing');
  assert.ok(htmlContent.includes('id="batchQueueEmpty"'), '#batchQueueEmpty missing');
});

runTest('1.4: layout.css defines .batch-queue-card and component styles', () => {
  assert.ok(layoutCssCode.includes('.batch-queue-card'), '.batch-queue-card missing in CSS');
  assert.ok(layoutCssCode.includes('.batch-queue-header'), '.batch-queue-header missing in CSS');
  assert.ok(layoutCssCode.includes('.batch-queue-item'), '.batch-queue-item missing in CSS');
  assert.ok(layoutCssCode.includes('.btn-batch-action'), '.btn-batch-action missing in CSS');
  assert.ok(layoutCssCode.includes('.btn-queue-remove'), '.btn-queue-remove missing in CSS');
  assert.ok(layoutCssCode.includes('.batch-queue-empty'), '.batch-queue-empty missing in CSS');
});

runTest('1.5: layout.css defines responsive mobile styles for batch queue at <= 480px', () => {
  assert.ok(
    layoutCssCode.includes('@media (max-width: 480px)') &&
    layoutCssCode.includes('.batch-queue-card') &&
    layoutCssCode.includes('.batch-queue-header'),
    'Responsive styles for batch queue missing at max-width: 480px'
  );
});

// ============================================================================
// TEST HARNESS CREATOR
// ============================================================================
function createUploadHarness(options = {}) {
  const elements = {};
  const classes = {};
  const attrs = {};
  const eventListeners = {};
  const toastCalls = [];
  let resetPageSelectionCalls = 0;

  function makeEl(id, tagName = 'div') {
    classes[id] = new Set();
    attrs[id] = {};
    eventListeners[id] = {};

    const el = {
      id,
      tagName: tagName.toUpperCase(),
      style: {},
      value: '',
      innerHTML: '',
      textContent: '',
      checked: false,
      disabled: false,
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
      querySelectorAll: (sel) => {
        if (sel === '.btn-queue-remove') {
          const matches = [];
          const regex = /data-id="([^"]+)"/g;
          let m;
          while ((m = regex.exec(el.innerHTML)) !== null) {
            const idVal = m[1];
            const btn = {
              getAttribute: (a) => (a === 'data-id' ? idVal : null),
              addEventListener: (e, fn) => {
                btn._handler = fn;
              },
              click: () => {
                if (btn._handler) btn._handler({ stopPropagation: () => {} });
              },
            };
            matches.push(btn);
          }
          return matches;
        }
        return [];
      },
    };
    elements[id] = el;
    return el;
  }

  const ids = [
    'dropzoneCard',
    'pdfFileInput',
    'btnSelectPdf',
    'dropzonePrompt',
    'dropzoneSelected',
    'filePreviewBox',
    'previewFileName',
    'previewFileSize',
    'btnRemoveFile',
    'dropzoneLimitText',
    'batchQueueCard',
    'batchQueueCount',
    'btnAddMoreFiles',
    'btnClearBatchQueue',
    'batchQueueList',
    'batchQueueEmpty',
    'btnProcessPdf',
    // Page selection elements
    'radioPageModeAll',
    'radioPageModeCustom',
    'labelPageModeAll',
    'labelPageModeCustom',
    'pageRangeCustomWrap',
    'inputPageRange',
    'chipFirstPage',
    'chipFirst5Pages',
    'chipFirst10Pages',
    'toastContainer',
  ];
  ids.forEach((id) => makeEl(id));

  elements.radioPageModeAll.checked = true;
  elements.labelPageModeAll.classList.add('active');
  elements.pageRangeCustomWrap.style.display = 'none';
  elements.chipFirstPage.setAttribute('data-range', '1');
  elements.chipFirst5Pages.setAttribute('data-range', '1-5');
  elements.chipFirst10Pages.setAttribute('data-range', '1-10');

  const chipsList = [elements.chipFirstPage, elements.chipFirst5Pages, elements.chipFirst10Pages];

  const windowMock = {
    addEventListener: () => {},
    scrollTo: () => {},
    showToast: (msg, type) => {
      toastCalls.push({ msg, type });
    },
    pdfLinguaPageSelection: {
      resetPageSelection: () => {
        resetPageSelectionCalls++;
      },
    },
    pdfLinguaAuth: {
      getStoredUser: () => ({ id: 1, email: 'test@example.com', role: 'free' }),
    },
    pdfLinguaPricing: {
      openQuotaExceededModal: (msg) => {
        windowMock._quotaExceededMsg = msg;
      },
    },
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => {
        if (sel === '.dropzone-limit') return elements['dropzoneLimitText'];
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel === '.quick-chip') return chipsList;
        return [];
      },
      addEventListener: () => {},
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        innerHTML: '',
        textContent: '',
        remove: () => {},
      }),
    },
  };

  const sandbox = {
    window: windowMock,
    document: windowMock.document,
    showToast: windowMock.showToast,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
  };

  vm.createContext(sandbox);

  if (options.withRealPageSelection) {
    vm.runInContext(workspaceJsCode, sandbox);
    const origReset = sandbox.window.pdfLinguaPageSelection.resetPageSelection;
    sandbox.window.pdfLinguaPageSelection.resetPageSelection = () => {
      resetPageSelectionCalls++;
      origReset();
    };
    sandbox.window.pdfLinguaPageSelection.initPageSelection();
  }

  vm.runInContext(uploadJsCode, sandbox);

  // Trigger initDropzone
  sandbox.initDropzone();

  return {
    sandbox,
    elements,
    classes,
    toastCalls,
    getResetPageCalls: () => resetPageSelectionCalls,
  };
}

// ============================================================================
// SUITE 2: Multi-file Queue Population & Count
// ============================================================================
console.log('\n[Suite 2] Multi-file Queue Population');

runTest('2.1: Adding multiple PDF files adds all to queue and updates count', () => {
  const { sandbox, elements } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const f1 = { name: 'report1.pdf', size: 1024 * 500, type: 'application/pdf' };
  const f2 = { name: 'report2.pdf', size: 1024 * 1200, type: 'application/pdf' };
  const f3 = { name: 'report3.pdf', size: 1024 * 800, type: 'application/pdf' };

  const res = queueMgr.addFiles([f1, f2, f3]);
  assert.strictEqual(res.added, 3, 'Should add 3 files');
  assert.strictEqual(queueMgr.getQueueCount(), 3, 'Queue count should be 3');
  assert.strictEqual(elements.batchQueueCount.textContent, '3 tệp');
  assert.strictEqual(elements.batchQueueCard.style.display, 'block');
  assert.strictEqual(elements.dropzoneSelected.classList.contains('active'), true);
  assert.strictEqual(elements.dropzonePrompt.style.display, 'none');
});

runTest('2.2: Primary selectedFile is set to the first file for single-file compatibility', () => {
  const { sandbox, elements } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const f1 = { name: 'first.pdf', size: 1024 * 300, type: 'application/pdf' };
  const f2 = { name: 'second.pdf', size: 1024 * 600, type: 'application/pdf' };
  queueMgr.addFiles([f1, f2]);

  const sel = sandbox.window.pdfLinguaUpload.getSelectedFile();
  assert.ok(sel, 'selectedFile must be defined');
  assert.strictEqual(sel.name, 'first.pdf');
  assert.strictEqual(elements.previewFileName.textContent, 'first.pdf');
});

runTest('2.3: Each item in queue list renders file name, size, and ready status', () => {
  const { sandbox, elements } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const f = { name: 'contract.pdf', size: 2 * 1024 * 1024, type: 'application/pdf' };
  queueMgr.addFiles([f]);

  const listHtml = elements.batchQueueList.innerHTML;
  assert.ok(listHtml.includes('contract.pdf'), 'List HTML must include file name');
  assert.ok(listHtml.includes('2 MB') || listHtml.includes('2.00 MB'), 'List HTML must include formatted size');
  assert.ok(listHtml.includes('Sẵn sàng'), 'List HTML must include status "Sẵn sàng"');
  assert.ok(listHtml.includes('btn-queue-remove'), 'List HTML must include remove button');
});

// ============================================================================
// SUITE 3: Drag & Drop and File Input Events
// ============================================================================
console.log('\n[Suite 3] Dropzone Drop & Input Change Events');

runTest('3.1: fileInput change event with multiple files adds them to queue and clears input.value', () => {
  const { sandbox, elements } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const f1 = { name: 'a.pdf', size: 1024 * 100, type: 'application/pdf' };
  const f2 = { name: 'b.pdf', size: 1024 * 200, type: 'application/pdf' };

  elements.pdfFileInput.value = 'C:\\fakepath\\a.pdf';
  elements.pdfFileInput.dispatchEvent({
    type: 'change',
    target: { files: [f1, f2] },
  });

  assert.strictEqual(queueMgr.getQueueCount(), 2);
  assert.strictEqual(elements.pdfFileInput.value, '', 'Input value must be reset to allow re-selection');
});

runTest('3.2: dropzone drop event with multiple files adds them to queue', () => {
  const { sandbox, elements } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const f1 = { name: 'drag1.pdf', size: 1024 * 400, type: 'application/pdf' };
  const f2 = { name: 'drag2.pdf', size: 1024 * 500, type: 'application/pdf' };

  elements.dropzoneCard.dispatchEvent({
    type: 'drop',
    dataTransfer: { files: [f1, f2] },
    preventDefault: () => {},
    stopPropagation: () => {},
  });

  assert.strictEqual(queueMgr.getQueueCount(), 2);
  assert.strictEqual(elements.batchQueueCount.textContent, '2 tệp');
});

// ============================================================================
// SUITE 4: Deduplication Logic
// ============================================================================
console.log('\n[Suite 4] Deduplication Logic');

runTest('4.1: Adding a duplicate file (same name & size) is blocked with warning toast', () => {
  const { sandbox, toastCalls } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const f = { name: 'duplicate.pdf', size: 1024 * 500, type: 'application/pdf' };
  queueMgr.addFiles([f]);
  assert.strictEqual(queueMgr.getQueueCount(), 1);

  // Attempt duplicate addition
  const res = queueMgr.addFiles([f]);
  assert.strictEqual(res.added, 0, 'Duplicate file should not be added');
  assert.strictEqual(res.skipped, 1, 'Duplicate file should be counted as skipped');
  assert.strictEqual(queueMgr.getQueueCount(), 1, 'Queue count should remain 1');
  assert.ok(
    toastCalls.some((t) => t.type === 'warning' && t.msg.includes('đã có trong hàng đợi')),
    'Warning toast for duplicate must be triggered'
  );
});

runTest('4.2: Files with same name but different size are allowed', () => {
  const { sandbox } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const f1 = { name: 'doc.pdf', size: 1024 * 100, type: 'application/pdf' };
  const f2 = { name: 'doc.pdf', size: 1024 * 200, type: 'application/pdf' };

  queueMgr.addFiles([f1, f2]);
  assert.strictEqual(queueMgr.getQueueCount(), 2);
});

// ============================================================================
// SUITE 5: Format & Size Limit Validation
// ============================================================================
console.log('\n[Suite 5] Format & Size Limit Validation');

runTest('5.1: Non-PDF files are blocked with error toast', () => {
  const { sandbox, toastCalls } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const invalidFiles = [
    { name: 'image.png', size: 1024 * 200, type: 'image/png' },
    { name: 'document.docx', size: 1024 * 300, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { name: 'notes.txt', size: 1024 * 50, type: 'text/plain' },
  ];

  const res = queueMgr.addFiles(invalidFiles);
  assert.strictEqual(res.added, 0);
  assert.strictEqual(res.skipped, 3);
  assert.strictEqual(queueMgr.getQueueCount(), 0);
  assert.ok(
    toastCalls.some((t) => t.type === 'error' && t.msg.includes('không phải định dạng PDF')),
    'Error toast for non-PDF must be triggered'
  );
});

runTest('5.2: Files exceeding account size limit (Free > 20MB) are blocked', () => {
  const { sandbox, toastCalls } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const oversized = { name: 'huge.pdf', size: 25 * 1024 * 1024, type: 'application/pdf' };
  const res = queueMgr.addFiles([oversized]);

  assert.strictEqual(res.added, 0);
  assert.strictEqual(res.skipped, 1);
  assert.strictEqual(queueMgr.getQueueCount(), 0);
  assert.ok(
    toastCalls.some((t) => t.type === 'error' && t.msg.includes('vượt quá giới hạn')),
    'Error toast for oversized file must be triggered'
  );
});

runTest('5.3: Mixed batch filters valid files while rejecting invalid and duplicates', () => {
  const { sandbox } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const files = [
    { name: 'valid1.pdf', size: 1024 * 100, type: 'application/pdf' },
    { name: 'bad.jpg', size: 1024 * 50, type: 'image/jpeg' },
    { name: 'oversized.pdf', size: 30 * 1024 * 1024, type: 'application/pdf' },
    { name: 'valid2.pdf', size: 1024 * 200, type: 'application/pdf' },
  ];

  const res = queueMgr.addFiles(files);
  assert.strictEqual(res.added, 2, 'Only 2 valid files should be added');
  assert.strictEqual(res.skipped, 2, '2 invalid files should be skipped');
  assert.strictEqual(queueMgr.getQueueCount(), 2);
});

// ============================================================================
// SUITE 6: Removal & Clear Operations
// ============================================================================
console.log('\n[Suite 6] Removal & Clear Operations');

runTest('6.1: Removing an individual file removes it and updates count', () => {
  const { sandbox, elements } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const f1 = { name: 'keep.pdf', size: 1024 * 100, type: 'application/pdf' };
  const f2 = { name: 'delete.pdf', size: 1024 * 200, type: 'application/pdf' };
  queueMgr.addFiles([f1, f2]);
  assert.strictEqual(queueMgr.getQueueCount(), 2);

  const q = queueMgr.getQueue();
  const deleteId = q[1].id;
  const success = queueMgr.removeFile(deleteId);

  assert.strictEqual(success, true);
  assert.strictEqual(queueMgr.getQueueCount(), 1);
  assert.strictEqual(elements.batchQueueCount.textContent, '1 tệp');
  assert.ok(!elements.batchQueueList.innerHTML.includes('delete.pdf'), 'delete.pdf should be removed from DOM');
  assert.ok(elements.batchQueueList.innerHTML.includes('keep.pdf'), 'keep.pdf should remain in DOM');
});

runTest('6.2: Removing the last item resets to upload prompt view', () => {
  const { sandbox, elements } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const f = { name: 'only.pdf', size: 1024 * 100, type: 'application/pdf' };
  queueMgr.addFiles([f]);
  assert.strictEqual(queueMgr.getQueueCount(), 1);

  queueMgr.removeFile(0);
  assert.strictEqual(queueMgr.getQueueCount(), 0);
  assert.strictEqual(elements.dropzonePrompt.style.display, 'flex');
  assert.strictEqual(elements.dropzoneSelected.classList.contains('active'), false);
  assert.strictEqual(sandbox.window.pdfLinguaUpload.getSelectedFile(), null);
});

runTest('6.3: Clicking #btnClearBatchQueue clears all files and resets to prompt', () => {
  const { sandbox, elements } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  queueMgr.addFiles([
    { name: '1.pdf', size: 1024 * 100, type: 'application/pdf' },
    { name: '2.pdf', size: 1024 * 200, type: 'application/pdf' },
  ]);
  assert.strictEqual(queueMgr.getQueueCount(), 2);

  elements.btnClearBatchQueue.click();

  assert.strictEqual(queueMgr.getQueueCount(), 0);
  assert.strictEqual(elements.dropzonePrompt.style.display, 'flex');
  assert.strictEqual(elements.dropzoneSelected.classList.contains('active'), false);
  assert.strictEqual(sandbox.window.pdfLinguaUpload.getSelectedFile(), null);
});

// ============================================================================
// SUITE 7: Single-File Regression & Backward Compatibility
// ============================================================================
console.log('\n[Suite 7] Single-File Regression & Backward Compatibility');

runTest('7.1: handleFile(singleFile) seamlessly sets selectedFile and updates preview info', () => {
  const { sandbox, elements } = createUploadHarness();

  const single = { name: 'single_doc.pdf', size: 1024 * 1024, type: 'application/pdf' };
  sandbox.window.pdfLinguaUpload.handleFile(single);

  const sel = sandbox.window.pdfLinguaUpload.getSelectedFile();
  assert.ok(sel, 'selectedFile must be present');
  assert.strictEqual(sel.name, 'single_doc.pdf');
  assert.strictEqual(elements.previewFileName.textContent, 'single_doc.pdf');
  assert.strictEqual(elements.dropzoneSelected.classList.contains('active'), true);
  assert.strictEqual(sandbox.window.pdfLinguaBatchQueue.getQueueCount(), 1);
});

runTest('7.2: btnRemoveFile click resets single file and clears queue', () => {
  const { sandbox, elements } = createUploadHarness();

  const single = { name: 'test.pdf', size: 1024 * 500, type: 'application/pdf' };
  sandbox.window.pdfLinguaUpload.handleFile(single);
  assert.strictEqual(sandbox.window.pdfLinguaBatchQueue.getQueueCount(), 1);

  elements.btnRemoveFile.click();

  assert.strictEqual(sandbox.window.pdfLinguaBatchQueue.getQueueCount(), 0);
  assert.strictEqual(sandbox.window.pdfLinguaUpload.getSelectedFile(), null);
  assert.strictEqual(elements.dropzoneSelected.classList.contains('active'), false);
});

// ============================================================================
// SUITE 8: Page Selection Lifecycle Safety & Active File Switching
// ============================================================================
console.log('\n[Suite 8] Page Selection Lifecycle Safety & Active File Switching');

runTest('8.1: Adding first file calls resetPageSelection, but appending subsequent files does NOT reset', () => {
  const { sandbox, getResetPageCalls } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  assert.strictEqual(getResetPageCalls(), 0);

  // Add first file (queue was empty -> resets page selection to default)
  queueMgr.addFiles([{ name: 'f1.pdf', size: 1024 * 100, type: 'application/pdf' }]);
  assert.strictEqual(getResetPageCalls(), 1, 'Should reset page selection on first file');

  // Add second file (queue already has files -> must NOT reset page selection)
  queueMgr.addFiles([{ name: 'f2.pdf', size: 1024 * 200, type: 'application/pdf' }]);
  assert.strictEqual(getResetPageCalls(), 1, 'Subsequent additions must NOT trigger resetPageSelection');

  // Resetting queue must reset page selection
  queueMgr.clearQueue();
  assert.strictEqual(getResetPageCalls(), 2, 'Clearing queue must reset page selection');
});

runTest('8.2: Queue has A and B (selectedFile is A). Removing A switches selectedFile to B -> must reset page selection', () => {
  const { sandbox, getResetPageCalls } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const fA = { name: 'A.pdf', size: 1024 * 100, type: 'application/pdf' };
  const fB = { name: 'B.pdf', size: 1024 * 200, type: 'application/pdf' };
  queueMgr.addFiles([fA, fB]);

  assert.strictEqual(sandbox.window.pdfLinguaUpload.getSelectedFile().name, 'A.pdf');
  const initialResetCalls = getResetPageCalls(); // 1 (from initial empty queue add)

  // Remove A (index 0 / selectedFile)
  const q = queueMgr.getQueue();
  queueMgr.removeFile(q[0].id);

  // selectedFile switched to B.pdf
  assert.strictEqual(sandbox.window.pdfLinguaUpload.getSelectedFile().name, 'B.pdf');
  assert.strictEqual(
    getResetPageCalls(),
    initialResetCalls + 1,
    'Removing the active selected file must trigger resetPageSelection'
  );
});

runTest('8.3: Queue has A and B (selectedFile is A). Removing B leaves selectedFile as A -> must NOT reset page selection', () => {
  const { sandbox, getResetPageCalls } = createUploadHarness();
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;

  const fA = { name: 'A.pdf', size: 1024 * 100, type: 'application/pdf' };
  const fB = { name: 'B.pdf', size: 1024 * 200, type: 'application/pdf' };
  queueMgr.addFiles([fA, fB]);

  assert.strictEqual(sandbox.window.pdfLinguaUpload.getSelectedFile().name, 'A.pdf');
  const initialResetCalls = getResetPageCalls();

  // Remove B (index 1, non-selected file)
  const q = queueMgr.getQueue();
  queueMgr.removeFile(q[1].id);

  // selectedFile is STILL A.pdf
  assert.strictEqual(sandbox.window.pdfLinguaUpload.getSelectedFile().name, 'A.pdf');
  assert.strictEqual(
    getResetPageCalls(),
    initialResetCalls,
    'Removing a non-selected file must NOT trigger resetPageSelection'
  );
});

runTest('8.4: End-to-end DOM: Custom range for file A is reset when A is removed, avoiding misapplication to B', () => {
  const { sandbox, elements } = createUploadHarness({ withRealPageSelection: true });
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;
  const pageMgr = sandbox.window.pdfLinguaPageSelection;

  const fA = { name: 'docA_10pages.pdf', size: 1024 * 500, type: 'application/pdf' };
  const fB = { name: 'docB_2pages.pdf', size: 1024 * 300, type: 'application/pdf' };
  queueMgr.addFiles([fA, fB]);

  assert.strictEqual(sandbox.window.pdfLinguaUpload.getSelectedFile().name, 'docA_10pages.pdf');

  // User selects custom page range "1-3, 5" for file A
  pageMgr.setPageSelectionMode('custom');
  pageMgr.setPageRangeInput('1-3, 5');

  assert.strictEqual(pageMgr.getSelectedPageMode(), 'custom');
  assert.strictEqual(elements.inputPageRange.value, '1-3, 5');

  // Now user removes file A from queue
  const q = queueMgr.getQueue();
  queueMgr.removeFile(q[0].id);

  // selectedFile is now file B
  assert.strictEqual(sandbox.window.pdfLinguaUpload.getSelectedFile().name, 'docB_2pages.pdf');

  // Page selection must be reset to "all" and input cleared!
  assert.strictEqual(
    pageMgr.getSelectedPageMode(),
    'all',
    'Page selection mode must be reset to "all" when active file changes'
  );
  assert.strictEqual(
    elements.inputPageRange.value,
    '',
    'Page range input value must be cleared when active file changes'
  );
  assert.strictEqual(
    elements.pageRangeCustomWrap.style.display,
    'none',
    'Custom page range wrap must be hidden'
  );
});

runTest('8.5: End-to-end DOM: Custom range for file A is preserved when non-selected file B is removed', () => {
  const { sandbox, elements } = createUploadHarness({ withRealPageSelection: true });
  const queueMgr = sandbox.window.pdfLinguaBatchQueue;
  const pageMgr = sandbox.window.pdfLinguaPageSelection;

  const fA = { name: 'docA_10pages.pdf', size: 1024 * 500, type: 'application/pdf' };
  const fB = { name: 'docB_2pages.pdf', size: 1024 * 300, type: 'application/pdf' };
  queueMgr.addFiles([fA, fB]);

  // User selects custom range for file A
  pageMgr.setPageSelectionMode('custom');
  pageMgr.setPageRangeInput('1-5');

  assert.strictEqual(pageMgr.getSelectedPageMode(), 'custom');
  assert.strictEqual(elements.inputPageRange.value, '1-5');

  // Remove file B (index 1)
  const q = queueMgr.getQueue();
  queueMgr.removeFile(q[1].id);

  // selectedFile is STILL file A
  assert.strictEqual(sandbox.window.pdfLinguaUpload.getSelectedFile().name, 'docA_10pages.pdf');

  // Custom range for file A is preserved!
  assert.strictEqual(
    pageMgr.getSelectedPageMode(),
    'custom',
    'Page selection mode must remain "custom" for unchanged active file'
  );
  assert.strictEqual(
    elements.inputPageRange.value,
    '1-5',
    'Page range input value must be preserved for unchanged active file'
  );
  assert.strictEqual(
    elements.pageRangeCustomWrap.style.display,
    'block',
    'Custom page range wrap must remain visible'
  );
});

// ============================================================================
// SUMMARY
// ============================================================================
setTimeout(() => {
  console.log('\n=======================================================');
  console.log(`KẾT QUẢ TEST SUITE PDFL-252.1: ${passedTests}/${totalTests} tests passed`);
  console.log('=======================================================');
  if (passedTests === totalTests) {
    console.log('>>> TẤT CẢ TEST ĐỀU ĐẠT! SẴN SÀNG HOÀN THÀNH TASK PDFL-252.1.\n');
  } else {
    console.error(`>>> CÓ ${totalTests - passedTests} TEST THẤT BẠI!\n`);
    process.exit(1);
  }
}, 50);

