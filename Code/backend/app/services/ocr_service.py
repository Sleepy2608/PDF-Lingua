"""OCR Service - Handles optical character recognition for scanned PDFs and images."""

from pathlib import Path
from typing import Optional


class OCRService:
    def __init__(self, default_lang: str = "vie+eng"):
        self.default_lang = default_lang

    async def extract_text_from_image(self, image_path: Path, lang: Optional[str] = None) -> str:
        """Run OCR on an image file and return recognized text."""
        # TODO: Implement OCR using pytesseract / EasyOCR
        raise NotImplementedError("Image OCR is not yet implemented.")

    async def extract_text_from_scanned_pdf(self, pdf_path: Path, lang: Optional[str] = None) -> str:
        """Convert scanned PDF pages to images and perform OCR."""
        # TODO: Implement scanned PDF OCR pipeline
        raise NotImplementedError("Scanned PDF OCR is not yet implemented.")
