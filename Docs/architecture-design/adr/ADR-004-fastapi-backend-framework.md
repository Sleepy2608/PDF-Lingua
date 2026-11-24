# ADR-004: Lựa Chọn Backend Framework FastAPI & Python 3.12

| Thuộc tính | Chi tiết |
|---|---|
| **Mã định danh** | ADR-004 |
| **Tiêu đề** | Lựa chọn Backend Framework FastAPI kết hợp Python 3.12 bất đồng bộ |
| **Trạng thái** | Accepted (Đã chấp thuận) |
| **Ngày quyết định** | 15/09/2026 |
| **Người quyết định** | Nhóm Kỹ sư Kiến trúc PDF-Lingua (Nhóm 19) |
| **Tài liệu liên quan** | [`Docs/architecture-design/system-architecture.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/architecture-design/system-architecture.md) |

---

## 1. Context (Bối cảnh kỹ thuật)

Backend của PDF-Lingua là trung tâm điều phối nhiều tác vụ có đặc thù kỹ thuật trái ngược nhau:
1. **Tác vụ I/O bất đồng bộ (I/O Bound)**: Nhận tệp tải lên, gọi dịch vụ AI từ xa (Google Gemini / OpenAI / DeepL API), gửi webhook, truy vấn cơ sở dữ liệu.
2. **Tác vụ tính toán nặng (CPU Bound)**: Tiền xử lý ảnh tài liệu, phân tích tọa độ trang, gọi OCR quang học.
3. **Tiêu chuẩn tài liệu hóa API**: Yêu cầu tự động sinh tài liệu OpenAPI / Swagger để dễ dàng kiểm thử và tích hợp giữa các thành viên trong nhóm.

---

## 2. Decision (Nội dung quyết định)

Hệ thống quyết định chọn **FastAPI** chạy trên nền **Python 3.12** kết hợp máy chủ ASGI **Uvicorn**:
- Tận dụng `async/await` gốc của Python để xử lý hàng trăm kết nối I/O đồng thời mà không bị nghẽn luồng.
- Sử dụng **Pydantic v2** để tự động kiểm thực (validate) dữ liệu đầu vào và chuyển đổi kiểu dữ liệu mạnh mẽ (Strong Typing).
- Đẩy các tác vụ nặng (OCR trang lớn, xuất tệp Docx) vào hàng đợi nền (Background Tasks / Worker).

---

## 3. Alternatives Considered (Các phương án đối trọng đã cân nhắc)

| Phương án | Ưu điểm | Nhược điểm & Lý do loại bỏ |
|---|---|---|
| **Phương án A: Django** | Đầy đủ tính năng có sẵn (ORM, Admin, Auth tích hợp). | Quá nặng nề (Monolithic), kiến trúc đồng bộ cũ khó tối ưu hóa cho các luồng xử lý AI bất đồng bộ; khó bóc tách làm microservice gọn nhẹ. |
| **Phương án B: Flask** | Rất nhẹ, dễ học cho sinh viên. | Thiếu hỗ trợ bất đồng bộ `async/await` tự nhiên; phải cài thêm nhiều thư viện mở rộng rời rạc; không tự sinh tài liệu Swagger chuẩn. |
| **Phương án C: Node.js (Express / NestJS)** | Tốc độ I/O rất nhanh. | Hệ sinh thái xử lý PDF, OCR và AI/Machine Learning của JavaScript rất nghèo nàn so với Python; phải gọi subprocess Python làm phát sinh độ trễ liên tiến trình. |
| **Phương án Được Chọn: FastAPI (Python 3.12)** | Hiệu năng tương đương Node.js/Go; tự sinh Swagger UI tại `/docs`; tích hợp tự nhiên 100% với toàn bộ thư viện AI Python (PyMuPDF, Tesseract, LangChain). | Cần hiểu vững mô hình lập trình bất đồng bộ (`asyncio`). |

---

## 4. Consequences & Trade-offs (Hệ quả & Đánh đổi)

### Điểm tích cực (Gains):
- **Tốc độ phản hồi cực cao**: Các endpoint truy vấn hạn mức, kiểm tra trạng thái job trả về dưới 15ms.
- **Tự động sinh tài liệu sống**: Tài liệu API tương tác tại `/docs` giúp kiểm thử ngay trên giao diện web mà không cần cài đặt thêm Postman.
