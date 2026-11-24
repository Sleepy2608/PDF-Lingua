# HỒ SƠ QUYẾT ĐỊNH KIẾN TRÚC (ARCHITECTURE DECISION RECORDS - ADR)

## DỰ ÁN: NỀN TẢNG DỊCH THUẬT TÀI LIỆU PDF HỌC THUẬT & TRỢ LÝ AI (PDF-LINGUA)

| Thông tin | Chi tiết |
|---|---|
| **Dự án** | PDF-Lingua: Academic PDF Translation & AI Research Assistant |
| **Loại tài liệu** | Architecture Decision Records (ADR) Suite |
| **Tiêu chuẩn áp dụng** | Michael Nygard ADR Template & SEI Architecture Evaluation |
| **Phiên bản** | 1.0 |
| **Trạng thái** | Hoàn thành (Accepted) |

---

## 1. Giới thiệu tổng quan

Hồ sơ Quyết định Kiến trúc (Architecture Decision Records - ADR) là tập hợp các văn bản kỹ thuật ghi lại **nguyên nhân, bối cảnh, các giải pháp thay thế đã từng cân nhắc và sự đánh đổi (trade-offs)** khi đội ngũ kỹ sư đưa ra các quyết định kiến trúc then chốt trong dự án **PDF-Lingua**.

Mỗi bản ghi ADR đại diện cho một quyết định thiết kế quan trọng và có hiệu lực xuyên suốt vòng đời phát triển của phần mềm.

---

## 2. Bảng Chỉ Mục Quyết Định Kiến Trúc (ADR Master Index)

| Mã ADR | Tiêu Đề Quyết Định | Trạng Thái | Ngày Quyết Định | Tác Động Hệ Thống |
| :---: | :--- | :---: | :---: | :--- |
| **[ADR-001](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/architecture-design/adr/ADR-001-hybrid-fast-path-extraction.md)** | Lựa chọn giải pháp trích xuất PDF lai (PyMuPDF kết hợp Tesseract OCR) | **Accepted** | 15/09/2026 | Tối ưu hóa tốc độ bóc tách văn bản, giảm 80% chi phí và độ trễ CPU so với OCR toàn bộ. |
| **[ADR-002](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/architecture-design/adr/ADR-002-vietqr-napas247-payment-gateway.md)** | Lựa chọn cổng thanh toán VietQR Napas247 qua SePay Webhook | **Accepted** | 20/09/2026 | Đảm bảo tính khả thi thanh toán 0% phí, không cần thẻ tín dụng quốc tế, khớp lệnh tự động dưới 3 giây. |
| **[ADR-003](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/architecture-design/adr/ADR-003-modern-vanilla-js-spa.md)** | Lựa chọn kiến trúc Single Page Application bằng Modern Vanilla JS & Apple HIG | **Accepted** | 18/09/2026 | Triệt tiêu hoàn toàn bundle overhead, thời gian tải trang dưới 50ms, độ tương thích trình duyệt 100%. |
| **[ADR-004](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/architecture-design/adr/ADR-004-fastapi-backend-framework.md)** | Lựa chọn Backend Framework FastAPI & Python 3.12 bất đồng bộ | **Accepted** | 15/09/2026 | Hỗ trợ xử lý tác vụ I/O song song, tích hợp mượt mà với thư viện AI/ML và tự động sinh Swagger OpenAPI. |
| **[ADR-005](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/architecture-design/adr/ADR-005-sqlite-sqlalchemy-persistence.md)** | Lựa chọn SQLite & SQLAlchemy ORM cho tầng dữ liệu cục bộ | **Accepted** | 16/09/2026 | Đơn giản hóa đóng gói triển khai một chạm, hỗ trợ ACID đầy đủ, sẵn sàng chuyển dịch sang PostgreSQL. |
| **[ADR-006](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/architecture-design/adr/ADR-006-smart-layout-reading-flow.md)** | Lựa chọn thuật toán tái cấu trúc luồng đọc 2 cột (Smart Layout Flow) | **Accepted** | 22/09/2026 | Bảo toàn ngữ nghĩa đoạn văn bản học thuật đa cột trước khi đưa vào mô hình dịch thuật AI. |

---

## 3. Cấu trúc chuẩn của một bản ghi ADR

Mọi tài liệu ADR trong thư mục này đều tuân thủ cấu trúc 6 phần tiêu chuẩn:
1. **Title (Tiêu đề & Định danh)**: Mã số định danh `ADR-XXX` và tên quyết định.
2. **Status (Trạng thái)**: `Proposed` (Đề xuất), `Accepted` (Đã chấp thuận), `Superseded` (Bị thay thế), `Deprecated` (Hết hiệu lực).
3. **Context (Bối cảnh kỹ thuật)**: Bài toán thực tế gặp phải, các ràng buộc kỹ thuật, ngân sách và mục tiêu người dùng.
4. **Decision (Nội dung quyết định)**: Giải pháp công nghệ được lựa chọn thực thi.
5. **Alternatives Considered (Các phương án đối trọng đã cân nhắc)**: Phân tích so sánh chi tiết các công nghệ/giải pháp cạnh tranh và lý do loại bỏ.
6. **Consequences & Trade-offs (Hệ quả & Đánh đổi)**: Đánh giá hai mặt được/mất của quyết định và biện pháp giảm thiểu rủi ro kỹ thuật tương ứng.
