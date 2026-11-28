# PDF-Lingua - Kế Hoạch 8 Sprint Phát Triển (Full Sprint Plan)

- **Dự án**: **PDF Lingua** - Ứng dụng web trích xuất văn bản từ tài liệu PDF, dịch thuật đa ngôn ngữ, tích hợp AI tóm tắt và trợ lý hỏi đáp tài liệu thông minh.
- **Thành viên nhóm**:
  1. `056206011188` - **Nguyễn Lê Huy Tâm** (Trưởng nhóm: Backend, Kiến trúc hệ thống, Dịch thuật, AI Engine, Admin, Triển khai)
  2. `077206002307` - **Huỳnh Đình Chấn** (Thành viên: Frontend UI/UX, Xác thực & Phân quyền, OCR Nâng cao, Benchmark & Security)
- **Jira Project Key**: `PDFL`
- **Jira Board & Summary**: [https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary](https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary)
- **Tài liệu tham chiếu**:
  - Product Backlog chi tiết: [PDF_Lingua_Jira_Backlog.md](./PDF_Lingua_Jira_Backlog.md)
  - Bảng phân công nhiệm vụ chi tiết: [Assignment.md](./Assignment.md)
- **Thời gian thực hiện toàn dự án**: `13/10/2026 - 30/11/2026` (8 Sprint liên tục)
- **Ngày cập nhật lần cuối**: `28/11/2026` (Đồng bộ hóa 100% Sprint 1 đến Sprint 8 theo Jira Cloud và mã nguồn dự án)
- **Tiến độ tổng quan**:
  - **Sprint 1, 2, 3, 4, 5, 6, 8**: Đã hoàn thành 100% trọn vẹn (Kiến trúc, Auth, PDF/OCR, Dịch thuật, Xuất file, Lịch sử, Admin, Gói Free/Pro, AI RAG, Avatar, Billing, CI/CD, Test Suite 36 files và Cấu hình máy chủ).
  - **Sprint 7**: Hoàn thành 20/31 work items (67/95 SP Done), 7 items đang triển khai (20 SP In Progress) và 4 items kế hoạch mở rộng (8 SP To Do) phục vụ nghiệm thu và bảo vệ đồ án.

---

## 📌 Chiến Lược Phân Bổ 8 Sprint (Roadmap Strategy)

Hệ thống được phát triển theo mô hình Scrum/Agile với chu kỳ **1 tuần / 1 Sprint** trong tổng thời gian 8 tuần (13/10/2026 - 30/11/2026):

1. **Sprint 1 (13/10/2026 - 20/10/2026) - Phân Tích Yêu Cầu, Thiết Kế Hệ Thống & Khởi Tạo Khung Dự Án**:
   - **Ngày hoàn thành thực tế**: `20/10/2026`.
   - **Khối lượng công việc**: 34 work items (34/34 Done) - Tổng `101` Story Points.
   - **Nội dung trọng tâm**: Khảo sát nghiệp vụ, phân tích thiết kế (Use Case, Activity, ERD, Kiến trúc hệ thống), khởi tạo repository GitHub, khung mã nguồn Frontend/Backend, quy chuẩn Git, cơ sở dữ liệu SQLite WAL, CORS, logging và health check.
2. **Sprint 2 (20/10/2026 - 27/10/2026) - Hệ Thống Tài Khoản, Xác Thực & Cốt Lõi Xử Lý PDF/OCR**:
   - **Ngày hoàn thành thực tế**: `27/10/2026`.
   - **Khối lượng công việc**: 32 work items (32/32 Done) - Tổng `95` Story Points.
   - **Nội dung trọng tâm**: Xây dựng User schema, mã hóa mật khẩu bcrypt, phiên JWT, giao diện Workspace, kiểm tra file PDF (magic bytes), giới hạn 20MB/100MB, trích xuất văn bản PyMuPDF/pdfplumber, nhận dạng scan OCR Tesseract tiếng Việt/Anh.
3. **Sprint 3 (27/10/2026 - 03/11/2026) - Quản Lý Tài Liệu, OCR Nâng Cao, Dịch Thuật Cốt Lõi, Xuất File & Đo Lường**:
   - **Ngày hoàn thành thực tế**: `03/11/2026`.
   - **Khối lượng công việc**: 38 work items (38/38 Done) - Tổng `109` Story Points.
   - **Nội dung trọng tâm**: Quản lý kho file cá nhân, tiền xử lý hình ảnh OCR (khử nghiêng, xoay trang, phát hiện trang trắng), động cơ dịch thuật deep-translator (Google/MyMemory fallback), chia đoạn chống nghẽn, xuất TXT/PDF Unicode, kéo thả file, điều khoản dịch vụ và benchmark đo lường.
4. **Sprint 4 (03/11/2026 - 10/11/2026) - Dịch Thuật Fallback, Xuất File, Lịch Sử Xử Lý, Quản Trị Admin Cơ Bản & Quyền Lợi Gói**:
   - **Ngày hoàn thành thực tế**: `10/11/2026`.
   - **Khối lượng công việc**: 31 work items (31/31 Done) - Tổng `90` Story Points.
   - **Nội dung trọng tâm**: Xử lý lỗi dịch thuật đa tầng, kiểm thử file xuất, thiết kế bảng dữ liệu lịch sử xử lý, API lưu/mở lại/xóa lịch sử, quyền lợi gói Free vs Pro, Dashboard quản trị Admin cơ bản (khóa/mở tài khoản, phân quyền), ma trận bảo mật và giới hạn upload.
5. **Sprint 5 (10/11/2026 - 17/11/2026) - Lịch Sử Pro, Quản Trị Admin Nâng Cao, Hạn Mức Free/Pro, Mở Rộng, Thiết Kế Đồ Án, Avatar & Billing**:
   - **Ngày hoàn thành thực tế**: `17/11/2026`.
   - **Khối lượng công việc**: 41 work items (41/41 Done) - Tổng `111` Story Points.
   - **Nội dung trọng tâm**: Lịch sử Pro, Admin Console nâng cao (tìm kiếm, lọc, thống kê, audit log), Batch ZIP, xuất DOCX, xem trước PDF inline, chọn trang cụ thể, nộp hồ sơ thiết kế đồ án (Kiến trúc, Use Case, Class Diagram), tính năng Avatar người dùng, Lịch sử hóa đơn thanh toán và quản lý hạn mức gói.
6. **Sprint 6 (17/11/2026 - 24/11/2026) - Tích Hợp AI: Tóm Tắt Văn Bản & Trợ Lý Hỏi Đáp Tài Liệu, Tính Năng Mở Rộng & Triển Khai**:
   - **Ngày hoàn thành thực tế**: `24/11/2026`.
   - **Khối lượng công việc**: 37 work items (37/37 Done) - Tổng `114` Story Points.
   - **Nội dung trọng tâm**: Tích hợp LLM API an toàn qua biến môi trường, AI Tóm tắt văn bản (Map-Reduce cho tài liệu dài), Trợ lý AI hỏi đáp tài liệu theo ngữ cảnh (RAG QA Chatbot), anti-hallucination guardrails, giao diện chatbox, kiểm thử responsive, lưu bản dịch theo trang, thanh toán Pro, tiếng Anh đa ngôn ngữ, Welcome Dashboard và CI/CD workflow.
7. **Sprint 7 (22/11/2026 - 29/11/2026) - Nghiệm Thu Triển Khai Website, Theo Dõi Khách Truy Cập (Admin Visitors), Báo Cáo Đồ Án & Vá Lỗi**:
   - **Ngày hoàn thành thực tế**: `28/11/2026`.
   - **Khối lượng công việc**: 31 work items (20/31 Done) - Tổng `95` Story Points.
   - **Nội dung trọng tâm**: Triển khai website chính thức, hoàn thiện báo cáo phân tích thiết kế, theo dõi khách truy cập (Visitors & Transition) trong Admin console, mở rộng chiến lược doanh thu quảng cáo/gói cước, vá các lỗi bảo mật quan trọng (JWT secret key fallback, Webhook verification, Admin transaction rejection, Bulk-adding translation).
8. **Sprint 8 (23/11/2026 - 30/11/2026) - Kiểm Thử Toàn Diện (Unit, Integration, Security Matrix, Benchmark) & Cấu Hình An Toàn Môi Trường Triển Khai**:
   - **Ngày hoàn thành thực tế**: `28/11/2026`.
   - **Khối lượng công việc**: 35 work items (35/35 Done) - Tổng `99` Story Points.
   - **Nội dung trọng tâm**: Hoàn thành bộ test suite tự động 36 files kiểm thử chuyên sâu: Unit test Services, API test, OCR/Deskew/Orientation test, Tiếng Việt có dấu, tài liệu dài, tải file lớn, benchmark hiệu năng, giải phóng bộ nhớ, và cấu hình an toàn production (SQLite WAL, CORS, HTTPS, OCR server, Storage).

