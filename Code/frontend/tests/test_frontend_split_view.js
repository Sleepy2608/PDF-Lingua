/**
 * PDF-Lingua - Test Suite for PDFL-256.2: Dual/Split View & Secure Inline PDF Stream
 * ==================================================================================
 * Tests:
 * 1. Static HTML structure (View Mode Switcher, Dynamic Views Wrapper, Split Mobile Tab Bar).
 * 2. View Mode Switcher logic (text, pdf, split) and aria-pressed attributes.
 * 3. Split mode mobile tab switching (pdf vs translated).
 * 4. Authenticated PDF stream fetch for History records (200, 401, 403, 404).
 * 5. Workspace rendering and reset workflows.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- BẮT ĐẦU TEST SUITE PDFL-256.2 (Dual/Split View & Secure Inline PDF Stream) ---\n');

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
const workspaceJsCode = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');
const workspaceCssCode = fs.readFileSync(path.resolve(__dirname, '../css/workspace.css'), 'utf8');

// ============================================================================
// SUITE 1: Static HTML Structure & IDs (PDFL-256.2)
// ============================================================================
console.log('[Suite 1] Static HTML Structure & Component IDs');

runTest('1.1: index.html contains #viewModeSwitcher in workspace toolbar', () => {
  assert.ok(htmlContent.includes('id="viewModeSwitcher"'), 'viewModeSwitcher missing');
});

runTest('1.2: index.html contains 3 view mode buttons (Text, PDF, Split)', () => {
  assert.ok(htmlContent.includes('id="btnViewModeText"'), 'btnViewModeText missing');
  assert.ok(htmlContent.includes('id="btnViewModePdf"'), 'btnViewModePdf missing');
  assert.ok(htmlContent.includes('id="btnViewModeSplit"'), 'btnViewModeSplit missing');
  assert.ok(htmlContent.includes('data-mode="text"'), 'data-mode text missing');
  assert.ok(htmlContent.includes('data-mode="pdf"'), 'data-mode pdf missing');
  assert.ok(htmlContent.includes('data-mode="split"'), 'data-mode split missing');
});

runTest('1.3: index.html contains #workspaceViewsWrapper wrapping preview & dualPaneGrid', () => {
  assert.ok(htmlContent.includes('id="workspaceViewsWrapper"'), 'workspaceViewsWrapper missing');
  const wrapperIdx = htmlContent.indexOf('id="workspaceViewsWrapper"');
  const previewIdx = htmlContent.indexOf('id="pdfPreviewContainer"');
  const dualGridIdx = htmlContent.indexOf('id="dualPaneGrid"');
  assert.ok(wrapperIdx < previewIdx, 'workspaceViewsWrapper must open before pdfPreviewContainer');
  assert.ok(wrapperIdx < dualGridIdx, 'workspaceViewsWrapper must open before dualPaneGrid');
});

runTest('1.4: index.html contains #splitMobileTabBar with #btnSplitTabPdf and #btnSplitTabTranslated', () => {
  assert.ok(htmlContent.includes('id="splitMobileTabBar"'), 'splitMobileTabBar missing');
  assert.ok(htmlContent.includes('id="btnSplitTabPdf"'), 'btnSplitTabPdf missing');
  assert.ok(htmlContent.includes('id="btnSplitTabTranslated"'), 'btnSplitTabTranslated missing');
});

runTest('1.5: index.html contains #paneCardOriginal and #paneCardTranslated', () => {
  assert.ok(htmlContent.includes('id="paneCardOriginal"'), 'paneCardOriginal missing');
  assert.ok(htmlContent.includes('id="paneCardTranslated"'), 'paneCardTranslated missing');
});

// ============================================================================
// SUITE 2: CSS Layout Rules & Breakpoints
// ============================================================================
console.log('\n[Suite 2] CSS Layout Rules & Breakpoints');

runTest('2.1: workspace.css defines .view-mode-switcher and .view-mode-btn styling', () => {
  assert.ok(workspaceCssCode.includes('.view-mode-switcher'), '.view-mode-switcher missing in CSS');
  assert.ok(workspaceCssCode.includes('.view-mode-btn'), '.view-mode-btn missing in CSS');
});

runTest('2.2: workspace.css defines .workspace-views-wrapper.view-mode-text rules', () => {
  assert.ok(workspaceCssCode.includes('.view-mode-text #pdfPreviewContainer'), 'view-mode-text hide preview missing');
  assert.ok(workspaceCssCode.includes('.view-mode-text #dualPaneGrid'), 'view-mode-text dualPaneGrid missing');
});

runTest('2.3: workspace.css defines .workspace-views-wrapper.view-mode-pdf rules', () => {
  assert.ok(workspaceCssCode.includes('.view-mode-pdf #pdfPreviewContainer'), 'view-mode-pdf preview missing');
  assert.ok(workspaceCssCode.includes('.view-mode-pdf #dualPaneGrid'), 'view-mode-pdf hide dualPaneGrid missing');
});

runTest('2.4: workspace.css defines Desktop split view (> 1024px) 2-column grid', () => {
  assert.ok(workspaceCssCode.includes('min-width: 1025px'), 'min-width 1025px breakpoint missing');
  assert.ok(workspaceCssCode.includes('grid-template-columns: 1fr 1fr'), '2-column 1fr 1fr missing');
});

runTest('2.5: workspace.css defines Mobile/Tablet split view (<= 1024px) tabbed layout', () => {
  assert.ok(workspaceCssCode.includes('max-width: 1024px'), 'max-width 1024px breakpoint missing');
  assert.ok(workspaceCssCode.includes('.split-mobile-tab-bar'), 'split-mobile-tab-bar in media query missing');
  assert.ok(workspaceCssCode.includes('data-split-tab="pdf"'), 'data-split-tab pdf missing');
  assert.ok(workspaceCssCode.includes('data-split-tab="translated"'), 'data-split-tab translated missing');
});

// ============================================================================
// SUITE 3: View Mode Switching Logic (JSDOM-like Mock Environment)
// ============================================================================
console.log('\n[Suite 3] View Mode Switching & Tab Selection Logic');

function setupMockDOM() {
  const elements = {};
  const classes = {};
  const attrs = {};

  function makeEl(id) {
    classes[id] = new Set();
    attrs[id] = {};
    const listeners = {};
    const el = {
      id,
      style: {},
      classList: {
        add: (...c) => c.forEach((cls) => classes[id].add(cls)),
        remove: (...c) => c.forEach((cls) => classes[id].delete(cls)),
        toggle: (cls, force) => {
          if (force === undefined) {
            if (classes[id].has(cls)) classes[id].delete(cls);
            else classes[id].add(cls);
          } else if (force) classes[id].add(cls);
          else classes[id].delete(cls);
        },
        contains: (cls) => classes[id].has(cls),
      },
      setAttribute: (k, v) => { attrs[id][k] = String(v); },
      getAttribute: (k) => attrs[id][k],
      addEventListener: (evt, fn) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      click: () => {
        (listeners['click'] || []).forEach((fn) => fn({ stopPropagation: () => {} }));
      },
      innerText: '',
      textContent: '',
      querySelector: (sel) => makeEl(id + '_' + sel),
    };
    elements[id] = el;
    return el;
  }

  const ids = [
    'workspaceViewsWrapper',
    'viewModeSwitcher',
    'btnViewModeText',
    'btnViewModePdf',
    'btnViewModeSplit',
    'splitMobileTabBar',
    'btnSplitTabPdf',
    'btnSplitTabTranslated',
    'pdfPreviewContainer',
    'dualPaneGrid',
    'paneCardOriginal',
    'paneCardTranslated',
    'pdfPreviewLoading',
    'pdfPreviewError',
    'pdfPreviewErrorMsg',
    'pdfCanvasWrap',
    'docNameDisplay',
    'docPagesDisplay',
    'docSizeDisplay',
    'docTypeDisplay',
    'paneOriginal',
    'paneTranslated',
    'targetLangSelect',
    'countOriginal',
    'countTranslated',
    'btnDownloadTxt',
    'btnDownloadPdf',
    'btnDownloadDocx',
    'btnDownloadOriginalTxt',
    'btnDownloadOriginalPdf',
    'btnDownloadOriginalDocx',
    'btnDownloadBilingualTxt',
    'btnDownloadBilingualPdf',
    'btnDownloadBilingualDocx',
    'btnDownloadSummaryTxt',
    'btnDownloadSummaryPdf',
    'btnDownloadSummaryDocx',
    'btnNewFile',
    'btnRemoveFile',
    'btnCopyOriginal',
    'btnCopyTranslated',
    'heroSection',
    'workspaceSection',
    'documentsSection',
  ];

  ids.forEach(makeEl);

  const mockSessionStore = {};
  const mockStorage = {
    getItem: (k) => (k in mockSessionStore ? mockSessionStore[k] : null),
    setItem: (k, v) => { mockSessionStore[k] = String(v); },
    removeItem: (k) => { delete mockSessionStore[k]; },
    clear: () => { Object.keys(mockSessionStore).forEach((k) => delete mockSessionStore[k]); },
  };

  const windowMock = {
    sessionStorage: mockStorage,
    localStorage: mockStorage,
    scrollTo: () => {},
    innerWidth: 1200,
    showToast: () => {},
    pdfLinguaPreview: {
      loadPdfPreview: () => Promise.resolve(),
      cleanupPdfPreview: () => {},
      zoomFit: () => {},
    },
    pdfLinguaAuth: {
      getStoredToken: () => 'mock-test-token-jwt',
      getStoredUser: () => ({ id: 1, email: 'user@example.com', role: 'free' }),
      clearStoredSession: () => {},
      updateHeaderAuthState: () => {},
    },
    pdfLinguaUpload: {
      getSelectedFile: () => null,
    },
    document: {
      getElementById: (id) => elements[id] || null,
      querySelectorAll: () => [],
      addEventListener: () => {},
    },
  };

  return { windowMock, elements, classes, attrs, mockStorage };
}

(async function runLogicTests() {
  const { windowMock, elements, classes, attrs, mockStorage } = setupMockDOM();

  // Execute workspace module in mock context
  const vm = require('vm');
  const context = vm.createContext({
    window: windowMock,
    document: windowMock.document,
    sessionStorage: windowMock.sessionStorage,
    localStorage: windowMock.localStorage,
    fetch: () => Promise.resolve({ status: 200, blob: () => Promise.resolve({ size: 100 }) }),
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {},
    console: console,
  });

  vm.runInContext(workspaceJsCode, context);
  const ws = context.window.pdfLinguaWorkspace;

  assert.ok(ws, 'window.pdfLinguaWorkspace must be attached');
  assert.strictEqual(typeof ws.setViewMode, 'function', 'setViewMode must be exposed');
  assert.strictEqual(typeof ws.setSplitMobileTab, 'function', 'setSplitMobileTab must be exposed');
  assert.strictEqual(typeof ws.fetchDocumentPreview, 'function', 'fetchDocumentPreview must be exposed');

  runTest('3.1: setViewMode("text") sets .view-mode-text and marks #btnViewModeText active', () => {
    ws.setViewMode('text');
    assert.strictEqual(ws.getViewMode(), 'text');
    assert.ok(classes['workspaceViewsWrapper'].has('view-mode-text'), 'wrapper must have view-mode-text class');
    assert.ok(!classes['workspaceViewsWrapper'].has('view-mode-split'), 'wrapper must not have view-mode-split class');
    assert.strictEqual(attrs['workspaceViewsWrapper']['data-view-mode'], 'text');
    assert.ok(classes['btnViewModeText'].has('active'), 'btnViewModeText must have active class');
    assert.strictEqual(attrs['btnViewModeText']['aria-pressed'], 'true');
    assert.strictEqual(mockStorage.getItem('pdfl_workspace_view_mode'), 'text');
  });

  runTest('3.2: setViewMode("pdf") sets .view-mode-pdf and marks #btnViewModePdf active', () => {
    ws.setViewMode('pdf');
    assert.strictEqual(ws.getViewMode(), 'pdf');
    assert.ok(classes['workspaceViewsWrapper'].has('view-mode-pdf'), 'wrapper must have view-mode-pdf class');
    assert.strictEqual(attrs['btnViewModePdf']['aria-pressed'], 'true');
    assert.strictEqual(attrs['btnViewModeText']['aria-pressed'], 'false');
  });

  runTest('3.3: setViewMode("split") sets .view-mode-split and marks #btnViewModeSplit active', () => {
    ws.setViewMode('split');
    assert.strictEqual(ws.getViewMode(), 'split');
    assert.ok(classes['workspaceViewsWrapper'].has('view-mode-split'), 'wrapper must have view-mode-split class');
    assert.strictEqual(attrs['btnViewModeSplit']['aria-pressed'], 'true');
  });

  runTest('3.4: setViewMode with invalid parameter defaults safely to "split"', () => {
    ws.setViewMode('unknown_mode_xyz');
    assert.strictEqual(ws.getViewMode(), 'split');
    assert.ok(classes['workspaceViewsWrapper'].has('view-mode-split'));
  });

  runTest('3.5: setSplitMobileTab toggles "pdf" and "translated" tabs', () => {
    ws.setSplitMobileTab('translated');
    assert.strictEqual(ws.getSplitMobileTab(), 'translated');
    assert.strictEqual(attrs['workspaceViewsWrapper']['data-split-tab'], 'translated');
    assert.ok(classes['btnSplitTabTranslated'].has('active'));
    assert.strictEqual(attrs['btnSplitTabTranslated']['aria-selected'], 'true');
    assert.strictEqual(attrs['btnSplitTabPdf']['aria-selected'], 'false');

    ws.setSplitMobileTab('pdf');
    assert.strictEqual(ws.getSplitMobileTab(), 'pdf');
    assert.strictEqual(attrs['workspaceViewsWrapper']['data-split-tab'], 'pdf');
    assert.ok(classes['btnSplitTabPdf'].has('active'));
    assert.strictEqual(attrs['btnSplitTabPdf']['aria-selected'], 'true');
  });

  runTest('3.6: Switching view modes or mobile tabs does NOT trigger network fetch', () => {
    let networkFetchCount = 0;
    const originalFetch = context.fetch;
    context.fetch = () => { networkFetchCount++; return Promise.resolve(); };

    ws.setViewMode('text');
    ws.setViewMode('pdf');
    ws.setViewMode('split');
    ws.setSplitMobileTab('translated');
    ws.setSplitMobileTab('pdf');

    assert.strictEqual(networkFetchCount, 0, 'View mode/tab switching must never initiate network requests');
    context.fetch = originalFetch;
  });

  // ============================================================================
  // SUITE 4: Authenticated PDF Stream Fetch for History (PDFL-256.2)
  // ============================================================================
  console.log('\n[Suite 4] Authenticated PDF Stream Fetch for History Records');

  await runAsyncTest('4.1: fetchDocumentPreview on 200 OK passes Blob to loadPdfPreview', async () => {
    let previewLoadedBlob = null;
    let fetchedUrl = null;
    let fetchedHeaders = null;

    windowMock.pdfLinguaPreview.loadPdfPreview = (blob) => {
      previewLoadedBlob = blob;
      return Promise.resolve();
    };

    context.fetch = (url, opts) => {
      fetchedUrl = url;
      fetchedHeaders = opts.headers;
      return Promise.resolve({
        status: 200,
        blob: () => Promise.resolve({ size: 2048 }),
      });
    };

    await ws.fetchDocumentPreview(42, 'hop_dong_dich.pdf');

    assert.ok(fetchedUrl.includes('/api/documents/42/file'), 'fetch URL must point to /api/documents/42/file');
    assert.strictEqual(fetchedHeaders['Authorization'], 'Bearer mock-test-token-jwt');
    assert.ok(previewLoadedBlob, 'loadPdfPreview must receive the fetched Blob');
    assert.strictEqual(previewLoadedBlob.name, 'hop_dong_dich.pdf', 'Blob name must preserve document filename');
  });

  await runAsyncTest('4.2: fetchDocumentPreview on 401 calls handleAuthError', async () => {
    let authErrorCalled = false;
    context.handleAuthError = () => { authErrorCalled = true; };

    context.fetch = () => Promise.resolve({
      status: 401,
      json: () => Promise.resolve({ detail: 'Token expired' }),
    });

    await ws.fetchDocumentPreview(42, 'doc.pdf');
    assert.strictEqual(elements['pdfPreviewError'].style.display, 'flex');
    assert.ok(elements['pdfPreviewErrorMsg'].textContent.includes('hết hạn'));
  });

  await runAsyncTest('4.3: fetchDocumentPreview on 403 shows forbidden error', async () => {
    let toastMsg = null;
    context.showToast = (msg, type) => {
      if (type === 'error') toastMsg = msg;
    };

    context.fetch = () => Promise.resolve({
      status: 403,
      json: () => Promise.resolve({ detail: 'Forbidden' }),
    });

    await ws.fetchDocumentPreview(42, 'doc.pdf');
    assert.strictEqual(toastMsg, 'Bạn không có quyền xem trước tài liệu này.');
    assert.strictEqual(elements['pdfPreviewError'].style.display, 'flex');
  });

  await runAsyncTest('4.4: fetchDocumentPreview on 404 shows missing document error', async () => {
    let toastMsg = null;
    context.showToast = (msg, type) => {
      if (type === 'error') toastMsg = msg;
    };

    context.fetch = () => Promise.resolve({
      status: 404,
      json: () => Promise.resolve({ detail: 'Not Found' }),
    });

    await ws.fetchDocumentPreview(42, 'doc.pdf');
    assert.strictEqual(toastMsg, 'Không tìm thấy tệp PDF gốc trên hệ thống.');
    assert.strictEqual(elements['pdfPreviewError'].style.display, 'flex');
  });

  // ============================================================================
  // SUITE 5: Workspace Flow Integration
  // ============================================================================
  console.log('\n[Suite 5] Workspace Flow Integration');

  await runAsyncTest('5.1: renderWorkspace with document_id and no local file triggers fetchDocumentPreview', async () => {
    let previewLoaded = false;
    context.fetch = () => Promise.resolve({
      status: 200,
      blob: () => Promise.resolve({ size: 1024 }),
    });
    windowMock.pdfLinguaPreview.loadPdfPreview = () => {
      previewLoaded = true;
      return Promise.resolve();
    };

    ws.renderWorkspace({
      document_id: 88,
      document_filename: 'tai_lieu_history.pdf',
      original_text: 'Hello world',
      translated_text: 'Xin chào thế giới',
    });

    // Wait a tick for async fetchDocumentPreview
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(previewLoaded, 'renderWorkspace must trigger PDF stream fetch');
  });

  runTest('5.2: resetToUpload restores split mode and cleans up preview', () => {
    ws.setViewMode('text');
    assert.strictEqual(ws.getViewMode(), 'text');

    ws.resetToUpload();
    assert.strictEqual(ws.getViewMode(), 'split', 'resetToUpload must restore view mode to split');
    assert.strictEqual(ws.getSplitMobileTab(), 'pdf', 'resetToUpload must restore mobile tab to pdf');
  });

  runTest('5.3: Corrupted sessionStorage value falls back to split mode safely', () => {
    mockStorage.setItem('pdfl_workspace_view_mode', 'invalid_corrupted_value_999');
    ws.renderWorkspace({
      filename: 'test_safe.pdf',
      original_text: 'sample',
      translated_text: 'mau',
    });
    assert.strictEqual(ws.getViewMode(), 'split', 'Must fall back to split on invalid stored mode');
  });

  runTest('5.4: Storage setItem throwing QuotaExceededError does not crash setViewMode', () => {
    const originalSetItem = mockStorage.setItem;
    mockStorage.setItem = () => { throw new Error('QuotaExceededError'); };

    assert.doesNotThrow(() => {
      ws.setViewMode('text');
    }, 'setViewMode must not throw on storage exceptions');

    assert.strictEqual(ws.getViewMode(), 'text');
    mockStorage.setItem = originalSetItem;
  });

  // Summary
  console.log('\n======================================================');
  console.log(`KẾT QUẢ KIỂM THỬ SPLIT VIEW & INLINE STREAM: ${passedTests}/${totalTests} tests passed`);
  console.log('======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();

