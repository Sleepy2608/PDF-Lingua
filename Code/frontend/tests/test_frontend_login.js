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
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

function createEnv() {
  const ids = [
    'loginForm', 'loginEmail', 'loginEmailError', 'loginPassword', 'loginPasswordError',
    'loginAlert', 'btnSubmitLogin', 'loginSpinner', 'loginBtnText', 'registerAlert',
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

  const document = {
    getElementById: (id) => e[id] || null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: { style: {} },
    createElement: () => ({ appendChild: () => {}, innerHTML: '' }),
    createTextNode: (v) => v,
  };

  const window = {
    location: { protocol: 'http:', port: '8000' },
    document,
    localStorage,
  };

  const context = vm.createContext({
    window,
    document,
    localStorage,
    console,
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout,
    fetch: null,
  });

  vm.runInContext(source, context);
  return { e, a: window.pdfLinguaAuth, c: context, storage: localStorage };
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

  console.log(`\n================================================================`);
  console.log(`SUMMARY: ${passed}/${total} frontend tests passed (0 failed).`);
  console.log(`================================================================\n`);
})().catch((err) => {
  console.error('[FATAL]', err);
  process.exitCode = 1;
});
