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

      // Close on resize if expanded past mobile/tablet breakpoint
      window.addEventListener('resize', function () {
        if (window.innerWidth > 1024 && mobileDrawer.classList.contains('is-open')) {
          toggleMobileMenu(false);
        }
      }, { passive: true });
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

    // 7. Smooth Scrolling with Sticky Navbar Offset Compensation
    var smoothScrollLinks = document.querySelectorAll('a[href^="#welcome"]');
    if (smoothScrollLinks.length > 0) {
      smoothScrollLinks.forEach(function (link) {
        link.addEventListener('click', function (e) {
          var targetId = link.getAttribute('href');
          if (targetId && targetId.length > 1) {
            var targetEl = document.querySelector(targetId);
            if (targetEl) {
              e.preventDefault();
              var headerHeight = navbar ? navbar.offsetHeight : 72;
              var targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;
              var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              window.scrollTo({
                top: Math.max(0, targetPosition),
                behavior: prefersReduced ? 'auto' : 'smooth'
              });
              if (history.pushState) {
                history.pushState(null, null, targetId);
              }
            }
          }
        });
      });
    }

    // 8. Scroll Reveal Observer with Reduced Motion Fallback
    var revealElements = document.querySelectorAll('.welcome-reveal');
    if (revealElements.length > 0) {
      var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion || !('IntersectionObserver' in window)) {
        revealElements.forEach(function (el) {
          el.classList.add('is-revealed');
        });
      } else {
        var revealObserver = new IntersectionObserver(function (entries, observer) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-revealed');
              observer.unobserve(entry.target);
            }
          });
        }, {
          root: null,
          rootMargin: '0px 0px -40px 0px',
          threshold: 0.1
        });

        revealElements.forEach(function (el) {
          revealObserver.observe(el);
        });
      }
    }

    // 9. Login Modal Controller (with automatic redirection to index.html)
    var loginModal = document.getElementById('loginModal');
    var navBtnLogin = document.getElementById('navBtnLogin');
    var mobileBtnLogin = document.getElementById('btnWelcomeMobileLogin');
    var btnCloseLoginModal = document.getElementById('btnCloseLoginModal');
    var loginForm = document.getElementById('loginForm');
    var loginEmail = document.getElementById('loginEmail');
    var loginPassword = document.getElementById('loginPassword');
    var loginEmailError = document.getElementById('loginEmailError');
    var loginPasswordError = document.getElementById('loginPasswordError');
    var loginAlert = document.getElementById('loginAlert');
    var toggleLoginPassword = document.getElementById('toggleLoginPassword');
    var btnSubmitLogin = document.getElementById('btnSubmitLogin');
    var loginSpinner = document.getElementById('loginSpinner');
    var loginBtnText = document.getElementById('loginBtnText');

    var openLoginModal = function () {
      if (!loginModal) return;
      var mobileToggle = document.getElementById('btnWelcomeMobileMenu');
      var mobileDrawer = document.getElementById('welcomeMobileDrawer');
      if (mobileToggle && mobileDrawer && mobileDrawer.classList.contains('is-open')) {
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileDrawer.setAttribute('aria-hidden', 'true');
        mobileDrawer.classList.remove('is-open');
      }
      loginModal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      if (loginAlert) {
        loginAlert.style.display = 'none';
        loginAlert.textContent = '';
        loginAlert.className = 'form-alert';
      }
      if (loginEmailError) {
        loginEmailError.textContent = '';
        loginEmailError.classList.remove('active');
      }
      if (loginPasswordError) {
        loginPasswordError.textContent = '';
        loginPasswordError.classList.remove('active');
      }
      if (loginEmail) {
        setTimeout(function () {
          loginEmail.focus();
        }, 60);
      }
    };

    var closeLoginModal = function () {
      if (!loginModal) return;
      loginModal.setAttribute('hidden', '');
      document.body.style.overflow = '';
      if (loginForm) {
        loginForm.reset();
      }
      if (loginAlert) {
        loginAlert.style.display = 'none';
        loginAlert.textContent = '';
      }
      if (loginEmailError) {
        loginEmailError.textContent = '';
        loginEmailError.classList.remove('active');
      }
      if (loginPasswordError) {
        loginPasswordError.textContent = '';
        loginPasswordError.classList.remove('active');
      }
    };

    if (navBtnLogin) {
      navBtnLogin.addEventListener('click', function (e) {
        e.preventDefault();
        openLoginModal();
      });
    }

    if (mobileBtnLogin) {
      mobileBtnLogin.addEventListener('click', function (e) {
        e.preventDefault();
        openLoginModal();
      });
    }

    if (btnCloseLoginModal) {
      btnCloseLoginModal.addEventListener('click', function () {
        closeLoginModal();
      });
    }

    if (loginModal) {
      loginModal.addEventListener('click', function (e) {
        if (e.target === loginModal) {
          closeLoginModal();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && loginModal && !loginModal.hasAttribute('hidden')) {
        closeLoginModal();
        if (navBtnLogin && typeof navBtnLogin.focus === 'function') {
          navBtnLogin.focus();
        }
      }
    });

    if (toggleLoginPassword && loginPassword) {
      toggleLoginPassword.addEventListener('click', function () {
        var isPassword = loginPassword.getAttribute('type') === 'password';
        loginPassword.setAttribute('type', isPassword ? 'text' : 'password');
        var eyeOpen = toggleLoginPassword.querySelector('.eye-open');
        var eyeClosed = toggleLoginPassword.querySelector('.eye-closed');
        if (eyeOpen && eyeClosed) {
          eyeOpen.style.display = isPassword ? 'none' : 'block';
          eyeClosed.style.display = isPassword ? 'block' : 'none';
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = loginEmail ? loginEmail.value.trim() : '';
        var password = loginPassword ? loginPassword.value : '';
        var hasError = false;

        if (loginAlert) {
          loginAlert.style.display = 'none';
          loginAlert.className = 'form-alert';
        }
        if (loginEmailError) {
          loginEmailError.textContent = '';
          loginEmailError.classList.remove('active');
        }
        if (loginPasswordError) {
          loginPasswordError.textContent = '';
          loginPasswordError.classList.remove('active');
        }

        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
          if (loginEmailError) {
            loginEmailError.textContent = 'Vui lòng nhập địa chỉ email.';
            loginEmailError.classList.add('active');
          }
          hasError = true;
        } else if (!emailRegex.test(email)) {
          if (loginEmailError) {
            loginEmailError.textContent = 'Địa chỉ email không đúng định dạng.';
            loginEmailError.classList.add('active');
          }
          hasError = true;
        }

        if (!password) {
          if (loginPasswordError) {
            loginPasswordError.textContent = 'Vui lòng nhập mật khẩu.';
            loginPasswordError.classList.add('active');
          }
          hasError = true;
        }

        if (hasError) return;

        if (btnSubmitLogin) btnSubmitLogin.disabled = true;
        if (loginSpinner) loginSpinner.style.display = 'inline-block';
        if (loginBtnText) loginBtnText.textContent = 'Đang đăng nhập...';

        var API_BASE_URL = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8000'))
          ? (window.location.protocol === 'https:' ? 'https:' : 'http:') + '//' + ((window.location.hostname && window.location.hostname !== '') ? window.location.hostname : '127.0.0.1') + ':8000'
          : '';

        fetch(API_BASE_URL + '/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ email: email, password: password })
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { status: res.status, data: data };
            }).catch(function () {
              return { status: res.status, data: null };
            });
          })
          .then(function (result) {
            if (btnSubmitLogin) btnSubmitLogin.disabled = false;
            if (loginSpinner) loginSpinner.style.display = 'none';
            if (loginBtnText) loginBtnText.textContent = 'Đăng nhập';

            if (result.status === 200 && result.data && result.data.data) {
              var token = result.data.data.access_token;
              var user = result.data.data.user;
              try {
                if (window.localStorage) {
                  window.localStorage.setItem('pdfl_token', token);
                  if (user) {
                    window.localStorage.setItem('pdfl_user', JSON.stringify(user));
                  }
                }
              } catch (storageErr) {
                // Ignore storage error
              }

              if (loginAlert) {
                loginAlert.className = 'form-alert alert-success';
                loginAlert.textContent = 'Đăng nhập thành công! Đang chuyển hướng vào không gian làm việc...';
                loginAlert.style.display = 'flex';
              }

              setTimeout(function () {
                window.location.href = 'index.html';
              }, 700);
            } else {
              var errorMsg = (result.data && result.data.message) ? result.data.message : 'Email hoặc mật khẩu không chính xác.';
              if (loginAlert) {
                loginAlert.className = 'form-alert alert-error';
                loginAlert.textContent = errorMsg;
                loginAlert.style.display = 'flex';
              }
            }
          })
          .catch(function () {
            if (btnSubmitLogin) btnSubmitLogin.disabled = false;
            if (loginSpinner) loginSpinner.style.display = 'none';
            if (loginBtnText) loginBtnText.textContent = 'Đăng nhập';
            if (loginAlert) {
              loginAlert.className = 'form-alert alert-error';
              loginAlert.textContent = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại dịch vụ.';
              loginAlert.style.display = 'flex';
            }
          });
      });
    }

    // 8. Legal & Contact Modal Controller (Terms, Privacy, Contact)
    var legalOverlay = document.getElementById('legalModalOverlay');
    var legalContainer = legalOverlay ? legalOverlay.querySelector('.legal-modal-container') : null;
    var legalCloseBtn = document.getElementById('legalModalCloseBtn');
    var legalTabBtns = document.querySelectorAll('.legal-tab-btn');
    var legalTabPanels = document.querySelectorAll('.legal-tab-panel');

    var footerLinkTerms = document.getElementById('footerLinkTerms');
    var footerLinkPrivacy = document.getElementById('footerLinkPrivacy');

    var btnToggleFullscreenLegal = document.getElementById('btnToggleFullscreenLegal');
    var btnPrintLegal = document.getElementById('btnPrintLegal');
    var btnScrollToTop = document.getElementById('btnScrollToTop');
    var btnAcceptLegal = document.getElementById('btnAcceptLegal');
    var btnCopySupportEmail = document.getElementById('btnCopySupportEmail');
    var feedbackForm = document.getElementById('feedbackForm');

    if (legalOverlay) {
      var switchLegalTab = function (tabId) {
        legalTabBtns.forEach(function (btn) {
          var isTarget = btn.getAttribute('data-tab') === tabId;
          btn.classList.toggle('active', isTarget);
          btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        });

        legalTabPanels.forEach(function (panel) {
          var isTarget = panel.id === tabId;
          panel.classList.toggle('active', isTarget);
        });

        var modalBody = legalOverlay.querySelector('.legal-modal-body');
        if (modalBody) {
          modalBody.scrollTop = 0;
        }
      };

      var openLegalModal = function (tabId) {
        switchLegalTab(tabId || 'tabTerms');
        legalOverlay.style.display = 'flex';
        legalOverlay.classList.add('active');
        legalOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      };

      var closeLegalModal = function () {
        legalOverlay.classList.remove('active');
        legalOverlay.setAttribute('aria-hidden', 'true');
        legalOverlay.style.display = 'none';
        document.body.style.overflow = '';

        if (legalContainer && legalContainer.classList.contains('fullscreen')) {
          legalContainer.classList.remove('fullscreen');
          var fsIcon = document.getElementById('fullscreenIcon');
          var fsText = document.getElementById('fullscreenText');
          if (fsIcon) fsIcon.textContent = '⛶';
          if (fsText) fsText.textContent = 'Phóng to';
        }
      };

      if (footerLinkTerms) {
        footerLinkTerms.addEventListener('click', function (e) {
          e.preventDefault();
          openLegalModal('tabTerms');
        });
      }

      if (footerLinkPrivacy) {
        footerLinkPrivacy.addEventListener('click', function (e) {
          e.preventDefault();
          openLegalModal('tabPrivacy');
        });
      }

      legalTabBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var targetTab = btn.getAttribute('data-tab');
          if (targetTab) {
            switchLegalTab(targetTab);
          }
        });
      });

      if (legalCloseBtn) {
        legalCloseBtn.addEventListener('click', function (e) {
          e.preventDefault();
          closeLegalModal();
        });
      }

      legalOverlay.addEventListener('click', function (e) {
        if (e.target === legalOverlay) {
          closeLegalModal();
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && legalOverlay.classList.contains('active')) {
          closeLegalModal();
        }
      });

      if (btnAcceptLegal) {
        btnAcceptLegal.addEventListener('click', function (e) {
          e.preventDefault();
          closeLegalModal();
        });
      }

      if (btnToggleFullscreenLegal && legalContainer) {
        btnToggleFullscreenLegal.addEventListener('click', function (e) {
          e.preventDefault();
          var isFs = legalContainer.classList.toggle('fullscreen');
          var fsIcon = document.getElementById('fullscreenIcon');
          var fsText = document.getElementById('fullscreenText');
          if (fsIcon) fsIcon.textContent = isFs ? '🗗' : '⛶';
          if (fsText) fsText.textContent = isFs ? 'Thu nhỏ' : 'Phóng to';
        });
      }

      if (btnPrintLegal) {
        btnPrintLegal.addEventListener('click', function (e) {
          e.preventDefault();
          window.print();
        });
      }

      if (btnScrollToTop) {
        btnScrollToTop.addEventListener('click', function (e) {
          e.preventDefault();
          var modalBody = legalOverlay.querySelector('.legal-modal-body');
          if (modalBody) {
            modalBody.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      }

      if (btnCopySupportEmail) {
        btnCopySupportEmail.addEventListener('click', function (e) {
          e.preventDefault();
          var email = 'huytamnguyenle2608@gmail.com';
          var notifyCopy = function () {
            btnCopySupportEmail.textContent = 'Đã sao chép!';
            setTimeout(function () {
              btnCopySupportEmail.textContent = 'Sao chép';
            }, 2000);
          };

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(email).then(notifyCopy).catch(function () {
              btnCopySupportEmail.textContent = 'huytamnguyenle2608@gmail.com';
            });
          } else {
            notifyCopy();
          }
        });
      }

      if (feedbackForm) {
        feedbackForm.addEventListener('submit', function (e) {
          e.preventDefault();
          alert('Cảm ơn bạn đã gửi phản hồi đóng góp cho nhóm phát triển PDF-Lingua!');
          feedbackForm.reset();
        });
      }
    }
  }

  // Self-initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWelcomeController);
  } else {
    initWelcomeController();
  }
})();

