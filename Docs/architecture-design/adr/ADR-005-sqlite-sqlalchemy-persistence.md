# ADR-005: Lựa Chọn SQLite & SQLAlchemy ORM Cho Tầng Lưu Trữ Cục Bộ

| Thuộc tính | Chi tiết |
|---|---|
| **Mã định danh** | ADR-005 |
| **Tiêu đề** | Lựa chọn cơ sở dữ liệu SQLite kết hợp SQLAlchemy ORM và Alembic Migration |
| **Trạng thái** | Accepted (Đã chấp thuận) |
| **Ngày quyết định** | 16/09/2026 |
| **Người quyết định** | Nhóm Kỹ sư Kiến trúc PDF-Lingua (Nhóm 19) |
| **Tài liệu liên quan** | [`Docs/architecture-design/system-architecture.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/architecture-design/system-architecture.md) |

---

## 1. Context (Bối cảnh kỹ thuật)

Đồ án cần một giải pháp lưu trữ dữ liệu đáp ứng:
1. **Tính độc lập & Dễ triển khai**: Người chấm đồ án hoặc thành viên nhóm chỉ cần tải code về là chạy được ngay ("Zero-configuration Deployment"), không bắt buộc phải cài đặt, khởi động và cấu hình cụm máy chủ cơ sở dữ liệu cồng kềnh (PostgreSQL/MySQL Service) trên máy cá nhân.
2. **Tính toàn vẹn dữ liệu (ACID)**: Lưu trữ thông tin tài khoản, lịch sử giao dịch thanh toán VietQR và dữ liệu hạn mức phải bảo đảm an toàn giao dịch.
3. **Khả năng nâng cấp dài hạn**: Khi dự án đưa lên môi trường sản xuất thực tế với hàng nghìn người dùng, mã nguồn phải chuyển dịch sang PostgreSQL mà không cần viết lại câu lệnh truy vấn.

---

## 2. Decision (Nội dung quyết định)

Hệ thống quyết định chọn **SQLite** làm cơ sở dữ liệu mặc định, điều phối qua **SQLAlchemy 2.0 ORM** và quản lý phiên bản lược đồ bằng **Alembic**:
- Cơ sở dữ liệu được lưu gói gọn trong một tệp duy nhất (`storage/pdf_lingua.db`).
- Áp dụng cơ chế **Write-Ahead Logging (WAL mode)** để tăng tốc độ ghi đồng thời và tránh tình trạng khóa tệp (Database locked).
- Sử dụng SQLAlchemy ORM giúp trừu tượng hóa toàn bộ câu lệnh SQL thành Python Object.
- Quản lý các bước nâng cấp cấu trúc bảng dữ liệu (Migrations) thông qua Alembic scripts có thể rollback an toàn.

---

## 3. Alternatives Considered (Các phương án đối trọng đã cân nhắc)

| Phương án | Ưu điểm | Nhược điểm & Lý do loại bỏ |
|---|---|---|
| **Phương án A: PostgreSQL / MySQL Độc lập** | Rất mạnh cho hệ thống phân tán, xử lý tải cao tốt. | Phức tạp trong khâu chấm đồ án; bắt buộc người dùng cài đặt PostgreSQL service, cấu hình tài khoản, cổng kết nối; dễ phát sinh lỗi môi trường cục bộ. |
| **Phương án B: MongoDB / NoSQL** | Dễ lưu trữ văn bản JSON bản dịch dài. | Khó đảm bảo tính toàn vẹn khóa ngoại (Foreign Key Integrity) giữa User, Document và Transaction thanh toán; khó kiểm soát quan hệ tài chính chặt chẽ. |
| **Phương án C: File JSON lưu trữ phẳng** | Cực kỳ thô sơ, không cần thư viện. | Không có transaction; dễ hỏng dữ liệu (corruption) khi 2 request cùng ghi file; tốc độ tìm kiếm phân trang rất chậm. |
| **Phương án Được Chọn: SQLite + SQLAlchemy + Alembic** | Không cần cài đặt server; tệp DB duy nhất; chuẩn ACID; hỗ trợ chuyển sang PostgreSQL chỉ bằng cách đổi chuỗi kết nối `DATABASE_URL`. | Không tối ưu cho hàng trăm request ghi đồng thời tại cùng 1 microsecond (đã được khắc phục nhờ bật WAL mode). |

---

## 4. Consequences & Trade-offs (Hệ quả & Đánh đổi)

### Điểm tích cực (Gains):
- **Khởi chạy một chạm**: Đóng gói đồ án kèm sẵn DB mẫu, chỉ cần chạy server là có đầy đủ tài khoản thử nghiệm và lịch sử mẫu để bảo vệ đồ án.
- **Linh hoạt nâng cấp**: Toàn bộ mô hình dữ liệu (Models) được khai báo theo chuẩn SQLAlchemy, sẵn sàng trỏ sang PostgreSQL khi triển khai trên hạ tầng Docker/Kubernetes.
