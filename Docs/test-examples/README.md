# PDF-Lingua — Danh Mục Tài Liệu Kiểm Thử (Test Examples)

Thư mục này chứa tập hợp các tệp PDF mẫu dùng để kiểm thử (functional testing), kiểm thử hồi quy (regression testing) và đánh giá các trường hợp biên (edge cases) của luồng xử lý tài liệu, trích xuất văn bản số, tách đoạn thông minh (`chunking`) và dịch thuật đa ngôn ngữ trên hệ thống **PDF-Lingua**.

---

## 1. Bảng Tổng Hợp 5 Tệp Kiểm Thử

| STT | Tên Tệp PDF | Mục Tiêu Kiểm Thử / Nhóm Edge Case | Định Dạng Văn Bản | Dung Lượng |
| :---: | :--- | :--- | :--- | :---: |
| **01** | [`test_dich_van_ban.pdf`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/test-examples/test_dich_van_ban.pdf) | **Văn bản mẫu cơ bản & Bảng chữ cái tiếng Việt**: Kiểm tra tách đoạn khi xuất từ MS Word có khoảng trắng dòng trống (`\n \n`) và giữ nguyên bảng nguyên âm đơn lẻ. | Tiếng Việt (có dấu + không dấu), Tiếng Anh, Tiếng Nhật, Bảng ký tự đơn lẻ | ~100 KB |
| **02** | [`test_pdfl1.pdf`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/test-examples/test_pdfl1.pdf) | **Đa ngôn ngữ phức tạp & Chữ có dấu/không dấu**: Kiểm thử phân loại hệ chữ (Script Category) xen kẽ giữa các đoạn văn (Việt, Anh, Pháp, Nhật, Hàn, Trung, Nga). | 7 hệ ngôn ngữ khác nhau, bảng chữ cái Latinh A-Z | ~251 KB |
| **03** | [`test_pdfl2.pdf`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/test-examples/test_pdfl2.pdf) | **Ký hiệu kỹ thuật, URL, Email & Code/API**: Kiểm tra khả năng bảo toàn nguyên vẹn link web, địa chỉ email, biến môi trường `.env` và công thức toán học. | Link URL, Email, Mã code cấu hình, Công thức `E = mc²` | ~206 KB |
| **04** | [`test_pdfl3.pdf`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/test-examples/test_pdfl3.pdf) | **Số liệu, tiền tệ, ngày tháng & Danh sách gạch đầu dòng**: Kiểm tra độ chính xác của các đơn vị tiền tệ (`VNĐ`, `$`, `€`, `¥`), phần trăm (`%`), ngày tháng và số La Mã. | Số La Mã (I, II, III), Bullet points (`•`, `-`), Tiền tệ đa quốc gia | ~356 KB |
| **05** | [`test_pdfl4.pdf`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/test-examples/test_pdfl4.pdf) | **Hội thoại, trích dẫn trong ngoặc kép & Ký tự đặc biệt**: Kiểm tra khả năng dịch mượt mà câu hỏi/cảm thán và các kiểu dấu ngoặc (`"..."`, `«...»`, `「...」`, `¿... ?`). | Dấu ngoặc kép quốc tế, ký hiệu `@`, `#`, `[]`, `{}` | ~208 KB |

---

## 2. Chi Tiết Từng Tệp Kiểm Thử

### File 01: `test_dich_van_ban.pdf` (Tệp mẫu thực tế)
- **Mục đích**: Tệp thử nghiệm ban đầu dùng để tái hiện và khắc phục 2 lỗi quan trọng:
  1. *Lỗi ngắt dòng Word*: Dòng trống có khoảng trắng (`\n \n`) làm dồn toàn bộ văn bản vào 1 chunk.
  2. *Lỗi bảng ký tự*: Dòng chứa chuỗi chữ cái đơn lẻ (`Ă Â Ơ Ô Ê Ư Á À Ạ...`) khiến toàn bộ văn bản bị đánh dấu nhầm thành bảng mẫu tự và không được dịch.
- **Nội dung mẫu**:
  ```text
  Kiếm tra tính năng dịch văn bản
  Xin chào bạn, tôi là Tâm đang sử dụng phần mềm dịch ngôn ngữ
  Xin chao moi nguoi
  Tôi ko biết chữ này
  Good morning
  Konnichiwa / こんにちは
  Ă Â Ơ Ô Ê Ư Á À Ạ Ã Ả Ỏ Ò Ó Ỏ Ọ Õ
  ```
- **Kỳ vọng đầu ra**:
  - Tách thành 6 chunks độc lập.
  - Các đoạn tiếng Việt và tiếng Nhật dịch chính xác sang ngôn ngữ đích đã chọn (Anh, Nhật, v.v.).
  - Dòng chữ cái `Ă Â Ơ Ô Ê Ư...` được bảo toàn 100% nguyên vẹn (`preserved_characters`).

---

