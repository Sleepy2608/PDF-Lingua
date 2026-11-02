import json
import sys
from pathlib import Path
import pymupdf

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

DATASET_DIR = Path(__file__).parent / "dataset"
MIXED_DIR = DATASET_DIR / "mixed"
GROUND_TRUTH_DIR = DATASET_DIR / "ground_truth"

MIXED_DIR.mkdir(parents=True, exist_ok=True)


def generate_mixed_pdf():
    filename = "mixed_digital_and_scanned.pdf"
    pdf_path = MIXED_DIR / filename
    gt_path = GROUND_TRUTH_DIR / "mixed_digital_and_scanned.txt"

    page1_text = (
        "Page 1 Digital Header\n\n"
        "This is the first page of a mixed PDF document.\n"
        "It contains native digital vector text that should be processed instantly via Fast Path."
    )

    page2_text = (
        "Page 2 Scanned Content\n\n"
        "This second page represents a scanned image page inserted into the document.\n"
        "It requires OCR processing and preprocessing pipeline execution."
    )

    # 1. Tạo file PDF 2 trang
    doc = pymupdf.open()

    # Trang 1: Native Digital
    page1 = doc.new_page(width=595, height=842)
    page1.insert_text((72, 100), page1_text, fontsize=12)

    # Trang 2: Scanned Image Page (render text sang image rồi chèn lại)
    page2_temp = doc.new_page(width=595, height=842)
    page2_temp.insert_text((72, 100), page2_text, fontsize=12)
    pix = page2_temp.get_pixmap(dpi=150)

    doc.delete_page(1)  # Xóa trang tạm
    page2_final = doc.new_page(width=595, height=842)
    page2_final.insert_image(page2_final.rect, stream=pix.tobytes("png"))

    doc.save(str(pdf_path))
    doc.close()

    full_gt = f"{page1_text}\n\n{page2_text}"
    gt_path.write_text(full_gt, encoding="utf-8")

    # Cập nhật dataset_metadata.json
    metadata_file = DATASET_DIR / "dataset_metadata.json"
    with open(metadata_file, "r", encoding="utf-8") as f:
        meta = json.load(f)

    # Kiểm tra nếu chưa có
    if not any(item["filename"] == filename for item in meta):
        meta.append({
            "filename": filename,
            "type": "Mixed PDF",
            "subtype": "digital_and_scanned",
            "page_count": 2,
            "characteristics": "Contains Page 1 (Native Digital) and Page 2 (Scanned Image).",
            "file_path": str(pdf_path.relative_to(DATASET_DIR.parent)),
            "ground_truth_path": str(gt_path.relative_to(DATASET_DIR.parent)),
        })
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

    print("Generated mixed PDF and updated dataset metadata successfully!")


if __name__ == "__main__":
    generate_mixed_pdf()

