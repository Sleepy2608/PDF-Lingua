# PDF-Lingua - Kế Hoạch Nhóm, Phân Công Nhiệm Vụ & Báo Cáo Đóng Góp (Master Assignment & Team Contribution Report)

- **Dự án**: **PDF Lingua** - Nền tảng Web trích xuất văn bản từ tài liệu PDF, nhận dạng ký tự quang học OCR, dịch thuật đa ngôn ngữ và trợ lý AI tóm tắt, hỏi đáp tài liệu thông minh.
- **Học phần**: Đồ án Thực tế Công nghệ Phần mềm (Nhóm 19)
- **Jira Project Key**: `PDFL`
- **Jira Board & Summary**: [https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary](https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary)
- **Tài liệu tham chiếu**:
  - Kế hoạch 7 Sprint chi tiết: [Sprint_Plan.md](./Sprint_Plan.md)
  - Product Backlog chi tiết: [PDF_Lingua_Jira_Backlog.md](./PDF_Lingua_Jira_Backlog.md)
  - Báo cáo phân công thực hiện EPIC 15 & 16: [phan_cong_thuc_hien_epic15_epic16.md](../.plan/.extra/phan_cong_thuc_hien_epic15_epic16.md)
- **Thời gian thực hiện**: 13/10/2026 - 01/12/2026 (7 tuần / 7 Sprint)
- **Ngày cập nhật lần cuối**: `16/11/2026` (Đồng bộ hóa 100% từ Tuần 1 đến Tuần 6 theo tiến độ thực tế Git commit, test suite và Jira Board)

---

## 1. Danh Sách Thành Viên & Phân Định Vai Trò Chính

Dự án được xây dựng và phát triển toàn diện bởi 2 thành viên chính, với sự phối hợp chặt chẽ giữa Backend, Kiến trúc AI, Kiểm thử tự động và Frontend UI/UX:

| STT | MSSV | Họ và tên | Vai trò | Nhiệm vụ |
| :---: | :---: | :--- | :---: | :--- |
| 1 | `056206011188` | **Nguyễn Lê Huy Tâm**<br>*(Jira: `NT`)* | **Trưởng nhóm** | - Thiết kế kiến trúc hệ thống, Backend FastAPI, cấu hình CSDL và bảo mật.<br>- Phát triển core xử lý trích xuất PDF, luồng pipeline E2E và quản lý lưu trữ tệp.<br>- Tích hợp động cơ dịch thuật đa ngôn ngữ và thuật toán chia đoạn văn bản.<br>- Hiện thực các tính năng AI: Tóm tắt văn bản và Trợ lý AI hỏi đáp tài liệu (RAG).<br>- Xây dựng module Admin quản trị, phân quyền tài khoản và gói dịch vụ (Free/Pro).<br>- Biên soạn tài liệu kiến trúc, hướng dẫn cài đặt và tài liệu người dùng. |
| 2 | `077206002307` | **Huỳnh Đình Chấn** | **Thành viên** | - Thiết kế và phát triển giao diện người dùng UI/UX toàn hệ thống.<br>- Xây dựng chức năng xác thực người dùng (Đăng ký, Đăng nhập, JWT, Hồ sơ cá nhân).<br>- Tiền xử lý hình ảnh OCR nâng cao (khử nghiêng, xoay trang, phát hiện trang trắng).<br>- Xây dựng công cụ benchmark hiệu năng, tối ưu bộ nhớ và bộ đo chất lượng trích xuất.<br>- Phát triển chức năng quản lý tài liệu, lưu trữ lịch sử xử lý và chính sách dữ liệu.<br>- Thiết lập ma trận bảo mật, kiểm soát an toàn tải file và hạn mức tài nguyên.<br>- Phát triển các tính năng mở rộng (xử lý lô, tải ZIP, xuất DOCX, xem trước PDF).<br>- Xây dựng tài liệu thiết kế phần mềm (Sơ đồ Use Case, Lược đồ Lớp). |

---

## 2. Kế Hoạch Nhóm & Lộ Trình Phát Triển 7 Sprint (Roadmap Strategy)

Hệ thống được tổ chức phát triển theo phương pháp Scrum/Agile với chu kỳ **1 tuần / 1 Sprint** trong 4 giai đoạn chính:

```
[Tuần 1 - 3: Core Logic & Gói Free] -> [Tuần 4 - 5: Tính Năng Pro & Admin] -> [Tuần 6: Tích Hợp AI Toàn Diện] -> [Tuần 7: Kiểm Thử, Triển Khai & Bàn Giao Nghiệm Thu]
```

- **Tuần 1 (Sprint 1: 13/10 - 20/10/2026) - Phân tích yêu cầu, thiết kế hệ thống & khởi tạo khung dự án**: Khảo sát nghiệp vụ, Use Case, Activity, ERD, kiến trúc phần mềm, khởi tạo repo GitHub, Backend FastAPI, Frontend HTML/CSS/JS, cấu hình `.env`, `.gitignore`, kết nối DB, logging, healthcheck, CORS.
- **Tuần 2 (Sprint 2: 20/10 - 27/10/2026) - Hệ thống tài khoản, xác thực & cốt lõi xử lý PDF/OCR**: User schema, bcrypt password hashing, đăng ký, đăng nhập, JWT token, tải PDF an toàn, trích xuất text số PyMuPDF/pdfplumber, nhận dạng scan OCR Tesseract, Workspace UI, bộ test suite nền tảng (Services, Auth, API, E2E, Bcrypt, Injection).
- **Tuần 3 (Sprint 3: 27/10 - 03/11/2026) - Quản lý tài liệu, OCR nâng cao, dịch thuật cốt lõi & kiểm thử đo lường**: Quản lý kho file cá nhân, tiền xử lý OCR (deskew, rotate, blank page), động cơ dịch thuật `deep-translator`, chia đoạn chống timeout, xuất file TXT/PDF Unicode, kéo thả file, điều khoản dịch vụ; bộ test đánh giá độ chính xác tiếng Việt, layout metrics, benchmark hiệu năng, tối ưu bộ nhớ và xử lý song song.
- **Tuần 4 (Sprint 4: 03/11 - 10/11/2026) - Dịch thuật fallback, xuất file, lịch sử, admin cơ bản & quyền lợi gói**: Xử lý lỗi dịch thuật đa tầng, kiểm thử file xuất, thiết kế bảng dữ liệu lịch sử, API xem/mở lại/xóa lịch sử, quyền lợi Free (20MB) vs Pro (100MB), Dashboard admin cơ bản, bộ test ma trận bảo mật (Security Matrix), giới hạn tải lên và tài liệu kiến trúc.
- **Tuần 5 (Sprint 5: 10/11 - 17/11/2026) - Lịch sử Pro, Quản trị Admin, Hạn mức Free/Pro, Mở rộng, Thiết kế đồ án, Avatar/Billing & Thống kê/Truy xuất AI**: Lịch sử Pro, Admin Console nâng cao, phân quyền RBAC, Batch ZIP, DOCX export, PDF preview inline, nộp hồ sơ thiết kế đồ án (Kiến trúc `PDFL-269`, Use Case `PDFL-270`, Class Diagram `PDFL-271`), khởi động Avatar người dùng (`PDFL-272`, `PDFL-273`), Billing (`PDFL-274`, `PDFL-275`, `PDFL-276`), Bổ sung thống kê sử dụng dịch vụ (`PDFL-262` - Chấn) và Cải thiện truy xuất nguồn câu trả lời AI (`PDFL-263` - Tâm).
- **Tuần 6 (Sprint 6: 17/11 - 24/11/2026) - Tích Hợp AI: Tóm Tắt Văn Bản & Trợ Lý Hỏi Đáp Tài Liệu**: Tích hợp mô hình ngôn ngữ lớn (LLM API), prompt tóm tắt, Map-Reduce cho tài liệu dài, Trợ lý AI chat hỏi đáp theo ngữ cảnh (RAG QA Chatbot), anti-hallucination guardrails, giao diện chat, hoàn thành trọn vẹn 26 work items (74 SP - 100% Done) đúng theo Jira Board.
- **Tuần 7 (Sprint 7: 22/11 - 29/11/2026) - Kiểm thử toàn diện, Triển khai, Tài liệu bàn giao & Nghiệm thu đồ án**: Triển khai trọn gói 45 work items (98 Story Points: 69 SP Done / 29 SP To Do), hoàn tất báo cáo kỹ thuật (`PDFL-248`), slide thuyết trình (`PDFL-249`), kịch bản demo (`PDFL-250`), hướng dẫn sử dụng web (`PDFL-279`), bộ test case chức năng (`PDFL-199`), hình ảnh hướng dẫn (`PDFL-246`), rà soát an toàn repo (`PDFL-251`), phương án triển khai (`PDFL-228`) và tổng duyệt bảo vệ đồ án.

---

## 3. BẢNG PHÂN CÔNG & KẾT QUẢ THỰC HIỆN CHI TIẾT TỪNG TUẦN (TUẦN 1 ĐẾN TUẦN 7)

