# PDF-Lingua - Kế Hoạch 8 Sprint Phát Triển (Full Sprint Plan)

- **Dự án**: **PDF Lingua** - Ứng dụng web trích xuất văn bản từ tài liệu PDF, dịch thuật đa ngôn ngữ, tích hợp AI tóm tắt và trợ lý hỏi đáp tài liệu thông minh.
- **Thành viên nhóm**:
  1. `056206011188` - **Nguyễn Lê Huy Tâm** (Trưởng nhóm - Backend, Kiến trúc hệ thống, Dịch thuật, AI Engine, Admin)
  2. `077206002307` - **Huỳnh Đình Chấn** (Thành viên - Frontend UI/UX, Xác thực & Phân quyền, OCR Nâng cao, Benchmark & Security)
- **Jira Project Key**: `PDFL`
- **Jira Board & Summary**: [https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary](https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary)
- **Tài liệu tham chiếu**:
  - Product Backlog chi tiết: [PDF_Lingua_Jira_Backlog.md](./PDF_Lingua_Jira_Backlog.md)
  - Bảng phân công nhiệm vụ chi tiết: [Assignment.md](./Assignment.md)
  - Báo cáo phân công thực hiện EPIC 15 & 16: [phan_cong_thuc_hien_epic15_epic16.md](../.plan/.extra/phan_cong_thuc_hien_epic15_epic16.md)
- **Ngày khởi tạo kế hoạch**: `15/10/2026` (Bắt đầu chu kỳ Sprint 1)
- **Ngày cập nhật lần cuối**: `27/11/2026` (Đồng bộ hóa 100% Sprint 1 đến Sprint 8 theo Jira Cloud và mã nguồn dự án)
- **Tiến độ tổng quan**:
  - **Sprint 1, 2, 3, 4, 5, 6**: Đã hoàn thành 100% (Khung kiến trúc, Tài khoản/Auth, Trích xuất PDF & OCR, Dịch thuật đa ngôn ngữ, Xuất file, Lịch sử, Admin, Gói Free/Pro, AI Tóm tắt & Chatbot RAG, Đa ngôn ngữ, Landing Page, Avatar, Billing và CI/CD).
  - **Sprint 7 (22/11 - 29/11/2026)**: 31 work items (20 Done - 67 SP / 7 In Progress - 20 SP / 4 To Do - 8 SP - tổng 95 Story Points) gồm nghiệm thu triển khai website, báo cáo tổng kết đồ án, theo dõi khách truy cập, vá các lỗi quan trọng, kiểm thử vai trò và kế hoạch mở rộng.
  - **Sprint 8 (23/11 - 30/11/2026)**: Đã hoàn thành 100% trọn vẹn 35 work items (69 Story Points Done) gồm bộ test suite tự động 36 files (Unit, Integration, Security, Benchmark) và cấu hình hạ tầng triển khai.

---

## 📌 Chiến Lược Phân Bổ 7 Sprint (Roadmap Strategy)

Hệ thống được phát triển theo mô hình Scrum/Agile với chu kỳ **1 tuần / 1 Sprint** trong tổng thời gian 7 tuần (13/10/2026 - 01/12/2026):

1. **Sprint 1 (Tuần 1: 13/10 - 20/10/2026) - Phân Tích Yêu Cầu, Thiết Kế Hệ Thống & Khởi Tạo Khung Dự Án**:
   - Khảo sát nghiệp vụ, Use Case Diagram, Activity Diagram, ERD cơ sở dữ liệu, kiến trúc phần mềm tổng quan.
   - Khởi tạo Backend FastAPI, Frontend HTML/CSS/JS, cấu hình database SQLite WAL / PostgreSQL, CORS, logging và healthcheck.
   - Thiết lập cấu hình bảo mật dự án (`.gitignore`, `.env.example`, tài liệu Swagger/OpenAPI tự động).
2. **Sprint 2 (Tuần 2: 20/10 - 27/10/2026) - Hệ Thống Tài Khoản, Xác Thực & Cốt Lõi Xử Lý PDF/OCR**:
   - Xây dựng hệ thống tài khoản người dùng, băm mật khẩu bảo mật `bcrypt` (12 rounds salt), phiên đăng nhập JWT.
   - Upload PDF an toàn: kiểm tra magic bytes `%PDF-`, giới hạn 20MB (Free) / 100MB (Pro), tối đa 100 trang, chặn file hỏng/có mật khẩu.
   - Trích xuất văn bản số (`pypdf`, `pdfplumber`), giữ thứ tự đọc tự nhiên (Natural Reading Order) và OCR scan (`Tesseract`).
   - Xây dựng bộ test tự động nền tảng (Unit test Services, API test, Auth test, E2E pipeline, kiểm tra băm mật khẩu và chống injection).
3. **Sprint 3 (Tuần 3: 27/10 - 03/11/2026) - Quản Lý Tài Liệu, OCR Nâng Cao, Dịch Thuật Cốt Lõi, Xuất File & Đo Lường**:
   - Quản lý tài liệu cá nhân: Danh sách file, xem chi tiết metadata, xóa an toàn, dọn dẹp file tạm và cô lập dữ liệu.
   - Tiền xử lý hình ảnh OCR: Khử nghiêng (Deskew), xoay trang (Orientation), phát hiện trang trắng (Blank Page).
   - Tích hợp động cơ dịch thuật đa ngôn ngữ (`deep-translator`, Google GTX, fallback MyMemory), chia đoạn chống nghẽn API.
   - Xuất file TXT (UTF-8 BOM), PDF Unicode tiếng Việt, hỗ trợ kéo thả file và chính sách điều khoản người dùng.
   - Bộ test đánh giá chuyên sâu: Đánh giá trích xuất tiếng Việt, layout văn bản, benchmark hiệu năng, đo đạc bộ nhớ (Memory Optimization) và xử lý song song (Parallel Processing).
4. **Sprint 4 (Tuần 4: 03/11 - 10/11/2026) - Dịch Thuật Fallback, Xuất File, Lịch Sử Xử Lý, Quản Trị Admin Cơ Bản & Quyền Lợi Gói**:
   - Xử lý lỗi dịch thuật đa tầng (mạng lỗi, rate limit, fallback), kiểm thử các cặp ngôn ngữ phổ biến và định dạng file xuất.
   - Thiết kế bảng dữ liệu lịch sử xử lý, API lưu/truy vấn/mở lại/xóa lịch sử theo chính sách lưu trữ.
   - Thiết lập quyền lợi gói Free vs Pro (20MB vs 100MB, hạn mức số trang, hạn mức dịch vụ).
   - Xây dựng Dashboard quản trị Admin cơ bản (danh sách tài khoản, khóa/mở khóa tài khoản, phân quyền RBAC).
   - Bộ test ma trận bảo mật (Security Matrix), kiểm thử giới hạn dung lượng tải lên và kiểm tra ranh giới truy cập an toàn.
5. **Sprint 5 (Tuần 5: 10/11 - 17/11/2026) - Lịch Sử Pro, Quản Trị Admin Nâng Cao, Hạn Mức Free/Pro, Mở Rộng, Thiết Kế Đồ Án, Avatar & Quản Lý Gói/Hóa Đơn (Billing)**:
   - Lịch sử Pro: Lưu trữ kết quả trích xuất, dịch và tóm tắt; API mở lại kết quả cũ; kiểm soát truy cập lịch sử nghiêm ngặt.
   - Admin Console nâng cao: Quản lý người dùng, cấp/hạ quyền Pro, theo dõi thống kê, nhật ký thao tác (Audit log).
   - Tính năng mở rộng: Xử lý tệp theo lô (Batch Processing), tải file nén ZIP, xuất kết quả Microsoft Word (.docx), xem trước PDF trực tiếp (PDF Inline Preview), chọn trang cụ thể (Page Selection).
   - Nộp hồ sơ thiết kế đồ án giữa kỳ: Kiến trúc hệ thống (`PDFL-269`), Lược đồ usecase (`PDFL-270`), Lược đồ lớp (`PDFL-271`).
   - Hoàn thiện tính năng Avatar người dùng (`PDFL-272`, `PDFL-273`), lịch sử giao dịch và hạn mức sử dụng gói Pro (`PDFL-274`, `PDFL-275`, `PDFL-276`) và thống kê dịch vụ (`PDFL-262`).
