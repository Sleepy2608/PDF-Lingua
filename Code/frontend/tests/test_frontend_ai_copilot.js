/**
 * PDF-Lingua - Frontend AI Copilot Chat Test Suite (PDFL-51, PDFL-142, PDFL-143, PDFL-144, PDFL-145)
 * --------------------------------------------------------------------------------------------------
 * Validates:
 * 1. Static HTML DOM elements:
 *    - #btnAiCopilot, #aiCopilotDrawer, #aiCopilotBackdrop, #btnCloseCopilotDrawer
 *    - #btnClearCopilotChat, #copilotQuotaBadge, #copilotQuickPrompts
 *    - #copilotMessagesContainer, #copilotMessagesList, #copilotTypingIndicator
 *    - #copilotChatForm, #copilotInput, #btnSendCopilot
 * 2. Safe Markdown rendering and XSS protection.
 * 3. Pro VIP authorization gate (guest/free rejected with modal, pro/admin allowed).
 * 4. Message rendering (user bubble, assistant bubble, source grounding tag).
 * 5. Typing indicator toggling during AI processing.
 * 6. Network/service failure error bubble with retry action.
 * 7. Daily quota counter badge update and quota exhaustion handling.
 * 8. Chat history reset / clearing.
 * 9. Quick prompt suggestion chip dispatch.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const aiCopilotSource = fs.readFileSync(path.resolve(__dirname, '../js/ai_copilot.js'), 'utf8');
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
    this.scrollHeight = 300;
    this.scrollTop = 0;
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }

  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  dispatchEvent(event) {
    const type = typeof event === 'string' ? event : event.type;
    const handlers = this.listeners[type] || [];
    handlers.forEach(h => h.call(this, event));
  }

  click() {
    if (this.disabled) return;
    this.dispatchEvent({ type: 'click', preventDefault: () => {} });
  }

  focus() { this.focused = true; }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      const targetId = selector.substring(1);
      if (this.id === targetId) return this;
      for (const c of this.children) {
        if (c.id === targetId) return c;
        if (c.querySelector) {
          const found = c.querySelector(selector);
          if (found) return found;
        }
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const res = [];
    if (selector.startsWith('.')) {
      const cls = selector.substring(1);
      if (this.classList.contains(cls)) res.push(this);
      for (const c of this.children) {
        if (c.classList && c.classList.contains(cls)) res.push(c);
      }
    }
    return res;
  }
}

function createMockEnvironment(userRole = 'free', token = null) {
  const elements = {};

  function getOrCreate(id, tag = 'div') {
    if (!elements[id]) {
      elements[id] = new MockElement(id, tag);
    }
    return elements[id];
  }

  // Pre-seed known elements
  const ids = [
    'btnAiCopilot', 'aiCopilotDrawer', 'aiCopilotBackdrop', 'btnCloseCopilotDrawer',
    'btnClearCopilotChat', 'copilotQuotaBadge', 'copilotQuickPrompts',
    'copilotMessagesContainer', 'copilotMessagesList', 'copilotWelcomeMsg',
    'copilotTypingIndicator', 'copilotChatForm', 'copilotInput', 'btnSendCopilot',
    'aiProModal', 'btnDismissAiProModal', 'editorTranslated', 'editorOriginal',
  ];

  ids.forEach(id => getOrCreate(id));
  elements['aiCopilotDrawer'].style.display = 'none';
  elements['aiProModal'].style.display = 'none';

  // Pre-seed suggestion chips inside copilotQuickPrompts
  const quickPrompts = getOrCreate('copilotQuickPrompts');
  const chip1 = new MockElement('', 'button');
  chip1.classList.add('copilot-prompt-chip');
  chip1.setAttribute('data-prompt', 'Tom tat 3 y chinh cua tai lieu?');
  chip1.textContent = 'Tom tat 3 y chinh';

  const chip2 = new MockElement('', 'button');
  chip2.classList.add('copilot-prompt-chip');
  chip2.setAttribute('data-prompt', 'Cac so lieu quan trong?');
  chip2.textContent = 'So lieu quan trong';

  quickPrompts.children.push(chip1, chip2);

  const mockStorage = {
    pdfl_token: token,
    pdfl_user: userRole ? JSON.stringify({ id: 10, email: `${userRole}@example.com`, role: userRole }) : null,
  };

  const toastsEmitted = [];

  const context = {
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    localStorage: {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = String(v); },
      removeItem: (k) => { delete mockStorage[k]; },
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    document: {
      readyState: 'complete',
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => {
        if (sel.startsWith('#')) return elements[sel.substring(1)] || null;
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel === '.copilot-prompt-chip') return [chip1, chip2];
        return [];
      },
      createElement: (tag) => new MockElement('', tag),
      addEventListener: () => {},
    },
    window: {
      location: { href: 'http://localhost/' },
      showToast: (msg, type) => { toastsEmitted.push({ msg, type }); },
      workspaceState: {
        currentDocumentId: 42,
        currentDocumentText: 'Day la noi dung tai lieu thu nghiem.',
      },
    },
    fetch: null, // to be mocked in tests
    setTimeout: (fn) => fn(),
    Event: function (type) { this.type = type; },
  };

  context.window.document = context.document;
  context.window.localStorage = context.localStorage;

  vm.createContext(context);
  vm.runInContext(aiCopilotSource, context);

  // Hook spy toast directly
  context.window.showToast = (msg, type) => { toastsEmitted.push({ msg, type }); };

  return { context, elements, toastsEmitted, chip1, chip2 };
}

console.log('[Test Suite] Starting Frontend AI Copilot Tests...\n');

let totalTests = 0;
let passedTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`  PASS: ${description}`);
  } catch (err) {
    console.error(`  FAIL: ${description}`);
    console.error(`    ${err.message}`);
  }
}

// 1. Static HTML Structural Verification
runTest('HTML contains #btnAiCopilot with PRO badge', () => {
  assert(htmlSource.includes('id="btnAiCopilot"'), 'Missing #btnAiCopilot in index.html');
  assert(htmlSource.includes('Hỏi đáp AI'), 'Missing button label Hoi dap AI');
});

runTest('HTML contains #aiCopilotDrawer and backdrop overlay', () => {
  assert(htmlSource.includes('id="aiCopilotDrawer"'), 'Missing #aiCopilotDrawer');
  assert(htmlSource.includes('id="aiCopilotBackdrop"'), 'Missing #aiCopilotBackdrop');
});

runTest('HTML contains chat drawer controls (close, clear history, quota badge)', () => {
  assert(htmlSource.includes('id="btnCloseCopilotDrawer"'), 'Missing close button');
  assert(htmlSource.includes('id="btnClearCopilotChat"'), 'Missing clear history button');
  assert(htmlSource.includes('id="copilotQuotaBadge"'), 'Missing quota badge');
});

runTest('HTML contains messages list and typing indicator with 3 dots', () => {
  assert(htmlSource.includes('id="copilotMessagesList"'), 'Missing messages list');
  assert(htmlSource.includes('id="copilotTypingIndicator"'), 'Missing typing indicator');
  assert(htmlSource.includes('class="typing-dot"'), 'Missing typing dots');
});

runTest('HTML contains chat input form, textarea, and send button', () => {
  assert(htmlSource.includes('id="copilotChatForm"'), 'Missing #copilotChatForm');
  assert(htmlSource.includes('id="copilotInput"'), 'Missing #copilotInput');
  assert(htmlSource.includes('id="btnSendCopilot"'), 'Missing #btnSendCopilot');
});

// 2. Safe Markdown Rendering & XSS Sanitization
runTest('Markdown renderer sanitizes HTML tags and XSS attacks', () => {
  const { context } = createMockEnvironment();
  const dangerous = '<script>alert("xss")</script><b>Bold Tag</b>';
  const rendered = context.window.pdfLinguaCopilot.renderMarkdown(dangerous);
  assert(!rendered.includes('<script>'), 'Failed to escape script tag');
  assert(rendered.includes('&lt;script&gt;'), 'Expected escaped script entity');
});

runTest('Markdown renderer formats headings, bold, and list items', () => {
  const { context } = createMockEnvironment();
  const raw = '# Tieu de lon\n## Tieu de phu\n- Muc 1\n- Muc 2\n**In dam**';
  const rendered = context.window.pdfLinguaCopilot.renderMarkdown(raw);
  assert(rendered.includes('<h2>Tieu de lon</h2>'), 'Missing h2');
  assert(rendered.includes('<h3>Tieu de phu</h3>'), 'Missing h3');
  assert(rendered.includes('<ul>'), 'Missing ul');
  assert(rendered.includes('<li>Muc 1</li>'), 'Missing li');
  assert(rendered.includes('<strong>In dam</strong>'), 'Missing strong');
});

// 3. Pro VIP Gate Verification
runTest('Guest user clicking #btnAiCopilot triggers Pro modal and does not open drawer', () => {
  const { elements } = createMockEnvironment(null, null);
  elements.btnAiCopilot.click();
  assert.strictEqual(elements.aiCopilotDrawer.style.display, 'none');
  assert.strictEqual(elements.aiProModal.style.display, 'flex');
});

runTest('Free user clicking #btnAiCopilot triggers Pro modal and does not open drawer', () => {
  const { elements } = createMockEnvironment('free', 'valid_token');
  elements.btnAiCopilot.click();
  assert.strictEqual(elements.aiCopilotDrawer.style.display, 'none');
  assert.strictEqual(elements.aiProModal.style.display, 'flex');
});

runTest('Pro VIP user clicking #btnAiCopilot opens the sliding drawer', () => {
  const { elements } = createMockEnvironment('pro', 'valid_pro_jwt');
  elements.btnAiCopilot.click();
  assert.strictEqual(elements.aiCopilotDrawer.style.display, 'flex');
  assert(elements.aiCopilotDrawer.classList.contains('open'));
});

// 4. Message Dispatch and Typing Indicator
runTest('Sending query appends user message and displays typing indicator', async () => {
  const { context, elements } = createMockEnvironment('pro', 'valid_pro_jwt');
  let fetchCalled = false;

  context.fetch = async () => {
    fetchCalled = true;
    // Check that typing indicator is shown during fetch
    assert.strictEqual(elements.copilotTypingIndicator.style.display, 'flex');
    return {
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        data: {
          answer: 'Cau tra loi tu AI Copilot ve tai lieu.',
          relevant_chunks: ['Doan 1: Thong tin trich xuat.'],
          daily_questions_remaining: 13,
        },
      }),
    };
  };

  await context.window.pdfLinguaCopilot.sendQuery('Cau hoi ve han ngach');
  assert(fetchCalled, 'fetch was not called');
  // After fetch completes, typing indicator must be hidden
  assert.strictEqual(elements.copilotTypingIndicator.style.display, 'none');
  // Check message list received children
  assert(elements.copilotMessagesList.children.length >= 2, 'Expected user and assistant messages');
});

// 5. Daily Quota Updates
runTest('Successful response updates #copilotQuotaBadge', async () => {
  const { context, elements } = createMockEnvironment('pro', 'valid_pro_jwt');

  context.fetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({
      success: true,
      data: {
        answer: 'Tra loi hop le.',
        daily_questions_remaining: 8,
      },
    }),
  });

  await context.window.pdfLinguaCopilot.sendQuery('Kiem tra han ngach con lai');
  assert.strictEqual(elements.copilotQuotaBadge.textContent, '8/15 cau hoi');
});

runTest('Quota exceeded response displays friendly error notice', async () => {
  const { context, elements, toastsEmitted } = createMockEnvironment('pro', 'valid_pro_jwt');

  context.fetch = async () => ({
    status: 403,
    ok: false,
    json: async () => ({
      success: false,
      error_code: 'DAILY_QUOTA_EXCEEDED',
      message: 'Ban da su dung het 15 cau hoi/ngay cho goi Pro.',
    }),
  });

  await context.window.pdfLinguaCopilot.sendQuery('Cau hoi vuot han ngach');
  assert(toastsEmitted.some(t => t.type === 'warning'), 'Expected warning toast for quota exceeded');
  const lastChild = elements.copilotMessagesList.children[elements.copilotMessagesList.children.length - 1];
  assert(lastChild.innerHTML.includes('han ngach 15 cau hoi/ngay'), 'Expected quota message in chat');
});

// 6. Network Error & Retry
runTest('Network exception renders error bubble with retry action', async () => {
  const { context, elements } = createMockEnvironment('pro', 'valid_pro_jwt');

  context.fetch = async () => {
    throw new Error('Connection refused');
  };

  await context.window.pdfLinguaCopilot.sendQuery('Cau hoi bi rot mang');
  const lastChild = elements.copilotMessagesList.children[elements.copilotMessagesList.children.length - 1];
  assert(lastChild.innerHTML.includes('copilot-msg-error'), 'Expected error bubble');
  assert(lastChild.innerHTML.includes('btn-copilot-retry'), 'Expected retry button');
  assert.strictEqual(context.window.pdfLinguaCopilot.state.lastFailedQuery, 'Cau hoi bi rot mang');
});

// 7. Clear Chat History
runTest('Clear chat button resets message list and conversation history', () => {
  const { context, elements, toastsEmitted } = createMockEnvironment('pro', 'valid_pro_jwt');

  // Push some mock state
  context.window.pdfLinguaCopilot.state.conversationHistory.push({ role: 'user', content: 'hello' });
  elements.btnClearCopilotChat.click();

  assert.strictEqual(context.window.pdfLinguaCopilot.state.conversationHistory.length, 0);
  assert(elements.copilotMessagesList.innerHTML.includes('Lich su tro chuyen da duoc lam moi'));
  assert(toastsEmitted.some(t => t.msg.includes('Da xoa lich su')), 'Missing clear toast');
});

// 8. Quick Suggestion Prompt Chips
runTest('Clicking a quick suggestion chip triggers query send', async () => {
  const { context, chip1 } = createMockEnvironment('pro', 'valid_pro_jwt');
  let sentPrompt = null;

  context.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    sentPrompt = body.query;
    return {
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        data: { answer: 'Day la 3 y chinh.', daily_questions_remaining: 12 },
      }),
    };
  };

  chip1.click();
  assert.strictEqual(sentPrompt, 'Tom tat 3 y chinh cua tai lieu?');
});

console.log(`\nFrontend AI Copilot Tests Completed: ${passedTests}/${totalTests} Passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
