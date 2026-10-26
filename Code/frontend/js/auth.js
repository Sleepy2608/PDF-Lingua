/**
 * PDF-Lingua — Authentication & Registration Module (PDFL-73.4)
 * -------------------------------------------------------------
 * Handles registration modal interaction, client-side input validation,
 * password toggle visibility, asynchronous API submission, and UI error states.
 */

(function () {
  'use strict';

  // API Base URL Detection (handles localhost:8000 backend with CORS support)
  const API_BASE_URL = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8000'))
    ? 'http://localhost:8000'
    : '';

  let isSubmitting = false;

  document.addEventListener('DOMContentLoaded', () => {
    initAuthModal();
    initPasswordToggles();
    initRegistrationForm();
  });

  /**
   * Initialize modal opening, closing, keyboard accessibility, and backdrop dismissal.
   */
  function initAuthModal() {
    const modal = document.getElementById('registerModal');
    const btnOpen = document.getElementById('btnOpenRegister');
    const btnLogin = document.getElementById('btnLogin');
    const btnClose = document.getElementById('btnCloseRegisterModal');
    const linkSwitchLogin = document.getElementById('linkSwitchLogin');

    if (!modal) return;

    function openModal() {
      modal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      clearAlert();
      clearAllFieldErrors();
      // Auto-focus first input field
      const firstInput = document.getElementById('regFullName');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 50);
      }
    }

    function closeModal() {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
      clearAlert();
    }

    if (btnOpen) {
      btnOpen.addEventListener('click', openModal);
    }

    if (btnLogin) {
      btnLogin.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
        showAlert(
          'Chức năng Đăng nhập đang được phát triển ở phiên bản tiếp theo. Bạn có thể đăng ký tài khoản mới ngay bây giờ!',
          'info'
        );
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', closeModal);
    }

    if (linkSwitchLogin) {
      linkSwitchLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showAlert(
          'Hệ thống đăng nhập đang được cập nhật (PDFL-74). Vui lòng đăng ký tài khoản mới bên dưới!',
          'info'
        );
      });
    }

    // Dismiss when clicking outside modal dialog
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Dismiss when pressing ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
        closeModal();
      }
    });

    // Expose helpers globally for testing or integration
    window.pdfLinguaAuth = {
      openRegisterModal: openModal,
      closeRegisterModal: closeModal,
    };
  }

  /**
   * Password Visibility Toggle (Show / Hide plaintext)
   */
  function initPasswordToggles() {
    setupToggle('toggleRegPassword', 'regPassword');
    setupToggle('toggleRegConfirmPassword', 'regConfirmPassword');

    function setupToggle(buttonId, inputId) {
      const btn = document.getElementById(buttonId);
      const input = document.getElementById(inputId);
      if (!btn || !input) return;

      const eyeOpen = btn.querySelector('.eye-open');
      const eyeClosed = btn.querySelector('.eye-closed');

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        if (eyeOpen && eyeClosed) {
          eyeOpen.style.display = isPassword ? 'none' : 'block';
          eyeClosed.style.display = isPassword ? 'block' : 'none';
        }

        btn.setAttribute(
          'aria-label',
          isPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
        );
      });
    }
  }

  /**
   * Form validation & API submission
   */
  function initRegistrationForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    const emailInput = document.getElementById('regEmail');
    const passwordInput = document.getElementById('regPassword');
    const confirmPasswordInput = document.getElementById('regConfirmPassword');
    const fullNameInput = document.getElementById('regFullName');

    // Live validation cleanup on user input
    [emailInput, passwordInput, confirmPasswordInput].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        clearFieldError(input);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isSubmitting) return;

      clearAlert();
      clearAllFieldErrors();

      // Client-side Validation
      const isValid = validateRegistrationForm({
        emailInput,
        passwordInput,
        confirmPasswordInput,
      });

      if (!isValid) return;

      // Prepare payload (Never send confirm_password)
      const payload = {
        email: emailInput.value.trim().toLowerCase(),
        password: passwordInput.value,
      };

      const fullName = fullNameInput ? fullNameInput.value.trim() : '';
      if (fullName) {
        payload.full_name = fullName;
      }

      await submitRegistration(payload);
    });
  }

  /**
   * Validate all form fields according to business rules
   */
  function validateRegistrationForm({ emailInput, passwordInput, confirmPasswordInput }) {
    let isValid = true;
    let firstInvalidInput = null;

    // 1. Email validation
    const emailVal = emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal) {
      showFieldError(emailInput, 'Vui lòng nhập địa chỉ email.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || emailInput;
    } else if (!emailRegex.test(emailVal)) {
      showFieldError(emailInput, 'Định dạng email không hợp lệ (ví dụ: ten@domain.com).');
      isValid = false;
      firstInvalidInput = firstInvalidInput || emailInput;
    }

    // 2. Password validation
    const pwdVal = passwordInput.value;
    if (!pwdVal) {
      showFieldError(passwordInput, 'Vui lòng nhập mật khẩu.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || passwordInput;
    } else if (pwdVal.length < 8) {
      showFieldError(passwordInput, 'Mật khẩu phải có tối thiểu 8 ký tự.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || passwordInput;
    } else if (!/[a-zA-Z]/.test(pwdVal)) {
      showFieldError(passwordInput, 'Mật khẩu phải chứa ít nhất một chữ cái.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || passwordInput;
    } else if (!/[0-9]/.test(pwdVal)) {
      showFieldError(passwordInput, 'Mật khẩu phải chứa ít nhất một chữ số.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || passwordInput;
    }

    // 3. Confirm Password validation
    const confirmVal = confirmPasswordInput.value;
    if (!confirmVal) {
      showFieldError(confirmPasswordInput, 'Vui lòng nhập lại mật khẩu xác nhận.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || confirmPasswordInput;
    } else if (pwdVal && confirmVal !== pwdVal) {
      showFieldError(confirmPasswordInput, 'Mật khẩu xác nhận không khớp với mật khẩu đã nhập.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || confirmPasswordInput;
    }

    if (firstInvalidInput) {
      firstInvalidInput.focus();
    }

    return isValid;
  }

  /**
   * Send registration request to backend API
   */
  async function submitRegistration(payload) {
    const btnSubmit = document.getElementById('btnSubmitRegister');
    const spinner = document.getElementById('regSpinner');
    const btnText = document.getElementById('regBtnText');
    const form = document.getElementById('registerForm');
    const emailInput = document.getElementById('regEmail');

    setLoadingState(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let responseData = null;
      try {
        responseData = await response.json();
      } catch (err) {
        // Fallback if response is not JSON
      }

      if (response.status === 201) {
        // Successful registration
        showAlert(
          'Đăng ký tài khoản thành công! Bạn có thể sử dụng tài khoản này để trải nghiệm PDF-Lingua.',
          'success'
        );
        form.reset();
        // Reset password visibility if it was toggled
        resetPasswordToggleView();
      } else if (response.status === 400) {
        // Duplicate email or business validation error
        if (responseData && responseData.error_code === 'EMAIL_ALREADY_EXISTS') {
          showAlert(
            'Email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác.',
            'error'
          );
          if (emailInput) {
            showFieldError(emailInput, 'Email đã tồn tại trong hệ thống.');
            emailInput.focus();
          }
        } else {
          const msg = responseData && responseData.message
            ? responseData.message
            : 'Yêu cầu đăng ký không hợp lệ. Vui lòng kiểm tra lại.';
          showAlert(msg, 'error');
        }
      } else if (response.status === 422) {
        // Schema validation error
        showAlert(
          'Dữ liệu nhập vào chưa đúng định dạng. Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ và số.',
          'error'
        );
      } else {
        // Server error (500, etc.)
        showAlert(
          'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau giây lát.',
          'error'
        );
      }
    } catch (networkError) {
      console.error('[PDF-Lingua Auth Error]', networkError);
      showAlert(
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng hoặc đảm bảo máy chủ backend đang chạy.',
        'error'
      );
    } finally {
      setLoadingState(false);
    }

    function setLoadingState(loading) {
      isSubmitting = loading;
      if (btnSubmit) {
        btnSubmit.disabled = loading;
      }
      if (spinner) {
        spinner.style.display = loading ? 'inline-block' : 'none';
      }
      if (btnText) {
        btnText.textContent = loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản';
      }
    }
  }

  /**
   * UI Helpers: Field Errors and Alerts
   */
  function showFieldError(input, message) {
    if (!input) return;
    input.classList.add('has-error');
    const errorEl = document.getElementById(`${input.id}Error`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('active');
    }
  }

  function clearFieldError(input) {
    if (!input) return;
    input.classList.remove('has-error');
    const errorEl = document.getElementById(`${input.id}Error`);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('active');
    }
  }

  function clearAllFieldErrors() {
    document.querySelectorAll('.form-input').forEach((input) => {
      clearFieldError(input);
    });
  }

  function showAlert(message, type = 'info') {
    const alertBox = document.getElementById('registerAlert');
    if (!alertBox) return;

    alertBox.className = `form-alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.style.display = 'block';
  }

  function clearAlert() {
    const alertBox = document.getElementById('registerAlert');
    if (!alertBox) return;
    alertBox.style.display = 'none';
    alertBox.textContent = '';
    alertBox.className = 'form-alert';
  }

  function resetPasswordToggleView() {
    const pwdInput = document.getElementById('regPassword');
    const confirmInput = document.getElementById('regConfirmPassword');
    if (pwdInput) pwdInput.type = 'password';
    if (confirmInput) confirmInput.type = 'password';

    document.querySelectorAll('.btn-toggle-eye').forEach((btn) => {
      const open = btn.querySelector('.eye-open');
      const closed = btn.querySelector('.eye-closed');
      if (open) open.style.display = 'block';
      if (closed) closed.style.display = 'none';
      btn.setAttribute('aria-label', 'Hiện mật khẩu');
    });
  }
})();
