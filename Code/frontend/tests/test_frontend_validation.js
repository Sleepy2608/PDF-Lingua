/**
 * PDF-Lingua — Frontend Validation Test Suite (PDFL-74.3)
 * -------------------------------------------------------
 * Reproducible test suite for frontend registration validation,
 * password length limits, HTTP 422 schema error mapping, and security defenses.
 *
 * Execution:
 *   node Code/frontend/tests/test_frontend_validation.js
 *
 * Requirements: Node.js (no external npm dependencies required).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

// Resolve file paths relative to this script directory
const htmlPath = path.resolve(__dirname, '../index.html');
const jsPath = path.resolve(__dirname, '../js/auth.js');

console.log('================================================================');
console.log('PDF-Lingua Frontend Validation Test Suite (PDFL-74.3)');
console.log('Testing: ' + htmlPath);
console.log('Testing: ' + jsPath);
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}\n`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}\n`);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Part 1: Static HTML Markup Verification
// -----------------------------------------------------------------------------
console.log('--- 1. Static HTML Markup Verification ---');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

runTest('HTML: #regPassword has maxlength="128"', () => {
  const match = htmlContent.match(/<input[^>]*id="regPassword"[^>]*>/i);
  assert(match, '#regPassword input tag not found in index.html');
  assert(
    match[0].includes('maxlength="128"'),
    `Expected maxlength="128" on #regPassword, but found: ${match[0]}`
  );
});

runTest('HTML: #regConfirmPassword has maxlength="128"', () => {
  const match = htmlContent.match(/<input[^>]*id="regConfirmPassword"[^>]*>/i);
  assert(match, '#regConfirmPassword input tag not found in index.html');
  assert(
    match[0].includes('maxlength="128"'),
    `Expected maxlength="128" on #regConfirmPassword, but found: ${match[0]}`
  );
});

runTest('HTML: #regFullName has maxlength="150"', () => {
  const match = htmlContent.match(/<input[^>]*id="regFullName"[^>]*>/i);
  assert(match, '#regFullName input tag not found in index.html');
  assert(
    match[0].includes('maxlength="150"'),
    `Expected maxlength="150" on #regFullName, but found: ${match[0]}`
  );
});

runTest('HTML: #regFullNameError element exists for inline full_name error mapping', () => {
  assert(
    htmlContent.includes('id="regFullNameError"'),
    'Expected #regFullNameError paragraph in index.html'
  );
});

runTest('HTML: Field error elements exist for all inputs', () => {
  assert(htmlContent.includes('id="regEmailError"'), 'Missing #regEmailError');
  assert(htmlContent.includes('id="regPasswordError"'), 'Missing #regPasswordError');
  assert(htmlContent.includes('id="regConfirmPasswordError"'), 'Missing #regConfirmPasswordError');
  assert(htmlContent.includes('id="registerAlert"'), 'Missing #registerAlert');
});

// -----------------------------------------------------------------------------
// Part 2: DOM Mock & JS Module Evaluation
// -----------------------------------------------------------------------------
console.log('\n--- 2. JavaScript Validation Logic & 422 Mapping ---');
const jsContent = fs.readFileSync(jsPath, 'utf8');

class MockClassList {
  constructor() { this.classes = new Set(); }
  add(cls) { this.classes.add(cls); }
  remove(cls) { this.classes.delete(cls); }
  contains(cls) { return this.classes.has(cls); }
}

class MockElement {
  constructor(id, type = 'text') {
    this.id = id;
    this.type = type;
    this.value = '';
    this.textContent = '';
    this.className = '';
    this.classList = new MockClassList();
    this.style = {};
    this.listeners = {};
    this.attributes = {};
    this.focused = false;
  }
  addEventListener(event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }
  trigger(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn(data));
    }
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return k in this.attributes; }
  focus() { this.focused = true; }
  reset() { this.value = ''; }
}

function createFreshEnvironment() {
  const elements = {
    registerModal: new MockElement('registerModal'),
    registerForm: new MockElement('registerForm'),
    regFullName: new MockElement('regFullName', 'text'),
    regFullNameError: new MockElement('regFullNameError'),
    regEmail: new MockElement('regEmail', 'email'),
    regEmailError: new MockElement('regEmailError'),
    regPassword: new MockElement('regPassword', 'password'),
    regPasswordError: new MockElement('regPasswordError'),
    regConfirmPassword: new MockElement('regConfirmPassword', 'password'),
    regConfirmPasswordError: new MockElement('regConfirmPasswordError'),
    registerAlert: new MockElement('registerAlert'),
    btnSubmitRegister: new MockElement('btnSubmitRegister'),
    regSpinner: new MockElement('regSpinner'),
    regBtnText: new MockElement('regBtnText'),
  };

  const domWindow = {
    location: { protocol: 'http:', port: '8000' },
    addEventListener: () => {},
    document: {
      addEventListener: () => {},
      getElementById: (id) => elements[id] || null,
      querySelectorAll: (selector) => {
        if (selector === '.form-input') {
          return [elements.regFullName, elements.regEmail, elements.regPassword, elements.regConfirmPassword];
        }
        return [];
      },
      body: { style: {} },
    },
  };

  const context = vm.createContext({
    window: domWindow,
    document: domWindow.document,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    fetch: null,
  });

  vm.runInContext(jsContent, context);

  return {
    elements,
    auth: domWindow.pdfLinguaAuth,
    context,
  };
}

(async () => {
  const env = createFreshEnvironment();
  const { elements, auth } = env;

  runTest('JS: validateRegistrationForm rejects password exceeding 128 characters', () => {
    elements.regFullName.value = 'Nguyen Van A';
    elements.regEmail.value = 'user@example.com';
    elements.regPassword.value = 'A1' + 'b'.repeat(127); // 129 chars
    elements.regConfirmPassword.value = elements.regPassword.value;

    const isValid = auth.validateRegistrationForm({
      fullNameInput: elements.regFullName,
      emailInput: elements.regEmail,
      passwordInput: elements.regPassword,
      confirmPasswordInput: elements.regConfirmPassword,
    });

    assert.strictEqual(isValid, false, 'Expected validation to fail for password > 128 chars');
    assert.strictEqual(
      elements.regPasswordError.textContent,
      'Mật khẩu không được vượt quá 128 ký tự.'
    );
  });

  runTest('JS: validateRegistrationForm rejects confirmPassword exceeding 128 characters', () => {
    elements.regPassword.value = 'ValidPass123';
    elements.regConfirmPassword.value = 'ValidPass123' + 'z'.repeat(120); // > 128 chars
    auth.clearFieldError(elements.regPassword);
    auth.clearFieldError(elements.regConfirmPassword);

    const isValid = auth.validateRegistrationForm({
      fullNameInput: elements.regFullName,
      emailInput: elements.regEmail,
      passwordInput: elements.regPassword,
      confirmPasswordInput: elements.regConfirmPassword,
    });

    assert.strictEqual(isValid, false, 'Expected validation to fail for confirm_password > 128 chars');
    assert.strictEqual(
      elements.regConfirmPasswordError.textContent,
      'Mật khẩu xác nhận không được vượt quá 128 ký tự.'
    );
  });

  runTest('JS: validateRegistrationForm rejects full_name exceeding 150 characters', () => {
    elements.regFullName.value = 'A'.repeat(151); // 151 chars
    elements.regPassword.value = 'ValidPass123';
    elements.regConfirmPassword.value = 'ValidPass123';
    auth.clearFieldError(elements.regPassword);
    auth.clearFieldError(elements.regConfirmPassword);
    auth.clearFieldError(elements.regFullName);

    const isValid = auth.validateRegistrationForm({
      fullNameInput: elements.regFullName,
      emailInput: elements.regEmail,
      passwordInput: elements.regPassword,
      confirmPasswordInput: elements.regConfirmPassword,
    });

    assert.strictEqual(isValid, false, 'Expected validation to fail for full_name > 150 chars');
    assert.strictEqual(
      elements.regFullNameError.textContent,
      'Họ và tên không được vượt quá 150 ký tự.'
    );
  });

  runTest('JS: validateRegistrationForm requires at least one letter and one number', () => {
    elements.regFullName.value = '';
    elements.regEmail.value = 'user@example.com';
    
    // Only numbers
    elements.regPassword.value = '12345678';
    elements.regConfirmPassword.value = '12345678';
    assert.strictEqual(
      auth.validateRegistrationForm({
        fullNameInput: elements.regFullName,
        emailInput: elements.regEmail,
        passwordInput: elements.regPassword,
        confirmPasswordInput: elements.regConfirmPassword,
      }),
      false
    );
    assert.strictEqual(elements.regPasswordError.textContent, 'Mật khẩu phải chứa ít nhất một chữ cái.');

    // Only letters
    elements.regPassword.value = 'abcdefgh';
    elements.regConfirmPassword.value = 'abcdefgh';
    assert.strictEqual(
      auth.validateRegistrationForm({
        fullNameInput: elements.regFullName,
        emailInput: elements.regEmail,
        passwordInput: elements.regPassword,
        confirmPasswordInput: elements.regConfirmPassword,
      }),
      false
    );
    assert.strictEqual(elements.regPasswordError.textContent, 'Mật khẩu phải chứa ít nhất một chữ số.');
  });

  runTest('JS: resolveFieldTarget correctly identifies schema locations', () => {
    const inputs = {
      fullNameInput: elements.regFullName,
      emailInput: elements.regEmail,
      passwordInput: elements.regPassword,
    };

    assert.strictEqual(auth.resolveFieldTarget({ field: 'body -> email' }, inputs).input, elements.regEmail);
    assert.strictEqual(auth.resolveFieldTarget({ field: 'body -> password' }, inputs).input, elements.regPassword);
    assert.strictEqual(auth.resolveFieldTarget({ field: 'body -> full_name' }, inputs).input, elements.regFullName);
    assert.strictEqual(auth.resolveFieldTarget({ loc: ['body', 'password'] }, inputs).input, elements.regPassword);
    assert.strictEqual(auth.resolveFieldTarget({ field: 'unrelated_field' }, inputs), null);
  });

  runTest('JS: formatValidationErrorMessage translates Pydantic messages to Vietnamese', () => {
    assert.strictEqual(
      auth.formatValidationErrorMessage('password', 'String should have at most 128 characters'),
      'Mật khẩu không được vượt quá 128 ký tự.'
    );
    assert.strictEqual(
      auth.formatValidationErrorMessage('password', 'String should have at least 8 characters'),
      'Mật khẩu phải có tối thiểu 8 ký tự.'
    );
    assert.strictEqual(
      auth.formatValidationErrorMessage('password', 'Value error, Password must contain at least one letter.'),
      'Mật khẩu phải chứa ít nhất một chữ cái.'
    );
    assert.strictEqual(
      auth.formatValidationErrorMessage('password', 'Value error, Password must contain at least one digit.'),
      'Mật khẩu phải chứa ít nhất một chữ số.'
    );
    assert.strictEqual(
      auth.formatValidationErrorMessage('email', 'value is not a valid email address: ...'),
      'Định dạng email không hợp lệ (ví dụ: ten@domain.com).'
    );
    assert.strictEqual(
      auth.formatValidationErrorMessage('full_name', 'String should have at most 150 characters'),
      'Họ và tên không được vượt quá 150 ký tự.'
    );
  });

  // Async submission simulation helper
  async function submitWithMock(statusCode, responseBody) {
    env.context.fetch = async () => ({
      status: statusCode,
      json: async () => responseBody,
    });
    auth.clearAllFieldErrors();
    auth.clearAlert();
    await auth.submitRegistration({
      email: 'user@example.com',
      password: 'Password123',
    });
  }

  await runAsyncTest('HTTP 422: Single password error maps to #regPasswordError', async () => {
    await submitWithMock(422, {
      success: false,
      error_code: 'VALIDATION_ERROR',
      details: [
        { field: 'body -> password', message: 'String should have at most 128 characters' }
      ]
    });
    assert.strictEqual(
      elements.regPasswordError.textContent,
      'Mật khẩu không được vượt quá 128 ký tự.'
    );
    assert(
      elements.registerAlert.textContent.includes('Thông tin đăng ký chưa hợp lệ'),
      'Expected alert banner for mapped fields'
    );
  });

  await runAsyncTest('HTTP 422: Multiple field errors map simultaneously to corresponding inputs', async () => {
    await submitWithMock(422, {
      success: false,
      error_code: 'VALIDATION_ERROR',
      details: [
        { field: 'body -> email', message: 'value is not a valid email address: ...' },
        { field: 'body -> password', message: 'Value error, Password must contain at least one digit.' },
        { field: 'body -> full_name', message: 'String should have at most 150 characters' }
      ]
    });
    assert.strictEqual(
      elements.regEmailError.textContent,
      'Định dạng email không hợp lệ (ví dụ: ten@domain.com).'
    );
    assert.strictEqual(
      elements.regPasswordError.textContent,
      'Mật khẩu phải chứa ít nhất một chữ số.'
    );
    assert.strictEqual(
      elements.regFullNameError.textContent,
      'Họ và tên không được vượt quá 150 ký tự.'
    );
  });

  await runAsyncTest('HTTP 422: Unmapped field errors fall back to banner alert', async () => {
    await submitWithMock(422, {
      success: false,
      error_code: 'VALIDATION_ERROR',
      details: [
        { field: 'headers -> custom_auth_token', message: 'Missing custom authorization token' }
      ]
    });
    assert.strictEqual(elements.regPasswordError.textContent, '');
    assert.strictEqual(elements.regEmailError.textContent, '');
    assert(
      elements.registerAlert.textContent.includes('Missing custom authorization token'),
      'Expected banner to display unmapped message'
    );
  });

  await runAsyncTest('HTTP 422: Empty details array falls back to banner alert', async () => {
    await submitWithMock(422, {
      success: false,
      error_code: 'VALIDATION_ERROR',
      message: 'General schema validation failed',
      details: []
    });
    assert.strictEqual(elements.regPasswordError.textContent, '');
    assert.strictEqual(elements.registerAlert.textContent, 'General schema validation failed');
  });

  await runAsyncTest('HTTP 400: EMAIL_ALREADY_EXISTS regression check', async () => {
    await submitWithMock(400, {
      success: false,
      error_code: 'EMAIL_ALREADY_EXISTS',
      message: 'Email already registered.'
    });
    assert.strictEqual(elements.regEmailError.textContent, 'Email đã tồn tại trong hệ thống.');
    assert(elements.registerAlert.textContent.includes('Email này đã được sử dụng'));
  });

  await runAsyncTest('HTTP 201: Registration success regression check', async () => {
    await submitWithMock(201, {
      success: true,
      data: { id: 1, email: 'user@example.com' }
    });
    assert(elements.registerAlert.textContent.includes('Đăng ký tài khoản thành công'));
  });

  await runAsyncTest('Network Error: Fetch rejection handled gracefully in alert banner', async () => {
    env.context.fetch = async () => { throw new Error('Network offline'); };
    auth.clearAllFieldErrors();
    auth.clearAlert();
    await auth.submitRegistration({ email: 'u@e.com', password: 'Password1' });
    assert(elements.registerAlert.textContent.includes('Không thể kết nối đến máy chủ'));
  });

  await runAsyncTest('Security: HTML Injection / XSS defense using textContent', async () => {
    const maliciousPayload = '<img src=x onerror="alert(document.cookie)">';
    await submitWithMock(422, {
      success: false,
      error_code: 'VALIDATION_ERROR',
      details: [
        { field: 'body -> password', message: maliciousPayload }
      ]
    });
    // Element must contain the raw string safely, not execute or parse HTML
    assert.strictEqual(elements.regPasswordError.textContent, maliciousPayload);
  });

  runTest('UX: Field error cleanup clears error on field input', () => {
    elements.regFullName.value = 'Valid Name';
    auth.showFieldError(elements.regFullName, 'Old error message');
    assert.strictEqual(elements.regFullNameError.textContent, 'Old error message');
    assert(elements.regFullName.classList.contains('has-error'));

    auth.clearFieldError(elements.regFullName);
    assert.strictEqual(elements.regFullNameError.textContent, '');
    assert(!elements.regFullName.classList.contains('has-error'));
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (${totalTests - passedTests} failed).`);
  console.log('================================================================');
})();