6. **Sprint 6 (Tuần 6: 17/11 - 24/11/2026) - Tích Hợp AI: Tóm Tắt Văn Bản & Trợ Lý Hỏi Đáp Tài Liệu Theo Ngữ Cảnh, Tính Năng Mở Rộng & Triển Khai**:
   - Tích hợp mô hình ngôn ngữ lớn (LLM API), quản lý an toàn API key qua biến môi trường.
   - AI Tóm tắt tài liệu: Tùy chọn kiểu tóm tắt (ngắn gọn, chi tiết, bullet points), kỹ thuật Map-Reduce chia đoạn tóm tắt cho tài liệu dài.
   - Trợ lý AI hỏi đáp tài liệu (Contextual Document QA/RAG Chatbot): Trích xuất đoạn liên quan làm ngữ cảnh, trả lời bám sát tài liệu, hạn chế ảo giác (hallucination guardrails), bảo vệ cô lập dữ liệu người dùng.
   - Hoàn thành xuất sắc 37/37 work items (100 Story Points - 100% Done) đúng theo Jira Board.
7. **Sprint 7 (Tuần 7: 22/11 - 29/11/2026) - Kiểm Thử Toàn Diện, Triển Khai Hệ Thống, Tài Liệu Bàn Giao & Nghiệm Thu Đồ Án**:
   - 45 work items (98 Story Points) bao gồm toàn bộ kiểm thử bảo mật/hiệu năng EPIC 15, thiết lập triển khai/tài liệu kỹ thuật EPIC 16, viết báo cáo phân tích thiết kế, chuẩn bị slide/kịch bản demo, hướng dẫn sử dụng web PDFL-279 và rà soát kho mã nguồn trước bàn giao.
   - Đồng bộ 100% Jira Board: 37 công việc đã hoàn thành trong codebase (69 SP Done) và 8 công việc nghiệm thu tài liệu/demo cuối kỳ (29 SP To Do).

---

## 🗺️ Ma Trận Tổng Quan 7 Sprint (Sprint Matrix)

| Sprint | Thời gian | Mục tiêu trọng tâm | Epics phụ trách chính | Số lượng Work Items | Story Points | Trạng thái |
| :---: | :---: | :--- | :--- | :---: | :---: | :---: |
| **Sprint 1** | 13/10 - 20/10/2026 | Khảo sát, kiến trúc, khung dự án, môi trường & cấu hình cơ bản | **EPIC 01, EPIC 02, EPIC 03, EPIC 04, EPIC 15, EPIC 16** | 31 tasks backlog + 10 tasks test/deploy | 77 + 24 SP | ✅ **Đã hoàn thành** (100% Done) |
| **Sprint 2** | 20/10 - 27/10/2026 | Hệ thống tài khoản, xác thực bcrypt, cốt lõi xử lý PDF/OCR & test suite nền tảng | **EPIC 03, EPIC 04, EPIC 05, EPIC 06, EPIC 07, EPIC 15** | 32 tasks backlog + 6 tasks test/security | 90 + 17 SP | ✅ **Đã hoàn thành** (100% Done) |
| **Sprint 3** | 27/10 - 03/11/2026 | Quản lý tài liệu, OCR nâng cao, dịch thuật cốt lõi, xuất file & kiểm thử hiệu năng | **EPIC 03, EPIC 05, EPIC 06, EPIC 07, EPIC 08, EPIC 11, EPIC 15, EPIC 16, EPIC 17** | 39 tasks backlog + 13 tasks test/measure | 105 + 36 SP | ✅ **Đã hoàn thành** (100% Done) |
| **Sprint 4** | 03/11 - 10/11/2026 | Dịch thuật fallback, xuất file, lịch sử, admin cơ bản, quyền lợi Free/Pro & bảo mật | **EPIC 08, EPIC 11, EPIC 12, EPIC 13, EPIC 14, EPIC 15, EPIC 16, EPIC 17** | 31 tasks backlog + 13 tasks test/security | 84 + 35 SP | ✅ **Đã hoàn thành** (100% Done) |
| **Sprint 5** | 10/11 - 17/11/2026 | Lịch sử Pro, Quản trị Admin, Hạn mức gói Free/Pro, Mở rộng, Thiết kế đồ án, Avatar/Billing & Thống kê | **EPIC 03, EPIC 04, EPIC 12, EPIC 13, EPIC 14, EPIC 16, EPIC 17** | 41 work items | 123 SP | ✅ **Đã hoàn thành** (41/41 Done - 100%) |
| **Sprint 6** | 17/11 - 24/11/2026 | Tích hợp AI, Tính năng mở rộng, Trang chào mừng & Triển khai CI/CD | **EPIC 03, EPIC 09, EPIC 10, EPIC 11, EPIC 15, EPIC 16** | 37 work items | 100 SP | ✅ **Đã hoàn thành** (37/37 Done - 100 SP) |
| **Sprint 7** | 22/11 - 29/11/2026 | Kiểm thử toàn diện, Triển khai, Tài liệu bàn giao & Nghiệm thu | **EPIC 15, EPIC 16** | 45 work items | 98 SP | 📋 **Kế hoạch & Nghiệm thu** (69 SP Done / 29 SP To Do) |

---

## 🏃 CHI TIẾT KẾ HOẠCH TỪNG SPRINT (SPRINT 1 ĐẾN SPRINT 7)

