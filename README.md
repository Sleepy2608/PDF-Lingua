# PDF-Lingua 📄🌐

> **PDF-Lingua** là công cụ hỗ trợ trích xuất, nhận dạng ký tự quang học (OCR) và dịch thuật tài liệu PDF thông minh, hướng tới việc giữ nguyên bố cục và hỗ trợ đa ngôn ngữ.

---

## 📁 Cấu trúc dự án (Project Structure)

```text
PDF-Lingua/
├── .jira/                      # Các task trên jira
├── Code/
│   ├── frontend/
│   │   ├── index.html          # Giao diện người dùng chính
│   │   ├── css/
│   │   │   └── style.css       # Định kiểu giao diện
│   │   ├── js/
│   │   │   └── app.js          # Logic xử lý phía client
│   │   └── assets/             # Hình ảnh, icon và tài nguyên tĩnh
│   │
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py         # Entrypoint của FastAPI backend
│   │   │   ├── api/            # Định nghĩa các API endpoints
│   │   │   ├── services/       # Xử lý nghiệp vụ chính
│   │   │   │   ├── pdf_service.py         # Trích xuất & xử lý PDF
│   │   │   │   ├── ocr_service.py         # Nhận dạng văn bản OCR (Tesseract / EasyOCR)
│   │   │   │   └── translation_service.py # Dịch thuật nội dung
│   │   │   └── schemas/        # Pydantic models & data transfer objects
│   │   ├── requirements.txt    # Danh sách thư viện Python cần cài đặt
│   │   └── .env.example        # Mẫu biến môi trường cho backend
│   │
│   └── tests/                  # Kiểm thử tự động (Unit tests / Integration tests)
│
├── Docs/                       # Tài liệu báo cáo, hướng dẫn thiết kế & đặc tả
├── Extra/                      # Tài liệu bổ sung, slides, tài nguyên tham khảo
├── .env.example                # Cấu hình biến môi trường mẫu ở thư mục gốc
├── .gitignore                  # Cấu hình bỏ qua các file tạm/rác trên Git
└── README.md                   # Tài liệu giới thiệu dự án
```

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Frontend**: HTML5, Vanilla CSS, JavaScript.
- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic.
- **Xử lý PDF & OCR**: `pypdf`, `pdfplumber`, `pytesseract` / Tesseract OCR, `Pillow`.
- **Dịch thuật**: `googletrans` / `deep-translator`.

---

## 🚀 Hướng dẫn khởi chạy (Getting Started)

### 1. Chuẩn bị môi trường Backend

```bash
cd Code/backend
python -m venv venv

# Kích hoạt môi trường ảo:
# Trên Windows:
.\venv\Scripts\activate
# Trên Linux/macOS:
source venv/bin/activate

# Cài đặt thư viện:
pip install -r requirements.txt
```

### 2. Cấu hình biến môi trường

Sao chép file `.env.example` thành `.env` và điều chỉnh thông số cần thiết:

```bash
cp .env.example .env
```

### 3. Khởi chạy Backend Server

```bash
uvicorn app.main:app --reload --port 8000
```

Truy cập tài liệu API tự động tại: `http://localhost:8000/docs`

### 4. Khởi chạy Frontend

Mở trực tiếp file `Code/frontend/index.html` bằng trình duyệt hoặc sử dụng Live Server trong VS Code / IDE.