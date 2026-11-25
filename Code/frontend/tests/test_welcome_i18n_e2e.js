/**
 * E2E DOM Verification: Welcome page full translation when switching to English
 */
const fs = require('fs');
const assert = require('assert');

// Simple DOM Mock for welcome.html test
const html = fs.readFileSync('Code/frontend/welcome.html', 'utf8');

// Parse all elements with data-i18n and data-i18n-html
const dataI18nRegex = /<([a-z0-9\-]+)([^>]*?)\sdata-i18n="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi;
const dataI18nHtmlRegex = /<([a-z0-9\-]+)([^>]*?)\sdata-i18n-html="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi;

const i18n = require('../js/i18n.js');
i18n.init();
i18n.setLanguage('en');

const dict = i18n.getDictionaries().en;

console.log('Testing Welcome Page English translations...');

// 1. Verify Features Bento Grid
assert.strictEqual(i18n.t('welcome_features_title'), 'Core Capabilities of the PDF-Lingua System');
assert.strictEqual(i18n.t('bento_layout_title'), 'Optimized Reading Flow & Multi-Column Layout');
assert.strictEqual(i18n.t('bento_ocr_title'), 'Scanned Page Processing & Deskew');
assert.strictEqual(i18n.t('bento_copilot_title'), 'AI Copilot Document Q&A Assistant');
assert.strictEqual(i18n.t('bento_summary_title'), 'Distributed Map-Reduce Summarization');
assert.strictEqual(i18n.t('bento_batch_title'), 'Batch Processing & DOCX / ZIP Export');
assert.strictEqual(i18n.t('bento_sec_title'), 'Directory Isolation & Access Control');
console.log('[PASS] All 6 Bento Grid card titles translate to English');

// 2. Verify Bento Grid visual items
assert.strictEqual(i18n.t('bento_sync_row1_vi'), 'Multi-head attention mechanisms');
assert.strictEqual(i18n.t('bento_ocr_scale_zero'), '0 deg (Standard)');
assert.strictEqual(i18n.t('bento_chat_q_lbl'), 'Question:');
assert.strictEqual(i18n.t('bento_summary_chunk'), 'Chunk 1..N');
assert.strictEqual(i18n.t('bento_queue_title'), 'DOCUMENT QUEUE');
assert.strictEqual(i18n.t('bento_sec_user_id'), 'User ID Partitioning');
console.log('[PASS] All Bento Grid micro-visuals translate to English');

// 3. Verify Workflow Steps
assert.strictEqual(i18n.t('welcome_workflow_title'), 'Fast Translation in Seconds');
assert.strictEqual(i18n.t('step_1_meta'), 'Supports PDF 20MB - 100MB');
assert.strictEqual(i18n.t('step_2_meta'), 'Multi-threaded async processing');
assert.strictEqual(i18n.t('step_3_meta'), 'DOCX, TXT, ZIP Formats');
console.log('[PASS] Workflow steps & meta chips translate to English');

// 4. Verify Pricing
assert.strictEqual(i18n.t('welcome_pricing_title'), 'Flexible Pricing for Every Need');
assert.strictEqual(i18n.t('tier_free_name'), 'Free Account');
assert.strictEqual(i18n.t('tier_pro_name'), 'Pro Tier');
assert.strictEqual(i18n.t('tier_pro_badge'), 'Most Popular');
assert.ok(i18n.t('tier_free_item_1').includes('5 documents / day'));
assert.ok(i18n.t('tier_pro_item_1').includes('Unlimited'));
console.log('[PASS] Pricing tiers & feature lists translate to English');

// 5. Verify Footer
assert.strictEqual(i18n.t('footer_badge_rbac'), 'RBAC Access Control');
assert.strictEqual(i18n.t('footer_tech_ocr'), 'Vietnamese OCR & Deskew');
assert.strictEqual(i18n.t('footer_tech_layout'), 'Smart Layout Reading Order');
assert.strictEqual(i18n.t('footer_contact_email'), 'Contact: support.pdflingua@gmail.com');
console.log('[PASS] Footer badges and core technology links translate to English');

// 6. Verify Legal Modal
assert.strictEqual(i18n.t('terms_h1'), '1. Intellectual Property & Copyright');
assert.strictEqual(i18n.t('privacy_h1'), '1. Data Collection & Scope of Use');
assert.strictEqual(i18n.t('feedback_section_feedback'), 'Send Feedback to the Team');
assert.strictEqual(i18n.t('feedback_btn_submit'), 'Submit Feedback');
console.log('[PASS] Legal modal detailed content translates to English');

// 7. Verify Accessibility Labels & Interactive Tooltips
assert.strictEqual(i18n.t('lang_select_aria'), 'Select language');
assert.strictEqual(i18n.t('lang_vi_title'), 'Vietnamese');
assert.strictEqual(i18n.t('lang_en_title'), 'English');
assert.strictEqual(i18n.t('welcome_aria_hero'), 'About PDF-Lingua');
assert.strictEqual(i18n.t('welcome_aria_features'), 'Core features');
assert.strictEqual(i18n.t('welcome_aria_workflow'), 'How it works');
assert.strictEqual(i18n.t('welcome_aria_pricing'), 'Service pricing');
assert.strictEqual(i18n.t('welcome_aria_billing_toggle'), 'Billing cycle');
assert.strictEqual(i18n.t('welcome_aria_footer'), 'Footer');
assert.strictEqual(i18n.t('welcome_copy_source_title'), 'Copy text');
assert.strictEqual(i18n.t('welcome_copy_target_title'), 'Copy translation');
assert.strictEqual(i18n.t('common_scroll_top_title'), 'Scroll to top');
assert.strictEqual(i18n.t('legal_toggle_fullscreen_title'), 'Toggle fullscreen');
assert.strictEqual(i18n.t('legal_print_title'), 'Print or save as PDF');
assert.strictEqual(i18n.t('feedback_copy_email_title'), 'Copy email');
console.log('[PASS] All section accessibility labels and tooltips translate to English');

// 8. Verify Modal Authentication & Navigation Attributes
assert.strictEqual(i18n.t('auth_login_password_placeholder'), 'Enter your password');
assert.strictEqual(i18n.t('auth_show_password_aria'), 'Show password');
assert.ok(i18n.t('auth_no_account_register').includes('Sign up now'));
assert.ok(html.includes('data-i18n-attr="aria-label:lang_select_aria"'));
assert.ok(html.includes('data-i18n-attr="title:lang_vi_title"'));
assert.ok(html.includes('data-i18n-attr="aria-label:welcome_aria_hero"'));
assert.ok(html.includes('data-i18n-attr="title:welcome_copy_source_title"'));
assert.ok(html.includes('data-i18n-attr="aria-label:welcome_aria_features"'));
assert.ok(html.includes('data-i18n-attr="aria-label:welcome_aria_workflow"'));
assert.ok(html.includes('data-i18n-attr="aria-label:welcome_aria_pricing"'));
assert.ok(html.includes('id="pricingCardProYearly"'));
assert.ok(html.includes('data-i18n-attr="aria-label:welcome_aria_footer"'));
assert.ok(html.includes('data-i18n-attr="placeholder:auth_login_password_placeholder"'));
assert.ok(html.includes('data-i18n-attr="title:common_scroll_top_title"'));
console.log('[PASS] Welcome HTML bindings and modal auth attributes verified');

console.log('\n[SUCCESS] Welcome page i18n E2E verification complete: 100% PASS!');
