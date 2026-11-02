import io
import sys
import tracemalloc
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


class TestMemoryOptimization(unittest.TestCase):
    def setUp(self):
        self.pdf_service = PDFService()
        self.ocr_service = OCRService()

    def _create_multipage_pdf(self, num_pages: int = 10, tmp_path: Path | None = None) -> Path:
        """Tạo tệp PDF nhiều trang để kiểm thử lazy loading và dọn dẹp bộ nhớ"""
        if tmp_path is None:
            tmp_path = Path(__file__).parent / "temp_multipage.pdf"

        doc = pymupdf.open()
        for i in range(num_pages):
            page = doc.new_page(width=595, height=842)
            page.insert_text((72, 100), f"Section {i + 1}: Multi-page performance testing content for page {i + 1}.", fontsize=12)
        doc.save(str(tmp_path))
        doc.close()
        return tmp_path

    def _create_large_scanned_pdf(self, num_pages: int = 3, tmp_path: Path | None = None) -> Path:
        """Tạo tệp PDF scan chứa các hình ảnh dung lượng lớn (render nặng)"""
        if tmp_path is None:
            tmp_path = Path(__file__).parent / "temp_large_scanned.pdf"

        doc = pymupdf.open()
        for i in range(num_pages):
            img = Image.new("RGB", (1000, 1200), color="white")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            img_bytes = buf.getvalue()
            img.close()

            page = doc.new_page(width=595, height=842)
            page.insert_image(page.rect, stream=img_bytes)

        doc.save(str(tmp_path))
        doc.close()
        return tmp_path

    def test_multipage_pdf_memory_peak(self):
        """1. Kiểm tra RAM peak khi xử lý PDF nhiều trang (10 trang) bằng Hybrid Fast Path"""
        pdf_path = self._create_multipage_pdf(num_pages=10)
        try:
            tracemalloc.start()
            res = self.pdf_service.extract_hybrid_fast_path(pdf_path, ocr_service=self.ocr_service)
            current, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()

            # Bộ nhớ peak phải rất nhỏ (< 15 MB) vì Fast Path không nạp ảnh vào RAM
            peak_mb = peak / (1024 * 1024)
            self.assertEqual(res["page_count"], 10)
            self.assertEqual(res["document_type"], "digital")
            self.assertLess(peak_mb, 15.0, f"Peak memory {peak_mb:.2f}MB vượt quá giới hạn kỳ vọng.")
        finally:
            if pdf_path.exists():
                pdf_path.unlink()

    def test_scanned_pdf_image_cleanup_per_page(self):
        """2. Kiểm tra giải phóng ảnh trung gian ngay sau khi xử lý từng trang scan"""
        pdf_path = self._create_large_scanned_pdf(num_pages=3)
        try:
            tracemalloc.start()
            res = self.ocr_service.extract_text_from_scanned_pdf(pdf_path, max_pages=3)
            current, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()

            # Sau khi hoàn tất, bộ nhớ current (đang giữ) phải được giải phóng về mức thấp (< 5MB)
            current_mb = current / (1024 * 1024)
            self.assertTrue(res["success"])
            self.assertEqual(res["page_count"], 3)
            self.assertLess(current_mb, 5.0, f"Bộ nhớ chưa giải phóng sau OCR: {current_mb:.2f}MB")
        finally:
            if pdf_path.exists():
                pdf_path.unlink()

    def test_doc_fitz_cleanup_on_success_and_exception(self):
        """3. Xác nhận doc_fitz.close() thực sự được gọi khi thành công lẫn exception trong Hybrid Fast Path"""
        mixed_pdf = DATASET_DIR / "mixed" / "mixed_digital_and_scanned.pdf"

        # Case 3.1: Thành công (Success)
        real_open = pymupdf.open
        mock_doc_instance = None

        def open_spy(*args, **kwargs):
            nonlocal mock_doc_instance
            doc = real_open(*args, **kwargs)
            mock_doc_instance = MagicMock(wraps=doc)
            return mock_doc_instance

        with patch("pymupdf.open", side_effect=open_spy):
            res = self.pdf_service.extract_hybrid_fast_path(mixed_pdf, ocr_service=self.ocr_service)
            self.assertIsNotNone(mock_doc_instance, "doc_fitz phải được mở cho Mixed PDF.")
            mock_doc_instance.close.assert_called()

        # Case 3.2: Phát sinh ngoại lệ (Exception)
        mock_doc_exception = None

        def open_spy_exc(*args, **kwargs):
            nonlocal mock_doc_exception
            doc = real_open(*args, **kwargs)
            mock_doc_exception = MagicMock(wraps=doc)
            return mock_doc_exception

        with patch("pymupdf.open", side_effect=open_spy_exc):
            with patch.object(self.ocr_service, "preprocess_image", side_effect=RuntimeError("Simulated OCR Error")):
                res = self.pdf_service.extract_hybrid_fast_path(mixed_pdf, ocr_service=self.ocr_service)
                self.assertIsNotNone(mock_doc_exception)
                mock_doc_exception.close.assert_called()

    def test_ocr_service_document_cleanup_pymupdf_and_pdfium(self):
        """4. Đảm bảo cleanup doc.close() hoạt động với cả PyMuPDF và PDFium khi thành công lẫn exception"""
        scanned_pdf = DATASET_DIR / "scanned" / "scanned_high_quality.pdf"

        # 4.1 PyMuPDF Cleanup (Success & Exception)
        with patch("app.services.ocr_service.pdfium", None):
            real_open = pymupdf.open

            # Thành công
            mock_doc = None
            def spy_fitz(*args, **kwargs):
                nonlocal mock_doc
                d = real_open(*args, **kwargs)
                mock_doc = MagicMock(wraps=d)
                return mock_doc

            with patch("pymupdf.open", side_effect=spy_fitz):
                res = self.ocr_service.extract_text_from_scanned_pdf(scanned_pdf, max_pages=1)
                self.assertIsNotNone(mock_doc)
                mock_doc.close.assert_called()

            # Exception
            mock_doc_exc = None
            def spy_fitz_exc(*args, **kwargs):
                nonlocal mock_doc_exc
                d = real_open(*args, **kwargs)
                mock_doc_exc = MagicMock(wraps=d)
                return mock_doc_exc

            with patch("pymupdf.open", side_effect=spy_fitz_exc):
                with patch.object(self.ocr_service, "preprocess_image", side_effect=RuntimeError("Render error")):
                    res = self.ocr_service.extract_text_from_scanned_pdf(scanned_pdf, max_pages=1)
                    self.assertIsNotNone(mock_doc_exc)
                    mock_doc_exc.close.assert_called()

        # 4.2 PDFium Cleanup (Success & Exception)
        mock_pdfium_doc = MagicMock()
        mock_pdfium_doc.__len__.return_value = 1
        mock_pdfium_page = MagicMock()
        mock_pil = Image.new("RGB", (100, 100), color="white")
        mock_pdfium_page.render.return_value.to_pil.return_value = mock_pil
        mock_pdfium_doc.get_page.return_value = mock_pdfium_page

        mock_pdfium_module = MagicMock()
        mock_pdfium_module.PdfDocument.return_value = mock_pdfium_doc

        # Thành công
        with patch("app.services.ocr_service.pdfium", mock_pdfium_module):
            res = self.ocr_service.extract_text_from_scanned_pdf(scanned_pdf, max_pages=1)
            mock_pdfium_doc.close.assert_called()

        # Exception
        mock_pdfium_doc.reset_mock()
        with patch("app.services.ocr_service.pdfium", mock_pdfium_module):
            with patch.object(self.ocr_service, "preprocess_image", side_effect=RuntimeError("PDFium crash")):
                res = self.ocr_service.extract_text_from_scanned_pdf(scanned_pdf, max_pages=1)
                mock_pdfium_doc.close.assert_called()

    def test_intermediate_images_cleanup_preserves_input(self):
        """5. Kiểm tra cleanup ảnh trung gian khi preprocessing phát sinh exception; không đóng nhầm ảnh đầu vào"""
        input_img = Image.new("RGB", (300, 400), color="white")

        # Trường hợp 1: Chạy bình thường
        out_img, meta = self.ocr_service.preprocess_image(input_img, check_blank=False)
        # Ảnh đầu vào input_img không được bị đóng nhầm, vẫn đọc được thuộc tính size
        self.assertEqual(input_img.size, (300, 400))
        self.assertIsNotNone(input_img.mode)

        # Trường hợp 2: Có ngoại lệ trong detect_and_correct_skew
        with patch.object(self.ocr_service, "detect_and_correct_skew", side_effect=RuntimeError("Skew crash")):
            out_img_err, meta_err = self.ocr_service.preprocess_image(input_img, check_blank=False)
            self.assertEqual(input_img.size, (300, 400))
            self.assertIsNotNone(input_img.mode)

        input_img.close()

    def test_compatibility_with_hybrid_fast_path(self):
        """6. Kiểm tra tính tương thích và bảo toàn thứ tự trang của Hybrid Fast Path sau tối ưu"""
        mixed_pdf = DATASET_DIR / "mixed" / "mixed_digital_and_scanned.pdf"
        res = self.pdf_service.extract_hybrid_fast_path(mixed_pdf, ocr_service=self.ocr_service)

        self.assertEqual(res["page_count"], 2)
        self.assertEqual(res["pages"][0]["page"], 1)
        self.assertEqual(res["pages"][0]["type"], "digital")
        self.assertEqual(res["pages"][1]["page"], 2)
        self.assertEqual(res["pages"][1]["type"], "scanned")


if __name__ == "__main__":
    unittest.main()