---

## 🗺️ Ma Trận Tổng Quan 8 Sprint (Sprint Matrix)

| Sprint | Thời gian kế hoạch | Ngày hoàn thành thực tế | Mục tiêu trọng tâm | Epics phụ trách chính | Số lượng Work Items | Story Points | Trạng thái |
| :---: | :---: | :---: | :--- | :--- | :---: | :---: | :---: |
| **Sprint 1** | 13/10/2026 - 20/10/2026 | **20/10/2026** | Phân Tích Yêu Cầu, Thiết Kế Hệ Thống & Khởi Tạo Khung Dự Án | **EPIC 01, EPIC 02, EPIC 03, EPIC 04** | 34 tasks | **101 SP** | ✅ Đã hoàn thành (100% Done) |
| **Sprint 2** | 20/10/2026 - 27/10/2026 | **27/10/2026** | Hệ Thống Tài Khoản, Xác Thực & Cốt Lõi Xử Lý PDF/OCR | **EPIC 03, EPIC 04, EPIC 05, EPIC 06, EPIC 07** | 32 tasks | **95 SP** | ✅ Đã hoàn thành (100% Done) |
| **Sprint 3** | 27/10/2026 - 03/11/2026 | **03/11/2026** | Quản Lý Tài Liệu, OCR Nâng Cao, Dịch Thuật Cốt Lõi, Xuất File & Đo Lường | **EPIC 03, EPIC 05, EPIC 06, EPIC 07, EPIC 08, EPIC 11, EPIC 17** | 38 tasks | **109 SP** | ✅ Đã hoàn thành (100% Done) |
| **Sprint 4** | 03/11/2026 - 10/11/2026 | **10/11/2026** | Dịch Thuật Fallback, Xuất File, Lịch Sử Xử Lý, Quản Trị Admin Cơ Bản & Quyền Lợi Gói | **EPIC 08, EPIC 11, EPIC 12, EPIC 13, EPIC 14, EPIC 15, EPIC 16** | 31 tasks | **90 SP** | ✅ Đã hoàn thành (100% Done) |
| **Sprint 5** | 10/11/2026 - 17/11/2026 | **17/11/2026** | Lịch Sử Pro, Quản Trị Admin Nâng Cao, Hạn Mức Free/Pro, Mở Rộng, Thiết Kế Đồ Án, Avatar & Billing | **EPIC 03, EPIC 04, EPIC 12, EPIC 13, EPIC 14, EPIC 16, EPIC 17** | 41 tasks | **111 SP** | ✅ Đã hoàn thành (100% Done) |
| **Sprint 6** | 17/11/2026 - 24/11/2026 | **24/11/2026** | Tích Hợp AI: Tóm Tắt Văn Bản & Trợ Lý Hỏi Đáp Tài Liệu, Tính Năng Mở Rộng & Triển Khai | **EPIC 03, EPIC 09, EPIC 10, EPIC 11, EPIC 15, EPIC 16** | 37 tasks | **114 SP** | ✅ Đã hoàn thành (100% Done) |
| **Sprint 7** | 22/11/2026 - 29/11/2026 | **28/11/2026** | Nghiệm Thu Triển Khai Website, Theo Dõi Khách Truy Cập (Admin Visitors), Báo Cáo Đồ Án & Vá Lỗi | **EPIC 13, EPIC 14, EPIC 15, EPIC 16, EPIC 17, EPIC 18** | 31 tasks | **95 SP** | 📋 Nghiệm thu đồ án (20 Done / 7 In Progress / 4 To Do) |
| **Sprint 8** | 23/11/2026 - 30/11/2026 | **28/11/2026** | Kiểm Thử Toàn Diện (Unit, Integration, Security Matrix, Benchmark) & Cấu Hình An Toàn Môi Trường Triển Khai | **EPIC 15, EPIC 16** | 35 tasks | **99 SP** | ✅ Đã hoàn thành (35/35 Done - 100%) |

---

## 🏃 CHI TIẾT KẾ HOẠCH TỪNG SPRINT (SPRINT 1 ĐẾN SPRINT 8)

