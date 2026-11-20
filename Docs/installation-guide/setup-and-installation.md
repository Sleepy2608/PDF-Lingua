# HƯỚNG DẪN CÀI ĐẶT, CẤU HÌNH MÔI TRƯỜNG & VẬN HÀNH (INSTALLATION GUIDE)

## DỰ ÁN: NỀN TẢNG DỊCH THUẬT TÀI LIỆU PDF HỌC THUẬT & TRỢ LÝ AI (PDF-LINGUA)

| Thông tin | Chi tiết |
|---|---|
| **Tên dự án (EN)** | PDF-Lingua: Academic PDF Translation & AI Research Assistant |
| **Tên dự án (VN)** | Nền tảng Dịch thuật PDF Học thuật & Trợ lý Nghiên cứu AI |
| **Loại tài liệu** | Installation & Operations Guide |
| **Viết tắt** | PDF-Lingua |
| **Phiên bản tài liệu** | 1.2 |
| **Ngày tạo** | 15/09/2026 |
| **Ngày chỉnh sửa lần cuối** | 20/11/2026 |
| **Trạng thái** | Hoàn thành (Release) |

---

## 1. Yêu Cầu Môi Trường Hệ Thống (Prerequisites)

Để triển khai và vận hành hệ thống một cách tối ưu, máy chủ hoặc máy tính cá nhân cần đáp ứng các yêu cầu sau:

| Thành phần | Yêu cầu tối thiểu | Khuyến nghị |
| :--- | :--- | :--- |
| **Hệ điều hành** | Windows 10/11 (64-bit) hoặc Ubuntu 22.04 LTS | Windows 11 Pro hoặc Ubuntu 24.04 LTS |
| **Python** | Python 3.12+ (kèm `pip` và `venv`) | Python 3.12.6 |
| **Node.js** | Node.js 18+ (dành cho bộ test suites) | Node.js 20 LTS |
| **Tesseract OCR** | Tesseract OCR 5.0+ (kèm gói tiếng Việt `vie`) | Tesseract 5.3+ |
| **RAM** | Tối thiểu 4 GB RAM khả dụng | 8 GB - 16 GB RAM |
| **Ổ cứng** | Trống tối thiểu 2 GB dung lượng | Ổ cứng SSD |

---

## 2. Hướng Dẫn Cài Đặt Tesseract OCR Tiếng Việt

Động cơ OCR cục bộ yêu cầu binary Tesseract để trích xuất văn bản từ các trang scan:

### Trên hệ điều hành Windows:
1. Tải bộ cài Tesseract 64-bit chính thức từ nguồn GitHub hoặc UB-Mannheim (`tesseract-ocr-w64-setup-v5.x.exe`).
2. Tiến hành cài đặt vào đường dẫn mặc định: `C:\Program Files\Tesseract-OCR\`.
3. **Lưu ý quan trọng**: Trong màn hình lựa chọn gói ngôn ngữ (*Choose Components*), cuộn xuống mục **Additional script data** và **Additional language data**, tích chọn **Vietnamese** để tự động tải tệp `vie.traineddata`.
4. Nếu đã cài trước đó mà thiếu tiếng Việt, tải tệp `vie.traineddata` và sao chép vào thư mục: `C:\Program Files\Tesseract-OCR\tessdata\`.

### Trên hệ điều hành Ubuntu / Linux:
```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-vie libgl1
```

---

## 3. Cấu Hình Biến Môi Trường (.env)

Sao chép tệp mẫu từ `Code/backend/.env.example` thành `.env` tại thư mục gốc hoặc thư mục `Code/backend/`:

```bash
cp Code/backend/.env.example Code/backend/.env
```

### Bảng Giải Thích Các Tham Số Cấu Hình Quan Trọng:

| Tên biến | Giá trị mẫu | Giải thích ý nghĩa |
| :--- | :--- | :--- |
| `APP_NAME` | `PDF-Lingua` | Tên định danh của ứng dụng trên Swagger UI |
| `APP_ENV` | `development` | Môi trường chạy (`development` / `production`) |
| `SECRET_KEY` | `dev-secret-key-pdf-lingua-min-32-chars` | Khóa bí mật dùng để ký và giải mã JWT token (tối thiểu 32 ký tự) |
| `ALGORITHM` | `HS256` | Thuật toán mã hóa JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Thời gian hết hạn của token đăng nhập (1440 phút = 24 giờ) |
| `DATABASE_URL` | `sqlite:///./pdf_lingua.db` | Chuỗi kết nối cơ sở dữ liệu SQLite |
| `HOST` | `0.0.0.0` | Địa chỉ mạng lắng nghe kết nối API |
| `PORT` | `8000` | Cổng dịch vụ FastAPI |
| `TESSERACT_CMD` | `C:\Program Files\Tesseract-OCR\tesseract.exe` | Đường dẫn đến tệp thực thi của Tesseract OCR trên Windows |
| `GEMINI_API_KEY` | *(Tùy chọn)* | API key dành cho các dịch vụ AI bên ngoài |
| `SEPAY_WEBHOOK_SECRET` | *(Tùy chọn)* | Khóa xác thực an toàn cho Webhook thanh toán VietQR |

