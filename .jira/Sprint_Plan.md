# PDF-Lingua - Kế Hoạch 7 Sprint Phát Triển (Full Sprint Plan)

- **Dự án**: **PDF Lingua** - Ứng dụng web trích xuất văn bản từ tài liệu PDF, dịch thuật đa ngôn ngữ, tích hợp AI tóm tắt và trợ lý hỏi đáp tài liệu thông minh.
- **Thành viên nhóm**:
  1. `056206011188` - **Nguyễn Lê Huy Tâm** (Trưởng nhóm)
  2. `077206002307` - **Huỳnh Đình Chấn** (Thành viên)
- **Jira Project Key**: `PDFL`
- **Jira Board & Summary**: [https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary](https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary)
- **Tài liệu tham chiếu**:
  - Product Backlog chi tiết: [PDF_Lingua_Jira_Backlog.md](./PDF_Lingua_Jira_Backlog.md)
  - Bảng phân công nhiệm vụ: [Assignment.md](./Assignment.md)
- **Ngày khởi tạo kế hoạch**: `15/10/2026` (Bắt đầu chu kỳ Sprint 1)
- **Ngày cập nhật lần cuối**: `11/11/2026` (Đồng bộ hóa 100% Sprint 4 theo Jira Board với 31 work items đã hoàn thành)
- **Tiến độ hiện tại**: Đã hoàn thành xuất sắc **Sprint 4 (07/11 - 13/11/2026)**: 31/31 tasks đã hoàn thành (Done). Đang chuẩn bị triển khai **Sprint 5 (14/11 - 20/11/2026)**.

---

## 📌 Chiến Lược Phân Bổ 7 Sprint (Roadmap Strategy)

Hệ thống được phát triển theo mô hình Scrum/Agile với chu kỳ **1 tuần / 1 Sprint** trong tổng thời gian 7 tuần (15/10/2026 - 03/12/2026):

1. **Sprint 1 & Sprint 2 (Tuần 1 & 2 - Nền Tảng, Xác Thực & Cốt Lõi Xử Lý PDF/OCR)**:
   - Phân tích yêu cầu, thiết kế kiến trúc hệ thống, cơ sở dữ liệu, giao diện tổng quan và khởi tạo khung dự án.
   - Xây dựng hệ thống tài khoản, mã hóa mật khẩu bcrypt, xác thực, phân quyền (Guest, User, Admin).
   - Tải lên tài liệu PDF (Free 20MB, Pro 100MB, tối đa 100 trang), kiểm tra an toàn tệp, trích xuất văn bản số (`pypdf`, `pdfplumber`) và nhận dạng chữ từ PDF scan thông qua OCR (`Tesseract`).
2. **Sprint 3 & Sprint 4 (Tuần 3 & 4 - Quản Lý File, OCR Nâng Cao, Dịch Thuật & Hoàn Thiện Gói Free)**:
   - Sprint 3 (31/10 - 06/11/2026): Tăng tốc hoàn thành 38 tasks gồm hoàn thiện UI Auth/Profile/Workspace, Quản lý tài liệu người dùng, Tối ưu OCR scan nâng cao, Tích hợp dịch thuật đa ngôn ngữ (Google GTX, fallback MyMemory), Chia đoạn văn bản chống timeout, Xuất file kết quả (.txt UTF-8 BOM, .pdf Unicode), Kéo thả file và Chính sách điều khoản.
   - Sprint 4 (07/11 - 13/11/2026): Tinh chỉnh xử lý lỗi mạng, giới hạn API và đa tầng fallback, kiểm thử toàn diện đa ngôn ngữ, kiểm thử định dạng xuất file và hoàn thiện trải nghiệm Gói Free trước khi bước sang giai đoạn AI Pro.
3. **Sprint 5 & Sprint 6 (Tuần 5 & 6 - AI Nâng Cao, Gói Pro, Admin & Đóng Gói Bàn Giao)**:
   - Tích hợp AI tóm tắt văn bản và Trợ lý AI hỏi đáp theo ngữ cảnh tài liệu (RAG/QA) dành riêng cho gói Pro.
   - Quản trị gói dịch vụ (Free 20MB vs Pro 100MB), lưu trữ lịch sử xử lý, Dashboard quản trị hệ thống Admin, kiểm thử toàn diện và đóng gói báo cáo đồ án.
4. **Sprint 7 (Tuần 7 - Tính Năng Mở Rộng & Buffer Dự Phòng)**:
   - 13 tính năng giá trị gia tăng mở rộng (`PDFL-252`, `PDFL-254` đến `PDFL-265`) nhằm tối ưu trải nghiệm người dùng (do `PDFL-253` đã hoàn thành ở Sprint 3).
   - Buffer dự phòng để hoàn thiện các công việc tồn đọng, sửa lỗi phát sinh và diễn tập kịch bản demo bảo vệ đồ án.

---

## 🗺️ Ma Trận Tổng Quan 7 Sprint (Sprint Matrix)

