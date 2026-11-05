import io
import json
import statistics
import sys
import time
from pathlib import Path

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import pymupdf
from PIL import Image

from app.services.ocr_service import OCRService
from app.services.pdf_service import PDFService

DATASET_DIR = Path(__file__).parent / "dataset"


def run_benchmark(num_runs: int = 3):
    ocr_service = OCRService()
    pdf_service = PDFService()

    print("=" * 115)
    print("BENCHMARK SO SÁNH HIỆU NĂNG THỰC TẾ: TUẦN TỰ (SEQUENTIAL) VS SONG SONG (PARALLEL)")
    print(f"(Thực hiện trung bình qua {num_runs} lần chạy độc lập trên cùng điều kiện)")
    print("=" * 115)

    mixed_pdf = DATASET_DIR / "mixed" / "mixed_digital_and_scanned.pdf"
    scanned_hq = DATASET_DIR / "scanned" / "scanned_high_quality.pdf"

    # Tạo tệp Scanned Multi-Page 4 trang mẫu
    multi_scanned_pdf = Path(__file__).parent / "temp_bench_4p_eval.pdf"
    doc = pymupdf.open()
    for i in range(4):
        p = doc.new_page(width=595, height=842)
        p.insert_text((72, 100), f"Sample Scanned Content Page {i+1} for rigorous OCR benchmarking.")
    doc2 = pymupdf.open()
    for i in range(4):
        pix = doc[i].get_pixmap(dpi=150)
        p2 = doc2.new_page(width=595, height=842)
        p2.insert_image(p2.rect, stream=pix.tobytes("png"))
    doc2.save(str(multi_scanned_pdf))
    doc.close()
    doc2.close()

    scenarios = [
        ("Mixed PDF (1 Digital + 1 Scanned)", mixed_pdf, "hybrid"),
        ("Scanned PDF (Single Page HQ)", scanned_hq, "ocr"),
        ("Scanned Multi-Page (4 Pages)", multi_scanned_pdf, "ocr"),
    ]

    header = (
        f"{'Tài liệu kiểm thử':<36} | "
        f"{'Tuần tự (Avg)':<18} | "
        f"{'Song song (Avg)':<18} | "
        f"{'Speedup':<10} | "
        f"{'Kết luận trung thực':<25}"
    )
    print(header)
    print("-" * 115)

    try:
        for name, file_path, mode in scenarios:
            seq_times = []
            par_times = []

            for _ in range(num_runs):
                # Đo tuần tự
                t0 = time.perf_counter()
                if mode == "hybrid":
                    pdf_service.extract_hybrid_fast_path(file_path, ocr_service=ocr_service, max_workers=1)
                else:
                    ocr_service.extract_text_from_scanned_pdf(file_path, max_workers=1)
                seq_times.append(time.perf_counter() - t0)

                # Đo song song
                t0 = time.perf_counter()
                if mode == "hybrid":
                    pdf_service.extract_hybrid_fast_path(file_path, ocr_service=ocr_service, max_workers=2)
                else:
                    ocr_service.extract_text_from_scanned_pdf(file_path, max_workers=2)
                par_times.append(time.perf_counter() - t0)

            avg_seq = round(statistics.mean(seq_times), 3)
            avg_par = round(statistics.mean(par_times), 3)
            speedup = round(avg_seq / avg_par, 2) if avg_par > 0 else 1.0

            if speedup > 1.05:
                note = f"Nhanh hơn {(speedup - 1.0)*100:.1f}%"
            elif speedup < 0.95:
                note = f"Chậm hơn {(1.0/speedup - 1.0)*100:.1f}% (Overhead)"
            else:
                note = "Tương đương (~1.0x)"

            print(
                f"{name:<36} | "
                f"{avg_seq:<14} s | "
                f"{avg_par:<14} s | "
                f"{speedup:<8}x | "
                f"{note:<25}"
            )

    finally:
        if multi_scanned_pdf.exists():
            multi_scanned_pdf.unlink()

    print("-" * 115)
    print("PHÂN TÍCH VÀ KẾT LUẬN TRUNG THỰC:")
    print("1. Với tài liệu chỉ có 1 trang Scanned (Mixed PDF hoặc Single Page Scanned):")
    print("   - Khởi tạo ThreadPoolExecutor gây ra độ trễ overhead, xử lý tuần tự trực tiếp luôn tối ưu hơn.")
    print("   - Nhờ tối ưu 'chỉ kích hoạt song song khi >= 2 trang scanned', Hybrid Fast Path tránh được overhead này.")
    print("2. Với tài liệu nhiều trang Scanned (Multi-page Scanned):")
    print("   - Khi các trang chứa hình ảnh nặng cần OCR thực sự, Tesseract OCR cạnh tranh CPU đa luồng (OpenMP).")
    print("   - Song song giúp phân tán render ảnh PyMuPDF nhưng tổng thời gian CPU-bound của Tesseract có thể không")
    print("     tăng tuyến tính và phụ thuộc mạnh vào số lõi CPU vật lý của môi trường chạy.")


if __name__ == "__main__":
    run_benchmark(num_runs=3)
