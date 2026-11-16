const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../js/auth.js'), 'utf8');

class ClassList {
  constructor() {
    this.values = new Set();
  }
  add(v) {
    this.values.add(v);
  }
  remove(v) {
    this.values.delete(v);
  }
  contains(v) {
    return this.values.has(v);
  }
}

class Element {
  constructor(id) {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.src = '';
    this.classList = new ClassList();
    this.style = {};
    this.disabled = false;
    this.attributes = {};
    this.listeners = {};
    this.files = [];
    this.clicked = false;
    this.focused = false;
  }
  focus() {
    this.focused = true;
  }
  click() {
    this.clicked = true;
    this.trigger('click', { target: this, preventDefault: () => {} });
  }
  reset() {
    this.value = '';
    this.files = [];
  }
  setAttribute(k, v) {
    this.attributes[k] = v;
  }
  getAttribute(k) {
    return this.attributes[k];
  }
  removeAttribute(k) {
    delete this.attributes[k];
  }
  hasAttribute(k) {
    return Object.prototype.hasOwnProperty.call(this.attributes, k);
  }
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
  constructor() {
    this.store = {};
  }
  getItem(k) {
    return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null;
  }
  setItem(k, v) {
    this.store[k] = String(v);
  }
  removeItem(k) {
    delete this.store[k];
  }
  clear() {
    this.store = {};
  }
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
    'accountAvatarLarge', 'accountAvatarInitial', 'accountAvatarImg', 'btnSelectAvatar',
    'avatarFileInput', 'btnTriggerAvatarUpload', 'btnDeleteAvatar', 'avatarDeleteConfirmBox',
    'btnCancelDeleteAvatar', 'btnConfirmDeleteAvatar', 'accountFullNameDisplay', 'accountEmailSubDisplay',
    'accountDetailFullName', 'accountDetailEmail', 'accountDetailRole', 'accountDetailStatus',
    'accountFullNameView', 'accountEditForm', 'btnToggleEditFullName', 'editFullNameInput',
    'editFullNameInputError', 'btnCancelEditFullName', 'btnSaveFullName', 'editFullNameSpinner',
    'editFullNameBtnText', 'btnAccountUpgradePro', 'btnOpenAdmin',
    'changePasswordForm', 'changePasswordAlert', 'currentPasswordInput', 'currentPasswordInputError',
    'newPasswordInput', 'newPasswordInputError', 'confirmNewPasswordInput', 'confirmNewPasswordInputError',
    'btnSubmitChangePassword', 'btnCancelChangePassword', 'changePasswordSpinner', 'changePasswordBtnText',
    'btnToggleCurrentPassword', 'btnToggleNewPassword', 'btnToggleConfirmPassword',
    'changePasswordFormWrap', 'btnOpenChangePassword',
  ];

  const elements = {};
  ids.forEach((id) => {
    elements[id] = new Element(id);
  });

  const localStorage = new MockLocalStorage();
  const sessionStorage = new MockLocalStorage();

  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    body: { style: {} },
    addEventListener: () => {},
  };

  const mockWindow = {
    location: { reload: () => {} },
    localStorage: localStorage,
    sessionStorage: sessionStorage,
    URL: {
      createObjectURL: (file) => `blob:mock-url/${file.name}`,
    },
    addEventListener: () => {},
  };

  const context = {
    document: mockDocument,
    window: mockWindow,
    localStorage: localStorage,
    sessionStorage: sessionStorage,
    console: console,
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    URL: mockWindow.URL,
    FileReader: class {
      readAsDataURL(file) {
        if (typeof this.onload === 'function') {
          this.onload({ target: { result: `data:image/png;base64,mock_${file.name}` } });
        }
      }
    },
  };

  vm.createContext(context);
  vm.runInContext(source, context);

  return { context, elements, localStorage, sessionStorage };
}

let passCount = 0;
let failCount = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failCount++;
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('Account Modal Avatar UI & Interaction Test Suite');
  console.log('================================================================');

// 1. Initial State & Render Details without Avatar
await runTest('Account Details without Avatar: Renders initial letter and hides image & delete button', () => {
  const { context, elements } = createEnv();
  const auth = context.window.pdfLinguaAuth;
  auth.initAccountModal();

  auth.renderAccountDetails({
    id: 1,
    email: 'user@example.com',
    full_name: 'Nguyễn Văn A',
    avatar_url: null,
  });

  assert.strictEqual(elements.accountAvatarInitial.textContent, 'N');
  assert.strictEqual(elements.accountAvatarInitial.style.display, 'inline-block');
  assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
  assert.strictEqual(elements.accountAvatarImg.src, '');
  assert.strictEqual(elements.btnDeleteAvatar.style.display, 'none');
  assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'none');
});

