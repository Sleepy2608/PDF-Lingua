/**
 * PDF-Lingua - Upload & Dropzone Module (PDFL-81.4)
 * --------------------------------------------------------------------------
 * Handles PDF file selection via dropzone and file input, enforces role-based
 * client-side size limits (Guest/Free: 20MB, Pro/Admin: 100MB), and updates
 * dropzone instructions dynamically based on user authentication state.
 */

const ROLE_LIMITS = {
  guest: { maxFileSizeMb: 20, maxPages: 100, maxOcrPages: 100, label: 'Khách' },
  free: { maxFileSizeMb: 20, maxPages: 100, maxOcrPages: 100, label: 'Miễn phí' },
  pro: { maxFileSizeMb: 100, maxPages: 500, maxOcrPages: 500, label: 'Pro' },
  admin: { maxFileSizeMb: 100, maxPages: 500, maxOcrPages: 500, label: 'Quản trị viên' },
};

const DEFAULT_LIMITS = ROLE_LIMITS.guest;

let selectedFile = null;
let batchQueue = [];
let resetFileSelection = () => {};
let addFilesToBatchQueue = () => ({ added: 0, skipped: 0, errors: [] });
let removeFileFromBatchQueue = () => false;
let clearBatchQueue = () => {};
let renderBatchQueueUI = () => {};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  initDropzone();
  updateUploadLimitsUI();
});

// Listen to custom auth change events fired by auth.js or workspace.js
if (typeof window !== 'undefined') {
  window.addEventListener('pdfl:auth-change', (e) => {
    updateUploadLimitsUI(e && e.detail ? e.detail.user : null);
  });
}

/**
 * Determine upload and processing limits based on the current user's role.
 * If user is not logged in, status is not ready, or role is unknown, defaults
 * safely to Guest/Free limits (20MB, 100 pages).
 *
 * NOTE: Frontend checks enhance UX; Backend is always the final authority for RBAC.
 */
function getCurrentUserLimits(user) {
  let role = 'guest';
  let targetUser = user;

  if (!targetUser) {
    try {
      if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredUser === 'function') {
        targetUser = window.pdfLinguaAuth.getStoredUser();
      } else if (typeof localStorage !== 'undefined' && localStorage) {
        const raw = localStorage.getItem('pdfl_user');
        targetUser = raw ? JSON.parse(raw) : null;
      }
    } catch (e) {
      targetUser = null;
    }
  }

  if (targetUser && targetUser.role) {
    const rawRole = String(targetUser.role).trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ROLE_LIMITS, rawRole)) {
      role = rawRole;
    }
  }

  const config = ROLE_LIMITS[role] || DEFAULT_LIMITS;
  return {
    role: role,
    maxFileSizeMb: config.maxFileSizeMb,
    maxFileSizeBytes: config.maxFileSizeMb * 1024 * 1024,
    maxPages: config.maxPages || 100,
    maxOcrPages: config.maxOcrPages || 100,
    label: config.label,
  };
}

/**
 * Dynamically updates dropzone banner limit text to reflect current role limits.
 * Also cleans up any previously selected file if it exceeds the new limits (e.g. after logout).
 */
