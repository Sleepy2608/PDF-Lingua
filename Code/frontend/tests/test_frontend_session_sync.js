/**
 * PDF-Lingua — Session Restoration & Multi-tab Sync Test Suite (PDFL-43.4)
 * ------------------------------------------------------------------------
 * Covers boot-time session verification and cross-tab synchronisation
 * (`storage` + `visibilitychange`) without touching the backend contract.
 *
 * Execution:
 *   node Code/frontend/tests/test_frontend_session_sync.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../js/auth.js'), 'utf8');

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
    this.style = { setProperty() {} };
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
  querySelectorAll() { return []; }
  querySelector() { return null; }
}

class MockStorage {
  constructor() { this.store = {}; this.writes = []; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); this.writes.push(k); }
  removeItem(k) { delete this.store[k]; this.writes.push('-' + k); }
  clear() { this.store = {}; }
}

function createEnv() {
  const e = Object.fromEntries(ELEMENT_IDS.map((id) => [id, new Element(id)]));
  const localStorage = new MockStorage();
  const sessionStorage = new MockStorage();

  const documentListeners = {};
  const document = {
    visibilityState: 'visible',
    getElementById: (id) => e[id] || null,
    querySelectorAll: () => [],
    body: { style: {} },
    createElement: () => ({ appendChild: () => {}, innerHTML: '' }),
    createTextNode: (v) => v,
    addEventListener: (type, fn) => {
      documentListeners[type] = documentListeners[type] || [];
      documentListeners[type].push(fn);
    },
  };

  const windowListeners = {};
  class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init ? init.detail : undefined;
    }
  }
  const window = {
    location: { protocol: 'http:', port: '8000', hostname: 'localhost' },
    document,
    localStorage,
    sessionStorage,
    addEventListener: (type, fn) => {
      windowListeners[type] = windowListeners[type] || [];
      windowListeners[type].push(fn);
    },
    dispatchEvent: (evt) => {
      (windowListeners[evt.type] || []).forEach((fn) => fn(evt));
      return true;
    },
  };

  const context = vm.createContext({
    window,
    document,
    localStorage,
    sessionStorage,
    CustomEvent,
    console,
    setTimeout,
    clearTimeout,
    Date,
    fetch: null,
  });

  vm.runInContext(source, context);

  return {
    e,
    a: window.pdfLinguaAuth,
    c: context,
    storage: localStorage,
    session: sessionStorage,
    fireReady: () => (documentListeners['DOMContentLoaded'] || []).forEach((fn) => fn()),
    fireStorage: (key, newValue, oldValue = undefined) => {
      (windowListeners['storage'] || []).forEach((fn) => fn({ key, newValue, oldValue }));
    },
    fireVisibility: (state) => {
      document.visibilityState = state;
      (documentListeners['visibilitychange'] || []).forEach((fn) => fn());
    },
    authChangeEvents: windowListeners['pdfl:auth-change'] || [],
  };
}

function seedSession(env, token, user) {
  env.storage.setItem('pdfl_token', token);
  env.storage.setItem('pdfl_user', JSON.stringify(user));
}

function okResponse(user) {
  return { status: 200, json: async () => ({ success: true, data: user }) };
}

function flush(times = 4) {
  return new Promise((resolve) => {
    let remaining = times;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) return resolve();
      setTimeout(tick, 10);
    };
    setTimeout(tick, 10);
  });
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

(async () => {
  console.log('================================================================');
  console.log('PDF-Lingua Session Restoration & Sync (PDFL-43.4)');
  console.log('================================================================\n');

  await test('Boot: valid token is verified with /me and the header shows the user', async () => {
    const env = createEnv();
    seedSession(env, 'boot-token', { id: 1, email: 'boot@example.com', full_name: 'Boot User', role: 'free' });
    const calls = [];
    env.c.fetch = async (url, options) => {
      calls.push({ url: String(url), headers: options && options.headers });
      return okResponse({ id: 1, email: 'boot@example.com', full_name: 'Boot User', role: 'free' });
    };

    env.fireReady();
    await flush();

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url.endsWith('/api/auth/me'), true);
    assert.strictEqual(!!(calls[0].headers || {}).Authorization, true);
    assert.strictEqual(env.e.userDisplayName.textContent, 'Boot User');
    assert.strictEqual(env.e.authGuestGroup.hasAttribute('hidden'), true);
  });

  await test('Boot: no token means Guest and no /me request', async () => {
    const env = createEnv();
    let calls = 0;
    env.c.fetch = async () => { calls++; return okResponse({}); };

    env.fireReady();
    await flush();

    assert.strictEqual(calls, 0);
    assert.strictEqual(env.e.authGuestGroup.hasAttribute('hidden'), false);
    assert.strictEqual(env.e.userDisplayName.textContent, '');
  });

  for (const status of [401, 403]) {
    await test(`Boot: ${status} clears the local session and returns to Guest`, async () => {
      const env = createEnv();
      seedSession(env, 'expired-token', { id: 2, email: 'old@example.com', full_name: 'Old User', role: 'free' });
      env.c.fetch = async () => ({ status, json: async () => ({ success: false }) });

      env.fireReady();
      await flush();

      assert.strictEqual(env.storage.getItem('pdfl_token'), null);
      assert.strictEqual(env.storage.getItem('pdfl_user'), null);
      assert.strictEqual(env.e.authGuestGroup.hasAttribute('hidden'), false);
      assert.strictEqual(env.e.authUserGroup.hasAttribute('hidden'), true);
    });
  }

  await test('Boot: 500 keeps the cached session (no logout)', async () => {
    const env = createEnv();
    seedSession(env, 'server-error-token', { id: 3, email: 'keep@example.com', full_name: 'Keep User', role: 'free' });
    env.c.fetch = async () => ({ status: 500, json: async () => ({ success: false }) });

    env.fireReady();
    await flush();

    assert.strictEqual(env.storage.getItem('pdfl_token'), 'server-error-token');
    assert.strictEqual(env.e.userDisplayName.textContent, 'Keep User');
  });

  await test('Boot: network failure keeps the cached session (no logout)', async () => {
    const env = createEnv();
    seedSession(env, 'offline-token', { id: 4, email: 'offline@example.com', full_name: 'Offline User', role: 'free' });
    env.c.fetch = async () => { throw new Error('offline'); };

    env.fireReady();
    await flush();

    assert.strictEqual(env.storage.getItem('pdfl_token'), 'offline-token');
    assert.strictEqual(env.e.userDisplayName.textContent, 'Offline User');
  });

  await test('Boot: unchanged user is not written back to storage', async () => {
    const env = createEnv();
    const user = { id: 5, email: 'same@example.com', full_name: 'Same User', role: 'free' };
    seedSession(env, 'same-token', user);
    env.storage.writes = [];
    env.c.fetch = async () => okResponse({ ...user, is_active: true, created_at: '2026-01-01' });

    env.fireReady();
    await flush();

    assert.strictEqual(env.storage.writes.filter((k) => k === 'pdfl_user').length, 0);
    assert.strictEqual(env.e.userDisplayName.textContent, 'Same User');
  });

  await test('Sync: external logout resets memory, header and account modal without touching storage', async () => {
    const env = createEnv();
    seedSession(env, 'tab-a-token', { id: 6, email: 'a@example.com', full_name: 'Tab A', role: 'free' });
    let calls = 0;
    env.c.fetch = async () => { calls++; return okResponse({ id: 6, email: 'a@example.com', full_name: 'Tab A', role: 'free' }); };

    env.fireReady();
    await flush();
    assert.strictEqual(env.e.userDisplayName.textContent, 'Tab A');

    // Account modal is open when the other tab logs out.
    env.e.accountModal.removeAttribute('hidden');

    // Another tab clears the token: the event carries newValue === null.
    env.storage.removeItem('pdfl_token');
    env.storage.removeItem('pdfl_user');
    const writesBefore = env.storage.writes.length;
    calls = 0;

    env.fireStorage('pdfl_token', null, 'tab-a-token');
    await flush();

    assert.strictEqual(calls, 0, 'logout sync must not call /me');
    assert.strictEqual(env.e.authGuestGroup.hasAttribute('hidden'), false);
    assert.strictEqual(env.e.userDisplayName.textContent, '');
    assert.strictEqual(env.e.accountModal.hasAttribute('hidden'), true);
    assert.strictEqual(env.storage.writes.length, writesBefore, 'storage must not be written by the event handler');
  });

  await test('Sync: external login verifies the new token and shows the new user', async () => {
    const env = createEnv();
    let calls = 0;
    env.c.fetch = async () => {
      calls++;
      return okResponse({ id: 8, email: 'b@example.com', full_name: 'Tab B', role: 'pro' });
    };

    env.fireReady();
    await flush();
    assert.strictEqual(calls, 0);

    // Another tab logs in (writes the login response; this tab never sees it in memory).
    env.storage.setItem('pdfl_token', 'tab-b-token');
    env.storage.setItem('pdfl_user', JSON.stringify({ id: 8, email: 'b@example.com', full_name: 'Tab B', role: 'pro' }));
    const writesBefore = env.storage.writes.length;

    env.fireStorage('pdfl_token', 'tab-b-token', null);
    await flush();

    assert.strictEqual(calls, 1);
    assert.strictEqual(env.e.userDisplayName.textContent, 'Tab B');
    assert.strictEqual(env.storage.writes.length, writesBefore, 'sync must not write storage (no ping-pong)');
    assert.strictEqual(env.storage.getItem('pdfl_token'), 'tab-b-token');
  });

  await test('Sync: switching user X to Y never keeps user X', async () => {
    const env = createEnv();
    seedSession(env, 'token-x', { id: 10, email: 'x@example.com', full_name: 'User X', role: 'free' });
    let calls = 0;
    env.c.fetch = async () => {
      calls++;
      const token = env.storage.getItem('pdfl_token');
      const user = token === 'token-y'
        ? { id: 11, email: 'y@example.com', full_name: 'User Y', role: 'pro' }
        : { id: 10, email: 'x@example.com', full_name: 'User X', role: 'free' };
      return okResponse(user);
    };

    env.fireReady();
    await flush();
    assert.strictEqual(env.e.userDisplayName.textContent, 'User X');

    // Logout then login as another user in another tab.
    env.storage.removeItem('pdfl_token');
    env.storage.removeItem('pdfl_user');
    env.fireStorage('pdfl_token', null, 'token-x');
    await flush();

    env.storage.setItem('pdfl_token', 'token-y');
    env.storage.setItem('pdfl_user', JSON.stringify({ id: 11, email: 'y@example.com', full_name: 'User Y', role: 'pro' }));
    env.fireStorage('pdfl_token', 'token-y', null);
    await flush();

    assert.strictEqual(env.e.userDisplayName.textContent, 'User Y');
    assert.strictEqual(env.storage.getItem('pdfl_token'), 'token-y');
  });

  await test('Sync: pdfl_user events are ignored (no extra /me, no ping-pong)', async () => {
    const env = createEnv();
    seedSession(env, 'user-key-token', { id: 12, email: 'k@example.com', full_name: 'Key User', role: 'free' });
    let calls = 0;
    env.c.fetch = async () => { calls++; return okResponse({ id: 12, email: 'k@example.com', full_name: 'Key User', role: 'free' }); };

    env.fireReady();
    await flush();
    const callsAfterBoot = calls;

    env.storage.setItem('pdfl_user', JSON.stringify({ id: 99, email: 'other@example.com' }));
    env.fireStorage('pdfl_user', env.storage.getItem('pdfl_user'), null);
    await flush();

    assert.strictEqual(calls, callsAfterBoot, 'pdfl_user events must not trigger /me');
    assert.strictEqual(env.e.userDisplayName.textContent, 'Key User');
  });

  await test('Sync: overlapping events never produce stacked /me requests', async () => {
    const env = createEnv();
    seedSession(env, 'boot-pending', { id: 13, email: 'fast@example.com', full_name: 'Fast User', role: 'free' });
    let calls = 0;
    const resolvers = [];
    env.c.fetch = async () => {
      calls++;
      return new Promise((resolve) => { resolvers.push(resolve); });
    };

    env.fireReady();
    await flush();
    assert.strictEqual(calls, 1, 'boot verification in flight');

    env.storage.setItem('pdfl_token', 'token-fast-1');
    env.fireStorage('pdfl_token', 'token-fast-1', null);
    env.fireStorage('pdfl_token', 'token-fast-1', null);
    env.fireStorage('pdfl_token', 'token-fast-1', null);
    await flush();

    assert.strictEqual(calls, 1, 'no request while one is already running');

    // Resolve the boot request; exactly one queued verification may follow.
    resolvers[0](okResponse({ id: 13, email: 'fast@example.com', full_name: 'Fast User', role: 'free' }));
    await flush();

    assert.strictEqual(calls, 2, 'at most one coalesced follow-up request');
    if (resolvers[1]) resolvers[1](okResponse({ id: 13, email: 'fast@example.com', full_name: 'Fast User', role: 'free' }));
    await flush();
    assert.strictEqual(calls, 2);
  });

  await test('Sync: a response for an older token cannot overwrite the newer session', async () => {
    const env = createEnv();
    seedSession(env, 'token-old', { id: 14, email: 'old@example.com', full_name: 'Old User', role: 'free' });
    const resolvers = [];
    env.c.fetch = async () => new Promise((resolve) => { resolvers.push(resolve); });

    env.fireReady();
    await flush();
    assert.strictEqual(resolvers.length, 1);

    // Another tab logs in with a newer token before the old request resolves.
    env.storage.setItem('pdfl_token', 'token-new');
    env.storage.setItem('pdfl_user', JSON.stringify({ id: 15, email: 'new@example.com', full_name: 'New User', role: 'pro' }));
    env.fireStorage('pdfl_token', 'token-new', 'token-old');
    await flush();

    // Old response arrives late and must be ignored.
    resolvers[0](okResponse({ id: 14, email: 'old@example.com', full_name: 'Old User', role: 'free' }));
    await flush();

    assert.notStrictEqual(env.e.userDisplayName.textContent, 'Old User');

    // Because the token already changed, the queued verification resolves next.
    const pendingResolver = resolvers[resolvers.length - 1];
    if (pendingResolver) pendingResolver(okResponse({ id: 15, email: 'new@example.com', full_name: 'New User', role: 'pro' }));
    await flush();

    assert.strictEqual(env.e.userDisplayName.textContent, 'New User');
    assert.strictEqual(env.storage.getItem('pdfl_token'), 'token-new');
  });

  await test('Sync: token changed while the 200 body is parsing is never overwritten', async () => {
    const env = createEnv();
    seedSession(env, 'token-a', { id: 21, email: 'a@example.com', full_name: 'User A', role: 'free' });
    env.c.fetch = async () => ({
      status: 200,
      json: async () => {
        // Another tab switches account while the body is being parsed.
        env.storage.setItem('pdfl_token', 'token-b');
        env.storage.setItem('pdfl_user', JSON.stringify({ id: 22, email: 'b@example.com', full_name: 'User B', role: 'pro' }));
        return { success: true, data: { id: 23, email: 'stale@example.com', full_name: 'Stale User', role: 'free' } };
      },
    });

    env.fireReady();
    await flush();

    assert.strictEqual(env.e.userDisplayName.textContent, 'User A', 'only the optimistic cache may render');
    assert.strictEqual(env.storage.getItem('pdfl_token'), 'token-b');
    assert.match(env.storage.getItem('pdfl_user'), /b@example\.com/);
  });

  await test('Visibility: coming back to the tab re-verifies at most once per minute', async () => {
    const env = createEnv();
    seedSession(env, 'visible-token', { id: 16, email: 'v@example.com', full_name: 'Visible User', role: 'free' });
    let calls = 0;
    env.c.fetch = async () => { calls++; return okResponse({ id: 16, email: 'v@example.com', full_name: 'Visible User', role: 'free' }); };

    env.fireReady();
    await flush();
    const callsAfterBoot = calls;

    env.fireVisibility('hidden');
    env.fireVisibility('visible');
    await flush();
    env.fireVisibility('visible');
    await flush();

    assert.strictEqual(calls, callsAfterBoot + 1, 'throttled to a single re-check');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${total} session sync tests passed (${total - passed} failed).`);
  console.log('================================================================');
})().catch((err) => {
  console.error('[FATAL]', err);
  process.exitCode = 1;
});