// 2. Render Details with Existing Avatar
await runTest('Account Details with Avatar: Displays image, hides initial, and enables delete button', () => {
  const { context, elements } = createEnv();
  const auth = context.window.pdfLinguaAuth;
  auth.initAccountModal();

  auth.renderAccountDetails({
    id: 1,
    email: 'avatar_user@example.com',
    full_name: 'Trần Thị B',
    avatar_url: '/api/storage/avatars/1/custom_avatar.png',
  });

  assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/1/custom_avatar.png');
  assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
  assert.strictEqual(elements.accountAvatarInitial.style.display, 'none');
  assert.strictEqual(elements.btnDeleteAvatar.style.display, 'inline-flex');
  assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'none');
});

// 3. Camera Button & Quick Action Trigger File Input
await runTest('Camera button and change button trigger file input click', () => {
  const { context, elements } = createEnv();
  const auth = context.window.pdfLinguaAuth;
  auth.initAccountModal();

  let fileInputClicked = 0;
  elements.avatarFileInput.click = () => {
    fileInputClicked++;
  };

  // Click on camera button
  elements.btnSelectAvatar.trigger('click', { preventDefault: () => {} });
  assert.strictEqual(fileInputClicked, 1, 'Camera button should trigger file input click');

  // Keydown Enter on camera button
  elements.btnSelectAvatar.trigger('keydown', { key: 'Enter', preventDefault: () => {} });
  assert.strictEqual(fileInputClicked, 2, 'Enter key on camera button should trigger file input click');

  // Keydown Space on camera button
  elements.btnSelectAvatar.trigger('keydown', { key: ' ', preventDefault: () => {} });
  assert.strictEqual(fileInputClicked, 3, 'Space key on camera button should trigger file input click');

  // Click on action button
  elements.btnTriggerAvatarUpload.trigger('click', { preventDefault: () => {} });
  assert.strictEqual(fileInputClicked, 4, 'Change avatar action button should trigger file input click');
});

// 4. File Selection: Unsupported Media Type Rejection
await runTest('File Selection Validation: Rejects disallowed format and clears input', () => {
  const { context, elements } = createEnv();
  const auth = context.window.pdfLinguaAuth;
  auth.initAccountModal();

  elements.avatarFileInput.files = [
    { name: 'document.pdf', type: 'application/pdf', size: 1024 * 50 },
  ];
  elements.avatarFileInput.value = 'C:\\fakepath\\document.pdf';

  elements.avatarFileInput.trigger('change', { target: elements.avatarFileInput });

  assert.strictEqual(elements.accountAlert.style.display, 'block');
  assert.ok(elements.accountAlert.textContent.includes('không được hỗ trợ'));
  assert.strictEqual(elements.avatarFileInput.value, '');
  assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
});

// 5. File Selection: Oversized File Rejection (> 2 MB)
await runTest('File Selection Validation: Rejects files exceeding 2 MB', () => {
  const { context, elements } = createEnv();
  const auth = context.window.pdfLinguaAuth;
  auth.initAccountModal();

  elements.avatarFileInput.files = [
    { name: 'large_photo.png', type: 'image/png', size: 3 * 1024 * 1024 },
  ];
  elements.avatarFileInput.value = 'C:\\fakepath\\large_photo.png';

  elements.avatarFileInput.trigger('change', { target: elements.avatarFileInput });

  assert.strictEqual(elements.accountAlert.style.display, 'block');
  assert.ok(elements.accountAlert.textContent.includes('2 MB'));
  assert.strictEqual(elements.avatarFileInput.value, '');
  assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
});

// 6. File Selection: Valid Image Sets Preview (JPEG, PNG, WebP)
await runTest('File Selection: Valid images create preview and show delete button', () => {
  const { context, elements } = createEnv();
  const auth = context.window.pdfLinguaAuth;
  auth.initAccountModal();

  const validFormats = [
    { name: 'photo.jpg', type: 'image/jpeg', size: 500 * 1024 },
    { name: 'graphic.png', type: 'image/png', size: 800 * 1024 },
    { name: 'modern.webp', type: 'image/webp', size: 300 * 1024 },
  ];

  validFormats.forEach((fileObj) => {
    elements.avatarFileInput.files = [fileObj];
    elements.avatarFileInput.value = `C:\\fakepath\\${fileObj.name}`;

    elements.avatarFileInput.trigger('change', { target: elements.avatarFileInput });

    assert.strictEqual(elements.accountAlert.style.display, 'none');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
    assert.ok(elements.accountAvatarImg.src.includes(fileObj.name));
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'none');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'inline-flex');
  });
});

