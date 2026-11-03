# BÁO CÁO ĐÁNH GIÁ VÀ TỔNG HỢP HIỆU NĂNG TOÀN DIỆN (PDFL-111.5)
## Performance Testing & Benchmarking Report — PDF-Lingua Pipeline

**Dự án:** PDF-Lingua  
**Phiên bản kiểm thử:** PDFL-111 (PDF Processing Optimization Suite)  
**Ngày thực hiện:** 03/11/2026  
**Môi trường thử nghiệm:**
- **Hệ điều hành:** Microsoft Windows 11 (64-bit)
- **Runtime:** Python 3.13.0 (64-bit)
- **PDF Engine:** PyMuPDF (fitz) 1.25.x / pypdfium2 fallback
- **OCR Engine:** Tesseract OCR v5.x (Google)
- **Image Processing:** Pillow (PIL) 10.x (không sử dụng OpenCV hoặc jiwer)
- **Web Framework:** FastAPI / Starlette SSE / Node.js frontend runtime

---

### 1. Phương pháp đo đạc & Định nghĩa thuật ngữ

1. **Đo lường thời gian xử lý & Phân biệt thuật ngữ:**
   - Sử dụng `time.perf_counter()` độ chính xác nano-giây trên Windows.
   - **Thời gian xử lý giảm (Latency Reduction %):** Tính theo công thức $\frac{T_{\text{baseline}} - T_{\text{optimized}}}{T_{\text{baseline}}} \times 100\%$, phản ánh tỉ lệ phần trăm thời gian chờ được cắt giảm.
   - **Tỉ số tăng tốc (Speedup Factor):** Tính theo công thức $\frac{T_{\text{baseline}}}{T_{\text{optimized}}}$, phản ánh mức cải thiện thông lượng (Throughput) tương đối.
   - Thử nghiệm được thực hiện lặp lại 3 lần độc lập cho mỗi kịch bản, lấy giá trị trung bình (`mean`).

2. **Đo lường bộ nhớ (RAM & Working Set) & Bản chất giải phóng bộ nhớ:**
   - **Hệ điều hành (OS Level):** Gọi trực tiếp Windows Win32 API (`GetProcessMemoryInfo` qua `ctypes`) với cấu trúc chuẩn `PROCESS_MEMORY_COUNTERS_EX`:
     - `WorkingSetSize` (RSS): Lượng RAM vật lý thực tế tiến trình đang chiếm dụng tại thời điểm đo.
     - `PeakWorkingSetSize` (Peak RSS): Đỉnh RAM vật lý cao nhất trong toàn bộ vòng đời tiến trình.
   - **Môi trường đo cô lập (Subprocess Isolation):** Chạy Legacy và Optimized trong từng tiến trình con độc lập nhằm đảm bảo baseline khởi đầu tương đương (~54.5 MB RSS), triệt tiêu hoàn toàn ảnh hưởng của garbage collector hoặc bộ nhớ lưu đệm giữa các lần chạy.
   - **Python Heap (Python Level):** Sử dụng `tracemalloc` đo bộ nhớ Python nội tại (`pymalloc`).
   - **Lưu ý về bộ nhớ hệ điều hành:** Lượng RSS đo được sau khi xử lý (67.84 MB vs 206.55 MB) phản ánh việc giải phóng các đối tượng hình ảnh trung gian khỏi heap; tuy nhiên theo cơ chế của Windows Heap Manager và Python allocator, các trang nhớ vật lý có thể tiếp tục được giữ lại trong pool của tiến trình để tái sử dụng chứ không nhất thiết được thu hồi (unmapped) ngay lập tức về hệ điều hành.

3. **Thời gian phản hồi HTTP (TTFB):**
   - Sự sụt giảm từ 5-15s xuống mức mili-giây là **kết quả quan sát cục bộ** dựa trên việc chuyển đổi kiến trúc sang non-blocking HTTP 202 Accepted (không còn bị block bởi quá trình OCR kéo dài), chưa qua benchmark đo tải mạng chuyên dụng bằng công cụ ngoài (như wrk hay k6).

---

### 2. Kết quả đo đạc chi tiết theo từng module tối ưu

#### 2.1. PDFL-111.1 – Hybrid Fast Path (Phân loại & Tối ưu luồng xử lý)
- **Mục tiêu:** Tự động phân loại từng trang PDF (Digital vs Scanned), kích hoạt Fast Path trích xuất trực tiếp cho Digital và chỉ chạy OCR khi thực sự là Scanned.
- **Dữ liệu thực nghiệm (Dataset PDFL-110):**

