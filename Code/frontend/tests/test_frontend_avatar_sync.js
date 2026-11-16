const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../js/auth.js'), 'utf8');
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

function createSyncEnv(fetchHandler) {
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
          data: { avatar_url: '/api/storage/avatars/77/uploaded.png?v=1' },
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
      this.size = opts.size || 1024 * 50;
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
  console.log('Synchronize Avatar Across UI Test Suite');
  console.log('================================================================');

  // 1. Immediate Header Synchronization on Upload
  await runTest('Header Sync on Upload: Successful upload immediately updates Header avatar image without page reload', async () => {
    const env = createSyncEnv((url, opts) => {
      if (url.includes('/api/auth/me/avatar') && opts.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { avatar_url: '/api/storage/avatars/77/live_avatar.png?v=101' },
            }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    const { elements, auth, localStorage, dispatchedEvents } = env;

    localStorage.setItem('pdfl_token', 'jwt_token_sync_1');
    localStorage.setItem(
      'pdfl_user',
      JSON.stringify({ id: 77, full_name: 'Minh Tu', email: 'tu@example.com', avatar_url: null })
    );

    auth.initAccountModal();
    auth.initAvatarCropModal();

    // Prior to upload, Header shows initial 'M'
    auth.updateHeaderAuthState({ id: 77, full_name: 'Minh Tu', email: 'tu@example.com', avatar_url: null });
    assert.strictEqual(elements.userAvatar.textContent, 'M');

    // Simulate crop selection and confirm upload
    auth.openAvatarCropModal({ name: 'profile.png', type: 'image/png' });
    elements.avatarCropImg.trigger('load');

    const success = await auth.confirmAvatarCrop();
    assert.strictEqual(success, true);

    // Verify Header userAvatar immediately updated to img tag
    assert.ok(elements.userAvatar.innerHTML.includes('<img src="/api/storage/avatars/77/live_avatar.png?v=101"'));
    assert.ok(elements.userAvatar.innerHTML.includes('header-user-avatar-img'));

    // Verify Account modal preview updated
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/77/live_avatar.png?v=101');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'none');

    // Verify stored session updated as single source of truth
    const stored = JSON.parse(localStorage.getItem('pdfl_user'));
    assert.strictEqual(stored.avatar_url, '/api/storage/avatars/77/live_avatar.png?v=101');

    // Verify auth change event broadcast for other UI modules
    const authEvent = dispatchedEvents[dispatchedEvents.length - 1];
    assert.ok(authEvent, 'Must dispatch pdfl:auth-change event');
    assert.strictEqual(authEvent.detail.user.avatar_url, '/api/storage/avatars/77/live_avatar.png?v=101');
  });

  // 2. Immediate Header Synchronization on Delete
  await runTest('Header Sync on Delete: Successful deletion immediately resets Header to initial letter without page reload', async () => {
    const env = createSyncEnv((url, opts) => {
      if (url.includes('/api/auth/me/avatar') && opts.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, message: 'Đã xóa avatar.' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    const { elements, auth, localStorage, dispatchedEvents } = env;

    localStorage.setItem('pdfl_token', 'jwt_token_sync_2');
    localStorage.setItem(
      'pdfl_user',
      JSON.stringify({
        id: 77,
        full_name: 'Minh Tu',
        email: 'tu@example.com',
        avatar_url: '/api/storage/avatars/77/live_avatar.png',
      })
    );

    auth.initAccountModal();
    auth.updateHeaderAuthState({
      id: 77,
      full_name: 'Minh Tu',
      email: 'tu@example.com',
      avatar_url: '/api/storage/avatars/77/live_avatar.png',
    });
    auth.applyAvatarPreview('/api/storage/avatars/77/live_avatar.png');

    assert.ok(elements.userAvatar.innerHTML.includes('<img src="/api/storage/avatars/77/live_avatar.png"'));
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');

    // Trigger delete avatar
    elements.btnDeleteAvatar.trigger('click');
    const deleteSuccess = await auth.handleConfirmDeleteAvatar();
    assert.strictEqual(deleteSuccess, true);

    // Verify Header immediately reset to initial 'M'
    assert.strictEqual(elements.userAvatar.textContent, 'M');
    assert.strictEqual(elements.userAvatar.innerHTML, '');

    // Verify Account modal preview reset
    assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
    assert.strictEqual(elements.accountAvatarImg.src, '');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'inline-block');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'none');

    // Verify session single source of truth updated to null
    const stored = JSON.parse(localStorage.getItem('pdfl_user'));
    assert.strictEqual(stored.avatar_url, null);

    // Verify broadcast event
    const lastEvent = dispatchedEvents[dispatchedEvents.length - 1];
    assert.strictEqual(lastEvent.type, 'pdfl:auth-change');
    assert.strictEqual(lastEvent.detail.user.avatar_url, null);
  });

  // 3. Session Restoration on Page Reload (with Avatar)
  await runTest('Session Restoration: Page reload restores avatar in Header and Account details', async () => {
    const env = createSyncEnv((url) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: 88,
                full_name: 'Kim Thoa',
                email: 'thoa@example.com',
                role: 'free',
                avatar_url: '/api/storage/avatars/88/avatar.webp?v=555',
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    const { elements, auth, localStorage } = env;

    localStorage.setItem('pdfl_token', 'jwt_restore_token');
    localStorage.setItem(
      'pdfl_user',
      JSON.stringify({
        id: 88,
        full_name: 'Kim Thoa',
        email: 'thoa@example.com',
        avatar_url: '/api/storage/avatars/88/cached.webp',
      })
    );

    // Call restoreSession as page boot does
    await auth.restoreSession();

    // Verify fresh avatar URL rendered in Header
    assert.ok(elements.userAvatar.innerHTML.includes('/api/storage/avatars/88/avatar.webp?v=555'));
    assert.strictEqual(elements.userDisplayName.textContent, 'Kim Thoa');

    // Open Account Modal and verify it renders the restored avatar
    auth.initAccountModal();
    auth.openAccountModal();

    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/88/avatar.webp?v=555');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'none');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'inline-flex');
  });

  // 4. Session Restoration with Null Avatar
  await runTest('Session Restoration without Avatar: Renders initial fallback cleanly without broken img tags', async () => {
    const env = createSyncEnv((url) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: 99,
                full_name: 'Bao Long',
                email: 'long@example.com',
                role: 'free',
                avatar_url: null,
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    const { elements, auth, localStorage } = env;

    localStorage.setItem('pdfl_token', 'jwt_null_avatar');
    localStorage.setItem(
      'pdfl_user',
      JSON.stringify({ id: 99, full_name: 'Bao Long', email: 'long@example.com', avatar_url: null })
    );

    await auth.restoreSession();

    // Verify initial 'B' in Header
    assert.strictEqual(elements.userAvatar.textContent, 'B');
    assert.strictEqual(elements.userAvatar.innerHTML, '');

    // Account modal renders initial 'B'
    auth.initAccountModal();
    auth.renderAccountDetails(auth.getStoredUser());

    assert.strictEqual(elements.accountAvatarInitial.textContent, 'B');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'inline-block');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'none');
  });

  // 5. Default Guest State Synchronization
  await runTest('Guest State: When unauthenticated, Header displays guest controls and clears avatar state', () => {
    const { elements, auth, localStorage } = createSyncEnv();

    localStorage.clear();
    auth.updateHeaderAuthState(null);

    // Guest group visible, user group hidden
    assert.strictEqual(elements.authGuestGroup.style.display, 'flex');
    assert.strictEqual(elements.authUserGroup.style.display, 'none');
    assert.strictEqual(elements.userAvatar.textContent, '');
    assert.strictEqual(elements.userAvatar.innerHTML, '');
    assert.strictEqual(elements.userDisplayName.textContent, '');
    assert.strictEqual(elements.btnOpenAdmin.style.display, 'none');
  });

  // 6. Avatar Image Load Failure in Header falls back to initial
  await runTest('Error Handling: Corrupt avatar image in Header triggers error event and falls back to initial', () => {
    const { elements, auth } = createSyncEnv();

    auth.updateHeaderAuthState({
      id: 55,
      full_name: 'Hoang Nam',
      email: 'nam@example.com',
      avatar_url: '/api/storage/avatars/55/corrupt.png',
    });

    assert.ok(elements.userAvatar.innerHTML.includes('corrupt.png'));

    // Find inner img element and trigger error
    const imgEl = elements.userAvatar.querySelector('img');
    assert.ok(imgEl, 'Image element must exist in userAvatar');

    imgEl.trigger('error');

    // Should have replaced image with initial 'H'
    assert.strictEqual(elements.userAvatar.textContent, 'H');
    assert.strictEqual(elements.userAvatar.innerHTML, '');
  });

  // 7. Avatar Image Load Failure in Account Modal falls back to initial
  await runTest('Error Handling: Corrupt image loading in Account Modal hides img and reveals initial', () => {
    const { elements, auth } = createSyncEnv();

    auth.initAccountModal();
    auth.applyAvatarPreview('/api/storage/avatars/55/broken.png');

    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');

    // Trigger error on accountAvatarImg
    elements.accountAvatarImg.trigger('error');

    // Must hide broken image and reveal initial
    assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'inline-block');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'none');
  });

  // 8. User Initial Formatting and Whitespace Handling
  await runTest('Initial Fallback: Handles leading whitespace, trims names, and falls back to email or U', () => {
    const { elements, auth } = createSyncEnv();

    // Leading space full_name
    auth.updateHeaderAuthState({ full_name: '   Duy Khanh   ', email: 'khanh@example.com', avatar_url: null });
    assert.strictEqual(elements.userAvatar.textContent, 'D');

    // Missing full_name, email fallback
    auth.updateHeaderAuthState({ full_name: '', email: 'elena@example.com', avatar_url: null });
    assert.strictEqual(elements.userAvatar.textContent, 'E');

    // Both missing, fallback 'U'
    auth.updateHeaderAuthState({ full_name: '', email: '', id: 101, avatar_url: null });
    assert.strictEqual(elements.userAvatar.textContent, 'U');
  });

  // 9. Avoid Duplicate Event Listeners
  await runTest('Idempotency: Repeated calls to initAccountAvatar or initAccountModal do not duplicate listeners', () => {
    const { elements, auth } = createSyncEnv();

    auth.initAccountModal();
    auth.initAccountModal();
    auth.initAccountAvatar();

    let clickCount = 0;
    elements.avatarFileInput.click = () => {
      clickCount++;
    };

    // Clicking camera button once
    elements.btnSelectAvatar.trigger('click', {});
    assert.strictEqual(clickCount, 1, 'Only one click event should be dispatched regardless of repeated inits');
  });

  // 10. Account Edit Full Name updates Header Initial when no avatar exists
  await runTest('Name Update Sync: Changing full_name updates Header initial when user has no avatar', async () => {
    const env = createSyncEnv((url, opts) => {
      if (url.includes('/api/auth/me') && opts.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: 33,
                full_name: 'Vuong Tri',
                email: 'tri@example.com',
                role: 'free',
                avatar_url: null,
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    const { elements, auth, localStorage } = env;

    localStorage.setItem('pdfl_token', 'jwt_patch_token');
    localStorage.setItem(
      'pdfl_user',
      JSON.stringify({ id: 33, full_name: 'Old Name', email: 'tri@example.com', avatar_url: null })
    );

    auth.initAccountModal();
    auth.updateHeaderAuthState({ id: 33, full_name: 'Old Name', email: 'tri@example.com', avatar_url: null });
    assert.strictEqual(elements.userAvatar.textContent, 'O');

    elements.editFullNameInput.value = 'Vuong Tri';
    await auth.handleSaveFullName();

    // Verify Header immediately updated to initial 'V'
    assert.strictEqual(elements.userAvatar.textContent, 'V');
    assert.strictEqual(elements.userDisplayName.textContent, 'Vuong Tri');
  });

  // 11. Sidebar Synchronization via pdfl:auth-change
  await runTest('Sidebar Sync: pdfl:auth-change event updates Sidebar avatar image, initial, and guest SVG', () => {
    const { elements, auth } = createSyncEnv();

    // 1. Initial guest state: sidebarUserAvatar contains guest SVG
    assert.ok(elements.sidebarUserAvatar.innerHTML.includes('<svg'));

    // 2. Auth state with avatar: sidebarUserAvatar renders img tag
    auth.updateHeaderAuthState({
      id: 42,
      full_name: 'Lan Huong',
      email: 'huong@example.com',
      role: 'pro',
      avatar_url: '/api/storage/avatars/42/photo.webp',
    });

    assert.ok(elements.sidebarUserAvatar.innerHTML.includes('<img src="/api/storage/avatars/42/photo.webp"'));
    assert.ok(elements.sidebarUserAvatar.innerHTML.includes('sidebar-avatar-img'));
    assert.strictEqual(elements.sidebarUserName.textContent, 'Lan Huong');

    // 3. Image error on sidebar avatar falls back to initial 'L'
    const sidebarImg = elements.sidebarUserAvatar.querySelector('img');
    assert.ok(sidebarImg, 'Sidebar avatar img must exist');
    sidebarImg.trigger('error');
    assert.strictEqual(elements.sidebarUserAvatar.textContent, 'L');
    assert.strictEqual(elements.sidebarUserAvatar.innerHTML, '');

    // 4. Delete avatar (avatar_url: null) sets sidebarUserAvatar to initial 'L'
    auth.updateHeaderAuthState({
      id: 42,
      full_name: 'Lan Huong',
      email: 'huong@example.com',
      role: 'pro',
      avatar_url: null,
    });
    assert.strictEqual(elements.sidebarUserAvatar.textContent, 'L');
    assert.strictEqual(elements.sidebarUserAvatar.innerHTML, '');

    // 5. Logout (guest: null) restores guest SVG and resets name to Khach
    auth.updateHeaderAuthState(null);
    assert.ok(elements.sidebarUserAvatar.innerHTML.includes('<svg'));
    assert.strictEqual(elements.sidebarUserName.textContent, 'Khách');
  });

  // 12. Recursive Error Loop Prevention on Image Fallback
  await runTest('Loop Protection: Broken image fallback on Account Modal and Header does not create recursive error loops', () => {
    const { elements, auth } = createSyncEnv();

    auth.initAccountModal();
    auth.applyAvatarPreview('/api/storage/avatars/99/broken.png');

    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');

    let errorTriggerCount = 0;
    // Simulate a browser where modifying src attribute triggers an error event
    elements.accountAvatarImg.addEventListener('error', () => {
      errorTriggerCount++;
      if (errorTriggerCount < 10) {
        // Attempt recursive call that would cause infinite loop without guard
        auth.handleAccountAvatarImgError();
      }
    });

    // Trigger initial error
    elements.accountAvatarImg.trigger('error');

    // Guard must halt re-entrant execution safely
    assert.strictEqual(elements.accountAvatarImg.style.display, 'none');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'inline-block');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'none');

    // Header error handler cleans up its own onerror to avoid looping
    auth.updateHeaderAuthState({
      id: 99,
      full_name: 'Test Loop',
      email: 'loop@example.com',
      avatar_url: '/api/storage/avatars/99/broken_header.png',
    });

    const headerImg = elements.userAvatar.querySelector('img');
    assert.ok(headerImg);

    let headerErrorCalls = 0;
    headerImg.addEventListener('error', () => {
      headerErrorCalls++;
    });

    headerImg.trigger('error');
    assert.strictEqual(elements.userAvatar.textContent, 'T');
    assert.strictEqual(elements.userAvatar.innerHTML, '');
    assert.strictEqual(headerImg.onerror, null);
  });

  console.log('================================================================');
  console.log(`SUMMARY: ${passCount}/${passCount + failCount} avatar sync tests passed (${failCount} failed).`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite();
