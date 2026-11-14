const API_BASE_URL = 'http://localhost:8000/api/process';
const WORKSPACE_DOC_STORAGE_KEY = 'pdfl_workspace_doc_data';
const ACTIVE_JOB_STORAGE_KEY = 'pdfl_active_job_id';
const ACTIVE_VIEW_STORAGE_KEY = 'pdfl_active_view';
const PENDING_TOAST_STORAGE_KEY = 'pdfl_pending_toast';
const VIEW_MODE_STORAGE_KEY = 'pdfl_workspace_view_mode';

let currentDocData = null;
let currentViewMode = 'split';
let currentSplitMobileTab = 'pdf';

/**
 * PDFL-256.2: Switch workspace view modes:
 * - 'text': Text only (original text pane & translated text pane side-by-side)
 * - 'pdf': Full-width PDF canvas preview only
 * - 'split': Dual view (PDF preview on left, translated text pane on right; tabbed on mobile)
 */
function setViewMode(mode) {
  const validModes = ['text', 'pdf', 'split'];
  const targetMode = validModes.includes(mode) ? mode : 'split';
  currentViewMode = targetMode;

  const wrapper = document.getElementById('workspaceViewsWrapper');
  if (wrapper) {
    wrapper.classList.remove('view-mode-text', 'view-mode-pdf', 'view-mode-split');
    wrapper.classList.add(`view-mode-${targetMode}`);
    wrapper.setAttribute('data-view-mode', targetMode);
  }

  const modeButtons = [
    { id: 'btnViewModeText', mode: 'text' },
    { id: 'btnViewModePdf', mode: 'pdf' },
    { id: 'btnViewModeSplit', mode: 'split' },
  ];

  modeButtons.forEach((btnConfig) => {
    const btn = document.getElementById(btnConfig.id);
    if (btn) {
      const isActive = btnConfig.mode === targetMode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  });

  const store = getWorkspaceSessionStorage();
  if (store) {
    try {
      store.setItem(VIEW_MODE_STORAGE_KEY, targetMode);
    } catch (_e) {}
  }

  if ((targetMode === 'split' || targetMode === 'pdf') && typeof window !== 'undefined' && window.pdfLinguaPreview) {
    setTimeout(() => {
      if (typeof window.pdfLinguaPreview.zoomFit === 'function') {
        window.pdfLinguaPreview.zoomFit();
      }
    }, 60);
  }
}

/**
 * PDFL-256.2: Switch mobile/tablet tab in split mode (<= 1024px):
 * - 'pdf': Displays PDF Preview
 * - 'translated': Displays Translated text pane
 */
function setSplitMobileTab(tab) {
  const validTabs = ['pdf', 'translated'];
  const targetTab = validTabs.includes(tab) ? tab : 'pdf';
  currentSplitMobileTab = targetTab;

  const wrapper = document.getElementById('workspaceViewsWrapper');
  if (wrapper) {
    wrapper.setAttribute('data-split-tab', targetTab);
  }

  const btnPdf = document.getElementById('btnSplitTabPdf');
  const btnTranslated = document.getElementById('btnSplitTabTranslated');

  if (btnPdf) {
    const isPdf = targetTab === 'pdf';
    btnPdf.classList.toggle('active', isPdf);
    btnPdf.setAttribute('aria-selected', isPdf ? 'true' : 'false');
  }
  if (btnTranslated) {
    const isTrans = targetTab === 'translated';
    btnTranslated.classList.toggle('active', isTrans);
    btnTranslated.setAttribute('aria-selected', isTrans ? 'true' : 'false');
  }

  if (targetTab === 'pdf' && typeof window !== 'undefined' && window.pdfLinguaPreview) {
    setTimeout(() => {
      if (typeof window.pdfLinguaPreview.zoomFit === 'function') {
        window.pdfLinguaPreview.zoomFit();
      }
    }, 60);
  }
}

/**
 * PDFL-256.2: Display error message inside PDF Preview container
 */
function showPreviewErrorState(msg) {
  const errorEl = document.getElementById('pdfPreviewError');
  const errorMsgEl = document.getElementById('pdfPreviewErrorMsg');
  const canvasWrap = document.getElementById('pdfCanvasWrap');
  if (errorEl) errorEl.style.display = 'flex';
  if (errorMsgEl) errorMsgEl.textContent = msg || 'Không thể hiển thị bản xem trước tệp PDF.';
  if (canvasWrap) canvasWrap.style.opacity = '1';
}

/**
 * PDFL-256.2: Authenticated PDF stream fetch for History records
 * Requests GET /api/documents/{document_id}/file with Authorization Bearer header.
 */
async function fetchDocumentPreview(documentId, filename) {
  if (!documentId) return;

  const previewContainer = document.getElementById('pdfPreviewContainer');
  if (previewContainer) {
    previewContainer.style.display = 'block';
  }

  const loadingEl = document.getElementById('pdfPreviewLoading');
  const errorEl = document.getElementById('pdfPreviewError');
  const canvasWrap = document.getElementById('pdfCanvasWrap');
  if (loadingEl) {
    loadingEl.style.display = 'flex';
    const textEl = loadingEl.querySelector('.preview-loading-text');
    if (textEl) textEl.textContent = 'Đang tải tệp PDF xem trước từ máy chủ...';
  }
  if (errorEl) errorEl.style.display = 'none';
  if (canvasWrap) canvasWrap.style.opacity = '0.5';

  const authHeaders = getAuthHeaders();
  const rootBase = (typeof API_BASE_URL === 'string')
    ? API_BASE_URL.replace(/\/api\/process\/?$/, '').replace(/\/process\/?$/, '')
    : 'http://localhost:8000';
  const fileUrl = `${rootBase}/api/documents/${encodeURIComponent(documentId)}/file`;

  try {
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: authHeaders,
    });

    if (response.status === 200) {
      const blob = await response.blob();
      try {
        Object.defineProperty(blob, 'name', {
          value: filename || 'tai_lieu.pdf',
          writable: true,
          configurable: true,
        });
      } catch (_e) {
        blob.name = filename || 'tai_lieu.pdf';
      }

      if (typeof window !== 'undefined' && window.pdfLinguaPreview && typeof window.pdfLinguaPreview.loadPdfPreview === 'function') {
        await window.pdfLinguaPreview.loadPdfPreview(blob);
      }
    } else if (response.status === 401) {
      let errData = null;
      try {
        errData = await response.json();
      } catch (_e) {}
      handleAuthError(errData);
      showPreviewErrorState('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xem trước PDF.');
    } else if (response.status === 403) {
      showToast('Bạn không có quyền xem trước tài liệu này.', 'error');
      showPreviewErrorState('Bạn không có quyền truy cập tệp PDF này.');
    } else if (response.status === 404) {
      showToast('Không tìm thấy tệp PDF gốc trên hệ thống.', 'error');
      showPreviewErrorState('Tệp tin PDF không tồn tại trên hệ thống lưu trữ.');
    } else {
      showToast('Không thể tải tệp PDF xem trước.', 'error');
      showPreviewErrorState('Đã xảy ra lỗi khi tải tệp tin PDF.');
    }
  } catch (err) {
    console.error('[PDFPreview] Fetch preview failed:', err);
    showToast('Lỗi kết nối khi tải bản xem trước PDF.', 'error');
    showPreviewErrorState('Lỗi kết nối khi tải bản xem trước.');
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (canvasWrap) canvasWrap.style.opacity = '1';
  }
}