// 7. Delete Avatar Confirmation Interaction: Open & Cancel
await runTest('Delete Avatar Confirmation: Open confirm box and cancel preserves state', () => {
  const { context, elements } = createEnv();
  const auth = context.window.pdfLinguaAuth;
  auth.initAccountModal();

  // Set initial preview state
  auth.applyAvatarPreview('blob:mock-url/photo.jpg');
  assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
  assert.strictEqual(elements.btnDeleteAvatar.style.display, 'inline-flex');

  // Click delete button opens confirmation
  elements.btnDeleteAvatar.trigger('click', {});
  assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'flex');

  // Click cancel closes confirmation and preserves image
  elements.btnCancelDeleteAvatar.trigger('click', {});
  assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'none');
  assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
  assert.strictEqual(elements.btnDeleteAvatar.style.display, 'inline-flex');
});

// 8. Delete Avatar Confirmation Interaction: Escape Key Dismissal
await runTest('Delete Avatar Confirmation: Escape key closes confirmation box', () => {
  const { context, elements } = createEnv();
  const auth = context.window.pdfLinguaAuth;
  auth.initAccountModal();

  auth.applyAvatarPreview('blob:mock-url/photo.jpg');
  elements.btnDeleteAvatar.trigger('click', {});
  assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'flex');

  elements.avatarDeleteConfirmBox.trigger('keydown', { key: 'Escape' });
  assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'none');
});

// 9. Delete Avatar Confirmation Interaction: Confirm Deletion
await runTest('Delete Avatar Confirmation: Confirming reset removes preview, hides delete button, and clears input', async () => {
  const { context, elements, localStorage } = createEnv();
  localStorage.setItem('pdfl_token', 'mock_jwt_token');
  localStorage.setItem(
    'pdfl_user',
    JSON.stringify({ id: 1, full_name: 'Test', email: 'test@example.com', avatar_url: 'blob:mock-url/photo.jpg' })
  );
  const auth = context.window.pdfLinguaAuth;
  auth.initAccountModal();

  auth.applyAvatarPreview('blob:mock-url/photo.jpg');
  elements.avatarFileInput.value = 'C:\\fakepath\\photo.jpg';

  elements.btnDeleteAvatar.trigger('click', {});
  await auth.handleConfirmDeleteAvatar();

  assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
  assert.strictEqual(elements.accountAvatarImg.src, '');
  assert.strictEqual(elements.accountAvatarInitial.style.display, 'inline-block');
  assert.strictEqual(elements.btnDeleteAvatar.style.display, 'none');
  assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'none');
  assert.strictEqual(elements.avatarFileInput.value, '');
});

// 10. Close Modal Cleans Up Confirmation Box
await runTest('Modal Lifecycle: Closing account modal closes any active delete confirmation', () => {
  const { context, elements } = createEnv();
  const auth = context.window.pdfLinguaAuth;
  auth.initAccountModal();

  auth.applyAvatarPreview('blob:mock-url/photo.jpg');
  elements.btnDeleteAvatar.trigger('click', {});
  assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'flex');

  // Trigger modal close
  auth.closeAccountModal();
  assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'none');
});

// 11. Header Avatar Synchronization
await runTest('Header Auth State: Synchronizes avatar image when avatar_url is provided and text initial when null', () => {
  const { context, elements } = createEnv();
  const auth = context.window.pdfLinguaAuth;

  // With avatar_url
  auth.updateHeaderAuthState({
    id: 10,
    email: 'test@example.com',
    full_name: 'Lê Hoàng',
    avatar_url: '/api/storage/avatars/10/img.webp',
  });
  assert.ok(elements.userAvatar.innerHTML.includes('<img src="/api/storage/avatars/10/img.webp"'));
  assert.ok(elements.userAvatar.innerHTML.includes('header-user-avatar-img'));

  // Without avatar_url
  auth.updateHeaderAuthState({
    id: 10,
    email: 'test@example.com',
    full_name: 'Lê Hoàng',
    avatar_url: null,
  });
  assert.strictEqual(elements.userAvatar.textContent, 'L');
});

  console.log('================================================================');
  console.log(`SUMMARY: ${passCount}/${passCount + failCount} avatar modal tests passed (${failCount} failed).`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite();