### 📅 TUẦN 1 (Sprint 1: 13/10/2026 - 20/10/2026)
- **Trọng tâm**: Khảo sát nghiệp vụ, phân tích thiết kế, khởi tạo repository, xây dựng khung Backend/Frontend, cấu hình cơ sở dữ liệu, an toàn môi trường và health check.
- **Trạng thái**: ✅ **100% Hoàn thành**

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Story Points | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-1` | Xác định đối tượng sử dụng: Khách, Free, Pro, Admin | EPIC 01 | Nguyễn Lê Huy Tâm | 3 | Tài liệu phân tích yêu cầu | **Done** |
| `PDFL-2` | Chốt danh sách chức năng chính và chức năng mở rộng | EPIC 01 | Nguyễn Lê Huy Tâm | 3 | Tài liệu Product Backlog | **Done** |
| `PDFL-3` | Xác định quyền lợi, giới hạn gói Free (20MB) và Pro (100MB) | EPIC 01 | Nguyễn Lê Huy Tâm | 3 | Bảng so sánh quyền lợi gói | **Done** |
| `PDFL-4` | Xác định quy trình xử lý tài liệu từ upload đến xuất kết quả | EPIC 01 | Nguyễn Lê Huy Tâm | 3 | Sơ đồ luồng xử lý tài liệu | **Done** |
| `PDFL-21` | Xây dựng Use Case Diagram | EPIC 01 | Huỳnh Đình Chấn | 3 | `Docs/diagrams/use_case_diagram.png` | **Done** |
| `PDFL-22` | Xây dựng sơ đồ hoạt động (Activity Diagram) các luồng chính | EPIC 01 | Huỳnh Đình Chấn | 3 | `Docs/diagrams/activity_diagram.png` | **Done** |
| `PDFL-23` | Thiết kế kiến trúc tổng thể (Frontend, Backend, DB, OCR, AI) | EPIC 01 | Nguyễn Lê Huy Tâm | 3 | `kien_truc_he_thong.md` | **Done** |
| `PDFL-24` | Thiết kế sơ đồ ERD và mô hình dữ liệu quan hệ | EPIC 01 | Huỳnh Đình Chấn | 3 | `Docs/diagrams/erd_diagram.png` | **Done** |
| `PDFL-25` | Thống nhất cấu trúc và quy chuẩn API giữa Frontend và Backend | EPIC 01 | Nguyễn Lê Huy Tâm | 3 | Tài liệu API conventions | **Done** |
| `PDFL-26` | Xác định yêu cầu phi chức năng (bảo mật, hiệu năng, UX) | EPIC 01 | Nguyễn Lê Huy Tâm | 2 | Tài liệu NFR specification | **Done** |
| `PDFL-27` | Tạo repository GitHub `pdf-lingua` | EPIC 02 | Nguyễn Lê Huy Tâm | 2 | GitHub repo Sleepy2608/PDF-Lingua | **Done** |
| `PDFL-28` | Xây dựng cấu trúc thư mục Frontend và Backend | EPIC 02 | Nguyễn Lê Huy Tâm | 2 | Cây thư mục `Code/backend`, `Code/frontend` | **Done** |
| `PDFL-29` | Khởi tạo ứng dụng Frontend bằng HTML, CSS và JavaScript | EPIC 02 | Huỳnh Đình Chấn | 3 | `Code/frontend/index.html`, `style.css` | **Done** |
| `PDFL-30` | Khởi tạo Backend bằng Python và FastAPI | EPIC 02 | Nguyễn Lê Huy Tâm | 3 | `Code/backend/app/main.py` | **Done** |
| `PDFL-31` | Cấu hình môi trường Python, `requirements.txt` và `venv` | EPIC 02 | Nguyễn Lê Huy Tâm | 2 | `Code/backend/requirements.txt` | **Done** |
| `PDFL-32` | Cấu hình các biến môi trường trong `.env` | EPIC 02 | Nguyễn Lê Huy Tâm | 2 | `Code/backend/.env` | **Done** |
| `PDFL-33` | Tạo `.env.example` và cấu hình `.gitignore`, `.gitattributes` | EPIC 02 | Nguyễn Lê Huy Tâm | 2 | `.env.example`, `.gitignore` | **Done** |
| `PDFL-34` | Cấu hình kết nối database (SQLite / PostgreSQL) | EPIC 02 | Nguyễn Lê Huy Tâm | 3 | `Code/backend/app/core/database.py` | **Done** |
| `PDFL-35` | Thiết lập quy tắc đặt tên branch, commit và Pull Request | EPIC 02 | Nguyễn Lê Huy Tâm | 2 | Tài liệu Git conventions | **Done** |
| `PDFL-36` | Xây dựng API kiểm tra tình trạng Backend (`/health`) | EPIC 02 | Nguyễn Lê Huy Tâm | 2 | `GET /health` trong `main.py` | **Done** |
| `PDFL-37` | Cấu hình môi trường để Frontend gọi API Backend (CORS) | EPIC 02 | Nguyễn Lê Huy Tâm | 2 | `CORSMiddleware` trong `main.py` | **Done** |
| `PDFL-38` | Kiểm tra khởi chạy toàn bộ dự án trên máy phát triển | EPIC 02 | Nguyễn Lê Huy Tâm | 2 | Kiểm thử khởi động server uvicorn | **Done** |
| `PDFL-39` | Xác định phong cách thiết kế, màu sắc, typography giao diện | EPIC 03 | Huỳnh Đình Chấn | 2 | Design system tokens CSS | **Done** |
| `PDFL-40` | Thiết kế thanh điều hướng (Navbar) và bố cục chung | EPIC 03 | Huỳnh Đình Chấn | 3 | Header, navigation bar trong `index.html` | **Done** |
| `PDFL-41` | Xây dựng trang chủ giới thiệu PDF-Lingua và tính năng | EPIC 03 | Huỳnh Đình Chấn | 3 | Hero section, features grid trong `index.html` | **Done** |
| `PDFL-58` | Đảm bảo giao diện responsive trên máy tính và điện thoại | EPIC 03 | Huỳnh Đình Chấn | 3 | CSS media queries trong `style.css` | **Done** |
| `PDFL-60` | Thiết kế cấu trúc module Backend theo nhóm chức năng | EPIC 04 | Nguyễn Lê Huy Tâm | 3 | Cấu trúc packages `core`, `services`, `api` | **Done** |
| `PDFL-61` | Xây dựng các lớp xử lý nghiệp vụ (Service layer pattern) | EPIC 04 | Nguyễn Lê Huy Tâm | 3 | Base classes trong `app/services` | **Done** |
| `PDFL-62` | Chuẩn hóa cấu trúc request và response của API | EPIC 04 | Nguyễn Lê Huy Tâm | 2 | Pydantic BaseModels trong `schemas` | **Done** |
| `PDFL-63` | Xây dựng cơ chế xử lý lỗi chung (Global Exception Handler) | EPIC 04 | Nguyễn Lê Huy Tâm | 3 | `app/core/exceptions.py` | **Done** |
| `PDFL-64` | Cấu hình CORS an toàn cho phát triển và triển khai | EPIC 04 | Nguyễn Lê Huy Tâm | 2 | Cấu hình `allow_origins` trong `main.py` | **Done** |
| `PDFL-68` | Chuẩn hóa HTTP status code và thông báo lỗi rõ ràng | EPIC 04 | Nguyễn Lê Huy Tâm | 2 | HTTP status constants trong `exceptions.py` | **Done** |
| `PDFL-69` | Xây dựng tài liệu API Swagger/OpenAPI tự động | EPIC 04 | Nguyễn Lê Huy Tâm | 2 | `/docs` và `/redoc` trong `main.py` | **Done** |
| `PDFL-70` | Thiết lập logging để theo dõi hoạt động xử lý và lỗi | EPIC 04 | Nguyễn Lê Huy Tâm | 2 | Middleware logging trong `main.py` | **Done** |
| `PDFL-216` | Đảm bảo API key và secret không bị đưa lên GitHub | EPIC 15 | Nguyễn Lê Huy Tâm | 2 | File `.gitignore` (16/10/2026) | **Done** |
| `PDFL-227` | Thiết lập thông báo lỗi, logging và khôi phục sự cố | EPIC 15 | `exceptions.py`, `main.py` (23/10/2026) | **Done** |
| `PDFL-231` | Thiết lập database cho môi trường triển khai | EPIC 16 | Nguyễn Lê Huy Tâm | 3 | `database.py` (SQLite WAL) (22/10/2026) | **Done** |
| `PDFL-232` | Cấu hình biến môi trường và API key trên môi trường production | EPIC 16 | Nguyễn Lê Huy Tâm | 3 | `config.py`, `.env.example` (22/10/2026) | **Done** |
| `PDFL-233` | Cấu hình CORS, domain và HTTPS | EPIC 16 | Nguyễn Lê Huy Tâm | 2 | `CORSMiddleware` (21/10/2026) | **Done** |
| `PDFL-234` | Cài đặt các thành phần cần thiết cho OCR trên server | EPIC 16 | Nguyễn Lê Huy Tâm | 2 | `README.md`, `ocr_service.py` (16/10/2026) | **Done** |
| `PDFL-237` | Thiết lập kiểm tra tình trạng hoạt động và theo dõi lỗi | EPIC 16 | Nguyễn Lê Huy Tâm | 2 | `GET /health` endpoint (21/10/2026) | **Done** |
| `PDFL-241` | Ghi rõ công nghệ sử dụng và yêu cầu cài đặt | EPIC 16 | Nguyễn Lê Huy Tâm | 2 | `README.md` tech stack (16/10/2026) | **Done** |
| `PDFL-243` | Hướng dẫn cấu hình .env và các dịch vụ bên ngoài | EPIC 16 | Nguyễn Lê Huy Tâm | 2 | `README.md`, `.env.example` (20/10/2026) | **Done** |
| `PDFL-245` | Viết tài liệu API và ví dụ request/response | EPIC 16 | Nguyễn Lê Huy Tâm | 3 | OpenAPI Swagger metadata (21/10/2026) | **Done** |

> **Thống kê Tuần 1**:
> - **Tổng số công việc hoàn thành**: 44 tasks (34 tasks Backlog + 10 tasks Môi trường/Kiểm thử/Tài liệu)
> - **Tổng Story Points**: 101 SP (Nguyễn Lê Huy Tâm: 81 SP | Huỳnh Đình Chấn: 20 SP)

---

### 📅 TUẦN 2 (Sprint 2: 20/10/2026 - 27/10/2026)
- **Trọng tâm**: Xây dựng toàn diện cơ chế tài khoản, mã hóa mật khẩu bcrypt, phiên JWT; xây dựng luồng trích xuất PDF số (PyMuPDF/pdfplumber) và nhận dạng scan OCR (Tesseract); xây dựng bộ test tự động nền tảng đầu tiên của dự án.
- **Trạng thái**: ✅ **100% Hoàn thành**

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Story Points | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-65` | Xây dựng API lấy thông tin người dùng hiện tại (`/api/auth/me`) | EPIC 04 | Nguyễn Lê Huy Tâm | 3 | `Code/backend/app/api/auth.py` | **Done** |
| `PDFL-66` | Xây dựng API kiểm tra quyền sử dụng tính năng | EPIC 04 | Nguyễn Lê Huy Tâm | 2 | `app/core/dependencies.py` | **Done** |
| `PDFL-72` | Thiết kế bảng dữ liệu tài khoản người dùng (User schema) | EPIC 05 | Nguyễn Lê Huy Tâm | 3 | `app/models/user.py` | **Done** |
| `PDFL-73` | Xây dựng chức năng đăng ký tài khoản | EPIC 05 | Huỳnh Đình Chấn | 3 | `app/api/auth.py`, `auth.js` | **Done** |
| `PDFL-74` | Kiểm tra email và thông tin đăng ký hợp lệ | EPIC 05 | Huỳnh Đình Chấn | 2 | Regex email & frontend validation | **Done** |
| `PDFL-75` | Mã hóa mật khẩu trước khi lưu vào database (bcrypt 12 rounds) | EPIC 05 | Huỳnh Đình Chấn | 3 | `app/core/security.py` | **Done** |
| `PDFL-76` | Xây dựng chức năng đăng nhập | EPIC 05 | Huỳnh Đình Chấn | 3 | Login API & form đăng nhập | **Done** |
| `PDFL-78` | Xây dựng chức năng đăng xuất | EPIC 05 | Huỳnh Đình Chấn | 2 | Logout handler & xóa JWT cookie/storage | **Done** |
| `PDFL-79` | Xây dựng chức năng xem và cập nhật thông tin tài khoản | EPIC 05 | Huỳnh Đình Chấn | 3 | Modal profile & Update profile API | **Done** |
| `PDFL-80` | Xây dựng chức năng đổi mật khẩu | EPIC 05 | Huỳnh Đình Chấn | 3 | Change password API & validation | **Done** |
| `PDFL-81` | Kiểm soát quyền truy cập của khách, người dùng và Admin | EPIC 05 | Huỳnh Đình Chấn | 3 | Role-based authentication middleware | **Done** |
| `PDFL-82` | Kiểm tra quyền truy cập khi người dùng gọi trực tiếp API | EPIC 05 | Huỳnh Đình Chấn | 3 | Dependency security checks trên router | **Done** |
| `PDFL-83` | Xử lý token hết hạn, tài khoản không tồn tại, sai thông tin | EPIC 05 | Huỳnh Đình Chấn | 2 | JWT decode error handling | **Done** |
| `PDFL-84` | Kiểm tra khả năng truy cập và chỉnh sửa dữ liệu người khác | EPIC 05 | Huỳnh Đình Chấn | 3 | Anti-tampering checks | **Done** |
| `PDFL-85` | Xây dựng API tải tài liệu PDF lên Backend | EPIC 06 | Nguyễn Lê Huy Tâm | 3 | `POST /api/process/upload-and-translate` | **Done** |
| `PDFL-86` | Kiểm tra loại file và nội dung file (chặn file giả mạo PDF) | EPIC 06 | Nguyễn Lê Huy Tâm | 3 | Magic bytes check `%PDF-` | **Done** |
| `PDFL-87` | Áp dụng giới hạn dung lượng: Free 20MB, Pro 100MB | EPIC 06 | Nguyễn Lê Huy Tâm | 3 | File size validation middleware | **Done** |
| `PDFL-88` | Kiểm tra PDF bị hỏng, có mật khẩu hoặc không thể đọc | EPIC 06 | Nguyễn Lê Huy Tâm | 3 | PyPDF parser try-catch checks | **Done** |
| `PDFL-89` | Thiết lập giới hạn số trang được phép xử lý (Free 100 trang) | EPIC 06 | Nguyễn Lê Huy Tâm | 3 | Page count limit guard | **Done** |
| `PDFL-99` | Tích hợp thư viện PyMuPDF để đọc và trích xuất văn bản | EPIC 07 | Nguyễn Lê Huy Tâm | 3 | `pdf_service.py` trích xuất text số | **Done** |
| `PDFL-100` | Trích xuất văn bản theo từng trang | EPIC 07 | Nguyễn Lê Huy Tâm | 3 | Pagination loop extraction | **Done** |
| `PDFL-101` | Xử lý xuống dòng, khoảng trắng và ký tự bất thường | EPIC 07 | Nguyễn Lê Huy Tâm | 2 | Text sanitization regex | **Done** |
| `PDFL-102` | Giữ thứ tự văn bản hợp lý (Natural Reading Order) | EPIC 07 | Nguyễn Lê Huy Tâm | 3 | Thuật toán sắp xếp khối toạ độ bbox | **Done** |
| `PDFL-103` | Phát hiện tài liệu có ít hoặc không có văn bản trích xuất được | EPIC 07 | Nguyễn Lê Huy Tâm | 2 | Scan detection heuristic | **Done** |
| `PDFL-104` | Tích hợp Tesseract OCR để nhận diện văn bản từ PDF scan | EPIC 07 | Nguyễn Lê Huy Tâm | 3 | `ocr_service.py` (`pytesseract`) | **Done** |
| `PDFL-105` | Cấu hình dữ liệu ngôn ngữ OCR (tiếng Việt `vie` và tiếng Anh `eng`) | EPIC 07 | Nguyễn Lê Huy Tâm | 2 | `tessdata` language configuration | **Done** |
| `PDFL-106` | Kết hợp kết quả OCR với trích xuất văn bản (Hybrid Engine) | EPIC 07 | Nguyễn Lê Huy Tâm | 3 | Fallback OCR per page | **Done** |
| `PDFL-107` | Xây dựng API trả về nội dung văn bản được trích xuất | EPIC 07 | Nguyễn Lê Huy Tâm | 3 | `POST /api/process/extract-text` | **Done** |
| `PDFL-45` | Xây dựng giao diện tải tài liệu PDF (Dropzone UI) | EPIC 03 | Huỳnh Đình Chấn | 3 | Kéo thả và chọn file trong `index.html` | **Done** |
| `PDFL-46` | Xây dựng giao diện hiển thị tiến trình tải lên và xử lý | EPIC 03 | Huỳnh Đình Chấn | 3 | Modal progress 4 bước xử lý | **Done** |
| `PDFL-47` | Xây dựng giao diện hiển thị văn bản sau khi trích xuất | EPIC 03 | Huỳnh Đình Chấn | 3 | Dual-pane Workspace trong `workspace.css` | **Done** |
| `PDFL-57` | Thiết kế trạng thái loading, lỗi, thành công và giao diện rỗng | EPIC 03 | Huỳnh Đình Chấn | 2 | Empty state & Spinner UI | **Done** |
| `PDFL-200` | Unit test cho các hàm xử lý nghiệp vụ quan trọng | EPIC 15 | Cả hai (Tâm & Chấn) | 3 | `test_services.py` (27/10/2026) | **Done** |
| `PDFL-201` | Kiểm thử API upload, trích xuất, OCR, dịch thuật | EPIC 15 | Nguyễn Lê Huy Tâm | 3 | `test_api_process.py` (27/10/2026) | **Done** |
| `PDFL-202` | Kiểm thử đăng ký, đăng nhập, phân quyền và gói Free/Pro | EPIC 15 | Huỳnh Đình Chấn | 3 | `test_auth.py`, `test_frontend_login.js` | **Done** |
| `PDFL-204` | Kiểm thử tích hợp toàn bộ luồng E2E từ tải PDF đến kết quả | EPIC 15 | Nguyễn Lê Huy Tâm | 3 | `test_e2e_pipeline.py` (27/10/2026) | **Done** |
| `PDFL-215` | Đảm bảo mật khẩu không được lưu dưới dạng văn bản thuần | EPIC 15 | Huỳnh Đình Chấn | 2 | Test bcrypt trong `test_auth.py` | **Done** |
| `PDFL-223` | Kiểm tra các lỗi SQL injection, XSS và Header injection | EPIC 15 | Nguyễn Lê Huy Tâm | 3 | Input validation trong `test_api_process.py` | **Done** |