### 🔹 Sprint 1: Phân Tích Yêu Cầu, Thiết Kế Hệ Thống & Khởi Tạo Khung Dự Án
- **Thời gian kế hoạch**: 13/10/2026 - 20/10/2026
- **Ngày hoàn thành thực tế**: `20/10/2026`
- **Mục tiêu**: Khảo sát nghiệp vụ, phân tích thiết kế (Use Case, Activity, ERD, Kiến trúc hệ thống), khởi tạo repository GitHub, khung mã nguồn Frontend/Backend, quy chuẩn Git, cơ sở dữ liệu SQLite WAL, CORS, logging và health check.
- **Khối lượng công việc**: `34 Work Items` | `101 Story Points` | **34/34 Hoàn thành**
- **Trạng thái Jira**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Story Points | Mức độ ưu tiên | Người thực hiện | Ngày hoàn thành | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| `PDFL-1` | Xác định các đối tượng sử dụng hệ thống: khách chưa đăng nhập, tài khoản Free, tài khoản Pro và Admin. | EPIC 01 | 2 | High | Nguyễn Lê Huy Tâm | 20/10/2026 | **Done** |
| `PDFL-2` | Chốt danh sách chức năng chính và chức năng mở rộng. | EPIC 01 | 5 | High | Huỳnh Đình Chấn | 27/10/2026 | **Done** |
| `PDFL-3` | Xác định quyền lợi, giới hạn và điểm khác nhau giữa gói Free và Pro. | EPIC 01 | 2 | High | Nguyễn Lê Huy Tâm | 20/10/2026 | **Done** |
| `PDFL-4` | Xác định quy trình xử lý tài liệu từ lúc tải PDF lên đến khi xuất kết quả. | EPIC 01 | 3 | High | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-21` | Xây dựng Use Case Diagram. | EPIC 01 | 3 | Medium | Huỳnh Đình Chấn | 27/10/2026 | **Done** |
| `PDFL-22` | Xây dựng sơ đồ hoạt động cho các luồng quan trọng như trích xuất, dịch thuật, AI và nâng cấp gói. | EPIC 01 | 3 | High | Huỳnh Đình Chấn | 27/10/2026 | **Done** |
| `PDFL-23` | Thiết kế kiến trúc tổng thể: Frontend, Backend, database, dịch vụ OCR và dịch vụ AI. | EPIC 01 | 3 | High | Nguyễn Lê Huy Tâm | 21/10/2026 | **Done** |
| `PDFL-24` | Thiết kế ERD và mô hình dữ liệu. | EPIC 01 | 5 | Medium | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-25` | Thống nhất cấu trúc API giữa Frontend và Backend. | EPIC 01 | 3 | High | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-26` | Xác định các yêu cầu phi chức năng: hiệu năng, bảo mật, khả năng mở rộng và trải nghiệm người dùng. | EPIC 01 | 3 | Highest | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-27` | Tạo repository GitHub | EPIC 02 | 1 | Highest | Nguyễn Lê Huy Tâm | 20/10/2026 | **Done** |
| `PDFL-28` | Xây dựng cấu trúc thư mục Frontend và Backend. | EPIC 02 | 2 | High | Nguyễn Lê Huy Tâm | 20/10/2026 | **Done** |
| `PDFL-29` | Khởi tạo ứng dụng Frontend bằng HTML, CSS và JavaScript. | EPIC 02 | 2 | High | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-30` | Khởi tạo Backend bằng Python và FastAPI. | EPIC 02 | 3 | High | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-31` | Cấu hình môi trường Python và requirements.txt hoặc pyproject.toml | EPIC 02 | 3 | High | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-32` | Cấu hình các biến môi trường trong .env. | EPIC 02 | 3 | High | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-33` | Tạo .env.example và cấu hình .gitignore và gitattributes | EPIC 02 | 3 | Medium | Nguyễn Lê Huy Tâm | 20/10/2026 | **Done** |
| `PDFL-34` | Cấu hình kết nối database. | EPIC 02 | 3 | High | Nguyễn Lê Huy Tâm | 20/10/2026 | **Done** |
| `PDFL-35` | Thiết lập quy tắc đặt tên branch, commit và Pull Request. | EPIC 02 | 2 | Highest | Nguyễn Lê Huy Tâm | 20/10/2026 | **Done** |
| `PDFL-36` | Xây dựng API kiểm tra tình trạng hoạt động của Backend. | EPIC 02 | 3 | Medium | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-37` | Cấu hình môi trường phát triển để Frontend giao tiếp với Backend. | EPIC 02 | 3 | High | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-38` | Kiểm tra khởi chạy toàn bộ dự án trên máy phát triển. | EPIC 02 | 5 | High | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-39` | Xác định phong cách thiết kế, màu sắc, font chữ và bộ quy chuẩn giao diện. | EPIC 03 | 3 | Medium | Nguyễn Lê Huy Tâm | 22/10/2026 | **Done** |
| `PDFL-40` | Thiết kế thanh điều hướng và bố cục chung của ứng dụng. | EPIC 03 | 3 | Medium | Nguyễn Lê Huy Tâm | 24/10/2026 | **Done** |
| `PDFL-41` | Xây dựng trang chủ giới thiệu PDF Lingua và các tính năng. | EPIC 03 | 3 | Medium | Nguyễn Lê Huy Tâm | 24/10/2026 | **Done** |
| `PDFL-58` | Đảm bảo giao diện responsive trên máy tính, máy tính bảng và điện thoại. | EPIC 03 | 3 | Medium | Nguyễn Lê Huy Tâm | 24/10/2026 | **Done** |
| `PDFL-60` | Thiết kế cấu trúc module Backend theo từng nhóm chức năng. | EPIC 04 | 3 | Medium | Nguyễn Lê Huy Tâm | 23/10/2026 | **Done** |
| `PDFL-61` |  Xây dựng các lớp xử lý nghiệp vụ, truy cập dữ liệu và giao tiếp API. | EPIC 04 | 3 | Medium | Nguyễn Lê Huy Tâm | 23/10/2026 | **Done** |
| `PDFL-62` | Chuẩn hóa cấu trúc request và response của API. | EPIC 04 | 3 | Medium | Nguyễn Lê Huy Tâm | 24/10/2026 | **Done** |
| `PDFL-63` |  Xây dựng cơ chế xác thực request và xử lý lỗi chung. | EPIC 04 | 3 | High | Nguyễn Lê Huy Tâm | 24/10/2026 | **Done** |
| `PDFL-64` | Cấu hình CORS cho môi trường phát triển và triển khai. | EPIC 04 | 3 | High | Nguyễn Lê Huy Tâm | 23/10/2026 | **Done** |
| `PDFL-68` | Chuẩn hóa HTTP status code và thông báo lỗi. | EPIC 04 | 3 | High | Nguyễn Lê Huy Tâm | 24/10/2026 | **Done** |
| `PDFL-69` |  Xây dựng tài liệu API bằng OpenAPI/Swagger của FastAPI. | EPIC 04 | 3 | High | Nguyễn Lê Huy Tâm | 23/10/2026 | **Done** |
| `PDFL-70` | Thiết lập logging để theo dõi lỗi và hoạt động xử lý. | EPIC 04 | 3 | High | Nguyễn Lê Huy Tâm | 24/10/2026 | **Done** |

### 🔹 Sprint 2: Hệ Thống Tài Khoản, Xác Thực & Cốt Lõi Xử Lý PDF/OCR
- **Thời gian kế hoạch**: 20/10/2026 - 27/10/2026
- **Ngày hoàn thành thực tế**: `27/10/2026`
- **Mục tiêu**: Xây dựng User schema, mã hóa mật khẩu bcrypt, phiên JWT, giao diện Workspace, kiểm tra file PDF (magic bytes), giới hạn 20MB/100MB, trích xuất văn bản PyMuPDF/pdfplumber, nhận dạng scan OCR Tesseract tiếng Việt/Anh.
- **Khối lượng công việc**: `32 Work Items` | `95 Story Points` | **32/32 Hoàn thành**
- **Trạng thái Jira**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Story Points | Mức độ ưu tiên | Người thực hiện | Ngày hoàn thành | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| `PDFL-45` | Xây dựng giao diện tải tài liệu PDF. | EPIC 03 | 3 | High | Nguyễn Lê Huy Tâm | 28/10/2026 | **Done** |
| `PDFL-46` | Xây dựng giao diện hiển thị tiến trình tải lên và xử lý tài liệu. | EPIC 03 | 3 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-47` | Xây dựng giao diện hiển thị văn bản sau khi trích xuất. | EPIC 03 | 3 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-57` | Thiết kế trạng thái loading, lỗi, thành công và giao diện khi chưa có dữ liệu. | EPIC 03 | 3 | High | Nguyễn Lê Huy Tâm | 28/10/2026 | **Done** |
| `PDFL-65` |  Xây dựng API lấy thông tin người dùng hiện tại. | EPIC 04 | 3 | High | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-66` |  Xây dựng API kiểm tra quyền sử dụng tính năng. | EPIC 04 | 3 | High | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-72` |  Thiết kế bảng dữ liệu tài khoản người dùng. | EPIC 05 | 3 | Highest | Huỳnh Đình Chấn | 26/10/2026 | **Done** |
| `PDFL-73` | Xây dựng chức năng đăng ký tài khoản. | EPIC 05 | 3 | Highest | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-74` | Kiểm tra email và thông tin đăng ký hợp lệ. | EPIC 05 | 3 | High | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-75` |  Mã hóa mật khẩu trước khi lưu vào database. | EPIC 05 | 3 | High | Huỳnh Đình Chấn | 29/10/2026 | **Done** |
| `PDFL-76` |  Xây dựng chức năng đăng nhập. | EPIC 05 | 3 | Highest | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-78` | Xây dựng chức năng đăng xuất. | EPIC 05 | 3 | Highest | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-79` |  Xây dựng chức năng xem và cập nhật thông tin tài khoản. | EPIC 05 | 3 | Highest | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-80` | Xây dựng chức năng đổi mật khẩu. | EPIC 05 | 3 | Highest | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-81` |  Kiểm soát quyền truy cập của khách, người dùng đã đăng nhập và Admin. | EPIC 05 | 3 | Highest | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-82` | Kiểm tra quyền truy cập khi người dùng gọi trực tiếp API, không chỉ ẩn chức năng trên giao diện. | EPIC 05 | 3 | Medium | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-83` | Xử lý trường hợp token hết hạn, tài khoản không tồn tại hoặc thông tin đăng nhập sai. | EPIC 05 | 3 | High | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-84` |  Kiểm tra khả năng truy cập và chỉnh sửa dữ liệu của người dùng khác. | EPIC 05 | 3 | Medium | Huỳnh Đình Chấn | 30/10/2026 | **Done** |
| `PDFL-85` |  Xây dựng API tải tài liệu PDF lên Backend. | EPIC 06 | 3 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-86` |  Kiểm tra loại file và nội dung file để hạn chế file giả mạo định dạng PDF. | EPIC 06 | 2 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-87` |  Áp dụng giới hạn dung lượng: Free tối đa 20 MB/tệp, Pro tối đa 100 MB/tệp. | EPIC 06 | 3 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-88` | Kiểm tra PDF bị hỏng, có mật khẩu hoặc không thể đọc. | EPIC 06 | 2 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-89` | Thiết lập giới hạn số trang được phép xử lý. | EPIC 06 | 2 | High | Nguyễn Lê Huy Tâm | 29/10/2026 | **Done** |
| `PDFL-99` |  Tích hợp thư viện PyMuPDF để đọc và trích xuất văn bản. | EPIC 07 | 3 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-100` | Trích xuất văn bản theo từng trang. | EPIC 07 | 3 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-101` | Xử lý xuống dòng, khoảng trắng và ký tự bất thường. | EPIC 07 | 2 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-102` | Giữ thứ tự văn bản hợp lý khi tài liệu có nhiều đoạn hoặc nhiều cột. | EPIC 07 | 2 | High | Nguyễn Lê Huy Tâm | 29/10/2026 | **Done** |
| `PDFL-103` | Phát hiện tài liệu có ít hoặc không có văn bản trích xuất được. | EPIC 07 | 3 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-104` | Tích hợp Tesseract OCR để nhận diện văn bản từ PDF scan | EPIC 07 | 5 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-105` | Cấu hình dữ liệu ngôn ngữ OCR cần hỗ trợ, ưu tiên tiếng Việt và tiếng Anh. | EPIC 07 | 5 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-106` | Kết hợp kết quả OCR với cơ chế trích xuất văn bản thông thường. | EPIC 07 | 3 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |
| `PDFL-107` | Xây dựng API trả về nội dung văn bản được trích xuất. | EPIC 07 | 3 | High | Nguyễn Lê Huy Tâm | 27/10/2026 | **Done** |

