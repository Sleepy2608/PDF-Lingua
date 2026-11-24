# Graph Report - PDF-Lingua  (2026-11-23)

## Corpus Check
- 230 files · ~399,243 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .css 7, (none) 3, .example 2)

## Summary
- 4063 nodes · 9412 edges · 244 communities (90 shown, 154 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 1356 edges (avg confidence: 0.91)
- Token cost: 12,500 input · 4,200 output

## Community Hubs (Navigation)
- Test Suite: Document Access Control
- Test Suite: Permissions
- Services Subscription Service
- Frontend Auth & Profile Controller
- Test Suite: Avatar Schema
- Processing History & Audit Records
- Authentication & User Management
- Processing History & Audit Records
- Frontend Pricing & Billing UI
- Processing History & Audit Records
- Sidebar & Document Navigation
- Translation & Chunking Pipeline
- AI Copilot & Document QA
- Async Job & PDF Ingestion
- OCR & Image Preprocessing Engine
- Authentication & User Management
- Test Suite: Files Lost And
- PDF Parsing & Layout Analysis
- Processing History & Audit Records
- Async Job & PDF Ingestion
- Dual-Pane Translation Workspace
- Test Suite: Avatar Api
- Services Storage Service
- Test Suite: Frontend Avatar Lifecycle
- Processing History & Audit Records
- Test Suite: Frontend Avatar Sync
- Test Suite: Frontend Quota Dashboard
- Test Suite: Frontend Avatar Upload
- Test Suite: Frontend Background Jobs
- Test Suite: Exceptions Logging
- Database Migration (Env)
- Test Suite: Services
- Tests Conftest
- Test Suite: Background Jobs Api
- Test Suite: Frontend Avatar Crop
- Test Suite: Security
- PDF Parsing & Layout Analysis
- Test Suite: Avatar Storage
- Test Suite: Docx Export
- Processing History & Audit Records
- Workflows Ci
- Test Suite: Size Page Limits
- Async Job & PDF Ingestion
- Test Suite: Frontend Role Limits
- Core Text Metrics
- Test Suite: Frontend Avatar Modal
- Processing History & Audit Records
- Test Suite: Ai Summary Quality
- Sidebar & Document Navigation
- PDF Parsing & Layout Analysis
- Test Suite: Frontend Login
- Test Suite: Page Selection
- Test Suite: Frontend Validation
- PDF Parsing & Layout Analysis
- Frontend Pricing & Billing UI
- Services Admin Service
- Test Suite: Frontend Ai Summary
- Test Suite: Generate Dataset
- Test Suite: Frontend Admin Service
- Test Suite: Memory Optimization
- Js Ai Copilot
- Js Batch Processor
- Test Suite: Avatar Serving
- Translation & Chunking Pipeline
- Test Suite: Frontend Ai Copilot
- Test Suite: Frontend Export
- Async Job & PDF Ingestion
- Js Admin
- Core Layout Metrics
- Test Suite: Deskew
- Test Suite: Batch Zip
- PDF Parsing & Layout Analysis
- Processing History & Audit Records
- Tests Benchmark Runner
- Test Suite: Upload Security
- Js Upload
- Database Migration (Create Processing Hi)
- Test Suite: Frontend Export
- Test Suite: Frontend Quota Dashboard
- Translation & Chunking Pipeline
- Js App
- Test Suite: Frontend Batch Processor
- Test Suite: Ai Citations
- Test Suite: Progress Tracking
- Js Ai Summary
- Test Suite: Frontend Batch Queue
- Test Suite: Frontend Page Selection
- Test Suite: Ai Citations
- Test Suite: Layout Metrics
- Tests Conftest
- Js Welcome
- PDF Parsing & Layout Analysis
- Test Suite: Frontend Split View
- Tests Verify I18N Parity
- Core Exceptions
- Test Suite: Ai Chat Api
- Test Suite: Ai Chat Api
- Test Suite: Ai Chat Api
- Test Suite: Dataset Preparation
- Api Documents
- Test Suite: Ai Chat Api
- Test Suite: Ai Chat Api
- Test Suite: Ai Chat Api
- Core Database
- Core Exceptions
- Test Suite: Ai Api
- Test Suite: Ai Api
- Test Suite: Ai Copilot Quality
- PDF Parsing & Layout Analysis
- AI Copilot & Document QA
- Tests Measure Memory Before After
- Test Suite: Ai Api
- Test Suite: Ai Api
- Test Suite: Ai Citations
- Test Suite: Ai Citations
- Test Suite: Ai Citations
- Async Job & PDF Ingestion
- Authentication & User Management
- Processing History & Audit Records
- Processing History & Audit Records
- Test Suite: Permissions
- Test Suite: Ai Api
- Documentation: Readme
- Test Suite: Avatar Api
- Test Suite: Avatar Lifecycle Integration
- Test Suite: Avatar Serving
- Test Suite: Document Model
- Processing History & Audit Records
- Processing History & Audit Records
- Test Suite: Basic
- Documentation: Test Plan And Results
- Test Suite: Ai Api
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Authentication & User Management
- Test Suite: Document Access Control
- Test Suite: E2E Pipeline
- Lược Đồ Usecase Luoc Do
- Core Database
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Management
- Test Suite: Admin Service Usage
- Test Suite: Admin Service Usage
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Async Job & PDF Ingestion
- Test Suite: Document Access Control
- Test Suite: Document Access Control
- Test Suite: Document Access Control
- Test Suite: Document Access Control
- Test Suite: Document Access Control
- Test Suite: Document Access Control
- Test Suite: Document Access Control
- Test Suite: Document Access Control
- Test Suite: Document Access Control
- Test Suite: Document Access Control
- Test Suite: E2E Security Bypass
- Test Suite: Pricing Api
- Test Suite: Pricing Api
- Test Suite: Pricing Api
- Test Suite: Pricing Api
- Test Suite: Pricing Api
- Test Suite: Pricing Api
- Test Suite: Pricing Api
- Test Suite: Pricing Api
- Test Suite: Pricing Subscription
- Processing History & Audit Records
- Test Suite: Security Matrix
- Kiến Trúc Hệ Thống Kien
- Lược Đồ Lớp Luoc Do

## God Nodes (most connected - your core abstractions)
1. `User` - 186 edges
2. `UserRole` - 184 edges
3. `StorageService` - 87 edges
4. `ActionType` - 83 edges
5. `ProcessingStatus` - 80 edges
6. `HistoryService` - 74 edges
7. `Document` - 69 edges
8. `PDFService` - 64 edges
9. `NotFoundException` - 62 edges
10. `AuthUserFixture` - 61 edges

## Surprising Connections (you probably didn't know these)
- `test_job_manager_progress_with_selected_pages()` --uses--> `JobStatus`  [INFERRED]
  Code/backend/tests/test_page_selection.py → Code/backend/app/services/job_service.py
- `_ensure_prerequisite_tables()` --uses--> `Base`  [INFERRED]
  Code/backend/alembic/versions/create_processing_histories_table.py → Code/backend/app/core/database.py
- `get_system_stats()` --uses--> `User`  [INFERRED]
  Code/backend/app/api/admin.py → Code/backend/app/models/user.py
- `get_system_stats()` --uses--> `UserRole`  [INFERRED]
  Code/backend/app/api/admin.py → Code/backend/app/models/user.py
- `list_users()` --uses--> `User`  [INFERRED]
  Code/backend/app/api/admin.py → Code/backend/app/models/user.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **End-to-End PDF Translation & OCR Pipeline** — docs_ai_design_pdf_processing_and_ai_pipeline_hybrid_fast_path, docs_ai_design_pdf_processing_and_ai_pipeline_smart_layout_engine, docs_ai_design_pdf_processing_and_ai_pipeline_smart_chunking, docs_ai_design_pdf_processing_and_ai_pipeline_translation_orchestrator [EXTRACTED 1.00]
- **VietQR Payment & Subscription Lifecycle** — docs_pricing_plans_pricing_plans_pro_tier_monthly, docs_pricing_plans_pricing_plans_quota_reset_rules, docs_workflows_business_workflows_workflow_subscription [EXTRACTED 1.00]
- **Academic Document Copilot Assistant** — docs_ai_design_pdf_processing_and_ai_pipeline_ai_copilot_assistant, docs_workflows_business_workflows_workflow_copilot_qa, docs_software_requirement_specification_srs_specification_fr_ai_copilot [EXTRACTED 1.00]

## Communities (244 total, 154 thin omitted)

### Community 0 - "Test Suite: Document Access Control"
Cohesion: 0.03
Nodes (44): downgrade(), upgrade(), downgrade(), upgrade(), update_user_role(), Base, get_current_user(), get_db() (+36 more)

### Community 1 - "Test Suite: Permissions"
Cohesion: 0.02
Nodes (72): list_user_documents(), get_user_limits(), require_roles(), role_checker(), User, UserRole, test_download_roles_free_pro_admin_all_succeed(), test_login_payload_tampering_ignored() (+64 more)

### Community 2 - "Services Subscription Service"
Cohesion: 0.05
Nodes (28): cancel_my_subscription(), check_transaction_status(), get_billing_invoice(), get_my_billing_history(), get_my_subscription(), get_pricing_plans(), payment_webhook(), simulate_transaction_payment() (+20 more)

### Community 3 - "Frontend Auth & Profile Controller"
Cohesion: 0.07
Nodes (92): applyAvatarPreview(), authFetch(), clearAccountAlert(), clearAlert(), clearAlertInElement(), clearAllFieldErrors(), clearChangePasswordAlert(), clearCropAlert() (+84 more)

### Community 4 - "Test Suite: Avatar Schema"
Cohesion: 0.04
Nodes (33): change_password(), get_me(), login(), logout(), register(), update_me(), init_db(), _migrate_db_schema() (+25 more)

### Community 5 - "Processing History & Audit Records"
Cohesion: 0.05
Nodes (36): BillingCycle, PaymentMethod, PaymentStatus, PaymentTransaction, PricingPlan, seed_pricing_plans(), Subscription, SubscriptionStatus (+28 more)

### Community 6 - "Authentication & User Management"
Cohesion: 0.03
Nodes (37): test_change_password_incorrect_current_password(), test_change_password_invalid_new_password_strength(), test_change_password_same_as_old(), test_change_password_success(), test_get_me_inactive_account(), test_get_me_invalid_auth_scheme(), test_get_me_invalid_or_malformed_token(), test_get_me_missing_token() (+29 more)

### Community 7 - "Processing History & Audit Records"
Cohesion: 0.10
Nodes (38): ForbiddenException, ActionType, ProcessingStatus, ProcessingHistoryCreate, HistoryService, test_list_user_histories_document_ownership_and_not_found(), test_api_delete_history_endpoint(), test_cleanup_expired_histories_forbidden_other_user() (+30 more)

### Community 8 - "Frontend Pricing & Billing UI"
Cohesion: 0.09
Nodes (72): applyQuotaThresholdStyles(), bindGlobalSyncEvents(), buildFallbackCheckoutData(), calculateQuotaPercent(), closeCheckoutModal(), closeInvoiceModal(), closePricingView(), closeQuotaExceededModal() (+64 more)

### Community 9 - "Processing History & Audit Records"
Cohesion: 0.07
Nodes (27): cleanup_expired_histories(), delete_history_record(), get_history_detail(), get_history_result(), list_user_histories(), AppException, BadRequestException, ApiResponse (+19 more)

### Community 10 - "Sidebar & Document Navigation"
Cohesion: 0.10
Nodes (66): closeDocumentDeleteConfirmModal(), closeDocumentDetailModal(), closeDocumentsView(), closeHistoryDeleteConfirmModal(), closeHistoryView(), closeMobileSidebar(), confirmDocumentDelete(), confirmHistoryDelete() (+58 more)

### Community 11 - "Translation & Chunking Pipeline"
Cohesion: 0.06
Nodes (31): TranslationService, test_e2e_long_document_chunking_and_order(), test_translation_service_chunking(), test_translation_service_chunking_with_spaced_newlines(), test_translation_service_empty_text(), test_translation_service_is_isolated_char_list(), test_pdfl_120_all_tiers_fail_graceful_fallback_raw(), test_pdfl_120_empty_chunk_handled_without_network() (+23 more)

### Community 12 - "AI Copilot & Document QA"
Cohesion: 0.06
Nodes (8): AIService, summarize_chunk(), TestAIServiceInitialization, TestAIServiceSummarizeExecution, TestOfflineMockSummary, TestPromptConstruction, TestTextChunking, TestAISummarizeQualityAcrossDocumentTypes

### Community 13 - "Async Job & PDF Ingestion"
Cohesion: 0.06
Nodes (17): cancel_processing_job(), create_processing_job(), _execute_pdf_background_job(), on_progress(), get_download_current_user(), get_job_status(), JobCancelledException, process_compatibility_endpoint() (+9 more)

### Community 14 - "OCR & Image Preprocessing Engine"
Cohesion: 0.06
Nodes (6): OCRService, run_benchmark(), TestBlankPageDetection, TestOCRIntegrationPipeline, TestOrientationCorrection, test_ocr_service_availability()

### Community 15 - "Authentication & User Management"
Cohesion: 0.03
Nodes (18): create_access_token(), admin_test_env(), usage_test_env(), ai_test_env(), ai_chat_env(), api_test_env(), test_download_expired_token_returns_401(), test_change_password_unauthenticated_and_tokens() (+10 more)

### Community 16 - "Test Suite: Files Lost And"
Cohesion: 0.05
Nodes (28): create_password_protected_pdf_bytes(), IdorOwnershipTestCase, PageLimitTestCase, PathTraversalTestCase, SizeLimitTestCase, UploadValidationTestCase, test_download_compatibility_multipage_and_special_chars(), test_download_compatibility_pdf_pypdf_parsing() (+20 more)

### Community 17 - "PDF Parsing & Layout Analysis"
Cohesion: 0.08
Nodes (16): PDFService, measure_comparison(), TestHybridFastPath, test_document_classification_with_selected_pages(), test_selective_extraction_extract_hybrid_text_wrapper(), test_selective_extraction_extract_pages_preserves_page_numbers(), test_selective_extraction_extract_text_content_filtering(), test_selective_extraction_hybrid_fast_path_preserves_page_numbers() (+8 more)

### Community 18 - "Processing History & Audit Records"
Cohesion: 0.06
Nodes (15): NotFoundException, ErrorResponse, HistoryCleanupResponse, HistoryDeleteResponse, ProcessingResultResponse, _run_async(), test_api_cleanup_endpoint(), test_api_routes_registered() (+7 more)

### Community 19 - "Async Job & PDF Ingestion"
Cohesion: 0.08
Nodes (3): Job, JobManager, TestJobService

### Community 20 - "Dual-Pane Translation Workspace"
Cohesion: 0.14
Nodes (47): cancelActiveJob(), checkIsOtherViewActive(), cleanupProgressTracking(), clearActiveJobFromStorage(), closeBgWidget(), completedJobIds, copyText(), fetchDocumentPreview() (+39 more)

### Community 21 - "Test Suite: Avatar Api"
Cohesion: 0.06
Nodes (23): delete_avatar(), upload_avatar(), hash_password(), create_image_upload(), test_delete_avatar_physical_file_failure_logged(), test_delete_avatar_success(), test_delete_avatar_when_none_exists_raises_400(), test_get_me_accurately_reflects_avatar_lifecycle() (+15 more)

### Community 22 - "Services Storage Service"
Cohesion: 0.07
Nodes (12): StorageService, access_control_env(), test_cross_tenant_document_and_history_isolation_e2e(), test_path_traversal_attempts_in_file_access_blocked(), test_matrix_idor_and_document_ownership(), test_matrix_path_traversal_protection(), isolated_db_and_storage(), test_pdfl_214_2_path_traversal_read_write_delete_isolation() (+4 more)

### Community 23 - "Test Suite: Frontend Avatar Lifecycle"
Cohesion: 0.05
Nodes (15): assert, authSource, ClassList, createIntegrationEnv(), Element, fs, MockCanvas, MockCanvasContext (+7 more)

### Community 24 - "Processing History & Audit Records"
Cohesion: 0.06
Nodes (8): ProcessingHistory, test_admin_stats_api_returns_services_breakdown(), TestAIChatDailyQuota, test_pdfl_214_3_admin_can_access_and_delete_user_history(), test_pdfl_214_3_cleanup_anti_idor(), test_pdfl_214_3_cross_tenant_history_detail_and_result_anti_idor(), test_cleanup_expired_histories_default_retention_days(), test_cleanup_expired_histories_retention_and_isolation()

### Community 25 - "Test Suite: Frontend Avatar Sync"
Cohesion: 0.05
Nodes (15): assert, ClassList, createSyncEnv(), Element, fs, MockCanvas, MockCanvasContext, MockFormData (+7 more)

### Community 26 - "Test Suite: Frontend Quota Dashboard"
Cohesion: 0.06
Nodes (34): aiCopilotSource, assert, fs, htmlSource, path, vm, workspaceSource, assert (+26 more)

### Community 27 - "Test Suite: Frontend Avatar Upload"
Cohesion: 0.05
Nodes (14): assert, ClassList, createEnv(), Element, fs, MockCanvas, MockCanvasContext, MockFormData (+6 more)

### Community 28 - "Test Suite: Frontend Background Jobs"
Cohesion: 0.06
Nodes (14): assert, authSource, ClassList, createTestEnvironment(), Element, fs, MockEventSource, MockStorage (+6 more)

### Community 29 - "Test Suite: Exceptions Logging"
Cohesion: 0.06
Nodes (18): ChatRequest, ChatResponseData, ChatTurn, SummarizeRequest, SummarizeResponseData, DocumentResponse, SamplePayload, test_bad_request_exception_handling() (+10 more)

### Community 30 - "Database Migration (Env)"
Cohesion: 0.11
Nodes (6): run_migrations_offline(), run_migrations_online(), _resolve_database_url(), Settings, test_health_check_endpoint(), test_root_endpoint()

### Community 31 - "Test Suite: Services"
Cohesion: 0.12
Nodes (25): ExportService, test_e2e_export_txt_and_pdf(), test_export_pdf_all_4_export_types_sections_and_content(), test_export_pdf_multipage_pagination_and_special_characters(), test_export_pdf_structural_validity_and_pypdf_reader(), test_export_pdf_vietnamese_unicode_text_extraction(), test_export_service_pdf(), test_export_service_pdf_4_types() (+17 more)

### Community 32 - "Tests Conftest"
Cohesion: 0.05
Nodes (19): corrupted_pdf(), db_session(), empty_pdf(), fake_pdf_exe(), fake_pdf_txt(), guest_user(), password_pdf(), pdf_factory() (+11 more)

### Community 33 - "Test Suite: Background Jobs Api"
Cohesion: 0.06
Nodes (7): execute_pdf_job_sync(), MockUploadFile, run_coro(), run_coro_drive(), TestBackgroundJobsAPI, run_worker(), run_worker()

### Community 34 - "Test Suite: Frontend Avatar Crop"
Cohesion: 0.06
Nodes (13): assert, ClassList, createCropEnv(), Element, fs, MockCanvas, MockCanvasContext, MockLocalStorage (+5 more)

### Community 35 - "Test Suite: Security"
Cohesion: 0.07
Nodes (18): decode_access_token(), verify_password(), test_register_long_password_consistent_bcrypt(), test_register_success(), test_register_unicode_vietnamese_password(), test_create_access_token_with_custom_claims_and_delta(), test_create_and_decode_access_token_success(), test_decode_access_token_expired() (+10 more)

### Community 36 - "PDF Parsing & Layout Analysis"
Cohesion: 0.12
Nodes (17): preview_document_file(), create_custom_page_pdf_bytes(), _create_db_document(), test_http_endpoint_inline_stream_admin_200(), test_http_endpoint_inline_stream_compat_route_200(), test_http_endpoint_inline_stream_cross_tenant_idor_403(), test_http_endpoint_inline_stream_nonexistent_404(), test_http_endpoint_inline_stream_owner_200() (+9 more)

### Community 37 - "Test Suite: Avatar Storage"
Cohesion: 0.10
Nodes (13): create_test_image_bytes(), test_atomic_write_cleans_up_on_failure(), test_cleanup_old_avatars(), test_cross_tenant_avatar_access_isolation(), test_detect_image_format_exact_magic_bytes(), test_invalid_user_id_rejected(), test_path_traversal_attempts_blocked(), test_reject_disallowed_formats() (+5 more)

### Community 38 - "Test Suite: Docx Export"
Cohesion: 0.09
Nodes (17): get_optional_current_user(), make_mock_user(), test_download_api_invalid_format_returns_422(), test_download_docx_admin_user_success(), test_download_docx_bilingual_pro_success(), test_download_docx_empty_content_returns_400(), test_download_docx_free_user_forbidden_403(), test_download_docx_guest_user_forbidden_403() (+9 more)

### Community 39 - "Processing History & Audit Records"
Cohesion: 0.07
Nodes (14): assert, ClassList, createBillingApiTestEnv(), mockWindow, reg(), fs, htmlSource, MockElement (+6 more)

### Community 40 - "Workflows Ci"
Cohesion: 0.06
Nodes (36): defaults, name, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group (+28 more)

### Community 41 - "Test Suite: Size Page Limits"
Cohesion: 0.06
Nodes (16): AuthUserFixture, test_client_supplied_role_and_user_id_tampering_is_ignored(), test_endpoint_consistency_between_sync_and_async_jobs(), test_free_and_pro_users_cannot_access_admin_endpoints(), test_matrix_auth_and_role_spoofing(), test_matrix_role_and_page_limits_async_job_endpoint(), test_matrix_role_and_page_limits_policy(), test_matrix_role_and_page_limits_sync_endpoint() (+8 more)

### Community 42 - "Async Job & PDF Ingestion"
Cohesion: 0.09
Nodes (14): batch_download_results(), download_result(), BatchDownloadRequest, DownloadRequest, ExportFormat, ExportTargetType, FeedbackRequest, JobProgressData (+6 more)

### Community 43 - "Test Suite: Frontend Role Limits"
Cohesion: 0.07
Nodes (11): assert, authSource, ClassList, createTestEnvironment(), Element, fs, MockLocalStorage, path (+3 more)

### Community 44 - "Core Text Metrics"
Cohesion: 0.12
Nodes (8): calculate_cer(), calculate_text_similarity(), calculate_wer(), evaluate_text(), EvaluationResult, levenshtein_distance(), normalize_text(), TestTextEvaluationMetrics

### Community 45 - "Test Suite: Frontend Avatar Modal"
Cohesion: 0.08
Nodes (11): assert, ClassList, createEnv(), Element, fs, MockLocalStorage, path, runSuite() (+3 more)

### Community 46 - "Processing History & Audit Records"
Cohesion: 0.08
Nodes (12): assert, ClassList, createTestEnvironment(), fs, htmlSource, main(), MockElement, path (+4 more)

### Community 47 - "Test Suite: Ai Summary Quality"
Cohesion: 0.08
Nodes (3): setup_logger(), __getattr__(), sample_documents()

### Community 48 - "Sidebar & Document Navigation"
Cohesion: 0.09
Nodes (12): assert, ClassList, createTestEnvironment(), fs, htmlSource, main(), MockElement, path (+4 more)

### Community 49 - "PDF Parsing & Layout Analysis"
Cohesion: 0.08
Nodes (23): AI Copilot QA & Summarizer Pipeline, Hybrid Fast Path Page Classifier, Smart Sentence & Script Chunking, Smart Reading Flow Layout Engine, Multi-engine Translation Orchestrator, Free Tier Plan Limits, Pro VIP Annual Subscription Plan, Pro VIP Monthly Subscription Plan (+15 more)

### Community 50 - "Test Suite: Frontend Login"
Cohesion: 0.08
Nodes (9): assert, ClassList, createEnv(), Element, fs, MockLocalStorage, path, source (+1 more)

### Community 51 - "Test Suite: Page Selection"
Cohesion: 0.12
Nodes (23): parse_page_selection(), create_multi_page_pdf(), test_api_process_compat_endpoint_success(), test_api_process_invalid_pages_format_returns_400(), test_api_process_jobs_endpoint_with_pages_validation(), test_api_process_pages_out_of_bounds_returns_400(), test_api_process_reverse_range_returns_400(), test_api_process_valid_selected_pages_success() (+15 more)

### Community 52 - "Test Suite: Frontend Validation"
Cohesion: 0.08
Nodes (11): assert, createFreshEnvironment(), fs, htmlContent, htmlPath, jsContent, jsPath, MockClassList (+3 more)

### Community 54 - "Frontend Pricing & Billing UI"
Cohesion: 0.09
Nodes (12): assert, ClassList, createPricingTestEnv(), fs, htmlSource, main(), MockElement, path (+4 more)

### Community 55 - "Services Admin Service"
Cohesion: 0.11
Nodes (8): get_system_stats(), list_users(), update_user_status(), AdminServiceUsageStats, AdminService, test_service_usage_aggregates_successful_actions_correctly(), test_service_usage_empty_database_returns_zeroes(), test_service_usage_strictly_excludes_failed_and_pending_records()

### Community 56 - "Test Suite: Frontend Ai Summary"
Cohesion: 0.09
Nodes (10): aiSummarySource, assert, ClassList, createTestEnvironment(), fs, htmlSource, MockElement, path (+2 more)

### Community 57 - "Test Suite: Generate Dataset"
Cohesion: 0.16
Nodes (12): generate_mixed_pdf(), build_dataset(), create_directories(), generate_complex_pdf(), generate_multi_column_digital(), generate_scanned_high_quality(), generate_scanned_low_blurry_noisy(), generate_scanned_medium_skewed() (+4 more)

### Community 58 - "Test Suite: Frontend Admin Service"
Cohesion: 0.10
Nodes (10): adminJsSource, assert, ClassList, componentsCssSource, createAdminTestEnv(), fs, htmlSource, MockElement (+2 more)

### Community 60 - "Js Ai Copilot"
Cohesion: 0.23
Nodes (22): appendAssistantMessage(), appendErrorMessage(), appendUserMessage(), clearChatHistory(), closeCopilotDrawer(), escapeHtml(), formatCurrentTime(), getAuthToken() (+14 more)

### Community 62 - "Test Suite: Avatar Serving"
Cohesion: 0.11
Nodes (10): get_user_avatar(), create_image_bytes(), test_serve_avatar_blocks_hidden_and_tmp_and_env_files(), test_serve_avatar_cannot_access_files_outside_user_directory(), test_serve_avatar_invalid_user_id_raises_404(), test_serve_avatar_non_existent_file_raises_404(), test_serve_avatar_path_traversal_attempts_blocked(), test_serve_avatar_security_and_caching_headers() (+2 more)

### Community 63 - "Translation & Chunking Pipeline"
Cohesion: 0.15
Nodes (7): calculate_bleu_score(), calculate_semantic_similarity(), calculate_translation_similarity(), evaluate_translation(), _get_ngrams(), _tokenize(), TranslationEvaluationResult

### Community 64 - "Test Suite: Frontend Ai Copilot"
Cohesion: 0.12
Nodes (4): ClassList, createMockEnvironment(), getOrCreate(), MockElement

### Community 66 - "Async Job & PDF Ingestion"
Cohesion: 0.10
Nodes (4): create_multipage_pdf_bytes(), create_test_pdf_bytes(), test_upload_and_translate_success(), test_upload_exceeds_max_pages()

### Community 67 - "Js Admin"
Cohesion: 0.26
Nodes (20): closeAdminView(), closeConfirmModal(), escapeHtml(), executeRoleUpdate(), executeStatusUpdate(), fetchAdminStats(), fetchAdminUsers(), formatBytes() (+12 more)

### Community 68 - "Core Layout Metrics"
Cohesion: 0.18
Nodes (7): calculate_column_order_score(), calculate_paragraph_structure_score(), calculate_reading_order_score(), calculate_table_structure_score(), evaluate_layout(), LayoutEvaluationResult, _split_paragraphs()

### Community 70 - "Test Suite: Batch Zip"
Cohesion: 0.16
Nodes (8): test_batch_download_admin_can_download_any_job(), test_batch_download_anti_idor_forbidden(), test_batch_download_duplicate_ids_returns_400(), test_batch_download_empty_payload_returns_400(), test_batch_download_incomplete_job_returns_400(), test_batch_download_nonexistent_job_returns_404(), test_batch_download_success_and_deduplication(), test_batch_download_unauthenticated_returns_401()

### Community 71 - "PDF Parsing & Layout Analysis"
Cohesion: 0.35
Nodes (18): cleanupPdfPreview(), clearPreviewError(), getEl(), getURL(), goToPage(), handleViewportResize(), initPdfPreviewListeners(), loadPdfPreview() (+10 more)

### Community 72 - "Processing History & Audit Records"
Cohesion: 0.16
Nodes (4): ProcessingHistoryBase, ProcessingHistoryUpdate, sanitize_error_message(), test_schema_sanitizes_error_message()

### Community 73 - "Tests Benchmark Runner"
Cohesion: 0.18
Nodes (3): BenchmarkRunner, DocumentBenchmarkReport, TestBenchmarkExecution

### Community 74 - "Test Suite: Upload Security"
Cohesion: 0.16
Nodes (8): make_valid_pdf_bytes(), test_download_export_filename_path_traversal_sanitized(), test_unit_validate_raw_pdf_content(), test_upload_rejects_double_extensions(), test_upload_rejects_invalid_content_type(), test_upload_rejects_non_pdf_extensions(), test_upload_rejects_null_byte_and_invalid_filenames(), test_upload_valid_pdf_sync_and_async()

### Community 75 - "Js Upload"
Cohesion: 0.23
Nodes (15): addFilesToBatchQueue(), batchQueue, clearBatchQueue(), escapeHtml(), formatFileSize(), getCurrentUserLimits(), initDropzone(), handleFile() (+7 more)

### Community 76 - "Database Migration (Create Processing Hi)"
Cohesion: 0.23
Nodes (7): _cleanup_migration_ownership(), downgrade(), _ensure_prerequisite_tables(), _get_migration_ownership(), _record_migration_ownership(), upgrade(), _verify_and_reconcile_existing_table()

### Community 77 - "Test Suite: Frontend Export"
Cohesion: 0.13
Nodes (8): assert, createEnvironment(), fs, htmlSource, MockStorage, path, vm, workspaceSource

### Community 80 - "Js App"
Cohesion: 0.21
Nodes (13): initLegalModal(), openModal(), switchTab(), initModalScrollLock(), applyLock(), findScrollableTarget(), handleKeyDown(), handleTouchMove() (+5 more)

### Community 81 - "Test Suite: Frontend Batch Processor"
Cohesion: 0.13
Nodes (11): assert, batchProcessorJsCode, createTestEnvironment(), fs, htmlContent, htmlPath, layoutCssCode, path (+3 more)

### Community 84 - "Js Ai Summary"
Cohesion: 0.34
Nodes (13): closeAiProModal(), escapeHtml(), formatStyleLabel(), getAuthToken(), getStoredUser(), handleCopySummary(), handleExecuteAiSummary(), handleToggleAiSummaryCard() (+5 more)

### Community 85 - "Test Suite: Frontend Batch Queue"
Cohesion: 0.14
Nodes (10): assert, createUploadHarness(), fs, htmlContent, htmlPath, layoutCssCode, path, uploadJsCode (+2 more)

### Community 86 - "Test Suite: Frontend Page Selection"
Cohesion: 0.14
Nodes (10): assert, createTestHarness(), fs, htmlContent, htmlPath, layoutCssCode, path, uploadJsCode (+2 more)

### Community 87 - "Test Suite: Ai Citations"
Cohesion: 0.15
Nodes (3): TestAIAntiHallucinationFakeEntities, TestAIAntiHallucinationOutOfDomain, TestAIAntiPromptInjection

### Community 90 - "Tests Conftest"
Cohesion: 0.21
Nodes (5): admin_user(), free_user(), pro_user(), tenant_users(), create_test_user_with_role()

### Community 91 - "Js Welcome"
Cohesion: 0.29
Nodes (11): initWelcomeController(), initWelcomeModalScrollLock(), applyLock(), findScrollableTarget(), handleKeyDown(), handleTouchMove(), handleWheel(), hasAnyOpenModal() (+3 more)

### Community 92 - "PDF Parsing & Layout Analysis"
Cohesion: 0.20
Nodes (9): assert, createMockDOM(), createMockPdfDocument(), fs, htmlContent, htmlPath, path, pdfPreviewJsCode (+1 more)

### Community 93 - "Test Suite: Frontend Split View"
Cohesion: 0.17
Nodes (9): assert, fs, htmlContent, htmlPath, path, setupMockDOM(), makeEl(), workspaceCssCode (+1 more)

### Community 94 - "Tests Verify I18N Parity"
Cohesion: 0.17
Nodes (10): content, enKeys, enMatch, enSet, fs, missingInEn, missingInVi, viKeys (+2 more)

### Community 101 - "Api Documents"
Cohesion: 0.25
Nodes (3): delete_document(), download_document_file(), get_document_details()

### Community 105 - "Core Database"
Cohesion: 0.29
Nodes (4): check_db_connection(), health_check(), root(), test_database_connection()

### Community 110 - "PDF Parsing & Layout Analysis"
Cohesion: 0.29
Nodes (6): Epic Ai Assistant, Epic Auth Billing, Epic Ocr Processing, Epic Pdf Engine, Epic Qa Testing, Epic Translation

### Community 118 - "Async Job & PDF Ingestion"
Cohesion: 0.33
Nodes (5): test_download_bilingual_empty_original_content(), test_download_bilingual_empty_translated_content(), test_download_empty_content_original(), test_download_empty_content_summary(), test_download_empty_content_translated()

### Community 124 - "Documentation: Readme"
Cohesion: 0.40
Nodes (3): Free Tier Plan Limits, Pro VIP Annual Subscription Plan, Pro VIP Monthly Subscription Plan

### Community 132 - "Documentation: Test Plan And Results"
Cohesion: 0.50
Nodes (3): Backend Pytest Integration Suite, Frontend Vanilla JS Unit Test Suite, OCR CER/WER Accuracy Benchmark

## Knowledge Gaps
- **26 isolated node(s):** `Epic Pdf Engine`, `Epic Ocr Processing`, `Epic Translation`, `Epic Ai Assistant`, `Epic Auth Billing` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1850 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **154 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `UserRole` connect `Test Suite: Permissions` to `Test Suite: Document Access Control`, `Services Subscription Service`, `Test Suite: Avatar Schema`, `Processing History & Audit Records`, `Authentication & User Management`, `Processing History & Audit Records`, `Processing History & Audit Records`, `Async Job & PDF Ingestion`, `Authentication & User Management`, `Test Suite: Files Lost And`, `Processing History & Audit Records`, `Test Suite: Avatar Api`, `Services Storage Service`, `PDF Parsing & Layout Analysis`, `Test Suite: Docx Export`, `Test Suite: Size Page Limits`, `Async Job & PDF Ingestion`, `Test Suite: Page Selection`, `Services Admin Service`, `Async Job & PDF Ingestion`, `Test Suite: Batch Zip`, `Tests Conftest`, `Api Documents`, `AI Copilot & Document QA`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Are the 69 inferred relationships involving `User` (e.g. with `get_system_stats()` and `list_users()`) actually correct?**
  _`User` has 69 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Epic Pdf Engine`, `Epic Ocr Processing`, `Epic Translation` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Test Suite: Document Access Control` be split into smaller, more focused modules?**
  _Cohesion score 0.03488543976348855 - nodes in this community are weakly interconnected._
- **Why does `User` connect `Test Suite: Permissions` to `Test Suite: Document Access Control`, `Services Subscription Service`, `Test Suite: Avatar Schema`, `Models User`, `Authentication & User Management`, `Processing History & Audit Records`, `Processing History & Audit Records`, `Processing History & Audit Records`, `Async Job & PDF Ingestion`, `Authentication & User Management`, `Test Suite: Files Lost And`, `Processing History & Audit Records`, `Test Suite: Avatar Api`, `Services Storage Service`, `Test Suite: Security`, `PDF Parsing & Layout Analysis`, `Test Suite: Avatar Storage`, `Test Suite: Docx Export`, `Test Suite: Size Page Limits`, `Async Job & PDF Ingestion`, `Test Suite: Page Selection`, `Services Admin Service`, `Async Job & PDF Ingestion`, `Tests Conftest`, `Api Documents`, `AI Copilot & Document QA`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Are the 132 inferred relationships involving `UserRole` (e.g. with `get_system_stats()` and `list_users()`) actually correct?**
  _`UserRole` has 132 INFERRED edges - model-reasoned connections that need verification._
- **Should `Test Suite: Permissions` be split into smaller, more focused modules?**
  _Cohesion score 0.023563218390804597 - nodes in this community are weakly interconnected._