> **Thống kê Tuần 2**:
> - **Tổng số công việc hoàn thành**: 38 tasks (32 tasks Backlog + 6 tasks Kiểm thử/Bảo mật)
> - **Tổng Story Points**: 107 SP (Nguyễn Lê Huy Tâm: 59 SP | Huỳnh Đình Chấn: 45 SP | Cả hai: 3 SP)

---

### 📅 TUẦN 3 (Sprint 3: 27/10/2026 - 03/11/2026)
- **Trọng tâm**: Quản lý tài liệu người dùng, tiền xử lý hình ảnh OCR nâng cao (khử nghiêng, xoay trang, trang trắng), tích hợp động cơ dịch thuật `deep-translator`, chia đoạn chống nghẽn API, xuất file kết quả TXT/PDF, hoàn thiện giao diện và hệ thống đo lường hiệu năng/bộ nhớ.
- **Trạng thái**: ✅ **100% Hoàn thành**

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Story Points | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-42` | Xây dựng trang đăng ký tài khoản | EPIC 03 | Huỳnh Đình Chấn | 3 | `Code/frontend/register.html` | **Done** |
| `PDFL-43` | Xây dựng trang đăng nhập | EPIC 03 | Huỳnh Đình Chấn | 3 | `Code/frontend/login.html` | **Done** |
| `PDFL-44` | Xây dựng trang thông tin tài khoản | EPIC 03 | Huỳnh Đình Chấn | 3 | Modal profile người dùng | **Done** |
| `PDFL-48` | Xây dựng giao diện chọn ngôn ngữ nguồn và ngôn ngữ đích | EPIC 03 | Huỳnh Đình Chấn | 2 | Dropdown chọn ngôn ngữ trong Workspace | **Done** |
| `PDFL-49` | Xây dựng giao diện hiển thị bản dịch | EPIC 03 | Huỳnh Đình Chấn | 3 | Khung hiển thị song song bên phải | **Done** |
| `PDFL-52` | Giao diện so sánh/chuyển đổi văn bản gốc và bản dịch | EPIC 03 | Huỳnh Đình Chấn | 3 | Toggle view split/side-by-side | **Done** |
| `PDFL-59` | Kiểm tra tính nhất quán về thiết kế và khả năng sử dụng | EPIC 03 | Huỳnh Đình Chấn | 2 | UI audit check trên các trang | **Done** |
| `PDFL-77` | Xây dựng cơ chế quản lý phiên đăng nhập hoặc token | EPIC 05 | Huỳnh Đình Chấn | 3 | Token refresh & local storage sync | **Done** |
| `PDFL-90` | Lưu trữ file trong thư mục hoặc dịch vụ lưu trữ cấu hình | EPIC 06 | Nguyễn Lê Huy Tâm | 3 | `storage/documents/{user_id}/` | **Done** |
| `PDFL-91` | Ghi nhận metadata của tài liệu (tên file, dung lượng, trang) | EPIC 06 | Huỳnh Đình Chấn | 2 | `app/models/document.py` | **Done** |
| `PDFL-92` | Hiển thị danh sách tài liệu của người dùng | EPIC 06 | Huỳnh Đình Chấn | 3 | Panel quản lý tài liệu trong Workspace | **Done** |
| `PDFL-93` | Xem thông tin chi tiết của một tài liệu | EPIC 06 | Huỳnh Đình Chấn | 2 | Modal Document Details | **Done** |
| `PDFL-94` | Xây dựng chức năng xóa tài liệu | EPIC 06 | Huỳnh Đình Chấn | 3 | `DELETE /api/documents/{id}` | **Done** |
| `PDFL-95` | Kiểm soát quyền tải xuống và truy cập file | EPIC 06 | Huỳnh Đình Chấn | 3 | Document access control check | **Done** |
| `PDFL-96` | Xử lý lỗi khi tải file, mất kết nối hoặc quá giới hạn | EPIC 06 | Huỳnh Đình Chấn | 2 | Client-side error toasts & retry | **Done** |
| `PDFL-97` | Xóa các file tạm khi hoàn tất xử lý hoặc xảy ra lỗi | EPIC 06 | Nguyễn Lê Huy Tâm | 2 | Temp cleaner background logic | **Done** |
| `PDFL-98` | Đảm bảo tài liệu riêng tư không bị người dùng khác truy cập | EPIC 06 | Huỳnh Đình Chấn | 3 | Owner isolation check | **Done** |
| `PDFL-108` | Hiển thị kết quả trích xuất trên giao diện | EPIC 07 | Huỳnh Đình Chấn | 3 | Render formatted text trên Workspace | **Done** |
| `PDFL-109` | Xử lý trang trống, trang xoay hoặc hình ảnh kém | EPIC 07 | Huỳnh Đình Chấn | 3 | Deskew, rotate, blank detection logic | **Done** |
| `PDFL-110` | Kiểm thử độ chính xác với PDF thông thường và scan | EPIC 07 | Huỳnh Đình Chấn | 3 | Dataset test runner | **Done** |
| `PDFL-111` | Tối ưu thời gian xử lý đối với tài liệu nhiều trang | EPIC 07 | Huỳnh Đình Chấn | 3 | Streaming / chunked page processing | **Done** |
| `PDFL-112` | Trả thông báo rõ ràng khi không trích xuất được nội dung | EPIC 07 | Huỳnh Đình Chấn | 2 | Thông báo lỗi không nhận dạng được chữ | **Done** |
| `PDFL-113` | Lựa chọn thư viện hoặc dịch vụ dịch thuật | EPIC 08 | Nguyễn Lê Huy Tâm | 2 | Đánh giá `deep-translator` vs API | **Done** |
| `PDFL-114` | Xác định danh sách ngôn ngữ nguồn và đích hỗ trợ | EPIC 08 | Nguyễn Lê Huy Tâm | 2 | Config hỗ trợ 10+ ngôn ngữ | **Done** |
| `PDFL-115` | Xây dựng chức năng tự động nhận diện ngôn ngữ nguồn | EPIC 08 | Nguyễn Lê Huy Tâm | 3 | Auto-detect language engine | **Done** |
| `PDFL-116` | Xây dựng giao diện chọn ngôn ngữ | EPIC 08 | Huỳnh Đình Chấn | 2 | Language selector UI widget | **Done** |
| `PDFL-117` | Xây dựng API dịch văn bản | EPIC 08 | Nguyễn Lê Huy Tâm | 3 | `POST /api/translate` | **Done** |
| `PDFL-118` | Chia văn bản dài thành các đoạn phù hợp với giới hạn | EPIC 08 | Nguyễn Lê Huy Tâm | 3 | Sentence boundary chunking | **Done** |
| `PDFL-119` | Giữ thứ tự các đoạn khi ghép kết quả dịch | EPIC 08 | Nguyễn Lê Huy Tâm | 3 | Chunk index order reassembly | **Done** |
| `PDFL-121` | Hiển thị bản dịch kèm thông tin ngôn ngữ | EPIC 08 | Huỳnh Đình Chấn | 2 | Metadata badge trên bản dịch | **Done** |
| `PDFL-122` | Cho phép sao chép bản dịch | EPIC 08 | Huỳnh Đình Chấn | 2 | Nút Copy to Clipboard | **Done** |
| `PDFL-266` | Tích hợp thư viện dịch thuật 'deep-translator' | EPIC 08 | Nguyễn Lê Huy Tâm | 3 | `translation_service.py` | **Done** |
| `PDFL-151` | Xây dựng chức năng xuất văn bản thành file TXT | EPIC 11 | Huỳnh Đình Chấn | 3 | Export TXT UTF-8 BOM | **Done** |
| `PDFL-152` | Xây dựng chức năng xuất nội dung thành file PDF | EPIC 11 | Huỳnh Đình Chấn | 3 | Export PDF Unicode tiếng Việt | **Done** |
| `PDFL-153` | Xây dựng chức năng tải file kết quả về thiết bị | EPIC 11 | Huỳnh Đình Chấn | 2 | Download trigger & blob handling | **Done** |
| `PDFL-154` | Đặt tên file kết quả theo tài liệu và ngôn ngữ | EPIC 11 | Huỳnh Đình Chấn | 2 | Quy chuẩn tên file tải về | **Done** |
| `PDFL-155` | Đảm bảo tiếng Việt và Unicode hiển thị đúng trong file xuất | EPIC 11 | Huỳnh Đình Chấn | 3 | Font registration (Roboto/DejaVu) | **Done** |
| `PDFL-253` | Hỗ trợ kéo thả file vào giao diện | EPIC 17 | Huỳnh Đình Chấn | 3 | Drag & drop highlight & drop event | **Done** |
| `PDFL-267` | Điều khoản và bảo mật cho người dùng | EPIC 03 | Huỳnh Đình Chấn | 2 | Modal Terms & Privacy Policy | **Done** |
| `PDFL-205` | Kiểm thử giao diện trên các kích thước màn hình | EPIC 15 | Cả hai (Tâm & Chấn) | 2 | `test_frontend_sidebar.js` (05/11/2026) | **In Progress** |
| `PDFL-206` | Kiểm thử các trường hợp lỗi và trường hợp biên | EPIC 15 | Cả hai (Tâm & Chấn) | 3 | `test_blank_page.py`, `test_files_lost_and_error_tasks.py` | **Done** |
| `PDFL-208` | Kiểm thử PDF scan (OCR, Deskew, Orientation) | EPIC 15 | Huỳnh Đình Chấn | 3 | `test_ocr_pipeline.py`, `test_deskew.py` | **Done** |
| `PDFL-209` | Kiểm thử PDF tiếng Việt có dấu và tài liệu đa ngôn ngữ | EPIC 15 | Cả hai (Tâm & Chấn) | 3 | `test_text_metrics.py` (02/11/2026) | **Done** |
| `PDFL-210` | Kiểm thử PDF nhiều trang, nhiều cột, bố cục phức tạp | EPIC 15 | Huỳnh Đình Chấn | 3 | `test_layout_metrics.py` (02/11/2026) | **Done** |
| `PDFL-219` | Kiểm soát dung lượng, số trang, bộ nhớ và thời gian | EPIC 15 | Huỳnh Đình Chấn | 3 | `test_memory_optimization.py` | **Done** |
| `PDFL-220` | Ngăn chặn truy cập chéo tài liệu/lịch sử (Anti-IDOR) | EPIC 15 | Nguyễn Lê Huy Tâm | 3 | `test_document_access_control.py` | **Done** |
| `PDFL-224` | Đánh giá thời gian trích xuất, OCR, dịch và AI | EPIC 15 | Huỳnh Đình Chấn | 3 | `benchmark_runner.py` (02/11/2026) | **Done** |
| `PDFL-225` | Kiểm tra request đồng thời và giới hạn tài nguyên | EPIC 15 | Huỳnh Đình Chấn | 3 | `test_parallel_pdf_processing.py` | **Done** |
| `PDFL-226` | Tối ưu quy trình đọc, xử lý và lưu file lớn | EPIC 15 | Huỳnh Đình Chấn | 3 | `measure_memory_before_after.py` | **Done** |
| `PDFL-230` | Chọn nơi lưu trữ PDF và file kết quả | EPIC 16 | Nguyễn Lê Huy Tâm | 3 | `storage_service.py` (03/11/2026) | **Done** |
| `PDFL-242` | Hướng dẫn thiết lập môi trường chạy trên máy cá nhân | EPIC 16 | Nguyễn Lê Huy Tâm | 2 | `run.bat`, `README.md` (03/11/2026) | **Done** |
| `PDFL-246` | Cung cấp hình ảnh giao diện và hướng dẫn sử dụng | EPIC 16 | Nguyễn Lê Huy Tâm | 2 | `Docs/user-guide/user-guide.md` (01/11) | **In Progress** |

> **Thống kê Tuần 3**:
> - **Tổng số công việc hoàn thành**: 52 tasks (39 tasks Backlog + 13 tasks Đo lường/Hiệu năng/Kiểm thử)
> - **Tổng Story Points**: 141 SP (Huỳnh Đình Chấn: 92 SP | Nguyễn Lê Huy Tâm: 41 SP | Cả hai: 8 SP)

---

### 📅 TUẦN 4 (Sprint 4: 03/11/2026 - 10/11/2026)
- **Trọng tâm**: Xử lý lỗi dịch thuật đa tầng, kiểm thử xuất file định dạng TXT/PDF, hoàn thiện cơ sở dữ liệu và API lịch sử xử lý tài liệu, thiết lập quyền lợi gói Free/Pro, Dashboard quản trị Admin cơ bản, bộ test ma trận bảo mật và giới hạn dung lượng tải lên.
- **Trạng thái**: ✅ **100% Hoàn thành**

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Story Points | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-120` | Xử lý lỗi mạng, giới hạn API và lỗi dịch thuật | EPIC 08 | Nguyễn Lê Huy Tâm | 3 | Fallback engine & retry policy | **Done** |
| `PDFL-123` | Kiểm thử các trường hợp dịch tiếng Việt, Anh và các ngôn ngữ | EPIC 08 | Nguyễn Lê Huy Tâm | 3 | Translation evaluation suite | **Done** |
| `PDFL-124` | Đánh giá khả năng giữ nguyên đoạn văn, danh sách khi dịch | EPIC 08 | Nguyễn Lê Huy Tâm | 3 | Structure preservation check | **Done** |
| `PDFL-125` | Đảm bảo hệ thống không làm mất hoặc đảo thứ tự đoạn | EPIC 08 | Nguyễn Lê Huy Tâm | 3 | Sequence verification test | **Done** |
| `PDFL-150` | Xác định các loại kết quả có thể xuất (gốc, dịch, tóm tắt) | EPIC 11 | Huỳnh Đình Chấn | 2 | Export target schema | **Done** |
| `PDFL-156` | Xử lý trường hợp nội dung rỗng hoặc không có kết quả | EPIC 11 | Huỳnh Đình Chấn | 2 | Empty content validator | **Done** |
| `PDFL-157` | Kiểm tra quyền tải xuống và quyền truy cập kết quả | EPIC 11 | Huỳnh Đình Chấn | 3 | Export authorization check | **Done** |
| `PDFL-158` | Kiểm thử file xuất trên các trình đọc file thông dụng | EPIC 11 | Huỳnh Đình Chấn | 2 | Cross-viewer compatibility test | **Done** |
| `PDFL-159` | Thiết kế bảng dữ liệu lưu lịch sử xử lý | EPIC 12 | Huỳnh Đình Chấn | 3 | `app/models/processing_history.py` | **Done** |
| `PDFL-160` | Lưu thông tin tài liệu và loại thao tác đã thực hiện | EPIC 12 | Huỳnh Đình Chấn | 2 | Operation type logging | **Done** |
| `PDFL-161` | Lưu kết quả trích xuất, dịch thuật hoặc tóm tắt vào lịch sử | EPIC 12 | Huỳnh Đình Chấn | 3 | History persistence logic | **Done** |
| `PDFL-162` | Xây dựng API lấy danh sách lịch sử | EPIC 12 | Huỳnh Đình Chấn | 3 | `GET /api/history` | **Done** |
| `PDFL-163` | Xây dựng API xem chi tiết một bản ghi lịch sử | EPIC 12 | Huỳnh Đình Chấn | 3 | `GET /api/history/{id}` | **Done** |
| `PDFL-164` | Hiển thị lịch sử trên giao diện | EPIC 12 | Huỳnh Đình Chấn | 3 | History panel trong `index.html` | **Done** |
| `PDFL-165` | Cho phép mở lại kết quả đã lưu | EPIC 12 | Huỳnh Đình Chấn | 3 | Re-open past results handler | **Done** |
| `PDFL-166` | Cho phép xóa lịch sử theo chính sách lưu trữ | EPIC 12 | Huỳnh Đình Chấn | 3 | `DELETE /api/history/{id}` | **Done** |
| `PDFL-172` | Xác định quyền lợi cụ thể của gói Free | EPIC 13 | Nguyễn Lê Huy Tâm | 2 | Free plan definition specification | **Done** |
| `PDFL-173` | Xác định quyền lợi cụ thể của gói Pro | EPIC 13 | Nguyễn Lê Huy Tâm | 2 | Pro plan definition specification | **Done** |
| `PDFL-176` | Giới hạn tải lên tối đa 20 MB/tệp đối với Free | EPIC 13 | Huỳnh Đình Chấn | 3 | Free 20MB limit validator | **Done** |
| `PDFL-178` | Xác định và thực thi giới hạn số trang PDF cho từng gói | EPIC 13 | Huỳnh Đình Chấn | 3 | Page limit guard per plan | **Done** |
| `PDFL-185` | Kiểm thử việc áp dụng hạn mức ở Backend | EPIC 13 | Huỳnh Đình Chấn | 3 | Backend limit enforcement test | **Done** |
| `PDFL-207` | Kiểm thử PDF văn bản thông thường | EPIC 15 | Huỳnh Đình Chấn | 3 | Standard PDF test dataset | **Done** |
| `PDFL-214` | Kiểm tra an toàn file tải lên và ngăn việc truy cập ngoài phạm vi | EPIC 15 | Huỳnh Đình Chấn | 3 | Upload safety & path traversal guard | **Done** |
| `PDFL-186` | Xác định vai trò và quyền hạn của Admin | EPIC 14 | Nguyễn Lê Huy Tâm | 2 | Admin role definition | **Done** |
| `PDFL-188` | Xây dựng trang tổng quan quản trị | EPIC 14 | Nguyễn Lê Huy Tâm | 3 | Admin dashboard layout | **Done** |
| `PDFL-189` | Hiển thị danh sách tài khoản người dùng | EPIC 14 | Nguyễn Lê Huy Tâm | 3 | User management table | **Done** |
| `PDFL-194` | Khóa hoặc mở khóa tài khoản khi cần | EPIC 14 | Nguyễn Lê Huy Tâm | 3 | Ban/unban user action | **Done** |
| `PDFL-197` | Xử lý thông báo xác nhận trước những thao tác ảnh hưởng lớn | EPIC 14 | Nguyễn Lê Huy Tâm | 2 | Confirmation dialog widget | **Done** |
| `PDFL-198` | Kiểm thử quyền Admin và đảm bảo tài khoản thường không truy cập | EPIC 14 | Nguyễn Lê Huy Tâm | 3 | Admin RBAC guard test | **Done** |
| `PDFL-240` | Viết README giới thiệu PDF Lingua | EPIC 16 | Nguyễn Lê Huy Tâm | 2 | `README.md` tổng quan dự án | **Done** |
| `PDFL-260` | Gửi thông báo về trạng thái xử lý tài liệu | EPIC 17 | Huỳnh Đình Chấn | 3 | Toast notification system | **Done** |
| `PDFL-203` | Kiểm thử lịch sử, xuất file và chức năng Admin | EPIC 15 | Cả hai (Chấn & Tâm) | 3 | `test_history_api.py`, `test_admin_management.py` | **Done** |
| `PDFL-211` | Kiểm thử PDF bị hỏng, có mật khẩu hoặc không đọc được | EPIC 15 | Huỳnh Đình Chấn | 3 | `test_upload_security.py` (10/11/2026) | **Done** |
| `PDFL-212` | Kiểm thử file nhỏ, sát giới hạn và vượt giới hạn dung lượng | EPIC 15 | Huỳnh Đình Chấn | 3 | `test_size_page_limits_integration.py` | **Done** |
| `PDFL-217` | Kiểm tra xác thực và phân quyền trên các API riêng tư | EPIC 15 | Huỳnh Đình Chấn | 3 | `test_security_matrix.py` (10/11/2026) | **Done** |
| `PDFL-221` | Chính sách lưu trữ, xóa và bảo vệ dữ liệu người dùng | EPIC 15 | Huỳnh Đình Chấn | 3 | `test_history_delete.py` (08/11/2026) | **Done** |
| `PDFL-236` | Kiểm tra việc xử lý file lớn theo giới hạn công bố | EPIC 16 | Huỳnh Đình Chấn | 3 | `test_size_page_limits_integration.py` | **Done** |
| `PDFL-238` | Phương án sao lưu và phục hồi database | EPIC 16 | Nguyễn Lê Huy Tâm | 2 | `kien_truc_he_thong.md` (11/11/2026) | **In Progress** |
| `PDFL-244` | Mô tả cấu trúc thư mục và kiến trúc hệ thống | EPIC 16 | Nguyễn Lê Huy Tâm | 3 | `kien_truc_he_thong.md` (11/11/2026) | **Done** |
| `PDFL-213` | Kiểm thử tài liệu dài khi dịch, tóm tắt và hỏi đáp AI | EPIC 15 | Nguyễn Lê Huy Tâm | 3 | `test_ai_summary_quality.py` (12/11) | **Done** |
| `PDFL-222` | Hạn chế nội dung không đáng tin cậy ảnh hưởng trợ lý AI | EPIC 15 | Nguyễn Lê Huy Tâm | 2 | `test_ai_chat_api.py` (12/11/2026) | **In Progress** |