### 🔹 Sprint 3: Quản Lý Tài Liệu, OCR Nâng Cao, Dịch Thuật Cốt Lõi, Xuất File & Đo Lường
- **Thời gian kế hoạch**: 27/10/2026 - 03/11/2026
- **Ngày hoàn thành thực tế**: `03/11/2026`
- **Mục tiêu**: Quản lý kho file cá nhân, tiền xử lý hình ảnh OCR (khử nghiêng, xoay trang, phát hiện trang trắng), động cơ dịch thuật deep-translator (Google/MyMemory fallback), chia đoạn chống nghẽn, xuất TXT/PDF Unicode, kéo thả file, điều khoản dịch vụ và benchmark đo lường.
- **Khối lượng công việc**: `38 Work Items` | `109 Story Points` | **38/38 Hoàn thành**
- **Trạng thái Jira**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Story Points | Mức độ ưu tiên | Người thực hiện | Ngày hoàn thành | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| `PDFL-42` | Xây dựng trang đăng ký tài khoản. | EPIC 03 | 3 | Highest | Huỳnh Đình Chấn | 01/11/2026 | **Done** |
| `PDFL-43` | Xây dựng trang đăng nhập. | EPIC 03 | 3 | Highest | Huỳnh Đình Chấn | 01/11/2026 | **Done** |
| `PDFL-44` | Xây dựng trang thông tin tài khoản. | EPIC 03 | 3 | Highest | Huỳnh Đình Chấn | 01/11/2026 | **Done** |
| `PDFL-48` | Xây dựng giao diện chọn ngôn ngữ nguồn và ngôn ngữ đích. | EPIC 03 | 3 | High | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-49` |  Xây dựng giao diện hiển thị bản dịch. | EPIC 03 | 3 | High | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-52` | Xây dựng giao diện so sánh hoặc chuyển đổi giữa văn bản gốc và bản dịch. | EPIC 03 | 3 | High | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-59` | Kiểm tra tính nhất quán về thiết kế và khả năng sử dụng. | EPIC 03 | 3 | Highest | Huỳnh Đình Chấn | 07/11/2026 | **Done** |
| `PDFL-77` |  Xây dựng cơ chế quản lý phiên đăng nhập hoặc token. | EPIC 05 | 3 | Medium | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-90` |  Lưu trữ file trong thư mục hoặc dịch vụ lưu trữ được cấu hình. | EPIC 06 | 3 | Medium | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-91` |  Ghi nhận metadata của tài liệu như tên file, dung lượng, số trang, thời gian tải lên và chủ sở hữu. | EPIC 06 | 3 | Medium | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-92` | Hiển thị danh sách tài liệu của người dùng. | EPIC 06 | 3 | High | Huỳnh Đình Chấn | 07/11/2026 | **Done** |
| `PDFL-93` |  Xem thông tin chi tiết của một tài liệu. | EPIC 06 | 3 | High | Huỳnh Đình Chấn | 07/11/2026 | **Done** |
| `PDFL-94` |  Xây dựng chức năng xóa tài liệu. | EPIC 06 | 3 | High | Huỳnh Đình Chấn | 07/11/2026 | **Done** |
| `PDFL-95` |  Kiểm soát quyền tải xuống và truy cập file. | EPIC 06 | 3 | Highest | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-96` |  Xử lý lỗi khi tải file, mất kết nối hoặc quá giới hạn. | EPIC 06 | 3 | High | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-97` | Xóa các file tạm khi hoàn tất xử lý hoặc khi xảy ra lỗi. | EPIC 06 | 3 | High | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-98` | Đảm bảo tài liệu riêng tư không bị người dùng khác truy cập. | EPIC 06 | 3 | Highest | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-108` | Hiển thị kết quả trích xuất trên giao diện. | EPIC 07 | 3 | Medium | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-109` | Xử lý tài liệu có trang trống, trang bị xoay hoặc hình ảnh chất lượng thấp. | EPIC 07 | 2 | High | Huỳnh Đình Chấn | 04/11/2026 | **Done** |
| `PDFL-110` | Kiểm thử độ chính xác với PDF thông thường và PDF scan. | EPIC 07 | 2 | High | Huỳnh Đình Chấn | 04/11/2026 | **Done** |
| `PDFL-111` | Tối ưu thời gian xử lý đối với tài liệu nhiều trang. | EPIC 07 | 3 | High | Huỳnh Đình Chấn | 04/11/2026 | **Done** |
| `PDFL-112` | Trả thông báo rõ ràng khi không trích xuất được nội dung. | EPIC 07 | 3 | Medium | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-113` | Lựa chọn thư viện hoặc dịch vụ dịch thuật | EPIC 08 | 3 | Medium | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-114` | Xác định danh sách ngôn ngữ nguồn và ngôn ngữ đích được hỗ trợ. | EPIC 08 | 5 | Medium | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-115` | Xây dựng chức năng tự động nhận diện ngôn ngữ nguồn nếu dịch vụ hỗ trợ. | EPIC 08 | 5 | Medium | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-116` | Xây dựng giao diện chọn ngôn ngữ. | EPIC 08 | 3 | High | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-117` | Xây dựng API dịch văn bản. | EPIC 08 | 3 | Medium | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-118` | Chia văn bản dài thành các đoạn phù hợp với giới hạn của dịch vụ. | EPIC 08 | 5 | Highest | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-119` | Giữ thứ tự các đoạn khi ghép kết quả dịch. | EPIC 08 | 3 | Medium | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-121` | Hiển thị bản dịch kèm thông tin ngôn ngữ. | EPIC 08 | 1 | Medium | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-122` | Cho phép sao chép bản dịch. | EPIC 08 | 1 | Medium | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-151` | Xây dựng chức năng xuất văn bản thành file TXT. | EPIC 11 | 2 | High | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-152` | Xây dựng chức năng xuất nội dung thành file PDF. | EPIC 11 | 2 | High | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-153` | Xây dựng chức năng tải file kết quả về thiết bị người dùng. | EPIC 11 | 3 | High | Nguyễn Lê Huy Tâm | 01/11/2026 | **Done** |
| `PDFL-154` | Đặt tên file kết quả theo tài liệu, ngôn ngữ hoặc loại nội dung. | EPIC 11 | 1 | Medium | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-155` | Đảm bảo tiếng Việt và Unicode được hiển thị đúng trong file xuất. | EPIC 11 | 3 | High | Nguyễn Lê Huy Tâm | 02/11/2026 | **Done** |
| `PDFL-253` | Hỗ trợ kéo thả file vào giao diện. | EPIC 17 | 2 | Medium | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-267` | Điều khoản và bảo mật cho người dùng | EPIC 03 | 3 | Medium | Nguyễn Lê Huy Tâm | 29/10/2026 | **Done** |

### 🔹 Sprint 4: Dịch Thuật Fallback, Xuất File, Lịch Sử Xử Lý, Quản Trị Admin Cơ Bản & Quyền Lợi Gói
- **Thời gian kế hoạch**: 03/11/2026 - 10/11/2026
- **Ngày hoàn thành thực tế**: `10/11/2026`
- **Mục tiêu**: Xử lý lỗi dịch thuật đa tầng, kiểm thử file xuất, thiết kế bảng dữ liệu lịch sử xử lý, API lưu/mở lại/xóa lịch sử, quyền lợi gói Free vs Pro, Dashboard quản trị Admin cơ bản (khóa/mở tài khoản, phân quyền), ma trận bảo mật và giới hạn upload.
- **Khối lượng công việc**: `31 Work Items` | `90 Story Points` | **31/31 Hoàn thành**
- **Trạng thái Jira**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Story Points | Mức độ ưu tiên | Người thực hiện | Ngày hoàn thành | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| `PDFL-120` | Xử lý lỗi mạng, giới hạn API và lỗi dịch thuật. | EPIC 08 | 3 | High | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-123` | Kiểm thử các trường hợp dịch tiếng Việt, tiếng Anh và các ngôn ngữ được lựa chọn. | EPIC 08 | 3 | Medium | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-124` | Đánh giá khả năng giữ nguyên đoạn văn, danh sách và nội dung quan trọng khi dịch. | EPIC 08 | 3 | Medium | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-125` | Đảm bảo hệ thống không làm mất hoặc đảo thứ tự đoạn khi dịch tài liệu dài. | EPIC 08 | 3 | Medium | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-150` | Xác định các loại kết quả có thể xuất: văn bản gốc, bản dịch và bản tóm tắt. | EPIC 11 | 3 | Medium | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-156` | Xử lý trường hợp nội dung rỗng hoặc không có kết quả. | EPIC 11 | 3 | Highest | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-157` | Kiểm tra quyền tải xuống và quyền truy cập kết quả. | EPIC 11 | 3 | Medium | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-158` | Kiểm thử file xuất trên các trình đọc file thông dụng. | EPIC 11 | 3 | Medium | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-159` | Thiết kế bảng dữ liệu lưu lịch sử xử lý. | EPIC 12 | 3 | High | Huỳnh Đình Chấn | 10/11/2026 | **Done** |
| `PDFL-160` | Lưu thông tin tài liệu và loại thao tác đã thực hiện. | EPIC 12 | 3 | High | Huỳnh Đình Chấn | 10/11/2026 | **Done** |
| `PDFL-161` | Lưu kết quả trích xuất, dịch thuật hoặc tóm tắt theo phạm vi chức năng đã thống nhất. | EPIC 12 | 3 | High | Huỳnh Đình Chấn | 10/11/2026 | **Done** |
| `PDFL-162` | Xây dựng API lấy danh sách lịch sử. | EPIC 12 | 3 | High | Huỳnh Đình Chấn | 10/11/2026 | **Done** |
| `PDFL-163` | Xây dựng API xem chi tiết một bản ghi lịch sử. | EPIC 12 | 3 | High | Huỳnh Đình Chấn | 10/11/2026 | **Done** |
| `PDFL-164` | Hiển thị lịch sử trên giao diện | EPIC 12 | 3 | Medium | Huỳnh Đình Chấn | 10/11/2026 | **Done** |
| `PDFL-165` | Cho phép mở lại kết quả đã lưu. | EPIC 12 | 2 | Medium | Huỳnh Đình Chấn | 10/11/2026 | **Done** |
| `PDFL-166` | Cho phép xóa lịch sử theo chính sách lưu trữ. | EPIC 12 | 3 | Medium | Huỳnh Đình Chấn | 10/11/2026 | **Done** |
| `PDFL-172` | Xác định quyền lợi cụ thể của gói Free. | EPIC 13 | 2 | Highest | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-173` | Xác định quyền lợi cụ thể của gói Pro. | EPIC 13 | 2 | Highest | Nguyễn Lê Huy Tâm | 05/11/2026 | **Done** |
| `PDFL-176` | Giới hạn tải lên tối đa 20 MB/tệp đối với Free. | EPIC 13 | 3 | Medium | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-178` | Xác định và thực thi giới hạn số trang PDF cho từng gói. | EPIC 13 | 3 | Medium | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-185` | Kiểm thử việc áp dụng hạn mức ở Backend, kể cả khi người dùng gọi API trực tiếp. | EPIC 13 | 3 | Medium | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-186` | Xác định vai trò và quyền hạn của Admin. | EPIC 14 | 2 | High | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-188` | Xây dựng trang tổng quan quản trị. | EPIC 14 | 3 | Medium | Nguyễn Lê Huy Tâm | 04/11/2026 | **Done** |
| `PDFL-189` | Hiển thị danh sách tài khoản người dùng. | EPIC 14 | 3 | Medium | Nguyễn Lê Huy Tâm | 04/11/2026 | **Done** |
| `PDFL-194` | Khóa hoặc mở khóa tài khoản khi cần. | EPIC 14 | 3 | Medium | Nguyễn Lê Huy Tâm | 04/11/2026 | **Done** |
| `PDFL-197` | Xử lý thông báo xác nhận trước những thao tác có ảnh hưởng lớn. | EPIC 14 | 3 | Medium | Nguyễn Lê Huy Tâm | 04/11/2026 | **Done** |
| `PDFL-198` | Kiểm thử quyền Admin và đảm bảo tài khoản thường không thể truy cập chức năng quản trị. | EPIC 14 | 3 | Highest | Nguyễn Lê Huy Tâm | 04/11/2026 | **Done** |
| `PDFL-207` | Kiểm thử PDF văn bản thông thường. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-214` | Kiểm tra an toàn file tải lên và ngăn việc truy cập file ngoài phạm vi cho phép. | EPIC 15 | 5 | Medium | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-240` | Viết README giới thiệu PDF Lingua. | EPIC 16 | 2 | Medium | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |
| `PDFL-260` | Gửi thông báo về trạng thái xử lý tài liệu. | EPIC 17 | 3 | High | Nguyễn Lê Huy Tâm | 03/11/2026 | **Done** |

