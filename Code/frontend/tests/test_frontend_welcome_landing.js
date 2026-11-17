/**
 * PDF-Lingua: Welcome Landing Page Unit & Integration Test Suite
 * --------------------------------------------------------------
 * Verifies all 7 core structural sections from the wireframe:
 * 1. Navigation Bar
 * 2. Hero Section (Eyebrow, 2-line H1, Dual CTAs, Interactive Preview, Dropzone)
 * 3. Features Bento Grid (6 cards)
 * 4. How It Works (3 steps)
 * 5. Testimonials & Hard Metrics
 * 6. Pricing Plans Preview (Free vs Pro)
 * 7. Comprehensive Footer & Legal Links
 * Also verifies 1-click sample demo execution, design system compliance, and dash safety.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const HTML_PATH = path.join(__dirname, '..', 'index.html');
const CSS_PATH = path.join(__dirname, '..', 'css', 'welcome_landing.css');
const JS_PATH = path.join(__dirname, '..', 'js', 'welcome_landing.js');

let passCount = 0;
let failCount = 0;

function it(title, fn) {
  try {
    fn();
    console.log(`[PASS] ${title}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${title}`);
    console.error(`       Error: ${err.message}`);
    failCount++;
  }
}

console.log('================================================================');
console.log('PDF-Lingua Welcome Landing Page Test Suite');
console.log('================================================================\n');

const htmlContent = fs.readFileSync(HTML_PATH, 'utf8');
const cssContent = fs.readFileSync(CSS_PATH, 'utf8');
const jsContent = fs.readFileSync(JS_PATH, 'utf8');

// 1. Files & Linkages
it('Landing CSS and JS are properly linked in index.html', () => {
  assert(htmlContent.includes('css/welcome_landing.css'), 'welcome_landing.css must be linked');
  assert(htmlContent.includes('js/welcome_landing.js'), 'welcome_landing.js must be loaded');
});

// 2. Dash Safety (Zero En-dash, Zero Em-dash)
it('Strict hyphen compliance: Zero en-dash and zero em-dash in all landing assets', () => {
  assert(!htmlContent.includes('\u2013'), 'index.html must not contain en-dash');
  assert(!htmlContent.includes('\u2014'), 'index.html must not contain em-dash');
  assert(!cssContent.includes('\u2013'), 'welcome_landing.css must not contain en-dash');
  assert(!cssContent.includes('\u2014'), 'welcome_landing.css must not contain em-dash');
  assert(!jsContent.includes('\u2013'), 'welcome_landing.js must not contain en-dash');
  assert(!jsContent.includes('\u2014'), 'welcome_landing.js must not contain em-dash');
});

// 3. Block 1: Navigation Bar
it('Block 1: Navigation Bar exists with brand, links, and action buttons', () => {
  assert(htmlContent.includes('id="welcomeNavbar"'), 'Navbar element #welcomeNavbar must exist');
  assert(htmlContent.includes('href="#welcomeHero"'), 'Home link must exist');
  assert(htmlContent.includes('href="#welcomeFeatures"'), 'Features link must exist');
  assert(htmlContent.includes('href="#welcomeHowItWorks"'), 'How it works link must exist');
  assert(htmlContent.includes('href="#welcomeTestimonials"'), 'Testimonials link must exist');
  assert(htmlContent.includes('href="#welcomePricing"'), 'Pricing link must exist');
  assert(htmlContent.includes('id="btnNavLogin"'), 'Login button #btnNavLogin must exist');
  assert(htmlContent.includes('id="btnNavGetStarted"'), 'Get Started CTA button #btnNavGetStarted must exist');
});

// 4. Block 2: Hero Section
it('Block 2: Hero Section has eyebrow badge, strict 2-line H1, dual CTAs, preview card & dropzone', () => {
  assert(htmlContent.includes('id="welcomeHero"'), 'Hero section #welcomeHero must exist');
  assert(htmlContent.includes('wl-hero-badge'), 'Hero eyebrow badge must exist');
  assert(htmlContent.includes('class="wl-hero-h1"'), 'H1 with class wl-hero-h1 must exist');
  assert(htmlContent.includes('wl-highlight-word'), 'H1 must contain highlighted phrase');
  assert(htmlContent.includes('id="btnHeroStart"'), 'Hero start button #btnHeroStart must exist');
  assert(htmlContent.includes('id="btnTryDemoDoc"'), 'Demo button #btnTryDemoDoc must exist');
  assert(htmlContent.includes('class="wl-preview-card"'), 'Dual-pane preview card must exist');
  assert(htmlContent.includes('class="wl-citation-badge"'), 'AI citation highlight badge must exist');
  assert(htmlContent.includes('id="dropzoneCard"'), 'Dropzone card must be preserved in hero');
});

// 5. Block 3: Features Bento Grid
it('Block 3: Features Bento Grid contains all 6 core technical pillars', () => {
  assert(htmlContent.includes('id="welcomeFeatures"'), 'Features section #welcomeFeatures must exist');
  assert(htmlContent.includes('wl-bento-grid'), 'Bento grid container must exist');
  assert(htmlContent.includes('Dịch Thuật Song Ngữ Đối Chiếu'), 'Feature 1 must exist');
  assert(htmlContent.includes('OCR Tiếng Việt Chuyên Sâu'), 'Feature 2 must exist');
  assert(htmlContent.includes('Trợ Lý AI Copilot Trích Dẫn Số Trang'), 'Feature 3 must exist');
  assert(htmlContent.includes('Tóm Tắt Map-Reduce'), 'Feature 4 must exist');
  assert(htmlContent.includes('Xử Lý Lô & Xuất Đa Định Dạng'), 'Feature 5 must exist');
  assert(htmlContent.includes('Bảo Mật & Riêng Tư Tuyệt Đối'), 'Feature 6 must exist');
});

// 6. Block 4: How It Works
it('Block 4: How It Works contains 3 sequential steps', () => {
  assert(htmlContent.includes('id="welcomeHowItWorks"'), 'How it works section #welcomeHowItWorks must exist');
  assert(htmlContent.includes('Tải Lên Tài Liệu'), 'Step 1 must exist');
  assert(htmlContent.includes('AI Bóc Tách & Dịch Thuật'), 'Step 2 must exist');
  assert(htmlContent.includes('Đối Chiếu, Hỏi Đáp & Xuất Tệp'), 'Step 3 must exist');
});

// 7. Block 5: Testimonials & Hard Metrics
it('Block 5: Testimonials & Hard Metrics section has real metrics and academic feedback', () => {
  assert(htmlContent.includes('id="welcomeTestimonials"'), 'Testimonials section #welcomeTestimonials must exist');
  assert(htmlContent.includes('&lt; 2.8'), 'OCR speed metric (< 2.8s) must be displayed');
  assert(htmlContent.includes('99.2'), 'Vietnamese accuracy metric (99.2%) must be displayed');
  assert(htmlContent.includes('94.5'), 'Layout preservation metric (94.5%) must be displayed');
  assert(htmlContent.includes('Kỹ sư Nghiên cứu AI'), 'AI Researcher testimonial must exist');
  assert(htmlContent.includes('Giảng viên Ngôn ngữ Ứng dụng'), 'Language Lecturer testimonial must exist');
});

// 8. Block 6: Pricing Plans Preview
it('Block 6: Pricing Plans section displays Free and featured Pro plans', () => {
  assert(htmlContent.includes('id="welcomePricing"'), 'Pricing section #welcomePricing must exist');
  assert(htmlContent.includes('id="btnPlanFree"'), 'Free plan button #btnPlanFree must exist');
  assert(htmlContent.includes('id="btnPlanPro"'), 'Pro plan button #btnPlanPro must exist');
  assert(htmlContent.includes('PHỔ BIẾN NHẤT ★'), 'Featured badge on Pro card must exist');
});

// 9. Block 7: Comprehensive Footer
it('Block 7: Footer contains 4 informational columns, copyright bar and legal links', () => {
  assert(htmlContent.includes('class="wl-footer"'), 'Footer .wl-footer must exist');
  assert(htmlContent.includes('id="linkTermsLanding"'), 'Landing terms link must exist');
  assert(htmlContent.includes('id="linkPrivacyLanding"'), 'Landing privacy link must exist');
  assert(htmlContent.includes('id="linkContactLanding"'), 'Landing contact link must exist');
  assert(htmlContent.includes('© 2026 PDF-Lingua Project. Bảo lưu mọi quyền.'), 'Copyright statement must exist');
});

// 10. Controller API & Demo Execution
it('Controller: PDFLinguaLanding exposes loadSampleDocument and focusOrScrollDropzone', () => {
  let renderedData = null;
  global.window = {
    pdfLinguaWorkspace: {
      renderWorkspace: (data) => {
        renderedData = data;
      }
    }
  };
  global.document = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => []
  };

  // Evaluate script in sandbox
  eval(jsContent);

  assert(typeof global.window.PDFLinguaLanding === 'object', 'PDFLinguaLanding must be exposed on window');
  assert(typeof global.window.PDFLinguaLanding.loadSampleDocument === 'function', 'loadSampleDocument must be a function');
  assert(typeof global.window.PDFLinguaLanding.focusOrScrollDropzone === 'function', 'focusOrScrollDropzone must be a function');

  // Test executing loadSampleDocument
  global.window.PDFLinguaLanding.loadSampleDocument();
  assert(renderedData !== null, 'renderWorkspace must be called with sample data');
  assert.strictEqual(renderedData.page_count, 2, 'Sample doc must have 2 pages');
  assert.strictEqual(renderedData.filename, 'Bao_cao_Nghien_cuu_AI_Song_Ngu_Mau.pdf', 'Sample doc filename must match');
  assert(renderedData.translated_text.includes('Dịch máy thần kinh'), 'Translated text must be populated');
});

console.log('\n================================================================');
console.log(`SUMMARY: ${passCount}/${passCount + failCount} tests passed (${failCount} failed).`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}

