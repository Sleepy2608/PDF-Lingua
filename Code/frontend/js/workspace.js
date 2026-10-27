const API_BASE_URL = 'http://localhost:8000/api/process';

let currentDocData = null;

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
      downloadDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!downloadDropdown.contains(e.target) && e.target !== btnDownloadMenu) {
        downloadDropdown.classList.remove('show');
      }
    });
  }

  if (btnDownloadTxt) {
    btnDownloadTxt.addEventListener('click', () => triggerDownload('txt'));
  }

  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', () => triggerDownload('pdf'));
  }

  if (btnNewFile) {
    btnNewFile.addEventListener('click', resetToUpload);
  }
}

async function handleProcessPdf() {
  if (typeof selectedFile === 'undefined' || !selectedFile) {
    showToast('Vui lòng chọn một tệp PDF trước khi bắt đầu!', 'error');
    return;
  }

  const targetLang = document.getElementById('targetLangSelect')?.value || 'vi';
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('target_lang', targetLang);

  showProgressModal(true);
  updateProgress(20, 'Đang tải tệp PDF lên máy chủ...', 1);

  try {
    const progressTimer1 = setTimeout(() => {
      updateProgress(45, 'Đang đọc và phân tích văn bản PDF (Kiểm tra OCR)...', 2);
    }, 600);

    const progressTimer2 = setTimeout(() => {
      updateProgress(75, 'Đang dịch thuật văn bản sang ngôn ngữ đích...', 3);
    }, 1500);

    const response = await fetch(`${API_BASE_URL}/upload-and-translate`, {
      method: 'POST',
      body: formData,
    });

    clearTimeout(progressTimer1);
    clearTimeout(progressTimer2);

    const result = await response.json();

    if (!response.ok || !result.success) {
      const msg = result.detail || result.message || 'Xử lý tài liệu thất bại.';
      throw new Error(msg);
    }

    updateProgress(100, 'Xử lý và dịch thuật hoàn tất!', 4);
    currentDocData = result.data;

    setTimeout(() => {
      showProgressModal(false);
      renderWorkspace(result.data);
      showToast('Tài liệu đã được dịch thuật thành công!', 'success');
    }, 400);

  } catch (error) {
    showProgressModal(false);
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
    const response = await fetch(`${API_BASE_URL}/retranslate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: currentDocData.original_text,
        target_lang: newTargetLang,
        source_lang: 'auto',
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.detail || result.message || 'Dịch lại thất bại.');
    }

    const newTranslatedText = result.data.translated_text;
    currentDocData.translated_text = newTranslatedText;
    currentDocData.target_lang = newTargetLang;

    const paneTranslated = document.getElementById('paneTranslated');
    if (paneTranslated) {
      paneTranslated.innerText = newTranslatedText;
    }
    updateCounters();
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

async function triggerDownload(format) {
  if (!currentDocData || !currentDocData.translated_text) {
    showToast('Chưa có nội dung bản dịch để tải về!', 'error');
    return;
  }

  const dropdown = document.getElementById('downloadDropdown');
  if (dropdown) dropdown.classList.remove('show');

  const baseName = (currentDocData.filename || 'tai_lieu').replace(/\.[^/.]+$/, '');
  const title = `PDF-Lingua — ${currentDocData.filename || 'Tài Liệu Dịch'}`;

  showToast(`Đang chuẩn bị tệp .${format.toUpperCase()}...`, 'info');

  try {
    const response = await fetch(`${API_BASE_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: currentDocData.translated_text,
        format: format,
        filename: `${baseName}_dich`,
        title: title,
        original_content: currentDocData.original_text,
      }),
    });

    if (!response.ok) {
      throw new Error('Lỗi khi tải tệp từ máy chủ.');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${baseName}_dich.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);

    showToast(`Đã tải xuống thành công tệp .${format.toUpperCase()}!`, 'success');
  } catch (error) {
    showToast(error.message || 'Tải tệp thất bại!', 'error');
  }
}

function renderWorkspace(data) {
  const heroSection = document.getElementById('heroSection');
  const workspaceSection = document.getElementById('workspaceSection');

  if (heroSection) heroSection.style.display = 'none';
  if (workspaceSection) workspaceSection.style.display = 'block';

  const docName = document.getElementById('docNameDisplay');
  const docPages = document.getElementById('docPagesDisplay');
  const docSize = document.getElementById('docSizeDisplay');
  const docType = document.getElementById('docTypeDisplay');
  const paneOriginal = document.getElementById('paneOriginal');
  const paneTranslated = document.getElementById('paneTranslated');

  if (docName) docName.textContent = data.filename;
  if (docPages) docPages.textContent = `${data.page_count} trang`;
  if (docSize) docSize.textContent = `${data.file_size_mb} MB`;

  if (docType) {
    if (data.is_ocr_used) {
      docType.className = 'meta-pill ocr';
      docType.textContent = 'Quét OCR';
    } else {
      docType.className = 'meta-pill digital';
      docType.textContent = 'PDF Số';
    }
  }

  if (paneOriginal) paneOriginal.innerText = data.original_text || '';
  if (paneTranslated) paneTranslated.innerText = data.translated_text || '';

  const targetLangSelect = document.getElementById('targetLangSelect');
  if (targetLangSelect && data.target_lang) {
    targetLangSelect.value = data.target_lang;
  }

  updateCounters();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetToUpload() {
  currentDocData = null;
  const heroSection = document.getElementById('heroSection');
  const workspaceSection = document.getElementById('workspaceSection');

  if (workspaceSection) workspaceSection.style.display = 'none';
  if (heroSection) heroSection.style.display = 'block';

  const btnRemoveFile = document.getElementById('btnRemoveFile');
  if (btnRemoveFile) btnRemoveFile.click();

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
    updateProgress(15, 'Đang chuẩn bị...', 1);
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
