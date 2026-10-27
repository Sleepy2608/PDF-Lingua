/**
 * PDF-Lingua — Authentication & Registration Module (PDFL-73.4 + PDFL-76.4)
 * --------------------------------------------------------------------------
 * Handles registration and login modal interaction, client-side input validation,
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
    initAuthModals();
    initPasswordToggles();
    initRegistrationForm();
    initLoginForm();
  });

  /**
   * Initialize modal opening, closing, keyboard accessibility, backdrop dismissal,
   * and modal switching between Register and Login.
   */
  function initAuthModals() {
    const registerModal = document.getElementById('registerModal');
    const loginModal = document.getElementById('loginModal');
    const btnOpenRegister = document.getElementById('btnOpenRegister');
    const btnLogin = document.getElementById('btnLogin');
    const btnCloseRegister = document.getElementById('btnCloseRegisterModal');
    const btnCloseLogin = document.getElementById('btnCloseLoginModal');
    const linkSwitchLogin = document.getElementById('linkSwitchLogin');
    const linkSwitchRegister = document.getElementById('linkSwitchRegister');

    // ── Register Modal ──

    function openRegisterModal() {
      closeLoginModal();
      if (!registerModal) return;
      registerModal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      clearRegisterAlert();
      clearAllFieldErrors();
      const firstInput = document.getElementById('regFullName');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 50);
      }
    }

    function closeRegisterModal() {
      if (!registerModal) return;
      registerModal.setAttribute('hidden', '');
      document.body.style.overflow = '';
      clearRegisterAlert();
    }

    // ── Login Modal ──

    function openLoginModal() {
      closeRegisterModal();
      if (!loginModal) return;
      loginModal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      clearLoginAlert();
      clearLoginFieldErrors();
      const emailInput = document.getElementById('loginEmail');
      if (emailInput) {
        setTimeout(() => emailInput.focus(), 50);
      }
    }

    function closeLoginModal() {
      if (!loginModal) return;
      loginModal.setAttribute('hidden', '');
      document.body.style.overflow = '';
      clearLoginAlert();
    }

    // ── Button Wiring ──

    if (btnOpenRegister) {
      btnOpenRegister.addEventListener('click', openRegisterModal);
    }

    if (btnLogin) {
      btnLogin.addEventListener('click', (e) => {
        e.preventDefault();
        openLoginModal();
      });
    }

    if (btnCloseRegister) {
      btnCloseRegister.addEventListener('click', closeRegisterModal);
    }

    if (btnCloseLogin) {
      btnCloseLogin.addEventListener('click', closeLoginModal);
    }

    // ── Modal Switching ──

    if (linkSwitchLogin) {
      linkSwitchLogin.addEventListener('click', (e) => {
        e.preventDefault();
        openLoginModal();
      });
    }

    if (linkSwitchRegister) {
      linkSwitchRegister.addEventListener('click', (e) => {
        e.preventDefault();
        openRegisterModal();
      });
    }

    // ── Backdrop Dismiss ──

    if (registerModal) {
      registerModal.addEventListener('click', (e) => {
        if (e.target === registerModal) closeRegisterModal();
      });
    }

    if (loginModal) {
      loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) closeLoginModal();
      });
    }

    // ── Escape Key ──

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (registerModal && !registerModal.hasAttribute('hidden')) {
          closeRegisterModal();
        }
        if (loginModal && !loginModal.hasAttribute('hidden')) {
          closeLoginModal();
        }
      }
    });

    // Expose helpers globally for testing or integration
    window.pdfLinguaAuth = {
      openRegisterModal,
      closeRegisterModal,
      openLoginModal,
      closeLoginModal,
    };
  }

  /**
   * Password Visibility Toggle (Show / Hide plaintext)
   */
  function initPasswordToggles() {
    setupToggle('toggleRegPassword', 'regPassword');
    setupToggle('toggleRegConfirmPassword', 'regConfirmPassword');
    setupToggle('toggleLoginPassword', 'loginPassword');

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

  // ═══════════════════════════════════════════════════════════════════════════
  //  REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Form validation & API submission for registration
   */
  function initRegistrationForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    const emailInput = document.getElementById('regEmail');
    const passwordInput = document.getElementById('regPassword');
    const confirmPasswordInput = document.getElementById('regConfirmPassword');
    const fullNameInput = document.getElementById('regFullName');

    // Live validation cleanup on user input
    [fullNameInput, emailInput, passwordInput, confirmPasswordInput].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        clearFieldError(input);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isSubmitting) return;

      clearRegisterAlert();
      clearAllFieldErrors();

      // Client-side Validation
      const isValid = validateRegistrationForm({
        fullNameInput,
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
   * Validate all registration form fields according to business rules
   */
  function validateRegistrationForm({ fullNameInput, emailInput, passwordInput, confirmPasswordInput }) {
    let isValid = true;
    let firstInvalidInput = null;

    // 0. Full name validation (Optional, max 150 chars)
    if (fullNameInput && fullNameInput.value) {
      const fullNameVal = fullNameInput.value.trim();
      if (fullNameVal.length > 150) {
        showFieldError(fullNameInput, 'Họ và tên không được vượt quá 150 ký tự.');
        isValid = false;
        firstInvalidInput = firstInvalidInput || fullNameInput;
      }
    }

    // 1. Email validation
    const emailVal = emailInput ? emailInput.value.trim() : '';
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
    const pwdVal = passwordInput ? passwordInput.value : '';
    if (!pwdVal) {
      showFieldError(passwordInput, 'Vui lòng nhập mật khẩu.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || passwordInput;
    } else if (pwdVal.length < 8) {
      showFieldError(passwordInput, 'Mật khẩu phải có tối thiểu 8 ký tự.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || passwordInput;
    } else if (pwdVal.length > 128) {
      showFieldError(passwordInput, 'Mật khẩu không được vượt quá 128 ký tự.');
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
    const confirmVal = confirmPasswordInput ? confirmPasswordInput.value : '';
    if (!confirmVal) {
      showFieldError(confirmPasswordInput, 'Vui lòng nhập lại mật khẩu xác nhận.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || confirmPasswordInput;
    } else if (confirmVal.length > 128) {
      showFieldError(confirmPasswordInput, 'Mật khẩu xác nhận không được vượt quá 128 ký tự.');
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
   * Format or translate raw validation messages from backend into user-friendly text.
   */
  function formatValidationErrorMessage(fieldKey, rawMessage) {
    const raw = String(rawMessage || '').trim();
    const lower = raw.toLowerCase();

    if (fieldKey === 'email') {
      if (lower.includes('valid email') || lower.includes('email address')) {
        return 'Định dạng email không hợp lệ (ví dụ: ten@domain.com).';
      }
      if (lower.includes('field required') || lower.includes('missing')) {
        return 'Vui lòng nhập địa chỉ email.';
      }
    }

    if (fieldKey === 'password') {
      if (lower.includes('at least 8') || lower.includes('min_length')) {
        return 'Mật khẩu phải có tối thiểu 8 ký tự.';
      }
      if (lower.includes('at most 128') || lower.includes('max_length') || lower.includes('128 characters')) {
        return 'Mật khẩu không được vượt quá 128 ký tự.';
      }
      if (lower.includes('at least one letter') || lower.includes('one letter')) {
        return 'Mật khẩu phải chứa ít nhất một chữ cái.';
      }
      if (lower.includes('at least one digit') || lower.includes('one digit') || lower.includes('one number')) {
        return 'Mật khẩu phải chứa ít nhất một chữ số.';
      }
      if (lower.includes('field required') || lower.includes('missing')) {
        return 'Vui lòng nhập mật khẩu.';
      }
    }

    if (fieldKey === 'full_name') {
      if (lower.includes('at most 150') || lower.includes('max_length') || lower.includes('150 characters')) {
        return 'Họ và tên không được vượt quá 150 ký tự.';
      }
    }

    // Strip "Value error, " prefix if present from Pydantic validator exceptions
    const cleaned = raw.replace(/^value error,\s*/i, '');
    return cleaned || 'Dữ liệu không hợp lệ.';
  }

  /**
   * Resolve which input element and field key an error relates to.
   */
  function resolveFieldTarget(err, inputs) {
    if (!err) return null;
    let fieldIdentifier = '';

    if (typeof err.field === 'string') {
      fieldIdentifier = err.field;
    } else if (Array.isArray(err.loc)) {
      fieldIdentifier = err.loc.map(String).join(' -> ');
    } else if (typeof err.loc === 'string') {
      fieldIdentifier = err.loc;
    }

    const normalized = fieldIdentifier.toLowerCase();
    if (normalized.includes('email')) {
      return { input: inputs.emailInput, key: 'email' };
    }
    if (normalized.includes('password') && !normalized.includes('confirm')) {
      return { input: inputs.passwordInput, key: 'password' };
    }
    if (normalized.includes('full_name') || normalized.includes('fullname')) {
      return { input: inputs.fullNameInput, key: 'full_name' };
    }

    return null;
  }

  /**
   * Send registration request to backend API
   */
  async function submitRegistration(payload) {
    const btnSubmit = document.getElementById('btnSubmitRegister');
    const spinner = document.getElementById('regSpinner');
    const btnText = document.getElementById('regBtnText');
    const form = document.getElementById('registerForm');
    const fullNameInput = document.getElementById('regFullName');
    const emailInput = document.getElementById('regEmail');
    const passwordInput = document.getElementById('regPassword');
    const confirmPasswordInput = document.getElementById('regConfirmPassword');

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
        showRegisterAlert(
          'Đăng ký tài khoản thành công! Bạn có thể sử dụng tài khoản này để trải nghiệm PDF-Lingua.',
          'success'
        );
        form.reset();
        // Reset password visibility if it was toggled
        resetPasswordToggleView();
      } else if (response.status === 400) {
        // Duplicate email or business validation error
        if (responseData && responseData.error_code === 'EMAIL_ALREADY_EXISTS') {
          showRegisterAlert(
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
          showRegisterAlert(msg, 'error');
        }
      } else if (response.status === 422) {
        // Schema validation error: Parse details and map to inputs
        let hasMappedField = false;
        let firstInvalidInput = null;
        const unmappedErrors = [];

        const inputsMap = { fullNameInput, emailInput, passwordInput };

        if (responseData && Array.isArray(responseData.details) && responseData.details.length > 0) {
          responseData.details.forEach((err) => {
            const target = resolveFieldTarget(err, inputsMap);
            if (target && target.input) {
              const friendlyMsg = formatValidationErrorMessage(target.key, err.message || err.msg);
              showFieldError(target.input, friendlyMsg);
              hasMappedField = true;
              firstInvalidInput = firstInvalidInput || target.input;
            } else {
              unmappedErrors.push(err);
            }
          });
        }

        if (hasMappedField) {
          const alertText = unmappedErrors.length > 0
            ? `Thông tin chưa hợp lệ: ${unmappedErrors.map((e) => e.message || e.msg || 'Lỗi dữ liệu').join('; ')}`
            : 'Thông tin đăng ký chưa hợp lệ. Vui lòng kiểm tra lại các trường được đánh dấu.';
          showRegisterAlert(alertText, 'error');
          if (firstInvalidInput) {
            firstInvalidInput.focus();
          }
        } else {
          // Fallback if details is missing, empty, or unmappable
          let fallbackMsg = (responseData && responseData.message)
            ? responseData.message
            : 'Dữ liệu nhập vào chưa đúng định dạng. Vui lòng kiểm tra lại thông tin đăng ký.';
          if (unmappedErrors.length > 0) {
            const unmappedText = unmappedErrors.map((e) => e.message || e.msg).filter(Boolean).join('; ');
            if (unmappedText) fallbackMsg = unmappedText;
          }
          showRegisterAlert(fallbackMsg, 'error');
        }
      } else {
        // Server error (500, etc.)
        showRegisterAlert(
          'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau giây lát.',
          'error'
        );
      }
    } catch (networkError) {
      console.error('[PDF-Lingua Auth Error]', networkError);
      showRegisterAlert(
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  LOGIN (PDFL-76.4)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize login form validation and API submission
   */
  function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');

    // Live validation cleanup on user input
    [emailInput, passwordInput].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        clearFieldError(input);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isSubmitting) return;

      clearLoginAlert();
      clearLoginFieldErrors();

      // Client-side Validation
      const isValid = validateLoginForm({ emailInput, passwordInput });

      if (!isValid) return;

      const payload = {
        email: emailInput.value.trim().toLowerCase(),
        password: passwordInput.value,
      };

      await submitLogin(payload);
    });
  }

  /**
   * Validate login form fields
   */
  function validateLoginForm({ emailInput, passwordInput }) {
    let isValid = true;
    let firstInvalidInput = null;

    // 1. Email validation
    const emailVal = emailInput ? emailInput.value.trim() : '';
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

    // 2. Password validation (login only checks presence)
    const pwdVal = passwordInput ? passwordInput.value : '';
    if (!pwdVal) {
      showFieldError(passwordInput, 'Vui lòng nhập mật khẩu.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || passwordInput;
    }

    if (firstInvalidInput) {
      firstInvalidInput.focus();
    }

    return isValid;
  }

  /**
   * Send login request to backend API
   */
  async function submitLogin(payload) {
    const btnSubmit = document.getElementById('btnSubmitLogin');
    const spinner = document.getElementById('loginSpinner');
    const btnText = document.getElementById('loginBtnText');
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');

    setLoginLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
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

      if (response.status === 200) {
        // Successful login
        const userData = responseData && responseData.data ? responseData.data : null;
        const displayName = userData && (userData.full_name || userData.email)
          ? (userData.full_name || userData.email)
          : '';

        showLoginAlert(
          displayName
            ? `Đăng nhập thành công! Xin chào, ${escapeHtml(displayName)}.`
            : 'Đăng nhập thành công!',
          'success'
        );

        form.reset();
        resetLoginPasswordToggle();

      } else if (response.status === 401) {
        // Invalid credentials (wrong email or password — same message for anti-enumeration)
        const msg = (responseData && responseData.message)
          ? responseData.message
          : 'Email hoặc mật khẩu không chính xác.';
        showLoginAlert(msg, 'error');

      } else if (response.status === 403) {
        // Account inactive / disabled
        const msg = (responseData && responseData.message)
          ? responseData.message
          : 'Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.';
        showLoginAlert(msg, 'error');

      } else if (response.status === 422) {
        // Validation errors from backend
        let hasMappedField = false;
        let firstInvalidInput = null;
        const unmappedErrors = [];
        const inputsMap = { emailInput, passwordInput };

        if (responseData && Array.isArray(responseData.details) && responseData.details.length > 0) {
          responseData.details.forEach((err) => {
            const target = resolveFieldTarget(err, inputsMap);
            if (target && target.input) {
              const friendlyMsg = formatValidationErrorMessage(target.key, err.message || err.msg);
              showFieldError(target.input, friendlyMsg);
              hasMappedField = true;
              firstInvalidInput = firstInvalidInput || target.input;
            } else {
              unmappedErrors.push(err);
            }
          });
        }

        if (hasMappedField) {
          const alertText = unmappedErrors.length > 0
            ? `Thông tin chưa hợp lệ: ${unmappedErrors.map((e) => e.message || e.msg || 'Lỗi dữ liệu').join('; ')}`
            : 'Thông tin đăng nhập chưa hợp lệ. Vui lòng kiểm tra lại.';
          showLoginAlert(alertText, 'error');
          if (firstInvalidInput) firstInvalidInput.focus();
        } else {
          showLoginAlert(
            (responseData && responseData.message)
              ? responseData.message
              : 'Dữ liệu nhập vào chưa đúng định dạng. Vui lòng kiểm tra lại.',
            'error'
          );
        }

      } else {
        // Server error (500, etc.)
        showLoginAlert(
          'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau giây lát.',
          'error'
        );
      }
    } catch (networkError) {
      console.error('[PDF-Lingua Login Error]', networkError);
      showLoginAlert(
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng hoặc đảm bảo máy chủ backend đang chạy.',
        'error'
      );
    } finally {
      setLoginLoading(false);
    }

    function setLoginLoading(loading) {
      isSubmitting = loading;
      if (btnSubmit) {
        btnSubmit.disabled = loading;
      }
      if (spinner) {
        spinner.style.display = loading ? 'inline-block' : 'none';
      }
      if (btnText) {
        btnText.textContent = loading ? 'Đang đăng nhập...' : 'Đăng nhập';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  UI HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Field-level error display
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

  function clearLoginFieldErrors() {
    ['loginEmail', 'loginPassword'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) clearFieldError(input);
    });
  }

  /**
   * Alert helpers — scoped to the correct modal
   */
  function showRegisterAlert(message, type = 'info') {
    showAlertInElement('registerAlert', message, type);
  }

  function clearRegisterAlert() {
    clearAlertInElement('registerAlert');
  }

  function showLoginAlert(message, type = 'info') {
    showAlertInElement('loginAlert', message, type);
  }

  function clearLoginAlert() {
    clearAlertInElement('loginAlert');
  }

  // Backward-compatible aliases used by registration flow
  function showAlert(message, type) {
    showRegisterAlert(message, type);
  }

  function clearAlert() {
    clearRegisterAlert();
  }

  function showAlertInElement(elementId, message, type) {
    const alertBox = document.getElementById(elementId);
    if (!alertBox) return;

    alertBox.className = `form-alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.style.display = 'block';
  }

  function clearAlertInElement(elementId) {
    const alertBox = document.getElementById(elementId);
    if (!alertBox) return;
    alertBox.style.display = 'none';
    alertBox.textContent = '';
    alertBox.className = 'form-alert';
  }

  /**
   * Password toggle reset helpers
   */
  function resetPasswordToggleView() {
    const pwdInput = document.getElementById('regPassword');
    const confirmInput = document.getElementById('regConfirmPassword');
    if (pwdInput) pwdInput.type = 'password';
    if (confirmInput) confirmInput.type = 'password';

    document.querySelectorAll('#registerModal .btn-toggle-eye').forEach((btn) => {
      const open = btn.querySelector('.eye-open');
      const closed = btn.querySelector('.eye-closed');
      if (open) open.style.display = 'block';
      if (closed) closed.style.display = 'none';
      btn.setAttribute('aria-label', 'Hiện mật khẩu');
    });
  }

  function resetLoginPasswordToggle() {
    const loginPwd = document.getElementById('loginPassword');
    if (loginPwd) loginPwd.type = 'password';

    document.querySelectorAll('#loginModal .btn-toggle-eye').forEach((btn) => {
      const open = btn.querySelector('.eye-open');
      const closed = btn.querySelector('.eye-closed');
      if (open) open.style.display = 'block';
      if (closed) closed.style.display = 'none';
      btn.setAttribute('aria-label', 'Hiện mật khẩu');
    });
  }

  /**
   * Escape HTML to prevent XSS when injecting user data into alert messages
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  // Expose helpers globally for testing or integration
  window.pdfLinguaAuth = Object.assign(window.pdfLinguaAuth || {}, {
    validateRegistrationForm,
    validateLoginForm,
    formatValidationErrorMessage,
    resolveFieldTarget,
    submitRegistration,
    submitLogin,
    showFieldError,
    clearFieldError,
    clearAllFieldErrors,
    showAlert,
    clearAlert,
    showLoginAlert,
    clearLoginAlert,
    escapeHtml,
  });
})();
