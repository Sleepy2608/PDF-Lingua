/**
 * PDF-Lingua: Welcome Landing Page Controller
 * ------------------------------------------------------------------------
 * Manages 1-click interactive sample demo, smooth navigation scrolling,
 * pricing plan interaction, and seamless transitions into the Workspace.
 */

(function () {
  'use strict';

  // Realistic Academic & Technical Sample Document for 1-Click Interactive Demo
  const SAMPLE_DOC_DATA = {
    document_id: 'sample-academic-rag-2026',
    filename: 'Bao_cao_Nghien_cuu_AI_Song_Ngu_Mau.pdf',
    document_filename: 'Bao_cao_Nghien_cuu_AI_Song_Ngu_Mau.pdf',
    page_count: 2,
    file_size_mb: 1.42,
    is_ocr_used: false,
    status: 'DONE',
    created_at: new Date().toISOString(),
    original_text: `--- Trang 1 ---
1. Introduction: Neural Machine Translation and Contextual RAG
Recent advancements in Large Language Models (LLMs) and Retrieval-Augmented Generation (RAG) have transformed document analysis. However, translating complex multi-column academic and legal documents while strictly preserving hierarchical layout remains a critical challenge. In this research, we introduce an end-to-end framework that unifies semantic chunking, layout-aware OCR extraction, and page-anchored citation.

Key Contributions:
- A bidirectional dual-pane synchronization pipeline for instantaneous bilingual cross-reference.
- High-precision Vietnamese diacritics restoration reaching 99.2% character accuracy.
- Zero-hallucination citation guardrails ensuring every generative assertion is mapped directly to source page numbers.

--- Trang 2 ---
2. Performance Benchmarks and Experimental Results
Our experimental evaluation across 500 heterogeneous document scans demonstrates that the proposed pipeline reduces extraction latency to under 2.8 seconds per page while eliminating document layout drift.

Table 1. Comparative Evaluation on Vietnamese Academic Datasets:
- Processing Speed: 2.74 seconds/page (4.2x faster than traditional OCR workflows)
- Layout Preservation Score: 94.5% structural retention across complex multi-column tables
- AI Answer Faithfulness: 98.8% grounded in verified source passages without hallucination

3. Conclusion and Future Directions
The integration of layout preservation with page-grounded retrieval empowers researchers to audit AI-generated summaries and translations with absolute fidelity.`,
    translated_text: `--- Trang 1 ---
1. Giới thiệu: Dịch máy thần kinh và RAG tăng cường ngữ cảnh
Những bước tiến vượt bậc của Mô hình ngôn ngữ lớn (LLM) và Kỹ thuật tạo tăng cường truy xuất (RAG) đã làm biến đổi toàn diện lĩnh vực phân tích tài liệu. Tuy nhiên, việc dịch thuật các tài liệu học thuật và hợp đồng pháp lý dạng nhiều cột phức tạp trong khi vẫn bảo tồn nghiêm ngặt bố cục phân tầng vẫn là một thách thức lớn. Trong nghiên cứu này, chúng tôi giới thiệu kiến trúc toàn diện kết hợp phân khúc ngữ nghĩa, bóc tách OCR bảo tồn định dạng và trích dẫn neo theo số trang.

Đóng góp chính:
- Quy trình đồng bộ song song hai cột cho phép đối chiếu song ngữ tức thì.
- Khôi phục dấu tiếng Việt chính xác cao đạt độ chuẩn xác ký tự 99.2%.
- Hàng rào kiểm soát chống bịa đặt (Zero-hallucination) đảm bảo mọi câu trả lời đều được ánh xạ trực tiếp đến số trang gốc.

--- Trang 2 ---
2. Đánh giá hiệu năng và Kết quả thực nghiệm
Thử nghiệm thực tế trên 500 tài liệu quét đa dạng chứng minh quy trình giúp giảm độ trễ bóc tách xuống dưới 2.8 giây mỗi trang và loại bỏ hoàn toàn hiện tượng lệch bố cục văn bản.

Bảng 1. Đánh giá so sánh trên tập dữ liệu học thuật tiếng Việt:
- Tốc độ xử lý: 2.74 giây/trang (nhanh gấp 4.2 lần quy trình OCR truyền thống)
- Điểm số giữ nguyên bố cục: 94.5% bảo toàn cấu trúc phân cột và bảng biểu
- Độ trung thực của câu trả lời AI: 98.8% dựa hoàn toàn vào đoạn văn gốc đã xác minh

3. Kết luận và Hướng phát triển
Sự kết hợp giữa bảo toàn bố cục và truy xuất neo trang trao quyền cho các nhà nghiên cứu kiểm chứng các bản tóm tắt và dịch thuật do AI tạo ra với độ tin cậy tuyệt đối.`,
    pages_data: [
      {
        page: 1,
        original: `1. Introduction: Neural Machine Translation and Contextual RAG\nRecent advancements in Large Language Models (LLMs) and Retrieval-Augmented Generation (RAG) have transformed document analysis. However, translating complex multi-column academic and legal documents while strictly preserving hierarchical layout remains a critical challenge. In this research, we introduce an end-to-end framework that unifies semantic chunking, layout-aware OCR extraction, and page-anchored citation.\n\nKey Contributions:\n- A bidirectional dual-pane synchronization pipeline for instantaneous bilingual cross-reference.\n- High-precision Vietnamese diacritics restoration reaching 99.2% character accuracy.\n- Zero-hallucination citation guardrails ensuring every generative assertion is mapped directly to source page numbers.`,
        translated: `1. Giới thiệu: Dịch máy thần kinh và RAG tăng cường ngữ cảnh\nNhững bước tiến vượt bậc của Mô hình ngôn ngữ lớn (LLM) và Kỹ thuật tạo tăng cường truy xuất (RAG) đã làm biến đổi toàn diện lĩnh vực phân tích tài liệu. Tuy nhiên, việc dịch thuật các tài liệu học thuật và hợp đồng pháp lý dạng nhiều cột phức tạp trong khi vẫn bảo tồn nghiêm ngặt bố cục phân tầng vẫn là một thách thức lớn. Trong nghiên cứu này, chúng tôi giới thiệu kiến trúc toàn diện kết hợp phân khúc ngữ nghĩa, bóc tách OCR bảo tồn định dạng và trích dẫn neo theo số trang.\n\nĐóng góp chính:\n- Quy trình đồng bộ song song hai cột cho phép đối chiếu song ngữ tức thì.\n- Khôi phục dấu tiếng Việt chính xác cao đạt độ chuẩn xác ký tự 99.2%.\n- Hàng rào kiểm soát chống bịa đặt (Zero-hallucination) đảm bảo mọi câu trả lời đều được ánh xạ trực tiếp đến số trang gốc.`
      },
      {
        page: 2,
        original: `2. Performance Benchmarks and Experimental Results\nOur experimental evaluation across 500 heterogeneous document scans demonstrates that the proposed pipeline reduces extraction latency to under 2.8 seconds per page while eliminating document layout drift.\n\nTable 1. Comparative Evaluation on Vietnamese Academic Datasets:\n- Processing Speed: 2.74 seconds/page (4.2x faster than traditional OCR workflows)\n- Layout Preservation Score: 94.5% structural retention across complex multi-column tables\n- AI Answer Faithfulness: 98.8% grounded in verified source passages without hallucination\n\n3. Conclusion and Future Directions\nThe integration of layout preservation with page-grounded retrieval empowers researchers to audit AI-generated summaries and translations with absolute fidelity.`,
        translated: `2. Đánh giá hiệu năng và Kết quả thực nghiệm\nThử nghiệm thực tế trên 500 tài liệu quét đa dạng chứng minh quy trình giúp giảm độ trễ bóc tách xuống dưới 2.8 giây mỗi trang và loại bỏ hoàn toàn hiện tượng lệch bố cục văn bản.\n\nBảng 1. Đánh giá so sánh trên tập dữ liệu học thuật tiếng Việt:\n- Tốc độ xử lý: 2.74 giây/trang (nhanh gấp 4.2 lần quy trình OCR truyền thống)\n- Điểm số giữ nguyên bố cục: 94.5% bảo toàn cấu trúc phân cột và bảng biểu\n- Độ trung thực của câu trả lời AI: 98.8% dựa hoàn toàn vào đoạn văn gốc đã xác minh\n\n3. Kết luận và Hướng phát triển\nSự kết hợp giữa bảo toàn bố cục và truy xuất neo trang trao quyền cho các nhà nghiên cứu kiểm chứng các bản tóm tắt và dịch thuật do AI tạo ra với độ tin cậy tuyệt đối.`
      }
    ]
  };

  document.addEventListener('DOMContentLoaded', () => {
    initWelcomeLanding();
  });

  function initWelcomeLanding() {
    // 1. Button "Dùng thử tài liệu mẫu" (1-Click Demo)
    const btnTryDemo = document.getElementById('btnTryDemoDoc');
    if (btnTryDemo) {
      btnTryDemo.addEventListener('click', (e) => {
        e.preventDefault();
        loadSampleDocument();
      });
    }

    // 2. Button "Bắt đầu ngay" (Hero CTA & Nav CTA)
    const btnHeroStart = document.getElementById('btnHeroStart');
    const btnNavGetStarted = document.getElementById('btnNavGetStarted');

    if (btnHeroStart) {
      btnHeroStart.addEventListener('click', (e) => {
        e.preventDefault();
        focusOrScrollDropzone();
      });
    }

    if (btnNavGetStarted) {
      btnNavGetStarted.addEventListener('click', (e) => {
        e.preventDefault();
        focusOrScrollDropzone();
      });
    }

    // 3. Button "Đăng nhập" on Landing Navbar
    const btnNavLogin = document.getElementById('btnNavLogin');
    if (btnNavLogin) {
      btnNavLogin.addEventListener('click', (e) => {
        e.preventDefault();
        const mainLoginBtn = document.getElementById('btnLogin');
        if (mainLoginBtn && typeof mainLoginBtn.click === 'function') {
          mainLoginBtn.click();
        }
      });
    }

    // 4. Smooth Scrolling for Landing Navigation Links
    const navLinks = document.querySelectorAll('.wl-nav-link[href^="#"]');
    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href').replace('#', '');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // Update active state
          navLinks.forEach((l) => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    });

    // 5. Billing Cycle Toggle & Pricing Plans Integration
    let landingBillingCycle = 'monthly';
    const btnCycleMonthly = document.getElementById('btnLandingCycleMonthly');
    const btnCycleYearly = document.getElementById('btnLandingCycleYearly');
    const priceProEl = document.getElementById('priceLandingPro');
    const periodProEl = document.getElementById('periodLandingPro');
    const noteProEl = document.getElementById('noteLandingPro');

    function setLandingBillingCycle(cycle) {
      landingBillingCycle = cycle === 'yearly' ? 'yearly' : 'monthly';
      if (btnCycleMonthly && btnCycleYearly) {
        if (landingBillingCycle === 'yearly') {
          btnCycleMonthly.classList.remove('active');
          btnCycleYearly.classList.add('active');
          if (priceProEl) priceProEl.textContent = '399.000 đ';
          if (periodProEl) periodProEl.textContent = '/ năm';
          if (noteProEl) noteProEl.textContent = 'Tương đương ~33.250 đ/tháng (Tiết kiệm 32%)';
        } else {
          btnCycleYearly.classList.remove('active');
          btnCycleMonthly.classList.add('active');
          if (priceProEl) priceProEl.textContent = '49.000 đ';
          if (periodProEl) periodProEl.textContent = '/ tháng';
          if (noteProEl) noteProEl.textContent = 'Thanh toán linh hoạt theo từng tháng';
        }
      }
    }

    if (btnCycleMonthly) {
      btnCycleMonthly.addEventListener('click', (e) => {
        e.preventDefault();
        setLandingBillingCycle('monthly');
      });
    }

    if (btnCycleYearly) {
      btnCycleYearly.addEventListener('click', (e) => {
        e.preventDefault();
        setLandingBillingCycle('yearly');
      });
    }

    // Plan action buttons
    const btnPlanFree = document.getElementById('btnPlanFree');
    const btnPlanPro = document.getElementById('btnPlanPro');

    if (btnPlanFree) {
      btnPlanFree.addEventListener('click', (e) => {
        e.preventDefault();
        focusOrScrollDropzone();
      });
    }

    if (btnPlanPro) {
      btnPlanPro.addEventListener('click', (e) => {
        e.preventDefault();
        const planCode = landingBillingCycle === 'yearly' ? 'pro_yearly' : 'pro_monthly';
        if (window.pdfLinguaPricing && typeof window.pdfLinguaPricing.openCheckoutModal === 'function') {
          window.pdfLinguaPricing.openCheckoutModal(planCode);
        } else {
          const sideNavPricing = document.getElementById('sideNavPricing');
          if (sideNavPricing && typeof sideNavPricing.click === 'function') {
            sideNavPricing.click();
          } else {
            const mainRegisterBtn = document.getElementById('btnOpenRegister');
            if (mainRegisterBtn) mainRegisterBtn.click();
          }
        }
      });
    }

    // 6. Interactive Bento Spotlight & Micro-triggers
    initBentoSpotlight();

    const btnBentoTrySync = document.getElementById('btnBentoTrySync');
    if (btnBentoTrySync) {
      btnBentoTrySync.addEventListener('click', (e) => {
        e.preventDefault();
        loadSampleDocument();
      });
    }

    const btnBentoCitation = document.getElementById('btnBentoCitationPreview');
    if (btnBentoCitation) {
      btnBentoCitation.addEventListener('click', (e) => {
        e.preventDefault();
        loadSampleDocument();
        setTimeout(() => {
          if (window.pdfLinguaCopilot && typeof window.pdfLinguaCopilot.sendQuery === 'function') {
            window.pdfLinguaCopilot.sendQuery('Tốc độ xử lý thực tế trên tài liệu học thuật là bao nhiêu?');
          }
        }, 800);
      });
    }

    // 7. How-It-Works Sequential Step Triggers
    const btnStepUpload = document.getElementById('btnStepUploadTrigger');
    if (btnStepUpload) {
      btnStepUpload.addEventListener('click', (e) => {
        e.preventDefault();
        focusOrScrollDropzone();
      });
    }

    const btnStepDemo = document.getElementById('btnStepDemoTrigger');
    if (btnStepDemo) {
      btnStepDemo.addEventListener('click', (e) => {
        e.preventDefault();
        loadSampleDocument();
      });
    }

    const btnStepWorkspace = document.getElementById('btnStepWorkspaceTrigger');
    if (btnStepWorkspace) {
      btnStepWorkspace.addEventListener('click', (e) => {
        e.preventDefault();
        const workspaceSection = document.getElementById('workspaceSection');
        if (workspaceSection) {
          workspaceSection.scrollIntoView({ behavior: 'smooth' });
        } else {
          focusOrScrollDropzone();
        }
      });
    }
  }

  /**
   * Initializes mouse spotlight gradient coordinates on bento cards
   */
  function initBentoSpotlight() {
    const bentoCards = document.querySelectorAll('.wl-bento-card');
    bentoCards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
      card.addEventListener('mouseleave', () => {
        card.style.removeProperty('--mouse-x');
        card.style.removeProperty('--mouse-y');
      });
    });
  }

  /**
   * Loads the built-in bilingual sample document into the workspace
   */
  function loadSampleDocument() {
    if (window.pdfLinguaWorkspace && typeof window.pdfLinguaWorkspace.renderWorkspace === 'function') {
      window.pdfLinguaWorkspace.renderWorkspace(SAMPLE_DOC_DATA);

      // Scroll to workspace smoothly
      const workspaceSection = document.getElementById('workspaceSection');
      if (workspaceSection) {
        workspaceSection.scrollIntoView({ behavior: 'smooth' });
      }

      // Display informative notification
      if (typeof showToast === 'function') {
        showToast('Đã nạp tài liệu nghiên cứu mẫu thành công! Bạn có thể xem bản dịch song ngữ và hỏi đáp với AI Copilot ngay bây giờ.', 'success');
      }

      // Populate prompt chips with the 3 sample questions
      const quickPromptsContainer = document.getElementById('copilotQuickPrompts');
      if (quickPromptsContainer) {
        quickPromptsContainer.innerHTML = `
          <button type="button" class="copilot-prompt-chip" data-prompt="Tài liệu này nói về chủ đề gì?">Tài liệu này nói về chủ đề gì?</button>
          <button type="button" class="copilot-prompt-chip" data-prompt="Các giải pháp kỹ thuật chính được đề cập là gì?">Các giải pháp kỹ thuật chính?</button>
          <button type="button" class="copilot-prompt-chip" data-prompt="Tác giả kết luận như thế nào ở trang cuối?">Kết luận ở trang cuối?</button>
        `;
        quickPromptsContainer.querySelectorAll('.copilot-prompt-chip').forEach((chip) => {
          chip.addEventListener('click', function () {
            const promptText = chip.getAttribute('data-prompt') || chip.textContent.trim();
            if (window.pdfLinguaCopilot && typeof window.pdfLinguaCopilot.sendQuery === 'function') {
              window.pdfLinguaCopilot.sendQuery(promptText);
            }
          });
        });
      }

      // Pre-fill Copilot greeting if available
      const copilotDrawer = document.getElementById('aiCopilotDrawer');
      const btnToggleCopilot = document.getElementById('btnToggleCopilot');
      if (btnToggleCopilot && copilotDrawer && !copilotDrawer.classList.contains('open')) {
        setTimeout(() => {
          btnToggleCopilot.click();
        }, 600);
      }
    } else {
      console.warn('[PDF-Lingua] Workspace controller is not ready yet.');
    }
  }

  /**
   * Scrolls smoothly to Dropzone or triggers the file browser
   */
  function focusOrScrollDropzone() {
    const dropzoneCard = document.getElementById('dropzoneCard');
    const pdfFileInput = document.getElementById('pdfFileInput');

    if (dropzoneCard) {
      dropzoneCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      dropzoneCard.classList.add('drag-over');
      setTimeout(() => {
        dropzoneCard.classList.remove('drag-over');
      }, 800);
    }

    // If already in view, open file dialog directly
    if (pdfFileInput && typeof pdfFileInput.click === 'function') {
      const rect = dropzoneCard ? dropzoneCard.getBoundingClientRect() : null;
      if (rect && rect.top >= 0 && rect.bottom <= window.innerHeight) {
        pdfFileInput.click();
      }
    }
  }

  // Export public API
  window.PDFLinguaLanding = {
    loadSampleDocument,
    focusOrScrollDropzone,
    initBentoSpotlight,
    initWelcomeLanding
  };
})();

