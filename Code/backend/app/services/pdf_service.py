import re
from pathlib import Path
from typing import Any
import pypdf


class PDFService:
    def __init__(self):
        pass

    def validate_pdf(self, file_path: Path | str) -> dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            return {"is_valid": False, "is_encrypted": False, "page_count": 0, "error": "Tệp không tồn tại."}

        try:
            reader = pypdf.PdfReader(str(path))
            if reader.is_encrypted:
                return {
                    "is_valid": False,
                    "is_encrypted": True,
                    "page_count": len(reader.pages),
                    "error": "Tệp PDF có mật khẩu bảo vệ.",
                }
            return {
                "is_valid": True,
                "is_encrypted": False,
                "page_count": len(reader.pages),
                "error": None,
            }
        except Exception as e:
            return {"is_valid": False, "is_encrypted": False, "page_count": 0, "error": f"Lỗi đọc tệp PDF: {e}"}

    def get_page_count(self, file_path: Path | str) -> int:
        reader = pypdf.PdfReader(str(file_path))
        return len(reader.pages)

    def extract_text(self, file_path: Path | str) -> str:
        reader = pypdf.PdfReader(str(file_path))
        page_texts: list[str] = []

        for page in reader.pages:
            raw_text = page.extract_text() or ""
            cleaned = self._clean_whitespace(raw_text)
            if cleaned:
                page_texts.append(cleaned)

        return "\n\n".join(page_texts)

    def extract_pages(self, file_path: Path | str) -> list[dict[str, Any]]:
        reader = pypdf.PdfReader(str(file_path))
        pages_data: list[dict[str, Any]] = []

        for idx, page in enumerate(reader.pages):
            raw_text = page.extract_text() or ""
            cleaned = self._clean_whitespace(raw_text)
            pages_data.append({
                "page": idx + 1,
                "text": cleaned,
                "char_count": len(cleaned),
                "has_text": len(cleaned) > 0,
            })

        return pages_data

    def is_scanned_pdf(self, file_path: Path | str, threshold_chars: int = 25) -> bool:
        pages = self.extract_pages(file_path)
        if not pages:
            return True

        total_chars = sum(p["char_count"] for p in pages)
        avg_chars = total_chars / len(pages)
        return avg_chars < threshold_chars

    @staticmethod
    def _clean_whitespace(text: str) -> str:
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()
