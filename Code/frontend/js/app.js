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
}