function updateUploadLimitsUI(user) {
  const dropzoneLimitEl = document.getElementById('dropzoneLimitText') || document.querySelector('.dropzone-limit');
  const limits = getCurrentUserLimits(user);

  if (dropzoneLimitEl) {
    if (limits.role === 'pro') {
      dropzoneLimitEl.innerHTML = '<span class="badge-role role-pro" style="font-size: 0.6875rem; padding: 0.1rem 0.4rem; vertical-align: middle; margin-right: 4px;">PRO</span> Tệp tối đa <strong>100 MB</strong>, xử lý tối đa <strong>500 trang</strong> / tệp';
    } else if (limits.role === 'admin') {
      dropzoneLimitEl.innerHTML = '<span class="badge-role role-admin" style="font-size: 0.6875rem; padding: 0.1rem 0.4rem; vertical-align: middle; margin-right: 4px;">QUẢN TRỊ VIÊN</span> Tệp tối đa <strong>100 MB</strong>, xử lý tối đa <strong>500 trang</strong> / tệp';
    } else if (limits.role === 'free') {
      dropzoneLimitEl.innerHTML = 'Tệp miễn phí tối đa <strong>20 MB</strong>, xử lý tối đa <strong>100 trang</strong> / tệp (Nâng cấp Pro để hỗ trợ 100 MB / 500 trang)';
    } else {
      // Guest (unauthenticated)
      dropzoneLimitEl.innerHTML = 'Tệp tối đa <strong>20 MB</strong>, xử lý tối đa <strong>100 trang</strong> / tệp (Nâng cấp Pro để hỗ trợ 100 MB / 500 trang)';
    }
  }

  // If a file was selected or queue contains files exceeding new role limits (e.g. user logged out from Pro)
  const oversizedItem = batchQueue.find(item => item.size > limits.maxFileSizeBytes);
  if (oversizedItem || (selectedFile && selectedFile.size > limits.maxFileSizeBytes)) {
    const prevSize = formatFileSize(oversizedItem ? oversizedItem.size : selectedFile.size);
    resetFileSelection();
    const msg = `Tệp đã chọn (${prevSize}) vượt quá giới hạn ${limits.maxFileSizeMb}MB của tài khoản hiện tại nên đã được hủy chọn.`;
    if (typeof showToast === 'function') {
      showToast(msg, 'info');
    } else if (typeof alert === 'function') {
      alert(msg);
    }
  }
}

/**
 * Initialize Dropzone, Batch Queue, and file input handlers
 */