function getWorkspaceSessionStorage() {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage) return sessionStorage;
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch (_e) {}
  return null;
}

function saveWorkspaceDocToStorage(docData) {
  const store = getWorkspaceSessionStorage();
  if (!store) return;
  try {
    if (docData) {
      store.setItem(WORKSPACE_DOC_STORAGE_KEY, JSON.stringify(docData));
    } else {
      store.removeItem(WORKSPACE_DOC_STORAGE_KEY);
    }
  } catch (_e) {}
}

function clearActiveJobFromStorage() {
  const store = getWorkspaceSessionStorage();
  if (!store) return;
  try {
    store.removeItem(ACTIVE_JOB_STORAGE_KEY);
  } catch (_e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  initWorkspace();
});

function initWorkspace() {
  const btnProcessPdf = document.getElementById('btnProcessPdf');
  const btnRetranslate = document.getElementById('btnRetranslate');
  const targetLangSelect = document.getElementById('targetLangSelect');
  const btnCopyOriginal = document.getElementById('btnCopyOriginal');
  const btnCopyTranslated = document.getElementById('btnCopyTranslated');
  const btnDownloadMenu = document.getElementById('btnDownloadMenu');
  const downloadDropdown = document.getElementById('downloadDropdown');
  const btnDownloadTxt = document.getElementById('btnDownloadTxt');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  const btnNewFile = document.getElementById('btnNewFile');

  if (btnProcessPdf) {
    btnProcessPdf.addEventListener('click', handleProcessPdf);
  }

  if (btnRetranslate) {
    btnRetranslate.addEventListener('click', handleRetranslate);
  }

  if (targetLangSelect) {
    targetLangSelect.addEventListener('change', () => {
      if (currentDocData) {
        handleRetranslate();
      }
    });
  }

  if (btnCopyOriginal) {
    btnCopyOriginal.addEventListener('click', () => {
      const text = document.getElementById('paneOriginal').innerText;
      copyText(text, btnCopyOriginal);
    });
  }

  if (btnCopyTranslated) {
    btnCopyTranslated.addEventListener('click', () => {
      const text = document.getElementById('paneTranslated').innerText;
      copyText(text, btnCopyTranslated);
    });
  }

  if (btnDownloadMenu && downloadDropdown) {
    btnDownloadMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      updateExportUIState();
      downloadDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!downloadDropdown.contains(e.target) && e.target !== btnDownloadMenu) {
        downloadDropdown.classList.remove('show');
      }
    });
  }

  // Multi-target Export Listeners (PDFL-150.4, PDFL-156.3 & PDFL-254.2)
  const exportBtnConfigs = [
    { id: 'btnDownloadTxt', format: 'txt', type: 'translated' },
    { id: 'btnDownloadPdf', format: 'pdf', type: 'translated' },
    { id: 'btnDownloadDocx', format: 'docx', type: 'translated' },
    { id: 'btnDownloadOriginalTxt', format: 'txt', type: 'original' },
    { id: 'btnDownloadOriginalPdf', format: 'pdf', type: 'original' },
    { id: 'btnDownloadOriginalDocx', format: 'docx', type: 'original' },
    { id: 'btnDownloadBilingualTxt', format: 'txt', type: 'bilingual' },
    { id: 'btnDownloadBilingualPdf', format: 'pdf', type: 'bilingual' },
    { id: 'btnDownloadBilingualDocx', format: 'docx', type: 'bilingual' },
    { id: 'btnDownloadSummaryTxt', format: 'txt', type: 'summary' },
    { id: 'btnDownloadSummaryPdf', format: 'pdf', type: 'summary' },
    { id: 'btnDownloadSummaryDocx', format: 'docx', type: 'summary' },
  ];

  exportBtnConfigs.forEach(({ id, format, type }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        return triggerDownload(format, type);
      });
    }
  });

  // View Mode Switcher Listeners (PDFL-256.2)
  const btnViewModeText = document.getElementById('btnViewModeText');
  const btnViewModePdf = document.getElementById('btnViewModePdf');
  const btnViewModeSplit = document.getElementById('btnViewModeSplit');
  const btnSplitTabPdf = document.getElementById('btnSplitTabPdf');
  const btnSplitTabTranslated = document.getElementById('btnSplitTabTranslated');

  if (btnViewModeText) {
    btnViewModeText.addEventListener('click', () => setViewMode('text'));
  }
  if (btnViewModePdf) {
    btnViewModePdf.addEventListener('click', () => setViewMode('pdf'));
  }
  if (btnViewModeSplit) {
    btnViewModeSplit.addEventListener('click', () => setViewMode('split'));
  }

  if (btnSplitTabPdf) {
    btnSplitTabPdf.addEventListener('click', () => setSplitMobileTab('pdf'));
  }
  if (btnSplitTabTranslated) {
    btnSplitTabTranslated.addEventListener('click', () => setSplitMobileTab('translated'));
  }

  updateExportUIState();

  if (btnNewFile) {
    btnNewFile.addEventListener('click', resetToUpload);
  }

  const paneOriginal = document.getElementById('paneOriginal');
  const paneTranslated = document.getElementById('paneTranslated');

  if (paneOriginal && paneTranslated) {
    let isSyncingLeft = false;
    let isSyncingRight = false;

    paneOriginal.addEventListener('scroll', () => {
      if (!isSyncingLeft) {
        isSyncingRight = true;
        const maxScroll = paneOriginal.scrollHeight - paneOriginal.clientHeight;
        if (maxScroll > 0) {
          const ratio = paneOriginal.scrollTop / maxScroll;
          paneTranslated.scrollTop = ratio * (paneTranslated.scrollHeight - paneTranslated.clientHeight);
        }
      }
      isSyncingLeft = false;
    });

    paneTranslated.addEventListener('scroll', () => {
      if (!isSyncingRight) {
        isSyncingLeft = true;
        const maxScroll = paneTranslated.scrollHeight - paneTranslated.clientHeight;
        if (maxScroll > 0) {
          const ratio = paneTranslated.scrollTop / maxScroll;
          paneOriginal.scrollTop = ratio * (paneOriginal.scrollHeight - paneOriginal.clientHeight);
        }
      }
      isSyncingRight = false;
    });

    paneOriginal.addEventListener('input', () => {
      if (currentDocData) {
        currentDocData.original_text = paneOriginal.innerText;
        saveWorkspaceDocToStorage(currentDocData);
      }
      updateCounters();
      updateExportUIState();
    });

    paneTranslated.addEventListener('input', () => {
      if (currentDocData) {
        currentDocData.translated_text = paneTranslated.innerText;
        saveWorkspaceDocToStorage(currentDocData);
      }
      updateCounters();
      updateExportUIState();
    });
  }

  // Restore workspace state or in-flight job if page reloaded (e.g., Live Server reload on storage write)
  const store = getWorkspaceSessionStorage();
  if (store) {
    try {
      const savedDocRaw = store.getItem(WORKSPACE_DOC_STORAGE_KEY);
      if (savedDocRaw && !currentDocData) {
        currentDocData = JSON.parse(savedDocRaw);
      }
    } catch (_e) {}

    try {
      const savedJobId = store.getItem(ACTIVE_JOB_STORAGE_KEY);
      const activeView = store.getItem(ACTIVE_VIEW_STORAGE_KEY);
      if (savedJobId) {
        showProgressModal(true);
        updateProgress(85, 'Đang hoàn tất xử lý và dịch thuật...', 3);
        listenToJobProgress(savedJobId, btnProcessPdf);
      } else if (currentDocData && activeView === 'workspace') {
        renderWorkspace(currentDocData);
        const pendingToastRaw = store.getItem(PENDING_TOAST_STORAGE_KEY);
        if (pendingToastRaw) {
          store.removeItem(PENDING_TOAST_STORAGE_KEY);
          const pendingToast = JSON.parse(pendingToastRaw);
          if (pendingToast && pendingToast.msg && Date.now() - (pendingToast.ts || 0) < 5000) {
            showToast(pendingToast.msg, pendingToast.type || 'success');
          }
        }
      }
    } catch (_e) {}
  }
}

