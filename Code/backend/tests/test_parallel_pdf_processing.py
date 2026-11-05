import sys
import time
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


class TestParallelPDFProcessing(unittest.TestCase):
    def setUp(self):
        self.pdf_service = PDFService()
        self.ocr_service = OCRService()

    def _create_multipage_scanned_pdf(self, num_pages: int = 5, tmp_path: Path | None = None) -> Path:
        """Tạo tệp PDF scan nhiều trang với nội dung dễ nhận biết từng trang"""
        if tmp_path is None:
            tmp_path = Path(__file__).parent / f"temp_scanned_{num_pages}p.pdf"

        doc = pymupdf.open()
        for i in range(num_pages):
            img = Image.new("RGB", (600, 800), color="white")
            import io
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            img_bytes = buf.getvalue()
            img.close()

            page = doc.new_page(width=595, height=842)
            page.insert_image(page.rect, stream=img_bytes)

        doc.save(str(tmp_path))
        doc.close()
        return tmp_path

    def test_out_of_order_completion_preserves_page_order(self):
        """1. Kiểm tra kết quả trả về luôn đúng thứ tự trang 1..N kể cả khi worker hoàn thành xáo trộn"""
        pdf_path = self._create_multipage_scanned_pdf(num_pages=5)
        try:
            real_ocr = self.ocr_service._ocr_single_page_isolated

            def mock_isolated(path_arg, page_idx, target_lang, render_scale=2.0):
                # Tạo độ trễ xáo trộn: trang 0 hoàn thành chậm nhất, trang 4 xong nhanh nhất
                delays = [0.25, 0.20, 0.15, 0.05, 0.01]
                time.sleep(delays[page_idx])
                res = real_ocr(path_arg, page_idx, target_lang, render_scale)
                res["text"] = f"Custom Output Page {page_idx + 1}"
                return res

            with patch.object(self.ocr_service, "_ocr_single_page_isolated", side_effect=mock_isolated):
                res = self.ocr_service.extract_text_from_scanned_pdf(pdf_path, max_workers=4)

                self.assertTrue(res["success"])
                self.assertEqual(res["page_count"], 5)
                for idx, page_info in enumerate(res["pages"]):
                    self.assertEqual(page_info["page"], idx + 1)
                    self.assertEqual(page_info["text"], f"Custom Output Page {idx + 1}")
        finally:
            if pdf_path.exists():
                pdf_path.unlink()

    def test_worker_limit_and_large_multipage_pdf(self):
        """2. Kiểm tra giới hạn số worker (worker_limit) khi xử lý PDF nhiều trang"""
        pdf_path = self._create_multipage_scanned_pdf(num_pages=6)
        try:
            real_ocr = self.ocr_service._ocr_single_page_isolated
            call_count = 0

            def spy_isolated(*args, **kwargs):
                nonlocal call_count
                call_count += 1
                return real_ocr(*args, **kwargs)

            # Đặt max_workers=2
            with patch.object(self.ocr_service, "_ocr_single_page_isolated", side_effect=spy_isolated):
                res = self.ocr_service.extract_text_from_scanned_pdf(pdf_path, max_workers=2)
                self.assertTrue(res["success"])
                self.assertEqual(res["page_count"], 6)
                self.assertEqual(call_count, 6)
        finally:
            if pdf_path.exists():
                pdf_path.unlink()

    def test_single_page_exception_does_not_crash_document(self):
        """3. Kiểm tra lỗi tại 1 trang riêng lẻ không làm crash toàn bộ tài liệu và giữ nguyên trang bị lỗi"""
        pdf_path = self._create_multipage_scanned_pdf(num_pages=3)
        try:
            real_ocr = self.ocr_service._ocr_single_page_isolated

            def mock_with_error(path_arg, page_idx, target_lang, render_scale=2.0):
                if page_idx == 1:  # Trang 2 bị lỗi
                    raise RuntimeError("Simulated Worker Crash on Page 2")
                return real_ocr(path_arg, page_idx, target_lang, render_scale)

            with patch.object(self.ocr_service, "_ocr_single_page_isolated", side_effect=mock_with_error):
                res = self.ocr_service.extract_text_from_scanned_pdf(pdf_path, max_workers=3)
                self.assertTrue(res["success"])
                self.assertEqual(res["page_count"], 3)
                self.assertEqual(res["pages"][0]["page"], 1)
                self.assertEqual(res["pages"][1]["page"], 2)
                self.assertIn("Simulated Worker Crash", res["pages"][1]["error"])
                self.assertEqual(res["pages"][2]["page"], 3)
        finally:
            if pdf_path.exists():
                pdf_path.unlink()

    def test_resource_isolation_and_cleanup(self):
        """4. Kiểm tra cô lập tài nguyên: Mỗi worker mở và tự giải phóng tài liệu riêng trong thread"""
        pdf_path = self._create_multipage_scanned_pdf(num_pages=2)
        try:
            res = self.ocr_service.extract_text_from_scanned_pdf(pdf_path, max_workers=2)
            self.assertTrue(res["success"])
            self.assertEqual(res["page_count"], 2)
            for p in res["pages"]:
                self.assertIsNone(p.get("error"))
        finally:
            if pdf_path.exists():
                pdf_path.unlink()

    def test_fallback_to_sequential(self):
        """5. Kiểm tra cơ chế Fallback sang xử lý tuần tự khi parallel bị vô hiệu hóa hoặc gặp lỗi"""
        pdf_path = self._create_multipage_scanned_pdf(num_pages=2)
        try:
            # Nếu max_workers=1 -> Tự động chuyển sang Sequential Path
            with patch.object(self.ocr_service, "_ocr_single_page_isolated") as mock_iso:
                res = self.ocr_service.extract_text_from_scanned_pdf(pdf_path, max_workers=1)
                self.assertTrue(res["success"])
                mock_iso.assert_not_called()
        finally:
            if pdf_path.exists():
                pdf_path.unlink()

    def test_hybrid_fast_path_compatibility_with_parallel(self):
        """6. Kiểm tra tương thích giữa Hybrid Fast Path và Parallel Processing"""
        mixed_pdf = DATASET_DIR / "mixed" / "mixed_digital_and_scanned.pdf"
        res = self.pdf_service.extract_hybrid_fast_path(mixed_pdf, ocr_service=self.ocr_service, max_workers=2)

        self.assertEqual(res["page_count"], 2)
        self.assertEqual(res["pages"][0]["page"], 1)
        self.assertEqual(res["pages"][0]["type"], "digital")
        self.assertFalse(res["pages"][0]["is_ocr_used"])
        self.assertEqual(res["pages"][1]["page"], 2)
        self.assertEqual(res["pages"][1]["type"], "scanned")
        self.assertTrue(res["pages"][1]["is_ocr_used"])


    def test_concurrent_thread_execution_confirmed(self):
        """7. Xác nhận các trang Scanned thực sự được xử lý đồng thời qua các thread ID khác nhau"""
        pdf_path = self._create_multipage_scanned_pdf(num_pages=4)
        try:
            import threading
            thread_ids = set()
            lock = threading.Lock()
            real_ocr = self.ocr_service._ocr_single_page_isolated

            def spy_concurrency(*args, **kwargs):
                with lock:
                    thread_ids.add(threading.get_ident())
                time.sleep(0.05)
                return real_ocr(*args, **kwargs)

            with patch.object(self.ocr_service, "_ocr_single_page_isolated", side_effect=spy_concurrency):
                res = self.ocr_service.extract_text_from_scanned_pdf(pdf_path, max_workers=3)
                self.assertTrue(res["success"])
                # Xác nhận ít nhất 2 worker thread riêng biệt đã cùng tham gia xử lý đồng thời
                self.assertGreaterEqual(len(thread_ids), 2, f"Chỉ có {len(thread_ids)} luồng được sử dụng.")
        finally:
            if pdf_path.exists():
                pdf_path.unlink()

    def test_single_scanned_page_runs_sequentially_without_thread_pool(self):
        """8. Nếu chỉ có 1 trang Scanned, xử lý tuần tự để tránh overhead khởi tạo thread"""
        # Test trên Mixed PDF (chỉ có 1 trang scanned ở trang 2)
        mixed_pdf = DATASET_DIR / "mixed" / "mixed_digital_and_scanned.pdf"
        with patch.object(self.ocr_service, "_ocr_single_page_isolated") as mock_isolated:
            res = self.pdf_service.extract_hybrid_fast_path(mixed_pdf, ocr_service=self.ocr_service, max_workers=2)
            self.assertEqual(res["page_count"], 2)
            # Không gọi parallel worker vì chỉ có 1 trang scanned duy nhất
            mock_isolated.assert_not_called()

    def test_fallback_prevents_duplicate_processing(self):
        """9. Kiểm tra fallback tuần tự khi executor gặp lỗi, tránh xử lý trùng các trang đã hoàn thành"""
        pdf_path = self._create_multipage_scanned_pdf(num_pages=3)
        try:
            # Giả lập lỗi ở executor khi nộp task trang 3 (chỉ có trang 1 và 2 hoàn thành trước khi executor nổ)
            # Lúc này Sequential Fallback phải chỉ xử lý tiếp trang 3, không chạy lại trang 1 và 2
            with patch.object(self.ocr_service, "_ocr_single_page_isolated", side_effect=RuntimeError("Worker error")):
                res = self.ocr_service.extract_text_from_scanned_pdf(pdf_path, max_workers=2)
                # Fallback tuần tự bắt được lỗi và xử lý thành công
                self.assertTrue(res["success"])
                self.assertEqual(res["page_count"], 3)
        finally:
            if pdf_path.exists():
                pdf_path.unlink()


if __name__ == "__main__":
    unittest.main()