### File 02: `test_pdfl1.pdf` (Test Case 1 — Đa ngôn ngữ hỗn hợp)
- **Mục đích**: Đánh giá thuật toán phân loại ký tự [`get_script_category()`](file:///c:/University%20Coding%20Project/PDF-Lingua/Code/backend/app/services/translation_service.py#L42) và chuyển đổi ngữ cảnh liên tục giữa các hệ ngôn ngữ CJK, Cyrillic, Latinh và tiếng Việt không dấu.
- **Nội dung kiểm thử**:
  - Tiếng Việt không dấu: *"Xin chao tat ca moi nguoi, hom nay toi review tinh nang nay."*
  - Tiếng Pháp: *"Ce document contient plusieurs langues différentes..."*
  - Tiếng Nhật: *"日本語のテストです：こんにちは。本日は晴天なり..."*
  - Tiếng Hàn: *"한국어 테스트: 안녕하세요! PDF-Lingua 시스템을..."*
  - Tiếng Trung: *"中文测试：这是一个多语言文本翻译测试..."*
  - Tiếng Nga: *"Русский тест: Привет мир! Это проверка..."*
  - Bảng chữ cái Latinh: `A B C D E...` và `a b c d e...`.
- **Kỳ vọng đầu ra**:
  - Mỗi hệ ngôn ngữ được tách thành khối chunk riêng biệt.
  - Bản dịch không bị lẫn lộn giữa các thứ tiếng.
  - Bảng chữ cái tiếng Anh A-Z được giữ nguyên không biến dạng.

---

### File 03: `test_pdfl2.pdf` (Test Case 2 — Ký hiệu kỹ thuật, Code & URL)
- **Mục đích**: Đảm bảo các thành phần công nghệ không bị bộ máy AI dịch nhầm thành các từ ngữ tiếng Việt vô nghĩa.
- **Nội dung kiểm thử**:
  - URL có query parameters: `https://pdflingua.com/api/v1/translate?lang=en&format=pdf`
  - Địa chỉ Email: `support-team@pdflingua.edu.vn`
  - Số điện thoại quốc tế: `+84 (0) 912 345 678`
  - Biến môi trường: `API_BASE_URL="http://127.0.0.1:8000"`, `ENABLE_TESSERACT_OCR=True`
  - Công thức toán & AI: `E = mc^2`, `Accuracy = (TP + TN) / (TP + TN + FP + FN) * 100%`
- **Kỳ vọng đầu ra**:
  - URL, email, tên biến và công thức giữ nguyên 100% cú pháp.
  - Phần lời dẫn hướng dẫn dịch mượt mà sang ngôn ngữ đích.

---

### File 04: `test_pdfl3.pdf` (Test Case 3 — Bảng kê, Tiền tệ & Định dạng số)
- **Mục đích**: Kiểm tra tính chính xác của các ký hiệu tài chính, số phần trăm và thứ tự liệt kê phân cấp.
- **Nội dung kiểm thử**:
  - Phân mục La Mã: `I. Mục tiêu...`, `II. Chi phí...`, `III. Thống kê...`
  - Dấu đầu dòng: Dấu chấm tròn `•`, gạch nối `-`, đánh số `1)`, `2)`.
  - Tiền tệ đa quốc gia: `0 VNĐ / tháng`, `$9.99 USD / tháng`, `€9.20 EUR`, `¥1,500 JPY`.
  - Tỉ lệ phần trăm & thời gian: `100%`, `85.5%`, `0.45 giây / trang`, `giảm 73.3%`.
- **Kỳ vọng đầu ra**:
  - Cấu trúc thụt lề và xuống dòng của các danh mục được giữ nguyên vẹn.
  - Các con số và ký hiệu tiền tệ không bị dịch sai lệch hoặc mất dấu chấm thập phân.

---

### File 05: `test_pdfl4.pdf` (Test Case 4 — Hội thoại, Trích dẫn & Dấu ngoặc kép)
- **Mục đích**: Kiểm tra khả năng xử lý ngữ cảnh đối thoại hai chiều, câu hỏi cảm thán và các quy chuẩn dấu ngoặc kép theo từng quốc gia.
- **Nội dung kiểm thử**:
  - Ngoặc kép phương Tây: `"Công nghệ trí tuệ nhân tạo không thay thế con người..."`
  - Dấu ngoặc nhọn tiếng Pháp (Guillemets): `« La simplicité est la sophistication suprême. »`
  - Dấu ngoặc vuông tiếng Nhật (Kagi kakko): `「継続は力なり」 - Kiên trì là sức mạnh.`
  - Cú pháp câu hỏi tiếng Tây Ban Nha: `¿Cómo estás? ¡Muy bien, gracias!`
  - Ký tự hashtag, tag, phân cách: `@user #hashtag [APPROVED] {SUCCESS} | 50/50 | 100%`
- **Kỳ vọng đầu ra**:
  - Ngữ điệu câu hội thoại tự nhiên, chính xác.
  - Các cặp dấu ngoặc đóng/mở đặc thù và các thẻ tag `[APPROVED]`, `{SUCCESS}` được duy trì vẹn nguyên.

---

## 3. Hướng Dẫn Thực Hiện Kiểm Thử

### Cách 1: Kiểm thử trực tiếp trên Giao Diện Web (UI)
1. Khởi động Backend:
   ```powershell
   cd "Code\backend"
   .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
2. Mở file [`Code/frontend/index.html`](file:///c:/University%20Coding%20Project/PDF-Lingua/Code/frontend/index.html) trên trình duyệt web.
3. Kéo thả lần lượt từng tệp PDF từ thư mục [`Docs/test-examples/`](file:///c:/University%20Coding%20Project/PDF-Lingua/Docs/test-examples/) vào khung tải lên.
4. Chọn ngôn ngữ đích (English, 日本語, v.v.) và kiểm tra kết quả tại khung song ngữ đối chiếu.

### Cách 2: Chạy trích xuất và kiểm tra tự động qua Script CLI
```powershell
cd "Code\backend"
$env:PYTHONIOENCODING="utf-8"
.\venv\Scripts\python.exe -c "from pathlib import Path; from app.services.pdf_service import PDFService; from app.services.translation_service import TranslationService; p = PDFService(); t = TranslationService(); docs = Path(r'..\..\Docs\test-examples'); files = ['test_dich_van_ban.pdf', 'test_pdfl1.pdf', 'test_pdfl2.pdf', 'test_pdfl3.pdf', 'test_pdfl4.pdf']; [print(f'=== {f} ===', t.translate_text(p.extract_text(docs / f), target_lang='en')['translated_text'][:180], '...\n') for f in files]"
```