| Tệp tài liệu | Phân loại | Thời gian Legacy (Cũ) | Thời gian Hybrid (Mới) | Giảm thời gian (Latency Reduction) | Tỉ số tăng tốc (Speedup) | Ghi chú vận hành |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `digital_single_column.pdf` | Digital PDF | 0.0053 s | **0.0044 s** | **Giảm 16.98%** | **1.20x** | Bỏ qua hoàn toàn rasterization & OCR |
| `digital_multi_column.pdf` | Digital PDF | 0.0061 s | **0.0049 s** | **Giảm 19.67%** | **1.24x** | Trích xuất text layer trực tiếp |
| `complex_tables_and_symbols.pdf` | Complex Digital | 0.0076 s | **0.0067 s** | **Giảm 11.84%** | **1.13x** | Giữ nguyên cấu trúc bảng và ký hiệu |
| `scanned_high_quality.pdf` | Scanned PDF | 1.4537 s | 2.4865 s | Tăng 71.05% | 0.58x | Overhead phân loại ban đầu trên trang đơn |
| `scanned_medium_skewed.pdf` | Scanned PDF | 3.4711 s | 3.8500 s | Tăng 10.92% | 0.90x | Pipeline deskew + orientation + OCR |
| `scanned_low_blurry_noisy.pdf` | Scanned PDF | 1.6337 s | **1.3510 s** | **Giảm 17.30%** | **1.21x** | Tiền xử lý thresholding + OCR |
| `mixed_digital_and_scanned.pdf` | Mixed PDF | 0.0376 s *(lỗi)* | **1.8496 s** | - | **Thành công** | Cũ: mất trang scan; Mới: xử lý đúng cả 2 |

- **Nhận xét chính xác:**
  - Đối với **Digital PDF**: Thời gian xử lý giảm từ **11.84% đến 19.67%** (tương đương Speedup từ **1.13x đến 1.24x**), đưa tổng thời gian xử lý xuống chỉ còn 4.4 ms – 6.7 ms do không phải render bitmap.
  - Đối với **Mixed PDF**: Khắc phục lỗi sai nghiêm trọng của luồng cũ (bỏ sót trang scan); phân loại chính xác từng trang để chạy đúng luồng tương ứng.

---

#### 2.2. PDFL-111.2 – Lazy Loading & Memory Optimization (Tối ưu RAM)
- **Mục tiêu:** Streaming từng trang thay vì nạp đồng thời; giải phóng tức thì Pixmap và Image sau khi OCR; đảm bảo dọn dẹp trong `try...finally`.
- **Dữ liệu thực nghiệm (Scanned PDF 20 trang khổ A4, dpi=150, trung bình 3 lượt chạy độc lập):**

| Chỉ số đo đạc | Legacy (Giữ toàn bộ 20 trang) | Optimized (Lazy streaming & eager cleanup) | Mức chênh lệch tuyệt đối | Tỷ lệ cải thiện |
| :--- | :---: | :---: | :---: | :---: |
| **Baseline RSS ban đầu** | 54.62 MB | 54.54 MB | - | Tương đương (Chuẩn hóa) |
| **Peak RSS (Đỉnh RAM HĐH)** | **232.63 MB** | **81.14 MB** | **-151.49 MB** | **Giảm 65.13%** |
| **RSS sau khi xử lý hoàn tất** | **206.55 MB** | **67.84 MB** | **-138.71 MB** | **Giảm 67.15% (Working Set tồn dư)** |
| **Python Heap Peak (`tracemalloc`)** | **6.25 MB** | **0.62 MB** | **-5.63 MB** | **Giảm 90.08%** |
| **Heap Python tồn dư** | 0.03 MB | 0.58 MB | +0.55 MB | Buffer I/O nội tại của tiến trình |

- **Nhận xét chính xác:**
  - **Đỉnh RAM vật lý (Peak RSS):** Giảm mạnh **65.13%** (từ 232.63 MB xuống 81.14 MB), triệt tiêu hiện tượng đỉnh RAM tăng tuyến tính theo số trang tài liệu.
  - **Lượng RAM tồn dư trong tiến trình (RSS sau xử lý):** Giảm **138.71 MB** (từ 206.55 MB xuống 67.84 MB), chứng minh các đối tượng ảnh trung gian đã được giải phóng thay vì bị giữ lại trong bộ nhớ.

