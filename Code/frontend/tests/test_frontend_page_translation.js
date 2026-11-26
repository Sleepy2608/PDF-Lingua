/**
 * PDF-Lingua - Frontend Test Suite: Page Translation Workspace UI
 * ===============================================================
 * Verifies:
 * 1. Static HTML & CSS structure (Page Translation Bar, Pure White & Slate tokens,
 *    responsive rules, reduced motion, zero Em-Dash / En-Dash).
 * 2. All Pages vs Single Page mode switching & non-contiguous page navigation (e.g. 2, 4, 5, 6).
 * 3. Guest persistence via sessionStorage (Save, Reload, Retranslate, blank page guard).
 * 4. Authenticated persistence via History APIs (GET /pages, GET /pages/{n}, PUT /pages/{n})
 *    and Export synchronization (`getTranslatedContent()`).
 * 5. Bidirectional PDF Preview synchronization without ping-pong loops.
 * 6. i18n VI/EN parity and Loading / Error states (404, 500, empty input, network failure).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('--- START FRONTEND TEST SUITE: Page Translation Workspace UI ---\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const workspaceCss = fs.readFileSync(path.resolve(__dirname, '../css/workspace.css'), 'utf8');
const workspaceJs = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');
const pdfPreviewJs = fs.readFileSync(path.resolve(__dirname, '../js/pdf_preview.js'), 'utf8');
const i18nJs = fs.readFileSync(path.resolve(__dirname, '../js/i18n.js'), 'utf8');

function createMockWorkspaceEnv({ token = null, fetchImpl = null, lang = 'vi' } = {}) {
  const elements = {};
  const docListeners = {};
  const winListeners = {};
  const toasts = [];
  const previewGoToCalls = [];
  let previewCurrentPage = 1;
  let previewChangeCb = null;

  function makeEl(id, tagName = 'div') {
    const classSet = new Set();
    const attrs = {};
    const listeners = {};
    const children = [];
    const el = {
      id,
      tagName: tagName.toUpperCase(),
      style: {},
      disabled: false,
      value: '',
      innerText: '',
      textContent: '',
      title: '',
      children,
      classList: {
        add: (...cls) => cls.forEach((c) => classSet.add(c)),
        remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
        toggle: (c, force) => {
          if (force === undefined) {
            if (classSet.has(c)) classSet.delete(c);
            else classSet.add(c);
          } else if (force) classSet.add(c);
          else classSet.delete(c);
        },
        contains: (c) => classSet.has(c),
      },
      setAttribute: (k, v) => { attrs[k] = String(v); },
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
      addEventListener: (evt, fn) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      dispatch: (evt, payload = {}) => {
        (listeners[evt] || []).forEach((fn) => fn(payload));
      },
      click: () => {
        (listeners.click || []).forEach((fn) => fn({ preventDefault: () => {}, stopPropagation: () => {} }));
      },
      appendChild: (child) => {
        children.push(child);
        return child;
      },
      querySelector: (sel) => {
        if (sel === 'span') {
          if (!el._spanChild) {
            el._spanChild = makeEl(`${id}_span`, 'span');
          }
          return el._spanChild;
        }
        return makeEl(`${id}_${sel}`);
      },
      set innerHTML(val) {
        this._innerHTML = String(val);
        if (val === '') children.length = 0;
      },
      get innerHTML() {
        return this._innerHTML || '';
      },
    };
    if (id) elements[id] = el;
    return el;
  }

  const ids = [
    'heroSection',
    'workspaceSection',
    'documentsSection',
    'historySection',
    'adminSection',
    'docNameDisplay',
    'docPagesDisplay',
    'docSizeDisplay',
    'docTypeDisplay',
    'paneOriginal',
    'paneTranslated',
    'countOriginal',
    'countTranslated',
    'targetLangSelect',
    'workspaceViewsWrapper',
    'viewModeSwitcher',
    'btnViewModeText',
    'btnViewModePdf',
    'btnViewModeSplit',
    'splitMobileTabBar',
    'btnSplitTabPdf',
    'btnSplitTabTranslated',
    'pdfPreviewContainer',
    'pdfPreviewLoading',
    'pdfPreviewError',
    'pdfPreviewErrorMsg',
    'pdfCanvasWrap',
    'pageTranslationBar',
    'pageViewModeSwitcher',
    'btnPageModeAll',
    'btnPageModeSingle',
    'pageNavControls',
    'btnPagePrev',
    'pageSelectDropdown',
    'pagePositionIndicator',
    'btnPageNext',
    'pageStatusBadge',
    'pageBarActions',
    'btnSavePageTranslation',
    'btnReloadPageTranslation',
    'btnRetranslatePage',
    'pageBarErrorBanner',
    'pageBarErrorText',
    'btnDownloadTxt',
    'btnDownloadPdf',
    'btnDownloadDocx',
    'btnNewFile',
  ];
  ids.forEach((id) => makeEl(id));
  elements.targetLangSelect.value = 'vi';

  const storeData = {};
  const mockStorage = {
    getItem: (k) => (k in storeData ? storeData[k] : null),
    setItem: (k, v) => { storeData[k] = String(v); },
    removeItem: (k) => { delete storeData[k]; },
    clear: () => { Object.keys(storeData).forEach((k) => delete storeData[k]); },
  };

  let activeLang = lang;
  const miniTranslations = {
    vi: {
      page_mode_all: 'Toàn bộ trang',
      page_mode_single: 'Theo từng trang',
      page_label_item: 'Trang {page}',
      page_label_blank_suffix: ' (Trống)',
      page_status_saved: 'Đã lưu',
      page_status_saved_guest: 'Đã lưu tạm',
      page_status_unsaved: 'Chưa lưu',
      page_status_blank: 'Trang trống',
      page_status_loading: 'Đang xử lý...',
      page_status_error: 'Lỗi đồng bộ',
      page_btn_save: 'Lưu trang',
      page_btn_saving: 'Đang lưu...',
      page_btn_reload: 'Tải lại trang',
      page_btn_reloading: 'Đang tải...',
      page_btn_retranslate: 'Dịch lại trang',
      page_btn_retranslating: 'Đang dịch...',
    },
    en: {
      page_mode_all: 'All pages',
      page_mode_single: 'By page',
      page_label_item: 'Page {page}',
      page_label_blank_suffix: ' (Blank)',
      page_status_saved: 'Saved',
      page_status_saved_guest: 'Saved locally',
      page_status_unsaved: 'Unsaved',
      page_status_blank: 'Blank page',
      page_status_loading: 'Working...',
      page_status_error: 'Sync error',
      page_btn_save: 'Save page',
      page_btn_saving: 'Saving...',
      page_btn_reload: 'Reload page',
      page_btn_reloading: 'Loading...',
      page_btn_retranslate: 'Retranslate page',
      page_btn_retranslating: 'Translating...',
    },
  };

  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    createElement: (tag) => makeEl('', tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (evt, fn) => {
      docListeners[evt] = docListeners[evt] || [];
      docListeners[evt].push(fn);
    },
    dispatchEvent: (evt) => {
      (docListeners[evt.type] || []).forEach((fn) => fn(evt));
    },
    body: { appendChild: () => {} },
  };

  const windowMock = {
    document: mockDocument,
    sessionStorage: mockStorage,
    localStorage: mockStorage,
    scrollTo: () => {},
    innerWidth: 1440,
    addEventListener: (evt, fn) => {
      winListeners[evt] = winListeners[evt] || [];
      winListeners[evt].push(fn);
    },
    dispatchEvent: (evt) => {
      (winListeners[evt.type] || []).forEach((fn) => fn(evt));
    },
    i18n: {
      getLanguage: () => activeLang,
      setLanguage: (nextLang) => {
        activeLang = nextLang;
        mockDocument.dispatchEvent({ type: 'languageChanged', detail: { lang: nextLang } });
      },
      t: (key, params) => {
        let str = (miniTranslations[activeLang] && miniTranslations[activeLang][key]) || key;
        if (params && typeof params === 'object') {
          Object.keys(params).forEach((p) => {
            str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
          });
        }
        return str;
      },
    },
    pdfLinguaAuth: {
      getStoredToken: () => token,
      getStoredUser: () => (token ? { id: 1, email: 'pro@example.com', role: 'pro' } : null),
      clearStoredSession: () => {},
      updateHeaderAuthState: () => {},
    },
    pdfLinguaPreview: {
      loadPdfPreview: () => Promise.resolve(true),
      cleanupPdfPreview: () => {},
      zoomFit: () => {},
      getPdfDoc: () => ({ numPages: 6 }),
      getCurrentPage: () => previewCurrentPage,
      goToPage: (p) => {
        previewGoToCalls.push(Number(p));
        previewCurrentPage = Number(p);
        return Promise.resolve(true);
      },
      onPageChange: (cb) => {
        previewChangeCb = cb;
      },
      triggerPreviewPageChange: (p) => {
        previewCurrentPage = Number(p);
        if (previewChangeCb) previewChangeCb(Number(p), 6);
      },
    },
    pdfLinguaUpload: {
      getSelectedFile: () => null,
    },
  };

  const sandbox = {
    window: windowMock,
    document: mockDocument,
    sessionStorage: mockStorage,
    localStorage: mockStorage,
    fetch: fetchImpl || (() => Promise.reject(new Error('Unexpected fetch call'))),
    console,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    Blob: class MockBlob {},
    FormData: class MockFormData {},
    EventSource: undefined,
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    encodeURIComponent,
  };

  vm.createContext(sandbox);
  vm.runInContext(workspaceJs, sandbox);

  // Override showToast to capture notifications deterministically
  const origShowToast = sandbox.showToast;
  sandbox.showToast = (msg, type = 'info') => {
    toasts.push({ msg, type });
    if (origShowToast) {
      try { origShowToast(msg, type); } catch (_e) {}
    }
  };
  windowMock.showToast = sandbox.showToast;

  sandbox.initWorkspace();

  return {
    ws: windowMock.pdfLinguaWorkspace,
    windowMock,
    elements,
    storeData,
    toasts,
    previewGoToCalls,
  };
}

function sampleNonContiguousDoc(historyId = null) {
  return {
    document_id: historyId ? 42 : null,
    history_id: historyId,
    filename: 'selected_pages_report.pdf',
    page_count: 4,
    file_size_mb: 1.25,
    target_lang: 'vi',
    is_ocr_used: true,
    original_text: 'Page 2 original.\n\nPage 5 original.\n\nPage 6 original.',
    translated_text: 'Bản dịch trang 2.\n\nBản dịch trang 5.\n\nBản dịch trang 6.',
    engine_used: 'google',
    pages: [
      {
        page_number: 2,
        original_text: 'Page 2 original.',
        translated_text: 'Bản dịch trang 2.',
        is_ocr_used: false,
        is_blank: false,
        target_lang: 'vi',
        engine_used: 'google',
        status: 'completed',
        updated_at: '2026-11-23T01:00:00+00:00',
      },
      {
        page_number: 4,
        original_text: '',
        translated_text: '',
        is_ocr_used: true,
        is_blank: true,
        target_lang: 'vi',
        engine_used: 'none',
        status: 'blank',
        updated_at: '2026-11-23T01:00:00+00:00',
      },
      {
        page_number: 5,
        original_text: 'Page 5 original.',
        translated_text: 'Bản dịch trang 5.',
        is_ocr_used: true,
        is_blank: false,
        target_lang: 'vi',
        engine_used: 'google',
        status: 'completed',
        updated_at: '2026-11-23T01:00:00+00:00',
      },
      {
        page_number: 6,
        original_text: 'Page 6 original.',
        translated_text: 'Bản dịch trang 6.',
        is_ocr_used: false,
        is_blank: false,
        target_lang: 'vi',
        engine_used: 'google',
        status: 'completed',
        updated_at: '2026-11-23T01:00:00+00:00',
      },
    ],
  };
}

async function runAllSuites() {
  // =========================================================================
  // SUITE 1: Static HTML, CSS & Anti-Slop Compliance
  // =========================================================================
  console.log('[Suite 1] Static HTML, CSS & Anti-Slop Compliance');

  runTest('1.1: index.html contains Page Translation Bar and all controls', () => {
    const requiredIds = [
      'id="pageTranslationBar"',
      'id="pageViewModeSwitcher"',
      'id="btnPageModeAll"',
      'id="btnPageModeSingle"',
      'id="pageNavControls"',
      'id="btnPagePrev"',
      'id="pageSelectDropdown"',
      'id="pagePositionIndicator"',
      'id="btnPageNext"',
      'id="pageStatusBadge"',
      'id="pageBarActions"',
      'id="btnSavePageTranslation"',
      'id="btnReloadPageTranslation"',
      'id="btnRetranslatePage"',
      'id="pageBarErrorBanner"',
    ];
    requiredIds.forEach((idAttr) => {
      assert.ok(htmlContent.includes(idAttr), `Missing ${idAttr} in index.html`);
    });
  });

  runTest('1.2: workspace.css includes Pure White & Slate tokens, tabular-nums, responsive and reduced-motion rules', () => {
    assert.ok(workspaceCss.includes('.page-translation-bar'));
    assert.ok(workspaceCss.includes('font-variant-numeric: tabular-nums'));
    assert.ok(workspaceCss.includes('.page-action-save.is-dirty'));
    assert.ok(workspaceCss.includes('@media (max-width: 1024px)'));
    assert.ok(workspaceCss.includes('@media (max-width: 768px)'));
    assert.ok(workspaceCss.includes('@media (prefers-reduced-motion: reduce)'));
  });

  runTest('1.3: pdf_preview.js exposes onPageChange/offPageChange and dispatches preview page events', () => {
    assert.ok(pdfPreviewJs.includes('onPageChange'));
    assert.ok(pdfPreviewJs.includes('offPageChange'));
    assert.ok(pdfPreviewJs.includes('pdfl:preview-page-change'));
  });

  runTest('1.4: Zero Em-Dash or En-Dash in modified frontend files', () => {
    const files = [htmlContent, workspaceCss, workspaceJs, pdfPreviewJs, i18nJs];
    files.forEach((src, i) => {
      assert.strictEqual(src.includes('\u2014'), false, `Found Em-Dash in file index ${i}`);
      assert.strictEqual(src.includes('\u2013'), false, `Found En-Dash in file index ${i}`);
    });
  });

  // =========================================================================
  // SUITE 2: Mode Switching & Non-Contiguous Page Selection Navigation
  // =========================================================================
  console.log('\n[Suite 2] Mode Switching & Non-Contiguous Page Selection Navigation');

  runTest('2.1: Defaults to All Pages mode and switches cleanly to Single Page preserving original page numbers [2, 4, 5, 6]', () => {
    const env = createMockWorkspaceEnv();
    env.ws.renderWorkspace(sampleNonContiguousDoc(null));

    assert.strictEqual(env.ws.getPageViewMode(), 'all');
    assert.strictEqual(env.elements.pageTranslationBar.style.display, 'flex');
    assert.strictEqual(env.elements.pageNavControls.style.display, 'none');
    assert.ok(env.elements.paneTranslated.innerText.includes('Bản dịch trang 2.'));
    assert.ok(env.elements.paneTranslated.innerText.includes('Bản dịch trang 6.'));

    // Switch to Single Page mode
    env.elements.btnPageModeSingle.click();
    assert.strictEqual(env.ws.getPageViewMode(), 'page');
    assert.strictEqual(env.ws.getCurrentTranslationPageNum(), 2);
    assert.strictEqual(env.elements.pageNavControls.style.display, 'inline-flex');
    assert.strictEqual(env.elements.pageBarActions.style.display, 'inline-flex');
    assert.strictEqual(env.elements.paneOriginal.innerText, 'Page 2 original.');
    assert.strictEqual(env.elements.paneTranslated.innerText, 'Bản dịch trang 2.');
    assert.strictEqual(env.elements.pagePositionIndicator.textContent, '1 / 4');
    assert.strictEqual(env.elements.btnPagePrev.disabled, true);
    assert.strictEqual(env.elements.btnPageNext.disabled, false);

    // Dropdown preserves exact original page numbers [2, 4, 5, 6]
    const optValues = env.elements.pageSelectDropdown.children.map((c) => c.value);
    assert.deepStrictEqual(optValues, ['2', '4', '5', '6']);
  });

  runTest('2.2: Prev/Next navigation steps cleanly across non-contiguous gaps and handles blank pages', () => {
    const env = createMockWorkspaceEnv();
    env.ws.renderWorkspace(sampleNonContiguousDoc(null));
    env.ws.setPageViewMode('page');

    // Step 2 -> 4 (blank page)
    env.elements.btnPageNext.click();
    assert.strictEqual(env.ws.getCurrentTranslationPageNum(), 4);
    assert.strictEqual(env.elements.paneOriginal.innerText, '');
    assert.strictEqual(env.elements.paneTranslated.innerText, '');
    assert.ok(env.elements.pageStatusBadge.classList.contains('status-blank'));

    // Step 4 -> 5
    env.elements.btnPageNext.click();
    assert.strictEqual(env.ws.getCurrentTranslationPageNum(), 5);
    assert.strictEqual(env.elements.paneOriginal.innerText, 'Page 5 original.');
    assert.strictEqual(env.elements.paneTranslated.innerText, 'Bản dịch trang 5.');

    // Step 5 -> 6 (last page disables Next)
    env.elements.btnPageNext.click();
    assert.strictEqual(env.ws.getCurrentTranslationPageNum(), 6);
    assert.strictEqual(env.elements.pagePositionIndicator.textContent, '4 / 4');
    assert.strictEqual(env.elements.btnPageNext.disabled, true);
    assert.strictEqual(env.elements.btnPagePrev.disabled, false);

    // Step back 6 -> 5
    env.elements.btnPagePrev.click();
    assert.strictEqual(env.ws.getCurrentTranslationPageNum(), 5);

    // Switch back to All Pages restores full document text
    env.elements.btnPageModeAll.click();
    assert.strictEqual(env.ws.getPageViewMode(), 'all');
    assert.ok(env.elements.paneTranslated.innerText.includes('Bản dịch trang 2.'));
    assert.ok(env.elements.paneTranslated.innerText.includes('Bản dịch trang 6.'));
  });

  runTest('2.3: Legacy document without pages disables Single Page mode safely', () => {
    const env = createMockWorkspaceEnv();
    env.ws.renderWorkspace({
      filename: 'legacy.pdf',
      page_count: 2,
      target_lang: 'vi',
      original_text: 'Legacy text',
      translated_text: 'Bản dịch cũ',
      pages: [],
    });

    assert.strictEqual(env.elements.btnPageModeSingle.disabled, true);
    assert.strictEqual(env.ws.setPageViewMode('page'), 'all');
    assert.strictEqual(env.ws.getPageViewMode(), 'all');
  });

  // =========================================================================
  // SUITE 3: Guest Persistence via sessionStorage (Save, Reload, Retranslate)
  // =========================================================================
  console.log('\n[Suite 3] Guest Persistence via sessionStorage');

  await runAsyncTest('3.1: Guest Save updates sessionStorage & aggregate text; Reload restores saved snapshot', async () => {
    const env = createMockWorkspaceEnv({ token: null });
    env.ws.renderWorkspace(sampleNonContiguousDoc(null));
    env.ws.setPageViewMode('page');
    env.ws.selectTranslationPage(5);

    // Simulate user typing into translated pane
    env.elements.paneTranslated.innerText = 'Bản dịch trang 5 (Guest đã sửa).';
    env.elements.paneTranslated.dispatch('input');
    assert.ok(env.elements.pageStatusBadge.classList.contains('status-unsaved'));
    assert.ok(env.elements.btnSavePageTranslation.classList.contains('is-dirty'));

    // Save as Guest (must NOT invoke fetch)
    const saved = await env.ws.handleSaveCurrentPage();
    assert.strictEqual(saved, true);
    assert.ok(env.elements.pageStatusBadge.classList.contains('status-saved'));
    assert.strictEqual(env.elements.btnSavePageTranslation.classList.contains('is-dirty'), false);
    assert.ok(env.ws.getTranslatedContent().includes('Bản dịch trang 5 (Guest đã sửa).'));
    assert.ok(env.ws.getTranslatedContent().includes('Bản dịch trang 2.'));

    // Make an unsaved accidental edit, then Reload from Guest sessionStorage snapshot
    env.elements.paneTranslated.innerText = 'Nội dung gõ nhầm chưa lưu...';
    env.elements.paneTranslated.dispatch('input');
    assert.ok(env.elements.pageStatusBadge.classList.contains('status-unsaved'));

    const reloaded = await env.ws.handleReloadCurrentPage();
    assert.strictEqual(reloaded, true);
    assert.strictEqual(env.elements.paneTranslated.innerText, 'Bản dịch trang 5 (Guest đã sửa).');
    assert.ok(env.elements.pageStatusBadge.classList.contains('status-saved'));
  });

  await runAsyncTest('3.2: Guest Retranslate translates only active page and blocks blank page', async () => {
    const fetchCalls = [];
    const env = createMockWorkspaceEnv({
      token: null,
      fetchImpl: async (url, opts) => {
        fetchCalls.push({ url, opts });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { translated_text: 'Page 2 retranslated to English.', engine_used: 'google' },
          }),
        };
      },
    });
    env.ws.renderWorkspace(sampleNonContiguousDoc(null));
    env.ws.setPageViewMode('page');
    env.elements.targetLangSelect.value = 'en';

    // Blank page 4 must NOT invoke fetch
    env.ws.selectTranslationPage(4);
    const blankRes = await env.ws.handleRetranslateCurrentPage();
    assert.strictEqual(blankRes, false);
    assert.strictEqual(fetchCalls.length, 0);

    // Content page 2 invokes POST /api/process/retranslate with page 2 original_text only
    env.ws.selectTranslationPage(2);
    const okRes = await env.ws.handleRetranslateCurrentPage();
    assert.strictEqual(okRes, true);
    assert.strictEqual(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].url.endsWith('/api/process/retranslate'));
    const body = JSON.parse(fetchCalls[0].opts.body);
    assert.strictEqual(body.text, 'Page 2 original.');
    assert.strictEqual(body.target_lang, 'en');
    assert.strictEqual(env.elements.paneTranslated.innerText, 'Page 2 retranslated to English.');
  });

  // =========================================================================
  // SUITE 4: Authenticated Persistence via 3 History APIs
  // =========================================================================
  console.log('\n[Suite 4] Authenticated Persistence via History APIs');

  await runAsyncTest('4.1: Authenticated GET /pages, PUT /pages/{n}, GET /pages/{n} and Retranslate+PUT', async () => {
    const apiLog = [];
    const env = createMockWorkspaceEnv({
      token: 'valid-jwt-token',
      fetchImpl: async (url, opts = {}) => {
        const method = opts.method || 'GET';
        apiLog.push({ method, url, headers: opts.headers, body: opts.body });

        if (method === 'GET' && url.endsWith('/api/history/77/pages')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                history_id: 77,
                document_id: 42,
                target_lang: 'vi',
                total_pages: 4,
                pages: sampleNonContiguousDoc(77).pages,
              },
            }),
          };
        }
        if (method === 'PUT' && url.endsWith('/api/history/77/pages/5')) {
          const parsedBody = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                page_number: 5,
                original_text: 'Page 5 original.',
                translated_text: parsedBody.translated_text,
                is_ocr_used: true,
                is_blank: false,
                target_lang: parsedBody.target_lang || 'vi',
                engine_used: 'google',
                status: 'edited',
                updated_at: '2026-11-23T02:00:00+00:00',
              },
            }),
          };
        }
        if (method === 'GET' && url.endsWith('/api/history/77/pages/5')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                page_number: 5,
                original_text: 'Page 5 original.',
                translated_text: 'Bản dịch trang 5 từ máy chủ.',
                is_ocr_used: true,
                is_blank: false,
                target_lang: 'vi',
                engine_used: 'google',
                status: 'edited',
                updated_at: '2026-11-23T02:05:00+00:00',
              },
            }),
          };
        }
        if (method === 'POST' && url.endsWith('/api/process/retranslate')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: { translated_text: 'Bản dịch mới trang 5.', engine_used: 'google' },
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({ success: false, message: 'Not found' }) };
      },
    });

    // 1. Load pages list from GET /api/history/77/pages
    env.ws.renderWorkspace({
      document_id: 42,
      history_id: 77,
      filename: 'server_doc.pdf',
      page_count: 4,
      target_lang: 'vi',
      original_text: 'Page 2 original.\n\nPage 5 original.\n\nPage 6 original.',
      translated_text: 'Bản dịch trang 2.\n\nBản dịch trang 5.\n\nBản dịch trang 6.',
      pages: [],
    });
    const loadedPages = await env.ws.loadHistoryPagesFromServer(77);
    assert.strictEqual(loadedPages.length, 4);
    assert.ok(apiLog.some((c) => c.method === 'GET' && c.url.endsWith('/api/history/77/pages')));

    // 2. Switch to page 5, edit, and Save -> PUT /api/history/77/pages/5
    env.ws.setPageViewMode('page');
    env.ws.selectTranslationPage(5);
    env.elements.paneTranslated.innerText = 'Bản dịch trang 5 đã chỉnh sửa trên server.';
    env.elements.paneTranslated.dispatch('input');
    const saveOk = await env.ws.handleSaveCurrentPage();
    assert.strictEqual(saveOk, true);
    const putCall = apiLog.find((c) => c.method === 'PUT' && c.url.endsWith('/api/history/77/pages/5'));
    assert.ok(putCall, 'Expected PUT /api/history/77/pages/5 call');
    assert.strictEqual(putCall.headers.Authorization, 'Bearer valid-jwt-token');
    assert.ok(env.ws.getTranslatedContent().includes('Bản dịch trang 5 đã chỉnh sửa trên server.'));
    assert.ok(env.ws.getTranslatedContent().includes('Bản dịch trang 6.'));

    // 3. Reload page 5 -> GET /api/history/77/pages/5
    env.elements.paneTranslated.innerText = 'Sửa nháp chưa lưu...';
    const reloadOk = await env.ws.handleReloadCurrentPage();
    assert.strictEqual(reloadOk, true);
    assert.strictEqual(env.elements.paneTranslated.innerText, 'Bản dịch trang 5 từ máy chủ.');

    // 4. Retranslate page 5 -> POST /retranslate + auto-save PUT /api/history/77/pages/5
    const beforePuts = apiLog.filter((c) => c.method === 'PUT').length;
    const retransOk = await env.ws.handleRetranslateCurrentPage();
    assert.strictEqual(retransOk, true);
    assert.strictEqual(env.elements.paneTranslated.innerText, 'Bản dịch mới trang 5.');
    const afterPuts = apiLog.filter((c) => c.method === 'PUT').length;
    assert.strictEqual(afterPuts, beforePuts + 1);
  });

  // =========================================================================
  // SUITE 5: Bidirectional PDF Preview Sync
  // =========================================================================
  console.log('\n[Suite 5] Bidirectional PDF Preview Synchronization');

  runTest('5.1: Workspace page change syncs PDF Preview and PDF Preview change syncs Workspace without loop', () => {
    const env = createMockWorkspaceEnv();
    env.ws.renderWorkspace(sampleNonContiguousDoc(null));
    env.ws.setPageViewMode('page');

    // Selecting page 5 from Workspace calls preview.goToPage(5)
    env.previewGoToCalls.length = 0;
    env.ws.selectTranslationPage(5);
    assert.deepStrictEqual(env.previewGoToCalls, [5]);

    // Flipping PDF Preview to page 6 syncs Workspace to page 6 without calling goToPage back
    env.previewGoToCalls.length = 0;
    env.windowMock.pdfLinguaPreview.triggerPreviewPageChange(6);
    assert.strictEqual(env.ws.getCurrentTranslationPageNum(), 6);
    assert.strictEqual(env.elements.paneTranslated.innerText, 'Bản dịch trang 6.');
    assert.deepStrictEqual(env.previewGoToCalls, []);

    // Flipping PDF Preview to untranslated page 3 keeps page 6 intact and emits info toast
    const toastCountBefore = env.toasts.length;
    env.windowMock.pdfLinguaPreview.triggerPreviewPageChange(3);
    assert.strictEqual(env.ws.getCurrentTranslationPageNum(), 6);
    assert.ok(env.toasts.length > toastCountBefore);
    assert.strictEqual(env.toasts[env.toasts.length - 1].type, 'info');
  });

  // =========================================================================
  // SUITE 6: i18n Reactivity & Error / Loading States
  // =========================================================================
  console.log('\n[Suite 6] i18n & Error / Loading States');

  runTest('6.1: Language switch dynamically updates page dropdown labels and status badge', () => {
    const env = createMockWorkspaceEnv({ lang: 'vi' });
    env.ws.renderWorkspace(sampleNonContiguousDoc(null));
    env.ws.setPageViewMode('page');

    assert.strictEqual(env.elements.pageSelectDropdown.children[0].textContent, 'Trang 2');
    assert.strictEqual(env.elements.pageStatusBadge.textContent, 'Đã lưu tạm');

    env.windowMock.i18n.setLanguage('en');
    assert.strictEqual(env.elements.pageSelectDropdown.children[0].textContent, 'Page 2');
    assert.strictEqual(env.elements.pageStatusBadge.textContent, 'Saved locally');
  });

  await runAsyncTest('6.2: Empty save input and API 500 error display error banner and recover loading state', async () => {
    const env = createMockWorkspaceEnv({
      token: 'valid-jwt-token',
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        json: async () => ({ success: false, message: 'Server persistence error' }),
      }),
    });
    env.ws.renderWorkspace(sampleNonContiguousDoc(88));
    env.ws.setPageViewMode('page');
    env.ws.selectTranslationPage(2);

    // Empty content validation
    env.elements.paneTranslated.innerText = '   ';
    const emptySave = await env.ws.handleSaveCurrentPage();
    assert.strictEqual(emptySave, false);
    assert.strictEqual(env.elements.pageBarErrorBanner.style.display, 'block');
    assert.ok(env.elements.pageStatusBadge.classList.contains('status-error'));

    // Server 500 failure on Save recovers buttons and shows error state
    env.elements.paneTranslated.innerText = 'Valid text failing on server.';
    const serverFail = await env.ws.handleSaveCurrentPage();
    assert.strictEqual(serverFail, false);
    assert.strictEqual(env.elements.pageBarErrorBanner.style.display, 'block');
    assert.strictEqual(env.elements.pageBarErrorText.textContent, 'Server persistence error');
    assert.ok(env.elements.pageStatusBadge.classList.contains('status-error'));
    assert.strictEqual(env.elements.btnSavePageTranslation.disabled, false);
    assert.strictEqual(env.elements.btnReloadPageTranslation.disabled, false);
  });

  console.log(`\n=== SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED) ===`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllSuites().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
