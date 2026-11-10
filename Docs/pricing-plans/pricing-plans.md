# Bảng Giá Gói Dịch Vụ & So Sánh Quyền Lợi (PDF-Lingua Pricing Plans)

Tài liệu này định nghĩa chi tiết cơ chế phân tầng tài khoản, bảng giá dịch vụ, chính sách hạn mức kỹ thuật và bảng so sánh toàn diện giữa hai gói **Gói Miễn Phí (Free Tier)** và **Gói Pro VIP (Pro Tier)** trong hệ thống **PDF-Lingua**.

---

## 1. Tổng Quan Về Mô Hình Gói Cước

PDF-Lingua vận hành theo mô hình Freemium kết hợp đăng ký gói cước linh hoạt (Subscription), tối ưu cho hai nhóm đối tượng trọng tâm:
- **Học sinh, sinh viên và người dùng cá nhân**: Nhu cầu đọc hiểu, dịch thuật tài liệu giáo trình và bài báo thông thường hàng ngày mà không mất phí.
- **Nghiên cứu sinh, giảng viên và chuyên gia**: Cần xử lý các tài liệu chuyên ngành dung lượng lớn, sách scan nhiều trang kèm nhu cầu tương tác chuyên sâu với Trợ lý AI Copilot và xuất định dạng Microsoft Word.

### 1.1. Bảng Giá & Chu Kỳ Thanh Toán

| Gói Cước | Chu Kỳ | Giá Niêm Yết | Giá Thực Tế | Mức Tiết Kiệm | Ghi Chú |
|---|---|---|---|---|---|
| **Gói Miễn Phí (Free)** | Vĩnh viễn | 0đ | **0đ** | - | Mặc định khi đăng ký tài khoản mới, không yêu cầu thẻ ngân hàng |
| **Gói Pro Hàng Tháng** | 30 ngày | 49.000đ | **49.000đ / tháng** | - | Phù hợp nhu cầu ngắn hạn theo mùa học tập / dự án |
| **Gói Pro Hàng Năm** | 365 ngày | 588.000đ | **399.000đ / năm** | **Tiết kiệm 32%** | Tương đương ~33.250đ / tháng, tối ưu chi phí lâu dài |

### 1.2. Phương Thức Thanh Toán VietQR Tự Động
- **Cổng thanh toán**: Tích hợp mã chuẩn **VietQR (Napas247)** ngân hàng số 24/7.
- **Nội dung chuyển khoản**: Mỗi phiên thanh toán khởi tạo mã giao dịch duy nhất dạng `TX-XXXXXXXX` để đối soát tự động.
- **Kích hoạt tức thì**: Hệ thống tự động kiểm tra và nâng hạng tài khoản lên vai trò `pro` ngay khi nhận tín hiệu chuyển khoản thành công, không cần tải lại trang.

---

## 2. Bảng So Sánh Quyền Lợi Chi Tiết (Free vs Pro)

Hệ thống quyền lợi được phân chia thành 3 nhóm năng lực cốt lõi (Capability Clusters) đồng bộ với giao diện ứng dụng:

### 2.1. Nhóm 1: Năng Lực Xử Lý Tài Liệu & OCR (Document Processing & OCR)

| Tiêu Chí / Tính Năng | Gói Miễn Phí (Free) | Gói Nâng Cao (Pro) | Chi Tiết Kỹ Thuật |
|---|:---:|:---:|---|
| **Dung lượng tệp PDF tối đa** | **20 MB / tệp** | **100 MB / tệp** | Pro hỗ trợ tải các tệp luận văn, giáo trình scan độ phân giải cao |
| **Giới hạn số trang OCR** | **100 trang / tệp** | **500 trang / tệp** | Nhận dạng ký tự quang học qua OCR engine trên tài liệu scan |
| **Tốc độ hàng đợi xử lý** | Tiêu chuẩn (Standard) | **Ưu tiên cao (Fast-track)** | Pro được định tuyến tới nhóm worker ưu tiên, giảm thời gian chờ đợi |
| **Trích xuất văn bản số (Text PDF)** | ✅ Hỗ trợ | ✅ Hỗ trợ | Trích xuất trực tiếp khối chữ từ các tệp PDF văn bản gốc |
| **Dịch thuật song ngữ thông minh** | ✅ Hỗ trợ | ✅ Hỗ trợ | Giữ nguyên cấu trúc trang, dịch thuật 2 cột song ngữ trực quan |