/**
 * Helper to construct authentication headers safely (PDFL-81.4).
 * Returns { 'Authorization': 'Bearer <token>' } if a valid non-empty token exists;
 * otherwise returns an empty object {} for Guests. Never sends 'Bearer null' or 'Bearer undefined'.
 */
function getAuthHeaders() {
  const headers = {};
  let token = null;

  try {
    if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredToken === 'function') {
      token = window.pdfLinguaAuth.getStoredToken();
    } else if (typeof localStorage !== 'undefined' && localStorage) {
      token = localStorage.getItem('pdfl_token');
    }
    if (!token && typeof sessionStorage !== 'undefined' && sessionStorage) {
      token = sessionStorage.getItem('pdfl_token');
    }
  } catch (e) {
    token = null;
  }

  if (typeof token === 'string') {
    const trimmed = token.trim();
    if (trimmed && trimmed !== 'null' && trimmed !== 'undefined') {
      headers['Authorization'] = `Bearer ${trimmed}`;
    }
  }

  return headers;
}

let activeEventSource = null;
let activePollTimer = null;

function cleanupProgressTracking() {
  if (activeEventSource) {
    try {
      activeEventSource.close();
    } catch (e) {}
    activeEventSource = null;
  }
  if (activePollTimer) {
    clearInterval(activePollTimer);
    activePollTimer = null;
  }
}

/**
 * Handle HTTP 401 Unauthorized errors from process endpoints (PDFL-81.4).
 * Clears stored token/session, resets header to Guest state and updates upload limits,
 * but NEVER silently retries the request without authentication.
 */
function handleAuthError(result) {
  showProgressModal(false);
  try {
    if (typeof window !== 'undefined' && window.pdfLinguaAuth) {
      if (typeof window.pdfLinguaAuth.clearStoredSession === 'function') {
        window.pdfLinguaAuth.clearStoredSession();
      }
      if (typeof window.pdfLinguaAuth.updateHeaderAuthState === 'function') {
        window.pdfLinguaAuth.updateHeaderAuthState(null);
      }
    }
    if (typeof updateUploadLimitsUI === 'function') {
      updateUploadLimitsUI(null);
    }
  } catch (e) {}

  const msg = (result && (result.message || result.detail))
    ? (result.message || result.detail)
    : 'Phiên đăng nhập đã hết hạn hoặc cần đăng nhập lại.';
  showToast(msg, 'error');
}

/**
 * Theo dõi tiến độ xử lý Background Job theo thời gian thực (PDFL-111.4).
 * Sử dụng SSE (Server-Sent Events) và tự động fallback sang polling nếu SSE ngắt kết nối.
 */
function listenToJobProgress(jobId, btnProcessPdf) {
  cleanupProgressTracking();

  const handleJobSuccess = (jobData) => {
    cleanupProgressTracking();
    clearActiveJobFromStorage();
    currentDocData = jobData.result;
    saveWorkspaceDocToStorage(currentDocData);
    const store = getWorkspaceSessionStorage();
    if (store) {
      try {
        store.setItem(ACTIVE_VIEW_STORAGE_KEY, 'workspace');
        store.setItem(
          PENDING_TOAST_STORAGE_KEY,
          JSON.stringify({ msg: 'Tài liệu đã được dịch thuật thành công!', type: 'success', ts: Date.now() })
        );
      } catch (_e) {}
    }
    updateProgress(100, jobData.message || 'Xử lý và dịch thuật hoàn tất!', 4);
    setTimeout(() => {
      if (store) {
        try {
          store.removeItem(PENDING_TOAST_STORAGE_KEY);
        } catch (_e) {}
      }
      showProgressModal(false);
      renderWorkspace(jobData.result);
      showToast('Tài liệu đã được dịch thuật thành công!', 'success');
      if (window.PDFLinguaSidebar && typeof window.PDFLinguaSidebar.fetchRecentDocuments === 'function') {
        window.PDFLinguaSidebar.fetchRecentDocuments();
      }
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        try {
          window.dispatchEvent(new CustomEvent('pdfl:document-processed', { detail: { document: jobData.result } }));
        } catch (e) {}
      }
      if (btnProcessPdf) btnProcessPdf.disabled = false;
    }, 400);
  };

  const handleJobFailure = (errorMsg) => {
    cleanupProgressTracking();
    clearActiveJobFromStorage();
    showProgressModal(false);
    const btn = btnProcessPdf || document.getElementById('btnProcessPdf');
    if (btn) btn.disabled = false;
    showToast(errorMsg || 'Xử lý tài liệu thất bại.', 'error');
  };

  // Polling fallback khi EventSource không khả dụng hoặc mạng ngắt kết nối
  const startPollingFallback = () => {
    if (activePollTimer) return;
    activePollTimer = setInterval(async () => {
      try {
        const authHeaders = getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
          method: 'GET',
          headers: authHeaders,
        });
        if (res.status === 404) {
          clearActiveJobFromStorage();
          cleanupProgressTracking();
          showProgressModal(false);
          return;
        }
        if (!res.ok) return;
        const body = await res.json();
        if (body && body.data) {
          const jd = body.data;
          updateProgress(jd.progress_percentage || 0, jd.message || 'Đang xử lý...', jd.current_step || 2);
          if (jd.status === 'COMPLETED') {
            handleJobSuccess(jd);
          } else if (jd.status === 'FAILED') {
            handleJobFailure(jd.error || jd.message);
          }
        }
      } catch (e) {}
    }, 1200);
  };

  if (typeof EventSource !== 'undefined') {
    try {
      const sseUrl = `${API_BASE_URL}/jobs/${jobId}/events`;
      activeEventSource = new EventSource(sseUrl);

      activeEventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data) return;

          const pct = typeof data.progress_percentage === 'number' ? data.progress_percentage : 0;
          const msg = data.message || 'Đang xử lý...';
          const step = typeof data.current_step === 'number' ? data.current_step : 2;

          updateProgress(pct, msg, step);

          if (data.status === 'COMPLETED') {
            handleJobSuccess(data);
          } else if (data.status === 'FAILED') {
            handleJobFailure(data.error || data.message);
          }
        } catch (e) {}
      };

      activeEventSource.onerror = () => {
        if (activeEventSource) {
          try { activeEventSource.close(); } catch (e) {}
          activeEventSource = null;
        }
        startPollingFallback();
      };
    } catch (err) {
      startPollingFallback();
    }
  } else {
    startPollingFallback();
  }
}

