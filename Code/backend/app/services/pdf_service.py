import re
import statistics
from pathlib import Path
from typing import Any
import pdfplumber
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

    def extract_text(self, file_path: Path | str, max_pages: int | None = None) -> str:
        pages_data = self.extract_pages(file_path, max_pages=max_pages)
        return "\n\n".join(p["text"] for p in pages_data if p["text"])

    def extract_pages(self, file_path: Path | str, max_pages: int | None = None) -> list[dict[str, Any]]:
        path = Path(file_path)
        pages_data: list[dict[str, Any]] = []

        try:
            with pdfplumber.open(str(path)) as pdf:
                pages = pdf.pages[:max_pages] if max_pages is not None else pdf.pages
                for idx, page in enumerate(pages):
                    raw_text = self._extract_page_smart_layout(page)
                    cleaned = self._clean_whitespace(raw_text)
                    pages_data.append({
                        "page": idx + 1,
                        "text": cleaned,
                        "char_count": len(cleaned),
                        "has_text": len(cleaned) > 0,
                    })
                return pages_data
        except Exception:
            # Fallback to pypdf in case pdfplumber fails
            reader = pypdf.PdfReader(str(path))
            pages = reader.pages[:max_pages] if max_pages is not None else reader.pages
            for idx, page in enumerate(pages):
                raw_text = page.extract_text() or ""
                cleaned = self._clean_whitespace(raw_text)
                pages_data.append({
                    "page": idx + 1,
                    "text": cleaned,
                    "char_count": len(cleaned),
                    "has_text": len(cleaned) > 0,
                })
            return pages_data

    def _extract_page_smart_layout(self, page: Any, y_tolerance: float = 3.5, min_gutter_gap: float = 20.0) -> str:
        """Extract text maintaining natural reading order for multi-column documents."""
        try:
            words = page.extract_words(keep_blank_chars=False, use_text_flow=False)
            if not words:
                return page.extract_text() or ""

            # Sort words by top (y) coordinate then left (x0)
            words.sort(key=lambda w: (w["top"], w["x0"]))

            # Group words into horizontal lines
            lines: list[list[dict[str, Any]]] = []
            current_line: list[dict[str, Any]] = []
            current_top: float | None = None

            for w in words:
                if current_top is None:
                    current_top = w["top"]
                    current_line.append(w)
                elif abs(w["top"] - current_top) <= y_tolerance:
                    current_line.append(w)
                else:
                    lines.append(sorted(current_line, key=lambda x: x["x0"]))
                    current_line = [w]
                    current_top = w["top"]
            if current_line:
                lines.append(sorted(current_line, key=lambda x: x["x0"]))

            # Detect column gutter candidates (large horizontal gaps between words on the same line)
            gutter_candidates: list[dict[str, Any]] = []
            for line in lines:
                for i in range(len(line) - 1):
                    w1 = line[i]
                    w2 = line[i + 1]
                    gap = w2["x0"] - w1["x1"]
                    if gap >= min_gutter_gap:
                        gutter_candidates.append({
                            "left": w1["x1"],
                            "right": w2["x0"],
                            "center": (w1["x1"] + w2["x0"]) / 2.0,
                            "gap": gap,
                        })

            # If fewer than 2 distinct lines have gutter gaps, treat as single-column layout
            if len(gutter_candidates) < 2:
                return "\n".join(" ".join(w["text"] for w in line) for line in lines)

            gutter_centers = [g["center"] for g in gutter_candidates]
            split_x = statistics.median(gutter_centers)
            near_gutters = [g for g in gutter_candidates if abs(g["center"] - split_x) <= 35.0]
            if len(near_gutters) < 2:
                return "\n".join(" ".join(w["text"] for w in line) for line in lines)

            # Classify lines into sections: spanning header/footers vs multi-column sections
            sections: list[dict[str, Any]] = []

            def get_or_create_col_section() -> dict[str, Any]:
                if not sections or sections[-1]["type"] != "columns":
                    sections.append({"type": "columns", "left": [], "right": []})
                return sections[-1]

            for line in lines:
                line_min_x = line[0]["x0"]
                line_max_x = line[-1]["x1"]

                # Check if there is an explicit gutter gap around split_x
                split_idx = -1
                for i in range(len(line) - 1):
                    w1 = line[i]
                    w2 = line[i + 1]
                    if w1["x1"] <= split_x <= w2["x0"] and (w2["x0"] - w1["x1"]) >= min_gutter_gap:
                        split_idx = i
                        break

                if split_idx != -1:
                    left_text = " ".join(w["text"] for w in line[:split_idx + 1]).strip()
                    right_text = " ".join(w["text"] for w in line[split_idx + 1:]).strip()
                    col_sec = get_or_create_col_section()
                    if left_text:
                        col_sec["left"].append(left_text)
                    if right_text:
                        col_sec["right"].append(right_text)
                elif line_max_x <= split_x + 5.0:
                    text = " ".join(w["text"] for w in line).strip()
                    if text:
                        col_sec = get_or_create_col_section()
                        col_sec["left"].append(text)
                elif line_min_x >= split_x - 5.0:
                    text = " ".join(w["text"] for w in line).strip()
                    if text:
                        col_sec = get_or_create_col_section()
                        col_sec["right"].append(text)
                else:
                    # Spanning across split_x without a gutter gap (e.g. Title, Abstract, Footer)
                    text = " ".join(w["text"] for w in line).strip()
                    if text:
                        sections.append({"type": "spanning", "lines": [text]})

            # Assemble natural reading order
            blocks: list[str] = []
            for sec in sections:
                if sec["type"] == "spanning":
                    blocks.extend(sec["lines"])
                elif sec["type"] == "columns":
                    blocks.extend(sec["left"])
                    blocks.extend(sec["right"])

            return "\n".join(blocks)
        except Exception:
            return page.extract_text() or ""

    def is_scanned_pdf(self, file_path: Path | str, threshold_chars: int = 25, max_pages: int | None = None) -> bool:
        pages = self.extract_pages(file_path, max_pages=max_pages)
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
