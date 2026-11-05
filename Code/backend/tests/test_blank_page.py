import unittest
import sys
from pathlib import Path
from PIL import Image, ImageDraw

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.pdf_service import PDFService
from app.services.ocr_service import OCRService


class TestBlankPageDetection(unittest.TestCase):
    def setUp(self):
        self.pdf_service = PDFService()
        self.ocr_service = OCRService()

    def test_completely_blank_page(self):
        """1. Trang trắng hoàn toàn"""
        img = Image.new("RGB", (500, 500), color="white")
        self.assertTrue(self.pdf_service.is_blank_page(img))
        self.assertTrue(self.ocr_service.is_blank_page(img))

    def test_page_with_text_content(self):
        """2. Trang có văn bản (nội dung rõ ràng)"""
        img = Image.new("RGB", (500, 500), color="white")
        draw = ImageDraw.Draw(img)
        # Vẽ một khối văn bản / đường kẻ lớn
        draw.rectangle([50, 50, 450, 200], fill="black")
        self.assertFalse(self.pdf_service.is_blank_page(img))
        self.assertFalse(self.ocr_service.is_blank_page(img))

    def test_page_with_minimal_content(self):
        """3. Trang có ít nội dung (văn bản nhỏ, chữ ký, số trang)"""
        img = Image.new("RGB", (1000, 1000), color="white")
        draw = ImageDraw.Draw(img)
        # Vẽ một đoạn văn nhỏ khoảng 20x20 pixel
        draw.rectangle([900, 950, 950, 970], fill="black")
        # Không được nhầm lẫn là trang trống
        self.assertFalse(self.pdf_service.is_blank_page(img))
        self.assertFalse(self.ocr_service.is_blank_page(img))

    def test_page_with_scan_noise(self):
        """4. Trang có nhiễu scan (vết lấm chấm rất nhỏ / nhiễu rải rác dưới threshold)"""
        img = Image.new("RGB", (1000, 1000), color="white")
        draw = ImageDraw.Draw(img)
        # Vẽ vài đốm nhiễu nhỏ cực kì ít (vài pixel)
        draw.point([(10, 10), (11, 10), (10, 11)], fill="gray")
        # Phải phát hiện đúng là trang trống
        self.assertTrue(self.pdf_service.is_blank_page(img))
        self.assertTrue(self.ocr_service.is_blank_page(img))


if __name__ == "__main__":
    unittest.main()
