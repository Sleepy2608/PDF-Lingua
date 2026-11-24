# PHƯƠNG THỨC 1: DOANH THU THUÊ BAO GÓI PRO VIP (B2C SUBSCRIPTION)

## DỰ ÁN: NỀN TẢNG DỊCH THUẬT TÀI LIỆU PDF HỌC THUẬT & TRỢ LÝ AI (PDF-LINGUA)

| Thông tin | Chi tiết |
|---|---|
| **Dự án** | PDF-Lingua: Academic PDF Translation & AI Research Assistant |
| **Phân hệ kinh doanh** | Mô hình Thuê bao Người dùng cuối (B2C Freemium to Premium) |
| **Phương thức thu tiền** | Thanh toán trực tuyến tự động qua VietQR Napas247 / SePay Webhook |
| **Tài liệu đặc tả kỹ thuật** | [`Docs/pricing-plans/pricing-plans.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/pricing-plans/pricing-plans.md) |
| **Phiên bản** | 1.0 |

---

## 1. Bản Chất Mô Hình Kinh Doanh

Mô hình **B2C Subscription** nhắm trực tiếp vào người dùng có nhu cầu xử lý tài liệu học thuật ở cường độ cao (giảng viên, nghiên cứu sinh, sinh viên làm khóa luận, chuyên gia nghiên cứu). Người dùng trả phí định kỳ để mở khóa các năng lực điện toán nâng cao và hạn mức mở rộng.

---

## 2. Bảng Giá & Cơ Cấu Gói Cước

| Gói Cước | Chu Kỳ Thanh Toán | Mức Phí Niêm Yết | Mức Phí Thực Tế | Giá Trị Tiết Kiệm | Đối Tượng Mục Tiêu |
|---|---|---|---|---|---|
| **Gói Miễn Phí (Free)** | Vĩnh viễn | 0đ | **0đ** | - | Sinh viên tra cứu tài liệu ngắn, dịch thử nghiệm |
| **Gói Pro Tháng** | 30 ngày | 49.000đ | **49.000đ / tháng** | - | Người dùng có nhu cầu ngắn hạn theo mùa thi, mùa bảo vệ đồ án |
| **Gói Pro Năm** | 365 ngày | 588.000đ | **399.000đ / năm** | **Tiết kiệm 32%** (~33.250đ/tháng) | Giảng viên, nghiên cứu sinh có nhu cầu đọc dịch tài liệu thường xuyên quanh năm |

---

## 3. Đặc Quyền Độc Quyền Của Gói Pro VIP

Người dùng khi nâng cấp lên Pro VIP được hưởng 5 đặc quyền vượt trội so với tài khoản Free:

1. **Hạn mức tài liệu mở rộng**:
   - Dung lượng tệp PDF tối đa tăng từ **20 MB** lên **100 MB** (xử lý tốt các tài liệu scan độ phân giải cao).
   - Hạn mức trang OCR tăng từ **100 trang** lên **500 trang** mỗi tệp.
2. **Trợ lý AI Copilot chuyên sâu**:
   - Mở khóa tính năng hỏi đáp chuyên sâu ngữ cảnh tài liệu: **15 câu hỏi/ngày** (tài khoản Free không có tính năng này).
   - Tự động lập bảng thuật ngữ chuyên ngành (Glossary) đối chiếu song ngữ.
3. **Ưu tiên hàng đợi xử lý (Fast-track Worker)**:
   - Tác vụ của người dùng Pro được định tuyến vào hàng đợi ưu tiên cao, giảm 70% thời gian chờ đợi vào giờ cao điểm.
4. **Định dạng tải xuống cao cấp**:
   - Hỗ trợ xuất kết quả dịch sang tệp Microsoft Word (`.docx`) giữ nguyên cấu trúc để tiếp tục biên tập, bên cạnh PDF và TXT thông thường.
5. **100% Hoàn toàn không quảng cáo (Ad-Free Experience)**:
   - Hệ thống tự động ẩn toàn bộ banner và thông điệp tài trợ trên giao diện, tạo không gian làm việc tĩnh lặng, tập trung tối đa cho người nghiên cứu.

---

## 4. Cơ Chế Thanh Toán Tự Động (VietQR Napas247)

- **Không cần thẻ quốc tế**: Tận dụng 100% ứng dụng ngân hàng số nội địa Việt Nam.
- **Tự động đối soát**: Mã nội dung chuyển khoản duy nhất `SUB-11-XXXXX-XX` được tạo riêng cho từng phiên.
- **Kích hoạt tức thì**: Nhận tín hiệu Webhook từ SePay, kiểm tra tính toàn vẹn số tiền và tự động nâng hạng tài khoản sang vai trò `pro` trong vòng **dưới 3 giây** mà không cần người dùng tải lại trang.

---

## 5. Ưu Điểm & Thách Thức Của Mô Hình Gói Pro

### Ưu điểm:
- **Doanh thu định kỳ có tính dự đoán cao (MRR - Monthly Recurring Revenue)**: Người dùng đăng ký gói năm đem lại dòng tiền trả trước ổn định.
- **Biên lợi nhuận cao**: Chi phí biến đổi trên mỗi lượt gọi OCR/AI được kiểm soát chặt chẽ bằng trần hạn mức (15 câu hỏi/ngày, 500 trang/tệp), đảm bảo hệ thống luôn có lãi ròng trên mỗi tài khoản Pro.

### Thách thức & Giải pháp:
- **Tỷ lệ chuyển đổi tự nhiên thường khiêm tốn (2-5%)**: Đa số sinh viên có xu hướng dùng miễn phí.
- **Giải pháp**: Dùng chính **quảng cáo hiển thị** ở tài khoản Free và giới hạn 20MB/10 trang OCR làm đòn bẩy kích thích nâng cấp Pro.
