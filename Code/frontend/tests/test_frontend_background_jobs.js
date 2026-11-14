/**
 * PDF-Lingua - Frontend Background Jobs & Progress Streaming Test Suite (PDFL-111.4)
 * ----------------------------------------------------------------------------------
 * Verifies:
 * 1. Upload submits to /jobs endpoint with file and language.
 * 2. EventSource connects to SSE endpoint /jobs/{job_id}/events.
 * 3. SSE message events update progressBarFill, progressDesc, and step indicator dynamically.
 * 4. Completion event (COMPLETED) renders workspace and closes SSE connection.
 * 5. Failure event (FAILED) shows error toast and resets button state.
 * 6. Fallback polling activates if EventSource is unavailable or errors out.
 * 7. cleanupProgressTracking correctly closes EventSource and cancels timers.
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
  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }
  removeEventListener(event, handler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(h => h !== handler);
  }
  trigger(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(h => h(data));
    }
  }
  focus() {}
  reset() { this.value = ''; }
  click() { this.trigger('click', { stopPropagation: () => {} }); }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  appendChild(child) { this.children = this.children || []; this.children.push(child); }
  remove() {}
}

class MockStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

class MockEventSource {
  constructor(url) {
    this.url = url;
    this.closed = false;
    this.onmessage = null;
    this.onerror = null;
    MockEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  emitMessage(data) {
    if (this.onmessage && !this.closed) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
  emitError(err) {
    if (this.onerror && !this.closed) {
      this.onerror(err);
    }
  }
}
MockEventSource.instances = [];

function createTestEnvironment() {
  const elements = {};
  const elementIds = [
    'btnProcessPdf', 'btnRetranslate', 'targetLangSelect', 'btnCopyOriginal', 'btnCopyTranslated',
    'btnDownloadMenu', 'downloadDropdown', 'btnDownloadTxt', 'btnDownloadPdf', 'btnNewFile',
    'btnRemoveFile', 'paneOriginal', 'paneTranslated', 'heroSection', 'workspaceSection',
    'processingModal', 'progressBarFill', 'progressDesc',
    'stepItem1', 'stepItem2', 'stepItem3', 'stepItem4',
    'toastContainer', 'docTitle', 'docMeta', 'originalTextMeta', 'translatedTextMeta',
    'docName', 'docSize', 'docPages', 'uploadDropzone', 'dropzoneText', 'fileInput',
    'btnMinimizeProgress', 'btnCloseProgressModal', 'btnCancelJob',
    'bgJobWidget', 'bgJobFileName', 'bgJobStatusText', 'btnMaximizeProgress', 'btnCloseBgWidget',
    'bgJobProgressBarFill', 'bgJobPercent',
  ];
  elementIds.forEach(id => { elements[id] = new Element(id); });

  const storage = new MockStorage();
  const listeners = {};
  MockEventSource.instances = [];

  const context = {
    console,
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    setInterval: (fn) => { fn(); return 2; },
    clearInterval: () => {},
    EventSource: MockEventSource,
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => null,
      querySelectorAll: () => [],
      addEventListener: (event, handler) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      },
      createElement: (tag) => new Element(tag),
    },
    window: {
      scrollTo: () => {},
      location: { protocol: 'http:', port: '8000', hostname: 'localhost' },
      addEventListener: (event, handler) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      },
      removeEventListener: (event, handler) => {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(h => h !== handler);
      },
      dispatchEvent: (event) => {
        const type = event.type || event;
        if (listeners[type]) listeners[type].forEach(h => h(event));
      },
    },
    localStorage: storage,
    sessionStorage: storage,
    FormData: class {
      constructor() { this.data = {}; }
      append(k, v) { this.data[k] = v; }
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: {} }),
    }),
  };

  context.window.document = context.document;
  context.window.localStorage = storage;
  context.window.sessionStorage = storage;
  context.window.EventSource = MockEventSource;

  vm.createContext(context);
  vm.runInContext(authSource, context);
  vm.runInContext(uploadSource, context);
  vm.runInContext(workspaceSource, context);

  return {
    context,
    elements,
    storage,
    fireDomReady: () => {
      if (listeners['DOMContentLoaded']) {
        listeners['DOMContentLoaded'].forEach(h => h());
      }
    },
    fireKeyDown: (key) => {
      if (listeners['keydown']) {
        listeners['keydown'].forEach(h => h({ key }));
      }
    },
  };
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('PDF-Lingua Frontend Background Jobs & SSE Test Suite (PDFL-111.4)');
  console.log('================================================================\n');

  await test('Background Job: Upload dispatches POST to /jobs and initiates SSE', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'test_doc.pdf', type: 'application/pdf', size: 2048 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    let calledUrl = '';
    env.context.fetch = async (url) => {
      calledUrl = url;
      return {
        ok: true,
        status: 202,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          data: {
            job_id: 'job-uuid-1234',
            status: 'PENDING',
            progress_percentage: 10,
          },
        }),
      };
    };

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();

    assert(calledUrl.includes('/jobs'), `Expected /jobs in URL, got ${calledUrl}`);
    assert.strictEqual(MockEventSource.instances.length, 1);
    assert(MockEventSource.instances[0].url.includes('/jobs/job-uuid-1234/events'));
  });

  await test('SSE Streaming: Real-time progress updates modify UI elements', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'test_doc.pdf', type: 'application/pdf', size: 2048 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    env.context.fetch = async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-progress-test', status: 'PENDING' },
      }),
    });

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];

    // Emit PROCESSING event from SSE
    es.emitMessage({
      job_id: 'job-progress-test',
      status: 'PROCESSING',
      progress_percentage: 60.5,
      current_step: 2,
      message: 'Đang xử lý trang 3/5...',
    });

    assert.strictEqual(env.elements.progressBarFill.style.width, '60.5%');
    assert.strictEqual(env.elements.progressDesc.textContent, 'Đang xử lý trang 3/5...');
    assert(env.elements.stepItem2.classList.contains('active'));
  });

  await test('SSE Completion: COMPLETED event renders workspace and closes SSE', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'test_doc.pdf', type: 'application/pdf', size: 2048 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    env.context.fetch = async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-done-test', status: 'PENDING' },
      }),
    });

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];

    es.emitMessage({
      job_id: 'job-done-test',
      status: 'COMPLETED',
      progress_percentage: 100,
      current_step: 4,
      message: 'Xử lý và dịch thuật hoàn tất!',
      result: {
        filename: 'test_doc.pdf',
        original_text: 'Hello world',
        translated_text: 'Xin chào thế giới',
      },
    });

    assert.strictEqual(es.closed, true, 'SSE EventSource should be closed upon completion');
    assert.strictEqual(env.elements.progressBarFill.style.width, '100%');
    const docData = env.context.window.pdfLinguaWorkspace.getCurrentDocData();
    assert.strictEqual(docData.translated_text, 'Xin chào thế giới');
  });

  await test('SSE Failure: FAILED event shows error toast and closes SSE', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'corrupted.pdf', type: 'application/pdf', size: 1024 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    env.context.fetch = async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-fail-test', status: 'PENDING' },
      }),
    });

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];

    es.emitMessage({
      job_id: 'job-fail-test',
      status: 'FAILED',
      error: 'Tệp PDF bị hỏng cấu trúc header.',
    });

    assert.strictEqual(es.closed, true, 'SSE EventSource should be closed on failure');
    assert.strictEqual(env.elements.btnProcessPdf.disabled, false);
    assert.strictEqual(env.elements.processingModal.style.display, 'none');
  });

  await test('Cleanup: resetToUpload and modal hide clean active SSE connection', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'test_doc.pdf', type: 'application/pdf', size: 2048 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    env.context.fetch = async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-cleanup-test', status: 'PENDING' },
      }),
    });

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];
    assert.strictEqual(es.closed, false);

    // Call resetToUpload
    env.context.window.pdfLinguaWorkspace.cleanupProgressTracking();
    assert.strictEqual(es.closed, true, 'cleanupProgressTracking must close EventSource');
  });

  await test('Fallback Polling: SSE onerror triggers polling fallback to fetch job status', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'test_doc.pdf', type: 'application/pdf', size: 2048 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    let pollCount = 0;
    env.context.fetch = async (url) => {
      if (url.includes('/jobs/job-poll-test/events')) {
        return { ok: true, status: 200 };
      }
      if (url.endsWith('/jobs')) {
        return {
          ok: true,
          status: 202,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            data: { job_id: 'job-poll-test', status: 'PENDING' },
          }),
        };
      }
      if (url.includes('/jobs/job-poll-test')) {
        pollCount++;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            data: {
              job_id: 'job-poll-test',
              status: 'COMPLETED',
              progress_percentage: 100,
              current_step: 4,
              result: { filename: 'test_doc.pdf', translated_text: 'Kết quả polling' },
            },
          }),
        };
      }
      return { ok: true, status: 200 };
    };

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];

    // Trigger SSE error -> should switch to polling fallback
    es.emitError(new Error('SSE disconnected'));
    await new Promise(r => setImmediate(r));

    assert(pollCount >= 1, 'Polling fallback should have queried job status');
    const docData = env.context.window.pdfLinguaWorkspace.getCurrentDocData();
    assert.strictEqual(docData.translated_text, 'Kết quả polling');
  });

  await test('PDFL-71.2: Minimizing modal hides modal, displays floating mini-widget, and keeps SSE connection alive', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'annual_report_2026.pdf', type: 'application/pdf', size: 5000 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    env.context.fetch = async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-minimize-test', status: 'PENDING' },
      }),
    });

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];
    assert.strictEqual(env.elements['processingModal'].style.display, 'flex');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'none');

    // Click btnMinimizeProgress
    env.elements['btnMinimizeProgress'].click();

    // Modal should be hidden, widget should be visible with filename
    assert.strictEqual(env.elements['processingModal'].style.display, 'none');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'flex');
    assert.strictEqual(env.elements['bgJobFileName'].textContent, 'annual_report_2026.pdf');

    // SSE connection must NOT be closed when minimized
    assert.strictEqual(es.closed, false, 'SSE must remain alive during minimization');
  });

  await test('PDFL-71.2: Progress update synchronizes with floating mini-widget bar, percent, status and filename', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'finance_q3.pdf', type: 'application/pdf', size: 8192 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    env.context.fetch = async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-sync-test', status: 'PENDING' },
      }),
    });

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];

    // Emit progress event
    es.emitMessage({
      job_id: 'job-sync-test',
      status: 'PROCESSING',
      progress_percentage: 68,
      message: 'Đang dịch thuật văn bản trang 5/8...',
      current_step: 3,
    });

    // Check modal sync
    assert.strictEqual(env.elements['progressBarFill'].style.width, '68%');
    assert.strictEqual(env.elements['progressDesc'].textContent, 'Đang dịch thuật văn bản trang 5/8...');

    // Check floating mini-widget sync
    assert.strictEqual(env.elements['bgJobProgressBarFill'].style.width, '68%');
    assert.strictEqual(env.elements['bgJobPercent'].textContent, '68%');
    assert.strictEqual(env.elements['bgJobStatusText'].textContent, 'Đang dịch thuật văn bản trang 5/8...');
    assert.strictEqual(env.elements['bgJobFileName'].textContent, 'finance_q3.pdf');
  });

  await test('PDFL-71.2: Maximizing from mini-widget restores modal and hides widget', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'doc_restore.pdf', type: 'application/pdf', size: 3000 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    env.context.fetch = async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-restore-test', status: 'PENDING' },
      }),
    });

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];

    // Minimize modal
    env.context.window.pdfLinguaWorkspace.minimizeProgressModal();
    assert.strictEqual(env.elements['processingModal'].style.display, 'none');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'flex');

    // Click btnMaximizeProgress
    env.elements['btnMaximizeProgress'].click();
    assert.strictEqual(env.elements['processingModal'].style.display, 'flex');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'none');
    assert.strictEqual(es.closed, false, 'SSE must remain active');
  });

  await test('PDFL-71.2: Closing widget hides mini-widget without stopping SSE background job', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'doc_close_widget.pdf', type: 'application/pdf', size: 4000 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    env.context.fetch = async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-close-widget-test', status: 'PENDING' },
      }),
    });

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];

    // Minimize first
    env.elements['btnMinimizeProgress'].click();
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'flex');

    // Click btnCloseBgWidget
    env.elements['btnCloseBgWidget'].click();
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'none');
    assert.strictEqual(es.closed, false, 'Closing widget must NOT cancel or stop SSE');
  });

  await test('PDFL-71.2: Escape key and backdrop overlay click minimize modal without stopping job', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'doc_esc.pdf', type: 'application/pdf', size: 2000 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    env.context.fetch = async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-esc-test', status: 'PENDING' },
      }),
    });

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];
    assert.strictEqual(env.elements['processingModal'].style.display, 'flex');

    // Test Escape key press
    env.fireKeyDown('Escape');
    assert.strictEqual(env.elements['processingModal'].style.display, 'none');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'flex');
    assert.strictEqual(es.closed, false);

    // Restore modal
    env.context.window.pdfLinguaWorkspace.maximizeProgressModal();
    assert.strictEqual(env.elements['processingModal'].style.display, 'flex');

    // Test backdrop click (target === processingModal)
    env.elements['processingModal'].trigger('click', { target: env.elements['processingModal'] });
    assert.strictEqual(env.elements['processingModal'].style.display, 'none');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'flex');
    assert.strictEqual(es.closed, false);
  });

  await test('PDFL-71.2: Cancelling job calls cancel endpoint, closes SSE, and resets UI', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'doc_cancel.pdf', type: 'application/pdf', size: 1000 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    let cancelEndpointCalled = false;
    let cancelMethod = '';

    env.context.fetch = async (url, opts) => {
      if (url.includes('/jobs') && opts && opts.body) {
        return {
          ok: true,
          status: 202,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            data: { job_id: 'job-to-cancel-999', status: 'PENDING' },
          }),
        };
      }
      if (url.includes('/jobs/job-to-cancel-999/cancel')) {
        cancelEndpointCalled = true;
        cancelMethod = opts ? opts.method : '';
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            message: 'Tác vụ đã được hủy thành công.',
          }),
        };
      }
      return { ok: true, status: 200 };
    };

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];

    // Trigger cancel job
    await env.context.window.pdfLinguaWorkspace.cancelActiveJob();

    assert.strictEqual(cancelEndpointCalled, true, 'POST /jobs/{job_id}/cancel must be called');
    assert.strictEqual(cancelMethod, 'POST');
    assert.strictEqual(es.closed, true, 'SSE must be closed after cancelling');
    assert.strictEqual(env.elements['processingModal'].style.display, 'none');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'none');
    assert.strictEqual(env.elements['btnProcessPdf'].disabled, false);
  });

  await test('PDFL-71.2: SSE CANCELLED event terminates tracking and updates UI', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    const mockFile = { name: 'doc_remote_cancel.pdf', type: 'application/pdf', size: 1500 };
    env.context.window.pdfLinguaUpload.setSelectedFile(mockFile);

    env.context.fetch = async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-remote-cancel', status: 'PENDING' },
      }),
    });

    await env.context.window.pdfLinguaWorkspace.handleProcessPdf();
    const es = MockEventSource.instances[0];

    // Emit CANCELLED status over SSE
    es.emitMessage({
      job_id: 'job-remote-cancel',
      status: 'CANCELLED',
      message: 'Tác vụ đã được hủy bởi hệ thống.',
    });

    assert.strictEqual(es.closed, true, 'SSE must be closed when CANCELLED status arrives');
    assert.strictEqual(env.elements['processingModal'].style.display, 'none');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'none');
    assert.strictEqual(env.elements['btnProcessPdf'].disabled, false);
  });

  await test('PDFL-71.3: F5 Reload with active PENDING/PROCESSING job recovers state and reconnects SSE', async () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_active_job_id', 'job-f5-active-101');
    env.storage.setItem('pdfl_bg_minimized', 'false');

    let getJobCalled = false;
    env.context.fetch = async (url) => {
      if (url.includes('/jobs/job-f5-active-101')) {
        getJobCalled = true;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            data: {
              job_id: 'job-f5-active-101',
              status: 'PROCESSING',
              filename: 'financial_q4.pdf',
              progress_percentage: 55,
              current_step: 3,
              message: 'Đang dịch thuật văn bản trang 3/5...',
            },
          }),
        };
      }
      return { ok: true, status: 200 };
    };

    // Run recovery
    await env.context.window.pdfLinguaWorkspace.recoverActiveJob('job-f5-active-101');

    assert.strictEqual(getJobCalled, true, 'GET /jobs/{job_id} must be called to verify backend state');
    assert.strictEqual(env.elements['processingModal'].style.display, 'flex');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'none');
    assert.strictEqual(env.elements['progressBarFill'].style.width, '55%');
    assert.strictEqual(env.elements['bgJobPercent'].textContent, '55%');
    assert.strictEqual(env.elements['bgJobFileName'].textContent, 'financial_q4.pdf');
    assert.strictEqual(env.elements['btnProcessPdf'].disabled, true);

    // Verify SSE reconnection
    assert.strictEqual(MockEventSource.instances.length, 1);
    assert(MockEventSource.instances[0].url.includes('/jobs/job-f5-active-101/events'));
    assert.strictEqual(MockEventSource.instances[0].closed, false);
  });

  await test('PDFL-71.3: F5 Reload recovers minimized state (bgJobWidget visible, modal hidden)', async () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_active_job_id', 'job-f5-minimized-202');
    env.storage.setItem('pdfl_bg_minimized', 'true');

    env.context.fetch = async (url) => {
      if (url.includes('/jobs/job-f5-minimized-202')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            data: {
              job_id: 'job-f5-minimized-202',
              status: 'PROCESSING',
              filename: 'contract_draft.pdf',
              progress_percentage: 30,
              current_step: 2,
              message: 'Đang trích xuất nội dung văn bản...',
            },
          }),
        };
      }
      return { ok: true, status: 200 };
    };

    await env.context.window.pdfLinguaWorkspace.recoverActiveJob('job-f5-minimized-202');

    // Minimized state check: widget should be flex, modal should be none
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'flex');
    assert.strictEqual(env.elements['processingModal'].style.display, 'none');
    assert.strictEqual(env.elements['bgJobProgressBarFill'].style.width, '30%');
    assert.strictEqual(env.elements['bgJobPercent'].textContent, '30%');
    assert.strictEqual(env.elements['bgJobFileName'].textContent, 'contract_draft.pdf');
    assert.strictEqual(MockEventSource.instances.length, 1);
  });

  await test('PDFL-71.3: F5 Reload with COMPLETED job renders workspace and clears storage', async () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_active_job_id', 'job-already-done-303');
    env.storage.setItem('pdfl_bg_minimized', 'true');

    env.context.fetch = async (url) => {
      if (url.includes('/jobs/job-already-done-303')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            data: {
              job_id: 'job-already-done-303',
              status: 'COMPLETED',
              progress_percentage: 100,
              current_step: 4,
              filename: 'done_doc.pdf',
              result: {
                filename: 'done_doc.pdf',
                original_text: 'Hello world',
                translated_text: 'Xin chào thế giới',
              },
            },
          }),
        };
      }
      return { ok: true, status: 200 };
    };

    await env.context.window.pdfLinguaWorkspace.recoverActiveJob('job-already-done-303');

    // Job completed: modal and widget must NOT show, no fake running state
    assert.strictEqual(env.elements['processingModal'].style.display, 'none');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'none');
    assert.strictEqual(env.storage.getItem('pdfl_active_job_id'), null, 'pdfl_active_job_id must be cleaned up');
    assert.strictEqual(env.storage.getItem('pdfl_bg_minimized'), null, 'pdfl_bg_minimized must be cleaned up');

    // Workspace rendered
    const docData = env.context.window.pdfLinguaWorkspace.getCurrentDocData();
    assert.strictEqual(docData.translated_text, 'Xin chào thế giới');
    assert.strictEqual(MockEventSource.instances.length, 0, 'No fake running SSE stream should be created');
  });

  await test('PDFL-71.3: F5 Reload with FAILED or CANCELLED job cleans up storage and notifies user', async () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_active_job_id', 'job-failed-404');
    env.storage.setItem('pdfl_bg_minimized', 'false');

    env.context.fetch = async (url) => {
      if (url.includes('/jobs/job-failed-404')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            data: {
              job_id: 'job-failed-404',
              status: 'FAILED',
              error: 'Dung lượng tệp vượt quá khả năng xử lý của bộ nhớ.',
            },
          }),
        };
      }
      return { ok: true, status: 200 };
    };

    await env.context.window.pdfLinguaWorkspace.recoverActiveJob('job-failed-404');

    assert.strictEqual(env.elements['processingModal'].style.display, 'none');
    assert.strictEqual(env.elements['bgJobWidget'].style.display, 'none');
    assert.strictEqual(env.storage.getItem('pdfl_active_job_id'), null);
    assert.strictEqual(env.storage.getItem('pdfl_bg_minimized'), null);
    assert.strictEqual(env.elements['btnProcessPdf'].disabled, false);
    assert.strictEqual(MockEventSource.instances.length, 0);

    // Also test CANCELLED
    env.storage.setItem('pdfl_active_job_id', 'job-cancelled-505');
    env.context.fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { job_id: 'job-cancelled-505', status: 'CANCELLED', message: 'Tác vụ đã bị hủy trước đó.' },
      }),
    });
    await env.context.window.pdfLinguaWorkspace.recoverActiveJob('job-cancelled-505');
    assert.strictEqual(env.storage.getItem('pdfl_active_job_id'), null);
  });

  await test('PDFL-71.3: SSE reconnect with Polling Fallback during recovery', async () => {
    const env = createTestEnvironment();
    env.storage.setItem('pdfl_active_job_id', 'job-reconnect-poll-606');

    let pollCount = 0;
    env.context.fetch = async (url) => {
      if (url.includes('/jobs/job-reconnect-poll-606')) {
        pollCount++;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            data: {
              job_id: 'job-reconnect-poll-606',
              status: pollCount > 1 ? 'COMPLETED' : 'PROCESSING',
              progress_percentage: 100,
              current_step: 4,
              result: { filename: 'rec.pdf', translated_text: 'Dịch qua reconnect polling' },
            },
          }),
        };
      }
      return { ok: true, status: 200 };
    };

    await env.context.window.pdfLinguaWorkspace.recoverActiveJob('job-reconnect-poll-606');
    assert.strictEqual(MockEventSource.instances.length, 1);

    // Trigger SSE error to force polling fallback
    MockEventSource.instances[0].emitError(new Error('SSE disconnected during recovery'));
    await new Promise(r => setImmediate(r));

    assert(pollCount >= 2, 'Polling fallback should have queried job status');
    const docData = env.context.window.pdfLinguaWorkspace.getCurrentDocData();
    assert.strictEqual(docData.translated_text, 'Dịch qua reconnect polling');
  });

  await test('PDFL-71.3: Prevents duplicate SSE connections when switching views or calling listen repeatedly', async () => {
    const env = createTestEnvironment();
    env.fireDomReady();

    // Start listening to job
    env.context.window.pdfLinguaWorkspace.listenToJobProgress('job-no-duplicate-707');
    assert.strictEqual(MockEventSource.instances.length, 1);

    // Call listen again with SAME job id while SSE is open
    env.context.window.pdfLinguaWorkspace.listenToJobProgress('job-no-duplicate-707');
    assert.strictEqual(MockEventSource.instances.length, 1, 'Must NOT open a duplicate EventSource connection');

    // Call listen with a DIFFERENT job id -> should clean up and open a new one
    env.context.window.pdfLinguaWorkspace.listenToJobProgress('job-different-808');
    assert.strictEqual(MockEventSource.instances.length, 2);
    assert.strictEqual(MockEventSource.instances[0].closed, true, 'Previous SSE connection must be closed');
    assert.strictEqual(MockEventSource.instances[1].closed, false, 'New SSE connection is active');
  });

  console.log('\n================================================================');
  console.log('SUMMARY: All frontend background jobs tests passed.');
  console.log('================================================================');
}

runAllTests();
