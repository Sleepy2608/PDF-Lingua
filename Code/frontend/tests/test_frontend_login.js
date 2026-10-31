const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../js/auth.js'), 'utf8');

class ClassList {
  constructor() { this.values = new Set(); }
  add(v) { this.values.add(v); }
  remove(v) { this.values.delete(v); }
  contains(v) { return this.values.has(v); }
}

class Element {
  constructor(id) {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.classList = new ClassList();
    this.style = {};
    this.disabled = false;
    this.attributes = {};
    this.listeners = {};
  }
  focus() {}
  reset() { this.value = ''; }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  addEventListener(event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }
  trigger(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((fn) => fn(data));
    }
  }
}

class MockLocalStorage {
  constructor() { this.store = {}; this.failOnWrite = false; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) {
    if (this.failOnWrite) throw new Error('Storage is not available');
    this.store[k] = String(v);
  }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

function createEnv() {
  const ids = [
    'loginForm', 'loginEmail', 'loginEmailError', 'loginPassword', 'loginPasswordError',
    'loginAlert', 'btnSubmitLogin', 'loginSpinner', 'loginBtnText', 'registerAlert',
    'regFullName', 'regEmail', 'regPassword', 'regConfirmPassword', 'btnSubmitRegister', 'regSpinner', 'regBtnText', 'registerForm',
    'regFullNameError', 'regEmailError', 'regPasswordError', 'regConfirmPasswordError',
    'authGuestGroup', 'authUserGroup', 'userDisplayName', 'userAvatar', 'btnLogout',
    'registerModal', 'loginModal', 'accountModal', 'btnOpenAccountModal', 'btnCloseAccountModal',
    'btnCloseAccountModalBtn', 'accountAlert', 'accountLoading', 'accountInfoContent',
    'accountAvatarLarge', 'accountFullNameDisplay', 'accountEmailSubDisplay',
    'accountDetailFullName', 'accountDetailEmail', 'accountDetailRole', 'accountDetailStatus',
    'accountFullNameView', 'accountEditForm', 'btnToggleEditFullName', 'editFullNameInput',
    'editFullNameInputError', 'btnCancelEditFullName', 'btnSaveFullName', 'editFullNameSpinner',
    'editFullNameBtnText',
    'btnToggleChangePassword', 'toggleChangePasswordText', 'changePasswordForm',
    'changePasswordAlert', 'currentPasswordInput', 'currentPasswordInputError',
    'toggleCurrentPassword', 'newPasswordInput', 'newPasswordInputError',
    'toggleNewPassword', 'confirmNewPasswordInput', 'confirmNewPasswordInputError',
    'toggleConfirmNewPassword', 'btnCancelChangePassword', 'btnSubmitChangePassword',
    'changePasswordSpinner', 'changePasswordBtnText',
  ];
  const e = Object.fromEntries(ids.map((id) => [id, new Element(id)]));
  const localStorage = new MockLocalStorage();
  const sessionStorage = new MockLocalStorage();

  const document = {
    getElementById: (id) => e[id] || null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: { style: {} },
    createElement: () => ({ appendChild: () => {}, innerHTML: '' }),
    createTextNode: (v) => v,
  };

  const window = {
    location: { protocol: 'http:', port: '8000', hostname: 'localhost' },
    document,
    localStorage,
    sessionStorage,
  };

  const context = vm.createContext({
    window,
    document,
    localStorage,
    sessionStorage,
    console,
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout,
    fetch: null,
  });

  vm.runInContext(source, context);
  return { e, a: window.pdfLinguaAuth, c: context, storage: localStorage, session: sessionStorage };
}

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err);
    throw err;
  }
}

