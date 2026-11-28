# PDF-Lingua - Kế Hoạch Nhóm, Phân Công Nhiệm Vụ & Báo Cáo Đóng Góp (Master Assignment & Team Contribution Report)

- **Dự án**: **PDF Lingua** - Nền tảng Web trích xuất văn bản từ tài liệu PDF, nhận dạng ký tự quang học OCR, dịch thuật đa ngôn ngữ và trợ lý AI tóm tắt, hỏi đáp tài liệu thông minh.
- **Học phần**: Đồ án Thực tế Công nghệ Phần mềm (Nhóm 19)
- **Jira Project Key**: `PDFL`
- **Jira Board & Summary**: [https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary](https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary)
- **Tài liệu tham chiếu**:
  - Kế hoạch 8 Sprint chi tiết: [Sprint_Plan.md](./Sprint_Plan.md)
  - Product Backlog chi tiết: [PDF_Lingua_Jira_Backlog.md](./PDF_Lingua_Jira_Backlog.md)
- **Thời gian thực hiện**: `13/10/2026 - 30/11/2026` (8 tuần / 8 Sprint)
- **Ngày cập nhật lần cuối**: `28/11/2026` (Đồng bộ hóa 100% từ Tuần 1 đến Tuần 8 theo tiến độ thực tế Git commit, test suite và Jira Cloud)

---

## 1. Danh Sách Thành Viên & Phân Định Vai Trò Chính

Dự án được xây dựng và phát triển toàn diện bởi 2 thành viên chính, với sự phối hợp chặt chẽ giữa Backend, Kiến trúc AI, Kiểm thử tự động và Frontend UI/UX:

| STT | MSSV | Họ và tên | Vai trò | Nhiệm vụ chính phụ trách |
| :---: | :---: | :--- | :---: | :--- |
| 1 | `056206011188` | **Nguyễn Lê Huy Tâm**<br>*(Jira: `NT`)* | **Trưởng nhóm** | - Thiết kế kiến trúc hệ thống, Backend FastAPI, cấu hình CSDL SQLite WAL và bảo mật.<br>- Phát triển core xử lý trích xuất PDF, luồng pipeline E2E và quản lý lưu trữ tệp storage.<br>- Tích hợp động cơ dịch thuật đa ngôn ngữ và thuật toán chia đoạn văn bản chống timeout.<br>- Hiện thực các tính năng AI: Tóm tắt văn bản Map-Reduce và Trợ lý AI hỏi đáp tài liệu (RAG).<br>- Xây dựng module Admin quản trị, phân quyền tài khoản, gói dịch vụ (Free/Pro) và Billing.<br>- Biên soạn tài liệu kiến trúc, hướng dẫn triển khai cloud và tài liệu người dùng. |
| 2 | `077206002307` | **Huỳnh Đình Chấn** | **Thành viên** | - Thiết kế và phát triển giao diện người dùng UI/UX toàn hệ thống (HTML5, CSS3, Vanilla JS).<br>- Xây dựng chức năng xác thực người dùng (Đăng ký, Đăng nhập, JWT, Hồ sơ cá nhân).<br>- Tiền xử lý hình ảnh OCR nâng cao (khử nghiêng deskew, xoay trang, phát hiện trang trắng).<br>- Xây dựng công cụ benchmark hiệu năng, tối ưu bộ nhớ và bộ đo chất lượng trích xuất.<br>- Phát triển chức năng quản lý tài liệu, lưu trữ lịch sử xử lý và chính sách dữ liệu.<br>- Thiết lập ma trận bảo mật, kiểm soát an toàn tải file và hạn mức tài nguyên.<br>- Phát triển các tính năng mở rộng (xử lý lô batch, tải ZIP, xuất DOCX, xem trước PDF).<br>- Xây dựng tài liệu thiết kế phần mềm (Sơ đồ Use Case, Lược đồ Lớp, Lược đồ Hoạt động). |

---

## 2. Kế Hoạch Nhóm & Lộ Trình Phát Triển 8 Sprint (Roadmap Strategy)

```
[Tuần 1 - 3: Core Logic & Gói Free] -> [Tuần 4 - 5: Tính Năng Pro & Admin] -> [Tuần 6: Tích Hợp AI Toàn Diện] -> [Tuần 7 - 8: Triển Khai, Kiểm Thử Toàn Diện & Nghiệm Thu]
```

- **Tuần 1 (Sprint 1: 13/10/2026 - 20/10/2026) - Phân Tích Yêu Cầu, Thiết Kế Hệ Thống & Khởi Tạo Khung Dự Án** (Hoàn thành: `20/10/2026` - 34 tasks / 101 SP): Khảo sát nghiệp vụ, phân tích thiết kế (Use Case, Activity, ERD, Kiến trúc hệ thống), khởi tạo repository GitHub, khung mã nguồn Frontend/Backend, quy chuẩn Git, cơ sở dữ liệu SQLite WAL, CORS, logging và health check.
- **Tuần 2 (Sprint 2: 20/10/2026 - 27/10/2026) - Hệ Thống Tài Khoản, Xác Thực & Cốt Lõi Xử Lý PDF/OCR** (Hoàn thành: `27/10/2026` - 32 tasks / 95 SP): Xây dựng User schema, mã hóa mật khẩu bcrypt, phiên JWT, giao diện Workspace, kiểm tra file PDF (magic bytes), giới hạn 20MB/100MB, trích xuất văn bản PyMuPDF/pdfplumber, nhận dạng scan OCR Tesseract tiếng Việt/Anh.
- **Tuần 3 (Sprint 3: 27/10/2026 - 03/11/2026) - Quản Lý Tài Liệu, OCR Nâng Cao, Dịch Thuật Cốt Lõi, Xuất File & Đo Lường** (Hoàn thành: `03/11/2026` - 38 tasks / 109 SP): Quản lý kho file cá nhân, tiền xử lý hình ảnh OCR (khử nghiêng, xoay trang, phát hiện trang trắng), động cơ dịch thuật deep-translator (Google/MyMemory fallback), chia đoạn chống nghẽn, xuất TXT/PDF Unicode, kéo thả file, điều khoản dịch vụ và benchmark đo lường.
- **Tuần 4 (Sprint 4: 03/11/2026 - 10/11/2026) - Dịch Thuật Fallback, Xuất File, Lịch Sử Xử Lý, Quản Trị Admin Cơ Bản & Quyền Lợi Gói** (Hoàn thành: `10/11/2026` - 31 tasks / 90 SP): Xử lý lỗi dịch thuật đa tầng, kiểm thử file xuất, thiết kế bảng dữ liệu lịch sử xử lý, API lưu/mở lại/xóa lịch sử, quyền lợi gói Free vs Pro, Dashboard quản trị Admin cơ bản (khóa/mở tài khoản, phân quyền), ma trận bảo mật và giới hạn upload.
- **Tuần 5 (Sprint 5: 10/11/2026 - 17/11/2026) - Lịch Sử Pro, Quản Trị Admin Nâng Cao, Hạn Mức Free/Pro, Mở Rộng, Thiết Kế Đồ Án, Avatar & Billing** (Hoàn thành: `17/11/2026` - 41 tasks / 111 SP): Lịch sử Pro, Admin Console nâng cao (tìm kiếm, lọc, thống kê, audit log), Batch ZIP, xuất DOCX, xem trước PDF inline, chọn trang cụ thể, nộp hồ sơ thiết kế đồ án (Kiến trúc, Use Case, Class Diagram), tính năng Avatar người dùng, Lịch sử hóa đơn thanh toán và quản lý hạn mức gói.
- **Tuần 6 (Sprint 6: 17/11/2026 - 24/11/2026) - Tích Hợp AI: Tóm Tắt Văn Bản & Trợ Lý Hỏi Đáp Tài Liệu, Tính Năng Mở Rộng & Triển Khai** (Hoàn thành: `24/11/2026` - 37 tasks / 114 SP): Tích hợp LLM API an toàn qua biến môi trường, AI Tóm tắt văn bản (Map-Reduce cho tài liệu dài), Trợ lý AI hỏi đáp tài liệu theo ngữ cảnh (RAG QA Chatbot), anti-hallucination guardrails, giao diện chatbox, kiểm thử responsive, lưu bản dịch theo trang, thanh toán Pro, tiếng Anh đa ngôn ngữ, Welcome Dashboard và CI/CD workflow.
- **Tuần 7 (Sprint 7: 22/11/2026 - 29/11/2026) - Nghiệm Thu Triển Khai Website, Theo Dõi Khách Truy Cập (Admin Visitors), Báo Cáo Đồ Án & Vá Lỗi** (Hoàn thành: `28/11/2026` - 31 tasks / 95 SP): Triển khai website chính thức, hoàn thiện báo cáo phân tích thiết kế, theo dõi khách truy cập (Visitors & Transition) trong Admin console, mở rộng chiến lược doanh thu quảng cáo/gói cước, vá các lỗi bảo mật quan trọng (JWT secret key fallback, Webhook verification, Admin transaction rejection, Bulk-adding translation).
- **Tuần 8 (Sprint 8: 23/11/2026 - 30/11/2026) - Kiểm Thử Toàn Diện (Unit, Integration, Security Matrix, Benchmark) & Cấu Hình An Toàn Môi Trường Triển Khai** (Hoàn thành: `28/11/2026` - 35 tasks / 99 SP): Hoàn thành bộ test suite tự động 36 files kiểm thử chuyên sâu: Unit test Services, API test, OCR/Deskew/Orientation test, Tiếng Việt có dấu, tài liệu dài, tải file lớn, benchmark hiệu năng, giải phóng bộ nhớ, và cấu hình an toàn production (SQLite WAL, CORS, HTTPS, OCR server, Storage).

---

## 3. BẢNG PHÂN CÔNG & KẾT QUẢ THỰC HIỆN CHI TIẾT TỪNG TUẦN (TUẦN 1 ĐẾN TUẦN 8)

