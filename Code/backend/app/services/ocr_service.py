import os
import shutil
from pathlib import Path
from typing import Any
from PIL import Image
import pytesseract
try:
    import pypdfium2 as pdfium
except ImportError:
    pdfium = None

from app.core.config import settings
from app.core.logger import logger


class OCRService:
    def __init__(self, default_lang: str = "vie+eng"):
        self.default_lang = default_lang
        self._init_tesseract_path()

    def _init_tesseract_path(self) -> None:
        if settings.TESSERACT_CMD and os.path.exists(settings.TESSERACT_CMD):
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
            return

        detected = shutil.which("tesseract")
        if detected:
            pytesseract.pytesseract.tesseract_cmd = detected
            return

        common_paths = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            os.path.join(os.environ.get("LOCALAPPDATA", ""), r"Programs\Tesseract-OCR\tesseract.exe"),
        ]
        for path in common_paths:
            if os.path.exists(path):
                pytesseract.pytesseract.tesseract_cmd = path
                return

    def is_available(self) -> bool:
        cmd = getattr(pytesseract.pytesseract, "tesseract_cmd", "tesseract")
        return bool(shutil.which(cmd) or os.path.exists(cmd))

    def is_blank_page(
        self,
        image_input: Path | str | Image.Image,
        content_ratio_threshold: float = 0.0005,
        dark_pixel_threshold: int = 240,
    ) -> bool:
        """
        Phát hiện trang scan/ảnh trống bằng Pillow dựa trên tỷ lệ mật độ pixel nội dung.
        - Chuyển ảnh về Grayscale ('L').
        - Đếm số lượng pixel tối (< dark_pixel_threshold).
        - Nếu tỷ lệ pixel tối / tổng số pixel < content_ratio_threshold -> Trang trống (True).
        """
        try:
            if isinstance(image_input, (str, Path)):
                img = Image.open(image_input)
            elif isinstance(image_input, Image.Image):
                img = image_input
            else:
                return False

            gray_img = img.convert("L")
            width, height = gray_img.size
            total_pixels = width * height
            if total_pixels == 0:
                return True

            histogram = gray_img.histogram()
            dark_pixels = sum(histogram[:dark_pixel_threshold])
            content_ratio = dark_pixels / total_pixels

            return content_ratio < content_ratio_threshold
        except Exception as e:
            logger.error(f"[OCR] Error detecting blank page: {e}")
            return False

    def detect_and_correct_orientation(
        self,
        image_input: Path | str | Image.Image,
    ) -> tuple[Image.Image, int]:
        """
        Nhận diện hướng trang sử dụng Tesseract OSD (pytesseract.image_to_osd)
        và tự động xoay ảnh về hướng chuẩn 0° bằng Pillow.

        Trả về:
            (ảnh_đã_xoay_chuẩn, góc_xoay_đã_hiệu_chỉnh)
            Nếu trang đã đúng hướng hoặc không xác định được: trả về (ảnh_gốc, 0)
        """
        if isinstance(image_input, (str, Path)):
            img = Image.open(image_input)
        elif isinstance(image_input, Image.Image):
            img = image_input
        else:
            return image_input, 0

        if not self.is_available():
            return img, 0

        try:
            osd_data = pytesseract.image_to_osd(img, output_type=pytesseract.Output.DICT)
            rotate_angle = osd_data.get("rotate", 0)

            # Tesseract OSD báo góc cần xoay (thường là 0, 90, 180, 270)
            if rotate_angle in (90, 180, 270):
                logger.info(f"[OCR] Correcting image orientation by rotating {360 - rotate_angle}° (OSD rotate: {rotate_angle}°)")
                # Pillow rotate nhận góc ngược chiều kim đồng hồ (counter-clockwise).
                # Nếu OSD rotate = 90 (nghĩa là ảnh bị xoay 90 độ xuôi kim đồng hồ),
                # để đưa về 0 ta cần xoay (360 - 90) = 270 độ hoặc img.rotate(-rotate_angle, expand=True)
                corrected_img = img.rotate(360 - rotate_angle, expand=True)
                return corrected_img, rotate_angle
            return img, 0
        except Exception as e:
            logger.debug(f"[OCR] OSD could not determine orientation (keeping original): {e}")
            return img, 0

    def extract_text_from_image(
        self,
        image_input: Path | str | Image.Image,
        lang: str | None = None,
        auto_rotate: bool = True,
    ) -> str:
        if not self.is_available():
            logger.warning("[OCR] Tesseract OCR is not installed or configured on the system.")
            return ""

        target_lang = lang or self.default_lang
        try:
            if isinstance(image_input, (str, Path)):
                img = Image.open(image_input)
            else:
                img = image_input

            if auto_rotate:
                img, _ = self.detect_and_correct_orientation(img)

            text = pytesseract.image_to_string(img, lang=target_lang)
            return text.strip()
        except pytesseract.TesseractNotFoundError:
            logger.warning("[OCR] Tesseract binary not found.")
            return ""
        except Exception as e:
            logger.error(f"[OCR] Error during image recognition: {e}")
            return ""

    def extract_text_from_scanned_pdf(
        self,
        pdf_path: Path | str,
        lang: str | None = None,
        max_pages: int = 50,
        render_scale: float = 2.0,
    ) -> dict[str, Any]:
        if not self.is_available():
            return {
                "success": False,
                "text": "",
                "page_count": 0,
                "error": "Máy chủ chưa cài đặt công cụ Tesseract OCR.",
            }

        target_lang = lang or self.default_lang
        pages_text: list[str] = []

        try:
            doc = pdfium.PdfDocument(str(pdf_path))
            total_pages = min(len(doc), max_pages)

            for i in range(total_pages):
                page = doc.get_page(i)
                pil_image = page.render(scale=render_scale).to_pil()

                # Kiểm tra trang trống trước khi thực hiện OCR tốn tài nguyên
                if self.is_blank_page(pil_image):
                    logger.info(f"[OCR] Page {i + 1} is detected as blank. Skipping OCR.")
                    continue

                # Nhận diện và tự động xoay trang về hướng chuẩn 0 độ
                corrected_image, angle = self.detect_and_correct_orientation(pil_image)

                page_text = self.extract_text_from_image(corrected_image, lang=target_lang, auto_rotate=False)
                if page_text:
                    pages_text.append(page_text)

            full_text = "\n\n".join(pages_text)
            return {
                "success": True,
                "text": full_text,
                "page_count": total_pages,
                "error": None,
            }
        except Exception as e:
            logger.error(f"[OCR] Error processing scanned PDF: {e}")
            return {
                "success": False,
                "text": "",
                "page_count": 0,
                "error": f"Lỗi nhận dạng PDF: {e}",
            }
