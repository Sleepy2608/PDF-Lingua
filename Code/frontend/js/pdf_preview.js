/**
 * PDF-Lingua - PDF.js Canvas Preview & Page Navigation Controls (PDFL-256.1)
 * --------------------------------------------------------------------------
 * Provides interactive client-side PDF document rendering on an HTML5 Canvas:
 * - PDF document loading from File, Blob, ArrayBuffer, or Blob/HTTP URL.
 * - Dynamic page rendering with HiDPI (devicePixelRatio) sharpness support.
 * - Previous / Next navigation controls with automated boundary disabling.
 * - Direct page jumping via number input with Enter key or blur validation.
 * - Zoom In (+20%), Zoom Out (-20%), and Fit-to-Container calculation.
 * - Smooth cancellation handling for rapid page flipping (RenderingCancelledException).
 * - Responsive viewport container with sleek scrollbars and shadow framing.
 */

(function (global) {
  'use strict';

  // Configure PDF.js Worker if pdfjsLib is present
  const PDFJS_WORKER_URL =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  if (typeof window !== 'undefined' && window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  }

  // Internal Preview State
  let pdfDoc = null;
  let currentPageNum = 1;
  let totalPageCount = 0;
  let currentScale = 1.0;
  let currentRenderTask = null;
  let currentLoadingTask = null;
  let currentBlobUrl = null;
  let currentRenderSequence = 0;
  let isLoading = false;
  let isCollapsed = false;
  let isFitMode = false;
  let listenersInitialized = false;
  let resizeTimer = null;

  // Zoom bounds
  const MIN_SCALE = 0.4;
  const MAX_SCALE = 3.0;
  const SCALE_STEP = 0.2;

  /**
   * Helper: Get DOM element safely by ID
   */
  function getEl(id) {
    return document.getElementById(id);
  }

  /**
   * Helper: Get URL object safely across browser and test environments
   */
  function getURL() {
    if (typeof window !== 'undefined' && window.URL) return window.URL;
    if (typeof URL !== 'undefined') return URL;
    return null;
  }

  /**
   * Helper: Show or hide loading indicator
   */
  function setLoadingState(loading, message) {
    isLoading = loading;
    const loadingEl = getEl('pdfPreviewLoading');
    const errorEl = getEl('pdfPreviewError');
    const canvasWrap = getEl('pdfCanvasWrap');

    if (loadingEl) {
      loadingEl.style.display = loading ? 'flex' : 'none';
      if (message) {
        const textEl = loadingEl.querySelector('.preview-loading-text');
        if (textEl) textEl.textContent = message;
      }
    }

    if (loading && errorEl) {
      errorEl.style.display = 'none';
    }

    if (canvasWrap) {
      canvasWrap.style.opacity = loading ? '0.5' : '1';
    }
  }

  /**
   * Helper: Show error state inside preview container
   */
  function showPreviewError(errorMessage) {
    setLoadingState(false);
    const errorEl = getEl('pdfPreviewError');
    const errorMsgEl = getEl('pdfPreviewErrorMsg');
    const canvasWrap = getEl('pdfCanvasWrap');

    if (errorEl) {
      errorEl.style.display = 'flex';
      if (errorMsgEl) {
        errorMsgEl.textContent =
          errorMessage || 'Không thể hiển thị bản xem trước tệp PDF.';
      }
    }

    if (canvasWrap) {
      canvasWrap.style.display = 'none';
    }

    updateControlsUI();
  }

  /**
   * Helper: Clear error state and show canvas
   */
  function clearPreviewError() {
    const errorEl = getEl('pdfPreviewError');
    const canvasWrap = getEl('pdfCanvasWrap');

    if (errorEl) errorEl.style.display = 'none';
    if (canvasWrap) canvasWrap.style.display = 'block';
  }

  /**
   * Helper: Update navigation & zoom controls in UI
   */
  function updateControlsUI() {
    const btnPrev = getEl('btnPrevPage');
    const btnNext = getEl('btnNextPage');
    const pageInput = getEl('previewPageInput');
    const totalPagesSpan = getEl('previewTotalPages');
    const zoomLevelSpan = getEl('previewZoomLevel');
    const btnZoomIn = getEl('btnZoomIn');
    const btnZoomOut = getEl('btnZoomOut');
    const btnZoomFit = getEl('btnZoomFit');

    const hasDoc = Boolean(pdfDoc && totalPageCount > 0);

    if (totalPagesSpan) {
      totalPagesSpan.textContent = hasDoc ? String(totalPageCount) : '1';
    }

    if (pageInput) {
      pageInput.value = hasDoc ? currentPageNum : 1;
      pageInput.min = 1;
      pageInput.max = hasDoc ? totalPageCount : 1;
      pageInput.disabled = !hasDoc;
    }

    if (btnPrev) {
      btnPrev.disabled = !hasDoc || currentPageNum <= 1;
    }

    if (btnNext) {
      btnNext.disabled = !hasDoc || currentPageNum >= totalPageCount;
    }

    if (btnZoomIn) {
      btnZoomIn.disabled = !hasDoc || currentScale >= MAX_SCALE;
    }

    if (btnZoomOut) {
      btnZoomOut.disabled = !hasDoc || currentScale <= MIN_SCALE;
    }

    if (btnZoomFit) {
      btnZoomFit.disabled = !hasDoc;
    }

    if (zoomLevelSpan) {
      zoomLevelSpan.textContent = `${Math.round(currentScale * 100)}%`;
    }
  }

  /**
   * Load PDF preview from a File, Blob, ArrayBuffer, or URL.
   * @param {File|Blob|ArrayBuffer|string} pdfDataOrUrl - Source PDF object or URL
   * @returns {Promise<boolean>} True if loaded successfully, false otherwise
   */
  async function loadPdfPreview(pdfDataOrUrl) {
    if (!pdfDataOrUrl) {
      showPreviewError('Không có dữ liệu tệp PDF hợp lệ.');
      return false;
    }

    // Clean up any in-flight loading task from previous load
    if (currentLoadingTask && typeof currentLoadingTask.destroy === 'function') {
      try {
        currentLoadingTask.destroy();
      } catch (_e) {}
      currentLoadingTask = null;
    }

    // Destroy existing PDF document to free memory
    if (pdfDoc && typeof pdfDoc.destroy === 'function') {
      try {
        pdfDoc.destroy();
      } catch (_e) {}
      pdfDoc = null;
    }

    // Clean up any previously created Object URL to avoid memory leaks
    const urlHelper = getURL();
    if (currentBlobUrl && urlHelper && typeof urlHelper.revokeObjectURL === 'function') {
      try {
        urlHelper.revokeObjectURL(currentBlobUrl);
      } catch (_e) {}
      currentBlobUrl = null;
    }

    // Cancel any active render task
    if (currentRenderTask) {
      try {
        currentRenderTask.cancel();
      } catch (_e) {}
      currentRenderTask = null;
    }

    setLoadingState(true, 'Đang chuẩn bị bản xem trước PDF...');
    clearPreviewError();

    const previewContainer = getEl('pdfPreviewContainer');
    if (previewContainer) {
      previewContainer.style.display = 'block';
    }

    try {
      const pdfjs = (typeof window !== 'undefined' && window.pdfjsLib) ? window.pdfjsLib : null;
      if (!pdfjs || typeof pdfjs.getDocument !== 'function') {
        throw new Error('Thư viện PDF.js chưa được tải hoặc không khả dụng.');
      }

      // Ensure worker is configured
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      }

      let loadingTask = null;

      // Determine parameter format for pdfjs.getDocument
      if (typeof pdfDataOrUrl === 'string') {
        loadingTask = pdfjs.getDocument({
          url: pdfDataOrUrl,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        });
      } else if (pdfDataOrUrl instanceof ArrayBuffer || (pdfDataOrUrl && pdfDataOrUrl.buffer instanceof ArrayBuffer)) {
        loadingTask = pdfjs.getDocument({
          data: pdfDataOrUrl,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        });
      } else if (
        (typeof Blob !== 'undefined' && pdfDataOrUrl instanceof Blob) ||
        (pdfDataOrUrl && (typeof pdfDataOrUrl.arrayBuffer === 'function' || pdfDataOrUrl.type !== undefined || pdfDataOrUrl.size !== undefined))
      ) {
        if (typeof pdfDataOrUrl.arrayBuffer === 'function') {
          const buffer = await pdfDataOrUrl.arrayBuffer();
          loadingTask = pdfjs.getDocument({
            data: new Uint8Array(buffer),
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
          });
        } else if (urlHelper && typeof urlHelper.createObjectURL === 'function') {
          currentBlobUrl = urlHelper.createObjectURL(pdfDataOrUrl);
          loadingTask = pdfjs.getDocument({
            url: currentBlobUrl,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
          });
        } else {
          throw new Error('Không hỗ trợ định dạng Blob trong môi trường này.');
        }
      } else if (typeof pdfDataOrUrl === 'object' && pdfDataOrUrl.data) {
        loadingTask = pdfjs.getDocument(pdfDataOrUrl);
      } else {
        throw new Error('Định dạng dữ liệu PDF không được hỗ trợ.');
      }

      currentLoadingTask = loadingTask;
      const doc = await loadingTask.promise;
      if (currentLoadingTask === loadingTask) {
        currentLoadingTask = null;
      }

      pdfDoc = doc;
      totalPageCount = doc.numPages || 1;
      currentPageNum = 1;
      currentScale = 1.0;
      isFitMode = false;

      // Update filename in header if available
      const docNameEl = getEl('previewDocName');
      if (docNameEl) {
        if (pdfDataOrUrl && typeof pdfDataOrUrl.name === 'string') {
          docNameEl.textContent = pdfDataOrUrl.name;
        } else if (typeof pdfDataOrUrl === 'string') {
          const rawName = pdfDataOrUrl.split('/').pop() || '';
          docNameEl.textContent = rawName.split('?')[0] || 'Bản gốc';
        }
      }

      setLoadingState(false);
      clearPreviewError();
      updateControlsUI();

      // Render the first page
      await renderPage(1);
      return true;

    } catch (err) {
      if (currentLoadingTask) {
        currentLoadingTask = null;
      }
      if (currentBlobUrl && urlHelper && typeof urlHelper.revokeObjectURL === 'function') {
        try {
          urlHelper.revokeObjectURL(currentBlobUrl);
        } catch (_e) {}
        currentBlobUrl = null;
      }
      console.error('Lỗi khi tải tài liệu PDF:', err);
      const msg = err && err.message ? err.message : 'Lỗi khi giải mã tệp PDF.';
      showPreviewError(`Không thể tải trước PDF: ${msg}`);
      return false;
    }
  }

  /**
   * Render a specific page onto the preview canvas according to currentScale.
   * Cancels any in-flight rendering task cleanly before starting.
   * @param {number} pageNum - 1-based page index to render
   * @returns {Promise<boolean>}
   */
  async function renderPage(pageNum) {
    if (!pdfDoc) return false;

    // Boundary check
    let targetPage = parseInt(pageNum, 10);
    if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
    if (targetPage > totalPageCount) targetPage = totalPageCount;

    const thisSequence = ++currentRenderSequence;

    // Cancel previous render task if active
    if (currentRenderTask) {
      try {
        currentRenderTask.cancel();
      } catch (_e) {}
      currentRenderTask = null;
    }

    const canvas = getEl('pdfPreviewCanvas');
    if (!canvas) return false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    setLoadingState(true, `Đang dựng trang ${targetPage}...`);

    let renderTask = null;

    try {
      const page = await pdfDoc.getPage(targetPage);

      if (thisSequence !== currentRenderSequence) {
        return false;
      }

      // HiDPI / Retina-ready viewport calculations
      const viewport = page.getViewport({ scale: currentScale });
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

      // Internal canvas pixel resolution
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);

      // CSS presentation dimensions
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
        transform: transform,
      };

      if (currentRenderTask) {
        try {
          currentRenderTask.cancel();
        } catch (_e) {}
        currentRenderTask = null;
      }

      renderTask = page.render(renderContext);
      currentRenderTask = renderTask;

      await renderTask.promise;

      // If a newer render sequence started, discard this result
      if (thisSequence !== currentRenderSequence) {
        return false;
      }

      currentPageNum = targetPage;
      setLoadingState(false);
      clearPreviewError();
      updateControlsUI();
      return true;

    } catch (err) {
      // PDF.js raises RenderingCancelledException when canceled intentionally
      if (err && (err.name === 'RenderingCancelledException' || err.message === 'Rendering cancelled')) {
        return false;
      }

      if (thisSequence !== currentRenderSequence) {
        return false;
      }

      console.error('Lỗi khi render trang PDF:', err);
      showPreviewError(`Lỗi khi dựng trang ${targetPage}: ${err.message || 'Không rõ nguyên nhân'}`);
      return false;
    } finally {
      if (currentRenderTask === renderTask) {
        currentRenderTask = null;
      }
    }
  }

  /**
   * Navigate to the previous page
   */
  async function prevPage() {
    if (currentPageNum > 1) {
      return renderPage(currentPageNum - 1);
    }
    return false;
  }

  /**
   * Navigate to the next page
   */
  async function nextPage() {
    if (currentPageNum < totalPageCount) {
      return renderPage(currentPageNum + 1);
    }
    return false;
  }

  /**
   * Jump directly to a given page number with validation
   * @param {number|string} pageValue
   */
  async function goToPage(pageValue) {
    if (!pdfDoc) return false;

    const parsed = parseInt(pageValue, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > totalPageCount) {
      // Revert input to current page
      const input = getEl('previewPageInput');
      if (input) input.value = currentPageNum;
      return false;
    }

    return renderPage(parsed);
  }

  /**
   * Increase zoom scale by STEP
   */
  async function zoomIn() {
    if (!pdfDoc) return false;
    isFitMode = false;
    const newScale = Math.min(MAX_SCALE, Math.round((currentScale + SCALE_STEP) * 10) / 10);
    if (newScale !== currentScale) {
      currentScale = newScale;
      return renderPage(currentPageNum);
    }
    return false;
  }

  /**
   * Decrease zoom scale by STEP
   */
  async function zoomOut() {
    if (!pdfDoc) return false;
    isFitMode = false;
    const newScale = Math.max(MIN_SCALE, Math.round((currentScale - SCALE_STEP) * 10) / 10);
    if (newScale !== currentScale) {
      currentScale = newScale;
      return renderPage(currentPageNum);
    }
    return false;
  }

  /**
   * Calculate zoom scale to fit the viewport container width cleanly
   */
  async function zoomFit() {
    if (!pdfDoc) return false;
    isFitMode = true;

    try {
      const page = await pdfDoc.getPage(currentPageNum);
      const viewport = page.getViewport({ scale: 1.0 });

      const container = getEl('pdfPreviewViewport') || getEl('pdfPreviewContainer');
      const availableWidth = container ? (container.clientWidth - 48) : 800;

      if (availableWidth > 120 && viewport.width > 0) {
        const calculatedScale = availableWidth / viewport.width;
        // Clamp scale within safe bounds
        currentScale = Math.max(MIN_SCALE, Math.min(2.5, Math.round(calculatedScale * 100) / 100));
      } else {
        currentScale = 1.0;
      }

      return renderPage(currentPageNum);
    } catch (err) {
      console.warn('Lỗi khi tính toán fit-to-width:', err);
      currentScale = 1.0;
      return renderPage(currentPageNum);
    }
  }

  /**
   * Recalculate zoom fit when window or viewport resizes
   */
  function handleViewportResize() {
    if (!isFitMode || !pdfDoc || isCollapsed) return;
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isFitMode && pdfDoc && !isCollapsed) {
        zoomFit();
      }
    }, 150);
  }

  /**
   * Toggle collapsing or expanding the preview card
   */
  function togglePdfPreview() {
    const container = getEl('pdfPreviewContainer');
    const viewport = getEl('pdfPreviewViewport');
    const toggleBtn = getEl('btnTogglePdfPreview');

    isCollapsed = !isCollapsed;

    if (container) {
      if (isCollapsed) {
        container.classList.add('collapsed');
      } else {
        container.classList.remove('collapsed');
      }
    }

    if (viewport) {
      viewport.style.display = isCollapsed ? 'none' : 'flex';
    }

    if (toggleBtn) {
      toggleBtn.title = isCollapsed ? 'Mở rộng bản xem trước' : 'Thu gọn bản xem trước';
      toggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    }
  }

  /**
   * Cleanup preview state, revoke URLs, and clear canvas
   */
  function cleanupPdfPreview() {
    if (currentRenderTask) {
      try {
        currentRenderTask.cancel();
      } catch (_e) {}
      currentRenderTask = null;
    }

    if (currentLoadingTask && typeof currentLoadingTask.destroy === 'function') {
      try {
        currentLoadingTask.destroy();
      } catch (_e) {}
      currentLoadingTask = null;
    }

    const urlHelper = getURL();
    if (currentBlobUrl && urlHelper && typeof urlHelper.revokeObjectURL === 'function') {
      try {
        urlHelper.revokeObjectURL(currentBlobUrl);
      } catch (_e) {}
      currentBlobUrl = null;
    }

    if (pdfDoc && typeof pdfDoc.destroy === 'function') {
      try {
        pdfDoc.destroy();
      } catch (_e) {}
      pdfDoc = null;
    }

    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }

    const canvas = getEl('pdfPreviewCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.width = '0px';
      canvas.style.height = '0px';
    }

    pdfDoc = null;
    currentPageNum = 1;
    totalPageCount = 0;
    currentScale = 1.0;
    isFitMode = false;
    isLoading = false;

    clearPreviewError();
    updateControlsUI();

    const previewContainer = getEl('pdfPreviewContainer');
    if (previewContainer) {
      previewContainer.style.display = 'none';
    }
  }

  /**
   * Bind DOM event listeners to preview controls
   */
  function initPdfPreviewListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', handleViewportResize);
    }

    const btnPrev = getEl('btnPrevPage');
    if (btnPrev) {
      btnPrev.addEventListener('click', (e) => {
        e.preventDefault();
        return prevPage();
      });
    }

    const btnNext = getEl('btnNextPage');
    if (btnNext) {
      btnNext.addEventListener('click', (e) => {
        e.preventDefault();
        return nextPage();
      });
    }

    const pageInput = getEl('previewPageInput');
    if (pageInput) {
      pageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          return goToPage(pageInput.value);
        }
      });
      pageInput.addEventListener('change', () => {
        return goToPage(pageInput.value);
      });
    }

    const btnIn = getEl('btnZoomIn');
    if (btnIn) {
      btnIn.addEventListener('click', (e) => {
        e.preventDefault();
        return zoomIn();
      });
    }

    const btnOut = getEl('btnZoomOut');
    if (btnOut) {
      btnOut.addEventListener('click', (e) => {
        e.preventDefault();
        return zoomOut();
      });
    }

    const btnFit = getEl('btnZoomFit');
    if (btnFit) {
      btnFit.addEventListener('click', (e) => {
        e.preventDefault();
        return zoomFit();
      });
    }

    const btnToggle = getEl('btnTogglePdfPreview');
    if (btnToggle) {
      btnToggle.addEventListener('click', (e) => {
        e.preventDefault();
        togglePdfPreview();
      });
    }

    // Optional keyboard navigation inside the preview viewport
    const viewport = getEl('pdfPreviewViewport');
    if (viewport) {
      viewport.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          return prevPage();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          return nextPage();
        }
      });
    }
  }

  // Auto-init on DOMContentLoaded if running in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPdfPreviewListeners);
    } else {
      initPdfPreviewListeners();
    }
  }

  // Export public API
  const pdfLinguaPreview = {
    loadPdfPreview,
    renderPage,
    prevPage,
    nextPage,
    goToPage,
    zoomIn,
    zoomOut,
    zoomFit,
    togglePdfPreview,
    cleanupPdfPreview,
    initPdfPreviewListeners,
    handleViewportResize,
    getCurrentPage: () => currentPageNum,
    getTotalPages: () => totalPageCount,
    getCurrentScale: () => currentScale,
    getPdfDoc: () => pdfDoc,
    isLoading: () => isLoading,
    isCollapsed: () => isCollapsed,
    isFitMode: () => isFitMode,
  };

  if (typeof window !== 'undefined') {
    window.pdfLinguaPreview = pdfLinguaPreview;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = pdfLinguaPreview;
  }

})(typeof window !== 'undefined' ? window : globalThis);