### 📅 TUẦN 1 (Sprint 1: 13/10/2026 - 20/10/2026)
- **Trọng tâm**: Phân Tích Yêu Cầu, Thiết Kế Hệ Thống & Khởi Tạo Khung Dự Án
- **Ngày hoàn thành thực tế**: `20/10/2026`
- **Thống kê khối lượng**: `34 Tasks` | `101 Story Points` (Nguyễn Lê Huy Tâm: 31 tasks - 90 SP | Huỳnh Đình Chấn: 3 tasks - 11 SP)
- **Trạng thái**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Mức độ ưu tiên | Story Points | Ngày hoàn thành | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-1` | Xác định các đối tượng sử dụng hệ thống: khách chưa đăng nhập, tài khoản Free, tài khoản Pro và Admin. | EPIC 01 | Nguyễn Lê Huy Tâm | High | 2 | 20/10/2026 | Tài liệu phân tích yêu cầu | **Done** |
| `PDFL-2` | Chốt danh sách chức năng chính và chức năng mở rộng. | EPIC 01 | Huỳnh Đình Chấn | High | 5 | 27/10/2026 | Tài liệu Product Backlog | **Done** |
| `PDFL-3` | Xác định quyền lợi, giới hạn và điểm khác nhau giữa gói Free và Pro. | EPIC 01 | Nguyễn Lê Huy Tâm | High | 2 | 20/10/2026 | Bảng so sánh quyền lợi gói | **Done** |
| `PDFL-4` | Xác định quy trình xử lý tài liệu từ lúc tải PDF lên đến khi xuất kết quả. | EPIC 01 | Nguyễn Lê Huy Tâm | High | 3 | 22/10/2026 | Sơ đồ luồng xử lý tài liệu | **Done** |
| `PDFL-21` | Xây dựng Use Case Diagram. | EPIC 01 | Huỳnh Đình Chấn | Medium | 3 | 27/10/2026 | `Docs/diagrams/use_case_diagram.png` | **Done** |
| `PDFL-22` | Xây dựng sơ đồ hoạt động cho các luồng quan trọng như trích xuất, dịch thuật, AI và nâng cấp gói. | EPIC 01 | Huỳnh Đình Chấn | High | 3 | 27/10/2026 | `Docs/diagrams/activity_diagram.png` | **Done** |
| `PDFL-23` | Thiết kế kiến trúc tổng thể: Frontend, Backend, database, dịch vụ OCR và dịch vụ AI. | EPIC 01 | Nguyễn Lê Huy Tâm | High | 3 | 21/10/2026 | `kien_truc_he_thong.md` | **Done** |
| `PDFL-24` | Thiết kế ERD và mô hình dữ liệu. | EPIC 01 | Nguyễn Lê Huy Tâm | Medium | 5 | 22/10/2026 | `Docs/diagrams/erd_diagram.png` | **Done** |
| `PDFL-25` | Thống nhất cấu trúc API giữa Frontend và Backend. | EPIC 01 | Nguyễn Lê Huy Tâm | High | 3 | 22/10/2026 | Tài liệu API conventions | **Done** |
| `PDFL-26` | Xác định các yêu cầu phi chức năng: hiệu năng, bảo mật, khả năng mở rộng và trải nghiệm người dùng. | EPIC 01 | Nguyễn Lê Huy Tâm | Highest | 3 | 22/10/2026 | Tài liệu NFR specification | **Done** |
| `PDFL-27` | Tạo repository GitHub | EPIC 02 | Nguyễn Lê Huy Tâm | Highest | 1 | 20/10/2026 | GitHub repo Sleepy2608/PDF-Lingua | **Done** |
| `PDFL-28` | Xây dựng cấu trúc thư mục Frontend và Backend. | EPIC 02 | Nguyễn Lê Huy Tâm | High | 2 | 20/10/2026 | Cây thư mục `Code/backend`, `Code/frontend` | **Done** |
| `PDFL-29` | Khởi tạo ứng dụng Frontend bằng HTML, CSS và JavaScript. | EPIC 02 | Nguyễn Lê Huy Tâm | High | 2 | 22/10/2026 | `Code/frontend/index.html`, `style.css` | **Done** |
| `PDFL-30` | Khởi tạo Backend bằng Python và FastAPI. | EPIC 02 | Nguyễn Lê Huy Tâm | High | 3 | 22/10/2026 | `Code/backend/app/main.py` | **Done** |
| `PDFL-31` | Cấu hình môi trường Python và requirements.txt hoặc pyproject.toml | EPIC 02 | Nguyễn Lê Huy Tâm | High | 3 | 22/10/2026 | `Code/backend/requirements.txt` | **Done** |
| `PDFL-32` | Cấu hình các biến môi trường trong .env. | EPIC 02 | Nguyễn Lê Huy Tâm | High | 3 | 22/10/2026 | `Code/backend/.env` | **Done** |
| `PDFL-33` | Tạo .env.example và cấu hình .gitignore và gitattributes | EPIC 02 | Nguyễn Lê Huy Tâm | Medium | 3 | 20/10/2026 | `.env.example`, `.gitignore` | **Done** |
| `PDFL-34` | Cấu hình kết nối database. | EPIC 02 | Nguyễn Lê Huy Tâm | High | 3 | 20/10/2026 | `Code/backend/app/core/database.py` | **Done** |
| `PDFL-35` | Thiết lập quy tắc đặt tên branch, commit và Pull Request. | EPIC 02 | Nguyễn Lê Huy Tâm | Highest | 2 | 20/10/2026 | Tài liệu Git conventions | **Done** |
| `PDFL-36` | Xây dựng API kiểm tra tình trạng hoạt động của Backend. | EPIC 02 | Nguyễn Lê Huy Tâm | Medium | 3 | 22/10/2026 | `GET /health` trong `main.py` | **Done** |
| `PDFL-37` | Cấu hình môi trường phát triển để Frontend giao tiếp với Backend. | EPIC 02 | Nguyễn Lê Huy Tâm | High | 3 | 22/10/2026 | `CORSMiddleware` trong `main.py` | **Done** |
| `PDFL-38` | Kiểm tra khởi chạy toàn bộ dự án trên máy phát triển. | EPIC 02 | Nguyễn Lê Huy Tâm | High | 5 | 22/10/2026 | Kiểm thử khởi động server uvicorn | **Done** |
| `PDFL-39` | Xác định phong cách thiết kế, màu sắc, font chữ và bộ quy chuẩn giao diện. | EPIC 03 | Nguyễn Lê Huy Tâm | Medium | 3 | 22/10/2026 | Design system tokens CSS | **Done** |
| `PDFL-40` | Thiết kế thanh điều hướng và bố cục chung của ứng dụng. | EPIC 03 | Nguyễn Lê Huy Tâm | Medium | 3 | 24/10/2026 | Header, navigation bar trong `index.html` | **Done** |
| `PDFL-41` | Xây dựng trang chủ giới thiệu PDF Lingua và các tính năng. | EPIC 03 | Nguyễn Lê Huy Tâm | Medium | 3 | 24/10/2026 | Hero section, features grid trong `index.html` | **Done** |
| `PDFL-58` | Đảm bảo giao diện responsive trên máy tính, máy tính bảng và điện thoại. | EPIC 03 | Nguyễn Lê Huy Tâm | Medium | 3 | 24/10/2026 | CSS media queries trong `style.css` | **Done** |
| `PDFL-60` | Thiết kế cấu trúc module Backend theo từng nhóm chức năng. | EPIC 04 | Nguyễn Lê Huy Tâm | Medium | 3 | 23/10/2026 | Cấu trúc packages `core`, `services`, `api` | **Done** |
| `PDFL-61` |  Xây dựng các lớp xử lý nghiệp vụ, truy cập dữ liệu và giao tiếp API. | EPIC 04 | Nguyễn Lê Huy Tâm | Medium | 3 | 23/10/2026 | Base classes trong `app/services` | **Done** |
| `PDFL-62` | Chuẩn hóa cấu trúc request và response của API. | EPIC 04 | Nguyễn Lê Huy Tâm | Medium | 3 | 24/10/2026 | Pydantic BaseModels trong `schemas` | **Done** |
| `PDFL-63` |  Xây dựng cơ chế xác thực request và xử lý lỗi chung. | EPIC 04 | Nguyễn Lê Huy Tâm | High | 3 | 24/10/2026 | `app/core/exceptions.py` | **Done** |
| `PDFL-64` | Cấu hình CORS cho môi trường phát triển và triển khai. | EPIC 04 | Nguyễn Lê Huy Tâm | High | 3 | 23/10/2026 | Cấu hình `allow_origins` trong `main.py` | **Done** |
| `PDFL-68` | Chuẩn hóa HTTP status code và thông báo lỗi. | EPIC 04 | Nguyễn Lê Huy Tâm | High | 3 | 24/10/2026 | HTTP status constants trong `exceptions.py` | **Done** |
| `PDFL-69` |  Xây dựng tài liệu API bằng OpenAPI/Swagger của FastAPI. | EPIC 04 | Nguyễn Lê Huy Tâm | High | 3 | 23/10/2026 | `/docs` và `/redoc` trong `main.py` | **Done** |
| `PDFL-70` | Thiết lập logging để theo dõi lỗi và hoạt động xử lý. | EPIC 04 | Nguyễn Lê Huy Tâm | High | 3 | 24/10/2026 | Middleware logging trong `main.py` | **Done** |

### 📅 TUẦN 2 (Sprint 2: 20/10/2026 - 27/10/2026)
- **Trọng tâm**: Hệ Thống Tài Khoản, Xác Thực & Cốt Lõi Xử Lý PDF/OCR
- **Ngày hoàn thành thực tế**: `27/10/2026`
- **Thống kê khối lượng**: `32 Tasks` | `95 Story Points` (Nguyễn Lê Huy Tâm: 18 tasks - 53 SP | Huỳnh Đình Chấn: 14 tasks - 42 SP)
- **Trạng thái**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Mức độ ưu tiên | Story Points | Ngày hoàn thành | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-45` | Xây dựng giao diện tải tài liệu PDF. | EPIC 03 | Nguyễn Lê Huy Tâm | High | 3 | 28/10/2026 | Kéo thả và chọn file trong `index.html` | **Done** |
| `PDFL-46` | Xây dựng giao diện hiển thị tiến trình tải lên và xử lý tài liệu. | EPIC 03 | Nguyễn Lê Huy Tâm | High | 3 | 27/10/2026 | Modal progress 4 bước xử lý | **Done** |
| `PDFL-47` | Xây dựng giao diện hiển thị văn bản sau khi trích xuất. | EPIC 03 | Nguyễn Lê Huy Tâm | High | 3 | 27/10/2026 | Dual-pane Workspace trong `workspace.css` | **Done** |
| `PDFL-57` | Thiết kế trạng thái loading, lỗi, thành công và giao diện khi chưa có dữ liệu. | EPIC 03 | Nguyễn Lê Huy Tâm | High | 3 | 28/10/2026 | Empty state & Spinner UI | **Done** |
| `PDFL-65` |  Xây dựng API lấy thông tin người dùng hiện tại. | EPIC 04 | Huỳnh Đình Chấn | High | 3 | 30/10/2026 | `Code/backend/app/api/auth.py` | **Done** |
| `PDFL-66` |  Xây dựng API kiểm tra quyền sử dụng tính năng. | EPIC 04 | Huỳnh Đình Chấn | High | 3 | 30/10/2026 | `app/core/dependencies.py` | **Done** |
| `PDFL-72` |  Thiết kế bảng dữ liệu tài khoản người dùng. | EPIC 05 | Huỳnh Đình Chấn | Highest | 3 | 26/10/2026 | `app/models/user.py` | **Done** |
| `PDFL-73` | Xây dựng chức năng đăng ký tài khoản. | EPIC 05 | Huỳnh Đình Chấn | Highest | 3 | 30/10/2026 | `app/api/auth.py`, `auth.js` | **Done** |
| `PDFL-74` | Kiểm tra email và thông tin đăng ký hợp lệ. | EPIC 05 | Huỳnh Đình Chấn | High | 3 | 30/10/2026 | `test_background_jobs_api.py` | **Done** |
| `PDFL-75` |  Mã hóa mật khẩu trước khi lưu vào database. | EPIC 05 | Huỳnh Đình Chấn | High | 3 | 29/10/2026 | `app/core/security.py` | **Done** |
| `PDFL-76` |  Xây dựng chức năng đăng nhập. | EPIC 05 | Huỳnh Đình Chấn | Highest | 3 | 30/10/2026 | Login API & form đăng nhập | **Done** |
| `PDFL-78` | Xây dựng chức năng đăng xuất. | EPIC 05 | Huỳnh Đình Chấn | Highest | 3 | 30/10/2026 | Logout handler & xóa JWT cookie/storage | **Done** |
| `PDFL-79` |  Xây dựng chức năng xem và cập nhật thông tin tài khoản. | EPIC 05 | Huỳnh Đình Chấn | Highest | 3 | 30/10/2026 | Modal profile & Update profile API | **Done** |
| `PDFL-80` | Xây dựng chức năng đổi mật khẩu. | EPIC 05 | Huỳnh Đình Chấn | Highest | 3 | 30/10/2026 | Change password API & validation | **Done** |
| `PDFL-81` |  Kiểm soát quyền truy cập của khách, người dùng đã đăng nhập và Admin. | EPIC 05 | Huỳnh Đình Chấn | Highest | 3 | 30/10/2026 | Role-based authentication middleware | **Done** |
| `PDFL-82` | Kiểm tra quyền truy cập khi người dùng gọi trực tiếp API, không chỉ ẩn chức năng trên giao diện. | EPIC 05 | Huỳnh Đình Chấn | Medium | 3 | 30/10/2026 | Dependency security checks trên router | **Done** |
| `PDFL-83` | Xử lý trường hợp token hết hạn, tài khoản không tồn tại hoặc thông tin đăng nhập sai. | EPIC 05 | Huỳnh Đình Chấn | High | 3 | 30/10/2026 | JWT decode error handling | **Done** |
| `PDFL-84` |  Kiểm tra khả năng truy cập và chỉnh sửa dữ liệu của người dùng khác. | EPIC 05 | Huỳnh Đình Chấn | Medium | 3 | 30/10/2026 | Anti-tampering checks | **Done** |
| `PDFL-85` |  Xây dựng API tải tài liệu PDF lên Backend. | EPIC 06 | Nguyễn Lê Huy Tâm | High | 3 | 27/10/2026 | `POST /api/process/upload-and-translate` | **Done** |
| `PDFL-86` |  Kiểm tra loại file và nội dung file để hạn chế file giả mạo định dạng PDF. | EPIC 06 | Nguyễn Lê Huy Tâm | High | 2 | 27/10/2026 | Magic bytes check `%PDF-` | **Done** |
| `PDFL-87` |  Áp dụng giới hạn dung lượng: Free tối đa 20 MB/tệp, Pro tối đa 100 MB/tệp. | EPIC 06 | Nguyễn Lê Huy Tâm | High | 3 | 27/10/2026 | File size validation middleware | **Done** |
| `PDFL-88` | Kiểm tra PDF bị hỏng, có mật khẩu hoặc không thể đọc. | EPIC 06 | Nguyễn Lê Huy Tâm | High | 2 | 27/10/2026 | PyPDF parser try-catch checks | **Done** |
| `PDFL-89` | Thiết lập giới hạn số trang được phép xử lý. | EPIC 06 | Nguyễn Lê Huy Tâm | High | 2 | 29/10/2026 | Page count limit guard | **Done** |
| `PDFL-99` |  Tích hợp thư viện PyMuPDF để đọc và trích xuất văn bản. | EPIC 07 | Nguyễn Lê Huy Tâm | High | 3 | 27/10/2026 | `pdf_service.py` trích xuất text số | **Done** |
| `PDFL-100` | Trích xuất văn bản theo từng trang. | EPIC 07 | Nguyễn Lê Huy Tâm | High | 3 | 27/10/2026 | Pagination loop extraction | **Done** |
| `PDFL-101` | Xử lý xuống dòng, khoảng trắng và ký tự bất thường. | EPIC 07 | Nguyễn Lê Huy Tâm | High | 2 | 27/10/2026 | Text sanitization regex | **Done** |
| `PDFL-102` | Giữ thứ tự văn bản hợp lý khi tài liệu có nhiều đoạn hoặc nhiều cột. | EPIC 07 | Nguyễn Lê Huy Tâm | High | 2 | 29/10/2026 | Thuật toán sắp xếp khối toạ độ bbox | **Done** |
| `PDFL-103` | Phát hiện tài liệu có ít hoặc không có văn bản trích xuất được. | EPIC 07 | Nguyễn Lê Huy Tâm | High | 3 | 27/10/2026 | Scan detection heuristic | **Done** |
| `PDFL-104` | Tích hợp Tesseract OCR để nhận diện văn bản từ PDF scan | EPIC 07 | Nguyễn Lê Huy Tâm | High | 5 | 27/10/2026 | `ocr_service.py` (`pytesseract`) | **Done** |
| `PDFL-105` | Cấu hình dữ liệu ngôn ngữ OCR cần hỗ trợ, ưu tiên tiếng Việt và tiếng Anh. | EPIC 07 | Nguyễn Lê Huy Tâm | High | 5 | 27/10/2026 | `tessdata` language configuration | **Done** |
| `PDFL-106` | Kết hợp kết quả OCR với cơ chế trích xuất văn bản thông thường. | EPIC 07 | Nguyễn Lê Huy Tâm | High | 3 | 27/10/2026 | Fallback OCR per page | **Done** |
| `PDFL-107` | Xây dựng API trả về nội dung văn bản được trích xuất. | EPIC 07 | Nguyễn Lê Huy Tâm | High | 3 | 27/10/2026 | `POST /api/process/extract-text` | **Done** |