function initDropzone() {
  const dropzone = document.getElementById('dropzoneCard');
  const fileInput = document.getElementById('pdfFileInput');
  const btnSelectPdf = document.getElementById('btnSelectPdf');
  const dropzonePrompt = document.getElementById('dropzonePrompt');
  const dropzoneSelected = document.getElementById('dropzoneSelected');
  const previewFileName = document.getElementById('previewFileName');
  const previewFileSize = document.getElementById('previewFileSize');
  const btnRemoveFile = document.getElementById('btnRemoveFile');
  const btnAddMoreFiles = document.getElementById('btnAddMoreFiles');
  const btnClearBatchQueue = document.getElementById('btnClearBatchQueue');

  function isDuplicateFile(file) {
    if (!file || !batchQueue || batchQueue.length === 0) return false;
    return batchQueue.some((item) => item.name === file.name && item.size === file.size);
  }

  function validateFileForQueue(file, currentLimits) {
    if (!file) {
      return { valid: false, reason: 'empty', message: 'Tệp không hợp lệ.' };
    }
    const isPdf = Boolean(
      (file.name && file.name.toLowerCase().endsWith('.pdf')) ||
      file.type === 'application/pdf'
    );
    if (!isPdf) {
      return {
        valid: false,
        reason: 'format',
        message: `Tệp "${file.name || 'Không rõ'}" không phải định dạng PDF (.pdf)!`,
      };
    }
    const limits = currentLimits || getCurrentUserLimits();
    if (file.size > limits.maxFileSizeBytes) {
      return {
        valid: false,
        reason: 'size',
        message: `Dung lượng tệp (${formatFileSize(file.size)}) vượt quá giới hạn ${limits.maxFileSizeMb}MB của tài khoản!`,
      };
    }
    if (isDuplicateFile(file)) {
      return {
        valid: false,
        reason: 'duplicate',
        message: `Tệp "${file.name}" đã có trong hàng đợi.`,
      };
    }
    return { valid: true };
  }

  renderBatchQueueUI = function () {
    const card = document.getElementById('batchQueueCard');
    const list = document.getElementById('batchQueueList');
    const countBadge = document.getElementById('batchQueueCount');
    const emptyEl = document.getElementById('batchQueueEmpty');

    const count = batchQueue.length;
    if (countBadge) {
      countBadge.textContent = `${count} tệp`;
    }

    if (emptyEl) {
      emptyEl.style.display = count === 0 ? 'flex' : 'none';
    }

    if (!list) return;

    if (count === 0) {
      list.innerHTML = '';
      if (card) card.style.display = 'none';
      return;
    }

    if (card) card.style.display = 'block';

    let html = '';
    batchQueue.forEach((item, index) => {
      const formattedSize = formatFileSize(item.size);
      html += `
        <div class="batch-queue-item" data-id="${item.id}" data-index="${index}">
          <div class="queue-item-icon">
            <span class="badge-pdf-mini">PDF</span>
          </div>
          <div class="queue-item-details">
            <div class="queue-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
            <div class="queue-item-meta">
              <span class="queue-item-size">${formattedSize}</span>
              <span class="queue-item-status status-${item.status}">${item.statusText || 'Sẵn sàng'}</span>
            </div>
          </div>
          <button type="button" class="btn-queue-remove" data-id="${item.id}" title="Xóa tệp ${escapeHtml(item.name)} khỏi hàng đợi" aria-label="Xóa tệp khỏi hàng đợi">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;
    });
    list.innerHTML = html;

    const removeButtons = list.querySelectorAll('.btn-queue-remove');
    if (removeButtons && typeof removeButtons.forEach === 'function') {
      removeButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          removeFileFromBatchQueue(id);
        });
      });
    }
  };

  addFilesToBatchQueue = function (fileList) {
    if (!fileList) return { added: 0, skipped: 0, errors: [] };
    const files = Array.isArray(fileList) ? fileList : Array.from(fileList);
    if (files.length === 0) return { added: 0, skipped: 0, errors: [] };

    const limits = getCurrentUserLimits();
    const wasEmpty = (batchQueue.length === 0);
    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const file of files) {
      if (!file) continue;
      const validation = validateFileForQueue(file, limits);
      if (!validation.valid) {
        errors.push(validation.message);
        skippedCount++;
        if (typeof showToast === 'function') {
          showToast(validation.message, validation.reason === 'duplicate' ? 'warning' : 'error');
        } else if (typeof alert === 'function') {
          alert(validation.message);
        }
        if (validation.reason === 'size') {
          if (
            typeof window !== 'undefined' &&
            window.PDFLinguaPricing &&
            typeof window.PDFLinguaPricing.openQuotaExceededModal === 'function' &&
            limits.maxFileSizeMb < 100
          ) {
            window.PDFLinguaPricing.openQuotaExceededModal(validation.message);
          }
        }
        continue;
      }

      const queueItem = {
        id: 'batch_file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7),
        file: file,
        name: file.name,
        size: file.size,
        status: 'ready',
        statusText: 'Sẵn sàng',
      };
      batchQueue.push(queueItem);
      addedCount++;
    }

    if (batchQueue.length > 0) {
      selectedFile = batchQueue[0].file;

      if (previewFileName) previewFileName.textContent = selectedFile.name;
      if (previewFileSize) previewFileSize.textContent = formatFileSize(selectedFile.size);

      if (dropzonePrompt) dropzonePrompt.style.display = 'none';
      if (dropzoneSelected) dropzoneSelected.classList.add('active');

      // Only reset page selection if queue was previously empty
      if (wasEmpty && typeof window !== 'undefined' && window.pdfLinguaPageSelection && typeof window.pdfLinguaPageSelection.resetPageSelection === 'function') {
        window.pdfLinguaPageSelection.resetPageSelection();
      }
    }

    renderBatchQueueUI();

    return { added: addedCount, skipped: skippedCount, errors };
  };

  removeFileFromBatchQueue = function (idOrIdx) {
    let index = -1;
    if (typeof idOrIdx === 'number') {
      index = idOrIdx;
    } else if (typeof idOrIdx === 'string') {
      index = batchQueue.findIndex((item) => item.id === idOrIdx);
    }

    if (index < 0 || index >= batchQueue.length) return false;

    const prevSelected = selectedFile;
    batchQueue.splice(index, 1);

    if (batchQueue.length === 0) {
      resetFileSelection();
    } else {
      selectedFile = batchQueue[0].file;
      if (previewFileName) previewFileName.textContent = selectedFile.name;
      if (previewFileSize) previewFileSize.textContent = formatFileSize(selectedFile.size);
      renderBatchQueueUI();

      // If selectedFile actually changed due to removing the active file, reset page selection
      if (
        prevSelected !== selectedFile &&
        typeof window !== 'undefined' &&
        window.pdfLinguaPageSelection &&
        typeof window.pdfLinguaPageSelection.resetPageSelection === 'function'
      ) {
        window.pdfLinguaPageSelection.resetPageSelection();
      }
    }
    return true;
  };

  clearBatchQueue = function () {
    resetFileSelection();
  };

  resetFileSelection = function () {
    batchQueue = [];
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (previewFileName) previewFileName.textContent = '';
    if (previewFileSize) previewFileSize.textContent = '';
    if (dropzonePrompt) dropzonePrompt.style.display = 'flex';
    if (dropzoneSelected) dropzoneSelected.classList.remove('active');

    renderBatchQueueUI();

    if (typeof window !== 'undefined' && window.pdfLinguaPageSelection && typeof window.pdfLinguaPageSelection.resetPageSelection === 'function') {
      window.pdfLinguaPageSelection.resetPageSelection();
    }
  };

  if (!dropzone || !fileInput) return;

  btnSelectPdf.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', () => {
    if (!selectedFile && batchQueue.length === 0) {
      fileInput.click();
    }
  });

  if (btnAddMoreFiles) {
    btnAddMoreFiles.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (btnClearBatchQueue) {
    btnClearBatchQueue.addEventListener('click', (e) => {
      e.stopPropagation();
      clearBatchQueue();
    });
  }

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToBatchQueue(e.target.files);
      fileInput.value = '';
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      addFilesToBatchQueue(dt.files);
    }
  });

  if (btnRemoveFile) {
    btnRemoveFile.addEventListener('click', (e) => {
      e.stopPropagation();
      resetFileSelection();
    });
  }

  function handleFile(file) {
    if (!file) return;
    addFilesToBatchQueue([file]);
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Expose globals for integration & testing (PDFL-81.4 & PDFL-252.1)
if (typeof window !== 'undefined') {
  window.pdfLinguaBatchQueue = {
    getQueue: () => [...batchQueue],
    getQueueCount: () => batchQueue.length,
    addFiles: (files) => addFilesToBatchQueue(files),
    addFile: (file) => addFilesToBatchQueue([file]),
    removeFile: (idOrIdx) => removeFileFromBatchQueue(idOrIdx),
    clearQueue: () => clearBatchQueue(),
    renderQueueUI: () => renderBatchQueueUI(),
    isDuplicate: (file) => (batchQueue.some(item => item.name === file.name && item.size === file.size)),
    validateFile: (file) => {
      if (!file) return { valid: false, reason: 'empty', message: 'Tệp không hợp lệ.' };
      const isPdf = Boolean((file.name && file.name.toLowerCase().endsWith('.pdf')) || file.type === 'application/pdf');
      if (!isPdf) return { valid: false, reason: 'format', message: `Tệp "${file.name || 'Không rõ'}" không phải định dạng PDF (.pdf)!` };
      const limits = getCurrentUserLimits();
      if (file.size > limits.maxFileSizeBytes) {
        return { valid: false, reason: 'size', message: `Dung lượng tệp (${formatFileSize(file.size)}) vượt quá giới hạn ${limits.maxFileSizeMb}MB của tài khoản!` };
      }
      if (batchQueue.some(item => item.name === file.name && item.size === file.size)) {
        return { valid: false, reason: 'duplicate', message: `Tệp "${file.name}" đã có trong hàng đợi.` };
      }
      return { valid: true };
    },
  };

  window.pdfLinguaUpload = Object.assign(window.pdfLinguaUpload || {}, {
    ROLE_LIMITS,
    DEFAULT_LIMITS,
    getCurrentUserLimits,
    updateUploadLimitsUI,
    formatFileSize,
    resetFileSelection: () => resetFileSelection(),
    getSelectedFile: () => selectedFile,
    setSelectedFile: (f) => {
      selectedFile = f;
      if (f && batchQueue.length === 0) {
        batchQueue = [{
          id: 'manual_' + Date.now(),
          file: f,
          name: f.name || 'manual.pdf',
          size: f.size || 0,
          status: 'ready',
          statusText: 'Sẵn sàng',
        }];
        renderBatchQueueUI();
      }
    },
    getBatchQueue: () => [...batchQueue],
    addFilesToQueue: (files) => addFilesToBatchQueue(files),
    removeFileFromQueue: (idOrIdx) => removeFileFromBatchQueue(idOrIdx),
    clearBatchQueue: () => clearBatchQueue(),
    handleFile: (f) => addFilesToBatchQueue([f]),
  });
}
