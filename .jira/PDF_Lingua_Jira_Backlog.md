# PDF-Lingua - Jira Product Backlog

- **Tên phần mềm**: **PDF Lingua** - Web trích xuất văn bản từ tài liệu PDF, dịch thuật đa ngôn ngữ và tích hợp AI hỗ trợ người dùng, tóm tắt văn bản.
- **Thành viên thực hiện**:
  1. Nguyễn Lê Huy Tâm - `056206011188` (Trưởng nhóm)
  2. Huỳnh Đình Chấn - `077206002307` (Thành viên)
- **Jira Project Key**: `PDFL`
- **Jira Board & Summary**: [https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary](https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary)
- **Kế hoạch 8 Sprint**: [Sprint_Plan.md](./Sprint_Plan.md)
- **Bảng phân công nhiệm vụ**: [Assignment.md](./Assignment.md)

> [!IMPORTANT]
> **Lộ trình triển khai & Cam kết chất lượng**:
> - Các tính năng cốt lõi (Tài khoản, Upload PDF 20MB, Trích xuất PDF & OCR, Dịch thuật đa ngôn ngữ, Xuất file) được triển khai tại Sprint 1 - 3.
> - Các tính năng Gói Pro và Quản trị (AI Tóm tắt, Trợ lý AI RAG Chatbot, Lịch sử Pro, Giới hạn 100MB, Admin Console, Avatar, Billing) hoàn thành tại Sprint 4 - 6.
> - Kiểm thử tự động toàn diện (36 files test suites), an toàn bảo mật, triển khai website và nghiệm thu hoàn tất tại Sprint 7 & 8.

---

# 1. Danh sách 18 Epic tổng quan

Bảng dưới đây tổng hợp 18 Epic chính trong lộ trình phát triển của dự án PDF-Lingua:

| STT | Mã Epic | Tên Epic | Mục tiêu & Phạm vi chính | Trạng thái Jira |
| :---: | :--- | :--- | :--- | :---: |
| 01 | **EPIC 01** | Phân tích yêu cầu và thiết kế hệ thống | Khảo sát người dùng, xây dựng Use Case, Activity Diagram, kiến trúc hệ thống và mô hình dữ liệu ERD. | **Done** |
| 02 | **EPIC 02** | Khởi tạo dự án và môi trường phát triển | Thiết lập cấu trúc repo GitHub, môi trường Frontend/Backend, database, git convention và CI/CD cơ bản. | **Done** |
| 03 | **EPIC 03** | Thiết kế giao diện Frontend | Xây dựng bộ UI/UX, responsive cho trang chủ, upload PDF, giao diện đọc, dịch thuật, AI chat và quản trị. | `In Progress` |
| 04 | **EPIC 04** | Backend API và kiến trúc xử lý | Thiết kế module hóa kiến trúc FastAPI, chuẩn hóa request/response, CORS, logging và middleware xử lý lỗi. | **Done** |
| 05 | **EPIC 05** | Tài khoản, xác thực và phân quyền | Quản lý đăng ký, đăng nhập, JWT authentication, phân quyền (Guest, User, Admin) và bảo mật dữ liệu. | **Done** |
| 06 | **EPIC 06** | Tải lên và quản lý tài liệu PDF | Xây dựng API upload, kiểm tra tính hợp lệ/an toàn của PDF, lưu trữ file, quản lý dung lượng và xóa file tạm. | **Done** |
| 07 | **EPIC 07** | Trích xuất văn bản và OCR | Bóc tách text số từ PDF (pypdf/pdfplumber) và tích hợp OCR (Tesseract/EasyOCR) xử lý PDF scan dạng ảnh. | **Done** |
| 08 | **EPIC 08** | Dịch thuật đa ngôn ngữ | Dịch thuật đoạn văn/tài liệu sang nhiều ngôn ngữ, phát hiện ngôn ngữ tự động và tối ưu thời gian phản hồi. | **Done** |
| 09 | **EPIC 09** | AI tóm tắt văn bản | Tích hợp mô hình AI để tóm tắt ý chính tài liệu PDF theo nhiều độ dài hoặc danh sách gạch đầu dòng. | **Done** |
| 10 | **EPIC 10** | Trợ lý AI hỏi đáp tài liệu | Trò chuyện, giải đáp thắc mắc trực tiếp dựa trên ngữ cảnh nội dung của tài liệu (RAG/Document QA). | **Done** |
| 11 | **EPIC 11** | Xuất và tải kết quả | Xuất văn bản trích xuất, kết quả dịch và tóm tắt ra các định dạng TXT, PDF, sao chép vào clipboard. | **Done** |
| 12 | **EPIC 12** | Lịch sử xử lý tài liệu | Lưu trữ và hiển thị danh sách các tài liệu đã tải lên, bản dịch đã thực hiện để người dùng xem lại. | **Done** |
| 13 | **EPIC 13** | Gói Free/Pro và hạn mức sử dụng | Phân chia hạn mức dung lượng (20MB vs 100MB), số trang, lượt gọi AI/OCR giữa gói Free và Pro. | `In Progress` |
| 14 | **EPIC 14** | Quản trị hệ thống Admin | Dashboard quản trị người dùng, theo dõi trạng thái tài khoản, nâng cấp/hạ cấp gói Pro và ghi log quản trị. | `In Progress` |
| 15 | **EPIC 15** | Kiểm thử, bảo mật và tối ưu | Viết Unit/Integration tests, kiểm thử an toàn file, SQL injection, XSS, rate limit và tối ưu hiệu năng. | `In Progress` |
| 16 | **EPIC 16** | Triển khai, tài liệu và bàn giao | Triển khai Frontend & Backend lên server/cloud, viết tài liệu README, API docs và chuẩn bị demo. | `In Progress` |
| 17 | **EPIC 17** | Tính năng mở rộng & Nâng cao trải nghiệm người dùng | Các tính năng giá trị gia tăng (xử lý file theo lô batch, tải DOCX, xem trước PDF, đa ngôn ngữ, avatar, billing,...). | `In Progress` |
| 18 | **EPIC 18** | Các hình thức quảng cáo cho người dùng và kiếm tiền | Chiến lược kiếm tiền từ quảng cáo, tích hợp gói dịch vụ bổ sung, điều chỉnh gói Pro và tối ưu doanh thu. | `In Progress` |

---

# 2. Danh Sách Task Chi Tiết Theo Từng Epic

