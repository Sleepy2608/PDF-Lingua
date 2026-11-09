/**
 * PDF-Lingua - Frontend Export UI & Multi-Target Download Test Suite (PDFL-150.4)
 * -------------------------------------------------------------------------------
 * Verifies:
 * 1. Static HTML contains 4 target groups (8 buttons) and summary status indicator.
 * 2. getSummaryContent extracts summary from currentDocData or DOM elements properly.
 * 3. updateSummaryExportState enables/disables summary export buttons and toggles badge.
 * 4. Dropdown menu toggles and updates state when opened.
 * 5. All 8 buttons invoke triggerDownload with correct format and exportType.
 * 6. triggerDownload validates content availability for each export type.
 * 7. Correct request payloads sent to /api/process/download (content, original_content, export_type, filename, title).
 * 8. Filename suffixes (_goc, _dich, _tomtat, _songngu) are deduplicated.
 * 9. Workspace pane contents remain intact and user edits in panes are prioritized.
 * 10. Backward compatibility when calling triggerDownload without exportType.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...args) { args.forEach(v => this.values.add(v)); }
  remove(...args) { args.forEach(v => this.values.delete(v)); }
  contains(v) { return this.values.has(v); }
  toggle(v) { if (this.contains(v)) this.remove(v); else this.add(v); }
  toString() { return Array.from(this.values).join(' '); }
}

class Element {
  constructor(id, tag = 'div') {
    this.id = id || '';
    this.tagName = tag.toUpperCase();
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.innerText = '';
    this.title = '';
    this.classList = new ClassList();
    this.style = {};
    this.disabled = false;
    this.attributes = {};
    this.listeners = {};
    this.children = [];
    this.download = '';
    this.href = '';
  }
  get className() {
    return this.classList.toString();
  }
  set className(val) {
    this.classList = new ClassList();
    if (val) {
      val.split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
    }
  }
  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }
  removeEventListener(event, handler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(h => h !== handler);
  }
  trigger(event, data = {}) {
    const ev = Object.assign({ stopPropagation: () => {}, target: this }, data);
    if (this.listeners[event]) {
      this.listeners[event].forEach(h => h(ev));
    }
  }
  click() {
    this.trigger('click', { stopPropagation: () => {} });
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  appendChild(child) {
    this.children.push(child);
  }
  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
  }
  remove() {
    this.children = [];
  }
  contains(child) {
    if (child === this) return true;
    return this.children.some(c => c === child || (c.contains && c.contains(child)));
  }
}

class MockStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

function createEnvironment() {
  const elements = {};
  const elementIds = [
    'btnProcessPdf', 'btnRetranslate', 'targetLangSelect', 'btnCopyOriginal', 'btnCopyTranslated',
    'btnDownloadMenu', 'downloadDropdown',
    'btnDownloadTxt', 'btnDownloadPdf',
    'btnDownloadOriginalTxt', 'btnDownloadOriginalPdf',
    'btnDownloadBilingualTxt', 'btnDownloadBilingualPdf',
    'btnDownloadSummaryTxt', 'btnDownloadSummaryPdf',
    'summaryExportStatus',
    'btnNewFile', 'btnRemoveFile',
    'paneOriginal', 'paneTranslated', 'paneSummary', 'summaryContent',
    'countOriginal', 'countTranslated',
    'docNameDisplay', 'docPagesDisplay', 'docSizeDisplay', 'docTypeDisplay',
    'heroSection', 'workspaceSection', 'documentsSection', 'adminSection',
    'processingModal', 'progressBarFill', 'progressDesc',
    'toastContainer'
  ];
  elementIds.forEach(id => { elements[id] = new Element(id); });

  const storage = new MockStorage();
  const documentListeners = {};
  const toasts = [];
  const fetchCalls = [];
  const clickedLinks = [];

  const context = {
    console,
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    setInterval: (fn) => { fn(); return 2; },
    clearInterval: () => {},
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => null,
      querySelectorAll: () => [],
      addEventListener: (event, handler) => {
        if (!documentListeners[event]) documentListeners[event] = [];
        documentListeners[event].push(handler);
      },
      createElement: (tag) => {
        const el = new Element('', tag);
        return el;
      },
      body: {
        appendChild: (el) => {
          if (el.tagName === 'A') {
            const originalClick = el.click.bind(el);
            el.click = () => {
              clickedLinks.push({ download: el.download, href: el.href });
              originalClick();
            };
          }
        },
        removeChild: () => {},
      },
    },
    window: {
      scrollTo: () => {},
      location: { protocol: 'http:', port: '8000', hostname: 'localhost' },
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      URL: {
        createObjectURL: () => 'blob:mock-download-url',
        revokeObjectURL: () => {},
      },
    },
    localStorage: storage,
    sessionStorage: storage,
    fetch: async (url, options) => {
      fetchCalls.push({ url, options, body: options && options.body ? JSON.parse(options.body) : null });
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/octet-stream' },
        blob: async () => ({ size: 1024, type: 'application/octet-stream' }),
        json: async () => ({ success: true }),
      };
    },
  };

  context.window.document = context.document;
  context.window.localStorage = storage;
  context.window.sessionStorage = storage;

  vm.createContext(context);
  vm.runInContext(workspaceSource, context);
  context.pdfLinguaWorkspace = context.window.pdfLinguaWorkspace;

  return { context, elements, toasts, fetchCalls, clickedLinks };
}

console.log('--- BẮT ĐẦU TEST SUITE PDFL-150.4 (Frontend Export UI & Multi-Target Download) ---');

let totalTests = 0;
let passedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ==========================================
// Test Suite 1: Static HTML Structure & IDs
// ==========================================
console.log('\n[Suite 1] Static HTML Structure & Component IDs');

runTest('1.1: index.html contains downloadDropdown with dropdown-menu-export class', () => {
  assert(htmlSource.includes('id="downloadDropdown"'), 'Missing id="downloadDropdown"');
  assert(htmlSource.includes('dropdown-menu-export'), 'Missing dropdown-menu-export class');
});

runTest('1.2: index.html contains all 8 multi-target download button IDs', () => {
  const requiredButtons = [
    'btnDownloadTxt',
    'btnDownloadPdf',
    'btnDownloadOriginalTxt',
    'btnDownloadOriginalPdf',
    'btnDownloadBilingualTxt',
    'btnDownloadBilingualPdf',
    'btnDownloadSummaryTxt',
    'btnDownloadSummaryPdf',
  ];
  requiredButtons.forEach(btnId => {
    assert(htmlSource.includes(`id="${btnId}"`), `Missing button #${btnId} in index.html`);
  });
});

runTest('1.3: index.html contains summaryExportStatus badge and summary buttons start disabled', () => {
  assert(htmlSource.includes('id="summaryExportStatus"'), 'Missing #summaryExportStatus in index.html');
  assert(htmlSource.includes('(chưa có)'), 'Summary status badge should default to (chưa có)');
  assert(htmlSource.includes('id="btnDownloadSummaryTxt" data-export-type="summary" data-format="txt" title="Chưa có bản tóm tắt" disabled'), 'btnDownloadSummaryTxt must start disabled');
  assert(htmlSource.includes('id="btnDownloadSummaryPdf" data-export-type="summary" data-format="pdf" title="Chưa có bản tóm tắt" disabled'), 'btnDownloadSummaryPdf must start disabled');
});

// ==========================================
// Test Suite 2: Summary Content Extraction
// ==========================================
console.log('\n[Suite 2] Summary Content Extraction (getSummaryContent)');

runTest('2.1: getSummaryContent returns null when no document data or DOM content', () => {
  const { context } = createEnvironment();
  const summary = context.pdfLinguaWorkspace.getSummaryContent();
  assert.strictEqual(summary, null);
});

runTest('2.2: getSummaryContent returns summary_text from currentDocData', () => {
  const { context } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'test.pdf',
    summary_text: '  Nội dung tóm tắt chính của tài liệu.  ',
  });
  const summary = context.pdfLinguaWorkspace.getSummaryContent();
  assert.strictEqual(summary, 'Nội dung tóm tắt chính của tài liệu.');
});

runTest('2.3: getSummaryContent returns summary (EPIC 09 alternate field) when summary_text is absent', () => {
  const { context } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'test.pdf',
    summary: '  Bản tóm tắt từ trường summary.  ',
  });
  const summary = context.pdfLinguaWorkspace.getSummaryContent();
  assert.strictEqual(summary, 'Bản tóm tắt từ trường summary.');
});

runTest('2.4: getSummaryContent falls back to DOM element #paneSummary when doc field is absent', () => {
  const { context, elements } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({ filename: 'test.pdf' });
  elements.paneSummary.innerText = 'Tóm tắt từ DOM paneSummary';
  const summary = context.pdfLinguaWorkspace.getSummaryContent();
  assert.strictEqual(summary, 'Tóm tắt từ DOM paneSummary');
});

// ==========================================
// Test Suite 3: Summary Export State UI
// ==========================================
console.log('\n[Suite 3] Summary Export State UI (updateSummaryExportState)');

runTest('3.1: updateSummaryExportState disables summary buttons and sets badge to (chưa có) when no summary', () => {
  const { context, elements } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({ filename: 'test.pdf', original_text: 'ABC', translated_text: 'XYZ' });
  context.pdfLinguaWorkspace.updateSummaryExportState();

  assert.strictEqual(elements.btnDownloadSummaryTxt.disabled, true);
  assert.strictEqual(elements.btnDownloadSummaryPdf.disabled, true);
  assert.strictEqual(elements.summaryExportStatus.textContent, '(chưa có)');
  assert(!elements.summaryExportStatus.classList.contains('ready'));
});

runTest('3.2: updateSummaryExportState enables summary buttons and sets badge to (sẵn sàng) when summary exists', () => {
  const { context, elements } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'test.pdf',
    original_text: 'ABC',
    translated_text: 'XYZ',
    summary_text: '1. Ý chính\n2. Kết luận',
  });
  context.pdfLinguaWorkspace.updateSummaryExportState();

  assert.strictEqual(elements.btnDownloadSummaryTxt.disabled, false);
  assert.strictEqual(elements.btnDownloadSummaryPdf.disabled, false);
  assert.strictEqual(elements.summaryExportStatus.textContent, '(sẵn sàng)');
  assert(elements.summaryExportStatus.classList.contains('ready'));
});

// ==========================================
// Test Suite 4: Multi-Target Button Click Binding
// ==========================================
console.log('\n[Suite 4] Event Binding and Dropdown Toggle');

runTest('4.1: Clicking btnDownloadMenu toggles dropdown and updates summary export state', () => {
  const { context, elements } = createEnvironment();
  context.initWorkspace();

  context.pdfLinguaWorkspace.setCurrentDocData({ filename: 'test.pdf', summary_text: 'Tóm tắt test' });
  assert(!elements.downloadDropdown.classList.contains('show'));

  elements.btnDownloadMenu.click();
  assert(elements.downloadDropdown.classList.contains('show'));
  assert.strictEqual(elements.summaryExportStatus.textContent, '(sẵn sàng)');

  elements.btnDownloadMenu.click();
  assert(!elements.downloadDropdown.classList.contains('show'));
});

runTest('4.2: All 8 export buttons trigger download with respective format and exportType', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  context.initWorkspace();

  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'bao_cao.pdf',
    original_text: 'Original text content',
    translated_text: 'Nội dung bản dịch',
    summary_text: 'Nội dung tóm tắt',
  });
  elements.paneOriginal.innerText = 'Original text content';
  elements.paneTranslated.innerText = 'Nội dung bản dịch';

  const cases = [
    { btn: elements.btnDownloadTxt, format: 'txt', type: 'translated' },
    { btn: elements.btnDownloadPdf, format: 'pdf', type: 'translated' },
    { btn: elements.btnDownloadOriginalTxt, format: 'txt', type: 'original' },
    { btn: elements.btnDownloadOriginalPdf, format: 'pdf', type: 'original' },
    { btn: elements.btnDownloadBilingualTxt, format: 'txt', type: 'bilingual' },
    { btn: elements.btnDownloadBilingualPdf, format: 'pdf', type: 'bilingual' },
    { btn: elements.btnDownloadSummaryTxt, format: 'txt', type: 'summary' },
    { btn: elements.btnDownloadSummaryPdf, format: 'pdf', type: 'summary' },
  ];

  for (let i = 0; i < cases.length; i++) {
    const { btn, format, type } = cases[i];
    await btn.click();
    assert.strictEqual(fetchCalls.length, i + 1, `Fetch call missing for ${btn.id}`);
    const call = fetchCalls[i];
    assert.strictEqual(call.body.format, format, `Format mismatch for ${btn.id}`);
    assert.strictEqual(call.body.export_type, type, `Export type mismatch for ${btn.id}`);
  }
});

// ==========================================
// Test Suite 5: Validation & Error Handling
// ==========================================
console.log('\n[Suite 5] Validation & Error Handling in triggerDownload');

runTest('5.1: triggerDownload aborts and toasts error when currentDocData is null', async () => {
  const { context, fetchCalls } = createEnvironment();
  let toastMsg = null;
  context.showToast = (msg, type) => { if (type === 'error') toastMsg = msg; };

  await context.pdfLinguaWorkspace.triggerDownload('txt', 'translated');
  assert.strictEqual(fetchCalls.length, 0);
  assert(toastMsg && toastMsg.includes('Chưa có tài liệu'));
});

runTest('5.2: triggerDownload original fails with toast if original content is empty', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({ filename: 'test.pdf', original_text: '', translated_text: 'Bản dịch' });
  elements.paneOriginal.innerText = '';
  elements.paneTranslated.innerText = 'Bản dịch';

  let toastMsg = null;
  context.showToast = (msg, type) => { if (type === 'error') toastMsg = msg; };

  await context.pdfLinguaWorkspace.triggerDownload('txt', 'original');
  assert.strictEqual(fetchCalls.length, 0);
  assert(toastMsg && toastMsg.includes('Chưa có nội dung văn bản gốc'));
});

runTest('5.3: triggerDownload translated fails with toast if translated content is empty', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({ filename: 'test.pdf', original_text: 'Original', translated_text: '' });
  elements.paneOriginal.innerText = 'Original';
  elements.paneTranslated.innerText = '';

  let toastMsg = null;
  context.showToast = (msg, type) => { if (type === 'error') toastMsg = msg; };

  await context.pdfLinguaWorkspace.triggerDownload('txt', 'translated');
  assert.strictEqual(fetchCalls.length, 0);
  assert(toastMsg && toastMsg.includes('Chưa có nội dung bản dịch'));
});

runTest('5.4: triggerDownload bilingual fails if either original or translated is missing', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  let toastMsg = null;
  context.showToast = (msg, type) => { if (type === 'error') toastMsg = msg; };

  // Missing original
  context.pdfLinguaWorkspace.setCurrentDocData({ filename: 'test.pdf', original_text: '', translated_text: 'Dịch' });
  elements.paneOriginal.innerText = '';
  elements.paneTranslated.innerText = 'Dịch';
  await context.pdfLinguaWorkspace.triggerDownload('txt', 'bilingual');
  assert.strictEqual(fetchCalls.length, 0);
  assert(toastMsg && toastMsg.includes('Thiếu nội dung văn bản gốc'));

  // Missing translated
  toastMsg = null;
  context.pdfLinguaWorkspace.setCurrentDocData({ filename: 'test.pdf', original_text: 'Gốc', translated_text: '' });
  elements.paneOriginal.innerText = 'Gốc';
  elements.paneTranslated.innerText = '';
  await context.pdfLinguaWorkspace.triggerDownload('txt', 'bilingual');
  assert.strictEqual(fetchCalls.length, 0);
  assert(toastMsg && toastMsg.includes('Thiếu nội dung bản dịch'));
});

runTest('5.5: triggerDownload summary fails with toast if summary content is missing', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({ filename: 'test.pdf', original_text: 'Gốc', translated_text: 'Dịch' });
  elements.paneOriginal.innerText = 'Gốc';
  elements.paneTranslated.innerText = 'Dịch';

  let toastMsg = null;
  context.showToast = (msg, type) => { if (type === 'error') toastMsg = msg; };

  await context.pdfLinguaWorkspace.triggerDownload('txt', 'summary');
  assert.strictEqual(fetchCalls.length, 0);
  assert(toastMsg && toastMsg.includes('Chưa có nội dung tóm tắt'));
});

// ==========================================
// Test Suite 6: API Payload & Filename Deduplication
// ==========================================
console.log('\n[Suite 6] API Payload Generation & Filename Deduplication');

runTest('6.1: Original export payload has correct content, suffix _goc, title, and no original_content', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'sample_doc.pdf',
    original_text: 'Original Doc Text',
    translated_text: 'Bản Dịch Text',
  });
  elements.paneOriginal.innerText = 'Original Doc Text';

  await context.pdfLinguaWorkspace.triggerDownload('txt', 'original');
  assert.strictEqual(fetchCalls.length, 1);
  const body = fetchCalls[0].body;

  assert.strictEqual(body.content, 'Original Doc Text');
  assert.strictEqual(body.format, 'txt');
  assert.strictEqual(body.export_type, 'original');
  assert.strictEqual(body.filename, 'sample_doc_goc');
  assert(body.title.includes('Văn Bản Gốc'));
  assert.strictEqual(body.original_content, undefined);
});

runTest('6.2: Bilingual export payload has target translated content, original_content, suffix _songngu, and title', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'contract.pdf',
    original_text: 'English Agreement Clause',
    translated_text: 'Điều khoản hợp đồng tiếng Việt',
  });
  elements.paneOriginal.innerText = 'English Agreement Clause';
  elements.paneTranslated.innerText = 'Điều khoản hợp đồng tiếng Việt';

  await context.pdfLinguaWorkspace.triggerDownload('pdf', 'bilingual');
  assert.strictEqual(fetchCalls.length, 1);
  const body = fetchCalls[0].body;

  assert.strictEqual(body.content, 'Điều khoản hợp đồng tiếng Việt');
  assert.strictEqual(body.original_content, 'English Agreement Clause');
  assert.strictEqual(body.format, 'pdf');
  assert.strictEqual(body.export_type, 'bilingual');
  assert.strictEqual(body.filename, 'contract_songngu');
  assert(body.title.includes('Song Ngữ'));
});

runTest('6.3: Summary export payload has summary content, suffix _tomtat, and title', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'research_paper.pdf',
    original_text: 'Paper content',
    translated_text: 'Nội dung bài báo',
    summary_text: '1. Mục tiêu\n2. Phương pháp\n3. Kết quả',
  });

  await context.pdfLinguaWorkspace.triggerDownload('pdf', 'summary');
  assert.strictEqual(fetchCalls.length, 1);
  const body = fetchCalls[0].body;

  assert.strictEqual(body.content, '1. Mục tiêu\n2. Phương pháp\n3. Kết quả');
  assert.strictEqual(body.format, 'pdf');
  assert.strictEqual(body.export_type, 'summary');
  assert.strictEqual(body.filename, 'research_paper_tomtat');
  assert(body.title.includes('Tóm Tắt'));
  assert.strictEqual(body.original_content, undefined);
});

runTest('6.4: Filename deduplication prevents double suffixes (e.g., _goc_goc or _dich_tomtat)', async () => {
  const { context, elements, fetchCalls } = createEnvironment();

  // Case 1: filename already has _goc, exporting original
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'document_goc.pdf',
    original_text: 'Some original text',
    translated_text: 'Some translated text',
  });
  elements.paneOriginal.innerText = 'Some original text';
  await context.pdfLinguaWorkspace.triggerDownload('txt', 'original');
  assert.strictEqual(fetchCalls[0].body.filename, 'document_goc');

  // Case 2: filename has _dich, exporting summary
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'document_dich.pdf',
    original_text: 'Some original text',
    translated_text: 'Some translated text',
    summary_text: 'Some summary',
  });
  await context.pdfLinguaWorkspace.triggerDownload('pdf', 'summary');
  assert.strictEqual(fetchCalls[1].body.filename, 'document_tomtat');
});

// ==========================================
// Test Suite 7: Content Preservation & Edits
// ==========================================
console.log('\n[Suite 7] Workspace Content Preservation & Priority');

runTest('7.1: User edits in editable pane are used for export instead of stale storage data', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'notes.pdf',
    original_text: 'Old original text',
    translated_text: 'Old translated text',
  });
  elements.paneOriginal.innerText = 'User updated original text!';
  elements.paneTranslated.innerText = 'Bản dịch mới do người dùng chỉnh sửa!';

  await context.pdfLinguaWorkspace.triggerDownload('txt', 'translated');
  assert.strictEqual(fetchCalls[0].body.content, 'Bản dịch mới do người dùng chỉnh sửa!');

  // Verify pane text is NOT erased or modified by triggerDownload
  assert.strictEqual(elements.paneOriginal.innerText, 'User updated original text!');
  assert.strictEqual(elements.paneTranslated.innerText, 'Bản dịch mới do người dùng chỉnh sửa!');
});

// ==========================================
// Test Suite 8: Backward Compatibility
// ==========================================
console.log('\n[Suite 8] Backward Compatibility');

runTest('8.1: triggerDownload(format) with no exportType defaults to translated', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'legacy.pdf',
    original_text: 'Old text',
    translated_text: 'Bản dịch mặc định',
  });
  elements.paneTranslated.innerText = 'Bản dịch mặc định';

  await context.pdfLinguaWorkspace.triggerDownload('pdf');
  assert.strictEqual(fetchCalls[0].body.export_type, 'translated');
  assert.strictEqual(fetchCalls[0].body.format, 'pdf');
  assert.strictEqual(fetchCalls[0].body.filename, 'legacy_dich');
});

runTest('8.2: triggerDownload() with no parameters defaults to format=txt and exportType=translated', async () => {
  const { context, elements, fetchCalls } = createEnvironment();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'legacy.pdf',
    original_text: 'Old text',
    translated_text: 'Bản dịch mặc định',
  });
  elements.paneTranslated.innerText = 'Bản dịch mặc định';

  await context.pdfLinguaWorkspace.triggerDownload();
  assert.strictEqual(fetchCalls[0].body.export_type, 'translated');
  assert.strictEqual(fetchCalls[0].body.format, 'txt');
  assert.strictEqual(fetchCalls[0].body.filename, 'legacy_dich');
});

// ==========================================
// Test Suite 9: PDFL-156.3 Empty State & Download Validation
// ==========================================
console.log('\n[Suite 9] Empty State & Strict Download Validation (PDFL-156.3)');

runTest('9.1: resetToUpload disables all 8 export buttons and clears panes', () => {
  const { context, elements } = createEnvironment();
  context.initWorkspace();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'doc.pdf',
    original_text: 'Hello',
    translated_text: 'Xin chào',
    summary_text: 'Tóm tắt',
  });
  elements.paneOriginal.innerText = 'Hello';
  elements.paneTranslated.innerText = 'Xin chào';
  context.pdfLinguaWorkspace.updateExportUIState();

  assert.strictEqual(elements.btnDownloadTxt.disabled, false);
  assert.strictEqual(elements.btnDownloadOriginalTxt.disabled, false);
  assert.strictEqual(elements.btnDownloadBilingualTxt.disabled, false);
  assert.strictEqual(elements.btnDownloadSummaryTxt.disabled, false);

  // Now reset workspace
  context.resetToUpload();

  assert.strictEqual(elements.btnDownloadTxt.disabled, true);
  assert.strictEqual(elements.btnDownloadPdf.disabled, true);
  assert.strictEqual(elements.btnDownloadOriginalTxt.disabled, true);
  assert.strictEqual(elements.btnDownloadOriginalPdf.disabled, true);
  assert.strictEqual(elements.btnDownloadBilingualTxt.disabled, true);
  assert.strictEqual(elements.btnDownloadBilingualPdf.disabled, true);
  assert.strictEqual(elements.btnDownloadSummaryTxt.disabled, true);
  assert.strictEqual(elements.btnDownloadSummaryPdf.disabled, true);
  assert.strictEqual(elements.paneOriginal.innerText, '');
  assert.strictEqual(elements.paneTranslated.innerText, '');
});

runTest('9.2: When original is null, empty string or whitespace, original & bilingual buttons are disabled', () => {
  const emptyValues = [null, '', '   ', '\n\t  '];
  emptyValues.forEach(emptyVal => {
    const { context, elements } = createEnvironment();
    context.initWorkspace();
    context.pdfLinguaWorkspace.setCurrentDocData({
      filename: 'doc.pdf',
      original_text: emptyVal,
      translated_text: 'Bản dịch hợp lệ',
    });
    elements.paneOriginal.innerText = emptyVal || '';
    elements.paneTranslated.innerText = 'Bản dịch hợp lệ';
    context.pdfLinguaWorkspace.updateExportUIState();

    assert.strictEqual(elements.btnDownloadOriginalTxt.disabled, true);
    assert.strictEqual(elements.btnDownloadOriginalPdf.disabled, true);
    assert.strictEqual(elements.btnDownloadBilingualTxt.disabled, true);
    assert.strictEqual(elements.btnDownloadBilingualPdf.disabled, true);
    // Translated buttons should remain enabled
    assert.strictEqual(elements.btnDownloadTxt.disabled, false);
    assert.strictEqual(elements.btnDownloadPdf.disabled, false);
  });
});

runTest('9.3: When translated is null, empty string or whitespace, translated & bilingual buttons are disabled', () => {
  const emptyValues = [null, '', '   ', '\n\t  '];
  emptyValues.forEach(emptyVal => {
    const { context, elements } = createEnvironment();
    context.initWorkspace();
    context.pdfLinguaWorkspace.setCurrentDocData({
      filename: 'doc.pdf',
      original_text: 'Văn bản gốc hợp lệ',
      translated_text: emptyVal,
    });
    elements.paneOriginal.innerText = 'Văn bản gốc hợp lệ';
    elements.paneTranslated.innerText = emptyVal || '';
    context.pdfLinguaWorkspace.updateExportUIState();

    assert.strictEqual(elements.btnDownloadTxt.disabled, true);
    assert.strictEqual(elements.btnDownloadPdf.disabled, true);
    assert.strictEqual(elements.btnDownloadBilingualTxt.disabled, true);
    assert.strictEqual(elements.btnDownloadBilingualPdf.disabled, true);
    // Original buttons should remain enabled
    assert.strictEqual(elements.btnDownloadOriginalTxt.disabled, false);
    assert.strictEqual(elements.btnDownloadOriginalPdf.disabled, false);
  });
});

runTest('9.4: Live pane input event synchronizes button disabled states immediately', () => {
  const { context, elements } = createEnvironment();
  context.initWorkspace();
  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'doc.pdf',
    original_text: '',
    translated_text: 'Bản dịch có sẵn',
  });
  elements.paneOriginal.innerText = '';
  elements.paneTranslated.innerText = 'Bản dịch có sẵn';
  context.pdfLinguaWorkspace.updateExportUIState();

  assert.strictEqual(elements.btnDownloadOriginalTxt.disabled, true);
  assert.strictEqual(elements.btnDownloadBilingualTxt.disabled, true);

  // User types text into paneOriginal
  elements.paneOriginal.innerText = 'Người dùng vừa nhập văn bản!';
  elements.paneOriginal.trigger('input');

  assert.strictEqual(elements.btnDownloadOriginalTxt.disabled, false);
  assert.strictEqual(elements.btnDownloadBilingualTxt.disabled, false);

  // User clears paneOriginal with whitespace
  elements.paneOriginal.innerText = '   ';
  elements.paneOriginal.trigger('input');

  assert.strictEqual(elements.btnDownloadOriginalTxt.disabled, true);
  assert.strictEqual(elements.btnDownloadBilingualTxt.disabled, true);
});

runTest('9.5: triggerDownload rejects whitespace-only content across all 4 export types without calling fetch', async () => {
  const testCases = [
    { type: 'original', orig: '   ', trans: 'Hợp lệ', summ: 'Hợp lệ' },
    { type: 'translated', orig: 'Hợp lệ', trans: ' \t\n ', summ: 'Hợp lệ' },
    { type: 'summary', orig: 'Hợp lệ', trans: 'Hợp lệ', summ: '   ' },
    { type: 'bilingual', orig: '   ', trans: 'Hợp lệ', summ: 'Hợp lệ' },
    { type: 'bilingual', orig: 'Hợp lệ', trans: '   ', summ: 'Hợp lệ' },
  ];

  for (const tc of testCases) {
    const { context, elements, fetchCalls } = createEnvironment();
    context.pdfLinguaWorkspace.setCurrentDocData({
      filename: 'test.pdf',
      original_text: tc.orig,
      translated_text: tc.trans,
      summary_text: tc.summ,
    });
    elements.paneOriginal.innerText = tc.orig;
    elements.paneTranslated.innerText = tc.trans;

    let toastCalled = false;
    context.showToast = (msg, type) => {
      if (type === 'error') toastCalled = true;
    };

    await context.pdfLinguaWorkspace.triggerDownload('txt', tc.type);
    assert.strictEqual(fetchCalls.length, 0, `Fetch should not be called for ${tc.type} with whitespace content`);
    assert.strictEqual(toastCalled, true, `Error toast should be shown for ${tc.type} with whitespace content`);
  }
});

runTest('9.6: renderWorkspace synchronizes UI state and enables buttons according to data', () => {
  const { context, elements } = createEnvironment();
  context.initWorkspace();

  context.renderWorkspace({
    filename: 'rendered.pdf',
    page_count: 3,
    file_size_mb: 1.5,
    is_ocr_used: false,
    original_text: 'Rendered original',
    translated_text: 'Rendered translation',
  });

  assert.strictEqual(elements.btnDownloadTxt.disabled, false);
  assert.strictEqual(elements.btnDownloadPdf.disabled, false);
  assert.strictEqual(elements.btnDownloadOriginalTxt.disabled, false);
  assert.strictEqual(elements.btnDownloadOriginalPdf.disabled, false);
  assert.strictEqual(elements.btnDownloadBilingualTxt.disabled, false);
  assert.strictEqual(elements.btnDownloadBilingualPdf.disabled, false);
  // Summary should still be disabled since no summary exists
  assert.strictEqual(elements.btnDownloadSummaryTxt.disabled, true);
  assert.strictEqual(elements.btnDownloadSummaryPdf.disabled, true);
  assert.strictEqual(elements.summaryExportStatus.textContent, '(chưa có)');
});

runTest('9.7: Complete empty-result integration matrix (null, empty, whitespace) across all 4 export types confirms 0 API calls', async () => {
  const invalidVariants = [null, '', '   ', '\t\n '];
  const targetTypes = ['original', 'translated', 'summary', 'bilingual'];

  for (const expType of targetTypes) {
    for (const invalidVal of invalidVariants) {
      const { context, elements, fetchCalls } = createEnvironment();
      let origVal = 'Valid Original';
      let transVal = 'Valid Translation';
      let summVal = 'Valid Summary';

      if (expType === 'original') origVal = invalidVal;
      if (expType === 'translated') transVal = invalidVal;
      if (expType === 'summary') summVal = invalidVal;
      if (expType === 'bilingual') {
        origVal = invalidVal;
      }

      context.pdfLinguaWorkspace.setCurrentDocData({
        filename: 'matrix.pdf',
        original_text: origVal,
        translated_text: transVal,
        summary_text: summVal,
      });
      elements.paneOriginal.innerText = origVal || '';
      elements.paneTranslated.innerText = transVal || '';

      let toastShown = false;
      context.showToast = (_msg, type) => {
        if (type === 'error') toastShown = true;
      };

      await context.pdfLinguaWorkspace.triggerDownload('txt', expType);
      assert.strictEqual(fetchCalls.length, 0, `Fetch must NOT be called for ${expType} with invalid input ${JSON.stringify(invalidVal)}`);
      assert.strictEqual(toastShown, true, `Toast error must be shown for ${expType} with invalid input`);
    }
  }
});

// ==========================================
// Test Suite 10: Download Authorization & Error Responses (PDFL-157.3)
// ==========================================
console.log('\n[Suite 10] Download Authorization & Error Responses (PDFL-157.3)');

runTest('10.1: triggerDownload sends Bearer token from window.pdfLinguaAuth.getStoredToken()', async () => {
  const { context, elements, fetchCalls, clickedLinks } = createEnvironment();
  context.initWorkspace();

  context.window.pdfLinguaAuth = {
    getStoredToken: () => 'auth_token_from_helper_123',
    clearStoredSession: () => {},
    updateHeaderAuthState: () => {},
  };

  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'auth_test.pdf',
    original_text: 'Original content',
    translated_text: 'Translated content',
  });
  elements.paneOriginal.innerText = 'Original content';
  elements.paneTranslated.innerText = 'Translated content';

  await context.pdfLinguaWorkspace.triggerDownload('txt', 'translated');

  assert.strictEqual(fetchCalls.length, 1);
  assert.strictEqual(fetchCalls[0].options.headers['Authorization'], 'Bearer auth_token_from_helper_123');
  assert.strictEqual(clickedLinks.length, 1);
  assert.strictEqual(clickedLinks[0].download, 'auth_test_dich.txt');
});

runTest('10.2: triggerDownload falls back to localStorage/sessionStorage when helper is absent', async () => {
  const { context, elements, fetchCalls, clickedLinks } = createEnvironment();
  context.initWorkspace();

  delete context.window.pdfLinguaAuth;
  context.localStorage.setItem('pdfl_token', 'token_from_storage_456');

  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'storage_test.pdf',
    original_text: 'Original content',
    translated_text: 'Translated content',
  });
  elements.paneOriginal.innerText = 'Original content';
  elements.paneTranslated.innerText = 'Translated content';

  await context.pdfLinguaWorkspace.triggerDownload('pdf', 'original');

  assert.strictEqual(fetchCalls.length, 1);
  assert.strictEqual(fetchCalls[0].options.headers['Authorization'], 'Bearer token_from_storage_456');
  assert.strictEqual(clickedLinks.length, 1);
  assert.strictEqual(clickedLinks[0].download, 'storage_test_goc.pdf');
});

runTest('10.3: triggerDownload handles HTTP 401: Clears session and displays authentication error toast', async () => {
  const { context, elements, clickedLinks } = createEnvironment();
  context.initWorkspace();

  let sessionCleared = false;
  let headerAuthReset = false;
  context.window.pdfLinguaAuth = {
    getStoredToken: () => 'expired_token',
    clearStoredSession: () => { sessionCleared = true; },
    updateHeaderAuthState: (u) => { if (u === null) headerAuthReset = true; },
  };

  context.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Token đã hết hạn hoặc không hợp lệ.' }),
  });

  let toastMsg = '';
  let toastType = '';
  context.showToast = (msg, type) => {
    toastMsg = msg;
    toastType = type;
  };

  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'unauth.pdf',
    original_text: 'Original content',
    translated_text: 'Translated content',
  });
  elements.paneOriginal.innerText = 'Original content';
  elements.paneTranslated.innerText = 'Translated content';

  await context.pdfLinguaWorkspace.triggerDownload('txt', 'translated');

  assert.strictEqual(sessionCleared, true, 'Session must be cleared on 401');
  assert.strictEqual(headerAuthReset, true, 'Header auth must be reset to null on 401');
  assert.strictEqual(toastType, 'error');
  assert(toastMsg.includes('hết hạn') || toastMsg.includes('đăng nhập lại'));
  assert.strictEqual(clickedLinks.length, 0, 'No download link must be clicked on 401');
});

runTest('10.4: triggerDownload handles HTTP 401 with default message when response body is empty', async () => {
  const { context, elements, clickedLinks } = createEnvironment();
  context.initWorkspace();

  context.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({}),
  });

  let toastMsg = '';
  let toastType = '';
  context.showToast = (msg, type) => {
    toastMsg = msg;
    toastType = type;
  };

  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'unauth_empty.pdf',
    original_text: 'Original content',
    translated_text: 'Translated content',
  });
  elements.paneOriginal.innerText = 'Original content';
  elements.paneTranslated.innerText = 'Translated content';

  await context.pdfLinguaWorkspace.triggerDownload('txt', 'translated');

  assert.strictEqual(toastType, 'error');
  assert(toastMsg.includes('Phiên đăng nhập đã hết hạn hoặc cần đăng nhập lại'));
  assert.strictEqual(clickedLinks.length, 0);
});

runTest('10.5: triggerDownload handles HTTP 403: Displays forbidden toast without clearing session', async () => {
  const { context, elements, clickedLinks } = createEnvironment();
  context.initWorkspace();

  let sessionCleared = false;
  context.window.pdfLinguaAuth = {
    getStoredToken: () => 'valid_user_token',
    clearStoredSession: () => { sessionCleared = true; },
    updateHeaderAuthState: () => {},
  };

  context.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ detail: 'Tài khoản không có quyền truy cập.' }),
  });

  let toastMsg = '';
  let toastType = '';
  context.showToast = (msg, type) => {
    toastMsg = msg;
    toastType = type;
  };

  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'forbidden.pdf',
    original_text: 'Original content',
    translated_text: 'Translated content',
  });
  elements.paneOriginal.innerText = 'Original content';
  elements.paneTranslated.innerText = 'Translated content';

  await context.pdfLinguaWorkspace.triggerDownload('pdf', 'translated');

  assert.strictEqual(sessionCleared, false, 'Session must NOT be cleared on 403');
  assert.strictEqual(toastType, 'error');
  assert(toastMsg.includes('không có quyền truy cập'));
  assert.strictEqual(clickedLinks.length, 0);
});

runTest('10.6: triggerDownload handles other HTTP errors (e.g. 500): Displays server error toast', async () => {
  const { context, elements, clickedLinks } = createEnvironment();
  context.initWorkspace();

  context.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ detail: 'Lỗi máy chủ nội bộ khi tạo file PDF.' }),
  });

  let toastMsg = '';
  let toastType = '';
  context.showToast = (msg, type) => {
    toastMsg = msg;
    toastType = type;
  };

  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'server_err.pdf',
    original_text: 'Original content',
    translated_text: 'Translated content',
  });
  elements.paneOriginal.innerText = 'Original content';
  elements.paneTranslated.innerText = 'Translated content';

  await context.pdfLinguaWorkspace.triggerDownload('pdf', 'translated');

  assert.strictEqual(toastType, 'error');
  assert(toastMsg.includes('Lỗi máy chủ nội bộ') || toastMsg.includes('Lỗi khi tải tệp từ máy chủ'));
  assert.strictEqual(clickedLinks.length, 0);
});

runTest('10.7: All 4 export types with valid token successfully trigger download for TXT and PDF', async () => {
  const { context, elements, fetchCalls, clickedLinks } = createEnvironment();
  context.initWorkspace();

  context.window.pdfLinguaAuth = {
    getStoredToken: () => 'multi_target_auth_token',
    clearStoredSession: () => {},
    updateHeaderAuthState: () => {},
  };

  context.pdfLinguaWorkspace.setCurrentDocData({
    filename: 'full_export.pdf',
    original_text: 'Gốc toàn diện',
    translated_text: 'Dịch toàn diện',
    summary_text: 'Tóm tắt toàn diện',
  });
  elements.paneOriginal.innerText = 'Gốc toàn diện';
  elements.paneTranslated.innerText = 'Dịch toàn diện';
  elements.paneSummary.innerText = 'Tóm tắt toàn diện';

  const types = [
    { type: 'original', format: 'txt', suffix: '_goc.txt' },
    { type: 'original', format: 'pdf', suffix: '_goc.pdf' },
    { type: 'translated', format: 'txt', suffix: '_dich.txt' },
    { type: 'translated', format: 'pdf', suffix: '_dich.pdf' },
    { type: 'summary', format: 'txt', suffix: '_tomtat.txt' },
    { type: 'summary', format: 'pdf', suffix: '_tomtat.pdf' },
    { type: 'bilingual', format: 'txt', suffix: '_songngu.txt' },
    { type: 'bilingual', format: 'pdf', suffix: '_songngu.pdf' },
  ];

  for (let i = 0; i < types.length; i++) {
    const item = types[i];
    await context.pdfLinguaWorkspace.triggerDownload(item.format, item.type);
    assert.strictEqual(fetchCalls[i].options.headers['Authorization'], 'Bearer multi_target_auth_token');
    assert.strictEqual(clickedLinks[i].download, `full_export${item.suffix}`);
  }

  assert.strictEqual(fetchCalls.length, 8);
  assert.strictEqual(clickedLinks.length, 8);
});


console.log(`\n======================================================`);
console.log(`KẾT QUẢ KIỂM THỬ FRONTEND EXPORT: ${passedTests}/${totalTests} tests passed`);
console.log(`======================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
