# PHƯƠNG THỨC 2: DOANH THU QUẢNG CÁO & TÀI TRỢ (B2B ADVERTISING & SPONSORSHIP)

## DỰ ÁN: NỀN TẢNG DỊCH THUẬT TÀI LIỆU PDF HỌC THUẬT & TRỢ LÝ AI (PDF-LINGUA)

| Thông tin | Chi tiết |
|---|---|
| **Dự án** | PDF-Lingua: Academic PDF Translation & AI Research Assistant |
| **Phân hệ kinh doanh** | Mô hình Quảng cáo Trực tiếp & Tài trợ Doanh nghiệp (B2B Ad & Sponsorship) |
| **Đối tượng chi trả** | Trung tâm ngoại ngữ, Nhà xuất bản, Đơn vị du học, Nền tảng EdTech, Doanh nghiệp công nghệ |
| **Phương thức tiếp cận** | Tự quản trị banner nội bộ (In-house) + Mạng quảng cáo tự động |
| **Phiên bản** | 1.0 |

---

## 1. Bản Chất Mô Hình Kinh Doanh

Mô hình **B2B Advertising & Sponsorship** khai thác triệt để giá trị từ **tệp người dùng miễn phí (Free Tier & Khách vãng lai)**. Thay vì để 95% người dùng không trả phí tạo ra gánh nặng chi phí máy chủ, hệ thống biến lưu lượng truy cập học thuật chất lượng cao thành không gian hiển thị banner và thông điệp tài trợ của các đối tác giáo dục.

---

## 2. Các Vị Trí Hiển Thị Quảng Cáo Trên Giao Diện (Ad Slots)

Hệ thống thiết kế 4 vị trí hiển thị chuẩn mực theo phong cách **Apple Human Interface Guidelines (HIG)**, bảo đảm tính thanh lịch và không làm gián đoạn luồng làm việc của người dùng:

| Vị Trí (Slot) | Vị Trí Cụ Thể | Thời Điểm Hiển Thị | Kích Thước Khuyến Nghị | Định Dạng & Trải Nghiệm |
|---|---|---|---|---|
| **Slot 1: Sidebar Sponsor Box** | Nằm ở đáy thanh điều hướng Sidebar bên trái (dưới mục *Tài Liệu Gần Đây*). | Hiển thị liên tục khi duyệt trang. | `240 x 120 px` (Dạng thẻ Card phẳng) | Hình ảnh banner đối tác + Tiêu đề ngắn + Nút xem chi tiết. |
| **Slot 2: Processing Progress Ad** | Bên trong Modal tiến trình khi người dùng tải tệp PDF lên và chờ hệ thống phân loại, OCR hoặc dịch thuật. | Xuất hiện trong 3 đến 10 giây chờ xử lý (Waiting Time). | `480 x 160 px` (Banner trung tâm) | Thông điệp tài trợ sinh động ("Tài trợ bởi Khóa luyện thi IELTS X - Ưu đãi 30% sinh viên"). |
| **Slot 3: Workspace Bottom Strip** | Dải băng chân trang cố định ở đáy không gian làm việc song ngữ (Dual-pane View). | Xuất hiện khi người dùng đang đọc và đối chiếu văn bản. | `728 x 60 px` (Dải băng Leaderboard gọn) | Logo thương hiệu + Text link tài trợ tinh tế. |
| **Slot 4: Welcome Landing Showcase** | Khối danh mục đối tác đồng hành tại trang chủ giới thiệu (`welcome.html`). | Xuất hiện khi khách truy cập tìm hiểu phần mềm. | Grid 4 cột đối tác | Logo đối tác tài trợ + Liên kết dẫn về website đối tác. |

> [!IMPORTANT]
> **Bộ lọc quyền tự động (Role-based Ad Suppression)**: Toàn bộ 4 vị trí quảng cáo trên chỉ kích hoạt đối với người dùng `Guest` hoặc `Free`. Khi người dùng đăng nhập tài khoản `PRO` hoặc `ADMIN`, hệ thống tự động loại bỏ hoàn toàn các phần tử DOM này.

