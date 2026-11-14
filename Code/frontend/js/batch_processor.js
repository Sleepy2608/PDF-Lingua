/**
 * PDF-Lingua - Batch Processor & Orchestrator (PDFL-252.2)
 * --------------------------------------------------------------------------
 * Controls concurrent execution of PDF processing jobs from the Batch Queue:
 * - Strict concurrency limit = 2 (maximum 2 active processing jobs simultaneously).
 * - Independent job creation via POST /api/process/jobs.
 * - Independent Server-Sent Events (SSE) stream (/jobs/{job_id}/events) with polling fallback.
 * - Auto-dequeues next waiting job upon completion or failure.
 * - Updates per-file progress/status and overall batch progress.
 * - Packages and downloads all completed files via POST /api/process/batch-download (ZIP).
 */

(function (window) {
  'use strict';

  const BATCH_API_BASE_URL = (typeof API_BASE_URL !== 'undefined')
    ? API_BASE_URL
    : 'http://localhost:8000/api';

  class BatchOrchestrator {
    constructor() {
      this.maxConcurrency = 2;
      this.activeCount = 0;
      this.isProcessing = false;
      this.completedJobs = [];
      this.failedJobs = [];
      this.activeStreams = new Map();
      this.pollingTimers = new Map();
      this.isCancelled = false;

      this.initEvents();
    }

    initEvents() {
      if (typeof document === 'undefined') return;

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.bindUI());
      } else {
        this.bindUI();
      }
    }

    bindUI() {
      const btnDownloadBatchZip = document.getElementById('btnDownloadBatchZip');
      if (btnDownloadBatchZip) {
        btnDownloadBatchZip.addEventListener('click', (e) => {
          e.stopPropagation();
          this.downloadBatchZip('pdf');
        });
      }

      const btnDownloadBatchZipDocx = document.getElementById('btnDownloadBatchZipDocx');
      if (btnDownloadBatchZipDocx) {
        btnDownloadBatchZipDocx.addEventListener('click', (e) => {
          e.stopPropagation();
          this.downloadBatchZip('docx');
        });
      }

      const btnStartBatchProcess = document.getElementById('btnStartBatchProcess');
      if (btnStartBatchProcess) {
        btnStartBatchProcess.addEventListener('click', (e) => {
          e.stopPropagation();
          this.startBatch();
        });
      }
    }

    getAuthHeaders() {
      if (typeof getAuthHeaders === 'function') {
        return getAuthHeaders();
      }
      try {
        let token = null;
        if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getToken === 'function') {
          token = window.pdfLinguaAuth.getToken();
        } else if (typeof localStorage !== 'undefined' && localStorage) {
          token = localStorage.getItem('pdfl_access_token');
        }
        return token ? { Authorization: `Bearer ${token}` } : {};
      } catch (_e) {
        return {};
      }
    }

    showToast(message, type = 'info') {
      if (typeof showToast === 'function') {
        showToast(message, type);
      } else if (typeof alert === 'function' && type === 'error') {
        alert(message);
      }
    }

    lockQueueUI(locked) {
      const btnAddMoreFiles = document.getElementById('btnAddMoreFiles');
      const btnClearBatchQueue = document.getElementById('btnClearBatchQueue');
      const btnProcessPdf = document.getElementById('btnProcessPdf');
      const btnStartBatchProcess = document.getElementById('btnStartBatchProcess');

      if (btnAddMoreFiles) btnAddMoreFiles.disabled = locked;
      if (btnClearBatchQueue) btnClearBatchQueue.disabled = locked;
      if (btnProcessPdf) btnProcessPdf.disabled = locked;
      if (btnStartBatchProcess) btnStartBatchProcess.disabled = locked;

      // Lock all remove buttons in the queue
      const removeButtons = document.querySelectorAll('.btn-queue-remove');
      if (removeButtons && typeof removeButtons.forEach === 'function') {
        removeButtons.forEach((btn) => {
          btn.disabled = locked;
        });
      }
    }

    updateOverallProgress() {
      const queue = (window.pdfLinguaBatchQueue && window.pdfLinguaBatchQueue.getQueue()) || [];
      const total = queue.length;
      if (total === 0) return;

      const completedCount = queue.filter((i) => i.status === 'completed').length;
      const failedCount = queue.filter((i) => i.status === 'failed').length;
      const processedCount = completedCount + failedCount;

      let sumProgress = 0;
      queue.forEach((item) => {
        if (item.status === 'completed') {
          sumProgress += 100;
        } else if (item.status === 'failed') {
          sumProgress += item.progress || 100;
        } else {
          sumProgress += item.progress || 0;
        }
      });

      const overallPercent = Math.min(100, Math.max(0, Math.round(sumProgress / total)));

      const progressWrap = document.getElementById('batchOverallProgressWrap');
      const progressFill = document.getElementById('batchOverallProgressFill');
      const progressText = document.getElementById('batchOverallProgressText');

      if (progressWrap && (this.isProcessing || processedCount > 0)) {
        progressWrap.style.display = 'block';
      }

      if (progressFill) {
        progressFill.style.width = `${overallPercent}%`;
      }

      if (progressText) {
        progressText.textContent = `${processedCount} / ${total} hoàn thành (${overallPercent}%)`;
      }
    }

    startBatch() {
      if (this.isProcessing) return;

      const queue = (window.pdfLinguaBatchQueue && window.pdfLinguaBatchQueue.getQueue()) || [];
      if (queue.length === 0) {
        this.showToast('Hàng đợi tệp đang trống. Vui lòng thêm tệp PDF trước!', 'warning');
        return;
      }

      this.isProcessing = true;
      this.isCancelled = false;
      this.completedJobs = [];
      this.failedJobs = [];
      this.activeCount = 0;

      // Mark all non-completed items as waiting
      queue.forEach((item) => {
        if (item.status !== 'completed') {
          window.pdfLinguaBatchQueue.updateItem(item.id, {
            status: 'waiting',
            statusText: 'Đang xếp hàng chờ...',
            progress: 0,
          });
        }
      });

      this.lockQueueUI(true);

      const progressWrap = document.getElementById('batchOverallProgressWrap');
      if (progressWrap) progressWrap.style.display = 'block';

      const footer = document.getElementById('batchQueueFooter');
      if (footer) footer.style.display = 'none';

      const btnZip = document.getElementById('btnDownloadBatchZip');
      if (btnZip) btnZip.style.display = 'none';

      const btnZipDocx = document.getElementById('btnDownloadBatchZipDocx');
      if (btnZipDocx) btnZipDocx.style.display = 'none';

      const notice = document.getElementById('batchFooterNotice');
      if (notice) notice.style.display = 'none';

      this.updateOverallProgress();

      // Pump jobs adhering strictly to concurrency = 2
      this.pump();
    }

    pump() {
      if (!this.isProcessing || this.isCancelled) return;

      const queue = (window.pdfLinguaBatchQueue && window.pdfLinguaBatchQueue.getQueue()) || [];

      while (this.activeCount < this.maxConcurrency) {
        const nextItem = queue.find((i) => i.status === 'waiting' || i.status === 'ready');
        if (!nextItem) {
          if (this.activeCount === 0) {
            this.onBatchComplete();
          }
          break;
        }

        this.activeCount++;
        this.processItem(nextItem);
      }
    }

    async processItem(item) {
      window.pdfLinguaBatchQueue.updateItem(item.id, {
        status: 'processing',
        statusText: 'Đang gửi tệp lên máy chủ...',
        progress: 10,
      });
      this.updateOverallProgress();

      const targetLangSelect = document.getElementById('targetLangSelect');
      const targetLang = (targetLangSelect && targetLangSelect.value) ? targetLangSelect.value : 'vi';

      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('target_lang', targetLang);

      // PDFL-255.2 & PDFL-252.2 Page Selection Safety:
      // Do NOT apply file A's custom page selection to all other files in batch.
      // Each file must have its own valid page selection or default to all (null).
      const queue = (window.pdfLinguaBatchQueue && window.pdfLinguaBatchQueue.getQueue()) || [];
      if (item.pages && typeof item.pages === 'string' && item.pages.trim()) {
        formData.append('pages', item.pages.trim());
      } else if (queue.length === 1 && typeof validatePageSelection === 'function') {
        const pageVal = validatePageSelection();
        if (pageVal.mode === 'custom' && pageVal.pages) {
          formData.append('pages', pageVal.pages);
        }
      }

      try {
        const authHeaders = this.getAuthHeaders();
        const fetchOptions = {
          method: 'POST',
          body: formData,
        };
        if (authHeaders['Authorization']) {
          fetchOptions.headers = authHeaders;
        }

        const response = await fetch(`${BATCH_API_BASE_URL}/process/jobs`, fetchOptions);

        let result = null;
        try {
          result = await response.json();
        } catch (_e) { }

        if (response.status === 401) {
          this.handleItemFailure(item, 'Chưa xác thực hoặc phiên đăng nhập đã hết hạn (401).');
          if (typeof handleAuthError === 'function') handleAuthError(result);
          return;
        }

        if (response.status === 400) {
          const msg = (result && (result.detail || result.message)) || 'Dữ liệu không hợp lệ.';
          this.handleItemFailure(item, msg);
          return;
        }

        if (response.status === 413) {
          const msg = (result && (result.message || result.detail)) || 'Tệp vượt quá giới hạn dung lượng hoặc số trang.';
          this.handleItemFailure(item, msg);
          return;
        }

        if (!response.ok || !result || !result.success) {
          const msg = (result && (result.detail || result.message)) || `Lỗi máy chủ (${response.status})`;
          this.handleItemFailure(item, msg);
          return;
        }

        // Direct sync result (used by test mocks or direct processing)
        if (result.data && result.data.translated_text && !result.data.job_id) {
          this.handleItemSuccess(item, result.data);
          return;
        }

        const jobId = result.data ? result.data.job_id : null;
        if (!jobId) {
          this.handleItemFailure(item, 'Máy chủ không trả về mã tác vụ (Job ID).');
          return;
        }

        item.job_id = jobId;
        window.pdfLinguaBatchQueue.updateItem(item.id, {
          job_id: jobId,
          status: 'processing',
          statusText: 'Đang phân tích & dịch thuật...',
          progress: 20,
        });
        this.updateOverallProgress();

        // Listen to independent SSE events for this job
        this.listenToJobEvents(item, jobId);

      } catch (err) {
        const msg = err.message === 'Failed to fetch'
          ? 'Không thể kết nối đến máy chủ Backend.'
          : (err.message || 'Lỗi kết nối máy chủ.');
        this.handleItemFailure(item, msg);
      }
    }

    listenToJobEvents(item, jobId) {
      const EventSourceClass = (typeof EventSource !== 'undefined')
        ? EventSource
        : (typeof window !== 'undefined' && window.EventSource ? window.EventSource : null);

      if (!EventSourceClass) {
        this.startPolling(item, jobId);
        return;
      }

      try {
        const sseUrl = `${BATCH_API_BASE_URL}/process/jobs/${jobId}/events`;
        const es = new EventSourceClass(sseUrl);
        this.activeStreams.set(jobId, es);

        es.onmessage = (e) => {
          if (!e.data || e.data === ': keepalive') return;
          try {
            const data = JSON.parse(e.data);
            const pct = Math.min(100, Math.max(0, Math.round(data.progress_percentage || 0)));
            const msg = data.message || 'Đang xử lý...';

            window.pdfLinguaBatchQueue.updateItem(item.id, {
              progress: pct,
              statusText: msg,
            });
            this.updateOverallProgress();

            if (data.status === 'COMPLETED') {
              this.cleanupStream(jobId);
              this.handleItemSuccess(item, data.result);
            } else if (data.status === 'FAILED') {
              this.cleanupStream(jobId);
              this.handleItemFailure(item, data.error || 'Xử lý thất bại.');
            }
          } catch (_parseErr) { }
        };

        es.onerror = () => {
          this.cleanupStream(jobId);
          // Fallback to polling
          this.startPolling(item, jobId);
        };
      } catch (_e) {
        this.startPolling(item, jobId);
      }
    }

    startPolling(item, jobId) {
      if (this.pollingTimers.has(jobId)) return;

      const timer = setInterval(async () => {
        try {
          const authHeaders = this.getAuthHeaders();
          const response = await fetch(`${BATCH_API_BASE_URL}/process/jobs/${jobId}`, {
            headers: authHeaders,
          });
          if (!response.ok) return;

          const json = await response.json();
          if (!json || !json.data) return;

          const data = json.data;
          const pct = Math.min(100, Math.max(0, Math.round(data.progress_percentage || 0)));
          const msg = data.message || 'Đang xử lý...';

          window.pdfLinguaBatchQueue.updateItem(item.id, {
            progress: pct,
            statusText: msg,
          });
          this.updateOverallProgress();

          if (data.status === 'COMPLETED') {
            this.cleanupPolling(jobId);
            this.handleItemSuccess(item, data.result);
          } else if (data.status === 'FAILED') {
            this.cleanupPolling(jobId);
            this.handleItemFailure(item, data.error || 'Xử lý thất bại.');
          }
        } catch (_err) { }
      }, 1500);

      this.pollingTimers.set(jobId, timer);
    }

    cleanupStream(jobId) {
      if (this.activeStreams.has(jobId)) {
        try {
          const es = this.activeStreams.get(jobId);
          es.close();
        } catch (_e) { }
        this.activeStreams.delete(jobId);
      }
    }

    cleanupPolling(jobId) {
      if (this.pollingTimers.has(jobId)) {
        clearInterval(this.pollingTimers.get(jobId));
        this.pollingTimers.delete(jobId);
      }
    }

    cleanupAllConnections() {
      this.activeStreams.forEach((es) => {
        try { es.close(); } catch (_e) { }
      });
      this.activeStreams.clear();

      this.pollingTimers.forEach((timer) => {
        clearInterval(timer);
      });
      this.pollingTimers.clear();
    }

    handleItemSuccess(item, result) {
      item.status = 'completed';
      item.statusText = 'Hoàn thành';
      item.progress = 100;
      item.result = result;

      this.completedJobs.push(item);
      this.activeCount = Math.max(0, this.activeCount - 1);

      window.pdfLinguaBatchQueue.updateItem(item.id, {
        status: 'completed',
        statusText: 'Hoàn thành',
        progress: 100,
        result: result,
      });

      this.updateOverallProgress();
      this.pump();
    }

    handleItemFailure(item, errorMsg) {
      item.status = 'failed';
      item.statusText = `Thất bại: ${errorMsg || 'Lỗi không xác định'}`;

      this.failedJobs.push(item);
      this.activeCount = Math.max(0, this.activeCount - 1);

      window.pdfLinguaBatchQueue.updateItem(item.id, {
        status: 'failed',
        statusText: item.statusText,
      });

      this.updateOverallProgress();
      this.pump();
    }

    isProOrAdminUser() {
      let targetUser = null;
      try {
        if (typeof window !== 'undefined' && window.pdfLinguaAuth && typeof window.pdfLinguaAuth.getStoredUser === 'function') {
          targetUser = window.pdfLinguaAuth.getStoredUser();
        } else if (typeof localStorage !== 'undefined' && localStorage) {
          const raw = localStorage.getItem('pdfl_user');
          targetUser = raw ? JSON.parse(raw) : null;
        }
      } catch (_e) {
        targetUser = null;
      }
      if (!targetUser) return false;
      const role = String(targetUser.role || '').toLowerCase();
      return role === 'pro' || role === 'admin' || Boolean(targetUser.is_pro);
    }

    onBatchComplete() {
      this.isProcessing = false;
      this.lockQueueUI(false);
      this.cleanupAllConnections();

      const footer = document.getElementById('batchQueueFooter');
      const btnZip = document.getElementById('btnDownloadBatchZip');
      const btnZipDocx = document.getElementById('btnDownloadBatchZipDocx');
      const notice = document.getElementById('batchFooterNotice');

      if (footer) footer.style.display = 'block';

      if (this.completedJobs.length > 0) {
        if (btnZip) btnZip.style.display = 'inline-flex';
        if (btnZipDocx) btnZipDocx.style.display = 'inline-flex';

        if (this.failedJobs.length > 0) {
          if (notice) {
            notice.style.display = 'block';
            notice.textContent = `Đã hoàn thành ${this.completedJobs.length} tệp, có ${this.failedJobs.length} tệp thất bại. Bạn có thể tải các tệp thành công.`;
          }
          this.showToast(`Hoàn tất: ${this.completedJobs.length} thành công, ${this.failedJobs.length} thất bại.`, 'warning');
        } else {
          if (notice) notice.style.display = 'none';
          this.showToast(`Đã xử lý thành công toàn bộ ${this.completedJobs.length} tệp!`, 'success');
        }
      } else {
        if (btnZip) btnZip.style.display = 'none';
        if (btnZipDocx) btnZipDocx.style.display = 'none';
        if (notice) {
          notice.style.display = 'block';
          notice.textContent = 'Toàn bộ các tệp trong hàng đợi đều xử lý thất bại.';
        }
        this.showToast('Không có tệp nào xử lý thành công trong hàng đợi.', 'error');
      }

      // If exactly 1 file was processed successfully and workspace can render it
      if (this.completedJobs.length === 1 && this.completedJobs[0].result) {
        const res = this.completedJobs[0].result;
        if (typeof renderWorkspace === 'function') {
          renderWorkspace(res);
        }
      }
    }

    async downloadBatchZip(format = 'pdf') {
        if (this.completedJobs.length === 0) {
          this.showToast('Không có tệp nào xử lý thành công để tải về.', 'warning');
          return;
        }

        // Kiểm tra quyền Pro đối với định dạng Word (.docx)
        if (format === 'docx' && !this.isProOrAdminUser()) {
          const proMsg = 'Tính năng tải tệp Word (.docx) chỉ dành riêng cho tài khoản Pro.';
          this.showToast(proMsg, 'warning');
          if (
            typeof window !== 'undefined' &&
            window.PDFLinguaPricing &&
            typeof window.PDFLinguaPricing.openQuotaExceededModal === 'function'
          ) {
            window.PDFLinguaPricing.openQuotaExceededModal('Tính năng tải trọn bộ ZIP file Word (.docx) chỉ dành riêng cho tài khoản Pro. Vui lòng nâng cấp gói để sử dụng!');
          }
          return;
        }

        const jobIds = this.completedJobs.map((i) => i.job_id).filter(Boolean);
        if (jobIds.length === 0) {
          this.showToast('Không tìm thấy mã tác vụ hợp lệ để tải về.', 'warning');
          return;
        }

        const targetBtn = (format === 'docx')
          ? document.getElementById('btnDownloadBatchZipDocx')
          : document.getElementById('btnDownloadBatchZip');

        let prevHtml = '';
      if (targetBtn) {
        targetBtn.disabled = true;
        prevHtml = targetBtn.innerHTML;
        targetBtn.innerHTML = `
            < svg class="spinner-svg" width = "15" height = "15" viewBox = "0 0 24 24" fill = "none" stroke = "currentColor" stroke - width="2.5" >
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg >
          <span>Đang tạo ZIP...</span>
          `;
      }

      try {
        const authHeaders = this.getAuthHeaders();
        const fetchHeaders = {
          'Content-Type': 'application/json',
          ...authHeaders,
        };

        const response = await fetch(`${ BATCH_API_BASE_URL } /process/batch - download`, {
          method: 'POST',
          headers: fetchHeaders,
          body: JSON.stringify({
            job_ids: jobIds,
            format: format,
          }),
        });

        if (response.status === 401) {
          this.showToast('Vui lòng đăng nhập để tải trọn bộ kết quả dạng ZIP.', 'warning');
          if (typeof handleAuthError === 'function') handleAuthError();
          return;
        }

        if (response.status === 403) {
          this.showToast('Bạn không có quyền tải tệp này.', 'error');
          return;
        }

        if (!response.ok) {
          let errMsg = 'Tải tệp ZIP thất bại.';
          try {
            const errJson = await response.json();
            errMsg = errJson.message || errJson.detail || errMsg;
          } catch (_e) {}
          this.showToast(errMsg, 'error');
          return;
        }

        const downloadFilename = (format === 'docx')
          ? 'PDFLingua_Batch_Word_Results.zip'
          : 'PDFLingua_Batch_Results.zip';

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);

        const fmtLabel = format === 'docx' ? 'Word (.docx)' : 'PDF';
        this.showToast(`Đã tải về trọn bộ file ZIP(${ fmtLabel }) thành công!`, 'success');
      } catch (err) {
        const msg = err.message || 'Lỗi khi tải tệp ZIP.';
        this.showToast(msg, 'error');
      } finally {
        if (targetBtn) {
          targetBtn.disabled = false;
          targetBtn.innerHTML = prevHtml;
        }
      }
    }

    cancelBatch() {
      this.isCancelled = true;
      this.isProcessing = false;
      this.cleanupAllConnections();
      this.lockQueueUI(false);
    }
  }

  // Singleton instance exposed on window (PDFL-252.2)
  if (typeof window !== 'undefined') {
    window.pdfLinguaBatchOrchestrator = new BatchOrchestrator();
    window.BatchOrchestrator = BatchOrchestrator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
