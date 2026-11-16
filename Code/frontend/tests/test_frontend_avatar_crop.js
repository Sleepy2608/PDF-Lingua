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

function createCropEnv() {
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
    // Avatar Cropping elements
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
  localStorage.setItem('pdfl_token', 'mock_jwt_token');
  localStorage.setItem(
    'pdfl_user',
    JSON.stringify({ id: 1, full_name: 'Test', email: 'test@example.com', avatar_url: null })
  );
  let createdCanvas = null;

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
      createObjectURL: (obj) => `blob:mock-crop/${(obj && obj.name) || 'blob_preview'}`,
    },
    addEventListener: () => {},
  };

  class MockFormData {
    constructor() {
      this.entries = [];
    }
    append(key, value, filename) {
      this.entries.push({ key, value, filename });
    }
  }

  const context = {
    document: mockDocument,
    window: mockWindow,
    localStorage: localStorage,
    sessionStorage: sessionStorage,
    console: console,
    FormData: MockFormData,
    fetch: () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            message: 'Cập nhật ảnh đại diện thành công.',
            data: { avatar_url: '/api/storage/avatars/1/avatar.png?v=1' },
          }),
      }),
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    URL: mockWindow.URL,
    File: function (parts, filename, opts = {}) {
      this.parts = parts;
      this.name = filename;
      this.type = opts.type || 'image/png';
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
    auth: context.window.pdfLinguaAuth,
    getCanvas: () => createdCanvas,
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
    console.error(`[FAIL] ${name}:`, err);
    failCount++;
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('Interactive Avatar Cropping & HTML5 Canvas Test Suite');
  console.log('================================================================');

  // 1. Modal opening upon selecting valid image
  await runTest('Crop Modal Lifecycle: Opens crop modal when a valid image is selected', () => {
    const { elements, auth } = createCropEnv();
    auth.initAccountModal();
    auth.initAvatarCropModal();

    elements.avatarFileInput.files = [
      { name: 'profile_pic.png', type: 'image/png', size: 1024 * 100 },
    ];
    elements.avatarFileInput.value = 'C:\\fakepath\\profile_pic.png';

    elements.avatarFileInput.trigger('change', { target: elements.avatarFileInput });

    assert.strictEqual(elements.avatarCropModal.style.display, 'flex');
    assert.strictEqual(elements.avatarCropModal.hasAttribute('hidden'), false);
    assert.ok(elements.avatarCropImg.src.includes('profile_pic.png'));
    const state = auth.getCropState();
    assert.strictEqual(state.isOpen, true);
    assert.strictEqual(state.zoom, 1);
  });

  // 2. Image onload calculates scaleBase and fits crop diameter
  await runTest('Crop Calculations: Image load establishes scaleBase and centers viewport', () => {
    const { elements, auth } = createCropEnv();
    auth.initAvatarCropModal();

    const mockFile = { name: 'landscape.jpg', type: 'image/jpeg', size: 200 * 1024 };
    auth.openAvatarCropModal(mockFile);

    elements.avatarCropImg.naturalWidth = 1200;
    elements.avatarCropImg.naturalHeight = 600;
    elements.avatarCropImg.trigger('load');

    const state = auth.getCropState();
    assert.strictEqual(state.naturalWidth, 1200);
    assert.strictEqual(state.naturalHeight, 600);
    // Diameter is 240. scaleBase = max(240/1200, 240/600) = max(0.2, 0.4) = 0.4
    assert.strictEqual(state.scaleBase, 0.4);
    assert.strictEqual(elements.cropZoomValue.textContent, '100%');
    assert.strictEqual(elements.cropZoomRange.value, '1');
  });

  // 3. Zoom Range & Buttons interaction
  await runTest('Zoom Controls: Slider and buttons modify zoom level within [1.0, 3.0] bounds', () => {
    const { elements, auth } = createCropEnv();
    auth.initAvatarCropModal();

    auth.openAvatarCropModal({ name: 'square.png', type: 'image/png' });
    elements.avatarCropImg.naturalWidth = 500;
    elements.avatarCropImg.naturalHeight = 500;
    elements.avatarCropImg.trigger('load');

    // Zoom in via button
    elements.btnCropZoomIn.trigger('click');
    let state = auth.getCropState();
    assert.strictEqual(state.zoom, 1.1);
    assert.strictEqual(elements.cropZoomValue.textContent, '110%');

    // Zoom out via button
    elements.btnCropZoomOut.trigger('click');
    state = auth.getCropState();
    assert.strictEqual(state.zoom, 1.0);

    // Zoom slider change
    elements.cropZoomRange.value = '2.25';
    elements.cropZoomRange.trigger('input', { target: elements.cropZoomRange });
    state = auth.getCropState();
    assert.strictEqual(state.zoom, 2.25);
    assert.strictEqual(elements.cropZoomValue.textContent, '225%');

    // Zoom upper clamp test
    auth.setCropZoom(4.5);
    state = auth.getCropState();
    assert.strictEqual(state.zoom, 3.0);

    // Zoom lower clamp test
    auth.setCropZoom(0.5);
    state = auth.getCropState();
    assert.strictEqual(state.zoom, 1.0);
  });

  // 4. Viewport dragging and offset clamping
  await runTest('Interactive Dragging: Pointer movement repositions image and clamps to mask boundary', () => {
    const { elements, auth } = createCropEnv();
    auth.initAvatarCropModal();

    auth.openAvatarCropModal({ name: 'wide.png', type: 'image/png' });
    elements.avatarCropImg.naturalWidth = 1000;
    elements.avatarCropImg.naturalHeight = 500;
    elements.avatarCropImg.trigger('load');

    // scaleBase = max(240/1000, 240/500) = 0.48
    // currentW = 1000 * 0.48 * 1.0 = 480. MaxOffsetX = (480 - 240)/2 = 120.
    // currentH = 500 * 0.48 * 1.0 = 240. MaxOffsetY = (240 - 240)/2 = 0.

    // Pointer down
    elements.avatarCropViewport.trigger('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    let state = auth.getCropState();
    assert.strictEqual(state.isDragging, true);

    // Drag right by 50px
    elements.avatarCropViewport.trigger('pointermove', { clientX: 150, clientY: 100 });
    state = auth.getCropState();
    assert.strictEqual(state.offsetX, 50);
    assert.strictEqual(state.offsetY, 0);

    // Drag far right beyond max (150px exceeds 120px) -> clamped to 120px
    elements.avatarCropViewport.trigger('pointermove', { clientX: 300, clientY: 100 });
    state = auth.getCropState();
    assert.strictEqual(state.offsetX, 120);

    // Pointer up ends drag
    elements.avatarCropViewport.trigger('pointerup', { pointerId: 1 });
    state = auth.getCropState();
    assert.strictEqual(state.isDragging, false);
  });

  // 5. Wheel and Keyboard controls
  await runTest('Accessibility Controls: Mouse wheel adjusts zoom and Arrow keys nudge position', () => {
    const { elements, auth } = createCropEnv();
    auth.initAvatarCropModal();

    auth.openAvatarCropModal({ name: 'keyboard.png', type: 'image/png' });
    elements.avatarCropImg.naturalWidth = 600;
    elements.avatarCropImg.naturalHeight = 600;
    elements.avatarCropImg.trigger('load');

    // Wheel zoom in
    elements.avatarCropViewport.trigger('wheel', { deltaY: -100, preventDefault: () => {} });
    let state = auth.getCropState();
    assert.ok(state.zoom > 1.0);

    // Arrow keys nudge
    const initX = state.offsetX;
    elements.avatarCropViewport.trigger('keydown', { key: 'ArrowLeft', preventDefault: () => {} });
    state = auth.getCropState();
    assert.strictEqual(state.offsetX, initX - 6);

    elements.avatarCropViewport.trigger('keydown', { key: 'ArrowRight', preventDefault: () => {} });
    state = auth.getCropState();
    assert.strictEqual(state.offsetX, initX);
  });

  // 6. Cancel Action discards crop and preserves original preview
  await runTest('Cancel Action: Discards pending crop, resets input, and leaves avatar preview unchanged', () => {
    const { elements, auth } = createCropEnv();
    auth.initAccountModal();
    auth.initAvatarCropModal();

    // Set initial avatar preview
    auth.applyAvatarPreview('/api/storage/avatars/1/original.png');
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/1/original.png');

    // Open crop modal
    auth.openAvatarCropModal({ name: 'cancelled.jpg', type: 'image/jpeg' });
    elements.avatarFileInput.value = 'C:\\fakepath\\cancelled.jpg';
    assert.strictEqual(elements.avatarCropModal.style.display, 'flex');

    // Click cancel button
    elements.btnCancelAvatarCrop.trigger('click');

    assert.strictEqual(elements.avatarCropModal.style.display, 'none');
    assert.strictEqual(elements.avatarCropModal.hasAttribute('hidden'), true);
    assert.strictEqual(elements.avatarFileInput.value, '');
    // Original avatar preview is completely preserved
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/1/original.png');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
  });

  // 7. Modal Escape key and Close Button
  await runTest('Escape & Close Button: Dismiss crop modal without saving changes', () => {
    const { elements, auth } = createCropEnv();
    auth.initAvatarCropModal();

    auth.openAvatarCropModal({ name: 'dismiss.png', type: 'image/png' });
    assert.strictEqual(elements.avatarCropModal.style.display, 'flex');

    // Click close X button
    elements.btnCloseAvatarCropModal.trigger('click');
    assert.strictEqual(elements.avatarCropModal.style.display, 'none');

    // Open again and press Escape
    auth.openAvatarCropModal({ name: 'dismiss2.png', type: 'image/png' });
    elements.avatarCropModal.trigger('keydown', { key: 'Escape' });
    assert.strictEqual(elements.avatarCropModal.style.display, 'none');
  });

  // 8. Confirm Action produces Canvas Blob and updates Avatar Preview
  await runTest('Confirm Action: Generates HTML5 Canvas crop Blob, creates File, and updates preview', async () => {
    const { elements, auth, getCanvas } = createCropEnv();
    auth.initAccountModal();
    auth.initAvatarCropModal();

    const testFile = { name: 'my_face.png', type: 'image/png', size: 1024 * 80 };
    auth.openAvatarCropModal(testFile);

    elements.avatarCropImg.naturalWidth = 800;
    elements.avatarCropImg.naturalHeight = 800;
    elements.avatarCropImg.trigger('load');

    // Trigger confirmation
    await auth.confirmAvatarCrop();

    // Verify modal closed
    assert.strictEqual(elements.avatarCropModal.style.display, 'none');

    // Verify canvas drawImage was executed
    const canvas = getCanvas();
    assert.ok(canvas, 'Canvas must be created during crop confirmation');
    assert.strictEqual(canvas.width, 400);
    assert.strictEqual(canvas.height, 400);
    assert.ok(canvas.ctx.drawCalls.length > 0, 'drawImage must be called on canvas 2D context');

    // Verify state holds cropped Blob & File
    const state = auth.getCropState();
    assert.ok(state.croppedBlob, 'Cropped blob must be stored');
    assert.ok(state.croppedFile, 'Cropped file must be stored');
    assert.ok(state.croppedFile.name.includes('my_face_cropped.png'));

    // Verify Account Modal preview was updated with server avatar URL
    assert.strictEqual(elements.accountAvatarImg.src, '/api/storage/avatars/1/avatar.png?v=1');
    assert.strictEqual(elements.accountAvatarImg.style.display, 'block');
    assert.strictEqual(elements.accountAvatarInitial.style.display, 'none');
    assert.strictEqual(elements.btnDeleteAvatar.style.display, 'inline-flex');
  });

  // 9. Error Handling: Image load error displays alert and disables confirm
  await runTest('Error Handling: Corrupt image loading shows friendly alert and disables confirm', () => {
    const { elements, auth } = createCropEnv();
    auth.initAvatarCropModal();

    auth.openAvatarCropModal({ name: 'corrupt.jpg', type: 'image/jpeg' });
    elements.avatarCropImg.trigger('error');

    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('Không thể tải hoặc xử lý'));
    assert.strictEqual(elements.btnConfirmAvatarCrop.disabled, true);
  });

  // 10. Error Handling: Invalid image dimensions (0x0)
  await runTest('Error Handling: 0x0 natural dimensions shows error alert', () => {
    const { elements, auth } = createCropEnv();
    auth.initAvatarCropModal();

    auth.openAvatarCropModal({ name: 'zero.png', type: 'image/png' });
    elements.avatarCropImg.naturalWidth = 0;
    elements.avatarCropImg.naturalHeight = 0;
    elements.avatarCropImg.trigger('load');

    assert.strictEqual(elements.avatarCropAlert.style.display, 'block');
    assert.ok(elements.avatarCropAlert.textContent.includes('Không thể đọc kích thước'));
    assert.strictEqual(elements.btnConfirmAvatarCrop.disabled, true);
  });

  console.log('================================================================');
  console.log(`SUMMARY: ${passCount}/${passCount + failCount} avatar crop tests passed (${failCount} failed).`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite();
