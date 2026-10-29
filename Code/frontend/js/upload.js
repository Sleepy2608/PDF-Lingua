/**
 * PDF-Lingua — Upload & Dropzone Module (PDFL-81.4)
 * --------------------------------------------------------------------------
 * Handles PDF file selection via dropzone and file input, enforces role-based
 * client-side size limits (Guest/Free: 20MB, Pro/Admin: 100MB), and updates
 * dropzone instructions dynamically based on user authentication state.
 */

const ROLE_LIMITS = {
  guest: { maxFileSizeMb: 20, maxOcrPages: 100, label: 'Khách' },
  free: { maxFileSizeMb: 20, maxOcrPages: 100, label: 'Miễn phí' },
  pro: { maxFileSizeMb: 100, maxOcrPages: 500, label: 'Pro' },
  admin: { maxFileSizeMb: 100, maxOcrPages: 500, label: 'Quản trị viên' },
};

const DEFAULT_LIMITS = ROLE_LIMITS.guest;

let selectedFile = null;
let resetFileSelection = () => {};

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
    maxOcrPages: config.maxOcrPages,
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
      dropzoneLimitEl.innerHTML = '<span class="badge-role role-pro" style="font-size: 0.6875rem; padding: 0.1rem 0.4rem; vertical-align: middle; margin-right: 4px;">PRO</span> Tệp tối đa <strong>100 MB</strong>, nhận diện OCR tối đa <strong>500 trang</strong>';
    } else if (limits.role === 'admin') {
      dropzoneLimitEl.innerHTML = '<span class="badge-role role-admin" style="font-size: 0.6875rem; padding: 0.1rem 0.4rem; vertical-align: middle; margin-right: 4px;">ADMIN</span> Tệp tối đa <strong>100 MB</strong>, nhận diện OCR tối đa <strong>500 trang</strong>';
    } else if (limits.role === 'free') {
      dropzoneLimitEl.innerHTML = 'Tệp miễn phí tối đa <strong>20 MB</strong>, OCR tối đa <strong>100 trang</strong> (Nâng cấp Pro để hỗ trợ 100 MB / 500 trang)';
    } else {
      // Guest (unauthenticated)
      dropzoneLimitEl.innerHTML = 'Tệp tối đa <strong>20 MB</strong>, OCR tối đa <strong>100 trang</strong> (Nâng cấp Pro để hỗ trợ 100 MB / 500 trang)';
    }
  }

  // If a file was selected but exceeds new role limits (e.g. user logged out from Pro)
  if (selectedFile && selectedFile.size > limits.maxFileSizeBytes) {
    const prevSize = formatFileSize(selectedFile.size);
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
 * Initialize Dropzone and file input handlers
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

  resetFileSelection = function () {
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (dropzonePrompt) dropzonePrompt.style.display = 'flex';
    if (dropzoneSelected) dropzoneSelected.classList.remove('active');
  };

  if (!dropzone || !fileInput) return;

  btnSelectPdf.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', () => {
    if (!selectedFile) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
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
    if (dt && dt.files && dt.files[0]) {
      handleFile(dt.files[0]);
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

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      const msg = 'Vui lòng chỉ tải lên tệp định dạng PDF (.pdf)!';
      if (typeof showToast === 'function') {
        showToast(msg, 'error');
      } else {
        alert(msg);
      }
      return;
    }

    const limits = getCurrentUserLimits();
    if (file.size > limits.maxFileSizeBytes) {
      const msg = `Dung lượng tệp (${formatFileSize(file.size)}) vượt quá giới hạn ${limits.maxFileSizeMb}MB của tài khoản!`;
      if (typeof showToast === 'function') {
        showToast(msg, 'error');
      } else {
        alert(msg);
      }
      return;
    }

    selectedFile = file;

    if (previewFileName) previewFileName.textContent = file.name;
    if (previewFileSize) previewFileSize.textContent = formatFileSize(file.size);

    if (dropzonePrompt) dropzonePrompt.style.display = 'none';
    if (dropzoneSelected) dropzoneSelected.classList.add('active');
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Expose globals for integration & testing
if (typeof window !== 'undefined') {
  window.pdfLinguaUpload = Object.assign(window.pdfLinguaUpload || {}, {
    ROLE_LIMITS,
    DEFAULT_LIMITS,
    getCurrentUserLimits,
    updateUploadLimitsUI,
    formatFileSize,
    resetFileSelection: () => resetFileSelection(),
    getSelectedFile: () => selectedFile,
    setSelectedFile: (f) => { selectedFile = f; },
  });
}
