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

runTest('HTML: Document links to favicon.png and favicon.ico', () => {
  assert.ok(htmlContent.includes('rel="icon"'), 'Missing rel="icon" in <head>');
  assert.ok(htmlContent.includes('href="assets/images/favicon.png"'), 'Missing link to favicon.png');
  assert.ok(htmlContent.includes('href="assets/images/favicon.ico"'), 'Missing link to favicon.ico');
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

runTest('HTML: Section 5 (Pricing #welcomePricing) is present', () => {
  assert.ok(htmlContent.includes('id="welcomePricing"'), 'Missing #welcomePricing element');
  assert.ok(/<section[^>]+id="welcomePricing"/i.test(htmlContent), '#welcomePricing must be a <section> tag');
});

runTest('HTML: Section 6 (Footer #welcomeFooter) is present', () => {
  assert.ok(htmlContent.includes('id="welcomeFooter"'), 'Missing #welcomeFooter element');
  assert.ok(/<footer[^>]+id="welcomeFooter"/i.test(htmlContent), '#welcomeFooter must be a <footer> tag');
});

runTest('HTML: Testimonials section (#welcomeTestimonials) is removed', () => {
  assert.strictEqual(htmlContent.includes('id="welcomeTestimonials"'), false, '#welcomeTestimonials must be removed');
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

runTest('Brand: Contains "PDF" badge and "Lingua" text matching index.html theme', () => {
  assert.ok(htmlContent.includes('welcome-brand-badge'), 'Missing .welcome-brand-badge class');
  assert.ok(htmlContent.includes('welcome-brand-name'), 'Missing .welcome-brand-name class');
  assert.ok(htmlContent.includes('welcome-brand-text'), 'Missing .welcome-brand-text class');
  assert.ok(htmlContent.includes('>PDF<'), 'Missing "PDF" text inside badge');
  assert.ok(htmlContent.includes('Lingua'), 'Missing "Lingua" brand text');
  assert.ok(cssContent.includes('.welcome-brand-badge') && cssContent.includes('#EF4444'), 'Brand badge must use red background #EF4444');
  assert.ok(cssContent.includes('.welcome-brand-text') && (cssContent.includes('#0F172A') || cssContent.includes('#000000')), 'Brand text must use black color #0F172A');
});

runTest('Nav: Anchor links navigate to all major landing page sections', () => {
  assert.ok(htmlContent.includes('href="#welcomeHero"'), 'Missing link to #welcomeHero');
  assert.ok(htmlContent.includes('href="#welcomeFeatures"'), 'Missing link to #welcomeFeatures');
  assert.ok(htmlContent.includes('href="#welcomeHowItWorks"'), 'Missing link to #welcomeHowItWorks');
  assert.ok(htmlContent.includes('href="#welcomePricing"'), 'Missing link to #welcomePricing');
  assert.strictEqual(htmlContent.includes('href="#welcomeTestimonials"'), false, 'Nav must not link to #welcomeTestimonials');
});

runTest('Nav: CTA buttons link to workspace and open login modal', () => {
  assert.ok(htmlContent.includes('id="navBtnLogin"'), 'Missing #navBtnLogin button');
  assert.ok(htmlContent.includes('id="btnWelcomeMobileLogin"'), 'Missing #btnWelcomeMobileLogin button');
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

runTest('Modal HTML: Login modal structure matches index.html specifications', () => {
  assert.ok(htmlContent.includes('id="loginModal"'), 'Missing #loginModal dialog');
  assert.ok(htmlContent.includes('id="loginForm"'), 'Missing #loginForm');
  assert.ok(htmlContent.includes('id="loginEmail"'), 'Missing #loginEmail input');
  assert.ok(htmlContent.includes('id="loginPassword"'), 'Missing #loginPassword input');
  assert.ok(htmlContent.includes('id="btnCloseLoginModal"'), 'Missing #btnCloseLoginModal button');
  assert.ok(htmlContent.includes('id="toggleLoginPassword"'), 'Missing #toggleLoginPassword button');
  assert.ok(htmlContent.includes('id="btnSubmitLogin"'), 'Missing #btnSubmitLogin button');
  assert.ok(htmlContent.includes('id="loginAlert"'), 'Missing #loginAlert container');
});

runTest('Modal CSS: Dialog styling with backdrop blur and responsive modal', () => {
  assert.ok(cssContent.includes('.modal-backdrop'), 'Missing .modal-backdrop styles');
  assert.ok(cssContent.includes('.modal-dialog'), 'Missing .modal-dialog styles');
  assert.ok(cssContent.includes('.btn-gradient'), 'Missing .btn-gradient styles');
  assert.ok(cssContent.includes('.form-alert'), 'Missing .form-alert styles');
});

runTest('Modal JS: Login controller handles open, close, API call, token storage, and redirect', () => {
  assert.ok(jsContent.includes('navBtnLogin'), 'JS must hook desktop nav login button');
  assert.ok(jsContent.includes('btnWelcomeMobileLogin'), 'JS must hook mobile drawer login button');
  assert.ok(jsContent.includes('/api/auth/login'), 'JS must post credentials to /api/auth/login');
  assert.ok(jsContent.includes('pdfl_token'), 'JS must persist pdfl_token in localStorage');
  assert.ok(jsContent.includes('pdfl_user'), 'JS must persist pdfl_user in localStorage');
  assert.ok(jsContent.includes("window.location.href = 'index.html'"), 'JS must redirect to index.html on login success');
  assert.ok(jsContent.includes('closeLoginModal'), 'JS must provide clean closeLoginModal without navigation');
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

runTest('Compliance: No en-dash (\\u2013) or em-dash (\\u2014) in test_frontend_welcome_page.js', () => {
  const selfContent = fs.readFileSync(__filename, 'utf8');
  assert.strictEqual(/\u2013/.test(selfContent), false, 'Found en-dash in test suite');
  assert.strictEqual(/\u2014/.test(selfContent), false, 'Found em-dash in test suite');
});

// -----------------------------------------------------------------------------
// Part 7: Hero Section & Interactive Product Preview
// -----------------------------------------------------------------------------
console.log('\n--- 7. Hero Section & Interactive Product Preview ---');

runTest('Hero: Eyebrow badge contains core AI OCR proposition', () => {
  assert.ok(htmlContent.includes('welcome-eyebrow-badge'), 'Missing .welcome-eyebrow-badge');
  assert.ok(htmlContent.includes('Nền Tảng Dịch Thuật Học Thuật &amp; Kỹ Thuật'), 'Missing eyebrow text');
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
  assert.ok(htmlContent.includes('Cô lập thư mục User ID riêng biệt'), 'Missing User ID isolation trust badge');
  assert.ok(htmlContent.includes('Hỗ trợ PDF quét scan & OCR Tiếng Việt'), 'Missing OCR scan trust badge');
});

runTest('Preview: Workspace toolbar displays test_pdfl2.pdf and meta badges', () => {
  assert.ok(htmlContent.includes('id="welcomePreview"'), 'Missing #welcomePreview container');
  assert.ok(htmlContent.includes('welcome-preview-card'), 'Missing .welcome-preview-card');
  assert.ok(htmlContent.includes('welcome-preview-toolbar'), 'Missing .welcome-preview-toolbar');
  assert.ok(htmlContent.includes('test_pdfl2.pdf'), 'Missing test_pdfl2.pdf filename in preview');
  assert.ok(htmlContent.includes('1 trang'), 'Missing 1 trang badge');
  assert.ok(htmlContent.includes('0.2 MB'), 'Missing 0.2 MB badge');
  assert.ok(htmlContent.includes('PDF Số'), 'Missing PDF Số badge');
  assert.ok(htmlContent.includes('Văn bản'), 'Missing Van ban view mode');
  assert.ok(htmlContent.includes('English (en)'), 'Missing English (en) target language');
});

runTest('Preview: Split panes present original VI and translated EN columns matching real workspace', () => {
  assert.ok(htmlContent.includes('id="paneOriginal"'), 'Missing #paneOriginal left column');
  assert.ok(htmlContent.includes('id="paneTranslated"'), 'Missing #paneTranslated right column');
  assert.ok(htmlContent.includes('data-sync-id="p1"'), 'Missing data-sync-id attributes for paragraph pairing');
  assert.ok(htmlContent.includes('Văn bản gốc'), 'Missing Van ban goc title');
  assert.ok(htmlContent.includes('Bản dịch'), 'Missing Ban dich title');
  assert.ok(htmlContent.includes('95 từ (580 ký tự)'), 'Missing original word count');
  assert.ok(htmlContent.includes('75 từ (603 ký tự)'), 'Missing translated word count');
  assert.ok(htmlContent.includes('support-team@pdflingua.edu.vn'), 'Missing technical support email in content');
  assert.ok(htmlContent.includes('API_BASE_URL='), 'Missing env configuration in preview content');
  assert.ok(htmlContent.includes('E = mc^2'), 'Missing formula line in preview content');
});

runTest('CSS: Preview Card grid layout and workspace toolbar styles defined', () => {
  assert.ok(cssContent.includes('.welcome-preview-panes'), 'Missing .welcome-preview-panes in CSS');
  assert.ok(cssContent.includes('grid-template-columns: 1fr 1fr;'), 'Missing 2-column grid in preview');
  assert.ok(cssContent.includes('.welcome-preview-toolbar'), 'Missing .welcome-preview-toolbar in CSS');
  assert.ok(cssContent.includes('.welcome-file-badge-pdf'), 'Missing .welcome-file-badge-pdf in CSS');
});

runTest('JS: Synchronization interaction attached to preview paragraphs', () => {
  assert.ok(jsContent.includes('data-sync-id'), 'JS must reference data-sync-id for synchronized highlighting');
  assert.ok(jsContent.includes('is-sync-active'), 'JS must toggle is-sync-active class');
});

// -----------------------------------------------------------------------------
// Part 8: Features Bento Grid (6 Asymmetric Pillars)
// -----------------------------------------------------------------------------
console.log('\n--- 8. Features Bento Grid (6 Asymmetric Pillars) ---');

runTest('Bento: Section title and eyebrow badge configured truthfully', () => {
  assert.strictEqual(htmlContent.includes('Công Nghệ Đột Phá'), false, 'Tag "Công Nghệ Đột Phá" must be removed');
  assert.strictEqual(htmlContent.includes('6 Trụ Cột Đột Phá'), false, 'Old title "6 Trụ Cột Đột Phá" must be removed');
  assert.ok(htmlContent.includes('Các Tính Năng Chính Của Hệ Thống PDF-Lingua'), 'Missing updated section title');
});

runTest('Bento: Grid container and 6 feature cards exist', () => {
  assert.ok(htmlContent.includes('welcome-bento-grid'), 'Missing .welcome-bento-grid');
  assert.ok(htmlContent.includes('id="bentoCardLayout"'), 'Missing #bentoCardLayout');
  assert.ok(htmlContent.includes('id="bentoCardOcr"'), 'Missing #bentoCardOcr');
  assert.ok(htmlContent.includes('id="bentoCardCopilot"'), 'Missing #bentoCardCopilot');
  assert.ok(htmlContent.includes('id="bentoCardSummary"'), 'Missing #bentoCardSummary');
  assert.ok(htmlContent.includes('id="bentoCardBatch"'), 'Missing #bentoCardBatch');
  assert.ok(htmlContent.includes('id="bentoCardSecurity"'), 'Missing #bentoCardSecurity');
});

runTest('Bento: Asymmetric column spanning configured (3-column rows)', () => {
  assert.ok(htmlContent.includes('welcome-bento-span-2'), 'Missing .welcome-bento-span-2 class');
  assert.ok(htmlContent.includes('welcome-bento-span-1'), 'Missing .welcome-bento-span-1 class');
});

runTest('Bento: Micro-visuals implemented for all 6 cards', () => {
  assert.ok(htmlContent.includes('bento-visual-dual-sync'), 'Missing Card 1 dual sync visual');
  assert.ok(htmlContent.includes('bento-visual-deskew'), 'Missing Card 2 deskew visual');
  assert.ok(htmlContent.includes('bento-visual-chat'), 'Missing Card 3 chat visual');
  assert.ok(htmlContent.includes('bento-visual-compression'), 'Missing Card 4 compression visual');
  assert.ok(htmlContent.includes('bento-visual-queue'), 'Missing Card 5 queue visual');
  assert.ok(htmlContent.includes('bento-visual-security'), 'Missing Card 6 security visual');
});

runTest('CSS: Bento Grid layout and hover animations defined', () => {
  assert.ok(cssContent.includes('.welcome-bento-grid'), 'Missing .welcome-bento-grid in CSS');
  assert.ok(cssContent.includes('grid-template-columns: repeat(3, 1fr);'), 'Bento grid must be 3 columns');
  assert.ok(cssContent.includes('.welcome-bento-span-2'), 'Missing .welcome-bento-span-2 in CSS');
  assert.ok(cssContent.includes('.welcome-bento-card:hover'), 'Missing hover state for bento card');
});

runTest('JS: Interactive Bento sync row switcher configured', () => {
  assert.ok(jsContent.includes('mini-sync-row'), 'JS must reference mini-sync-row');
});

// -----------------------------------------------------------------------------
// Part 9: How It Works (3 Streamlined Steps)
// -----------------------------------------------------------------------------
console.log('\n--- 9. How It Works (3 Streamlined Steps) ---');

runTest('Steps: Grid container and 3 step cards exist', () => {
  assert.strictEqual(htmlContent.includes('Hướng Dẫn Nhanh'), false, 'Tag "Hướng Dẫn Nhanh" must be removed');
  assert.ok(htmlContent.includes('welcome-steps-container'), 'Missing .welcome-steps-container');
  assert.ok(htmlContent.includes('welcome-steps-grid'), 'Missing .welcome-steps-grid');
  assert.ok(htmlContent.includes('id="stepUpload"'), 'Missing #stepUpload');
  assert.ok(htmlContent.includes('id="stepProcess"'), 'Missing #stepProcess');
  assert.ok(htmlContent.includes('id="stepExport"'), 'Missing #stepExport');
});

runTest('Steps: Numbering 01, 02, 03 and progress connector line present', () => {
  assert.ok(htmlContent.includes('>01<'), 'Missing step 01 number');
  assert.ok(htmlContent.includes('>02<'), 'Missing step 02 number');
  assert.ok(htmlContent.includes('>03<'), 'Missing step 03 number');
  assert.ok(htmlContent.includes('welcome-steps-progress'), 'Missing .welcome-steps-progress');
});

runTest('CSS: How It Works 3-column grid and step cards defined', () => {
  assert.ok(cssContent.includes('.welcome-steps-grid'), 'Missing .welcome-steps-grid in CSS');
  assert.ok(cssContent.includes('grid-template-columns: repeat(3, 1fr);'), 'Steps grid must be 3 columns');
  assert.ok(cssContent.includes('.welcome-step-number'), 'Missing .welcome-step-number in CSS');
  assert.ok(cssContent.includes('font-variant-numeric: tabular-nums;'), 'Step numbers must use tabular-nums');
});

// -----------------------------------------------------------------------------
// Part 10: Removal of Testimonials & Feedback Cards
// -----------------------------------------------------------------------------
console.log('\n--- 10. Removal of Testimonials & Feedback Cards ---');

runTest('Testimonials: Cards and fake profiles completely removed from welcome.html', () => {
  assert.strictEqual(htmlContent.includes('id="welcomeTestimonials"'), false, '#welcomeTestimonials must be removed');
  assert.strictEqual(htmlContent.includes('TS. Nguyễn Văn Hưng'), false, 'TS. Nguyen Van Hung card must be removed');
  assert.strictEqual(htmlContent.includes('ThS. Trần Thu Trang'), false, 'ThS. Tran Thu Trang card must be removed');
  assert.strictEqual(htmlContent.includes('Lê Hoàng Long'), false, 'Le Hoang Long card must be removed');
  assert.strictEqual(htmlContent.includes('welcome-testimonials-grid'), false, '.welcome-testimonials-grid must be removed');
});

runTest('Testimonials: Navigation and drawer links do not point to removed section', () => {
  assert.strictEqual(htmlContent.includes('href="#welcomeTestimonials"'), false, 'href="#welcomeTestimonials" must not exist');
});

// -----------------------------------------------------------------------------
// Part 11: Pricing Plans & Billing Toggle (Section 6)
// -----------------------------------------------------------------------------
console.log('\n--- 11. Pricing Plans & Billing Toggle ---');

runTest('Pricing: 3-Tier Layout (Free, Pro Monthly, Pro Yearly) with discount badge', () => {
  assert.strictEqual(htmlContent.includes('Chi Phí Minh Bạch'), false, 'Tag "Chi Phí Minh Bạch" must be removed');
  assert.strictEqual(cssContent.includes('.welcome-section-tag'), false, '.welcome-section-tag must be removed from CSS');
  assert.ok(htmlContent.includes('id="pricingCardFree"'), 'Missing #pricingCardFree');
  assert.ok(htmlContent.includes('id="pricingCardPro"'), 'Missing #pricingCardPro');
  assert.ok(htmlContent.includes('id="pricingCardProYearly"'), 'Missing #pricingCardProYearly');
  assert.ok(htmlContent.includes('TIẾT KIỆM 25%') || htmlContent.includes('Tiết kiệm 25%'), 'Missing discount badge');
});

runTest('Pricing: Free and Pro cards exist with feature comparison', () => {
  assert.ok(htmlContent.includes('id="pricingCardFree"'), 'Missing #pricingCardFree');
  assert.ok(htmlContent.includes('id="pricingCardPro"'), 'Missing #pricingCardPro');
  assert.ok(htmlContent.includes('id="pricingCardProYearly"'), 'Missing #pricingCardProYearly');
  assert.ok(htmlContent.includes('pricing-featured-badge'), 'Missing featured badge on Pro card');
  assert.ok(htmlContent.includes('id="btnStartFree"'), 'Missing #btnStartFree');
  assert.ok(htmlContent.includes('id="btnUpgradePro"'), 'Missing #btnUpgradePro');
  assert.ok(htmlContent.includes('id="btnUpgradeProYearlyPlan"'), 'Missing #btnUpgradeProYearlyPlan');
});

runTest('CSS: Pricing grid, featured border, and price figures styled', () => {
  assert.ok(cssContent.includes('.welcome-pricing-grid'), 'Missing .welcome-pricing-grid in CSS');
  assert.ok(cssContent.includes('.pricing-card-featured'), 'Missing .pricing-card-featured in CSS');
  assert.ok(cssContent.includes('--wl-accent-red'), 'Featured plan must use red border');
});

runTest('JS: Billing toggle interaction defined for price adjustments', () => {
  assert.ok(jsContent.includes('btnBillingMonthly'), 'JS must reference btnBillingMonthly');
  assert.ok(jsContent.includes('btnBillingYearly'), 'JS must reference btnBillingYearly');
  assert.ok(jsContent.includes('350.000 đ') || jsContent.includes('399.000 đ'), 'JS must toggle yearly price');
});

// -----------------------------------------------------------------------------
// Part 12: Comprehensive 4-Column Footer (Section 7)
// -----------------------------------------------------------------------------
console.log('\n--- 12. Comprehensive 4-Column Footer ---');

runTest('Footer: 4-column semantic layout with brand, nav, tech and legal', () => {
  assert.ok(htmlContent.includes('welcome-footer-grid'), 'Missing .welcome-footer-grid');
  assert.ok(htmlContent.includes('col-brand'), 'Missing col-brand column');
  assert.ok(htmlContent.includes('Điều Hướng Nhanh'), 'Missing Navigation column');
  assert.ok(htmlContent.includes('Công Nghệ Cốt Lõi'), 'Missing Technology column');
  assert.ok(htmlContent.includes('Hỗ Trợ &amp; Pháp Lý'), 'Missing Legal column');
});

runTest('Footer: Includes security badges, email support, and GitHub repo with uptime removed', () => {
  assert.ok(htmlContent.includes('footer-cert-badge'), 'Missing .footer-cert-badge');
  assert.ok(htmlContent.includes('support.pdflingua@gmail.com'), 'Missing project support email');
  assert.ok(htmlContent.includes('github.com/Sleepy2608/PDF-Lingua'), 'Missing GitHub repo URL');
  assert.strictEqual(htmlContent.includes('99.98% Uptime'), false, 'Uptime status must be removed');
  assert.ok(htmlContent.includes('welcome-footer-copy'), 'Missing copyright text container');
});

runTest('Legal Modal: Footer terms and privacy links open legal modal directly on welcome page', () => {
  assert.ok(htmlContent.includes('id="footerLinkTerms"'), 'Missing #footerLinkTerms');
  assert.ok(htmlContent.includes('id="footerLinkPrivacy"'), 'Missing #footerLinkPrivacy');
  assert.ok(htmlContent.includes('id="legalModalOverlay"'), 'Missing #legalModalOverlay');
  assert.ok(htmlContent.includes('id="tabTerms"'), 'Missing #tabTerms panel');
  assert.ok(htmlContent.includes('id="tabPrivacy"'), 'Missing #tabPrivacy panel');
  assert.ok(htmlContent.includes('id="tabContact"'), 'Missing #tabContact panel');
  assert.ok(cssContent.includes('.legal-modal-overlay'), 'Missing .legal-modal-overlay in CSS');
  assert.ok(cssContent.includes('.legal-modal-container'), 'Missing .legal-modal-container in CSS');
  assert.ok(jsContent.includes('footerLinkTerms'), 'JS must reference footerLinkTerms');
  assert.ok(jsContent.includes('footerLinkPrivacy'), 'JS must reference footerLinkPrivacy');
  assert.ok(jsContent.includes('switchLegalTab'), 'JS must define switchLegalTab');
});

runTest('Footer: Copyright line centered horizontally in CSS', () => {
  assert.ok(cssContent.includes('.welcome-footer-bottom'), 'Missing .welcome-footer-bottom in CSS');
  assert.ok(cssContent.includes('justify-content: center;'), 'Footer bottom must be centered');
  assert.ok(cssContent.includes('.welcome-footer-copy'), 'Missing .welcome-footer-copy in CSS');
});

runTest('Theme: Alternating grey and white backgrounds with grey footer configured', () => {
  assert.ok(cssContent.includes('.welcome-hero-section'), 'Missing .welcome-hero-section in CSS');
  assert.ok(cssContent.includes('.welcome-how-it-works-section'), 'Missing .welcome-how-it-works-section in CSS');
  assert.ok(cssContent.includes('.welcome-footer-section'), 'Missing .welcome-footer-section in CSS');
  assert.ok(cssContent.includes('background-color: var(--wl-bg-subtle);'), 'Subtle grey background must be defined');
  assert.ok(cssContent.includes('background-color: var(--wl-bg-page);'), 'Page white background must be defined');
});

runTest('CSS: Footer grid, columns, and link hover styles defined', () => {
  assert.ok(cssContent.includes('.welcome-footer-grid'), 'Missing .welcome-footer-grid in CSS');
  assert.ok(cssContent.includes('grid-template-columns: 2fr 1fr 1fr 1.2fr;'), 'Footer grid must be 4 columns');
  assert.ok(cssContent.includes('.welcome-footer-links a:hover'), 'Missing link hover in footer');
});

// -----------------------------------------------------------------------------
// Part 13: Aesthetic Refinements & Accessibility Standards
// -----------------------------------------------------------------------------
console.log('\n--- 13. Aesthetic Refinements & Accessibility Standards ---');

runTest('Typography: Tabular numeric styling configured across metrics, prices, steps', () => {
  assert.ok(cssContent.includes('font-variant-numeric: tabular-nums;'), 'Missing tabular-nums rule in CSS');
  assert.ok(cssContent.includes('.welcome-stat-number'), 'Missing .welcome-stat-number selector for tabular-nums');
  assert.ok(cssContent.includes('.welcome-price-value'), 'Missing .welcome-price-value selector for tabular-nums');
  assert.ok(cssContent.includes('.welcome-step-number'), 'Missing .welcome-step-number selector for tabular-nums');
  assert.ok(cssContent.includes('.welcome-metric-number'), 'Missing .welcome-metric-number selector for tabular-nums');
  assert.ok(cssContent.includes('.mini-gauge-num'), 'Missing .mini-gauge-num selector for tabular-nums');
  assert.ok(cssContent.includes('.reduction-val'), 'Missing .reduction-val selector for tabular-nums');
  assert.ok(cssContent.includes('.welcome-doc-table td'), 'Missing .welcome-doc-table td selector for tabular-nums');
});

runTest('Accessibility: High-contrast keyboard focus outlines with offset and glow', () => {
  assert.ok(cssContent.includes(':focus-visible'), 'Missing :focus-visible rules');
  assert.ok(cssContent.includes('outline-offset: 2px;'), 'Missing outline-offset');
  assert.ok(cssContent.includes('.welcome-btn:focus-visible'), 'Missing .welcome-btn:focus-visible');
  assert.ok(cssContent.includes('.welcome-nav-link:focus-visible'), 'Missing .welcome-nav-link:focus-visible');
  assert.ok(cssContent.includes('.billing-toggle-btn:focus-visible'), 'Missing .billing-toggle-btn:focus-visible');
});

runTest('Scroll Reveal: CSS animation classes and stagger delays defined', () => {
  assert.ok(cssContent.includes('.welcome-reveal {'), 'Missing .welcome-reveal rule in CSS');
  assert.ok(cssContent.includes('.welcome-reveal.is-revealed'), 'Missing .welcome-reveal.is-revealed in CSS');
  assert.ok(cssContent.includes('.welcome-reveal-delay-1'), 'Missing delay 1 class');
  assert.ok(cssContent.includes('.welcome-reveal-delay-2'), 'Missing delay 2 class');
  assert.ok(cssContent.includes('.welcome-reveal-delay-3'), 'Missing delay 3 class');
});

runTest('Motion Safety: prefers-reduced-motion media query immediately reveals elements', () => {
  assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'Missing prefers-reduced-motion media query');
  assert.ok(cssContent.includes('opacity: 1 !important;'), 'Reduced motion must force full opacity');
  assert.ok(cssContent.includes('transition: none !important;'), 'Reduced motion must disable transitions');
});

runTest('HTML: Scroll reveal classes integrated into major landing sections', () => {
  assert.ok(htmlContent.includes('welcome-section-header welcome-hero-header welcome-reveal'), 'Hero header missing reveal class');
  assert.ok(htmlContent.includes('welcome-preview-card welcome-reveal'), 'Preview card missing reveal class');
  assert.ok(htmlContent.includes('welcome-bento-card welcome-bento-span-2 welcome-reveal'), 'Bento card missing reveal class');
  assert.ok(htmlContent.includes('welcome-step-card welcome-reveal'), 'Step card missing reveal class');
  assert.ok(htmlContent.includes('welcome-pricing-card welcome-reveal'), 'Pricing card missing reveal class');
});

runTest('JS: Scroll reveal observer with reduced motion check implemented', () => {
  assert.ok(jsContent.includes('.welcome-reveal'), 'JS must query .welcome-reveal');
  assert.ok(jsContent.includes('prefers-reduced-motion: reduce'), 'JS must check prefers-reduced-motion');
  assert.ok(jsContent.includes('is-revealed'), 'JS must add is-revealed class');
  assert.ok(jsContent.includes('unobserve'), 'JS must unobserve after reveal');
});

runTest('JS: Smooth scroll with sticky navbar offset calculation implemented', () => {
  assert.ok(jsContent.includes('a[href^="#welcome"]'), 'JS must query anchor links');
  assert.ok(jsContent.includes('getBoundingClientRect().top'), 'JS must calculate element position');
  assert.ok(jsContent.includes('window.scrollTo'), 'JS must call window.scrollTo');
  assert.ok(jsContent.includes('behavior: prefersReduced ? \'auto\' : \'smooth\''), 'JS must respect reduced motion');
});

// -----------------------------------------------------------------------------
// Part 14: Responsive Breakpoints, Web Vitals & Definition of Done
// -----------------------------------------------------------------------------
console.log('\n--- 14. Responsive Breakpoints, Web Vitals & Definition of Done ---');

runTest('Web Vitals (CLS = 0): Brand logo specifies explicit dimensions and aspect ratio', () => {
  assert.ok(htmlContent.includes('class="welcome-brand-img" width="34" height="34"'), 'Brand logo must have width="34" height="34"');
  assert.ok(cssContent.includes('aspect-ratio: 1 / 1;'), 'Brand logo CSS must specify aspect-ratio: 1 / 1');
  assert.ok(cssContent.includes('object-fit: contain;'), 'Brand logo CSS must specify object-fit: contain');
});

runTest('Web Vitals (LCP < 1.8s): Below-the-fold sections configured with content-visibility: auto', () => {
  assert.ok(cssContent.includes('content-visibility: auto;'), 'Missing content-visibility: auto in CSS');
  assert.ok(cssContent.includes('contain-intrinsic-size: 1px 700px;'), 'Missing contain-intrinsic-size in CSS');
  assert.ok(cssContent.includes('.welcome-features-section'), 'Features section must have content-visibility');
  assert.ok(cssContent.includes('.welcome-pricing-section'), 'Pricing section must have content-visibility');
  assert.ok(cssContent.includes('.welcome-footer'), 'Footer must have content-visibility');
});

runTest('Responsive: Tablet tier (@media max-width: 1024px) switches Bento and Footer to 2 columns', () => {
  assert.ok(cssContent.includes('@media (max-width: 1024px)'), 'Missing @media (max-width: 1024px)');
  assert.ok(cssContent.includes('grid-template-columns: repeat(2, 1fr);'), 'Tablet must set 2-column grid');
  assert.ok(cssContent.includes('.welcome-nav-menu'), 'Tablet must handle nav menu collapse');
});

runTest('Responsive: Mobile tier (@media max-width: 640px) enables full-width buttons and single columns', () => {
  assert.ok(cssContent.includes('@media (max-width: 640px)'), 'Missing @media (max-width: 640px)');
  assert.ok(cssContent.includes('flex-direction: column;'), 'Mobile CTA group must be vertical column');
  assert.ok(cssContent.includes('width: 100%;'), 'Mobile CTA buttons must be 100% width');
});

runTest('JS: Auto-dismisses mobile drawer when viewport expands past tablet breakpoint', () => {
  assert.ok(jsContent.includes('window.innerWidth > 1024'), 'JS must check window.innerWidth > 1024');
  assert.ok(jsContent.includes('toggleMobileMenu(false)'), 'JS must close drawer on wide resize');
});

runTest('Definition of Done: Standalone page with zero runtime dependencies on index.html', () => {
  assert.strictEqual(htmlContent.includes('id="app"'), false, 'welcome.html must not depend on #app shell');
  assert.strictEqual(htmlContent.includes('main.js'), false, 'welcome.html must not load main.js');
  assert.ok(htmlContent.includes('src="js/welcome.js"'), 'welcome.html loads dedicated welcome.js');
});

runTest('Definition of Done: Complete 6-landmark semantic architecture verified', () => {
  const landmarks = [
    'id="welcomeNavbar"',
    'id="welcomeHero"',
    'id="welcomeFeatures"',
    'id="welcomeHowItWorks"',
    'id="welcomePricing"',
    'id="welcomeFooter"'
  ];
  landmarks.forEach((id) => {
    assert.ok(htmlContent.includes(id), `Missing landmark: ${id}`);
  });
  assert.strictEqual(htmlContent.includes('id="welcomeTestimonials"'), false, '#welcomeTestimonials must not exist');
});

// -----------------------------------------------------------------------------
// Part 15: Multilingual (i18n) Engine & Translation Attributes
// -----------------------------------------------------------------------------
console.log('\n--- 15. Multilingual (i18n) Architecture & Dictionary Parity ---');

const i18n = require('../js/i18n.js');

runTest('HTML: welcome.html loads js/i18n.js before js/welcome.js', () => {
  const i18nIndex = htmlContent.indexOf('src="js/i18n.js"');
  const welcomeJsIndex = htmlContent.indexOf('src="js/welcome.js"');
  assert.ok(i18nIndex !== -1, 'welcome.html must include <script src="js/i18n.js">');
  assert.ok(welcomeJsIndex !== -1, 'welcome.html must include <script src="js/welcome.js">');
  assert.ok(i18nIndex < welcomeJsIndex, 'js/i18n.js must be loaded before js/welcome.js');
});

runTest('HTML: Desktop header and mobile drawer include language switcher controls', () => {
  assert.ok(htmlContent.includes('id="welcomeLangSwitcher"'), 'Missing #welcomeLangSwitcher in desktop nav');
  assert.ok(htmlContent.includes('id="mobileLangSwitcher"'), 'Missing #mobileLangSwitcher in mobile drawer');
  assert.ok(htmlContent.includes('data-lang="vi"'), 'Missing Vietnamese language toggle button');
  assert.ok(htmlContent.includes('data-lang="en"'), 'Missing English language toggle button');
});

runTest('HTML: Document title and metadata configured with i18n keys', () => {
  assert.ok(/<title[^>]+data-i18n="welcome_meta_title"/i.test(htmlContent), 'Title tag must have data-i18n="welcome_meta_title"');
});

runTest('HTML: Hero section binds complete data-i18n and data-i18n-html attributes', () => {
  const heroKeys = [
    'welcome_hero_eyebrow',
    'welcome_hero_title_1',
    'welcome_hero_subtitle',
    'welcome_hero_cta_primary',
    'welcome_hero_cta_secondary',
    'welcome_trust_no_install',
    'welcome_trust_user_isolation',
    'welcome_trust_ocr_support'
  ];
  heroKeys.forEach(k => {
    assert.ok(
      htmlContent.includes(`data-i18n="${k}"`) || htmlContent.includes(`data-i18n-html="${k}"`),
      `Hero section missing i18n binding for: ${k}`
    );
  });
});

runTest('HTML: Interactive Preview Mock binds tabs, badges, headers and labels to i18n', () => {
  const previewKeys = [
    'preview_file_pages',
    'badge_pdf_digital',
    'welcome_preview_mode_text',
    'welcome_preview_mode_pdf',
    'welcome_preview_mode_split',
    'toolbar_target_lang',
    'welcome_preview_btn_retranslate',
    'welcome_preview_btn_download',
    'panel_source_title',
    'badge_original',
    'preview_stats_orig',
    'common_copy',
    'panel_target_title',
    'badge_translated',
    'preview_stats_trans'
  ];
  previewKeys.forEach(k => {
    assert.ok(
      htmlContent.includes(`data-i18n="${k}"`) || htmlContent.includes(`data-i18n-html="${k}"`),
      `Preview mock missing i18n binding for: ${k}`
    );
  });
});

runTest('HTML: Bento Grid (all 6 feature cards) binds tags, titles and descriptions', () => {
  const bentoKeys = [
    'welcome_features_title', 'welcome_features_subtitle',
    'bento_layout_badge', 'bento_layout_title', 'bento_layout_desc',
    'bento_ocr_badge', 'bento_ocr_title', 'bento_ocr_desc',
    'bento_copilot_badge', 'bento_copilot_title', 'bento_copilot_desc',
    'bento_summary_badge', 'bento_summary_title', 'bento_summary_desc',
    'bento_batch_badge', 'bento_batch_title', 'bento_batch_desc',
    'bento_sec_badge', 'bento_sec_title', 'bento_sec_desc'
  ];
  bentoKeys.forEach(k => {
    assert.ok(
      htmlContent.includes(`data-i18n="${k}"`) || htmlContent.includes(`data-i18n-html="${k}"`),
      `Bento grid missing i18n binding for: ${k}`
    );
  });
});

runTest('HTML: How It Works section binds title, subtitle and all 3 steps', () => {
  const howKeys = [
    'welcome_workflow_title', 'welcome_workflow_subtitle',
    'step_1_title', 'step_1_desc', 'step_1_meta',
    'step_2_title', 'step_2_desc', 'step_2_meta',
    'step_3_title', 'step_3_desc', 'step_3_meta'
  ];
  howKeys.forEach(k => {
    assert.ok(
      htmlContent.includes(`data-i18n="${k}"`) || htmlContent.includes(`data-i18n-html="${k}"`),
      `How It Works section missing i18n binding for: ${k}`
    );
  });
});

runTest('HTML: Pricing section binds 3 tiers, discount badge, feature lists and CTAs', () => {
  const pricingKeys = [
    'welcome_pricing_title', 'welcome_pricing_subtitle',
    'pricing_free_name', 'pricing_free_tagline', 'pricing_free_pill', 'pricing_free_price', 'pricing_free_period',
    'pricing_free_f1', 'pricing_free_f2', 'pricing_free_f3', 'pricing_free_f4', 'pricing_free_f5',
    'pricing_free_cta',
    'pricing_pro_name_monthly', 'pricing_pro_tagline_monthly', 'pricing_tier_flexible', 'pricing_pro_period_month',
    'pricing_pro_f1', 'pricing_pro_f2', 'pricing_pro_f3', 'pricing_pro_f4', 'pricing_pro_f5', 'pricing_pro_f6', 'pricing_pro_f7', 'pricing_pro_f8',
    'pricing_pro_cta_monthly',
    'pricing_pro_name_yearly', 'pricing_pro_tagline_yearly', 'pricing_pro_ribbon_yearly', 'pricing_pro_period_year',
    'pricing_discount_badge_25', 'pricing_pro_yearly_f1', 'pricing_pro_yearly_f2', 'pricing_pro_cta_yearly'
  ];
  pricingKeys.forEach(k => {
    assert.ok(
      htmlContent.includes(`data-i18n="${k}"`) || htmlContent.includes(`data-i18n-html="${k}"`),
      `Pricing section missing i18n binding for: ${k}`
    );
  });
});

runTest('HTML: Footer and Legal Modals bind all columns, badges and buttons to i18n', () => {
  const footerAndLegalKeys = [
    'footer_desc', 'welcome_footer_quick_nav', 'welcome_footer_core_tech',
    'welcome_footer_support_legal', 'footer_badge_rbac', 'footer_contact_email',
    'footer_copyright', 'legal_modal_title', 'legal_modal_subtitle',
    'legal_tab_terms', 'legal_tab_privacy', 'legal_tab_contact'
  ];
  footerAndLegalKeys.forEach(k => {
    assert.ok(
      htmlContent.includes(`data-i18n="${k}"`) || htmlContent.includes(`data-i18n-html="${k}"`),
      `Footer or Legal Modal missing i18n binding for: ${k}`
    );
  });
});

runTest('JS: welcome.js subscribes to languageChanged event for dynamic pricing sync', () => {
  assert.ok(jsContent.includes('languageChanged'), 'welcome.js must listen for languageChanged');
  assert.ok(jsContent.includes('setBillingCycle(currentCycle)'), 'welcome.js must update billing cycle on language change');
});

runTest('i18n Dictionary Parity: All welcome.html i18n keys resolve in vi and en dictionaries', () => {
  const i18nRegex = /data-i18n(?:-html)?="([^"]+)"/g;
  const keys = new Set();
  let match;
  while ((match = i18nRegex.exec(htmlContent)) !== null) {
    keys.add(match[1]);
  }

  assert.ok(keys.size >= 40, `Expected at least 40 i18n keys in welcome.html, found ${keys.size}`);

  const missingVi = [];
  const missingEn = [];

  i18n.setLanguage('vi');
  for (const k of keys) {
    const textVi = i18n.t(k);
    if (!textVi || textVi === k) missingVi.push(k);
  }

  i18n.setLanguage('en');
  for (const k of keys) {
    const textEn = i18n.t(k);
    if (!textEn || textEn === k) missingEn.push(k);
  }

  assert.strictEqual(missingVi.length, 0, 'Missing Vietnamese translations for: ' + missingVi.join(', '));
  assert.strictEqual(missingEn.length, 0, 'Missing English translations for: ' + missingEn.join(', '));
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (0 failed).`);
console.log('================================================================\n');