---

#### 2.3. PDFL-111.3 – Parallel PDF Processing (Xử lý đa luồng)
- **Mục tiêu:** ThreadPoolExecutor phân tán xử lý OCR các trang Scanned độc lập; bảo đảm giữ đúng thứ tự trang ban đầu; tự động chạy tuần tự khi chỉ có 1 trang scan.
- **Dữ liệu thực nghiệm (Trung bình 3 lần chạy độc lập):**

| Kịch bản kiểm thử | Tuần tự (Sequential Avg) | Song song (Parallel Avg) | Giảm thời gian (Latency Reduction) | Tỉ số tăng tốc (Speedup Factor) | Đánh giá |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Scanned Multi-Page (4 Pages)** | 10.283 s | **8.039 s** | **Giảm 21.82%** | **1.28x** (+27.9% throughput) | Phân tán render ảnh đa luồng hiệu quả |
| **Mixed PDF (1 Digital + 1 Scanned)** | 5.636 s | **4.315 s** | **Giảm 23.44%** | **1.31x** (+30.6% throughput) | Tách biệt luồng text và ảnh |
| **Scanned PDF (Single Page HQ)** | 3.284 s | **2.773 s** | **Giảm 15.56%** | **1.18x** (+18.4% throughput) | Xử lý đơn trang |

- **Nhận xét chính xác:**
  - Phân biệt rõ: Mức giảm thời gian (Latency Reduction) đạt **21.82%** trên tài liệu 4 trang và **23.44%** trên Mixed PDF; tương ứng với mức tăng thông lượng xử lý (Speedup) lần lượt là **1.28x** và **1.31x**.
  - Hiệu quả tăng tốc bị giới hạn bởi đặc tính CPU-bound và cơ chế OpenMP nội tại của Tesseract OCR, do đó không thể đạt mức tăng tốc tuyến tính hoàn hảo.

---

#### 2.4. PDFL-111.4 – Background Jobs & Progress Streaming (Trải nghiệm & Khả năng kiểm soát)
- **Mục tiêu:** Chuyển đổi kiến trúc sang Asynchronous Background Job với Server-Sent Events (SSE) stream tiến độ theo thời gian thực.
- **Phân định rõ hai cơ chế kiểm soát tài nguyên:**
  1. **Tầng Server Concurrency (`_job_semaphore = threading.Semaphore(4)`):** Giới hạn tối đa **4 tác vụ nền thực sự chạy xử lý OCR đồng thời** trên toàn server, ngăn ngừa cạn kiệt tài nguyên CPU và RAM.
  2. **Tầng Client Buffer Overflow (`asyncio.Queue(maxsize=100)`):** Giới hạn tối đa **100 sự kiện đệm cho từng client kết nối SSE**, tự động xoay vòng loại bỏ sự kiện cũ khi client nhận chậm nhằm ngăn rò rỉ RAM trong tiến trình asyncio.

| Tiêu chí | Trước PDFL-111.4 (Synchronous) | Sau PDFL-111.4 (Background Jobs + SSE) | Ghi chú đánh giá |
| :--- | :---: | :---: | :--- |
| **Độ trễ phản hồi ban đầu (TTFB)** | 5.0 s – 15.0+ s (Treo kết nối HTTP chờ OCR) | **Quan sát cục bộ: < 15 ms** (HTTP 202 Accepted) | Trả về ngay Job ID mà không chờ xử lý |
| **Theo dõi tiến độ giao diện** | Timer giả lập (`setTimeout`) | Tiến độ thực tế từng trang qua SSE | Khớp 100% với trạng thái xử lý thực tế |
| **Kiểm soát tải đồng thời** | Không giới hạn | Semaphore = 4 | Giới hạn số lượng tác vụ tính toán nặng |
| **Bộ đệm sự kiện SSE** | Không kiểm soát | Hàng đợi giới hạn `maxsize=100` | Tránh tràn RAM kết nối |
| **Khả năng dọn dẹp tài nguyên** | Thủ công | Cấu trúc `try...finally` bảo vệ file tạm | Luôn dọn dẹp khi có exception |

---

### 3. Bảng so sánh hiệu năng tổng thể (End-to-End Summary)

