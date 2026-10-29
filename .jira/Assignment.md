# PDF-Lingua — Kế Hoạch Nhóm & Lộ Trình Phát Triển (Team Plan & Roadmap)

- **Dự án**: **PDF Lingua** – Ứng dụng web trích xuất văn bản từ tài liệu PDF, dịch thuật đa ngôn ngữ và tích hợp AI hỗ trợ người dùng, tóm tắt văn bản.
- **Jira Project Key**: `PDFL`
- **Jira Board & Summary**: [https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary](https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary)
- **Kế hoạch chi tiết 7 Sprint**: [Sprint_Plan.md](./Sprint_Plan.md)
- **Tài liệu Backlog chi tiết**: [PDF_Lingua_Jira_Backlog.md](./PDF_Lingua_Jira_Backlog.md)
- **Thời gian thực hiện**: 15/10/2026 – 03/12/2026 (7 tuần / 7 Sprint)

---

## 1. Danh Sách Thành Viên & Phân Công Nhiệm Vụ Chính

Dựa trên lịch sử commit mã nguồn thực tế và phân chia công việc trong Sprint 1, 2, 3:

| STT | MSSV | Họ và tên | Vai trò | Nhiệm vụ chính |
| :---: | :---: | :--- | :--- | :--- |
| 1 | `056206011188` | **Nguyễn Lê Huy Tâm** | Trưởng nhóm | Kiến trúc hệ thống, Backend FastAPI, Core xử lý PDF & OCR, Dịch thuật & Bảo mật dữ liệu. |
| 2 | `077206002307` | **Huỳnh Đình Chấn** | Thành viên | Thiết kế UI/UX Frontend, Workspace tương tác, Giao diện Auth & Điều khoản, Tối ưu Responsive. |

---

## 2. Kế Hoạch Nhóm & Lộ Trình Phát Triển (Development Roadmap)

Chiến lược phát triển được tổ chức theo mô hình Agile/Scrum gồm 7 Sprint (1 tuần/Sprint), chia làm 4 giai đoạn trọng tâm:

```
[Tuần 1 - 3: Core Logic & Gói Free] ──> [Tuần 4 - 5: Tính Năng Pro & Admin] ──> [Tuần 6: Kiểm Thử, Tối Ưu & Đóng Gói] ──> [Tuần 7: Tính Năng Mở Rộng & Tổng Duyệt]
```

---

### 🔹 Giai Đoạn 1: Xây Dựng Core Logic & Nền Tảng Cơ Bản (Tuần 1 – Tuần 3)
*Mục tiêu: Tập trung hoàn thiện toàn bộ luồng xử lý cốt lõi của website từ tải tệp, kiểm soát an toàn, trích xuất văn bản số, OCR scan đến dịch thuật và giao diện làm việc của Gói Free.*

* **Tuần 1 (Sprint 1: 15/10 – 22/10/2026) — Phân tích thiết kế & Khởi tạo khung dự án:**
  - Khảo sát yêu cầu nghiệp vụ, xây dựng Use Case Diagram, Activity Diagram và sơ đồ thực thể liên kết ERD.
  - Khởi tạo kiến trúc dự án (FastAPI Backend + HTML/CSS/JS Frontend), kết nối cơ sở dữ liệu SQLite, cấu hình CORS và logging tập trung.
  - Thiết kế hệ thống Design Tokens CSS, Navbar, bố cục chung và trang chủ giới thiệu PDF-Lingua.
