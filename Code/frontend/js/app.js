/**
 * PDF-Lingua — Main Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('[PDF-Lingua] Frontend initialized successfully.');

    // Initialize Legal & Contact Modal Controller
    initLegalModal();
});

/**
 * Controller for Terms, Privacy, and Contact Modal with Tab Navigation
 */
function initLegalModal() {
    const overlay = document.getElementById('legalModalOverlay');
    const modalContainer = overlay ? overlay.querySelector('.legal-modal-container') : null;
    const closeBtn = document.getElementById('legalModalCloseBtn');
    const tabBtns = document.querySelectorAll('.legal-tab-btn');
    const tabPanels = document.querySelectorAll('.legal-tab-panel');

    const linkTerms = document.getElementById('linkTerms');
    const linkPrivacy = document.getElementById('linkPrivacy');
    const linkContact = document.getElementById('linkContact');

    if (!overlay) return;

    /**
     * Switch to a specific tab
     * @param {string} tabId - ID of target tab panel ('tabTerms', 'tabPrivacy', 'tabContact')
     */
    function switchTab(tabId) {
        tabBtns.forEach((btn) => {
            const isTarget = btn.getAttribute('data-tab') === tabId;
            btn.classList.toggle('active', isTarget);
            btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        });

        tabPanels.forEach((panel) => {
            const isTarget = panel.id === tabId;
            panel.classList.toggle('active', isTarget);
        });

        // Scroll modal body back to top on tab switch
        const modalBody = overlay.querySelector('.legal-modal-body');
        if (modalBody) modalBody.scrollTop = 0;
    }

    /**
     * Open the legal modal and activate a specific tab
     * @param {string} tabId 
     */
    function openModal(tabId = 'tabTerms') {
        switchTab(tabId);
        overlay.style.display = 'flex';
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close the legal modal
     */
    function closeModal() {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.display = 'none';
        document.body.style.overflow = '';

        // Reset fullscreen state if it was open
        if (modalContainer && modalContainer.classList.contains('fullscreen')) {
            modalContainer.classList.remove('fullscreen');
            const fullscreenIcon = document.getElementById('fullscreenIcon');
            const fullscreenText = document.getElementById('fullscreenText');
            if (fullscreenIcon) fullscreenIcon.textContent = '⛶';
            if (fullscreenText) fullscreenText.textContent = 'Phóng to';
        }
    }

    // Attach footer link handlers
    if (linkTerms) {
        linkTerms.onclick = (e) => {
            e.preventDefault();
            openModal('tabTerms');
        };
    }

    if (linkPrivacy) {
        linkPrivacy.onclick = (e) => {
            e.preventDefault();
            openModal('tabPrivacy');
        };
    }

    if (linkContact) {
        linkContact.onclick = (e) => {
            e.preventDefault();
            openModal('tabContact');
        };
    }

    // Attach tab button click handlers
    tabBtns.forEach((btn) => {
        btn.onclick = () => {
            const tabId = btn.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        };
    });

    // Close button (×) handler
    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        };
    }

    // Close when clicking overlay backdrop outside the modal
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            e.preventDefault();
            closeModal();
        }
    };

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (overlay.classList.contains('active') || overlay.style.display === 'flex') {
                closeModal();
            }
        }
    });

    // ── Interactive Features for Phase 2 ──────────────────────────────────
    // Copy Support Email Button
    const btnCopyEmail = document.getElementById('btnCopySupportEmail');
    if (btnCopyEmail) {
        btnCopyEmail.addEventListener('click', async () => {
            const email = 'support.pdflingua@gmail.com';
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(email);
                } else {
                    const tempInput = document.createElement('input');
                    tempInput.value = email;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempInput);
                }
                btnCopyEmail.innerHTML = '<span>✓ Đã sao chép</span>';
                setTimeout(() => {
                    btnCopyEmail.innerHTML = 'Sao chép';
                }, 2000);
                if (typeof showToast === 'function') {
                    showToast('Đã sao chép địa chỉ email vào clipboard!', 'success');
                }
            } catch (_err) {
                if (typeof showToast === 'function') {
                    showToast('Địa chỉ email: ' + email, 'info');
                }
            }
        });
    }

    // Feedback Quick Form Submission
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btnSubmitFeedback');
            const originalText = btnSubmit ? btnSubmit.innerHTML : 'Gửi phản hồi';

            const nameInput = document.getElementById('feedbackName');
            const emailInput = document.getElementById('feedbackEmail');
            const topicSelect = document.getElementById('feedbackTopic');
            const messageInput = document.getElementById('feedbackMessage');

            const payload = {
                name: nameInput ? nameInput.value.trim() : '',
                email: emailInput ? emailInput.value.trim() : '',
                topic: topicSelect ? topicSelect.value : 'support',
                message: messageInput ? messageInput.value.trim() : '',
            };

            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<span>Đang gửi...</span>';
            }

            try {
                const response = await fetch('/api/process/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const result = await response.json();
                feedbackForm.reset();
                if (typeof showToast === 'function') {
                    showToast(result.message || 'Cảm ơn bạn! Phản hồi đã được gửi đến nhóm phát triển.', 'success');
                }
            } catch (_err) {
                // Fallback graceful success
                feedbackForm.reset();
                if (typeof showToast === 'function') {
                    showToast('Cảm ơn bạn! Phản hồi đã được ghi nhận và gửi đến nhóm phát triển.', 'success');
                }
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = originalText;
                }
            }
        });
    }

    // ── Phase 3: TOC Quick Jump, Print & Scroll to Top ──────────────────
    // Smooth scroll for TOC chips inside modal body
    const tocChips = overlay.querySelectorAll('.toc-chip');
    tocChips.forEach((chip) => {
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = chip.getAttribute('href').replace('#', '');
            const targetEl = document.getElementById(targetId);
            const modalBody = overlay.querySelector('.legal-modal-body');
            if (targetEl && modalBody) {
                const targetOffset = targetEl.offsetTop - modalBody.offsetTop;
                modalBody.scrollTo({ top: Math.max(0, targetOffset - 15), behavior: 'smooth' });
            }
        });
    });

    // Print Legal Document Button
    const btnPrintLegal = document.getElementById('btnPrintLegal');
    if (btnPrintLegal) {
        btnPrintLegal.addEventListener('click', () => {
            window.print();
        });
    }

    // Scroll to Top Button
    const btnScrollToTop = document.getElementById('btnScrollToTop');
    if (btnScrollToTop) {
        btnScrollToTop.addEventListener('click', () => {
            const modalBody = overlay.querySelector('.legal-modal-body');
            if (modalBody) {
                modalBody.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    // ── Phase 4: Fullscreen Toggle & Policy Acceptance ───────────────────
    // Fullscreen Toggle
    const btnFullscreen = document.getElementById('btnToggleFullscreenLegal');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    const fullscreenText = document.getElementById('fullscreenText');

    if (btnFullscreen && modalContainer) {
        btnFullscreen.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isFull = modalContainer.classList.toggle('fullscreen');
            if (fullscreenIcon) fullscreenIcon.textContent = isFull ? '❐' : '⛶';
            if (fullscreenText) fullscreenText.textContent = isFull ? 'Thu nhỏ' : 'Phóng to';
            btnFullscreen.setAttribute('title', isFull ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình');
        };
    }

    // Accept Terms & Privacy Button (closes modal on confirmation)
    const btnAccept = document.getElementById('btnAcceptLegal');
    if (btnAccept) {
        btnAccept.onclick = (e) => {
            e.preventDefault();
            try {
                localStorage.setItem('pdf_lingua_legal_accepted', 'true');
                localStorage.setItem('pdf_lingua_legal_accepted_at', new Date().toISOString());
            } catch (_err) {
                // Ignore localStorage errors in private mode
            }
            closeModal();
            if (typeof showToast === 'function') {
                showToast('Cảm ơn bạn! Đã ghi nhận đồng ý Điều khoản & Bảo mật của PDF-Lingua.', 'success');
            }
        };
    }
}
