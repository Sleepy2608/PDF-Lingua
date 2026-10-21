# PDF-Lingua — Kế Hoạch Sprint Phát Triển (Sprint Plan)

- **Dự án**: **PDF Lingua** – Web trích xuất văn bản từ tài liệu PDF, dịch thuật đa ngôn ngữ và tích hợp AI hỗ trợ người dùng, tóm tắt văn bản.
- **Thành viên nhóm**:
  1. `056206011188` – Nguyễn Lê Huy Tâm (Trưởng nhóm)
  2. `077206002307` – Huỳnh Đình Chấn (Thành viên)
- **Jira Project**: [https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary](https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary)
- **Tài liệu Backlog tham chiếu**: [PDF_Lingua_Jira_Backlog.md](file:///c:/University%20Coding%20Project/PDF-Lingua/.jira/PDF_Lingua_Jira_Backlog.md)

---

## Tổng quan lộ trình tuần 1 & 2
- **Tuần 1 (Sprint 1: 15/10 - 22/10)**: Phân tích yêu cầu, thiết kế hệ thống, khởi tạo repository, khung dự án Frontend & Backend, cấu hình môi trường và quy chuẩn Git.
- **Tuần 2 (Sprint 2: 22/10 - 29/10)**: Xây dựng toàn diện hệ thống tài khoản, xác thực người dùng, bảo mật mật khẩu, cấp phát JWT, phân quyền vai trò (Guest, User, Admin) và giao diện Auth.

---

## KẾ HOẠCH CHI TIẾT TUẦN 1 & TUẦN 2

### Sprint 1: Phân tích yêu cầu, Thiết kế hệ thống & Khởi tạo khung dự án
- **Mục tiêu**: Hoàn thành tài liệu phân tích thiết kế (Use Case, Activity, ERD, Kiến trúc), khởi tạo kho lưu trữ GitHub, khung dự án Frontend/Backend và quy chuẩn làm việc Git.
- **Thời gian**: Tuần 1 (15/10 - 22/10)

| Mã Task | Tên nhiệm vụ | Epic |
| :--- | :--- | :---: |
| `PDFL-1` | Xác định đối tượng sử dụng: Khách, Free, Pro, Admin | EPIC 01 |
| `PDFL-2` | Chốt danh sách chức năng chính và chức năng mở rộng | EPIC 01 |
| `PDFL-3` | Xác định quyền lợi, giới hạn gói Free (20MB) và Pro (100MB) | EPIC 01 |
| `PDFL-4` | Xác định quy trình xử lý tài liệu từ upload đến xuất kết quả | EPIC 01 |
| `PDFL-21` | Xây dựng Use Case Diagram | EPIC 01 |
| `PDFL-22` | Xây dựng sơ đồ hoạt động (Activity Diagram) các luồng chính | EPIC 01 |
| `PDFL-23` | Thiết kế kiến trúc tổng thể (Frontend, Backend, Database, OCR, AI) | EPIC 01 |
| `PDFL-24` | Thiết kế sơ đồ ERD và mô hình dữ liệu quan hệ | EPIC 01 |
| `PDFL-25` | Thống nhất cấu trúc và quy chuẩn API giữa Frontend và Backend | EPIC 01 |
| `PDFL-26` | Xác định yêu cầu phi chức năng (bảo mật, hiệu năng, UX) | EPIC 01 |
| `PDFL-27` | Tạo repository GitHub `pdf-lingua` | EPIC 02 |
| `PDFL-28` | Xây dựng cấu trúc thư mục Frontend và Backend | EPIC 02 |
| `PDFL-29` | Khởi tạo ứng dụng Frontend bằng HTML, CSS và JavaScript | EPIC 02 |
| `PDFL-30` | Khởi tạo Backend bằng Python và FastAPI | EPIC 02 |
| `PDFL-31` | Cấu hình môi trường Python, `requirements.txt` và `venv` | EPIC 02 |
| `PDFL-32` | Cấu hình các biến môi trường trong `.env` | EPIC 02 |
| `PDFL-33` | Tạo `.env.example` và cấu hình `.gitignore`, `.gitattributes` | EPIC 02 |
| `PDFL-34` | Cấu hình kết nối database (SQLite / PostgreSQL) | EPIC 02 |
| `PDFL-35` | Thiết lập quy tắc đặt tên branch, commit và Pull Request | EPIC 02 |
| `PDFL-36` | Xây dựng API kiểm tra tình trạng Backend (`/health`) | EPIC 02 |
| `PDFL-37` | Cấu hình môi trường để Frontend gọi API Backend (CORS) | EPIC 02 |
| `PDFL-38` | Kiểm tra khởi chạy toàn bộ dự án trên máy phát triển | EPIC 02 |
| `PDFL-39` | Xác định phong cách thiết kế, màu sắc, typography giao diện | EPIC 03 |
| `PDFL-40` | Thiết kế thanh điều hướng (Navbar) và bố cục chung | EPIC 03 |
| `PDFL-41` | Xây dựng trang chủ giới thiệu PDF-Lingua và tính năng | EPIC 03 |
| `PDFL-58` | Đảm bảo giao diện responsive trên máy tính và điện thoại | EPIC 03 |
| `PDFL-60` | Thiết kế cấu trúc module Backend theo nhóm chức năng | EPIC 04 |
| `PDFL-61` | Xây dựng các lớp xử lý nghiệp vụ (Service layer pattern) | EPIC 04 |
| `PDFL-62` | Chuẩn hóa cấu trúc request và response của API | EPIC 04 |
| `PDFL-63` | Xây dựng cơ chế xử lý lỗi chung (Global Exception Handler) | EPIC 04 |
| `PDFL-64` | Cấu hình CORS an toàn cho phát triển và triển khai | EPIC 04 |
| `PDFL-68` | Chuẩn hóa HTTP status code và thông báo lỗi rõ ràng | EPIC 04 |
| `PDFL-69` | Xây dựng tài liệu API Swagger/OpenAPI tự động | EPIC 04 |
| `PDFL-70` | Thiết lập logging để theo dõi hoạt động xử lý và lỗi | EPIC 04 |

- **Kết quả bàn giao (Deliverables)**:
  - Tài liệu sơ đồ thiết kế hệ thống hoàn chỉnh.
  - Khung mã nguồn Frontend + Backend chạy thông suốt, cấu hình Git chuẩn hóa.

---

### Sprint 2: Hệ thống tài khoản, Xác thực & Phân quyền người dùng
- **Mục tiêu**: Xây dựng toàn diện cơ chế đăng ký, đăng nhập, bảo mật mật khẩu, cấp phát JWT token, phân quyền (Guest, User, Admin) và giao diện tài khoản người dùng.
- **Thời gian**: Tuần 2 (22/10 - 29/10)

| Mã Task | Tên nhiệm vụ | Epic |
| :--- | :--- | :---: |
| `PDFL-72` | Thiết kế bảng dữ liệu tài khoản người dùng (User schema) | EPIC 05 |
| `PDFL-73` | Xây dựng API đăng ký tài khoản mới | EPIC 05 |
| `PDFL-74` | Kiểm tra tính hợp lệ của email và độ mạnh mật khẩu | EPIC 05 |
| `PDFL-75` | Mã hóa mật khẩu an toàn (bcrypt/argon2) trước khi lưu DB | EPIC 05 |
| `PDFL-76` | Xây dựng API đăng nhập xác thực thông tin tài khoản | EPIC 05 |
| `PDFL-77` | Quản lý phiên đăng nhập và cấp phát JWT access token | EPIC 05 |
| `PDFL-78` | Xây dựng chức năng đăng xuất (hủy token phía client) | EPIC 05 |
| `PDFL-79` | API xem và cập nhật thông tin cá nhân của người dùng | EPIC 05 |
| `PDFL-80` | Xây dựng chức năng đổi mật khẩu cho tài khoản | EPIC 05 |
| `PDFL-81` | Kiểm soát quyền truy cập của Khách, User đăng nhập và Admin | EPIC 05 |
| `PDFL-82` | Kiểm tra quyền truy cập ở tầng API Backend (Middleware / Guard) | EPIC 05 |
| `PDFL-83` | Xử lý token hết hạn, sai credentials và trả thông báo lỗi thân thiện | EPIC 05 |
| `PDFL-84` | Ngăn chặn người dùng truy cập hoặc sửa dữ liệu của tài khoản khác | EPIC 05 |
| `PDFL-65` | Xây dựng API lấy thông tin người dùng hiện tại (`/api/auth/me`) | EPIC 04 |
| `PDFL-66` | Xây dựng API kiểm tra quyền sử dụng tính năng của tài khoản | EPIC 04 |
| `PDFL-42` | Xây dựng giao diện trang Đăng ký tài khoản | EPIC 03 |
| `PDFL-43` | Xây dựng giao diện trang Đăng nhập | EPIC 03 |
| `PDFL-44` | Xây dựng giao diện trang Thông tin tài khoản người dùng | EPIC 03 |
| `PDFL-59` | Kiểm tra tính nhất quán giao diện và trải nghiệm form nhập liệu | EPIC 03 |

- **Kết quả bàn giao (Deliverables)**:
  - Luồng xác thực người dùng hoàn chỉnh từ giao diện đến API và lưu trữ Database.
  - Phân quyền chặt chẽ theo vai trò và token bảo mật.