| Sprint | Thời gian dự kiến | Mục tiêu trọng tâm | Epics phụ trách chính | Số lượng Work Items | Trạng thái |
| :---: | :---: | :--- | :--- | :---: | :---: |
| **Sprint 1** | 15/10 - 22/10/2026 | Phân tích yêu cầu, thiết kế hệ thống & khởi tạo khung dự án | **EPIC 01, EPIC 02**, một phần EPIC 03 & 04 | 31 tasks | ✅ Đã hoàn thành (31/31 Done) |
| **Sprint 2** | 23/10 - 30/10/2026 | Hệ thống tài khoản, xác thực & Cốt lõi xử lý PDF, OCR | **EPIC 05, EPIC 06, EPIC 07**, EPIC 03 & 04 | 32 tasks | ✅ **Đã hoàn thành** (32/32 Done) |
| **Sprint 3** | 31/10 - 06/11/2026 | Quản lý tài liệu, OCR nâng cao, Dịch thuật cốt lõi, Xuất file & UI hoàn thiện | **EPIC 03, EPIC 05, EPIC 06, EPIC 07, EPIC 08, EPIC 11, EPIC 17** | 38 tasks | ✅ **Đã hoàn thành** (38/38 Done) |
| **Sprint 4** | 07/11 - 13/11/2026 | Dịch thuật fallback, xuất file, lịch sử, admin cơ bản & quyền lợi Free/Pro | **EPIC 08, EPIC 11, EPIC 12, EPIC 13, EPIC 14, EPIC 15, EPIC 16, EPIC 17** | 31 tasks | ✅ **Đã hoàn thành** (31/31 Done) |
| **Sprint 5** | 13/11 - 20/11/2026 | Lịch sử Pro, Quản trị Admin, Hạn mức gói Free/Pro, Mở rộng & Thiết kế | **EPIC 03, EPIC 04, EPIC 12, EPIC 13, EPIC 14, EPIC 16, EPIC 17** | 34 tasks | 🚀 **Đang triển khai** |
| **Sprint 6** | 21/11 - 28/11/2026 | AI tóm tắt văn bản & Trợ lý AI hỏi đáp tài liệu theo ngữ cảnh | **EPIC 03, EPIC 09, EPIC 10** | 26 tasks | 📋 Kế hoạch |
| **Sprint 7** | 28/11 - 04/12/2026 | Tính năng mở rộng nâng cao, tối ưu UX & Buffer dự phòng | **EPIC 17 (`PDFL-252` $\rightarrow$ `PDFL-265`)**, Demo Dry Run | 13 tasks | 📋 Kế hoạch |

---

## 🏃 CHI TIẾT KẾ HOẠCH TỪNG SPRINT (SPRINT 1 ĐẾN SPRINT 7)

### 🔹 Sprint 1: Phân Tích Yêu Cầu, Thiết Kế Hệ Thống & Khởi Tạo Khung Dự Án
- **Thời gian**: 15/10/2026 - 22/10/2026 (Tuần 1)
- **Mục tiêu**: Hoàn thành tài liệu phân tích thiết kế (Use Case, Activity Diagram, ERD, Kiến trúc hệ thống), khởi tạo repository GitHub, khung mã nguồn Frontend/Backend và quy chuẩn làm việc Git.
- **Trạng thái**: ✅ **Hoàn thành (Done)**

| Mã Task | Tên nhiệm vụ | Epic | Trạng thái |
| :--- | :--- | :---: | :---: |
| `PDFL-1` | Xác định đối tượng sử dụng: Khách, Free, Pro, Admin | EPIC 01 | Done |
| `PDFL-2` | Chốt danh sách chức năng chính và chức năng mở rộng | EPIC 01 | Done |
| `PDFL-3` | Xác định quyền lợi, giới hạn gói Free (20MB) và Pro (100MB) | EPIC 01 | Done |
| `PDFL-4` | Xác định quy trình xử lý tài liệu từ upload đến xuất kết quả | EPIC 01 | Done |
| `PDFL-21` | Xây dựng Use Case Diagram | EPIC 01 | Done |
| `PDFL-22` | Xây dựng sơ đồ hoạt động (Activity Diagram) các luồng chính | EPIC 01 | Done |
| `PDFL-23` | Thiết kế kiến trúc tổng thể (Frontend, Backend, Database, OCR, AI) | EPIC 01 | Done |
| `PDFL-24` | Thiết kế sơ đồ ERD và mô hình dữ liệu quan hệ | EPIC 01 | Done |
| `PDFL-25` | Thống nhất cấu trúc và quy chuẩn API giữa Frontend và Backend | EPIC 01 | Done |
| `PDFL-26` | Xác định yêu cầu phi chức năng (bảo mật, hiệu năng, UX) | EPIC 01 | Done |
| `PDFL-27` | Tạo repository GitHub `pdf-lingua` | EPIC 02 | Done |
| `PDFL-28` | Xây dựng cấu trúc thư mục Frontend và Backend | EPIC 02 | Done |
| `PDFL-29` | Khởi tạo ứng dụng Frontend bằng HTML, CSS và JavaScript | EPIC 02 | Done |
| `PDFL-30` | Khởi tạo Backend bằng Python và FastAPI | EPIC 02 | Done |
| `PDFL-31` | Cấu hình môi trường Python, `requirements.txt` và `venv` | EPIC 02 | Done |
| `PDFL-32` | Cấu hình các biến môi trường trong `.env` | EPIC 02 | Done |
| `PDFL-33` | Tạo `.env.example` và cấu hình `.gitignore`, `.gitattributes` | EPIC 02 | Done |
| `PDFL-34` | Cấu hình kết nối database (SQLite / PostgreSQL) | EPIC 02 | Done |
| `PDFL-35` | Thiết lập quy tắc đặt tên branch, commit và Pull Request | EPIC 02 | Done |
| `PDFL-36` | Xây dựng API kiểm tra tình trạng Backend (`/health`) | EPIC 02 | Done |
| `PDFL-37` | Cấu hình môi trường để Frontend gọi API Backend (CORS) | EPIC 02 | Done |
| `PDFL-38` | Kiểm tra khởi chạy toàn bộ dự án trên máy phát triển | EPIC 02 | Done |
| `PDFL-39` | Xác định phong cách thiết kế, màu sắc, typography giao diện | EPIC 03 | Done |
| `PDFL-40` | Thiết kế thanh điều hướng (Navbar) và bố cục chung | EPIC 03 | Done |
| `PDFL-41` | Xây dựng trang chủ giới thiệu PDF-Lingua và tính năng | EPIC 03 | Done |
| `PDFL-58` | Đảm bảo giao diện responsive trên máy tính và điện thoại | EPIC 03 | Done |
| `PDFL-60` | Thiết kế cấu trúc module Backend theo nhóm chức năng | EPIC 04 | Done |
| `PDFL-61` | Xây dựng các lớp xử lý nghiệp vụ (Service layer pattern) | EPIC 04 | Done |
| `PDFL-62` | Chuẩn hóa cấu trúc request và response của API | EPIC 04 | Done |
| `PDFL-63` | Xây dựng cơ chế xử lý lỗi chung (Global Exception Handler) | EPIC 04 | Done |
| `PDFL-64` | Cấu hình CORS an toàn cho phát triển và triển khai | EPIC 04 | Done |
| `PDFL-68` | Chuẩn hóa HTTP status code và thông báo lỗi rõ ràng | EPIC 04 | Done |
| `PDFL-69` | Xây dựng tài liệu API Swagger/OpenAPI tự động | EPIC 04 | Done |
| `PDFL-70` | Thiết lập logging để theo dõi hoạt động xử lý và lỗi | EPIC 04 | Done |