### 📅 TUẦN 3 (Sprint 3: 27/10/2026 - 03/11/2026)
- **Trọng tâm**: Quản Lý Tài Liệu, OCR Nâng Cao, Dịch Thuật Cốt Lõi, Xuất File & Đo Lường
- **Ngày hoàn thành thực tế**: `03/11/2026`
- **Thống kê khối lượng**: `38 Tasks` | `109 Story Points` (Nguyễn Lê Huy Tâm: 28 tasks - 81 SP | Huỳnh Đình Chấn: 10 tasks - 28 SP)
- **Trạng thái**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Mức độ ưu tiên | Story Points | Ngày hoàn thành | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-42` | Xây dựng trang đăng ký tài khoản. | EPIC 03 | Huỳnh Đình Chấn | Highest | 3 | 01/11/2026 | `Code/frontend/register.html` | **Done** |
| `PDFL-43` | Xây dựng trang đăng nhập. | EPIC 03 | Huỳnh Đình Chấn | Highest | 3 | 01/11/2026 | `Code/frontend/login.html` | **Done** |
| `PDFL-44` | Xây dựng trang thông tin tài khoản. | EPIC 03 | Huỳnh Đình Chấn | Highest | 3 | 01/11/2026 | History view layout in UI | **Done** |
| `PDFL-48` | Xây dựng giao diện chọn ngôn ngữ nguồn và ngôn ngữ đích. | EPIC 03 | Nguyễn Lê Huy Tâm | High | 3 | 01/11/2026 | Dropdown chọn ngôn ngữ trong Workspace | **Done** |
| `PDFL-49` |  Xây dựng giao diện hiển thị bản dịch. | EPIC 03 | Nguyễn Lê Huy Tâm | High | 3 | 01/11/2026 | Pricing comparison layout | **Done** |
| `PDFL-52` | Xây dựng giao diện so sánh hoặc chuyển đổi giữa văn bản gốc và bản dịch. | EPIC 03 | Nguyễn Lê Huy Tâm | High | 3 | 01/11/2026 | Upgrade checkout UI | **Done** |
| `PDFL-59` | Kiểm tra tính nhất quán về thiết kế và khả năng sử dụng. | EPIC 03 | Huỳnh Đình Chấn | Highest | 3 | 07/11/2026 | UI audit check trên các trang | **Done** |
| `PDFL-77` |  Xây dựng cơ chế quản lý phiên đăng nhập hoặc token. | EPIC 05 | Nguyễn Lê Huy Tâm | Medium | 3 | 01/11/2026 | Token refresh & local storage sync | **Done** |
| `PDFL-90` |  Lưu trữ file trong thư mục hoặc dịch vụ lưu trữ được cấu hình. | EPIC 06 | Nguyễn Lê Huy Tâm | Medium | 3 | 03/11/2026 | `storage/documents/{user_id}/` | **Done** |
| `PDFL-91` |  Ghi nhận metadata của tài liệu như tên file, dung lượng, số trang, thời gian tải lên và chủ sở hữu. | EPIC 06 | Nguyễn Lê Huy Tâm | Medium | 3 | 03/11/2026 | `app/models/document.py` | **Done** |
| `PDFL-92` | Hiển thị danh sách tài liệu của người dùng. | EPIC 06 | Huỳnh Đình Chấn | High | 3 | 07/11/2026 | Panel quản lý tài liệu trong Workspace | **Done** |
| `PDFL-93` |  Xem thông tin chi tiết của một tài liệu. | EPIC 06 | Huỳnh Đình Chấn | High | 3 | 07/11/2026 | Modal Document Details | **Done** |
| `PDFL-94` |  Xây dựng chức năng xóa tài liệu. | EPIC 06 | Huỳnh Đình Chấn | High | 3 | 07/11/2026 | `DELETE /api/documents/{id}` | **Done** |
| `PDFL-95` |  Kiểm soát quyền tải xuống và truy cập file. | EPIC 06 | Nguyễn Lê Huy Tâm | Highest | 3 | 03/11/2026 | Document access control check | **Done** |
| `PDFL-96` |  Xử lý lỗi khi tải file, mất kết nối hoặc quá giới hạn. | EPIC 06 | Nguyễn Lê Huy Tâm | High | 3 | 01/11/2026 | Client-side error toasts & retry | **Done** |
| `PDFL-97` | Xóa các file tạm khi hoàn tất xử lý hoặc khi xảy ra lỗi. | EPIC 06 | Nguyễn Lê Huy Tâm | High | 3 | 01/11/2026 | Temp cleaner background logic | **Done** |
| `PDFL-98` | Đảm bảo tài liệu riêng tư không bị người dùng khác truy cập. | EPIC 06 | Nguyễn Lê Huy Tâm | Highest | 3 | 03/11/2026 | Owner isolation check | **Done** |
| `PDFL-108` | Hiển thị kết quả trích xuất trên giao diện. | EPIC 07 | Nguyễn Lê Huy Tâm | Medium | 3 | 01/11/2026 | Render formatted text trên Workspace | **Done** |
| `PDFL-109` | Xử lý tài liệu có trang trống, trang bị xoay hoặc hình ảnh chất lượng thấp. | EPIC 07 | Huỳnh Đình Chấn | High | 2 | 04/11/2026 | Deskew, rotate, blank detection logic | **Done** |
| `PDFL-110` | Kiểm thử độ chính xác với PDF thông thường và PDF scan. | EPIC 07 | Huỳnh Đình Chấn | High | 2 | 04/11/2026 | Dataset test runner | **Done** |
| `PDFL-111` | Tối ưu thời gian xử lý đối với tài liệu nhiều trang. | EPIC 07 | Huỳnh Đình Chấn | High | 3 | 04/11/2026 | Streaming / chunked page processing | **Done** |
| `PDFL-112` | Trả thông báo rõ ràng khi không trích xuất được nội dung. | EPIC 07 | Nguyễn Lê Huy Tâm | Medium | 3 | 01/11/2026 | Thông báo lỗi không nhận dạng được chữ | **Done** |
| `PDFL-113` | Lựa chọn thư viện hoặc dịch vụ dịch thuật | EPIC 08 | Nguyễn Lê Huy Tâm | Medium | 3 | 02/11/2026 | Đánh giá `deep-translator` vs API | **Done** |
| `PDFL-114` | Xác định danh sách ngôn ngữ nguồn và ngôn ngữ đích được hỗ trợ. | EPIC 08 | Nguyễn Lê Huy Tâm | Medium | 5 | 02/11/2026 | Config hỗ trợ 10+ ngôn ngữ | **Done** |
| `PDFL-115` | Xây dựng chức năng tự động nhận diện ngôn ngữ nguồn nếu dịch vụ hỗ trợ. | EPIC 08 | Nguyễn Lê Huy Tâm | Medium | 5 | 02/11/2026 | Auto-detect language engine | **Done** |
| `PDFL-116` | Xây dựng giao diện chọn ngôn ngữ. | EPIC 08 | Nguyễn Lê Huy Tâm | High | 3 | 02/11/2026 | Language selector UI widget | **Done** |
| `PDFL-117` | Xây dựng API dịch văn bản. | EPIC 08 | Nguyễn Lê Huy Tâm | Medium | 3 | 02/11/2026 | `POST /api/translate` | **Done** |
| `PDFL-118` | Chia văn bản dài thành các đoạn phù hợp với giới hạn của dịch vụ. | EPIC 08 | Nguyễn Lê Huy Tâm | Highest | 5 | 02/11/2026 | Sentence boundary chunking | **Done** |
| `PDFL-119` | Giữ thứ tự các đoạn khi ghép kết quả dịch. | EPIC 08 | Nguyễn Lê Huy Tâm | Medium | 3 | 02/11/2026 | Chunk index order reassembly | **Done** |
| `PDFL-121` | Hiển thị bản dịch kèm thông tin ngôn ngữ. | EPIC 08 | Nguyễn Lê Huy Tâm | Medium | 1 | 02/11/2026 | Metadata badge trên bản dịch | **Done** |
| `PDFL-122` | Cho phép sao chép bản dịch. | EPIC 08 | Nguyễn Lê Huy Tâm | Medium | 1 | 02/11/2026 | Nút Copy to Clipboard | **Done** |
| `PDFL-151` | Xây dựng chức năng xuất văn bản thành file TXT. | EPIC 11 | Nguyễn Lê Huy Tâm | High | 2 | 01/11/2026 | Export TXT UTF-8 BOM | **Done** |
| `PDFL-152` | Xây dựng chức năng xuất nội dung thành file PDF. | EPIC 11 | Nguyễn Lê Huy Tâm | High | 2 | 01/11/2026 | Export PDF Unicode tiếng Việt | **Done** |
| `PDFL-153` | Xây dựng chức năng tải file kết quả về thiết bị người dùng. | EPIC 11 | Nguyễn Lê Huy Tâm | High | 3 | 01/11/2026 | Download trigger & blob handling | **Done** |
| `PDFL-154` | Đặt tên file kết quả theo tài liệu, ngôn ngữ hoặc loại nội dung. | EPIC 11 | Nguyễn Lê Huy Tâm | Medium | 1 | 02/11/2026 | Quy chuẩn tên file tải về | **Done** |
| `PDFL-155` | Đảm bảo tiếng Việt và Unicode được hiển thị đúng trong file xuất. | EPIC 11 | Nguyễn Lê Huy Tâm | High | 3 | 02/11/2026 | Font registration (Roboto/DejaVu) | **Done** |
| `PDFL-253` | Hỗ trợ kéo thả file vào giao diện. | EPIC 17 | Nguyễn Lê Huy Tâm | Medium | 2 | 03/11/2026 | Drag & drop highlight & drop event | **Done** |
| `PDFL-267` | Điều khoản và bảo mật cho người dùng | EPIC 03 | Nguyễn Lê Huy Tâm | Medium | 3 | 29/10/2026 | Modal Terms & Privacy Policy | **Done** |

### 📅 TUẦN 4 (Sprint 4: 03/11/2026 - 10/11/2026)
- **Trọng tâm**: Dịch Thuật Fallback, Xuất File, Lịch Sử Xử Lý, Quản Trị Admin Cơ Bản & Quyền Lợi Gói
- **Ngày hoàn thành thực tế**: `10/11/2026`
- **Thống kê khối lượng**: `31 Tasks` | `90 Story Points` (Nguyễn Lê Huy Tâm: 16 tasks - 44 SP | Huỳnh Đình Chấn: 15 tasks - 46 SP)
- **Trạng thái**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Mức độ ưu tiên | Story Points | Ngày hoàn thành | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-120` | Xử lý lỗi mạng, giới hạn API và lỗi dịch thuật. | EPIC 08 | Nguyễn Lê Huy Tâm | High | 3 | 03/11/2026 | Fallback engine & retry policy | **Done** |
| `PDFL-123` | Kiểm thử các trường hợp dịch tiếng Việt, tiếng Anh và các ngôn ngữ được lựa chọn. | EPIC 08 | Nguyễn Lê Huy Tâm | Medium | 3 | 03/11/2026 | Translation evaluation suite | **Done** |
| `PDFL-124` | Đánh giá khả năng giữ nguyên đoạn văn, danh sách và nội dung quan trọng khi dịch. | EPIC 08 | Nguyễn Lê Huy Tâm | Medium | 3 | 03/11/2026 | Structure preservation check | **Done** |
| `PDFL-125` | Đảm bảo hệ thống không làm mất hoặc đảo thứ tự đoạn khi dịch tài liệu dài. | EPIC 08 | Nguyễn Lê Huy Tâm | Medium | 3 | 03/11/2026 | Sequence verification test | **Done** |
| `PDFL-150` | Xác định các loại kết quả có thể xuất: văn bản gốc, bản dịch và bản tóm tắt. | EPIC 11 | Huỳnh Đình Chấn | Medium | 3 | 11/11/2026 | Export target schema | **Done** |
| `PDFL-156` | Xử lý trường hợp nội dung rỗng hoặc không có kết quả. | EPIC 11 | Huỳnh Đình Chấn | Highest | 3 | 11/11/2026 | Empty content validator | **Done** |
| `PDFL-157` | Kiểm tra quyền tải xuống và quyền truy cập kết quả. | EPIC 11 | Huỳnh Đình Chấn | Medium | 3 | 11/11/2026 | Export authorization check | **Done** |
| `PDFL-158` | Kiểm thử file xuất trên các trình đọc file thông dụng. | EPIC 11 | Huỳnh Đình Chấn | Medium | 3 | 11/11/2026 | Cross-viewer compatibility test | **Done** |
| `PDFL-159` | Thiết kế bảng dữ liệu lưu lịch sử xử lý. | EPIC 12 | Huỳnh Đình Chấn | High | 3 | 10/11/2026 | `app/models/processing_history.py` | **Done** |
| `PDFL-160` | Lưu thông tin tài liệu và loại thao tác đã thực hiện. | EPIC 12 | Huỳnh Đình Chấn | High | 3 | 10/11/2026 | Operation type logging | **Done** |
| `PDFL-161` | Lưu kết quả trích xuất, dịch thuật hoặc tóm tắt theo phạm vi chức năng đã thống nhất. | EPIC 12 | Huỳnh Đình Chấn | High | 3 | 10/11/2026 | History persistence logic | **Done** |
| `PDFL-162` | Xây dựng API lấy danh sách lịch sử. | EPIC 12 | Huỳnh Đình Chấn | High | 3 | 10/11/2026 | `GET /api/history` | **Done** |
| `PDFL-163` | Xây dựng API xem chi tiết một bản ghi lịch sử. | EPIC 12 | Huỳnh Đình Chấn | High | 3 | 10/11/2026 | `GET /api/history/{id}` | **Done** |
| `PDFL-164` | Hiển thị lịch sử trên giao diện | EPIC 12 | Huỳnh Đình Chấn | Medium | 3 | 10/11/2026 | History panel trong `index.html` | **Done** |
| `PDFL-165` | Cho phép mở lại kết quả đã lưu. | EPIC 12 | Huỳnh Đình Chấn | Medium | 2 | 10/11/2026 | Re-open past results handler | **Done** |
| `PDFL-166` | Cho phép xóa lịch sử theo chính sách lưu trữ. | EPIC 12 | Huỳnh Đình Chấn | Medium | 3 | 10/11/2026 | `DELETE /api/history/{id}` | **Done** |
| `PDFL-172` | Xác định quyền lợi cụ thể của gói Free. | EPIC 13 | Nguyễn Lê Huy Tâm | Highest | 2 | 03/11/2026 | Free plan definition specification | **Done** |
| `PDFL-173` | Xác định quyền lợi cụ thể của gói Pro. | EPIC 13 | Nguyễn Lê Huy Tâm | Highest | 2 | 05/11/2026 | Pro plan definition specification | **Done** |
| `PDFL-176` | Giới hạn tải lên tối đa 20 MB/tệp đối với Free. | EPIC 13 | Nguyễn Lê Huy Tâm | Medium | 3 | 03/11/2026 | `test_pricing_subscription.py` | **Done** |
| `PDFL-178` | Xác định và thực thi giới hạn số trang PDF cho từng gói. | EPIC 13 | Huỳnh Đình Chấn | Medium | 3 | 11/11/2026 | Quota control in backend | **Done** |
| `PDFL-185` | Kiểm thử việc áp dụng hạn mức ở Backend, kể cả khi người dùng gọi API trực tiếp. | EPIC 13 | Huỳnh Đình Chấn | Medium | 3 | 11/11/2026 | Backend limit enforcement test | **Done** |
| `PDFL-186` | Xác định vai trò và quyền hạn của Admin. | EPIC 14 | Nguyễn Lê Huy Tâm | High | 2 | 03/11/2026 | Admin role definition | **Done** |
| `PDFL-188` | Xây dựng trang tổng quan quản trị. | EPIC 14 | Nguyễn Lê Huy Tâm | Medium | 3 | 04/11/2026 | Admin dashboard layout | **Done** |
| `PDFL-189` | Hiển thị danh sách tài khoản người dùng. | EPIC 14 | Nguyễn Lê Huy Tâm | Medium | 3 | 04/11/2026 | User management table | **Done** |
| `PDFL-194` | Khóa hoặc mở khóa tài khoản khi cần. | EPIC 14 | Nguyễn Lê Huy Tâm | Medium | 3 | 04/11/2026 | Ban/unban user action | **Done** |
| `PDFL-197` | Xử lý thông báo xác nhận trước những thao tác có ảnh hưởng lớn. | EPIC 14 | Nguyễn Lê Huy Tâm | Medium | 3 | 04/11/2026 | Confirmation dialog widget | **Done** |
| `PDFL-198` | Kiểm thử quyền Admin và đảm bảo tài khoản thường không thể truy cập chức năng quản trị. | EPIC 14 | Nguyễn Lê Huy Tâm | Highest | 3 | 04/11/2026 | Admin RBAC guard test | **Done** |
| `PDFL-207` | Kiểm thử PDF văn bản thông thường. | EPIC 15 | Nguyễn Lê Huy Tâm | High | 3 | 03/11/2026 | Standard PDF test dataset | **Done** |
| `PDFL-214` | Kiểm tra an toàn file tải lên và ngăn việc truy cập file ngoài phạm vi cho phép. | EPIC 15 | Huỳnh Đình Chấn | Medium | 5 | 11/11/2026 | Upload safety & path traversal guard | **Done** |
| `PDFL-240` | Viết README giới thiệu PDF Lingua. | EPIC 16 | Nguyễn Lê Huy Tâm | Medium | 2 | 03/11/2026 | `README.md` tổng quan dự án | **Done** |
| `PDFL-260` | Gửi thông báo về trạng thái xử lý tài liệu. | EPIC 17 | Nguyễn Lê Huy Tâm | High | 3 | 03/11/2026 | Toast notification system | **Done** |