### 🔹 Sprint 5: Lịch Sử Pro, Quản Trị Admin Nâng Cao, Hạn Mức Free/Pro, Mở Rộng, Thiết Kế Đồ Án, Avatar & Billing
- **Thời gian kế hoạch**: 10/11/2026 - 17/11/2026
- **Ngày hoàn thành thực tế**: `17/11/2026`
- **Mục tiêu**: Lịch sử Pro, Admin Console nâng cao (tìm kiếm, lọc, thống kê, audit log), Batch ZIP, xuất DOCX, xem trước PDF inline, chọn trang cụ thể, nộp hồ sơ thiết kế đồ án (Kiến trúc, Use Case, Class Diagram), tính năng Avatar người dùng, Lịch sử hóa đơn thanh toán và quản lý hạn mức gói.
- **Khối lượng công việc**: `41 Work Items` | `111 Story Points` | **41/41 Hoàn thành**
- **Trạng thái Jira**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Story Points | Mức độ ưu tiên | Người thực hiện | Ngày hoàn thành | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| `PDFL-53` | Xây dựng giao diện lịch sử xử lý tài liệu. | EPIC 03 | 3 | High | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-54` | Xây dựng trang giới thiệu và so sánh gói Free/Pro. | EPIC 03 | 3 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-55` | Xây dựng giao diện nâng cấp gói Pro. | EPIC 03 | 3 | Highest | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-56` | Xây dựng giao diện quản trị Admin. | EPIC 03 | 3 | Highest | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-67` |  Xây dựng API kiểm tra giới hạn upload, AI và các hạn mức khác. | EPIC 04 | 3 | High | Nguyễn Lê Huy Tâm | 15/11/2026 | **Done** |
| `PDFL-71` | Xử lý các tác vụ mất nhiều thời gian mà không khóa toàn bộ ứng dụng. | EPIC 04 | 3 | High | Huỳnh Đình Chấn | 15/11/2026 | **Done** |
| `PDFL-167` | Chỉ cho phép tài khoản Pro sử dụng chức năng lịch sử nếu đây là quyền lợi đã chốt. | EPIC 12 | 2 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-168` | Kiểm soát quyền truy cập lịch sử theo tài khoản. | EPIC 12 | 3 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-169` | Xác định thời gian lưu trữ và cách xóa dữ liệu khi cần. | EPIC 12 | 2 | High | Huỳnh Đình Chấn | 15/11/2026 | **Done** |
| `PDFL-170` | Kiểm thử khả năng lưu, truy vấn, mở lại và xóa lịch sử. | EPIC 12 | 3 | Medium | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-171` | Thiết kế dữ liệu gói dịch vụ và trạng thái đăng ký của người dùng. | EPIC 13 | 3 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-174` | Hiển thị gói hiện tại của người dùng. | EPIC 13 | 2 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-175` | Xây dựng cơ chế kiểm tra gói dịch vụ ở Backend. | EPIC 13 | 3 | Highest | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-177` | Giới hạn tải lên tối đa 100 MB/tệp đối với Pro. | EPIC 13 | 2 | High | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-179` | Xác định hạn mức OCR, dịch thuật và AI theo gói. | EPIC 13 | 2 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-180` | Chặn hoặc thông báo khi người dùng vượt hạn mức. | EPIC 13 | 2 | High | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-181` | Xây dựng trang so sánh quyền lợi Free và Pro. | EPIC 13 | 2 | Highest | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-182` | Xây dựng luồng yêu cầu nâng cấp lên Pro. | EPIC 13 | 3 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-183` | Cập nhật quyền sử dụng khi tài khoản được nâng cấp hoặc hạ cấp. | EPIC 13 | 3 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-184` | Hiển thị thông báo nâng cấp khi người dùng truy cập tính năng dành cho Pro. | EPIC 13 | 2 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-187` | Thiết lập cách khởi tạo tài khoản Admin an toàn. | EPIC 14 | 3 | Highest | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-190` | Tìm kiếm và lọc tài khoản theo thông tin phù hợp. | EPIC 14 | 2 | Medium | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-191` | Xem thông tin và trạng thái tài khoản. | EPIC 14 | 2 | Medium | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-192` | Theo dõi trạng thái gói Free/Pro. | EPIC 14 | 2 | Medium | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-193` | Cấp, gia hạn, hạ cấp hoặc thu hồi quyền Pro theo quy định của hệ thống. | EPIC 14 | 3 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-195` | Kiểm soát quyền Admin ở Backend. | EPIC 14 | 3 | High | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-196` | Ghi nhận nhật ký các thao tác quản trị quan trọng. | EPIC 14 | 3 | Highest | Nguyễn Lê Huy Tâm | 11/11/2026 | **Done** |
| `PDFL-247` | Chuẩn bị dữ liệu PDF mẫu phục vụ demo. | EPIC 16 | 2 | Medium | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-252` | Cho phép xử lý nhiều file PDF theo lô. | EPIC 17 | 2 | High | Huỳnh Đình Chấn | 15/11/2026 | **Done** |
| `PDFL-254` | Cho phép người dùng Pro tải kết quả dưới định dạng DOCX | EPIC 17 | 3 | High | Huỳnh Đình Chấn | 15/11/2026 | **Done** |
| `PDFL-255` | Cho phép chọn các trang cụ thể cần trích xuất hoặc dịch. | EPIC 17 | 3 | High | Huỳnh Đình Chấn | 15/11/2026 | **Done** |
| `PDFL-256` | Hỗ trợ xem trước PDF và chuyển trang ngay trên ứng dụng. | EPIC 17 | 2 | High | Huỳnh Đình Chấn | 15/11/2026 | **Done** |
| `PDFL-262` | Bổ sung thống kê mức sử dụng dịch vụ. | EPIC 17 | 3 | High | Huỳnh Đình Chấn | 23/11/2026 | **Done** |
| `PDFL-269` | Kiến trúc hệ thống (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | 3 | Highest | Nguyễn Lê Huy Tâm | 15/11/2026 | **Done** |
| `PDFL-270` | Lược đồ usecase (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | 5 | Highest | Huỳnh Đình Chấn | 11/11/2026 | **Done** |
| `PDFL-271` | Lược đồ lớp (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | 3 | Highest | Huỳnh Đình Chấn | 14/11/2026 | **Done** |
| `PDFL-272` | Thiết kế tính năng tải lên ảnh đại diện cho người dùng | EPIC 17 | 3 | Medium | Huỳnh Đình Chấn | 17/11/2026 | **Done** |
| `PDFL-273` | Xây dựng giao diện tải lên, cắt ảnh và hiển thị avatar người dùng | EPIC 03 | 3 | Medium | Huỳnh Đình Chấn | 17/11/2026 | **Done** |
| `PDFL-274` | Xây dựng API lấy danh sách lịch sử giao dịch thanh toán của người dùng (Billing) | EPIC 13 | 3 | High | Huỳnh Đình Chấn | 23/11/2026 | **Done** |
| `PDFL-275` | Xây dựng giao diện xem Lịch sử giao dịch, hóa đơn và trạng thái thanh toán Pro (Billing) | EPIC 03 | 3 | High | Huỳnh Đình Chấn | 23/11/2026 | **Done** |
| `PDFL-276` | Xây dựng giao diện hiển thị mức độ sử dụng, trạng thái gói cho Pro | EPIC 03 | 3 | High | Huỳnh Đình Chấn | 23/11/2026 | **Done** |

### 🔹 Sprint 6: Tích Hợp AI: Tóm Tắt Văn Bản & Trợ Lý Hỏi Đáp Tài Liệu, Tính Năng Mở Rộng & Triển Khai
- **Thời gian kế hoạch**: 17/11/2026 - 24/11/2026
- **Ngày hoàn thành thực tế**: `24/11/2026`
- **Mục tiêu**: Tích hợp LLM API an toàn qua biến môi trường, AI Tóm tắt văn bản (Map-Reduce cho tài liệu dài), Trợ lý AI hỏi đáp tài liệu theo ngữ cảnh (RAG QA Chatbot), anti-hallucination guardrails, giao diện chatbox, kiểm thử responsive, lưu bản dịch theo trang, thanh toán Pro, tiếng Anh đa ngôn ngữ, Welcome Dashboard và CI/CD workflow.
- **Khối lượng công việc**: `37 Work Items` | `114 Story Points` | **37/37 Hoàn thành**
- **Trạng thái Jira**: ✅ Đã hoàn thành (100% Done)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Story Points | Mức độ ưu tiên | Người thực hiện | Ngày hoàn thành | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| `PDFL-50` | Xây dựng giao diện tóm tắt văn bản bằng AI. | EPIC 03 | 3 | Highest | Nguyễn Lê Huy Tâm | 12/11/2026 | **Done** |
| `PDFL-51` | Xây dựng giao diện trò chuyện với trợ lý AI. | EPIC 03 | 3 | Highest | Nguyễn Lê Huy Tâm | 12/11/2026 | **Done** |
| `PDFL-126` | Lựa chọn mô hình AI hoặc dịch vụ API phù hợp. | EPIC 09 | 3 | Highest | Nguyễn Lê Huy Tâm | 12/11/2026 | **Done** |
| `PDFL-127` | Quản lý API key thông qua biến môi trường. | EPIC 09 | 3 | High | Nguyễn Lê Huy Tâm | 12/11/2026 | **Done** |
| `PDFL-128` | Xây dựng cấu trúc prompt tóm tắt văn bản. | EPIC 09 | 3 | High | Nguyễn Lê Huy Tâm | 14/11/2026 | **Done** |
| `PDFL-129` | Xây dựng API tóm tắt nội dung tài liệu. | EPIC 09 | 3 | High | Nguyễn Lê Huy Tâm | 14/11/2026 | **Done** |
| `PDFL-130` | Hỗ trợ lựa chọn độ dài hoặc kiểu tóm tắt nếu mô hình cho phép. | EPIC 09 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-131` | Hỗ trợ tóm tắt văn bản dài bằng cách chia đoạn hoặc tóm tắt nhiều bước. | EPIC 09 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-132` | Hiển thị nội dung tóm tắt trên giao diện. | EPIC 09 | 3 | High | Nguyễn Lê Huy Tâm | 14/11/2026 | **Done** |
| `PDFL-133` | Cho phép sao chép kết quả tóm tắt. | EPIC 09 | 2 | Medium | Nguyễn Lê Huy Tâm | 12/11/2026 | **Done** |
| `PDFL-134` | Kiểm tra quyền sử dụng AI của tài khoản Pro. | EPIC 09 | 2 | Medium | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-135` | Kiểm soát số lượt sử dụng, lượng văn bản đầu vào và chi phí. | EPIC 09 | 2 | Highest | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-136` | Xử lý lỗi khi dịch vụ AI không phản hồi hoặc vượt giới hạn. | EPIC 09 | 2 | Highest | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-137` | Kiểm thử chất lượng tóm tắt trên các loại tài liệu khác nhau. | EPIC 09 | 3 | Medium | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-138` | Xác định phạm vi câu hỏi mà trợ lý AI có thể xử lý. | EPIC 10 | 3 | Highest | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-139` | Xây dựng API gửi câu hỏi về tài liệu. | EPIC 10 | 3 | High | Nguyễn Lê Huy Tâm | 12/11/2026 | **Done** |
| `PDFL-140` | Cung cấp nội dung tài liệu liên quan làm ngữ cảnh cho AI. | EPIC 10 | 3 | High | Nguyễn Lê Huy Tâm | 14/11/2026 | **Done** |
| `PDFL-141` | Xử lý tài liệu dài bằng cách chọn các đoạn liên quan trước khi gửi cho AI. | EPIC 10 | 3 | High | Nguyễn Lê Huy Tâm | 14/11/2026 | **Done** |
| `PDFL-142` | Xây dựng giao diện khung chat. | EPIC 10 | 3 | Highest | Nguyễn Lê Huy Tâm | 12/11/2026 | **Done** |
| `PDFL-143` | Hiển thị câu hỏi và câu trả lời theo thứ tự hội thoại. | EPIC 10 | 3 | High | Nguyễn Lê Huy Tâm | 12/11/2026 | **Done** |
| `PDFL-144` | Xử lý trạng thái AI đang suy nghĩ, câu trả lời lỗi và yêu cầu thử lại. | EPIC 10 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-145` | Giới hạn số lượt hỏi đáp hoặc lượng nội dung theo gói dịch vụ. | EPIC 10 | 3 | Highest | Nguyễn Lê Huy Tâm | 12/11/2026 | **Done** |
| `PDFL-146` | Đảm bảo câu trả lời dựa trên nội dung tài liệu khi người dùng hỏi về tài liệu. | EPIC 10 | 3 | High | Nguyễn Lê Huy Tâm | 14/11/2026 | **Done** |
| `PDFL-147` | Xử lý trường hợp tài liệu không có thông tin để trả lời. | EPIC 10 | 3 | Medium | Nguyễn Lê Huy Tâm | 14/11/2026 | **Done** |
| `PDFL-148` | Kiểm soát quyền truy cập để người dùng không hỏi hoặc truy xuất tài liệu của người khác. | EPIC 10 | 3 | Highest | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-149` | Kiểm thử khả năng trả lời đúng nội dung, hạn chế bịa đặt và xử lý câu hỏi ngoài phạm vi. | EPIC 10 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-205` | Kiểm thử giao diện trên các kích thước màn hình khác nhau. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 25/11/2026 | **Done** |
| `PDFL-257` | Hỗ trợ lưu hoặc tải lại kết quả dịch theo từng trang. | EPIC 17 | 5 | Medium | Huỳnh Đình Chấn | 25/11/2026 | **Done** |
| `PDFL-259` | Tích hợp thanh toán trực tuyến cho gói Pro. | EPIC 17 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-261` | Cho phép người dùng gửi phản hồi hoặc báo cáo lỗi. | EPIC 17 | 3 | Medium | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-263` | Cải thiện khả năng truy xuất nguồn cho câu trả lời AI bằng cách tham chiếu trang hoặc đoạn văn liên quan. | EPIC 17 | 3 | High | Nguyễn Lê Huy Tâm | 17/11/2026 | **Done** |
| `PDFL-265` | Xem xét sử dụng hàng đợi tác vụ cho các file lớn và quy trình OCR/AI kéo dài. | EPIC 17 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-277` | Trang web hỗ trợ ngôn ngữ Tiếng Anh | EPIC 17 | 8 | Highest | Nguyễn Lê Huy Tâm | 22/11/2026 | **Done** |
| `PDFL-278` | Welcome Dashboard (Landing page khi người dùng mới ấn vào web) | EPIC 17 | 3 | High | Nguyễn Lê Huy Tâm | 19/11/2026 | **Done** |
| `PDFL-279` | Hướng dẫn sử dụng web | EPIC 16 | 3 | Highest | Nguyễn Lê Huy Tâm | 17/11/2026 | **Done** |
| `PDFL-280` | RBAC for UI/UX frontend and benefit update | EPIC 03 | 3 | High | Nguyễn Lê Huy Tâm | 20/11/2026 | **Done** |
| `PDFL-281` | Simple CI/CD Workflow | EPIC 15 | 3 | Medium | Nguyễn Lê Huy Tâm | 20/11/2026 | **Done** |

### 🔹 Sprint 7: Nghiệm Thu Triển Khai Website, Theo Dõi Khách Truy Cập (Admin Visitors), Báo Cáo Đồ Án & Vá Lỗi
- **Thời gian kế hoạch**: 22/11/2026 - 29/11/2026
- **Ngày hoàn thành thực tế**: `28/11/2026`
- **Mục tiêu**: Triển khai website chính thức, hoàn thiện báo cáo phân tích thiết kế, theo dõi khách truy cập (Visitors & Transition) trong Admin console, mở rộng chiến lược doanh thu quảng cáo/gói cước, vá các lỗi bảo mật quan trọng (JWT secret key fallback, Webhook verification, Admin transaction rejection, Bulk-adding translation).
- **Khối lượng công việc**: `31 Work Items` | `95 Story Points` | **20/31 Hoàn thành**
- **Trạng thái Jira**: 📋 Nghiệm thu đồ án (20 Done / 7 In Progress / 4 To Do)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Story Points | Mức độ ưu tiên | Người thực hiện | Ngày hoàn thành | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| `PDFL-199` | Xây dựng danh sách test case theo yêu cầu chức năng. | EPIC 15 | 5 | High | Huỳnh Đình Chấn | - | `In Progress` |
| `PDFL-218` | Giới hạn tần suất request phù hợp để giảm lạm dụng. | EPIC 15 | 3 | Highest | Huỳnh Đình Chấn | - | `In Progress` |
| `PDFL-222` | Hạn chế nội dung không đáng tin cậy trong tài liệu ảnh hưởng đến chỉ dẫn của trợ lý AI. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | 24/11/2026 | **Done** |
| `PDFL-228` | Chọn nền tảng triển khai Frontend. | EPIC 16 | 3 | Highest | Nguyễn Lê Huy Tâm | 24/11/2026 | **Done** |
| `PDFL-229` | Chọn nền tảng triển khai Backend Python. | EPIC 16 | 3 | Highest | Nguyễn Lê Huy Tâm | 24/11/2026 | **Done** |
| `PDFL-235` | Kiểm thử ứng dụng trên môi trường triển khai thực tế. | EPIC 16 | 5 | High | Nguyễn Lê Huy Tâm | 24/11/2026 | **Done** |
| `PDFL-238` | Xác định phương án sao lưu và phục hồi database. | EPIC 16 | 3 | Medium | Nguyễn Lê Huy Tâm | 25/11/2026 | **Done** |
| `PDFL-239` | Kiểm tra quy trình cập nhật phiên bản và khôi phục khi triển khai lỗi. | EPIC 16 | 3 | High | Nguyễn Lê Huy Tâm | 24/11/2026 | **Done** |
| `PDFL-246` | Cung cấp hình ảnh giao diện | EPIC 16 | 2 | High | Huỳnh Đình Chấn | - | `In Progress` |
| `PDFL-248` | Viết báo cáo phân tích, thiết kế, hiện thực | EPIC 16 | 3 | Highest | Nguyễn Lê Huy Tâm | 23/11/2026 | **Done** |
| `PDFL-249` | Chuẩn bị slide thuyết trình (Powerpoint) | EPIC 16 | 3 | Medium | Huỳnh Đình Chấn | - | To Do |
| `PDFL-250` | Chuẩn bị kịch bản demo các chức năng chính. | EPIC 16 | 3 | Medium | Nguyễn Lê Huy Tâm | 24/11/2026 | **Done** |
| `PDFL-251` | Kiểm tra README, tài liệu, repository và loại bỏ API key hoặc dữ liệu nhạy cảm trước khi bàn giao. | EPIC 16 | 3 | Highest | Nguyễn Lê Huy Tâm | 24/11/2026 | **Done** |
| `PDFL-264` | Hỗ trợ nhiều chủ đề giao diện hoặc chế độ tối. | EPIC 17 | 3 | Low | Huỳnh Đình Chấn | - | To Do |
| `PDFL-282` | Testing guests' features | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | 20/11/2026 | **Done** |
| `PDFL-283` | Testing free users' features | EPIC 15 | 3 | Highest | Huỳnh Đình Chấn | - | `In Progress` |
| `PDFL-284` | Testing pro users' features | EPIC 15 | 5 | Highest | Huỳnh Đình Chấn | - | `In Progress` |
| `PDFL-285` | Testing admin's features | EPIC 15 | 3 | Highest | Nguyễn Lê Huy Tâm | 26/11/2026 | **Done** |
| `PDFL-286` | Bulk-adding PDF files not translating after uploading successfully | EPIC 17 | 2 | Highest | Huỳnh Đình Chấn | 25/11/2026 | **Done** |
| `PDFL-287` | Viết báo cáo tổng kết đồ án (Words) | EPIC 16 | 3 | Medium | Nguyễn Lê Huy Tâm | 24/11/2026 | **Done** |
| `PDFL-288` | Triển khai trên website | EPIC 16 | 5 | Highest | Nguyễn Lê Huy Tâm | 24/11/2026 | **Done** |
| `PDFL-289` | Monetization strategy by using ads | EPIC 18 | 5 | Medium | Nguyễn Lê Huy Tâm | - | `In Progress` |
| `PDFL-291` | Add an extra paid plan (pricing plans) with better benefits | EPIC 18 | 2 | Medium | Huỳnh Đình Chấn | - | To Do |
| `PDFL-292` | Pro plan adjustment | EPIC 13 | 2 | Medium | Huỳnh Đình Chấn | - | To Do |
| `PDFL-293` | Allowing admin to track visitors and transition | EPIC 14 | 3 | Medium | Nguyễn Lê Huy Tâm | 26/11/2026 | **Done** |
| `PDFL-294` | Small tabs/frontend in Admin console for tracking visitors and transition | EPIC 03 | 3 | Medium | Nguyễn Lê Huy Tâm | 26/11/2026 | **Done** |
| `PDFL-295` | Enhancing bug reports from users | EPIC 17 | 3 | Medium | Nguyễn Lê Huy Tâm | - | `In Progress` |
| `PDFL-296` | Upgrade to Pro for free via the "/simulate" endpoint | EPIC 13 | 2 | Medium | Nguyễn Lê Huy Tâm | 27/11/2026 | **Done** |
| `PDFL-297` | Admin's rejection not working properly | EPIC 14 | 2 | Medium | Nguyễn Lê Huy Tâm | 27/11/2026 | **Done** |
| `PDFL-298` | The webhook accepts a "pending" status and skips the amount check | EPIC 13 | 2 | Medium | Nguyễn Lê Huy Tâm | 27/11/2026 | **Done** |
| `PDFL-299` | Fix secret key with a default fallback is exposed | EPIC 15 | 2 | Medium | Nguyễn Lê Huy Tâm | 27/11/2026 | **Done** |

### 🔹 Sprint 8: Kiểm Thử Toàn Diện (Unit, Integration, Security Matrix, Benchmark) & Cấu Hình An Toàn Môi Trường Triển Khai
- **Thời gian kế hoạch**: 23/11/2026 - 30/11/2026
- **Ngày hoàn thành thực tế**: `28/11/2026`
- **Mục tiêu**: Hoàn thành bộ test suite tự động 36 files kiểm thử chuyên sâu: Unit test Services, API test, OCR/Deskew/Orientation test, Tiếng Việt có dấu, tài liệu dài, tải file lớn, benchmark hiệu năng, giải phóng bộ nhớ, và cấu hình an toàn production (SQLite WAL, CORS, HTTPS, OCR server, Storage).
- **Khối lượng công việc**: `35 Work Items` | `99 Story Points` | **35/35 Hoàn thành**
- **Trạng thái Jira**: ✅ Đã hoàn thành (35/35 Done - 100%)

| Mã Task | Tên nhiệm vụ / User Story | Epic | Story Points | Mức độ ưu tiên | Người thực hiện | Ngày hoàn thành | Trạng thái Jira |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| `PDFL-200` | Viết unit test cho các hàm xử lý nghiệp vụ quan trọng. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-201` | Kiểm thử API upload, trích xuất, OCR, dịch thuật và AI. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-202` | Kiểm thử đăng ký, đăng nhập, phân quyền và gói Free/Pro. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-203` | Kiểm thử lịch sử, xuất file và chức năng Admin. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-204` | Kiểm thử tích hợp toàn bộ luồng từ tải PDF đến tải kết quả. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-206` | Kiểm thử các trường hợp lỗi và trường hợp biên. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-208` | Kiểm thử PDF scan. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-209` | Kiểm thử PDF tiếng Việt có dấu và tài liệu đa ngôn ngữ. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-210` | Kiểm thử PDF nhiều trang, nhiều cột hoặc bố cục phức tạp. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-211` | Kiểm thử PDF bị hỏng, có mật khẩu hoặc không thể đọc. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-212` | Kiểm thử file nhỏ, file sát giới hạn và file vượt giới hạn dung lượng. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-213` | Kiểm thử tài liệu dài khi dịch thuật, tóm tắt và hỏi đáp AI. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-215` | Đảm bảo mật khẩu không được lưu dưới dạng văn bản thuần. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-216` | Đảm bảo API key và thông tin nhạy cảm không bị đưa lên GitHub. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-217` | Kiểm tra xác thực và phân quyền trên các API riêng tư. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-219` | Kiểm soát dung lượng, số trang, bộ nhớ và thời gian xử lý PDF. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-220` | Ngăn tài liệu hoặc lịch sử của người dùng này bị truy cập bởi người dùng khác. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-221` | Xác định chính sách lưu trữ, xóa và bảo vệ dữ liệu người dùng. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-223` | Kiểm tra các lỗi phổ biến như SQL injection, XSS và truy cập trái phép. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-224` | Đánh giá thời gian trích xuất, OCR, dịch và xử lý AI. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-225` | Kiểm tra nhiều request đồng thời và giới hạn tài nguyên. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-226` | Tối ưu quy trình đọc, xử lý và lưu file lớn. | EPIC 15 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-227` | Thiết lập thông báo lỗi, logging và cách khôi phục khi xử lý thất bại. | EPIC 15 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-230` | Chọn nơi lưu trữ PDF và file kết quả. | EPIC 16 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-231` | Thiết lập database cho môi trường triển khai. | EPIC 16 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-232` | Cấu hình biến môi trường và API key trên môi trường production. | EPIC 16 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-233` | Cấu hình CORS, domain và HTTPS nếu nền tảng hỗ trợ. | EPIC 16 | 2 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-234` | Cài đặt các thành phần cần thiết cho OCR trên server. | EPIC 16 | 2 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-236` | Kiểm tra việc xử lý file lớn theo giới hạn đã công bố. | EPIC 16 | 3 | High | Huỳnh Đình Chấn | 16/11/2026 | **Done** |
| `PDFL-237` | Thiết lập kiểm tra tình trạng hoạt động và theo dõi lỗi. | EPIC 16 | 2 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-241` | Ghi rõ công nghệ sử dụng và yêu cầu cài đặt. | EPIC 16 | 2 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-242` | Hướng dẫn thiết lập môi trường chạy trên máy cá nhân. | EPIC 16 | 2 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-243` | Hướng dẫn cấu hình .env và các dịch vụ bên ngoài. | EPIC 16 | 2 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-244` | Mô tả cấu trúc thư mục và kiến trúc hệ thống. | EPIC 16 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |
| `PDFL-245` | Viết tài liệu API và ví dụ request/response. | EPIC 16 | 3 | High | Nguyễn Lê Huy Tâm | 16/11/2026 | **Done** |

---

## 📦 DANH SÁCH BACKLOG (PRODUCT BACKLOG & CÁC EPIC CHƯA GÁN SPRINT)

Các Epic tổng quan và công việc dự kiến mở rộng chưa xếp vào chu kỳ Sprint cố định:

| Mã Task | Tên nhiệm vụ / Epic | Phân loại | Story Points | Mức độ ưu tiên | Người thực hiện | Ngày tạo | Trạng thái |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| `PDFL-5` | EPIC 01: Phân tích yêu cầu và thiết kế hệ thống | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-6` | EPIC 02: Khởi tạo dự án và môi trường phát triển | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-7` | EPIC 03: Thiết kế giao diện Frontend | Epic | - | Medium | Chưa phân công | 20/10/2026 | `In Progress` |
| `PDFL-8` | EPIC 04: Backend API và kiến trúc xử lý | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-9` | EPIC 05: Tài khoản, xác thực và phân quyền | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-10` | EPIC 06: Tải lên và quản lý tài liệu PDF | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-11` | EPIC 07: Trích xuất văn bản và OCR | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-12` | EPIC 08: Dịch thuật đa ngôn ngữ | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-13` | EPIC 09: AI tóm tắt văn bản | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-14` | EPIC 10: Trợ lý AI hỏi đáp tài liệu | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-15` | EPIC 11: Xuất và tải kết quả | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-16` | EPIC 12: Lịch sử xử lý tài liệu | Epic | - | Medium | Chưa phân công | 20/10/2026 | **Done** |
| `PDFL-17` | EPIC 13: Gói Free/Pro và hạn mức sử dụng | Epic | - | Medium | Chưa phân công | 20/10/2026 | `In Progress` |
| `PDFL-18` | EPIC 14: Quản trị hệ thống Admin | Epic | - | Medium | Chưa phân công | 20/10/2026 | `In Progress` |
| `PDFL-19` | EPIC 15: Kiểm thử, bảo mật và tối ưu | Epic | - | Medium | Chưa phân công | 20/10/2026 | `In Progress` |
| `PDFL-20` | EPIC 16: Triển khai, tài liệu và bàn giao | Epic | - | Medium | Chưa phân công | 20/10/2026 | `In Progress` |
| `PDFL-258` | Bổ sung đặt lại mật khẩu qua email. | Task | 3 | Lowest | Chưa phân công | 21/10/2026 | To Do |
| `PDFL-266` | Tích hợp thư viện dịch thuật `deep-translator` | Task | 3 | Medium | Nguyễn Lê Huy Tâm | 21/10/2026 | **Done** |
| `PDFL-268` | EPIC 17: Tính năng mở rộng & Nâng cao trải nghiệm người dùng | Epic | - | Medium | Chưa phân công | 03/11/2026 | `In Progress` |
| `PDFL-290` | EPIC 18: Các hình thức quảng cáo cho người dùng và kiếm tiền | Epic | - | Medium | Chưa phân công | 25/11/2026 | `In Progress` |

---

## 📈 Quy Trình Vận Hành Sprint (Sprint Workflow) & Tiêu Chuẩn Hoàn Thành (DoD)

### 1. Quy trình Scrum chuẩn
1. **Sprint Planning (Đầu tuần)**: Rà soát danh sách task của Sprint trên Jira, chốt khối lượng công việc, Story Points và Assignee.
2. **Daily / Mid-week Sync (Giữa tuần)**: Trao đổi nhanh các khó khăn kỹ thuật (blockers), hỗ trợ giải quyết lỗi và tối ưu hiệu năng.
3. **Sprint Review & Code Review (Cuối tuần)**: Kiểm thử các chức năng đã hoàn thành, tạo Pull Request để thành viên còn lại review trước khi merge vào nhánh chính.
4. **Cập nhật Jira**: Đảm bảo tất cả các task đã hoàn thành được cập nhật trạng thái `Done`, ghi nhận Story Points và ngày hoàn thành thực tế.

### 2. Tiêu chuẩn hoàn thành (Definition of Done - DoD)
- [x] **Mã nguồn**: Code chạy đúng logic yêu cầu, tuân thủ quy chuẩn đặt tên biến/hàm, không có lỗi cú pháp hoặc log rác.
- [x] **Kiểm thử**: Đạt 100% các unit test / integration test liên quan; tự kiểm tra (manual test) các trường hợp bình thường và ngoại lệ.
- [x] **Bảo mật**: Tuyệt đối không hardcode mật khẩu, token bí mật hoặc API Key vào mã nguồn hoặc Git repository.
- [x] **Code Review**: Đã tạo Pull Request và được thành viên trong nhóm phê duyệt trước khi merge vào nhánh `main`.
- [x] **Đồng bộ Jira**: Chuyển trạng thái task tương ứng sang `Done` trên Jira Board.
