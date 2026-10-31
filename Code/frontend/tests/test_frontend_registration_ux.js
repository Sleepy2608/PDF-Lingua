/**
 * PDF-Lingua — Registration UX & Edge Cases Test Suite (PDFL-42.4)
 * ----------------------------------------------------------------
 * Covers modal state isolation, password/confirmation synchronisation,
 * the single success notification hand-over and form state after failures.
 *
 * Execution:
 *   node Code/frontend/tests/test_frontend_registration_ux.js
 *
 * Requirements: Node.js (no external npm dependencies required).
 */

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
    this.className = '';
    this.classList = new ClassList();
    this.style = {};
    this.disabled = false;
    this.attributes = {};
    this.listeners = {};
    this.contained = [];
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
    (this.listeners[event] || []).forEach((fn) => fn(data || { preventDefault() {} }));
  }
  querySelectorAll(selector) {
    if (selector === '.form-input') return this.contained;
    return [];
  }
  querySelector() { return null; }
}

class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
}

const ELEMENT_IDS = [
  'loginForm', 'loginEmail', 'loginEmailError', 'loginPassword', 'loginPasswordError',
  'loginAlert', 'btnSubmitLogin', 'loginSpinner', 'loginBtnText', 'registerAlert',
  'regFullName', 'regEmail', 'regPassword', 'regConfirmPassword', 'btnSubmitRegister',
  'regSpinner', 'regBtnText', 'registerForm',
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
  'btnOpenRegister', 'btnLogin', 'btnCloseRegisterModal', 'btnCloseLoginModal',
  'linkSwitchLogin', 'linkSwitchRegister',
];

function createEnv() {
  const e = Object.fromEntries(ELEMENT_IDS.map((id) => [id, new Element(id)]));
  const localStorage = new MockLocalStorage();
  const domReadyCallbacks = [];

  e.registerModal.contained = [e.regFullName, e.regEmail, e.regPassword, e.regConfirmPassword];
  e.loginModal.contained = [e.loginEmail, e.loginPassword];
  e.accountModal.contained = [
    e.editFullNameInput,
    e.currentPasswordInput,
    e.newPasswordInput,
    e.confirmNewPasswordInput,
  ];

  const allFormInputs = [
    ...e.registerModal.contained,
    ...e.loginModal.contained,
    ...e.accountModal.contained,
  ];

  const document = {
    getElementById: (id) => e[id] || null,
    querySelectorAll: (selector) => (selector === '.form-input' ? allFormInputs : []),
    addEventListener: (event, fn) => {
      if (event === 'DOMContentLoaded') domReadyCallbacks.push(fn);
    },
    body: { style: {} },
    createElement: () => ({ appendChild: () => {}, innerHTML: '' }),
    createTextNode: (v) => v,
  };

  const window = {
    location: { protocol: 'http:', port: '8000', hostname: 'localhost' },
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
  domReadyCallbacks.forEach((fn) => fn());

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
    console.error(`[FAIL] ${name}`);
    console.error(err);
    throw err;
  }
}

function setValue(input, value) {
  input.value = value;
  input.trigger('input');
}

function blur(input) {
  input.trigger('blur', { relatedTarget: null });
}

function submit(env) {
  env.e.registerForm.trigger('submit', { preventDefault() {} });
}

function fillValidRegistration(env) {
  setValue(env.e.regFullName, 'Nguyễn Văn A');
  setValue(env.e.regEmail, 'newuser@example.com');
  setValue(env.e.regPassword, 'Abcdef12');
  setValue(env.e.regConfirmPassword, 'Abcdef12');
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 5));
}

