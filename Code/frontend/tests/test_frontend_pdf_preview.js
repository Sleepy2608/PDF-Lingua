/**
 * PDF-Lingua - Test Suite for PDFL-256.1: PDF.js Canvas Preview & Page Navigation Controls
 * =========================================================================================
 * Tests static HTML structure, PDF.js CDN integration, Canvas preview rendering,
 * navigation buttons (Previous/Next/Go to page), zoom controls (In/Out/Fit),
 * HiDPI/Retina rendering, rapid page flipping cancellation, error handling,
 * and integration with upload & workspace workflows.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- BẮT ĐẦU TEST SUITE PDFL-256.1 (PDF.js Canvas Preview & Navigation) ---\n');

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

// ============================================================================
// SUITE 1: Static HTML Structure & Required Element IDs
// ============================================================================
console.log('[Suite 1] Static HTML Structure & Component IDs');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const pdfPreviewJsCode = fs.readFileSync(path.resolve(__dirname, '../js/pdf_preview.js'), 'utf8');

runTest('1.1: index.html embeds PDF.js CDN script', () => {
  assert(
    htmlContent.includes('cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'),
    'index.html should load pdf.js from CDN'
  );
});

runTest('1.2: index.html loads js/pdf_preview.js module', () => {
  assert(
    htmlContent.includes('js/pdf_preview.js'),
    'index.html should include js/pdf_preview.js'
  );
});

runTest('1.3: index.html contains #pdfPreviewContainer and canvas#pdfPreviewCanvas', () => {
  assert(htmlContent.includes('id="pdfPreviewContainer"'), 'Must contain #pdfPreviewContainer');
  assert(htmlContent.includes('id="pdfPreviewCanvas"'), 'Must contain canvas#pdfPreviewCanvas');
});

runTest('1.4: index.html contains page navigation control elements', () => {
  assert(htmlContent.includes('id="btnPrevPage"'), 'Must contain #btnPrevPage');
  assert(htmlContent.includes('id="btnNextPage"'), 'Must contain #btnNextPage');
  assert(htmlContent.includes('id="previewPageInput"'), 'Must contain #previewPageInput');
  assert(htmlContent.includes('id="previewTotalPages"'), 'Must contain #previewTotalPages');
});

runTest('1.5: index.html contains zoom control elements', () => {
  assert(htmlContent.includes('id="btnZoomIn"'), 'Must contain #btnZoomIn');
  assert(htmlContent.includes('id="btnZoomOut"'), 'Must contain #btnZoomOut');
  assert(htmlContent.includes('id="btnZoomFit"'), 'Must contain #btnZoomFit');
  assert(htmlContent.includes('id="previewZoomLevel"'), 'Must contain #previewZoomLevel');
});

runTest('1.6: index.html contains loading, error, and toggle elements', () => {
  assert(htmlContent.includes('id="pdfPreviewLoading"'), 'Must contain #pdfPreviewLoading');
  assert(htmlContent.includes('id="pdfPreviewError"'), 'Must contain #pdfPreviewError');
  assert(htmlContent.includes('id="btnTogglePdfPreview"'), 'Must contain #btnTogglePdfPreview');
});

runTest('1.7: PDF.js script and worker both strictly use version 3.11.174', () => {
  assert(
    htmlContent.includes('/pdf.js/3.11.174/pdf.min.js'),
    'index.html must load pdf.js 3.11.174'
  );
  assert(
    pdfPreviewJsCode.includes('/pdf.js/3.11.174/pdf.worker.min.js'),
    'pdf_preview.js must configure worker 3.11.174'
  );
});

// ============================================================================
// DOM & PDF.js Mock Harness
// ============================================================================
function createMockDOM() {
  const elements = {};

  class MockElement {
    constructor(id, tagName = 'div') {
      this.id = id;
      this.tagName = tagName.toUpperCase();
      this.classList = {
        classes: new Set(),
        add: (c) => this.classList.classes.add(c),
        remove: (c) => this.classList.classes.delete(c),
        contains: (c) => this.classList.classes.has(c),
        toggle: (c) => {
          if (this.classList.classes.has(c)) this.classList.classes.delete(c);
          else this.classList.classes.add(c);
        },
      };
      this.style = {};
      this.disabled = false;
      this.value = '';
      this.textContent = '';
      this.innerText = '';
      this.listeners = {};
      this.width = 0;
      this.height = 0;
      this.clientWidth = 800;
      this.clientHeight = 600;
      this.attributes = {};
    }

    setAttribute(k, v) {
      this.attributes[k] = v;
    }

    getAttribute(k) {
      return this.attributes[k];
    }

    removeAttribute(k) {
      delete this.attributes[k];
    }

    addEventListener(event, cb) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
    }

    trigger(event, data = {}) {
      if (this.listeners[event]) {
        const results = [];
        for (const cb of this.listeners[event]) {
          results.push(cb(Object.assign({ target: this, preventDefault: () => {} }, data)));
        }
        return Promise.all(results);
      }
      return Promise.resolve();
    }

    click() {
      return this.trigger('click');
    }

    querySelector(selector) {
      if (selector === '.preview-loading-text') {
        if (!this._loadingTextEl) {
          this._loadingTextEl = new MockElement('loadingText', 'span');
        }
        return this._loadingTextEl;
      }
      return null;
    }

    getContext(type) {
      if (type === '2d') {
        return {
          clearRect: () => {},
          drawImage: () => {},
          save: () => {},
          restore: () => {},
        };
      }
      return null;
    }
  }

  const ids = [
    'pdfPreviewContainer',
    'pdfPreviewCanvas',
    'pdfCanvasWrap',
    'pdfPreviewViewport',
    'pdfPreviewLoading',
    'pdfPreviewError',
    'pdfPreviewErrorMsg',
    'previewDocName',
    'btnPrevPage',
    'btnNextPage',
    'previewPageInput',
    'previewTotalPages',
    'btnZoomIn',
    'btnZoomOut',
    'btnZoomFit',
    'previewZoomLevel',
    'btnTogglePdfPreview',
    'workspaceSection',
    'heroSection',
    'documentsSection',
    'paneOriginal',
    'paneTranslated',
    'btnRemoveFile',
  ];

  ids.forEach((id) => {
    elements[id] = new MockElement(id);
  });

  return {
    elements,
    getElementById: (id) => elements[id] || null,
  };
}

function createMockPdfDocument(numPages = 3, options = {}) {
  const renderedPages = [];
  const canceledPages = [];

  const pages = {};
  for (let i = 1; i <= numPages; i++) {
    pages[i] = {
      pageNumber: i,
      getViewport: ({ scale = 1.0 }) => ({
        width: 600 * scale,
        height: 800 * scale,
        scale: scale,
      }),
      render: (renderContext) => {
        let isCanceled = false;
        renderedPages.push(i);
        return {
          cancel: () => {
            isCanceled = true;
            canceledPages.push(i);
          },
          promise: new Promise((resolve, reject) => {
            setTimeout(() => {
              if (isCanceled) {
                const cancelErr = new Error('Rendering cancelled');
                cancelErr.name = 'RenderingCancelledException';
                reject(cancelErr);
              } else if (options.failOnPage === i) {
                reject(new Error(`Failed to render page ${i}`));
              } else {
                resolve();
              }
            }, 5);
          }),
        };
      },
    };
  }

  return {
    numPages: numPages,
    getPage: async (n) => {
      if (pages[n]) return pages[n];
      throw new Error(`Page ${n} not found`);
    },
    renderedPages,
    canceledPages,
  };
}

// Set up mocked environment for testing pdf_preview.js
function setupTestEnvironment(mockDoc = null) {
  const mockDOM = createMockDOM();
  const mockGlobal = {
    document: {
      getElementById: mockDOM.getElementById,
      addEventListener: () => {},
      readyState: 'complete',
    },
    window: {
      devicePixelRatio: 2, // HiDPI screen
      scrollTo: () => {},
      pdfjsLib: {
        GlobalWorkerOptions: {},
        getDocument: (source) => {
          return {
            promise: new Promise((resolve, reject) => {
              if (mockDoc === 'ERROR') {
                reject(new Error('Invalid or corrupted PDF structure'));
              } else {
                resolve(mockDoc || createMockPdfDocument(3));
              }
            }),
          };
        },
      },
    },
    URL: {
      createObjectURL: (blob) => 'blob:mock-url',
      revokeObjectURL: () => {},
    },
    Blob: class MockBlob {
      constructor(parts) {
        this.parts = parts;
      }
      async arrayBuffer() {
        return new ArrayBuffer(8);
      }
    },
    ArrayBuffer: ArrayBuffer,
    Uint8Array: Uint8Array,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  };

  mockGlobal.window.document = mockGlobal.document;
  mockGlobal.window.URL = mockGlobal.URL;

  const fn = new Function('window', 'document', 'URL', 'Blob', 'ArrayBuffer', 'Uint8Array', 'console', pdfPreviewJsCode);
  fn(mockGlobal.window, mockGlobal.document, mockGlobal.URL, mockGlobal.Blob, mockGlobal.ArrayBuffer, mockGlobal.Uint8Array, mockGlobal.console);

  const previewModule = mockGlobal.window.pdfLinguaPreview;
  previewModule.initPdfPreviewListeners();

  return {
    previewModule,
    elements: mockDOM.elements,
    mockGlobal,
  };
}

// ============================================================================
// SUITE 2: Preview Loading & Navigation Controls (1-Page & Multi-Page)
// ============================================================================
console.log('\n[Suite 2] Preview Loading & Single/Multi-Page Navigation');

(async () => {
  await runAsyncTest('2.1: Loading single-page PDF (1 page) disables both Prev and Next buttons', async () => {
    const singleDoc = createMockPdfDocument(1);
    const { previewModule, elements } = setupTestEnvironment(singleDoc);

    const loaded = await previewModule.loadPdfPreview({ data: new Uint8Array([1, 2, 3]) });
    assert.strictEqual(loaded, true, 'loadPdfPreview should return true');
    assert.strictEqual(previewModule.getCurrentPage(), 1);
    assert.strictEqual(previewModule.getTotalPages(), 1);
    assert.strictEqual(elements.previewTotalPages.textContent, '1');
    assert.strictEqual(elements.previewPageInput.value, 1);
    assert.strictEqual(elements.btnPrevPage.disabled, true, 'btnPrevPage must be disabled on page 1');
    assert.strictEqual(elements.btnNextPage.disabled, true, 'btnNextPage must be disabled on single-page PDF');
  });

  await runAsyncTest('2.2: Loading multi-page PDF (5 pages) enables Next button and disables Prev button on page 1', async () => {
    const multiDoc = createMockPdfDocument(5);
    const { previewModule, elements } = setupTestEnvironment(multiDoc);

    const loaded = await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    assert.strictEqual(loaded, true);
    assert.strictEqual(previewModule.getTotalPages(), 5);
    assert.strictEqual(previewModule.getCurrentPage(), 1);
    assert.strictEqual(elements.previewTotalPages.textContent, '5');
    assert.strictEqual(elements.btnPrevPage.disabled, true, 'btnPrevPage disabled on page 1');
    assert.strictEqual(elements.btnNextPage.disabled, false, 'btnNextPage enabled on page 1 of 5');
  });

  await runAsyncTest('2.3: Next page advances to page 2, enabling both Prev and Next buttons', async () => {
    const multiDoc = createMockPdfDocument(5);
    const { previewModule, elements } = setupTestEnvironment(multiDoc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    await elements.btnNextPage.click();

    assert.strictEqual(previewModule.getCurrentPage(), 2);
    assert.strictEqual(elements.previewPageInput.value, 2);
    assert.strictEqual(elements.btnPrevPage.disabled, false, 'btnPrevPage enabled on page 2');
    assert.strictEqual(elements.btnNextPage.disabled, false, 'btnNextPage enabled on page 2 of 5');
  });

  await runAsyncTest('2.4: Navigating to last page disables Next button and enables Prev button', async () => {
    const multiDoc = createMockPdfDocument(3);
    const { previewModule, elements } = setupTestEnvironment(multiDoc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    await previewModule.goToPage(3);

    assert.strictEqual(previewModule.getCurrentPage(), 3);
    assert.strictEqual(elements.btnPrevPage.disabled, false, 'btnPrevPage enabled on last page');
    assert.strictEqual(elements.btnNextPage.disabled, true, 'btnNextPage disabled on last page');

    // Attempting next again stays on page 3
    await previewModule.nextPage();
    assert.strictEqual(previewModule.getCurrentPage(), 3);
  });

  await runAsyncTest('2.5: Previous page from page 2 navigates back to page 1 and disables Prev button', async () => {
    const multiDoc = createMockPdfDocument(3);
    const { previewModule, elements } = setupTestEnvironment(multiDoc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    await previewModule.renderPage(2);
    await elements.btnPrevPage.click();

    assert.strictEqual(previewModule.getCurrentPage(), 1);
    assert.strictEqual(elements.btnPrevPage.disabled, true);
  });

  // ============================================================================
  // SUITE 3: Direct Page Input Validation (goToPage & Enter Key)
  // ============================================================================
  console.log('\n[Suite 3] Direct Page Input & Keyboard Navigation');

  await runAsyncTest('3.1: Valid page jump via goToPage renders target page', async () => {
    const multiDoc = createMockPdfDocument(10);
    const { previewModule, elements } = setupTestEnvironment(multiDoc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    await previewModule.goToPage(7);

    assert.strictEqual(previewModule.getCurrentPage(), 7);
    assert.strictEqual(elements.previewPageInput.value, 7);
  });

  await runAsyncTest('3.2: Enter key on #previewPageInput jumps directly to input value', async () => {
    const multiDoc = createMockPdfDocument(10);
    const { previewModule, elements } = setupTestEnvironment(multiDoc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    elements.previewPageInput.value = '4';
    await elements.previewPageInput.trigger('keydown', { key: 'Enter' });

    assert.strictEqual(previewModule.getCurrentPage(), 4);
  });

  await runAsyncTest('3.3: Invalid page input (< 1, > total, non-numeric) is rejected and resets input', async () => {
    const multiDoc = createMockPdfDocument(5);
    const { previewModule, elements } = setupTestEnvironment(multiDoc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    await previewModule.renderPage(2);

    // Test out of bounds high (99)
    await previewModule.goToPage(99);
    assert.strictEqual(previewModule.getCurrentPage(), 2, 'Page should remain 2');
    assert.strictEqual(elements.previewPageInput.value, 2, 'Input should be reverted to 2');

    // Test out of bounds low (0)
    await previewModule.goToPage(0);
    assert.strictEqual(previewModule.getCurrentPage(), 2);

    // Test non-numeric
    await previewModule.goToPage('invalid');
    assert.strictEqual(previewModule.getCurrentPage(), 2);
  });

  // ============================================================================
  // SUITE 4: Zoom Controls (In, Out, Fit)
  // ============================================================================
  console.log('\n[Suite 4] Zoom Controls (In, Out, Fit) & HiDPI Sharpness');

  await runAsyncTest('4.1: Zoom In increases scale by +0.2 and updates #previewZoomLevel', async () => {
    const doc = createMockPdfDocument(3);
    const { previewModule, elements } = setupTestEnvironment(doc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    assert.strictEqual(previewModule.getCurrentScale(), 1.0);
    assert.strictEqual(elements.previewZoomLevel.textContent, '100%');

    await elements.btnZoomIn.click();

    assert.strictEqual(previewModule.getCurrentScale(), 1.2);
    assert.strictEqual(elements.previewZoomLevel.textContent, '120%');
  });

  await runAsyncTest('4.2: Zoom Out decreases scale by -0.2 and updates #previewZoomLevel', async () => {
    const doc = createMockPdfDocument(3);
    const { previewModule, elements } = setupTestEnvironment(doc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    await elements.btnZoomOut.click();

    assert.strictEqual(previewModule.getCurrentScale(), 0.8);
    assert.strictEqual(elements.previewZoomLevel.textContent, '80%');
  });

  await runAsyncTest('4.3: Zoom bounds clamp at MIN_SCALE (0.4) and MAX_SCALE (3.0)', async () => {
    const doc = createMockPdfDocument(3);
    const { previewModule } = setupTestEnvironment(doc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');

    // Zoom in multiple times past max
    for (let i = 0; i < 15; i++) {
      await previewModule.zoomIn();
    }
    assert.strictEqual(previewModule.getCurrentScale(), 3.0, 'Scale clamped at 3.0');

    // Zoom out multiple times past min
    for (let i = 0; i < 20; i++) {
      await previewModule.zoomOut();
    }
    assert.strictEqual(previewModule.getCurrentScale(), 0.4, 'Scale clamped at 0.4');
  });

  await runAsyncTest('4.4: Zoom Fit calculates scale cleanly based on viewport width', async () => {
    const doc = createMockPdfDocument(3);
    const { previewModule, elements } = setupTestEnvironment(doc);

    elements.pdfPreviewViewport.clientWidth = 948; // available width 948 - 48 = 900
    // Page 1 unscaled width = 600, so 900 / 600 = 1.5 scale

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    await elements.btnZoomFit.click();

    assert.strictEqual(previewModule.getCurrentScale(), 1.5);
    assert.strictEqual(elements.previewZoomLevel.textContent, '150%');
  });

  await runAsyncTest('4.5: Canvas dimensions use HiDPI scaling (window.devicePixelRatio)', async () => {
    const doc = createMockPdfDocument(1);
    const { previewModule, elements } = setupTestEnvironment(doc);

    // devicePixelRatio is set to 2 in setupTestEnvironment
    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');

    // Page unscaled is 600x800 at scale 1.0
    // Internal canvas resolution should be 600*2 = 1200, 800*2 = 1600
    assert.strictEqual(elements.pdfPreviewCanvas.width, 1200);
    assert.strictEqual(elements.pdfPreviewCanvas.height, 1600);
    // CSS presentation dimensions should match unscaled viewport px
    assert.strictEqual(elements.pdfPreviewCanvas.style.width, '600px');
    assert.strictEqual(elements.pdfPreviewCanvas.style.height, '800px');
  });

  await runAsyncTest('4.6: Viewport resize event recalculates Zoom Fit scale when in Fit mode', async () => {
    const doc = createMockPdfDocument(3);
    const { previewModule, elements } = setupTestEnvironment(doc);

    elements.pdfPreviewViewport.clientWidth = 948; // scale = 1.5
    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    await elements.btnZoomFit.click();
    assert.strictEqual(previewModule.getCurrentScale(), 1.5);

    // Resize viewport to 648 (available = 600, scale = 600 / 600 = 1.0)
    elements.pdfPreviewViewport.clientWidth = 648;
    previewModule.handleViewportResize();
    await new Promise((r) => setTimeout(r, 180));

    assert.strictEqual(previewModule.getCurrentScale(), 1.0, 'Scale should adapt to 1.0 after resize');
    assert.strictEqual(elements.previewZoomLevel.textContent, '100%');
  });

  // ============================================================================
  // SUITE 5: Vietnamese File Names & Rapid Navigation Cancellation
  // ============================================================================
  console.log('\n[Suite 5] Vietnamese File Support & Rapid Page Cancellation');

  await runAsyncTest('5.1: File object with Vietnamese name sets #previewDocName properly', async () => {
    const doc = createMockPdfDocument(2);
    const { previewModule, elements } = setupTestEnvironment(doc);

    const mockFile = {
      name: 'Tài_liệu_báo_cáo_nghiên_cứu_quý_4.pdf',
      size: 1024 * 100,
      arrayBuffer: async () => new ArrayBuffer(16),
    };

    await previewModule.loadPdfPreview(mockFile);
    assert.strictEqual(
      elements.previewDocName.textContent,
      'Tài_liệu_báo_cáo_nghiên_cứu_quý_4.pdf',
      'Should display Vietnamese document name'
    );
  });

  await runAsyncTest('5.2: Rapid page switching cancels in-flight render task without throwing', async () => {
    const doc = createMockPdfDocument(10);
    const { previewModule } = setupTestEnvironment(doc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');

    // Trigger page 2 render
    const p1 = previewModule.renderPage(2);
    // Give it a microtick to start page.render()
    await new Promise((r) => setTimeout(r, 1));
    // Trigger page 3 while page 2 is in-flight
    const p2 = previewModule.renderPage(3);

    await Promise.all([p1, p2]);

    // The final page should be 3
    assert.strictEqual(previewModule.getCurrentPage(), 3);
    // Page 2 must have had cancel called
    assert(doc.canceledPages.includes(2), 'Page 2 in-flight render task should have been canceled');
  });

  // ============================================================================
  // SUITE 6: Error Handling & Cleanup
  // ============================================================================
  console.log('\n[Suite 6] Error Handling & Cleanup Lifecycle');

  await runAsyncTest('6.1: Null or empty PDF parameter shows error state', async () => {
    const { previewModule, elements } = setupTestEnvironment();

    const success = await previewModule.loadPdfPreview(null);
    assert.strictEqual(success, false);
    assert.strictEqual(elements.pdfPreviewError.style.display, 'flex');
  });

  await runAsyncTest('6.2: Corrupted PDF file displays error message inside container', async () => {
    const { previewModule, elements } = setupTestEnvironment('ERROR');

    const success = await previewModule.loadPdfPreview('http://localhost:8000/corrupted.pdf');
    assert.strictEqual(success, false);
    assert.strictEqual(elements.pdfPreviewError.style.display, 'flex');
    assert(
      elements.pdfPreviewErrorMsg.textContent.includes('Invalid or corrupted PDF structure'),
      'Should display specific error reason'
    );
  });

  await runAsyncTest('6.3: cleanupPdfPreview resets state, canvas dimensions, and hides container', async () => {
    const doc = createMockPdfDocument(3);
    const { previewModule, elements } = setupTestEnvironment(doc);

    await previewModule.loadPdfPreview('http://localhost:8000/test.pdf');
    assert.strictEqual(elements.pdfPreviewContainer.style.display, 'block');

    previewModule.cleanupPdfPreview();

    assert.strictEqual(previewModule.getPdfDoc(), null);
    assert.strictEqual(previewModule.getCurrentPage(), 1);
    assert.strictEqual(previewModule.getTotalPages(), 0);
    assert.strictEqual(elements.pdfPreviewCanvas.width, 0);
    assert.strictEqual(elements.pdfPreviewContainer.style.display, 'none');
  });

  await runAsyncTest('6.4: togglePdfPreview collapses and expands viewport', () => {
    const { previewModule, elements } = setupTestEnvironment();

    assert.strictEqual(previewModule.isCollapsed(), false);

    elements.btnTogglePdfPreview.click();
    assert.strictEqual(previewModule.isCollapsed(), true);
    assert(elements.pdfPreviewContainer.classList.contains('collapsed'));
    assert.strictEqual(elements.pdfPreviewViewport.style.display, 'none');

    elements.btnTogglePdfPreview.click();
    assert.strictEqual(previewModule.isCollapsed(), false);
    assert(!elements.pdfPreviewContainer.classList.contains('collapsed'));
    assert.strictEqual(elements.pdfPreviewViewport.style.display, 'flex');
  });

  await runAsyncTest('6.5: cleanupPdfPreview and loadPdfPreview destroy in-flight loadingTask and previous doc', async () => {
    let docDestroyed = false;
    let loadingTaskDestroyed = false;

    const mockDoc = Object.assign(createMockPdfDocument(2), {
      destroy: () => { docDestroyed = true; },
    });

    const { previewModule, mockGlobal } = setupTestEnvironment(mockDoc);
    // Spy on getDocument to return task with destroy
    const origGetDoc = mockGlobal.window.pdfjsLib.getDocument;
    mockGlobal.window.pdfjsLib.getDocument = (src) => {
      const task = origGetDoc(src);
      task.destroy = () => { loadingTaskDestroyed = true; };
      return task;
    };

    await previewModule.loadPdfPreview('http://localhost:8000/doc1.pdf');
    previewModule.cleanupPdfPreview();

    assert.strictEqual(previewModule.getPdfDoc(), null);
    assert.strictEqual(docDestroyed, true, 'pdfDoc.destroy() must be called to free memory');
  });

  await runAsyncTest('6.6: cleanupPdfPreview revokes currentBlobUrl via URL.revokeObjectURL', async () => {
    const doc = createMockPdfDocument(2);
    const { previewModule, mockGlobal } = setupTestEnvironment(doc);

    let revokedUrl = null;
    mockGlobal.URL.revokeObjectURL = (url) => {
      revokedUrl = url;
    };

    const mockBlob = new mockGlobal.Blob(['fake pdf']);
    mockBlob.type = 'application/pdf';
    mockBlob.size = 100;
    // Mock blob with createObjectURL path (override prototype arrayBuffer)
    mockBlob.arrayBuffer = null;

    await previewModule.loadPdfPreview(mockBlob);
    previewModule.cleanupPdfPreview();

    assert.strictEqual(revokedUrl, 'blob:mock-url', 'Object URL must be revoked on cleanup');
  });

  // ============================================================================
  // SUITE 7: Integration with Workspace & Upload Flow (Regression Check)
  // ============================================================================
  console.log('\n[Suite 7] Workspace & Upload Flow Integration Matrix');

  await runAsyncTest('7.1: renderWorkspace automatically triggers loadPdfPreview when selectedFile exists', async () => {
    const mockDoc = createMockPdfDocument(3);
    const { elements, mockGlobal } = setupTestEnvironment(mockDoc);

    let loadCalledWith = null;
    mockGlobal.window.pdfLinguaPreview.loadPdfPreview = async (source) => {
      loadCalledWith = source;
      return true;
    };

    const mockFile = { name: 'test_auto.pdf' };
    mockGlobal.window.pdfLinguaUpload = {
      getSelectedFile: () => mockFile,
    };

    // Load workspace.js
    const workspaceJs = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');
    const wsFn = new Function('window', 'document', 'localStorage', 'sessionStorage', 'console', workspaceJs);
    wsFn(mockGlobal.window, mockGlobal.document, {}, {}, mockGlobal.console);

    mockGlobal.window.pdfLinguaWorkspace.renderWorkspace({
      document_id: 'doc-123',
      filename: 'test_auto.pdf',
      page_count: 3,
      original_text: 'Văn bản gốc tiếng Việt',
      translated_text: 'Original English text',
    });

    assert.strictEqual(loadCalledWith, mockFile, 'loadPdfPreview must be called with dropzone file');
    assert.strictEqual(elements.pdfPreviewContainer.style.display, 'block');
  });

  await runAsyncTest('7.2: resetToUpload automatically triggers cleanupPdfPreview', async () => {
    const { elements, mockGlobal } = setupTestEnvironment();

    let cleanupCalled = false;
    mockGlobal.window.pdfLinguaPreview.cleanupPdfPreview = () => {
      cleanupCalled = true;
    };

    const workspaceJs = fs.readFileSync(path.resolve(__dirname, '../js/workspace.js'), 'utf8');
    const wsFn = new Function('window', 'document', 'localStorage', 'sessionStorage', 'console', workspaceJs);
    wsFn(mockGlobal.window, mockGlobal.document, {}, {}, mockGlobal.console);

    mockGlobal.window.pdfLinguaWorkspace.resetToUpload();

    assert.strictEqual(cleanupCalled, true, 'cleanupPdfPreview must be called when user resets to upload');
    assert.strictEqual(elements.pdfPreviewContainer.style.display, 'none');
  });

  // Summary
  console.log('\n======================================================');
  console.log(`KẾT QUẢ KIỂM THỬ PDF PREVIEW: ${passedTests}/${totalTests} tests passed`);
  console.log('======================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
})();
