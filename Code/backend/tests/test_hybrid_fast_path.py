import sys
import unittest
from pathlib import Path

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.ocr_service import OCRService
from app.services.pdf_service import PDFService

DATASET_DIR = Path(__file__).parent / "dataset"


class TestHybridFastPath(unittest.TestCase):
    def setUp(self):
        self.pdf_service = PDFService()
        self.ocr_service = OCRService()

    def test_classify_page_digital_and_scanned(self):
        """1. Kiểm tra phân loại từng trang đơn lẻ"""
        digital_text = "This is a clean academic paragraph with native digital text layer."
        self.assertEqual(self.pdf_service.classify_page(digital_text), "digital")

        scanned_text = ""  # Trang không có text
        self.assertEqual(self.pdf_service.classify_page(scanned_text), "scanned")

        unreliable_text = "??? \ufffd \ufffd \ufffd \ufffd"  # Text hỏng / không đáng tin cậy
        self.assertEqual(self.pdf_service.classify_page(unreliable_text), "scanned")

    def test_digital_pdf_fast_path(self):
        """2. PDF Digital: Chạy Fast Path 100%, không cần OCR"""
        digital_pdf = DATASET_DIR / "digital" / "digital_single_column.pdf"
        res = self.pdf_service.extract_hybrid_fast_path(digital_pdf, ocr_service=self.ocr_service)

        self.assertEqual(res["document_type"], "digital")
        self.assertTrue(res["fast_path_used"])
        self.assertEqual(res["ocr_pages_count"], 0)
        self.assertIn("PDF-Lingua Smart Document Extraction", res["text"])

    def test_scanned_pdf_ocr_path(self):
        """3. PDF Scanned: Phân loại đúng scanned và kích hoạt OCRService"""
        scanned_pdf = DATASET_DIR / "scanned" / "scanned_high_quality.pdf"
        res = self.pdf_service.extract_hybrid_fast_path(scanned_pdf, ocr_service=self.ocr_service)

        self.assertEqual(res["document_type"], "scanned")
        self.assertEqual(res["ocr_pages_count"], 1)
        self.assertTrue(len(res["text"]) > 0)

    def test_mixed_pdf_processing(self):
        """4. PDF Mixed: Xử lý trang 1 bằng Fast Path, trang 2 bằng OCR, bảo toàn thứ tự trang"""
        mixed_pdf = DATASET_DIR / "mixed" / "mixed_digital_and_scanned.pdf"
        res = self.pdf_service.extract_hybrid_fast_path(mixed_pdf, ocr_service=self.ocr_service)

        self.assertEqual(res["document_type"], "mixed")
        self.assertEqual(res["page_count"], 2)
        self.assertEqual(len(res["pages"]), 2)

        # Trang 1: Digital (No OCR)
        self.assertEqual(res["pages"][0]["type"], "digital")
        self.assertFalse(res["pages"][0]["is_ocr_used"])
        self.assertIn("Page 1 Digital Header", res["pages"][0]["text"])

        # Trang 2: Scanned (OCR)
        self.assertEqual(res["pages"][1]["type"], "scanned")
        self.assertTrue(res["pages"][1]["is_ocr_used"])

    def test_fallback_on_extraction_error(self):
        """5. Fallback an toàn khi tệp không tồn tại hoặc lỗi mở tệp"""
        non_existent_pdf = DATASET_DIR / "non_existent.pdf"
        res = self.pdf_service.extract_hybrid_fast_path(non_existent_pdf, ocr_service=self.ocr_service)

        self.assertIn("document_type", res)
        self.assertEqual(res["text"], "")


if __name__ == "__main__":
    unittest.main()

