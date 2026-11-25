/**
 * Routing, Redirection and Navigation E2E Verification Test Suite
 * Tests Vercel routing configurations and multi-page transitions between
 * the Welcome Landing Page (welcome.html) and Workspace Application (index.html).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('PDF-Lingua Routing, Redirection and Navigation Test Suite');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    failCount++;
  }
}

// -----------------------------------------------------------------------------
// 1. Vercel Configuration & Anti-Redirect-Loop Safeguards
// -----------------------------------------------------------------------------
console.log('--- 1. Vercel Routing Configuration Safeguards ---');

const rootVercelPath = path.resolve(__dirname, '../../../vercel.json');
const frontendVercelPath = path.resolve(__dirname, '../vercel.json');

runTest('Vercel Config: Root and Frontend vercel.json exist and parse cleanly', () => {
  assert.ok(fs.existsSync(rootVercelPath), 'Missing root vercel.json');
  assert.ok(fs.existsSync(frontendVercelPath), 'Missing Code/frontend/vercel.json');

  const rootConfig = JSON.parse(fs.readFileSync(rootVercelPath, 'utf8'));
  const frontendConfig = JSON.parse(fs.readFileSync(frontendVercelPath, 'utf8'));

  assert.strictEqual(typeof rootConfig, 'object');
  assert.strictEqual(typeof frontendConfig, 'object');
});

runTest('Anti-Loop: cleanUrls is disabled to prevent 308 redirect of index.html to root /', () => {
  const rootConfig = JSON.parse(fs.readFileSync(rootVercelPath, 'utf8'));
  const frontendConfig = JSON.parse(fs.readFileSync(frontendVercelPath, 'utf8'));

  assert.strictEqual(rootConfig.cleanUrls, false, 'root vercel.json must set cleanUrls to false');
  assert.strictEqual(frontendConfig.cleanUrls, false, 'Code/frontend/vercel.json must set cleanUrls to false');
});

runTest('Redirection: Root URL / redirects to /welcome landing portal', () => {
  const rootConfig = JSON.parse(fs.readFileSync(rootVercelPath, 'utf8'));
  const frontendConfig = JSON.parse(fs.readFileSync(frontendVercelPath, 'utf8'));

  const rootRedir = rootConfig.redirects.find((r) => r.source === '/');
  assert.ok(rootRedir, 'root vercel.json missing redirect for /');
  assert.strictEqual(rootRedir.destination, '/welcome');

  const frontendRedir = frontendConfig.redirects.find((r) => r.source === '/');
  assert.ok(frontendRedir, 'Code/frontend/vercel.json missing redirect for /');
  assert.strictEqual(frontendRedir.destination, '/welcome');
});

runTest('Rewrites: /welcome and workspace routes (/workspace, /app, /index) are properly resolved', () => {
  const frontendConfig = JSON.parse(fs.readFileSync(frontendVercelPath, 'utf8'));
  const rewrites = frontendConfig.rewrites;

  const welcomeRw = rewrites.find((rw) => rw.source === '/welcome');
  assert.ok(welcomeRw, 'Missing rewrite for /welcome');
  assert.strictEqual(welcomeRw.destination, '/welcome.html');

  const indexRw = rewrites.find((rw) => rw.source === '/index');
  assert.ok(indexRw, 'Missing rewrite for /index');
  assert.strictEqual(indexRw.destination, '/index.html');

  const workspaceRw = rewrites.find((rw) => rw.source === '/workspace');
  assert.ok(workspaceRw, 'Missing rewrite for /workspace');
  assert.strictEqual(workspaceRw.destination, '/index.html');

  const appRw = rewrites.find((rw) => rw.source === '/app');
  assert.ok(appRw, 'Missing rewrite for /app');
  assert.strictEqual(appRw.destination, '/index.html');
});

runTest('API Proxy: /api/:path* routes to remote Render backend URL', () => {
  const frontendConfig = JSON.parse(fs.readFileSync(frontendVercelPath, 'utf8'));
  const apiRw = frontendConfig.rewrites.find((rw) => rw.source === '/api/:path*');
  assert.ok(apiRw, 'Missing API proxy rewrite');
  assert.strictEqual(apiRw.destination, 'https://pdf-lingua.onrender.com/api/:path*');
});

// -----------------------------------------------------------------------------
// 2. Welcome Page CTA and Navigation Routing
// -----------------------------------------------------------------------------
console.log('\n--- 2. Welcome Landing Page Navigation & CTAs ---');

const welcomeHtmlPath = path.resolve(__dirname, '../welcome.html');
const welcomeHtml = fs.readFileSync(welcomeHtmlPath, 'utf8');

runTest('Welcome CTAs: Main CTA buttons target index.html workspace directly', () => {
  assert.ok(welcomeHtml.includes('id="navBtnTrial"'), 'Missing #navBtnTrial');
  assert.ok(welcomeHtml.includes('id="heroBtnStart"'), 'Missing #heroBtnStart');
  assert.ok(welcomeHtml.includes('id="btnStartFree"'), 'Missing #btnStartFree');

  // Verify href attributes connect to index.html
  assert.ok(/href="index\.html"[^>]*id="navBtnTrial"|id="navBtnTrial"[^>]*href="index\.html"/.test(welcomeHtml));
  assert.ok(/href="index\.html"[^>]*id="heroBtnStart"|id="heroBtnStart"[^>]*href="index\.html"/.test(welcomeHtml));
  assert.ok(/href="index\.html"[^>]*id="btnStartFree"|id="btnStartFree"[^>]*href="index\.html"/.test(welcomeHtml));
});

runTest('Welcome CTAs: Pro tier buttons deep link to index.html#pricing', () => {
  assert.ok(/href="index\.html#pricing"[^>]*id="btnUpgradePro"|id="btnUpgradePro"[^>]*href="index\.html#pricing"/.test(welcomeHtml));
  assert.ok(/href="index\.html#pricing"[^>]*id="btnUpgradeProYearlyPlan"|id="btnUpgradeProYearlyPlan"[^>]*href="index\.html#pricing"/.test(welcomeHtml));
});

runTest('Welcome In-Page Anchors: All navigation hash targets exist in HTML', () => {
  const inPageLinks = ['#welcomeFeatures', '#welcomeHowItWorks', '#welcomePricing'];
  inPageLinks.forEach((targetId) => {
    const id = targetId.replace('#', '');
    assert.ok(welcomeHtml.includes(`id="${id}"`), `Missing target anchor id="${id}" in welcome.html`);
  });
});

// -----------------------------------------------------------------------------
// 3. Welcome JavaScript Authentication & Redirection Controller
// -----------------------------------------------------------------------------
console.log('\n--- 3. Welcome Authentication & Redirection Controller ---');

const welcomeJsPath = path.resolve(__dirname, '../js/welcome.js');
const welcomeJs = fs.readFileSync(welcomeJsPath, 'utf8');

runTest('Login Redirect: Login success redirects to index.html workspace', () => {
  assert.ok(welcomeJs.includes("window.location.href = 'index.html'"), 'Login flow must redirect to index.html');
});

runTest('Modal Safety: Close and switch register links exist and don\'t trigger accidental redirect', () => {
  assert.ok(welcomeHtml.includes('id="linkSwitchRegister"'));
  assert.ok(welcomeHtml.includes('href="index.html#register"'));
  assert.ok(welcomeJs.includes('closeLoginModal'));
});

// -----------------------------------------------------------------------------
// 4. Workspace Index Page Navigation & Integrity
// -----------------------------------------------------------------------------
console.log('\n--- 4. Workspace Application Navigation & Integrity ---');

const indexHtmlPath = path.resolve(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

runTest('Workspace Shell: Core layout landmarks exist in index.html', () => {
  assert.ok(indexHtml.includes('id="appShell"'), 'Missing #appShell');
  assert.ok(indexHtml.includes('id="appSidebar"'), 'Missing #appSidebar');
  assert.ok(indexHtml.includes('id="sidebarBrandLink"'), 'Missing #sidebarBrandLink');
  assert.ok(indexHtml.includes('id="btnToggleSidebar"'), 'Missing #btnToggleSidebar');
});

// -----------------------------------------------------------------------------
// Test Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`SUMMARY: ${passCount}/${passCount + failCount} tests passed (${failCount} failed).`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}