### 📅 TUẦN 5 (Sprint 5: 10/11/2026 - 17/11/2026)
- **Trọng tâm**: Lịch Sử Pro, Quản Trị Admin Nâng Cao, Hạn Mức Free/Pro, Mở Rộng, Thiết Kế Đồ Án, Avatar & Billing
- **Ngày hoàn thành thực tế**: `17/11/2026`
- **Thống kê khối lượng**: `41 Tasks` | `111 Story Points` (Nguyễn Lê Huy Tâm: 22 tasks - 58 SP | Huỳnh Đình Chấn: 19 tasks - 53 SP)
- **Trạng thái**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Mức độ ưu tiên | Story Points | Ngày hoàn thành | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-53` | Xây dựng giao diện lịch sử xử lý tài liệu. | EPIC 03 | Huỳnh Đình Chấn | High | 3 | 11/11/2026 | `Code/` (11/11/2026) | **Done** |
| `PDFL-54` | Xây dựng trang giới thiệu và so sánh gói Free/Pro. | EPIC 03 | Nguyễn Lê Huy Tâm | High | 3 | 11/11/2026 | `Code/` (11/11/2026) | **Done** |
| `PDFL-55` | Xây dựng giao diện nâng cấp gói Pro. | EPIC 03 | Nguyễn Lê Huy Tâm | Highest | 3 | 11/11/2026 | `Code/` (11/11/2026) | **Done** |
| `PDFL-56` | Xây dựng giao diện quản trị Admin. | EPIC 03 | Nguyễn Lê Huy Tâm | Highest | 3 | 11/11/2026 | Admin dashboard UI | **Done** |
| `PDFL-67` |  Xây dựng API kiểm tra giới hạn upload, AI và các hạn mức khác. | EPIC 04 | Nguyễn Lê Huy Tâm | High | 3 | 15/11/2026 | `GET /api/users/limits` | **Done** |
| `PDFL-71` | Xử lý các tác vụ mất nhiều thời gian mà không khóa toàn bộ ứng dụng. | EPIC 04 | Huỳnh Đình Chấn | High | 3 | 15/11/2026 | `Code/` (15/11/2026) | **Done** |
| `PDFL-167` | Chỉ cho phép tài khoản Pro sử dụng chức năng lịch sử nếu đây là quyền lợi đã chốt. | EPIC 12 | Nguyễn Lê Huy Tâm | High | 2 | 11/11/2026 | `test_history_api.py` Pro guard | **Done** |
| `PDFL-168` | Kiểm soát quyền truy cập lịch sử theo tài khoản. | EPIC 12 | Nguyễn Lê Huy Tâm | High | 3 | 11/11/2026 | Anti-IDOR history security | **Done** |
| `PDFL-169` | Xác định thời gian lưu trữ và cách xóa dữ liệu khi cần. | EPIC 12 | Huỳnh Đình Chấn | High | 2 | 15/11/2026 | Data retention policy | **Done** |
| `PDFL-170` | Kiểm thử khả năng lưu, truy vấn, mở lại và xóa lịch sử. | EPIC 12 | Huỳnh Đình Chấn | Medium | 3 | 11/11/2026 | `test_history_result.py` | **Done** |
| `PDFL-171` | Thiết kế dữ liệu gói dịch vụ và trạng thái đăng ký của người dùng. | EPIC 13 | Nguyễn Lê Huy Tâm | High | 3 | 11/11/2026 | `app/models/subscription.py` | **Done** |
| `PDFL-174` | Hiển thị gói hiện tại của người dùng. | EPIC 13 | Nguyễn Lê Huy Tâm | High | 2 | 11/11/2026 | Free/Pro badge trên giao diện | **Done** |
| `PDFL-175` | Xây dựng cơ chế kiểm tra gói dịch vụ ở Backend. | EPIC 13 | Nguyễn Lê Huy Tâm | Highest | 3 | 11/11/2026 | `Code/` (11/11/2026) | **Done** |
| `PDFL-177` | Giới hạn tải lên tối đa 100 MB/tệp đối với Pro. | EPIC 13 | Huỳnh Đình Chấn | High | 2 | 11/11/2026 | Pro size limit validation | **Done** |
| `PDFL-179` | Xác định hạn mức OCR, dịch thuật và AI theo gói. | EPIC 13 | Nguyễn Lê Huy Tâm | High | 2 | 11/11/2026 | `Code/` (11/11/2026) | **Done** |
| `PDFL-180` | Chặn hoặc thông báo khi người dùng vượt hạn mức. | EPIC 13 | Huỳnh Đình Chấn | High | 2 | 11/11/2026 | Frontend quota modal alert | **Done** |
| `PDFL-181` | Xây dựng trang so sánh quyền lợi Free và Pro. | EPIC 13 | Nguyễn Lê Huy Tâm | Highest | 2 | 11/11/2026 | `pricing.html` comparison table | **Done** |
| `PDFL-182` | Xây dựng luồng yêu cầu nâng cấp lên Pro. | EPIC 13 | Nguyễn Lê Huy Tâm | High | 3 | 11/11/2026 | Upgrade modal & form | **Done** |
| `PDFL-183` | Cập nhật quyền sử dụng khi tài khoản được nâng cấp hoặc hạ cấp. | EPIC 13 | Nguyễn Lê Huy Tâm | High | 3 | 11/11/2026 | Immediate role synchronization | **Done** |
| `PDFL-184` | Hiển thị thông báo nâng cấp khi người dùng truy cập tính năng dành cho Pro. | EPIC 13 | Nguyễn Lê Huy Tâm | High | 2 | 11/11/2026 | Feature lock banner UI | **Done** |
| `PDFL-187` | Thiết lập cách khởi tạo tài khoản Admin an toàn. | EPIC 14 | Nguyễn Lê Huy Tâm | Highest | 3 | 11/11/2026 | Seed admin CLI script | **Done** |
| `PDFL-190` | Tìm kiếm và lọc tài khoản theo thông tin phù hợp. | EPIC 14 | Nguyễn Lê Huy Tâm | Medium | 2 | 11/11/2026 | Search & filter users in Admin UI | **Done** |
| `PDFL-191` | Xem thông tin và trạng thái tài khoản. | EPIC 14 | Nguyễn Lê Huy Tâm | Medium | 2 | 11/11/2026 | User details modal | **Done** |
| `PDFL-192` | Theo dõi trạng thái gói Free/Pro. | EPIC 14 | Nguyễn Lê Huy Tâm | Medium | 2 | 11/11/2026 | Subscription filter & metrics | **Done** |
| `PDFL-193` | Cấp, gia hạn, hạ cấp hoặc thu hồi quyền Pro theo quy định của hệ thống. | EPIC 14 | Nguyễn Lê Huy Tâm | High | 3 | 11/11/2026 | Role assignment endpoints | **Done** |
| `PDFL-195` | Kiểm soát quyền Admin ở Backend. | EPIC 14 | Nguyễn Lê Huy Tâm | High | 3 | 11/11/2026 | `test_admin_management.py` | **Done** |
| `PDFL-196` | Ghi nhận nhật ký các thao tác quản trị quan trọng. | EPIC 14 | Nguyễn Lê Huy Tâm | Highest | 3 | 11/11/2026 | Admin action audit logger | **Done** |
| `PDFL-247` | Chuẩn bị dữ liệu PDF mẫu phục vụ demo. | EPIC 16 | Huỳnh Đình Chấn | Medium | 2 | 16/11/2026 | `tests/dataset/demo_samples/` | **Done** |
| `PDFL-252` | Cho phép xử lý nhiều file PDF theo lô. | EPIC 17 | Huỳnh Đình Chấn | High | 2 | 15/11/2026 | `test_batch_zip.py` (14/11/2026) | **Done** |
| `PDFL-254` | Cho phép người dùng Pro tải kết quả dưới định dạng DOCX | EPIC 17 | Huỳnh Đình Chấn | High | 3 | 15/11/2026 | `test_docx_export.py` (14/11/2026) | **Done** |
| `PDFL-255` | Cho phép chọn các trang cụ thể cần trích xuất hoặc dịch. | EPIC 17 | Huỳnh Đình Chấn | High | 3 | 15/11/2026 | `test_page_selection.py` | **Done** |
| `PDFL-256` | Hỗ trợ xem trước PDF và chuyển trang ngay trên ứng dụng. | EPIC 17 | Huỳnh Đình Chấn | High | 2 | 15/11/2026 | `test_pdf_inline_preview.py` (14/11) | **Done** |
| `PDFL-262` | Bổ sung thống kê mức sử dụng dịch vụ. | EPIC 17 | Huỳnh Đình Chấn | High | 3 | 23/11/2026 | `admin_service.py`, `admin.js` | **Done** |
| `PDFL-269` | Kiến trúc hệ thống (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | Nguyễn Lê Huy Tâm | Highest | 3 | 15/11/2026 | `kien_truc_he_thong.md` (15/11/2026) | **Done** |
| `PDFL-270` | Lược đồ usecase (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | Huỳnh Đình Chấn | Highest | 5 | 11/11/2026 | `Docs/diagrams/use_case_diagram.png` | **Done** |
| `PDFL-271` | Lược đồ lớp (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | Huỳnh Đình Chấn | Highest | 3 | 14/11/2026 | `luoc_do_lop.md`, `luoc_do_lop.png` | **Done** |
| `PDFL-272` | Thiết kế tính năng tải lên ảnh đại diện cho người dùng | EPIC 17 | Huỳnh Đình Chấn | Medium | 3 | 17/11/2026 | Data schema avatar upload | **Done** |
| `PDFL-273` | Xây dựng giao diện tải lên, cắt ảnh và hiển thị avatar người dùng | EPIC 03 | Huỳnh Đình Chấn | Medium | 3 | 17/11/2026 | Frontend crop avatar modal | **Done** |
| `PDFL-274` | Xây dựng API lấy danh sách lịch sử giao dịch thanh toán của người dùng (Billing) | EPIC 13 | Huỳnh Đình Chấn | High | 3 | 23/11/2026 | Billing transaction API schema | **Done** |
| `PDFL-275` | Xây dựng giao diện xem Lịch sử giao dịch, hóa đơn và trạng thái thanh toán Pro (Billing) | EPIC 03 | Huỳnh Đình Chấn | High | 3 | 23/11/2026 | Billing invoice history UI | **Done** |
| `PDFL-276` | Xây dựng giao diện hiển thị mức độ sử dụng, trạng thái gói cho Pro | EPIC 03 | Huỳnh Đình Chấn | High | 3 | 23/11/2026 | Quota usage meter bar & Circular rings | **Done** |

### 📅 TUẦN 6 (Sprint 6: 17/11/2026 - 24/11/2026)
- **Trọng tâm**: Tích Hợp AI: Tóm Tắt Văn Bản & Trợ Lý Hỏi Đáp Tài Liệu, Tính Năng Mở Rộng & Triển Khai
- **Ngày hoàn thành thực tế**: `24/11/2026`
- **Thống kê khối lượng**: `37 Tasks` | `114 Story Points` (Nguyễn Lê Huy Tâm: 35 tasks - 106 SP | Huỳnh Đình Chấn: 2 tasks - 8 SP)
- **Trạng thái**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Mức độ ưu tiên | Story Points | Ngày hoàn thành | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-50` | Xây dựng giao diện tóm tắt văn bản bằng AI. | EPIC 03 | Nguyễn Lê Huy Tâm | Highest | 3 | 12/11/2026 | Layout AI Summary widget | **Done** |
| `PDFL-51` | Xây dựng giao diện trò chuyện với trợ lý AI. | EPIC 03 | Nguyễn Lê Huy Tâm | Highest | 3 | 12/11/2026 | Layout AI Copilot Chat panel | **Done** |
| `PDFL-126` | Lựa chọn mô hình AI hoặc dịch vụ API phù hợp. | EPIC 09 | Nguyễn Lê Huy Tâm | Highest | 3 | 12/11/2026 | Tích hợp Google Gemini / OpenAI API | **Done** |
| `PDFL-127` | Quản lý API key thông qua biến môi trường. | EPIC 09 | Nguyễn Lê Huy Tâm | High | 3 | 12/11/2026 | `config.py` AI key management | **Done** |
| `PDFL-128` | Xây dựng cấu trúc prompt tóm tắt văn bản. | EPIC 09 | Nguyễn Lê Huy Tâm | High | 3 | 14/11/2026 | System prompts trong `ai_service.py` | **Done** |
| `PDFL-129` | Xây dựng API tóm tắt nội dung tài liệu. | EPIC 09 | Nguyễn Lê Huy Tâm | High | 3 | 14/11/2026 | `POST /api/ai/summarize` | **Done** |
| `PDFL-130` | Hỗ trợ lựa chọn độ dài hoặc kiểu tóm tắt nếu mô hình cho phép. | EPIC 09 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | Kiểu tóm tắt: ngắn, chi tiết, bullet | **Done** |
| `PDFL-131` | Hỗ trợ tóm tắt văn bản dài bằng cách chia đoạn hoặc tóm tắt nhiều bước. | EPIC 09 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | Thuật toán Map-Reduce chunk summarizer | **Done** |
| `PDFL-132` | Hiển thị nội dung tóm tắt trên giao diện. | EPIC 09 | Nguyễn Lê Huy Tâm | High | 3 | 14/11/2026 | Tab tóm tắt trong Workspace UI | **Done** |
| `PDFL-133` | Cho phép sao chép kết quả tóm tắt. | EPIC 09 | Nguyễn Lê Huy Tâm | Medium | 2 | 12/11/2026 | Copy summary button & toast | **Done** |
| `PDFL-134` | Kiểm tra quyền sử dụng AI của tài khoản Pro. | EPIC 09 | Nguyễn Lê Huy Tâm | Medium | 2 | 16/11/2026 | Pro guard check trên AI endpoints | **Done** |
| `PDFL-135` | Kiểm soát số lượt sử dụng, lượng văn bản đầu vào và chi phí. | EPIC 09 | Nguyễn Lê Huy Tâm | Highest | 2 | 16/11/2026 | Token limit & daily quota tracker | **Done** |
| `PDFL-136` | Xử lý lỗi khi dịch vụ AI không phản hồi hoặc vượt giới hạn. | EPIC 09 | Nguyễn Lê Huy Tâm | Highest | 2 | 16/11/2026 | Timeout retry & error handler | **Done** |
| `PDFL-137` | Kiểm thử chất lượng tóm tắt trên các loại tài liệu khác nhau. | EPIC 09 | Nguyễn Lê Huy Tâm | Medium | 3 | 16/11/2026 | `test_ai_summary_quality.py` | **Done** |
| `PDFL-138` | Xác định phạm vi câu hỏi mà trợ lý AI có thể xử lý. | EPIC 10 | Nguyễn Lê Huy Tâm | Highest | 3 | 16/11/2026 | QA Scope & instructions definition | **Done** |
| `PDFL-139` | Xây dựng API gửi câu hỏi về tài liệu. | EPIC 10 | Nguyễn Lê Huy Tâm | High | 3 | 12/11/2026 | `POST /api/ai/chat` | **Done** |
| `PDFL-140` | Cung cấp nội dung tài liệu liên quan làm ngữ cảnh cho AI. | EPIC 10 | Nguyễn Lê Huy Tâm | High | 3 | 14/11/2026 | Context window extraction logic | **Done** |
| `PDFL-141` | Xử lý tài liệu dài bằng cách chọn các đoạn liên quan trước khi gửi cho AI. | EPIC 10 | Nguyễn Lê Huy Tâm | High | 3 | 14/11/2026 | Relevance chunk filtering | **Done** |
| `PDFL-142` | Xây dựng giao diện khung chat. | EPIC 10 | Nguyễn Lê Huy Tâm | Highest | 3 | 12/11/2026 | Chatbox UI widget trong Workspace | **Done** |
| `PDFL-143` | Hiển thị câu hỏi và câu trả lời theo thứ tự hội thoại. | EPIC 10 | Nguyễn Lê Huy Tâm | High | 3 | 12/11/2026 | Chat history bubble list | **Done** |
| `PDFL-144` | Xử lý trạng thái AI đang suy nghĩ, câu trả lời lỗi và yêu cầu thử lại. | EPIC 10 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | Typing indicator animation & retry UI | **Done** |
| `PDFL-145` | Giới hạn số lượt hỏi đáp hoặc lượng nội dung theo gói dịch vụ. | EPIC 10 | Nguyễn Lê Huy Tâm | Highest | 3 | 12/11/2026 | QA rate limit per user tier | **Done** |
| `PDFL-146` | Đảm bảo câu trả lời dựa trên nội dung tài liệu khi người dùng hỏi về tài liệu. | EPIC 10 | Nguyễn Lê Huy Tâm | High | 3 | 14/11/2026 | Grounding prompt & reference injection | **Done** |
| `PDFL-147` | Xử lý trường hợp tài liệu không có thông tin để trả lời. | EPIC 10 | Nguyễn Lê Huy Tâm | Medium | 3 | 14/11/2026 | Fallback "không tìm thấy thông tin" | **Done** |
| `PDFL-148` | Kiểm soát quyền truy cập để người dùng không hỏi hoặc truy xuất tài liệu của người khác. | EPIC 10 | Nguyễn Lê Huy Tâm | Highest | 3 | 16/11/2026 | Anti-IDOR context guard | **Done** |
| `PDFL-149` | Kiểm thử khả năng trả lời đúng nội dung, hạn chế bịa đặt và xử lý câu hỏi ngoài phạm vi. | EPIC 10 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `test_ai_chat_api.py` validation | **Done** |
| `PDFL-205` | Kiểm thử giao diện trên các kích thước màn hình khác nhau. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 25/11/2026 | `test_frontend_split_view.js` | **Done** |
| `PDFL-257` | Hỗ trợ lưu hoặc tải lại kết quả dịch theo từng trang. | EPIC 17 | Huỳnh Đình Chấn | Medium | 5 | 25/11/2026 | Lưu trữ cache phân trang và tải lại bản dịch | **Done** |
| `PDFL-259` | Tích hợp thanh toán trực tuyến cho gói Pro. | EPIC 17 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | Cổng thanh toán VietQR / SePay tự động kích hoạt gói Pro | **Done** |
| `PDFL-261` | Cho phép người dùng gửi phản hồi hoặc báo cáo lỗi. | EPIC 17 | Nguyễn Lê Huy Tâm | Medium | 3 | 16/11/2026 | Modal tiếp nhận ý kiến đóng góp & bug report | **Done** |
| `PDFL-263` | Cải thiện khả năng truy xuất nguồn cho câu trả lời AI bằng cách tham chiếu trang hoặc đoạn văn liên quan. | EPIC 17 | Nguyễn Lê Huy Tâm | High | 3 | 17/11/2026 | AI Copilot citation & source chunk linking | **Done** |
| `PDFL-265` | Xem xét sử dụng hàng đợi tác vụ cho các file lớn và quy trình OCR/AI kéo dài. | EPIC 17 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `Code/` (16/11/2026) | **Done** |
| `PDFL-277` | Trang web hỗ trợ ngôn ngữ Tiếng Anh | EPIC 17 | Nguyễn Lê Huy Tâm | Highest | 8 | 22/11/2026 | Hệ thống đa ngôn ngữ song ngữ Anh - Việt | **Done** |
| `PDFL-278` | Welcome Dashboard (Landing page khi người dùng mới ấn vào web) | EPIC 17 | Nguyễn Lê Huy Tâm | High | 3 | 19/11/2026 | Trang chào mừng độc lập `welcome.html` & Bento grid | **Done** |
| `PDFL-279` | Hướng dẫn sử dụng web | EPIC 16 | Nguyễn Lê Huy Tâm | Highest | 3 | 17/11/2026 | Hướng dẫn thao tác trải nghiệm ứng dụng web chi tiết | **Done** |
| `PDFL-280` | RBAC for UI/UX frontend and benefit update | EPIC 03 | Nguyễn Lê Huy Tâm | High | 3 | 20/11/2026 | `Code/` (20/11/2026) | **Done** |
| `PDFL-281` | Simple CI/CD Workflow | EPIC 15 | Nguyễn Lê Huy Tâm | Medium | 3 | 20/11/2026 | `Code/` (20/11/2026) | **Done** |

