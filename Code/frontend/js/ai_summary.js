/**
 * PDF-Lingua - AI Document Summarization Module
 * ----------------------------------------------------------------------------
 * Handles AI summarization UI interaction, Pro VIP role authorization gates,
 * multi-style prompt requests (brief, bullets, detailed), Markdown rendering,
 * one-click clipboard copying, and synchronization with export controls.
 */

(function () {
  'use strict';

  const AI_API_ENDPOINT = 'http://localhost:8000/api/ai/summarize';

  // State cache for latest summary
  let lastSummaryText = '';
  let isSummarizing = false;

  function getAuthToken() {
    if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredToken === 'function') {
      return window.pdfLinguaAuth.getStoredToken();
    }
    try {
      return localStorage.getItem('pdfl_token') || sessionStorage.getItem('pdfl_token') || null;
    } catch (_e) {
      return null;
    }
  }

  function getStoredUser() {
    if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredUser === 'function') {
      return window.pdfLinguaAuth.getStoredUser();
    }
    try {
      const raw = localStorage.getItem('pdfl_user') || sessionStorage.getItem('pdfl_user');
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function showToast(message, type = 'success') {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[Toast ${type}] ${message}`);
    }
  }

  function formatStyleLabel(styleKey) {
    switch (styleKey) {
      case 'brief': return 'Ngắn gọn';
      case 'bullets': return 'Ý chính';
      case 'detailed': return 'Chi tiết';
      default: return styleKey || 'Tự động';
    }
  }

  /**
   * Escape HTML entities to prevent XSS attacks before formatting markdown.
   */
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Safe, lightweight Markdown renderer converting headers, bold text,
   * bullet points, and numbered lists into semantic HTML elements.
   */
  function renderMarkdown(rawText) {
    if (!rawText || !rawText.trim()) return '';

    const safe = escapeHtml(rawText.trim());
    const lines = safe.split(/\r?\n/);
    const htmlParts = [];
    let inUl = false;
    let inOl = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      if (!line) {
        if (inUl) { htmlParts.push('</ul>'); inUl = false; }
        if (inOl) { htmlParts.push('</ol>'); inOl = false; }
        continue;
      }

      // Format bold markdown: **bold text**
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Check headings (### or ##)
      if (line.startsWith('### ')) {
        if (inUl) { htmlParts.push('</ul>'); inUl = false; }
        if (inOl) { htmlParts.push('</ol>'); inOl = false; }
        htmlParts.push(`<h4>${line.substring(4)}</h4>`);
        continue;
      }
      if (line.startsWith('## ')) {
        if (inUl) { htmlParts.push('</ul>'); inUl = false; }
        if (inOl) { htmlParts.push('</ol>'); inOl = false; }
        htmlParts.push(`<h3>${line.substring(3)}</h3>`);
        continue;
      }

      // Check bullet items (• or - or *)
      const bulletMatch = line.match(/^([•\-\*])\s+(.+)$/);
      if (bulletMatch) {
        if (inOl) { htmlParts.push('</ol>'); inOl = false; }
        if (!inUl) { htmlParts.push('<ul>'); inUl = true; }
        htmlParts.push(`<li>${bulletMatch[2]}</li>`);
        continue;
      }

      // Check ordered items (1. 2. etc.)
      const orderMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (orderMatch) {
        if (inUl) { htmlParts.push('</ul>'); inUl = false; }
        if (!inOl) { htmlParts.push('<ol>'); inOl = true; }
        htmlParts.push(`<li>${orderMatch[2]}</li>`);
        continue;
      }

      // Regular paragraph line
      if (inUl) { htmlParts.push('</ul>'); inUl = false; }
      if (inOl) { htmlParts.push('</ol>'); inOl = false; }
      htmlParts.push(`<p>${line}</p>`);
    }

    if (inUl) htmlParts.push('</ul>');
    if (inOl) htmlParts.push('</ol>');

    return htmlParts.join('\n');
  }

  function openAiProModal() {
    const modal = document.getElementById('aiProModal');
    if (modal) {
      modal.removeAttribute('hidden');
      modal.style.display = 'flex';
    }
  }

  function closeAiProModal() {
    const modal = document.getElementById('aiProModal');
    if (modal) {
      modal.setAttribute('hidden', '');
      modal.style.display = 'none';
    }
  }

  /**
   * Check if current user is logged in and has Pro or Admin privileges.
   */
  function isProOrAdmin() {
    const user = getStoredUser();
    if (!user || !user.role) return false;
    const role = String(user.role).toLowerCase();
    return role === 'pro' || role === 'admin';
  }

  /**
   * Toggle the AI Summary card in Workspace.
   * If user is not Pro, prompts the Pro Upgrade dialog instead.
   */
  function handleToggleAiSummaryCard() {
    const token = getAuthToken();
    const user = getStoredUser();

    if (!token || !user) {
      showToast('Vui lòng đăng nhập để sử dụng tính năng tóm tắt AI.', 'error');
      if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.openLoginModal === 'function') {
        window.pdfLinguaAuth.openLoginModal();
      }
      return;
    }

    if (!isProOrAdmin()) {
      openAiProModal();
      return;
    }

    const card = document.getElementById('aiSummaryCard');
    if (!card) return;

    if (card.style.display === 'none' || card.hasAttribute('hidden')) {
      card.removeAttribute('hidden');
      card.style.display = 'block';
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      card.style.display = 'none';
    }
  }

  /**
   * Execute document summarization via POST /api/ai/summarize.
   */
  async function handleExecuteAiSummary() {
    if (isSummarizing) return;

    const token = getAuthToken();
    if (!token) {
      showToast('Vui lòng đăng nhập để sử dụng AI.', 'error');
      return;
    }

    if (!isProOrAdmin()) {
      openAiProModal();
      return;
    }

    // Retrieve text from original pane or translated pane
    let textToSummarize = '';
    const paneOriginal = document.getElementById('paneOriginal');
    const paneTranslated = document.getElementById('paneTranslated');

    if (paneOriginal && paneOriginal.innerText && paneOriginal.innerText.trim()) {
      textToSummarize = paneOriginal.innerText.trim();
    } else if (paneTranslated && paneTranslated.innerText && paneTranslated.innerText.trim()) {
      textToSummarize = paneTranslated.innerText.trim();
    }

    // Fallback: Check document data in workspace
    if (!textToSummarize && typeof window !== 'undefined' && window.pdfLinguaWorkspace) {
      const doc = window.pdfLinguaWorkspace.getCurrentDocData();
      if (doc) {
        textToSummarize = doc.original_text || doc.translated_text || '';
      }
    }

    if (!textToSummarize || !textToSummarize.trim()) {
      showToast('Chưa có nội dung văn bản để tóm tắt. Vui lòng mở hoặc tải lên một tệp PDF.', 'error');
      return;
    }

    const styleSelect = document.getElementById('aiSummaryStyle');
    const lengthSelect = document.getElementById('aiSummaryLength');
    const style = styleSelect ? styleSelect.value : 'brief';
    const length = lengthSelect ? lengthSelect.value : 'medium';

    let documentId = null;
    if (typeof window !== 'undefined' && window.pdfLinguaWorkspace) {
      const doc = window.pdfLinguaWorkspace.getCurrentDocData();
      if (doc && doc.document_id) {
        documentId = doc.document_id;
      }
    }

    // Update UI to loading state
    const loadingEl = document.getElementById('aiSummaryLoading');
    const resultEl = document.getElementById('aiSummaryResult');
    const btnExecute = document.getElementById('btnExecuteAiSummary');
    const btnText = document.getElementById('btnExecuteAiSummaryText');

    isSummarizing = true;
    if (loadingEl) loadingEl.style.display = 'block';
    if (resultEl) resultEl.style.display = 'none';
    if (btnExecute) btnExecute.disabled = true;
    if (btnText) btnText.textContent = 'Đang phân tích...';

    try {
      const payload = {
        text: textToSummarize,
        style: style,
        length: length,
      };
      if (documentId) {
        payload.document_id = documentId;
      }

      const response = await fetch(AI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403 && (result.error_code === 'PRO_REQUIRED' || (result.message && result.message.includes('Pro')))) {
          openAiProModal();
          return;
        }
        if (response.status === 401) {
          showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
          if (window.pdfLinguaAuth && typeof window.pdfLinguaAuth.openLoginModal === 'function') {
            window.pdfLinguaAuth.openLoginModal();
          }
          return;
        }
        throw new Error(result.message || 'Lỗi khi gọi dịch vụ tóm tắt AI.');
      }

      const data = result.data || {};
      lastSummaryText = data.summary || '';

      // Populate metadata badges
      const modelBadge = document.getElementById('aiModelUsedBadge');
      const styleBadge = document.getElementById('aiStyleUsedBadge');
      const wordBadge = document.getElementById('aiWordCountBadge');
      const timeBadge = document.getElementById('aiTimeElapsedBadge');

      if (modelBadge) modelBadge.textContent = data.model_used || 'gpt-5-mini';
      if (styleBadge) styleBadge.textContent = formatStyleLabel(data.style || style);
      if (wordBadge) wordBadge.textContent = `${data.word_count || 0} từ`;
      if (timeBadge) timeBadge.textContent = `${data.execution_time_ms || 0}ms`;

      // Render Markdown output
      const contentEl = document.getElementById('aiSummaryContent');
      if (contentEl) {
        contentEl.innerHTML = renderMarkdown(lastSummaryText);
      }

      // Synchronize with Workspace session and Export state
      if (typeof window !== 'undefined' && window.pdfLinguaWorkspace) {
        const docData = window.pdfLinguaWorkspace.getCurrentDocData();
        if (docData) {
          docData.summary_text = lastSummaryText;
          docData.summary = lastSummaryText;
          window.pdfLinguaWorkspace.setCurrentDocData(docData);
          if (typeof window.pdfLinguaWorkspace.updateSummaryExportState === 'function') {
            window.pdfLinguaWorkspace.updateSummaryExportState();
          }
        }
      }

      // Show result box
      if (resultEl) resultEl.style.display = 'block';

      if (data.fallback_used) {
        showToast('Đã tạo bản tóm tắt nội dung (chế độ ngoại tuyến).', 'success');
      } else {
        showToast('Tóm tắt tài liệu thành công!', 'success');
      }

    } catch (err) {
      console.error('[AI Summary Error]', err);
      showToast(err.message || 'Không thể tạo bản tóm tắt. Vui lòng thử lại sau.', 'error');
    } finally {
      isSummarizing = false;
      if (loadingEl) loadingEl.style.display = 'none';
      if (btnExecute) btnExecute.disabled = false;
      if (btnText) btnText.textContent = 'Bắt đầu tóm tắt';
    }
  }

  /**
   * One-click clipboard copy for summary text.
   */
  async function handleCopySummary() {
    if (!lastSummaryText) {
      const contentEl = document.getElementById('aiSummaryContent');
      if (contentEl && contentEl.innerText) {
        lastSummaryText = contentEl.innerText.trim();
      }
    }

    if (!lastSummaryText) {
      showToast('Chưa có nội dung tóm tắt để sao chép.', 'error');
      return;
    }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(lastSummaryText);
      } else {
        // Fallback for older browser contexts
        const textarea = document.createElement('textarea');
        textarea.value = lastSummaryText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      const btnCopyText = document.getElementById('btnCopyAiSummaryText');
      if (btnCopyText) {
        const originalText = btnCopyText.textContent;
        btnCopyText.textContent = 'Đã sao chép!';
        setTimeout(() => {
          btnCopyText.textContent = originalText;
        }, 2000);
      }

      showToast('Đã sao chép nội dung tóm tắt vào clipboard!', 'success');
    } catch (_err) {
      showToast('Không thể sao chép văn bản vào clipboard.', 'error');
    }
  }

  /**
   * Initialize event bindings on DOM elements.
   */
  function initAiSummary() {
    const btnAiSummarize = document.getElementById('btnAiSummarize');
    const btnExecuteAiSummary = document.getElementById('btnExecuteAiSummary');
    const btnCloseAiSummary = document.getElementById('btnCloseAiSummary');
    const btnCopyAiSummary = document.getElementById('btnCopyAiSummary');

    const btnCloseAiProModal = document.getElementById('btnCloseAiProModal');
    const btnDismissAiProModal = document.getElementById('btnDismissAiProModal');
    const btnGoToPricingFromAi = document.getElementById('btnGoToPricingFromAi');

    if (btnAiSummarize) {
      btnAiSummarize.addEventListener('click', handleToggleAiSummaryCard);
    }
    if (btnExecuteAiSummary) {
      btnExecuteAiSummary.addEventListener('click', handleExecuteAiSummary);
    }
    if (btnCloseAiSummary) {
      btnCloseAiSummary.addEventListener('click', () => {
        const card = document.getElementById('aiSummaryCard');
        if (card) card.style.display = 'none';
      });
    }
    if (btnCopyAiSummary) {
      btnCopyAiSummary.addEventListener('click', handleCopySummary);
    }

    if (btnCloseAiProModal) {
      btnCloseAiProModal.addEventListener('click', closeAiProModal);
    }
    if (btnDismissAiProModal) {
      btnDismissAiProModal.addEventListener('click', closeAiProModal);
    }
    if (btnGoToPricingFromAi) {
      btnGoToPricingFromAi.addEventListener('click', () => {
        closeAiProModal();
        if (typeof window !== 'undefined' && window.location) {
          window.location.hash = '#pricingSection';
        }
        const pricingSection = document.getElementById('pricingSection');
        if (pricingSection) {
          pricingSection.style.display = 'block';
          pricingSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }

  // Initialize on DOM ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAiSummary);
    } else {
      initAiSummary();
    }
  }

  // Export module for testing and integration
  if (typeof window !== 'undefined') {
    window.pdfLinguaAiSummary = {
      initAiSummary,
      handleToggleAiSummaryCard,
      handleExecuteAiSummary,
      handleCopySummary,
      renderMarkdown,
      formatStyleLabel,
      openAiProModal,
      closeAiProModal,
      isProOrAdmin,
      getLastSummaryText: () => lastSummaryText,
      setLastSummaryText: (t) => { lastSummaryText = t; },
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      renderMarkdown,
      formatStyleLabel,
    };
  }
})();

