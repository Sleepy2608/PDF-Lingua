/**
 * PDF-Lingua: Authentication & Registration Module
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

  function openAccountModal() {
    const accountModal = document.getElementById('accountModal');
    if (!accountModal) return;
    closeLoginModal();
    closeRegisterModal();
    accountModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    clearAccountAlert();
    fetchAccountDetails();
  }

  function closeAccountModal() {
    const accountModal = document.getElementById('accountModal');
    if (!accountModal) return;
    accountModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    clearAccountAlert();
    toggleAccountEditMode(false);
    toggleChangePasswordMode(false);
    toggleAccountAvatarDeleteConfirm(false);
  }

  function openRegisterModal() {
    closeLoginModal();
    const registerModal = document.getElementById('registerModal');
    resetRegisterModalState();
    clearAllFieldErrors();
    if (!registerModal) return;
    registerModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    const firstInput = document.getElementById('regFullName');
    if (firstInput && typeof firstInput.focus === 'function') {
      setTimeout(() => firstInput.focus(), 50);
    }
  }

  function closeRegisterModal() {
    const registerModal = document.getElementById('registerModal');
    resetRegisterModalState();
    if (!registerModal) return;
    registerModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function openLoginModal() {
    closeRegisterModal();
    const loginModal = document.getElementById('loginModal');
    resetLoginModalState();
    if (!loginModal) return;
    loginModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    const emailInput = document.getElementById('loginEmail');
    if (emailInput && typeof emailInput.focus === 'function') {
      setTimeout(() => emailInput.focus(), 50);
    }
  }

  function closeLoginModal() {
    const loginModal = document.getElementById('loginModal');
    resetLoginModalState();
    if (!loginModal) return;
    loginModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    initAuthModals();
    initPasswordToggles();
    initRegistrationForm();
    initLoginForm();
    initAuthHeader();
    initAccountModal();
    initAvatarCropModal();
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
      showUpgradeModal,
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
  //  LOGIN
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
        // Invalid credentials (wrong email or password: same message for anti-enumeration)
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

  function clearRegisterFieldErrors() {
    ['regFullName', 'regEmail', 'regPassword', 'regConfirmPassword'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) clearFieldError(input);
    });
  }

  function clearLoginFieldErrors() {
    ['loginEmail', 'loginPassword'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) clearFieldError(input);
    });
  }

  function resetRegisterModalState() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm && typeof registerForm.reset === 'function') {
      registerForm.reset();
    }
    ['regFullName', 'regEmail', 'regPassword', 'regConfirmPassword'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });
    clearRegisterAlert();
    clearRegisterFieldErrors();
    resetPasswordToggleView();
  }

  function resetLoginModalState() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm && typeof loginForm.reset === 'function') {
      loginForm.reset();
    }
    ['loginEmail', 'loginPassword'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });
    clearLoginAlert();
    clearLoginFieldErrors();
    resetLoginPasswordToggle();
  }

  /**
   * Alert helpers: scoped to the correct modal
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
  function resetEyeToggleBtn(btn, defaultLabel = 'Hiện mật khẩu') {
    if (!btn) return;
    const open = typeof btn.querySelector === 'function' ? btn.querySelector('.eye-open') : null;
    const closed = typeof btn.querySelector === 'function' ? btn.querySelector('.eye-closed') : null;
    if (open) open.style.display = 'block';
    if (closed) closed.style.display = 'none';
    if (typeof btn.setAttribute === 'function') {
      btn.setAttribute('aria-label', defaultLabel);
    }
  }

  function resetPasswordToggleView() {
    const pwdInput = document.getElementById('regPassword');
    const confirmInput = document.getElementById('regConfirmPassword');
    if (pwdInput) pwdInput.type = 'password';
    if (confirmInput) confirmInput.type = 'password';

    resetEyeToggleBtn(document.getElementById('toggleRegPassword'), 'Hiện mật khẩu');
    resetEyeToggleBtn(document.getElementById('toggleRegConfirmPassword'), 'Hiện mật khẩu xác nhận');

    document.querySelectorAll('#registerModal .btn-toggle-eye').forEach((btn) => {
      const label = btn.id === 'toggleRegConfirmPassword' ? 'Hiện mật khẩu xác nhận' : 'Hiện mật khẩu';
      resetEyeToggleBtn(btn, label);
    });
  }

  function resetLoginPasswordToggle() {
    const loginPwd = document.getElementById('loginPassword');
    if (loginPwd) loginPwd.type = 'password';

    resetEyeToggleBtn(document.getElementById('toggleLoginPassword'), 'Hiện mật khẩu');

    document.querySelectorAll('#loginModal .btn-toggle-eye').forEach((btn) => {
      resetEyeToggleBtn(btn, 'Hiện mật khẩu');
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

  // ── Session & Auth State Management ──

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
      avatar_url: user.avatar_url !== undefined ? user.avatar_url : null,
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
        if (user.avatar_url) {
          userAvatarEl.innerHTML = `<img src="${user.avatar_url}" alt="Avatar" class="header-user-avatar-img">`;
        } else {
          const initial = (user.full_name ? user.full_name.charAt(0) : (user.email ? user.email.charAt(0) : 'U')).toUpperCase();
          userAvatarEl.textContent = initial;
        }
      }

      // Update Admin badge indicator visibility in header
      const btnOpenAdmin = document.getElementById('btnOpenAdmin');
      const isAdmin = !!(user && user.role === 'admin');
      if (btnOpenAdmin) {
        btnOpenAdmin.style.display = isAdmin ? 'inline-flex' : 'none';
      }
    } else {
      // Hide admin indicator on logout or guest state
      const btnOpenAdmin = document.getElementById('btnOpenAdmin');
      if (btnOpenAdmin) btnOpenAdmin.style.display = 'none';

      // If admin section was visible, return to default view
      const adminSec = document.getElementById('adminSection');
      if (adminSec && adminSec.style.display !== 'none') {
        adminSec.style.display = 'none';
        const heroSec = document.getElementById('heroSection');
        if (heroSec) heroSec.style.display = '';
      }

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

    // Notify upload module to update role-based file limits
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

  // ── Account Info Modal ──

  function initAccountModal() {
    const accountModal = document.getElementById('accountModal');
    const btnOpenAccountModal = document.getElementById('btnOpenAccountModal');
    const btnCloseAccountModal = document.getElementById('btnCloseAccountModal');
    const btnCloseAccountModalBtn = document.getElementById('btnCloseAccountModalBtn');

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
    initAccountAvatar();
  }

  // ── Account Avatar Interactive Controls ──

  function initAccountAvatar() {
    const btnSelectAvatar = document.getElementById('btnSelectAvatar');
    const btnTriggerAvatarUpload = document.getElementById('btnTriggerAvatarUpload');
    const avatarFileInput = document.getElementById('avatarFileInput');
    const btnDeleteAvatar = document.getElementById('btnDeleteAvatar');
    const avatarDeleteConfirmBox = document.getElementById('avatarDeleteConfirmBox');
    const btnCancelDeleteAvatar = document.getElementById('btnCancelDeleteAvatar');
    const btnConfirmDeleteAvatar = document.getElementById('btnConfirmDeleteAvatar');
    const accountAvatarImg = document.getElementById('accountAvatarImg');

    if (accountAvatarImg && !accountAvatarImg.src) {
      accountAvatarImg.style.display = 'none';
    }

    if (btnSelectAvatar) {
      btnSelectAvatar.addEventListener('click', () => {
        if (avatarFileInput) avatarFileInput.click();
      });
      btnSelectAvatar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (avatarFileInput) avatarFileInput.click();
        }
      });
    }

    if (btnTriggerAvatarUpload) {
      btnTriggerAvatarUpload.addEventListener('click', () => {
        if (avatarFileInput) avatarFileInput.click();
      });
    }

    if (avatarFileInput) {
      avatarFileInput.addEventListener('change', handleAvatarFileSelection);
    }

    if (btnDeleteAvatar) {
      btnDeleteAvatar.addEventListener('click', () => {
        toggleAccountAvatarDeleteConfirm(true);
      });
    }

    if (btnCancelDeleteAvatar) {
      btnCancelDeleteAvatar.addEventListener('click', () => {
        toggleAccountAvatarDeleteConfirm(false);
      });
    }

    if (btnConfirmDeleteAvatar) {
      btnConfirmDeleteAvatar.addEventListener('click', handleConfirmDeleteAvatar);
    }

    if (avatarDeleteConfirmBox) {
      avatarDeleteConfirmBox.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          toggleAccountAvatarDeleteConfirm(false);
          if (btnDeleteAvatar && typeof btnDeleteAvatar.focus === 'function') {
            btnDeleteAvatar.focus();
          }
        }
      });
    }
  }

  function toggleAccountAvatarDeleteConfirm(isOpen) {
    const confirmBox = document.getElementById('avatarDeleteConfirmBox');
    if (!confirmBox) return;
    confirmBox.style.display = isOpen ? 'flex' : 'none';
    if (isOpen) {
      const cancelBtn = document.getElementById('btnCancelDeleteAvatar');
      if (cancelBtn && typeof cancelBtn.focus === 'function') {
        cancelBtn.focus();
      }
    }
  }

  function handleAvatarFileSelection(e) {
    const input = (e && e.target) ? e.target : document.getElementById('avatarFileInput');
    if (!input || !input.files || !input.files[0]) return;

    const file = input.files[0];
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const fileName = (file.name || '').toLowerCase();
    const hasValidExt = /\.(jpe?g|png|webp)$/i.test(fileName);
    const hasValidMime = allowedMimes.includes((file.type || '').toLowerCase());

    if (!hasValidMime && !hasValidExt) {
      showAccountAlert('Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.', 'error');
      input.value = '';
      return;
    }

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showAccountAlert('Kích thước tệp ảnh vượt quá giới hạn tối đa cho phép (2 MB).', 'error');
      input.value = '';
      return;
    }

    clearAccountAlert();

    const cropModal = document.getElementById('avatarCropModal');
    if (cropModal) {
      openAvatarCropModal(file);
    } else {
      let previewUrl = '';
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        try {
          previewUrl = URL.createObjectURL(file);
        } catch (_err) {}
      }

      if (previewUrl) {
        applyAvatarPreview(previewUrl);
      } else if (typeof FileReader !== 'undefined') {
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          applyAvatarPreview(loadEvent.target && loadEvent.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        applyAvatarPreview('');
      }
    }
  }

  let isUploadingAvatar = false;
  let isDeletingAvatar = false;
  let activeAvatarPreviewObjectUrl = null;

  function revokeActiveAvatarPreview() {
    if (activeAvatarPreviewObjectUrl) {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        try {
          URL.revokeObjectURL(activeAvatarPreviewObjectUrl);
        } catch (_e) {}
      }
      activeAvatarPreviewObjectUrl = null;
    }
  }

  function revokeTempCropUrl() {
    if (cropState.tempObjectUrl) {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        try {
          URL.revokeObjectURL(cropState.tempObjectUrl);
        } catch (_e) {}
      }
      cropState.tempObjectUrl = null;
    }
  }

  function applyAvatarPreview(srcUrl) {
    if (srcUrl && srcUrl !== activeAvatarPreviewObjectUrl) {
      revokeActiveAvatarPreview();
      if (typeof srcUrl === 'string' && srcUrl.startsWith('blob:')) {
        activeAvatarPreviewObjectUrl = srcUrl;
      }
    }

    const avatarImg = document.getElementById('accountAvatarImg');
    const avatarInitial = document.getElementById('accountAvatarInitial');
    const btnDelete = document.getElementById('btnDeleteAvatar');
    const confirmBox = document.getElementById('avatarDeleteConfirmBox');

    if (avatarImg) {
      avatarImg.src = srcUrl || '';
      avatarImg.style.display = 'block';
    }
    if (avatarInitial) {
      avatarInitial.style.display = 'none';
    }
    if (btnDelete) {
      btnDelete.style.display = 'inline-flex';
    }
    if (confirmBox) {
      confirmBox.style.display = 'none';
    }
  }

  async function handleConfirmDeleteAvatar() {
    if (isDeletingAvatar) return false;

    const token = getStoredToken();
    if (!token) {
      showAccountAlert('Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.', 'error');
      toggleAccountAvatarDeleteConfirm(false);
      return false;
    }

    const confirmBtn = document.getElementById('btnConfirmDeleteAvatar');
    const cancelBtn = document.getElementById('btnCancelDeleteAvatar');
    const originalBtnText = (confirmBtn && confirmBtn.textContent && confirmBtn.textContent.trim())
      ? confirmBtn.textContent
      : 'Gỡ ảnh';

    try {
      isDeletingAvatar = true;
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Đang xóa...';
      }
      if (cancelBtn) {
        cancelBtn.disabled = true;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      let resData = null;
      try {
        resData = await response.json();
      } catch (_e) {}

      if (response.status === 200) {
        revokeActiveAvatarPreview();

        const avatarImg = document.getElementById('accountAvatarImg');
        const avatarInitial = document.getElementById('accountAvatarInitial');
        const btnDelete = document.getElementById('btnDeleteAvatar');
        const input = document.getElementById('avatarFileInput');

        if (avatarImg) {
          avatarImg.src = '';
          avatarImg.style.display = 'none';
        }
        if (avatarInitial) {
          avatarInitial.style.display = 'inline-block';
        }
        if (btnDelete) {
          btnDelete.style.display = 'none';
        }
        if (input) {
          input.value = '';
        }
        toggleAccountAvatarDeleteConfirm(false);

        const user = getStoredUser();
        if (user) {
          user.avatar_url = null;
          setStoredSession(token, user);
        }

        showAccountAlert('Đã xóa ảnh đại diện thành công.', 'success');
        return true;
      } else if (response.status === 400) {
        const msg = (resData && resData.message) || 'Tài khoản chưa thiết lập ảnh đại diện để xóa.';
        showAccountAlert(msg, 'error');
        toggleAccountAvatarDeleteConfirm(false);
        return false;
      } else if (response.status === 401) {
        clearStoredSession();
        updateHeaderAuthState(null);
        toggleAccountAvatarDeleteConfirm(false);
        showAccountAlert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        return false;
      } else if (response.status === 403) {
        toggleAccountAvatarDeleteConfirm(false);
        const msg = (resData && (resData.message || (typeof resData.detail === 'string' ? resData.detail : null)))
          || 'Bạn không có quyền xóa ảnh đại diện này.';
        showAccountAlert(msg, 'error');
        return false;
      } else {
        const msg = (resData && resData.message) || 'Máy chủ gặp sự cố khi xóa ảnh đại diện. Vui lòng thử lại sau.';
        showAccountAlert(msg, 'error');
        return false;
      }
    } catch (networkError) {
      console.warn('[PDF-Lingua Delete Avatar Error]', networkError);
      showAccountAlert('Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng.', 'error');
      return false;
    } finally {
      isDeletingAvatar = false;
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalBtnText;
      }
      if (cancelBtn) {
        cancelBtn.disabled = false;
      }
    }
  }

  // ── Avatar Image Cropping & Canvas Processing ──

  let cropState = {
    isOpen: false,
    originalFile: null,
    naturalWidth: 0,
    naturalHeight: 0,
    scaleBase: 1,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    viewportSize: 320,
    cropDiameter: 240,
    croppedBlob: null,
    croppedFile: null,
  };

  function initAvatarCropModal() {
    const modal = document.getElementById('avatarCropModal');
    const closeBtn = document.getElementById('btnCloseAvatarCropModal');
    const cancelBtn = document.getElementById('btnCancelAvatarCrop');
    const confirmBtn = document.getElementById('btnConfirmAvatarCrop');
    const viewport = document.getElementById('avatarCropViewport');
    const zoomRange = document.getElementById('cropZoomRange');
    const zoomInBtn = document.getElementById('btnCropZoomIn');
    const zoomOutBtn = document.getElementById('btnCropZoomOut');
    const cropImg = document.getElementById('avatarCropImg');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeAvatarCropModal(false));
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => closeAvatarCropModal(false));
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', confirmAvatarCrop);
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAvatarCropModal(false);
      });
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAvatarCropModal(false);
      });
    }

    if (zoomRange) {
      zoomRange.addEventListener('input', (e) => {
        setCropZoom(parseFloat(e.target.value));
      });
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        setCropZoom(cropState.zoom + 0.1);
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        setCropZoom(cropState.zoom - 0.1);
      });
    }

    if (viewport) {
      viewport.addEventListener('pointerdown', handleCropPointerDown);
      viewport.addEventListener('pointermove', handleCropPointerMove);
      viewport.addEventListener('pointerup', handleCropPointerUp);
      viewport.addEventListener('pointercancel', handleCropPointerUp);
      viewport.addEventListener('wheel', handleCropWheel, { passive: false });
      viewport.addEventListener('keydown', handleCropKeydown);
    }

    if (cropImg) {
      cropImg.addEventListener('load', handleCropImageLoad);
      cropImg.addEventListener('error', handleCropImageError);
    }
  }

  function openAvatarCropModal(file) {
    const modal = document.getElementById('avatarCropModal');
    const cropImg = document.getElementById('avatarCropImg');
    const zoomRange = document.getElementById('cropZoomRange');
    const zoomVal = document.getElementById('cropZoomValue');
    const confirmBtn = document.getElementById('btnConfirmAvatarCrop');

    if (!modal || !cropImg) return;

    clearCropAlert();
    cropState.isOpen = true;
    cropState.originalFile = file;
    cropState.zoom = 1;
    cropState.offsetX = 0;
    cropState.offsetY = 0;
    cropState.isDragging = false;
    cropState.croppedBlob = null;
    cropState.croppedFile = null;

    if (zoomRange) zoomRange.value = '1';
    if (zoomVal) zoomVal.textContent = '100%';
    if (confirmBtn) confirmBtn.disabled = false;

    let objectUrl = '';
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      try {
        objectUrl = URL.createObjectURL(file);
      } catch (_e) {}
    }

    revokeTempCropUrl();
    cropState.tempObjectUrl = objectUrl;

    if (objectUrl) {
      cropImg.src = objectUrl;
    } else if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        cropImg.src = (loadEvent.target && loadEvent.target.result) || '';
      };
      reader.readAsDataURL(file);
    }

    modal.removeAttribute('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    syncViewportDimensions();

    const viewport = document.getElementById('avatarCropViewport');
    if (viewport && typeof viewport.focus === 'function') {
      setTimeout(() => viewport.focus(), 50);
    }
  }

  function syncViewportDimensions() {
    const viewport = document.getElementById('avatarCropViewport');
    if (viewport && viewport.clientWidth) {
      cropState.viewportSize = viewport.clientWidth;
      const mask = viewport.querySelector ? viewport.querySelector('.avatar-crop-mask') : null;
      if (mask && mask.clientWidth) {
        cropState.cropDiameter = mask.clientWidth;
      } else {
        cropState.cropDiameter = Math.round(cropState.viewportSize * 0.75);
      }
    } else {
      cropState.viewportSize = 320;
      cropState.cropDiameter = 240;
    }
  }

  function handleCropImageLoad() {
    const cropImg = document.getElementById('avatarCropImg');
    if (!cropImg) return;

    const natW = (cropImg.naturalWidth !== undefined) ? cropImg.naturalWidth : (cropImg.width || 0);
    const natH = (cropImg.naturalHeight !== undefined) ? cropImg.naturalHeight : (cropImg.height || 0);

    if (natW <= 0 || natH <= 0) {
      showCropAlert('Không thể đọc kích thước tệp ảnh đã chọn.', 'error');
      const confirmBtn = document.getElementById('btnConfirmAvatarCrop');
      if (confirmBtn) confirmBtn.disabled = true;
      return;
    }

    cropState.naturalWidth = natW;
    cropState.naturalHeight = natH;

    syncViewportDimensions();

    cropState.scaleBase = Math.max(
      cropState.cropDiameter / natW,
      cropState.cropDiameter / natH
    );
    cropState.zoom = 1;
    cropState.offsetX = 0;
    cropState.offsetY = 0;

    updateCropDisplay();
  }

  function handleCropImageError() {
    showCropAlert('Không thể tải hoặc xử lý tệp ảnh này. Vui lòng chọn tệp khác.', 'error');
    const confirmBtn = document.getElementById('btnConfirmAvatarCrop');
    if (confirmBtn) confirmBtn.disabled = true;
  }

  function updateCropDisplay() {
    const cropImg = document.getElementById('avatarCropImg');
    const zoomVal = document.getElementById('cropZoomValue');
    const zoomRange = document.getElementById('cropZoomRange');

    if (!cropImg || !cropState.naturalWidth || !cropState.naturalHeight) return;

    const currentW = cropState.naturalWidth * cropState.scaleBase * cropState.zoom;
    const currentH = cropState.naturalHeight * cropState.scaleBase * cropState.zoom;

    const maxOffsetX = Math.max(0, (currentW - cropState.cropDiameter) / 2);
    const maxOffsetY = Math.max(0, (currentH - cropState.cropDiameter) / 2);

    cropState.offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, cropState.offsetX));
    cropState.offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, cropState.offsetY));

    cropImg.style.width = `${Math.round(currentW)}px`;
    cropImg.style.height = `${Math.round(currentH)}px`;
    cropImg.style.transform = `translate(${Math.round(cropState.offsetX)}px, ${Math.round(cropState.offsetY)}px)`;

    const pct = Math.round(cropState.zoom * 100);
    if (zoomVal) zoomVal.textContent = `${pct}%`;
    if (zoomRange && Math.abs(parseFloat(zoomRange.value) - cropState.zoom) > 0.01) {
      zoomRange.value = String(cropState.zoom);
    }
  }

  function setCropZoom(val) {
    const clamped = Math.min(3.0, Math.max(1.0, Math.round(val * 100) / 100));
    cropState.zoom = clamped;
    updateCropDisplay();
  }

  function handleCropPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    cropState.isDragging = true;
    cropState.dragStartX = e.clientX || 0;
    cropState.dragStartY = e.clientY || 0;
    cropState.startOffsetX = cropState.offsetX;
    cropState.startOffsetY = cropState.offsetY;

    const viewport = document.getElementById('avatarCropViewport');
    if (viewport) {
      viewport.style.cursor = 'grabbing';
      if (typeof viewport.setPointerCapture === 'function' && e.pointerId !== undefined) {
        try { viewport.setPointerCapture(e.pointerId); } catch (_e) {}
      }
    }
  }

  function handleCropPointerMove(e) {
    if (!cropState.isDragging) return;
    const dx = (e.clientX || 0) - cropState.dragStartX;
    const dy = (e.clientY || 0) - cropState.dragStartY;
    cropState.offsetX = cropState.startOffsetX + dx;
    cropState.offsetY = cropState.startOffsetY + dy;
    updateCropDisplay();
  }

  function handleCropPointerUp(e) {
    cropState.isDragging = false;
    const viewport = document.getElementById('avatarCropViewport');
    if (viewport) {
      viewport.style.cursor = 'grab';
      if (typeof viewport.releasePointerCapture === 'function' && e && e.pointerId !== undefined) {
        try { viewport.releasePointerCapture(e.pointerId); } catch (_e) {}
      }
    }
  }

  function handleCropWheel(e) {
    e.preventDefault();
    const delta = (e.deltaY || 0) < 0 ? 0.08 : -0.08;
    setCropZoom(cropState.zoom + delta);
  }

  function handleCropKeydown(e) {
    if (e.key === 'ArrowLeft') {
      cropState.offsetX -= 6;
      updateCropDisplay();
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      cropState.offsetX += 6;
      updateCropDisplay();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      cropState.offsetY -= 6;
      updateCropDisplay();
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      cropState.offsetY += 6;
      updateCropDisplay();
      e.preventDefault();
    } else if (e.key === '+' || e.key === '=') {
      setCropZoom(cropState.zoom + 0.1);
      e.preventDefault();
    } else if (e.key === '-') {
      setCropZoom(cropState.zoom - 0.1);
      e.preventDefault();
    }
  }

  function closeAvatarCropModal(isConfirmed = false) {
    const modal = document.getElementById('avatarCropModal');
    const cropImg = document.getElementById('avatarCropImg');
    const fileInput = document.getElementById('avatarFileInput');

    cropState.isOpen = false;
    if (modal) {
      modal.setAttribute('hidden', '');
      modal.style.display = 'none';
    }
    document.body.style.overflow = '';
    clearCropAlert();

    if (cropImg) {
      cropImg.src = '';
    }

    revokeTempCropUrl();

    if (!isConfirmed) {
      cropState.originalFile = null;
      cropState.croppedBlob = null;
      cropState.croppedFile = null;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }

  async function confirmAvatarCrop() {
    if (isUploadingAvatar) return false;
    if (!cropState.naturalWidth || !cropState.naturalHeight) {
      showCropAlert('Chưa có ảnh hợp lệ để áp dụng.', 'error');
      return false;
    }

    const confirmBtn = document.getElementById('btnConfirmAvatarCrop');
    const cancelBtn = document.getElementById('btnCancelAvatarCrop');
    const closeBtn = document.getElementById('btnCloseAvatarCropModal');
    const spinner = document.getElementById('cropConfirmSpinner');
    const btnText = document.getElementById('cropConfirmBtnText');

    let croppedBlob = null;
    let croppedFile = null;

    try {
      if (spinner) spinner.style.display = 'inline-block';
      if (confirmBtn) confirmBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      if (closeBtn) closeBtn.disabled = true;
      if (btnText) btnText.textContent = 'Đang xử lý ảnh...';

      croppedBlob = await generateCroppedBlob();
      if (!croppedBlob) {
        throw new Error('Canvas không tạo được dữ liệu ảnh.');
      }

      const originalName = (cropState.originalFile && cropState.originalFile.name) || 'avatar.png';
      const ext = croppedBlob.type === 'image/jpeg' ? '.jpg' : (croppedBlob.type === 'image/webp' ? '.webp' : '.png');
      const baseName = originalName.replace(/\.[^/.]+$/, '');
      const croppedFileName = `${baseName}_cropped${ext}`;

      if (typeof File !== 'undefined') {
        try {
          croppedFile = new File([croppedBlob], croppedFileName, { type: croppedBlob.type });
        } catch (_fileErr) {
          croppedFile = croppedBlob;
          croppedFile.name = croppedFileName;
        }
      } else {
        croppedFile = croppedBlob;
      }

      cropState.croppedBlob = croppedBlob;
      cropState.croppedFile = croppedFile;
    } catch (cropErr) {
      console.warn('[PDF-Lingua Crop Error]', cropErr);
      showCropAlert('Không thể xử lý cắt ảnh. Vui lòng thử lại.', 'error');
      if (spinner) spinner.style.display = 'none';
      if (confirmBtn) confirmBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      if (closeBtn) closeBtn.disabled = false;
      if (btnText) btnText.textContent = 'Áp dụng ảnh';
      return false;
    }

    return await uploadCroppedAvatar(croppedFile);
  }

  async function uploadCroppedAvatar(file) {
    if (isUploadingAvatar) return false;

    const confirmBtn = document.getElementById('btnConfirmAvatarCrop');
    const cancelBtn = document.getElementById('btnCancelAvatarCrop');
    const closeBtn = document.getElementById('btnCloseAvatarCropModal');
    const spinner = document.getElementById('cropConfirmSpinner');
    const btnText = document.getElementById('cropConfirmBtnText');

    const restoreButtons = () => {
      isUploadingAvatar = false;
      if (spinner) spinner.style.display = 'none';
      if (confirmBtn) confirmBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      if (closeBtn) closeBtn.disabled = false;
      if (btnText) btnText.textContent = 'Áp dụng ảnh';
    };

    const targetFile = file || cropState.croppedFile;
    if (!targetFile) {
      restoreButtons();
      showCropAlert('Không tìm thấy tệp ảnh để tải lên.', 'error');
      return false;
    }

    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    let fileType = (targetFile.type || '').toLowerCase();
    if (!fileType && targetFile.name) {
      const ext = targetFile.name.split('.').pop().toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') fileType = 'image/jpeg';
      else if (ext === 'png') fileType = 'image/png';
      else if (ext === 'webp') fileType = 'image/webp';
    }

    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      restoreButtons();
      showCropAlert('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận JPEG, PNG hoặc WebP.', 'error');
      return false;
    }

    const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
    if (typeof targetFile.size === 'number') {
      if (targetFile.size <= 0) {
        restoreButtons();
        showCropAlert('Tệp ảnh không hợp lệ hoặc rỗng.', 'error');
        return false;
      }
      if (targetFile.size > MAX_AVATAR_SIZE) {
        restoreButtons();
        showCropAlert('Kích thước ảnh đại diện vượt quá giới hạn tối đa 2 MB.', 'error');
        return false;
      }
    }

    const token = getStoredToken();
    if (!token) {
      restoreButtons();
      clearStoredSession();
      updateHeaderAuthState(null);
      showCropAlert('Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.', 'error');
      showAccountAlert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
      return false;
    }

    try {
      isUploadingAvatar = true;
      if (spinner) spinner.style.display = 'inline-block';
      if (confirmBtn) confirmBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      if (closeBtn) closeBtn.disabled = true;
      if (btnText) btnText.textContent = 'Đang tải lên...';

      let formData;
      if (typeof FormData !== 'undefined') {
        formData = new FormData();
        formData.append('file', targetFile, targetFile.name || 'avatar.png');
      } else {
        formData = {
          file: targetFile,
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      let resData = null;
      try {
        resData = await response.json();
      } catch (_e) {}

      if (response.status === 200 && resData && resData.data && resData.data.avatar_url) {
        const serverAvatarUrl = resData.data.avatar_url;

        revokeActiveAvatarPreview();
        applyAvatarPreview(serverAvatarUrl);

        const user = getStoredUser();
        if (user) {
          user.avatar_url = serverAvatarUrl;
          setStoredSession(token, user);
        }

        closeAvatarCropModal(true);

        const fileInput = document.getElementById('avatarFileInput');
        if (fileInput) {
          fileInput.value = '';
        }

        showAccountAlert('Cập nhật ảnh đại diện thành công.', 'success');
        return true;
      } else if (response.status === 401) {
        clearStoredSession();
        updateHeaderAuthState(null);
        showCropAlert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        showAccountAlert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        return false;
      } else if (response.status === 403) {
        const msg = (resData && (resData.message || (typeof resData.detail === 'string' ? resData.detail : null)))
          || 'Bạn không có quyền cập nhật ảnh đại diện này.';
        showCropAlert(msg, 'error');
        return false;
      } else if (response.status === 413) {
        const msg = (resData && (resData.message || (typeof resData.detail === 'string' ? resData.detail : null)))
          || 'Kích thước tệp ảnh vượt quá giới hạn tối đa cho phép (2 MB).';
        showCropAlert(msg, 'error');
        return false;
      } else if (response.status === 415) {
        const msg = (resData && (resData.message || (typeof resData.detail === 'string' ? resData.detail : null)))
          || 'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận các định dạng JPEG, PNG và WebP.';
        showCropAlert(msg, 'error');
        return false;
      } else if (response.status === 400 || response.status === 422) {
        let msg = resData && (resData.message || (typeof resData.detail === 'string' ? resData.detail : null));
        if (!msg && resData && Array.isArray(resData.detail) && resData.detail.length > 0) {
          msg = resData.detail.map((d) => d.msg || d.message).join('; ');
        }
        showCropAlert(msg || 'Dữ liệu ảnh không hợp lệ. Vui lòng kiểm tra lại.', 'error');
        return false;
      } else {
        const msg = (resData && (resData.message || (typeof resData.detail === 'string' ? resData.detail : null)))
          || 'Máy chủ gặp sự cố khi lưu ảnh đại diện. Vui lòng thử lại sau.';
        showCropAlert(msg, 'error');
        return false;
      }
    } catch (networkError) {
      console.warn('[PDF-Lingua Avatar Upload Error]', networkError);
      showCropAlert('Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng.', 'error');
      return false;
    } finally {
      restoreButtons();
    }
  }

  function generateCroppedBlob(targetSize = 400) {
    return new Promise((resolve, reject) => {
      try {
        const currentW = cropState.naturalWidth * cropState.scaleBase * cropState.zoom;
        const currentH = cropState.naturalHeight * cropState.scaleBase * cropState.zoom;
        const ratio = cropState.naturalWidth / currentW;

        const relX = (currentW - cropState.cropDiameter) / 2 - cropState.offsetX;
        const relY = (currentH - cropState.cropDiameter) / 2 - cropState.offsetY;

        const sx = Math.max(0, relX * ratio);
        const sy = Math.max(0, relY * ratio);
        const sSize = Math.min(
          cropState.cropDiameter * ratio,
          cropState.naturalWidth - sx,
          cropState.naturalHeight - sy
        );

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Không thể khởi tạo Canvas 2D context.'));
          return;
        }

        const img = document.getElementById('avatarCropImg');
        ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, targetSize, targetSize);

        const mimeType = (cropState.originalFile && cropState.originalFile.type) || 'image/png';
        const outputMime = ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ? mimeType : 'image/png';

        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob trả về null.'));
            }
          }, outputMime, 0.92);
        } else if (typeof canvas.toDataURL === 'function') {
          const dataUrl = canvas.toDataURL(outputMime, 0.92);
          const parts = dataUrl.split(',');
          const binStr = atob(parts[1]);
          const len = binStr.length;
          const u8 = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            u8[i] = binStr.charCodeAt(i);
          }
          resolve(new Blob([u8], { type: outputMime }));
        } else {
          reject(new Error('Trình duyệt không hỗ trợ xuất dữ liệu Canvas.'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  function showCropAlert(msg, type = 'error') {
    const alertBox = document.getElementById('avatarCropAlert');
    if (!alertBox) return;
    alertBox.className = `form-alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.style.display = 'block';
  }

  function clearCropAlert() {
    const alertBox = document.getElementById('avatarCropAlert');
    if (!alertBox) return;
    alertBox.className = 'form-alert';
    alertBox.textContent = '';
    alertBox.style.display = 'none';
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

  // ── Change Password Logic ──

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
    const avatarInitial = document.getElementById('accountAvatarInitial');
    const avatarImg = document.getElementById('accountAvatarImg');
    const btnDeleteAvatar = document.getElementById('btnDeleteAvatar');
    const confirmBox = document.getElementById('avatarDeleteConfirmBox');
    const detailFullName = document.getElementById('accountDetailFullName');
    const detailEmail = document.getElementById('accountDetailEmail');
    const detailRole = document.getElementById('accountDetailRole');
    const detailStatus = document.getElementById('accountDetailStatus');

    const name = user.full_name || 'Chưa đặt tên';
    const email = user.email || '';
    const initial = (user.full_name ? user.full_name.charAt(0) : email.charAt(0) || 'U').toUpperCase();

    if (fullNameDisplay) fullNameDisplay.textContent = name;
    if (emailSubDisplay) emailSubDisplay.textContent = email;

    if (confirmBox) confirmBox.style.display = 'none';

    if (user.avatar_url) {
      if (avatarImg) {
        avatarImg.src = user.avatar_url;
        avatarImg.style.display = 'block';
      }
      if (avatarInitial) {
        avatarInitial.textContent = initial;
        avatarInitial.style.display = 'none';
      }
      if (btnDeleteAvatar) {
        btnDeleteAvatar.style.display = 'inline-flex';
      }
      if (avatarLarge && !avatarInitial) {
        avatarLarge.textContent = '';
      }
    } else {
      if (avatarImg) {
        avatarImg.src = '';
        avatarImg.style.display = 'none';
      }
      if (avatarInitial) {
        avatarInitial.textContent = initial;
        avatarInitial.style.display = 'inline-block';
      }
      if (btnDeleteAvatar) {
        btnDeleteAvatar.style.display = 'none';
      }
      if (avatarLarge && !avatarInitial) {
        avatarLarge.textContent = initial;
      }
    }
    if (detailFullName) detailFullName.textContent = name;
    if (detailEmail) detailEmail.textContent = email;

    if (detailRole) {
      const roleStr = (user.role || 'free').toLowerCase();
      const roleLabels = {
        admin: 'Quản trị viên',
        pro: 'Gói Pro VIP',
        free: 'Gói Miễn phí',
      };
      detailRole.textContent = roleLabels[roleStr] || 'Gói Miễn phí';
      detailRole.className = `badge-role role-${roleStr}`;

      const btnAccountUpgradePro = document.getElementById('btnAccountUpgradePro');
      if (btnAccountUpgradePro) {
        btnAccountUpgradePro.style.display = roleStr === 'free' ? 'inline-flex' : 'none';
      }
    }

    if (detailStatus) {
      if (user.is_active === false) {
        detailStatus.textContent = 'Bị vô hiệu';
        detailStatus.className = 'badge-status status-inactive';
        if (detailStatus.classList) {
          detailStatus.classList.remove('status-active');
          detailStatus.classList.add('status-inactive');
        }
        detailStatus.style.backgroundColor = '#FEE2E2';
        detailStatus.style.color = '#DC2626';
        detailStatus.style.borderColor = '#FCA5A5';
      } else {
        detailStatus.textContent = 'Hoạt động';
        detailStatus.className = 'badge-status status-active';
        if (detailStatus.classList) {
          detailStatus.classList.remove('status-inactive');
          detailStatus.classList.add('status-active');
        }
        detailStatus.style.backgroundColor = '';
        detailStatus.style.color = '';
        detailStatus.style.borderColor = '';
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

  /**
   * Kích hoạt modal / giao diện nâng cấp tài khoản Pro VIP.
   */
  function showUpgradeModal() {
    if (typeof window !== 'undefined' && window.PDFLinguaPricing && typeof window.PDFLinguaPricing.openPricingView === 'function') {
      window.PDFLinguaPricing.openPricingView();
      return;
    }
    const quotaModal = document.getElementById('quotaExceededModal');
    if (quotaModal) {
      quotaModal.removeAttribute('hidden');
      quotaModal.setAttribute('aria-hidden', 'false');
      quotaModal.style.display = 'flex';
      return;
    }
    const aiProModal = document.getElementById('aiProModal');
    if (aiProModal) {
      aiProModal.removeAttribute('hidden');
      aiProModal.style.display = 'flex';
      return;
    }
    const checkoutModal = document.getElementById('pricingCheckoutModal');
    if (checkoutModal) {
      checkoutModal.removeAttribute('hidden');
      checkoutModal.setAttribute('aria-hidden', 'false');
      checkoutModal.style.display = 'flex';
      return;
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = '#pricingSection';
    }
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
    showUpgradeModal,
    authFetch,
    openLoginModal,
    closeLoginModal,
    openRegisterModal,
    closeRegisterModal,
    openAccountModal,
    closeAccountModal,
    initAccountModal,
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
    initAccountAvatar,
    toggleAccountAvatarDeleteConfirm,
    handleAvatarFileSelection,
    applyAvatarPreview,
    handleConfirmDeleteAvatar,
    openAvatarCropModal,
    closeAvatarCropModal,
    initAvatarCropModal,
    updateCropDisplay,
    setCropZoom,
    confirmAvatarCrop,
    generateCroppedBlob,
    uploadCroppedAvatar,
    revokeActiveAvatarPreview,
    revokeTempCropUrl,
    getIsUploadingAvatar: () => isUploadingAvatar,
    getIsDeletingAvatar: () => isDeletingAvatar,
    getCropState: () => cropState,
  });
})();