### 🔹 Sprint 1: Phân Tích Yêu Cầu, Thiết Kế Hệ Thống & Khởi Tạo Khung Dự Án
- **Thời gian**: 13/10/2026 - 20/10/2026 (Tuần 1)
- **Mục tiêu**: Hoàn thành tài liệu phân tích thiết kế (Use Case, Activity Diagram, ERD, Kiến trúc hệ thống), khởi tạo repository GitHub, khung mã nguồn Frontend/Backend, quy chuẩn làm việc Git, cơ sở dữ liệu và bảo mật cấu hình.
- **Trạng thái**: ✅ **Đã hoàn thành (100% Done)** - **31 Work Items Backlog (77 SP)**

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Người thực hiện | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `PDFL-1` | Xác định đối tượng sử dụng: Khách, Free, Pro, Admin | EPIC 01 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-2` | Chốt danh sách chức năng chính và chức năng mở rộng | EPIC 01 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-3` | Xác định quyền lợi, giới hạn gói Free (20MB) và Pro (100MB) | EPIC 01 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-4` | Xác định quy trình xử lý tài liệu từ upload đến xuất kết quả | EPIC 01 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-21` | Xây dựng Use Case Diagram | EPIC 01 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-22` | Xây dựng sơ đồ hoạt động (Activity Diagram) các luồng chính | EPIC 01 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-23` | Thiết kế kiến trúc tổng thể (Frontend, Backend, Database, OCR, AI) | EPIC 01 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-24` | Thiết kế sơ đồ ERD và mô hình dữ liệu quan hệ | EPIC 01 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-25` | Thống nhất cấu trúc và quy chuẩn API giữa Frontend và Backend | EPIC 01 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-26` | Xác định yêu cầu phi chức năng (bảo mật, hiệu năng, UX) | EPIC 01 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-27` | Tạo repository GitHub `pdf-lingua` | EPIC 02 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-28` | Xây dựng cấu trúc thư mục Frontend và Backend | EPIC 02 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-29` | Khởi tạo ứng dụng Frontend bằng HTML, CSS và JavaScript | EPIC 02 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-30` | Khởi tạo Backend bằng Python và FastAPI | EPIC 02 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-31` | Cấu hình môi trường Python, `requirements.txt` và `venv` | EPIC 02 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-32` | Cấu hình các biến môi trường trong `.env` | EPIC 02 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-33` | Tạo `.env.example` và cấu hình `.gitignore`, `.gitattributes` | EPIC 02 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-34` | Cấu hình kết nối database (SQLite / PostgreSQL) | EPIC 02 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-35` | Thiết lập quy tắc đặt tên branch, commit và Pull Request | EPIC 02 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-36` | Xây dựng API kiểm tra tình trạng Backend (`/health`) | EPIC 02 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-37` | Cấu hình môi trường để Frontend gọi API Backend (CORS) | EPIC 02 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-38` | Kiểm tra khởi chạy toàn bộ dự án trên máy phát triển | EPIC 02 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-39` | Xác định phong cách thiết kế, màu sắc, typography giao diện | EPIC 03 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-40` | Thiết kế thanh điều hướng (Navbar) và bố cục chung | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-41` | Xây dựng trang chủ giới thiệu PDF-Lingua và tính năng | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-58` | Đảm bảo giao diện responsive trên máy tính và điện thoại | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-60` | Thiết kế cấu trúc module Backend theo nhóm chức năng | EPIC 04 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-61` | Xây dựng các lớp xử lý nghiệp vụ (Service layer pattern) | EPIC 04 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-62` | Chuẩn hóa cấu trúc request và response của API | EPIC 04 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-63` | Xây dựng cơ chế xử lý lỗi chung (Global Exception Handler) | EPIC 04 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-64` | Cấu hình CORS an toàn cho phát triển và triển khai | EPIC 04 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-68` | Chuẩn hóa HTTP status code và thông báo lỗi rõ ràng | EPIC 04 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-69` | Xây dựng tài liệu API Swagger/OpenAPI tự động | EPIC 04 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-70` | Thiết lập logging để theo dõi hoạt động xử lý và lỗi | EPIC 04 | 2 | Nguyễn Lê Huy Tâm | **Done** |

#### 📦 Công việc Cấu hình Môi trường & Bảo mật nền tảng hoàn thành song song trong Tuần 1 (EPIC 15 & 16)
*(Căn cứ theo lịch sử Git commit và tài liệu đối chiếu [phan_cong_thuc_hien_epic15_epic16.md](../.plan/.extra/phan_cong_thuc_hien_epic15_epic16.md))*:

| Mã Task | Tên nội dung kỹ thuật | Epic | File thực hiện / Minh chứng | Người thực hiện | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: |
| `PDFL-216` | Đảm bảo API key và secret không bị đưa lên GitHub | EPIC 15 | `.gitignore` (16/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-227` | Thiết lập thông báo lỗi, logging và khôi phục sự cố | EPIC 15 | `Code/backend/app/core/exceptions.py`, `main.py` (23/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-231` | Thiết lập database cho môi trường triển khai | EPIC 16 | `Code/backend/app/core/database.py` (SQLite WAL) (22/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-232` | Cấu hình biến môi trường và API key | EPIC 16 | `Code/backend/app/core/config.py`, `.env.example` (22/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-233` | Cấu hình CORS, domain và HTTPS | EPIC 16 | `Code/backend/app/main.py` (`CORSMiddleware`) (21/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-234` | Cài đặt các thành phần cần thiết cho OCR trên server | EPIC 16 | `README.md`, `ocr_service.py` (16/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-237` | Thiết lập kiểm tra tình trạng hoạt động và theo dõi lỗi | EPIC 16 | `Code/backend/app/main.py` (`GET /health`) (21/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-241` | Ghi rõ công nghệ sử dụng và yêu cầu cài đặt | EPIC 16 | `README.md` (16/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-243` | Hướng dẫn cấu hình .env và các dịch vụ bên ngoài | EPIC 16 | `README.md`, `.env.example` (20/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-245` | Viết tài liệu API và ví dụ request/response | EPIC 16 | `Code/backend/app/main.py` (OpenAPI Swagger) (21/10/2026) | Nguyễn Lê Huy Tâm | **Done** |

---

### 🔹 Sprint 2: Hệ Thống Tài Khoản, Xác Thực & Cốt Lõi Xử Lý PDF, OCR
- **Thời gian**: 20/10/2026 - 27/10/2026 (Tuần 2)
- **Mục tiêu**: Xây dựng toàn diện cơ chế tài khoản & bảo mật mật khẩu bcrypt, đồng thời tích hợp sớm toàn bộ luồng cốt lõi xử lý PDF (Upload, kiểm tra an toàn, giới hạn trang/dung lượng, trích xuất văn bản PyMuPDF/pdfplumber và nhận dạng OCR Tesseract kết hợp giao diện Workspace).
- **Trạng thái**: ✅ **Đã hoàn thành 100% (Completed)** - **32 Work Items Backlog (90 SP)**

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Người thực hiện | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `PDFL-65` | Xây dựng API lấy thông tin người dùng hiện tại (`/api/auth/me`) | EPIC 04 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-66` | Xây dựng API kiểm tra quyền sử dụng tính năng | EPIC 04 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-72` | Thiết kế bảng dữ liệu tài khoản người dùng (User schema) | EPIC 05 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-73` | Xây dựng chức năng đăng ký tài khoản | EPIC 05 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-74` | Kiểm tra email và thông tin đăng ký hợp lệ | EPIC 05 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-75` | Mã hóa mật khẩu trước khi lưu vào database (bcrypt 12 rounds) | EPIC 05 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-76` | Xây dựng chức năng đăng nhập | EPIC 05 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-78` | Xây dựng chức năng đăng xuất | EPIC 05 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-79` | Xây dựng chức năng xem và cập nhật thông tin tài khoản | EPIC 05 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-80` | Xây dựng chức năng đổi mật khẩu | EPIC 05 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-81` | Kiểm soát quyền truy cập của khách, người dùng đã đăng nhập và Admin | EPIC 05 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-82` | Kiểm tra quyền truy cập khi người dùng gọi trực tiếp API | EPIC 05 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-83` | Xử lý trường hợp token hết hạn, tài khoản không tồn tại | EPIC 05 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-84` | Kiểm tra khả năng truy cập và chỉnh sửa dữ liệu của người dùng khác | EPIC 05 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-85` | Xây dựng API tải tài liệu PDF lên Backend (`/api/process/upload-and-translate`) | EPIC 06 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-86` | Kiểm tra loại file và nội dung file để hạn chế file giả mạo | EPIC 06 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-87` | Áp dụng giới hạn dung lượng: Free tối đa 20 MB/tệp, Pro tối đa 100 MB/tệp | EPIC 06 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-88` | Kiểm tra PDF bị hỏng, có mật khẩu hoặc không thể đọc | EPIC 06 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-89` | Thiết lập giới hạn số trang được phép xử lý (Free 100 trang) | EPIC 06 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-99` | Tích hợp thư viện PyMuPDF để đọc và trích xuất văn bản | EPIC 07 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-100` | Trích xuất văn bản theo từng trang | EPIC 07 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-101` | Xử lý xuống dòng, khoảng trắng và ký tự bất thường | EPIC 07 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-102` | Giữ thứ tự văn bản hợp lý khi tài liệu có nhiều đoạn hoặc nhiều cột | EPIC 07 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-103` | Phát hiện tài liệu có ít hoặc không có văn bản trích xuất được | EPIC 07 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-104` | Tích hợp Tesseract OCR để nhận diện văn bản từ PDF scan | EPIC 07 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-105` | Cấu hình dữ liệu ngôn ngữ OCR cần hỗ trợ, ưu tiên tiếng Việt và tiếng Anh | EPIC 07 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-106` | Kết hợp kết quả OCR với cơ chế trích xuất văn bản thông thường (Hybrid Engine) | EPIC 07 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-107` | Xây dựng API trả về nội dung văn bản được trích xuất | EPIC 07 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-45` | Xây dựng giao diện tải tài liệu PDF (Dropzone UI) | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-46` | Xây dựng giao diện hiển thị tiến trình tải lên và xử lý tài liệu | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-47` | Xây dựng giao diện hiển thị văn bản sau khi trích xuất (Dual-pane Workspace) | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-57` | Thiết kế trạng thái loading, lỗi, thành công và giao diện khi chưa có dữ liệu | EPIC 03 | 2 | Huỳnh Đình Chấn | **Done** |

#### 🧪 Bộ Test Suite Kiểm Thử Nền Tảng & Bảo Mật hoàn thành trong Tuần 2 (EPIC 15)
*(Căn cứ theo lịch sử Git commit và tài liệu đối chiếu [phan_cong_thuc_hien_epic15_epic16.md](../.plan/.extra/phan_cong_thuc_hien_epic15_epic16.md))*:

| Mã Task | Tên nội dung kiểm thử | Epic | File Test Suite / Minh chứng | Người thực hiện | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: |
| `PDFL-200` | Unit test cho các hàm xử lý nghiệp vụ quan trọng | EPIC 15 | `Code/backend/tests/test_services.py` (27/10/2026) | Cả hai (Tâm & Chấn) | **Done** |
| `PDFL-201` | Kiểm thử API upload, trích xuất, OCR, dịch thuật | EPIC 15 | `Code/backend/tests/test_api_process.py` (27/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-202` | Kiểm thử đăng ký, đăng nhập, phân quyền và gói Free/Pro | EPIC 15 | `Code/backend/tests/test_auth.py`, `test_frontend_login.js` (27/10/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-204` | Kiểm thử tích hợp toàn bộ luồng E2E từ tải PDF đến kết quả | EPIC 15 | `Code/backend/tests/test_e2e_pipeline.py` (27/10/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-215` | Đảm bảo mật khẩu không được lưu dưới dạng văn bản thuần | EPIC 15 | `Code/backend/tests/test_auth.py` (bcrypt verification) (27/10/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-223` | Kiểm tra các lỗi SQL injection, XSS và Header injection | EPIC 15 | `Code/backend/tests/test_api_process.py` (27/10/2026) | Nguyễn Lê Huy Tâm | **Done** |

---

### 🔹 Sprint 3: Quản Lý Tài Liệu Người Dùng, Tối Ưu Hóa OCR Nâng Cao, Dịch Thuật & Hoàn Thiện Giao Diện
- **Thời gian**: 27/10/2026 - 03/11/2026 (Tuần 3)
- **Mục tiêu**: Hoàn thiện toàn diện giao diện Auth & Profile, quản lý tài liệu cá nhân, tối ưu OCR nâng cao cho tài liệu xoay/lỗi/nhiều trang, tích hợp động cơ dịch thuật đa ngôn ngữ và xuất tệp kết quả TXT/PDF, hỗ trợ kéo thả file và chính sách điều khoản người dùng.
- **Trạng thái**: ✅ **Đã hoàn thành 100% (Completed)** - **39 Work Items Backlog (105 SP)**

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Người thực hiện | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `PDFL-42` | Xây dựng trang đăng ký tài khoản | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-43` | Xây dựng trang đăng nhập | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-44` | Xây dựng trang thông tin tài khoản | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-48` | Xây dựng giao diện chọn ngôn ngữ nguồn và ngôn ngữ đích | EPIC 03 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-49` | Xây dựng giao diện hiển thị bản dịch | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-52` | Xây dựng giao diện so sánh hoặc chuyển đổi giữa văn bản gốc và bản dịch | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-59` | Kiểm tra tính nhất quán về thiết kế và khả năng sử dụng | EPIC 03 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-77` | Xây dựng cơ chế quản lý phiên đăng nhập hoặc token | EPIC 05 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-90` | Lưu trữ file trong thư mục hoặc dịch vụ lưu trữ được cấu hình | EPIC 06 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-91` | Ghi nhận metadata của tài liệu như tên file, dung lượng, số trang, thời gian và chủ sở hữu | EPIC 06 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-92` | Hiển thị danh sách tài liệu của người dùng | EPIC 06 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-93` | Xem thông tin chi tiết của một tài liệu | EPIC 06 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-94` | Xây dựng chức năng xóa tài liệu | EPIC 06 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-95` | Kiểm soát quyền tải xuống và truy cập file | EPIC 06 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-96` | Xử lý lỗi khi tải file, mất kết nối hoặc quá giới hạn | EPIC 06 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-97` | Xóa các file tạm khi hoàn tất xử lý hoặc khi xảy ra lỗi | EPIC 06 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-98` | Đảm bảo tài liệu riêng tư không bị người dùng khác truy cập | EPIC 06 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-108` | Hiển thị kết quả trích xuất trên giao diện | EPIC 07 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-109` | Xử lý tài liệu có trang trống, trang bị xoay hoặc hình ảnh chất lượng thấp | EPIC 07 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-110` | Kiểm thử độ chính xác với PDF thông thường và PDF scan | EPIC 07 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-111` | Tối ưu thời gian xử lý đối với tài liệu nhiều trang | EPIC 07 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-112` | Trả thông báo rõ ràng khi không trích xuất được nội dung | EPIC 07 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-113` | Lựa chọn thư viện hoặc dịch vụ dịch thuật | EPIC 08 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-114` | Xác định danh sách ngôn ngữ nguồn và ngôn ngữ đích được hỗ trợ | EPIC 08 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-115` | Xây dựng chức năng tự động nhận diện ngôn ngữ nguồn nếu dịch vụ hỗ trợ | EPIC 08 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-116` | Xây dựng giao diện chọn ngôn ngữ | EPIC 08 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-117` | Xây dựng API dịch văn bản | EPIC 08 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-118` | Chia văn bản dài thành các đoạn phù hợp với giới hạn của dịch vụ | EPIC 08 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-119` | Giữ thứ tự các đoạn khi ghép kết quả dịch | EPIC 08 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-121` | Hiển thị bản dịch kèm thông tin ngôn ngữ | EPIC 08 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-122` | Cho phép sao chép bản dịch | EPIC 08 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-266` | Tích hợp thư viện dịch thuật 'deep-translator' | EPIC 08 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-151` | Xây dựng chức năng xuất văn bản thành file TXT | EPIC 11 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-152` | Xây dựng chức năng xuất nội dung thành file PDF | EPIC 11 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-153` | Xây dựng chức năng tải file kết quả về thiết bị người dùng | EPIC 11 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-154` | Đặt tên file kết quả theo tài liệu, ngôn ngữ hoặc loại nội dung | EPIC 11 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-155` | Đảm bảo tiếng Việt và Unicode được hiển thị đúng trong file xuất | EPIC 11 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-253` | Hỗ trợ kéo thả file vào giao diện | EPIC 17 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-267` | Điều khoản và bảo mật cho người dùng | EPIC 03 | 2 | Huỳnh Đình Chấn | **Done** |

#### 📊 Bộ Test Suite Đánh Giá Chất Lượng, Tối Ưu Bộ Nhớ & Hiệu Năng hoàn thành trong Tuần 3 (EPIC 15 & 16)
*(Căn cứ theo lịch sử Git commit và tài liệu đối chiếu [phan_cong_thuc_hien_epic15_epic16.md](../.plan/.extra/phan_cong_thuc_hien_epic15_epic16.md))*:

| Mã Task | Tên nội dung kiểm thử / tối ưu | Epic | File Test Suite / Minh chứng | Người thực hiện | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: |
| `PDFL-205` | Kiểm thử giao diện trên các kích thước màn hình | EPIC 15 | `Code/frontend/tests/test_frontend_sidebar.js` (05/11/2026) | Cả hai (Tâm & Chấn) | **In Progress** |
| `PDFL-206` | Kiểm thử các trường hợp lỗi và trường hợp biên (mất file, task lỗi, trang trắng) | EPIC 15 | `test_files_lost_and_error_tasks.py`, `test_blank_page.py` (01/11/2026) | Cả hai (Tâm & Chấn) | **Done** |
| `PDFL-208` | Kiểm thử PDF scan (OCR, Deskew, Orientation) | EPIC 15 | `test_ocr_pipeline.py`, `test_deskew.py`, `test_orientation.py` (02/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-209` | Kiểm thử PDF tiếng Việt có dấu và tài liệu đa ngôn ngữ | EPIC 15 | `test_text_metrics.py`, `test_translation_pipeline_tasks.py` (02/11/2026) | Cả hai (Tâm & Chấn) | **Done** |
| `PDFL-210` | Kiểm thử PDF nhiều trang, nhiều cột hoặc bố cục phức tạp | EPIC 15 | `Code/backend/tests/test_layout_metrics.py` (02/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-219` | Kiểm soát dung lượng, số trang, bộ nhớ và thời gian | EPIC 15 | `Code/backend/tests/test_memory_optimization.py` (03/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-220` | Ngăn chặn truy cập chéo tài liệu/lịch sử (Anti-IDOR) | EPIC 15 | `Code/backend/tests/test_document_access_control.py` (03/11/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-224` | Đánh giá thời gian trích xuất, OCR, dịch và AI | EPIC 15 | `Code/backend/tests/benchmark_runner.py` (02/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-225` | Kiểm tra request đồng thời và giới hạn tài nguyên | EPIC 15 | `Code/backend/tests/test_parallel_pdf_processing.py` (03/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-226` | Tối ưu quy trình đọc, xử lý và lưu file lớn | EPIC 15 | `Code/backend/tests/measure_memory_before_after.py` (03/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-230` | Chọn nơi lưu trữ PDF và file kết quả | EPIC 16 | `Code/backend/app/services/storage_service.py` (03/11/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-242` | Hướng dẫn thiết lập môi trường chạy trên máy cá nhân | EPIC 16 | `README.md`, `run.bat` (03/11/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-246` | Cung cấp hình ảnh giao diện và hướng dẫn sử dụng | EPIC 16 | `Docs/user-guide/user-guide.md` (01/11/2026) | Nguyễn Lê Huy Tâm | **In Progress** |

---

### 🔹 Sprint 4: Dịch Thuật Fallback, Xuất File, Lịch Sử Xử Lý, Quản Trị Admin Cơ Bản & Quyền Lợi Gói
- **Thời gian**: 03/11/2026 - 10/11/2026 (Tuần 4)
- **Mục tiêu**: Xử lý các kịch bản ngoại lệ của dịch vụ dịch thuật (mạng lỗi, rate limit, fallback đa tầng), kiểm thử xuất file định dạng TXT/PDF, hoàn thiện cơ sở dữ liệu và API lịch sử xử lý tài liệu, thiết lập quyền lợi gói Free/Pro và Dashboard quản trị Admin cơ bản.
- **Trạng thái**: ✅ **Đã hoàn thành 100% (Completed)** - **31 Work Items Backlog (84 SP)**

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Người thực hiện | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `PDFL-120` | Xử lý lỗi mạng, giới hạn API và lỗi dịch thuật | EPIC 08 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-123` | Kiểm thử các trường hợp dịch tiếng Việt, tiếng Anh và các ngôn ngữ | EPIC 08 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-124` | Đánh giá khả năng giữ nguyên đoạn văn, danh sách và nội dung quan trọng | EPIC 08 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-125` | Đảm bảo hệ thống không làm mất hoặc đảo thứ tự đoạn khi dịch tài liệu dài | EPIC 08 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-150` | Xác định các loại kết quả có thể xuất: văn bản gốc, bản dịch và bản tóm tắt | EPIC 11 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-156` | Xử lý trường hợp nội dung rỗng hoặc không có kết quả | EPIC 11 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-157` | Kiểm tra quyền tải xuống và quyền truy cập kết quả | EPIC 11 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-158` | Kiểm thử file xuất trên các trình đọc file thông dụng | EPIC 11 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-159` | Thiết kế bảng dữ liệu lưu lịch sử xử lý | EPIC 12 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-160` | Lưu thông tin tài liệu và loại thao tác đã thực hiện | EPIC 12 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-161` | Lưu kết quả trích xuất, dịch thuật hoặc tóm tắt vào lịch sử | EPIC 12 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-162` | Xây dựng API lấy danh sách lịch sử | EPIC 12 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-163` | Xây dựng API xem chi tiết một bản ghi lịch sử | EPIC 12 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-164` | Hiển thị lịch sử trên giao diện | EPIC 12 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-165` | Cho phép mở lại kết quả đã lưu | EPIC 12 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-166` | Cho phép xóa lịch sử theo chính sách lưu trữ | EPIC 12 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-172` | Xác định quyền lợi cụ thể của gói Free | EPIC 13 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-173` | Xác định quyền lợi cụ thể của gói Pro | EPIC 13 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-176` | Giới hạn tải lên tối đa 20 MB/tệp đối với Free | EPIC 13 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-178` | Xác định và thực thi giới hạn số trang PDF cho từng gói | EPIC 13 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-185` | Kiểm thử việc áp dụng hạn mức ở Backend, kể cả khi gọi API trực tiếp | EPIC 13 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-207` | Kiểm thử PDF văn bản thông thường | EPIC 15 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-214` | Kiểm tra an toàn file tải lên và ngăn việc truy cập ngoài phạm vi | EPIC 15 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-186` | Xác định vai trò và quyền hạn của Admin | EPIC 14 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-188` | Xây dựng trang tổng quan quản trị | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-189` | Hiển thị danh sách tài khoản người dùng | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-194` | Khóa hoặc mở khóa tài khoản khi cần | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-197` | Xử lý thông báo xác nhận trước những thao tác có ảnh hưởng lớn | EPIC 14 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-198` | Kiểm thử quyền Admin và đảm bảo tài khoản thường không thể truy cập | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-240` | Viết README giới thiệu PDF Lingua | EPIC 16 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-260` | Gửi thông báo về trạng thái xử lý tài liệu | EPIC 17 | 3 | Huỳnh Đình Chấn | **Done** |

#### 🛡️ Bộ Test Suite Bảo Mật, Giới Hạn Tải & Thuyết Minh Kiến Trúc hoàn thành trong Tuần 4 (EPIC 15 & 16)
*(Căn cứ theo lịch sử Git commit và tài liệu đối chiếu [phan_cong_thuc_hien_epic15_epic16.md](../.plan/.extra/phan_cong_thuc_hien_epic15_epic16.md))*:

| Mã Task | Tên nội dung kiểm thử / tài liệu | Epic | File Test Suite / Tài liệu | Người thực hiện | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: |
| `PDFL-203` | Kiểm thử lịch sử, xuất file và chức năng Admin | EPIC 15 | `test_history_api.py` (08/11), `test_admin_management.py` (04/11) | Cả hai (Chấn & Tâm) | **Done** |
| `PDFL-211` | Kiểm thử PDF bị hỏng, có mật khẩu hoặc không đọc được | EPIC 15 | `Code/backend/tests/test_upload_security.py` (10/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-212` | Kiểm thử file nhỏ, sát giới hạn và vượt giới hạn dung lượng | EPIC 15 | `Code/backend/tests/test_size_page_limits_integration.py` (10/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-217` | Kiểm tra xác thực và phân quyền trên các API riêng tư | EPIC 15 | `Code/backend/tests/test_security_matrix.py` (10/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-221` | Chính sách lưu trữ, xóa và bảo vệ dữ liệu người dùng | EPIC 15 | `Code/backend/tests/test_history_delete.py` (08/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-236` | Kiểm tra việc xử lý file lớn theo giới hạn công bố | EPIC 16 | `Code/backend/tests/test_size_page_limits_integration.py` (10/11/2026) | Huỳnh Đình Chấn | **Done** |
| `PDFL-238` | Phương án sao lưu và phục hồi database | EPIC 16 | `kien_truc_he_thong.md` (11/11/2026) | Nguyễn Lê Huy Tâm | **In Progress** |
| `PDFL-244` | Mô tả cấu trúc thư mục và kiến trúc hệ thống | EPIC 16 | `kien_truc_he_thong.md` (11/11/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-213` | Kiểm thử tài liệu dài khi dịch, tóm tắt và hỏi đáp AI | EPIC 15 | `Code/backend/tests/test_ai_summary_quality.py` (12/11/2026) | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-222` | Hạn chế nội dung không đáng tin cậy ảnh hưởng trợ lý AI | EPIC 15 | `Code/backend/tests/test_ai_service.py`, `test_ai_chat_api.py` (24/11/2026) | Nguyễn Lê Huy Tâm | **Done** |

---

### 🔹 Sprint 5: Quản Trị Hệ Thống Admin, Gói Dịch Vụ Pro, Tính Năng Mở Rộng, Thiết Kế Đồ Án & Avatar/Billing
- **Thời gian**: 10/11/2026 - 17/11/2026 (Tuần 5)
- **Mục tiêu**: Hoàn thiện toàn diện hệ sinh thái gói dịch vụ Free/Pro, phân quyền tài khoản, bảng điều khiển quản trị Admin, xử lý tác vụ nền, các tính năng mở rộng nâng cao trải nghiệm người dùng, hoàn thiện hồ sơ thiết kế kiến trúc hệ thống, lược đồ use case, lược đồ lớp, tính năng avatar người dùng và giao dịch thanh toán (Billing).
- **Trạng thái**: ✅ **Đã hoàn thành 100% (Completed)** - **41 Work Items** (41 Done / 0 In Progress / 0 To Do - **123 Story Points**) - *Đồng bộ 100% Jira Board*

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Người thực hiện | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `PDFL-167` | Chỉ cho phép tài khoản Pro sử dụng chức năng lịch sử nếu đây là quyền lợi đã chốt | EPIC 12 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-168` | Kiểm soát quyền truy cập lịch sử theo tài khoản | EPIC 12 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-169` | Xác định thời gian lưu trữ và cách xóa dữ liệu khi cần | EPIC 12 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-170` | Kiểm thử khả năng lưu, truy vấn, mở lại và xóa lịch sử | EPIC 12 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-171` | Thiết kế dữ liệu gói dịch vụ và trạng thái đăng ký của người dùng | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-174` | Hiển thị gói hiện tại của người dùng | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-176` | Xây dựng cơ chế kiểm tra gói dịch vụ ở backend | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-177` | Giới hạn tải lên tối đa 100 MB/tệp đối với Pro | EPIC 13 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-178` | Xác định hạn mức OCR, dịch thuật và AI theo gói | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-180` | Chặn hoặc thông báo khi người dùng vượt hạn mức | EPIC 13 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-181` | Xây dựng trang so sánh quyền lợi Free và Pro | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-182` | Xây dựng luồng yêu cầu nâng cấp lên Pro | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-183` | Cập nhật quyền sử dụng khi tài khoản được nâng cấp hoặc hạ cấp | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-184` | Hiển thị thông báo nâng cấp tới người dùng truy cập tính năng dành cho Pro | EPIC 13 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-187` | Thiết lập cách khởi tạo tài khoản Admin an toàn | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-190` | Tìm kiếm và lọc tài khoản theo thông tin phù hợp | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-191` | Xem thông tin và trạng thái tài khoản | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-192` | Theo dõi trạng thái gói Free/Pro | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-193` | Cấp, gia hạn, hạ cấp hoặc thu hồi quyền Pro theo quy định của hệ thống | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-195` | Kiểm soát quyền Admin ở backend | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-196` | Ghi nhận nhật ký các thao tác quản trị quan trọng | EPIC 14 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-247` | Chuẩn bị dữ liệu PDF mẫu phục vụ demo | EPIC 16 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-252` | Cho phép xử lý nhiều file PDF theo lô | EPIC 17 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-254` | Cho phép người dùng Pro tải kết quả dưới định dạng DOCX | EPIC 17 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-255` | Cho phép chọn các trang cụ thể cần trích xuất hoặc dịch | EPIC 17 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-256` | Hỗ trợ xem trước PDF và chuyển trang ngay trên ứng dụng | EPIC 17 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-67` | Xây dựng API kiểm tra giới hạn upload, AI và các hạn mức khác | EPIC 04 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-74` | Xử lý các tác vụ mất nhiều thời gian mà không khóa toàn bộ ứng dụng | EPIC 04 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-44` | Xây dựng giao diện lịch sử xử lý tài liệu | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-49` | Xây dựng trang giới thiệu và so sánh gói Free/Pro | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-52` | Xây dựng giao diện nâng cấp gói Pro | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-56` | Xây dựng giao diện quản trị Admin | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-269` | Kiến trúc hệ thống (Deadline cho đề tài 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-270` | Lược đồ usecase (Deadline cho đề tài 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-271` | Lược đồ lớp (Deadline cho đề tài 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-272` | Thiết kế tính năng tải lên ảnh đại diện cho người dùng | EPIC 17 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-273` | Xây dựng giao diện tải lên, cắt ảnh và hiển thị avatar người dùng | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-274` | Xây dựng API lấy danh sách lịch sử giao dịch thanh toán của người dùng (Billing) | EPIC 13 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-275` | Xây dựng giao diện xem Lịch sử giao dịch, hóa đơn và trạng thái thanh toán Pro (Billing) | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-276` | Xây dựng giao diện hiển thị mức độ sử dụng, trạng thái gói cho Pro | EPIC 03 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-262` | Bổ sung thống kê mức sử dụng dịch vụ | EPIC 17 | 3 | Huỳnh Đình Chấn | **Done** |

> **Thống kê Sprint 5**:
> - **Tổng số công việc**: 41 work items (41 Done / 0 In Progress / 0 To Do - **100% Done**)
> - **Tổng Story Points**: 123 SP (Nguyễn Lê Huy Tâm: 66 SP | Huỳnh Đình Chấn: 57 SP)

---

### 🔹 Sprint 6: Tích Hợp AI, Tính Năng Mở Rộng, Trang Chào Mừng & Triển Khai CI/CD
- **Thời gian**: 17/11/2026 - 24/11/2026 (Tuần 6)
- **Mục tiêu**: Tích hợp các mô hình trí tuệ nhân tạo (LLM API) để tóm tắt ý chính tài liệu PDF, xây dựng Trợ lý ảo chat hỏi đáp trực tiếp (Document QA/RAG), mở rộng tính năng đa ngôn ngữ, trang chào mừng Welcome, thanh toán gói Pro, phân quyền RBAC và thiết lập luồng CI/CD.
- **Trạng thái**: ✅ **Đã hoàn thành 100% (Completed)** - **37 Work Items** (37 Done / 0 In Progress / 0 To Do - **100 Story Points**) - *Đồng bộ 100% Jira Board*

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Người thực hiện | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `PDFL-126` | Lựa chọn mô hình AI hoặc dịch vụ API phù hợp | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-127` | Quản lý API key thông qua biến môi trường | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-128` | Xây dựng cấu trúc prompt tóm tắt văn bản | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-129` | Xây dựng API tóm tắt nội dung tài liệu | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-130` | Hỗ trợ lựa chọn độ dài hoặc kiểu tóm tắt nếu mô hình cho phép | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-131` | Hỗ trợ tóm tắt văn bản dài bằng cách chia đoạn hoặc tóm tắt nhiều bước | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-132` | Hiển thị nội dung tóm tắt trên giao diện | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-133` | Cho phép sao chép kết quả tóm tắt | EPIC 09 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-134` | Kiểm tra quyền sử dụng AI của tài khoản Pro | EPIC 09 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-135` | Kiểm soát số lượt sử dụng, lượng văn bản đầu vào và chi phí | EPIC 09 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-136` | Xử lý lỗi khi dịch vụ AI không phản hồi hoặc vượt giới hạn | EPIC 09 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-137` | Kiểm thử chất lượng tóm tắt trên các loại tài liệu khác nhau | EPIC 09 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-138` | Xác định phạm vi câu hỏi mà trợ lý AI có thể xử lý | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-139` | Xây dựng API gửi câu hỏi về tài liệu | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-140` | Cung cấp nội dung tài liệu liên quan làm ngữ cảnh cho AI | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-141` | Xử lý tài liệu dài bằng cách chọn các đoạn liên quan trước khi gửi cho AI | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-142` | Xây dựng giao diện khung chat | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-143` | Hiển thị câu hỏi và câu trả lời theo thứ tự hội thoại | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-144` | Xử lý trạng thái AI đang suy nghĩ, câu trả lời lỗi và yêu cầu thử lại | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-145` | Giới hạn số lượt hỏi đáp hoặc lượng nội dung theo gói dịch vụ | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-146` | Đảm bảo câu trả lời dựa trên nội dung tài liệu khi người dùng hỏi về tài liệu | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-148` | Kiểm soát quyền truy cập để người dùng không hỏi hoặc truy xuất tài liệu của người khác | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-149` | Kiểm thử khả năng trả lời đúng nội dung, hạn chế bịa đặt và xử lý câu hỏi ngoài phạm vi | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-147` | Xử lý trường hợp tài liệu không có thông tin để trả lời | EPIC 10 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-50` | Xây dựng giao diện tóm tắt văn bản bằng AI | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-51` | Xây dựng giao diện trò chuyện với trợ lý AI | EPIC 03 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-205` | Kiểm thử giao diện trên các kích thước màn hình khác nhau | EPIC 15 | 2 | Huỳnh Đình Chấn | **Done** |
| `PDFL-257` | Hỗ trợ lưu hoặc tải lại kết quả dịch theo từng trang | EPIC 11 | 3 | Huỳnh Đình Chấn | **Done** |
| `PDFL-259` | Tích hợp thanh toán trực tuyến cho gói Pro | EPIC 11 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-261` | Cho phép người dùng gửi phản hồi hoặc báo cáo lỗi | EPIC 11 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-263` | Cải thiện khả năng truy xuất nguồn cho câu trả lời AI bằng cách tham chiếu trang hoặc đoạn văn liên quan | EPIC 10 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-264` | Xem xét sử dụng hàng đợi tác vụ cho các file lớn và quy trình OCR/AI kéo dài | EPIC 11 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-277` | Trang web hỗ trợ ngôn ngữ Tiếng Anh | EPIC 11 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-278` | Welcome Dashboard (Landing page khi người dùng mới lần vào web) | EPIC 11 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-279` | Hướng dẫn sử dụng web | EPIC 16 | 3 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-283` | RBAC for UI/UX frontend and benefit update | EPIC 03 | 2 | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-284` | Simple CI/CD Workflow | EPIC 15 | 2 | Nguyễn Lê Huy Tâm | **Done** |

---

### 🔹 Sprint 7: Triển Khai Hệ Thống, Nghiệm Thu Đồ Án, Giám Sát Admin & Vá Lỗi
- **Thời gian**: 22/11/2026 - 29/11/2026 (Tuần 7)
- **Mục tiêu**: Triển khai website chính thức, hoàn thiện báo cáo tổng kết đồ án, theo dõi người dùng & khách truy cập, rà soát bảo mật JWT/Webhook/Thanh toán, kiểm thử vai trò người dùng và chuẩn bị kịch bản nghiệm thu.
- **Trạng thái**: 📋 **31 Work Items** (20 Done - 67 SP / 7 In Progress - 20 SP / 4 To Do - 8 SP - **Tổng 95 Story Points**) - *Đồng bộ 100% Jira Board*

#### Danh sách công việc Sprint 7 chi tiết (31 Work Items)

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Mức độ ưu tiên | Người thực hiện | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `PDFL-199` | Xây dựng danh sách test case theo yêu cầu chức năng. | EPIC 15 | 5 | High | Đình Chấn Huỳnh | **In Progress** |
| `PDFL-218` | Giới hạn tần suất request phù hợp để giảm lạm dụng. | EPIC 15 | 3 | Highest | Đình Chấn Huỳnh | **In Progress** |
| `PDFL-222` | Hạn chế nội dung không đáng tin cậy trong tài liệu ảnh hưởng đến chỉ dẫn của trợ lý AI. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-228` | Chọn nền tảng triển khai Frontend. | EPIC 16 | 3 | Highest | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-229` | Chọn nền tảng triển khai Backend Python. | EPIC 16 | 3 | Highest | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-235` | Kiểm thử ứng dụng trên môi trường triển khai thực tế. | EPIC 16 | 5 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-238` | Xác định phương án sao lưu và phục hồi database. | EPIC 16 | 3 | Medium | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-239` | Kiểm tra quy trình cập nhật phiên bản và khôi phục khi triển khai lỗi. | EPIC 16 | 3 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-246` | Cung cấp hình ảnh giao diện | EPIC 16 | 2 | High | Đình Chấn Huỳnh | **In Progress** |
| `PDFL-248` | Viết báo cáo phân tích, thiết kế, hiện thực | EPIC 16 | 3 | Highest | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-249` | Chuẩn bị slide thuyết trình (Powerpoint) | EPIC 16 | 3 | Medium | Đình Chấn Huỳnh | **To Do** |
| `PDFL-250` | Chuẩn bị kịch bản demo các chức năng chính. | EPIC 16 | 3 | Medium | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-251` | Kiểm tra README, tài liệu, repository và loại bỏ API key hoặc dữ liệu nhạy cảm trước khi bàn giao. | EPIC 16 | 3 | Highest | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-264` | Hỗ trợ nhiều chủ đề giao diện hoặc chế độ tối. | EPIC 17 | 3 | Low | Đình Chấn Huỳnh | **To Do** |
| `PDFL-282` | Testing guests' features | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-283` | Testing free users' features | EPIC 15 | 3 | Highest | Đình Chấn Huỳnh | **In Progress** |
| `PDFL-284` | Testing pro users' features | EPIC 15 | 5 | Highest | Đình Chấn Huỳnh | **In Progress** |
| `PDFL-285` | Testing admin's features | EPIC 15 | 3 | Highest | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-286` | Bulk-adding PDF files not translating after uploading successfully | - | 2 | Highest | Đình Chấn Huỳnh | **Done** |
| `PDFL-287` | Viết báo cáo tổng kết đồ án (Words) | EPIC 16 | 3 | Medium | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-288` | Triển khai trên website | EPIC 16 | 5 | Highest | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-289` | Monetization strategy by using ads | EPIC 18 | 5 | Medium | Nguyễn Lê Huy Tâm | **In Progress** |
| `PDFL-291` | Add an extra paid plan (pricing plans) with better benefits | EPIC 18 | 2 | Medium | Đình Chấn Huỳnh | **To Do** |
| `PDFL-292` | Pro plan adjustment | EPIC 13 | 2 | Medium | Đình Chấn Huỳnh | **To Do** |
| `PDFL-293` | Allowing admin to track visitors and transition | EPIC 14 | 3 | Medium | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-294` | Small tabs/frontend in Admin console for tracking visitors and transition | EPIC 03 | 3 | Medium | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-295` | Enhancing bug reports from users | EPIC 17 | 3 | Medium | Nguyễn Lê Huy Tâm | **In Progress** |
| `PDFL-296` | Upgrade to Pro for free via the "/simulate" endpoint | - | 2 | Medium | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-297` | Admin's rejection not working properly | - | 2 | Medium | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-298` | The webhook accepts a "pending" status and skips the amount check | - | 2 | Medium | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-299` | Fix secret key with a default fallback is exposed | - | 2 | Medium | Nguyễn Lê Huy Tâm | **Done** |

---

### 🔹 Sprint 8: Kiểm Thử Chuyên Sâu, An Toàn Bảo Mật & Tối Ưu Môi Trường Triển Khai
- **Thời gian**: 23/11/2026 - 30/11/2026 (Tuần 8)
- **Mục tiêu**: Tập trung nghiệm thu toàn diện hệ thống kiểm thử tự động (Unit, API, OCR, Translation, Security, Benchmark) với bộ test suite 36 files và đóng gói cấu hình triển khai an toàn.
- **Trạng thái**: ✅ **100% Hoàn Thành** - **35 Work Items** (35 Done - **Tổng 69 Story Points**) - *Đồng bộ 100% Jira Board*

#### Danh sách công việc Sprint 8 chi tiết (35 Work Items)

| Mã Task | Tên nhiệm vụ | Epic | Story Points | Mức độ ưu tiên | Người thực hiện | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `PDFL-200` | Viết unit test cho các hàm xử lý nghiệp vụ quan trọng. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-201` | Kiểm thử API upload, trích xuất, OCR, dịch thuật và AI. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-202` | Kiểm thử đăng ký, đăng nhập, phân quyền và gói Free/Pro. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-203` | Kiểm thử lịch sử, xuất file và chức năng Admin. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-204` | Kiểm thử tích hợp toàn bộ luồng từ tải PDF đến tải kết quả. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-206` | Kiểm thử các trường hợp lỗi và trường hợp biên. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-208` | Kiểm thử PDF scan. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-209` | Kiểm thử PDF tiếng Việt có dấu và tài liệu đa ngôn ngữ. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-210` | Kiểm thử PDF nhiều trang, nhiều cột hoặc bố cục phức tạp. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-211` | Kiểm thử PDF bị hỏng, có mật khẩu hoặc không thể đọc. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-212` | Kiểm thử file nhỏ, file sát giới hạn và file vượt giới hạn dung lượng. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-213` | Kiểm thử tài liệu dài khi dịch thuật, tóm tắt và hỏi đáp AI. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-215` | Đảm bảo mật khẩu không được lưu dưới dạng văn bản thuần. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-216` | Đảm bảo API key và thông tin nhạy cảm không bị đưa lên GitHub. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-217` | Kiểm tra xác thực và phân quyền trên các API riêng tư. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-219` | Kiểm soát dung lượng, số trang, bộ nhớ và thời gian xử lý PDF. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-220` | Ngăn tài liệu hoặc lịch sử của người dùng này bị truy cập bởi người dùng khác. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-221` | Xác định chính sách lưu trữ, xóa và bảo vệ dữ liệu người dùng. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-223` | Kiểm tra các lỗi phổ biến như SQL injection, XSS và truy cập trái phép. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-224` | Đánh giá thời gian trích xuất, OCR, dịch và xử lý AI. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-225` | Kiểm tra nhiều request đồng thời và giới hạn tài nguyên. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-226` | Tối ưu quy trình đọc, xử lý và lưu file lớn. | EPIC 15 | 3 | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-227` | Thiết lập thông báo lỗi, logging và cách khôi phục khi xử lý thất bại. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-230` | Chọn nơi lưu trữ PDF và file kết quả. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-231` | Thiết lập database cho môi trường triển khai. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-232` | Cấu hình biến môi trường và API key trên môi trường production. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-233` | Cấu hình CORS, domain và HTTPS nếu nền tảng hỗ trợ. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-234` | Cài đặt các thành phần cần thiết cho OCR trên server. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-236` | Kiểm tra việc xử lý file lớn theo giới hạn đã công bố. | EPIC 16 | - | High | Đình Chấn Huỳnh | **Done** |
| `PDFL-237` | Thiết lập kiểm tra tình trạng hoạt động và theo dõi lỗi. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-241` | Ghi rõ công nghệ sử dụng và yêu cầu cài đặt. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-242` | Hướng dẫn thiết lập môi trường chạy trên máy cá nhân. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-243` | Hướng dẫn cấu hình .env và các dịch vụ bên ngoài. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-244` | Mô tả cấu trúc thư mục và kiến trúc hệ thống. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |
| `PDFL-245` | Viết tài liệu API và ví dụ request/response. | EPIC 16 | - | High | Nguyễn Lê Huy Tâm | **Done** |

---

## 📈 Quy Trình Vận Hành Sprint (Sprint Workflow) & Tiêu Chuẩn Hoàn Thành (DoD)

### 1. Quy trình Scrum chuẩn
1. **Sprint Planning (Đầu tuần)**: Rà soát danh sách task của Sprint trên Jira, chốt khối lượng công việc và Story Points.
2. **Daily / Mid-week Sync (Giữa tuần)**: Trao đổi nhanh các khó khăn kỹ thuật (blockers), hỗ trợ giải quyết lỗi.
3. **Sprint Review & Code Review (Cuối tuần)**: Kiểm thử các chức năng đã hoàn thành, tạo Pull Request để thành viên còn lại review trước khi merge vào nhánh chính.
4. **Cập nhật Jira**: Đảm bảo tất cả các task đã hoàn thành được chuyển trạng thái sang `Done`.

### 2. Tiêu chuẩn hoàn thành (Definition of Done - DoD)
- [x] **Mã nguồn**: Code chạy đúng logic yêu cầu, tuân thủ quy chuẩn đặt tên biến/hàm, không có lỗi cú pháp hoặc log rác.
- [x] **Kiểm thử**: Đạt 100% các unit test / integration test liên quan; đã tự kiểm tra (manual test) các trường hợp bình thường và ngoại lệ.
- [x] **Bảo mật**: Tuyệt đối không hardcode mật khẩu, token bí mật hoặc API Key vào mã nguồn hoặc Git repository.
- [x] **Code Review**: Đã tạo Pull Request và được thành viên trong nhóm phê duyệt trước khi merge vào nhánh `main` / `develop`.
- [x] **Đồng bộ Jira**: Chuyển trạng thái task tương ứng sang `Done` trên Jira Board.