---

### 🔹 Sprint 2: Hệ Thống Tài Khoản, Xác Thực & Cốt Lõi Xử Lý PDF, OCR
- **Thời gian**: 23/10/2026 - 30/10/2026 (Tuần 2)
- **Mục tiêu**: Xây dựng toàn diện cơ chế tài khoản & bảo mật mật khẩu bcrypt, đồng thời tích hợp sớm toàn bộ luồng cốt lõi xử lý PDF (Upload, kiểm tra an toàn, giới hạn trang/dung lượng, trích xuất văn bản PyMuPDF/pdfplumber và nhận dạng OCR Tesseract kết hợp giao diện Workspace).
- **Trạng thái**: ✅ **Đã hoàn thành 100% (Completed)**: **32 Work Items** (32 Done / 0 In Progress / 0 To Do)

| Mã Task | Tên nhiệm vụ | Epic | Trạng thái Jira |
| :--- | :--- | :---: | :---: |
| `PDFL-65` | Xây dựng API lấy thông tin người dùng hiện tại (`/api/auth/me`) | EPIC 04 | **Done** |
| `PDFL-66` | Xây dựng API kiểm tra quyền sử dụng tính năng | EPIC 04 | **Done** |
| `PDFL-72` | Thiết kế bảng dữ liệu tài khoản người dùng (User schema) | EPIC 05 | **Done** |
| `PDFL-73` | Xây dựng chức năng đăng ký tài khoản | EPIC 05 | **Done** |
| `PDFL-74` | Kiểm tra email và thông tin đăng ký hợp lệ | EPIC 05 | **Done** |
| `PDFL-75` | Mã hóa mật khẩu trước khi lưu vào database (bcrypt 12 rounds) | EPIC 05 | **Done** |
| `PDFL-76` | Xây dựng chức năng đăng nhập | EPIC 05 | **Done** |
| `PDFL-78` | Xây dựng chức năng đăng xuất | EPIC 05 | **Done** |
| `PDFL-79` | Xây dựng chức năng xem và cập nhật thông tin tài khoản | EPIC 05 | **Done** |
| `PDFL-80` | Xây dựng chức năng đổi mật khẩu | EPIC 05 | **Done** |
| `PDFL-81` | Kiểm soát quyền truy cập của khách, người dùng đã đăng nhập và Admin | EPIC 05 | **Done** |
| `PDFL-82` | Kiểm tra quyền truy cập khi người dùng gọi trực tiếp API, không chỉ ẩn chức năng trên giao diện | EPIC 05 | **Done** |
| `PDFL-83` | Xử lý trường hợp token hết hạn, tài khoản không tồn tại hoặc thông tin đăng nhập sai | EPIC 05 | **Done** |
| `PDFL-84` | Kiểm tra khả năng truy cập và chỉnh sửa dữ liệu của người dùng khác | EPIC 05 | **Done** |
| `PDFL-85` | Xây dựng API tải tài liệu PDF lên Backend (`/api/process/upload-and-translate`) | EPIC 06 | **Done** |
| `PDFL-86` | Kiểm tra loại file và nội dung file để hạn chế file giả mạo định dạng PDF | EPIC 06 | **Done** |
| `PDFL-87` | Áp dụng giới hạn dung lượng: Free tối đa 20 MB/tệp, Pro tối đa 100 MB/tệp | EPIC 06 | **Done** |
| `PDFL-88` | Kiểm tra PDF bị hỏng, có mật khẩu hoặc không thể đọc | EPIC 06 | **Done** |
| `PDFL-89` | Thiết lập giới hạn số trang được phép xử lý (Free 100 trang) | EPIC 06 | **Done** |
| `PDFL-99` | Tích hợp thư viện PyMuPDF để đọc và trích xuất văn bản | EPIC 07 | **Done** |
| `PDFL-100` | Trích xuất văn bản theo từng trang | EPIC 07 | **Done** |
| `PDFL-101` | Xử lý xuống dòng, khoảng trắng và ký tự bất thường | EPIC 07 | **Done** |
| `PDFL-102` | Giữ thứ tự văn bản hợp lý khi tài liệu có nhiều đoạn hoặc nhiều cột (Natural Reading Order) | EPIC 07 | **Done** |
| `PDFL-103` | Phát hiện tài liệu có ít hoặc không có văn bản trích xuất được | EPIC 07 | **Done** |
| `PDFL-104` | Tích hợp Tesseract OCR để nhận diện văn bản từ PDF scan | EPIC 07 | **Done** |
| `PDFL-105` | Cấu hình dữ liệu ngôn ngữ OCR cần hỗ trợ, ưu tiên tiếng Việt và tiếng Anh | EPIC 07 | **Done** |
| `PDFL-106` | Kết hợp kết quả OCR với cơ chế trích xuất văn bản thông thường (Hybrid Engine) | EPIC 07 | **Done** |
| `PDFL-107` | Xây dựng API trả về nội dung văn bản được trích xuất | EPIC 07 | **Done** |
| `PDFL-45` | Xây dựng giao diện tải tài liệu PDF (Dropzone UI) | EPIC 03 | **Done** |
| `PDFL-46` | Xây dựng giao diện hiển thị tiến trình tải lên và xử lý tài liệu (Processing Modal) | EPIC 03 | **Done** |
| `PDFL-47` | Xây dựng giao diện hiển thị văn bản sau khi trích xuất (Dual-pane Workspace) | EPIC 03 | **Done** |
| `PDFL-57` | Thiết kế trạng thái loading, lỗi, thành công và giao diện khi chưa có dữ liệu | EPIC 03 | **Done** |

