/**
 * PDF-Lingua - AI Copilot Chat Module
 * -----------------------------------------------------------------------------
 * Interactive Copilot assistant for asking questions and conversing with documents.
 * Features:
 * - Pro VIP role gate with upgrade prompt modal for Free users
 * - Sliding drawer container with responsive layout
 * - Multi-turn conversational history management
 * - RAG context integration with anti-hallucination guardrails
 * - Real-time typing indicator with bouncing dots animation
 * - Network failure retry button
 * - Daily quota tracking and counter display
 * - Safe markdown rendering for assistant responses
 */

(function () {
  'use strict';

  const CHAT_API_ENDPOINT = 'http://localhost:8000/api/ai/chat';

  // Internal Copilot State
  const state = {
    isOpen: false,
    isProcessing: false,
    conversationHistory: [],
    dailyQuestionsRemaining: null,
    lastFailedQuery: null,
  };

  // Helper: Retrieve JWT authentication token
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

  // Helper: Retrieve authenticated user profile
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

  // Helper: Display UI toast message
  function showToast(message, type = 'success') {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[Toast ${type}] ${message}`);
    }
  }

  // Helper: Escape HTML entities to prevent XSS attacks
  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: Safe Markdown formatting for assistant responses
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

      // Format bold text: **bold**
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Headings
      if (line.startsWith('### ')) {
        if (inUl) { htmlParts.push('</ul>'); inUl = false; }
        if (inOl) { htmlParts.push('</ol>'); inOl = false; }
        htmlParts.push(`<h4>${line.substring(4)}</h4>`);
      } else if (line.startsWith('## ')) {
        if (inUl) { htmlParts.push('</ul>'); inUl = false; }
        if (inOl) { htmlParts.push('</ol>'); inOl = false; }
        htmlParts.push(`<h3>${line.substring(3)}</h3>`);
      } else if (line.startsWith('# ')) {
        if (inUl) { htmlParts.push('</ul>'); inUl = false; }
        if (inOl) { htmlParts.push('</ol>'); inOl = false; }
        htmlParts.push(`<h2>${line.substring(2)}</h2>`);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet list item
        if (inOl) { htmlParts.push('</ol>'); inOl = false; }
        if (!inUl) { htmlParts.push('<ul>'); inUl = true; }
        htmlParts.push(`<li>${line.substring(2)}</li>`);
      } else if (/^\d+\.\s/.test(line)) {
        // Numbered list item
        if (inUl) { htmlParts.push('</ul>'); inUl = false; }
        if (!inOl) { htmlParts.push('<ol>'); inOl = true; }
        htmlParts.push(`<li>${line.replace(/^\d+\.\s/, '')}</li>`);
      } else {
        // Normal paragraph
        if (inUl) { htmlParts.push('</ul>'); inUl = false; }
        if (inOl) { htmlParts.push('</ol>'); inOl = false; }
        htmlParts.push(`<p>${line}</p>`);
      }
    }

    if (inUl) htmlParts.push('</ul>');
    if (inOl) htmlParts.push('</ol>');

    return htmlParts.join('\n');
  }

  // Open Pro Upgrade Modal
  function showProModal() {
    const modal = document.getElementById('aiProModal');
    if (modal) {
      modal.removeAttribute('hidden');
      modal.style.display = 'flex';
      const dismissBtn = document.getElementById('btnDismissAiProModal');
      if (dismissBtn) dismissBtn.focus();
    }
  }

  // Check if current user is Pro or Admin
  function isUserPro() {
    const user = getStoredUser();
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    return role === 'pro' || role === 'admin';
  }

  // Update active document badge in Copilot header
  function updateCopilotDocBadge() {
    const badge = document.getElementById('copilotDocBadge');
    if (!badge) return;
    let docName = '';
    const nameEl = document.getElementById('docNameDisplay');
    if (nameEl && nameEl.textContent && nameEl.textContent.trim()) {
      docName = nameEl.textContent.trim();
    }
    if (!docName && typeof window !== 'undefined' && window.pdfLinguaWorkspace && typeof window.pdfLinguaWorkspace.getCurrentDocData === 'function') {
      const doc = window.pdfLinguaWorkspace.getCurrentDocData();
      if (doc && doc.filename) docName = doc.filename;
    }
    badge.textContent = docName || 'Tài liệu song ngữ';
  }

  // Open Copilot Drawer
  function openCopilotDrawer() {
    const user = getStoredUser();
    const token = getAuthToken();

    if (!token || !user) {
      showToast('Vui long dang nhap de su dung Tro ly AI Copilot.', 'info');
      showProModal();
      return;
    }

    if (!isUserPro()) {
      showProModal();
      return;
    }

    const drawer = document.getElementById('aiCopilotDrawer');
    const backdrop = document.getElementById('aiCopilotBackdrop');

    if (drawer) {
      drawer.style.display = 'flex';
      drawer.classList.add('open');
    }
    if (backdrop) {
      backdrop.style.display = 'none';
      backdrop.classList.add('visible');
    }

    updateCopilotDocBadge();

    state.isOpen = true;

    // Focus input field
    const input = document.getElementById('copilotInput');
    if (input) {
      setTimeout(() => input.focus(), 150);
    }
  }

  // Close Copilot Drawer
  function closeCopilotDrawer() {
    const drawer = document.getElementById('aiCopilotDrawer');
    const backdrop = document.getElementById('aiCopilotBackdrop');

    if (drawer) {
      drawer.style.display = 'none';
      drawer.classList.remove('open');
    }
    if (backdrop) {
      backdrop.style.display = 'none';
      backdrop.classList.remove('visible');
    }

    state.isOpen = false;
  }

  // Toggle Copilot Drawer
  function toggleCopilotDrawer() {
    if (state.isOpen) {
      closeCopilotDrawer();
    } else {
      openCopilotDrawer();
    }
  }

  // Scroll chat messages list to bottom
  function scrollToBottom() {
    const container = document.getElementById('copilotMessagesContainer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // Format current time HH:MM
  function formatCurrentTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // Append User message to UI
  function appendUserMessage(text) {
    const list = document.getElementById('copilotMessagesList');
    if (!list) return;

    const welcomeHero = document.getElementById('copilotWelcomeHero');
    if (welcomeHero) welcomeHero.style.display = 'none';
    const welcomeMsg = document.getElementById('copilotWelcomeMsg');
    if (welcomeMsg) welcomeMsg.style.display = 'none';

    const msgDiv = document.createElement('div');
    msgDiv.className = 'copilot-msg copilot-msg-user';

    const safeText = escapeHtml(text);
    const time = formatCurrentTime();

    msgDiv.innerHTML = `
      <div class="copilot-msg-content">
        <p>${safeText}</p>
        <div class="copilot-msg-meta" style="justify-content: flex-end;">
          <span class="copilot-msg-time">${time}</span>
        </div>
      </div>
    `;

    list.appendChild(msgDiv);
    scrollToBottom();
  }

  // Append Assistant message to UI
  function appendAssistantMessage(answer, relevantChunks = []) {
    const list = document.getElementById('copilotMessagesList');
    if (!list) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'copilot-msg copilot-msg-assistant';

    const formattedContent = renderMarkdown(answer);
    const time = formatCurrentTime();

    let sourcesHtml = '';
    if (relevantChunks && relevantChunks.length > 0) {
      sourcesHtml = `
        <span class="copilot-source-tag" title="Can cu theo noi dung trich xuat tu tai lieu">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          ${relevantChunks.length} doan trich dan
        </span>
      `;
    }

    msgDiv.innerHTML = `
      <div class="copilot-msg-avatar" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.4 7.2L21.6 12l-7.2 2.4L12 21.6l-2.4-7.2L2.4 12l7.2-2.4L12 2z"/>
        </svg>
      </div>
      <div class="copilot-msg-content markdown-body">
        ${formattedContent}
        <div class="copilot-msg-meta">
          ${sourcesHtml}
          <span class="copilot-msg-time">${time}</span>
        </div>
      </div>
    `;

    list.appendChild(msgDiv);
    scrollToBottom();
  }

  // Append Error message with Retry action
  function appendErrorMessage(errorMessage, queryToRetry) {
    const list = document.getElementById('copilotMessagesList');
    if (!list) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'copilot-msg copilot-msg-assistant';

    const safeError = escapeHtml(errorMessage);
    state.lastFailedQuery = queryToRetry;

    msgDiv.innerHTML = `
      <div class="copilot-msg-avatar" style="background: #EF4444;" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="copilot-msg-content copilot-msg-error">
        <p>${safeError}</p>
        <button type="button" class="btn-copilot-retry" id="btnCopilotRetryAction">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          Thu lai
        </button>
      </div>
    `;

    list.appendChild(msgDiv);

    // Bind retry button
    const retryBtn = msgDiv.querySelector('#btnCopilotRetryAction');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        if (state.lastFailedQuery) {
          sendUserQuery(state.lastFailedQuery);
        }
      });
    }

    scrollToBottom();
  }

  // Show/Hide Typing Indicator
  function setTyping(isTyping) {
    state.isProcessing = isTyping;
    const indicator = document.getElementById('copilotTypingIndicator');
    const sendBtn = document.getElementById('btnSendCopilot');
    const input = document.getElementById('copilotInput');

    if (indicator) {
      indicator.style.display = isTyping ? 'flex' : 'none';
    }
    if (sendBtn) {
      sendBtn.disabled = isTyping || !(input && input.value.trim());
    }
    if (input) {
      input.disabled = isTyping;
      if (!isTyping) input.focus();
    }

    if (isTyping) scrollToBottom();
  }

  // Update Daily Quota Badge
  function updateQuotaDisplay(remaining) {
    const badge = document.getElementById('copilotQuotaBadge');
    if (!badge) return;

    if (remaining === null || remaining === undefined) {
      const user = getStoredUser();
      const role = (user && user.role ? user.role : '').toLowerCase();
      if (role === 'admin') {
        badge.textContent = 'Khong gioi han';
      } else {
        badge.textContent = '15/15 cau hoi';
      }
    } else {
      state.dailyQuestionsRemaining = remaining;
      badge.textContent = `${remaining}/15 cau hoi`;
    }
  }

  // Clear chat conversation
  function clearChatHistory() {
    state.conversationHistory = [];
    state.lastFailedQuery = null;

    const list = document.getElementById('copilotMessagesList');
    if (!list) return;

    // Reset to initial welcome greeting only
    list.innerHTML = `
      <div class="copilot-msg copilot-msg-assistant" id="copilotWelcomeMsg">
        <div class="copilot-msg-avatar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.2L21.6 12l-7.2 2.4L12 21.6l-2.4-7.2L2.4 12l7.2-2.4L12 2z"/>
          </svg>
        </div>
        <div class="copilot-msg-content">
          <p>Lich su tro chuyen da duoc lam moi. Hay dat cau hoi bat ky ve tai lieu hien tai!</p>
        </div>
      </div>
    `;

    const welcomeHero = document.getElementById('copilotWelcomeHero');
    if (welcomeHero) welcomeHero.style.display = 'flex';

    showToast('Da xoa lich su hoi dap voi AI Copilot.', 'info');
  }

  // Get active document text from workspace
  function getDocumentContext() {
    let text = '';

    // Check workspace translated pane first
    const transPane = document.getElementById('paneTranslated') || document.getElementById('editorTranslated');
    if (transPane && transPane.innerText && transPane.innerText.trim()) {
      text = transPane.innerText.trim();
    }

    // Fallback to original document pane
    if (!text) {
      const origPane = document.getElementById('paneOriginal') || document.getElementById('editorOriginal');
      if (origPane && origPane.innerText && origPane.innerText.trim()) {
        text = origPane.innerText.trim();
      }
    }

    // Fallback to workspace module state if available
    if (!text && typeof window !== 'undefined' && window.pdfLinguaWorkspace && typeof window.pdfLinguaWorkspace.getCurrentDocData === 'function') {
      const currentDoc = window.pdfLinguaWorkspace.getCurrentDocData();
      if (currentDoc) {
        text = currentDoc.translated_text || currentDoc.original_text || '';
      }
    }

    // Fallback to workspace global state if available
    if (!text && typeof window !== 'undefined' && window.workspaceState) {
      text = window.workspaceState.currentDocumentText || '';
    }

    return text;
  }

  // Send Query to AI Copilot API
  async function sendUserQuery(queryText) {
    const trimmed = (queryText || '').trim();
    if (!trimmed || state.isProcessing) return;

    const token = getAuthToken();
    if (!token) {
      showToast('Phien dang nhap het han. Vui long dang nhap lai.', 'error');
      showProModal();
      return;
    }

    // Append user query to UI and history
    appendUserMessage(trimmed);
    state.conversationHistory.push({ role: 'user', content: trimmed });

    // Clear input field
    const input = document.getElementById('copilotInput');
    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }

    setTyping(true);

    // Prepare document context and payload
    const documentText = getDocumentContext();
    let docId = null;
    if (typeof window !== 'undefined' && window.workspaceState && window.workspaceState.currentDocumentId) {
      docId = window.workspaceState.currentDocumentId;
    } else if (typeof window !== 'undefined' && window.pdfLinguaWorkspace && typeof window.pdfLinguaWorkspace.getCurrentDocData === 'function') {
      const currentDoc = window.pdfLinguaWorkspace.getCurrentDocData();
      if (currentDoc && (currentDoc.document_id || currentDoc.id)) {
        docId = currentDoc.document_id || currentDoc.id;
      }
    }

    const payload = {
      query: trimmed,
      document_text: documentText || 'Noi dung tai lieu dang xem tai Workspace.',
      conversation_history: state.conversationHistory.slice(-8), // send last 8 turns
    };
    if (docId) payload.document_id = docId;

    try {
      const response = await fetch(CHAT_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (response.status === 403) {
        setTyping(false);
        if (resData.error_code === 'PRO_REQUIRED') {
          showProModal();
          appendErrorMessage('Tinh nang AI Copilot yeu cau tai khoan Pro VIP.', trimmed);
        } else if (resData.error_code === 'DAILY_QUOTA_EXCEEDED') {
          showToast('Ban da su dung het 15 cau hoi/ngay cho goi Pro.', 'warning');
          appendErrorMessage('Ban da dat den han ngach 15 cau hoi/ngay cho goi Pro. Vui long quay lai vao ngay mai hoac nang cap goi khong gioi han.', null);
        } else {
          appendErrorMessage(resData.message || 'Khong co quyen thuc hien yeu cau.', trimmed);
        }
        return;
      }

      if (!response.ok || !resData.success) {
        setTyping(false);
        const errMsg = resData.message || `Loi he thong (${response.status}).`;
        appendErrorMessage(errMsg, trimmed);
        return;
      }

      // Success
      setTyping(false);
      const answer = resData.data.answer || 'Khong nhan duoc cau tra loi tu he thong.';
      const chunks = resData.data.relevant_chunks || [];

      // Record assistant answer in history
      state.conversationHistory.push({ role: 'assistant', content: answer });

      // Update remaining quota
      if (resData.data.daily_questions_remaining !== undefined) {
        updateQuotaDisplay(resData.data.daily_questions_remaining);
      }

      // Render assistant message in thread
      appendAssistantMessage(answer, chunks);

    } catch (networkError) {
      setTyping(false);
      console.error('[AI Copilot] Network exception:', networkError);
      appendErrorMessage('Loi ket noi den may chu AI. Vui long kiem tra mang va thu lai.', trimmed);
    }
  }

  // Initialize Copilot DOM events
  function initCopilotEvents() {
    // 1. Toolbar button toggle
    const btnAiCopilot = document.getElementById('btnAiCopilot');
    if (btnAiCopilot) {
      btnAiCopilot.addEventListener('click', function (e) {
        e.preventDefault();
        toggleCopilotDrawer();
      });
    }

    // 2. Close drawer button
    const btnClose = document.getElementById('btnCloseCopilotDrawer');
    if (btnClose) {
      btnClose.addEventListener('click', function () {
        closeCopilotDrawer();
      });
    }

    // 3. Backdrop click to close
    const backdrop = document.getElementById('aiCopilotBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        closeCopilotDrawer();
      });
    }

    // 4. Clear chat history button
    const btnClear = document.getElementById('btnClearCopilotChat');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        clearChatHistory();
      });
    }

    // 5. Quick suggestion prompt chips
    const quickChips = document.querySelectorAll('.copilot-prompt-chip');
    quickChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        const promptText = chip.getAttribute('data-prompt') || chip.textContent.trim();
        sendUserQuery(promptText);
      });
    });

    // 6. Form submit and textarea handling
    const chatForm = document.getElementById('copilotChatForm');
    const input = document.getElementById('copilotInput');
    const sendBtn = document.getElementById('btnSendCopilot');

    if (input) {
      input.addEventListener('input', function () {
        // Auto-expand textarea up to max 120px
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';

        if (sendBtn) {
          sendBtn.disabled = !this.value.trim() || state.isProcessing;
        }
      });

      input.addEventListener('keydown', function (e) {
        // Send on Enter (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (chatForm) {
            chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
          } else {
            sendUserQuery(this.value);
          }
        }
      });
    }

    if (chatForm) {
      chatForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (input && input.value.trim()) {
          sendUserQuery(input.value);
        }
      });
    }
  }

  // Self-initialization
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCopilotEvents);
    } else {
      initCopilotEvents();
    }
  }

  // Export module for external callers and test assertions
  if (typeof window !== 'undefined') {
    window.pdfLinguaCopilot = {
      open: openCopilotDrawer,
      close: closeCopilotDrawer,
      toggle: toggleCopilotDrawer,
      sendQuery: sendUserQuery,
      clearChat: clearChatHistory,
      renderMarkdown: renderMarkdown,
      escapeHtml: escapeHtml,
      state: state,
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      openCopilotDrawer,
      closeCopilotDrawer,
      toggleCopilotDrawer,
      sendUserQuery,
      clearChatHistory,
      renderMarkdown,
      escapeHtml,
      state,
      initCopilotEvents,
    };
  }
})();

