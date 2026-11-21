/**
 * PDF-Lingua: Frontend Internationalization (i18n) Test Suite
 * -----------------------------------------------------------
 * Test suite for multilingual engine, key lookup, language switching,
 * parameter interpolation, fallback resolution, and DOM bindings.
 *
 * Execution:
 *   node Code/frontend/tests/test_frontend_i18n.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================');
console.log('PDF-Lingua Frontend i18n Test Suite');
console.log('Testing: Code/frontend/js/i18n.js');
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

// Mock localStorage and DOM environment for testing
const mockStorage = {};
global.localStorage = {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, val) => { mockStorage[key] = String(val); },
    removeItem: (key) => { delete mockStorage[key]; },
    clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
};

global.navigator = {
    language: 'vi-VN'
};

const mockElements = [];
global.document = {
    documentElement: { lang: 'vi' },
    querySelectorAll: (selector) => {
        if (selector === '[data-i18n]') {
            return mockElements.filter(el => el.hasAttribute('data-i18n'));
        }
        if (selector === '[data-i18n-html]') {
            return mockElements.filter(el => el.hasAttribute('data-i18n-html'));
        }
        if (selector === '[data-i18n-attr]') {
            return mockElements.filter(el => el.hasAttribute('data-i18n-attr'));
        }
        if (selector === '.lang-switcher-btn') {
            return mockElements.filter(el => (el.className || '').includes('lang-switcher-btn'));
        }
        return [];
    },
    dispatchEvent: () => true,
    addEventListener: () => {}
};

global.CustomEvent = class {
    constructor(type, eventInitDict) {
        this.type = type;
        this.detail = eventInitDict ? eventInitDict.detail : null;
    }
};

// Load i18n module
const i18n = require('../js/i18n.js');

// -----------------------------------------------------------------------------
// Part 1: Engine Initialization & API Surface
// -----------------------------------------------------------------------------
console.log('--- 1. Engine Initialization & API Surface ---');

runTest('i18n object exposes all core methods', () => {
    assert.strictEqual(typeof i18n.init, 'function');
    assert.strictEqual(typeof i18n.t, 'function');
    assert.strictEqual(typeof i18n.setLanguage, 'function');
    assert.strictEqual(typeof i18n.getLanguage, 'function');
    assert.strictEqual(typeof i18n.applyTranslations, 'function');
    assert.strictEqual(typeof i18n.updateSwitcherUI, 'function');
});

runTest('i18n defaults to vi when no preferences exist', () => {
    global.localStorage.clear();
    global.navigator.language = 'vi-VN';
    const lang = i18n.init();
    assert.strictEqual(lang, 'vi');
    assert.strictEqual(i18n.getLanguage(), 'vi');
});

runTest('i18n reads saved language from localStorage if present', () => {
    global.localStorage.setItem('pdf_lingua_lang', 'en');
    const lang = i18n.init();
    assert.strictEqual(lang, 'en');
    assert.strictEqual(i18n.getLanguage(), 'en');
});

// -----------------------------------------------------------------------------
// Part 2: Language Switching & State Persistence
// -----------------------------------------------------------------------------
console.log('\n--- 2. Language Switching & State Persistence ---');

runTest('setLanguage switches to vi and en cleanly', () => {
    i18n.setLanguage('vi');
    assert.strictEqual(i18n.getLanguage(), 'vi');
    assert.strictEqual(global.localStorage.getItem('pdf_lingua_lang'), 'vi');

    i18n.setLanguage('en');
    assert.strictEqual(i18n.getLanguage(), 'en');
    assert.strictEqual(global.localStorage.getItem('pdf_lingua_lang'), 'en');
});

runTest('setLanguage ignores invalid language codes', () => {
    i18n.setLanguage('en');
    i18n.setLanguage('invalid_code_xyz');
    assert.strictEqual(i18n.getLanguage(), 'en');
});

// -----------------------------------------------------------------------------
// Part 3: Translation Lookup & Parameter Interpolation
// -----------------------------------------------------------------------------
console.log('\n--- 3. Translation Lookup & Parameter Interpolation ---');

runTest('Translation lookup returns correct localized strings for common keys', () => {
    i18n.setLanguage('vi');
    assert.strictEqual(i18n.t('nav_home'), 'Trang chủ');
    assert.strictEqual(i18n.t('nav_pricing'), 'Bảng giá');
    assert.strictEqual(i18n.t('sidebar_recent_docs'), 'Tài liệu gần đây');

    i18n.setLanguage('en');
    assert.strictEqual(i18n.t('nav_home'), 'Home');
    assert.strictEqual(i18n.t('nav_pricing'), 'Pricing');
    assert.strictEqual(i18n.t('sidebar_recent_docs'), 'Recent Documents');
});

runTest('Parameter interpolation replaces dynamic tokens correctly', () => {
    i18n.setLanguage('vi');
    const viText = i18n.t('dropzone_limits_hint', { max_size: 20, max_pages: 100 });
    assert.strictEqual(viText, 'Hỗ trợ tệp PDF tối đa 20 MB và 100 trang');

    i18n.setLanguage('en');
    const enText = i18n.t('dropzone_limits_hint', { max_size: 20, max_pages: 100 });
    assert.strictEqual(enText, 'Supports PDF up to 20 MB and 100 pages');
});

runTest('Missing keys fall back gracefully to key identifier or vi equivalent', () => {
    i18n.setLanguage('en');
    const missingKey = 'non_existent_key_12345';
    assert.strictEqual(i18n.t(missingKey), missingKey);
});

// -----------------------------------------------------------------------------
// Part 4: DOM Declarative Binding Verification
// -----------------------------------------------------------------------------
console.log('\n--- 4. DOM Declarative Binding Verification ---');

runTest('applyTranslations updates textContent and attributes on mocked DOM elements', () => {
    const textEl = {
        attributes: { 'data-i18n': 'btn_translate' },
        getAttribute: function(name) { return this.attributes[name]; },
        hasAttribute: function(name) { return name in this.attributes; },
        textContent: ''
    };

    const attrEl = {
        attributes: { 'data-i18n-attr': 'placeholder:page_select_placeholder' },
        getAttribute: function(name) { return this.attributes[name]; },
        hasAttribute: function(name) { return name in this.attributes; },
        setAttribute: function(name, val) { this[name] = val; },
        placeholder: ''
    };

    mockElements.push(textEl, attrEl);

    i18n.setLanguage('vi');
    assert.strictEqual(textEl.textContent, 'Dịch văn bản');
    assert.strictEqual(attrEl.placeholder, 'Ví dụ: 1-5, 8, 11-13');

    i18n.setLanguage('en');
    assert.strictEqual(textEl.textContent, 'Translate');
    assert.strictEqual(attrEl.placeholder, 'E.g. 1-5, 8, 11-13');
});

// -----------------------------------------------------------------------------
// Part 5: HTTP Errors & Dynamic Message Localization
// -----------------------------------------------------------------------------
console.log('\n--- 5. HTTP Errors & Dynamic Message Localization ---');

runTest('getHttpError returns localized messages for standard status codes', () => {
    i18n.setLanguage('vi');
    assert.strictEqual(i18n.getHttpError(400), 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.');
    assert.strictEqual(i18n.getHttpError(404), 'Không tìm thấy tài nguyên yêu cầu.');
    assert.strictEqual(i18n.getHttpError(500), 'Máy chủ gặp sự cố xử lý. Vui lòng thử lại sau.');
    assert.strictEqual(i18n.getHttpError(999, 'Lỗi tùy chỉnh'), 'Lỗi tùy chỉnh');

    i18n.setLanguage('en');
    assert.strictEqual(i18n.getHttpError(400), 'Invalid request. Please check your input.');
    assert.strictEqual(i18n.getHttpError(404), 'The requested resource could not be found.');
    assert.strictEqual(i18n.getHttpError(500), 'Internal server error occurred. Please try again later.');
    assert.strictEqual(i18n.getHttpError(999, 'Custom fallback'), 'Custom fallback');
});

runTest('Dynamic progress text and toast sentences translate accurately', () => {
    i18n.setLanguage('vi');
    assert.strictEqual(i18n.t('Đang xử lý...'), 'Đang xử lý...');
    assert.strictEqual(i18n.t('Đã sao chép toàn bộ bản dịch vào bộ nhớ tạm!'), 'Đã sao chép toàn bộ bản dịch vào bộ nhớ tạm!');

    i18n.setLanguage('en');
    assert.strictEqual(i18n.t('Đang xử lý...'), 'Processing...');
    assert.strictEqual(i18n.t('Đã sao chép toàn bộ bản dịch vào bộ nhớ tạm!'), 'Full translation copied to clipboard!');
});

// -----------------------------------------------------------------------------
// Part 6: Zero En-dash & Em-dash Character Compliance in Dictionaries
// -----------------------------------------------------------------------------
console.log('\n--- 6. Zero En-dash & Em-dash Compliance in i18n.js ---');

runTest('i18n.js strictly contains zero en-dash and zero em-dash characters', () => {
    const i18nSource = fs.readFileSync(path.resolve(__dirname, '../js/i18n.js'), 'utf8');
    const enDashes = (i18nSource.match(/\u2013/g) || []).length;
    const emDashes = (i18nSource.match(/\u2014/g) || []).length;
    assert.strictEqual(enDashes, 0, 'Forbidden en-dash character found in i18n.js');
    assert.strictEqual(emDashes, 0, 'Forbidden em-dash character found in i18n.js');
});

// -----------------------------------------------------------------------------
// Part 7: Role Translations (Guest, Free, Pro, Admin) & DOM Bindings
// -----------------------------------------------------------------------------
console.log('\n--- 7. Multilingual Role Mapping & Index.html Bindings ---');

runTest('Role dictionary mapping: Khach -> Guest, Nguoi dung Free -> Free User, Nguoi dung Pro -> Pro User, Quan tri vien -> Admin', () => {
    i18n.setLanguage('vi');
    assert.strictEqual(i18n.t('role_guest'), 'Khách');
    assert.strictEqual(i18n.t('role_free'), 'Người dùng Free');
    assert.strictEqual(i18n.t('role_pro'), 'Người dùng Pro');
    assert.strictEqual(i18n.t('role_admin'), 'Quản trị viên');
    assert.strictEqual(i18n.t('role_admin_title'), 'Vai trò: Quản trị viên');

    i18n.setLanguage('en');
    assert.strictEqual(i18n.t('role_guest'), 'Guest');
    assert.strictEqual(i18n.t('role_free'), 'Free User');
    assert.strictEqual(i18n.t('role_pro'), 'Pro User');
    assert.strictEqual(i18n.t('role_admin'), 'Admin');
    assert.strictEqual(i18n.t('role_admin_title'), 'Role: Admin');
});

runTest('Index.html HTML bindings: sidebar and topbar configure role i18n attributes', () => {
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    assert.ok(indexHtml.includes('data-i18n="role_guest"'), 'Missing data-i18n="role_guest" on sidebar user name');
    assert.ok(indexHtml.includes('data-tooltip:role_guest'), 'Missing data-tooltip:role_guest on sidebar profile card');
    assert.ok(indexHtml.includes('data-i18n="role_admin"'), 'Missing data-i18n="role_admin" on admin crown badge');
    assert.ok(indexHtml.includes('data-i18n-attr="title:role_admin_title"'), 'Missing title:role_admin_title on admin button');
    assert.ok(indexHtml.includes('data-i18n="account_role_label"'), 'Missing data-i18n="account_role_label" on account modal');
});

// -----------------------------------------------------------------------------
// Part 8: Index.html Hero, Title & Footer Multilingual Verification
// -----------------------------------------------------------------------------
console.log('\n--- 8. Index.html Hero, Title & Footer Multilingual Verification ---');

runTest('Hero section and Meta Title dictionary keys exist for both VI and EN', () => {
    i18n.setLanguage('vi');
    assert.strictEqual(i18n.t('app_meta_title'), 'PDF-Lingua | Trích xuất & Dịch thuật PDF thông minh');
    assert.strictEqual(i18n.t('hero_eyebrow'), 'Không gian làm việc tài liệu AI thế hệ mới');
    assert.strictEqual(i18n.t('hero_title'), 'Trình Dịch Thuật & Trợ Lý PDF AI');
    assert.ok(i18n.t('hero_desc').includes('Dịch tài liệu song ngữ'));
    assert.strictEqual(i18n.t('hero_check_1'), 'Dịch tài liệu song ngữ thông minh giữ nguyên định dạng');
    assert.strictEqual(i18n.t('hero_check_2'), 'Nhận dạng OCR chuyên sâu cho tài liệu scan và chữ mờ');
    assert.strictEqual(i18n.t('hero_check_3'), 'Trợ lý AI hỏi đáp tài liệu tức thì có trích dẫn số trang');
    assert.strictEqual(i18n.t('hero_check_4'), 'Tóm tắt nhanh văn bản và bảng thuật ngữ chỉ trong vài giây');

    i18n.setLanguage('en');
    assert.strictEqual(i18n.t('app_meta_title'), 'PDF-Lingua | Smart PDF Extraction & Translation');
    assert.strictEqual(i18n.t('hero_eyebrow'), 'Next-Gen AI Document Workspace');
    assert.strictEqual(i18n.t('hero_title'), 'Intelligent PDF AI Translator & Assistant');
    assert.ok(i18n.t('hero_desc').includes('Smart bilingual document translation'));
    assert.strictEqual(i18n.t('hero_check_1'), 'Intelligent bilingual translation with layout preservation');
    assert.strictEqual(i18n.t('hero_check_2'), 'Deep OCR recognition for scanned and low-contrast PDFs');
    assert.strictEqual(i18n.t('hero_check_3'), 'Instant AI document Q&A with page number citations');
    assert.strictEqual(i18n.t('hero_check_4'), 'Fast document & terminology summarization in seconds');
});

runTest('Index.html contains explicit data-i18n bindings for Hero and Footer links', () => {
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    assert.ok(indexHtml.includes('data-i18n="app_meta_title"'), 'Missing data-i18n="app_meta_title" on title tag');
    assert.ok(indexHtml.includes('data-i18n="hero_eyebrow"'), 'Missing data-i18n="hero_eyebrow"');
    assert.ok(indexHtml.includes('data-i18n="hero_title"'), 'Missing data-i18n="hero_title"');
    assert.ok(indexHtml.includes('data-i18n="hero_desc"'), 'Missing data-i18n="hero_desc"');
    assert.ok(indexHtml.includes('data-i18n="hero_check_1"'), 'Missing data-i18n="hero_check_1"');
    assert.ok(indexHtml.includes('data-i18n="hero_check_2"'), 'Missing data-i18n="hero_check_2"');
    assert.ok(indexHtml.includes('data-i18n="hero_check_3"'), 'Missing data-i18n="hero_check_3"');
    assert.ok(indexHtml.includes('data-i18n="hero_check_4"'), 'Missing data-i18n="hero_check_4"');
    assert.ok(indexHtml.includes('id="linkTerms" data-i18n="legal_tab_terms"'), 'Missing legal_tab_terms on linkTerms');
    assert.ok(indexHtml.includes('id="linkPrivacy" data-i18n="legal_tab_privacy"'), 'Missing legal_tab_privacy on linkPrivacy');
    assert.ok(indexHtml.includes('id="linkContact" data-i18n="legal_tab_contact"'), 'Missing legal_tab_contact on linkContact');
});

runTest('Index.html strictly contains zero en-dash and zero em-dash characters', () => {
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const enDashes = (indexHtml.match(/\u2013/g) || []).length;
    const emDashes = (indexHtml.match(/\u2014/g) || []).length;
    assert.strictEqual(enDashes, 0, `Forbidden en-dash character found in index.html: ${enDashes}`);
    assert.strictEqual(emDashes, 0, `Forbidden em-dash character found in index.html: ${emDashes}`);
});

// -----------------------------------------------------------------------------
// Part 9: Index.html All Sections & Modals Multilingual Verification
// -----------------------------------------------------------------------------
console.log('\n--- 9. Index.html All Sections & Modals Multilingual Verification ---');

runTest('Pricing section dictionary keys exist and render correctly in VI and EN', () => {
    i18n.setLanguage('vi');
    assert.strictEqual(i18n.t('pricing_section_title'), 'Bảng giá gói dịch vụ');
    assert.strictEqual(i18n.t('billing_monthly_opt'), 'Theo tháng (49k/tháng)');
    assert.strictEqual(i18n.t('billing_yearly_opt'), 'Theo năm (399k/năm)');
    assert.strictEqual(i18n.t('pricing_free_name'), 'Gói Miễn Phí');
    assert.strictEqual(i18n.t('pricing_pro_name_monthly'), 'Gói Pro Hàng Tháng');

    i18n.setLanguage('en');
    assert.strictEqual(i18n.t('pricing_section_title'), 'Pricing Plans');
    assert.strictEqual(i18n.t('billing_monthly_opt'), 'Monthly (49k/mo)');
    assert.strictEqual(i18n.t('billing_yearly_opt'), 'Yearly (399k/yr)');
    assert.strictEqual(i18n.t('pricing_free_name'), 'Free Plan');
    assert.strictEqual(i18n.t('pricing_pro_name_monthly'), 'Pro Monthly Plan');
});

runTest('Documents and History section bindings exist in index.html', () => {
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    assert.ok(indexHtml.includes('data-i18n="docs_title"'), 'Missing docs_title');
    assert.ok(indexHtml.includes('data-i18n="docs_empty_title"'), 'Missing docs_empty_title');
    assert.ok(indexHtml.includes('data-i18n="docs_loading_title"'), 'Missing docs_loading_title');
    assert.ok(indexHtml.includes('data-i18n="history_title"'), 'Missing history_title');
    assert.ok(indexHtml.includes('data-i18n="history_empty_title"'), 'Missing history_empty_title');
    assert.ok(indexHtml.includes('data-i18n="history_th_operation"'), 'Missing history_th_operation');
});

runTest('Modals and Admin dashboard bindings exist in index.html', () => {
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    assert.ok(indexHtml.includes('data-i18n="account_modal_title"'), 'Missing account_modal_title');
    assert.ok(indexHtml.includes('data-i18n="checkout_modal_title"'), 'Missing checkout_modal_title');
    assert.ok(indexHtml.includes('data-i18n="quota_modal_title"'), 'Missing quota_modal_title');
    assert.ok(indexHtml.includes('data-i18n="doc_detail_title"'), 'Missing doc_detail_title');
    assert.ok(indexHtml.includes('data-i18n="admin_title"'), 'Missing admin_title');
    assert.ok(indexHtml.includes('data-i18n="admin_table_title"'), 'Missing admin_table_title');
});

console.log('\n================================================================');
console.log(`Frontend i18n Test Suites Result: ${passedTests}/${totalTests} PASSED`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
