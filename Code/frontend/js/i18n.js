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
            "common_free": "Người dùng Free",
            "common_pro": "Người dùng Pro",
            "common_guest": "Khách",
            "common_member": "Thành viên",
            "common_admin": "Quản trị viên",
            "role_guest": "Khách",
            "role_free": "Người dùng Free",
            "role_pro": "Người dùng Pro",
            "role_admin": "Quản trị viên",
            "role_admin_title": "Vai trò: Quản trị viên",
            "role_guest_tooltip": "Khách",
            "role_personal_account": "Tài khoản cá nhân",
            "account_role_label": "Gói tài khoản (Vai trò)",
            "sidebar_profile_aria": "Xem thông tin tài khoản",
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
            "badge_original": "GỐC",
            "badge_translated": "BẢN DỊCH",
            "badge_pdf_digital": "PDF Số",
            "preview_file_pages": "1 trang",
            "preview_stats_orig": "95 từ (580 ký tự)",
            "preview_stats_trans": "75 từ (603 ký tự)",

            // Welcome Features Section
            "welcome_features_eyebrow": "Tính Năng Vượt Trội",
            "welcome_features_title": "Các Tính Năng Chính Của Hệ Thống PDF-Lingua",
            "welcome_features_subtitle": "Giải quyết triệt để tình trạng lệch dòng, vỡ khung bảng biểu và ảo giác dữ liệu khi dịch thuật tài liệu kỹ thuật.",
            "bento_layout_badge": "Smart Layout",
            "bento_layout_title": "Tối Ưu Thứ Tự Đọc & Bố Cục Đa Cột",
            "bento_layout_desc": "Tự động phát hiện khoảng hở lề (gutter gap) và gom dòng thông minh theo toạ độ dọc. Tối ưu thứ tự đọc tự nhiên cho tài liệu 2 cột và hỗ trợ đối chiếu song ngữ trực quan.",
            "bento_sync_original": "Original (EN)",
            "bento_sync_translated": "Bản Dịch (VI)",
            "bento_sync_row1_vi": "Cơ chế tập trung đa đầu",
            "bento_sync_row2_vi": "Bảo tồn hình thái bảng biểu",
            "bento_sync_row3_vi": "Luồng đọc chuẩn hai cột",
            "bento_ocr_badge": "Tesseract OCR",
            "bento_ocr_title": "Xử Lý Trang Quét & Khử Nghiêng Deskew",
            "bento_ocr_desc": "Tích hợp Tesseract OCR (vie+eng), tự động nhận diện hướng xoay 90°/180°/270° qua OSD và thuật toán Deskew cân chỉnh góc nghiêng lệch trong phạm vi [-15°, +15°].",
            "bento_ocr_range_lbl": "Phạm vi cân chỉnh",
            "bento_ocr_scale_zero": "0° (Chuẩn)",
            "bento_ocr_status": "OSD xoay 90°/180°/270° & Cân bằng Deskew",
            "bento_copilot_badge": "Ngăn Ngừa Ảo Giác",
            "bento_copilot_title": "Trợ Lý AI Copilot Hỏi Đáp Tài Liệu",
            "bento_copilot_desc": "Hỏi đáp trực tiếp dựa trên nội dung tài liệu bằng cơ chế RAG phân đoạn ngữ cảnh. Guardrail nghiêm ngặt buộc AI từ chối suy diễn nếu văn bản không đề cập.",
            "bento_chat_q_lbl": "Câu hỏi:",
            "bento_chat_q_txt": "Phương pháp đánh giá độ trễ trong bài báo là gì?",
            "bento_chat_context": "Ngữ cảnh tài liệu",
            "bento_chat_ans": "Đo lường thời gian xử lý trung bình qua các lần thử nghiệm trên tệp đa cột, phản hồi trực tiếp từ dữ liệu văn bản gốc.",
            "bento_summary_badge": "Thuật Toán Map-Reduce",
            "bento_summary_title": "Tóm Tắt Phân Tán Map-Reduce",
            "bento_summary_desc": "Chia nhỏ tài liệu dài thành các khối 1500 từ, xử lý tóm tắt song song (Map phase) bằng asyncio và tổng hợp báo cáo cô đọng (Reduce phase) theo 3 phong cách tùy chọn.",
            "bento_summary_chunk": "Khối 1..N",
            "bento_summary_async": "1500 từ (Async)",
            "bento_summary_report": "Báo cáo",
            "bento_summary_style_concise": "Ngắn gọn",
            "bento_summary_style_bullet": "Gạch đầu dòng",
            "bento_summary_style_detail": "Chi tiết",
            "bento_batch_badge": "Hàng Đợi Xử Lý",
            "bento_batch_title": "Xử Lý Hàng Loạt & Xuất DOCX, ZIP",
            "bento_batch_desc": "Tải lên nhiều tệp vào hàng đợi với cơ chế giới hạn concurrency trên trình duyệt. Xuất kết quả song ngữ ra Microsoft Word (.DOCX) và tải trọn bộ qua tệp nén ZIP.",
            "bento_queue_title": "Hàng Đợi Tài Liệu",
            "bento_queue_done": "2/3 Đã Xong",
            "bento_queue_proc": "Đang xử lý",
            "bento_sec_badge": "Phân Quyền RBAC",
            "bento_sec_title": "Cô Lập Thư Mục & Kiểm Soát Quyền Truy Cập",
            "bento_sec_desc": "Mỗi tài khoản được phân bổ không gian lưu trữ riêng biệt theo User ID. Hệ thống kiểm soát quyền nghiêm ngặt, ngăn chặn tấn công Path Traversal và tự động xóa vĩnh viễn tệp theo yêu cầu.",
            "bento_sec_user_id": "Phân Vùng User ID",
            "bento_sec_user_id_desc": "Cô lập thư mục dữ liệu riêng theo định danh tài khoản",
            "bento_sec_traversal": "Chống Path Traversal",
            "bento_sec_traversal_desc": "Chuẩn hóa đường dẫn tệp và chặn ký tự độc hại",
            "bento_sec_purge": "Tự Động Hủy Tệp",
            "bento_sec_purge_desc": "Xóa vĩnh viễn tệp tạm sau khi hoàn tất phiên làm việc",

            // Welcome Workflow Steps
            "welcome_workflow_eyebrow": "Quy Trình 3 Bước",
            "welcome_workflow_title": "Dịch Thuật Nhanh Chóng Trong Vài Giây",
            "welcome_workflow_subtitle": "Chuyển đổi tài liệu học thuật phức tạp sang bản dịch song ngữ bảo tồn bố cục chỉ trong vài thao tác đơn giản.",
            "step_1_title": "1. Tải tài liệu PDF",
            "step_1_desc": "Kéo thả tài liệu PDF từ máy tính hoặc thiết bị của bạn. Hỗ trợ cả file số hóa và bản scan ảnh.",
            "step_1_meta": "Hỗ trợ PDF 20MB - 100MB",
            "step_2_title": "2. Chọn ngôn ngữ & Chế độ",
            "step_2_desc": "Lựa chọn ngôn ngữ đích, phạm vi trang cần dịch và kích hoạt nhận dạng OCR nếu cần.",
            "step_2_meta": "Hỗ trợ đa luồng xử lý",
            "step_3_title": "3. Xem song song & Xuất tệp",
            "step_3_desc": "So sánh trực quan bản gốc và bản dịch theo từng đoạn văn. Xuất kết quả sang Word hoặc PDF song ngữ.",
            "step_3_meta": "Định dạng DOCX, TXT, ZIP",

            // Welcome Pricing Section
            "welcome_pricing_eyebrow": "Bảng Giá Minh Bạch",
            "welcome_pricing_title": "Bảng Giá Linh Hoạt Cho Mọi Nhu Cầu",
            "welcome_pricing_subtitle": "Khởi đầu miễn phí hoàn toàn hoặc nâng cấp gói Pro để mở khóa toàn bộ sức mạnh AI và xử lý hàng loạt.",
            "welcome_billing_monthly": "Hàng tháng",
            "welcome_billing_yearly": "Hàng năm",
            "welcome_billing_save": "Tiết kiệm 32%",
            "welcome_meta_title": "PDF-Lingua | Dịch Thuật PDF Song Ngữ Thông Minh & Trợ Lý AI Chuyên Sâu",
            "tier_guest_name": "Khách vãng lai",
            "tier_guest_desc": "Trải nghiệm nhanh không cần tạo tài khoản",
            "tier_guest_price": "0đ",
            "tier_guest_period": "dùng thử",
            "tier_guest_btn": "Trải nghiệm ngay",
            "tier_free_name": "Tài khoản Miễn phí",
            "tier_free_desc": "Phù hợp cho sinh viên và người dùng cá nhân cơ bản",
            "tier_free_price": "0 đ",
            "tier_free_period": "mãi mãi",
            "tier_free_period_month": "/ tháng",
            "tier_free_btn": "Đăng ký miễn phí",
            "tier_free_item_1": "Xử lý tối đa 5 tài liệu / ngày",
            "tier_free_item_2": "OCR Tiếng Việt tối đa 100 trang / tháng",
            "tier_free_item_3": "Xem song ngữ 2 cột đối chiếu trực quan",
            "tier_free_item_4": "Lưu trữ lịch sử xử lý 7 ngày",
            "tier_free_item_5": "Trợ lý AI Copilot hỏi đáp ngữ cảnh tài liệu",
            "tier_free_item_6": "Xuất tệp Microsoft Word (.DOCX)",
            "tier_pro_name": "Gói Pro Chuyên Nghiệp",
            "tier_pro_desc": "Tối ưu cho nghiên cứu sinh, dịch giả và giảng viên",
            "tier_pro_price": "49.000 đ",
            "tier_pro_period": "/ tháng",
            "tier_pro_period_month": "/ tháng",
            "tier_pro_btn": "Nâng cấp gói Pro",
            "tier_pro_badge": "Phổ biến nhất",
            "tier_pro_item_1": "Không giới hạn số lượng tài liệu tải lên",
            "tier_pro_item_2": "OCR Tiếng Việt chuyên sâu 500 trang / tháng",
            "tier_pro_item_3": "Trợ lý AI Copilot hỏi đáp theo ngữ cảnh tài liệu",
            "tier_pro_item_4": "Tóm tắt tài liệu lớn bằng thuật toán Map-Reduce",
            "tier_pro_item_5": "Xuất tệp Microsoft Word (.DOCX) & nén ZIP",
            "tier_pro_item_6": "Hỗ trợ kỹ thuật ưu tiên & Cô lập thư mục User ID",

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
            "footer_badge_rbac": "Kiểm Soát Quyền RBAC",
            "footer_tech_ocr": "OCR Tiếng Việt & Khử Nghiêng",
            "footer_tech_layout": "Tối ưu thứ tự đọc Smart Layout",
            "footer_tech_mapreduce": "Tóm tắt phân tán Map-Reduce",
            "footer_tech_copilot": "Trợ lý Copilot hỏi đáp tài liệu",
            "footer_tech_export": "Xuất tệp Word .DOCX & ZIP",
            "footer_contact_email": "Liên hệ: huytamnguyenle2608@gmail.com",

            // Legal Modal Detailed Content
            "terms_callout_title": "Tóm tắt quyền lợi:",
            "terms_callout_desc": "Bạn giữ toàn bộ quyền sở hữu đối với tài liệu PDF tải lên. Bản dịch máy móc mang tính chất tham khảo học thuật.",
            "legal_toc_label": "Mục lục:",
            "terms_toc_1": "1. Bản quyền",
            "terms_toc_2": "2. Quy định",
            "terms_toc_3": "3. Hạn mức",
            "terms_toc_4": "4. Miễn trừ",
            "terms_h1": "1. Quyền sở hữu trí tuệ & Bản quyền",
            "terms_p1": "Người dùng giữ toàn quyền sở hữu và bản quyền đối với tệp tài liệu PDF tải lên hệ thống cũng như các kết quả trích xuất và bản dịch. PDF-Lingua cam kết không sở hữu, sao chép hoặc phân phối tài liệu của bạn cho bất kỳ bên thứ ba nào ngoài mục đích xử lý phiên dịch theo yêu cầu.",
            "terms_h2": "2. Quy định sử dụng dịch vụ",
            "terms_p2": "Người dùng cam kết không sử dụng hệ thống để xử lý, phát tán các tài liệu chứa mã độc, nội dung vi phạm pháp luật, xâm phạm quyền riêng tư của cá nhân hoặc tổ chức khác. Không thực hiện các hành vi can thiệp trái phép, đảo ngược mã nguồn hoặc tấn công làm quá tải máy chủ.",
            "terms_h3": "3. Giới hạn gói dịch vụ (Tiers)",
            "terms_p3_free": "Gói Miễn phí (Khách & Người dùng cơ bản): Hạn mức xử lý tối đa 20 MB/tệp và tối đa 100 trang/tài liệu. Hỗ trợ trích xuất văn bản số và OCR cơ bản.",
            "terms_p3_pro": "Gói Pro: Hạn mức xử lý mở rộng lên đến 100 MB/tệp cùng các tính năng AI nâng cao (Tóm tắt văn bản, Trợ lý AI hỏi đáp tài liệu).",
            "terms_h4": "4. Miễn trừ trách nhiệm (Disclaimer)",
            "terms_p4": "Các tính năng trích xuất văn bản, nhận dạng OCR và dịch thuật tự động được thực hiện dựa trên các mô hình máy học và dịch máy. Hệ thống nỗ lực mang lại kết quả chuẩn xác nhất nhưng không đảm bảo tính hoàn hảo 100% về mặt ngữ nghĩa và không thể thay thế cho bản dịch công chứng có tính pháp lý.",

            "privacy_callout_title": "Cam kết bảo mật:",
            "privacy_callout_desc": "Tệp PDF được xử lý trong phiên cô lập và tự động xóa sạch. Mật khẩu được mã hóa an toàn bằng Bcrypt.",
            "privacy_toc_1": "1. Thu thập dữ liệu",
            "privacy_toc_2": "2. Tự động xóa",
            "privacy_toc_3": "3. Tiêu chuẩn mã hóa",
            "privacy_toc_4": "4. Cam kết bảo vệ",
            "privacy_h1": "1. Thu thập dữ liệu & Phạm vi sử dụng",
            "privacy_p1": "PDF-Lingua chỉ thu thập các dữ liệu tối thiểu cần thiết để phục vụ quy trình bóc tách và dịch thuật tài liệu:",
            "privacy_p1_item1": "Tệp PDF tải lên tạm thời trong phiên làm việc.",
            "privacy_p1_item2": "Thông tin tài khoản đăng ký (Địa chỉ email, Tên hiển thị). Mật khẩu được mã hóa một chiều tuyệt đối không lưu plaintext.",
            "privacy_p1_item3": "Dữ liệu kỹ thuật ẩn danh (IP, thời gian gửi yêu cầu) phục vụ cho cơ chế bảo vệ chống tấn công quá tải (Rate Limiting).",
            "privacy_h2": "2. Chính sách lưu trữ & Tự động xóa (Auto-Cleanup)",
            "privacy_p2": "Mọi tệp tài liệu PDF và file tạm thời phát sinh trong quá trình xử lý đều được lưu trữ trong thư mục tạm có bảo vệ và được tự động dọn dẹp, xóa sạch sau khi hoàn tất phiên làm việc. Người dùng có toàn quyền xóa lịch sử xử lý tài liệu bất cứ khi nào.",
            "privacy_h3": "3. Tiêu chuẩn mã hóa & An toàn hệ thống",
            "privacy_h3_item1": "Mật khẩu: Sử dụng thuật toán băm chuẩn công nghiệp bcrypt với 12 rounds muối ngẫu nhiên.",
            "privacy_h3_item2": "Phiên làm việc: Bảo mật thông qua mã xác thực JSON Web Token (JWT) có thời hạn.",
            "privacy_h3_item3": "Tính cô lập (Data Isolation): Tài liệu và dữ liệu của người dùng được phân tách biệt lập, ngăn chặn hoàn toàn việc người khác truy cập trái phép.",
            "privacy_h4": "4. Cam kết bảo vệ dữ liệu",
            "privacy_p4": "Chúng tôi tuyệt đối không bán, cho thuê, trao đổi hoặc tiết lộ thông tin cá nhân và dữ liệu tài liệu của người dùng cho bất kỳ bên thứ ba nào.",

            "feedback_section_project": "Thông tin đồ án",
            "feedback_project_desc": "Dự án: PDF-Lingua - Web trích xuất văn bản từ tài liệu PDF, dịch thuật đa ngôn ngữ và tích hợp AI.",
            "feedback_section_team": "Thành viên nhóm",
            "feedback_section_contact": "Thông tin liên hệ",
            "feedback_contact_email_lbl": "Email hỗ trợ:",
            "feedback_copy_btn": "Sao chép",
            "feedback_contact_source_lbl": "Mã nguồn",
            "feedback_goto_repo": "Đi tới repo",
            "feedback_section_feedback": "Gửi phản hồi cho nhóm",
            "feedback_lbl_name": "Họ và tên",
            "feedback_lbl_name_req": "Họ và tên <span class=\"text-danger\">*</span>",
            "feedback_lbl_email": "Email liên hệ",
            "feedback_lbl_email_req": "Email liên hệ <span class=\"text-danger\">*</span>",
            "feedback_lbl_topic": "Chủ đề đóng góp",
            "feedback_topic_bug": "Báo cáo lỗi dịch thuật / OCR",
            "feedback_topic_feature": "Đề xuất tính năng mới",
            "feedback_topic_support": "Câu hỏi / Hỗ trợ sử dụng",
            "feedback_topic_other": "Ý kiến đóng góp khác",
            "feedback_lbl_message": "Nội dung phản hồi",
            "feedback_lbl_message_req": "Nội dung phản hồi <span class=\"text-danger\">*</span>",
            "feedback_placeholder_message": "Mô tả chi tiết ý kiến hoặc lỗi bạn gặp phải...",
            "feedback_btn_submit": "Gửi phản hồi",
            "feedback_legal_meta": "Phiên bản: v1.0.0 • Hiệu lực từ: 28/10/2026",
            "auth_no_account_register": "Chưa có tài khoản? <a href=\"index.html#register\" id=\"linkSwitchRegister\">Đăng ký ngay</a>",

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
            "feedback_topic_other": "Ý kiến đóng góp khác",

            // HTTP Errors & Dynamic Status Messages
            "http_error_400": "Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.",
            "http_error_401": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
            "http_error_403": "Bạn không có quyền thực hiện thao tác này.",
            "http_error_404": "Không tìm thấy tài nguyên yêu cầu.",
            "http_error_413": "Dung lượng tệp vượt quá giới hạn cho phép.",
            "http_error_429": "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
            "http_error_500": "Máy chủ gặp sự cố xử lý. Vui lòng thử lại sau.",
            "http_error_default": "Đã xảy ra lỗi kết nối. Vui lòng thử lại.",
            "status_completed": "hoàn thành",
            "preview_loading_server": "Đang tải tệp PDF xem trước từ máy chủ...",
            "toast_preparing_file": "Đang chuẩn bị tệp .{format}...",
            "toast_email_copied": "Đã sao chép địa chỉ email vào clipboard!",
            "toast_feedback_sent": "Cảm ơn bạn! Phản hồi đã được gửi đến nhóm phát triển.",
            "toast_legal_accepted": "Cảm ơn bạn! Đã ghi nhận đồng ý Điều khoản & Bảo mật của PDF-Lingua.",
            "toast_translation_copied": "Đã sao chép toàn bộ bản dịch vào clipboard!",
            "toast_original_copied": "Đã sao chép văn bản gốc vào clipboard!",
            "toast_summary_copied": "Đã sao chép tóm tắt vào clipboard!",
            "toast_workspace_reset": "Làm mới phiên làm việc thành công.",
            "toast_upload_required": "Vui lòng tải lên tệp PDF để bắt đầu!",
            "toast_admin_denied": "Bạn chưa có quyền xem quản trị!",

            // Dynamic Progress & Statuses
            "Đang xử lý...": "Đang xử lý...",
            "Đang tải tài liệu lên máy chủ...": "Đang tải tài liệu lên máy chủ...",
            "Đang nhận dạng OCR văn bản...": "Đang nhận dạng OCR văn bản...",
            "Đang dịch thuật văn bản...": "Đang dịch thuật văn bản...",
            "Đang xếp hàng chờ...": "Đang xếp hàng chờ...",
            "Đang phân tích & dịch thuật...": "Đang phân tích & dịch thuật...",
            "Hoàn tất xử lý": "Hoàn tất xử lý",
            "Sẵn sàng": "Sẵn sàng",

            // Common Dynamic Toast Sentences
            "Đã sao chép toàn bộ bản dịch vào bộ nhớ tạm!": "Đã sao chép toàn bộ bản dịch vào bộ nhớ tạm!",
            "Đã sao chép văn bản gốc vào clipboard!": "Đã sao chép văn bản gốc vào clipboard!",
            "Đã sao chép vào bộ nhớ tạm!": "Đã sao chép vào bộ nhớ tạm!",
            "Chưa có nội dung bản dịch để sao chép!": "Chưa có nội dung bản dịch để sao chép!",
            "Không thể sao chép văn bản.": "Không thể sao chép văn bản.",
            "Vui lòng tải lên tệp PDF để bắt đầu!": "Vui lòng tải lên tệp PDF để bắt đầu!",
            "Vui lòng chọn một tệp PDF trước khi bắt đầu!": "Vui lòng chọn một tệp PDF trước khi bắt đầu!",
            "Tài liệu đã được dịch thuật thành công!": "Tài liệu đã được dịch thuật thành công!",
            "Đã hủy tác vụ xử lý thành công.": "Đã hủy tác vụ xử lý thành công.",
            "Tác vụ đang tiếp tục xử lý ở chế độ nền.": "Tác vụ đang tiếp tục xử lý ở chế độ nền.",
            "Lỗi kết nối khi tải bản xem trước PDF.": "Lỗi kết nối khi tải bản xem trước PDF.",
            "Chưa có tài liệu để tải về!": "Chưa có tài liệu để tải về!",
            "Tính năng tải tệp Word (.docx) chỉ dành riêng cho tài khoản Pro VIP!": "Tính năng tải tệp Word (.docx) chỉ dành riêng cho tài khoản Pro VIP!",
            "Chưa có nội dung bản dịch để tải về!": "Chưa có nội dung bản dịch để tải về!",
            "Chưa có nội dung văn bản gốc để tải về!": "Chưa có nội dung văn bản gốc để tải về!",
            "Thiếu nội dung văn bản gốc để xuất song ngữ!": "Thiếu nội dung văn bản gốc để xuất song ngữ!",
            "Thiếu nội dung bản dịch để xuất song ngữ!": "Thiếu nội dung bản dịch để xuất song ngữ!",
            "Cảm ơn bạn! Đã ghi nhận đồng ý Điều khoản & Bảo mật của PDF-Lingua.": "Cảm ơn bạn! Đã ghi nhận đồng ý Điều khoản & Bảo mật của PDF-Lingua.",
            "Cảm ơn bạn đã gửi phản hồi đóng góp cho nhóm phát triển PDF-Lingua!": "Cảm ơn bạn đã gửi phản hồi đóng góp cho nhóm phát triển PDF-Lingua!"
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
            "common_free": "Free User",
            "common_pro": "Pro User",
            "common_guest": "Guest",
            "common_member": "Member",
            "common_admin": "Admin",
            "role_guest": "Guest",
            "role_free": "Free User",
            "role_pro": "Pro User",
            "role_admin": "Admin",
            "role_admin_title": "Role: Admin",
            "role_guest_tooltip": "Guest",
            "role_personal_account": "Personal Account",
            "account_role_label": "Account Plan (Role)",
            "sidebar_profile_aria": "View account information",
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
            "badge_original": "ORIGINAL",
            "badge_translated": "TRANSLATED",
            "badge_pdf_digital": "Digital PDF",
            "preview_file_pages": "1 page",
            "preview_stats_orig": "95 words (580 characters)",
            "preview_stats_trans": "75 words (603 characters)",

            // Welcome Features Section
            "welcome_features_eyebrow": "Key Features",
            "welcome_features_title": "Core Capabilities of the PDF-Lingua System",
            "welcome_features_subtitle": "Thoroughly eliminate line displacement, broken table layouts, and hallucinated data in technical translation.",
            "bento_layout_badge": "Smart Layout",
            "bento_layout_title": "Optimized Reading Flow & Multi-Column Layout",
            "bento_layout_desc": "Automatically detects gutter gaps and merges lines based on vertical coordinates. Optimizes natural reading order for two-column papers with intuitive side-by-side alignment.",
            "bento_sync_original": "Original (EN)",
            "bento_sync_translated": "Translation (VI)",
            "bento_sync_row1_vi": "Multi-head attention mechanisms",
            "bento_sync_row2_vi": "Preserve tabular topology",
            "bento_sync_row3_vi": "Two-column standard reading flow",
            "bento_ocr_badge": "Tesseract OCR",
            "bento_ocr_title": "Scanned Page Processing & Deskew",
            "bento_ocr_desc": "Integrates Tesseract OCR (vie+eng) with automatic 90 deg / 180 deg / 270 deg orientation detection via OSD and Deskew algorithm calibrating tilt angles within [-15 deg, +15 deg].",
            "bento_ocr_range_lbl": "Calibration range",
            "bento_ocr_scale_zero": "0 deg (Standard)",
            "bento_ocr_status": "OSD rotate 90 deg / 180 deg / 270 deg & Deskew calibration",
            "bento_copilot_badge": "Hallucination Guard",
            "bento_copilot_title": "AI Copilot Document Q&A Assistant",
            "bento_copilot_desc": "Query directly based on document contents using contextual chunk RAG. Strict guardrails prevent speculation if the text does not mention it.",
            "bento_chat_q_lbl": "Question:",
            "bento_chat_q_txt": "What latency evaluation methodology is used in the paper?",
            "bento_chat_context": "Document Context",
            "bento_chat_ans": "Measures average processing latency across experimental trials on multi-column files, directly sourced from original text data.",
            "bento_summary_badge": "Map-Reduce Algorithm",
            "bento_summary_title": "Distributed Map-Reduce Summarization",
            "bento_summary_desc": "Partitions long documents into 1,500-word chunks, processes summaries concurrently in the Map phase via asyncio, and synthesizes concise reports in the Reduce phase across 3 customizable styles.",
            "bento_summary_chunk": "Chunk 1..N",
            "bento_summary_async": "1,500 words (Async)",
            "bento_summary_report": "Report",
            "bento_summary_style_concise": "Concise",
            "bento_summary_style_bullet": "Bullet points",
            "bento_summary_style_detail": "Detailed",
            "bento_batch_badge": "Processing Queue",
            "bento_batch_title": "Batch Processing & DOCX / ZIP Export",
            "bento_batch_desc": "Queue multiple files with per-file concurrency limit. Export bilingual side-by-side Microsoft Word (.DOCX) and download all in a ZIP archive.",
            "bento_queue_title": "DOCUMENT QUEUE",
            "bento_queue_done": "2/3 Completed",
            "bento_queue_proc": "Processing",
            "bento_sec_badge": "RBAC Permissions",
            "bento_sec_title": "Directory Isolation & Access Control",
            "bento_sec_desc": "Each account is partitioned into an isolated storage space by User ID. Strict path traversal prevention and automatic file retention lifecycle.",
            "bento_sec_user_id": "User ID Partitioning",
            "bento_sec_user_id_desc": "Isolated user storage; no cross-user access.",
            "bento_sec_traversal": "Path Traversal Defense",
            "bento_sec_traversal_desc": "Standardizes paths, blocks malicious /../ traversal attacks.",
            "bento_sec_purge": "Automated Lifecycle",
            "bento_sec_purge_desc": "Deletes temporary files after task completion.",

            // Welcome Workflow Steps
            "welcome_workflow_eyebrow": "Three Simple Steps",
            "welcome_workflow_title": "Fast Translation in Seconds",
            "welcome_workflow_subtitle": "Convert complex academic documents into layout-preserved bilingual translations in a few simple steps.",
            "step_1_title": "1. Upload your PDF",
            "step_1_desc": "Drag and drop your PDF from your computer or mobile device. Digitized and scanned documents are supported.",
            "step_1_meta": "Supports PDF 20MB - 100MB",
            "step_2_title": "2. Choose language & mode",
            "step_2_desc": "Select the target translation language, specify page ranges, and enable OCR processing as needed.",
            "step_2_meta": "Multi-threaded async processing",
            "step_3_title": "3. Compare side-by-side & export",
            "step_3_desc": "Compare original and translated paragraphs side-by-side. Export the output to Microsoft Word or bilingual PDF.",
            "step_3_meta": "DOCX, TXT, ZIP Formats",

            // Welcome Pricing Section
            "welcome_pricing_eyebrow": "Transparent Pricing",
            "welcome_pricing_title": "Flexible Pricing for Every Need",
            "welcome_pricing_subtitle": "Start completely free or upgrade to Pro to unlock advanced AI and batch processing.",
            "welcome_billing_monthly": "Monthly",
            "welcome_billing_yearly": "Yearly",
            "welcome_billing_save": "Save 32%",
            "welcome_meta_title": "PDF-Lingua | Intelligent Bilingual PDF Translation & Specialized AI Assistant",
            "tier_guest_name": "Guest User",
            "tier_guest_desc": "Instant trial without creating an account",
            "tier_guest_price": "$0",
            "tier_guest_period": "trial",
            "tier_guest_btn": "Try It Now",
            "tier_free_name": "Free Account",
            "tier_free_desc": "Best for students and occasional document reading",
            "tier_free_price": "0 VND",
            "tier_free_period": "forever",
            "tier_free_period_month": "/ month",
            "tier_free_btn": "Sign Up Free",
            "tier_free_item_1": "Process up to <strong>5 documents / day</strong>",
            "tier_free_item_2": "Vietnamese OCR up to <strong>100 pages / month</strong>",
            "tier_free_item_3": "Visual side-by-side 2-column view",
            "tier_free_item_4": "7-day processing history retention",
            "tier_free_item_5": "AI Copilot contextual document Q&A",
            "tier_free_item_6": "Export to Microsoft Word (.DOCX)",
            "tier_pro_name": "Pro Tier",
            "tier_pro_desc": "Optimized for researchers, translators, and educators",
            "tier_pro_price": "49,000 VND",
            "tier_pro_period": "/ month",
            "tier_pro_period_month": "/ month",
            "tier_pro_btn": "Upgrade to Pro",
            "tier_pro_badge": "Most Popular",
            "tier_pro_item_1": "<strong>Unlimited</strong> document uploads",
            "tier_pro_item_2": "Deep Vietnamese OCR <strong>500 pages / month</strong>",
            "tier_pro_item_3": "AI Copilot <strong>contextual document Q&A</strong>",
            "tier_pro_item_4": "Large document summarization via Map-Reduce",
            "tier_pro_item_5": "Export <strong>Microsoft Word (.DOCX) & ZIP archives</strong>",
            "tier_pro_item_6": "Priority tech support & User ID directory isolation",

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
            "footer_badge_rbac": "RBAC Access Control",
            "footer_tech_ocr": "Vietnamese OCR & Deskew",
            "footer_tech_layout": "Smart Layout Reading Order",
            "footer_tech_mapreduce": "Distributed Map-Reduce Summarization",
            "footer_tech_copilot": "Copilot Document Q&A Assistant",
            "footer_tech_export": "Word .DOCX & ZIP Export",
            "footer_contact_email": "Contact: huytamnguyenle2608@gmail.com",

            // Legal Modal Detailed Content
            "terms_callout_title": "Rights Overview:",
            "terms_callout_desc": "You retain full ownership of uploaded PDF documents. Machine translation is provided for academic reference.",
            "legal_toc_label": "Table of Contents:",
            "terms_toc_1": "1. Copyright",
            "terms_toc_2": "2. Terms of Use",
            "terms_toc_3": "3. Tiers & Limits",
            "terms_toc_4": "4. Disclaimer",
            "terms_h1": "1. Intellectual Property & Copyright",
            "terms_p1": "Users retain full ownership and copyright of PDF documents uploaded to the system as well as extraction and translation outputs. PDF-Lingua commits not to own, copy, or distribute your documents to any third party beyond the scope of processing requested translations.",
            "terms_h2": "2. Acceptable Use Policy",
            "terms_p2": "Users agree not to use the system to process or disseminate documents containing malware, illegal material, or content infringing upon privacy or intellectual rights. Unauthorized tampering, reverse engineering, or denial-of-service attacks against our servers are strictly prohibited.",
            "terms_h3": "3. Service Tier Limits",
            "terms_p3_free": "Free Tier (Guest & Basic Users): Processing limit up to 20 MB/file and up to 100 pages/document. Supports digital text extraction and standard OCR.",
            "terms_p3_pro": "Pro Tier: Expanded processing limit up to 100 MB/file with advanced AI features (Map-Reduce Summarization, AI Copilot Document Q&A).",
            "terms_h4": "4. Disclaimer",
            "terms_p4": "Text extraction, OCR recognition, and automated translation are driven by machine learning models. While the system strives for highest accuracy, 100% semantic perfection is not guaranteed and machine output cannot substitute for certified legal translations.",

            "privacy_callout_title": "Security Commitment:",
            "privacy_callout_desc": "PDF files are processed in isolated sessions and automatically purged. Passwords are encrypted with Bcrypt.",
            "privacy_toc_1": "1. Data Collection",
            "privacy_toc_2": "2. Auto-Cleanup",
            "privacy_toc_3": "3. Encryption Standards",
            "privacy_toc_4": "4. Data Protection",
            "privacy_h1": "1. Data Collection & Scope of Use",
            "privacy_p1": "PDF-Lingua only collects the minimal data required to deliver document parsing and translation services:",
            "privacy_p1_item1": "PDF files temporarily uploaded during your active session.",
            "privacy_p1_item2": "Registered account credentials (Email address, Display name). Passwords are one-way hashed and never stored in plaintext.",
            "privacy_p1_item3": "Anonymous technical metrics (IP address, request timestamps) used strictly for rate limiting and abuse prevention.",
            "privacy_h2": "2. Storage Policy & Automated Cleanup",
            "privacy_p2": "All PDF documents and temporary intermediate files generated during processing are stored in protected temporary directories and automatically cleaned up after session completion. Users retain full rights to delete their document processing history at any time.",
            "privacy_h3": "3. Encryption & System Security Standards",
            "privacy_h3_item1": "Passwords: Built with industry-standard bcrypt hashing utilizing 12 random salt rounds.",
            "privacy_h3_item2": "Sessions: Secured via expirable JSON Web Tokens (JWT).",
            "privacy_h3_item3": "Data Isolation: User documents and data are partitioned to completely prevent unauthorized cross-tenant access.",
            "privacy_h4": "4. Protection Commitment",
            "privacy_p4": "We strictly do not sell, rent, trade, or disclose personal data and document contents to any third parties.",

            "feedback_section_project": "Project Information",
            "feedback_project_desc": "Project: PDF-Lingua - PDF text extraction, multilingual translation, and AI assistant platform.",
            "feedback_section_team": "Team Members",
            "feedback_section_contact": "Contact Information",
            "feedback_contact_email_lbl": "Support Email:",
            "feedback_copy_btn": "Copy",
            "feedback_contact_source_lbl": "Source Code",
            "feedback_goto_repo": "Go to repository",
            "feedback_section_feedback": "Send Feedback to the Team",
            "feedback_lbl_name": "Full Name",
            "feedback_lbl_name_req": "Full Name <span class=\"text-danger\">*</span>",
            "feedback_lbl_email": "Contact Email",
            "feedback_lbl_email_req": "Contact Email <span class=\"text-danger\">*</span>",
            "feedback_lbl_topic": "Feedback Topic",
            "feedback_topic_bug": "Report translation / OCR bug",
            "feedback_topic_feature": "Feature suggestion",
            "feedback_topic_support": "Question / User support",
            "feedback_topic_other": "Other feedback",
            "feedback_lbl_message": "Feedback Message",
            "feedback_lbl_message_req": "Feedback Message <span class=\"text-danger\">*</span>",
            "feedback_placeholder_message": "Describe your feedback or bug details...",
            "feedback_btn_submit": "Submit Feedback",
            "feedback_legal_meta": "Version: v1.0.0 * Effective date: 28/10/2026",
            "auth_no_account_register": "Don't have an account? <a href=\"index.html#register\" id=\"linkSwitchRegister\">Sign up now</a>",

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
            "feedback_topic_other": "General Feedback",

            // HTTP Errors & Dynamic Status Messages
            "http_error_400": "Invalid request. Please check your input.",
            "http_error_401": "Your session has expired or is invalid. Please sign in again.",
            "http_error_403": "You do not have permission to perform this action.",
            "http_error_404": "The requested resource could not be found.",
            "http_error_413": "File size exceeds the permitted limit.",
            "http_error_429": "Too many requests. Please wait a moment and try again.",
            "http_error_500": "Internal server error occurred. Please try again later.",
            "http_error_default": "A network error occurred. Please try again.",
            "status_completed": "completed",
            "preview_loading_server": "Loading PDF preview from server...",
            "toast_preparing_file": "Preparing .{format} file...",
            "toast_email_copied": "Email address copied to clipboard!",
            "toast_feedback_sent": "Thank you! Your feedback has been sent to our team.",
            "toast_legal_accepted": "Thank you! Terms & Privacy agreement recorded.",
            "toast_translation_copied": "Full translation copied to clipboard!",
            "toast_original_copied": "Original text copied to clipboard!",
            "toast_summary_copied": "AI summary copied to clipboard!",
            "toast_workspace_reset": "Workspace session reset successfully.",
            "toast_upload_required": "Please upload a PDF file to begin!",
            "toast_admin_denied": "You do not have administrative privileges!",

            // Dynamic Progress & Statuses
            "Đang xử lý...": "Processing...",
            "Đang tải tài liệu lên máy chủ...": "Uploading document to server...",
            "Đang nhận dạng OCR văn bản...": "Running OCR text recognition...",
            "Đang dịch thuật văn bản...": "Translating text content...",
            "Đang xếp hàng chờ...": "Queued in line...",
            "Đang phân tích & dịch thuật...": "Analyzing & translating...",
            "Hoàn tất xử lý": "Processing complete",
            "Sẵn sàng": "Ready",

            // Common Dynamic Toast Sentences
            "Đã sao chép toàn bộ bản dịch vào bộ nhớ tạm!": "Full translation copied to clipboard!",
            "Đã sao chép văn bản gốc vào clipboard!": "Original text copied to clipboard!",
            "Đã sao chép vào bộ nhớ tạm!": "Copied to clipboard!",
            "Chưa có nội dung bản dịch để sao chép!": "No translated content to copy!",
            "Không thể sao chép văn bản.": "Failed to copy text to clipboard.",
            "Vui lòng tải lên tệp PDF để bắt đầu!": "Please upload a PDF file to begin!",
            "Vui lòng chọn một tệp PDF trước khi bắt đầu!": "Please select a PDF file before starting!",
            "Tài liệu đã được dịch thuật thành công!": "Document translated successfully!",
            "Đã hủy tác vụ xử lý thành công.": "Task cancelled successfully.",
            "Tác vụ đang tiếp tục xử lý ở chế độ nền.": "Task continues processing in the background.",
            "Lỗi kết nối khi tải bản xem trước PDF.": "Connection error while loading PDF preview.",
            "Chưa có tài liệu để tải về!": "No document available for download!",
            "Tính năng tải tệp Word (.docx) chỉ dành riêng cho tài khoản Pro VIP!": "Word export (.docx) is exclusive to Pro VIP accounts!",
            "Chưa có nội dung bản dịch để tải về!": "No translated text to export!",
            "Chưa có nội dung văn bản gốc để tải về!": "No original text to export!",
            "Thiếu nội dung văn bản gốc để xuất song ngữ!": "Missing original text for bilingual export!",
            "Thiếu nội dung bản dịch để xuất song ngữ!": "Missing translated text for bilingual export!",
            "Cảm ơn bạn! Đã ghi nhận đồng ý Điều khoản & Bảo mật của PDF-Lingua.": "Thank you! Terms & Privacy agreement recorded.",
            "Cảm ơn bạn đã gửi phản hồi đóng góp cho nhóm phát triển PDF-Lingua!": "Thank you! Your feedback has been sent to our team."
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
         * Get localized HTTP error message by status code.
         * @param {number} status
         * @param {string} fallbackMsg
         * @returns {string}
         */
        getHttpError: function (status, fallbackMsg) {
            const errorKeys = {
                400: 'http_error_400',
                401: 'http_error_401',
                403: 'http_error_403',
                404: 'http_error_404',
                413: 'http_error_413',
                429: 'http_error_429',
                500: 'http_error_500'
            };
            const key = errorKeys[status];
            if (key) {
                return this.t(key);
            }
            return fallbackMsg || this.t('http_error_default');
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
    }
    if (typeof window !== 'undefined') {
        window.i18n = i18n;
        window.PDFL_i18n = i18n;
    }
})(typeof window !== 'undefined' ? window : globalThis);
