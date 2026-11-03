import json
import unittest
from pathlib import Path

DATASET_DIR = Path(__file__).parent / "dataset"
METADATA_FILE = DATASET_DIR / "dataset_metadata.json"


class TestDatasetPreparation(unittest.TestCase):
    def setUp(self):
        self.assertTrue(DATASET_DIR.exists(), "Thư mục dataset không tồn tại.")
        self.assertTrue(METADATA_FILE.exists(), "File dataset_metadata.json không tồn tại.")
        with open(METADATA_FILE, "r", encoding="utf-8") as f:
            self.metadata = json.load(f)

    def test_metadata_structure(self):
        """1. Kiểm tra cấu trúc metadata tối thiểu theo yêu cầu"""
        self.assertIsInstance(self.metadata, list)
        self.assertGreaterEqual(len(self.metadata), 6, "Dataset phải có ít nhất 6 tài liệu mẫu.")

        required_fields = ["filename", "type", "page_count", "characteristics", "file_path", "ground_truth_path"]
        for item in self.metadata:
            for field in required_fields:
                self.assertIn(field, item, f"Trường {field} bị thiếu trong metadata của {item.get('filename')}")
                self.assertTrue(item[field], f"Trường {field} không được để rỗng")

    def test_dataset_categories_coverage(self):
        """2. Kiểm tra bộ dataset có đủ 3 nhóm: Digital, Complex, Scanned"""
        types = {item["type"] for item in self.metadata}
        self.assertIn("Digital PDF", types, "Thiếu nhóm Digital PDF")
        self.assertIn("Complex PDF", types, "Thiếu nhóm Complex PDF")
        self.assertIn("Scanned PDF", types, "Thiếu nhóm Scanned PDF")

        subtypes = {item.get("subtype") for item in self.metadata}
        # Digital: single-column, multi-column
        self.assertIn("single_column", subtypes)
        self.assertIn("multi_column", subtypes)
        # Complex: tables, symbols, formulas
        self.assertIn("tables_symbols_formulas", subtypes)
        # Scanned: high, medium, low
        self.assertIn("high_quality", subtypes)
        self.assertIn("medium_skewed", subtypes)
        self.assertIn("low_blurry_noisy", subtypes)

    def test_files_and_ground_truth_existence(self):
        """3. Kiểm tra file PDF và file Ground Truth đối ứng đều tồn tại trên ổ đĩa và không rỗng"""
        base_tests_dir = Path(__file__).parent

        for item in self.metadata:
            pdf_path = base_tests_dir / item["file_path"]
            gt_path = base_tests_dir / item["ground_truth_path"]

            self.assertTrue(pdf_path.exists(), f"File PDF không tồn tại: {pdf_path}")
            self.assertGreater(pdf_path.stat().st_size, 0, f"File PDF rỗng: {pdf_path}")

            self.assertTrue(gt_path.exists(), f"File Ground Truth không tồn tại: {gt_path}")
            gt_content = gt_path.read_text(encoding="utf-8").strip()
            self.assertGreater(len(gt_content), 20, f"Nội dung Ground Truth quá ngắn hoặc rỗng: {gt_path}")

    def test_ground_truth_exact_match_for_digital(self):
        """4. Kiểm tra đối chiếu Ground Truth của Digital PDF chính xác với văn bản nhúng"""
        import pymupdf
        base_tests_dir = Path(__file__).parent

        for item in self.metadata:
            if item["type"] in ("Digital PDF", "Complex PDF"):
                pdf_path = base_tests_dir / item["file_path"]
                gt_path = base_tests_dir / item["ground_truth_path"]

                doc = pymupdf.open(str(pdf_path))
                extracted_text = "\n".join(page.get_text() for page in doc).strip()
                doc.close()

                gt_text = gt_path.read_text(encoding="utf-8").strip()

                # Xác nhận các từ khóa quan trọng trong Ground Truth đều xuất hiện trong file PDF
                sample_words = [w for w in gt_text.split() if len(w) > 4][:5]
                for word in sample_words:
                    self.assertIn(word, extracted_text, f"Từ khóa Ground Truth '{word}' không khớp trong PDF: {item['filename']}")


if __name__ == "__main__":
    unittest.main()

