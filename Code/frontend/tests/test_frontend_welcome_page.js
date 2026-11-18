/**
 * PDF-Lingua: Standalone Welcome Landing Page Test Suite
 * -------------------------------------------------------------
 * Verifies standalone welcome page architecture, HTML5 semantic structure,
 * White-Red-Ocean Blue color palette, sticky glass header, responsive drawer,
 * and zero en-dash/em-dash character compliance.
 *
 * Execution:
 *   node Code/frontend/tests/test_frontend_welcome_page.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.resolve(__dirname, '../welcome.html');
const cssPath = path.resolve(__dirname, '../css/welcome.css');
const jsPath = path.resolve(__dirname, '../js/welcome.js');

console.log('================================================================');
console.log('PDF-Lingua Standalone Welcome Page Test Suite');
console.log('Testing HTML: ' + htmlPath);
console.log('Testing CSS:  ' + cssPath);
console.log('Testing JS:   ' + jsPath);
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

// -----------------------------------------------------------------------------
// Part 1: File Existence & Basic Validation
// -----------------------------------------------------------------------------
console.log('--- 1. File Existence & Architecture ---');

runTest('Files: welcome.html, welcome.css, welcome.js exist', () => {
  assert.strictEqual(fs.existsSync(htmlPath), true, 'welcome.html must exist');
  assert.strictEqual(fs.existsSync(cssPath), true, 'welcome.css must exist');
  assert.strictEqual(fs.existsSync(jsPath), true, 'welcome.js must exist');
});

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const jsContent = fs.readFileSync(jsPath, 'utf8');

runTest('HTML: Document has valid DOCTYPE and <html lang="vi">', () => {
  assert.ok(/<!DOCTYPE html>/i.test(htmlContent), 'Missing <!DOCTYPE html>');
  assert.ok(/<html lang="vi">/i.test(htmlContent), 'Missing <html lang="vi">');
});

runTest('HTML: Document links to css/welcome.css and js/welcome.js', () => {
  assert.ok(htmlContent.includes('href="css/welcome.css"'), 'Missing link to css/welcome.css');
  assert.ok(htmlContent.includes('src="js/welcome.js"'), 'Missing script tag for js/welcome.js');
});

runTest('HTML: Document includes Inter & JetBrains Mono fonts', () => {
  assert.ok(htmlContent.includes('family=Inter'), 'Missing Inter font in link tag');
  assert.ok(htmlContent.includes('family=JetBrains+Mono'), 'Missing JetBrains Mono font in link tag');
});

// -----------------------------------------------------------------------------
// Part 2: 7 Semantic Landmarks & Wireframe Sections
// -----------------------------------------------------------------------------
console.log('\n--- 2. Semantic Wireframe Sections ---');

runTest('HTML: Section 1 (Header #welcomeNavbar) is present', () => {
  assert.ok(htmlContent.includes('id="welcomeNavbar"'), 'Missing #welcomeNavbar element');
  assert.ok(/<header[^>]+id="welcomeNavbar"/i.test(htmlContent), '#welcomeNavbar must be a <header> tag');
});

runTest('HTML: Section 2 (Hero #welcomeHero) is present', () => {
  assert.ok(htmlContent.includes('id="welcomeHero"'), 'Missing #welcomeHero element');
  assert.ok(/<section[^>]+id="welcomeHero"/i.test(htmlContent), '#welcomeHero must be a <section> tag');
});

runTest('HTML: Section 3 (Features #welcomeFeatures) is present', () => {
  assert.ok(htmlContent.includes('id="welcomeFeatures"'), 'Missing #welcomeFeatures element');
  assert.ok(/<section[^>]+id="welcomeFeatures"/i.test(htmlContent), '#welcomeFeatures must be a <section> tag');
});

runTest('HTML: Section 4 (How It Works #welcomeHowItWorks) is present', () => {
  assert.ok(htmlContent.includes('id="welcomeHowItWorks"'), 'Missing #welcomeHowItWorks element');
  assert.ok(/<section[^>]+id="welcomeHowItWorks"/i.test(htmlContent), '#welcomeHowItWorks must be a <section> tag');
});

runTest('HTML: Section 5 (Testimonials #welcomeTestimonials) is present', () => {
  assert.ok(htmlContent.includes('id="welcomeTestimonials"'), 'Missing #welcomeTestimonials element');
  assert.ok(/<section[^>]+id="welcomeTestimonials"/i.test(htmlContent), '#welcomeTestimonials must be a <section> tag');
});

runTest('HTML: Section 6 (Pricing #welcomePricing) is present', () => {
  assert.ok(htmlContent.includes('id="welcomePricing"'), 'Missing #welcomePricing element');
  assert.ok(/<section[^>]+id="welcomePricing"/i.test(htmlContent), '#welcomePricing must be a <section> tag');
});

runTest('HTML: Section 7 (Footer #welcomeFooter) is present', () => {
  assert.ok(htmlContent.includes('id="welcomeFooter"'), 'Missing #welcomeFooter element');
  assert.ok(/<footer[^>]+id="welcomeFooter"/i.test(htmlContent), '#welcomeFooter must be a <footer> tag');
});

// -----------------------------------------------------------------------------
// Part 3: Navigation Bar Elements & Brand Identity
// -----------------------------------------------------------------------------
console.log('\n--- 3. Brand Identity & Navigation Bar ---');

runTest('Brand: Logo image has dimensions width="34" height="34" for CLS=0', () => {
  assert.ok(htmlContent.includes('src="assets/images/logo-app-transparent.png"'), 'Missing logo image src');
  assert.ok(htmlContent.includes('width="34"'), 'Missing width="34" attribute on logo');
  assert.ok(htmlContent.includes('height="34"'), 'Missing height="34" attribute on logo');
});

runTest('Brand: Contains "PDF" badge and "Lingua" text', () => {
  assert.ok(htmlContent.includes('welcome-brand-badge'), 'Missing .welcome-brand-badge class');
  assert.ok(htmlContent.includes('welcome-brand-name'), 'Missing .welcome-brand-name class');
  assert.ok(htmlContent.includes('>PDF<'), 'Missing "PDF" text inside badge');
  assert.ok(htmlContent.includes('Lingua'), 'Missing "Lingua" brand text');
});

runTest('Nav: Anchor links navigate to all major landing page sections', () => {
  assert.ok(htmlContent.includes('href="#welcomeHero"'), 'Missing link to #welcomeHero');
  assert.ok(htmlContent.includes('href="#welcomeFeatures"'), 'Missing link to #welcomeFeatures');
  assert.ok(htmlContent.includes('href="#welcomeHowItWorks"'), 'Missing link to #welcomeHowItWorks');
  assert.ok(htmlContent.includes('href="#welcomeTestimonials"'), 'Missing link to #welcomeTestimonials');
  assert.ok(htmlContent.includes('href="#welcomePricing"'), 'Missing link to #welcomePricing');
});

runTest('Nav: CTA buttons link to workspace and login portal', () => {
  assert.ok(htmlContent.includes('href="index.html#login"'), 'Missing link to index.html#login');
  assert.ok(htmlContent.includes('href="index.html"'), 'Missing link to index.html workspace');
});

runTest('Nav: Mobile toggle button configured with ARIA attributes', () => {
  assert.ok(htmlContent.includes('id="btnWelcomeMobileMenu"'), 'Missing #btnWelcomeMobileMenu button');
  assert.ok(htmlContent.includes('aria-controls="welcomeMobileDrawer"'), 'Missing aria-controls attribute');
  assert.ok(htmlContent.includes('id="welcomeMobileDrawer"'), 'Missing #welcomeMobileDrawer container');
});

// -----------------------------------------------------------------------------
// Part 4: CSS Tokens & High Contrast Colors
// -----------------------------------------------------------------------------
console.log('\n--- 4. CSS Design Tokens & Styling ---');

runTest('CSS: Pure White and Slate backgrounds defined', () => {
  assert.ok(cssContent.includes('--wl-bg-page: #FFFFFF;'), 'Missing --wl-bg-page #FFFFFF');
  assert.ok(cssContent.includes('--wl-bg-subtle: #F8FAFC;'), 'Missing --wl-bg-subtle #F8FAFC');
});

runTest('CSS: PDF Red and Lingua Ocean Blue accent tokens defined', () => {
  assert.ok(cssContent.includes('--wl-accent-red: #E5322D;'), 'Missing --wl-accent-red #E5322D');
  assert.ok(cssContent.includes('--wl-accent-blue: #2563EB;'), 'Missing --wl-accent-blue #2563EB');
  assert.ok(cssContent.includes('--wl-text-primary: #0F172A;'), 'Missing --wl-text-primary #0F172A');
});

runTest('CSS: Sticky Glass Header with backdrop-filter blur', () => {
  assert.ok(cssContent.includes('position: sticky;'), 'Missing position: sticky in CSS');
  assert.ok(cssContent.includes('backdrop-filter: blur(16px);'), 'Missing backdrop-filter blur in CSS');
});

runTest('CSS: Primary button uses PDF Red (#E5322D)', () => {
  assert.ok(cssContent.includes('.welcome-btn-primary'), 'Missing .welcome-btn-primary class');
  assert.ok(cssContent.includes('--wl-accent-red'), 'Primary button must reference red token');
});

runTest('CSS: Accessibility :focus-visible and tabular-nums configured', () => {
  assert.ok(cssContent.includes(':focus-visible'), 'Missing :focus-visible styles in CSS');
  assert.ok(cssContent.includes('font-variant-numeric: tabular-nums;'), 'Missing tabular-nums in CSS');
  assert.ok(cssContent.includes('prefers-reduced-motion: reduce'), 'Missing prefers-reduced-motion in CSS');
});

// -----------------------------------------------------------------------------
// Part 5: JavaScript Controller Logic
// -----------------------------------------------------------------------------
console.log('\n--- 5. JavaScript Controller Logic ---');

runTest('JS: Script wraps in IIFE and strictly handles scroll & mobile toggle', () => {
  assert.ok(jsContent.includes('welcomeNavbar'), 'JS should reference welcomeNavbar');
  assert.ok(jsContent.includes('btnWelcomeMobileMenu'), 'JS should reference btnWelcomeMobileMenu');
  assert.ok(jsContent.includes('welcomeMobileDrawer'), 'JS should reference welcomeMobileDrawer');
  assert.ok(jsContent.includes('is-scrolled'), 'JS should toggle is-scrolled class');
  assert.ok(jsContent.includes('aria-expanded'), 'JS should toggle aria-expanded');
});

runTest('JS: Closes mobile drawer on Escape key press', () => {
  assert.ok(jsContent.includes("'Escape'"), 'JS must listen for Escape key');
});

// -----------------------------------------------------------------------------
// Part 6: Zero En-dash & Zero Em-dash Compliance
// -----------------------------------------------------------------------------
console.log('\n--- 6. Zero En-dash & Em-dash Character Compliance ---');

runTest('Compliance: No en-dash (\\u2013) or em-dash (\\u2014) in welcome.html', () => {
  assert.strictEqual(/\u2013/.test(htmlContent), false, 'Found en-dash in welcome.html');
  assert.strictEqual(/\u2014/.test(htmlContent), false, 'Found em-dash in welcome.html');
});

runTest('Compliance: No en-dash (\\u2013) or em-dash (\\u2014) in welcome.css', () => {
  assert.strictEqual(/\u2013/.test(cssContent), false, 'Found en-dash in welcome.css');
  assert.strictEqual(/\u2014/.test(cssContent), false, 'Found em-dash in welcome.css');
});

runTest('Compliance: No en-dash (\\u2013) or em-dash (\\u2014) in welcome.js', () => {
  assert.strictEqual(/\u2013/.test(jsContent), false, 'Found en-dash in welcome.js');
  assert.strictEqual(/\u2014/.test(jsContent), false, 'Found em-dash in welcome.js');
});

// -----------------------------------------------------------------------------
// Part 7: Hero Section & Interactive Product Preview
// -----------------------------------------------------------------------------
console.log('\n--- 7. Hero Section & Interactive Product Preview ---');

runTest('Hero: Eyebrow badge contains core AI OCR proposition', () => {
  assert.ok(htmlContent.includes('welcome-eyebrow-badge'), 'Missing .welcome-eyebrow-badge');
  assert.ok(htmlContent.includes('Công Nghệ AI OCR & Dịch Thuật Bố Cục Đa Cột'), 'Missing eyebrow text');
});

runTest('Hero: Headline H1 matches 2-line concise title', () => {
  assert.ok(htmlContent.includes('welcome-hero-title'), 'Missing .welcome-hero-title class');
  assert.ok(htmlContent.includes('Dịch Thuật PDF Song Ngữ Thông Minh & Trợ Lý AI Chuyên Sâu'), 'Missing exact H1 title');
});

runTest('Hero: Dual CTA group connects to workspace and preview scroll', () => {
  assert.ok(htmlContent.includes('id="heroBtnStart"'), 'Missing #heroBtnStart');
  assert.ok(htmlContent.includes('id="heroBtnSample"'), 'Missing #heroBtnSample');
  assert.ok(htmlContent.includes('href="#welcomePreview"'), 'Secondary CTA must link to #welcomePreview');
});

runTest('Hero: Trust signals bar displays security and OCR badges', () => {
  assert.ok(htmlContent.includes('welcome-hero-trust-bar'), 'Missing .welcome-hero-trust-bar');
  assert.ok(htmlContent.includes('Không cần cài đặt'), 'Missing "Không cần cài đặt" trust badge');
  assert.ok(htmlContent.includes('Bảo mật mã hóa AES-256'), 'Missing AES-256 trust badge');
  assert.ok(htmlContent.includes('Hỗ trợ PDF quét scan & OCR Tiếng Việt'), 'Missing OCR scan trust badge');
});

runTest('Preview: macOS window chrome has colored dots and document name', () => {
  assert.ok(htmlContent.includes('id="welcomePreview"'), 'Missing #welcomePreview container');
  assert.ok(htmlContent.includes('welcome-preview-card'), 'Missing .welcome-preview-card');
  assert.ok(htmlContent.includes('dot-close'), 'Missing .dot-close');
  assert.ok(htmlContent.includes('dot-minimize'), 'Missing .dot-minimize');
  assert.ok(htmlContent.includes('dot-maximize'), 'Missing .dot-maximize');
  assert.ok(htmlContent.includes('academic_deep_learning_survey_2026.pdf'), 'Missing preview filename');
});

runTest('Preview: Split panes present original EN and translated VI columns', () => {
  assert.ok(htmlContent.includes('id="paneOriginal"'), 'Missing #paneOriginal left column');
  assert.ok(htmlContent.includes('id="paneTranslated"'), 'Missing #paneTranslated right column');
  assert.ok(htmlContent.includes('data-sync-id="p1"'), 'Missing data-sync-id attributes for paragraph pairing');
  assert.ok(htmlContent.includes('welcome-doc-table'), 'Missing benchmark table in preview');
});

runTest('Preview: Floating Copilot Highlight Card cites source page and table', () => {
  assert.ok(htmlContent.includes('id="welcomeCopilotCard"'), 'Missing #welcomeCopilotCard');
  assert.ok(htmlContent.includes('Trợ lý AI Copilot'), 'Missing Copilot title');
  assert.ok(htmlContent.includes('Trang 2, Bảng 1'), 'Missing page and table source citation');
  assert.ok(htmlContent.includes('Không ảo giác'), 'Missing non-hallucination tag');
});

runTest('CSS: Preview Card grid layout and Copilot card styles defined', () => {
  assert.ok(cssContent.includes('.welcome-preview-panes'), 'Missing .welcome-preview-panes in CSS');
  assert.ok(cssContent.includes('grid-template-columns: 1fr 1fr;'), 'Missing 2-column grid in preview');
  assert.ok(cssContent.includes('.welcome-copilot-card'), 'Missing .welcome-copilot-card in CSS');
  assert.ok(cssContent.includes('backdrop-filter: blur(16px);'), 'Missing blur in copilot card');
});

runTest('JS: Synchronization interaction attached to preview paragraphs', () => {
  assert.ok(jsContent.includes('data-sync-id'), 'JS must reference data-sync-id for synchronized highlighting');
  assert.ok(jsContent.includes('is-sync-active'), 'JS must toggle is-sync-active class');
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (0 failed).`);
console.log('================================================================\n');

