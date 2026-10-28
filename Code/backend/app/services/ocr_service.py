import os
import shutil
from pathlib import Path
from typing import Any
from PIL import Image
import pytesseract
import pypdfium2 as pdfium

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

    def extract_text_from_image(self, image_input: Path | str | Image.Image, lang: str | None = None) -> str:
        if not self.is_available():
            logger.warning("[OCR] Tesseract OCR is not installed or configured on the system.")
            return ""

        target_lang = lang or self.default_lang
        try:
            if isinstance(image_input, (str, Path)):
                img = Image.open(image_input)
            else:
                img = image_input

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
                page_text = self.extract_text_from_image(pil_image, lang=target_lang)
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