(async () => {
  console.log('================================================================');
  console.log('PDF-Lingua Frontend Login & Auth Persistence Test Suite (PDFL-78.4)');
  console.log('================================================================\n');

  // 1. Client-side Form Validation
  await test('Validation: Empty email and password are rejected', () => {
    const { e, a } = createEnv();
    const valid = a.validateLoginForm({ emailInput: e.loginEmail, passwordInput: e.loginPassword });
    assert.strictEqual(valid, false);
    assert.strictEqual(e.loginEmailError.textContent, 'Vui lòng nhập địa chỉ email.');
  });

  // 2. Response Missing Token Error Handling
  await test('Login Error: Response missing access_token does not create session', async () => {
    const { e, a, c, storage } = createEnv();
    e.loginEmail.value = 'user@example.com';
    e.loginPassword.value = 'Password123';
    c.fetch = async () => ({
      status: 200,
      json: async () => ({ success: true, data: { email: 'user@example.com' } }), // missing access_token & user
    });
    await a.submitLogin({ email: e.loginEmail.value, password: e.loginPassword.value });
    assert.match(e.loginAlert.textContent, /không hợp lệ.*thiếu token/i);
    assert.strictEqual(storage.getItem('pdfl_token'), null);
  });

  // 3. Successful Login: Token Stored & Header Updated
  await test('Login Success: Stores pdfl_token & pdfl_user, updates Header to user state', async () => {
    const { e, a, c, storage } = createEnv();
    e.loginEmail.value = 'nguyen@example.com';
    e.loginPassword.value = 'SecureP@ss1';
    c.fetch = async (url, opts) => {
      assert.strictEqual(opts.method, 'POST');
      assert.strictEqual(url.endsWith('/api/auth/login'), true);
      return {
        status: 200,
        json: async () => ({
          success: true,
          data: {
            access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.sig',
            token_type: 'bearer',
            user: {
              id: 7,
              email: 'nguyen@example.com',
              full_name: 'Nguyễn Văn A',
              role: 'free',
            },
          },
        }),
      };
    };

    await a.submitLogin({ email: e.loginEmail.value, password: e.loginPassword.value });

    assert.strictEqual(storage.getItem('pdfl_token'), 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.sig');
    const storedUser = JSON.parse(storage.getItem('pdfl_user'));
    assert.strictEqual(storedUser.email, 'nguyen@example.com');
    assert.strictEqual(storedUser.full_name, 'Nguyễn Văn A');

    // Header State Check
    assert.strictEqual(e.authGuestGroup.hasAttribute('hidden'), true);
    assert.strictEqual(e.authUserGroup.hasAttribute('hidden'), false);
    assert.strictEqual(e.userDisplayName.textContent, 'Nguyễn Văn A');
    assert.strictEqual(e.userAvatar.textContent, 'N');
    assert.match(e.loginAlert.textContent, /Đăng nhập thành công/);
  });

  // 4. HTTP 401 INVALID_CREDENTIALS
  await test('Login 401: Invalid credentials shows error alert and clears token', async () => {
    const { e, a, c, storage } = createEnv();
    e.loginEmail.value = 'user@example.com';
    e.loginPassword.value = 'WrongPassword';
    c.fetch = async () => ({
      status: 401,
      json: async () => ({
        success: false,
        error_code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác.',
      }),
    });

    await a.submitLogin({ email: e.loginEmail.value, password: e.loginPassword.value });
    assert.strictEqual(e.loginAlert.textContent, 'Email hoặc mật khẩu không chính xác.');
    assert.strictEqual(storage.getItem('pdfl_token'), null);
  });

  // 5. HTTP 403 ACCOUNT_INACTIVE
  await test('Login 403: Inactive account shows error message', async () => {
    const { e, a, c } = createEnv();
    e.loginEmail.value = 'inactive@example.com';
    e.loginPassword.value = 'Password123';
    c.fetch = async () => ({
      status: 403,
      json: async () => ({
        success: false,
        error_code: 'ACCOUNT_INACTIVE',
        message: 'Tài khoản này đã bị vô hiệu hóa.',
      }),
    });

    await a.submitLogin({ email: e.loginEmail.value, password: e.loginPassword.value });
    assert.match(e.loginAlert.textContent, /vô hiệu hóa/);
  });

  // 6. HTTP 422 VALIDATION_ERROR mapping
  await test('Login 422: Validation errors mapped to inline field errors', async () => {
    const { e, a, c } = createEnv();
    e.loginEmail.value = 'invalid';
    e.loginPassword.value = '123';
    c.fetch = async () => ({
      status: 422,
      json: async () => ({
        success: false,
        details: [
          { field: 'body -> email', message: 'value is not a valid email address' },
          { field: 'body -> password', message: 'Field required' },
        ],
      }),
    });

    await a.submitLogin({ email: e.loginEmail.value, password: e.loginPassword.value });
    assert.match(e.loginEmailError.textContent, /Định dạng email/);
    assert.strictEqual(e.loginPasswordError.textContent, 'Vui lòng nhập mật khẩu.');
  });

  // 7. Network Error on Login
  await test('Login Network Error: Clears loading state, displays friendly message', async () => {
    const { e, a, c } = createEnv();
    e.loginEmail.value = 'user@example.com';
    e.loginPassword.value = 'Password123';
    c.fetch = async () => { throw new Error('Failed to fetch'); };

    await a.submitLogin({ email: e.loginEmail.value, password: e.loginPassword.value });
    assert.match(e.loginAlert.textContent, /Không thể kết nối/);
    assert.strictEqual(e.btnSubmitLogin.disabled, false);
    assert.strictEqual(e.loginSpinner.style.display, 'none');
  });

  // 8. Restore Session: Valid Token calls /api/auth/me
  await test('Restore Session: Valid token in localStorage verifies with /me and updates Header', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'valid-persisted-token');
    storage.setItem('pdfl_user', JSON.stringify({ id: 5, email: 'persisted@example.com', full_name: 'Persisted User' }));

    let meCalled = false;
    c.fetch = async (url, opts) => {
      if (url.includes('/api/auth/me')) {
        meCalled = true;
        assert.strictEqual(opts.headers.Authorization, 'Bearer valid-persisted-token');
        return {
          status: 200,
          json: async () => ({
            success: true,
            data: { id: 5, email: 'persisted@example.com', full_name: 'Persisted User Fresh', role: 'free' },
          }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    await a.restoreSession();
    assert.strictEqual(meCalled, true);
    assert.strictEqual(e.authUserGroup.hasAttribute('hidden'), false);
    assert.strictEqual(e.userDisplayName.textContent, 'Persisted User Fresh');
  });

  // 9. Restore Session: Expired/Invalid Token (401/403) Clears Session
  await test('Restore Session: Expired or invalid token (401/403) clears storage and sets Guest', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'expired-token');
    storage.setItem('pdfl_user', JSON.stringify({ id: 9, email: 'expired@example.com' }));

    c.fetch = async () => ({
      status: 401,
      json: async () => ({ success: false, error_code: 'TOKEN_EXPIRED' }),
    });

    await a.restoreSession();
    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.strictEqual(storage.getItem('pdfl_user'), null);
    assert.strictEqual(e.authGuestGroup.hasAttribute('hidden'), false);
    assert.strictEqual(e.authUserGroup.hasAttribute('hidden'), true);
  });

  // 10. Restore Session: Network Error Retains Token
  await test('Restore Session: Network error does NOT clear token (allows retry)', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'my-offline-token');
    storage.setItem('pdfl_user', JSON.stringify({ id: 1, email: 'offline@example.com', full_name: 'Offline User' }));

    c.fetch = async () => { throw new Error('Network offline'); };

    await a.restoreSession();
    // Token must be preserved
    assert.strictEqual(storage.getItem('pdfl_token'), 'my-offline-token');
    assert.strictEqual(e.userDisplayName.textContent, 'Offline User');
  });

  // 11. Logout: Calls /api/auth/logout with Bearer token, clears session & reverts Header
  await test('Logout: Calls /api/auth/logout with Bearer token, clears storage & reverts to Guest', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'token-to-logout');
    storage.setItem('pdfl_user', JSON.stringify({ id: 2, email: 'logout@example.com' }));
    a.updateHeaderAuthState({ email: 'logout@example.com' });
    assert.strictEqual(e.authUserGroup.hasAttribute('hidden'), false);

    let logoutCalled = false;
    c.fetch = async (url, opts) => {
      if (url.includes('/api/auth/logout')) {
        logoutCalled = true;
        assert.strictEqual(opts.method, 'POST');
        assert.strictEqual(opts.headers.Authorization, 'Bearer token-to-logout');
        return {
          status: 200,
          json: async () => ({ success: true, message: 'Đăng xuất thành công.' }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    await a.handleLogout();
    assert.strictEqual(logoutCalled, true);
    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.strictEqual(storage.getItem('pdfl_user'), null);
    assert.strictEqual(e.authGuestGroup.hasAttribute('hidden'), false);
    assert.strictEqual(e.authUserGroup.hasAttribute('hidden'), true);
  });

  // 12. Logout Failure (Network error): Still clears client-side session
  await test('Logout Network Failure: Clears client storage regardless of API error', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'failing-token');
    storage.setItem('pdfl_user', JSON.stringify({ id: 3, email: 'fail@example.com' }));
    a.updateHeaderAuthState({ email: 'fail@example.com' });

    c.fetch = async () => { throw new Error('Logout network error'); };

    await a.handleLogout();
    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.strictEqual(storage.getItem('pdfl_user'), null);
    assert.strictEqual(e.authGuestGroup.hasAttribute('hidden'), false);
    assert.strictEqual(e.authUserGroup.hasAttribute('hidden'), true);
  });

  // 13. Account Modal: Fetch and render user details from /api/auth/me
  await test('Account Details: Renders full user details from /api/auth/me successfully', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'account-token-123');

    c.fetch = async (url, opts) => {
      assert.strictEqual(url.endsWith('/api/auth/me'), true);
      assert.strictEqual(opts.headers.Authorization, 'Bearer account-token-123');
      return {
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: 10,
            email: 'profile@example.com',
            full_name: 'Trần Văn Profile',
            role: 'pro',
            is_active: true,
          },
        }),
      };
    };

    await a.fetchAccountDetails();
    assert.strictEqual(e.accountFullNameDisplay.textContent, 'Trần Văn Profile');
    assert.strictEqual(e.accountDetailFullName.textContent, 'Trần Văn Profile');
    assert.strictEqual(e.accountDetailEmail.textContent, 'profile@example.com');
    assert.strictEqual(e.accountDetailRole.textContent, 'PRO');
    assert.strictEqual(e.accountDetailRole.className, 'badge-role role-pro');
    assert.strictEqual(e.accountAvatarLarge.textContent, 'T');
    assert.strictEqual(e.accountDetailStatus.textContent, 'Hoạt động');
  });

  // 14. Account Modal: Expired token / 401 clears session and prompts login
  await test('Account Details: 401 unauthorized clears session and shows friendly alert', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'expired-token');

    c.fetch = async () => ({
      status: 401,
      json: async () => ({ success: false, error_code: 'TOKEN_EXPIRED' }),
    });

    await a.fetchAccountDetails();
    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.match(e.accountAlert.textContent, /hết hạn.*đăng nhập lại/i);
  });

  // 15. Account Modal: Missing token shows alert directly without fetch
  await test('Account Details: Missing token displays not logged in alert', async () => {
    const { e, a } = createEnv();
    await a.fetchAccountDetails();
    assert.match(e.accountAlert.textContent, /chưa đăng nhập/i);
  });

  // 16. Update Profile: Toggle edit mode switches views and populates input
  await test('Update Profile: toggleAccountEditMode switches visibility and populates name', async () => {
    const { e, a, storage } = createEnv();
    storage.setItem('pdfl_user', JSON.stringify({ id: 1, full_name: 'Nguyễn Văn A', email: 'a@example.com' }));

    a.toggleAccountEditMode(true);
    assert.strictEqual(e.accountFullNameView.style.display, 'none');
    assert.strictEqual(e.accountEditForm.style.display, 'block');
    assert.strictEqual(e.btnToggleEditFullName.style.display, 'none');
    assert.strictEqual(e.editFullNameInput.value, 'Nguyễn Văn A');

    a.toggleAccountEditMode(false);
    assert.strictEqual(e.accountFullNameView.style.display, 'flex');
    assert.strictEqual(e.accountEditForm.style.display, 'none');
    assert.strictEqual(e.btnToggleEditFullName.style.display, 'inline-flex');
  });

  // 17. Update Profile: Validation error if full_name > 150 chars
  await test('Update Profile: Reject name exceeding 150 characters', async () => {
    const { e, a, storage } = createEnv();
    storage.setItem('pdfl_token', 'valid-token');
    e.editFullNameInput.value = 'a'.repeat(151);

    await a.handleSaveFullName();
    assert.match(e.editFullNameInputError.textContent, /không được vượt quá 150/i);
  });

  // 18. Update Profile: Success PATCH updates local session and UI
  await test('Update Profile: Successful PATCH updates local storage, header and modal UI', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'valid-token');
    storage.setItem('pdfl_user', JSON.stringify({ id: 1, full_name: 'Old Name', email: 'a@example.com', role: 'free' }));
    e.editFullNameInput.value = 'New Name';

    let patchCalled = false;
    let patchBody = null;

    c.fetch = async (url, opts) => {
      if (opts.method === 'PATCH' && url.endsWith('/api/auth/me')) {
        patchCalled = true;
        patchBody = JSON.parse(opts.body);
        return {
          status: 200,
          json: async () => ({
            success: true,
            data: { id: 1, email: 'a@example.com', full_name: 'New Name', role: 'free', is_active: true },
          }),
        };
      }
      return { status: 400 };
    };

    await a.handleSaveFullName();

    assert.strictEqual(patchCalled, true);
    assert.strictEqual(patchBody.full_name, 'New Name');
    assert.match(e.accountAlert.textContent, /thành công/i);
    assert.strictEqual(e.accountDetailFullName.textContent, 'New Name');
    assert.strictEqual(e.userDisplayName.textContent, 'New Name');

    const updatedSession = JSON.parse(storage.getItem('pdfl_user'));
    assert.strictEqual(updatedSession.full_name, 'New Name');
    assert.strictEqual(updatedSession.password, undefined);
    assert.strictEqual(updatedSession.hashed_password, undefined);
    assert.strictEqual(e.userAvatar.textContent, 'N');
    assert.strictEqual(e.accountAvatarLarge.textContent, 'N');
  });

  // 19. Update Profile: Unauthenticated / Missing token
  await test('Update Profile: Missing token aborts and prompts login', async () => {
    const { e, a } = createEnv();
    e.editFullNameInput.value = 'Unauth User';

    await a.handleSaveFullName();
    assert.match(e.accountAlert.textContent, /hết hạn.*đăng nhập lại/i);
  });

  // 20. Update Profile: 401/403 Expired token clears session
  await test('Update Profile: 401/403 clears session and shows error alert', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'expired-token');
    storage.setItem('pdfl_user', JSON.stringify({ id: 1, full_name: 'Old', email: 'a@example.com' }));
    e.editFullNameInput.value = 'Try Update';

    c.fetch = async () => ({
      status: 401,
      json: async () => ({ success: false, error_code: 'TOKEN_EXPIRED' }),
    });

    await a.handleSaveFullName();
    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.strictEqual(storage.getItem('pdfl_user'), null);
    assert.match(e.accountAlert.textContent, /hết hạn hoặc không hợp lệ/i);
  });

  // 21. Update Profile: 422 Server validation error displays inline and alert
  await test('Update Profile: 422 validation error highlights field and alert', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'valid-token');
    e.editFullNameInput.value = 'Invalid Val';

    c.fetch = async () => ({
      status: 422,
      json: async () => ({
        success: false,
        error_code: 'VALIDATION_ERROR',
        details: [{ field: 'full_name', message: 'Tên không hợp lệ từ máy chủ.' }],
      }),
    });

    await a.handleSaveFullName();
    assert.match(e.editFullNameInputError.textContent, /Tên không hợp lệ từ máy chủ/i);
    assert.match(e.accountAlert.textContent, /Tên không hợp lệ từ máy chủ/i);
  });

  // 22. Update Profile: Network error displays friendly message and keeps token
  await test('Update Profile: Network error preserves session token and shows friendly alert', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'valid-token');
    e.editFullNameInput.value = 'Network Test';

    c.fetch = async () => {
      throw new Error('Connection failed');
    };

    await a.handleSaveFullName();
    assert.strictEqual(storage.getItem('pdfl_token'), 'valid-token');
    assert.match(e.accountAlert.textContent, /Không thể kết nối đến máy chủ/i);
  });

  // 23. Update Profile: Server 500 error shows server error alert
  await test('Update Profile: 500 Internal error shows server error alert and keeps token', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'valid-token');
    e.editFullNameInput.value = 'Server Error Test';

    c.fetch = async () => ({
      status: 500,
      json: async () => ({ success: false, message: 'Internal Server Error' }),
    });

    await a.handleSaveFullName();
    assert.strictEqual(storage.getItem('pdfl_token'), 'valid-token');
    assert.match(e.accountAlert.textContent, /Không thể cập nhật thông tin lúc này|Internal Server Error/i);
  });

  // 24. Change Password: Form open, close, and reset
  await test('Change Password: Form open, close, and reset behaviors', async () => {
    const { e, a } = createEnv();
    a.toggleChangePasswordMode(true);
    assert.strictEqual(e.changePasswordForm.style.display, 'flex');
    assert.strictEqual(e.btnToggleChangePassword.style.display, 'none');

    a.toggleChangePasswordMode(false);
    assert.strictEqual(e.changePasswordForm.style.display, 'none');
    assert.strictEqual(e.btnToggleChangePassword.style.display, 'inline-flex');
  });

  // 25. Change Password Validation: Empty fields are rejected
  await test('Change Password Validation: Empty fields show validation errors', async () => {
    const { e, a } = createEnv();
    const isValid = a.validateChangePasswordForm({
      currentPasswordInput: e.currentPasswordInput,
      newPasswordInput: e.newPasswordInput,
      confirmNewPasswordInput: e.confirmNewPasswordInput,
    });
    assert.strictEqual(isValid, false);
    assert.match(e.currentPasswordInputError.textContent, /nhập mật khẩu hiện tại/i);
    assert.match(e.newPasswordInputError.textContent, /nhập mật khẩu mới/i);
    assert.match(e.confirmNewPasswordInputError.textContent, /xác nhận mật khẩu mới/i);
  });

  // 26. Change Password Validation: Strength & matching rules
  await test('Change Password Validation: Strength and matching rules enforced', async () => {
    const { e, a } = createEnv();

    // Short password
    e.currentPasswordInput.value = 'Current123';
    e.newPasswordInput.value = 'Short1';
    e.confirmNewPasswordInput.value = 'Short1';
    assert.strictEqual(a.validateChangePasswordForm({
      currentPasswordInput: e.currentPasswordInput,
      newPasswordInput: e.newPasswordInput,
      confirmNewPasswordInput: e.confirmNewPasswordInput,
    }), false);
    assert.match(e.newPasswordInputError.textContent, /tối thiểu 8 ký tự/i);

    // Missing letter
    e.newPasswordInput.value = '123456789';
    e.confirmNewPasswordInput.value = '123456789';
    assert.strictEqual(a.validateChangePasswordForm({
      currentPasswordInput: e.currentPasswordInput,
      newPasswordInput: e.newPasswordInput,
      confirmNewPasswordInput: e.confirmNewPasswordInput,
    }), false);
    assert.match(e.newPasswordInputError.textContent, /chứa ít nhất một chữ cái/i);

    // Missing digit
    e.newPasswordInput.value = 'LettersOnlyPassword';
    e.confirmNewPasswordInput.value = 'LettersOnlyPassword';
    assert.strictEqual(a.validateChangePasswordForm({
      currentPasswordInput: e.currentPasswordInput,
      newPasswordInput: e.newPasswordInput,
      confirmNewPasswordInput: e.confirmNewPasswordInput,
    }), false);
    assert.match(e.newPasswordInputError.textContent, /chứa ít nhất một chữ số/i);

    // Same as current password
    e.newPasswordInput.value = 'Current123';
    e.confirmNewPasswordInput.value = 'Current123';
    assert.strictEqual(a.validateChangePasswordForm({
      currentPasswordInput: e.currentPasswordInput,
      newPasswordInput: e.newPasswordInput,
      confirmNewPasswordInput: e.confirmNewPasswordInput,
    }), false);
    assert.match(e.newPasswordInputError.textContent, /không được trùng với mật khẩu hiện tại/i);

    // Mismatched confirmation
    e.newPasswordInput.value = 'ValidNewPass123';
    e.confirmNewPasswordInput.value = 'DifferentPass123';
    assert.strictEqual(a.validateChangePasswordForm({
      currentPasswordInput: e.currentPasswordInput,
      newPasswordInput: e.newPasswordInput,
      confirmNewPasswordInput: e.confirmNewPasswordInput,
    }), false);
    assert.match(e.confirmNewPasswordInputError.textContent, /không khớp/i);
  });

  // 27. Change Password Success: Calls POST /api/auth/change-password with Bearer token
  await test('Change Password Success: Valid submission sends POST request with Bearer token and updates UI', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'user-bearer-token');

    e.currentPasswordInput.value = 'OldPassword123';
    e.newPasswordInput.value = 'NewPassword456';
    e.confirmNewPasswordInput.value = 'NewPassword456';

    let calledUrl = '';
    let calledOpts = null;

    c.fetch = async (url, opts) => {
      calledUrl = url;
      calledOpts = opts;
      return {
        status: 200,
        json: async () => ({
          success: true,
          message: 'Đổi mật khẩu thành công.',
          data: null,
        }),
      };
    };

    await a.handleChangePasswordSubmit();

    assert.match(calledUrl, /\/api\/auth\/change-password$/);
    assert.strictEqual(calledOpts.method, 'POST');
    assert.strictEqual(calledOpts.headers['Authorization'], 'Bearer user-bearer-token');
    const body = JSON.parse(calledOpts.body);
    assert.strictEqual(body.current_password, 'OldPassword123');
    assert.strictEqual(body.new_password, 'NewPassword456');

    assert.match(e.changePasswordAlert.textContent, /thành công/i);
    assert.strictEqual(storage.getItem('current_password'), null);
    assert.strictEqual(storage.getItem('new_password'), null);
  });

  // 28. Change Password Error: 400 Incorrect current password
  await test('Change Password Error: 400 incorrect current password shows inline error and alert', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'valid-token');

    e.currentPasswordInput.value = 'WrongCurrent123';
    e.newPasswordInput.value = 'NewPassword456';
    e.confirmNewPasswordInput.value = 'NewPassword456';

    c.fetch = async () => ({
      status: 400,
      json: async () => ({
        success: false,
        error_code: 'INCORRECT_CURRENT_PASSWORD',
        message: 'Mật khẩu hiện tại không chính xác.',
      }),
    });

    await a.handleChangePasswordSubmit();

    assert.match(e.currentPasswordInputError.textContent, /không chính xác/i);
    assert.match(e.changePasswordAlert.textContent, /không chính xác/i);
  });

  // 29. Change Password Error: 400 New password same as old password
  await test('Change Password Error: 400 same as old password shows inline error and alert', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'valid-token');

    e.currentPasswordInput.value = 'CurrentPassword123';
    e.newPasswordInput.value = 'NewPassword123';
    e.confirmNewPasswordInput.value = 'NewPassword123';

    c.fetch = async () => ({
      status: 400,
      json: async () => ({
        success: false,
        error_code: 'PASSWORD_SAME_AS_OLD',
        message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.',
      }),
    });

    await a.handleChangePasswordSubmit();

    assert.match(e.newPasswordInputError.textContent, /không được trùng/i);
    assert.match(e.changePasswordAlert.textContent, /không được trùng/i);
  });

  // 30. Change Password Error: 401/403 clears session
  await test('Change Password Error: 401 unauthorized clears session and directs user to login', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'expired-token');
    storage.setItem('pdfl_user', JSON.stringify({ id: 1, email: 'user@example.com' }));

    e.currentPasswordInput.value = 'OldPassword123';
    e.newPasswordInput.value = 'NewPassword456';
    e.confirmNewPasswordInput.value = 'NewPassword456';

    c.fetch = async () => ({
      status: 401,
      json: async () => ({ success: false, error_code: 'TOKEN_EXPIRED' }),
    });

    await a.handleChangePasswordSubmit();

    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.strictEqual(storage.getItem('pdfl_user'), null);
    assert.match(e.accountAlert.textContent, /hết hạn hoặc không hợp lệ/i);
  });

  // 31. Change Password Error: Network error preserves token and shows message
  await test('Change Password Error: Network failure displays error and preserves token', async () => {
    const { e, a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'valid-token');

    e.currentPasswordInput.value = 'OldPassword123';
    e.newPasswordInput.value = 'NewPassword456';
    e.confirmNewPasswordInput.value = 'NewPassword456';

    c.fetch = async () => {
      throw new Error('Connection refused');
    };

    await a.handleChangePasswordSubmit();

    assert.strictEqual(storage.getItem('pdfl_token'), 'valid-token');
    assert.match(e.changePasswordAlert.textContent, /Không thể kết nối đến máy chủ/i);
  });

  // 32. Register Success
  await test('Register Success: Shows success, hands the user to the login modal and keeps Guest state', async () => {
    const { e, a, c, storage } = createEnv();

    c.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/register')) {
        return {
          status: 201,
          json: async () => ({
            success: true,
            data: { id: 10, email: 'newuser@example.com', full_name: 'Người Mới', role: 'free' },
          }),
        };
      }
      if (urlStr.includes('/api/auth/login')) {
        return {
          status: 200,
          json: async () => ({
            success: true,
            data: {
              access_token: 'auto-registered-jwt-token',
              token_type: 'bearer',
              user: { id: 10, email: 'newuser@example.com', full_name: 'Người Mới', role: 'free' },
            },
          }),
        };
      }
      return { status: 404, json: async () => ({}) };
    };

    await a.submitRegistration({
      email: 'newuser@example.com',
      password: 'SecurePassword123',
      full_name: 'Người Mới',
    });

    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.strictEqual(storage.getItem('pdfl_user'), null);
    assert.strictEqual(e.authGuestGroup.hasAttribute('hidden'), false);
    assert.strictEqual(e.loginEmail.value, 'newuser@example.com');
    assert.strictEqual(e.regPassword.value, '');
    assert.strictEqual(e.regConfirmPassword.value, '');
    assert.strictEqual(e.btnSubmitRegister.disabled, false);
    assert.strictEqual(e.registerAlert.textContent, '', 'Register modal must not duplicate the success notice');
    assert.match(e.loginAlert.textContent, /Đăng ký tài khoản thành công/i);
  });

  await test('Register Success without full_name: Hands over to login with email pre-filled', async () => {
    const { e, a, c, storage } = createEnv();

    c.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/register')) {
        return {
          status: 201,
          json: async () => ({
            success: true,
            data: { id: 11, email: 'noname@example.com', full_name: null, role: 'free' },
          }),
        };
      }
      if (urlStr.includes('/api/auth/login')) {
        return {
          status: 200,
          json: async () => ({
            success: true,
            data: {
              access_token: 'jwt-noname-token',
              token_type: 'bearer',
              user: { id: 11, email: 'noname@example.com', full_name: null, role: 'free' },
            },
          }),
        };
      }
      return { status: 404, json: async () => ({}) };
    };

    await a.submitRegistration({
      email: 'noname@example.com',
      password: 'SecurePassword123',
    });

    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.strictEqual(e.authGuestGroup.hasAttribute('hidden'), false);
    assert.strictEqual(e.loginEmail.value, 'noname@example.com');
    assert.match(e.loginAlert.textContent, /Đăng ký tài khoản thành công/i);
  });

  await test('Register Failure: Keeps the entered data and restores the submit button', async () => {
    const { e, a, c, storage } = createEnv();

    c.fetch = async () => ({
      status: 500,
      json: async () => ({ success: false, message: 'Internal server error' }),
    });

    e.regFullName.value = 'Người Mới';
    e.regEmail.value = 'kept@example.com';
    e.regPassword.value = 'SecurePassword123';
    e.regConfirmPassword.value = 'SecurePassword123';

    await a.submitRegistration({
      email: 'kept@example.com',
      password: 'SecurePassword123',
      full_name: 'Người Mới',
    });

    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.strictEqual(e.regFullName.value, 'Người Mới');
    assert.strictEqual(e.regEmail.value, 'kept@example.com');
    assert.strictEqual(e.regPassword.value, 'SecurePassword123');
    assert.strictEqual(e.regConfirmPassword.value, 'SecurePassword123');
    assert.strictEqual(e.btnSubmitRegister.disabled, false);
    assert.strictEqual(e.regBtnText.textContent, 'Tạo tài khoản');
    assert.match(e.registerAlert.textContent, /Hệ thống đang gặp sự cố/i);
  });

  await test('Session Persistence: Fallback to sessionStorage when localStorage is restricted', async () => {
    const { e, a, c, storage } = createEnv();

    // Test setStoredSession / getStoredToken
    a.setStoredSession('session-jwt-token', {
      id: 99,
      email: 'sess@example.com',
      full_name: 'Session User',
      role: 'free',
    });

    assert.strictEqual(a.getStoredToken(), 'session-jwt-token');
    const u = a.getStoredUser();
    assert.strictEqual(u.email, 'sess@example.com');
    assert.strictEqual(u.full_name, 'Session User');

    a.clearStoredSession();
    assert.strictEqual(a.getStoredToken(), null);
    assert.strictEqual(a.getStoredUser(), null);
  });

  // 36. Login validation (PDFL-43.2)
  await test('Validation: trims the email and accepts padded valid credentials', () => {
    const { e, a } = createEnv();
    e.loginEmail.value = '  user@example.com  ';
    e.loginPassword.value = 'Password123';

    const valid = a.validateLoginForm({ emailInput: e.loginEmail, passwordInput: e.loginPassword });

    assert.strictEqual(valid, true);
    assert.strictEqual(e.loginEmailError.textContent, '');
    assert.strictEqual(e.loginPasswordError.textContent, '');
  });

  await test('Validation: invalid email uses the shared message and clears a now-valid password error', () => {
    const { e, a } = createEnv();
    e.loginEmail.value = 'not-an-email';
    e.loginPassword.value = 'Password123';
    a.showFieldError(e.loginPassword, 'Lỗi cũ của mật khẩu.');

    const valid = a.validateLoginForm({ emailInput: e.loginEmail, passwordInput: e.loginPassword });

    assert.strictEqual(valid, false);
    assert.strictEqual(e.loginEmailError.textContent, 'Định dạng email không hợp lệ (ví dụ: ten@domain.com).');
    assert.strictEqual(e.loginEmail.getAttribute('aria-invalid'), 'true');
    assert.strictEqual(e.loginPasswordError.textContent, '');
    assert.strictEqual(e.loginPassword.getAttribute('aria-invalid'), undefined);
  });

  // 37. 401 must keep the typed credentials (PDFL-43.2)
  await test('Login 401: keeps typed credentials, restores the button and shows the anti-enumeration message', async () => {
    const { e, a, c } = createEnv();
    e.loginEmail.value = 'user@example.com';
    e.loginPassword.value = 'WrongPass1';
    c.fetch = async () => ({
      status: 401,
      json: async () => ({
        success: false,
        error_code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác.',
      }),
    });

    await a.submitLogin({ email: 'user@example.com', password: 'WrongPass1' });

    assert.strictEqual(e.loginEmail.value, 'user@example.com');
    assert.strictEqual(e.loginPassword.value, 'WrongPass1');
    assert.strictEqual(e.btnSubmitLogin.disabled, false);
    assert.strictEqual(e.loginBtnText.textContent, 'Đăng nhập');
    assert.strictEqual(e.loginSpinner.style.display, 'none');
    assert.match(e.loginAlert.textContent, /Email hoặc mật khẩu không chính xác/i);
  });

  // 38. 5xx must not leak backend internals (PDFL-43.2)
  await test('Login 500: shows a generic message and never exposes backend internals', async () => {
    const { e, a, c } = createEnv();
    c.fetch = async () => ({
      status: 500,
      json: async () => ({
        success: false,
        error_code: 'INTERNAL_SERVER_ERROR',
        message: 'Traceback (most recent call last): psycopg2.OperationalError',
      }),
    });

    await a.submitLogin({ email: 'user@example.com', password: 'Password123' });

    assert.match(e.loginAlert.textContent, /Hệ thống đang gặp sự cố/i);
    assert.strictEqual(/traceback|psycopg2/i.test(e.loginAlert.textContent), false);
    assert.strictEqual(e.btnSubmitLogin.disabled, false);
  });

  // ── PDFL-43.3: TokenStore standardisation ────────────────────────────────

  await test('TokenStore: login stores the session in exactly one storage (localStorage)', async () => {
    const { a, c, storage, session } = createEnv();
    c.fetch = async () => ({
      status: 200,
      json: async () => ({
        success: true,
        data: {
          access_token: 'jwt-single-storage',
          token_type: 'bearer',
          user: { id: 21, email: 'single@example.com', full_name: 'Single User', role: 'free' },
        },
      }),
    });

    await a.submitLogin({ email: 'single@example.com', password: 'Password123' });

    assert.strictEqual(storage.getItem('pdfl_token'), 'jwt-single-storage');
    assert.notStrictEqual(storage.getItem('pdfl_user'), null);
    assert.strictEqual(session.getItem('pdfl_token'), null);
    assert.strictEqual(session.getItem('pdfl_user'), null);
  });

  await test('TokenStore: reads the token and user back from storage', () => {
    const { a, storage } = createEnv();
    storage.setItem('pdfl_token', 'read-me');
    storage.setItem('pdfl_user', JSON.stringify({ id: 3, email: 'read@example.com', role: 'free' }));

    assert.strictEqual(a.getStoredToken(), 'read-me');
    assert.strictEqual(a.getStoredUser().email, 'read@example.com');
  });

  await test('TokenStore: logout clears memory and both storages', () => {
    const { a, storage, session } = createEnv();
    storage.setItem('pdfl_token', 'mem-token');
    storage.setItem('pdfl_user', JSON.stringify({ id: 4 }));
    session.setItem('pdfl_token', 'legacy-token');
    session.setItem('pdfl_user', JSON.stringify({ id: 5 }));

    assert.strictEqual(a.getStoredToken(), 'mem-token');
    a.clearStoredSession();

    assert.strictEqual(a.getStoredToken(), null);
    assert.strictEqual(a.getStoredUser(), null);
    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.strictEqual(storage.getItem('pdfl_user'), null);
    assert.strictEqual(session.getItem('pdfl_token'), null);
    assert.strictEqual(session.getItem('pdfl_user'), null);

    // No stale in-memory session is left behind.
    storage.setItem('pdfl_token', 'after-logout');
    assert.strictEqual(a.getStoredToken(), 'after-logout');
  });

  await test('TokenStore: falls back to sessionStorage when localStorage cannot be written', () => {
    const { a, storage, session } = createEnv();
    storage.failOnWrite = true;

    a.setStoredSession('session-only-token', { id: 6, email: 'fallback@example.com', role: 'free' });

    assert.strictEqual(storage.getItem('pdfl_token'), null);
    assert.strictEqual(session.getItem('pdfl_token'), 'session-only-token');
    assert.strictEqual(a.getStoredToken(), 'session-only-token');
    assert.strictEqual(a.getStoredUser().email, 'fallback@example.com');
  });

  await test('TokenStore: migrates a legacy session from sessionStorage into localStorage', () => {
    const { a, storage, session } = createEnv();
    session.setItem('pdfl_token', 'legacy-jwt');
    session.setItem('pdfl_user', JSON.stringify({ id: 7, email: 'legacy@example.com' }));

    assert.strictEqual(a.getStoredToken(), 'legacy-jwt');
    assert.strictEqual(storage.getItem('pdfl_token'), 'legacy-jwt');
    assert.match(storage.getItem('pdfl_user'), /legacy@example\.com/);
    assert.strictEqual(session.getItem('pdfl_token'), null);
    assert.strictEqual(session.getItem('pdfl_user'), null);
  });

  await test('TokenStore: keeps the active session and drops the stale duplicate when both storages have data', () => {
    const { a, storage, session } = createEnv();
    storage.setItem('pdfl_token', 'active-jwt');
    storage.setItem('pdfl_user', JSON.stringify({ id: 8, email: 'active@example.com' }));
    session.setItem('pdfl_token', 'stale-jwt');
    session.setItem('pdfl_user', JSON.stringify({ id: 9, email: 'stale@example.com' }));

    assert.strictEqual(a.getStoredToken(), 'active-jwt');
    assert.strictEqual(storage.getItem('pdfl_token'), 'active-jwt');
    assert.strictEqual(a.getStoredUser().email, 'active@example.com');
    assert.strictEqual(session.getItem('pdfl_token'), null);
    assert.strictEqual(session.getItem('pdfl_user'), null);
  });

  await test('TokenStore: invalid tokens are never returned nor sent as Authorization', () => {
    const { a, storage } = createEnv();

    ['', '   ', 'null', 'undefined'].forEach((value) => {
      a.clearStoredSession();
      storage.setItem('pdfl_token', value);
      assert.strictEqual(a.getStoredToken(), null, `Token "${value}" must be rejected`);
      assert.strictEqual(a.getAuthHeaders()['Authorization'], undefined);
    });
  });

  await test('TokenStore: setStoredSession never overwrites a valid session with empty data', () => {
    const { a, storage } = createEnv();
    storage.setItem('pdfl_token', 'valid-session');

    a.setStoredSession('', { id: 1 });
    a.setStoredSession('null', { id: 1 });

    assert.strictEqual(storage.getItem('pdfl_token'), 'valid-session');
    assert.strictEqual(a.getStoredToken(), 'valid-session');
  });

  await test('authFetch: adds the Bearer token and preserves caller headers and body', async () => {
    const { a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'jwt-auth-fetch');

    let captured = null;
    c.fetch = async (url, options) => {
      captured = { url, options };
      return { status: 200, json: async () => ({ success: true }) };
    };

    const response = await a.authFetch('/api/example', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Trace': 'abc' },
      body: '{"a":1}',
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(captured.url, '/api/example');
    assert.strictEqual(captured.options.method, 'PATCH');
    assert.strictEqual(captured.options.body, '{"a":1}');
    assert.strictEqual(captured.options.headers['Content-Type'], 'application/json');
    assert.strictEqual(captured.options.headers['X-Trace'], 'abc');
    assert.strictEqual(captured.options.headers['Authorization'], 'Bearer jwt-auth-fetch');
  });

  await test('authFetch: keeps an explicit Authorization header and omits it for guests', async () => {
    const { a, c, storage } = createEnv();
    let captured = null;
    c.fetch = async (_url, options) => {
      captured = options;
      return { status: 200, json: async () => ({}) };
    };

    storage.setItem('pdfl_token', 'jwt-should-not-win');
    await a.authFetch('/api/keep', { headers: { Authorization: 'Custom abc' } });
    assert.strictEqual(captured.headers['Authorization'], 'Custom abc');

    a.clearStoredSession();
    storage.removeItem('pdfl_token');
    await a.authFetch('/api/guest', { headers: { 'X-Guest': '1' } });
    assert.strictEqual(captured.headers['Authorization'], undefined);
    assert.strictEqual(captured.headers['X-Guest'], '1');
  });

  await test('authFetch: does not log out on 401/403 (feature-specific handling stays)', async () => {
    const { a, c, storage } = createEnv();
    storage.setItem('pdfl_token', 'jwt-still-there');
    c.fetch = async () => ({
      status: 401,
      json: async () => ({ success: false, message: 'Nope' }),
    });

    const response = await a.authFetch('/api/protected');

    assert.strictEqual(response.status, 401);
    assert.strictEqual(a.getStoredToken(), 'jwt-still-there');
  });

  console.log(`\n================================================================`);
  console.log(`SUMMARY: ${passed}/${total} frontend tests passed (0 failed).`);
  console.log(`================================================================\n`);
})().catch((err) => {
  console.error('[FATAL]', err);
  process.exitCode = 1;
});