async function handleProcessPdf() {
  if (typeof selectedFile === 'undefined' || !selectedFile) {
    showToast('Vui lòng chọn một tệp PDF trước khi bắt đầu!', 'error');
    return;
  }

  // Pre-check file size against current limits before uploading
  const limits = (typeof getCurrentUserLimits === 'function')
    ? getCurrentUserLimits()
    : { maxFileSizeBytes: 20 * 1024 * 1024, maxFileSizeMb: 20 };
  if (selectedFile.size > limits.maxFileSizeBytes) {
    const overMsg = `Dung lượng tệp (${formatFileSize(selectedFile.size)}) vượt quá giới hạn ${limits.maxFileSizeMb}MB của tài khoản!`;
    showToast(overMsg, 'error');
    if (
      typeof window !== 'undefined' &&
      window.PDFLinguaPricing &&
      typeof window.PDFLinguaPricing.openQuotaExceededModal === 'function' &&
      limits.maxFileSizeMb < 100
    ) {
      window.PDFLinguaPricing.openQuotaExceededModal(overMsg);
    }
    return;
  }

  const btnProcessPdf = document.getElementById('btnProcessPdf');
  if (btnProcessPdf) btnProcessPdf.disabled = true;

  const targetLang = document.getElementById('targetLangSelect')?.value || 'vi';
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('target_lang', targetLang);

  showProgressModal(true);
  updateProgress(15, 'Đang tải tệp PDF lên máy chủ...', 1);

  try {
    const authHeaders = getAuthHeaders();
    const fetchOptions = {
      method: 'POST',
      body: formData,
    };
    if (authHeaders['Authorization']) {
      fetchOptions.headers = authHeaders;
    }

    // PDFL-111.4: Gửi yêu cầu khởi tạo Background Job (/jobs)
    const response = await fetch(`${API_BASE_URL}/jobs`, fetchOptions);

    let result = null;
    try {
      result = await response.json();
    } catch (e) {}

    if (response.status === 401) {
      handleAuthError(result);
      if (btnProcessPdf) btnProcessPdf.disabled = false;
      return;
    }

    if (response.status === 413) {
      showProgressModal(false);
      const msg = (result && (result.message || result.detail))
        ? (result.message || result.detail)
        : 'Tệp hoặc số trang vượt quá giới hạn cho phép của tài khoản!';
      showToast(msg, 'error');
      if (
        typeof window !== 'undefined' &&
        window.PDFLinguaPricing &&
        typeof window.PDFLinguaPricing.openQuotaExceededModal === 'function'
      ) {
        window.PDFLinguaPricing.openQuotaExceededModal(msg);
      }
      if (btnProcessPdf) btnProcessPdf.disabled = false;
      return;
    }

    if (!response.ok || !result || !result.success) {
      const msg = (result && (result.detail || result.message)) || 'Khởi tạo tác vụ xử lý tài liệu thất bại.';
      throw new Error(msg);
    }

    // Nếu endpoint trả về ngay kết quả trực tiếp (direct sync data hoặc test mock)
    if (result.data && result.data.translated_text && !result.data.job_id) {
      updateProgress(100, 'Xử lý và dịch thuật hoàn tất!', 4);
      clearActiveJobFromStorage();
      currentDocData = result.data;
      saveWorkspaceDocToStorage(currentDocData);
      const store = getWorkspaceSessionStorage();
      if (store) {
        try {
          store.setItem(ACTIVE_VIEW_STORAGE_KEY, 'workspace');
        } catch (_e) {}
      }
      setTimeout(() => {
        showProgressModal(false);
        renderWorkspace(result.data);
        showToast('Tài liệu đã được dịch thuật thành công!', 'success');
        if (window.PDFLinguaSidebar && typeof window.PDFLinguaSidebar.fetchRecentDocuments === 'function') {
          window.PDFLinguaSidebar.fetchRecentDocuments();
        }
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
          try {
            window.dispatchEvent(new CustomEvent('pdfl:document-processed', { detail: { document: result.data } }));
          } catch (e) {}
        }
        if (btnProcessPdf) btnProcessPdf.disabled = false;
      }, 400);
      return;
    }

    const jobId = result.data ? result.data.job_id : null;
    if (!jobId) {
      throw new Error('Máy chủ không trả về mã tác vụ (Job ID).');
    }

    const store = getWorkspaceSessionStorage();
    if (store) {
      try {
        store.setItem(ACTIVE_JOB_STORAGE_KEY, String(jobId));
        store.setItem(ACTIVE_VIEW_STORAGE_KEY, 'workspace');
      } catch (_e) {}
    }

    // Theo dõi tiến độ thời gian thực qua Server-Sent Events (SSE)
    listenToJobProgress(jobId, btnProcessPdf);

  } catch (error) {
    showProgressModal(false);
    if (btnProcessPdf) btnProcessPdf.disabled = false;
    const msg = error.message === 'Failed to fetch'
      ? 'Không thể kết nối đến máy chủ Backend (http://localhost:8000). Vui lòng đảm bảo Backend đang chạy!'
      : (error.message || 'Có lỗi kết nối đến máy chủ Backend!');
    showToast(msg, 'error');
  }
}

