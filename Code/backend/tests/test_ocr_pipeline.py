import unittest
import sys
from pathlib import Path
from PIL import Image, ImageDraw
from unittest.mock import patch

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.ocr_service import OCRService


class TestOCRIntegrationPipeline(unittest.TestCase):
    def setUp(self):
        self.ocr_service = OCRService()

    def _create_sample_text_image(self, width: int = 600, height: int = 800) -> Image.Image:
        """Tạo ảnh mẫu có dòng chữ để thử nghiệm pipeline"""
        img = Image.new("RGB", (width, height), color="white")
        draw = ImageDraw.Draw(img)
        for y in range(100, height - 100, 40):
            draw.rectangle([80, y, width - 80, y + 15], fill="black")
        return img

    def test_pipeline_order_and_single_processing(self):
        """1. Kiểm tra thứ tự các bước trong pipeline và đảm bảo không xử lý lặp lại 2 lần"""
        img = self._create_sample_text_image()

        with patch.object(self.ocr_service, "is_blank_page", wraps=self.ocr_service.is_blank_page) as mock_blank, \
             patch.object(self.ocr_service, "detect_and_correct_orientation", wraps=self.ocr_service.detect_and_correct_orientation) as mock_orient, \
             patch.object(self.ocr_service, "detect_and_correct_skew", wraps=self.ocr_service.detect_and_correct_skew) as mock_skew, \
             patch.object(self.ocr_service, "enhance_image", wraps=self.ocr_service.enhance_image) as mock_enhance:

            processed_img, meta = self.ocr_service.preprocess_image(img)

            # Đảm bảo từng bước đều được gọi đúng 1 lần theo thứ tự
            mock_blank.assert_called_once()
            mock_orient.assert_called_once()
            mock_skew.assert_called_once()
            mock_enhance.assert_called_once()

            self.assertFalse(meta["is_blank"])
            self.assertTrue(meta["enhanced"])

    def test_blank_page_early_exit(self):
        """2. Trang trống phải dừng pipeline sớm tại bước 1 (bỏ qua Orient, Skew, Enhance)"""
        blank_img = Image.new("RGB", (500, 500), color="white")

        with patch.object(self.ocr_service, "detect_and_correct_orientation") as mock_orient, \
             patch.object(self.ocr_service, "detect_and_correct_skew") as mock_skew, \
             patch.object(self.ocr_service, "enhance_image") as mock_enhance:

            processed_img, meta = self.ocr_service.preprocess_image(blank_img)

            self.assertTrue(meta["is_blank"])
            mock_orient.assert_not_called()
            mock_skew.assert_not_called()
            mock_enhance.assert_not_called()

    def test_error_handling_and_fallback(self):
        """3. Báo lỗi ở 1 bước tiền xử lý không làm crash pipeline, vẫn trả về kết quả an toàn"""
        img = self._create_sample_text_image()

        # Mock ném exception ở bước Orientation & Skew
        with patch.object(self.ocr_service, "detect_and_correct_orientation", side_effect=Exception("OSD failure")), \
             patch.object(self.ocr_service, "detect_and_correct_skew", side_effect=Exception("Skew failure")):

            processed_img, meta = self.ocr_service.preprocess_image(img)

            # Pipeline vẫn hoàn thành mượt mà, fallback về ảnh gốc mà không nổ lỗi
            self.assertIsNotNone(processed_img)
            self.assertFalse(meta["is_blank"])

    def test_enhance_image(self):
        """4. Kiểm tra riêng bước Image Enhancement"""
        img = self._create_sample_text_image()
        enhanced = self.ocr_service.enhance_image(img)
        self.assertIsNotNone(enhanced)
        # Chuyển về thang độ xám 'L'
        self.assertEqual(enhanced.mode, "L")


if __name__ == "__main__":
    unittest.main()

