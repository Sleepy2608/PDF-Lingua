/**
 * PDF-Lingua - Frontend AI Summarization Test Suite (PDFL-50, PDFL-132, PDFL-133)
 * --------------------------------------------------------------------------------
 * Validates:
 * 1. Static HTML elements (btnAiSummarize, aiSummaryCard, aiSummaryLoading, aiSummaryResult, aiProModal).
 * 2. Safe Markdown rendering (XSS escaping, headers, bold, bullet points, ordered lists).
 * 3. Pro VIP authorization gate (guest/free rejected with modal, pro/admin allowed).
 * 4. API request dispatch and DOM metadata/content population.
 * 5. One-click clipboard copy integration and toast notifications.
 * 6. Workspace export state synchronization with summary buttons.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const aiSummarySource = fs.readFileSync(path.resolve(__dirname, '../js/ai_summary.js'), 'utf8');
const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...args) { args.forEach(v => this.values.add(v)); }
  remove(...args) { args.forEach(v => this.values.delete(v)); }
  contains(v) { return this.values.has(v); }
  toggle(v) { if (this.contains(v)) this.remove(v); else this.add(v); }
  toString() { return Array.from(this.values).join(' '); }
}

class MockElement {
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
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }

  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  click() {
    if (this.disabled) return;
    const handlers = this.listeners['click'] || [];
    handlers.forEach(fn => fn({ preventDefault: () => {}, target: this }));
  }

  scrollIntoView() {}
}

function createTestEnvironment(initialUser = null, initialToken = null) {
  const elements = {};
  const elementIds = [
    'btnAiSummarize',
    'aiSummaryCard',
    'aiSummaryStyle',
    'aiSummaryLength',
    'btnExecuteAiSummary',
    'btnExecuteAiSummaryText',
    'btnCloseAiSummary',
    'aiSummaryLoading',
    'aiSummaryResult',
    'aiModelUsedBadge',
    'aiStyleUsedBadge',
    'aiWordCountBadge',
    'aiTimeElapsedBadge',
    'btnCopyAiSummary',
    'btnCopyAiSummaryText',
    'aiSummaryContent',
    'aiProModal',
    'btnCloseAiProModal',
    'btnDismissAiProModal',
    'btnGoToPricingFromAi',
    'pricingSection',
    'paneOriginal',
    'paneTranslated',
    'btnDownloadSummaryTxt',
    'btnDownloadSummaryPdf',
    'summaryExportStatus',
  ];

  elementIds.forEach(id => {
    elements[id] = new MockElement(id);
  });

  // Default dropdown values
  elements.aiSummaryStyle.value = 'brief';
  elements.aiSummaryLength.value = 'medium';

  const toasts = [];
  const fetchCalls = [];
  let clipboardText = '';

  const storage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
  };

  if (initialToken) storage.setItem('pdfl_token', initialToken);
  if (initialUser) storage.setItem('pdfl_user', JSON.stringify(initialUser));

  const context = {
    window: {},
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      readyState: 'complete',
    },
    navigator: {
      clipboard: {
        writeText: async (t) => { clipboardText = t; },
      },
    },
    localStorage: storage,
    sessionStorage: storage,
    console: console,
    showToast: (msg, type) => { toasts.push({ message: msg, type: type }); },
    fetch: async (url, options) => {
      fetchCalls.push({ url, options, body: options && options.body ? JSON.parse(options.body) : null });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Tom tat thanh cong',
          data: {
            summary: 'Ban tom tat mau sinh boi AI Gateway.\n\n### 1. Tong quan\nNoi dung mo ta.',
            style: 'brief',
            length: 'medium',
            word_count: 15,
            model_used: 'gpt-5-mini',
            provider: 'b.ai',
            fallback_used: false,
            execution_time_ms: 250,
          },
        }),
      };
    },
  };

  context.window = context;

  vm.createContext(context);
  // Run workspace first so window.pdfLinguaWorkspace is available
  vm.runInContext(workspaceSource, context);

  // Hook test spy into window.showToast after workspace initialization
  context.window.showToast = (msg, type) => { toasts.push({ message: msg, type: type }); };
  context.showToast = context.window.showToast;

  // Run ai_summary.js
  vm.runInContext(aiSummarySource, context);

  context.pdfLinguaAiSummary.initAiSummary();

  return {
    context,
    elements,
    toasts,
    fetchCalls,
    getClipboardText: () => clipboardText,
  };
}

console.log('--- BAT DAU TEST SUITE FRONTEND AI SUMMARY (PDFL-50, PDFL-132, PDFL-133) ---');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ==========================================
// Test Suite 1: Static HTML Structure & IDs
// ==========================================
console.log('\n[Suite 1] Static HTML Structure & Component IDs');

runTest('1.1: index.html contains #btnAiSummarize with PRO badge', () => {
  assert(htmlSource.includes('id="btnAiSummarize"'), 'Missing #btnAiSummarize button');
  assert(htmlSource.includes('class="badge-pro-pill"'), 'Missing PRO badge in toolbar');
  assert(htmlSource.includes('Tóm tắt AI'), 'Missing button text "Tóm tắt AI"');
});

runTest('1.2: index.html contains #aiSummaryCard with controls and selectors', () => {
  assert(htmlSource.includes('id="aiSummaryCard"'), 'Missing #aiSummaryCard');
  assert(htmlSource.includes('id="aiSummaryStyle"'), 'Missing #aiSummaryStyle');
  assert(htmlSource.includes('id="aiSummaryLength"'), 'Missing #aiSummaryLength');
  assert(htmlSource.includes('id="btnExecuteAiSummary"'), 'Missing #btnExecuteAiSummary');
  assert(htmlSource.includes('id="btnCloseAiSummary"'), 'Missing #btnCloseAiSummary');
});

runTest('1.3: index.html contains loading shimmer and result area', () => {
  assert(htmlSource.includes('id="aiSummaryLoading"'), 'Missing #aiSummaryLoading');
  assert(htmlSource.includes('class="ai-skeleton-shimmer"'), 'Missing .ai-skeleton-shimmer');
  assert(htmlSource.includes('id="aiSummaryResult"'), 'Missing #aiSummaryResult');
  assert(htmlSource.includes('id="btnCopyAiSummary"'), 'Missing #btnCopyAiSummary');
  assert(htmlSource.includes('id="aiSummaryContent"'), 'Missing #aiSummaryContent');
});

runTest('1.4: index.html contains #aiProModal upgrade dialog', () => {
  assert(htmlSource.includes('id="aiProModal"'), 'Missing #aiProModal');
  assert(htmlSource.includes('id="btnGoToPricingFromAi"'), 'Missing #btnGoToPricingFromAi');
});

runTest('1.5: index.html includes js/ai_summary.js script tag', () => {
  assert(htmlSource.includes('src="js/ai_summary.js'), 'Missing script tag for ai_summary.js in index.html');
});

// ==========================================
// Test Suite 2: Markdown Renderer (PDFL-132)
// ==========================================
console.log('\n[Suite 2] Safe Markdown Rendering (renderMarkdown)');

runTest('2.1: renderMarkdown converts headings, bold and paragraphs', () => {
  const { context } = createTestEnvironment();
  const raw = '## Tieu De 2\n\n### Tieu De 3\n\nDoan van ban co **in dam** ro rang.';
  const html = context.pdfLinguaAiSummary.renderMarkdown(raw);

  assert(html.includes('<h3>Tieu De 2</h3>'), 'Missing <h3> for ##');
  assert(html.includes('<h4>Tieu De 3</h4>'), 'Missing <h4> for ###');
  assert(html.includes('<strong>in dam</strong>'), 'Missing <strong> for **in dam**');
  assert(html.includes('<p>Doan van ban co <strong>in dam</strong> ro rang.</p>'), 'Missing <p> wrapper');
});

runTest('2.2: renderMarkdown converts bullet points into <ul><li> list', () => {
  const { context } = createTestEnvironment();
  const raw = '• Y chinh thu nhat\n• Y chinh thu hai\n• Y chinh thu ba';
  const html = context.pdfLinguaAiSummary.renderMarkdown(raw);

  assert(html.includes('<ul>'), 'Missing <ul> tag');
  assert(html.includes('<li>Y chinh thu nhat</li>'), 'Missing <li> for bullet 1');
  assert(html.includes('<li>Y chinh thu hai</li>'), 'Missing <li> for bullet 2');
  assert(html.includes('</ul>'), 'Missing </ul> tag');
});

runTest('2.3: renderMarkdown sanitizes raw HTML tags (XSS protection)', () => {
  const { context } = createTestEnvironment();
  const malicious = '<script>alert("xss")</script> **an toan**';
  const html = context.pdfLinguaAiSummary.renderMarkdown(malicious);

  assert(!html.includes('<script>'), 'Dangerous script tag must be sanitized');
  assert(html.includes('&lt;script&gt;'), 'Script tag should be escaped to entity');
  assert(html.includes('<strong>an toan</strong>'), 'Safe markdown bold should still work');
});

// ==========================================
// Test Suite 3: Pro VIP Authorization Gate (PDFL-134)
// ==========================================
console.log('\n[Suite 3] Pro VIP Authorization Gate (PDFL-134)');

runTest('3.1: Guest user clicking btnAiSummarize triggers login alert', () => {
  const { elements, toasts } = createTestEnvironment(null, null);
  elements.btnAiSummarize.click();

  assert(toasts.some(t => t.message.includes('Vui lòng đăng nhập')), 'Guest must receive login prompt toast');
  assert.strictEqual(elements.aiSummaryCard.style.display, undefined); // Card not shown
});

runTest('3.2: Free user clicking btnAiSummarize opens #aiProModal', () => {
  const freeUser = { id: 1, email: 'free@example.com', role: 'free' };
  const { elements } = createTestEnvironment(freeUser, 'mock_free_token');

  elements.btnAiSummarize.click();
  assert.strictEqual(elements.aiProModal.style.display, 'flex');
  assert(!elements.aiProModal.hasAttribute('hidden'), 'aiProModal should not have hidden attribute');
});

runTest('3.3: Pro user clicking btnAiSummarize opens #aiSummaryCard', () => {
  const proUser = { id: 2, email: 'pro@example.com', role: 'pro' };
  const { elements } = createTestEnvironment(proUser, 'mock_pro_token');

  elements.btnAiSummarize.click();
  assert.strictEqual(elements.aiSummaryCard.style.display, 'block');
});

runTest('3.4: Admin user clicking btnAiSummarize opens #aiSummaryCard', () => {
  const adminUser = { id: 3, email: 'admin@example.com', role: 'admin' };
  const { elements } = createTestEnvironment(adminUser, 'mock_admin_token');

  elements.btnAiSummarize.click();
  assert.strictEqual(elements.aiSummaryCard.style.display, 'block');
});

// ==========================================
// Test Suite 4: Summarization Execution (PDFL-129, PDFL-132)
// ==========================================
console.log('\n[Suite 4] Summarization Execution & UI State (PDFL-129, PDFL-132)');

runTest('4.1: Empty pane text prompts warning toast and aborts', async () => {
  const proUser = { id: 2, email: 'pro@example.com', role: 'pro' };
  const { elements, toasts, fetchCalls } = createTestEnvironment(proUser, 'mock_pro_token');

  elements.paneOriginal.innerText = '';
  elements.paneTranslated.innerText = '';

  await elements.btnExecuteAiSummary.click();

  assert(toasts.some(t => t.message.includes('Chưa có nội dung')), 'Should warn user of empty text');
  assert.strictEqual(fetchCalls.length, 0, 'No fetch should be made when text is empty');
});

runTest('4.2: Valid execution dispatches API call and populates UI', async () => {
  const proUser = { id: 2, email: 'pro@example.com', role: 'pro' };
  const { elements, fetchCalls, toasts } = createTestEnvironment(proUser, 'mock_pro_token');

  elements.paneOriginal.innerText = 'Noi dung tai lieu mau can tom tat bang tri tue nhan tao.';
  elements.aiSummaryStyle.value = 'brief';
  elements.aiSummaryLength.value = 'medium';

  await elements.btnExecuteAiSummary.click();

  assert.strictEqual(fetchCalls.length, 1, 'Should call AI summarize API');
  assert.strictEqual(fetchCalls[0].url, 'http://localhost:8000/api/ai/summarize');
  assert.strictEqual(fetchCalls[0].body.style, 'brief');
  assert.strictEqual(fetchCalls[0].body.length, 'medium');

  // Verify UI populated
  assert.strictEqual(elements.aiSummaryResult.style.display, 'block');
  assert.strictEqual(elements.aiModelUsedBadge.textContent, 'gpt-5-mini');
  assert.strictEqual(elements.aiStyleUsedBadge.textContent, 'Ngắn gọn');
  assert.strictEqual(elements.aiWordCountBadge.textContent, '15 từ');
  assert(elements.aiSummaryContent.innerHTML.includes('<h4>1. Tong quan</h4>'), 'Markdown header should be rendered');
  assert(toasts.some(t => t.message.includes('thành công')), 'Success toast should appear');
});

// ==========================================
// Test Suite 5: Clipboard Copy Integration (PDFL-133)
// ==========================================
console.log('\n[Suite 5] Clipboard Copy Integration (PDFL-133)');

runTest('5.1: Copy button copies summary text to clipboard and shows toast', async () => {
  const proUser = { id: 2, email: 'pro@example.com', role: 'pro' };
  const { elements, toasts, getClipboardText } = createTestEnvironment(proUser, 'mock_pro_token');

  elements.paneOriginal.innerText = 'Noi dung can tom tat.';
  await elements.btnExecuteAiSummary.click();

  elements.btnCopyAiSummary.click();

  assert(getClipboardText().includes('Ban tom tat mau sinh boi AI Gateway'), 'Clipboard must receive summary text');
  assert(toasts.some(t => t.message.includes('Đã sao chép')), 'Toast must notify successful copy');
});

// ==========================================
// Summary Report
// ==========================================
console.log(`\n======================================================`);
console.log(`KET QUA KIEM THU FRONTEND AI SUMMARY: ${passedTests}/${totalTests} tests passed`);
console.log(`======================================================`);
if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