---

### 🔹 Sprint 3: Quản Lý Tài Liệu Người Dùng, Tối Ưu Hóa OCR Nâng Cao, Dịch Thuật & Hoàn Thiện Giao Diện
- **Thời gian**: 31/10/2026 - 06/11/2026 (Tuần 3)
- **Mục tiêu**: Hoàn thiện toàn diện giao diện Auth & Profile, quản lý tài liệu cá nhân, tối ưu OCR nâng cao cho tài liệu xoay/lỗi/nhiều trang, tích hợp động cơ dịch thuật đa ngôn ngữ và xuất tệp kết quả TXT/PDF, hỗ trợ kéo thả file và chính sách điều khoản người dùng.
- **Trạng thái**: ✅ **Đã hoàn thành 100% (Completed)**: **38 Work Items** (38 Done / 0 In Progress / 0 To Do)

| Mã Task | Tên nhiệm vụ | Epic | Trạng thái Jira |
| :--- | :--- | :---: | :---: |
| `PDFL-42` | Xây dựng trang đăng ký tài khoản | EPIC 03 | **Done** |
| `PDFL-43` | Xây dựng trang đăng nhập | EPIC 03 | **Done** |
| `PDFL-44` | Xây dựng trang thông tin tài khoản | EPIC 03 | **Done** |
| `PDFL-48` | Xây dựng giao diện chọn ngôn ngữ nguồn và ngôn ngữ đích | EPIC 03 | **Done** |
| `PDFL-49` | Xây dựng giao diện hiển thị bản dịch | EPIC 03 | **Done** |
| `PDFL-52` | Xây dựng giao diện so sánh hoặc chuyển đổi giữa văn bản gốc và bản dịch | EPIC 03 | **Done** |
| `PDFL-59` | Kiểm tra tính nhất quán về thiết kế và khả năng sử dụng | EPIC 03 | **Done** |
| `PDFL-77` | Xây dựng cơ chế quản lý phiên đăng nhập hoặc token | EPIC 05 | **Done** |
| `PDFL-90` | Lưu trữ file trong thư mục hoặc dịch vụ lưu trữ được cấu hình | EPIC 06 | **Done** |
| `PDFL-91` | Ghi nhận metadata của tài liệu như tên file, dung lượng, số trang, thời gian tải lên và chủ sở hữu | EPIC 06 | **Done** |
| `PDFL-92` | Hiển thị danh sách tài liệu của người dùng | EPIC 06 | **Done** |
| `PDFL-93` | Xem thông tin chi tiết của một tài liệu | EPIC 06 | **Done** |
| `PDFL-94` | Xây dựng chức năng xóa tài liệu | EPIC 06 | **Done** |
| `PDFL-95` | Kiểm soát quyền tải xuống và truy cập file | EPIC 06 | **Done** |
| `PDFL-96` | Xử lý lỗi khi tải file, mất kết nối hoặc quá giới hạn | EPIC 06 | **Done** |
| `PDFL-97` | Xóa các file tạm khi hoàn tất xử lý hoặc khi xảy ra lỗi | EPIC 06 | **Done** |
| `PDFL-98` | Đảm bảo tài liệu riêng tư không bị người dùng khác truy cập | EPIC 06 | **Done** |
| `PDFL-108` | Hiển thị kết quả trích xuất trên giao diện | EPIC 07 | **Done** |
| `PDFL-109` | Xử lý tài liệu có trang trống, trang bị xoay hoặc hình ảnh chất lượng thấp | EPIC 07 | **Done** |
| `PDFL-110` | Kiểm thử độ chính xác với PDF thông thường và PDF scan | EPIC 07 | **Done** |
| `PDFL-111` | Tối ưu thời gian xử lý đối với tài liệu nhiều trang | EPIC 07 | **Done** |
| `PDFL-112` | Trả thông báo rõ ràng khi không trích xuất được nội dung | EPIC 07 | **Done** |
| `PDFL-113` | Lựa chọn thư viện hoặc dịch vụ dịch thuật | EPIC 08 | **Done** |
| `PDFL-114` | Xác định danh sách ngôn ngữ nguồn và ngôn ngữ đích được hỗ trợ | EPIC 08 | **Done** |
| `PDFL-115` | Xây dựng chức năng tự động nhận diện ngôn ngữ nguồn nếu dịch vụ hỗ trợ | EPIC 08 | **Done** |
| `PDFL-116` | Xây dựng giao diện chọn ngôn ngữ | EPIC 08 | **Done** |
| `PDFL-117` | Xây dựng API dịch văn bản | EPIC 08 | **Done** |
| `PDFL-118` | Chia văn bản dài thành các đoạn phù hợp với giới hạn của dịch vụ | EPIC 08 | **Done** |
| `PDFL-119` | Giữ thứ tự các đoạn khi ghép kết quả dịch | EPIC 08 | **Done** |
| `PDFL-121` | Hiển thị bản dịch kèm thông tin ngôn ngữ | EPIC 08 | **Done** |
| `PDFL-122` | Cho phép sao chép bản dịch | EPIC 08 | **Done** |
| `PDFL-151` | Xây dựng chức năng xuất văn bản thành file TXT | EPIC 11 | **Done** |
| `PDFL-152` | Xây dựng chức năng xuất nội dung thành file PDF | EPIC 11 | **Done** |
| `PDFL-153` | Xây dựng chức năng tải file kết quả về thiết bị người dùng | EPIC 11 | **Done** |
| `PDFL-154` | Đặt tên file kết quả theo tài liệu, ngôn ngữ hoặc loại nội dung | EPIC 11 | **Done** |
| `PDFL-155` | Đảm bảo tiếng Việt và Unicode được hiển thị đúng trong file xuất | EPIC 11 | **Done** |
| `PDFL-253` | Hỗ trợ kéo thả file vào giao diện | EPIC 17 | **Done** |
| `PDFL-267` | Điều khoản và bảo mật cho người dùng | EPIC 03 | **Done** |

