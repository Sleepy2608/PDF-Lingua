/**
 * PDF-Lingua - Standalone Welcome Landing Page Script
 * -------------------------------------------------------------
 * Lightweight Vanilla JS modular controller.
 * Handles sticky navbar scroll state, mobile menu toggle,
 * and active section navigation tracking.
 */

(function () {
  'use strict';

  function initWelcomeController() {
    // 1. Sticky Glass Header Scroll Indicator
    var navbar = document.getElementById('welcomeNavbar');
    if (navbar) {
      var handleScroll = function () {
        if (window.scrollY > 20) {
          navbar.classList.add('is-scrolled');
        } else {
          navbar.classList.remove('is-scrolled');
        }
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();
    }

    // 2. Mobile Menu Toggle & Keyboard Accessibility
    var mobileToggle = document.getElementById('btnWelcomeMobileMenu');
    var mobileDrawer = document.getElementById('welcomeMobileDrawer');
    if (mobileToggle && mobileDrawer) {
      var toggleMobileMenu = function (forceState) {
        var isCurrentlyOpen = mobileToggle.getAttribute('aria-expanded') === 'true';
        var nextState = typeof forceState === 'boolean' ? forceState : !isCurrentlyOpen;
        mobileToggle.setAttribute('aria-expanded', String(nextState));
        mobileDrawer.setAttribute('aria-hidden', String(!nextState));
        if (nextState) {
          mobileDrawer.classList.add('is-open');
        } else {
          mobileDrawer.classList.remove('is-open');
        }
      };

      mobileToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleMobileMenu();
      });

      // Close drawer when clicking any link inside it
      var mobileLinks = mobileDrawer.querySelectorAll('a');
      mobileLinks.forEach(function (link) {
        link.addEventListener('click', function () {
          toggleMobileMenu(false);
        });
      });

      // Close on Escape key press
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mobileDrawer.classList.contains('is-open')) {
          toggleMobileMenu(false);
          mobileToggle.focus();
        }
      });

      // Close on click outside
      document.addEventListener('click', function (e) {
        if (
          mobileDrawer.classList.contains('is-open') &&
          !mobileDrawer.contains(e.target) &&
          !mobileToggle.contains(e.target)
        ) {
          toggleMobileMenu(false);
        }
      });
    }

    // 3. Section Visibility & Active Link Tracking
    var desktopNavLinks = document.querySelectorAll('.welcome-nav-link');
    var trackedSections = document.querySelectorAll('section[id], footer[id]');

    if ('IntersectionObserver' in window && trackedSections.length > 0 && desktopNavLinks.length > 0) {
      var observerOptions = {
        root: null,
        rootMargin: '-20% 0px -65% 0px',
        threshold: 0
      };

      var sectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var currentId = entry.target.getAttribute('id');
            desktopNavLinks.forEach(function (link) {
              var href = link.getAttribute('href');
              if (href === '#' + currentId) {
                link.classList.add('is-active');
              } else {
                link.classList.remove('is-active');
              }
            });
          }
        });
      }, observerOptions);

      trackedSections.forEach(function (sec) {
        sectionObserver.observe(sec);
      });
    }

    // 4. Interactive Dual-Pane Preview Paragraph Synchronization
    var syncParagraphs = document.querySelectorAll('.welcome-doc-para[data-sync-id]');
    if (syncParagraphs.length > 0) {
      syncParagraphs.forEach(function (para) {
        para.addEventListener('mouseenter', function () {
          var syncId = para.getAttribute('data-sync-id');
          if (syncId) {
            document.querySelectorAll('.welcome-doc-para[data-sync-id="' + syncId + '"]').forEach(function (el) {
              el.classList.add('is-sync-active');
            });
          }
        });

        para.addEventListener('mouseleave', function () {
          var syncId = para.getAttribute('data-sync-id');
          if (syncId) {
            document.querySelectorAll('.welcome-doc-para[data-sync-id="' + syncId + '"]').forEach(function (el) {
              el.classList.remove('is-sync-active');
            });
          }
        });
      });
    }

    // 5. Interactive Bento Micro-Visual Row Switcher
    var bentoRows = document.querySelectorAll('.mini-sync-row');
    if (bentoRows.length > 0) {
      bentoRows.forEach(function (row) {
        row.addEventListener('mouseenter', function () {
          bentoRows.forEach(function (r) {
            r.classList.remove('active');
          });
          row.classList.add('active');
        });
      });
    }

    // 6. Pricing Plans Billing Toggle (Monthly / Yearly)
    var btnMonthly = document.getElementById('btnBillingMonthly');
    var btnYearly = document.getElementById('btnBillingYearly');
    var priceValuePro = document.getElementById('priceValuePro');
    var pricePeriodPro = document.getElementById('pricePeriodPro');
    var pricePeriodFree = document.getElementById('pricePeriodFree');

    if (btnMonthly && btnYearly) {
      var setBillingCycle = function (cycle) {
        if (cycle === 'yearly') {
          btnYearly.classList.add('active');
          btnMonthly.classList.remove('active');
          if (priceValuePro) priceValuePro.textContent = '399.000 đ';
          if (pricePeriodPro) pricePeriodPro.textContent = '/ năm';
          if (pricePeriodFree) pricePeriodFree.textContent = '/ năm';
        } else {
          btnMonthly.classList.add('active');
          btnYearly.classList.remove('active');
          if (priceValuePro) priceValuePro.textContent = '49.000 đ';
          if (pricePeriodPro) pricePeriodPro.textContent = '/ tháng';
          if (pricePeriodFree) pricePeriodFree.textContent = '/ tháng';
        }
      };

      btnMonthly.addEventListener('click', function () {
        setBillingCycle('monthly');
      });

      btnYearly.addEventListener('click', function () {
        setBillingCycle('yearly');
      });
    }
  }

  // Self-initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWelcomeController);
  } else {
    initWelcomeController();
  }
})();

