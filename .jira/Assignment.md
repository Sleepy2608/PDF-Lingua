# PDF-Lingua — Bảng Phân Công Nhiệm Vụ (Task Assignment)

- **Dự án**: PDF Lingua – Web trích xuất văn bản từ tài liệu PDF, dịch thuật đa ngôn ngữ và tích hợp AI hỗ trợ người dùng, tóm tắt văn bản.
- **Jira Project Key**: `PDFL`
- **Jira Board & Summary**: [https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary](https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary)
- **Tài liệu Backlog chi tiết**: [PDF_Lingua_Jira_Backlog.md](./PDF_Lingua_Jira_Backlog.md)

---

## 1. Danh sách thành viên nhóm

| STT | MSSV | Họ và tên | Vai trò | Nhiệm vụ chính |
| :---: | :---: | :--- | :--- | :--- |
| 1 | `056206011188` | **Nguyễn Lê Huy Tâm** | Trưởng nhóm | - |
| 2 | `077206002307` | **Huỳnh Đình Chấn** | Thành viên | - |

---

## 2. Nguyên tắc & Lộ trình phân công

### 2.1. Lộ trình triển khai (Roadmap)
Dự án được chia làm 3 giai đoạn chính dựa theo yêu cầu đề tài:
1. **Giai đoạn 1 (Core Features - Gói Free)**:
   - Khởi tạo kiến trúc hệ thống, database, thiết kế giao diện cơ bản.
   - Quản lý tài khoản (Đăng ký, Đăng nhập).
   - Tải lên & quản lý tài liệu PDF (Free tối đa 20 MB/tệp).
   - Trích xuất văn bản trực tiếp từ PDF & nhận dạng chữ qua OCR (tài liệu scan).
   - Dịch thuật đa ngôn ngữ & Xuất tải file kết quả (TXT / PDF).
2. **Giai đoạn 2 (Advanced Features - Gói Pro)**:
   - Tóm tắt văn bản bằng AI (Pro).
   - Trợ lý AI hỏi đáp, giải thích khái niệm theo ngữ cảnh tài liệu (Pro).
   - Lưu trữ & tra cứu lịch sử xử lý tài liệu (Pro).
   - Nâng cấp gói Pro (tăng hạn mức upload 100 MB/tệp, hạn mức AI cao hơn).
   - Quản trị hệ thống Admin (theo dõi người dùng, cấp/hạ quyền Pro).
3. **Giai đoạn 3 (Testing, Hardening & Handover)**:
   - Kiểm thử chức năng, kiểm thử tải và bảo mật (XSS, SQLi, file upload).
   - Tối ưu hiệu năng OCR và AI.
   - Hoàn thiện tài liệu báo cáo, slide thuyết trình và kịch bản demo.

### 2.2. Quy ước trạng thái Task trên Jira
- **To Do**: Nhiệm vụ đã được lên kế hoạch nhưng chưa bắt đầu.
- **In Progress**: Đang được thành viên phụ trách hiện thực mã nguồn.
- **In Review**: Đã hoàn tất lập trình, đang tạo Pull Request và chờ thành viên còn lại review code.
- **In Testing**: Đã vượt qua review code, đang trong quá trình kiểm thử chức năng và kiểm tra lỗi.
- **Done**: Đã vượt qua kiểm thử, merge vào nhánh chính và đáp ứng đầy đủ Definition of Done.

---

## 3. Tiêu chuẩn hoàn thành (Definition of Done - DoD)

Một nhiệm vụ chỉ được đánh dấu là **Done** khi thỏa mãn các điều kiện sau:
1. **Mã nguồn**: Code chạy đúng logic yêu cầu, tuân thủ quy chuẩn đặt tên biến/hàm và không có lỗi cú pháp.
2. **Kiểm thử**: Đã tự kiểm tra (manual test) các trường hợp bình thường và ngoại lệ; các test case liên quan vượt qua thành công.
3. **Bảo mật**: Không hardcode mật khẩu, token, API key hoặc file nhạy cảm trong code.
4. **Code Review**: Pull Request được thành viên còn lại review và duyệt trước khi merge vào nhánh `main` hoặc `develop`.
5. **Cập nhật trạng thái**: Chuyển trạng thái task tương ứng trên Jira Board sang `Done`.
