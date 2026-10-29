<div align="center">
  <h1>PDF-Lingua — Smart PDF Text Extraction & Multilingual AI Translation</h1>
  <img src="Code/frontend/assets/images/logo-app-transparent.png" alt="PDF-Lingua Logo" width="120" />
  <br><br>
  <p><em>
    <b>Đề tài:</b> Web trích xuất văn bản từ tài liệu PDF, dịch thuật đa ngôn ngữ và tích hợp AI <br>
    <b>Môn học:</b> Đồ án thực tế Công nghệ phần mềm
  </em></p>
  <p>
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.12"/>
    <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
    <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5"/>
    <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3"/>
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"/>
    <img src="https://img.shields.io/badge/Tesseract_OCR-5C6BC0?style=for-the-badge&logo=tesseract&logoColor=white" alt="Tesseract OCR"/>
  </p>
</div>

---

## Mục lục

1. [Giới thiệu hệ thống (System Introduction)](#giới-thiệu-hệ-thống-system-introduction)
2. [Danh sách thành viên nhóm (Member)](#danh-sách-thành-viên-nhóm-member)
3. [Tiến độ triển khai dự án (Project Deployment Progress)](#tiến-độ-triển-khai-dự-án-project-deployment-progress)
4. [Công nghệ sử dụng (Tech Stack)](#công-nghệ-sử-dụng-tech-stack)
5. [Cấu trúc thư mục (Project Structure)](#cấu-trúc-thư-mục-project-structure)
6. [Cách chạy (How to Run)](#cách-chạy-how-to-run)
   - [1. Yêu cầu môi trường](#1-yêu-cầu-môi-trường)
   - [2. Clone mã nguồn](#2-clone-mã-nguồn)
   - [3. Cấu hình và khởi chạy Backend](#3-cấu-hình-và-khởi-chạy-backend)
   - [4. Khởi chạy Giao diện Frontend](#4-khởi-chạy-giao-diện-frontend)
   - [5. Chạy bộ kiểm thử tự động (Automated Tests)](#5-chạy-bộ-kiểm-thử-tự-động-automated-tests)

---

## Giới thiệu hệ thống (System Introduction)

**PDF-Lingua** là nền tảng web thông minh hỗ trợ xử lý toàn diện tài liệu PDF: từ tải lên an toàn, bóc tách văn bản số, nhận dạng ký tự quang học (OCR) cho tài liệu scan dạng ảnh, đến dịch thuật đa ngôn ngữ và xuất bản kết quả với định dạng chuẩn xác.

### 1. Bối cảnh
- Tài liệu học thuật, nghiên cứu khoa học, sách giáo trình và báo cáo chuyên ngành quốc tế hiện nay chủ yếu được phát hành dưới định dạng **PDF**.
- Rào cản lớn nhất đối với sinh viên và người đi làm tại Việt Nam là **rào cản ngôn ngữ** kết hợp với **cấu trúc tài liệu phức tạp**: văn bản scan chất lượng kém không thể copy, tài liệu chia nhiều cột bị đảo lộn thứ tự khi trích xuất, hoặc việc copy-paste thủ công sang các công cụ dịch làm mất ngữ cảnh và tốn nhiều thời gian.
- Các công cụ trực tuyến hiện nay thường giới hạn dung lượng nghiêm ngặt, chi phí cao hoặc không đảm bảo quyền riêng tư đối với tài liệu tải lên.

### 2. Giải pháp cốt lõi
Ứng dụng web trực quan, hiệu năng cao giúp tự động hóa toàn bộ quy trình:
- **Tải lên & Kiểm soát an toàn**: Kéo thả tệp PDF tiện lợi, kiểm tra magic bytes `%PDF-` chống tệp giả mạo, bắt lỗi tệp hỏng hoặc có mật khẩu khóa.
- **Trích xuất văn bản & Nhận dạng OCR kết hợp (Hybrid Engine)**: Bóc tách văn bản số chuẩn xác bằng `pypdf`/`pdfplumber`, tự động phát hiện trang scan để kích hoạt Tesseract OCR (`vie+eng`), đồng thời áp dụng thuật toán **Natural Reading Order** đảm bảo văn bản đa cột không bị nhảy dòng, xáo trộn nội dung.
- **Dịch thuật đa ngôn ngữ mượt mà**: Tự động nhận diện ngôn ngữ nguồn, chia nhỏ đoạn thông minh (Smart Chunking) chống gián đoạn mạng và dịch thuật mạch lạc sang Tiếng Việt cùng nhiều ngôn ngữ khác.
- **Không gian làm việc kép (Dual-pane Workspace)**: So sánh trực quan văn bản gốc và bản dịch song song, hỗ trợ sao chép nhanh và xuất tải tệp TXT / PDF tức thì.

### 3. Đối tượng sử dụng
- **Học sinh, sinh viên, nghiên cứu sinh**: Đọc hiểu nhanh tài liệu học thuật quốc tế (IEEE, ScienceDirect, sách giáo trình...).
- **Giảng viên, dịch giả, chuyên viên văn phòng**: Xử lý, bóc tách và dịch các bản hợp đồng, báo cáo tài chính hoặc tài liệu scan nhiều cột một cách chuẩn xác.

### 4. Nguyên tắc thiết kế
- **Bảo mật & Cô lập dữ liệu**: Mật khẩu được mã hóa an toàn bằng `bcrypt` (12 rounds salt); tệp tạm thời xử lý trong phiên cô lập và tự động dọn sạch; không lưu trữ tài liệu nhạy cảm của người dùng.
- **Độ tin cậy & Dự phòng (Fault Tolerance)**: Cơ chế phân đoạn dịch thuật thông minh, tự động xử lý ngoại lệ khi tệp PDF lỗi cấu trúc.
- **Tiếp cận & Trực quan (Modern Responsive UI)**: Giao diện tối giản, trực quan, hỗ trợ thao tác kéo thả mượt mà và tương thích tốt trên mọi thiết bị.

---

## Danh sách thành viên nhóm (Member)

Dự án được xây dựng và phát triển bởi nhóm sinh viên:

| STT | Họ và Tên | MSSV | Vai trò | Nhiệm vụ chính trong dự án |
| :---: | :--- | :---: | :---: | :--- |
| 1 | [Nguyễn Lê Huy Tâm](https://github.com/Sleepy2608) | `056206011188` | **Trưởng nhóm (Leader)** | Kiến trúc hệ thống, Backend FastAPI, Core xử lý PDF & OCR, Dịch thuật & Bảo mật dữ liệu. |
| 2 | [Huỳnh Đình Chấn](https://github.com/Chan-2006) | `077206002307` | **Thành viên (Member)** | Thiết kế UI/UX Frontend, Workspace tương tác, Giao diện Auth & Điều khoản, Tối ưu Responsive. |

> Chi tiết phân công nhiệm vụ và lộ trình kế hoạch của nhóm xem tại [`.jira/Assignment.md`](.jira/Assignment.md).

---

## Tiến độ triển khai dự án (Project Deployment Progress)

* **Mô hình phát triển**: Scrum/Agile với chu kỳ **1 tuần / 1 Sprint** trong tổng thời gian 7 tuần (15/10/2026 – 03/12/2026).
* **Quản trị tiến độ trên Jira**: [Jira Board PDF-Lingua](https://pdflingua.atlassian.net/jira/software/projects/PDFL/summary)
* **Kế hoạch chi tiết 7 Sprint**: [Sprint_Plan.md](.jira/Sprint_Plan.md) | **Phân công nhiệm vụ**: [Assignment.md](.jira/Assignment.md)
* **Tình trạng hiện tại (Tuần 2 - Sprint 2)**:
  - **Sprint 1 (Khởi tạo nền tảng)**: ✅ **Hoàn thành 100%** (31/31 tasks).
  - **Sprint 2 (Tài khoản, Bảo mật & Cốt lõi PDF/OCR)**: 🚀 **Đang thực hiện** (**27/37 tasks Done**, 4 In Progress, 6 To Do).
  - **Bộ kiểm thử tự động (Automated Test Suite)**: **35/35 tests PASSED (100%)**.

---

## Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ / Thư viện | Vai trò |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3 Modern, Vanilla JavaScript (ES6+) | Giao diện người dùng đơn trang, Workspace tương tác song song, Dropzone kéo thả tệp, Modal chính sách đa tab. |
| **Backend API** | Python 3.12+, FastAPI, Uvicorn, Pydantic v2 | Máy chủ RESTful API bất đồng bộ (async), xác thực dữ liệu chặt chẽ, điều phối luồng xử lý PDF. |
| **Xử lý PDF** | `pypdf`, `pdfplumber`, `pypdfium2` | Bóc tách text số, phân tích tọa độ khối chữ, giữ thứ tự đọc đa cột (Natural Reading Order) và render trang ảnh. |
| **Nhận dạng OCR** | Tesseract OCR engine, `pytesseract`, Pillow | Nhận dạng ký tự quang học từ tài liệu scan dạng hình ảnh (tiếng Việt `vie` và tiếng Anh `eng`). |
| **Dịch thuật** | Google GTX Translation Engine, `deep-translator` | Tự động nhận diện ngôn ngữ nguồn, dịch máy ngữ nghĩa, chia đoạn thông minh. |
| **Xuất kết quả** | ReportLab, UTF-8 BOM encoding | Tạo tệp PDF bản dịch hỗ trợ tiếng Việt có dấu, tạo tệp văn bản TXT chuẩn mã hóa. |
| **Cơ sở dữ liệu** | SQLite / SQLAlchemy ORM | Lưu trữ thông tin tài khoản người dùng, phân quyền và dữ liệu hệ thống. |
| **Bảo mật** | `bcrypt` (12 rounds salt), CORS Middleware | Mã hóa mật khẩu một chiều, ngăn chặn tấn công timing attack, kiểm soát truy cập an toàn. |
| **Kiểm thử** | `pytest`, `pytest-asyncio`, FastAPI TestClient | Bộ kiểm thử đơn vị (Unit tests) và kiểm thử luồng tích hợp đầu-cuối (E2E Pipeline). |

---

## Cấu trúc thư mục (Project Structure)

```text
PDF-Lingua/
├── .jira/                    # Kế hoạch Sprint và phân công nhiệm vụ (Agile/Scrum)
├── .plan/                    # Tài liệu nghiên cứu kiến trúc & thiết kế giao diện
├── Code/
│   ├── backend/              # Máy chủ Backend (Python / FastAPI)
│   │   ├── app/
│   │   │   ├── api/          # Định tuyến API endpoints (/process, /auth)
│   │   │   ├── core/         # Cấu hình lõi (Database, Security bcrypt, Logger)
│   │   │   ├── models/       # Mô hình dữ liệu ORM (SQLAlchemy)
│   │   │   ├── schemas/      # Lược đồ chuẩn hóa DTO (Pydantic)
│   │   │   ├── services/     # Nghiệp vụ bóc tách PDF, Tesseract OCR, dịch thuật & xuất file
│   │   │   └── main.py       # Điểm khởi chạy ứng dụng FastAPI
│   │   ├── tests/            # Bộ kiểm thử tự động (Unit test, E2E pipeline)
│   │   └── requirements.txt  # Danh sách thư viện phụ thuộc Python
│   └── frontend/             # Giao diện người dùng Web (HTML5, CSS3, JavaScript)
│       ├── assets/           # Tài nguyên tĩnh (Logo, icons liên hệ)
│       ├── css/              # Bố cục giao diện, components và Dual-pane Workspace
│       ├── js/               # Xử lý Dropzone kéo thả tệp, gọi API và xuất bản dịch
│       └── index.html        # Trang giao diện chính của ứng dụng
├── pyproject.toml            # Cấu hình công cụ kiểm thử Pytest
└── README.md                 # Tài liệu tổng quan dự án
```

---

## Cách chạy (How to Run)

### 1. Yêu cầu môi trường
- **Python**: Phiên bản `3.10` trở lên (Khuyến nghị Python `3.12`).
- **Tesseract OCR Engine**: Đã cài đặt trên máy và có dữ liệu ngôn ngữ tiếng Việt (`vie.traineddata`) và tiếng Anh (`eng.traineddata`).
- **Trình duyệt Web**: Google Chrome, Microsoft Edge, Firefox phiên bản hiện đại.

### 2. Clone mã nguồn
Mở terminal và clone repository về máy:
```bash
git clone https://github.com/Sleepy2608/PDF-Lingua.git
cd PDF-Lingua
```

### 3. Cấu hình và khởi chạy Backend

```bash
# 1. Di chuyển vào thư mục backend
cd Code/backend

# 2. Khởi tạo môi trường ảo Python (Virtual Environment)
python -m venv venv

# 3. Kích hoạt môi trường ảo:
# Trên Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Trên Windows (Command Prompt):
.\venv\Scripts\activate.bat
# Trên Linux / macOS:
source venv/bin/activate

# 4. Nâng cấp pip và cài đặt thư viện phụ thuộc:
pip install -r requirements.txt

# 5. Khởi tạo file cấu hình môi trường:
cp .env.example .env

# 6. Khởi chạy máy chủ Backend (FastAPI):
uvicorn app.main:app --reload --port 8000
```

> Sau khi chạy thành công, máy chủ Backend sẽ hoạt động tại: `http://localhost:8000`<br>
> Bạn có thể kiểm tra tài liệu API tự động (Swagger UI) tại: **`http://localhost:8000/docs`**

### 4. Khởi chạy Giao diện Frontend

* **Cách 1 (Khuyên dùng)**: Mở thư mục dự án bằng **VS Code**, cài extension **Live Server**, chuột phải vào file [`Code/frontend/index.html`](Code/frontend/index.html) và chọn **Open with Live Server** (cổng mặc định `5500`).
* **Cách 2**: Mở trực tiếp file `Code/frontend/index.html` bằng trình duyệt web bất kỳ.

### 5. Chạy bộ kiểm thử tự động (Automated Tests)

Từ thư mục gốc dự án, đảm bảo môi trường ảo backend đã được kích hoạt:

```bash
# Chạy toàn bộ 35 automated test cases:
pytest Code/backend/tests -v
```

---

<p align="center">
  <b>Đồ án thực tế Công nghệ phần mềm</b>
</p>
