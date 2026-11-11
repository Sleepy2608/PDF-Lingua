# Lược Đồ Lớp (Class Diagram)

> Sẽ hoàn thiện sơ đồ lớp sau

## 1. Sơ đồ Lớp tổng thể hệ thống

```mermaid
classDiagram
    direction TB

    class UserRole {
        <<enumeration>>
        FREE
        PRO
        ADMIN
    }

    class User {
        +int id
        +string email
        +string hashed_password
        +string full_name
        +UserRole role
        +bool is_active
        +datetime created_at
        +normalise_email(email) str
        +verify_password(plain) bool
    }

    class Document {
        +int id
        +int user_id
        +string original_filename
        +string stored_filename
        +string stored_path
        +int file_size_bytes
        +int page_count
        +string target_lang
        +datetime created_at
    }

    class ProcessingHistory {
        +int id
        +int user_id
        +string original_filename
        +int file_size_bytes
        +string action_type
        +string target_lang
        +string result_summary
        +string result_path
        +string status
        +datetime created_at
    }

    class PricingPlan {
        +int id
        +string code
        +string name
        +int price_vnd
        +int duration_days
        +int max_upload_size_mb
        +int max_pages
    }

    class Subscription {
        +int id
        +int user_id
        +int plan_id
        +string status
        +datetime starts_at
        +datetime expires_at
        +string payment_ref
    }

    class PDFService {
        +validate_pdf(file, max_mb) bool
        +check_magic_bytes(file_path) bool
        +extract_digital_text(doc) str
        +process_hybrid_pages(doc) str
    }

    class OCRService {
        +render_pdf_to_images(doc, dpi) list
        +preprocess_image(image) Image
        +perform_ocr(image, lang) str
    }

    class TranslationService {
        +detect_language(text) str
        +chunk_text(text, max_chars) list
        +translate_chunk(chunk, src, dest) str
        +translate_full_text(text, src, dest) str
    }

    class AIService {
        +summarize_document(text, style) str
        +map_reduce_summary(chunks) str
        +chat_document_context(query, doc_text) str
        +retrieve_relevant_chunks(query, doc) list
    }

    class AuthService {
        +hash_password(password) str
        +verify_password(plain, hashed) bool
        +create_access_token(data, expires_delta) str
        +get_current_user(token) User
    }

    class AdminService {
        +get_system_stats() dict
        +list_users(filter_role, search) list
        +change_user_role(user_id, new_role) bool
        +toggle_user_status(user_id) bool
    }

    User "1" --> "1" UserRole : has role
    User "1" *-- "0..*" Document : owns
    User "1" *-- "0..*" ProcessingHistory : records
    User "1" *-- "0..*" Subscription : subscribes
    PricingPlan "1" o-- "0..*" Subscription : applied to

    PDFService ..> Document : processes
    OCRService ..> Document : scans
    TranslationService ..> Document : translates
    AIService ..> Document : analyzes
    AuthService ..> User : authenticates
    AdminService ..> User : manages
```

## 2. Đặc tả các Lớp Thực thể Dữ liệu (ORM Models)

1. **`User` (Thực thể Người dùng)**: Đại diện cho bảng `users`. Quản lý thông tin tài khoản, mật khẩu băm `bcrypt` (12 rounds salt), phân quyền qua Enum `UserRole` (`FREE`, `PRO`, `ADMIN`) và trạng thái hoạt động `is_active`.
2. **`Document` (Thực thể Tài liệu tải lên)**: Đại diện cho bảng `documents`. Lưu trữ siêu dữ liệu của tệp PDF (tên gốc, đường dẫn an toàn trên máy chủ, dung lượng bytes, số lượng trang).
3. **`ProcessingHistory` (Thực thể Lịch sử xử lý)**: Đại diện cho bảng `processing_histories`. Ghi nhận lịch sử bóc tách, dịch thuật hoặc tóm tắt cho tài khoản Pro.
4. **`PricingPlan` và `Subscription` (Thực thể Gói cước và Đăng ký)**: Định nghĩa các gói dịch vụ và theo dõi chu kỳ kích hoạt, mã đối soát giao dịch VietQR.

## 3. Đặc tả các Lớp Dịch vụ Nghiệp vụ (Service Layer)

1. **`PDFService`**: Thẩm định an toàn tệp PDF (kiểm tra MIME, magic bytes `%PDF-`), bóc tách văn bản số qua PyMuPDF, điều phối xử lý lai (hybrid).
2. **`OCRService`**: Render trang PDF sang ảnh bitmap 300 DPI, tăng cường tương phản bằng Pillow và nhận dạng quang học Tesseract OCR song ngữ `vie + eng`.
3. **`TranslationService`**: Nhận diện ngôn ngữ nguồn, chia nhỏ đoạn an toàn $\le$ 4500 ký tự không cắt ngang câu và chuyển đổi Fallback đa tầng (Google GTX $\rightarrow$ MyMemory / Deep-Translator).
4. **`AIService`**: Tóm tắt văn bản thông minh (kỹ thuật Map-Reduce) và Trợ lý AI hỏi đáp tài liệu theo ngữ cảnh RAG (15 câu/ngày).
5. **`AuthService`**: Quản lý băm mật khẩu `bcrypt`, xác thực thông tin đăng nhập và cấp phát token JWT an toàn.
6. **`AdminService`**: Tập hợp số liệu thống kê toàn hệ thống, tìm kiếm/lọc danh sách tài khoản, thực thi phân quyền và khóa/mở khóa tài khoản.