async function handleRetranslate() {
  if (!currentDocData || !currentDocData.original_text) {
    showToast('Chưa có nội dung văn bản để dịch!', 'error');
    return;
  }

  const newTargetLang = document.getElementById('targetLangSelect')?.value || 'vi';
  const btnRetranslate = document.getElementById('btnRetranslate');

  if (btnRetranslate) {
    btnRetranslate.disabled = true;
    btnRetranslate.innerHTML = `
      <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
      </svg>
      <span>Đang dịch lại...</span>
    `;
  }

  try {
    const authHeaders = getAuthHeaders();
    const headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders);

    const response = await fetch(`${API_BASE_URL}/retranslate`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        text: currentDocData.original_text,
        target_lang: newTargetLang,
        source_lang: 'auto',
      }),
    });

    let result = null;
    try {
      result = await response.json();
    } catch (e) {}

    if (response.status === 401) {
      handleAuthError(result);
      return;
    }

    if (!response.ok || !result || !result.success) {
      throw new Error((result && (result.detail || result.message)) || 'Dịch lại thất bại.');
    }

    const newTranslatedText = result.data.translated_text;
    currentDocData.translated_text = newTranslatedText;
    currentDocData.target_lang = newTargetLang;
    saveWorkspaceDocToStorage(currentDocData);

    const paneTranslated = document.getElementById('paneTranslated');
    if (paneTranslated) {
      paneTranslated.innerText = newTranslatedText;
    }
    updateCounters();
    updateExportUIState();
    showToast(`Đã dịch xong sang ${getLangName(newTargetLang)}!`, 'success');

  } catch (error) {
    showToast(error.message || 'Lỗi khi dịch lại văn bản!', 'error');
  } finally {
    if (btnRetranslate) {
      btnRetranslate.disabled = false;
      btnRetranslate.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
        <span>Dịch lại</span>
      `;
    }
  }
}

/**
 * Lấy nội dung văn bản gốc từ DOM hoặc currentDocData (PDFL-156.3).
 * Trả về chuỗi đã trim nếu có, ngược lại trả về chuỗi rỗng.
 */
function getOriginalContent() {
  const paneOriginal = document.getElementById('paneOriginal');
  if (paneOriginal && (paneOriginal.innerText || '').trim()) {
    return paneOriginal.innerText.trim();
  }
  if (currentDocData && typeof currentDocData.original_text === 'string' && currentDocData.original_text.trim()) {
    return currentDocData.original_text.trim();
  }
  return '';
}

/**
 * Lấy nội dung bản dịch từ DOM hoặc currentDocData (PDFL-156.3).
 * Trả về chuỗi đã trim nếu có, ngược lại trả về chuỗi rỗng.
 */
function getTranslatedContent() {
  const paneTranslated = document.getElementById('paneTranslated');
  if (paneTranslated && (paneTranslated.innerText || '').trim()) {
    return paneTranslated.innerText.trim();
  }
  if (currentDocData && typeof currentDocData.translated_text === 'string' && currentDocData.translated_text.trim()) {
    return currentDocData.translated_text.trim();
  }
  return '';
}

/**
 * Lấy nội dung tóm tắt từ dữ liệu tài liệu hiện tại hoặc DOM (EPIC 09).
 * Trả về chuỗi nội dung nếu có, ngược lại trả về null.
 */
function getSummaryContent() {
  if (currentDocData) {
    if (typeof currentDocData.summary_text === 'string' && currentDocData.summary_text.trim()) {
      return currentDocData.summary_text.trim();
    }
    if (typeof currentDocData.summary === 'string' && currentDocData.summary.trim()) {
      return currentDocData.summary.trim();
    }
  }
  const summaryEl = document.getElementById('paneSummary') || document.getElementById('summaryContent');
  if (summaryEl && (summaryEl.innerText || summaryEl.value || '').trim()) {
    return (summaryEl.innerText || summaryEl.value).trim();
  }
  return null;
}

/**
 * PDFL-254.2: Kiểm tra người dùng hiện tại có quyền Pro hoặc Admin không.
 * Bảo đảm:
 * - Bắt buộc phải có Bearer token hợp lệ (nếu không có token -> Guest).
 * - Tài khoản không bị khóa (is_active !== false).
 * - Role phải chính xác là 'pro' hoặc 'admin' (chuẩn hóa trim & lowercase).
 * - Backend (/download) luôn là nguồn xác thực bảo mật cuối cùng.
 */
function isProOrAdminUser() {
  let token = null;
  if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredToken === 'function') {
    token = window.pdfLinguaAuth.getStoredToken();
  }
  if (!token && typeof localStorage !== 'undefined') {
    try {
      token = localStorage.getItem('pdfl_token') || sessionStorage.getItem('pdfl_token');
    } catch (_e) {}
  }
  if (!token) return false;

  let user = null;
  if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredUser === 'function') {
    user = window.pdfLinguaAuth.getStoredUser();
  }
  if (!user && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('pdfl_user') || sessionStorage.getItem('pdfl_user');
      if (raw) user = JSON.parse(raw);
    } catch (_e) {}
  }
  if (!user || user.is_active === false) return false;

  const role = String(user.role || '').trim().toLowerCase();
  return role === 'pro' || role === 'admin';
}

/**
 * Cập nhật trạng thái hiển thị và khả năng bấm của tất cả các nút tải xuống (PDFL-156.3 & PDFL-254.2).
 */
function updateExportUIState() {
  const originalText = getOriginalContent();
  const translatedText = getTranslatedContent();
  const summaryText = getSummaryContent();

  const hasDoc = Boolean(currentDocData);
  const hasOriginal = hasDoc && Boolean(originalText);
  const hasTranslated = hasDoc && Boolean(translatedText);
  const hasBilingual = hasDoc && hasOriginal && hasTranslated;
  const hasSummary = hasDoc && Boolean(summaryText);

  // 1. Bản dịch (translated)
  const btnTransTxt = document.getElementById('btnDownloadTxt');
  const btnTransPdf = document.getElementById('btnDownloadPdf');
  const btnTransDocx = document.getElementById('btnDownloadDocx');
  if (btnTransTxt) {
    btnTransTxt.disabled = !hasTranslated;
    btnTransTxt.title = hasTranslated ? 'Tải bản dịch định dạng TXT' : 'Chưa có nội dung bản dịch';
  }
  if (btnTransPdf) {
    btnTransPdf.disabled = !hasTranslated;
    btnTransPdf.title = hasTranslated ? 'Tải bản dịch định dạng PDF' : 'Chưa có nội dung bản dịch';
  }
  if (btnTransDocx) {
    btnTransDocx.disabled = !hasTranslated;
    btnTransDocx.title = hasTranslated ? 'Tải bản dịch định dạng Word (.docx) - Pro VIP' : 'Chưa có nội dung bản dịch';
  }

  // 2. Văn bản gốc (original)
  const btnOrigTxt = document.getElementById('btnDownloadOriginalTxt');
  const btnOrigPdf = document.getElementById('btnDownloadOriginalPdf');
  const btnOrigDocx = document.getElementById('btnDownloadOriginalDocx');
  if (btnOrigTxt) {
    btnOrigTxt.disabled = !hasOriginal;
    btnOrigTxt.title = hasOriginal ? 'Tải văn bản gốc định dạng TXT' : 'Chưa có nội dung văn bản gốc';
  }
  if (btnOrigPdf) {
    btnOrigPdf.disabled = !hasOriginal;
    btnOrigPdf.title = hasOriginal ? 'Tải văn bản gốc định dạng PDF' : 'Chưa có nội dung văn bản gốc';
  }
  if (btnOrigDocx) {
    btnOrigDocx.disabled = !hasOriginal;
    btnOrigDocx.title = hasOriginal ? 'Tải văn bản gốc định dạng Word (.docx) - Pro VIP' : 'Chưa có nội dung văn bản gốc';
  }

  // 3. Song ngữ (bilingual)
  const btnBiTxt = document.getElementById('btnDownloadBilingualTxt');
  const btnBiPdf = document.getElementById('btnDownloadBilingualPdf');
  const btnBiDocx = document.getElementById('btnDownloadBilingualDocx');
  const biTitle = hasBilingual
    ? 'Tải song ngữ định dạng TXT'
    : (!hasOriginal ? 'Thiếu nội dung văn bản gốc để xuất song ngữ' : 'Thiếu nội dung bản dịch để xuất song ngữ');
  const biPdfTitle = hasBilingual
    ? 'Tải song ngữ định dạng PDF'
    : (!hasOriginal ? 'Thiếu nội dung văn bản gốc để xuất song ngữ' : 'Thiếu nội dung bản dịch để xuất song ngữ');
  const biDocxTitle = hasBilingual
    ? 'Tải song ngữ định dạng Word (.docx) - Pro VIP'
    : (!hasOriginal ? 'Thiếu nội dung văn bản gốc để xuất song ngữ' : 'Thiếu nội dung bản dịch để xuất song ngữ');
  if (btnBiTxt) {
    btnBiTxt.disabled = !hasBilingual;
    btnBiTxt.title = biTitle;
  }
  if (btnBiPdf) {
    btnBiPdf.disabled = !hasBilingual;
    btnBiPdf.title = biPdfTitle;
  }
  if (btnBiDocx) {
    btnBiDocx.disabled = !hasBilingual;
    btnBiDocx.title = biDocxTitle;
  }

  // 4. Bản tóm tắt (summary)
  const btnSummTxt = document.getElementById('btnDownloadSummaryTxt');
  const btnSummPdf = document.getElementById('btnDownloadSummaryPdf');
  const btnSummDocx = document.getElementById('btnDownloadSummaryDocx');
  const statusBadge = document.getElementById('summaryExportStatus');
  if (btnSummTxt) {
    btnSummTxt.disabled = !hasSummary;
    btnSummTxt.title = hasSummary ? 'Tải bản tóm tắt định dạng TXT' : 'Chưa có bản tóm tắt';
  }
  if (btnSummPdf) {
    btnSummPdf.disabled = !hasSummary;
    btnSummPdf.title = hasSummary ? 'Tải bản tóm tắt định dạng PDF' : 'Chưa có bản tóm tắt';
  }
  if (btnSummDocx) {
    btnSummDocx.disabled = !hasSummary;
    btnSummDocx.title = hasSummary ? 'Tải bản tóm tắt định dạng Word (.docx) - Pro VIP' : 'Chưa có bản tóm tắt';
  }
  if (statusBadge) {
    statusBadge.textContent = hasSummary ? '(sẵn sàng)' : '(chưa có)';
    statusBadge.className = hasSummary ? 'summary-badge ready' : 'summary-badge';
  }
}

/**
 * Alias cho updateExportUIState để tương thích ngược.
 */
function updateSummaryExportState() {
  updateExportUIState();
}

async function triggerDownload(format = 'txt', exportType = 'translated') {
  if (!currentDocData) {
    showToast('Chưa có tài liệu để tải về!', 'error');
    return;
  }

  const cleanFormat = (format || 'txt').trim().toLowerCase();

  // PDFL-254.2: Pro Guard cho định dạng DOCX (Chặn trước ở client cho Guest / Free)
  if (cleanFormat === 'docx') {
    if (!isProOrAdminUser()) {
      showToast('Tính năng tải tệp Word (.docx) chỉ dành riêng cho tài khoản Pro VIP!', 'warning');
      if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.showUpgradeModal === 'function') {
        window.pdfLinguaAuth.showUpgradeModal();
      } else if (typeof window !== 'undefined' && window.PDFLinguaPricing && typeof window.PDFLinguaPricing.openPricingView === 'function') {
        window.PDFLinguaPricing.openPricingView();
      } else {
        const aiProModal = document.getElementById('aiProModal');
        if (aiProModal) {
          aiProModal.removeAttribute('hidden');
          aiProModal.style.display = 'flex';
        }
      }
      return; // Tuyệt đối không gọi API!
    }
  }

  const dropdown = document.getElementById('downloadDropdown');
  if (dropdown) dropdown.classList.remove('show');

  const currentOriginal = getOriginalContent();
  const currentTranslated = getTranslatedContent();

  let targetContent = '';
  let originalContent = '';

  switch (exportType) {
    case 'original':
      if (!currentOriginal || !currentOriginal.trim()) {
        showToast('Chưa có nội dung văn bản gốc để tải về!', 'error');
        return;
      }
      targetContent = currentOriginal.trim();
      break;

    case 'summary': {
      const summaryText = getSummaryContent();
      if (!summaryText || !summaryText.trim()) {
        showToast('Chưa có nội dung tóm tắt. Vui lòng tạo bản tóm tắt trước khi tải về!', 'error');
        return;
      }
      targetContent = summaryText.trim();
      break;
    }

    case 'bilingual':
      if (!currentOriginal || !currentOriginal.trim()) {
        showToast('Thiếu nội dung văn bản gốc để xuất song ngữ!', 'error');
        return;
      }
      if (!currentTranslated || !currentTranslated.trim()) {
        showToast('Thiếu nội dung bản dịch để xuất song ngữ!', 'error');
        return;
      }
      targetContent = currentTranslated.trim();
      originalContent = currentOriginal.trim();
      break;

    case 'translated':
    default:
      if (!currentTranslated || !currentTranslated.trim()) {
        showToast('Chưa có nội dung bản dịch để tải về!', 'error');
        return;
      }
      targetContent = currentTranslated.trim();
      break;
  }

  const rawBaseName = (currentDocData.filename || 'tai_lieu').replace(/\.[^/.]+$/, '');
  let cleanName = rawBaseName.replace(/[\\/*?:"<>|]/g, '').trim() || 'tai_lieu';
  const knownSuffixes = ['_goc', '_dich', '_tomtat', '_songngu'];
  for (const sfx of knownSuffixes) {
    if (cleanName.endsWith(sfx)) {
      cleanName = cleanName.slice(0, -sfx.length);
      break;
    }
  }

  const suffixMap = {
    original: '_goc',
    translated: '_dich',
    summary: '_tomtat',
    bilingual: '_songngu',
  };
  const targetSuffix = suffixMap[exportType] || '_dich';
  const downloadFileName = `${cleanName}${targetSuffix}`;

  const titleMap = {
    original: `PDF-Lingua - Văn Bản Gốc - ${cleanName}`,
    translated: `PDF-Lingua - Bản Dịch - ${cleanName}`,
    summary: `PDF-Lingua - Tóm Tắt - ${cleanName}`,
    bilingual: `PDF-Lingua - Song Ngữ - ${cleanName}`,
  };
  const title = titleMap[exportType] || `PDF-Lingua - ${cleanName}`;

  showToast(`Đang chuẩn bị tệp .${cleanFormat.toUpperCase()}...`, 'info');

  try {
    const authHeaders = getAuthHeaders();
    const headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders);

    const payload = {
      content: targetContent,
      format: cleanFormat,
      export_type: exportType,
      filename: downloadFileName,
      title: title,
    };
    if (exportType === 'bilingual') {
      payload.original_content = originalContent;
    }

    const response = await fetch(`${API_BASE_URL}/download`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      let result = null;
      try {
        result = await response.json();
      } catch (e) {}
      const fallbackMsg = 'Phiên đăng nhập đã hết hạn hoặc cần đăng nhập lại.';
      const msg = (result && (result.message || result.detail))
        ? (result.message || result.detail)
        : fallbackMsg;
      handleAuthError({ message: msg });
      return;
    }

    if (response.status === 403) {
      let result = null;
      try {
        result = await response.json();
      } catch (e) {}
      const msg = (result && (result.message || result.detail))
        ? (result.message || result.detail)
        : 'Tài khoản không có quyền truy cập.';
      showToast(msg, 'error');
      if (result && (result.error_code === 'PRO_REQUIRED' || (result.message && result.message.includes('Pro')))) {
        if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.showUpgradeModal === 'function') {
          window.pdfLinguaAuth.showUpgradeModal();
        }
      }
      return;
    }

    if (!response.ok) {
      let errorMsg = 'Lỗi khi tải tệp từ máy chủ.';
      try {
        const errorJson = await response.json();
        if (errorJson && (errorJson.message || errorJson.detail)) {
          errorMsg = errorJson.message || errorJson.detail;
        }
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${downloadFileName}.${cleanFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);

    showToast(`Đã tải xuống thành công tệp .${cleanFormat.toUpperCase()}!`, 'success');
  } catch (error) {
    showToast(error.message || 'Tải tệp thất bại!', 'error');
  }
}

function renderWorkspace(data) {
  if (data) {
    currentDocData = data;
    saveWorkspaceDocToStorage(currentDocData);
  }

  const heroSection = document.getElementById('heroSection');
  const workspaceSection = document.getElementById('workspaceSection');
  const documentsSection = document.getElementById('documentsSection');
  const historySection = document.getElementById('historySection');
  const adminSection = document.getElementById('adminSection');

  if (heroSection) heroSection.style.display = 'none';
  if (documentsSection) documentsSection.style.display = 'none';
  if (historySection) historySection.style.display = 'none';
  if (adminSection) adminSection.style.display = 'none';
  if (workspaceSection) workspaceSection.style.display = 'block';

  // Highlight Dịch PDF in sidebar when document is translated
  if (window.PDFLinguaSidebar && typeof window.PDFLinguaSidebar.setActiveNav === 'function') {
    window.PDFLinguaSidebar.setActiveNav('translate');
  } else {
    const sideNavTranslate = document.getElementById('sideNavTranslate');
    const allItems = document.querySelectorAll ? document.querySelectorAll('.sidebar-nav-item') : [];
    if (allItems && typeof allItems.forEach === 'function') {
      allItems.forEach((item) => item.classList.remove('active'));
    }
    if (sideNavTranslate) sideNavTranslate.classList.add('active');
  }

  const docName = document.getElementById('docNameDisplay');
  const docPages = document.getElementById('docPagesDisplay');
  const docSize = document.getElementById('docSizeDisplay');
  const docType = document.getElementById('docTypeDisplay');
  const paneOriginal = document.getElementById('paneOriginal');
  const paneTranslated = document.getElementById('paneTranslated');

  const filename = data.filename || data.document_filename || 'Tài liệu không tên';
  if (docName) docName.textContent = filename;
  if (docPages) docPages.textContent = `${data.page_count || 1} trang`;
  if (docSize) docSize.textContent = data.file_size_mb ? `${data.file_size_mb} MB` : '--';

  if (docType) {
    if (data.is_ocr_used) {
      docType.className = 'meta-pill ocr';
      docType.textContent = 'Quét OCR';
    } else {
      docType.className = 'meta-pill digital';
      docType.textContent = 'PDF Số';
    }
  }

  const translatedContent = (data.action_type === 'SUMMARIZE' && data.summary_text)
    ? data.summary_text
    : (data.translated_text || '');

  if (paneOriginal) paneOriginal.innerText = data.original_text || '';
  if (paneTranslated) paneTranslated.innerText = translatedContent;

  const targetLangSelect = document.getElementById('targetLangSelect');
  if (targetLangSelect && data.target_lang) {
    targetLangSelect.value = data.target_lang;
  }

  // Update currentDocData & persist to session storage so refresh preserves it (PDFL-165.2)
  currentDocData = {
    document_id: data.document_id,
    history_id: data.history_id,
    filename: filename,
    page_count: data.page_count || 1,
    file_size_mb: data.file_size_mb,
    target_lang: data.target_lang || 'vi',
    is_ocr_used: Boolean(data.is_ocr_used),
    original_text: data.original_text || '',
    translated_text: translatedContent,
    action_type: data.action_type || 'TRANSLATE',
    engine_used: data.engine_used,
  };
  saveWorkspaceDocToStorage(currentDocData);

  const store = getWorkspaceSessionStorage();
  if (store) {
    try {
      store.setItem(ACTIVE_VIEW_STORAGE_KEY, 'workspace');
    } catch (_e) {}
  }

  updateCounters();
  updateExportUIState();

  // Initialize or restore View Mode (PDFL-256.2)
  const storeRef = getWorkspaceSessionStorage();
  let savedMode = 'split';
  if (storeRef) {
    try {
      savedMode = storeRef.getItem(VIEW_MODE_STORAGE_KEY) || 'split';
    } catch (_e) {}
  }
  setViewMode(savedMode);
  setSplitMobileTab('pdf');

  // Initialize PDF Preview (PDFL-256.1 & PDFL-256.2)
  try {
    let previewSource = null;
    if (typeof window !== 'undefined' && window.pdfLinguaUpload && typeof window.pdfLinguaUpload.getSelectedFile === 'function') {
      previewSource = window.pdfLinguaUpload.getSelectedFile();
    }
    if (!previewSource && data) {
      previewSource = data.file_url || data.preview_url || data.pdf_url || null;
    }
    const previewContainer = document.getElementById('pdfPreviewContainer');
    if (previewSource) {
      if (previewContainer) previewContainer.style.display = 'block';
      if (typeof window !== 'undefined' && window.pdfLinguaPreview && typeof window.pdfLinguaPreview.loadPdfPreview === 'function') {
        window.pdfLinguaPreview.loadPdfPreview(previewSource);
      }
    } else if (data && data.document_id) {
      // PDFL-256.2: When opened from History with document_id and no local File, fetch authenticated stream
      fetchDocumentPreview(data.document_id, filename);
    } else {
      if (previewContainer) previewContainer.style.display = 'none';
    }
  } catch (err) {
    console.warn('PDF Preview initialization error:', err);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetToUpload() {
  cleanupProgressTracking();
  clearActiveJobFromStorage();
  currentDocData = null;
  saveWorkspaceDocToStorage(null);
  const store = getWorkspaceSessionStorage();
  if (store) {
    try {
      store.removeItem(ACTIVE_VIEW_STORAGE_KEY);
    } catch (_e) {}
  }
  const heroSection = document.getElementById('heroSection');
  const workspaceSection = document.getElementById('workspaceSection');
  const documentsSection = document.getElementById('documentsSection');

  if (workspaceSection) workspaceSection.style.display = 'none';
  if (documentsSection) documentsSection.style.display = 'none';
  if (heroSection) heroSection.style.display = 'block';

  // Highlight Trang chủ in sidebar when returning to upload screen
  if (window.PDFLinguaSidebar && typeof window.PDFLinguaSidebar.setActiveNav === 'function') {
    window.PDFLinguaSidebar.setActiveNav('home');
  } else {
    const sideNavHome = document.getElementById('sideNavHome');
    const allItems = document.querySelectorAll ? document.querySelectorAll('.sidebar-nav-item') : [];
    if (allItems && typeof allItems.forEach === 'function') {
      allItems.forEach((item) => item.classList.remove('active'));
    }
    if (sideNavHome) sideNavHome.classList.add('active');
  }

  const btnRemoveFile = document.getElementById('btnRemoveFile');
  if (btnRemoveFile) btnRemoveFile.click();

  const paneOriginal = document.getElementById('paneOriginal');
  const paneTranslated = document.getElementById('paneTranslated');
  if (paneOriginal) paneOriginal.innerText = '';
  if (paneTranslated) paneTranslated.innerText = '';

  updateCounters();
  updateExportUIState();

  // Cleanup PDF Canvas Preview & reset View Mode (PDFL-256.1 & PDFL-256.2)
  try {
    if (typeof window !== 'undefined' && window.pdfLinguaPreview && typeof window.pdfLinguaPreview.cleanupPdfPreview === 'function') {
      window.pdfLinguaPreview.cleanupPdfPreview();
    }
    const previewContainer = document.getElementById('pdfPreviewContainer');
    if (previewContainer) previewContainer.style.display = 'none';
  } catch (_e) {}

  setViewMode('split');
  setSplitMobileTab('pdf');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateCounters() {
  const paneOriginal = document.getElementById('paneOriginal');
  const paneTranslated = document.getElementById('paneTranslated');
  const countOriginal = document.getElementById('countOriginal');
  const countTranslated = document.getElementById('countTranslated');

  if (paneOriginal && countOriginal) {
    const chars = paneOriginal.innerText.length;
    const words = paneOriginal.innerText.trim() ? paneOriginal.innerText.trim().split(/\s+/).length : 0;
    countOriginal.textContent = `${words.toLocaleString()} từ (${chars.toLocaleString()} ký tự)`;
  }

  if (paneTranslated && countTranslated) {
    const chars = paneTranslated.innerText.length;
    const words = paneTranslated.innerText.trim() ? paneTranslated.innerText.trim().split(/\s+/).length : 0;
    countTranslated.textContent = `${words.toLocaleString()} từ (${chars.toLocaleString()} ký tự)`;
  }
}

function copyText(text, btnElement) {
  if (!text) {
    showToast('Không có nội dung để sao chép!', 'error');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    const originalHtml = btnElement.innerHTML;
    btnElement.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span style="color:#10B981;">Đã chép!</span>
    `;
    showToast('Đã sao chép vào bộ nhớ tạm!', 'success');
    setTimeout(() => {
      btnElement.innerHTML = originalHtml;
    }, 2000);
  }).catch(() => {
    showToast('Không thể sao chép văn bản.', 'error');
  });
}