## EPIC 01 - Phân tích yêu cầu và thiết kế hệ thống
- **Mô tả phạm vi**: Khảo sát người dùng, xây dựng Use Case, Activity Diagram, kiến trúc hệ thống và mô hình dữ liệu ERD.
- **Khối lượng công việc**: `10 Tasks` | `32 Story Points` (Đã hoàn thành: `32/32 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-1` | Xác định các đối tượng sử dụng hệ thống: khách chưa đăng nhập, tài khoản Free, tài khoản Pro và Admin. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 20/10/2026 | **Done** |
| `PDFL-2` | Chốt danh sách chức năng chính và chức năng mở rộng. | 5 | High | Huỳnh Đình Chấn | Sprint 1 | 27/10/2026 | **Done** |
| `PDFL-3` | Xác định quyền lợi, giới hạn và điểm khác nhau giữa gói Free và Pro. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 20/10/2026 | **Done** |
| `PDFL-4` | Xác định quy trình xử lý tài liệu từ lúc tải PDF lên đến khi xuất kết quả. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |
| `PDFL-21` | Xây dựng Use Case Diagram. | 3 | Medium | Huỳnh Đình Chấn | Sprint 1 | 27/10/2026 | **Done** |
| `PDFL-22` | Xây dựng sơ đồ hoạt động cho các luồng quan trọng như trích xuất, dịch thuật, AI và nâng cấp gói. | 3 | High | Huỳnh Đình Chấn | Sprint 1 | 27/10/2026 | **Done** |
| `PDFL-23` | Thiết kế kiến trúc tổng thể: Frontend, Backend, database, dịch vụ OCR và dịch vụ AI. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 21/10/2026 | **Done** |
| `PDFL-24` | Thiết kế ERD và mô hình dữ liệu. | 5 | Medium | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |
| `PDFL-25` | Thống nhất cấu trúc API giữa Frontend và Backend. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |
| `PDFL-26` | Xác định các yêu cầu phi chức năng: hiệu năng, bảo mật, khả năng mở rộng và trải nghiệm người dùng. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |

## EPIC 02 - Khởi tạo dự án và môi trường phát triển
- **Mô tả phạm vi**: Thiết lập cấu trúc repo GitHub, môi trường Frontend/Backend, database, git convention và CI/CD cơ bản.
- **Khối lượng công việc**: `12 Tasks` | `33 Story Points` (Đã hoàn thành: `33/33 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-27` | Tạo repository GitHub | 1 | Highest | Nguyễn Lê Huy Tâm | Sprint 1 | 20/10/2026 | **Done** |
| `PDFL-28` | Xây dựng cấu trúc thư mục Frontend và Backend. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 20/10/2026 | **Done** |
| `PDFL-29` | Khởi tạo ứng dụng Frontend bằng HTML, CSS và JavaScript. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |
| `PDFL-30` | Khởi tạo Backend bằng Python và FastAPI. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |
| `PDFL-31` | Cấu hình môi trường Python và requirements.txt hoặc pyproject.toml | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |
| `PDFL-32` | Cấu hình các biến môi trường trong .env. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |
| `PDFL-33` | Tạo .env.example và cấu hình .gitignore và gitattributes | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 1 | 20/10/2026 | **Done** |
| `PDFL-34` | Cấu hình kết nối database. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 20/10/2026 | **Done** |
| `PDFL-35` | Thiết lập quy tắc đặt tên branch, commit và Pull Request. | 2 | Highest | Nguyễn Lê Huy Tâm | Sprint 1 | 20/10/2026 | **Done** |
| `PDFL-36` | Xây dựng API kiểm tra tình trạng hoạt động của Backend. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |
| `PDFL-37` | Cấu hình môi trường phát triển để Frontend giao tiếp với Backend. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |
| `PDFL-38` | Kiểm tra khởi chạy toàn bộ dự án trên máy phát triển. | 5 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |

## EPIC 03 - Thiết kế giao diện Frontend
- **Mô tả phạm vi**: Xây dựng bộ UI/UX, responsive cho trang chủ, upload PDF, giao diện đọc, dịch thuật, AI chat và quản trị.
- **Khối lượng công việc**: `27 Tasks` | `81 Story Points` (Đã hoàn thành: `81/81 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-39` | Xác định phong cách thiết kế, màu sắc, font chữ và bộ quy chuẩn giao diện. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 1 | 22/10/2026 | **Done** |
| `PDFL-40` | Thiết kế thanh điều hướng và bố cục chung của ứng dụng. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 1 | 24/10/2026 | **Done** |
| `PDFL-41` | Xây dựng trang chủ giới thiệu PDF Lingua và các tính năng. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 1 | 24/10/2026 | **Done** |
| `PDFL-42` | Xây dựng trang đăng ký tài khoản. | 3 | Highest | Huỳnh Đình Chấn | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-43` | Xây dựng trang đăng nhập. | 3 | Highest | Huỳnh Đình Chấn | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-44` | Xây dựng trang thông tin tài khoản. | 3 | Highest | Huỳnh Đình Chấn | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-45` | Xây dựng giao diện tải tài liệu PDF. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 28/10/2026 | **Done** |
| `PDFL-46` | Xây dựng giao diện hiển thị tiến trình tải lên và xử lý tài liệu. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-47` | Xây dựng giao diện hiển thị văn bản sau khi trích xuất. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-48` | Xây dựng giao diện chọn ngôn ngữ nguồn và ngôn ngữ đích. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-49` |  Xây dựng giao diện hiển thị bản dịch. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-50` | Xây dựng giao diện tóm tắt văn bản bằng AI. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 12/11/2026 | **Done** |
| `PDFL-51` | Xây dựng giao diện trò chuyện với trợ lý AI. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 12/11/2026 | **Done** |
| `PDFL-52` | Xây dựng giao diện so sánh hoặc chuyển đổi giữa văn bản gốc và bản dịch. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-53` | Xây dựng giao diện lịch sử xử lý tài liệu. | 3 | High | Huỳnh Đình Chấn | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-54` | Xây dựng trang giới thiệu và so sánh gói Free/Pro. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-55` | Xây dựng giao diện nâng cấp gói Pro. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-56` | Xây dựng giao diện quản trị Admin. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-57` | Thiết kế trạng thái loading, lỗi, thành công và giao diện khi chưa có dữ liệu. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 28/10/2026 | **Done** |
| `PDFL-58` | Đảm bảo giao diện responsive trên máy tính, máy tính bảng và điện thoại. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 1 | 24/10/2026 | **Done** |
| `PDFL-59` | Kiểm tra tính nhất quán về thiết kế và khả năng sử dụng. | 3 | Highest | Huỳnh Đình Chấn | Sprint 3 | 07/11/2026 | **Done** |
| `PDFL-267` | Điều khoản và bảo mật cho người dùng | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 29/10/2026 | **Done** |
| `PDFL-273` | Xây dựng giao diện tải lên, cắt ảnh và hiển thị avatar người dùng | 3 | Medium | Huỳnh Đình Chấn | Sprint 5 | 17/11/2026 | **Done** |
| `PDFL-275` | Xây dựng giao diện xem Lịch sử giao dịch, hóa đơn và trạng thái thanh toán Pro (Billing) | 3 | High | Huỳnh Đình Chấn | Sprint 5 | 23/11/2026 | **Done** |
| `PDFL-276` | Xây dựng giao diện hiển thị mức độ sử dụng, trạng thái gói cho Pro | 3 | High | Huỳnh Đình Chấn | Sprint 5 | 23/11/2026 | **Done** |
| `PDFL-280` | RBAC for UI/UX frontend and benefit update | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 20/11/2026 | **Done** |
| `PDFL-294` | Small tabs/frontend in Admin console for tracking visitors and transition | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | 26/11/2026 | **Done** |

## EPIC 04 - Backend API và kiến trúc xử lý
- **Mô tả phạm vi**: Thiết kế module hóa kiến trúc FastAPI, chuẩn hóa request/response, CORS, logging và middleware xử lý lỗi.
- **Khối lượng công việc**: `12 Tasks` | `36 Story Points` (Đã hoàn thành: `36/36 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-60` | Thiết kế cấu trúc module Backend theo từng nhóm chức năng. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 1 | 23/10/2026 | **Done** |
| `PDFL-61` |  Xây dựng các lớp xử lý nghiệp vụ, truy cập dữ liệu và giao tiếp API. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 1 | 23/10/2026 | **Done** |
| `PDFL-62` | Chuẩn hóa cấu trúc request và response của API. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 1 | 24/10/2026 | **Done** |
| `PDFL-63` |  Xây dựng cơ chế xác thực request và xử lý lỗi chung. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 24/10/2026 | **Done** |
| `PDFL-64` | Cấu hình CORS cho môi trường phát triển và triển khai. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 23/10/2026 | **Done** |
| `PDFL-65` |  Xây dựng API lấy thông tin người dùng hiện tại. | 3 | High | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-66` |  Xây dựng API kiểm tra quyền sử dụng tính năng. | 3 | High | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-67` |  Xây dựng API kiểm tra giới hạn upload, AI và các hạn mức khác. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 15/11/2026 | **Done** |
| `PDFL-68` | Chuẩn hóa HTTP status code và thông báo lỗi. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 24/10/2026 | **Done** |
| `PDFL-69` |  Xây dựng tài liệu API bằng OpenAPI/Swagger của FastAPI. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 23/10/2026 | **Done** |
| `PDFL-70` | Thiết lập logging để theo dõi lỗi và hoạt động xử lý. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 1 | 24/10/2026 | **Done** |
| `PDFL-71` | Xử lý các tác vụ mất nhiều thời gian mà không khóa toàn bộ ứng dụng. | 3 | High | Huỳnh Đình Chấn | Sprint 5 | 15/11/2026 | **Done** |

## EPIC 05 - Tài khoản, xác thực và phân quyền
- **Mô tả phạm vi**: Quản lý đăng ký, đăng nhập, JWT authentication, phân quyền (Guest, User, Admin) và bảo mật dữ liệu.
- **Khối lượng công việc**: `13 Tasks` | `39 Story Points` (Đã hoàn thành: `39/39 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-72` |  Thiết kế bảng dữ liệu tài khoản người dùng. | 3 | Highest | Huỳnh Đình Chấn | Sprint 2 | 26/10/2026 | **Done** |
| `PDFL-73` | Xây dựng chức năng đăng ký tài khoản. | 3 | Highest | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-74` | Kiểm tra email và thông tin đăng ký hợp lệ. | 3 | High | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-75` |  Mã hóa mật khẩu trước khi lưu vào database. | 3 | High | Huỳnh Đình Chấn | Sprint 2 | 29/10/2026 | **Done** |
| `PDFL-76` |  Xây dựng chức năng đăng nhập. | 3 | Highest | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-77` |  Xây dựng cơ chế quản lý phiên đăng nhập hoặc token. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-78` | Xây dựng chức năng đăng xuất. | 3 | Highest | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-79` |  Xây dựng chức năng xem và cập nhật thông tin tài khoản. | 3 | Highest | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-80` | Xây dựng chức năng đổi mật khẩu. | 3 | Highest | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-81` |  Kiểm soát quyền truy cập của khách, người dùng đã đăng nhập và Admin. | 3 | Highest | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-82` | Kiểm tra quyền truy cập khi người dùng gọi trực tiếp API, không chỉ ẩn chức năng trên giao diện. | 3 | Medium | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-83` | Xử lý trường hợp token hết hạn, tài khoản không tồn tại hoặc thông tin đăng nhập sai. | 3 | High | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |
| `PDFL-84` |  Kiểm tra khả năng truy cập và chỉnh sửa dữ liệu của người dùng khác. | 3 | Medium | Huỳnh Đình Chấn | Sprint 2 | 30/10/2026 | **Done** |

## EPIC 06 - Tải lên và quản lý tài liệu PDF
- **Mô tả phạm vi**: Xây dựng API upload, kiểm tra tính hợp lệ/an toàn của PDF, lưu trữ file, quản lý dung lượng và xóa file tạm.
- **Khối lượng công việc**: `14 Tasks` | `39 Story Points` (Đã hoàn thành: `39/39 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-85` |  Xây dựng API tải tài liệu PDF lên Backend. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-86` |  Kiểm tra loại file và nội dung file để hạn chế file giả mạo định dạng PDF. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-87` |  Áp dụng giới hạn dung lượng: Free tối đa 20 MB/tệp, Pro tối đa 100 MB/tệp. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-88` | Kiểm tra PDF bị hỏng, có mật khẩu hoặc không thể đọc. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-89` | Thiết lập giới hạn số trang được phép xử lý. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 29/10/2026 | **Done** |
| `PDFL-90` |  Lưu trữ file trong thư mục hoặc dịch vụ lưu trữ được cấu hình. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 03/11/2026 | **Done** |
| `PDFL-91` |  Ghi nhận metadata của tài liệu như tên file, dung lượng, số trang, thời gian tải lên và chủ sở hữu. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 03/11/2026 | **Done** |
| `PDFL-92` | Hiển thị danh sách tài liệu của người dùng. | 3 | High | Huỳnh Đình Chấn | Sprint 3 | 07/11/2026 | **Done** |
| `PDFL-93` |  Xem thông tin chi tiết của một tài liệu. | 3 | High | Huỳnh Đình Chấn | Sprint 3 | 07/11/2026 | **Done** |
| `PDFL-94` |  Xây dựng chức năng xóa tài liệu. | 3 | High | Huỳnh Đình Chấn | Sprint 3 | 07/11/2026 | **Done** |
| `PDFL-95` |  Kiểm soát quyền tải xuống và truy cập file. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 3 | 03/11/2026 | **Done** |
| `PDFL-96` |  Xử lý lỗi khi tải file, mất kết nối hoặc quá giới hạn. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-97` | Xóa các file tạm khi hoàn tất xử lý hoặc khi xảy ra lỗi. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-98` | Đảm bảo tài liệu riêng tư không bị người dùng khác truy cập. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 3 | 03/11/2026 | **Done** |

## EPIC 07 - Trích xuất văn bản và OCR
- **Mô tả phạm vi**: Bóc tách text số từ PDF (pypdf/pdfplumber) và tích hợp OCR (Tesseract/EasyOCR) xử lý PDF scan dạng ảnh.
- **Khối lượng công việc**: `14 Tasks` | `42 Story Points` (Đã hoàn thành: `42/42 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-99` |  Tích hợp thư viện PyMuPDF để đọc và trích xuất văn bản. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-100` | Trích xuất văn bản theo từng trang. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-101` | Xử lý xuống dòng, khoảng trắng và ký tự bất thường. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-102` | Giữ thứ tự văn bản hợp lý khi tài liệu có nhiều đoạn hoặc nhiều cột. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 29/10/2026 | **Done** |
| `PDFL-103` | Phát hiện tài liệu có ít hoặc không có văn bản trích xuất được. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-104` | Tích hợp Tesseract OCR để nhận diện văn bản từ PDF scan | 5 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-105` | Cấu hình dữ liệu ngôn ngữ OCR cần hỗ trợ, ưu tiên tiếng Việt và tiếng Anh. | 5 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-106` | Kết hợp kết quả OCR với cơ chế trích xuất văn bản thông thường. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-107` | Xây dựng API trả về nội dung văn bản được trích xuất. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 2 | 27/10/2026 | **Done** |
| `PDFL-108` | Hiển thị kết quả trích xuất trên giao diện. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-109` | Xử lý tài liệu có trang trống, trang bị xoay hoặc hình ảnh chất lượng thấp. | 2 | High | Huỳnh Đình Chấn | Sprint 3 | 04/11/2026 | **Done** |
| `PDFL-110` | Kiểm thử độ chính xác với PDF thông thường và PDF scan. | 2 | High | Huỳnh Đình Chấn | Sprint 3 | 04/11/2026 | **Done** |
| `PDFL-111` | Tối ưu thời gian xử lý đối với tài liệu nhiều trang. | 3 | High | Huỳnh Đình Chấn | Sprint 3 | 04/11/2026 | **Done** |
| `PDFL-112` | Trả thông báo rõ ràng khi không trích xuất được nội dung. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |

## EPIC 08 - Dịch thuật đa ngôn ngữ
- **Mô tả phạm vi**: Dịch thuật đoạn văn/tài liệu sang nhiều ngôn ngữ, phát hiện ngôn ngữ tự động và tối ưu thời gian phản hồi.
- **Khối lượng công việc**: `14 Tasks` | `44 Story Points` (Đã hoàn thành: `44/44 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-113` | Lựa chọn thư viện hoặc dịch vụ dịch thuật | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-114` | Xác định danh sách ngôn ngữ nguồn và ngôn ngữ đích được hỗ trợ. | 5 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-115` | Xây dựng chức năng tự động nhận diện ngôn ngữ nguồn nếu dịch vụ hỗ trợ. | 5 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-116` | Xây dựng giao diện chọn ngôn ngữ. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-117` | Xây dựng API dịch văn bản. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-118` | Chia văn bản dài thành các đoạn phù hợp với giới hạn của dịch vụ. | 5 | Highest | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-119` | Giữ thứ tự các đoạn khi ghép kết quả dịch. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-120` | Xử lý lỗi mạng, giới hạn API và lỗi dịch thuật. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 4 | 03/11/2026 | **Done** |
| `PDFL-121` | Hiển thị bản dịch kèm thông tin ngôn ngữ. | 1 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-122` | Cho phép sao chép bản dịch. | 1 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-123` | Kiểm thử các trường hợp dịch tiếng Việt, tiếng Anh và các ngôn ngữ được lựa chọn. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 4 | 03/11/2026 | **Done** |
| `PDFL-124` | Đánh giá khả năng giữ nguyên đoạn văn, danh sách và nội dung quan trọng khi dịch. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 4 | 03/11/2026 | **Done** |
| `PDFL-125` | Đảm bảo hệ thống không làm mất hoặc đảo thứ tự đoạn khi dịch tài liệu dài. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 4 | 03/11/2026 | **Done** |
| `PDFL-266` | Tích hợp thư viện dịch thuật `deep-translator` | 3 | Medium | Nguyễn Lê Huy Tâm | Backlog | 16/11/2026 | **Done** |

## EPIC 09 - AI tóm tắt văn bản
- **Mô tả phạm vi**: Tích hợp mô hình AI để tóm tắt ý chính tài liệu PDF theo nhiều độ dài hoặc danh sách gạch đầu dòng.
- **Khối lượng công việc**: `12 Tasks` | `32 Story Points` (Đã hoàn thành: `32/32 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-126` | Lựa chọn mô hình AI hoặc dịch vụ API phù hợp. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 12/11/2026 | **Done** |
| `PDFL-127` | Quản lý API key thông qua biến môi trường. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 12/11/2026 | **Done** |
| `PDFL-128` | Xây dựng cấu trúc prompt tóm tắt văn bản. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 14/11/2026 | **Done** |
| `PDFL-129` | Xây dựng API tóm tắt nội dung tài liệu. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 14/11/2026 | **Done** |
| `PDFL-130` | Hỗ trợ lựa chọn độ dài hoặc kiểu tóm tắt nếu mô hình cho phép. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-131` | Hỗ trợ tóm tắt văn bản dài bằng cách chia đoạn hoặc tóm tắt nhiều bước. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-132` | Hiển thị nội dung tóm tắt trên giao diện. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 14/11/2026 | **Done** |
| `PDFL-133` | Cho phép sao chép kết quả tóm tắt. | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 6 | 12/11/2026 | **Done** |
| `PDFL-134` | Kiểm tra quyền sử dụng AI của tài khoản Pro. | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-135` | Kiểm soát số lượt sử dụng, lượng văn bản đầu vào và chi phí. | 2 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-136` | Xử lý lỗi khi dịch vụ AI không phản hồi hoặc vượt giới hạn. | 2 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-137` | Kiểm thử chất lượng tóm tắt trên các loại tài liệu khác nhau. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |

## EPIC 10 - Trợ lý AI hỏi đáp tài liệu
- **Mô tả phạm vi**: Trò chuyện, giải đáp thắc mắc trực tiếp dựa trên ngữ cảnh nội dung của tài liệu (RAG/Document QA).
- **Khối lượng công việc**: `12 Tasks` | `36 Story Points` (Đã hoàn thành: `36/36 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-138` | Xác định phạm vi câu hỏi mà trợ lý AI có thể xử lý. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-139` | Xây dựng API gửi câu hỏi về tài liệu. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 12/11/2026 | **Done** |
| `PDFL-140` | Cung cấp nội dung tài liệu liên quan làm ngữ cảnh cho AI. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 14/11/2026 | **Done** |
| `PDFL-141` | Xử lý tài liệu dài bằng cách chọn các đoạn liên quan trước khi gửi cho AI. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 14/11/2026 | **Done** |
| `PDFL-142` | Xây dựng giao diện khung chat. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 12/11/2026 | **Done** |
| `PDFL-143` | Hiển thị câu hỏi và câu trả lời theo thứ tự hội thoại. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 12/11/2026 | **Done** |
| `PDFL-144` | Xử lý trạng thái AI đang suy nghĩ, câu trả lời lỗi và yêu cầu thử lại. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-145` | Giới hạn số lượt hỏi đáp hoặc lượng nội dung theo gói dịch vụ. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 12/11/2026 | **Done** |
| `PDFL-146` | Đảm bảo câu trả lời dựa trên nội dung tài liệu khi người dùng hỏi về tài liệu. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 14/11/2026 | **Done** |
| `PDFL-147` | Xử lý trường hợp tài liệu không có thông tin để trả lời. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 6 | 14/11/2026 | **Done** |
| `PDFL-148` | Kiểm soát quyền truy cập để người dùng không hỏi hoặc truy xuất tài liệu của người khác. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-149` | Kiểm thử khả năng trả lời đúng nội dung, hạn chế bịa đặt và xử lý câu hỏi ngoài phạm vi. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |

## EPIC 11 - Xuất và tải kết quả
- **Mô tả phạm vi**: Xuất văn bản trích xuất, kết quả dịch và tóm tắt ra các định dạng TXT, PDF, sao chép vào clipboard.
- **Khối lượng công việc**: `9 Tasks` | `23 Story Points` (Đã hoàn thành: `23/23 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-150` | Xác định các loại kết quả có thể xuất: văn bản gốc, bản dịch và bản tóm tắt. | 3 | Medium | Huỳnh Đình Chấn | Sprint 4 | 11/11/2026 | **Done** |
| `PDFL-151` | Xây dựng chức năng xuất văn bản thành file TXT. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-152` | Xây dựng chức năng xuất nội dung thành file PDF. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-153` | Xây dựng chức năng tải file kết quả về thiết bị người dùng. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 3 | 01/11/2026 | **Done** |
| `PDFL-154` | Đặt tên file kết quả theo tài liệu, ngôn ngữ hoặc loại nội dung. | 1 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-155` | Đảm bảo tiếng Việt và Unicode được hiển thị đúng trong file xuất. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 3 | 02/11/2026 | **Done** |
| `PDFL-156` | Xử lý trường hợp nội dung rỗng hoặc không có kết quả. | 3 | Highest | Huỳnh Đình Chấn | Sprint 4 | 11/11/2026 | **Done** |
| `PDFL-157` | Kiểm tra quyền tải xuống và quyền truy cập kết quả. | 3 | Medium | Huỳnh Đình Chấn | Sprint 4 | 11/11/2026 | **Done** |
| `PDFL-158` | Kiểm thử file xuất trên các trình đọc file thông dụng. | 3 | Medium | Huỳnh Đình Chấn | Sprint 4 | 11/11/2026 | **Done** |

## EPIC 12 - Lịch sử xử lý tài liệu
- **Mô tả phạm vi**: Lưu trữ và hiển thị danh sách các tài liệu đã tải lên, bản dịch đã thực hiện để người dùng xem lại.
- **Khối lượng công việc**: `12 Tasks` | `33 Story Points` (Đã hoàn thành: `33/33 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-159` | Thiết kế bảng dữ liệu lưu lịch sử xử lý. | 3 | High | Huỳnh Đình Chấn | Sprint 4 | 10/11/2026 | **Done** |
| `PDFL-160` | Lưu thông tin tài liệu và loại thao tác đã thực hiện. | 3 | High | Huỳnh Đình Chấn | Sprint 4 | 10/11/2026 | **Done** |
| `PDFL-161` | Lưu kết quả trích xuất, dịch thuật hoặc tóm tắt theo phạm vi chức năng đã thống nhất. | 3 | High | Huỳnh Đình Chấn | Sprint 4 | 10/11/2026 | **Done** |
| `PDFL-162` | Xây dựng API lấy danh sách lịch sử. | 3 | High | Huỳnh Đình Chấn | Sprint 4 | 10/11/2026 | **Done** |
| `PDFL-163` | Xây dựng API xem chi tiết một bản ghi lịch sử. | 3 | High | Huỳnh Đình Chấn | Sprint 4 | 10/11/2026 | **Done** |
| `PDFL-164` | Hiển thị lịch sử trên giao diện | 3 | Medium | Huỳnh Đình Chấn | Sprint 4 | 10/11/2026 | **Done** |
| `PDFL-165` | Cho phép mở lại kết quả đã lưu. | 2 | Medium | Huỳnh Đình Chấn | Sprint 4 | 10/11/2026 | **Done** |
| `PDFL-166` | Cho phép xóa lịch sử theo chính sách lưu trữ. | 3 | Medium | Huỳnh Đình Chấn | Sprint 4 | 10/11/2026 | **Done** |
| `PDFL-167` | Chỉ cho phép tài khoản Pro sử dụng chức năng lịch sử nếu đây là quyền lợi đã chốt. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-168` | Kiểm soát quyền truy cập lịch sử theo tài khoản. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-169` | Xác định thời gian lưu trữ và cách xóa dữ liệu khi cần. | 2 | High | Huỳnh Đình Chấn | Sprint 5 | 15/11/2026 | **Done** |
| `PDFL-170` | Kiểm thử khả năng lưu, truy vấn, mở lại và xóa lịch sử. | 3 | Medium | Huỳnh Đình Chấn | Sprint 5 | 11/11/2026 | **Done** |

## EPIC 13 - Gói Free/Pro và hạn mức sử dụng
- **Mô tả phạm vi**: Phân chia hạn mức dung lượng (20MB vs 100MB), số trang, lượt gọi AI/OCR giữa gói Free và Pro.
- **Khối lượng công việc**: `19 Tasks` | `46 Story Points` (Đã hoàn thành: `44/46 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-171` | Thiết kế dữ liệu gói dịch vụ và trạng thái đăng ký của người dùng. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-172` | Xác định quyền lợi cụ thể của gói Free. | 2 | Highest | Nguyễn Lê Huy Tâm | Sprint 4 | 03/11/2026 | **Done** |
| `PDFL-173` | Xác định quyền lợi cụ thể của gói Pro. | 2 | Highest | Nguyễn Lê Huy Tâm | Sprint 4 | 05/11/2026 | **Done** |
| `PDFL-174` | Hiển thị gói hiện tại của người dùng. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-175` | Xây dựng cơ chế kiểm tra gói dịch vụ ở Backend. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-176` | Giới hạn tải lên tối đa 20 MB/tệp đối với Free. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 4 | 03/11/2026 | **Done** |
| `PDFL-177` | Giới hạn tải lên tối đa 100 MB/tệp đối với Pro. | 2 | High | Huỳnh Đình Chấn | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-178` | Xác định và thực thi giới hạn số trang PDF cho từng gói. | 3 | Medium | Huỳnh Đình Chấn | Sprint 4 | 11/11/2026 | **Done** |
| `PDFL-179` | Xác định hạn mức OCR, dịch thuật và AI theo gói. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-180` | Chặn hoặc thông báo khi người dùng vượt hạn mức. | 2 | High | Huỳnh Đình Chấn | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-181` | Xây dựng trang so sánh quyền lợi Free và Pro. | 2 | Highest | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-182` | Xây dựng luồng yêu cầu nâng cấp lên Pro. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-183` | Cập nhật quyền sử dụng khi tài khoản được nâng cấp hoặc hạ cấp. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-184` | Hiển thị thông báo nâng cấp khi người dùng truy cập tính năng dành cho Pro. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-185` | Kiểm thử việc áp dụng hạn mức ở Backend, kể cả khi người dùng gọi API trực tiếp. | 3 | Medium | Huỳnh Đình Chấn | Sprint 4 | 11/11/2026 | **Done** |
| `PDFL-274` | Xây dựng API lấy danh sách lịch sử giao dịch thanh toán của người dùng (Billing) | 3 | High | Huỳnh Đình Chấn | Sprint 5 | 23/11/2026 | **Done** |
| `PDFL-292` | Pro plan adjustment | 2 | Medium | Huỳnh Đình Chấn | Sprint 7 | - | To Do |
| `PDFL-296` | Upgrade to Pro for free via the "/simulate" endpoint | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | 27/11/2026 | **Done** |
| `PDFL-298` | The webhook accepts a "pending" status and skips the amount check | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | 27/11/2026 | **Done** |

## EPIC 14 - Quản trị hệ thống Admin
- **Mô tả phạm vi**: Dashboard quản trị người dùng, theo dõi trạng thái tài khoản, nâng cấp/hạ cấp gói Pro và ghi log quản trị.
- **Khối lượng công việc**: `15 Tasks` | `40 Story Points` (Đã hoàn thành: `40/40 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-186` | Xác định vai trò và quyền hạn của Admin. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 4 | 03/11/2026 | **Done** |
| `PDFL-187` | Thiết lập cách khởi tạo tài khoản Admin an toàn. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-188` | Xây dựng trang tổng quan quản trị. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 4 | 04/11/2026 | **Done** |
| `PDFL-189` | Hiển thị danh sách tài khoản người dùng. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 4 | 04/11/2026 | **Done** |
| `PDFL-190` | Tìm kiếm và lọc tài khoản theo thông tin phù hợp. | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-191` | Xem thông tin và trạng thái tài khoản. | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-192` | Theo dõi trạng thái gói Free/Pro. | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-193` | Cấp, gia hạn, hạ cấp hoặc thu hồi quyền Pro theo quy định của hệ thống. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-194` | Khóa hoặc mở khóa tài khoản khi cần. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 4 | 04/11/2026 | **Done** |
| `PDFL-195` | Kiểm soát quyền Admin ở Backend. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-196` | Ghi nhận nhật ký các thao tác quản trị quan trọng. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-197` | Xử lý thông báo xác nhận trước những thao tác có ảnh hưởng lớn. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 4 | 04/11/2026 | **Done** |
| `PDFL-198` | Kiểm thử quyền Admin và đảm bảo tài khoản thường không thể truy cập chức năng quản trị. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 4 | 04/11/2026 | **Done** |
| `PDFL-293` | Allowing admin to track visitors and transition | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | 26/11/2026 | **Done** |
| `PDFL-297` | Admin's rejection not working properly | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | 27/11/2026 | **Done** |

## EPIC 15 - Kiểm thử, bảo mật và tối ưu
- **Mô tả phạm vi**: Viết Unit/Integration tests, kiểm thử an toàn file, SQL injection, XSS, rate limit và tối ưu hiệu năng.
- **Khối lượng công việc**: `35 Tasks` | `110 Story Points` (Đã hoàn thành: `94/110 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-199` | Xây dựng danh sách test case theo yêu cầu chức năng. | 5 | High | Huỳnh Đình Chấn | Sprint 7 | - | `In Progress` |
| `PDFL-200` | Viết unit test cho các hàm xử lý nghiệp vụ quan trọng. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-201` | Kiểm thử API upload, trích xuất, OCR, dịch thuật và AI. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-202` | Kiểm thử đăng ký, đăng nhập, phân quyền và gói Free/Pro. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-203` | Kiểm thử lịch sử, xuất file và chức năng Admin. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-204` | Kiểm thử tích hợp toàn bộ luồng từ tải PDF đến tải kết quả. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-205` | Kiểm thử giao diện trên các kích thước màn hình khác nhau. | 3 | High | Huỳnh Đình Chấn | Sprint 6 | 25/11/2026 | **Done** |
| `PDFL-206` | Kiểm thử các trường hợp lỗi và trường hợp biên. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-207` | Kiểm thử PDF văn bản thông thường. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 4 | 03/11/2026 | **Done** |
| `PDFL-208` | Kiểm thử PDF scan. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-209` | Kiểm thử PDF tiếng Việt có dấu và tài liệu đa ngôn ngữ. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-210` | Kiểm thử PDF nhiều trang, nhiều cột hoặc bố cục phức tạp. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-211` | Kiểm thử PDF bị hỏng, có mật khẩu hoặc không thể đọc. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-212` | Kiểm thử file nhỏ, file sát giới hạn và file vượt giới hạn dung lượng. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-213` | Kiểm thử tài liệu dài khi dịch thuật, tóm tắt và hỏi đáp AI. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-214` | Kiểm tra an toàn file tải lên và ngăn việc truy cập file ngoài phạm vi cho phép. | 5 | Medium | Huỳnh Đình Chấn | Sprint 4 | 11/11/2026 | **Done** |
| `PDFL-215` | Đảm bảo mật khẩu không được lưu dưới dạng văn bản thuần. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-216` | Đảm bảo API key và thông tin nhạy cảm không bị đưa lên GitHub. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-217` | Kiểm tra xác thực và phân quyền trên các API riêng tư. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-218` | Giới hạn tần suất request phù hợp để giảm lạm dụng. | 3 | Highest | Huỳnh Đình Chấn | Sprint 7 | - | `In Progress` |
| `PDFL-219` | Kiểm soát dung lượng, số trang, bộ nhớ và thời gian xử lý PDF. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-220` | Ngăn tài liệu hoặc lịch sử của người dùng này bị truy cập bởi người dùng khác. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-221` | Xác định chính sách lưu trữ, xóa và bảo vệ dữ liệu người dùng. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-222` | Hạn chế nội dung không đáng tin cậy trong tài liệu ảnh hưởng đến chỉ dẫn của trợ lý AI. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 7 | 24/11/2026 | **Done** |
| `PDFL-223` | Kiểm tra các lỗi phổ biến như SQL injection, XSS và truy cập trái phép. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-224` | Đánh giá thời gian trích xuất, OCR, dịch và xử lý AI. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-225` | Kiểm tra nhiều request đồng thời và giới hạn tài nguyên. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-226` | Tối ưu quy trình đọc, xử lý và lưu file lớn. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-227` | Thiết lập thông báo lỗi, logging và cách khôi phục khi xử lý thất bại. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-281` | Simple CI/CD Workflow | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 6 | 20/11/2026 | **Done** |
| `PDFL-282` | Testing guests' features | 3 | High | Nguyễn Lê Huy Tâm | Sprint 7 | 20/11/2026 | **Done** |
| `PDFL-283` | Testing free users' features | 3 | Highest | Huỳnh Đình Chấn | Sprint 7 | - | `In Progress` |
| `PDFL-284` | Testing pro users' features | 5 | Highest | Huỳnh Đình Chấn | Sprint 7 | - | `In Progress` |
| `PDFL-285` | Testing admin's features | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 7 | 26/11/2026 | **Done** |
| `PDFL-299` | Fix secret key with a default fallback is exposed | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | 27/11/2026 | **Done** |

## EPIC 16 - Triển khai, tài liệu và bàn giao
- **Mô tả phạm vi**: Triển khai Frontend & Backend lên server/cloud, viết tài liệu README, API docs và chuẩn bị demo.
- **Khối lượng công việc**: `30 Tasks` | `87 Story Points` (Đã hoàn thành: `82/87 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-228` | Chọn nền tảng triển khai Frontend. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 7 | 24/11/2026 | **Done** |
| `PDFL-229` | Chọn nền tảng triển khai Backend Python. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 7 | 24/11/2026 | **Done** |
| `PDFL-230` | Chọn nơi lưu trữ PDF và file kết quả. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-231` | Thiết lập database cho môi trường triển khai. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-232` | Cấu hình biến môi trường và API key trên môi trường production. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-233` | Cấu hình CORS, domain và HTTPS nếu nền tảng hỗ trợ. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-234` | Cài đặt các thành phần cần thiết cho OCR trên server. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-235` | Kiểm thử ứng dụng trên môi trường triển khai thực tế. | 5 | High | Nguyễn Lê Huy Tâm | Sprint 7 | 24/11/2026 | **Done** |
| `PDFL-236` | Kiểm tra việc xử lý file lớn theo giới hạn đã công bố. | 3 | High | Huỳnh Đình Chấn | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-237` | Thiết lập kiểm tra tình trạng hoạt động và theo dõi lỗi. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-238` | Xác định phương án sao lưu và phục hồi database. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | 25/11/2026 | **Done** |
| `PDFL-239` | Kiểm tra quy trình cập nhật phiên bản và khôi phục khi triển khai lỗi. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 7 | 24/11/2026 | **Done** |
| `PDFL-240` | Viết README giới thiệu PDF Lingua. | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 4 | 03/11/2026 | **Done** |
| `PDFL-241` | Ghi rõ công nghệ sử dụng và yêu cầu cài đặt. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-242` | Hướng dẫn thiết lập môi trường chạy trên máy cá nhân. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-243` | Hướng dẫn cấu hình .env và các dịch vụ bên ngoài. | 2 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-244` | Mô tả cấu trúc thư mục và kiến trúc hệ thống. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-245` | Viết tài liệu API và ví dụ request/response. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 8 | 16/11/2026 | **Done** |
| `PDFL-246` | Cung cấp hình ảnh giao diện | 2 | High | Huỳnh Đình Chấn | Sprint 7 | - | `In Progress` |
| `PDFL-247` | Chuẩn bị dữ liệu PDF mẫu phục vụ demo. | 2 | Medium | Huỳnh Đình Chấn | Sprint 5 | 16/11/2026 | **Done** |
| `PDFL-248` | Viết báo cáo phân tích, thiết kế, hiện thực | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 7 | 23/11/2026 | **Done** |
| `PDFL-249` | Chuẩn bị slide thuyết trình (Powerpoint) | 3 | Medium | Huỳnh Đình Chấn | Sprint 7 | - | To Do |
| `PDFL-250` | Chuẩn bị kịch bản demo các chức năng chính. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | 24/11/2026 | **Done** |
| `PDFL-251` | Kiểm tra README, tài liệu, repository và loại bỏ API key hoặc dữ liệu nhạy cảm trước khi bàn giao. | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 7 | 24/11/2026 | **Done** |
| `PDFL-269` | Kiến trúc hệ thống (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 5 | 15/11/2026 | **Done** |
| `PDFL-270` | Lược đồ usecase (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | 5 | Highest | Huỳnh Đình Chấn | Sprint 5 | 11/11/2026 | **Done** |
| `PDFL-271` | Lược đồ lớp (Deadline chủ đề 3: Nộp thuyết minh chi tiết thiết kế) | 3 | Highest | Huỳnh Đình Chấn | Sprint 5 | 14/11/2026 | **Done** |
| `PDFL-279` | Hướng dẫn sử dụng web | 3 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 17/11/2026 | **Done** |
| `PDFL-287` | Viết báo cáo tổng kết đồ án (Words) | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | 24/11/2026 | **Done** |
| `PDFL-288` | Triển khai trên website | 5 | Highest | Nguyễn Lê Huy Tâm | Sprint 7 | 24/11/2026 | **Done** |

## EPIC 17 - Tính năng mở rộng & Nâng cao trải nghiệm người dùng
- **Mô tả phạm vi**: Các tính năng giá trị gia tăng (xử lý file theo lô batch, tải DOCX, xem trước PDF, đa ngôn ngữ, avatar, billing,...).
- **Khối lượng công việc**: `19 Tasks` | `60 Story Points` (Đã hoàn thành: `51/60 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-252` | Cho phép xử lý nhiều file PDF theo lô. | 2 | High | Huỳnh Đình Chấn | Sprint 5 | 15/11/2026 | **Done** |
| `PDFL-253` | Hỗ trợ kéo thả file vào giao diện. | 2 | Medium | Nguyễn Lê Huy Tâm | Sprint 3 | 03/11/2026 | **Done** |
| `PDFL-254` | Cho phép người dùng Pro tải kết quả dưới định dạng DOCX | 3 | High | Huỳnh Đình Chấn | Sprint 5 | 15/11/2026 | **Done** |
| `PDFL-255` | Cho phép chọn các trang cụ thể cần trích xuất hoặc dịch. | 3 | High | Huỳnh Đình Chấn | Sprint 5 | 15/11/2026 | **Done** |
| `PDFL-256` | Hỗ trợ xem trước PDF và chuyển trang ngay trên ứng dụng. | 2 | High | Huỳnh Đình Chấn | Sprint 5 | 15/11/2026 | **Done** |
| `PDFL-257` | Hỗ trợ lưu hoặc tải lại kết quả dịch theo từng trang. | 5 | Medium | Huỳnh Đình Chấn | Sprint 6 | 25/11/2026 | **Done** |
| `PDFL-258` | Bổ sung đặt lại mật khẩu qua email. | 3 | Lowest | Chưa phân công | Backlog | - | To Do |
| `PDFL-259` | Tích hợp thanh toán trực tuyến cho gói Pro. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-260` | Gửi thông báo về trạng thái xử lý tài liệu. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 4 | 03/11/2026 | **Done** |
| `PDFL-261` | Cho phép người dùng gửi phản hồi hoặc báo cáo lỗi. | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-262` | Bổ sung thống kê mức sử dụng dịch vụ. | 3 | High | Huỳnh Đình Chấn | Sprint 5 | 23/11/2026 | **Done** |
| `PDFL-263` | Cải thiện khả năng truy xuất nguồn cho câu trả lời AI bằng cách tham chiếu trang hoặc đoạn văn liên quan. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 17/11/2026 | **Done** |
| `PDFL-264` | Hỗ trợ nhiều chủ đề giao diện hoặc chế độ tối. | 3 | Low | Huỳnh Đình Chấn | Sprint 7 | - | To Do |
| `PDFL-265` | Xem xét sử dụng hàng đợi tác vụ cho các file lớn và quy trình OCR/AI kéo dài. | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 16/11/2026 | **Done** |
| `PDFL-272` | Thiết kế tính năng tải lên ảnh đại diện cho người dùng | 3 | Medium | Huỳnh Đình Chấn | Sprint 5 | 17/11/2026 | **Done** |
| `PDFL-277` | Trang web hỗ trợ ngôn ngữ Tiếng Anh | 8 | Highest | Nguyễn Lê Huy Tâm | Sprint 6 | 22/11/2026 | **Done** |
| `PDFL-278` | Welcome Dashboard (Landing page khi người dùng mới ấn vào web) | 3 | High | Nguyễn Lê Huy Tâm | Sprint 6 | 19/11/2026 | **Done** |
| `PDFL-286` | Bulk-adding PDF files not translating after uploading successfully | 2 | Highest | Huỳnh Đình Chấn | Sprint 7 | 25/11/2026 | **Done** |
| `PDFL-295` | Enhancing bug reports from users | 3 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | - | `In Progress` |

## EPIC 18 - Các hình thức quảng cáo cho người dùng và kiếm tiền
- **Mô tả phạm vi**: Chiến lược kiếm tiền từ quảng cáo, tích hợp gói dịch vụ bổ sung, điều chỉnh gói Pro và tối ưu doanh thu.
- **Khối lượng công việc**: `2 Tasks` | `7 Story Points` (Đã hoàn thành: `0/7 SP`)

| Mã Task | Tên nhiệm vụ / User Story | Story Points | Mức độ ưu tiên | Người thực hiện | Sprint | Ngày hoàn thành | Trạng thái |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| `PDFL-289` | Monetization strategy by using ads | 5 | Medium | Nguyễn Lê Huy Tâm | Sprint 7 | - | `In Progress` |
| `PDFL-291` | Add an extra paid plan (pricing plans) with better benefits | 2 | Medium | Huỳnh Đình Chấn | Sprint 7 | - | To Do |

