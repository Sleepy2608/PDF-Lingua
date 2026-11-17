const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const authSource = fs.readFileSync(path.resolve(__dirname, '../js/auth.js'), 'utf8');
const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../js/sidebar.js'), 'utf8');

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
  toggle(v, force) {
    if (typeof force === 'boolean') {
      if (force) this.add(v); else this.remove(v);
    } else {
      if (this.contains(v)) this.remove(v); else this.add(v);
    }
  }
}

class Element {
  constructor(id, tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.value = '';
    this.textContent = '';
    this._innerHTML = '';
    this._imgChild = null;
    this.src = '';
    this.naturalWidth = 800;
    this.naturalHeight = 600;
    this.width = 800;
    this.height = 600;
    this.clientWidth = 320;
    this.clientHeight = 320;
    this.classList = new ClassList();
    this.style = {};
    this.disabled = false;
    this.attributes = {};
    this.listeners = {};
    this.files = [];
    this.clicked = false;
    this.focused = false;
  }
  get innerHTML() {
    return this._innerHTML;
  }
  set innerHTML(val) {
    this._innerHTML = val;
    this._imgChild = null;
    if (typeof val === 'string' && val.includes('<img')) {
      const match = val.match(/<img[^>]*src="([^"]*)"/);
      if (match) {
        this._imgChild = new Element('inner_img', 'img');
        this._imgChild.src = match[1];
        this._imgChild.parentElement = this;
      }
    }
  }
  focus() {
    this.focused = true;
  }
  reset() {
    this.value = '';
  }
  click() {
    this.clicked = true;
    this.trigger('click', { target: this, preventDefault: () => {} });
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
  trigger(event, data = {}) {
    if (typeof this[`on${event}`] === 'function') {
      try {
        this[`on${event}`](data);
      } catch (_e) {}
    }
    if (this.listeners[event]) {
      this.listeners[event].forEach((fn) => fn(data));
    }
  }
  querySelector(sel) {
    if (sel === 'img') {
      return this._imgChild;
    }
    if (sel === '.avatar-crop-mask') {
      const maskEl = new Element('mock_mask');
      maskEl.clientWidth = 240;
      maskEl.clientHeight = 240;
      return maskEl;
    }
    return null;
  }
  setPointerCapture() {}
  releasePointerCapture() {}
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

class MockFormData {
  constructor() {
    this.entries = [];
  }
  append(key, value, filename) {
    this.entries.push({ key, value, filename });
  }
  get(key) {
    const item = this.entries.find((e) => e.key === key);
    return item ? item.value : null;
  }
}

class MockCanvasContext {
  constructor() {
    this.drawCalls = [];
  }
  drawImage(...args) {
    this.drawCalls.push(args);
  }
}

class MockCanvas {
  constructor(shouldFailContext = false, shouldFailBlob = false) {
    this.width = 400;
    this.height = 400;
    this.ctx = shouldFailContext ? null : new MockCanvasContext();
    this.shouldFailBlob = shouldFailBlob;
  }
  getContext(type) {
    return type === '2d' ? this.ctx : null;
  }
  toBlob(callback, type = 'image/png') {
    if (this.shouldFailBlob) {
      callback(null);
      return;
    }
    const mockBlob = {
      size: 1024 * 35,
      type: type,
      name: 'cropped.png',
    };
    callback(mockBlob);
  }
  toDataURL(type = 'image/png') {
    return `data:${type};base64,mockBase64String`;
  }
}

function createIntegrationEnv(fetchHandler, canvasOptions = {}) {
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
    // Avatar crop elements
    'avatarCropModal', 'avatarCropModalTitle', 'btnCloseAvatarCropModal',
    'avatarCropAlert', 'avatarCropViewport', 'avatarCropImg',
    'btnCropZoomOut', 'cropZoomRange', 'btnCropZoomIn', 'cropZoomValue',
    'btnCancelAvatarCrop', 'btnConfirmAvatarCrop', 'cropConfirmSpinner', 'cropConfirmBtnText',
    // Sidebar elements
    'appSidebar', 'btnToggleSidebar', 'btnMobileSidebarToggle', 'sidebarBackdrop',
    'btnSidebarUpload', 'sidebarUserProfile', 'btnSidebarMore', 'sidebarUserAvatar',
    'sidebarUserName', 'sidebarUserRole', 'sideNavAdminItem', 'appShell',
    'sideNavAiCopilot', 'sideNavAiSummarize', 'btnAiSummarize', 'btnAiCopilot',
  ];

  const elements = {};
  ids.forEach((id) => {
    elements[id] = new Element(id);
  });

  const localStorage = new MockLocalStorage();
  const sessionStorage = new MockLocalStorage();
  const dispatchedEvents = [];
  const windowListeners = {};
  const docListeners = {};
  const revokedUrls = [];

  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    createElement: (tag) => {
      if (tag === 'canvas') {
        return new MockCanvas(canvasOptions.failContext, canvasOptions.failBlob);
      }
      return new Element(`tag_${tag}`, tag);
    },
    body: { style: {} },
    addEventListener: (event, fn) => {
      docListeners[event] = docListeners[event] || [];
      docListeners[event].push(fn);
    },
    trigger: (event, data = {}) => {
      if (docListeners[event]) {
        docListeners[event].forEach((fn) => fn(data));
      }
    },
  };

  const mockWindow = {
    location: { reload: () => {} },
    localStorage: localStorage,
    sessionStorage: sessionStorage,
    URL: {
      createObjectURL: (obj) => `blob:mock/${(obj && obj.name) || 'obj'}`,
      revokeObjectURL: (url) => revokedUrls.push(url),
    },
    addEventListener: (event, fn) => {
      windowListeners[event] = windowListeners[event] || [];
      windowListeners[event].push(fn);
    },
    dispatchEvent: (evt) => {
      dispatchedEvents.push(evt);
      if (windowListeners[evt.type]) {
        windowListeners[evt.type].forEach((fn) => fn(evt));
      }
      return true;
    },
    innerWidth: 1024,
  };

  const defaultFetch = () =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: { avatar_url: '/api/storage/avatars/42/uploaded_avatar.png?v=1' },
        }),
    });

  const context = {
    document: mockDocument,
    window: mockWindow,
    localStorage: localStorage,
    sessionStorage: sessionStorage,
    console: console,
    FormData: MockFormData,
    CustomEvent: function (type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    },
    fetch: fetchHandler || defaultFetch,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    URL: mockWindow.URL,
    File: function (parts, filename, opts = {}) {
      this.parts = parts;
      this.name = filename;
      this.type = opts.type || 'image/png';
      this.size = opts.size || 1024 * 40;
    },
    FileReader: class {
      readAsDataURL(file) {
        if (typeof this.onload === 'function') {
          this.onload({ target: { result: `data:image/png;base64,mock_${file.name}` } });
        }
      }
    },
  };

  vm.createContext(context);
  vm.runInContext(authSource, context);
  vm.runInContext(sidebarSource, context);
  mockDocument.trigger('DOMContentLoaded');

  return {
    context,
    elements,
    localStorage,
    sessionStorage,
    auth: context.window.pdfLinguaAuth,
    sidebar: context.window.PDFLinguaSidebar,
    dispatchedEvents,
    revokedUrls,
  };
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
  console.log('User Avatar Lifecycle Integration & Regression Test Suite');
  console.log('================================================================');

  // 1. Complete Happy Path Avatar Lifecycle
  await runTest('Lifecycle Happy Path: Select, validate, crop, upload, sync across UI, restore session, and delete', async () => {
    let uploadFormDataReceived = null;
    let deleteCalled = false;

    const env = createIntegrationEnv((url, opts = {}) => {
      if (url.includes('/api/auth/me/avatar') && opts.method === 'POST') {
        uploadFormDataReceived = opts.body;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { avatar_url: '/api/storage/avatars/42/avatar_hero.png?v=999' },
            }),
        });
      }
      if (url.includes('/api/auth/me/avatar') && opts.method === 'DELETE') {
        deleteCalled = true;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, message: 'Đã xóa avatar.' }),
        });
      }
      if (url.includes('/api/auth/me') && opts.method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: 42,
                full_name: 'Tran Thanh',
                email: 'thanh@example.com',
                role: 'free',
                avatar_url: '/api/storage/avatars/42/avatar_hero.png?v=999',
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    const { elements, auth, localStorage, revokedUrls } = env;

    // Step A: Initial session without avatar
    localStorage.setItem('pdfl_token', 'jwt_lifecycle_test');
    localStorage.setItem(
      'pdfl_user',
      JSON.stringify({
        id: 42,
        full_name: 'Tran Thanh',
        email: 'thanh@example.com',
        role: 'free',
        avatar_url: null,
      })
    );

    auth.initAccountModal();
    auth.initAvatarCropModal();
    auth.updateHeaderAuthState({
      id: 42,
      full_name: 'Tran Thanh',
      email: 'thanh@example.com',
      role: 'free',
      avatar_url: null,
    });

    // Verify initial letter 'T' everywhere
    assert.strictEqual(elements.userAvatar.textContent, 'T');
    assert.strictEqual(elements.sidebarUserAvatar.textContent, 'T');

    // Step B: Open Account Modal
    auth.openAccountModal();
    assert.strictEqual(elements.accountAvatarInitial.textContent, 'T');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'inline-block');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'none');

    // Step C: Select valid image via file input
    const mockFile = {
      name: 'profile_pic.png',
      type: 'image/png',
      size: 1024 * 180, // 180 KB
    };
    elements.avatarFileInput.files = [mockFile];
    elements.avatarFileInput.trigger('change');

    // Verify Crop Modal opened
    assert.strictEqual(elements.avatarCropModal.style.display, 'flex');
    elements.avatarCropImg.trigger('load');

    // Step D: Confirm crop
    const cropSuccess = await auth.confirmAvatarCrop();
    assert.strictEqual(cropSuccess, true);

    // Verify temp URL was revoked
    assert.ok(revokedUrls.length > 0, 'Temporary object URL must be revoked');

    // Verify multipart FormData was uploaded
    assert.ok(uploadFormDataReceived, 'Upload must call POST with FormData');
    assert.ok(uploadFormDataReceived.get('file'), 'FormData must include file field');

    // Verify immediate UI updates across all 3 locations
    assert.ok(elements.userAvatar.innerHTML.includes('/api/storage/avatars/42/avatar_hero.png?v=999'));
    assert.ok(elements.userAvatar.innerHTML.includes('header-user-avatar-img'));
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/avatar_hero.png?v=999');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'none');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'inline-flex');
    assert.ok(elements.sidebarUserAvatar.innerHTML.includes('/api/storage/avatars/42/avatar_hero.png?v=999'));
    assert.ok(elements.sidebarUserAvatar.innerHTML.includes('sidebar-avatar-img'));

    // Verify localStorage session holds fresh avatar_url
    const sessionUser = JSON.parse(localStorage.getItem('pdfl_user'));
    assert.strictEqual(sessionUser.avatar_url, '/api/storage/avatars/42/avatar_hero.png?v=999');

    // Step E: Simulate page reload / restoreSession
    await auth.restoreSession();
    assert.ok(elements.userAvatar.innerHTML.includes('/api/storage/avatars/42/avatar_hero.png?v=999'));
    assert.ok(elements.sidebarUserAvatar.innerHTML.includes('/api/storage/avatars/42/avatar_hero.png?v=999'));

    // Step F: Delete avatar via Account Modal
    elements.btnDeleteAvatar.trigger('click');
    assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'flex');

    const deleteSuccess = await auth.handleConfirmDeleteAvatar();
    assert.strictEqual(deleteSuccess, true);
    assert.strictEqual(deleteCalled, true);

    // Verify all 3 locations immediately reset to text initial
    assert.strictEqual(elements.userAvatar.textContent, 'T');
    assert.strictEqual(elements.userAvatar.innerHTML, '');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'inline-block');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'none');
    assert.strictEqual(elements.sidebarUserAvatar.textContent, 'T');
    assert.strictEqual(elements.sidebarUserAvatar.innerHTML, '');

    // Step G: Logout and verify Guest UI
    await auth.handleLogout();
    assert.strictEqual(elements.authGuestGroup.style.display, 'flex');
    assert.strictEqual(elements.authUserGroup.style.display, 'none');
    assert.strictEqual(elements.userAvatar.textContent, '');
    assert.ok(elements.sidebarUserAvatar.innerHTML.includes('<svg'));
    assert.strictEqual(elements.sidebarUserName.textContent, 'Khách');
  });

  // 2. Role Preservation across Avatar Operations (Free, Pro, Admin)
  await runTest('Role Preservation: Operations preserve Pro & Admin status and styling', async () => {
    const env = createIntegrationEnv();
    const { elements, auth, localStorage } = env;

    // Test Pro user styling
    localStorage.setItem('pdfl_token', 'jwt_pro_token');
    const proUser = {
      id: 50,
      full_name: 'Pro Member',
      email: 'pro@example.com',
      role: 'pro',
      avatar_url: '/api/storage/avatars/50/pic.png',
    };
    localStorage.setItem('pdfl_user', JSON.stringify(proUser));

    auth.updateHeaderAuthState(proUser);
    assert.strictEqual(elements.sidebarUserRole.textContent, 'Gói Pro');
    assert.strictEqual(elements.sideNavAdminItem.style.display, 'none');

    // Test Admin user styling
    const adminUser = {
      id: 1,
      full_name: 'Admin Manager',
      email: 'admin@example.com',
      role: 'admin',
      avatar_url: '/api/storage/avatars/1/admin.png',
    };
    localStorage.setItem('pdfl_user', JSON.stringify(adminUser));

    auth.updateHeaderAuthState(adminUser);
    assert.strictEqual(elements.sidebarUserRole.textContent, 'Quản trị viên');
    assert.strictEqual(elements.sidebarUserRole.style.color, '#C9201C');
    assert.strictEqual(elements.sideNavAdminItem.style.display, 'block');
  });

  // 3. Client-Side Input Validation Failures
  await runTest('Validation Failures: Rejects non-image types, files > 2 MB, and 0-byte files before crop modal opens', () => {
    const { elements, auth } = createIntegrationEnv();

    auth.initAccountModal();
    auth.initAvatarCropModal();

    // Rejects PDF file
    elements.avatarFileInput.files = [{ name: 'document.pdf', type: 'application/pdf', size: 1024 * 50 }];
    elements.avatarFileInput.trigger('change');
    assert.ok(!elements.avatarCropModal.style.display || elements.avatarCropModal.style.display === 'none');
    assert.ok(elements.accountAlert.textContent.includes('không được hỗ trợ'));

    // Rejects GIF file
    elements.avatarFileInput.files = [{ name: 'animation.gif', type: 'image/gif', size: 1024 * 50 }];
    elements.avatarFileInput.trigger('change');
    assert.ok(!elements.avatarCropModal.style.display || elements.avatarCropModal.style.display === 'none');

    // Rejects file > 2 MB
    elements.avatarFileInput.files = [{ name: 'large.png', type: 'image/png', size: 2.5 * 1024 * 1024 }];
    elements.avatarFileInput.trigger('change');
    assert.ok(!elements.avatarCropModal.style.display || elements.avatarCropModal.style.display === 'none');
    assert.strictEqual(elements.accountAlert.textContent.includes('2 MB'), true);

    // Rejects 0-byte file
    elements.avatarFileInput.files = [{ name: 'empty.png', type: 'image/png', size: 0 }];
    elements.avatarFileInput.trigger('change');
    assert.ok(!elements.avatarCropModal.style.display || elements.avatarCropModal.style.display === 'none');
  });

  // 4. Crop Modal Failures (Corrupt image, Canvas failures)
  await runTest('Crop Failures: Corrupted image or Canvas failure halts gracefully and restores controls', async () => {
    const env = createIntegrationEnv(null, { failBlob: true });
    const { elements, auth } = env;

    auth.initAvatarCropModal();

    // Corrupted image load
    auth.openAvatarCropModal({ name: 'corrupt.jpg', type: 'image/jpeg' });
    elements.avatarCropImg.trigger('error');
    assert.strictEqual(elements.btnConfirmAvatarCrop.disabled, true);
    assert.ok(elements.avatarCropAlert.textContent.includes('Không thể tải hoặc xử lý'));

    // Canvas toBlob failure
    auth.openAvatarCropModal({ name: 'normal.jpg', type: 'image/jpeg' });
    elements.avatarCropImg.trigger('load');

    const result = await auth.confirmAvatarCrop();
    assert.strictEqual(result, false);
    assert.strictEqual(elements.avatarCropAlert.textContent.includes('Không thể xử lý cắt ảnh'), true);
    assert.strictEqual(elements.btnConfirmAvatarCrop.disabled, false);
    assert.strictEqual(elements.btnCancelAvatarCrop.disabled, false);
  });

  // 5. Upload API Failure Scenarios (401, 403, 500, Network error)
  await runTest('Upload Failures: HTTP 401, 403, 500, and network error preserve existing avatar and restore state', async () => {
    let mockStatus = 500;
    let shouldRejectNetwork = false;

    const env = createIntegrationEnv((url) => {
      if (shouldRejectNetwork) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: mockStatus >= 200 && mockStatus < 300,
        status: mockStatus,
        json: () => Promise.resolve({ message: 'Error occurred' }),
      });
    });

    const { elements, auth, localStorage } = env;

    localStorage.setItem('pdfl_token', 'jwt_fail_test');
    localStorage.setItem(
      'pdfl_user',
      JSON.stringify({ id: 10, full_name: 'Lan', email: 'lan@example.com', avatar_url: '/api/storage/avatars/10/existing.png' })
    );

    auth.initAccountModal();
    auth.initAvatarCropModal();

    const sampleFile = { name: 'new.png', type: 'image/png', size: 1024 * 20 };

    // 500 Error
    mockStatus = 500;
    const res500 = await auth.uploadCroppedAvatar(sampleFile);
    assert.strictEqual(res500, false);
    assert.strictEqual(auth.getIsUploadingAvatar(), false);

    // Network offline
    shouldRejectNetwork = true;
    const resNet = await auth.uploadCroppedAvatar(sampleFile);
    assert.strictEqual(resNet, false);
    assert.strictEqual(auth.getIsUploadingAvatar(), false);

    // 403 Forbidden
    shouldRejectNetwork = false;
    mockStatus = 403;
    const res403 = await auth.uploadCroppedAvatar(sampleFile);
    assert.strictEqual(res403, false);
    assert.strictEqual(localStorage.getItem('pdfl_token'), 'jwt_fail_test'); // session kept

    // 401 Session expired
    mockStatus = 401;
    const res401 = await auth.uploadCroppedAvatar(sampleFile);
    assert.strictEqual(res401, false);
    assert.strictEqual(localStorage.getItem('pdfl_token'), null); // session cleared
  });

  // 6. Delete API Failure Scenarios (401, 403, 500, Network error)
  await runTest('Delete Failures: HTTP 401, 403, 500, and network failure handle state without losing avatar', async () => {
    let mockDeleteStatus = 500;
    let shouldRejectDelete = false;

    const env = createIntegrationEnv((url, opts = {}) => {
      if (shouldRejectDelete) return Promise.reject(new Error('Network offline'));
      return Promise.resolve({
        ok: mockDeleteStatus >= 200 && mockDeleteStatus < 300,
        status: mockDeleteStatus,
        json: () => Promise.resolve({ message: 'Delete error' }),
      });
    });

    const { elements, auth, localStorage } = env;

    localStorage.setItem('pdfl_token', 'jwt_delete_fail');
    localStorage.setItem(
      'pdfl_user',
      JSON.stringify({ id: 12, full_name: 'Dung', email: 'dung@example.com', avatar_url: '/api/storage/avatars/12/saved.png' })
    );

    auth.initAccountModal();
    auth.applyAvatarPreview('/api/storage/avatars/12/saved.png');

    // 500 Error
    mockDeleteStatus = 500;
    const del500 = await auth.handleConfirmDeleteAvatar();
    assert.strictEqual(del500, false);
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block'); // preview kept
    assert.strictEqual(auth.getIsDeletingAvatar(), false);

    // Network error
    shouldRejectDelete = true;
    const delNet = await auth.handleConfirmDeleteAvatar();
    assert.strictEqual(delNet, false);
    assert.strictEqual(auth.getIsDeletingAvatar(), false);

    // 403 Forbidden
    shouldRejectDelete = false;
    mockDeleteStatus = 403;
    const del403 = await auth.handleConfirmDeleteAvatar();
    assert.strictEqual(del403, false);
    assert.strictEqual(localStorage.getItem('pdfl_token'), 'jwt_delete_fail');

    // 401 Unauthorized
    mockDeleteStatus = 401;
    const del401 = await auth.handleConfirmDeleteAvatar();
    assert.strictEqual(del401, false);
    assert.strictEqual(localStorage.getItem('pdfl_token'), null);
  });

  // 7. Object URL Lifecycle & Memory Management
  await runTest('Memory Management: Object URLs are cleaned up on crop cancel, crop confirm, and avatar replace', () => {
    const env = createIntegrationEnv();
    const { auth, revokedUrls } = env;

    auth.initAvatarCropModal();

    // Open and cancel crop
    auth.openAvatarCropModal({ name: 'temp1.png', type: 'image/png' });
    auth.closeAvatarCropModal(false);
    assert.strictEqual(revokedUrls.length, 1);

    // Open and replace with another file
    auth.openAvatarCropModal({ name: 'temp2.png', type: 'image/png' });
    auth.openAvatarCropModal({ name: 'temp3.png', type: 'image/png' });
    assert.strictEqual(revokedUrls.length, 2);

    // Active preview object URL cleanup
    auth.applyAvatarPreview('blob:mock/avatar1');
    auth.applyAvatarPreview('blob:mock/avatar2');
    assert.ok(revokedUrls.includes('blob:mock/avatar1'));
  });

  // 8. Broken Avatar Image Fallback across all locations
  await runTest('Broken Image URLs: Header, Modal, and Sidebar cleanly fallback without recursion', () => {
    const { elements, auth } = createIntegrationEnv();

    auth.initAccountModal();

    // Header image broken
    auth.updateHeaderAuthState({
      id: 7,
      full_name: 'Quang Huy',
      email: 'huy@example.com',
      avatar_url: '/api/storage/avatars/7/broken.png',
    });

    const headerImg = elements.userAvatar.querySelector('img');
    assert.ok(headerImg);
    headerImg.trigger('error');
    assert.strictEqual(elements.userAvatar.textContent, 'Q');

    // Sidebar image broken
    const sidebarImg = elements.sidebarUserAvatar.querySelector('img');
    assert.ok(sidebarImg);
    sidebarImg.trigger('error');
    assert.strictEqual(elements.sidebarUserAvatar.textContent, 'Q');

    // Account Modal image broken
    auth.applyAvatarPreview('/api/storage/avatars/7/broken.png');
    elements.accountAvatarImg.trigger('error');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'inline-block');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'none');
  });

  // 9. Whitespace Trimming & Name Updates
  await runTest('Whitespace & Initial Trimming: Preserves correct initial across leading/trailing whitespace', () => {
    const { elements, auth } = createIntegrationEnv();

    auth.initAccountModal();

    // User with leading whitespace in name
    const spacedUser = {
      id: 8,
      full_name: '    Bao Ngoc   ',
      email: 'ngoc@example.com',
      avatar_url: null,
    };

    auth.updateHeaderAuthState(spacedUser);
    auth.renderAccountDetails(spacedUser);

    assert.strictEqual(elements.userAvatar.textContent, 'B');
    assert.strictEqual(elements.accountAvatarInitial.textContent, 'B');
    assert.strictEqual(elements.sidebarUserAvatar.textContent, 'B');
  });

  console.log('================================================================');
  console.log(`SUMMARY: ${passCount}/${passCount + failCount} integration tests passed (${failCount} failed).`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite();
