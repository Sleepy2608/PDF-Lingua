import unittest
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from unittest.mock import patch

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.ocr_service import OCRService


class TestOrientationCorrection(unittest.TestCase):
    def setUp(self):
        self.ocr_service = OCRService()

    def _create_sample_text_image(self) -> Image.Image:
        """Tạo ảnh mẫu có chứa nhiều chữ để OSD có thể nhận diện hoặc mock dễ dàng"""
        img = Image.new("RGB", (600, 800), color="white")
        draw = ImageDraw.Draw(img)
        # Vẽ một vài khối đen lớn giả lập văn bản
        for y in range(100, 700, 40):
            draw.rectangle([100, y, 500, y + 15], fill="black")
        return img

    def test_orientation_0_degrees(self):
        """1. Trang đã đúng hướng 0°"""
        img = self._create_sample_text_image()
        with patch("pytesseract.image_to_osd", return_value={"rotate": 0, "orientation": 0, "confidence": 95.0}):
            corrected_img, angle = self.ocr_service.detect_and_correct_orientation(img)
            self.assertEqual(angle, 0)
            self.assertEqual(corrected_img.size, img.size)

    def test_orientation_90_degrees(self):
        """2. Trang bị xoay 90°"""
        img = self._create_sample_text_image()
        with patch("pytesseract.image_to_osd", return_value={"rotate": 90, "orientation": 90, "confidence": 90.0}):
            corrected_img, angle = self.ocr_service.detect_and_correct_orientation(img)
            self.assertEqual(angle, 90)
            # Sau khi xoay 270° (360 - 90), kích thước WxH đổi chỗ cho nhau (800, 600)
            self.assertEqual(corrected_img.size, (800, 600))

    def test_orientation_180_degrees(self):
        """3. Trang bị ngược 180°"""
        img = self._create_sample_text_image()
        with patch("pytesseract.image_to_osd", return_value={"rotate": 180, "orientation": 180, "confidence": 88.0}):
            corrected_img, angle = self.ocr_service.detect_and_correct_orientation(img)
            self.assertEqual(angle, 180)
            self.assertEqual(corrected_img.size, img.size)

    def test_orientation_270_degrees(self):
        """4. Trang bị xoay 270°"""
        img = self._create_sample_text_image()
        with patch("pytesseract.image_to_osd", return_value={"rotate": 270, "orientation": 270, "confidence": 92.0}):
            corrected_img, angle = self.ocr_service.detect_and_correct_orientation(img)
            self.assertEqual(angle, 270)
            self.assertEqual(corrected_img.size, (800, 600))

    def test_osd_exception_fallback(self):
        """5. OSD gặp lỗi (Exception / Too few characters) -> Giữ nguyên ảnh gốc"""
        img = self._create_sample_text_image()
        with patch("pytesseract.image_to_osd", side_effect=Exception("Too few characters to resolve OSD")):
            corrected_img, angle = self.ocr_service.detect_and_correct_orientation(img)
            self.assertEqual(angle, 0)
            self.assertEqual(corrected_img, img)

    def test_blank_page_preserves_skip_behavior(self):
        """6. Trang trống -> Giữ nguyên logic skip OCR từ 109.1"""
        blank_img = Image.new("RGB", (500, 500), color="white")
        is_blank = self.ocr_service.is_blank_page(blank_img)
        self.assertTrue(is_blank)


if __name__ == "__main__":
    unittest.main()

