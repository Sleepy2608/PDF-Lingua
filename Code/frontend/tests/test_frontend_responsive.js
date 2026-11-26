'use strict';

/**
 * Automated Responsive UI Test Suite (Real Browser via Chrome DevTools Protocol)
 *
 * Self-contained, zero external dependencies:
 * - Starts an ephemeral in-process HTTP static server for Code/frontend on 127.0.0.1:0.
 * - Spawns a local headless Chromium/Chrome/Edge browser with an isolated temp profile.
 * - Executes live DOM geometry, overflow, overlap, clipping, modal scrollability,
 *   and touch-target assertions across 6 viewports and all major UI areas.
 * - Includes an in-memory defect-injection meta-check proving the assertions catch
 *   real layout regressions without modifying any application files.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const FRONTEND_DIR = path.resolve(__dirname, '..');

const VIEWPORTS = [
  { name: '1440x900', tier: 'Desktop', width: 1440, height: 900, mobile: false },
  { name: '1280x800', tier: 'Desktop', width: 1280, height: 800, mobile: false },
  { name: '1024x768', tier: 'Tablet', width: 1024, height: 768, mobile: false },
  { name: '768x1024', tier: 'Tablet', width: 768, height: 1024, mobile: true },
  { name: '390x844', tier: 'Mobile', width: 390, height: 844, mobile: true },
  { name: '360x740', tier: 'Mobile', width: 360, height: 740, mobile: true },
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Browser Discovery & Ephemeral Infrastructure ---

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {
      // Continue checking remaining candidate paths
    }
  }

  if (process.platform !== 'win32') {
    for (const cmd of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
      try {
        const resolved = execFileSync('which', [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (resolved && fs.existsSync(resolved)) return resolved;
      } catch (_) {
        // Command not on PATH
      }
    }
  }

  return null;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      const rawPath = decodeURIComponent(reqUrl.pathname);
      const relPath = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
      const absPath = path.resolve(rootDir, relPath);

      if (!absPath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(absPath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        const ext = path.extname(absPath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(content);
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

// --- Zero-Dependency RFC 6455 WebSocket Client (Node 20 Compatibility) ---

class RawWebSocket {
  constructor(wsUrl) {
    this.url = new URL(wsUrl);
    this.listeners = { open: [], message: [], error: [], close: [] };
    this.buffer = Buffer.alloc(0);
    this.handshakeDone = false;
    this.fragmentChunks = [];
    this.socket = null;
    this._connect();
  }

  addEventListener(type, fn, opts = {}) {
    if (!this.listeners[type]) return;
    const entry = { fn, once: Boolean(opts && opts.once) };
    this.listeners[type].push(entry);
  }

  _emit(type, payload) {
    const list = this.listeners[type] || [];
    const remaining = [];
    for (const entry of list) {
      entry.fn(payload);
      if (!entry.once) remaining.push(entry);
    }
    this.listeners[type] = remaining;
  }

  _connect() {
    const key = crypto.randomBytes(16).toString('base64');
    const port = Number(this.url.port) || 80;
    const host = this.url.hostname;
    const reqPath = `${this.url.pathname}${this.url.search}`;

    this.socket = net.createConnection({ host, port }, () => {
      const headers = [
        `GET ${reqPath} HTTP/1.1`,
        `Host: ${host}:${port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n');
      this.socket.write(headers);
    });

    this.socket.on('error', (err) => this._emit('error', err));
    this.socket.on('close', () => this._emit('close', {}));
    this.socket.on('data', (chunk) => this._onData(chunk));
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    if (!this.handshakeDone) {
      const sepIdx = this.buffer.indexOf('\r\n\r\n');
      if (sepIdx === -1) return;
      const headerText = this.buffer.slice(0, sepIdx).toString('utf8');
      this.buffer = this.buffer.slice(sepIdx + 4);
      if (!headerText.startsWith('HTTP/1.1 101')) {
        this._emit('error', new Error(`WebSocket handshake failed: ${headerText.split('\r\n')[0]}`));
        this.close();
        return;
      }
      this.handshakeDone = true;
      this._emit('open', {});
    }

    this._drainFrames();
  }

  _drainFrames() {
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (this.buffer.length < offset + 2) return;
        payloadLen = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        if (this.buffer.length < offset + 8) return;
        payloadLen = Number(this.buffer.readBigUInt64BE(offset));
        offset += 8;
      }

      const maskLen = masked ? 4 : 0;
      if (this.buffer.length < offset + maskLen + payloadLen) return;

      let payload = this.buffer.slice(offset + maskLen, offset + maskLen + payloadLen);
      if (masked) {
        const mask = this.buffer.slice(offset, offset + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buffer = this.buffer.slice(offset + maskLen + payloadLen);

      if (opcode === 0x8) {
        this.close();
        return;
      }
      if (opcode === 0x9) {
        this._sendFrame(0xA, payload);
        continue;
      }
      if (opcode === 0x1 || opcode === 0x0) {
        this.fragmentChunks.push(payload);
        if (fin) {
          const full = Buffer.concat(this.fragmentChunks).toString('utf8');
          this.fragmentChunks = [];
          this._emit('message', { data: full });
        }
      }
    }
  }

  _sendFrame(opcode, payloadBuf) {
    if (!this.socket || this.socket.destroyed) return;
    const len = payloadBuf.length;
    const mask = crypto.randomBytes(4);
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }

    const maskedPayload = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) {
      maskedPayload[i] = payloadBuf[i] ^ mask[i & 3];
    }
    this.socket.write(Buffer.concat([header, mask, maskedPayload]));
  }

  send(text) {
    this._sendFrame(0x1, Buffer.from(String(text), 'utf8'));
  }

  close() {
    if (this.socket && !this.socket.destroyed) {
      try {
        this.socket.end();
        this.socket.destroy();
      } catch (_) {
        // Ignore teardown socket error
      }
    }
  }
}

function createWebSocket(wsUrl) {
  if (process.env.FORCE_RAW_WS !== '1' && typeof globalThis.WebSocket === 'function') {
    return new globalThis.WebSocket(wsUrl);
  }
  return new RawWebSocket(wsUrl);
}

// --- Minimal Chrome DevTools Protocol Client ---

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
  }

  async connect() {
    this.ws = createWebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });

    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      } else if (msg.method && this.events.has(msg.method)) {
        for (const handler of [...this.events.get(msg.method)]) {
          handler(msg.params);
        }
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const list = this.events.get(method) || [];
      const fn = (params) => {
        const idx = list.indexOf(fn);
        if (idx >= 0) list.splice(idx, 1);
        resolve(params);
      };
      list.push(fn);
      this.events.set(method, list);
    });
  }

  async eval(expression) {
    const trimmed = expression.trim();
    const wrapped = trimmed.startsWith('(()') ? trimmed : `(() => { ${trimmed} })()`;
    const res = await this.send('Runtime.evaluate', {
      expression: wrapped,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      const desc =
        res.exceptionDetails.exception?.description ||
        res.exceptionDetails.text ||
        'Unknown JS evaluation error';
      throw new Error(`Browser JS error: ${desc}`);
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    try {
      this.ws.close();
    } catch (_) {
      // Ignore close error on teardown
    }
  }
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('HTTP timeout')));
  });
}

async function waitForCDP(port, timeoutMs = 25000, getStderr = null) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tabs = await httpGetJson(`http://127.0.0.1:${port}/json/list`);
      const page = Array.isArray(tabs)
        ? tabs.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
        : null;
      if (page) return page.webSocketDebuggerUrl;
    } catch (_) {
      // Chrome debugging port still starting up
    }
    await sleep(200);
  }
  const errTail = getStderr ? getStderr().trim() : '';
  const extra = errTail ? `\nChrome stderr:\n${errTail}` : '';
  throw new Error(`Timed out waiting for headless Chrome CDP on port ${port}${extra}`);
}

async function navigate(cdp, url) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
  await sleep(300);
}

async function setViewport(cdp, vp) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 1,
    mobile: vp.mobile,
  });
  await cdp.eval(`return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
}

async function waitForSettled(cdp, selector, timeoutMs = 1500) {
  return cdp.eval(`return new Promise((resolve) => {
    const start = performance.now();
    let prev = null;
    let stableFrames = 0;
    const step = () => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el) {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const op = parseFloat(s.opacity);
        const key = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(',');
        if (s.display !== 'none' && s.visibility !== 'hidden' && op >= 0.95 && r.width > 0 && r.height > 0) {
          if (key === prev) {
            stableFrames++;
            if (stableFrames >= 2) return resolve(true);
          } else {
            prev = key;
            stableFrames = 0;
          }
        }
      }
      if (performance.now() - start >= ${timeoutMs}) return resolve(false);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })`);
}

// --- In-Browser DOM Geometry Probes ---

const PROBE_BASE_LAYOUT = `(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const docSW = document.documentElement.scrollWidth;
  const bodySW = document.body.scrollWidth;

  const isVisible = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const rectOf = (sel) => {
    const el = document.querySelector(sel);
    if (!el || !isVisible(el)) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      height: Math.round(r.height),
      scrollWidth: Math.round(el.scrollWidth),
      clientWidth: Math.round(el.clientWidth),
      scrollHeight: Math.round(el.scrollHeight),
      clientHeight: Math.round(el.clientHeight),
      overflowX: s.overflowX,
      overflowY: s.overflowY,
    };
  };

  const checkContainerOverlap = (sel) => {
    const el = document.querySelector(sel);
    if (!el || !isVisible(el)) return { exists: false, overflowPx: 0, overlaps: [] };
    const s = getComputedStyle(el);
    const overflowPx = ['auto', 'scroll'].includes(s.overflowX)
      ? 0
      : Math.max(0, Math.round(el.scrollWidth - el.clientWidth));
    const kids = [...el.children].filter(isVisible);
    const overlaps = [];
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect();
        const b = kids[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) {
          overlaps.push({
            a: kids[i].id || kids[i].className,
            b: kids[j].id || kids[j].className,
            ox: Math.round(ox),
            oy: Math.round(oy),
          });
        }
      }
    }
    return { exists: true, overflowPx, overlaps };
  };

  return { vw, vh, docSW, bodySW, docOvX: Math.max(0, docSW - vw, bodySW - vw), rectOf, checkContainerOverlap, isVisible };
})`;

function evalWithHelpers(cdp, bodyCode) {
  return cdp.eval(`(() => {
    const H = ${PROBE_BASE_LAYOUT}();
    ${bodyCode}
  })()`);
}

// --- Test Harness ---

class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.viewportStats = new Map();
  }

  async run(viewportName, label, fn) {
    if (!this.viewportStats.has(viewportName)) {
      this.viewportStats.set(viewportName, { pass: 0, fail: 0 });
    }
    const stat = this.viewportStats.get(viewportName);
    try {
      await fn();
      this.passed++;
      stat.pass++;
    } catch (err) {
      this.failed++;
      stat.fail++;
      const msg = `[${viewportName}] ${label}: ${err.message}`;
      this.failures.push(msg);
      console.log(`  [FAIL] ${msg}`);
    }
  }
}

// --- Shared Page State Helpers ---

const SHOW_ONLY_SECTION = (sectionId) => `
  ['heroSection','workspaceSection','documentsSection','historySection','pricingSection','adminSection'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = id !== '${sectionId}';
    el.style.display = id === '${sectionId}' ? '' : 'none';
  });
  ['loginModal','registerModal','accountModal','avatarCropModal','pricingCheckoutModal','documentDetailModal','legalModalOverlay','quotaExceededModal','aiProModal','processingModal'].forEach((mid) => {
    const m = document.getElementById(mid);
    if (m) {
      m.hidden = true;
      m.style.display = 'none';
      m.classList.remove('active', 'open');
    }
  });
  const cop = document.getElementById('aiCopilotDrawer');
  if (cop) {
    cop.hidden = true;
    cop.style.display = 'none';
  }
  const sb = document.getElementById('appSidebar');
  if (sb) sb.classList.remove('mobile-open');
  const sbBg = document.getElementById('sidebarBackdrop');
  if (sbBg) sbBg.classList.remove('active');
  window.scrollTo(0, 0);
`;

// --- Area Test Suites ---

async function testWelcomeArea(cdp, vp, runner) {
  await runner.run(vp.name, 'Welcome: Zero horizontal overflow and clean navbar', async () => {
    await cdp.eval(`
      window.scrollTo(0, 0);
      document.querySelectorAll('.welcome-reveal').forEach((e) => e.classList.add('is-visible'));
    `);
    await sleep(80);
    const res = await evalWithHelpers(cdp, `
      const nav = H.checkContainerOverlap('.welcome-navbar-inner');
      const brand = H.rectOf('.welcome-brand-link');
      const toggle = H.rectOf('#btnWelcomeMobileMenu');
      const pane = H.rectOf('#paneOriginal');
      const copyBtn = H.rectOf('#paneOriginal .welcome-pane-copy');
      const codePara = H.rectOf('#paneOriginal .welcome-para-code');
      return {
        vw: H.vw,
        docOvX: H.docOvX,
        nav,
        brand,
        toggle,
        pane,
        copyBtn,
        codePara,
      };
    `);

    assert.strictEqual(res.docOvX, 0, `Welcome page horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.nav.exists, 'Welcome navbar must be visible');
    assert.ok(
      res.nav.overflowPx <= 2,
      `Welcome navbar overflowed container by ${res.nav.overflowPx}px`
    );
    assert.strictEqual(
      res.nav.overlaps.length,
      0,
      `Welcome navbar sibling overlap detected: ${JSON.stringify(res.nav.overlaps)}`
    );
    assert.ok(res.brand && res.brand.right <= res.vw + 1, 'Welcome brand exceeds viewport');

    if (vp.width <= 640) {
      assert.ok(res.toggle, 'Mobile menu toggle must be visible on <= 640px');
      assert.ok(res.toggle.right <= res.vw + 1, 'Mobile toggle button exceeds viewport');
      assert.ok(
        res.toggle.width >= 36 && res.toggle.height >= 36,
        `Mobile menu toggle touch target too small: ${res.toggle.width}x${res.toggle.height}`
      );
    }

    assert.ok(res.pane, 'Welcome preview original pane must be visible');
    assert.ok(res.pane.right <= res.vw + 1, `Welcome preview pane exceeds viewport (${res.pane.right} > ${res.vw})`);
    assert.ok(
      res.copyBtn && res.copyBtn.right <= res.pane.right + 1,
      `Welcome preview Copy button clipped outside pane (${res.copyBtn?.right} > ${res.pane.right})`
    );
    assert.ok(
      res.codePara && res.codePara.right <= res.pane.right + 1,
      `Welcome preview URL/code paragraph overflows pane (${res.codePara?.right} > ${res.pane.right})`
    );
  });

  if (vp.width <= 768) {
    await runner.run(vp.name, 'Welcome: Mobile drawer opens cleanly without overflow', async () => {
      await cdp.eval(`
        window.scrollTo(0, 0);
        const btn = document.getElementById('btnWelcomeMobileMenu');
        if (btn && btn.getAttribute('aria-expanded') !== 'true') btn.click();
      `);
      await sleep(120);
      const res = await evalWithHelpers(cdp, `
        const drawer = H.rectOf('#welcomeMobileDrawer');
        const langBtn = H.rectOf('#mobileLangSwitcher .lang-switcher-btn');
        return { vw: H.vw, docOvX: H.docOvX, drawer, langBtn };
      `);
      await cdp.eval(`
        const btn = document.getElementById('btnWelcomeMobileMenu');
        if (btn && btn.getAttribute('aria-expanded') === 'true') btn.click();
      `);

      assert.strictEqual(res.docOvX, 0, `Welcome mobile drawer caused horizontal overflow: ${res.docOvX}px`);
      assert.ok(res.drawer && res.drawer.right <= res.vw + 1, 'Welcome mobile drawer exceeds viewport');
      if (vp.width <= 640 && res.langBtn) {
        assert.ok(
          res.langBtn.height >= 34,
          `Mobile drawer language button height too small: ${res.langBtn.height}px`
        );
      }
    });
  }
}

async function testAppShellAndSidebar(cdp, vp, runner) {
  await runner.run(vp.name, 'App Shell Header (Guest): Zero overflow, zero overlap, tappable controls', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('heroSection'));
    await cdp.eval(`
      document.getElementById('authGuestGroup').hidden = false;
      document.getElementById('authGuestGroup').style.display = '';
      document.getElementById('authUserGroup').hidden = true;
      document.getElementById('authUserGroup').style.display = 'none';
    `);
    await sleep(80);
    const res = await evalWithHelpers(cdp, `
      const bar = H.checkContainerOverlap('.site-header .header-container');
      const loginBtn = H.rectOf('#btnLogin');
      const regBtn = H.rectOf('#btnOpenRegister');
      const lang = H.rectOf('#appLangSwitcher');
      const footerLinks = [...document.querySelectorAll('.footer-links a')].map((a) => {
        const r = a.getBoundingClientRect();
        return { id: a.id, h: Math.round(r.height), r: Math.round(r.right) };
      });
      return { vw: H.vw, docOvX: H.docOvX, bar, loginBtn, regBtn, lang, footerLinks };
    `);

    assert.strictEqual(res.docOvX, 0, `Guest shell horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.bar.overflowPx <= 2, `Header container overflowed by ${res.bar.overflowPx}px`);
    assert.strictEqual(res.bar.overlaps.length, 0, `Header sibling overlap: ${JSON.stringify(res.bar.overlaps)}`);
    assert.ok(res.loginBtn && res.loginBtn.right <= res.vw + 1, 'Login button clipped past viewport');
    assert.ok(res.regBtn && res.regBtn.right <= res.vw + 1, 'Register button clipped past viewport');
    assert.ok(res.lang && res.lang.right <= res.vw + 1, 'Language switcher clipped past viewport');

    if (vp.width <= 640) {
      assert.ok(res.loginBtn.height >= 34, `Mobile Login button height too small: ${res.loginBtn.height}px`);
      assert.ok(res.regBtn.height >= 34, `Mobile Register button height too small: ${res.regBtn.height}px`);
      for (const fl of res.footerLinks) {
        assert.ok(fl.h >= 34, `Mobile footer link ${fl.id} height too small: ${fl.h}px`);
      }
    }
  });

  await runner.run(vp.name, 'App Shell Header (Authenticated Admin): All controls stay within viewport', async () => {
    await cdp.eval(`
      document.getElementById('authGuestGroup').style.display = 'none';
      const u = document.getElementById('authUserGroup');
      u.hidden = false;
      u.style.display = 'flex';
      document.getElementById('btnOpenAdmin').style.display = 'inline-flex';
      document.getElementById('userDisplayName').textContent = 'Nguyen Van A';
      document.getElementById('userAvatar').textContent = 'NA';
    `);
    await sleep(80);
    const res = await evalWithHelpers(cdp, `
      const bar = H.checkContainerOverlap('.site-header .header-container');
      const adminBtn = H.rectOf('#btnOpenAdmin');
      const profileBtn = H.rectOf('#btnOpenAccountModal');
      const logoutBtn = H.rectOf('#btnLogout');
      const lang = H.rectOf('#appLangSwitcher');
      return { vw: H.vw, docOvX: H.docOvX, bar, adminBtn, profileBtn, logoutBtn, lang };
    `);
    await cdp.eval(`
      document.getElementById('authGuestGroup').style.display = '';
      document.getElementById('authUserGroup').style.display = 'none';
    `);

    assert.strictEqual(res.docOvX, 0, `Authenticated Admin shell overflow: ${res.docOvX}px`);
    assert.ok(res.bar.overflowPx <= 2, `Admin header overflowed by ${res.bar.overflowPx}px`);
    assert.strictEqual(res.bar.overlaps.length, 0, `Admin header overlap: ${JSON.stringify(res.bar.overlaps)}`);
    assert.ok(res.adminBtn && res.adminBtn.right <= res.vw + 1, 'Admin badge exceeds viewport');
    assert.ok(res.profileBtn && res.profileBtn.right <= res.vw + 1, 'Profile button exceeds viewport');
    assert.ok(res.logoutBtn && res.logoutBtn.right <= res.vw + 1, 'Logout button exceeds viewport');
    assert.ok(res.lang && res.lang.right <= res.vw + 1, 'Language switcher exceeds viewport');
  });

  await runner.run(vp.name, 'Sidebar: Desktop pinned vs Mobile off-canvas drawer behavior', async () => {
    await waitForSettled(cdp, '#appSidebar');
    const res = await evalWithHelpers(cdp, `
      const sb = H.rectOf('#appSidebar');
      const mobileToggle = H.rectOf('#btnMobileSidebarToggle');
      return { vw: H.vw, sb, mobileToggle };
    `);

    if (vp.width >= 768) {
      assert.ok(res.sb && res.sb.left >= 0 && res.sb.width >= 200, 'Sidebar must be visible on >= 768px');
      assert.strictEqual(res.mobileToggle, null, 'Mobile hamburger toggle must be hidden on >= 768px');
    } else {
      assert.ok(res.mobileToggle && res.mobileToggle.width >= 36 && res.mobileToggle.height >= 36, 'Mobile sidebar toggle must be tappable');
      assert.ok(res.sb && res.sb.right <= 1, 'Closed mobile sidebar must be translated off-canvas');

      await cdp.eval(`
        document.getElementById('appSidebar').classList.add('mobile-open');
        document.getElementById('sidebarBackdrop').classList.add('active');
      `);
      await waitForSettled(cdp, '#appSidebar');
      const openState = await evalWithHelpers(cdp, `
        return { vw: H.vw, docOvX: H.docOvX, sb: H.rectOf('#appSidebar') };
      `);
      await cdp.eval(`
        document.getElementById('appSidebar').classList.remove('mobile-open');
        document.getElementById('sidebarBackdrop').classList.remove('active');
      `);
      assert.strictEqual(openState.docOvX, 0, `Open mobile sidebar caused horizontal overflow: ${openState.docOvX}px`);
      assert.ok(openState.sb && openState.sb.left >= -1 && openState.sb.right <= openState.vw, 'Open mobile sidebar must fit inside viewport');
    }
  });
}

async function testWorkspaceAndCopilot(cdp, vp, runner) {
  await runner.run(vp.name, 'Workspace Text View, Toolbar & Page Translation Bar: Responsive layout', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('workspaceSection'));
    await cdp.eval(`
      document.getElementById('btnViewModeText')?.click();
      const bar = document.getElementById('pageTranslationBar');
      if (bar) {
        bar.hidden = false;
        bar.style.display = '';
        bar.querySelectorAll('[hidden]').forEach((el) => {
          if (el.id !== 'pageBarErrorBanner') el.hidden = false;
        });
      }
      const sel = document.getElementById('pageBarSelect');
      if (sel) {
        sel.innerHTML = '<option value="2">Trang 2 (1/3)</option><option value="5">Trang 5 (2/3)</option><option value="6">Trang 6 (3/3)</option>';
      }
      const badge = document.getElementById('pageBarStatusBadge');
      if (badge) {
        badge.hidden = false;
        badge.textContent = 'Da dich';
      }
    `);
    await sleep(100);

    const res = await evalWithHelpers(cdp, `
      const toolbar = H.rectOf('.workspace-toolbar');
      const toolbarCheck = H.checkContainerOverlap('.workspace-toolbar');
      const switcher = H.rectOf('.view-mode-switcher');
      const modeBtns = ['#btnViewModeText', '#btnViewModePdf', '#btnViewModeSplit'].map((s) => ({ sel: s, r: H.rectOf(s) }));
      const pageBar = H.rectOf('#pageTranslationBar');
      const pageActions = ['#btnPageSave', '#btnPageReload', '#btnPageRetranslate'].map((s) => ({ sel: s, r: H.rectOf(s) }));
      const orig = H.rectOf('#paneCardOriginal');
      const trans = H.rectOf('#paneCardTranslated');
      return { vw: H.vw, docOvX: H.docOvX, toolbar, toolbarCheck, switcher, modeBtns, pageBar, pageActions, orig, trans };
    `);

    assert.strictEqual(res.docOvX, 0, `Workspace horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.toolbar && res.toolbar.right <= res.vw + 1, 'Workspace toolbar exceeds viewport');
    assert.ok(
      res.toolbarCheck.overflowPx <= 2,
      `Workspace toolbar internal overflow: ${res.toolbarCheck.overflowPx}px`
    );
    assert.ok(
      res.switcher && res.switcher.right <= res.toolbar.right + 1,
      `View mode switcher overflows toolbar card (${res.switcher?.right} > ${res.toolbar.right})`
    );
    for (const mb of res.modeBtns) {
      assert.ok(mb.r && mb.r.right <= res.toolbar.right + 1, `${mb.sel} overflows toolbar card`);
      if (vp.width <= 640) {
        assert.ok(mb.r.height >= 34, `${mb.sel} touch height too small on mobile: ${mb.r.height}px`);
      }
    }

    // Page Translation Bar checks
    assert.ok(res.pageBar && res.pageBar.right <= res.vw + 1, 'Page Translation Bar exceeds viewport');
    for (const act of res.pageActions) {
      if (act.r) {
        assert.ok(act.r.right <= res.vw + 1, `${act.sel} exceeds viewport`);
        if (vp.width <= 768) {
          assert.ok(act.r.height >= 34, `${act.sel} touch height too small: ${act.r.height}px`);
        }
      }
    }

    // Dual-pane layout: side-by-side on >= 1024px, stacked 1-column on <= 900px
    assert.ok(res.orig && res.trans, 'Original and Translated pane cards must both be visible');
    assert.ok(res.orig.right <= res.vw + 1, `Original pane exceeds viewport (${res.orig.right} > ${res.vw})`);
    assert.ok(res.trans.right <= res.vw + 1, `Translated pane exceeds viewport (${res.trans.right} > ${res.vw})`);
    if (vp.width >= 1024) {
      assert.ok(
        res.orig.right <= res.trans.left + 2,
        `Desktop/1024px dual-pane should remain side-by-side (orig.right=${res.orig.right}, trans.left=${res.trans.left})`
      );
    } else {
      assert.ok(
        res.trans.top >= res.orig.bottom - 2,
        `Tablet/Mobile (${vp.name}) dual-pane must stack vertically (orig.bottom=${res.orig.bottom}, trans.top=${res.trans.top})`
      );
    }
  });

  await runner.run(vp.name, 'Workspace Split View & PDF Preview: Mode switching without overflow', async () => {
    await cdp.eval(`document.getElementById('btnViewModeSplit')?.click();`);
    await sleep(100);
    const res = await evalWithHelpers(cdp, `
      const preview = H.rectOf('#pdfPreviewContainer');
      const mobileTabs = H.rectOf('#splitMobileTabBar');
      const trans = H.rectOf('#paneCardTranslated');
      return { vw: H.vw, docOvX: H.docOvX, preview, mobileTabs, trans };
    `);

    assert.strictEqual(res.docOvX, 0, `Split view horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.preview && res.preview.right <= res.vw + 1, 'PDF Preview container exceeds viewport');
    if (vp.width >= 1025) {
      assert.strictEqual(res.mobileTabs, null, 'Split mobile tab bar must stay hidden on > 1024px');
      assert.ok(res.trans && res.preview.right <= res.trans.left + 2, 'Split view on > 1024px must be side-by-side');
    } else {
      assert.ok(res.mobileTabs && res.mobileTabs.right <= res.vw + 1, 'Split mobile tab bar must be visible on <= 1024px');
    }
  });

  await runner.run(vp.name, 'AI Copilot Drawer: Alignment, non-clipped header, and tappable controls', async () => {
    await cdp.eval(`
      document.getElementById('btnViewModeText')?.click();
      const cop = document.getElementById('aiCopilotDrawer');
      if (cop) {
        cop.hidden = false;
        cop.style.display = 'flex';
      }
    `);
    await waitForSettled(cdp, '#aiCopilotDrawer');

    const res = await evalWithHelpers(cdp, `
      const drawer = H.rectOf('#aiCopilotDrawer');
      const header = H.rectOf('.copilot-drawer-header');
      const headerCheck = H.checkContainerOverlap('.copilot-drawer-header');
      const clearBtn = H.rectOf('#btnClearCopilotChat');
      const quotaPill = H.rectOf('#copilotQuotaBadge');
      return { vw: H.vw, vh: H.vh, docOvX: H.docOvX, drawer, header, headerCheck, clearBtn, quotaPill };
    `);
    await cdp.eval(`
      const cop = document.getElementById('aiCopilotDrawer');
      if (cop) { cop.hidden = true; cop.style.display = 'none'; }
    `);

    assert.strictEqual(res.docOvX, 0, `AI Copilot caused document horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.drawer, 'AI Copilot drawer must be visible');
    assert.ok(
      res.drawer.left >= -1 && res.drawer.right <= res.vw + 1,
      `AI Copilot drawer misaligned outside viewport (left=${res.drawer.left}, right=${res.drawer.right}, vw=${res.vw})`
    );
    assert.ok(
      res.headerCheck.overflowPx <= 2,
      `AI Copilot header overflowed horizontally by ${res.headerCheck.overflowPx}px`
    );
    assert.strictEqual(
      res.headerCheck.overlaps.length,
      0,
      `AI Copilot header overlap: ${JSON.stringify(res.headerCheck.overlaps)}`
    );
    assert.ok(
      res.header.scrollHeight <= res.header.clientHeight + 2,
      `AI Copilot header clipped vertically (${res.header.scrollHeight} > ${res.header.clientHeight})`
    );
    assert.ok(res.clearBtn && res.clearBtn.right <= res.vw + 1, 'Copilot clear button clipped past viewport');
    if (vp.width <= 768) {
      assert.ok(res.clearBtn.width >= 34 && res.clearBtn.height >= 34, `Copilot icon touch target too small: ${res.clearBtn.width}x${res.clearBtn.height}`);
    }
  });
}

async function testDocumentsHistoryAdmin(cdp, vp, runner) {
  await runner.run(vp.name, 'Documents Section: Populated table fits cleanly with horizontal scroll wrapper', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('documentsSection'));
    await cdp.eval(`
      ['documentsLoadingState','documentsEmptyState','documentsErrorState','documentsUnauthState'].forEach((id) => {
        const e = document.getElementById(id); if (e) e.hidden = true;
      });
      const tw = document.getElementById('documentsTableWrapper');
      if (tw) tw.hidden = false;
      document.getElementById('documentsTableBody').innerHTML =
        '<tr><td><strong>annual_financial_report_2026_audited.pdf</strong></td><td>4.2 MB</td><td>32 trang</td><td>PDF So</td><td>22/11/2026</td><td><button class="doc-action-btn">Xem</button></td></tr>';
    `);
    await sleep(80);
    const res = await evalWithHelpers(cdp, `
      return {
        vw: H.vw,
        docOvX: H.docOvX,
        card: H.rectOf('#documentsListCard'),
        wrap: H.rectOf('#documentsTableWrapper'),
      };
    `);
    assert.strictEqual(res.docOvX, 0, `Documents horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.card && res.card.right <= res.vw + 1, 'Documents card exceeds viewport');
    assert.ok(res.wrap && ['auto', 'scroll'].includes(res.wrap.overflowX), 'Documents table wrapper must allow horizontal scroll');
  });

  await runner.run(vp.name, 'History Section: Populated table fits cleanly without horizontal overflow', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('historySection'));
    await cdp.eval(`
      ['historyLoadingState','historyEmptyState','historyErrorState','historyUnauthState'].forEach((id) => {
        const e = document.getElementById(id); if (e) e.hidden = true;
      });
      const tw = document.getElementById('historyTableWrapper');
      if (tw) tw.hidden = false;
      document.getElementById('historyTableBody').innerHTML =
        '<tr><td>1</td><td><strong>deep_learning_ch4.pdf</strong></td><td>EN -> VI</td><td>Google</td><td>Hoan thanh</td><td>12.4s</td><td>22/11/2026</td><td><button class="doc-action-btn">Mo</button></td></tr>';
    `);
    await sleep(80);
    const res = await evalWithHelpers(cdp, `
      return {
        vw: H.vw,
        docOvX: H.docOvX,
        card: H.rectOf('#historyListCard'),
        wrap: H.rectOf('#historyTableWrapper'),
        refreshBtn: H.rectOf('#btnHistoryRefresh'),
      };
    `);
    assert.strictEqual(res.docOvX, 0, `History horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.card && res.card.right <= res.vw + 1, 'History card exceeds viewport');
    assert.ok(res.wrap && ['auto', 'scroll'].includes(res.wrap.overflowX), 'History table wrapper must allow horizontal scroll');
    if (vp.width <= 768 && res.refreshBtn) {
      assert.ok(res.refreshBtn.height >= 34, `History refresh button height too small on mobile: ${res.refreshBtn.height}px`);
    }
  });

  await runner.run(vp.name, 'Admin Section: Users table, pills, and toolbar stay single-line and inside bounds', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('adminSection'));
    await cdp.eval(`
      const usersTabBtn = document.getElementById('sideNavAdminUsers');
      if (usersTabBtn) usersTabBtn.click();
      const overviewTab = document.getElementById('adminTabOverview');
      const usersTab = document.getElementById('adminTabUsers');
      const accessLogsTab = document.getElementById('adminTabAccessLogs');
      const txTab = document.getElementById('adminTabTransactions');
      if (overviewTab) overviewTab.style.display = 'none';
      if (accessLogsTab) accessLogsTab.style.display = 'none';
      if (txTab) txTab.style.display = 'none';
      if (usersTab) usersTab.style.display = 'block';
      document.getElementById('adminTableEmptyState').style.display = 'none';
      document.getElementById('adminUsersTableBody').innerHTML =
        '<tr><td><span class="user-id-mono">#9</span></td><td><div class="user-cell-meta"><div class="user-cell-avatar role-avatar-admin">Q</div><div><div class="user-cell-name">Quan Tri Vien</div><div class="user-cell-email">admin@pdflingua.edu.vn</div></div></div></td><td><span class="role-badge admin" id="testAdminRolePill">QUAN TRI VIEN</span></td><td><span class="status-pill active" id="testAdminStatusPill"><span class="status-dot"></span>Hoat dong</span></td><td><span class="doc-count-mono">12</span> <span class="doc-unit">tep</span></td><td><div class="admin-ip-cell"><div class="admin-ip-top"><span class="admin-ip-address font-mono">127.0.0.1</span><button type="button" class="btn-view-ip">Xem IP</button></div><div class="admin-ip-device">Edge / Windows</div></div></td><td><span class="date-mono">13/11/2026 06:04</span></td><td class="text-right"><div class="user-actions-group"><button class="btn-action btn-action-role" id="testRoleActionBtn">Ha Mien phi</button><button class="btn-action btn-action-lock" id="testLockActionBtn">Khoa</button></div></td></tr>';
      document.querySelector('#adminTabUsers .admin-table-card')?.scrollIntoView();
    `);
    await sleep(80);
    const res = await evalWithHelpers(cdp, `
      const card = H.rectOf('#adminTabUsers .admin-table-card');
      const wrap = H.rectOf('#adminTabUsers .admin-table-wrapper');
      const search = H.rectOf('#adminSearchInput');
      const usersToolbar = H.checkContainerOverlap('#adminTabUsers .admin-toolbar');
      const rolePill = H.rectOf('#testAdminRolePill');
      const statusPill = H.rectOf('#testAdminStatusPill');
      const roleBtn = H.rectOf('#testRoleActionBtn');
      const lockBtn = H.rectOf('#testLockActionBtn');
      return {
        vw: H.vw,
        docOvX: H.docOvX,
        card,
        wrap,
        search,
        usersToolbar,
        rolePill,
        statusPill,
        roleBtn,
        lockBtn,
      };
    `);
    assert.strictEqual(res.docOvX, 0, `Admin section horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.card && res.card.right <= res.vw + 1, 'Admin table card exceeds viewport');
    assert.ok(res.wrap && ['auto', 'scroll'].includes(res.wrap.overflowX), 'Admin table wrapper must enable overflow-x scrolling');
    assert.ok(res.wrap.right <= res.card.right + 1, 'Admin table wrapper exceeds card bounds');
    if (res.search) {
      assert.ok(res.search.right <= res.card.right + 1, 'Admin search input exceeds card bounds');
      assert.ok(res.search.left >= res.card.left + 12, 'Admin search input must have horizontal padding inside card');
    }
    assert.strictEqual(res.usersToolbar.overlaps.length, 0, `Admin users toolbar sibling overlap: ${JSON.stringify(res.usersToolbar.overlaps)}`);
    assert.strictEqual(res.usersToolbar.overflowPx, 0, `Admin users toolbar overflow: ${res.usersToolbar.overflowPx}px`);
    assert.ok(res.rolePill && res.rolePill.height <= 32, `Role badge must stay single-line (height=${res.rolePill?.height})`);
    assert.ok(res.statusPill && res.statusPill.height <= 32, `Status pill must stay single-line (height=${res.statusPill?.height})`);
    assert.ok(res.roleBtn && res.roleBtn.height <= 34, `Role button must stay single-line (height=${res.roleBtn?.height})`);
    assert.ok(res.lockBtn && res.lockBtn.height <= 34, `Lock button must stay single-line (height=${res.lockBtn?.height})`);
  });

  await runner.run(vp.name, 'Admin Section: IP Access Audit Logs card, toolbar, and action pills fit cleanly', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('adminSection'));
    await cdp.eval(`
      const logsTabBtn = document.getElementById('sideNavAdminAccessLogs');
      if (logsTabBtn) logsTabBtn.click();
      const overviewTab = document.getElementById('adminTabOverview');
      const usersTab = document.getElementById('adminTabUsers');
      const accessLogsTab = document.getElementById('adminTabAccessLogs');
      const txTab = document.getElementById('adminTabTransactions');
      if (overviewTab) overviewTab.style.display = 'none';
      if (usersTab) usersTab.style.display = 'none';
      if (txTab) txTab.style.display = 'none';
      if (accessLogsTab) accessLogsTab.style.display = 'block';
      document.getElementById('adminAccessLogsEmpty').style.display = 'none';
      document.getElementById('adminAccessLogsTableBody').innerHTML =
        '<tr><td><div class="user-cell-meta"><div class="user-cell-avatar">Q</div><div><div class="user-cell-name">Quan Tri Vien</div><div class="user-cell-email">admin@pdflingua.edu.vn</div></div></div></td><td><span class="admin-ip-address font-mono">127.0.0.1</span></td><td><span class="admin-ip-device">Edge / Windows</span></td><td><span class="admin-log-action-pill login" id="testLogActionPill"><span class="status-dot"></span>Dang nhap</span></td><td><span class="date-mono">03:48:13 26/11/2026</span></td></tr>';
      document.getElementById('adminAccessLogsCard')?.scrollIntoView();
    `);
    await sleep(80);
    const res = await evalWithHelpers(cdp, `
      const card = H.rectOf('#adminAccessLogsCard');
      const wrap = H.rectOf('#adminAccessLogsCard .admin-table-wrapper');
      const logSearch = H.rectOf('#adminLogSearchInput');
      const logsToolbar = H.checkContainerOverlap('#adminAccessLogsCard .admin-toolbar');
      const actionPill = H.rectOf('#testLogActionPill');
      return {
        vw: H.vw,
        docOvX: H.docOvX,
        card,
        wrap,
        logSearch,
        logsToolbar,
        actionPill,
      };
    `);
    assert.strictEqual(res.docOvX, 0, `Access logs section horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.card && res.card.right <= res.vw + 1, 'Access logs card exceeds viewport');
    assert.ok(res.wrap && ['auto', 'scroll'].includes(res.wrap.overflowX), 'Access logs table wrapper must allow horizontal scrolling');
    assert.ok(res.logSearch && res.logSearch.left >= res.card.left + 12, 'Access logs search input must have toolbar padding');
    assert.ok(res.logSearch.right <= res.card.right + 1, 'Access logs search input exceeds card bounds');
    assert.strictEqual(res.logsToolbar.overlaps.length, 0, `Access logs toolbar sibling overlap: ${JSON.stringify(res.logsToolbar.overlaps)}`);
    assert.strictEqual(res.logsToolbar.overflowPx, 0, `Access logs toolbar overflow: ${res.logsToolbar.overflowPx}px`);
    assert.ok(res.actionPill && res.actionPill.height <= 32, `Access log action pill wrapped (height=${res.actionPill?.height})`);
  });

  await runner.run(vp.name, 'Admin Section: VietQR transactions card, toolbar, and action buttons fit cleanly', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('adminSection'));
    await cdp.eval(`
      const txTabBtn = document.getElementById('sideNavAdminTransactions');
      if (txTabBtn) txTabBtn.click();
      const overviewTab = document.getElementById('adminTabOverview');
      const usersTab = document.getElementById('adminTabUsers');
      const accessLogsTab = document.getElementById('adminTabAccessLogs');
      const txTab = document.getElementById('adminTabTransactions');
      if (overviewTab) overviewTab.style.display = 'none';
      if (usersTab) usersTab.style.display = 'none';
      if (accessLogsTab) accessLogsTab.style.display = 'none';
      if (txTab) txTab.style.display = 'block';
      document.getElementById('adminTxTableEmpty').style.display = 'none';
      document.getElementById('adminTxTableBody').innerHTML =
        '<tr><td><span class="tx-code-chip font-mono">SUB-11-21422-0C</span></td><td><div class="user-cell-email">tam12@gmail.com</div></td><td><span class="tx-plan-pill yearly">Goi Pro Hang Nam</span></td><td><span class="tx-amount-mono">399.000d</span></td><td><span class="tx-status-pill pending" id="testTxStatusPill"><span class="tx-status-dot"></span>Cho duyet</span></td><td><span class="date-mono">04:31:38 14/11/2026</span></td><td class="text-right"><div class="user-actions-group"><button class="btn-tx-approve" id="testTxApproveBtn">Duyet Pro</button><button class="btn-tx-reject" id="testTxRejectBtn">Tu choi</button></div></td></tr>';
      document.getElementById('adminTxCard')?.scrollIntoView();
    `);
    await sleep(80);
    const res = await evalWithHelpers(cdp, `
      const card = H.rectOf('#adminTxCard');
      const wrap = H.rectOf('#adminTxCard .admin-table-wrapper');
      const search = H.rectOf('#adminTxSearchInput');
      const txToolbar = H.checkContainerOverlap('#adminTxCard .admin-toolbar');
      const statusPill = H.rectOf('#testTxStatusPill');
      const approveBtn = H.rectOf('#testTxApproveBtn');
      const rejectBtn = H.rectOf('#testTxRejectBtn');
      return {
        vw: H.vw,
        docOvX: H.docOvX,
        card,
        wrap,
        search,
        txToolbar,
        statusPill,
        approveBtn,
        rejectBtn,
      };
    `);
    assert.strictEqual(res.docOvX, 0, `VietQR section horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.card && res.card.right <= res.vw + 1, 'VietQR card exceeds viewport');
    assert.ok(res.wrap && ['auto', 'scroll'].includes(res.wrap.overflowX), 'VietQR table wrapper must allow horizontal scrolling');
    assert.ok(res.search && res.search.left >= res.card.left + 12, 'VietQR search input must have toolbar padding');
    assert.ok(res.search.right <= res.card.right + 1, 'VietQR search input exceeds card bounds');
    assert.strictEqual(res.txToolbar.overlaps.length, 0, `VietQR toolbar sibling overlap: ${JSON.stringify(res.txToolbar.overlaps)}`);
    assert.strictEqual(res.txToolbar.overflowPx, 0, `VietQR toolbar overflow: ${res.txToolbar.overflowPx}px`);
    assert.ok(res.statusPill && res.statusPill.height <= 32, `VietQR status pill wrapped (height=${res.statusPill?.height})`);
    assert.ok(res.approveBtn && res.approveBtn.height <= 34, `Approve button wrapped (height=${res.approveBtn?.height})`);
    assert.ok(res.rejectBtn && res.rejectBtn.height <= 34, `Reject button wrapped (height=${res.rejectBtn?.height})`);
  });
}

async function testPricingAndModals(cdp, vp, runner) {
  await runner.run(vp.name, 'Pricing Section: All tier cards stay strictly within viewport', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('pricingSection'));
    await sleep(80);
    const res = await evalWithHelpers(cdp, `
      const cards = ['#pricingCardFree', '#pricingCardPro', '#pricingCardProYearly'].map((s) => ({ sel: s, r: H.rectOf(s) }));
      return { vw: H.vw, docOvX: H.docOvX, cards };
    `);
    assert.strictEqual(res.docOvX, 0, `Pricing horizontal overflow: ${res.docOvX}px`);
    for (const c of res.cards) {
      assert.ok(c.r, `Pricing card ${c.sel} must be visible`);
      assert.ok(
        c.r.left >= 0 && c.r.right <= res.vw + 1,
        `Pricing card ${c.sel} overflows viewport (left=${c.r.left}, right=${c.r.right}, vw=${res.vw})`
      );
    }
  });

  await runner.run(vp.name, 'Pricing Checkout Modal: Fits viewport, scrollable, close button reachable', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('heroSection'));
    await cdp.eval(`
      const m = document.getElementById('pricingCheckoutModal');
      m.hidden = false;
      m.style.display = 'flex';
    `);
    await waitForSettled(cdp, '#pricingCheckoutModal .checkout-modal-card');
    const res = await evalWithHelpers(cdp, `
      const card = H.rectOf('#pricingCheckoutModal .checkout-modal-card');
      const closeBtn = H.rectOf('#pricingCheckoutModal .checkout-modal-close');
      return { vw: H.vw, vh: H.vh, docOvX: H.docOvX, card, closeBtn };
    `);
    assert.strictEqual(res.docOvX, 0, `Checkout modal caused horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.card, 'Checkout modal card must be visible');
    assert.ok(res.card.left >= 0 && res.card.right <= res.vw + 1, 'Checkout modal exceeds viewport width');
    assert.ok(
      res.card.top >= 0 && res.card.bottom <= res.vh + 2,
      `Checkout modal clipped vertically outside viewport (top=${res.card.top}, bottom=${res.card.bottom}, vh=${res.vh})`
    );
    if (res.card.scrollHeight > res.card.clientHeight + 2) {
      assert.ok(
        ['auto', 'scroll'].includes(res.card.overflowY),
        `Tall Checkout modal must be vertically scrollable (overflowY=${res.card.overflowY})`
      );
    }
    assert.ok(
      res.closeBtn && res.closeBtn.top >= 0 && res.closeBtn.right <= res.vw + 1,
      'Checkout modal close button is clipped off-screen'
    );
  });

  await runner.run(vp.name, 'Avatar Crop Modal: Centered crop viewport with zero horizontal overflow', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('heroSection'));
    await cdp.eval(`
      const m = document.getElementById('avatarCropModal');
      m.hidden = false;
      m.style.display = 'flex';
    `);
    await waitForSettled(cdp, '#avatarCropModal .avatar-crop-dialog');
    const res = await evalWithHelpers(cdp, `
      const dialog = H.rectOf('#avatarCropModal .avatar-crop-dialog');
      const viewport = H.rectOf('#avatarCropModal .avatar-crop-viewport');
      const closeBtn = H.rectOf('#btnCloseAvatarCropModal');
      return { vw: H.vw, vh: H.vh, docOvX: H.docOvX, dialog, viewport, closeBtn };
    `);
    assert.strictEqual(res.docOvX, 0, `Avatar crop modal caused horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.dialog && res.dialog.left >= 0 && res.dialog.right <= res.vw + 1, 'Avatar crop dialog exceeds viewport');
    assert.ok(res.dialog.top >= 0 && res.dialog.bottom <= res.vh + 2, 'Avatar crop dialog exceeds viewport height');
    assert.ok(
      res.viewport && res.viewport.left >= res.dialog.left && res.viewport.right <= res.dialog.right + 1,
      `Avatar crop viewport overflows dialog (${res.viewport?.right} > ${res.dialog.right})`
    );
    const leftGap = res.viewport.left - res.dialog.left;
    const rightGap = res.dialog.right - res.viewport.right;
    assert.ok(
      Math.abs(leftGap - rightGap) <= 4,
      `Avatar crop viewport not centered inside dialog (leftGap=${leftGap}px, rightGap=${rightGap}px)`
    );
    assert.ok(res.closeBtn && res.closeBtn.right <= res.vw + 1, 'Avatar crop close button clipped');
  });

  await runner.run(vp.name, 'Legal Modal: All 3 tabs visible without clipping and clean mobile header', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('heroSection'));
    await cdp.eval(`
      const m = document.getElementById('legalModalOverlay');
      m.hidden = false;
      m.style.display = '';
      m.classList.add('active');
    `);
    await waitForSettled(cdp, '#legalModalOverlay .legal-modal-container');
    const res = await evalWithHelpers(cdp, `
      const card = H.rectOf('#legalModalOverlay .legal-modal-container');
      const tabsBar = H.rectOf('#legalModalOverlay .legal-tabs-bar');
      const tabs = ['#tabBtnTerms', '#tabBtnPrivacy', '#tabBtnContact'].map((s) => ({ sel: s, r: H.rectOf(s) }));
      const fsBtn = H.rectOf('#btnToggleFullscreenLegal');
      const closeBtn = H.rectOf('#legalModalCloseBtn');
      return { vw: H.vw, vh: H.vh, docOvX: H.docOvX, card, tabsBar, tabs, fsBtn, closeBtn };
    `);
    assert.strictEqual(res.docOvX, 0, `Legal modal caused horizontal overflow: ${res.docOvX}px`);
    assert.ok(res.card && res.card.left >= 0 && res.card.right <= res.vw + 1, 'Legal modal exceeds viewport width');
    assert.ok(res.card.top >= 0 && res.card.bottom <= res.vh + 2, 'Legal modal exceeds viewport height');
    for (const tab of res.tabs) {
      assert.ok(tab.r, `Legal tab ${tab.sel} must be visible`);
      assert.ok(
        tab.r.right <= res.tabsBar.right + 2,
        `Legal tab ${tab.sel} clipped past tab bar (${tab.r.right} > ${res.tabsBar.right})`
      );
    }
    if (vp.width <= 640) {
      assert.strictEqual(res.fsBtn, null, 'Fullscreen toggle button should be hidden on <= 640px to prevent header wrap');
      assert.ok(res.closeBtn && res.closeBtn.width >= 36 && res.closeBtn.height >= 36, 'Legal modal close button too small on mobile');
    }
  });

  await runner.run(vp.name, 'Auth, Account & Quota Modals: Stay strictly within viewport bounds', async () => {
    const modals = [
      { id: 'loginModal', cardSel: '#loginModal .modal-dialog', closeSel: '#btnCloseLoginModal', display: '' },
      { id: 'accountModal', cardSel: '#accountModal .modal-dialog', closeSel: '#btnCloseAccountModal', display: '' },
      { id: 'quotaExceededModal', cardSel: '#quotaExceededModal .quota-modal-card', closeSel: '#btnCloseQuotaModal', display: 'flex' },
    ];
    for (const m of modals) {
      await cdp.eval(SHOW_ONLY_SECTION('heroSection'));
      await cdp.eval(`
        const el = document.getElementById('${m.id}');
        el.hidden = false;
        el.style.display = '${m.display}';
      `);
      await waitForSettled(cdp, m.cardSel);
      const res = await evalWithHelpers(cdp, `
        return {
          vw: H.vw,
          vh: H.vh,
          docOvX: H.docOvX,
          card: H.rectOf('${m.cardSel}'),
          closeBtn: H.rectOf('${m.closeSel}'),
        };
      `);
      assert.strictEqual(res.docOvX, 0, `${m.id} caused horizontal overflow: ${res.docOvX}px`);
      assert.ok(
        res.card && res.card.left >= 0 && res.card.right <= res.vw + 1,
        `${m.id} exceeds viewport width (card=${JSON.stringify(res.card)}, vw=${res.vw})`
      );
      assert.ok(res.card.top >= 0 && res.card.bottom <= res.vh + 2, `${m.id} exceeds viewport height (top=${res.card.top}, bottom=${res.card.bottom}, vh=${res.vh})`);
      if (res.closeBtn) {
        assert.ok(res.closeBtn.right <= res.vw + 1 && res.closeBtn.top >= 0, `${m.id} close button clipped`);
      }
    }
  });
}

// --- Regression Detector Self-Check (In-Memory Only, Zero Disk Edits) ---

async function verifyRegressionDetectorSensitivity(cdp, runner) {
  const mobileVp = VIEWPORTS.find((v) => v.name === '360x740');
  await setViewport(cdp, mobileVp);

  await runner.run('Meta-Check', 'Detector catches injected mobile header overflow, dual-pane blowout, and clipped Checkout modal', async () => {
    await cdp.eval(SHOW_ONLY_SECTION('workspaceSection'));
    await cdp.eval(`
      const style = document.createElement('style');
      style.id = '__responsiveRegressionProbeStyle';
      style.textContent = \`
        .site-header .header-container { width: 490px !important; max-width: none !important; overflow: visible !important; }
        .workspace-views-wrapper.view-mode-text #dualPaneGrid { grid-template-columns: 360px 360px !important; }
      \`;
      document.head.appendChild(style);
      document.getElementById('btnViewModeText')?.click();
    `);
    await sleep(80);

    const broken = await evalWithHelpers(cdp, `
      return {
        vw: H.vw,
        docOvX: H.docOvX,
        orig: H.rectOf('#paneCardOriginal'),
        trans: H.rectOf('#paneCardTranslated'),
      };
    `);

    await cdp.eval(`document.getElementById('__responsiveRegressionProbeStyle')?.remove();`);

    assert.ok(broken.docOvX > 100, `Expected detector to observe > 100px overflow when regression injected, got ${broken.docOvX}px`);
    assert.ok(broken.trans.right > broken.vw + 100, 'Expected detector to observe translated pane blown past mobile viewport');
  });
}

// --- Main Entrypoint ---

async function main() {
  const args = process.argv.slice(2);
  const vpFilterArg = args.find((a) => a.startsWith('--viewport='));
  const vpFilter = vpFilterArg ? vpFilterArg.split('=')[1] : null;
  const targetViewports = vpFilter ? VIEWPORTS.filter((v) => v.name === vpFilter) : VIEWPORTS;

  if (targetViewports.length === 0) {
    console.error(`Unknown viewport filter: ${vpFilter}. Valid: ${VIEWPORTS.map((v) => v.name).join(', ')}`);
    process.exit(2);
  }

  const browserBin = findBrowserExecutable();
  if (!browserBin) {
    console.error(
      'ERROR: No Chrome/Chromium/Edge binary found. Set CHROME_PATH environment variable to run real-browser responsive tests.'
    );
    process.exit(1);
  }

  console.log('================================================================');
  console.log('PDF-Lingua Automated Responsive UI Test Suite (Real Chrome CDP)');
  console.log('================================================================');
  console.log(`Browser : ${browserBin}`);
  console.log(`Targets : ${targetViewports.map((v) => `${v.name} (${v.tier})`).join(', ')}`);

  const { server, baseUrl } = await startStaticServer(FRONTEND_DIR);
  const cdpPort = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfl-responsive-chrome-'));

  const chromeArgs = [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${userDataDir}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--mute-audio',
    '--window-size=1440,900',
    'about:blank',
  ];

  const chrome = spawn(browserBin, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeStderr = '';
  if (chrome.stderr) {
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', (chunk) => {
      chromeStderr = (chromeStderr + chunk).slice(-2000);
    });
  }

  let cdp = null;
  const runner = new TestRunner();

  try {
    const wsUrl = await waitForCDP(cdpPort, 25000, () => chromeStderr);
    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Intercept backend API requests cleanly in static-server mode
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        const __origFetch = window.fetch;
        window.fetch = async (url, opts) => {
          const s = String(url || '');
          if (s.includes(':8000') || s.startsWith('/api/')) {
            return new Response(JSON.stringify({ detail: 'Offline static test mode' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return __origFetch(url, opts);
        };
      `,
    });

    // Phase 1: Welcome Page across all target viewports
    await navigate(cdp, `${baseUrl}/welcome.html`);
    for (const vp of targetViewports) {
      await setViewport(cdp, vp);
      await testWelcomeArea(cdp, vp, runner);
    }

    // Phase 2: Main App (index.html) across all target viewports
    await setViewport(cdp, targetViewports[0]);
    await navigate(cdp, `${baseUrl}/index.html`);
    for (const vp of targetViewports) {
      await setViewport(cdp, vp);
      await testAppShellAndSidebar(cdp, vp, runner);
      await testWorkspaceAndCopilot(cdp, vp, runner);
      await testDocumentsHistoryAdmin(cdp, vp, runner);
      await testPricingAndModals(cdp, vp, runner);
    }

    // Phase 3: Regression Detector Sensitivity Self-Check
    if (!vpFilter) {
      await verifyRegressionDetectorSensitivity(cdp, runner);
    }

    console.log('\n--- Per-Viewport Results ---');
    for (const [vpName, stat] of runner.viewportStats.entries()) {
      const status = stat.fail === 0 ? 'PASS' : 'FAIL';
      console.log(`  [${status}] ${vpName.padEnd(10)} : ${stat.pass} passed, ${stat.fail} failed`);
    }

    console.log('\n--- Static-Mode Scope Notice ---');
    console.log(
      '  [LIMITATION] Live PDF.js binary rendering and real backend API chat/history responses are not exercised in static-server mode; representative DOM states are verified instead.'
    );

    console.log('\n================================================================');
    console.log(`SUMMARY: ${runner.passed}/${runner.passed + runner.failed} tests passed (${runner.failed} failed).`);
    console.log('================================================================');

    if (runner.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (cdp) cdp.close();
    try {
      chrome.kill('SIGTERM');
    } catch (_) {
      // Ignore already-exited browser process
    }
    await sleep(200);
    try {
      chrome.kill('SIGKILL');
    } catch (_) {
      // Ignore already-exited browser process
    }
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {
      // Temp directory cleanup best effort on Windows file locks
    }
  }
}

main().catch((err) => {
  const msg = `RESPONSIVE TEST SUITE CRASHED: ${err.message || err}`;
  console.log(msg);
  console.error(msg);
  process.exit(1);
});
