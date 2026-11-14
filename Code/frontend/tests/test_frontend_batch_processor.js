/**
 * PDF-Lingua - Frontend Test Suite for PDFL-252.2: Batch Orchestrator & ZIP Download
 * =================================================================================
 * Tests:
 * 1. Static HTML & CSS markup (overall progress, footer, ZIP button, styles).
 * 2. BatchOrchestrator instantiation, configuration, and default state.
 * 3. Strict Concurrency Limit = 2 (max 2 concurrent requests).
 * 4. Auto-dequeue / advance on job completion and failure.
 * 5. Independent SSE connection and progress updates per job.
 * 6. Resilience: A failed job does not halt remaining batch jobs.
 * 7. Page Selection Safety: Custom page range does not bleed to other batch files.
 * 8. Queue UI locking during processing.
 * 9. Batch ZIP Download trigger, payload, headers, and blob cleanup.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('--- BẮT ĐẦU TEST SUITE PDFL-252.2 (Batch Orchestrator & ZIP Download) ---\n');

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
const batchProcessorJsCode = fs.readFileSync(path.resolve(__dirname, '../js/batch_processor.js'), 'utf8');
const workspaceJsCode = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');

// ============================================================================
// SUITE 1: Static HTML & CSS Markup
// ============================================================================
console.log('[Suite 1] Static HTML & CSS Analysis');

runTest('1.1: index.html loads js/batch_processor.js script tag', () => {
  assert.ok(
    htmlContent.includes('<script src="js/batch_processor.js"></script>'),
    'index.html must load js/batch_processor.js'
  );
});

runTest('1.2: index.html contains #batchOverallProgressWrap, #batchOverallProgressFill, #batchOverallProgressText', () => {
  assert.ok(htmlContent.includes('id="batchOverallProgressWrap"'), '#batchOverallProgressWrap missing in HTML');
  assert.ok(htmlContent.includes('id="batchOverallProgressFill"'), '#batchOverallProgressFill missing in HTML');
  assert.ok(htmlContent.includes('id="batchOverallProgressText"'), '#batchOverallProgressText missing in HTML');
});

  runTest('1.3: index.html contains #batchQueueFooter, #btnDownloadBatchZip, and #btnDownloadBatchZipDocx', () => {
    assert.ok(htmlContent.includes('id="batchQueueFooter"'), '#batchQueueFooter missing in HTML');
    assert.ok(htmlContent.includes('id="btnDownloadBatchZip"'), '#btnDownloadBatchZip missing in HTML');
    assert.ok(htmlContent.includes('id="btnDownloadBatchZipDocx"'), '#btnDownloadBatchZipDocx missing in HTML');
    assert.ok(htmlContent.includes('id="batchFooterNotice"'), '#batchFooterNotice missing in HTML');
  });

  runTest('1.4: layout.css defines batch overall progress, footer, and button styles', () => {
    assert.ok(layoutCssCode.includes('.batch-overall-progress-wrap'), '.batch-overall-progress-wrap missing in CSS');
    assert.ok(layoutCssCode.includes('.batch-progress-bar-fill'), '.batch-progress-bar-fill missing in CSS');
    assert.ok(layoutCssCode.includes('.btn-batch-zip'), '.btn-batch-zip missing in CSS');
    assert.ok(layoutCssCode.includes('.queue-item-progress-wrap'), '.queue-item-progress-wrap missing in CSS');
    assert.ok(layoutCssCode.includes('.status-waiting'), '.status-waiting missing in CSS');
    assert.ok(layoutCssCode.includes('.status-processing'), '.status-processing missing in CSS');
    assert.ok(layoutCssCode.includes('.status-completed'), '.status-completed missing in CSS');
    assert.ok(layoutCssCode.includes('.status-failed'), '.status-failed missing in CSS');
  });

  runTest('1.5: layout.css defines responsive styles for batch ZIP button at <= 480px', () => {
    assert.ok(
      layoutCssCode.includes('@media (max-width: 480px)') && layoutCssCode.includes('.btn-batch-zip'),
      'Responsive styles for .btn-batch-zip missing at max-width: 480px'
    );
  });

  // ============================================================================
  // HELPER: Mock DOM & Browser Environment
  // ============================================================================
  function createTestEnvironment(customFetch) {
    const listeners = {};
    const elements = {};

    function createElement(id, tagName = 'div') {
      const el = {
        id,
        tagName: tagName.toUpperCase(),
        style: {},
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); },
        },
        attributes: {},
        setAttribute(k, v) { this.attributes[k] = String(v); },
        getAttribute(k) { return this.attributes[k] || null; },
        removeAttribute(k) { delete this.attributes[k]; },
        textContent: '',
        innerHTML: '',
        disabled: false,
        value: '',
        checked: false,
        focus() { },
        click() {
          if (this.disabled) return;
          const handler = listeners[id + ':click'];
          if (handler) handler({ target: el, stopPropagation() { } });
        },
        addEventListener(event, handler) {
          listeners[id + ':' + event] = handler;
        },
        querySelectorAll(sel) {
          if (sel === '.btn-queue-remove') {
            return el._removeButtons || [];
          }
          return [];
        },
      };
      elements[id] = el;
      return el;
    }

    // Essential elements
    const elIds = [
      'dropzoneCard', 'pdfFileInput', 'btnSelectPdf', 'dropzonePrompt', 'dropzoneSelected',
      'previewFileName', 'previewFileSize', 'btnRemoveFile', 'btnAddMoreFiles', 'btnClearBatchQueue',
      'batchQueueCard', 'batchQueueCount', 'batchQueueList', 'batchQueueEmpty',
      'pageSelectionCard', 'radioPageModeAll', 'radioPageModeCustom', 'inputPageRange',
      'chipFirstPage', 'chipFirst5Pages', 'chipFirst10Pages', 'pageRangeCustomWrap',
      'btnProcessPdf', 'targetLangSelect', 'toastContainer',
      'batchOverallProgressWrap', 'batchOverallProgressFill', 'batchOverallProgressText',
      'batchQueueFooter', 'btnDownloadBatchZip', 'btnDownloadBatchZipDocx', 'batchFooterNotice', 'btnStartBatchProcess',
    ];

    elIds.forEach(id => createElement(id));

    elements['targetLangSelect'].value = 'vi';
    elements['radioPageModeAll'].checked = true;

    const toasts = [];
    const fakeEventSources = [];

    class MockEventSource {
      constructor(url) {
        this.url = url;
        this.closed = false;
        fakeEventSources.push(this);
      }
      close() {
        this.closed = true;
      }
      emit(eventData) {
        if (this.onmessage) {
          this.onmessage({ data: JSON.stringify(eventData) });
        }
      }
    }

    const downloads = [];

    const sandbox = {
      console: { log() { }, warn() { }, error() { } },
      document: {
        readyState: 'complete',
        getElementById(id) { return elements[id] || null; },
        querySelector(sel) { return null; },
        querySelectorAll(sel) {
          if (sel === '.btn-queue-remove') {
            return elements['batchQueueList'].querySelectorAll(sel);
          }
          return [];
        },
        addEventListener(evt, fn) { listeners['doc:' + evt] = fn; },
        createElement(tag) {
          if (tag === 'a') {
            return {
              href: '',
              download: '',
              click() {
                downloads.push({ href: this.href, download: this.download });
              },
            };
          }
          return createElement('dynamic_' + Date.now(), tag);
        },
        body: {
          appendChild() { },
          removeChild() { },
        },
      },
      window: {
        addEventListener(evt, fn) { listeners['win:' + evt] = fn; },
        dispatchEvent() { },
        EventSource: MockEventSource,
        URL: {
          createObjectURL(blob) { return 'blob:mock-url-' + Date.now(); },
          revokeObjectURL() { },
        },
      },
      EventSource: MockEventSource,
      fetch: customFetch || (async () => ({ ok: true, status: 200, json: async () => ({ success: true }) })),
      FormData: class {
        constructor() { this.entries = {}; }
        append(k, v) { this.entries[k] = v; }
      },
      showToast(msg, type) { toasts.push({ msg, type }); },
      localStorage: {
        store: {},
        getItem(k) { return this.store[k] || null; },
        setItem(k, v) { this.store[k] = String(v); },
        removeItem(k) { delete this.store[k]; },
      },
      setTimeout: (fn) => setTimeout(fn, 0),
      clearTimeout: (id) => clearTimeout(id),
      setInterval: (fn) => setInterval(fn, 100),
      clearInterval: (id) => clearInterval(id),
    };

    sandbox.window.document = sandbox.document;
    sandbox.window.showToast = sandbox.showToast;
    sandbox.window.localStorage = sandbox.localStorage;

    const ctx = vm.createContext(sandbox);

    // Run scripts in order
    vm.runInContext(uploadJsCode, ctx);
    if (typeof sandbox.initDropzone === 'function') {
      sandbox.initDropzone();
    }
    vm.runInContext(batchProcessorJsCode, ctx);
    if (sandbox.window.pdfLinguaBatchOrchestrator && typeof sandbox.window.pdfLinguaBatchOrchestrator.bindUI === 'function') {
      sandbox.window.pdfLinguaBatchOrchestrator.bindUI();
    }

    return { ctx, elements, toasts, fakeEventSources, downloads };
  }

  // ============================================================================
  // SUITE 2: BatchOrchestrator Instantiation & Concurrency Limits
  // ============================================================================
  console.log('\n[Suite 2] BatchOrchestrator Core Properties & Concurrency');

  runTest('2.1: window.pdfLinguaBatchOrchestrator exists and has maxConcurrency = 2', () => {
    const env = createTestEnvironment();
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;
    assert.ok(orchestrator, 'window.pdfLinguaBatchOrchestrator must be initialized');
    assert.strictEqual(orchestrator.maxConcurrency, 2, 'maxConcurrency must be strictly 2');
    assert.strictEqual(orchestrator.activeCount, 0);
    assert.strictEqual(orchestrator.isProcessing, false);
  });

  runTest('2.2: startBatch on empty queue shows warning toast and does not start', () => {
    const env = createTestEnvironment();
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;
    orchestrator.startBatch();
    assert.strictEqual(orchestrator.isProcessing, false);
    assert.ok(env.toasts.some(t => t.msg.includes('trống') && t.type === 'warning'));
  });

  runAsyncTest('2.3: Strict Concurrency = 2: Queue with 4 files launches exactly 2 jobs', async () => {
    let activeInFlight = 0;
    let maxObservedConcurrency = 0;
    const launchedJobs = [];

    const customFetch = async (url, options) => {
      if (url.includes('/jobs')) {
        activeInFlight++;
        if (activeInFlight > maxObservedConcurrency) {
          maxObservedConcurrency = activeInFlight;
        }
        const jobId = 'mock_job_' + launchedJobs.length;
        launchedJobs.push(jobId);

        // Return accepted job response
        return {
          ok: true,
          status: 202,
          json: async () => ({
            success: true,
            data: { job_id: jobId, status: 'PROCESSING' },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    };

    const env = createTestEnvironment(customFetch);
    const queue = env.ctx.window.pdfLinguaBatchQueue;
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;

    // Add 4 dummy files to queue
    const files = [
      { name: 'doc1.pdf', size: 1000 },
      { name: 'doc2.pdf', size: 2000 },
      { name: 'doc3.pdf', size: 3000 },
      { name: 'doc4.pdf', size: 4000 },
    ];
    queue.addFiles(files);

    assert.strictEqual(queue.getQueueCount(), 4);

    // Trigger batch
    orchestrator.startBatch();

    // Allow microtasks to resolve fetch calls
    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(orchestrator.isProcessing, true);
    assert.strictEqual(orchestrator.activeCount, 2, 'activeCount must be 2');
    assert.strictEqual(maxObservedConcurrency, 2, 'Max concurrent requests must never exceed 2');

    const currentQueue = queue.getQueue();
    const processingCount = currentQueue.filter(i => i.status === 'processing').length;
    const waitingCount = currentQueue.filter(i => i.status === 'waiting').length;

    assert.strictEqual(processingCount, 2, 'Exactly 2 jobs should be in processing state');
    assert.strictEqual(waitingCount, 2, 'Remaining 2 jobs should be waiting');
  });

  // ============================================================================
  // SUITE 3: Auto-Advance / Auto-Dequeue & Completion Lifecycle
  // ============================================================================
  console.log('\n[Suite 3] Auto-Advance & Lifecycle Management');

  runAsyncTest('3.1: Completing job 1 automatically dequeues and launches waiting job 3', async () => {
    let jobCounter = 0;
    const customFetch = async (url) => {
      if (url.includes('/jobs')) {
        jobCounter++;
        return {
          ok: true,
          status: 202,
          json: async () => ({
            success: true,
            data: { job_id: 'job_' + jobCounter, status: 'PROCESSING' },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const env = createTestEnvironment(customFetch);
    const queue = env.ctx.window.pdfLinguaBatchQueue;
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;

    queue.addFiles([
      { name: 'a.pdf', size: 100 },
      { name: 'b.pdf', size: 200 },
      { name: 'c.pdf', size: 300 },
    ]);

    orchestrator.startBatch();
    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(orchestrator.activeCount, 2);
    assert.strictEqual(env.fakeEventSources.length, 2);

    // Finish Job 1 via EventSource COMPLETED event
    const es1 = env.fakeEventSources[0];
    es1.emit({
      status: 'COMPLETED',
      progress_percentage: 100,
      message: 'Hoàn thành dịch thuật!',
      result: { translated_text: 'Kết quả file A' },
    });

    await new Promise(r => setTimeout(r, 20));

    // Job 1 should be completed, Job 3 should now be launched!
    assert.strictEqual(env.fakeEventSources.length, 3, 'Job 3 must be launched upon Job 1 completion');
    assert.strictEqual(orchestrator.activeCount, 2, 'Active count remains 2 (Job 2 and Job 3)');

    const qState = queue.getQueue();
    assert.strictEqual(qState[0].status, 'completed');
    assert.strictEqual(qState[1].status, 'processing');
    assert.strictEqual(qState[2].status, 'processing');
  });

  runAsyncTest('3.2: When all jobs finish, onBatchComplete displays ZIP button and shows success toast', async () => {
    const customFetch = async () => ({
      ok: true,
      status: 202,
      json: async () => ({ success: true, data: { job_id: 'job_all', status: 'PROCESSING' } }),
    });

    const env = createTestEnvironment(customFetch);
    const queue = env.ctx.window.pdfLinguaBatchQueue;
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;

    queue.addFiles([{ name: 'single.pdf', size: 500 }]);
    orchestrator.startBatch();
    await new Promise(r => setTimeout(r, 20));

    const es = env.fakeEventSources[0];
    es.emit({
      status: 'COMPLETED',
      progress_percentage: 100,
      message: 'Hoàn thành!',
      result: { translated_text: 'Done!' },
    });

    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(orchestrator.isProcessing, false);
    assert.strictEqual(env.elements['btnDownloadBatchZip'].style.display, 'inline-flex');
    assert.strictEqual(env.elements['batchQueueFooter'].style.display, 'block');
    assert.ok(env.toasts.some(t => t.type === 'success' && t.msg.includes('thành công')));
  });

  // ============================================================================
  // SUITE 4: Resilience & Error Handling
  // ============================================================================
  console.log('\n[Suite 4] Failure Resilience & Error Handling');

  runAsyncTest('4.1: A failed job does not halt remaining batch items; ZIP download available for successful items', async () => {
    let counter = 0;
    const customFetch = async (url) => {
      counter++;
      return {
        ok: true,
        status: 202,
        json: async () => ({ success: true, data: { job_id: 'job_f_' + counter, status: 'PROCESSING' } }),
      };
    };

    const env = createTestEnvironment(customFetch);
    const queue = env.ctx.window.pdfLinguaBatchQueue;
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;

    queue.addFiles([
      { name: 'fail.pdf', size: 100 },
      { name: 'pass.pdf', size: 200 },
    ]);

    orchestrator.startBatch();
    await new Promise(r => setTimeout(r, 20));

    // Job 1 fails
    env.fakeEventSources[0].emit({
      status: 'FAILED',
      error: 'OCR nhận diện trang thất bại.',
    });

    // Job 2 succeeds
    env.fakeEventSources[1].emit({
      status: 'COMPLETED',
      progress_percentage: 100,
      result: { translated_text: 'Bản dịch' },
    });

    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(orchestrator.isProcessing, false);
    assert.strictEqual(orchestrator.completedJobs.length, 1);
    assert.strictEqual(orchestrator.failedJobs.length, 1);

    // ZIP download button must still be available
    assert.strictEqual(env.elements['btnDownloadBatchZip'].style.display, 'inline-flex');
    assert.strictEqual(env.elements['batchFooterNotice'].style.display, 'block');
    assert.ok(env.elements['batchFooterNotice'].textContent.includes('1 tệp thất bại'));
  });

  // ============================================================================
  // SUITE 5: Page Selection Safety
  // ============================================================================
  console.log('\n[Suite 5] Page Selection Safety across Batch Queue');

  runAsyncTest('5.1: Custom page range does NOT bleed to other files in batch queue', async () => {
    const sentFormDatas = [];
    const customFetch = async (url, options) => {
      if (url.includes('/jobs')) {
        sentFormDatas.push(options.body.entries);
        return {
          ok: true,
          status: 202,
          json: async () => ({ success: true, data: { job_id: 'job_p_' + sentFormDatas.length } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const env = createTestEnvironment(customFetch);
    const queue = env.ctx.window.pdfLinguaBatchQueue;
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;

    // Add file 1 and file 2
    queue.addFiles([
      { name: 'first.pdf', size: 100 },
      { name: 'second.pdf', size: 200 },
    ]);

    // Set custom page range on active UI (simulate user entering range '1-3')
    env.ctx.validatePageSelection = () => ({ valid: true, mode: 'custom', pages: '1-3' });

    orchestrator.startBatch();
    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(sentFormDatas.length, 2);

    // In batch mode with multiple files, neither file should arbitrarily inherit '1-3' unless explicitly set per-item
    assert.strictEqual(sentFormDatas[0].pages, undefined, 'File 1 in batch must not be forced with bleed page selection');
    assert.strictEqual(sentFormDatas[1].pages, undefined, 'File 2 in batch must default to all pages');
  });

  // ============================================================================
  // SUITE 6: UI Locking During Batch Processing
  // ============================================================================
  console.log('\n[Suite 6] Queue UI Locking');

  runAsyncTest('6.1: Queue actions and remove buttons are disabled while batch is processing', async () => {
    const customFetch = async () => ({
      ok: true,
      status: 202,
      json: async () => ({ success: true, data: { job_id: 'job_lock' } }),
    });

    const env = createTestEnvironment(customFetch);
    const queue = env.ctx.window.pdfLinguaBatchQueue;
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;

    queue.addFiles([{ name: 'test.pdf', size: 100 }]);

    orchestrator.startBatch();
    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(env.elements['btnAddMoreFiles'].disabled, true);
    assert.strictEqual(env.elements['btnClearBatchQueue'].disabled, true);
    assert.strictEqual(env.elements['btnProcessPdf'].disabled, true);

    // Finish job
    env.fakeEventSources[0].emit({ status: 'COMPLETED', result: {} });
    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(env.elements['btnAddMoreFiles'].disabled, false);
    assert.strictEqual(env.elements['btnClearBatchQueue'].disabled, false);
    assert.strictEqual(env.elements['btnProcessPdf'].disabled, false);
  });

  // ============================================================================
  // SUITE 7: Batch ZIP Download Trigger & API Integration
  // ============================================================================
  console.log('\n[Suite 7] Batch ZIP Download API Integration');

  runAsyncTest('7.1: downloadBatchZip sends correct job_ids and triggers download of PDFLingua_Batch_Results.zip', async () => {
    let downloadPayload = null;
    let downloadHeaders = null;

    const customFetch = async (url, options) => {
      if (url.includes('/batch-download')) {
        downloadPayload = JSON.parse(options.body);
        downloadHeaders = options.headers;
        return {
          ok: true,
          status: 200,
          blob: async () => ({ size: 5000, type: 'application/zip' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const env = createTestEnvironment(customFetch);
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;

    // Simulate 2 completed jobs
    orchestrator.completedJobs = [
      { job_id: 'job_alpha', status: 'completed' },
      { job_id: 'job_beta', status: 'completed' },
    ];

    env.ctx.localStorage.setItem('pdfl_access_token', 'mock_token_xyz');

    await orchestrator.downloadBatchZip();

    assert.ok(downloadPayload, 'POST /batch-download must be called');
    assert.deepStrictEqual(downloadPayload.job_ids, ['job_alpha', 'job_beta']);
    assert.strictEqual(downloadHeaders['Authorization'], 'Bearer mock_token_xyz');
    assert.strictEqual(env.downloads.length, 1);
    assert.strictEqual(env.downloads[0].download, 'PDFLingua_Batch_Results.zip');
    assert.ok(env.toasts.some(t => t.type === 'success' && t.msg.includes('ZIP')));
  });

  runAsyncTest('7.2: downloadBatchZip handles 401 unauthenticated with appropriate message', async () => {
    const customFetch = async (url) => {
      if (url.includes('/batch-download')) {
        return { ok: false, status: 401 };
      }
      return { ok: true, status: 200 };
    };

    const env = createTestEnvironment(customFetch);
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;
    orchestrator.completedJobs = [{ job_id: 'job_401', status: 'completed' }];

    await orchestrator.downloadBatchZip();

    assert.ok(env.toasts.some(t => t.type === 'warning' && t.msg.includes('đăng nhập')));
  });

  runAsyncTest('7.3: downloadBatchZip with format=docx downloads Word ZIP for Pro user', async () => {
    let downloadPayload = null;
    const customFetch = async (url, options) => {
      if (url.includes('/batch-download')) {
        downloadPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          blob: async () => ({ size: 8000, type: 'application/zip' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const env = createTestEnvironment(customFetch);
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;
    orchestrator.completedJobs = [{ job_id: 'job_pro_w1', status: 'completed' }];

    // Pro user logged in
    env.ctx.localStorage.setItem('pdfl_user', JSON.stringify({ id: 10, role: 'pro' }));

    await orchestrator.downloadBatchZip('docx');

    assert.ok(downloadPayload, 'POST /batch-download must be dispatched');
    assert.strictEqual(downloadPayload.format, 'docx', 'Format must be docx');
    assert.strictEqual(env.downloads.length, 1);
    assert.strictEqual(env.downloads[0].download, 'PDFLingua_Batch_Word_Results.zip');
  });

  runAsyncTest('7.4: downloadBatchZip with format=docx blocks Free user and shows Pro warning', async () => {
    let fetchCalled = false;
    const customFetch = async () => {
      fetchCalled = true;
      return { ok: true, status: 200 };
    };

    const env = createTestEnvironment(customFetch);
    const orchestrator = env.ctx.window.pdfLinguaBatchOrchestrator;
    orchestrator.completedJobs = [{ job_id: 'job_free_w1', status: 'completed' }];

    // Free user
    env.ctx.localStorage.setItem('pdfl_user', JSON.stringify({ id: 11, role: 'free' }));

    await orchestrator.downloadBatchZip('docx');

    assert.strictEqual(fetchCalled, false, 'Fetch must not be dispatched for Free user on docx export');
    assert.ok(env.toasts.some(t => t.type === 'warning' && t.msg.includes('Pro')));
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================
  setTimeout(() => {
    console.log(`\n=================================================================`);
    console.log(`KẾT QUẢ TEST SUITE PDFL-252.2: ${passedTests}/${totalTests} BÀI KIỂM TRA THÀNH CÔNG.`);
    console.log(`=================================================================`);
    if (passedTests === totalTests) {
      console.log('✓ TẤT CẢ CÁC BÀI TEST PDFL-252.2 ĐỀU ĐẠT CHUẨN HOÀN TOÀN!\n');
      process.exit(0);
    } else {
      console.error(`✗ CÓ ${totalTests - passedTests} BÀI TEST THẤT BÀI.\n`);
      process.exit(1);
    }
  }, 250);
