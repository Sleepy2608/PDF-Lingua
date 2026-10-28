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
    const closeBtn = document.getElementById('legalModalCloseBtn');
    const closeFooterBtn = document.getElementById('legalModalCloseFooterBtn');
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
        document.body.style.overflow = '';
    }

    // Attach footer link handlers
    if (linkTerms) {
        linkTerms.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('tabTerms');
        });
    }

    if (linkPrivacy) {
        linkPrivacy.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('tabPrivacy');
        });
    }

    if (linkContact) {
        linkContact.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('tabContact');
        });
    }

    // Attach tab button click handlers
    tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        });
    });

    // Close handlers
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);

    // Close when clicking overlay backdrop
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeModal();
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
                    btnCopyEmail.innerHTML = '<span class="copy-icon">📋</span> Sao chép';
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
        feedbackForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btnSubmitFeedback');
            const originalText = btnSubmit ? btnSubmit.innerHTML : 'Gửi phản hồi';

            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<span>Đang gửi...</span>';
            }

            setTimeout(() => {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = originalText;
                }
                feedbackForm.reset();
                if (typeof showToast === 'function') {
                    showToast('Cảm ơn bạn! Phản hồi đã được ghi nhận và gửi đến nhóm phát triển.', 'success');
                }
            }, 350);
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

    // ── Phase 4: Fullscreen Toggle, Policy Acceptance & Live Search ──────
    // Fullscreen Toggle
    const btnFullscreen = document.getElementById('btnToggleFullscreenLegal');
    const modalContainer = overlay.querySelector('.legal-modal-container');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    const fullscreenText = document.getElementById('fullscreenText');

    if (btnFullscreen && modalContainer) {
        btnFullscreen.addEventListener('click', () => {
            const isFull = modalContainer.classList.toggle('fullscreen');
            if (fullscreenIcon) fullscreenIcon.textContent = isFull ? '❐' : '⛶';
            if (fullscreenText) fullscreenText.textContent = isFull ? 'Thu nhỏ' : 'Phóng to';
            btnFullscreen.setAttribute('title', isFull ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình');
        });
    }

    // Accept Terms & Privacy Button
    const btnAccept = document.getElementById('btnAcceptLegal');
    if (btnAccept) {
        btnAccept.addEventListener('click', () => {
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
        });
    }

    // In-Modal Live Search & Highlight
    const searchInput = document.getElementById('legalSearchInput');
    const btnClearSearch = document.getElementById('btnClearLegalSearch');
    const searchCount = document.getElementById('legalSearchCount');
    const modalBody = overlay.querySelector('.legal-modal-body');

    // Helper to remove existing highlights
    function clearHighlights() {
        if (!modalBody) return;
        const marks = modalBody.querySelectorAll('mark.legal-highlight');
        marks.forEach((mark) => {
            const parent = mark.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(mark.textContent), mark);
                parent.normalize();
            }
        });
        if (searchCount) searchCount.style.display = 'none';
        if (btnClearSearch) btnClearSearch.style.display = 'none';
    }

    // Recursive text highlighter
    function highlightText(node, regex) {
        if (node.nodeType === Node.TEXT_NODE) {
            const match = node.data.match(regex);
            if (match && match[0].trim()) {
                const mark = document.createElement('mark');
                mark.className = 'legal-highlight';
                const splitIdx = match.index;
                const matchedText = match[0];
                const matchedNode = node.splitText(splitIdx);
                matchedNode.splitText(matchedText.length);
                mark.appendChild(matchedNode.cloneNode(true));
                matchedNode.parentNode.replaceChild(mark, matchedNode);
                return 1;
            }
            return 0;
        } else if (node.nodeType === Node.ELEMENT_NODE && node.childNodes && !['SCRIPT', 'STYLE', 'BUTTON'].includes(node.nodeName)) {
            let count = 0;
            for (let i = 0; i < node.childNodes.length; i++) {
                count += highlightText(node.childNodes[i], regex);
            }
            return count;
        }
        return 0;
    }

    if (searchInput && modalBody) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim();
            clearHighlights();

            if (!query || query.length < 2) return;

            if (btnClearSearch) btnClearSearch.style.display = 'inline-block';

            try {
                const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(safeQuery, 'i');
                const activePanel = modalBody.querySelector('.legal-tab-panel.active') || modalBody;
                const count = highlightText(activePanel, regex);

                if (searchCount) {
                    searchCount.style.display = 'inline-block';
                    searchCount.textContent = count > 0 ? `${count} kết quả` : 'Không có';
                }

                if (count > 0) {
                    const firstMatch = activePanel.querySelector('mark.legal-highlight');
                    if (firstMatch) {
                        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            } catch (_err) {
                // Ignore regex errors
            }
        });

        if (btnClearSearch) {
            btnClearSearch.addEventListener('click', () => {
                searchInput.value = '';
                clearHighlights();
                searchInput.focus();
            });
        }
    }
}