* **Tuần 2 (Sprint 2: 23/10 – 29/10/2026) — Hệ thống tài khoản & Cốt lõi xử lý PDF, OCR:**
  - Thiết kế bảng dữ liệu người dùng, cơ chế mã hóa mật khẩu một chiều an toàn (`bcrypt` 12 rounds salt).
  - Xây dựng API tải tài liệu PDF: Áp dụng giới hạn Free 20 MB/tệp, giới hạn tối đa 100 trang (`PDFL-89`), kiểm tra magic bytes `%PDF-` chống tệp giả mạo và bắt lỗi tệp hỏng/có mật khẩu.
  - Xây dựng engine trích xuất văn bản số (`pypdf`, `pdfplumber`), làm sạch khoảng trắng thừa và thuật toán giữ thứ tự đọc tự nhiên cho tài liệu nhiều cột (Natural Reading Order - `PDFL-102`).
  - Tích hợp Tesseract OCR (`vie+eng`) nhận diện PDF scan và cơ chế trích xuất Hybrid Engine thông minh.
  - Xây dựng giao diện Dropzone tải file kéo thả, modal tiến trình 4 bước và Workspace hiển thị văn bản trích xuất song song.
* **Tuần 3 (Sprint 3: 29/10 – 05/11/2026) — Quản lý tài liệu người dùng, Dịch thuật cốt lõi & Chính sách:**
  - Quản lý kho tài liệu cá nhân: Danh sách file đã tải lên, xem chi tiết metadata, chức năng xóa file an toàn và cô lập dữ liệu riêng tư.
  - Xử lý các trường hợp tài liệu biên: Trang trống, trang bị xoay, hình ảnh scan chất lượng thấp.
  - Tích hợp dịch thuật đa ngôn ngữ cốt lõi (Google GTX, fallback MyMemory), chia đoạn tài liệu dài chống timeout và xuất file kết quả (TXT UTF-8 BOM / PDF Unicode).
  - Hoàn thiện giao diện Modal Điều khoản dịch vụ, Chính sách bảo mật và Kênh liên hệ nhóm phát triển (`PDFL-267`).

---

### 🔹 Giai Đoạn 2: Phát Triển Tính Năng Pro & Quản Trị Hệ Thống Admin (Tuần 4 – Tuần 5)
*Mục tiêu: Đưa trí tuệ nhân tạo (AI) vào phục vụ người dùng Pro và xây dựng module quản trị vận hành toàn diện.*

* **Tuần 4 (Sprint 4: 05/11 – 12/11/2026) — Khởi động Gói Pro & Tích hợp AI thông minh:**
  - **AI Tóm tắt văn bản tài liệu (Document Summarization)**: Tích hợp mô hình ngôn ngữ lớn (LLM API), cấu trúc prompt trích xuất ý chính, kỹ thuật chia đoạn và tóm tắt đa bước cho tài liệu dài.
  - **Trợ lý AI hỏi đáp tài liệu theo ngữ cảnh (Contextual QA/RAG Chatbot)**: Giao diện chat trực tiếp với tài liệu, trích xuất đoạn ngữ cảnh liên quan, trả lời chính xác và hạn chế ảo giác (hallucination).
  - Mở rộng hạn mức Gói Pro: Cho phép xử lý tệp dung lượng lớn lên đến 100 MB/tệp và nâng cao hạn ngạch sử dụng AI.
* **Tuần 5 (Sprint 5: 12/11 – 19/11/2026) — Quản trị hệ thống Admin & Lịch sử hoạt động:**
  - Hệ thống lưu trữ và tra cứu lịch sử xử lý tài liệu dành riêng cho tài khoản Pro (thời gian xử lý, tên file, kết quả dịch và bản tóm tắt).
  - Xây dựng Dashboard quản trị hệ thống dành cho Admin: Quản lý danh sách người dùng, cấp/hạ quyền tài khoản Pro, theo dõi thống kê lưu lượng tệp và số lượt gọi dịch thuật/AI.
  - Quản lý phân quyền nâng cao: Kiểm soát gọi trực tiếp API và xử lý token hết hạn.

---

### 🔹 Giai Đoạn 3: Kiểm Thử Toàn Diện, Tối Ưu Hiệu Năng, Bảo Mật & Đóng Gói (Tuần 6)
*Mục tiêu: Đảm bảo chất lượng phần mềm (QA/QC), tối ưu độ trễ, vá lỗ hổng bảo mật và sẵn sàng môi trường triển khai thực tế.*