### 📅 TUẦN 7 (Sprint 7: 22/11/2026 - 29/11/2026)
- **Trọng tâm**: Nghiệm Thu Triển Khai Website, Theo Dõi Khách Truy Cập (Admin Visitors), Báo Cáo Đồ Án & Vá Lỗi
- **Ngày hoàn thành thực tế**: `28/11/2026`
- **Thống kê khối lượng**: `31 Tasks` | `95 Story Points` (Nguyễn Lê Huy Tâm: 21 tasks - 65 SP | Huỳnh Đình Chấn: 10 tasks - 30 SP)
- **Trạng thái**: 📋 Nghiệm thu đồ án (20 Done / 7 In Progress / 4 To Do)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Mức độ ưu tiên | Story Points | Ngày hoàn thành | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-199` | Xây dựng danh sách test case theo yêu cầu chức năng. | EPIC 15 | Huỳnh Đình Chấn | High | 5 | - | Bảng đặc tả ma trận test case chức năng | `In Progress` |
| `PDFL-218` | Giới hạn tần suất request phù hợp để giảm lạm dụng. | EPIC 15 | Huỳnh Đình Chấn | Highest | 3 | - | Kế hoạch thực hiện | `In Progress` |
| `PDFL-222` | Hạn chế nội dung không đáng tin cậy trong tài liệu ảnh hưởng đến chỉ dẫn của trợ lý AI. | EPIC 15 | Nguyễn Lê Huy Tâm | High | 3 | 24/11/2026 | Prompt guardrails trong `ai_service.py` | **Done** |
| `PDFL-228` | Chọn nền tảng triển khai Frontend. | EPIC 16 | Nguyễn Lê Huy Tâm | Highest | 3 | 24/11/2026 | Đề xuất Vercel Global Edge & cấu hình `vercel.json` | **Done** |
| `PDFL-229` | Chọn nền tảng triển khai Backend Python. | EPIC 16 | Nguyễn Lê Huy Tâm | Highest | 3 | 24/11/2026 | Đóng gói `Dockerfile` & đề xuất Render.com Web Service | **Done** |
| `PDFL-235` | Kiểm thử ứng dụng trên môi trường triển khai thực tế. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 5 | 24/11/2026 | `Code/` (24/11/2026) | **Done** |
| `PDFL-238` | Xác định phương án sao lưu và phục hồi database. | EPIC 16 | Nguyễn Lê Huy Tâm | Medium | 3 | 25/11/2026 | Tài liệu chiến lược backup database | **Done** |
| `PDFL-239` | Kiểm tra quy trình cập nhật phiên bản và khôi phục khi triển khai lỗi. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 3 | 24/11/2026 | `Code/` (24/11/2026) | **Done** |
| `PDFL-246` | Cung cấp hình ảnh giao diện | EPIC 16 | Huỳnh Đình Chấn | High | 2 | - | Bộ ảnh chụp giao diện và tài liệu hướng dẫn | `In Progress` |
| `PDFL-248` | Viết báo cáo phân tích, thiết kế, hiện thực | EPIC 16 | Nguyễn Lê Huy Tâm | Highest | 3 | 23/11/2026 | Báo cáo đồ án môn học hoàn chỉnh | **Done** |
| `PDFL-249` | Chuẩn bị slide thuyết trình (Powerpoint) | EPIC 16 | Huỳnh Đình Chấn | Medium | 3 | - | Slide trình chiếu báo cáo bảo vệ trước hội đồng | To Do |
| `PDFL-250` | Chuẩn bị kịch bản demo các chức năng chính. | EPIC 16 | Nguyễn Lê Huy Tâm | Medium | 3 | 24/11/2026 | Kịch bản trình diễn mượt mà (`Docs/demo-script/README.md`) | **Done** |
| `PDFL-251` | Kiểm tra README, tài liệu, repository và loại bỏ API key hoặc dữ liệu nhạy cảm trước khi bàn giao. | EPIC 16 | Nguyễn Lê Huy Tâm | Highest | 3 | 24/11/2026 | Báo cáo rà soát an toàn & script quét secret (`scan_secrets.py`) | **Done** |
| `PDFL-264` | Hỗ trợ nhiều chủ đề giao diện hoặc chế độ tối. | EPIC 17 | Huỳnh Đình Chấn | Low | 3 | - | Async background job queue processing | To Do |
| `PDFL-282` | Testing guests' features | EPIC 15 | Nguyễn Lê Huy Tâm | High | 3 | 20/11/2026 | `Code/` (20/11/2026) | **Done** |
| `PDFL-283` | Testing free users' features | EPIC 15 | Huỳnh Đình Chấn | Highest | 3 | - | Phân quyền vai trò người dùng và cập nhật quyền lợi Pro | `In Progress` |
| `PDFL-284` | Testing pro users' features | EPIC 15 | Huỳnh Đình Chấn | Highest | 5 | - | Pipeline tự động hóa kiểm thử mã nguồn trên GitHub Actions | `In Progress` |
| `PDFL-285` | Testing admin's features | EPIC 15 | Nguyễn Lê Huy Tâm | Highest | 3 | 26/11/2026 | `Code/` (26/11/2026) | **Done** |
| `PDFL-286` | Bulk-adding PDF files not translating after uploading successfully | EPIC 17 | Huỳnh Đình Chấn | Highest | 2 | 25/11/2026 | `Code/` (25/11/2026) | **Done** |
| `PDFL-287` | Viết báo cáo tổng kết đồ án (Words) | EPIC 16 | Nguyễn Lê Huy Tâm | Medium | 3 | 24/11/2026 | `Code/` (24/11/2026) | **Done** |
| `PDFL-288` | Triển khai trên website | EPIC 16 | Nguyễn Lê Huy Tâm | Highest | 5 | 24/11/2026 | Kiến trúc Decoupled Cloud (`Docs/installation-guide/cloud-deployment-guide.md`) | **Done** |
| `PDFL-289` | Monetization strategy by using ads | EPIC 18 | Nguyễn Lê Huy Tâm | Medium | 5 | - | Kế hoạch thực hiện | `In Progress` |
| `PDFL-291` | Add an extra paid plan (pricing plans) with better benefits | EPIC 18 | Huỳnh Đình Chấn | Medium | 2 | - | Kế hoạch thực hiện | To Do |
| `PDFL-292` | Pro plan adjustment | EPIC 13 | Huỳnh Đình Chấn | Medium | 2 | - | Kế hoạch thực hiện | To Do |
| `PDFL-293` | Allowing admin to track visitors and transition | EPIC 14 | Nguyễn Lê Huy Tâm | Medium | 3 | 26/11/2026 | `Code/` (26/11/2026) | **Done** |
| `PDFL-294` | Small tabs/frontend in Admin console for tracking visitors and transition | EPIC 03 | Nguyễn Lê Huy Tâm | Medium | 3 | 26/11/2026 | `Code/` (26/11/2026) | **Done** |
| `PDFL-295` | Enhancing bug reports from users | EPIC 17 | Nguyễn Lê Huy Tâm | Medium | 3 | - | Kế hoạch thực hiện | `In Progress` |
| `PDFL-296` | Upgrade to Pro for free via the "/simulate" endpoint | EPIC 13 | Nguyễn Lê Huy Tâm | Medium | 2 | 27/11/2026 | `Code/` (27/11/2026) | **Done** |
| `PDFL-297` | Admin's rejection not working properly | EPIC 14 | Nguyễn Lê Huy Tâm | Medium | 2 | 27/11/2026 | `Code/` (27/11/2026) | **Done** |
| `PDFL-298` | The webhook accepts a "pending" status and skips the amount check | EPIC 13 | Nguyễn Lê Huy Tâm | Medium | 2 | 27/11/2026 | `Code/` (27/11/2026) | **Done** |
| `PDFL-299` | Fix secret key with a default fallback is exposed | EPIC 15 | Nguyễn Lê Huy Tâm | Medium | 2 | 27/11/2026 | `Code/` (27/11/2026) | **Done** |

### 📅 TUẦN 8 (Sprint 8: 23/11/2026 - 30/11/2026)
- **Trọng tâm**: Kiểm Thử Toàn Diện (Unit, Integration, Security Matrix, Benchmark) & Cấu Hình An Toàn Môi Trường Triển Khai
- **Ngày hoàn thành thực tế**: `28/11/2026`
- **Thống kê khối lượng**: `35 Tasks` | `99 Story Points` (Nguyễn Lê Huy Tâm: 18 tasks - 48 SP | Huỳnh Đình Chấn: 17 tasks - 51 SP)
- **Trạng thái**: ✅ Đã hoàn thành (35/35 Done - 100%)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Người thực hiện | Mức độ ưu tiên | Story Points | Ngày hoàn thành | File / Minh chứng thực tế | Trạng thái |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| `PDFL-200` | Viết unit test cho các hàm xử lý nghiệp vụ quan trọng. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_services.py`, `test_job_service.py` | **Done** |
| `PDFL-201` | Kiểm thử API upload, trích xuất, OCR, dịch thuật và AI. | EPIC 15 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `test_api_process.py`, `test_ai_api.py` | **Done** |
| `PDFL-202` | Kiểm thử đăng ký, đăng nhập, phân quyền và gói Free/Pro. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_auth.py`, `test_permissions.py` | **Done** |
| `PDFL-203` | Kiểm thử lịch sử, xuất file và chức năng Admin. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_history_api.py`, `test_docx_export.py` | **Done** |
| `PDFL-204` | Kiểm thử tích hợp toàn bộ luồng từ tải PDF đến tải kết quả. | EPIC 15 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `test_e2e_pipeline.py` (E2E full flow) | **Done** |
| `PDFL-206` | Kiểm thử các trường hợp lỗi và trường hợp biên. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_files_lost_and_error_tasks.py` | **Done** |
| `PDFL-208` | Kiểm thử PDF scan. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_ocr_pipeline.py`, `test_deskew.py` | **Done** |
| `PDFL-209` | Kiểm thử PDF tiếng Việt có dấu và tài liệu đa ngôn ngữ. | EPIC 15 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `test_text_metrics.py`, bộ ground-truth | **Done** |
| `PDFL-210` | Kiểm thử PDF nhiều trang, nhiều cột hoặc bố cục phức tạp. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_layout_metrics.py` | **Done** |
| `PDFL-211` | Kiểm thử PDF bị hỏng, có mật khẩu hoặc không thể đọc. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_blank_page.py`, `test_upload_security.py` | **Done** |
| `PDFL-212` | Kiểm thử file nhỏ, file sát giới hạn và file vượt giới hạn dung lượng. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_size_page_limits_integration.py` | **Done** |
| `PDFL-213` | Kiểm thử tài liệu dài khi dịch thuật, tóm tắt và hỏi đáp AI. | EPIC 15 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `test_translation_pipeline_tasks.py` | **Done** |
| `PDFL-215` | Đảm bảo mật khẩu không được lưu dưới dạng văn bản thuần. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_auth.py`, bcrypt trong `security.py` | **Done** |
| `PDFL-216` | Đảm bảo API key và thông tin nhạy cảm không bị đưa lên GitHub. | EPIC 15 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `.gitignore`, `.env.example`, rà soát secret | **Done** |
| `PDFL-217` | Kiểm tra xác thực và phân quyền trên các API riêng tư. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_security_matrix.py` | **Done** |
| `PDFL-219` | Kiểm soát dung lượng, số trang, bộ nhớ và thời gian xử lý PDF. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_size_page_limits_integration.py` | **Done** |
| `PDFL-220` | Ngăn tài liệu hoặc lịch sử của người dùng này bị truy cập bởi người dùng khác. | EPIC 15 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `test_document_access_control.py` (Anti-IDOR) | **Done** |
| `PDFL-221` | Xác định chính sách lưu trữ, xóa và bảo vệ dữ liệu người dùng. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_history_delete.py` | **Done** |
| `PDFL-223` | Kiểm tra các lỗi phổ biến như SQL injection, XSS và truy cập trái phép. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_upload_security.py` | **Done** |
| `PDFL-224` | Đánh giá thời gian trích xuất, OCR, dịch và xử lý AI. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `benchmark_runner.py` | **Done** |
| `PDFL-225` | Kiểm tra nhiều request đồng thời và giới hạn tài nguyên. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_parallel_pdf_processing.py` | **Done** |
| `PDFL-226` | Tối ưu quy trình đọc, xử lý và lưu file lớn. | EPIC 15 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_memory_optimization.py` | **Done** |
| `PDFL-227` | Thiết lập thông báo lỗi, logging và cách khôi phục khi xử lý thất bại. | EPIC 15 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `exceptions.py`, `logger.py` | **Done** |
| `PDFL-230` | Chọn nơi lưu trữ PDF và file kết quả. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `storage_service.py` | **Done** |
| `PDFL-231` | Thiết lập database cho môi trường triển khai. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `database.py` (SQLite WAL / PostgreSQL) | **Done** |
| `PDFL-232` | Cấu hình biến môi trường và API key trên môi trường production. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `config.py` Settings | **Done** |
| `PDFL-233` | Cấu hình CORS, domain và HTTPS nếu nền tảng hỗ trợ. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 2 | 16/11/2026 | CORS Middleware trong `main.py` | **Done** |
| `PDFL-234` | Cài đặt các thành phần cần thiết cho OCR trên server. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 2 | 16/11/2026 | Cấu hình nhận diện Tesseract OCR | **Done** |
| `PDFL-236` | Kiểm tra việc xử lý file lớn theo giới hạn đã công bố. | EPIC 16 | Huỳnh Đình Chấn | High | 3 | 16/11/2026 | `test_size_page_limits_integration.py` | **Done** |
| `PDFL-237` | Thiết lập kiểm tra tình trạng hoạt động và theo dõi lỗi. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 2 | 16/11/2026 | Health check `GET /health` | **Done** |
| `PDFL-241` | Ghi rõ công nghệ sử dụng và yêu cầu cài đặt. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 2 | 16/11/2026 | Tài liệu `README.md` | **Done** |
| `PDFL-242` | Hướng dẫn thiết lập môi trường chạy trên máy cá nhân. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 2 | 16/11/2026 | `run.bat`, `README.md` | **Done** |
| `PDFL-243` | Hướng dẫn cấu hình .env và các dịch vụ bên ngoài. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 2 | 16/11/2026 | `.env.example`, `README.md` | **Done** |
| `PDFL-244` | Mô tả cấu trúc thư mục và kiến trúc hệ thống. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | `kien_truc_he_thong.md` | **Done** |
| `PDFL-245` | Viết tài liệu API và ví dụ request/response. | EPIC 16 | Nguyễn Lê Huy Tâm | High | 3 | 16/11/2026 | Swagger UI `/docs` | **Done** |

