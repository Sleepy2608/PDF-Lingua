/**
 * PDF-Lingua — Authentication & Registration Module (PDFL-73.4 + PDFL-76.4)
 * --------------------------------------------------------------------------
 * Handles registration and login modal interaction, client-side input validation,
 * password toggle visibility, asynchronous API submission, and UI error states.
 */

(function () {
  'use strict';

  // API Base URL Detection (handles localhost/127.0.0.1 backend with CORS support)
  const API_BASE_URL = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8000'))
    ? `${window.location.protocol === 'https:' ? 'https:' : 'http:'}//${(window.location.hostname && window.location.hostname !== '') ? window.location.hostname : '127.0.0.1'}:8000`
    : '';

  let isSubmitting = false;
  let isRestoringSession = false;

  let openRegisterModal = () => {};
  let closeRegisterModal = () => {};
  let openLoginModal = () => {};
  let closeLoginModal = () => {};
  let openAccountModal = () => {};
  let closeAccountModal = () => {};

  document.addEventListener('DOMContentLoaded', () => {
    initAuthModals();
    initPasswordToggles();
    initRegistrationForm();
    initLoginForm();
    initAuthHeader();
    initAccountModal();
    restoreSession();
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

    openRegisterModal = function () {
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
    };

    closeRegisterModal = function () {
      if (!registerModal) return;
      registerModal.setAttribute('hidden', '');
      document.body.style.overflow = '';
      clearRegisterAlert();
    };

    // ── Login Modal ──

    openLoginModal = function () {
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
    };

    closeLoginModal = function () {
      if (!loginModal) return;
      loginModal.setAttribute('hidden', '');
      document.body.style.overflow = '';
      clearLoginAlert();
    };

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
        const accountModal = document.getElementById('accountModal');
        if (accountModal && !accountModal.hasAttribute('hidden')) {
          closeAccountModal();
        }
      }
    });

    // Expose helpers globally for testing or integration
    window.pdfLinguaAuth = Object.assign(window.pdfLinguaAuth || {}, {
      openRegisterModal,
      closeRegisterModal,
      openLoginModal,
      closeLoginModal,
    });
  }

  /**
   * Password Visibility Toggle (Show / Hide plaintext)
   */
  function initPasswordToggles() {
    setupToggle('toggleRegPassword', 'regPassword');
    setupToggle('toggleRegConfirmPassword', 'regConfirmPassword');
    setupToggle('toggleLoginPassword', 'loginPassword');
    setupToggle('toggleCurrentPassword', 'currentPasswordInput');
    setupToggle('toggleNewPassword', 'newPasswordInput');
    setupToggle('toggleConfirmNewPassword', 'confirmNewPasswordInput');

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

    let keepLoading = false;
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
        // Successful registration -> Auto-login
        setLoadingState(true, 'Đang tự động đăng nhập...');

        const regData = responseData && responseData.data ? responseData.data : null;
        let accessToken = regData && regData.access_token ? regData.access_token : null;
        let userData = regData && (regData.user || regData);

        // If backend did not return token directly, perform auto-login request
        if (!accessToken) {
          try {
            console.log('[PDF-Lingua Auth] Đang tự động đăng nhập cho tài khoản mới:', payload.email);
            const autoLoginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                email: payload.email,
                password: payload.password,
              }),
            });

            let autoLoginData = null;
            try {
              autoLoginData = await autoLoginRes.json();
            } catch (e) {}

            if (autoLoginRes.status === 200 && autoLoginData && autoLoginData.data) {
              accessToken = autoLoginData.data.access_token;
              userData = autoLoginData.data.user || autoLoginData.data;
              console.log('[PDF-Lingua Auth] Tự động đăng nhập thành công.');
            } else {
              console.warn('[PDF-Lingua Auth] Tự động đăng nhập không thành công (status):', autoLoginRes.status);
            }
          } catch (autoLoginErr) {
            console.warn('[PDF-Lingua Auth] Lỗi kết nối khi tự động đăng nhập:', autoLoginErr);
          }
        }

        // Guarantee safe user structure merged with registration payload
        const resolvedUser = Object.assign(
          {},
          (userData && typeof userData === 'object' ? userData : {}),
          {
            email: (userData && userData.email) || payload.email || '',
            full_name: (userData && userData.full_name) || payload.full_name || '',
            role: (userData && userData.role) || 'free',
          }
        );

        if (accessToken) {
          // 1. Save session to localStorage & sessionStorage
          setStoredSession(accessToken, resolvedUser);

          // 2. Immediately update Header navigation
          updateHeaderAuthState(resolvedUser);

          // 3. User feedback
          const displayName = resolvedUser.full_name || resolvedUser.email || '';
          showRegisterAlert(
            displayName
              ? `Đăng ký tài khoản thành công! Xin chào, ${escapeHtml(displayName)}.`
              : 'Đăng ký tài khoản thành công! Đã đăng nhập.',
            'success'
          );

          if (typeof showToast === 'function') {
            try {
              showToast(`Chào mừng ${displayName}! Đăng ký & đăng nhập thành công.`, 'success');
            } catch (e) {}
          }

          if (form) form.reset();
          resetPasswordToggleView();
          keepLoading = true;

          // 4. Close modal and clean up
          setTimeout(() => {
            closeRegisterModal();
            setLoadingState(false);
          }, 500);
          return;
        }

        // Fallback if token could not be obtained: Keep form clean and inform user
        if (form) form.reset();
        resetPasswordToggleView();
        showRegisterAlert(
          'Đăng ký tài khoản thành công! Bạn có thể sử dụng tài khoản này để đăng nhập.',
          'success'
        );
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
      if (!keepLoading) {
        setLoadingState(false);
      }
    }

    function setLoadingState(loading, customText) {
      isSubmitting = loading;
      if (btnSubmit) {
        btnSubmit.disabled = loading;
      }
      if (spinner) {
        spinner.style.display = loading ? 'inline-block' : 'none';
      }
      if (btnText) {
        btnText.textContent = customText ? customText : (loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản');
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
        const tokenData = responseData && responseData.data ? responseData.data : null;
        const accessToken = tokenData && tokenData.access_token ? tokenData.access_token : null;
        const userData = tokenData && tokenData.user ? tokenData.user : null;

        if (!accessToken || !userData) {
          showLoginAlert('Phản hồi từ máy chủ không hợp lệ (thiếu token xác thực).', 'error');
          return;
        }

        // Save session in localStorage (never stores password or hash)
        setStoredSession(accessToken, userData);

        // Update header UI immediately
        updateHeaderAuthState(userData);

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

        setTimeout(() => {
          closeLoginModal();
        }, 1200);

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

  // ── Session & Auth State Management (PDFL-78.4) ──

  let inMemoryToken = null;
  let inMemoryUser = null;

  function getLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage;
      }
    } catch (e) {}
    return null;
  }

  function getSessionStorage() {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage;
      }
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage;
      }
    } catch (e) {}
    return null;
  }

  function getStoredToken() {
    if (inMemoryToken) return inMemoryToken;
    const storage = getLocalStorage();
    if (storage) {
      try {
        const val = storage.getItem('pdfl_token');
        if (val) return val;
      } catch (e) {}
    }
    const sess = getSessionStorage();
    if (sess) {
      try {
        const val = sess.getItem('pdfl_token');
        if (val) return val;
      } catch (e) {}
    }
    return null;
  }

  function getStoredUser() {
    if (inMemoryUser) return inMemoryUser;
    const storage = getLocalStorage();
    if (storage) {
      try {
        const data = storage.getItem('pdfl_user');
        if (data) return JSON.parse(data);
      } catch (e) {}
    }
    const sess = getSessionStorage();
    if (sess) {
      try {
        const data = sess.getItem('pdfl_user');
        if (data) return JSON.parse(data);
      } catch (e) {}
    }
    return null;
  }

  function setStoredSession(token, user) {
    inMemoryToken = token;
    inMemoryUser = user ? {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    } : null;

    const storage = getLocalStorage();
    if (storage) {
      try {
        storage.setItem('pdfl_token', token);
        if (user) {
          storage.setItem('pdfl_user', JSON.stringify(inMemoryUser));
        }
      } catch (e) {
        console.warn('[PDF-Lingua Auth] Không thể lưu vào localStorage:', e);
      }
    }

    const sess = getSessionStorage();
    if (sess) {
      try {
        sess.setItem('pdfl_token', token);
        if (user) {
          sess.setItem('pdfl_user', JSON.stringify(inMemoryUser));
        }
      } catch (e) {}
    }
  }

  function clearStoredSession() {
    inMemoryToken = null;
    inMemoryUser = null;

    const storage = getLocalStorage();
    if (storage) {
      try {
        storage.removeItem('pdfl_token');
        storage.removeItem('pdfl_user');
      } catch (e) {
        console.warn('[PDF-Lingua Auth] Không thể xóa localStorage:', e);
      }
    }

    const sess = getSessionStorage();
    if (sess) {
      try {
        sess.removeItem('pdfl_token');
        sess.removeItem('pdfl_user');
      } catch (e) {}
    }
  }

  function updateHeaderAuthState(user) {
    const guestGroup = document.getElementById('authGuestGroup');
    const userGroup = document.getElementById('authUserGroup');
    const displayNameEl = document.getElementById('userDisplayName');
    const userAvatarEl = document.getElementById('userAvatar');

    if (user && (user.full_name || user.email || user.id)) {
      if (guestGroup) {
        guestGroup.setAttribute('hidden', '');
        guestGroup.style.display = 'none';
        try {
          guestGroup.style.setProperty('display', 'none', 'important');
        } catch (e) {}
      }
      if (userGroup) {
        userGroup.removeAttribute('hidden');
        userGroup.style.display = 'flex';
        try {
          userGroup.style.setProperty('display', 'flex', 'important');
        } catch (e) {}
      }

      const name = user.full_name || user.email || 'Người dùng';
      if (displayNameEl) {
        displayNameEl.textContent = name;
      }
      if (userAvatarEl) {
        const initial = (user.full_name ? user.full_name.charAt(0) : (user.email ? user.email.charAt(0) : 'U')).toUpperCase();
        userAvatarEl.textContent = initial;
      }
    } else {
      if (guestGroup) {
        guestGroup.removeAttribute('hidden');
        guestGroup.style.display = 'flex';
        try {
          guestGroup.style.setProperty('display', 'flex', 'important');
        } catch (e) {}
      }
      if (userGroup) {
        userGroup.setAttribute('hidden', '');
        userGroup.style.display = 'none';
        try {
          userGroup.style.setProperty('display', 'none', 'important');
        } catch (e) {}
      }
      if (displayNameEl) {
        displayNameEl.textContent = '';
      }
      if (userAvatarEl) {
        userAvatarEl.textContent = '';
      }
    }

    // PDFL-81.4: Notify upload module to update role-based file limits
    if (typeof updateUploadLimitsUI === 'function') {
      try {
        updateUploadLimitsUI(user);
      } catch (e) {}
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('pdfl:auth-change', { detail: { user } }));
      } catch (e) {}
    }
  }

  function initAuthHeader() {
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
      });
    }
  }

  async function restoreSession() {
    if (isRestoringSession) return;

    const token = getStoredToken();
    const cachedUser = getStoredUser();

    if (!token) {
      updateHeaderAuthState(null);
      return;
    }

    // Show cached user optimistically if present
    if (cachedUser) {
      updateHeaderAuthState(cachedUser);
    }

    isRestoringSession = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (response.status === 200) {
        const resData = await response.json();
        const freshUser = resData && resData.data ? resData.data : null;
        if (freshUser) {
          setStoredSession(token, freshUser);
          updateHeaderAuthState(freshUser);
        }
      } else if (response.status === 401 || response.status === 403) {
        // Token expired, invalid or account inactive -> clear session
        clearStoredSession();
        updateHeaderAuthState(null);
      } else {
        // Other 5xx or server errors: do NOT clear token! Allow user to retry
        console.warn('[PDF-Lingua Auth] Máy chủ tạm thời không thể xác thực phiên:', response.status);
      }
    } catch (err) {
      // Network failure / offline: do NOT clear token! Keep cached user state
      console.warn('[PDF-Lingua Auth] Lỗi kết nối khi khôi phục phiên (giữ nguyên token):', err);
    } finally {
      isRestoringSession = false;
    }
  }

  async function handleLogout() {
    const btnLogout = document.getElementById('btnLogout');
    const token = getStoredToken();

    if (btnLogout) {
      btnLogout.disabled = true;
      btnLogout.textContent = 'Đang đăng xuất...';
    }

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
      }
    } catch (err) {
      console.warn('[PDF-Lingua Auth] Lỗi mạng khi gọi logout API (vẫn xóa phiên client):', err);
    } finally {
      clearStoredSession();
      updateHeaderAuthState(null);
      if (btnLogout) {
        btnLogout.disabled = false;
        btnLogout.textContent = 'Đăng xuất';
      }
      closeLoginModal();
      closeRegisterModal();
      closeAccountModal();
    }
  }

  // ── Account Info Modal (PDFL-79.2) ──

  function initAccountModal() {
    const accountModal = document.getElementById('accountModal');
    const btnOpenAccountModal = document.getElementById('btnOpenAccountModal');
    const btnCloseAccountModal = document.getElementById('btnCloseAccountModal');
    const btnCloseAccountModalBtn = document.getElementById('btnCloseAccountModalBtn');

    openAccountModal = function () {
      if (!accountModal) return;
      closeLoginModal();
      closeRegisterModal();
      accountModal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      clearAccountAlert();
      fetchAccountDetails();
    };

    closeAccountModal = function () {
      if (!accountModal) return;
      accountModal.setAttribute('hidden', '');
      document.body.style.overflow = '';
      clearAccountAlert();
      toggleAccountEditMode(false);
      toggleChangePasswordMode(false);
    };

    if (btnOpenAccountModal) {
      btnOpenAccountModal.addEventListener('click', (e) => {
        e.preventDefault();
        openAccountModal();
      });
    }

    if (btnCloseAccountModal) {
      btnCloseAccountModal.addEventListener('click', closeAccountModal);
    }

    if (btnCloseAccountModalBtn) {
      btnCloseAccountModalBtn.addEventListener('click', closeAccountModal);
    }

    if (accountModal) {
      accountModal.addEventListener('click', (e) => {
        if (e.target === accountModal) closeAccountModal();
      });
    }

    initAccountEditForm();
    initChangePasswordForm();
  }

  function toggleAccountEditMode(isEditing) {
    const viewWrap = document.getElementById('accountFullNameView');
    const editForm = document.getElementById('accountEditForm');
    const btnToggle = document.getElementById('btnToggleEditFullName');
    const input = document.getElementById('editFullNameInput');

    clearFieldError(input);

    if (isEditing) {
      if (viewWrap) viewWrap.style.display = 'none';
      if (editForm) editForm.style.display = 'block';
      if (btnToggle) btnToggle.style.display = 'none';
      if (input) {
        const user = getStoredUser();
        input.value = (user && user.full_name) ? user.full_name : '';
        input.focus();
      }
    } else {
      if (viewWrap) viewWrap.style.display = 'flex';
      if (editForm) editForm.style.display = 'none';
      if (btnToggle) btnToggle.style.display = 'inline-flex';
    }
  }

  function initAccountEditForm() {
    const btnToggle = document.getElementById('btnToggleEditFullName');
    const btnCancel = document.getElementById('btnCancelEditFullName');
    const form = document.getElementById('accountEditForm');
    const input = document.getElementById('editFullNameInput');

    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        clearAccountAlert();
        toggleAccountEditMode(true);
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        clearAccountAlert();
        toggleAccountEditMode(false);
      });
    }

    if (input) {
      input.addEventListener('input', () => {
        clearFieldError(input);
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSaveFullName();
      });
    }
  }

  async function handleSaveFullName() {
    const input = document.getElementById('editFullNameInput');
    const btnSave = document.getElementById('btnSaveFullName');
    const btnCancel = document.getElementById('btnCancelEditFullName');
    const spinner = document.getElementById('editFullNameSpinner');
    const btnText = document.getElementById('editFullNameBtnText');

    if (!input) return;

    clearAccountAlert();
    clearFieldError(input);

    const val = input.value;
    if (val.length > 150) {
      showFieldError(input, 'Họ và tên không được vượt quá 150 ký tự.');
      input.focus();
      return;
    }

    const token = getStoredToken();
    if (!token) {
      showAccountAlert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
      return;
    }

    setSavingState(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          full_name: val.trim() === '' ? null : val.trim(),
        }),
      });

      let resData = null;
      try {
        resData = await response.json();
      } catch (e) {}

      if (response.status === 200) {
        const updatedUser = resData && resData.data ? resData.data : null;
        if (updatedUser) {
          setStoredSession(token, updatedUser);
          updateHeaderAuthState(updatedUser);
          renderAccountDetails(updatedUser);
        }
        toggleAccountEditMode(false);
        showAccountAlert('Cập nhật thông tin tài khoản thành công!', 'success');
      } else if (response.status === 401 || response.status === 403) {
        clearStoredSession();
        updateHeaderAuthState(null);
        toggleAccountEditMode(false);
        const card = document.getElementById('accountInfoContent');
        if (card) card.style.display = 'none';
        showAccountAlert('Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.', 'error');
      } else if (response.status === 422) {
        const details = resData && resData.details;
        let msg = (resData && resData.message) ? resData.message : 'Dữ liệu không hợp lệ.';
        if (Array.isArray(details) && details.length > 0) {
          msg = details[0].message || details[0].msg || msg;
        }
        showFieldError(input, msg);
        showAccountAlert(msg, 'error');
        input.focus();
      } else {
        const errorMsg = (resData && resData.message)
          ? resData.message
          : 'Không thể cập nhật thông tin lúc này. Vui lòng thử lại sau.';
        showAccountAlert(errorMsg, 'error');
      }
    } catch (networkError) {
      console.warn('[PDF-Lingua Auth Update Error]', networkError);
      showAccountAlert('Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền.', 'error');
    } finally {
      setSavingState(false);
    }

    function setSavingState(saving) {
      if (btnSave) btnSave.disabled = saving;
      if (btnCancel) btnCancel.disabled = saving;
      if (spinner) spinner.style.display = saving ? 'inline-block' : 'none';
      if (btnText) btnText.textContent = saving ? 'Đang lưu...' : 'Lưu';
    }
  }

  // ── Change Password Logic (PDFL-80.4) ──

  let isSubmittingPassword = false;

  function showChangePasswordAlert(message, type = 'error') {
    showAlertInElement('changePasswordAlert', message, type);
  }

  function clearChangePasswordAlert() {
    clearAlertInElement('changePasswordAlert');
  }

  function resetChangePasswordToggles() {
    ['currentPasswordInput', 'newPasswordInput', 'confirmNewPasswordInput'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.type = 'password';
    });
    document.querySelectorAll('#changePasswordForm .btn-toggle-eye').forEach((btn) => {
      const open = btn.querySelector('.eye-open');
      const closed = btn.querySelector('.eye-closed');
      if (open) open.style.display = 'block';
      if (closed) closed.style.display = 'none';
      btn.setAttribute('aria-label', 'Hiện mật khẩu');
    });
  }

  function validateChangePasswordForm(elements) {
    const { currentPasswordInput, newPasswordInput, confirmNewPasswordInput } = elements;
    let isValid = true;
    let firstInvalidInput = null;

    const currentVal = currentPasswordInput ? currentPasswordInput.value : '';
    const newVal = newPasswordInput ? newPasswordInput.value : '';
    const confirmVal = confirmNewPasswordInput ? confirmNewPasswordInput.value : '';

    // 1. Current password
    if (!currentVal) {
      showFieldError(currentPasswordInput, 'Vui lòng nhập mật khẩu hiện tại.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || currentPasswordInput;
    }

    // 2. New password
    if (!newVal) {
      showFieldError(newPasswordInput, 'Vui lòng nhập mật khẩu mới.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || newPasswordInput;
    } else if (newVal.length < 8) {
      showFieldError(newPasswordInput, 'Mật khẩu mới phải có tối thiểu 8 ký tự.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || newPasswordInput;
    } else if (newVal.length > 128) {
      showFieldError(newPasswordInput, 'Mật khẩu mới không được vượt quá 128 ký tự.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || newPasswordInput;
    } else if (!/[a-zA-Z]/.test(newVal)) {
      showFieldError(newPasswordInput, 'Mật khẩu mới phải chứa ít nhất một chữ cái.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || newPasswordInput;
    } else if (!/\d/.test(newVal)) {
      showFieldError(newPasswordInput, 'Mật khẩu mới phải chứa ít nhất một chữ số.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || newPasswordInput;
    } else if (currentVal && newVal === currentVal) {
      showFieldError(newPasswordInput, 'Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || newPasswordInput;
    }

    // 3. Confirm new password
    if (!confirmVal) {
      showFieldError(confirmNewPasswordInput, 'Vui lòng xác nhận mật khẩu mới.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || confirmNewPasswordInput;
    } else if (newVal && confirmVal !== newVal) {
      showFieldError(confirmNewPasswordInput, 'Mật khẩu xác nhận không khớp với mật khẩu mới.');
      isValid = false;
      firstInvalidInput = firstInvalidInput || confirmNewPasswordInput;
    }

    if (firstInvalidInput && typeof firstInvalidInput.focus === 'function') {
      firstInvalidInput.focus();
    }

    return isValid;
  }

  function toggleChangePasswordMode(isEditing) {
    const form = document.getElementById('changePasswordForm');
    const btnToggle = document.getElementById('btnToggleChangePassword');
    const toggleText = document.getElementById('toggleChangePasswordText');
    const currentInput = document.getElementById('currentPasswordInput');
    const newInput = document.getElementById('newPasswordInput');
    const confirmInput = document.getElementById('confirmNewPasswordInput');

    clearChangePasswordAlert();
    [currentInput, newInput, confirmInput].forEach((input) => {
      if (input) clearFieldError(input);
    });

    if (isEditing) {
      if (form) form.style.display = 'flex';
      if (btnToggle) {
        btnToggle.setAttribute('aria-expanded', 'true');
        btnToggle.style.display = 'none';
      }
      if (currentInput && typeof currentInput.focus === 'function') {
        currentInput.focus();
      }
    } else {
      if (form) {
        form.reset();
        form.style.display = 'none';
      }
      resetChangePasswordToggles();
      if (btnToggle) {
        btnToggle.setAttribute('aria-expanded', 'false');
        btnToggle.style.display = 'inline-flex';
      }
      if (toggleText) {
        toggleText.textContent = 'Đổi mật khẩu';
      }
    }
  }

  function initChangePasswordForm() {
    const btnToggle = document.getElementById('btnToggleChangePassword');
    const btnCancel = document.getElementById('btnCancelChangePassword');
    const form = document.getElementById('changePasswordForm');
    const currentInput = document.getElementById('currentPasswordInput');
    const newInput = document.getElementById('newPasswordInput');
    const confirmInput = document.getElementById('confirmNewPasswordInput');

    if (btnToggle) {
      btnToggle.addEventListener('click', (e) => {
        e.preventDefault();
        clearAccountAlert();
        toggleChangePasswordMode(true);
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', (e) => {
        e.preventDefault();
        clearChangePasswordAlert();
        toggleChangePasswordMode(false);
      });
    }

    [currentInput, newInput, confirmInput].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        clearFieldError(input);
      });
    });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleChangePasswordSubmit();
      });
    }
  }

  async function handleChangePasswordSubmit() {
    if (isSubmittingPassword) return;

    const currentPasswordInput = document.getElementById('currentPasswordInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const confirmNewPasswordInput = document.getElementById('confirmNewPasswordInput');
    const form = document.getElementById('changePasswordForm');
    const btnSubmit = document.getElementById('btnSubmitChangePassword');
    const btnCancel = document.getElementById('btnCancelChangePassword');
    const spinner = document.getElementById('changePasswordSpinner');
    const btnText = document.getElementById('changePasswordBtnText');

    clearChangePasswordAlert();
    [currentPasswordInput, newPasswordInput, confirmNewPasswordInput].forEach((input) => {
      if (input) clearFieldError(input);
    });

    const isValid = validateChangePasswordForm({
      currentPasswordInput,
      newPasswordInput,
      confirmNewPasswordInput,
    });
    if (!isValid) return;

    const token = getStoredToken();
    if (!token) {
      showChangePasswordAlert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPasswordInput.value,
          new_password: newPasswordInput.value,
        }),
      });

      let responseData = null;
      try {
        responseData = await response.json();
      } catch (e) {}

      if (response.status === 200) {
        showChangePasswordAlert('Đổi mật khẩu thành công!', 'success');
        showAccountAlert('Đổi mật khẩu thành công!', 'success');
        if (form) form.reset();
        resetChangePasswordToggles();
        setTimeout(() => {
          toggleChangePasswordMode(false);
        }, 1200);
      } else if (response.status === 400) {
        const errCode = responseData && responseData.error_code;
        if (errCode === 'INCORRECT_CURRENT_PASSWORD') {
          showFieldError(currentPasswordInput, 'Mật khẩu hiện tại không chính xác.');
          showChangePasswordAlert('Mật khẩu hiện tại không chính xác.', 'error');
          if (currentPasswordInput && typeof currentPasswordInput.focus === 'function') {
            currentPasswordInput.focus();
          }
        } else if (errCode === 'PASSWORD_SAME_AS_OLD') {
          showFieldError(newPasswordInput, 'Mật khẩu mới không được trùng với mật khẩu hiện tại.');
          showChangePasswordAlert('Mật khẩu mới không được trùng với mật khẩu hiện tại.', 'error');
          if (newPasswordInput && typeof newPasswordInput.focus === 'function') {
            newPasswordInput.focus();
          }
        } else {
          const msg = (responseData && responseData.message)
            ? responseData.message
            : 'Yêu cầu đổi mật khẩu không hợp lệ.';
          showChangePasswordAlert(msg, 'error');
        }
      } else if (response.status === 401 || response.status === 403) {
        clearStoredSession();
        updateHeaderAuthState(null);
        toggleChangePasswordMode(false);
        const card = document.getElementById('accountInfoContent');
        if (card) card.style.display = 'none';
        showAccountAlert('Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.', 'error');
      } else if (response.status === 422) {
        let msg = (responseData && responseData.message)
          ? responseData.message
          : 'Dữ liệu mật khẩu không hợp lệ.';
        if (responseData && Array.isArray(responseData.details) && responseData.details.length > 0) {
          const firstDetail = responseData.details[0];
          msg = firstDetail.message || firstDetail.msg || msg;
        }
        showChangePasswordAlert(msg, 'error');
      } else {
        showChangePasswordAlert(
          'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau giây lát.',
          'error'
        );
      }
    } catch (networkError) {
      console.warn('[PDF-Lingua Change Password Error]', networkError);
      showChangePasswordAlert(
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }

    function setSubmitting(loading) {
      isSubmittingPassword = loading;
      if (btnSubmit) btnSubmit.disabled = loading;
      if (btnCancel) btnCancel.disabled = loading;
      if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
      if (btnText) btnText.textContent = loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu';
    }
  }

  function showAccountAlert(message, type = 'error') {
    const alertBox = document.getElementById('accountAlert');
    if (!alertBox) return;
    alertBox.className = `form-alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.style.display = 'block';
  }

  function clearAccountAlert() {
    const alertBox = document.getElementById('accountAlert');
    if (!alertBox) return;
    alertBox.style.display = 'none';
    alertBox.textContent = '';
    alertBox.className = 'form-alert';
  }

  function renderAccountDetails(user) {
    if (!user) return;
    const fullNameDisplay = document.getElementById('accountFullNameDisplay');
    const emailSubDisplay = document.getElementById('accountEmailSubDisplay');
    const avatarLarge = document.getElementById('accountAvatarLarge');
    const detailFullName = document.getElementById('accountDetailFullName');
    const detailEmail = document.getElementById('accountDetailEmail');
    const detailRole = document.getElementById('accountDetailRole');
    const detailStatus = document.getElementById('accountDetailStatus');

    const name = user.full_name || 'Chưa đặt tên';
    const email = user.email || '';
    const initial = (user.full_name ? user.full_name.charAt(0) : email.charAt(0) || 'U').toUpperCase();

    if (fullNameDisplay) fullNameDisplay.textContent = name;
    if (emailSubDisplay) emailSubDisplay.textContent = email;
    if (avatarLarge) avatarLarge.textContent = initial;
    if (detailFullName) detailFullName.textContent = name;
    if (detailEmail) detailEmail.textContent = email;

    if (detailRole) {
      const roleStr = (user.role || 'free').toLowerCase();
      detailRole.textContent = roleStr.toUpperCase();
      detailRole.className = `badge-role role-${roleStr}`;
    }

    if (detailStatus) {
      if (user.is_active === false) {
        detailStatus.textContent = 'Bị vô hiệu';
        detailStatus.style.backgroundColor = '#FEE2E2';
        detailStatus.style.color = '#DC2626';
      } else {
        detailStatus.textContent = 'Hoạt động';
        detailStatus.style.backgroundColor = '';
        detailStatus.style.color = '';
      }
    }
  }

  async function fetchAccountDetails() {
    const loadingWrap = document.getElementById('accountLoading');
    const contentCard = document.getElementById('accountInfoContent');
    const token = getStoredToken();
    const cachedUser = getStoredUser();

    // Optimistically render cached user if available
    if (cachedUser) {
      renderAccountDetails(cachedUser);
    }

    if (!token) {
      if (contentCard) contentCard.style.display = 'none';
      if (loadingWrap) loadingWrap.style.display = 'none';
      showAccountAlert('Bạn chưa đăng nhập. Vui lòng đăng nhập lại.', 'error');
      updateHeaderAuthState(null);
      return;
    }

    if (loadingWrap && !cachedUser) loadingWrap.style.display = 'flex';
    if (contentCard && !cachedUser) contentCard.style.display = 'none';

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      let resData = null;
      try {
        resData = await response.json();
      } catch (e) {}

      if (response.status === 200) {
        const freshUser = resData && resData.data ? resData.data : null;
        if (freshUser) {
          setStoredSession(token, freshUser);
          updateHeaderAuthState(freshUser);
          renderAccountDetails(freshUser);
          if (contentCard) contentCard.style.display = 'block';
        }
      } else if (response.status === 401 || response.status === 403) {
        // Token expired, invalid or account inactive
        clearStoredSession();
        updateHeaderAuthState(null);
        if (contentCard) contentCard.style.display = 'none';
        showAccountAlert('Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.', 'error');
      } else {
        showAccountAlert('Không thể tải thông tin tài khoản từ máy chủ. Vui lòng thử lại sau.', 'error');
      }
    } catch (err) {
      console.warn('[PDF-Lingua Auth] Lỗi mạng khi gọi /api/auth/me:', err);
      if (!cachedUser) {
        if (contentCard) contentCard.style.display = 'none';
        showAccountAlert('Lỗi kết nối tới máy chủ. Vui lòng kiểm tra đường truyền.', 'error');
      }
    } finally {
      if (loadingWrap) loadingWrap.style.display = 'none';
      if (cachedUser && contentCard) contentCard.style.display = 'block';
    }
  }

  async function authFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, Object.assign({}, options, { headers }));
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
    getStoredToken,
    getStoredUser,
    setStoredSession,
    clearStoredSession,
    updateHeaderAuthState,
    restoreSession,
    handleLogout,
    authFetch,
    openLoginModal,
    closeLoginModal,
    openRegisterModal,
    closeRegisterModal,
    openAccountModal,
    closeAccountModal,
    fetchAccountDetails,
    renderAccountDetails,
    toggleAccountEditMode,
    handleSaveFullName,
    showChangePasswordAlert,
    clearChangePasswordAlert,
    resetChangePasswordToggles,
    validateChangePasswordForm,
    toggleChangePasswordMode,
    handleChangePasswordSubmit,
  });
})();
