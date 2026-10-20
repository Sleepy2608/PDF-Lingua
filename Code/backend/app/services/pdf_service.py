"""PDF Service - Handles parsing, text extraction, and page inspection."""

from pathlib import Path
from typing import Optional


class PDFService:
    def __init__(self):
        pass

    async def extract_text(self, file_path: Path) -> str:
        """Extract plain text directly from a digital PDF file."""
        # TODO: Implement PDF text extraction using pypdf or pdfplumber
        raise NotImplementedError("PDF text extraction is not yet implemented.")

    async def get_page_count(self, file_path: Path) -> int:
        """Return the total number of pages in the PDF."""
        # TODO: Implement page counting
        raise NotImplementedError("Page counting is not yet implemented.")
