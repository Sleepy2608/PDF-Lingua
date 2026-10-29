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

  console.log(`\n================================================================`);
  console.log(`SUMMARY: ${passed}/${total} frontend tests passed (0 failed).`);
  console.log(`================================================================\n`);
})().catch((err) => {
  console.error('[FATAL]', err);
  process.exitCode = 1;
});
