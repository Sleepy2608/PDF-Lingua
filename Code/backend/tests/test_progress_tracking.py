import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import pymupdf
from PIL import Image

from app.services.ocr_service import OCRService
from app.services.pdf_service import PDFService

DATASET_DIR = Path(__file__).parent / "dataset"


class TestProgressTracking(unittest.TestCase):
    def setUp(self):
        self.pdf_service = PDFService()
        self.ocr_service = OCRService()

    def test_progress_tracking_digital_pdf(self):
        """1. Kiểm tra theo dõi tiến độ cho tài liệu Digital PDF"""
        digital_pdf = DATASET_DIR / "digital" / "digital_single_column.pdf"
        progress_events = []

        def callback(processed, total, msg):
            progress_events.append((processed, total, msg))

        res = self.pdf_service.extract_hybrid_fast_path(
            digital_pdf,
            ocr_service=self.ocr_service,
            progress_callback=callback,
        )

        self.assertEqual(res["document_type"], "digital")
        self.assertGreater(len(progress_events), 0)

        # Trang cuối cùng phải đạt 100% số trang digital
        final_processed, final_total, final_msg = progress_events[-1]
        self.assertEqual(final_processed, final_total)
        self.assertGreater(final_total, 0)

    def test_progress_tracking_mixed_pdf(self):
        """2. Kiểm tra theo dõi tiến độ theo từng trang cho tài liệu Mixed PDF"""
        mixed_pdf = DATASET_DIR / "mixed" / "mixed_digital_and_scanned.pdf"
        progress_events = []

        def callback(processed, total, msg):
            progress_events.append((processed, total, msg))

        res = self.pdf_service.extract_hybrid_fast_path(
            mixed_pdf,
            ocr_service=self.ocr_service,
            progress_callback=callback,
        )

        self.assertEqual(res["page_count"], 2)
        # Phải nhận được các sự kiện tiến độ cho cả 2 trang
        processed_values = [p[0] for p in progress_events if p[0] > 0]
        self.assertIn(1, processed_values)
        self.assertIn(2, processed_values)

    def test_progress_tracking_scanned_pdf(self):
        """3. Kiểm tra theo dõi tiến độ trong OCRService extract_text_from_scanned_pdf"""
        scanned_pdf = DATASET_DIR / "scanned" / "scanned_high_quality.pdf"
        progress_events = []

        def callback(processed, total, msg):
            progress_events.append((processed, total, msg))

        res = self.ocr_service.extract_text_from_scanned_pdf(
            scanned_pdf,
            max_workers=1,
            progress_callback=callback,
        )

        self.assertTrue(res["success"])
        self.assertGreater(len(progress_events), 0)
        self.assertEqual(progress_events[-1][0], 1)

    def test_callback_exception_does_not_break_extraction(self):
        """4. Lỗi trong callback tiến độ không làm hỏng quá trình trích xuất tài liệu"""
        digital_pdf = DATASET_DIR / "digital" / "digital_single_column.pdf"

        def broken_callback(processed, total, msg):
            raise RuntimeError("UI stream disconnected or callback failed!")

        # Phải thực thi thành công không bị crash
        res = self.pdf_service.extract_hybrid_fast_path(
            digital_pdf,
            ocr_service=self.ocr_service,
            progress_callback=broken_callback,
        )
        self.assertEqual(res["document_type"], "digital")
        self.assertGreater(len(res["text"]), 0)


if __name__ == "__main__":
    unittest.main()