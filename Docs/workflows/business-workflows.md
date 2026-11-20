# QUY TRÌNH NGHIỆP VỤ & SƠ ĐỒ TUẦN TỰ (BUSINESS WORKFLOWS)

## DỰ ÁN: NỀN TẢNG DỊCH THUẬT TÀI LIỆU PDF HỌC THUẬT & TRỢ LÝ AI (PDF-LINGUA)

| Thông tin | Chi tiết |
|---|---|
| **Tên dự án (EN)** | PDF-Lingua: Academic PDF Translation & AI Research Assistant |
| **Tên dự án (VN)** | Nền tảng Dịch thuật PDF Học thuật & Trợ lý Nghiên cứu AI |
| **Loại tài liệu** | Business Workflows & Sequence Diagrams |
| **Viết tắt** | PDF-Lingua |
| **Phiên bản tài liệu** | 1.2 |
| **Ngày tạo** | 15/09/2026 |
| **Ngày chỉnh sửa lần cuối** | 20/11/2026 |
| **Trạng thái** | Hoàn thành (Release) |

---

## 1. Quy Trình Xử Lý & Dịch Thuật Tài Liệu PDF (PDF Translation Workflow)

Quy trình mô tả chuỗi tương tác từ khi người dùng tải tệp PDF lên đến khi nhận được bản dịch song ngữ:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng (Client)
    participant UI as Giao diện Web SPA
    participant API as Cổng API (/api/process)
    participant Sec as Bộ Thẩm Định Bảo Mật
    participant Storage as Dịch Vụ Lưu Trữ (StorageService)
    participant Engine as Động cơ Xử lý (PDF/OCR)
    participant Trans as Động cơ Dịch thuật (TranslationService)
    participant DB as Cơ sở dữ liệu SQLite

    User->>UI: Kéo thả tệp PDF và chọn ngôn ngữ đích
    UI->>API: POST /api/process/upload-and-translate (Multipart)
    API->>Sec: Kiểm tra MIME, Magic Bytes (%PDF-1.) & Path Traversal
    alt Tệp không hợp lệ (sai magic bytes, rỗng, lỗi)
        Sec-->>UI: Trả về HTTP 400 Bad Request
        UI-->>User: Hiển thị thông báo lỗi chi tiết
    else Tệp hợp lệ
        Sec-->>API: Phê duyệt tệp an toàn
        API->>Storage: Lưu tệp gốc vào storage/user_{id}/documents/
        API->>Engine: Kích hoạt Hybrid Fast Path (Bóc tách hoặc OCR)
        Engine->>Engine: Sắp xếp luồng đọc tự nhiên (Smart Layout 2 cột)
        Engine-->>API: Trả về cấu trúc khối văn bản
        API->>Trans: Smart Chunking & Dịch thuật đa luồng
        Trans-->>API: Trả về danh sách đoạn văn bản đã dịch đối chiếu
        API->>Storage: Lưu tệp kết quả JSON vào storage/user_{id}/results/
        API->>DB: Ghi nhận bản ghi ProcessingHistory (SUCCESS)
        API-->>UI: Trả về HTTP 200 OK kèm dữ liệu song ngữ
        UI-->>User: Hiển thị giao diện đọc song ngữ 2 cột đồng bộ cuộn
    end
