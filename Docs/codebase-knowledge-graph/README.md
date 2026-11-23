# SƠ ĐỒ TRI THỨC KIẾN TRÚC MÃ NGUỒN (CODEBASE KNOWLEDGE GRAPH)

## DỰ ÁN: NỀN TẢNG DỊCH THUẬT TÀI LIỆU PDF HỌC THUẬT & TRỢ LÝ AI (PDF-LINGUA)

| Thông tin | Chi tiết |
|---|---|
| **Dự án** | PDF-Lingua: Academic PDF Translation & AI Research Assistant |
| **Hạng mục** | Kiến trúc Hệ thống & Sơ đồ Mạng Tri thức (Knowledge Graph) |
| **Quy mô phân tích** | **230 tệp** toàn dự án (~399.243 từ) |
| **Tổng số Nodes** | **4.063** thực thể (Code AST, Services, API Routers, Models, Test Suites, Documents, Workflows) |
| **Tổng số Edges** | **9.412** liên kết phụ thuộc, lời gọi hàm, thẩm định quyền và kế thừa |
| **Số cộng đồng (Communities)** | **244** phân hệ chức năng |
| **Trạng thái** | Hoàn thành |

---

## 1. Giới thiệu tổng quan

Thư mục này lưu trữ kết quả phân tích cấu trúc tổng thể của đồ án PDF-Lingua bằng mô hình đồ thị tri thức (Knowledge Graph), kết hợp giữa **trích xuất cú pháp AST (Abstract Syntax Tree)** cho toàn bộ mã nguồn Backend/Frontend và **trích xuất ngữ nghĩa (Semantic Extraction)** cho hệ thống tài liệu kiến trúc, quy trình nghiệp vụ và Jira backlog.

---

## 2. Danh mục tài liệu trong thư mục

### 📄 1. [CODEBASE_ARCHITECTURE_GRAPH_REPORT.md](file:///C:/University%20Coding%20Project/PDF-Lingua/Docs/codebase-knowledge-graph/CODEBASE_ARCHITECTURE_GRAPH_REPORT.md)
Báo cáo phân tích kiến trúc chi tiết, bao gồm:
- **God Nodes (Điểm tựa kiến trúc trung tâm):** Các abstraction cốt lõi điều phối hệ thống (`User`, `UserRole`, `StorageService`, `ActionType`, `ProcessingStatus`, `HistoryService`, `PDFService`,...).
- **Surprising Connections:** Các mối liên kết tiềm ẩn và luồng phụ thuộc chéo giữa API Admin, Service, cơ sở dữ liệu và bộ kiểm thử.
- **Community Breakdown:** Phân rã 244 phân hệ (Dịch thuật, OCR, AI Copilot, Thanh toán VietQR, Quản lý tài liệu, Hạn mức gói cước, Kiểm thử bảo mật IDOR,...).
- **Suggested Architecture Questions:** Các câu hỏi chất vấn kiến trúc nhằm tối ưu hóa thiết kế hệ thống.

### 🌐 2. [interactive_codebase_graph.html](file:///C:/University%20Coding%20Project/PDF-Lingua/Docs/codebase-knowledge-graph/interactive_codebase_graph.html)
Trực quan hóa mạng tri thức dạng tương tác:
- Có thể **mở trực tiếp bằng bất kỳ trình duyệt web nào** (Chrome, Edge, Firefox) mà không cần cài đặt thêm server hay extension.
- Hỗ trợ phóng to/thu nhỏ (Zoom), kéo thả các cụm nốt (Draggable Nodes), tìm kiếm ký hiệu (Search by Symbol/File), lọc theo cộng đồng phân hệ và xem thông tin chi tiết từng cạnh liên kết.

---

## 3. Hướng dẫn mở và sử dụng

1. **Xem sơ đồ mạng tương tác:**
   - Nhấp đúp chuột vào tệp `interactive_codebase_graph.html` để mở trong trình duyệt.
   - Sử dụng thanh tìm kiếm ở góc để gõ tên module (ví dụ: `AIService`, `OCRService`, `Pricing`, `SubscriptionService`) để xem luồng liên kết.
2. **Xem báo cáo phân tích:**
   - Đọc trực tiếp tệp `CODEBASE_ARCHITECTURE_GRAPH_REPORT.md` bằng trình xem Markdown của VS Code, IDE hoặc GitHub.
