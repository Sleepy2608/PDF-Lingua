/**
 * PDF-Lingua — Frontend Role-Based PDF Limits & Auth Token Test Suite (PDFL-81.4)
 * -------------------------------------------------------------------------------
 * Verifies:
 * 1. Role Limits determination: Guest/Free (20MB, 100 OCR pages), Pro/Admin (100MB, 500 OCR pages), fallback for invalid roles.
 * 2. Client-side upload validation adheres to the active role limit.
 * 3. Dynamic UI banner updates on dropzone; session logout resets limits and cancels oversized selected files.
 * 4. Correct transmission of Bearer token on process endpoints (upload-and-translate, retranslate, download)
 *    and no empty/null token headers for Guests.
 * 5. Robust error handling for HTTP 401 (invalid/expired token clears session without silent retry) and HTTP 413 (limit exceeded).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const uploadSource = fs.readFileSync(path.resolve(__dirname, '../js/upload.js'), 'utf8');
const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');
const authSource = fs.readFileSync(path.resolve(__dirname, '../js/auth.js'), 'utf8');

class ClassList {
  constructor() { this.values = new Set(); }
  add(v) { this.values.add(v); }
  remove(v) { this.values.delete(v); }
  contains(v) { return this.values.has(v); }
  toggle(v) { if (this.contains(v)) this.remove(v); else this.add(v); }
}

class Element {
  constructor(id) {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.innerText = '';
    this.classList = new ClassList();
    this.style = {};
    this.disabled = false;
    this.attributes = {};
    this.listeners = {};
    this.files = [];
  }
  focus() {}
  reset() { this.value = ''; }
  click() { this.trigger('click', { stopPropagation: () => {} }); }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  addEventListener(event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }
  trigger(event, data = {}) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((fn) => fn(data));
    }
  }
  appendChild(child) {
    this.children = this.children || [];
    this.children.push(child);
    if (child.innerHTML) {
      this.innerHTML += child.innerHTML;
    } else if (child.textContent) {
      this.innerHTML += child.textContent;
    }
  }
  remove() {}
}

class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

function createTestEnvironment() {
  const ids = [
    'dropzoneCard', 'pdfFileInput', 'btnSelectPdf', 'dropzonePrompt', 'dropzoneSelected',
    'previewFileName', 'previewFileSize', 'btnRemoveFile', 'dropzoneLimitText',
    'btnProcessPdf', 'btnRetranslate', 'targetLangSelect', 'btnCopyOriginal', 'btnCopyTranslated',
    'btnDownloadMenu', 'downloadDropdown', 'btnDownloadTxt', 'btnDownloadPdf', 'btnNewFile',
    'paneOriginal', 'paneTranslated', 'heroSection', 'workspaceSection', 'processingModal',
    'progressBarFill', 'progressDesc', 'toastContainer', 'authGuestGroup', 'authUserGroup',
    'userDisplayName', 'userAvatar', 'btnLogout', 'loginModal', 'registerModal', 'accountModal',
  ];

  const elements = Object.fromEntries(ids.map((id) => [id, new Element(id)]));
  const localStorage = new MockLocalStorage();
  const eventListeners = {};

  const document = {
    getElementById: (id) => elements[id] || null,
    querySelector: (selector) => {
      if (selector === '.dropzone-limit') return elements['dropzoneLimitText'];
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: (event, fn) => {
      eventListeners[event] = eventListeners[event] || [];
      eventListeners[event].push(fn);
    },
    dispatchEvent: (event) => {
      const type = event.type || event;
      if (eventListeners[type]) {
        eventListeners[type].forEach(fn => fn(event));
      }
    },
    body: {
      style: {},
      appendChild: () => {},
      removeChild: () => {},
    },
    createElement: (tag) => {
      const el = new Element(tag);
      return el;
    },
    createTextNode: (v) => v,
  };

  const windowListeners = {};
  const windowObj = {
    location: { protocol: 'http:', port: '8000', hostname: 'localhost' },
    document,
    localStorage,
    addEventListener: (event, fn) => {
      windowListeners[event] = windowListeners[event] || [];
      windowListeners[event].push(fn);
    },
    dispatchEvent: (event) => {
      const type = event.type || event;
      if (windowListeners[type]) {
        windowListeners[type].forEach(fn => fn(event));
      }
      document.dispatchEvent(event);
    },
    URL: {
      createObjectURL: () => 'blob:mock-url',
      revokeObjectURL: () => {},
    },
    scrollTo: () => {},
  };

  const context = vm.createContext({
    window: windowObj,
    document,
    localStorage,
    console,
    setTimeout: (fn, ms) => {
      if (typeof fn === 'function') fn();
      return 1;
    },
    clearTimeout: () => {},
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ data: null }) }),
    FormData: class MockFormData {
      constructor() { this.entries = {}; }
      append(k, v) { this.entries[k] = v; }
    },
    alert: (msg) => { context.lastAlert = msg; },
    CustomEvent: class MockCustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail || {};
      }
    },
  });

  // Run scripts in order
  try {
    vm.runInContext(uploadSource, context);
  } catch (e) {
    console.error('UPLOAD RUN ERROR:', e);
  }
  try {
    vm.runInContext(authSource, context);
  } catch (e) {
    console.error('AUTH RUN ERROR:', e);
  }
  try {
    vm.runInContext(workspaceSource, context);
  } catch (e) {
    console.error('WORKSPACE RUN ERROR:', e);
  }

  return {
    elements,
    storage: localStorage,
    context,
    window: windowObj,
    document,
    fireDomReady: () => {
      if (eventListeners['DOMContentLoaded']) {
        eventListeners['DOMContentLoaded'].forEach(fn => fn());
      }
    },
  };
}

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err);
    throw err;
  }
}

(async () => {
  console.log('================================================================');
  console.log('PDF-Lingua Frontend Role Limits & Token Test Suite (PDFL-81.4)');
  console.log('================================================================\n');

  await test('Limits Resolution: Guest (no user) defaults to 20MB & 100 OCR pages', () => {
    const env = createTestEnvironment();
    const limits = env.context.window.pdfLinguaUpload.getCurrentUserLimits();
    assert.strictEqual(limits.role, 'guest');
    assert.strictEqual(limits.maxFileSizeMb, 20);
    assert.strictEqual(limits.maxFileSizeBytes, 20 * 1024 * 1024);
    assert.strictEqual(limits.maxOcrPages, 100);
  });

  await test('Limits Resolution: Free user gets 20MB & 100 OCR pages', () => {
    const env = createTestEnvironment();
    const limits = env.context.window.pdfLinguaUpload.getCurrentUserLimits({ role: 'free' });
    assert.strictEqual(limits.role, 'free');
    assert.strictEqual(limits.maxFileSizeMb, 20);
    assert.strictEqual(limits.maxOcrPages, 100);
  });

  await test('Limits Resolution: Pro user gets 100MB & 500 OCR pages', () => {
    const env = createTestEnvironment();
    const limits = env.context.window.pdfLinguaUpload.getCurrentUserLimits({ role: 'pro' });
    assert.strictEqual(limits.role, 'pro');
    assert.strictEqual(limits.maxFileSizeMb, 100);
    assert.strictEqual(limits.maxFileSizeBytes, 100 * 1024 * 1024);
    assert.strictEqual(limits.maxOcrPages, 500);
  });

  await test('Limits Resolution: Admin user gets 100MB & 500 OCR pages', () => {
    const env = createTestEnvironment();
    const limits = env.context.window.pdfLinguaUpload.getCurrentUserLimits({ role: 'admin' });
    assert.strictEqual(limits.role, 'admin');
    assert.strictEqual(limits.maxFileSizeMb, 100);
    assert.strictEqual(limits.maxOcrPages, 500);
  });

  await test('Limits Resolution: Unknown or tampered role safely defaults to safe 20MB limits', () => {
    const env = createTestEnvironment();
    const limits = env.context.window.pdfLinguaUpload.getCurrentUserLimits({ role: 'superuser_hacker' });
    assert.strictEqual(limits.role, 'guest');
    assert.strictEqual(limits.maxFileSizeMb, 20);
    assert.strictEqual(limits.maxOcrPages, 100);
  });

  await test('Upload Validation: Guest uploading file > 20MB (21MB) is rejected client-side', () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const fileInput = env.elements.pdfFileInput;
    const oversizedFile = {
      name: 'large_guest.pdf',
      type: 'application/pdf',
      size: 21 * 1024 * 1024,
    };

    fileInput.files = [oversizedFile];
    fileInput.trigger('change', { target: { files: [oversizedFile] } });

    // File should NOT be selected
    assert.strictEqual(env.context.window.pdfLinguaUpload.getSelectedFile(), null);
    const toastHtml = env.elements.toastContainer.innerHTML || '';
    const alertMsg = env.context.lastAlert || '';
    assert(toastHtml.includes('20MB') || alertMsg.includes('20MB'));
  });

  await test('Upload Validation: Guest uploading file <= 20MB (15MB) is accepted', () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const fileInput = env.elements.pdfFileInput;
    const validFile = {
      name: 'valid_guest.pdf',
      type: 'application/pdf',
      size: 15 * 1024 * 1024,
    };

    fileInput.files = [validFile];
    fileInput.trigger('change', { target: { files: [validFile] } });

    assert.strictEqual(env.context.window.pdfLinguaUpload.getSelectedFile(), validFile);
    assert.strictEqual(env.elements.previewFileName.textContent, 'valid_guest.pdf');
    assert(env.elements.dropzoneSelected.classList.contains('active'));
  });

  await test('Upload Validation: Pro user can upload file > 20MB (25MB)', () => {
    const env = createTestEnvironment();
    // Simulate stored Pro user
    env.storage.setItem('pdfl_user', JSON.stringify({ id: 'pro-1', role: 'pro' }));
    env.fireDomReady();

    const fileInput = env.elements.pdfFileInput;
    const proFile = {
      name: 'doc_25mb.pdf',
      type: 'application/pdf',
      size: 25 * 1024 * 1024,
    };

    fileInput.files = [proFile];
    fileInput.trigger('change', { target: { files: [proFile] } });

    assert.strictEqual(env.context.window.pdfLinguaUpload.getSelectedFile(), proFile);
    assert.strictEqual(env.elements.previewFileName.textContent, 'doc_25mb.pdf');
  });

  await test('Upload Validation: Pro user uploading file > 100MB (105MB) is rejected client-side', () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_user', JSON.stringify({ id: 'pro-1', role: 'pro' }));
    env.fireDomReady();

    const fileInput = env.elements.pdfFileInput;
    const hugeFile = {
      name: 'huge_105mb.pdf',
      type: 'application/pdf',
      size: 105 * 1024 * 1024,
    };

    fileInput.files = [hugeFile];
    fileInput.trigger('change', { target: { files: [hugeFile] } });

    assert.strictEqual(env.context.window.pdfLinguaUpload.getSelectedFile(), null);
    const toastHtml = env.elements.toastContainer.innerHTML || '';
    const alertMsg = env.context.lastAlert || '';
    assert(toastHtml.includes('100MB') || alertMsg.includes('100MB'));
  });

  await test('Dynamic UI: Dropzone text dynamically updates when switching roles', () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const banner = env.elements.dropzoneLimitText;
    // Guest initial
    assert(banner.innerHTML.includes('20 MB'));
    assert(banner.innerHTML.includes('100 trang'));

    // Switch to Pro via auth state update
    env.context.window.pdfLinguaAuth.updateHeaderAuthState({ id: 'p1', role: 'pro', full_name: 'Pro User' });
    assert(banner.innerHTML.includes('100 MB'));
    assert(banner.innerHTML.includes('500 trang'));
    assert(banner.innerHTML.includes('role-pro'));

    // Switch to Admin
    env.context.window.pdfLinguaAuth.updateHeaderAuthState({ id: 'a1', role: 'admin', full_name: 'Admin' });
    assert(banner.innerHTML.includes('100 MB'));
    assert(banner.innerHTML.includes('role-admin'));

    // Logout back to Guest
    env.context.window.pdfLinguaAuth.updateHeaderAuthState(null);
    assert(banner.innerHTML.includes('20 MB'));
    assert(banner.innerHTML.includes('100 trang'));
  });

  await test('Security / UX: Selected 25MB file is automatically reset upon logout from Pro', () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_user', JSON.stringify({ id: 'p1', role: 'pro' }));
    env.fireDomReady();

    const proFile = {
      name: 'pro_doc_25mb.pdf',
      type: 'application/pdf',
      size: 25 * 1024 * 1024,
    };
    env.elements.pdfFileInput.files = [proFile];
    env.elements.pdfFileInput.trigger('change', { target: { files: [proFile] } });

    assert.strictEqual(env.context.window.pdfLinguaUpload.getSelectedFile(), proFile);

    // Logout
    env.storage.removeItem('pdfl_user');
    env.context.window.pdfLinguaAuth.updateHeaderAuthState(null);

    // Selected file MUST be cleared to prevent bypassing limits
    assert.strictEqual(env.context.window.pdfLinguaUpload.getSelectedFile(), null);
    assert.strictEqual(env.elements.dropzoneSelected.classList.contains('active'), false);
  });

  await test('Auth Header: getAuthHeaders returns empty object for Guest (no token)', () => {
    const env = createTestEnvironment();
    const headers = env.context.window.pdfLinguaWorkspace.getAuthHeaders();
    assert.strictEqual(Object.keys(headers).length, 0);
    assert.strictEqual(headers['Authorization'], undefined);
  });

  await test('Auth Header: getAuthHeaders ignores null, undefined, or empty string tokens', () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_token', '   ');
    assert.strictEqual(env.context.window.pdfLinguaWorkspace.getAuthHeaders()['Authorization'], undefined);

    env.storage.setItem('pdfl_token', 'null');
    assert.strictEqual(env.context.window.pdfLinguaWorkspace.getAuthHeaders()['Authorization'], undefined);

    env.storage.setItem('pdfl_token', 'undefined');
    assert.strictEqual(env.context.window.pdfLinguaWorkspace.getAuthHeaders()['Authorization'], undefined);
  });

  await test('Auth Header: getAuthHeaders attaches Bearer token when present', () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_token', 'valid.jwt.token');
    const headers = env.context.window.pdfLinguaWorkspace.getAuthHeaders();
    assert.strictEqual(headers['Authorization'], 'Bearer valid.jwt.token');
  });

  await test('Process API: Guest upload sends request WITHOUT Authorization header', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const validFile = { name: 'guest.pdf', type: 'application/pdf', size: 1024 };
    env.context.window.pdfLinguaUpload.setSelectedFile(validFile);

    let capturedUrl = '';
    let capturedOptions = null;

    env.context.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          data: { filename: 'guest.pdf', page_count: 1, file_size_mb: 0.1, translated_text: 'Xin chao' },
        }),
      };
    };

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();

    assert(capturedUrl.includes('/upload-and-translate'));
    assert.strictEqual(capturedOptions.headers, undefined); // Guest sends NO Authorization header
  });

  await test('Process API: Logged-in user upload sends request WITH Authorization header', async () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_token', 'user.token.xyz');
    env.storage.setItem('pdfl_user', JSON.stringify({ id: 'u1', role: 'free' }));
    env.fireDomReady();

    const validFile = { name: 'user.pdf', type: 'application/pdf', size: 1024 };
    env.context.window.pdfLinguaUpload.setSelectedFile(validFile);

    let capturedHeaders = null;
    env.context.fetch = async (url, options) => {
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          data: { filename: 'user.pdf', page_count: 1, file_size_mb: 0.1, translated_text: 'Dich' },
        }),
      };
    };

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();

    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer user.token.xyz');
  });

  await test('Retranslate API: Attaches Bearer token and JSON headers when authenticated', async () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_token', 'user.token.xyz');
    env.context.window.pdfLinguaWorkspace.setCurrentDocData({ original_text: 'Hello' });

    let capturedHeaders = null;
    env.context.fetch = async (url, options) => {
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { translated_text: 'Xin chao' } }),
      };
    };

    await env.context.window.pdfLinguaWorkspace.handleRetranslate();

    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer user.token.xyz');
    assert.strictEqual(capturedHeaders['Content-Type'], 'application/json');
  });

  await test('Download API: Attaches Bearer token when authenticated', async () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_token', 'download.token.123');
    env.context.window.pdfLinguaWorkspace.setCurrentDocData({
      filename: 'sample.pdf',
      translated_text: 'Ket qua',
      original_text: 'Source',
    });

    let capturedHeaders = null;
    env.context.fetch = async (url, options) => {
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        blob: async () => ({}),
      };
    };

    await env.context.window.pdfLinguaWorkspace.triggerDownload('txt');

    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer download.token.123');
    assert.strictEqual(capturedHeaders['Content-Type'], 'application/json');
  });

  await test('Error Handling: HTTP 401 on upload clears token and resets to Guest without silent retry', async () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_token', 'expired.token');
    env.storage.setItem('pdfl_user', JSON.stringify({ id: 'u1', role: 'pro' }));
    env.fireDomReady();

    const validFile = { name: 'test.pdf', type: 'application/pdf', size: 1024 };
    env.context.window.pdfLinguaUpload.setSelectedFile(validFile);

    let callCount = 0;
    env.context.fetch = async () => {
      callCount++;
      return {
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, message: 'Token đã hết hạn' }),
      };
    };

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();

    // Verify exactly ONE call was made — no silent downgrade retry!
    assert.strictEqual(callCount, 1);
    // Token and session MUST be purged
    assert.strictEqual(env.storage.getItem('pdfl_token'), null);
    assert.strictEqual(env.storage.getItem('pdfl_user'), null);
    // UI limits reset back to Guest
    assert.strictEqual(env.context.window.pdfLinguaUpload.getCurrentUserLimits().role, 'guest');
  });

  await test('Error Handling: HTTP 413 on upload displays backend limit detail message', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const file = { name: 'oversized.pdf', type: 'application/pdf', size: 1024 };
    env.context.window.pdfLinguaUpload.setSelectedFile(file);

    let toastShown = '';
    env.elements.toastContainer = {
      appendChild: (node) => { toastShown = node.innerHTML; },
    };

    env.context.fetch = async () => {
      return {
        ok: false,
        status: 413,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: false,
          error_code: 'HTTP_413',
          message: 'Tài liệu dạng scan/ảnh (105 trang) vượt quá giới hạn OCR của tài khoản (100 trang).',
        }),
      };
    };

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();

    assert(toastShown.includes('105 trang'));
    assert(toastShown.includes('100 trang'));
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${total} frontend role limits tests passed (0 failed).`);
  console.log('================================================================\n');
})();