---

## 3. Quy Trình Thuê & Liên Hệ Quảng Cáo (Sponsor Booking Workflow)

Hệ thống tạo kênh kết nối trực tiếp, minh bạch để các đối tác có thể liên hệ thuê vị trí:

1. **Điểm chạm trên giao diện (CTA Touchpoint)**:
   - Tại mỗi khung quảng cáo có biểu tượng thông tin `(i)` và dòng chữ: *"Đặt quảng cáo tại đây? Nhấp để liên hệ"*.
   - Mục chân trang (Footer) có liên kết: *"Hợp tác & Tài trợ truyền thông"*.
2. **Biểu mẫu tiếp nhận yêu cầu (Booking Modal)**:
   - Cho phép đối tác gửi thông tin: Tên đơn vị, Vị trí mong muốn, Thời gian dự kiến thuê, Hình ảnh/Link đích.
   - Hệ thống tự động chuyển thông tin về cho Quản trị viên qua Email, Telegram hoặc Zalo.
3. **Kênh trao đổi trực tiếp với Quản trị viên**:
   - Email: `ads@pdf-lingua.vn`
   - Hotline / Zalo: Số điện thoại quản trị viên
   - Ký kết hợp đồng và nhận thanh toán chuyển khoản trực tiếp qua ngân hàng.

---

## 4. Các Gói Báo Giá Tài Trợ (Sponsorship Packages)

| Gói Dịch Vụ | Hình Thức Thu Phí | Mức Giá Tham Chiếu | Quyền Lợi Đối Tác |
|---|---|---|---|
| **Gói Tuần (Weekly Sponsor)** | Phí cố định theo tuần | **300.000 VNĐ / tuần** | Đặt banner tại Slot 1 (Sidebar) hoặc Slot 3 (Workspace); cam kết tối thiểu 5.000 lượt hiển thị. |
| **Gói Tháng (Monthly Sponsor)** | Phí cố định theo tháng | **1.000.000 VNĐ / tháng** | Độc quyền xuất hiện tại Slot 2 (Cửa sổ chờ dịch PDF) + Slot 1; miễn phí chỉnh sửa kích thước banner. |
| **Gói Độc Quyền Toàn Trang (Diamond)** | Thuê toàn bộ 4 vị trí | **2.500.000 VNĐ / tháng** | Xuất hiện đồng loạt trên mọi vị trí và đặt logo trang trọng tại trang chủ giới thiệu. |
| **Gói Theo Lượt Tiếp Cận (CPM)** | Trả theo lượt xem | **25.000 VNĐ / 1.000 views** | Phù hợp chiến dịch tuyển sinh ngắn hạn của các trung tâm du học / đào tạo. |

---

## 5. Kiến Trúc Kỹ Thuật (In-House Ad Engine)

- **Không bị chặn bởi AdBlock**: Sử dụng hệ thống tự host banner từ thư mục `storage/ads/` và phục vụ trực tiếp qua API nội bộ `/api/ads/active`, không thông qua mạng lưới bên thứ ba.
- **Thống kê minh bạch**: Cơ chế tự động đếm số lần xuất hiện (`impressions`) và số lần nhấp chuột (`clicks`), giúp lập báo cáo kiểm toán hiệu quả cho nhà tài trợ vào cuối kỳ thanh toán.

---

## 6. Tiêu Chuẩn Kiểm Duyệt Nội Dung (Ad Quality Policy)

- **Được chấp thuận**: Giáo dục, đào tạo ngoại ngữ, sách giáo trình, công cụ học tập công nghệ, du học, việc làm thực tập sinh.
- **Cấm tuyệt đối**: Cờ bạc, cá độ, tiền ảo, nội dung người lớn, quảng cáo lừa đảo (dạng nút download giả), quảng cáo chớp nháy gây ảnh hưởng thị lực.
