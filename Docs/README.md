# DANH MỤC TÀI LIỆU KỸ THUẬT ĐỒ ÁN (PROJECT DOCUMENTATION SUITE)

## DỰ ÁN: NỀN TẢNG DỊCH THUẬT TÀI LIỆU PDF HỌC THUẬT & TRỢ LÝ AI (PDF-LINGUA)

| Thông tin | Chi tiết |
|---|---|
| **Tên dự án (EN)** | PDF-Lingua: Academic PDF Translation & AI Research Assistant |
| **Tên dự án (VN)** | Nền tảng Dịch thuật PDF Học thuật & Trợ lý Nghiên cứu AI |
| **Loại tài liệu** | Master Documentation Index & Thesis Mapping |
| **Viết tắt** | PDF-Lingua |
| **Phiên bản tài liệu** | 1.3 |
| **Website trực tuyến (Live Demo)** | [https://pdflingua.vercel.app](https://pdflingua.vercel.app) |
| **Ngày tạo** | 15/09/2026 |
| **Ngày chỉnh sửa lần cuối** | 24/11/2026 |
| **Trạng thái** | Hoàn thành (Release) |

---

## 1. Bản Đồ Tra Cứu Toàn Bộ Tài Liệu (Documentation Master Index)

Bảng điều hướng tổng hợp toàn bộ các tài liệu kỹ thuật, kiến trúc, kiểm thử và hướng dẫn vận hành của đồ án:

| STT | Nhóm Tài Liệu | Đường Dẫn Tệp Chi Tiết | Mô Tả Tóm Tắt Nội Dung |
| :---: | :--- | :--- | :--- |
| **01** | **Kiến Trúc Hệ Thống** | [`Docs/architecture-design/system-architecture.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/architecture-design/system-architecture.md) | Sơ đồ kiến trúc 4 tầng, mô hình thực thể quan hệ ERD, cơ chế bảo mật Defense-in-Depth và phân vùng lưu trữ. |
| **02** | **Quyết Định Kiến Trúc (ADR)** | [`Docs/architecture-design/adr/README.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/architecture-design/adr/README.md) | Bộ 6 hồ sơ ADR phân tích bối cảnh, phương án đối trọng và đánh đổi kỹ thuật (Hybrid OCR, VietQR, Vanilla JS, FastAPI, SQLite, Smart Layout). |
| **03** | **Sơ Đồ Tri Thức Mã Nguồn** | [`Docs/codebase-knowledge-graph/README.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/codebase-knowledge-graph/README.md) | Mạng tri thức tương tác 2D/3D (4.063 nodes, 9.412 edges) và báo cáo kiểm định kiến trúc, God Nodes hệ thống. |
| **04** | **Thuật Toán & AI** | [`Docs/ai-design/pdf-processing-and-ai-pipeline.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/ai-design/pdf-processing-and-ai-pipeline.md) | Cơ chế Hybrid Fast Path (Digital vs Scanned), Smart Layout luồng đọc 2 cột, Smart Chunking và Tóm tắt Map-Reduce. |
| **05** | **Đặc Tả Yêu Cầu (SRS)**| [`Docs/software-requirement-specification/srs-specification.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/software-requirement-specification/srs-specification.md) | Đặc tả 11 yêu cầu chức năng (FR), 4 yêu cầu phi chức năng (NFR), ma trận phân quyền tác nhân (Guest, Free, Pro, Admin). |
| **06** | **Kiểm Thử & CI/CD** | [`Docs/testing-documents/test-plan-and-results.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/testing-documents/test-plan-and-results.md) | Báo cáo kết quả 10 test suites Frontend, kiểm thử Backend, ma trận an toàn bảo mật và tự động hóa GitHub Actions. |
| **07** | **Hướng Dẫn Cài Đặt** | [`Docs/installation-guide/setup-and-installation.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/installation-guide/setup-and-installation.md) | Hướng dẫn cài Tesseract OCR tiếng Việt, cấu hình biến môi trường `.env`, khởi chạy một chạm qua `run.bat` và khắc phục sự cố. |
| **08** | **Luồng Nghiệp Vụ** | [`Docs/workflows/business-workflows.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/workflows/business-workflows.md) | Sequence Diagrams chi tiết luồng bóc tách dịch thuật PDF, thanh toán nâng cấp Pro qua VietQR Napas247 / SePay Webhook. |
| **09** | **Hướng Dẫn Sử Dụng** | [`Docs/user-guide/user-guide.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/user-guide/user-guide.md) | Cẩm nang thao tác dành cho người dùng cuối: dịch thuật song ngữ, hỏi đáp Copilot, tóm tắt và tải bản dịch. |
| **10** | **Mô Tả Use Case** | [`Docs/use-case/pdf-lingua-use-case-overview.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/use-case/pdf-lingua-use-case-overview.md) | Sơ đồ Use case tổng quát, mô tả phạm vi tác nhân và hành vi tương tác hệ thống. |
| **11** | **Bảng Giá & Gói Cước** | [`Docs/pricing-plans/pricing-plans.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/pricing-plans/pricing-plans.md) | Quy định chi tiết quyền lợi gói Miễn Phí (0đ) và Gói Chuyên Nghiệp (49.000đ/tháng, 399.000đ/năm). |
| **12** | **Tệp PDF Kiểm Thử** | [`Docs/test-examples/README.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/test-examples/README.md) | Danh mục 5 tệp PDF thực tế đánh giá các trường hợp biên: đa ngôn ngữ, ký hiệu code, tiền tệ và bảng chữ cái tiếng Việt. |
| **13** | **Quy Chuẩn Màu Sắc** | [`Docs/color-theme/pdf-lingua-color-theme.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/color-theme/pdf-lingua-color-theme.md) | Hệ thống bảng màu chuẩn, mã màu Hex/RGBA và quy chuẩn tương phản giao diện UI/UX. |
| **14** | **Phân Tích An Toàn Bảo Mật** | [`Docs/security-and-threat-modeling/security-analysis.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/security-and-threat-modeling/security-analysis.md) | Mô hình đe dọa STRIDE, phòng chống IDOR (404), PDF Bombs (magic bytes), Prompt Injection và xác thực Webhook SePay. |
| **15** | **Chiến Lược Doanh Thu Kép** | [`Docs/monetization-strategy/README.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/monetization-strategy/README.md) | Kế hoạch kinh doanh 2 động cơ: Thuê bao Pro VIP (B2C) và Cho thuê quảng cáo/Tài trợ (B2B), kèm bảng so sánh đối chiếu và bánh đà cộng hưởng doanh thu. |
| **16** | **Kịch Bản Thuyết Minh & Demo Đồ Án** | [`Docs/demo-script/README.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/demo-script/README.md) | Kịch bản chi tiết 7 phân đoạn (12-15 phút) trình diễn hội đồng: Guest mode, trích xuất 2 cột, dual-pane workspace, AI Copilot, VietQR và Admin dashboard. |
| **17** | **Rà Soát An Toàn & Bàn Giao Repository** | [`Docs/security-and-threat-modeling/repository-secret-and-sanitization-audit.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/security-and-threat-modeling/repository-secret-and-sanitization-audit.md) | Báo cáo kiểm định an toàn 6 tầng, xác thực 0 rò rỉ khóa API/secret trên toàn bộ Git và mã nguồn, tích hợp công cụ quét tự động scan_secrets.py. |
| **18** | **Hướng Dẫn Triển Khai Cloud** | [`Docs/installation-guide/cloud-deployment-guide.md`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/installation-guide/cloud-deployment-guide.md) | Kiến trúc triển khai đám mây phân tán: Frontend trên Vercel, Backend Docker trên Render, proxy hóa CORS và hướng dẫn tên miền .id.vn/.com. |

---

## 2. Bản Đồ Ánh Xạ Vào Cấu Trúc Báo Cáo Đồ Án Tốt Nghiệp

Dành cho sinh viên khi tổng hợp nội dung vào cuốn Báo cáo Khóa luận / Đồ án chuyên ngành CNTT:

```mermaid
flowchart TD
    C1["Chương 1: Tổng Quan & Cơ Sở Lý Thuyết"] --> D1["use-case-overview.md & pricing-plans.md"]
    C2["Chương 2: Phân Tích Yêu Cầu Phần Mềm"] --> D2["srs-specification.md & use-case-tong-quat.png"]
    C3["Chương 3: Thiết Kế Hệ Thống & CSDL"] --> D3["system-architecture.md & business-workflows.md"]
    C4["Chương 4: Thuật Toán Lõi & Tích Hợp AI"] --> D4["pdf-processing-and-ai-pipeline.md"]
    C5["Chương 5: Hiện Thực Hóa & Kiểm Thử"] --> D5["test-plan-and-results.md & test-examples/"]
    C6["Chương 6: Hướng Dẫn Vận Hành & Kết Luận"] --> D6["setup-and-installation.md & user-guide.md"]
```

- **Chương 1 (Tổng quan đề tài)**: Trích xuất bối cảnh từ `use-case/` và bài toán chi phí/giải pháp từ `pricing-plans/`.
- **Chương 2 (Phân tích yêu cầu)**: Toàn bộ nội dung bảng FR/NFR và phân quyền tác nhân từ `software-requirement-specification/`.
- **Chương 3 (Thiết kế kiến trúc)**: Sơ đồ 4 tầng, mô hình ERD từ `architecture-design/` và sơ đồ tương tác từ `workflows/`.
- **Chương 4 (Thuật toán & AI)**: Trọng tâm đề tài: Hybrid Fast Path, Smart Layout 2 cột, Smart Chunking, Map-Reduce từ `ai-design/`.
- **Chương 5 (Kiểm thử & Đánh giá)**: Báo cáo kết quả kiểm thử tự động, kiểm thử bảo mật và quy trình CI/CD từ `testing-documents/`.
- **Chương 6 (Vận hành & Hướng dẫn)**: Hướng dẫn cài đặt một chạm từ `installation-guide/` và cẩm nang người dùng từ `user-guide/`.

---

## 3. Tiêu Chuẩn Duy Trì & Đảm Bảo Chất Lượng Tài Liệu

- **Chuẩn ký tự quốc tế**: Toàn bộ các tệp tài liệu trong hệ thống tuân thủ nghiêm ngặt định dạng mã hóa `UTF-8` không kèm ký tự đặc biệt gây xung đột parser (`zero en-dash / zero em-dash`).
- **Liên kết điều hướng (Deep Links)**: Mỗi tài liệu đều chứa liên kết tuyệt đối và liên kết nội bộ giúp tra cứu nhanh chóng mã nguồn và tài liệu liên quan.
- **Sơ đồ trực quan hóa**: Mọi quy trình và kiến trúc đều đi kèm sơ đồ `Mermaid` chuẩn, hiển thị trực quan ngay trên giao diện GitHub và các trình xem Markdown hiện đại.

