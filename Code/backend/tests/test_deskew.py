import unittest
import sys
from pathlib import Path
from PIL import Image, ImageDraw

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.ocr_service import OCRService


class TestDeskewCorrection(unittest.TestCase):
    def setUp(self):
        self.ocr_service = OCRService()

    def _create_horizontal_text_image(self, width: int = 800, height: int = 1000) -> Image.Image:
        """Tạo ảnh tài liệu mẫu chứa các dòng văn bản ngang song song rõ ràng"""
        img = Image.new("RGB", (width, height), color="white")
        draw = ImageDraw.Draw(img)
        # Vẽ các đoạn văn bản dài nằm ngang
        for y in range(100, height - 100, 35):
            draw.rectangle([80, y, width - 80, y + 12], fill="black")
        return img

    def test_image_not_skewed(self):
        """1. Ảnh không bị nghiêng (0°) -> giữ nguyên góc 0"""
        img = self._create_horizontal_text_image()
        corrected_img, angle = self.ocr_service.detect_and_correct_skew(img)
        self.assertEqual(angle, 0.0)

    def test_image_skewed_3_degrees(self):
        """2. Ảnh bị nghiêng 3°"""
        base_img = self._create_horizontal_text_image()
        # Giả lập ảnh scan nghiêng -3 độ (hoặc 3 độ)
        skewed_img = base_img.rotate(-3.0, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(255, 255, 255))
        corrected_img, angle = self.ocr_service.detect_and_correct_skew(skewed_img)
        # Góc phát hiện phải xấp xỉ 3° (chênh lệch <= 1°)
        self.assertAlmostEqual(angle, 3.0, delta=1.0)
        self.assertNotEqual(angle, 0.0)

    def test_image_skewed_5_degrees(self):
        """3. Ảnh bị nghiêng 5°"""
        base_img = self._create_horizontal_text_image()
        skewed_img = base_img.rotate(-5.0, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(255, 255, 255))
        corrected_img, angle = self.ocr_service.detect_and_correct_skew(skewed_img)
        # Góc phát hiện phải xấp xỉ 5° (chênh lệch <= 1°)
        self.assertAlmostEqual(angle, 5.0, delta=1.0)

    def test_image_skewed_10_degrees(self):
        """4. Ảnh bị nghiêng 10°"""
        base_img = self._create_horizontal_text_image()
        skewed_img = base_img.rotate(-10.0, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(255, 255, 255))
        corrected_img, angle = self.ocr_service.detect_and_correct_skew(skewed_img)
        # Góc phát hiện phải xấp xỉ 10° (chênh lệch <= 1.5°)
        self.assertAlmostEqual(angle, 10.0, delta=1.5)

    def test_image_skewed_beyond_threshold(self):
        """5. Ảnh nghiêng vượt phạm vi cho phép (> 15° ví dụ 25°) -> Giữ nguyên ảnh gốc"""
        base_img = self._create_horizontal_text_image()
        skewed_img = base_img.rotate(-25.0, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(255, 255, 255))
        corrected_img, angle = self.ocr_service.detect_and_correct_skew(skewed_img)
        # Ngoài giới hạn 1°-15° nên không deskew và trả về góc 0
        self.assertEqual(angle, 0.0)

    def test_image_insufficient_content(self):
        """6. Ảnh không đủ nội dung để xác định góc (chỉ có vài đốm nhỏ) -> Trả về ảnh gốc"""
        empty_img = Image.new("RGB", (600, 800), color="white")
        draw = ImageDraw.Draw(empty_img)
        draw.point([(10, 10), (12, 12)], fill="black")
        corrected_img, angle = self.ocr_service.detect_and_correct_skew(empty_img)
        self.assertEqual(angle, 0.0)
        self.assertEqual(corrected_img, empty_img)

    def test_exception_handling_and_fallback(self):
        """7. Xử lý exception và fallback về ảnh gốc"""
        # Truyền đối tượng không hợp lệ
        res_img, angle = self.ocr_service.detect_and_correct_skew(None)
        self.assertIsNone(res_img)
        self.assertEqual(angle, 0.0)


if __name__ == "__main__":
    unittest.main()