* **Tuần 6 (Sprint 6: 19/11 – 26/11/2026) — Hardening, Optimization & Packaging:**
  - **Kiểm thử toàn diện (End-to-End & Stress Testing)**: Kiểm thử tải đồng thời khi nhiều người dùng xử lý tài liệu lớn, kiểm thử độ chính xác trên các bộ dữ liệu PDF dị biệt (font chữ lạ, bảng biểu phức tạp, văn bản song ngữ).
  - **Gia cố an toàn bảo mật (Security Hardening)**: Rà soát và ngăn chặn triệt để các lỗ hổng XSS (trên nội dung trích xuất/dịch), SQL Injection, CSRF, Path Traversal khi upload và cấu hình Rate Limiting bảo vệ API.
  - **Tối ưu hóa hiệu năng (Performance Optimization)**: Bộ nhớ đệm (Caching) cho các cụm từ/bản dịch phổ biến, nén dung lượng tệp PDF xuất ra, giảm thiểu độ trễ xử lý OCR và dịch thuật.
  - **Container hóa & Chuẩn bị triển khai (Docker & Cloud Deployment)**: Đóng gói Dockerfile chuẩn hóa môi trường Frontend/Backend/Tesseract, thiết lập kịch bản triển khai và tài liệu hướng dẫn cài đặt.

---

### 🔹 Giai Đoạn 4: Tính Năng Mở Rộng & Tổng Duyệt Bảo Vệ Đồ Án (Tuần 7)
*Mục tiêu: Gia tăng tiện ích trải nghiệm người dùng, buffer dự phòng và chuẩn bị tốt nhất cho buổi báo cáo đồ án.*

* **Tuần 7 (Sprint 7: 26/11 – 03/12/2026) — Feature Extension, Dry Run & Final Handover:**
  - Triển khai 14 tính năng giá trị gia tăng mở rộng (`PDFL-252` $\rightarrow$ `PDFL-265`): Xem trước file PDF trực quan, so sánh văn bản song ngữ thông minh, tùy chỉnh định dạng font file xuất, phát âm văn bản bản dịch (Text-to-Speech)...
  - Buffer thời gian dự phòng để xử lý các phản hồi phát sinh và tinh chỉnh trải nghiệm người dùng cuối.
  - Hoàn thiện toàn bộ hồ sơ đồ án: Báo cáo học phần hoàn chỉnh, slide thuyết trình và tổng duyệt kịch bản demo (Dry Run) trước hội đồng bảo vệ.

---

## 3. Nguyên Tắc Phối Hợp & Tiêu Chuẩn Hoàn Thành (Definition of Done - DoD)

Một nhiệm vụ chỉ được đánh dấu là **Done** khi thỏa mãn đầy đủ các điều kiện:
1. **Mã nguồn chuẩn mực**: Chạy đúng logic yêu cầu, tuân thủ quy chuẩn đặt tên biến/hàm, clean code và không có lỗi cú pháp/type check.
2. **Kiểm thử tự động & thủ công**: Vượt qua toàn bộ unit test, integration test liên quan; kiểm tra đầy đủ các case biên (boundary) và ngoại lệ.
3. **Bảo mật tuyệt đối**: Không hardcode mật khẩu, token, API key hoặc file nhạy cảm trong mã nguồn; dữ liệu người dùng được mã hóa và cô lập an toàn.
4. **Quy trình Git & Review**: Code được phát triển trên nhánh tính năng riêng (`feat/...`), tạo Pull Request và được thành viên còn lại review duyệt trước khi merge vào nhánh chính (`main`).
5. **Đồng bộ Jira Board**: Cập nhật trạng thái task tương ứng trên Jira Board sang `Done` ngay sau khi hoàn tất.
