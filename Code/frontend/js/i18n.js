/**
 * PDF-Lingua Internationalization (i18n) Engine
 * Lightweight, zero-dependency client-side localization system.
 * Supports Vietnamese (vi) and English (en).
 */
(function (window) {
    'use strict';

    const STORAGE_KEY = 'pdf_lingua_lang';
    const DEFAULT_LANG = 'vi';
    const SUPPORTED_LANGS = ['vi', 'en'];

    // Comprehensive Dictionary for PDF-Lingua
    const dictionaries = {
        vi: {
            // Common Actions & Badges
            "common_app_name": "PDF-Lingua",
            "btn_translate": "Dịch văn bản",
            "btn_extract_text": "Trích xuất văn bản",
            "common_close": "Đóng",
            "common_cancel": "Hủy bỏ",
            "common_confirm": "Xác nhận",
            "common_save": "Lưu thay đổi",
            "common_copy": "Sao chép",
            "common_copied": "Đã sao chép",
            "common_download": "Tải về",
            "common_delete": "Xóa",
            "common_retry": "Thử lại",
            "common_loading": "Đang xử lý...",
            "common_success": "Thành công",
            "common_error": "Lỗi",
            "common_warning": "Cảnh báo",
            "common_free": "Miễn phí",
            "common_pro": "Gói Pro",
            "common_guest": "Khách vãng lai",
            "common_member": "Thành viên",
            "common_admin": "Quản trị viên",
            "common_pages": "trang",
            "common_characters": "ký tự",
            "common_words": "từ",
            "common_scroll_top": "Lên đầu trang",
            "common_understood_agree": "Tôi đã hiểu & Đồng ý",
            "common_print_save_pdf": "In hoặc lưu tệp PDF",
            "common_fullscreen": "Phóng to",
            "common_exit_fullscreen": "Thu nhỏ",

            // Navigation
            "nav_home": "Trang chủ",
            "nav_features": "Tính năng",
            "nav_how_it_works": "Quy trình",
            "nav_pricing": "Bảng giá",
            "nav_workspace": "Không gian làm việc",
            "nav_documents": "Tài liệu",
            "nav_history": "Lịch sử xử lý",
            "nav_login": "Đăng nhập",
            "nav_register": "Đăng ký",
            "nav_logout": "Đăng xuất",
            "nav_start_free": "Bắt đầu miễn phí",
            "nav_switch_lang": "Chọn ngôn ngữ",

            // Welcome Hero Section
            "welcome_hero_eyebrow": "Nền Tảng Dịch Thuật Học Thuật & Kỹ Thuật",
            "welcome_hero_title_1": "Dịch Thuật PDF Song Ngữ Thông Minh & Trợ Lý AI Chuyên Sâu",
            "welcome_hero_title_accent": "Bảo Toàn Bố Cục 100%",
            "welcome_hero_subtitle": "Bảo tồn nguyên vẹn cấu trúc bảng biểu, khử lệch dòng đa cột và tương tác hỏi đáp RAG trực tiếp trên ngữ cảnh tài liệu gốc.",
            "welcome_hero_cta_primary": "Bắt đầu miễn phí ngay",
            "welcome_hero_cta_secondary": "Xem bản dịch mẫu",
            "welcome_trust_no_install": "Không cần cài đặt",
            "welcome_trust_user_isolation": "Cô lập thư mục User ID riêng biệt",
            "welcome_trust_ocr_support": "Hỗ trợ PDF quét scan & OCR Tiếng Việt",
            "welcome_hero_badge_ocr": "OCR Tiếng Việt & Đa Ngữ",
            "welcome_hero_badge_layout": "Giữ nguyên format gốc",
            "welcome_hero_badge_privacy": "Bảo mật & Tự hủy file",

            // Welcome Preview Showcase
            "welcome_preview_title": "Bản xem trước trực tiếp",
            "welcome_preview_badge": "Không gian Studio",
            "welcome_preview_source_title": "Tài liệu gốc (PDF)",
            "welcome_preview_target_title": "Bản dịch song ngữ",
            "welcome_preview_tag_academic": "Báo cáo nghiên cứu khoa học",
            "welcome_preview_target_lang": "Tiếng Việt (vi)",
            "welcome_preview_mode_text": "Văn bản",
            "welcome_preview_mode_pdf": "PDF gốc",
            "welcome_preview_mode_split": "Song song",
            "welcome_preview_btn_retranslate": "Dịch lại",
            "welcome_preview_btn_download": "Tải xuống",

            // Welcome Features Section
            "welcome_features_eyebrow": "Tính Năng Vượt Trội",
            "welcome_features_title": "Được Thiết Kế Riêng Cho Nhu Cầu Học Thuật & Chuyên Nghiệp",
            "welcome_features_subtitle": "Giải quyết triệt để vấn đề mất định dạng bảng biểu, công thức toán học và lỗi dịch thô của các công cụ thông thường.",
            "feat_ocr_title": "OCR Nhận Diện Quang Học Chuẩn Xác",
            "feat_ocr_desc": "Bóc tách chữ từ tài liệu scan, hình ảnh mờ với độ chính xác trên 98%. Tự động nắn thẳng và khử nhiễu văn bản.",
            "feat_layout_title": "Bảo Toàn Bố Cục & Bảng Biểu",
            "feat_layout_desc": "Giữ nguyên cấu trúc cột, bảng biểu, chỉ số đầu mục và phông chữ nguyên bản khi xuất sang định dạng Word (.docx) hoặc PDF.",
            "feat_ai_title": "Trợ Lý AI & Tóm Tắt Tự Động",
            "feat_ai_desc": "Tóm tắt ý chính của bài báo hàng chục trang trong 5 giây. Hỏi đáp trực tiếp với trợ lý thông minh theo ngữ cảnh tài liệu.",
            "feat_security_title": "Bảo Mật & Phân Tách Cô Lập",
            "feat_security_desc": "Tài liệu được mã hóa trong suốt phiên làm việc. Cơ chế tự động dọn dẹp xóa sạch dữ liệu tạm sau khi hoàn tất.",

            // Welcome Workflow Steps
            "welcome_workflow_eyebrow": "Quy Trình 3 Bước",
            "welcome_workflow_title": "Dịch Thuật Nhanh Chóng Trong Vài Giây",
            "step_1_title": "1. Tải tài liệu PDF",
            "step_1_desc": "Kéo thả tài liệu PDF từ máy tính hoặc thiết bị của bạn. Hỗ trợ cả file số hóa và bản scan ảnh.",
            "step_2_title": "2. Chọn ngôn ngữ & Chế độ",
            "step_2_desc": "Lựa chọn ngôn ngữ đích, phạm vi trang cần dịch và kích hoạt nhận dạng OCR nếu cần.",
            "step_3_title": "3. Xem song song & Xuất tệp",
            "step_3_desc": "So sánh trực quan bản gốc và bản dịch theo từng đoạn văn. Xuất kết quả sang Word hoặc PDF song ngữ.",

            // Welcome Pricing Section
            "welcome_pricing_eyebrow": "Bảng Giá Minh Bạch",
            "welcome_pricing_title": "Bảng Giá Linh Hoạt Cho Mọi Nhu Cầu",
            "welcome_pricing_subtitle": "Khởi đầu miễn phí hoàn toàn hoặc nâng cấp gói Pro để mở khóa toàn bộ sức mạnh AI và xử lý hàng loạt.",
            "welcome_billing_monthly": "Hàng tháng",
            "welcome_billing_yearly": "Hàng năm",
            "welcome_billing_save": "Tiết kiệm 32%",
            "tier_guest_name": "Khách vãng lai",
            "tier_guest_desc": "Trải nghiệm nhanh không cần tạo tài khoản",
            "tier_guest_price": "0đ",
            "tier_guest_period": "dùng thử",
            "tier_guest_btn": "Trải nghiệm ngay",
            "tier_free_name": "Tài khoản Miễn phí",
            "tier_free_desc": "Phù hợp cho sinh viên và người dùng cá nhân cơ bản",
            "tier_free_price": "0đ",
            "tier_free_period": "mãi mãi",
            "tier_free_btn": "Đăng ký miễn phí",
            "tier_pro_name": "Gói Pro Chuyên Nghiệp",
            "tier_pro_desc": "Tối ưu cho nghiên cứu sinh, dịch giả và giảng viên",
            "tier_pro_price": "99.000đ",
            "tier_pro_period": "/ tháng",
            "tier_pro_btn": "Nâng cấp gói Pro",
            "tier_pro_badge": "Phổ biến nhất",

            // Welcome FAQ Section
            "welcome_faq_eyebrow": "Giải Đáp Thắc Mắc",
            "welcome_faq_title": "Câu Hỏi Thường Gặp",
            "faq_q1": "PDF-Lingua có hỗ trợ dịch các file PDF scan không có text không?",
            "faq_a1": "Có. Hệ thống tích hợp công nghệ OCR nâng cao giúp nhận diện ký tự quang học từ bản scan ảnh với độ chính xác cao.",
            "faq_q2": "Dữ liệu tài liệu của tôi có được bảo mật không?",
            "faq_a2": "Tuyệt đối an toàn. Tệp PDF chỉ được xử lý tạm thời trong phiên làm việc và hệ thống tự động xóa sạch dữ liệu theo chính sách bảo mật.",
            "faq_q3": "Khách chưa đăng nhập có thể dùng thử không?",
            "faq_a3": "Có. Khách vãng lai được trải nghiệm trực tiếp dịch tài liệu với hạn mức 20 MB/tệp và tối đa 100 trang.",

            // Welcome Footer
            "footer_desc": "Nền tảng dịch thuật tài liệu PDF chuyên sâu, bảo toàn cấu trúc và tích hợp trợ lý AI thông minh cho học thuật và công việc.",
            "welcome_footer_quick_nav": "Điều Hướng Nhanh",
            "welcome_footer_core_tech": "Công Nghệ Cốt Lõi",
            "welcome_footer_support_legal": "Hỗ Trợ & Pháp Lý",
            "welcome_footer_github": "Kho mã nguồn GitHub",
            "welcome_footer_copyright": "Bản quyền 2026 PDF-Lingua. Toàn bộ quyền được bảo lưu.",
            "footer_col_product": "Sản phẩm",
            "footer_col_resources": "Tài nguyên",
            "footer_col_legal": "Chính sách & Pháp lý",
            "footer_link_terms": "Điều khoản dịch vụ",
            "footer_link_privacy": "Chính sách bảo mật",
            "footer_link_contact": "Liên hệ hỗ trợ",
            "footer_copyright": "2026 PDF-Lingua. Dự án Đồ án Thực tế Công nghệ Phần mềm - Nhóm 19.",

            // Legal Modal Tabs
            "legal_modal_title": "Thông Tin & Chính Sách",
            "legal_modal_subtitle": "Quy định sử dụng, cam kết bảo mật & thông tin hỗ trợ PDF-Lingua",
            "legal_tab_terms": "Điều khoản",
            "legal_tab_privacy": "Bảo mật",
            "legal_tab_contact": "Liên hệ",
            "legal_badge_version": "v1.0.0",

            // Workspace Sidebar
            "sidebar_recent_docs": "Tài liệu gần đây",
            "sidebar_no_docs": "Bạn chưa có tài liệu nào.",
            "sidebar_no_docs_sub": "Hãy tải tài liệu đầu tiên của bạn!",
            "sidebar_guest_notice": "Bạn đang dùng chế độ Khách.",
            "sidebar_guest_notice_sub": "Đăng nhập để lưu lịch sử và quản lý tài liệu!",
            "sidebar_btn_login": "Đăng nhập ngay",
            "sidebar_btn_upload": "Tải PDF lên",
            "sidebar_collapse_tooltip": "Thu gọn thanh điều hướng",
            "sidebar_expand_tooltip": "Mở rộng thanh điều hướng",
            "sidebar_toggle": "Mở menu điều hướng",
            "sidebar_more_options": "Tùy chọn",

            // Workspace Dropzone
            "dropzone_main_title": "Kéo thả tệp PDF vào đây",
            "dropzone_main_subtitle": "hoặc nhấp chuột để chọn tệp từ máy tính",
            "dropzone_or_browse": "hoặc",
            "dropzone_btn_select": "Chọn tệp PDF",
            "dropzone_limits_hint": "Hỗ trợ tệp PDF tối đa {max_size} MB và {max_pages} trang",
            "dropzone_drag_over": "Thả tệp PDF vào đây để bắt đầu tải lên",

            // Batch Queue UI
            "batch_queue_title": "Hàng đợi tệp",
            "batch_add_files": "Thêm tệp",
            "batch_add_files_title": "Thêm tệp PDF vào hàng đợi",
            "batch_clear_all": "Xóa tất cả",
            "batch_clear_all_title": "Xóa toàn bộ hàng đợi",
            "batch_queue_empty": "Hàng đợi trống. Kéo thả hoặc chọn tệp PDF để thêm vào.",
            "batch_progress_title": "Tiến độ xử lý hàng đợi",
            "batch_download_zip_pdf": "Tải ZIP (.PDF)",
            "batch_download_zip_word": "Tải ZIP (.Word)",

            // Workspace Page Selection
            "page_select_title": "Phạm vi trang xử lý",
            "page_select_all": "Toàn bộ tài liệu",
            "page_select_custom": "Chọn trang cụ thể",
            "page_select_placeholder": "Ví dụ: 1-5, 8, 11-13",
            "page_select_range_hint": "Ví dụ: <code>1-3, 5</code> (hỗ trợ trang đơn và khoảng)",
            "page_select_quick_chips": "Chọn nhanh:",
            "page_select_chip_first": "Trang đầu",
            "page_select_chip_first5": "5 trang đầu",
            "page_select_chip_first10": "Trang 1-10",
            "btn_start_processing": "Bắt đầu xử lý & Dịch thuật",

            // Workspace Action Toolbar
            "toolbar_target_lang": "Dịch sang:",
            "toolbar_btn_translate": "Dịch văn bản",
            "toolbar_btn_extract": "Trích xuất văn bản",
            "toolbar_btn_ocr": "Quét OCR",
            "toolbar_btn_ai_summary": "Tóm tắt AI",
            "toolbar_btn_ai_chat": "Hỏi đáp AI",
            "toolbar_btn_split_view": "Xem song song",
            "toolbar_btn_export_docx": "Xuất Word (.docx)",
            "toolbar_btn_export_pdf": "Xuất PDF song ngữ",
            "toolbar_btn_copy": "Sao chép toàn bộ",
            "view_mode_text_title": "Chỉ xem văn bản trích xuất",
            "view_mode_pdf_title": "Xem trước PDF gốc",
            "view_mode_split_title": "So sánh song song (PDF gốc | Bản dịch)",
            "btn_retranslate_title": "Dịch lại theo ngôn ngữ đã chọn",
            "btn_download_title": "Tải xuống tệp",
            "dropdown_export_bilingual": "Bản dịch song ngữ",
            "dropdown_export_summary": "Bản tóm tắt",
            "dropdown_format_txt": "File TXT",
            "dropdown_format_pdf": "File PDF",
            "dropdown_format_word": "File Word",
            "ai_tools_title": "Tiện ích AI",
            "doc_actions_title": "Thao tác tài liệu",
            "btn_upload_another": "Tải lên tệp khác",
            "btn_copy_translation": "Sao chép bản dịch",
            "btn_reset_workspace": "Làm mới phiên làm việc",

            // AI Summary & Copilot Card
            "ai_summary_card_title": "Tóm tắt văn bản thông minh",
            "ai_summary_card_sub": "Đúc kết thông điệp cốt lõi, rút trích luận điểm chính từ tài liệu với AI Gateway",
            "ai_summary_style_label": "Kiểu tóm tắt:",
            "ai_summary_length_label": "Độ dài:",
            "btn_execute_ai_summary": "Bắt đầu tóm tắt",
            "btn_copy_summary": "Sao chép tóm tắt",

            // PDF Preview & Panels
            "preview_pdf_heading": "Xem trước PDF",
            "preview_pdf_subheading": "Bản gốc",
            "preview_page_label": "Trang",
            "preview_zoom_fit": "Vừa khung",
            "preview_pdf_loading": "Đang tải và dựng trang PDF...",
            "panel_source_title": "Văn bản gốc",
            "panel_target_title": "Bản dịch",
            "panel_empty_source": "Chưa có nội dung văn bản gốc. Vui lòng tải tài liệu PDF để bắt đầu.",
            "panel_empty_target": "Chưa có bản dịch. Nhấn nút 'Dịch văn bản' trên thanh công cụ để thực hiện.",
            "pane_tag_original": "Gốc",
            "pane_tag_translated": "Bản Dịch",
            "split_tab_pdf": "PDF Gốc",
            "split_tab_translated": "Bản Dịch",

            // Auth Modal
            "auth_login_title": "Đăng Nhập Tài Khoản",
            "auth_login_subtitle": "Chào mừng bạn quay lại với PDF-Lingua",
            "auth_register_title": "Tạo Tài Khoản Mới",
            "auth_register_subtitle": "Đăng ký miễn phí để lưu trữ tài liệu và mở rộng hạn mức",
            "auth_email_label": "Địa chỉ Email",
            "auth_password_label": "Mật khẩu",
            "auth_confirm_password_label": "Xác nhận mật khẩu",
            "auth_fullname_label": "Họ và tên",
            "auth_btn_login": "Đăng nhập",
            "auth_btn_register": "Tạo tài khoản",
            "auth_no_account": "Chưa có tài khoản?",
            "auth_has_account": "Đã có tài khoản?",
            "auth_switch_to_register": "Đăng ký ngay",
            "auth_switch_to_login": "Đăng nhập ngay",

            // Feedback & Contact Form
            "feedback_project_info": "Thông tin đồ án",
            "feedback_project_desc": "Dự án: PDF-Lingua - Web trích xuất văn bản từ tài liệu PDF, dịch thuật đa ngôn ngữ và tích hợp AI.",
            "feedback_team_members": "Thành viên nhóm",
            "feedback_form_title": "Gửi phản hồi cho nhóm",
            "feedback_name_label": "Họ và tên",
            "feedback_email_label": "Email liên hệ",
            "feedback_topic_label": "Chủ đề đóng góp",
            "feedback_content_label": "Nội dung phản hồi",
            "feedback_btn_submit": "Gửi phản hồi",
            "feedback_topic_bug": "Báo cáo lỗi dịch thuật / OCR",
            "feedback_topic_feature": "Đề xuất tính năng mới",
            "feedback_topic_support": "Câu hỏi / Hỗ trợ sử dụng",
            "feedback_topic_other": "Ý kiến đóng góp khác"
        },
        en: {
            // Common Actions & Badges
            "common_app_name": "PDF-Lingua",
            "btn_translate": "Translate",
            "btn_extract_text": "Extract Text",
            "common_close": "Close",
            "common_cancel": "Cancel",
            "common_confirm": "Confirm",
            "common_save": "Save Changes",
            "common_copy": "Copy",
            "common_copied": "Copied",
            "common_download": "Download",
            "common_delete": "Delete",
            "common_retry": "Retry",
            "common_loading": "Processing...",
            "common_success": "Success",
            "common_error": "Error",
            "common_warning": "Warning",
            "common_free": "Free",
            "common_pro": "Pro Tier",
            "common_guest": "Guest User",
            "common_member": "Member",
            "common_admin": "Administrator",
            "common_pages": "pages",
            "common_characters": "characters",
            "common_words": "words",
            "common_scroll_top": "Back to top",
            "common_understood_agree": "I Understand & Agree",
            "common_print_save_pdf": "Print or Save as PDF",
            "common_fullscreen": "Fullscreen",
            "common_exit_fullscreen": "Exit Fullscreen",

            // Navigation
            "nav_home": "Home",
            "nav_features": "Features",
            "nav_how_it_works": "How It Works",
            "nav_pricing": "Pricing",
            "nav_workspace": "Workspace",
            "nav_documents": "Documents",
            "nav_history": "History",
            "nav_login": "Sign In",
            "nav_register": "Sign Up",
            "nav_logout": "Sign Out",
            "nav_start_free": "Start for Free",
            "nav_switch_lang": "Select Language",

            // Welcome Hero Section
            "welcome_hero_eyebrow": "Academic & Technical Translation Platform",
            "welcome_hero_title_1": "Intelligent Bilingual PDF Translation & Specialized AI Assistant",
            "welcome_hero_title_accent": "100% Layout Preserved",
            "welcome_hero_subtitle": "Preserve tables, fix multi-column reading flows, and query with conversational AI directly on your original documents.",
            "welcome_hero_cta_primary": "Start for free now",
            "welcome_hero_cta_secondary": "View sample translation",
            "welcome_trust_no_install": "No installation required",
            "welcome_trust_user_isolation": "Isolated user storage",
            "welcome_trust_ocr_support": "Supports scanned PDFs & Vietnamese OCR",
            "welcome_hero_badge_ocr": "Multilingual OCR Engine",
            "welcome_hero_badge_layout": "Original format intact",
            "welcome_hero_badge_privacy": "Private & auto-cleanup",

            // Welcome Preview Showcase
            "welcome_preview_title": "Interactive Live Preview",
            "welcome_preview_badge": "Studio Workspace",
            "welcome_preview_source_title": "Source Document (PDF)",
            "welcome_preview_target_title": "Bilingual Translation",
            "welcome_preview_tag_academic": "Scientific Research Paper",
            "welcome_preview_target_lang": "English (en)",
            "welcome_preview_mode_text": "Text",
            "welcome_preview_mode_pdf": "Original PDF",
            "welcome_preview_mode_split": "Side-by-side",
            "welcome_preview_btn_retranslate": "Retranslate",
            "welcome_preview_btn_download": "Download",

            // Welcome Features Section
            "welcome_features_eyebrow": "Core Capabilities",
            "welcome_features_title": "Engineered for Academic & Professional Excellence",
            "welcome_features_subtitle": "Overcoming layout breakage, table distortion, and raw machine translation flaws common in generic translation tools.",
            "feat_ocr_title": "Accurate Optical Character Recognition (OCR)",
            "feat_ocr_desc": "Extract text from scanned documents and low-contrast images with over 98% accuracy. Automated deskewing and noise reduction.",
            "feat_layout_title": "Full Layout & Table Preservation",
            "feat_layout_desc": "Retain original column hierarchies, tables, headers, and typography when exporting to Word (.docx) or bilingual PDF.",
            "feat_ai_title": "AI Copilot & Instant Summarization",
            "feat_ai_desc": "Summarize lengthy 50-page articles in seconds. Query an intelligent conversational assistant grounded in your document context.",
            "feat_security_title": "Data Privacy & Session Isolation",
            "feat_security_desc": "Documents are strictly processed within isolated user sessions. Automated cleanup purges temporary files upon completion.",

            // Welcome Workflow Steps
            "welcome_workflow_eyebrow": "Three Simple Steps",
            "welcome_workflow_title": "Fast Translation in Seconds",
            "step_1_title": "1. Upload your PDF",
            "step_1_desc": "Drag and drop your PDF from your computer or mobile device. Digitized and scanned documents are supported.",
            "step_2_title": "2. Choose language & mode",
            "step_2_desc": "Select the target translation language, specify page ranges, and enable OCR processing as needed.",
            "step_3_title": "3. Compare side-by-side & export",
            "step_3_desc": "Compare original and translated paragraphs side-by-side. Export the output to Microsoft Word or bilingual PDF.",

            // Welcome Pricing Section
            "welcome_pricing_eyebrow": "Transparent Pricing",
            "welcome_pricing_title": "Flexible Pricing for Every Need",
            "welcome_pricing_subtitle": "Start completely free or upgrade to Pro to unlock advanced AI and batch processing.",
            "welcome_billing_monthly": "Monthly",
            "welcome_billing_yearly": "Yearly",
            "welcome_billing_save": "Save 32%",
            "tier_guest_name": "Guest User",
            "tier_guest_desc": "Instant trial without creating an account",
            "tier_guest_price": "$0",
            "tier_guest_period": "trial",
            "tier_guest_btn": "Try It Now",
            "tier_free_name": "Free Account",
            "tier_free_desc": "Best for students and occasional document reading",
            "tier_free_price": "$0",
            "tier_free_period": "forever",
            "tier_free_btn": "Sign Up Free",
            "tier_pro_name": "Pro Tier",
            "tier_pro_desc": "Optimized for researchers, translators, and educators",
            "tier_pro_price": "99,000 VND",
            "tier_pro_period": "/ month",
            "tier_pro_btn": "Upgrade to Pro",
            "tier_pro_badge": "Most Popular",

            // Welcome FAQ Section
            "welcome_faq_eyebrow": "Got Questions?",
            "welcome_faq_title": "Frequently Asked Questions",
            "faq_q1": "Does PDF-Lingua support scanned PDFs without selectable text?",
            "faq_a1": "Yes. Our integrated OCR pipeline detects and extracts optical characters from scanned pages with high accuracy.",
            "faq_q2": "Are my uploaded documents secure and private?",
            "faq_a2": "Absolutely. Files are processed temporarily during your active session and permanently deleted according to our privacy policy.",
            "faq_q3": "Can I try the service without registering an account?",
            "faq_a3": "Yes. Guest users can process documents up to 20 MB and 100 pages directly from the workspace.",

            // Welcome Footer
            "footer_desc": "Dedicated PDF translation platform with layout preservation and conversational AI assistant for academic and professional workflows.",
            "welcome_footer_quick_nav": "Quick Navigation",
            "welcome_footer_core_tech": "Core Technology",
            "welcome_footer_support_legal": "Support & Legal",
            "welcome_footer_github": "GitHub Repository",
            "welcome_footer_copyright": "Copyright 2026 PDF-Lingua. All rights reserved.",
            "footer_col_product": "Product",
            "footer_col_resources": "Resources",
            "footer_col_legal": "Legal & Policies",
            "footer_link_terms": "Terms of Service",
            "footer_link_privacy": "Privacy Policy",
            "footer_link_contact": "Contact & Support",
            "footer_copyright": "2026 PDF-Lingua. Software Engineering Capstone Project - Team 19.",

            // Legal Modal Tabs
            "legal_modal_title": "Information & Policies",
            "legal_modal_subtitle": "Terms of use, privacy commitments & support channels for PDF-Lingua",
            "legal_tab_terms": "Terms",
            "legal_tab_privacy": "Privacy",
            "legal_tab_contact": "Contact",
            "legal_badge_version": "v1.0.0",

            // Workspace Sidebar
            "sidebar_recent_docs": "Recent Documents",
            "sidebar_no_docs": "You have no documents yet.",
            "sidebar_no_docs_sub": "Upload your first document to get started!",
            "sidebar_guest_notice": "You are in Guest Mode.",
            "sidebar_guest_notice_sub": "Sign in to save processing history and manage files!",
            "sidebar_btn_login": "Sign In Now",
            "sidebar_btn_upload": "Upload PDF",
            "sidebar_collapse_tooltip": "Collapse sidebar",
            "sidebar_expand_tooltip": "Expand sidebar",
            "sidebar_toggle": "Toggle navigation menu",
            "sidebar_more_options": "Options",

            // Workspace Dropzone
            "dropzone_main_title": "Drag & drop your PDF file here",
            "dropzone_main_subtitle": "or click to select from your device",
            "dropzone_or_browse": "or",
            "dropzone_btn_select": "Choose PDF File",
            "dropzone_limits_hint": "Supports PDF up to {max_size} MB and {max_pages} pages",
            "dropzone_drag_over": "Drop your PDF file here to start upload",

            // Batch Queue UI
            "batch_queue_title": "Batch Queue",
            "batch_add_files": "Add Files",
            "batch_add_files_title": "Add PDF files to batch queue",
            "batch_clear_all": "Clear All",
            "batch_clear_all_title": "Clear entire batch queue",
            "batch_queue_empty": "Queue is empty. Drag and drop or choose PDF files to add.",
            "batch_progress_title": "Batch Processing Progress",
            "batch_download_zip_pdf": "Download ZIP (.PDF)",
            "batch_download_zip_word": "Download ZIP (.Word)",

            // Workspace Page Selection
            "page_select_title": "Page Selection Range",
            "page_select_all": "All Pages",
            "page_select_custom": "Custom Pages",
            "page_select_placeholder": "E.g. 1-5, 8, 11-13",
            "page_select_range_hint": "E.g. <code>1-3, 5</code> (supports single pages and ranges)",
            "page_select_quick_chips": "Quick select:",
            "page_select_chip_first": "First page",
            "page_select_chip_first5": "First 5 pages",
            "page_select_chip_first10": "Pages 1-10",
            "btn_start_processing": "Start Processing & Translation",

            // Workspace Action Toolbar
            "toolbar_target_lang": "Translate to:",
            "toolbar_btn_translate": "Translate",
            "toolbar_btn_extract": "Extract Text",
            "toolbar_btn_ocr": "Run OCR",
            "toolbar_btn_ai_summary": "AI Summary",
            "toolbar_btn_ai_chat": "Ask AI",
            "toolbar_btn_split_view": "Split View",
            "toolbar_btn_export_docx": "Export Word (.docx)",
            "toolbar_btn_export_pdf": "Export Bilingual PDF",
            "toolbar_btn_copy": "Copy All",
            "view_mode_text_title": "View extracted text only",
            "view_mode_pdf_title": "Preview original PDF",
            "view_mode_split_title": "Side-by-side comparison (PDF | Translation)",
            "btn_retranslate_title": "Retranslate with selected language",
            "btn_download_title": "Download exported file",
            "dropdown_export_bilingual": "Bilingual Translation",
            "dropdown_export_summary": "AI Summary",
            "dropdown_format_txt": "TXT File",
            "dropdown_format_pdf": "PDF File",
            "dropdown_format_word": "Word File",
            "ai_tools_title": "AI Utilities",
            "doc_actions_title": "Document Actions",
            "btn_upload_another": "Upload Another File",
            "btn_copy_translation": "Copy Translation",
            "btn_reset_workspace": "Reset Workspace Session",

            // AI Summary & Copilot Card
            "ai_summary_card_title": "Smart Document Summarization",
            "ai_summary_card_sub": "Extract core takeaways and main arguments from your document with AI Gateway",
            "ai_summary_style_label": "Summary style:",
            "ai_summary_length_label": "Length:",
            "btn_execute_ai_summary": "Start Summary",
            "btn_copy_summary": "Copy Summary",

            // PDF Preview & Panels
            "preview_pdf_heading": "PDF Preview",
            "preview_pdf_subheading": "Original",
            "preview_page_label": "Page",
            "preview_zoom_fit": "Fit View",
            "preview_pdf_loading": "Loading and rendering PDF page...",
            "panel_source_title": "Source Document",
            "panel_target_title": "Translation",
            "panel_empty_source": "No source content available. Please upload a PDF document to begin.",
            "panel_empty_target": "No translation available. Click 'Translate' on the toolbar to process.",
            "pane_tag_original": "Original",
            "pane_tag_translated": "Translation",
            "split_tab_pdf": "Original PDF",
            "split_tab_translated": "Translation",

            // Auth Modal
            "auth_login_title": "Sign In to Account",
            "auth_login_subtitle": "Welcome back to PDF-Lingua",
            "auth_register_title": "Create a New Account",
            "auth_register_subtitle": "Register for free to save files and unlock expanded limits",
            "auth_email_label": "Email Address",
            "auth_password_label": "Password",
            "auth_confirm_password_label": "Confirm Password",
            "auth_fullname_label": "Full Name",
            "auth_btn_login": "Sign In",
            "auth_btn_register": "Create Account",
            "auth_no_account": "Don't have an account?",
            "auth_has_account": "Already have an account?",
            "auth_switch_to_register": "Sign up now",
            "auth_switch_to_login": "Sign in now",

            // Feedback & Contact Form
            "feedback_project_info": "Project Information",
            "feedback_project_desc": "Project: PDF-Lingua - PDF text extraction, multilingual translation, and AI integration platform.",
            "feedback_team_members": "Team Members",
            "feedback_form_title": "Send Feedback to the Team",
            "feedback_name_label": "Your Name",
            "feedback_email_label": "Contact Email",
            "feedback_topic_label": "Feedback Topic",
            "feedback_content_label": "Feedback Message",
            "feedback_btn_submit": "Submit Feedback",
            "feedback_topic_bug": "Report OCR / Translation Bug",
            "feedback_topic_feature": "Suggest a New Feature",
            "feedback_topic_support": "Question / Help Request",
            "feedback_topic_other": "General Feedback"
        }
    };

    let currentLang = DEFAULT_LANG;

    const i18n = {
        /**
         * Initialize i18n from localStorage or browser preferences.
         */
        init: function () {
            let selectedLang = DEFAULT_LANG;
            try {
                const savedLang = localStorage.getItem(STORAGE_KEY);
                if (savedLang && SUPPORTED_LANGS.includes(savedLang)) {
                    selectedLang = savedLang;
                } else {
                    selectedLang = DEFAULT_LANG;
                }
            } catch (e) {
                selectedLang = DEFAULT_LANG;
            }

            currentLang = selectedLang;
            this.bindEvents();
            this.applyTranslations(currentLang);
            return currentLang;
        },

        /**
         * Translate key with optional parameter substitution.
         * @param {string} key
         * @param {object} params
         * @returns {string}
         */
        t: function (key, params) {
            const langDict = dictionaries[currentLang] || dictionaries[DEFAULT_LANG];
            let text = langDict[key] || (dictionaries[DEFAULT_LANG] && dictionaries[DEFAULT_LANG][key]) || key;

            if (params && typeof params === 'object') {
                for (const paramKey of Object.keys(params)) {
                    const regex = new RegExp('\\{' + paramKey + '\\}', 'g');
                    text = text.replace(regex, params[paramKey]);
                }
            }
            return text;
        },

        /**
         * Switch active language and update DOM.
         * @param {string} lang ('vi' | 'en')
         */
        setLanguage: function (lang) {
            if (!SUPPORTED_LANGS.includes(lang)) return;
            currentLang = lang;
            try {
                localStorage.setItem(STORAGE_KEY, lang);
            } catch (e) {
                // Ignore storage errors in restricted contexts
            }

            this.applyTranslations(lang);

            // Dispatch global event for custom components
            if (typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: lang } }));
            }
        },

        /**
         * Get current active language code ('vi' | 'en').
         */
        getLanguage: function () {
            return currentLang;
        },

        /**
         * Apply translations across the entire DOM tree.
         * @param {string} lang
         */
        applyTranslations: function (lang) {
            if (typeof document === 'undefined') return;

            document.documentElement.lang = lang;

            // 1. Text Content Binding: [data-i18n="key"]
            const textElements = document.querySelectorAll('[data-i18n]');
            textElements.forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (key) {
                    el.textContent = this.t(key);
                }
            });

            // 2. HTML Content Binding: [data-i18n-html="key"]
            const htmlElements = document.querySelectorAll('[data-i18n-html]');
            htmlElements.forEach(el => {
                const key = el.getAttribute('data-i18n-html');
                if (key) {
                    el.innerHTML = this.t(key);
                }
            });

            // 3. Attribute Binding: [data-i18n-attr="placeholder:key,title:key,aria-label:key"]
            const attrElements = document.querySelectorAll('[data-i18n-attr]');
            attrElements.forEach(el => {
                const rawMapping = el.getAttribute('data-i18n-attr');
                if (!rawMapping) return;

                const pairs = rawMapping.split(',');
                pairs.forEach(pair => {
                    const parts = pair.split(':');
                    if (parts.length === 2) {
                        const attr = parts[0].trim();
                        const key = parts[1].trim();
                        if (attr && key) {
                            el.setAttribute(attr, this.t(key));
                        }
                    }
                });
            });

            // 4. Custom navigation bindings for sidebar
            if (typeof document.querySelector === 'function') {
                const sideNavDocsSpan = document.querySelector('#sideNavDocuments .nav-item-text');
                if (sideNavDocsSpan) {
                    sideNavDocsSpan.textContent = this.t('nav_documents');
                }
                const sideNavDocsLink = document.querySelector('#sideNavDocuments');
                if (sideNavDocsLink) {
                    sideNavDocsLink.setAttribute('data-tooltip', this.t('nav_documents'));
                }
            }

            // 5. Update all switcher UI buttons
            this.updateSwitcherUI(lang);
        },

        /**
         * Update visual active states on all language switcher controls.
         */
        updateSwitcherUI: function (lang) {
            if (typeof document === 'undefined') return;

            const switchers = document.querySelectorAll('.lang-switcher-btn');
            switchers.forEach(btn => {
                const btnLang = btn.getAttribute('data-lang');
                if (btnLang === lang) {
                    btn.classList.add('active');
                    btn.setAttribute('aria-pressed', 'true');
                } else {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-pressed', 'false');
                }
            });
        },

        /**
         * Bind global click handlers for language switcher buttons.
         */
        bindEvents: function () {
            if (typeof document === 'undefined') return;

            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.lang-switcher-btn');
                if (btn) {
                    const targetLang = btn.getAttribute('data-lang');
                    if (targetLang && targetLang !== currentLang) {
                        this.setLanguage(targetLang);
                    }
                }
            });
        },

        /**
         * Access raw dictionary entries for testing or extensions.
         */
        getDictionaries: function () {
            return dictionaries;
        }
    };

    // Auto-initialize when DOM is ready
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                i18n.init();
            });
        } else {
            i18n.init();
        }
    }

    // Export globally for browser & CommonJS for testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = i18n;
    } else {
        window.i18n = i18n;
    }
})(typeof window !== 'undefined' ? window : globalThis);
