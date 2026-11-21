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

console.log('\n================================================================');
console.log(`Frontend i18n Test Suites Result: ${passedTests}/${totalTests} PASSED`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