---

### 🔹 Sprint 4: Dịch Thuật Fallback, Xuất File, Lịch Sử Xử Lý, Quản Trị Admin Cơ Bản & Quyền Lợi Gói
- **Thời gian**: 07/11/2026 - 13/11/2026 (Tuần 4)
- **Mục tiêu**: Xử lý các kịch bản ngoại lệ của dịch vụ dịch thuật (mạng lỗi, rate limit, fallback đa tầng), kiểm thử xuất file định dạng TXT/PDF, hoàn thiện cơ sở dữ liệu và API lịch sử xử lý tài liệu, thiết lập quyền lợi gói Free/Pro và Dashboard quản trị Admin cơ bản.
- **Trạng thái**: ✅ **Đã hoàn thành 100% (Completed)** - **31 Work Items** (31 Done / 0 In Progress / 0 To Do)

| Mã Task | Tên nhiệm vụ | Epic | Trạng thái Jira |
| :--- | :--- | :---: | :---: |
| `PDFL-120` | Xử lý lỗi mạng, giới hạn API và lỗi dịch thuật | EPIC 08 | **Done** |
| `PDFL-123` | Kiểm thử các trường hợp dịch tiếng Việt, tiếng Anh và các ngôn ngữ được lựa chọn | EPIC 08 | **Done** |
| `PDFL-124` | Đánh giá khả năng giữ nguyên đoạn văn, danh sách và nội dung quan trọng khi dịch | EPIC 08 | **Done** |
| `PDFL-125` | Đảm bảo hệ thống không làm mất hoặc đảo thứ tự đoạn khi dịch tài liệu dài | EPIC 08 | **Done** |
| `PDFL-150` | Xác định các loại kết quả có thể xuất: văn bản gốc, bản dịch và bản tóm tắt | EPIC 11 | **Done** |
| `PDFL-156` | Xử lý trường hợp nội dung rỗng hoặc không có kết quả | EPIC 11 | **Done** |
| `PDFL-157` | Kiểm tra quyền tải xuống và quyền truy cập kết quả | EPIC 11 | **Done** |
| `PDFL-158` | Kiểm thử file xuất trên các trình đọc file thông dụng | EPIC 11 | **Done** |
| `PDFL-159` | Thiết kế bảng dữ liệu lưu lịch sử xử lý | EPIC 12 | **Done** |
| `PDFL-160` | Lưu thông tin tài liệu và loại thao tác đã thực hiện | EPIC 12 | **Done** |
| `PDFL-161` | Lưu kết quả trích xuất, dịch thuật hoặc tóm tắt theo phạm vi chức năng đã thống nhất | EPIC 12 | **Done** |
| `PDFL-162` | Xây dựng API lấy danh sách lịch sử | EPIC 12 | **Done** |
| `PDFL-163` | Xây dựng API xem chi tiết một bản ghi lịch sử | EPIC 12 | **Done** |
| `PDFL-164` | Hiển thị lịch sử trên giao diện | EPIC 12 | **Done** |
| `PDFL-165` | Cho phép mở lại kết quả đã lưu | EPIC 12 | **Done** |
| `PDFL-166` | Cho phép xóa lịch sử theo chính sách lưu trữ | EPIC 12 | **Done** |
| `PDFL-172` | Xác định quyền lợi cụ thể của gói Free | EPIC 13 | **Done** |
| `PDFL-176` | Giới hạn tải lên tối đa 20 MB/tệp đối với Free | EPIC 13 | **Done** |
| `PDFL-178` | Xác định và thực thi giới hạn số trang PDF cho từng gói | EPIC 13 | **Done** |
| `PDFL-185` | Kiểm thử việc áp dụng hạn mức ở Backend, kể cả khi người dùng gọi API trực tiếp | EPIC 13 | **Done** |
| `PDFL-207` | Kiểm thử PDF văn bản thông thường | EPIC 15 | **Done** |
| `PDFL-214` | Kiểm tra an toàn file tải lên và ngăn việc truy cập file ngoài phạm vi cho phép | EPIC 15 | **Done** |
| `PDFL-186` | Xác định vai trò và quyền hạn của Admin | EPIC 14 | **Done** |
| `PDFL-188` | Xây dựng trang tổng quan quản trị | EPIC 14 | **Done** |
| `PDFL-189` | Hiển thị danh sách tài khoản người dùng | EPIC 14 | **Done** |
| `PDFL-194` | Khóa hoặc mở khóa tài khoản khi cần | EPIC 14 | **Done** |
| `PDFL-197` | Xử lý thông báo xác nhận trước những thao tác có ảnh hưởng lớn | EPIC 14 | **Done** |
| `PDFL-198` | Kiểm thử quyền Admin và đảm bảo tài khoản thường không thể truy cập chức năng quản trị | EPIC 14 | **Done** |
| `PDFL-240` | Viết README giới thiệu PDF Lingua | EPIC 16 | **Done** |
| `PDFL-260` | Gửi thông báo về trạng thái xử lý tài liệu | EPIC 17 | **Done** |
| `PDFL-173` | Xác định quyền lợi cụ thể của gói Pro | EPIC 13 | **Done** |