> **Thống kê Tuần 4**:
> - **Tổng số công việc hoàn thành**: 41 tasks (31 tasks Backlog + 10 tasks Bảo mật/Kiểm thử/Tài liệu)
> - **Tổng Story Points**: 119 SP (Huỳnh Đình Chấn: 67 SP | Nguyễn Lê Huy Tâm: 49 SP | Cả hai: 3 SP)

---

### 📅 TUẦN 5 (Sprint 5: 10/11/2026 - 17/11/2026)
- **Trọng tâm**: Lịch sử Pro, Quản trị Admin, Hạn mức gói Free/Pro, Mở rộng (DOCX, ZIP, Preview), Nộp hồ sơ thuyết minh thiết kế đồ án (`PDFL-269`, `PDFL-270`, `PDFL-271`), khởi động tính năng Avatar người dùng và giao dịch thanh toán (Billing).
- **Trạng thái**: 🚀 **Đang triển khai** - **42 Work Items** (35 Done / 2 In Progress / 5 To Do - **126 Story Points**) - *Đồng bộ 100% Jira Board*

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Người thực hiện | File / Minh chứng thực tế | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-167` | Chỉ cho phép tài khoản Pro sử dụng chức năng lịch sử nếu đây là quyền lợi đã chốt | EPIC 12 | 3 | Nguyễn Lê Huy Tâm | `test_history_api.py` Pro guard | **Done** |
| `PDFL-168` | Kiểm soát quyền truy cập lịch sử theo tài khoản | EPIC 12 | 3 | Nguyễn Lê Huy Tâm | Anti-IDOR history security | **Done** |
| `PDFL-169` | Xác định thời gian lưu trữ và cách xóa dữ liệu khi cần | EPIC 12 | 3 | Huỳnh Đình Chấn | Data retention policy | **Done** |
| `PDFL-170` | Kiểm thử khả năng lưu, truy vấn, mở lại và xóa lịch sử | EPIC 12 | 3 | Huỳnh Đình Chấn | `test_history_result.py` | **Done** |
| `PDFL-171` | Thiết kế dữ liệu gói dịch vụ và trạng thái đăng ký của người dùng | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | `app/models/subscription.py` | **Done** |
| `PDFL-174` | Hiển thị gói hiện tại của người dùng | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | Free/Pro badge trên giao diện | **Done** |
| `PDFL-176` | Xây dựng cơ chế kiểm tra gói dịch vụ ở backend | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | `test_pricing_subscription.py` | **Done** |
| `PDFL-177` | Giới hạn tải lên tối đa 100 MB/tệp đối với Pro | EPIC 13 | 3 | Huỳnh Đình Chấn | Pro size limit validation | **Done** |
| `PDFL-178` | Xác định hạn mức OCR, dịch thuật và AI theo gói | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | Quota control in backend | **Done** |
| `PDFL-180` | Chặn hoặc thông báo khi người dùng vượt hạn mức | EPIC 13 | 3 | Huỳnh Đình Chấn | Frontend quota modal alert | **Done** |
| `PDFL-181` | Xây dựng trang so sánh quyền lợi Free và Pro | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | `pricing.html` comparison table | **Done** |
| `PDFL-182` | Xây dựng luồng yêu cầu nâng cấp lên Pro | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | Upgrade modal & form | **Done** |
| `PDFL-183` | Cập nhật quyền sử dụng khi tài khoản được nâng cấp hoặc hạ cấp | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | Immediate role synchronization | **Done** |
| `PDFL-184` | Hiển thị thông báo nâng cấp tới người dùng truy cập tính năng Pro | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | Feature lock banner UI | **Done** |
| `PDFL-187` | Thiết lập cách khởi tạo tài khoản Admin an toàn | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | Seed admin CLI script | **Done** |
| `PDFL-190` | Tìm kiếm và lọc tài khoản theo thông tin phù hợp | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | Search & filter users in Admin UI | **Done** |
| `PDFL-191` | Xem thông tin và trạng thái tài khoản | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | User details modal | **Done** |
| `PDFL-192` | Theo dõi trạng thái gói Free/Pro | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | Subscription filter & metrics | **Done** |
| `PDFL-193` | Cấp, gia hạn, hạ cấp hoặc thu hồi quyền Pro theo quy định | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | Role assignment endpoints | **Done** |
| `PDFL-195` | Kiểm soát quyền Admin ở backend | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | `test_admin_management.py` | **Done** |
| `PDFL-196` | Ghi nhận nhật ký các thao tác quản trị quan trọng | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | Admin action audit logger | **Done** |
| `PDFL-247` | Chuẩn bị dữ liệu PDF mẫu phục vụ demo | EPIC 16 | 3 | Huỳnh Đình Chấn | `tests/dataset/demo_samples/` | **Done** |
| `PDFL-252` | Cho phép xử lý nhiều file PDF theo lô | EPIC 17 | 3 | Huỳnh Đình Chấn | `test_batch_zip.py` (14/11/2026) | **Done** |
| `PDFL-254` | Cho phép người dùng Pro tải kết quả dưới định dạng DOCX | EPIC 17 | 3 | Huỳnh Đình Chấn | `test_docx_export.py` (14/11/2026) | **Done** |
| `PDFL-255` | Cho phép chọn các trang cụ thể cần trích xuất hoặc dịch | EPIC 17 | 3 | Huỳnh Đình Chấn | `test_page_selection.py` | **Done** |
| `PDFL-256` | Hỗ trợ xem trước PDF và chuyển trang ngay trên ứng dụng | EPIC 17 | 3 | Huỳnh Đình Chấn | `test_pdf_inline_preview.py` (14/11) | **Done** |
| `PDFL-67` | Xây dựng API kiểm tra giới hạn upload, AI và các hạn mức khác | EPIC 04 | 3 | Nguyễn Lê Huy Tâm | `GET /api/users/limits` | **Done** |
| `PDFL-74` | Xử lý các tác vụ mất nhiều thời gian mà không khóa toàn bộ ứng dụng | EPIC 04 | 3 | Nguyễn Lê Huy Tâm | `test_background_jobs_api.py` | **Done** |
| `PDFL-44` | Xây dựng giao diện lịch sử xử lý tài liệu | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | History view layout in UI | **Done** |
| `PDFL-49` | Xây dựng trang giới thiệu và so sánh gói Free/Pro | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | Pricing comparison layout | **Done** |
| `PDFL-52` | Xây dựng giao diện nâng cấp gói Pro | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | Upgrade checkout UI | **Done** |
| `PDFL-56` | Xây dựng giao diện quản trị Admin | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | Admin dashboard UI | **Done** |
| `PDFL-269` | Kiến trúc hệ thống (Thuyết minh chi tiết thiết kế) | EPIC 16 | 3 | Nguyễn Lê Huy Tâm | `kien_truc_he_thong.md` (15/11/2026) | **Done** |
| `PDFL-270` | Lược đồ usecase (Thuyết minh chi tiết thiết kế) | EPIC 16 | 3 | Huỳnh Đình Chấn | `Docs/diagrams/use_case_diagram.png` | **Done** |
| `PDFL-271` | Lược đồ lớp (Thuyết minh chi tiết thiết kế) | EPIC 16 | 3 | Huỳnh Đình Chấn | `luoc_do_lop.md`, `luoc_do_lop.png` | **Done** |
| `PDFL-272` | Thiết kế tính năng tải lên ảnh đại diện cho người dùng | EPIC 17 | 3 | Huỳnh Đình Chấn | Data schema avatar upload | **In Progress** |
| `PDFL-273` | Xây dựng giao diện tải lên, cắt ảnh và hiển thị avatar người dùng | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | Frontend crop avatar modal | **In Progress** |
| `PDFL-274` | Xây dựng API lấy danh sách lịch sử giao dịch thanh toán (Billing) | EPIC 13 | 3 | Huỳnh Đình Chấn | Billing transaction API schema | **To Do** |
| `PDFL-275` | Xây dựng giao diện xem Lịch sử giao dịch, hóa đơn và thanh toán Pro | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | Billing invoice history UI | **To Do** |
| `PDFL-276` | Xây dựng giao diện hiển thị mức độ sử dụng, trạng thái gói cho Pro | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | Quota usage meter bar | **To Do** |
| `PDFL-262` | Bổ sung thống kê mức sử dụng dịch vụ | EPIC 17 | 3 | Huỳnh Đình Chấn | `admin_service.py`, `admin.js` | **To Do** *(Đã có code)* |
| `PDFL-263` | Cải thiện khả năng truy xuất nguồn cho câu trả lời AI bằng cách tham chiếu trang hoặc đoạn văn liên quan | EPIC 17 | 3 | Nguyễn Lê Huy Tâm | `ai_service.py`, `schemas/ai.py`, `api/ai.py`, `ai_copilot.js`, `test_ai_citations.py` | **To Do** *(Đã hoàn thiện & kiểm thử 27/27 ca)* |

> **Thống kê Tuần 5**:
> - **Tổng số công việc**: 42 work items (35 Done / 2 In Progress / 5 To Do)
> - **Tổng Story Points**: 126 SP (Nguyễn Lê Huy Tâm: 84 SP | Huỳnh Đình Chấn: 42 SP)

---

### 📅 TUẦN 6 (Sprint 6: 17/11/2026 - 24/11/2026)
- **Trọng tâm**: Tích hợp trí tuệ nhân tạo (LLM API) toàn diện: AI Tóm tắt văn bản tài liệu theo nhiều phong cách, thuật toán Map-Reduce chia đoạn tóm tắt cho tài liệu dài, Trợ lý AI hỏi đáp tài liệu theo ngữ cảnh (Contextual Document QA/RAG Chatbot), rào chắn hạn chế ảo giác (Anti-hallucination prompt boundary), giao diện chat và kiểm thử chất lượng AI.
- **Trạng thái**: ✅ **100% Hoàn thành** - **26 Work Items** (26 Done / 0 In Progress / 0 To Do - **74 Story Points**) - *Đồng bộ 100% Jira Board*

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Người thực hiện | File / Minh chứng thực tế | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-126` | Lựa chọn mô hình AI hoặc dịch vụ API phù hợp | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | Tích hợp Google Gemini / OpenAI API | **Done** |
| `PDFL-127` | Quản lý API key thông qua biến môi trường | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | `config.py` AI key management | **Done** |
| `PDFL-128` | Xây dựng cấu trúc prompt tóm tắt văn bản | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | System prompts trong `ai_service.py` | **Done** |
| `PDFL-129` | Xây dựng API tóm tắt nội dung tài liệu | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | `POST /api/ai/summarize` | **Done** |
| `PDFL-130` | Hỗ trợ lựa chọn độ dài hoặc kiểu tóm tắt nếu mô hình cho phép | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | Kiểu tóm tắt: ngắn, chi tiết, bullet | **Done** |
| `PDFL-131` | Hỗ trợ tóm tắt văn bản dài bằng cách chia đoạn hoặc tóm tắt nhiều bước | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | Thuật toán Map-Reduce chunk summarizer | **Done** |
| `PDFL-132` | Hiển thị nội dung tóm tắt trên giao diện | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | Tab tóm tắt trong Workspace UI | **Done** |
| `PDFL-133` | Cho phép sao chép kết quả tóm tắt | EPIC 09 | 2 | Nguyễn Lê Huy Tâm | Copy summary button & toast | **Done** |
| `PDFL-134` | Kiểm tra quyền sử dụng AI của tài khoản Pro | EPIC 09 | 2 | Nguyễn Lê Huy Tâm | Pro guard check trên AI endpoints | **Done** |
| `PDFL-135` | Kiểm soát số lượt sử dụng, lượng văn bản đầu vào và chi phí | EPIC 09 | 2 | Nguyễn Lê Huy Tâm | Token limit & daily quota tracker | **Done** |
| `PDFL-136` | Xử lý lỗi khi dịch vụ AI không phản hồi hoặc vượt giới hạn | EPIC 09 | 2 | Nguyễn Lê Huy Tâm | Timeout retry & error handler | **Done** |
| `PDFL-137` | Kiểm thử chất lượng tóm tắt trên các loại tài liệu khác nhau | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | `test_ai_summary_quality.py` | **Done** |
| `PDFL-138` | Xác định phạm vi câu hỏi mà trợ lý AI có thể xử lý | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | QA Scope & instructions definition | **Done** |
| `PDFL-139` | Xây dựng API gửi câu hỏi về tài liệu | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | `POST /api/ai/chat` | **Done** |
| `PDFL-140` | Cung cấp nội dung tài liệu liên quan làm ngữ cảnh cho AI | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | Context window extraction logic | **Done** |
| `PDFL-141` | Xử lý tài liệu dài bằng cách chọn các đoạn liên quan trước khi gửi cho AI | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | Relevance chunk filtering | **Done** |
| `PDFL-142` | Xây dựng giao diện khung chat | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | Chatbox UI widget trong Workspace | **Done** |
| `PDFL-143` | Hiển thị câu hỏi và câu trả lời theo thứ tự hội thoại | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | Chat history bubble list | **Done** |
| `PDFL-144` | Xử lý trạng thái AI đang suy nghĩ, câu trả lời lỗi và yêu cầu thử lại | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | Typing indicator animation & retry UI | **Done** |
| `PDFL-145` | Giới hạn số lượt hỏi đáp hoặc lượng nội dung theo gói dịch vụ | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | QA rate limit per user tier | **Done** |
| `PDFL-146` | Đảm bảo câu trả lời dựa trên nội dung tài liệu khi người dùng hỏi | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | Grounding prompt & reference injection | **Done** |
| `PDFL-148` | Kiểm soát quyền truy cập để người dùng không hỏi tài liệu người khác | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | Anti-IDOR context guard | **Done** |
| `PDFL-149` | Kiểm thử khả năng trả lời đúng, hạn chế bịa đặt và xử lý ngoài phạm vi | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | `test_ai_chat_api.py` validation | **Done** |
| `PDFL-147` | Xử lý trường hợp tài liệu không có thông tin để trả lời | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | Fallback "không tìm thấy thông tin" | **Done** |
| `PDFL-50` | Xây dựng giao diện tóm tắt văn bản bằng AI | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | Layout AI Summary widget | **Done** |
| `PDFL-51` | Xây dựng giao diện trò chuyện với trợ lý AI | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | Layout AI Copilot Chat panel | **Done** |