```

---

## 2. Quy Trình Nâng Cấp Gói Cước Tự Động Qua VietQR & SePay Webhook

Quy trình tự động hóa kích hoạt tài khoản PRO không cần sự can thiệp thủ công của quản trị viên:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant UI as Giao diện Bảng Giá
    participant API as Pricing API (/api/pricing)
    participant DB as Cơ sở dữ liệu
    participant BankApp as Ứng dụng Ngân Hàng (Mobile Banking)
    participant SePay as Cổng SePay Webhook

    User->>UI: Chọn gói Pro (Tháng hoặc Năm) -> Bấm Nâng cấp
    UI->>API: POST /api/pricing/subscribe
    API->>DB: Tạo bản ghi Subscription (Trạng thái: PENDING)
    API->>API: Sinh mã VietQR Napas247 kèm mã nội dung giao dịch duy nhất
    API-->>UI: Trả về URL ảnh VietQR + Thông tin chuyển khoản
    UI-->>User: Hiển thị Pop-up chứa mã QR và hướng dẫn thanh toán
    
    User->>BankApp: Quét mã VietQR và thực hiện chuyển khoản
    BankApp->>BankApp: Giao dịch thành công qua liên ngân hàng Napas247
    BankApp-->>SePay: Biến động số dư tài khoản nhận
    SePay->>API: POST /api/pricing/webhook (kèm X-Webhook-Secret)
    API->>API: Xác thực chữ ký bí mật Webhook
    API->>DB: Khớp mã nội dung chuyển khoản & Kiểm tra số tiền
    API->>DB: Cập nhật Subscription -> ACTIVE (30 ngày hoặc 365 ngày)
    API->>DB: Nâng cấp vai trò User -> PRO
    API-->>SePay: Trả về HTTP 200 OK (Đã xử lý)
    
    loop Polling trạng thái giao dịch
        UI->>API: GET /api/pricing/transactions/{code}/status
        API-->>UI: Trả về status: "ACTIVE"
    end
    UI-->>User: Bật thông báo Chúc mừng nâng cấp thành công gói PRO!
```

---

## 3. Quy Trình Tóm Tắt & Hỏi Đáp Ngữ Cảnh AI Copilot

Quy trình bóc tách câu hỏi, nạp ngữ cảnh tài liệu và sinh phản hồi thông minh:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng (PRO / ADMIN)
    participant UI as Khung Chat AI Copilot
    participant API as Cổng API AI (/api/ai)
    participant Storage as Dịch Vụ Lưu Trữ
    participant AISvc as AIService
    participant LLM as Cổng Multi-Model Gateway (B.AI / Gemini)
    participant DB as Nhật ký Lịch sử

    User->>UI: Đặt câu hỏi: "Phương pháp đánh giá độ trễ là gì?"
    UI->>API: POST /api/ai/chat (kèm document_id & message)
    API->>API: Xác thực JWT Token & Kiểm tra quyền PRO
    API->>Storage: Tải nội dung văn bản tài liệu đã bóc tách
    API->>AISvc: Xây dựng System Prompt kèm Document In-Context
    
    alt Kết nối Internet và Quota API khả dụng
        AISvc->>LLM: Gửi yêu cầu hoàn thành câu đối thoại
        LLM-->>AISvc: Trả về văn bản giải đáp ngữ cảnh chính xác
    else Mất kết nối hoặc Quota bị cạn kiệt
        AISvc->>AISvc: Kích hoạt Extractive Heuristic Fallback
        AISvc-->>API: Trả về đoạn văn trích xuất chứa từ khóa trọng tâm
    end
    
    API->>DB: Lưu tin nhắn vào ProcessingHistory
    API-->>UI: Trả về HTTP 200 OK kèm câu trả lời
    UI-->>User: Hiển thị phản hồi từ PDF-Lingua Copilot
```

---

## 4. Vòng Đời Trạng Thái Thuê Bao (Subscription State Lifecycle)

```mermaid
stateDiagram-v2
    [*] --> PENDING: Khởi tạo giao dịch VietQR
    PENDING --> ACTIVE: Nhận Webhook SePay hoặc Mô phỏng thành công
    PENDING --> FAILED: Hủy giao dịch hoặc Hết thời gian chờ (15 phút)
    ACTIVE --> ACTIVE: Mua gia hạn (Cộng dồn thời gian vào expires_at)
    ACTIVE --> EXPIRED: Hết hạn thời gian (expires_at < Hiện tại)
    EXPIRED --> FREE: Tự động hạ vai trò về FREE (Bảo lưu nếu là ADMIN)
    ACTIVE --> CANCELLED: Người dùng chủ động hủy tự động gia hạn
    CANCELLED --> EXPIRED: Vẫn giữ quyền PRO đến hết chu kỳ đã thanh toán
```

