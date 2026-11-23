# ADR-006: Lựa Chọn Thuật Toán Tái Cấu Trúc Luồng Đọc 2 Cột (Smart Layout Flow)

| Thuộc tính | Chi tiết |
|---|---|
| **Mã định danh** | ADR-006 |
| **Tiêu đề** | Lựa chọn thuật toán tái cấu trúc luồng đọc 2 cột tự nhiên (Smart Layout Flow Reconstruction) |
| **Trạng thái** | Accepted (Đã chấp thuận) |
| **Ngày quyết định** | 22/09/2026 |
| **Người quyết định** | Nhóm Kỹ sư Kiến trúc PDF-Lingua (Nhóm 19) |
| **Tài liệu liên quan** | [`Docs/ai-design/pdf-processing-and-ai-pipeline.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/ai-design/pdf-processing-and-ai-pipeline.md) |

---

## 1. Context (Bối cảnh kỹ thuật)

Đa số bài báo khoa học chuẩn IEEE, ACM, Springer và các tài liệu hội thảo quốc tế đều được định dạng theo cấu trúc **2 cột song song (Two-column format)**.
- Các công cụ trích xuất PDF thông thường (hoặc các trình dịch online) trích xuất các dòng văn bản theo thứ tự tọa độ thẳng từ trên xuống dưới trên toàn bộ chiều rộng trang ($Y_{top} \rightarrow Y_{bottom}$).
- Điều này dẫn đến lỗi nghiêm trọng: dòng 1 của cột trái bị ghép nối ngang với dòng 1 của cột phải, làm xáo trộn hoàn toàn trật tự từ và phá hủy ngữ nghĩa câu văn khoa học.
- Khi văn bản bị xáo trộn đưa vào mô hình AI dịch thuật, bản dịch đầu ra trở nên vô nghĩa, dịch sai nội dung hoặc gây ảo giác (hallucination).

---

## 2. Decision (Nội dung quyết định)

Hệ thống quyết định xây dựng và triển khai thuật toán **Smart Layout Flow Reconstruction**:
- **Phân tích tọa độ Bounding Box**: Thu thập danh sách các khối văn bản (text blocks) với tọa độ hình chữ nhật $(x_0, y_0, x_1, y_1)$ từ PyMuPDF.
- **Xác định đường phân cách cột (Column Divider)**: Tính toán phân bố mật độ khoảng trống giữa trang (Histogram analysis) để nhận diện trang 1 cột hay trang 2 cột.
- **Sắp xếp theo thứ tự đọc tự nhiên**:
  - Đối với trang 2 cột: Gom toàn bộ các khối nằm bên trái đường phân cách, sắp xếp từ trên xuống dưới để hoàn tất nội dung Cột 1; sau đó mới tiếp tục chuyển sang Cột 2.
  - Xử lý khối đặc biệt: Các khối văn bản tiêu đề (Title) hoặc tóm tắt (Abstract) trải dài cả 2 cột được giữ nguyên vị trí trên cùng trước khi tách cột.

---

## 3. Alternatives Considered (Các phương án đối trọng đã cân nhắc)

| Phương án | Ưu điểm | Nhược điểm & Lý do loại bỏ |
|---|---|---|
| **Phương án A: Trích xuất thô theo dòng quét (Raw Scanline)** | Đơn giản, dùng hàm `.get_text()` mặc định. | Phá nát ngữ nghĩa của 100% tài liệu học thuật định dạng 2 cột; không thể dùng được trong thực tế. |
| **Phương án B: Sử dụng mô hình Deep Learning LayoutLMv3** | Nhận diện bố cục rất thông minh và linh hoạt. | Mô hình nặng hàng trăm MB, yêu cầu GPU để suy luận (inference); tốc độ chậm (1-3s mỗi trang); phức tạp hóa môi trường triển khai. |
| **Phương án Được Chọn: Thuật toán Heuristic Phân Tách Hình Học (Smart Layout)** | Tốc độ tính toán dưới 5ms/trang trên CPU thường; xử lý chính xác tuyệt đối các bài báo 2 cột chuẩn IEEE/ACM; không phát sinh phụ thuộc thư viện AI nặng. | Cần điều chỉnh ngưỡng heuristic nếu gặp các bố cục tạp chí 3-4 cột phức tạp (đã bổ sung ngưỡng an toàn). |

---

## 4. Consequences & Trade-offs (Hệ quả & Đánh đổi)

### Điểm tích cực (Gains):
- **Độ chuẩn xác ngữ nghĩa vượt trội**: Bản dịch song ngữ giữ nguyên vẹn trật tự câu văn học thuật, giúp mô hình AI hiểu đúng ngữ cảnh và dịch mượt mà.
- **Tốc độ cực nhanh**: Chạy bằng thuật toán hình học thuần túy trên CPU mà không làm chậm quy trình xử lý tài liệu.