function showProgressModal(show) {
  const modal = document.getElementById('processingModal');
  if (!modal) return;
  modal.style.display = show ? 'flex' : 'none';
  if (show) {
    updateProgress(10, 'Đang chuẩn bị...', 1);
  } else {
    cleanupProgressTracking();
  }
}

function updateProgress(percentage, text, currentStep) {
  const bar = document.getElementById('progressBarFill');
  const desc = document.getElementById('progressDesc');

  if (bar) bar.style.width = `${percentage}%`;
  if (desc) desc.textContent = text;

  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`stepItem${i}`);
    if (!stepEl) continue;
    stepEl.classList.remove('active', 'done');
    if (i < currentStep) {
      stepEl.classList.add('done');
    } else if (i === currentStep) {
      stepEl.classList.add('active');
    }
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function getLangName(code) {
  const names = {
    vi: 'Tiếng Việt',
    en: 'Tiếng Anh',
    fr: 'Tiếng Pháp',
    zh: 'Tiếng Trung',
    'zh-CN': 'Tiếng Trung',
    ja: 'Tiếng Nhật',
    ko: 'Tiếng Hàn',
    de: 'Tiếng Đức',
    es: 'Tiếng Tây Ban Nha',
    ru: 'Tiếng Nga',
  };
  return names[code] || code;
}

// Expose globals for integration & testing (PDFL-81.4 & PDFL-111.4 & PDFL-150.4 & PDFL-156.3)
if (typeof window !== 'undefined') {
  window.pdfLinguaWorkspace = Object.assign(window.pdfLinguaWorkspace || {}, {
    getAuthHeaders,
    handleAuthError,
    handleProcessPdf,
    handleRetranslate,
    triggerDownload,
    getOriginalContent,
    getTranslatedContent,
    getSummaryContent,
    updateExportUIState,
    updateSummaryExportState,
    showToast,
    cleanupProgressTracking,
    listenToJobProgress,
    renderWorkspace,
    resetToUpload,
    isProOrAdminUser,
    setViewMode,
    getViewMode: () => currentViewMode,
    setSplitMobileTab,
    getSplitMobileTab: () => currentSplitMobileTab,
    fetchDocumentPreview,
    getCurrentDocData: () => currentDocData,
    setCurrentDocData: (d) => {
      currentDocData = d;
      saveWorkspaceDocToStorage(d);
      updateExportUIState();
    },
  });
  window.showToast = showToast;
}