### 2.2. Nhóm 2: Trợ Lý AI & Dịch Thuật (AI Copilot & Summarization)

| Tiêu Chí / Tính Năng | Gói Miễn Phí (Free) | Gói Nâng Cao (Pro) | Chi Tiết Kỹ Thuật |
|---|:---:|:---:|---|
| **Trợ lý hỏi đáp AI Copilot** | ❌ **Không có** | **15 câu / ngày** | Hỏi đáp ngữ cảnh tài liệu, tra cứu trích dẫn số trang chính xác |
| **Tóm tắt văn bản AI Summary** | Cơ bản | **Chuyên sâu** | Tổng thuật nội dung chính, trích xuất danh mục từ khóa quan trọng |
| **Trích xuất bảng thuật ngữ (Glossary)** | ❌ Không hỗ trợ | ✅ **Hỗ trợ** | Tự động lập bảng thuật ngữ chuyên ngành đối chiếu song ngữ |
| **Định dạng tải xuống bản dịch** | **PDF, TXT** | **PDF, Word (.docx), TXT** | Pro hỗ trợ tải về tệp Word giữ định dạng để tiếp tục chỉnh sửa |
| **Ngôn ngữ đích hỗ trợ** | Đa ngôn ngữ | Đa ngôn ngữ | Tiếng Việt, Anh, Pháp, Đức, Trung, Nhật, Hàn và hơn 30 ngôn ngữ |

### 2.3. Nhóm 3: Lưu Trữ & Đặc Quyền Hồ Sơ (Storage & VIP Identity)

| Tiêu Chí / Tính Năng | Gói Miễn Phí (Free) | Gói Nâng Cao (Pro) | Chi Tiết Kỹ Thuật |
|---|:---:|:---:|---|
| **Kho lưu trữ tài liệu cá nhân** | **5 tệp gần đây** | **Không giới hạn** | Lưu trữ đám mây an toàn, tra cứu lại bản dịch bất cứ lúc nào |
| **Huy hiệu nhận diện tài khoản** | **Không có nhãn** | **Huy hiệu VIP** | Hiển thị huy hiệu VIP nổi bật trên thanh Sidebar và hồ sơ tài khoản |
| **Nhật ký lịch sử xử lý** | Lưu 30 ngày | **Lưu trữ vĩnh viễn** | Tra cứu trạng thái, thời gian xử lý và tải lại tệp tin |
| **Chính sách quản lý & Hủy gia hạn** | Mặc định | **Hủy bất cứ lúc nào** | Người dùng chủ động bật / tắt tự động gia hạn trong phần cài đặt |
| **Hỗ trợ kỹ thuật** | Hỗ trợ cộng đồng | **Ưu tiên 24/7** | Giải quyết sự cố và phản hồi yêu cầu qua kênh ưu tiên |

---

## 3. Kiến Trúc Đồng Bộ Giữa Giao Diện & Cơ Sở Dữ Liệu

Mọi quy chuẩn hạn mức trên được bảo toàn tính nhất quán đa tầng:
1. **Frontend UI ([`Code/frontend/index.html`](file:///c:/University%20Coding%20Project/PDF-Lingua/Code/frontend/index.html))**: Hiển thị bảng đối chiếu minh bạch, tự động cập nhật mức giá và số ngày sử dụng khi người dùng chuyển đổi chu kỳ thanh toán.
2. **Frontend Validation ([`Code/frontend/js/workspace.js`](file:///c:/University%20Coding%20Project/PDF-Lingua/Code/frontend/js/workspace.js))**: Kiểm tra dung lượng tệp tải lên (20MB đối với Free, 100MB đối với Pro) ngay tại Dropzone để thông báo kịp thời.
3. **Backend Service ([`Code/backend/app/services/subscription_service.py`](file:///c:/University%20Coding%20Project/PDF-Lingua/Code/backend/app/services/subscription_service.py))**: Quản lý vòng đời đăng ký, đối soát mã VietQR và phân quyền truy cập API theo vai trò người dùng (`free` / `pro` / `admin`).

