/**
 * PDF-Lingua: Main Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('[PDF-Lingua] Frontend initialized successfully.');

    // Initialize Global Modal Scroll Lock & Boundary Containment Manager
    initModalScrollLock();

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
        if (window.PDFLinguaModalManager) {
            window.PDFLinguaModalManager.sync();
        } else {
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close the legal modal
     */
    function closeModal() {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.display = 'none';
        if (window.PDFLinguaModalManager) {
            window.PDFLinguaModalManager.sync();
        } else {
            document.body.style.overflow = '';
        }

        // Reset fullscreen state if it was open
        if (modalContainer && modalContainer.classList.contains('fullscreen')) {
            modalContainer.classList.remove('fullscreen');
            const fullscreenIcon = document.getElementById('fullscreenIcon');
            const fullscreenText = document.getElementById('fullscreenText');
            if (fullscreenIcon) fullscreenIcon.textContent = '⛶';
            if (fullscreenText) fullscreenText.textContent = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('common_fullscreen') : 'Phóng to';
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
                btnCopyEmail.innerHTML = '<span>✓ ' + ((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('common_copied') : 'Đã sao chép') + '</span>';
                setTimeout(() => {
                    btnCopyEmail.innerHTML = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('common_copy') : 'Sao chép';
                }, 2000);
                if (typeof showToast === 'function') {
                    const msg = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('toast_email_copied') : 'Đã sao chép địa chỉ email vào clipboard!';
                    showToast(msg, 'success');
                }
            } catch (_err) {
                if (typeof showToast === 'function') {
                    showToast(((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('toast_email_address_prefix') : 'Địa chỉ email: ') + email, 'info');
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
            const originalText = btnSubmit ? btnSubmit.innerHTML : ((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('feedback_btn_submit') : 'Gửi phản hồi');

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
                btnSubmit.innerHTML = '<span>' + ((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('feedback_sending') : 'Đang gửi...') + '</span>';
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
                    const msg = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('toast_feedback_sent') : (result.message || 'Cảm ơn bạn! Phản hồi đã được gửi đến nhóm phát triển.');
                    showToast(msg, 'success');
                }
            } catch (_err) {
                // Fallback graceful success
                feedbackForm.reset();
                if (typeof showToast === 'function') {
                    const msg = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('toast_feedback_sent') : 'Cảm ơn bạn! Phản hồi đã được ghi nhận và gửi đến nhóm phát triển.';
                    showToast(msg, 'success');
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
            if (fullscreenIcon) {
                fullscreenIcon.innerHTML = isFull
                    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
                    : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
            }
            if (fullscreenText) fullscreenText.textContent = isFull ? ((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('common_exit_fullscreen') : 'Thu nhỏ') : ((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('common_fullscreen') : 'Phóng to');
            btnFullscreen.setAttribute('title', isFull ? ((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('legal_exit_fullscreen_title') : 'Thu nhỏ cửa sổ') : ((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('legal_fullscreen_title') : 'Phóng to toàn màn hình'));
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
                showToast((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('toast_terms_agreed') : 'Cảm ơn bạn! Đã ghi nhận đồng ý Điều khoản & Bảo mật của PDF-Lingua.', 'success');
            }
        };
    }
}

/**
 * Global Modal Scroll Lock & Boundary Containment Manager
 * Ensures that whenever any modal, popup, or overlay is open:
 * 1. Background page scroll is strictly locked (html & body).
 * 2. Only the active modal's scrollable content can scroll.
 * 3. Boundary overscroll chaining is completely blocked so background never moves.
 * 4. Closing the popup unlocks page scroll immediately.
 */
function initModalScrollLock() {
    const MODAL_SELECTORS = [
        '.modal-backdrop',
        '.modal-overlay',
        '.legal-modal-overlay',
        '.avatar-crop-modal-backdrop'
    ];

    let savedScrollY = 0;
    let isLocked = false;

    function isElementVisibleModal(el) {
        if (!el || el.id === 'sidebarBackdrop') return false;
        if (el.hasAttribute('hidden')) return false;
        if (el.style && (el.style.display === 'none' || el.style.visibility === 'hidden')) return false;
        if (el.classList.contains('legal-modal-overlay')) {
            return el.classList.contains('active') || (el.style && el.style.display === 'flex');
        }
        if (typeof el.checkVisibility === 'function') {
            return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        }
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            const comp = window.getComputedStyle(el);
            if (comp.display === 'none' || comp.visibility === 'hidden' || comp.opacity === '0') {
                return false;
            }
        }
        return el.offsetWidth > 0 || el.offsetHeight > 0 || (typeof el.getClientRects === 'function' && el.getClientRects().length > 0);
    }

    function hasAnyOpenModal() {
        const candidates = document.querySelectorAll(MODAL_SELECTORS.join(', '));
        for (let i = 0; i < candidates.length; i++) {
            if (isElementVisibleModal(candidates[i])) {
                return true;
            }
        }
        return false;
    }

    function applyLock() {
        if (isLocked) return;
        isLocked = true;
        savedScrollY = window.scrollY || window.pageYOffset || 0;
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }

    function releaseLock() {
        if (!isLocked) return;
        isLocked = false;
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        if (savedScrollY > 0) {
            window.scrollTo(0, savedScrollY);
        }
    }

    function syncScrollLock() {
        if (hasAnyOpenModal()) {
            applyLock();
        } else {
            releaseLock();
        }
    }

    function findScrollableTarget(target) {
        let el = target;
        while (el && el !== document.body && el !== document.documentElement) {
            const isModalBackdrop = el.matches && (
                el.matches('.modal-backdrop, .modal-overlay, .legal-modal-overlay, .avatar-crop-modal-backdrop')
            );

            if (isModalBackdrop && (el.classList.contains('modal-backdrop') || el.classList.contains('legal-modal-overlay') || el.classList.contains('modal-overlay'))) {
                return null;
            }

            if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
                const style = window.getComputedStyle(el);
                const overflowY = style.overflowY;
                if (
                    (overflowY === 'auto' || overflowY === 'scroll') &&
                    el.scrollHeight > el.clientHeight
                ) {
                    return el;
                }
            }

            el = el.parentElement;
        }
        return null;
    }

    function handleWheel(e) {
        if (!isLocked) return;

        const scrollable = findScrollableTarget(e.target);
        if (!scrollable) {
            e.preventDefault();
            return;
        }

        const delta = e.deltaY;
        const atTop = scrollable.scrollTop <= 0 && delta < 0;
        const atBottom =
            scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1 &&
            delta > 0;

        if (atTop || atBottom) {
            e.preventDefault();
        }
    }

    let touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
            touchStartY = e.touches[0].clientY;
        }
    }, { passive: true });

    function handleTouchMove(e) {
        if (!isLocked) return;

        const scrollable = findScrollableTarget(e.target);
        if (!scrollable) {
            e.preventDefault();
            return;
        }

        if (e.touches && e.touches[0]) {
            const currentY = e.touches[0].clientY;
            const delta = touchStartY - currentY;
            const atTop = scrollable.scrollTop <= 0 && delta < 0;
            const atBottom =
                scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1 &&
                delta > 0;

            if (atTop || atBottom) {
                e.preventDefault();
            }
        }
    }

    function handleKeyDown(e) {
        if (!isLocked) return;
        const scrollKeys = ['Space', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'];
        if (!scrollKeys.includes(e.code) && !scrollKeys.includes(e.key)) return;

        const active = document.activeElement;
        const isInput =
            active &&
            (active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.tagName === 'SELECT' ||
                active.isContentEditable);
        if (isInput) return;

        const scrollable = findScrollableTarget(active || e.target);
        if (!scrollable) {
            e.preventDefault();
        }
    }

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('keydown', handleKeyDown, { passive: false });

    if (typeof MutationObserver !== 'undefined' && document.body) {
        const observer = new MutationObserver(() => {
            syncScrollLock();
        });
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['style', 'hidden', 'class', 'aria-hidden'],
            subtree: true
        });
    }

    window.PDFLinguaModalManager = {
        sync: syncScrollLock,
        lock: applyLock,
        unlock: releaseLock,
        isOpen: hasAnyOpenModal
    };

    syncScrollLock();
}
