import json
import time
import sys
from pathlib import Path

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.pdf_service import PDFService
from app.services.ocr_service import OCRService

DATASET_DIR = Path(__file__).parent / "dataset"
METADATA_FILE = DATASET_DIR / "dataset_metadata.json"


def measure_comparison():
    pdf_service = PDFService()
    ocr_service = OCRService()

    with open(METADATA_FILE, "r", encoding="utf-8") as f:
        meta_list = json.load(f)

    results = []

    print(f"{'Document':<35} | {'Type':<12} | {'Legacy Time':<12} | {'Hybrid Time':<12} | {'Speedup':<10}")
    print("-" * 90)

    for doc in meta_list:
        pdf_path = Path(__file__).parent / doc["file_path"]
        doc_type = doc["type"]
        filename = doc["filename"]

        # 1. Đo thời gian Legacy (Cũ):
        # - Nếu là Scanned hoặc is_scanned_pdf=True: Chạy extract_text_from_scanned_pdf
        # - Nếu là Digital thuần: extract_text
        t0 = time.time()
        is_scanned_legacy = pdf_service.is_scanned_pdf(pdf_path)
        if is_scanned_legacy:
            legacy_text = ocr_service.extract_text_from_scanned_pdf(pdf_path).get("text", "")
        else:
            legacy_text = pdf_service.extract_text(pdf_path)
        legacy_time = round(time.time() - t0, 4)

        # 2. Đo thời gian Hybrid Fast Path (Mới):
        t1 = time.time()
        hybrid_res = pdf_service.extract_hybrid_fast_path(pdf_path, ocr_service=ocr_service)
        hybrid_time = round(time.time() - t1, 4)

        speedup = round(legacy_time / hybrid_time, 2) if hybrid_time > 0 else 1.0

        results.append({
            "filename": filename,
            "type": doc_type,
            "legacy_time": legacy_time,
            "hybrid_time": hybrid_time,
            "speedup": f"{speedup}x",
        })

        print(f"{filename:<35} | {doc_type:<12} | {legacy_time:<10}s | {hybrid_time:<10}s | {speedup}x")

    return results


if __name__ == "__main__":
    measure_comparison()

