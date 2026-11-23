# ADR-001: Lựa Chọn Giải Pháp Trích Xuất PDF Lai (Hybrid Fast Path)

| Thuộc tính | Chi tiết |
|---|---|
| **Mã định danh** | ADR-001 |
| **Tiêu đề** | Lựa chọn giải pháp trích xuất PDF lai: PyMuPDF trích xuất số kết hợp Tesseract OCR tiếng Việt |
| **Trạng thái** | Accepted (Đã chấp thuận) |
| **Ngày quyết định** | 15/09/2026 |
| **Người quyết định** | Nhóm Kỹ sư Kiến trúc PDF-Lingua (Nhóm 19) |
| **Tài liệu liên quan** | [`Docs/ai-design/pdf-processing-and-ai-pipeline.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/ai-design/pdf-processing-and-ai-pipeline.md) |

---

## 1. Context (Bối cảnh kỹ thuật)

Tài liệu học thuật (báo khoa học, sách giáo trình, luận văn) tồn tại ở hai dạng chính:
1. **Digital PDF**: Văn bản số có sẵn lớp text layer và font chữ nhúng (chiếm khoảng 70-80% tài liệu hiện đại).
2. **Scanned PDF**: Tài liệu quét từ giấy hoặc ảnh chụp chỉ chứa các bitmap thô (chiếm 20-30%, đặc biệt là tài liệu tiếng Việt cũ hoặc kỷ yếu hội thảo).

Nếu gửi toàn bộ tài liệu qua công cụ OCR hình ảnh:
- Thời gian xử lý sẽ cực kỳ lâu (2-5 giây/trang, tài liệu 50 trang mất đến 3-4 phút).
- Tiêu tốn tài nguyên CPU và RAM máy chủ rất lớn.
- Nếu dùng Cloud Vision API của bên thứ ba (Google Cloud Document AI, AWS Textract), chi phí sẽ phát sinh theo từng trang và phụ thuộc vào kết nối Internet ra bên ngoài, không khả thi cho môi trường vận hành nội bộ hoặc ngân sách sinh viên.

---

## 2. Decision (Nội dung quyết định)

Hệ thống quyết định áp dụng mô hình phân luồng lai **Hybrid Fast Path**:
- **Bộ phân loại trang (Page Classifier)**: Kiểm tra mật độ ký tự số trên mỗi trang PDF thông qua PyMuPDF (`fitz`).
- **Nhánh Fast Path (Trang văn bản số)**: Trích xuất trực tiếp bằng PyMuPDF với tốc độ siêu nhanh (< 50ms/trang), giữ nguyên font chữ và tọa độ từng khối từ.
- **Nhánh OCR Fallback (Trang ảnh quét)**: Tự động chuyển đổi trang thành ảnh độ phân giải 300 DPI, thực hiện tiền xử lý nâng cao tương phản (CLAHE), cân chỉnh góc nghiêng (Deskewing) và gọi **Tesseract OCR Engine** với gói ngôn ngữ tiếng Việt (`vie.traineddata`) và tiếng Anh (`eng.traineddata`).

---

## 3. Alternatives Considered (Các phương án đối trọng đã cân nhắc)

| Phương án | Ưu điểm | Nhược điểm & Lý do loại bỏ |
|---|---|---|
| **Phương án A: OCR toàn bộ bằng Cloud API (Google Vision / AWS Textract)** | Độ chính xác nhận dạng ký tự cao. | Chi phí tính tiền theo từng trang rất đắt đỏ; phụ thuộc mạng Internet bên ngoài; không tự chủ dữ liệu học thuật nội bộ. |
| **Phương án B: Chỉ dùng PDFMiner / PyPDF thuần túy** | Thư viện Python thuần túy, dễ cài đặt. | Tốc độ trích xuất chậm gấp 5-10 lần PyMuPDF; hoàn toàn bất lực trước các tài liệu dạng ảnh quét (trả về trang trắng). |
| **Phương án C: Dùng EasyOCR / PaddleOCR** | Khả năng đọc chữ tiếng Việt tốt bằng mô hình Deep Learning. | Cần GPU mạnh và dung lượng RAM lớn (> 4GB); thời gian khởi động mô hình lâu, không phù hợp môi trường máy tính thông thường của sinh viên. |
| **Phương án Được Chọn: Hybrid Fast Path (PyMuPDF + Tesseract Local)** | Tốc độ trung bình toàn tài liệu giảm xuống dưới 200ms/trang; tự chủ 100% không phụ thuộc Internet; tiết kiệm 80% tài nguyên CPU. | Cần cài đặt binary Tesseract OCR trên máy chủ (đã được tự động hóa qua script cài đặt). |

---

## 4. Consequences & Trade-offs (Hệ quả & Đánh đổi)

### Điểm tích cực (Gains):
- **Hiệu năng vượt trội**: Với tài liệu số thông thường, tài liệu 20 trang chỉ mất chưa tới 1 giây để hoàn tất trích xuất.
- **Tiết kiệm chi phí**: Chi phí vận hành bằng 0 đồng do chạy hoàn toàn on-premise.
- **Chất lượng chữ tiếng Việt**: Tesseract `vie.traineddata` kết hợp bước tiền xử lý lọc nhiễu đạt tỉ lệ lỗi ký tự (CER) dưới 3% trên tập dữ liệu chuẩn.

### Điểm đánh đổi (Trade-offs) & Giải pháp khắc phục:
- **Đánh đổi**: Máy chủ triển khai cần cài đặt gói binary `tesseract` của hệ điều hành.
- **Giải pháp**: Xây dựng tài liệu hướng dẫn cài đặt tự động một chạm (`run.bat` trên Windows và script kiểm tra cấu hình trong `setup-and-installation.md`).