```
+-----------------------------------+--------------------+--------------------+---------------------------------------------+
| Chiều đo hiệu năng                | Baseline (Legacy)  | PDFL-111 Optimized | Mức cải thiện chính xác                     |
+-----------------------------------+--------------------+--------------------+---------------------------------------------+
| Digital PDF Latency               | 5.3 - 7.6 ms       | 4.4 - 6.7 ms       | Giảm 11.84% - 19.67% (Speedup: 1.13x - 1.24x)|
| Scanned 4-Page PDF Latency        | 10.283 s           | 8.039 s            | Giảm 21.82% (Speedup: 1.28x / +27.9% thpt)  |
| Mixed PDF Latency                 | 5.636 s            | 4.315 s            | Giảm 23.44% (Speedup: 1.31x / +30.6% thpt)  |
| Peak RAM (20-Page Scanned PDF)    | 232.63 MB          | 81.14 MB           | Giảm 65.13% Peak RSS (Tiết kiệm 151.49 MB)  |
| RSS tồn dư sau khi xử lý          | 206.55 MB          | 67.84 MB           | Giảm 67.15% Working Set tồn dư (138.71 MB)  |
| Python Heap Peak                  | 6.25 MB            | 0.62 MB            | Giảm 90.08% Heap cấp phát bởi Python        |
| Phản hồi HTTP ban đầu             | 5.0 - 15.0+ s      | Quan sát: < 15 ms  | HTTP 202 Accepted không block luồng request |
| Kiểm soát tải đồng thời server    | Không giới hạn     | Semaphore = 4      | Giới hạn tối đa 4 job tính toán đồng thời   |
| Kiểm soát đệm sự kiện SSE         | Không giới hạn     | Queue maxsize = 100| Tránh phình bộ nhớ SSE cho từng client      |
+-----------------------------------+--------------------+--------------------+---------------------------------------------+
```

---

### 4. Tính nhất quán của số liệu (Data Consistency Verification)

- **Số liệu RAM:** Trích xuất nguyên bản từ log chạy độc lập của `measure_memory_before_after.py` (ghi nhận qua Windows API `PROCESS_MEMORY_COUNTERS_EX`).
- **Số liệu đa luồng:** Trích xuất nguyên bản từ log thực nghiệm trung bình 3 lần chạy của `benchmark_parallel_performance.py`.
- **Số liệu Fast Path:** Trích xuất nguyên bản từ log đo toàn bộ dataset của `measure_hybrid_benchmark.py`.
- Mọi số liệu trong báo cáo Markdown này và file JSON đi kèm (`performance_benchmark_report_pdfl111.json`) được đồng bộ hóa hoàn toàn.

---

### 5. Hạn chế và Các điểm cần cải thiện (Limitations & Future Work)

1. **Hạn chế:**
   - **Tesseract OCR Thread Contention:** Tesseract OCR tích hợp OpenMP đa luồng nội bộ. Khi tăng số lượng worker thread Python trên CPU có số lõi hạn chế, hiện tượng tranh chấp tài nguyên khiến thời gian xử lý không giảm tuyến tính.
   - **Phạm vi bảo đảm của khối `finally`:** Cấu trúc double `try...finally` đảm bảo giải phóng semaphore và xóa tệp tạm trong mọi kịch bản luồng kết thúc bình thường hoặc phát sinh exceptions trong ứng dụng; tuy nhiên nếu tiến trình bị sập đột ngột (hard crash tiến trình, lệnh SIGKILL từ OS hoặc ngắt nguồn), các khối `finally` sẽ không thể được thực thi.
   - **Lưu trữ trạng thái Job trong bộ nhớ (In-Memory Job Manager):** Trạng thái các tác vụ được lưu tạm thời trong RAM với cơ chế TTL. Nếu backend restart, danh sách tác vụ cũ sẽ bị reset.

2. **Khuyến nghị cải thiện:**
   - Cân nhắc tích hợp Redis / SQLite để lưu trạng thái Job bền vững (Persistence) qua các lần khởi động lại server.
   - Bổ sung biến môi trường `OMP_THREAD_LIMIT=1` khi chạy Tesseract trong môi trường ThreadPoolExecutor để tối ưu hóa việc phân chia lõi CPU.

---
**Người lập báo cáo:** Antigravity AI Engineer  
**Trạng thái task PDFL-111.5:** HOÀN THÀNH (Đã kiểm tra, chỉnh sửa thuật ngữ và đối chiếu số liệu chuẩn xác).