---

## 4. Khởi Động Nhanh Một Chạm Với `run.bat` (Windows)

Để thuận tiện nhất cho việc chấm đồ án và trình diễn demo, dự án đã tích hợp sẵn tập lệnh tự động hóa `run.bat` tại thư mục gốc của repository:

1. Nhấp đúp chuột vào tệp [`run.bat`](file:///c:/University%20Coding%20Project/PDF-Lingua/run.bat) (hoặc chạy lệnh `.\run.bat` trong cửa sổ PowerShell/CMD).
2. Tập lệnh sẽ tự động:
   - Kiểm tra và tự động khởi tạo môi trường ảo Python Virtualenv (`Code/backend/venv`).
   - Tự động cài đặt các thư viện cần thiết từ `requirements.txt`.
   - Tự động kiểm tra tính khả dụng của động cơ Tesseract OCR tiếng Việt.
   - Khởi chạy máy chủ Backend FastAPI tại địa chỉ `http://localhost:8000`.
   - Tự động mở giao diện ứng dụng trên trình duyệt web mặc định.

---

## 5. Khởi Động Thủ Công Từng Bước (Manual Startup)

Nếu bạn muốn kiểm soát từng dịch vụ bằng dòng lệnh:

### Bước 1: Khởi động Backend FastAPI
```powershell
cd "Code\backend"
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Truy cập tài liệu API tương tác trực tiếp (Swagger UI): `http://localhost:8000/docs`
- Kiểm tra trạng thái máy chủ (Health check): `http://localhost:8000/health`

### Bước 2: Khởi động Giao diện Frontend
Mở một cửa sổ dòng lệnh thứ hai:
```powershell
cd "Code\frontend"
python -m http.server 3000
```
- Mở trình duyệt và truy cập: `http://localhost:3000` (hoặc mở trực tiếp tệp `Code/frontend/index.html`).

---

## 6. Hướng Dẫn Chạy Kiểm Thử Tự Động (Testing)

### Chạy toàn bộ 10 bài kiểm tra Frontend:
```powershell
node -e "
const fs = require('fs');
const { execSync } = require('child_process');
fs.readdirSync('Code/frontend/tests').filter(f => f.endsWith('.js')).forEach(f => {
  execSync('node Code/frontend/tests/' + f, { stdio: 'inherit' });
});
"
```

### Chạy kiểm thử Backend:
```powershell
cd "Code\backend"
python -m pytest ../tests -v
```

---

## 7. Khắc Phục Sự Cố Thường Gặp (Troubleshooting)

1. **Lỗi `tesseract is not installed or it's not in your PATH`**:
   - Mở tệp `.env` trong `Code/backend/` và kiểm tra lại đường dẫn `TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe`. Đảm bảo đường dẫn chỉ đúng đến tệp `tesseract.exe`.
2. **Lỗi cổng 8000 đã bị chiếm dụng (Port 8000 in use)**:
   - Chạy lệnh tìm tiến trình đang giữ cổng: `netstat -ano | findstr :8000` sau đó tắt tiến trình đó hoặc đổi cổng khác trong file `.env` (ví dụ `PORT=8080`).
3. **Lỗi khóa cơ sở dữ liệu (`database is locked`)**:
   - Xảy ra khi có nhiều tiến trình cùng ghi vào SQLite mà chưa đóng connection. Hãy đóng các phiên debug cũ hoặc xóa tệp cơ sở dữ liệu tạm thời để hệ thống tự động tái tạo bảng mới.

