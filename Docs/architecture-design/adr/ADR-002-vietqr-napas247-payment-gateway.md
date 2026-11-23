# ADR-002: Lựa Chọn Cổng Thanh Toán VietQR Napas247 Qua SePay Webhook

| Thuộc tính | Chi tiết |
|---|---|
| **Mã định danh** | ADR-002 |
| **Tiêu đề** | Lựa chọn cổng thanh toán VietQR Napas247 kết hợp SePay Webhook tự động |
| **Trạng thái** | Accepted (Đã chấp thuận) |
| **Ngày quyết định** | 20/09/2026 |
| **Người quyết định** | Nhóm Kỹ sư Kiến trúc PDF-Lingua (Nhóm 19) |
| **Tài liệu liên quan** | [`Docs/pricing-plans/pricing-plans.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/pricing-plans/pricing-plans.md), [`Docs/workflows/business-workflows.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/workflows/business-workflows.md) |

---

## 1. Context (Bối cảnh kỹ thuật)

PDF-Lingua hướng tới đối tượng người dùng chính tại Việt Nam là sinh viên, nghiên cứu sinh, giảng viên đại học và các chuyên gia nghiên cứu tài liệu học thuật. Để duy trì hạ tầng AI và chống lạm dụng tài nguyên, hệ thống triển khai mô hình kinh doanh Freemium (Gói Miễn Phí và Gói Pro VIP).

Hệ thống cần một giải pháp thanh toán đáp ứng các yêu cầu:
1. **Khả năng tiếp cận cao**: Đại đa số sinh viên Việt Nam không sở hữu thẻ tín dụng quốc tế (Visa/Mastercard) nhưng 100% đều có tài khoản ngân hàng nội địa với ứng dụng Mobile Banking quét mã QR.
2. **Chi phí giao dịch**: Các cổng thanh toán quốc tế thu phí rất cao (2.9% + $0.30 mỗi giao dịch, chiếm tỉ trọng lớn đối với các gói cước 49.000 VNĐ).
3. **Tự động hóa hoàn toàn**: Không cần nhân viên duyệt chuyển khoản thủ công; hệ thống phải tự động nhận diện giao dịch chuyển tiền và nâng cấp tài khoản cho người dùng ngay lập tức.

---

## 2. Decision (Nội dung quyết định)

Hệ thống quyết định tích hợp chuẩn thanh toán **VietQR Napas247** sử dụng dịch vụ trung gian **SePay Webhook**:
- **Tạo mã QR động**: Mỗi yêu cầu nâng cấp gói cước sẽ sinh một mã VietQR chuẩn chứa số tài khoản, tên chủ tài khoản và mã nội dung chuyển khoản duy nhất (`SUB-11-XXXXX-XX`).
- **Xử lý Webhook tức thì**: Khi người dùng chuyển khoản qua ứng dụng ngân hàng, ngân hàng gửi biến động số dư tới SePay, SePay gửi HTTP POST Webhook tới endpoint `/api/pricing/webhook/sepay` của PDF-Lingua.
- **Khớp lệnh & Phân quyền**: Hệ thống kiểm tra số tiền, mã nội dung chuyển khoản, nâng cấp trạng thái người dùng sang `PRO` và gia hạn 30 ngày (Gói Tháng) hoặc 365 ngày (Gói Năm) trong vòng chưa tới 3 giây.

---

## 3. Alternatives Considered (Các phương án đối trọng đã cân nhắc)

| Phương án | Ưu điểm | Nhược điểm & Lý do loại bỏ |
|---|---|---|
| **Phương án A: Stripe / PayPal** | Cổng thanh toán chuẩn quốc tế, tài liệu API hoàn thiện. | Bắt buộc phải có thẻ Visa/Mastercard (rào cản lớn với sinh viên Việt Nam); phí giao dịch cao; thủ tục đăng ký pháp nhân phức tạp. |
| **Phương án B: Cổng VNPAY / Momo Merchant** | Phổ biến tại Việt Nam. | Đòi hỏi giấy phép đăng ký kinh doanh doanh nghiệp và hồ sơ pháp lý thương mại, không thể áp dụng cho đồ án tốt nghiệp đại học của nhóm sinh viên. |
| **Phương án C: Chuyển khoản thủ công & Chụp màn hình bill** | Dễ làm nhất, không cần viết code tích hợp. | Trải nghiệm người dùng kém; không tự động hóa; tốn nhân sự trực duyệt; dễ bị làm giả ảnh chụp biên lai (fake bill). |
| **Phương án Được Chọn: VietQR + SePay Webhook** | Người dùng quét mã trên bất kỳ ngân hàng nào; chi phí 0%; tự động khớp lệnh dưới 3 giây; sinh viên có thể đăng ký tài khoản thử nghiệm hợp pháp ngay trong môi trường đồ án. | Phụ thuộc vào dịch vụ trung gian SePay để bắt biến động số dư. |

---

## 4. Consequences & Trade-offs (Hệ quả & Đánh đổi)

### Điểm tích cực (Gains):
- **Trải nghiệm người dùng liền mạch**: Quét mã QR bằng App ngân hàng bất kỳ, không cần nhập số tài khoản hay nội dung, tài khoản được kích hoạt Pro ngay lập tức.
- **An toàn giao dịch**: Mã giao dịch duy nhất ngăn chặn gian lận nạp tiền trùng lặp (Idempotency Key).

### Điểm đánh đổi (Trade-offs) & Giải pháp khắc phục:
- **Đánh đổi**: Cần bảo vệ an toàn cho endpoint Webhook công khai để tránh bị hacker bắn request giả mạo biến động số dư.
- **Giải pháp**: Kiểm tra `API Key` bí mật trong header của Webhook và kiểm tra tính hợp lệ của số tiền nạp khớp với cấu hình hệ thống trước khi kích hoạt.