(async () => {
  console.log('================================================================');
  console.log('PDF-Lingua Registration UX & Edge Cases (PDFL-42.4)');
  console.log('================================================================\n');

  await test('Modal isolation: opening the register modal keeps login and account errors', async () => {
    const env = createEnv();

    env.a.showFieldError(env.e.loginEmail, 'Lỗi đăng nhập cũ.');
    env.a.showFieldError(env.e.editFullNameInput, 'Lỗi họ tên cũ.');

    env.a.openRegisterModal();

    assert.strictEqual(env.e.loginEmail.classList.contains('has-error'), true);
    assert.strictEqual(env.e.loginEmailError.textContent, 'Lỗi đăng nhập cũ.');
    assert.strictEqual(env.e.editFullNameInput.classList.contains('has-error'), true);
    assert.strictEqual(env.e.editFullNameInputError.textContent, 'Lỗi họ tên cũ.');
  });

  await test('Modal isolation: opening the register modal still clears stale registration errors', async () => {
    const env = createEnv();

    env.a.showFieldError(env.e.regEmail, 'Lỗi đăng ký cũ.');
    env.a.openRegisterModal();

    assert.strictEqual(env.e.regEmail.classList.contains('has-error'), false);
    assert.strictEqual(env.e.regEmailError.textContent, '');
    assert.strictEqual(env.e.regEmail.getAttribute('aria-invalid'), undefined);
  });

  await test('Confirm password: no error while typing, before the field is left', async () => {
    const env = createEnv();
    env.a.openRegisterModal();

    setValue(env.e.regPassword, 'Abcdef12');
    setValue(env.e.regConfirmPassword, 'Abcdef99');

    assert.strictEqual(env.e.regConfirmPasswordError.textContent, '');
    assert.strictEqual(env.e.regConfirmPassword.classList.contains('has-error'), false);
  });

  await test('Confirm password: blur reports mismatch, editing the password re-checks it both ways', async () => {
    const env = createEnv();
    env.a.openRegisterModal();

    setValue(env.e.regPassword, 'Abcdef12');
    setValue(env.e.regConfirmPassword, 'Abcdef99');
    blur(env.e.regConfirmPassword);

    assert.strictEqual(
      env.e.regConfirmPasswordError.textContent,
      'Mật khẩu xác nhận không khớp với mật khẩu đã nhập.'
    );

    // Password edited so both values match → confirmation error disappears.
    setValue(env.e.regPassword, 'Abcdef99');
    assert.strictEqual(env.e.regConfirmPasswordError.textContent, '');
    assert.strictEqual(env.e.regConfirmPassword.classList.contains('has-error'), false);

    // Password edited again → confirmation error comes back.
    setValue(env.e.regPassword, 'Abcdef12');
    assert.strictEqual(
      env.e.regConfirmPasswordError.textContent,
      'Mật khẩu xác nhận không khớp với mật khẩu đã nhập.'
    );
  });

  await test('Confirm password: untouched confirmation stays silent when only the password changes', async () => {
    const env = createEnv();
    env.a.openRegisterModal();

    setValue(env.e.regPassword, 'Abcdef12');
    setValue(env.e.regPassword, 'Abcdef123');

    assert.strictEqual(env.e.regConfirmPasswordError.textContent, '');
  });

  await test('Submit: invalid data shows all errors, focuses the first field and sends no request', async () => {
    const env = createEnv();
    let calls = 0;
    env.c.fetch = async () => { calls++; return { status: 201, json: async () => ({}) }; };
    env.a.openRegisterModal();

    submit(env);
    await flush();

    assert.strictEqual(calls, 0);
    assert.strictEqual(env.e.regEmailError.textContent, 'Vui lòng nhập địa chỉ email.');
    assert.strictEqual(env.e.regPasswordError.textContent, 'Vui lòng nhập mật khẩu.');
    assert.strictEqual(env.e.regConfirmPasswordError.textContent, 'Vui lòng nhập lại mật khẩu xác nhận.');
    assert.strictEqual(env.e.regEmail.getAttribute('aria-invalid'), 'true');
  });

  await test('Success: exactly one notification, login modal open, email kept, passwords wiped', async () => {
    const env = createEnv();
    env.c.fetch = async () => ({
      status: 201,
      json: async () => ({
        success: true,
        data: { id: 1, email: 'newuser@example.com', full_name: 'Nguyễn Văn A', role: 'free' },
      }),
    });

    env.a.openRegisterModal();
    fillValidRegistration(env);
    submit(env);
    await flush();

    assert.strictEqual(env.e.registerAlert.textContent, '', 'Register modal must not duplicate the notice');
    assert.match(env.e.loginAlert.textContent, /Đăng ký tài khoản thành công/i);
    assert.strictEqual(env.e.loginEmail.value, 'newuser@example.com');
    assert.strictEqual(env.e.regPassword.value, '');
    assert.strictEqual(env.e.regConfirmPassword.value, '');
    assert.strictEqual(env.e.loginModal.hasAttribute('hidden'), false);
    assert.strictEqual(env.e.registerModal.hasAttribute('hidden'), true);
    assert.strictEqual(env.e.btnSubmitRegister.disabled, false);
    assert.strictEqual(env.storage.getItem('pdfl_token'), null);
  });

  await test('Failure then retry: data kept, button restored, second attempt can succeed', async () => {
    const env = createEnv();
    let attempt = 0;
    env.c.fetch = async () => {
      attempt++;
      if (attempt === 1) {
        return { status: 500, json: async () => ({ success: false, message: 'boom' }) };
      }
      return {
        status: 201,
        json: async () => ({ success: true, data: { id: 2, email: 'newuser@example.com' } }),
      };
    };

    env.a.openRegisterModal();
    fillValidRegistration(env);
    submit(env);
    await flush();

    assert.match(env.e.registerAlert.textContent, /Hệ thống đang gặp sự cố/i);
    assert.strictEqual(env.e.regFullName.value, 'Nguyễn Văn A');
    assert.strictEqual(env.e.regPassword.value, 'Abcdef12');
    assert.strictEqual(env.e.btnSubmitRegister.disabled, false);
    assert.strictEqual(env.e.regBtnText.textContent, 'Tạo tài khoản');

    submit(env);
    await flush();

    assert.strictEqual(attempt, 2);
    assert.match(env.e.loginAlert.textContent, /Đăng ký tài khoản thành công/i);
    assert.strictEqual(env.e.registerModal.hasAttribute('hidden'), true);
  });

  await test('Reopening the register modal after success shows a clean form but keeps the email', async () => {
    const env = createEnv();
    env.c.fetch = async () => ({
      status: 201,
      json: async () => ({ success: true, data: { id: 3, email: 'kept@example.com' } }),
    });

    env.a.openRegisterModal();
    setValue(env.e.regEmail, 'kept@example.com');
    setValue(env.e.regPassword, 'Abcdef12');
    setValue(env.e.regConfirmPassword, 'Abcdef12');
    submit(env);
    await flush();

    env.a.openRegisterModal();

    assert.strictEqual(env.e.registerModal.hasAttribute('hidden'), false);
    assert.strictEqual(env.e.registerAlert.textContent, '');
    assert.strictEqual(env.e.regEmail.classList.contains('has-error'), false);
    assert.strictEqual(env.e.regPassword.value, '');
    assert.strictEqual(env.e.regEmail.value, 'kept@example.com');
    assert.strictEqual(env.e.btnSubmitRegister.disabled, false);

    // A brand new interaction session must not resurrect old cross-field errors.
    setValue(env.e.regPassword, 'Abcdef12');
    assert.strictEqual(env.e.regConfirmPasswordError.textContent, '');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${total} registration UX tests passed (${total - passed} failed).`);
  console.log('================================================================');
})();
