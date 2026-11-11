# Thiết Kế Kiến Trúc Hệ Thống

> **Dự án**: PDF Lingua - Nền tảng Web Trích xuất PDF, OCR, Dịch thuật Đa ngôn ngữ và Trợ lý AI  
> **Nhóm thực hiện**: Nhóm 19 (Nguyễn Lê Huy Tâm, Huỳnh Đình Chấn)  

---

## 1. Phong cách kiến trúc phân tầng (Layered Architecture)

Hệ thống **PDF Lingua** được thiết kế tuân thủ mô hình kiến trúc phân tầng kết hợp hướng dịch vụ (Service-Oriented Layered Architecture). Kiến trúc đảm bảo các nguyên tắc:
- **Phân tách trách nhiệm (Separation of Concerns)**: Mỗi tầng chịu trách nhiệm cho một nhóm chức năng rõ ràng.
- **Khả năng mở rộng độc lập (Scalability)**: Các dịch vụ nền như OCR và AI có thể mở rộng độc lập mà không ảnh hưởng tầng Presentation.
- **Tính bảo trì và kiểm thử (Testability & Maintainability)**: Dễ dàng viết Unit Test và Integration Test cho từng Service.

### Mô hình 3 tầng chính

```text
+-----------------------------------------------------------------------------------+
|                  TẦNG 1: PRESENTATION LAYER (Client Browser)                      |
|  - Giao diện người dùng SPA (Single Page Application): HTML5, CSS Tokens, JS ES6+ |
|  - Dual-pane Workspace (cột gốc song song cột dịch/tóm tắt)                       |
|  - API Client với HTTP Fetch API và JWT Authorization Header                      |
+-----------------------------------------------------------------------------------+
                                      |
                         (HTTPS / RESTful API / JSON)
                                      v
+-----------------------------------------------------------------------------------+
|             TẦNG 2: APPLICATION & SERVICE LAYER (FastAPI Backend)                 |
|  - Routers: Auth Router (/api/auth), Process Router (/api/process),               |
|             Admin Router (/api/admin), Pricing Router (/api/pricing)              |
|  - Dependency Injection & Middleware: CORS, Exception Handler, Rate Limiter       |
|  - Business Services: AuthService, PDFService, OCRService,                        |
|                       TranslationService, AIService, AdminService                 |
+-----------------------------------------------------------------------------------+
                                      |
                         (ORM / Subprocess / HTTP APIs)
                                      v
+-----------------------------------------------------------------------------------+
|                 TẦNG 3: DATA & INFRASTRUCTURE LAYER                               |
|  - Cơ sở dữ liệu quan hệ: SQLite (Dev) / PostgreSQL (Prod) qua SQLAlchemy ORM     |
|  - Công cụ bóc tách PDF: PyMuPDF (fitz) + pdfplumber                              |
|  - Công cụ nhận dạng quang học: Tesseract OCR Engine (ngôn ngữ vie + eng)         |
|  - Dịch vụ đám mây bên ngoài: Google Gemini API / OpenAI API / Deep-Translator   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Phân rã 8 phân hệ kiến trúc cốt lõi (Communities)

Căn cứ theo bản đặc tả kiến trúc tại `.plan/.project_graph.md`, hệ thống gồm 8 phân hệ cốt lõi:

1. **C1 - Auth & Identity (Xác thực và phân quyền)**:
   - Quản lý định danh người dùng qua email chuẩn hóa.
   - Băm mật khẩu một chiều an toàn bằng thuật toán `bcrypt` (12 rounds salt).
   - Cấp phát và giải mã JSON Web Token (JWT) với thuật toán `HS256`.
   - Phân quyền theo 3 vai trò: `free`, `pro`, `admin`.

2. **C2 - PDF Processing Engine (Động cơ xử lý PDF cốt lõi)**:
   - Tiếp nhận luồng tải lên multipart an toàn.
   - Kiểm tra magic bytes `%PDF-` chống tấn công giả mạo đuôi file.
   - Bóc tách văn bản số bằng thư viện PyMuPDF (`fitz`), bảo toàn thứ tự đọc tự nhiên (Natural Reading Order).

3. **C3 - OCR Pipeline (Quy trình nhận dạng quang học)**:
   - Tự động phát hiện trang tài liệu scan hoặc ảnh chụp không có text layer.
   - Render trang PDF thành ảnh bitmap chất lượng cao 300 DPI.
   - Tiền xử lý tăng độ tương phản bằng Pillow.
   - Thực thi nhận dạng ký tự quang học qua Tesseract OCR với bộ dữ liệu song ngữ `vie+eng`.

4. **C4 - Translation Engine (Động cơ dịch thuật đa ngôn ngữ)**:
   - Tự động nhận diện ngôn ngữ nguồn và chuyển đổi sang ngôn ngữ đích.
   - Bộ thuật toán `chunk_text()` phân tách thông minh chuỗi văn bản dài thành các đoạn nhỏ ($\le$ 4500 ký tự) không ngắt giữa câu.
   - Cơ chế Fallback đa tầng chống gián đoạn dịch vụ: Google GTX (Ưu tiên 1) $\rightarrow$ MyMemory / Deep-Translator (Dự phòng tầng 2).

5. **C5 - AI Feature Suite (Bộ tính năng Trí tuệ nhân tạo Pro)**:
   - Tóm tắt tài liệu thông minh theo phương pháp Map-Reduce cho tài liệu dung lượng lớn.
   - Trợ lý hỏi đáp tương tác trực tiếp với tài liệu theo mô hình RAG (Retrieval-Augmented Generation).
   - Kiểm soát hạn mức hỏi đáp 15 câu/ngày đối với tài khoản Pro.

6. **C6 - Export & Delivery (Xuất và phân phối kết quả)**:
   - Định dạng hóa kết quả xuất ra tệp tin TXT (mã hóa chuẩn UTF-8 BOM hiển thị tiếng Việt chính xác trên Windows Notepad).
   - Xuất tệp tin PDF Unicode kết quả.
   - Quản lý tải xuống an toàn qua luồng blob.

7. **C7 - History & Subscription (Lịch sử xử lý và quản lý gói cước)**:
   - Quản lý bảng dữ liệu `processing_histories` cho tài khoản Pro.
   - Quy trình nâng cấp gói Pro tự động qua mã VietQR Napas247 định danh theo mã giao dịch duy nhất.
   - Bảng điều khiển quản trị Admin theo dõi các chỉ số vận hành toàn hệ thống.

8. **C8 - Frontend UI Layer (Giao diện người dùng tương tác)**:
   - Bố cục màn hình làm việc kép (Dual-pane) cho phép đối chiếu văn bản gốc và bản dịch trực quan.
   - Thanh Sidebar điều hướng thu phóng linh hoạt.
   - Hệ thống thông báo trạng thái Toast thời gian thực và các hộp thoại Modal trực quan.

---

## 3. Các luồng dữ liệu chính của hệ thống (Data Flows)

### 3.1. Luồng tải lên và xử lý tài liệu lai (Hybrid PDF Extraction)
1. Người dùng kéo thả tệp PDF vào khung tải lên tại màn hình làm việc.
2. Client kiểm tra kích thước tệp theo hạn ngạch tài khoản (Free $\le$ 20MB, Pro $\le$ 100MB).
3. Client gửi request `POST /api/process/upload-and-translate` kèm JWT token.
4. Backend kiểm tra magic bytes `%PDF-` để xác thực tính toàn vẹn của tệp tin.
5. PyMuPDF duyệt qua từng trang tài liệu:
   - Nếu trang có lớp văn bản số: trích xuất trực tiếp bằng `page.get_text()`.
   - Nếu trang là ảnh scan hoặc có ít hơn 10 ký tự: kích hoạt `OCRService` để chuyển thành ảnh bitmap và chạy Tesseract OCR.
6. Hợp nhất nội dung số và nội dung OCR thành chuỗi văn bản hoàn chỉnh.

### 3.2. Luồng dịch thuật đa ngôn ngữ có cơ chế dự phòng (Translation Fallback)
1. Hệ thống tiếp nhận văn bản nguồn và mã ngôn ngữ đích.
2. Thuật toán `chunk_text()` chia nhỏ văn bản thành các đoạn $\le$ 4500 ký tự tại các dấu ngắt câu hoặc ngắt đoạn tự nhiên.
3. Hệ thống gửi yêu cầu dịch từng đoạn qua động cơ chính (Google GTX).
4. Nếu gặp lỗi kết nối hoặc HTTP 429 (Rate Limit), hệ thống tự động bắt ngoại lệ và kích hoạt động cơ dự phòng tầng 2 (MyMemory / Deep-Translator).
5. Ghép nối các đoạn dịch theo đúng vị trí ban đầu và trả về bản dịch hoàn chỉnh song song với bản gốc.

### 3.3. Luồng xác thực an toàn và kiểm soát phân quyền (Auth & RBAC)
1. Khách đăng ký tài khoản mới: mật khẩu được băm một chiều bằng `bcrypt` trước khi lưu vào bảng `users`.
2. Khi đăng nhập: hệ thống xác thực mật khẩu qua `verify_password()`, cấp JWT token chứa `user_id`, `role`, thời hạn hết hạn (`exp`).
3. Mọi request cần quyền hạn đều truyền JWT qua header `Authorization: Bearer <token>`.
4. Middleware Backend giải mã token và kiểm tra phân quyền (RBAC) trước khi cho phép thực thi dịch vụ.