> **Thống kê Tuần 6**:
> - **Tổng số công việc hoàn thành**: 26 work items (100% Done)
> - **Tổng Story Points**: 74 SP (Nguyễn Lê Huy Tâm: 74 SP - 100%)

---

### 📅 TUẦN 7 (Sprint 7: 22/11/2026 - 29/11/2026)
- **Trọng tâm**: Nghiệm thu kiểm thử toàn diện, đóng gói triển khai hệ thống, hoàn thiện báo cáo phân tích thiết kế, xây dựng slide thuyết trình, kịch bản demo, hướng dẫn sử dụng web (`PDFL-279`), bộ test case chức năng (`PDFL-199`), rà soát an toàn repository và tổng duyệt bảo vệ đồ án.
- **Trạng thái**: 📋 **Kế hoạch & Nghiệm thu** - **45 Work Items** (37 Done - 69 SP / 8 To Do - 29 SP - **Tổng 98 Story Points**) - *Đồng bộ 100% Jira Board (22 Nov - 29 Nov)*

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Người thực hiện | File / Minh chứng thực tế | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-228` | Chọn nền tảng triển khai Frontend | EPIC 16 | 5 | Nguyễn Lê Huy Tâm | Đề xuất triển khai Vercel / Netlify / Nginx | **To Do** |
| `PDFL-248` | Viết báo cáo phân tích, thiết kế, hiện thực và kiểm thử phần mềm | EPIC 16 | 3 | Nguyễn Lê Huy Tâm | Báo cáo đồ án môn học hoàn chỉnh | **To Do** |
| `PDFL-249` | Chuẩn bị slide thuyết trình | EPIC 16 | - | Cả hai thành viên | Slide trình chiếu báo cáo bảo vệ trước hội đồng | **To Do** |
| `PDFL-250` | Chuẩn bị kịch bản demo các chức năng chính | EPIC 16 | - | Cả hai thành viên | Kịch bản trình diễn mượt mà OCR, dịch thuật & AI | **To Do** |
| `PDFL-251` | Kiểm tra README, tài liệu, repository và loại bỏ API key nhạy cảm | EPIC 16 | 3 | Nguyễn Lê Huy Tâm | Rà soát an toàn repo, quét secret trước bàn giao | **To Do** |
| `PDFL-199` | Xây dựng danh sách test case theo yêu cầu chức năng | EPIC 15 | 5 | Huỳnh Đình Chấn | Bảng đặc tả ma trận test case chức năng | **To Do** |
| `PDFL-246` | Cung cấp hình ảnh giao diện và hướng dẫn sử dụng | EPIC 16 | 8 | Huỳnh Đình Chấn | Bộ ảnh chụp giao diện và tài liệu hướng dẫn | **To Do** |
| `PDFL-279` | Hướng dẫn sử dụng web | EPIC 16 | 5 | Nguyễn Lê Huy Tâm | Hướng dẫn thao tác trải nghiệm ứng dụng web | **To Do** |
| `PDFL-200` | Unit test cho các hàm xử lý nghiệp vụ quan trọng | EPIC 15 | 3 | Huy Tâm & Đình Chấn | `test_services.py`, `test_job_service.py` | **Done** |
| `PDFL-201` | Kiểm thử API upload, trích xuất, OCR, dịch thuật và AI | EPIC 15 | 3 | Huy Tâm & Đình Chấn | `test_api_process.py`, `test_ai_api.py` | **Done** |
| `PDFL-202` | Kiểm thử đăng ký, đăng nhập, phân quyền và gói Free/Pro | EPIC 15 | 3 | Huỳnh Đình Chấn | `test_auth.py`, `test_permissions.py` | **Done** |
| `PDFL-203` | Kiểm thử lịch sử, xuất file và chức năng Admin | EPIC 15 | 3 | Huy Tâm & Đình Chấn | `test_history_api.py`, `test_docx_export.py` | **Done** |
| `PDFL-204` | Kiểm thử tích hợp toàn bộ luồng từ tải PDF đến tải kết quả | EPIC 15 | 3 | Nguyễn Lê Huy Tâm | `test_e2e_pipeline.py` (E2E full flow) | **Done** |
| `PDFL-206` | Kiểm thử các trường hợp lỗi và trường hợp biên | EPIC 15 | 2 | Nguyễn Lê Huy Tâm | `test_files_lost_and_error_tasks.py` | **Done** |
| `PDFL-208` | Kiểm thử PDF scan (OCR, Deskew, xoay trang) | EPIC 15 | 3 | Huỳnh Đình Chấn | `test_ocr_pipeline.py`, `test_deskew.py` | **Done** |
| `PDFL-209` | Kiểm thử PDF tiếng Việt có dấu và tài liệu đa ngôn ngữ | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_text_metrics.py`, bộ ground-truth | **Done** |
| `PDFL-210` | Kiểm thử PDF nhiều trang, nhiều cột hoặc bố cục phức tạp | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_layout_metrics.py` | **Done** |
| `PDFL-211` | Kiểm thử PDF bị hỏng, có mật khẩu hoặc không đọc được | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_blank_page.py`, `test_upload_security.py` | **Done** |
| `PDFL-212` | Kiểm thử file nhỏ, sát giới hạn và vượt giới hạn dung lượng | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_size_page_limits_integration.py` | **Done** |
| `PDFL-213` | Kiểm thử tài liệu dài khi dịch, tóm tắt và hỏi đáp AI | EPIC 15 | 3 | Nguyễn Lê Huy Tâm | `test_translation_pipeline_tasks.py` | **Done** |
| `PDFL-215` | Đảm bảo mật khẩu không lưu dạng văn bản thuần | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_auth.py`, bcrypt trong `security.py` | **Done** |
| `PDFL-216` | Đảm bảo API key và secret không bị đưa lên GitHub | EPIC 15 | 2 | Nguyễn Lê Huy Tâm | `.gitignore`, `.env.example`, rà soát secret | **Done** |
| `PDFL-217` | Kiểm tra xác thực và phân quyền trên các API riêng tư | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_security_matrix.py` | **Done** |
| `PDFL-219` | Kiểm soát dung lượng tải lên, số trang và thời gian chạy | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_size_page_limits_integration.py` | **Done** |
| `PDFL-220` | Ngăn chặn truy cập trái phép tài liệu của người khác | EPIC 15 | 2 | Nguyễn Lê Huy Tâm | `test_document_access_control.py` (Anti-IDOR) | **Done** |
| `PDFL-221` | Chính sách lưu trữ, xóa và bảo vệ dữ liệu người dùng | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_history_delete.py` | **Done** |
| `PDFL-223` | Kiểm tra lỗi SQL injection, XSS hoặc tải file độc hại | EPIC 15 | 2 | Nguyễn Lê Huy Tâm | `test_upload_security.py` | **Done** |
| `PDFL-224` | Đánh giá thời gian trích xuất, OCR, dịch và AI | EPIC 15 | 2 | Huỳnh Đình Chấn | `benchmark_runner.py` | **Done** |
| `PDFL-225` | Kiểm tra xử lý đồng thời nhiều yêu cầu | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_parallel_pdf_processing.py` | **Done** |
| `PDFL-226` | Tối ưu quy trình đọc và giải phóng bộ nhớ file lớn | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_memory_optimization.py` | **Done** |
| `PDFL-227` | Thiết lập thông báo lỗi và cơ chế khôi phục | EPIC 15 | 2 | Nguyễn Lê Huy Tâm | `exceptions.py`, `logger.py` | **Done** |
| `PDFL-205` | Kiểm thử giao diện trên các kích thước màn hình | EPIC 15 | 2 | Huỳnh Đình Chấn | `test_frontend_split_view.js` | **Done** |
| `PDFL-222` | Hạn chế nội dung không đáng tin cậy vào prompt AI | EPIC 15 | 2 | Nguyễn Lê Huy Tâm | Prompt guardrails trong `ai_service.py` | **Done** |
| `PDFL-230` | Chọn nơi lưu trữ PDF và file kết quả | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | `storage_service.py` | **Done** |
| `PDFL-231` | Thiết lập database cho môi trường triển khai | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | `database.py` (SQLite WAL / PostgreSQL) | **Done** |
| `PDFL-232` | Cấu hình biến môi trường và API key production | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | `config.py` Settings | **Done** |
| `PDFL-233` | Cấu hình CORS, domain và HTTPS | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | CORS Middleware trong `main.py` | **Done** |
| `PDFL-234` | Cài đặt các thành phần cần thiết cho OCR trên server | EPIC 16 | 2 | Huỳnh Đình Chấn | Cấu hình nhận diện Tesseract OCR | **Done** |
| `PDFL-236` | Kiểm tra việc xử lý file lớn theo giới hạn công bố | EPIC 16 | 2 | Huỳnh Đình Chấn | `test_size_page_limits_integration.py` | **Done** |
| `PDFL-237` | Thiết lập kiểm tra tình trạng hoạt động và theo dõi lỗi | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | Health check `GET /health` | **Done** |
| `PDFL-238` | Phương án sao lưu và phục hồi database | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | Tài liệu chiến lược backup database | **Done** |
| `PDFL-241` | Ghi rõ công nghệ sử dụng và yêu cầu cài đặt | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | Tài liệu `README.md` | **Done** |
| `PDFL-242` | Hướng dẫn thiết lập môi trường chạy máy cá nhân | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | `run.bat`, `README.md` | **Done** |
| `PDFL-243` | Hướng dẫn cấu hình .env và dịch vụ bên ngoài | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | `.env.example`, `README.md` | **Done** |
| `PDFL-244` | Mô tả cấu trúc thư mục và kiến trúc hệ thống | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | `kien_truc_he_thong.md` | **Done** |
| `PDFL-245` | Viết tài liệu API và ví dụ request/response | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | Swagger UI `/docs` | **Done** |

> **Thống kê Tuần 7**:
> - **Tổng số công việc**: 45 work items (37 Done - 69 SP / 8 To Do - 29 SP)
> - **Tổng Story Points**: 98 SP (Nguyễn Lê Huy Tâm: 53 SP | Huỳnh Đình Chấn: 45 SP | Chung: 0 SP)

---

## 4. BÁO CÁO TỔNG HỢP ĐÓNG GÓP TOÀN DỰ ÁN (TUẦN 1 - TUẦN 7)

### 📊 Bảng Ma Trận Tổng Hợp Đóng Góp Qua 7 Tuần

| Chỉ số đánh giá | Nguyễn Lê Huy Tâm (Trưởng nhóm) | Huỳnh Đình Chấn (Thành viên) | Cả hai thành viên | Tổng toàn dự án |
| :--- | :---: | :---: | :---: | :---: |
| **Tổng số Commit trên Git** | **204 commits** (58.0%) | **148 commits** (42.0%) | 352 commits | **352 commits** (100%) |
| **Tổng Story Points đảm trách (Tuần 1 - 7)** | **441 SP** (57.6%) | **311 SP** (40.6%) | **14 SP** (1.8%) | **766 SP** (100%) |
| **Số lượng Work Items Jira đảm trách** | **147 tasks** | **105 tasks** | 8 tasks | **260 tasks** |
| **Tỷ lệ hoàn thành công việc được giao** | **96.6%** (142 Done / 2 In Prog / 3 To Do) | **96.2%** (101 Done / 1 In Prog / 3 To Do) | 75.0% (6 Done / 2 To Do) | **95.8%** (249 Done / 3 In Prog / 8 To Do) |
| **Số file Test Suite tự động xây dựng** | 14 test suites | 18 test suites | 4 test suites chung | **36 test files** |

---

### 🛡️ Đối Chiếu Kết Quả Phân Công Thực Hiện EPIC 15 & EPIC 16
*(Trích xuất từ kết quả kiểm toán mã nguồn chi tiết tại [phan_cong_thuc_hien_epic15_epic16.md](../.plan/.extra/phan_cong_thuc_hien_epic15_epic16.md))*:

#### 1. EPIC 15: Kiểm thử, bảo mật và tối ưu (23 / 26 Task Done)
- **Huỳnh Đình Chấn (Chủ lực Kiểm định OCR, Benchmark & Bảo mật)**:
  - Khởi tạo và hiện thực toàn bộ các bài test chuyên sâu về OCR, Deskew, xoay trang, chất lượng tiếng Việt và bố cục phức tạp (`PDFL-208`, `PDFL-209`, `PDFL-210`).
  - Xây dựng hệ thống đo lường hiệu năng: Benchmark Runner (`PDFL-224`), Đo đạc giải phóng bộ nhớ (`PDFL-226`), Xử lý song song (`PDFL-225`).
  - Phụ trách kiểm thử phân quyền RBAC (`PDFL-202`), Ma trận bảo mật API riêng tư (`PDFL-217`), Kiểm soát dung lượng tải lên (`PDFL-212`, `PDFL-219`), Xóa dữ liệu lịch sử (`PDFL-221`), Kiểm thử băm mật khẩu bcrypt (`PDFL-215`).
- **Nguyễn Lê Huy Tâm (Chủ lực Kiểm thử Kiến trúc, E2E & AI Intelligence)**:
  - Khởi tạo kiến trúc xử lý ngoại lệ tập trung (`PDFL-227`), An toàn mã nguồn (`PDFL-216`).
  - Kiểm thử tích hợp toàn bộ luồng E2E Pipeline từ upload PDF đến trả kết quả (`PDFL-204`).
  - Phụ trách toàn bộ mảng kiểm thử Trí tuệ nhân tạo (AI): Tóm tắt Map-Reduce tài liệu dài (`PDFL-213`), Rào chắn câu hỏi trợ lý AI (`PDFL-222`), Kiểm thử chống truy cập chéo tài liệu Anti-IDOR (`PDFL-220`).
  - Kiểm thử chức năng Admin Console (`PDFL-203`) và Kiểm tra an toàn SQLi / XSS (`PDFL-223`).

#### 2. EPIC 16: Triển khai, tài liệu và bàn giao (12 / 17 Task Done)
- **Nguyễn Lê Huy Tâm (Chủ lực Tài liệu, Môi trường & Kiến trúc)**:
  - Biên soạn toàn bộ hệ thống tài liệu: `README.md` (`PDFL-240`, `PDFL-241`, `PDFL-243`), `Docs/user-guide/user-guide.md` (`PDFL-246`), Thuyết minh kiến trúc hệ thống (`PDFL-244`, `PDFL-269`).
  - Cấu hình môi trường máy chủ: Database SQLite WAL (`PDFL-231`), CORS (`PDFL-233`), Health check (`PDFL-237`), Phân vùng lưu trữ Storage (`PDFL-230`), Script tự động `run.bat` (`PDFL-242`), OpenAPI Swagger docs (`PDFL-245`).
- **Huỳnh Đình Chấn (Chủ lực Kiểm tra giới hạn tải & Tài liệu thiết kế)**:
  - Kiểm tra việc xử lý file lớn theo giới hạn công bố (`PDFL-236`).
  - Thiết lập môi trường tương thích Tesseract OCR (`PDFL-234`).
  - Chuẩn bị dữ liệu PDF mẫu phục vụ demo (`PDFL-247`).
  - Xây dựng sơ đồ Use Case Diagram (`PDFL-270`) và Lược đồ Lớp Class Diagram (`PDFL-271`).

---

## 5. Nguyên Tắc Phối Hợp & Tiêu Chuẩn Hoàn Thành (Definition of Done - DoD)

Một nhiệm vụ chỉ được đánh dấu là **Done** khi thỏa mãn đầy đủ 5 tiêu chuẩn khắt khe của nhóm:
1. **Mã nguồn chuẩn mực**: Logic hoạt động chính xác theo yêu cầu, tuân thủ PEP 8 (Python) và ESLint conventions (JavaScript), không có mã rác, log debug thừa.
2. **Kiểm thử tự động & thủ công**: Vượt qua 100% unit test và integration test liên quan; kiểm tra thủ công các kịch bản bình thường và kịch bản biên ngoại lệ.
3. **Bảo mật dữ liệu tuyệt đối**: Không hardcode mật khẩu, token bí mật hoặc API key; mã hóa một chiều mật khẩu bằng bcrypt; cô lập an toàn tài liệu giữa các tài khoản người dùng (Anti-IDOR).
4. **Quy trình Git & Review**: Code được phát triển trên nhánh tính năng (`feature/...`), tạo Pull Request và được thành viên còn lại review, phê duyệt trước khi merge vào nhánh chính.
5. **Đồng bộ hóa Jira**: Cập nhật trạng thái task trên Jira Board sang `Done` ngay sau khi tính năng được merge và kiểm chứng thành công.