---

### 🔹 Sprint 5: Quản Trị Hệ Thống Admin, Gói Dịch Vụ Pro, Tính Năng Mở Rộng & Thiết Kế Đồ Án
- **Thời gian**: 13/11/2026 - 20/11/2026 (Tuần 5)
- **Mục tiêu**: Hoàn thiện toàn diện hệ sinh thái gói dịch vụ Free/Pro, phân quyền tài khoản, bảng điều khiển quản trị Admin, xử lý tác vụ nền, các tính năng mở rộng nâng cao trải nghiệm người dùng và hoàn thiện hồ sơ thiết kế kiến trúc hệ thống, lược đồ use case, lược đồ lớp.
- **Trạng thái**: 🚀 **Đang triển khai** - **34 Work Items**

| Mã Task | Tên nhiệm vụ | Epic | Trạng thái Jira |
| :--- | :--- | :---: | :---: |
| `PDFL-167` | Chỉ cho phép tài khoản Pro sử dụng chức năng lịch sử nếu đây là quyền lợi đã chốt | EPIC 12 | - |
| `PDFL-168` | Kiểm soát quyền truy cập lịch sử theo tài khoản | EPIC 12 | - |
| `PDFL-169` | Xác định thời gian lưu trữ và cách xóa dữ liệu khi cần | EPIC 12 | - |
| `PDFL-170` | Kiểm thử khả năng lưu, truy vấn, mở lại và xóa lịch sử | EPIC 12 | - |
| `PDFL-171` | Thiết kế dữ liệu gói dịch vụ và trạng thái đăng ký của người dùng | EPIC 13 | - |
| `PDFL-174` | Hiển thị gói hiện tại của người dùng | EPIC 13 | - |
| `PDFL-175` | Xây dựng cơ chế kiểm tra gói dịch vụ ở Backend | EPIC 13 | - |
| `PDFL-177` | Giới hạn tải lên tối đa 100 MB/tệp đối với Pro | EPIC 13 | - |
| `PDFL-179` | Xác định hạn mức OCR, dịch thuật và AI theo gói | EPIC 13 | - |
| `PDFL-180` | Chặn hoặc thông báo khi người dùng vượt hạn mức | EPIC 13 | - |
| `PDFL-181` | Xây dựng trang so sánh quyền lợi Free và Pro | EPIC 13 | - |
| `PDFL-182` | Xây dựng luồng yêu cầu nâng cấp lên Pro | EPIC 13 | - |
| `PDFL-183` | Cập nhật quyền sử dụng khi tài khoản được nâng cấp hoặc hạ cấp | EPIC 13 | - |
| `PDFL-184` | Hiển thị thông báo nâng cấp khi người dùng truy cập tính năng dành cho Pro | EPIC 13 | - |
| `PDFL-187` | Thiết lập cách khởi tạo tài khoản Admin an toàn | EPIC 14 | - |
| `PDFL-190` | Tìm kiếm và lọc tài khoản theo thông tin phù hợp | EPIC 14 | - |
| `PDFL-191` | Xem thông tin và trạng thái tài khoản | EPIC 14 | - |
| `PDFL-192` | Theo dõi trạng thái gói Free/Pro | EPIC 14 | - |
| `PDFL-193` | Cấp, gia hạn, hạ cấp hoặc thu hồi quyền Pro theo quy định của hệ thống | EPIC 14 | - |
| `PDFL-195` | Kiểm soát quyền Admin ở Backend | EPIC 14 | - |
| `PDFL-196` | Ghi nhận nhật ký các thao tác quản trị quan trọng | EPIC 14 | - |
| `PDFL-252` | Cho phép xử lý nhiều file PDF theo lô | EPIC 17 | - |
| `PDFL-254` | Cho phép người dùng Pro tải kết quả dưới định dạng DOCX | EPIC 17 | - |
| `PDFL-255` | Cho phép chọn các trang cụ thể cần trích xuất hoặc dịch | EPIC 17 | - |
| `PDFL-256` | Hỗ trợ xem trước PDF và chuyển trang ngay trên ứng dụng | EPIC 17 | - |
| `PDFL-67` | Xây dựng API kiểm tra giới hạn upload, AI và các hạn mức khác | EPIC 04 | - |
| `PDFL-71` | Xử lý các tác vụ mất nhiều thời gian mà không khóa toàn bộ ứng dụng | EPIC 04 | - |
| `PDFL-53` | Xây dựng giao diện lịch sử xử lý tài liệu | EPIC 03 | - |
| `PDFL-54` | Xây dựng trang giới thiệu và so sánh gói Free/Pro | EPIC 03 | - |
| `PDFL-55` | Xây dựng giao diện nâng cấp gói Pro | EPIC 03 | - |
| `PDFL-56` | Xây dựng giao diện quản trị Admin | EPIC 03 | - |
| `PDFL-269` | Kiến trúc hệ thống (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | - |
| `PDFL-270` | Lược đồ usecase (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | - |
| `PDFL-271` | Lược đồ lớp (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | EPIC 16 | - |

---

### 🔹 Sprint 6: Tích Hợp AI - Tóm Tắt Văn Bản & Trợ Lý Hỏi Đáp Tài Liệu
- **Thời gian**: 21/11/2026 - 28/11/2026 (Tuần 6)
- **Mục tiêu**: Tích hợp các mô hình trí tuệ nhân tạo (LLM API) để tóm tắt ý chính tài liệu PDF và xây dựng Trợ lý ảo chat hỏi đáp trực tiếp dựa trên nội dung văn bản (Document QA/RAG).
- **Trạng thái**: 📋 **Theo kế hoạch** - **26 Work Items**

| Mã Task | Tên nhiệm vụ | Epic | Trạng thái Jira |
| :--- | :--- | :---: | :---: |
| `PDFL-126` | Lựa chọn mô hình AI hoặc dịch vụ API phù hợp | EPIC 09 | To Do |
| `PDFL-127` | Quản lý API key thông qua biến môi trường | EPIC 09 | To Do |
| `PDFL-128` | Xây dựng cấu trúc prompt tóm tắt văn bản | EPIC 09 | To Do |
| `PDFL-129` | Xây dựng API tóm tắt nội dung tài liệu | EPIC 09 | To Do |
| `PDFL-130` | Hỗ trợ lựa chọn độ dài hoặc kiểu tóm tắt nếu mô hình cho phép | EPIC 09 | To Do |
| `PDFL-131` | Hỗ trợ tóm tắt văn bản dài bằng cách chia đoạn hoặc tóm tắt nhiều bước | EPIC 09 | To Do |
| `PDFL-132` | Hiển thị nội dung tóm tắt trên giao diện | EPIC 09 | To Do |
| `PDFL-133` | Cho phép sao chép kết quả tóm tắt | EPIC 09 | To Do |
| `PDFL-134` | Kiểm tra quyền sử dụng AI của tài khoản Pro | EPIC 09 | To Do |
| `PDFL-135` | Kiểm soát số lượt sử dụng, lượng văn bản đầu vào và chi phí | EPIC 09 | To Do |
| `PDFL-136` | Xử lý lỗi khi dịch vụ AI không phản hồi hoặc vượt giới hạn | EPIC 09 | To Do |
| `PDFL-137` | Kiểm thử chất lượng tóm tắt trên các loại tài liệu khác nhau | EPIC 09 | To Do |
| `PDFL-138` | Xác định phạm vi câu hỏi mà trợ lý AI có thể xử lý | EPIC 10 | To Do |
| `PDFL-139` | Xây dựng API gửi câu hỏi về tài liệu | EPIC 10 | To Do |
| `PDFL-140` | Cung cấp nội dung tài liệu liên quan làm ngữ cảnh cho AI | EPIC 10 | To Do |
| `PDFL-141` | Xử lý tài liệu dài bằng cách chọn các đoạn liên quan trước khi gửi cho AI | EPIC 10 | To Do |
| `PDFL-142` | Xây dựng giao diện khung chat | EPIC 10 | To Do |
| `PDFL-143` | Hiển thị câu hỏi và câu trả lời theo thứ tự hội thoại | EPIC 10 | To Do |
| `PDFL-144` | Xử lý trạng thái AI đang suy nghĩ, câu trả lời lỗi và yêu cầu thử lại | EPIC 10 | To Do |
| `PDFL-145` | Giới hạn số lượt hỏi đáp hoặc lượng nội dung theo gói dịch vụ | EPIC 10 | To Do |
| `PDFL-146` | Đảm bảo câu trả lời dựa trên nội dung tài liệu khi người dùng hỏi về tài liệu | EPIC 10 | To Do |
| `PDFL-148` | Kiểm soát quyền truy cập để người dùng không hỏi hoặc truy xuất tài liệu của người khác | EPIC 10 | To Do |
| `PDFL-149` | Kiểm thử khả năng trả lời đúng nội dung, hạn chế bịa đặt và xử lý câu hỏi ngoài phạm vi | EPIC 10 | To Do |
| `PDFL-147` | Xử lý trường hợp tài liệu không có thông tin để trả lời | EPIC 10 | To Do |
| `PDFL-50` | Xây dựng giao diện tóm tắt văn bản bằng AI | EPIC 03 | To Do |
| `PDFL-51` | Xây dựng giao diện trò chuyện với trợ lý AI | EPIC 03 | To Do |

---

### 🔹 Sprint 7: Tính Năng Mở Rộng Nâng Cao & Buffer Dự Phòng (EPIC 17)
- **Thời gian**: 28/11/2026 - 04/12/2026 (Tuần 7)
- **Mục tiêu**:
  1. **Buffer dự phòng**: Hoàn tất các task tồn đọng từ 6 tuần trước (nếu có).
  2. **Tối ưu UX**: Sửa các lỗi nhỏ phát sinh trong quá trình chạy thử nghiệm.
  3. **Chức năng mở rộng (EPIC 17)**: Hiện thực 13 tính năng giá trị gia tăng (`PDFL-252`, `PDFL-254` đến `PDFL-265`) thuộc **EPIC 17: Tính năng mở rộng & Nâng cao trải nghiệm người dùng** (lưu ý: `PDFL-253` đã hoàn thành trước hạn tại Sprint 3).
  4. **Tổng duyệt**: Diễn tập buổi thuyết trình và demo kịch bản hoàn chỉnh (`DEMO-DRY`).
- **Trạng thái**: 📋 **Theo kế hoạch** - 13 Work Items

| Mã Task | Tên nhiệm vụ mở rộng | Epic | Ý nghĩa & Giá trị mang lại | Trạng thái Jira |
| :--- | :--- | :---: | :--- | :---: |
| `PDFL-252` | Cho phép xử lý nhiều file PDF theo lô | EPIC 17 | Tải lên và xử lý hàng loạt tài liệu cùng lúc | To Do |
| `PDFL-254` | Cho phép tải kết quả dưới định dạng DOCX | EPIC 17 | Tiện lợi cho người dùng muốn chỉnh sửa tiếp trên Microsoft Word | To Do |
| `PDFL-255` | Cho phép chọn các trang cụ thể cần trích xuất hoặc dịch | EPIC 17 | Tiết kiệm tài nguyên và thời gian khi tài liệu quá dài | To Do |
| `PDFL-256` | Hỗ trợ xem trước PDF và chuyển trang ngay trên ứng dụng | EPIC 17 | Người dùng xem được tài liệu gốc song song khi đối chiếu bản dịch | To Do |
| `PDFL-257` | Hỗ trợ lưu hoặc tải lại kết quả dịch theo từng trang | EPIC 17 | Quản lý kết quả dịch chi tiết theo từng trang riêng biệt | To Do |
| `PDFL-258` | Bổ sung đặt lại mật khẩu qua email | EPIC 17 | Hoàn thiện luồng quên mật khẩu người dùng với OTP/Token | To Do |
| `PDFL-259` | Tích hợp thanh toán trực tuyến cho gói Pro | EPIC 17 | Mô phỏng quy trình nâng cấp gói cước trực tuyến | To Do |
| `PDFL-260` | Gửi thông báo về trạng thái xử lý tài liệu | EPIC 17 | Trải nghiệm thông báo thời gian thực (Toast Notification) | To Do |
| `PDFL-261` | Cho phép người dùng gửi phản hồi hoặc báo cáo lỗi | EPIC 17 | Kênh tiếp nhận ý kiến đóng góp từ người dùng | To Do |
| `PDFL-262` | Bổ sung thống kê mức sử dụng dịch vụ | EPIC 17 | Biểu đồ trực quan số trang đã đọc, số từ đã dịch trong Dashboard | To Do |
| `PDFL-263` | Cải thiện khả năng truy xuất nguồn cho câu trả lời AI | EPIC 17 | Tham chiếu trang hoặc đoạn văn liên quan để tăng độ tin cậy AI | To Do |
| `PDFL-264` | Hỗ trợ nhiều chủ đề giao diện hoặc chế độ tối (Dark mode) | EPIC 17 | Tùy chọn giao diện bảo vệ mắt khi làm việc ban đêm | To Do |
| `PDFL-265` | Xem xét sử dụng hàng đợi tác vụ cho các file lớn (Task Queue) | EPIC 17 | Kiến trúc mở rộng chịu tải cao (Celery/Redis) cho quy trình OCR/AI | To Do |

---

## 📈 Quy Trình Vận Hành Sprint (Sprint Workflow) & Tiêu Chuẩn Hoàn Thành (DoD)

### 1. Quy trình Scrum chuẩn
1. **Sprint Planning (Đầu tuần)**: Rà soát danh sách task của Sprint trên Jira, chốt khối lượng công việc.
2. **Daily / Mid-week Sync (Giữa tuần)**: Trao đổi nhanh các khó khăn kỹ thuật (blockers), hỗ trợ giải quyết lỗi.
3. **Sprint Review & Code Review (Cuối tuần)**: Kiểm thử các chức năng đã hoàn thành, tạo Pull Request để thành viên còn lại review trước khi merge vào nhánh chính.
4. **Cập nhật Jira**: Đảm bảo tất cả các task đã hoàn thành được chuyển trạng thái sang `Done`.

### 2. Tiêu chuẩn hoàn thành (Definition of Done - DoD)
- [x] **Mã nguồn**: Code chạy đúng logic yêu cầu, tuân thủ quy chuẩn đặt tên biến/hàm, không có lỗi cú pháp hoặc log rác.
- [x] **Kiểm thử**: Đạt 100% các unit test / integration test liên quan; đã tự kiểm tra (manual test) các trường hợp bình thường và ngoại lệ.
- [x] **Bảo mật**: Tuyệt đối không hardcode mật khẩu, token bí mật hoặc API Key vào mã nguồn hoặc Git repository.
- [x] **Code Review**: Đã tạo Pull Request và được thành viên trong nhóm phê duyệt trước khi merge vào nhánh `main` / `develop`.
- [x] **Đồng bộ Jira**: Chuyển trạng thái task tương ứng sang `Done` trên Jira Board.
