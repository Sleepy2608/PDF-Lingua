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
  trigger(event, data = {}) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((fn) => fn(data));
    }
  }
  querySelector(sel) {
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
  constructor() {
    this.width = 400;
    this.height = 400;
    this.ctx = new MockCanvasContext();
  }
  getContext(type) {
    return type === '2d' ? this.ctx : null;
  }
  toBlob(callback, type = 'image/png') {
    const mockBlob = {
      size: 1024 * 30,
      type: type,
      name: 'cropped.png',
    };
    callback(mockBlob);
  }
  toDataURL(type = 'image/png') {
    return `data:${type};base64,mockCanvasBase64Data`;
  }
}

function createEnv(fetchHandler) {
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
  ];

  const elements = {};
  ids.forEach((id) => {
    elements[id] = new Element(id);
  });

  const localStorage = new MockLocalStorage();
  const sessionStorage = new MockLocalStorage();
  localStorage.setItem('pdfl_token', 'mock_jwt_token_xyz');
  localStorage.setItem(
    'pdfl_user',
    JSON.stringify({
      id: 42,
      email: 'alex@example.com',
      full_name: 'Alex Johnson',
      avatar_url: '/api/storage/avatars/42/initial.png',
    })
  );

  let createdCanvas = null;
  const revokedUrls = [];

  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    createElement: (tag) => {
      if (tag === 'canvas') {
        createdCanvas = new MockCanvas();
        return createdCanvas;
      }
      return new Element(`tag_${tag}`);
    },
    body: { style: {} },
    addEventListener: () => {},
  };

  const mockWindow = {
    location: { reload: () => {} },
    localStorage: localStorage,
    sessionStorage: sessionStorage,
    URL: {
      createObjectURL: (obj) => `blob:mock/${(obj && obj.name) || 'obj'}`,
      revokeObjectURL: (url) => revokedUrls.push(url),
    },
    addEventListener: () => {},
  };

  const defaultFetch = () =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          message: 'Cập nhật ảnh đại diện thành công.',
          data: { avatar_url: '/api/storage/avatars/42/new_avatar.png?v=999' },
        }),
    });

  const context = {
    document: mockDocument,
    window: mockWindow,
    localStorage: localStorage,
    sessionStorage: sessionStorage,
    console: console,
    FormData: MockFormData,
    fetch: fetchHandler || defaultFetch,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    URL: mockWindow.URL,
    File: function (parts, filename, opts = {}) {
      this.parts = parts;
      this.name = filename;
      this.type = opts.type || 'image/png';
      this.size = opts.size || (parts && parts[0] && parts[0].size) || 1024 * 50;
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
  vm.runInContext(source, context);

  return {
    context,
    elements,
    localStorage,
    sessionStorage,
    auth: context.window.pdfLinguaAuth,
    getCanvas: () => createdCanvas,
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
  console.log('User Avatar Upload & API Integration Test Suite');
  console.log('================================================================');

  // 1. Upload Success: Updates account preview with server avatar_url and session
  await runTest('Upload Success: POST /api/auth/me/avatar updates preview, session, and closes crop modal', async () => {
    let capturedUrl = '';
    let capturedOptions = null;

    const customFetch = (url, opts) => {
      capturedUrl = url;
      capturedOptions = opts;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            message: 'Cập nhật ảnh đại diện thành công.',
            data: { avatar_url: '/api/storage/avatars/42/uploaded_avatar.png?v=12345' },
          }),
      });
    };

    const env = createEnv(customFetch);
    const { elements, auth, localStorage } = env;

    auth.initAccountModal();
    auth.initAvatarCropModal();

    // Initial avatar in account modal
    elements.accountAvatarImg.src = '/api/storage/avatars/42/initial.png';
    elements.accountAvatarImg.style.display = 'block';

    // User chooses a file and crop modal opens
    auth.openAvatarCropModal({ name: 'my_photo.png', type: 'image/png' });
    elements.avatarCropImg.trigger('load');

    // Confirm crop triggers upload
    const uploadResult = await auth.confirmAvatarCrop();
    assert.strictEqual(uploadResult, true, 'Confirm crop upload should return true');

    // Verify request endpoint and authentication
    assert.ok(capturedUrl.includes('/api/auth/me/avatar'), 'Endpoint must be /api/auth/me/avatar');
    assert.strictEqual(capturedOptions.method, 'POST');
    assert.strictEqual(capturedOptions.headers['Authorization'], 'Bearer mock_jwt_token_xyz');
    assert.strictEqual(capturedOptions.headers['Accept'], 'application/json');

    // Verify Content-Type was NOT manually set
    assert.strictEqual(
      capturedOptions.headers['Content-Type'],
      undefined,
      'Content-Type must not be manually set so browser sets boundary'
    );

    // Verify FormData payload contains file
    assert.ok(capturedOptions.body instanceof MockFormData);
    const fileEntry = capturedOptions.body.get('file');
    assert.ok(fileEntry, 'FormData must contain file entry');
    assert.ok(fileEntry.name.includes('my_photo_cropped.png'));

    // Verify Account Modal preview was updated with server-returned URL
    assert.strictEqual(
      elements.accountAvatarImg.src,
      '/api/storage/avatars/42/uploaded_avatar.png?v=12345'
    );
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'inline-flex');

    // Verify session user in localStorage was updated
    const updatedUser = JSON.parse(localStorage.getItem('pdfl_user'));
    assert.strictEqual(
      updatedUser.avatar_url,
      '/api/storage/avatars/42/uploaded_avatar.png?v=12345'
    );

    // Verify crop modal was closed
    assert.strictEqual(elements.avatarCropModal.style.display, 'none');

    // Verify success alert in account modal
    assert.strictEqual(elements.accountAlert.style.display, 'block');
    assert.ok(elements.accountAlert.textContent.includes('thành công'));
  });

  // 2. Client-side Validation: Disallowed format is rejected before fetch
  await runTest('Validation: Disallowed MIME format is rejected client-side without calling API', async () => {
    let fetchCalled = false;
    const env = createEnv(() => {
      fetchCalled = true;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
    const { elements, auth } = env;

    auth.initAvatarCropModal();
    auth.applyAvatarPreview('/api/storage/avatars/42/initial.png');

    const invalidFile = {
      name: 'document.pdf',
      type: 'application/pdf',
      size: 1024 * 50,
    };

    const res = await auth.uploadCroppedAvatar(invalidFile);
    assert.strictEqual(res, false);
    assert.strictEqual(fetchCalled, false, 'Fetch must not be invoked for invalid format');

    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('không được hỗ trợ'));

    // Existing preview untouched
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/initial.png');
  });

  // 3. Client-side Validation: Oversized file (> 2 MB) is rejected before fetch
  await runTest('Validation: File exceeding 2 MB is rejected client-side without calling API', async () => {
    let fetchCalled = false;
    const env = createEnv(() => {
      fetchCalled = true;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
    const { elements, auth } = env;

    auth.initAvatarCropModal();
    auth.applyAvatarPreview('/api/storage/avatars/42/initial.png');

    const oversizedFile = {
      name: 'huge_pic.png',
      type: 'image/png',
      size: 3 * 1024 * 1024,
    };

    const res = await auth.uploadCroppedAvatar(oversizedFile);
    assert.strictEqual(res, false);
    assert.strictEqual(fetchCalled, false, 'Fetch must not be invoked for oversized file');

    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('2 MB'));
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/initial.png');
  });

  // 4. Client-side Validation: Empty file (0 bytes) is rejected
  await runTest('Validation: Empty 0-byte file is rejected client-side', async () => {
    let fetchCalled = false;
    const env = createEnv(() => {
      fetchCalled = true;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
    const { elements, auth } = env;

    auth.initAvatarCropModal();

    const emptyFile = {
      name: 'empty.png',
      type: 'image/png',
      size: 0,
    };

    const res = await auth.uploadCroppedAvatar(emptyFile);
    assert.strictEqual(res, false);
    assert.strictEqual(fetchCalled, false);
    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('rỗng'));
  });

  // 5. Authentication Failure: 401 clears session and prompts login without losing avatar
  await runTest('Auth Error: 401 session expiration clears token and notifies user', async () => {
    const env = createEnv(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Token đã hết hạn.' }),
      })
    );
    const { elements, auth, localStorage } = env;

    auth.applyAvatarPreview('/api/storage/avatars/42/initial.png');

    const validFile = { name: 'photo.jpg', type: 'image/jpeg', size: 1024 * 100 };
    const res = await auth.uploadCroppedAvatar(validFile);

    assert.strictEqual(res, false);
    assert.strictEqual(localStorage.getItem('pdfl_token'), null, 'Session token must be cleared');
    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('hết hạn'));

    // Existing preview untouched
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/initial.png');

    // Button states restored
    assert.strictEqual(auth.getIsUploadingAvatar(), false);
    assert.strictEqual(elements.btnConfirmAvatarCrop.disabled, false);
    assert.strictEqual(elements.cropConfirmBtnText.textContent, 'Áp dụng ảnh');
  });

  // 5b. Authorization Failure: 403 displays permission error and keeps valid session intact
  await runTest('Auth Error: 403 Forbidden displays permission error without clearing valid session during upload', async () => {
    const env = createEnv(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Tài khoản không có quyền thay đổi ảnh đại diện.' }),
      })
    );
    const { elements, auth, localStorage } = env;

    auth.applyAvatarPreview('/api/storage/avatars/42/initial.png');

    const validFile = { name: 'photo.jpg', type: 'image/jpeg', size: 1024 * 100 };
    const res = await auth.uploadCroppedAvatar(validFile);

    assert.strictEqual(res, false);
    // Session token must NOT be cleared on 403
    assert.strictEqual(localStorage.getItem('pdfl_token'), 'mock_jwt_token_xyz', 'Session token must be preserved on 403');
    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('quyền'));

    // Existing preview untouched
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/initial.png');

    // Button states restored
    assert.strictEqual(auth.getIsUploadingAvatar(), false);
    assert.strictEqual(elements.btnConfirmAvatarCrop.disabled, false);
    assert.strictEqual(elements.cropConfirmBtnText.textContent, 'Áp dụng ảnh');
  });

  // 6. Server Rejection: 413 Payload Too Large
  await runTest('Server Error: 413 Payload Too Large displays clear error message', async () => {
    const env = createEnv(() =>
      Promise.resolve({
        ok: false,
        status: 413,
        json: () =>
          Promise.resolve({
            message: 'Kích thước tệp ảnh vượt quá giới hạn tối đa cho phép (2 MB).',
          }),
      })
    );
    const { elements, auth } = env;

    auth.applyAvatarPreview('/api/storage/avatars/42/initial.png');
    const validFile = { name: 'photo.png', type: 'image/png', size: 1024 * 50 };

    const res = await auth.uploadCroppedAvatar(validFile);
    assert.strictEqual(res, false);
    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('2 MB'));
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/initial.png');
  });

  // 7. Server Rejection: 415 Unsupported Media Type
  await runTest('Server Error: 415 Unsupported Media Type displays friendly format error', async () => {
    const env = createEnv(() =>
      Promise.resolve({
        ok: false,
        status: 415,
        json: () =>
          Promise.resolve({
            message: 'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận các định dạng JPEG, PNG và WebP.',
          }),
      })
    );
    const { elements, auth } = env;

    auth.applyAvatarPreview('/api/storage/avatars/42/initial.png');
    const validFile = { name: 'fake.png', type: 'image/png', size: 1024 * 20 };

    const res = await auth.uploadCroppedAvatar(validFile);
    assert.strictEqual(res, false);
    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('JPEG, PNG và WebP'));
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/initial.png');
  });

  // 8. Server Error: 500 Internal Server Error
  await runTest('Server Error: 500 displays friendly server error without losing avatar', async () => {
    const env = createEnv(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );
    const { elements, auth } = env;

    auth.applyAvatarPreview('/api/storage/avatars/42/initial.png');
    const validFile = { name: 'photo.jpg', type: 'image/jpeg', size: 1024 * 30 };

    const res = await auth.uploadCroppedAvatar(validFile);
    assert.strictEqual(res, false);
    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('Máy chủ'));
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/initial.png');
  });

  // 9. Network Offline Error during Upload
  await runTest('Network Failure: Offline network error is caught gracefully', async () => {
    const env = createEnv(() => Promise.reject(new Error('Failed to fetch')));
    const { elements, auth } = env;

    auth.applyAvatarPreview('/api/storage/avatars/42/initial.png');
    const validFile = { name: 'photo.webp', type: 'image/webp', size: 1024 * 40 };

    const res = await auth.uploadCroppedAvatar(validFile);
    assert.strictEqual(res, false);
    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('đường truyền mạng'));
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/initial.png');
  });

  // 10. Duplicate Submission Prevention: Concurrent uploads are blocked
  await runTest('Concurrency: Prevents duplicate upload submissions while uploading', async () => {
    let resolveFirst;
    const slowFetch = () =>
      new Promise((resolve) => {
        resolveFirst = resolve;
      });

    const env = createEnv(slowFetch);
    const { elements, auth } = env;

    const file = { name: 'photo.png', type: 'image/png', size: 1024 * 20 };

    const firstPromise = auth.uploadCroppedAvatar(file);
    assert.strictEqual(auth.getIsUploadingAvatar(), true, 'Upload flag should be true');
    assert.strictEqual(elements.btnConfirmAvatarCrop.disabled, true);
    assert.strictEqual(elements.cropConfirmBtnText.textContent, 'Đang tải lên...');

    // Attempt second submission concurrently
    const secondResult = await auth.uploadCroppedAvatar(file);
    assert.strictEqual(secondResult, false, 'Duplicate submission must be rejected');

    // Finish first upload
    resolveFirst({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: { avatar_url: '/api/storage/avatars/42/done.png' },
        }),
    });

    const firstResult = await firstPromise;
    assert.strictEqual(firstResult, true);
    assert.strictEqual(auth.getIsUploadingAvatar(), false, 'Upload flag should reset to false');
    assert.strictEqual(elements.btnConfirmAvatarCrop.disabled, false);
  });

  // 11. Crop Modal Cancel: Never triggers upload and leaves preview untouched
  await runTest('Cancel Action: Discarding crop never triggers upload API', async () => {
    let fetchCalled = false;
    const env = createEnv(() => {
      fetchCalled = true;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
    const { elements, auth } = env;

    auth.initAvatarCropModal();
    auth.applyAvatarPreview('/api/storage/avatars/42/initial.png');

    auth.openAvatarCropModal({ name: 'temp.png', type: 'image/png' });
    assert.strictEqual(elements.avatarCropModal.style.display, 'flex');

    // Click cancel button
    elements.btnCancelAvatarCrop.trigger('click');

    assert.strictEqual(elements.avatarCropModal.style.display, 'none');
    assert.strictEqual(fetchCalled, false, 'Cancel must not trigger fetch');
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/initial.png');
  });

  // 12. Delete Avatar API Integration: Success
  await runTest('Delete Avatar Success: DELETE /api/auth/me/avatar resets preview & session', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders = {};

    const customFetch = (url, opts) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedHeaders = opts.headers;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            message: 'Đã xóa ảnh đại diện thành công.',
          }),
      });
    };

    const env = createEnv(customFetch);
    const { elements, auth, localStorage } = env;

    auth.initAccountModal();
    auth.applyAvatarPreview('/api/storage/avatars/42/to_be_deleted.png');

    elements.btnDeleteAvatar.trigger('click');
    assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'flex');

    const deleteResult = await auth.handleConfirmDeleteAvatar();
    assert.strictEqual(deleteResult, true);

    // Verify request
    assert.ok(capturedUrl.includes('/api/auth/me/avatar'));
    assert.strictEqual(capturedMethod, 'DELETE');
    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer mock_jwt_token_xyz');

    // Verify preview reset to initial letter
    assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
    assert.strictEqual(elements.accountAvatarImg.src, '');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'inline-block');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'none');
    assert.strictEqual(elements.avatarDeleteConfirmBox.style.display, 'none');

    // Verify session user updated to null avatar_url
    const user = JSON.parse(localStorage.getItem('pdfl_user'));
    assert.strictEqual(user.avatar_url, null);

    // Verify success alert
    assert.strictEqual(elements.accountAlert.style.display, 'block');
    assert.ok(elements.accountAlert.textContent.includes('xóa'));
  });

  // 13. Delete Avatar API Integration: Failure preserves existing avatar
  await runTest('Delete Avatar Failure: 500 error preserves existing preview and shows alert', async () => {
    const env = createEnv(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Lỗi máy chủ.' }),
      })
    );
    const { elements, auth, localStorage } = env;

    auth.initAccountModal();
    auth.applyAvatarPreview('/api/storage/avatars/42/keep_this.png');

    elements.btnDeleteAvatar.trigger('click');
    const deleteResult = await auth.handleConfirmDeleteAvatar();

    assert.strictEqual(deleteResult, false);

    // Avatar preview remains untouched
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/keep_this.png');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'inline-flex');

    // Session remains untouched
    const user = JSON.parse(localStorage.getItem('pdfl_user'));
    assert.strictEqual(user.avatar_url, '/api/storage/avatars/42/initial.png');

    // Error alert displayed
    assert.strictEqual(elements.accountAlert.style.display, 'block');
    assert.ok(elements.accountAlert.textContent.toLowerCase().includes('máy chủ'));
  });

  // 13b. Delete Avatar Auth Error: 401 session expiration clears session and preserves avatar
  await runTest('Delete Avatar Auth Error: 401 clears session and notifies user without deleting avatar', async () => {
    const env = createEnv(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Phiên đăng nhập đã hết hạn.' }),
      })
    );
    const { elements, auth, localStorage } = env;

    auth.initAccountModal();
    auth.applyAvatarPreview('/api/storage/avatars/42/keep_this.png');

    elements.btnDeleteAvatar.trigger('click');
    const deleteResult = await auth.handleConfirmDeleteAvatar();

    assert.strictEqual(deleteResult, false);
    assert.strictEqual(localStorage.getItem('pdfl_token'), null, 'Session token must be cleared on 401');
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/keep_this.png');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
    assert.strictEqual(elements.accountAlert.style.display, 'block');
    assert.ok(elements.accountAlert.textContent.includes('hết hạn'));

    // Loading flag and buttons restored
    assert.strictEqual(auth.getIsDeletingAvatar(), false);
    assert.strictEqual(elements.btnConfirmDeleteAvatar.disabled, false);
    assert.strictEqual(elements.btnConfirmDeleteAvatar.textContent, 'Gỡ ảnh');
  });

  // 13c. Delete Avatar Auth Error: 403 Forbidden displays permission error without clearing valid session
  await runTest('Delete Avatar Auth Error: 403 Forbidden displays permission error without clearing session', async () => {
    const env = createEnv(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Tài khoản không có quyền xóa avatar này.' }),
      })
    );
    const { elements, auth, localStorage } = env;

    auth.initAccountModal();
    auth.applyAvatarPreview('/api/storage/avatars/42/keep_this.png');

    elements.btnDeleteAvatar.trigger('click');
    const deleteResult = await auth.handleConfirmDeleteAvatar();

    assert.strictEqual(deleteResult, false);
    // Session token preserved on 403
    assert.strictEqual(localStorage.getItem('pdfl_token'), 'mock_jwt_token_xyz', 'Session token must remain valid on 403');
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/42/keep_this.png');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
    assert.strictEqual(elements.accountAlert.style.display, 'block');
    assert.ok(elements.accountAlert.textContent.includes('quyền'));

    // Loading flag and buttons restored
    assert.strictEqual(auth.getIsDeletingAvatar(), false);
    assert.strictEqual(elements.btnConfirmDeleteAvatar.disabled, false);
    assert.strictEqual(elements.btnConfirmDeleteAvatar.textContent, 'Gỡ ảnh');
  });

  // 14. Duplicate Delete Prevention: isDeletingAvatar blocks rapid clicks
  await runTest('Concurrency: Prevents duplicate delete submissions while deleting', async () => {
    let resolveDelete;
    const slowDeleteFetch = () =>
      new Promise((resolve) => {
        resolveDelete = resolve;
      });

    const env = createEnv(slowDeleteFetch);
    const { elements, auth } = env;

    auth.initAccountModal();
    auth.applyAvatarPreview('/api/storage/avatars/42/photo.png');

    const firstPromise = auth.handleConfirmDeleteAvatar();
    assert.strictEqual(auth.getIsDeletingAvatar(), true);
    assert.strictEqual(elements.btnConfirmDeleteAvatar.disabled, true);
    assert.strictEqual(elements.btnConfirmDeleteAvatar.textContent, 'Đang xóa...');

    // Second call concurrently
    const secondResult = await auth.handleConfirmDeleteAvatar();
    assert.strictEqual(secondResult, false, 'Duplicate delete must be blocked');

    resolveDelete({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    const firstResult = await firstPromise;
    assert.strictEqual(firstResult, true);
    assert.strictEqual(auth.getIsDeletingAvatar(), false);
    assert.strictEqual(elements.btnConfirmDeleteAvatar.disabled, false);
  });

  // 15. URL Revocation: Temporary object URLs are revoked upon success and modal close
  await runTest('Memory Management: Revokes temporary object URLs when no longer needed', async () => {
    const env = createEnv();
    const { auth, revokedUrls } = env;

    // Simulate opening crop modal which creates a tempObjectUrl
    auth.openAvatarCropModal({ name: 'temp_photo.png', type: 'image/png' });
    const cropState = auth.getCropState();
    assert.ok(cropState.tempObjectUrl, 'tempObjectUrl should be set');
    const createdUrl = cropState.tempObjectUrl;

    // Close crop modal
    auth.closeAvatarCropModal(false);

    assert.ok(
      revokedUrls.includes(createdUrl),
      'tempObjectUrl must be revoked upon closing crop modal'
    );
    assert.strictEqual(cropState.tempObjectUrl, null);
  });

  console.log('================================================================');
  console.log(`SUMMARY: ${passCount}/${passCount + failCount} avatar upload tests passed (${failCount} failed).`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite();