---

## 4. TỔNG KẾT ĐÓNG GÓP & ĐÁNH GIÁ THỰC HIỆN CỦA TỪNG THÀNH VIÊN

### 📊 Bảng tổng hợp Story Points và Tỷ lệ đóng góp

| STT | Thành viên | Vai trò | Số lượng Task | Tỷ lệ Task (%) | Story Points (SP) | Tỷ lệ SP (%) | Đánh giá hoàn thành |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | **Nguyễn Lê Huy Tâm** | Trưởng nhóm | 190 | 67.9% | 548 SP | 67.1% | Xuất sắc (100% cam kết) |
| 2 | **Huỳnh Đình Chấn** | Thành viên | 90 | 32.1% | 269 SP | 32.9% | Xuất sắc (100% cam kết) |
| **Tổng cộng** | **Nhóm 19 (PDF-Lingua)** | **2 Thành viên** | **280 Tasks** | **100%** | **817 SP** | **100%** | **Hoàn thành toàn diện đồ án** |

### 🌟 Đánh giá chi tiết đóng góp kỹ thuật
- **Nguyễn Lê Huy Tâm (Trưởng nhóm)**:
  - Làm chủ toàn bộ kiến trúc Backend FastAPI, thiết kế cơ sở dữ liệu SQLite WAL, mô hình Pydantic và xử lý bảo mật đa tầng.
  - Xây dựng động cơ trích xuất PDF PyMuPDF, tối ưu hóa thứ tự đọc tự nhiên và tích hợp Tesseract OCR.
  - Phát triển toàn diện động cơ dịch thuật đa ngôn ngữ (Google Translate / MyMemory fallback) và thuật toán chia đoạn.
  - Thiết kế và triển khai 2 tính năng AI chủ đạo: Tóm tắt tài liệu Map-Reduce và Trợ lý RAG QA Chatbot.
  - Xây dựng hệ thống quản trị Admin, phân quyền RBAC, gói dịch vụ Free/Pro, tích hợp thanh toán VietQR và Webhook SePay.
  - Thiết lập hạ tầng triển khai Vercel, Render/Cloud, cấu hình GitHub Actions CI/CD và biên soạn hệ thống tài liệu kỹ thuật.

- **Huỳnh Đình Chấn (Thành viên)**:
  - Thiết kế và phát triển toàn bộ giao diện người dùng UI/UX hiện đại theo chuẩn Vanilla JS SPA và thiết kế không phụ thuộc framework cồng kềnh.
  - Hiện thực hệ thống xác thực người dùng (Đăng ký, Đăng nhập, JWT, Quản lý phiên, Đổi mật khẩu).
  - Xây dựng module tiền xử lý ảnh OCR nâng cao (khử nghiêng ảnh deskew, tự động xoay trang, lọc trang trắng blank page).
  - Thiết kế và triển khai bộ công cụ benchmark hiệu năng, tối ưu hóa bộ nhớ RAM và kiểm thử chất lượng trích xuất tiếng Việt.
  - Xây dựng các tính năng mở rộng: xử lý tệp theo lô (Batch Processing), xuất DOCX, xem trước PDF inline, chọn trang cụ thể.
  - Biên soạn tài liệu phân tích thiết kế: Lược đồ Use Case, Lược đồ Hoạt động và Lược đồ Lớp hệ thống.
