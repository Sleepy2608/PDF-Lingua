import re
import statistics
from pathlib import Path
from typing import Any
try:
    import pdfplumber
except ImportError:
    pdfplumber = None
import pypdf
from PIL import Image


class PDFService:
    def __init__(self):
        pass

    def is_blank_page(
        self,
        image_or_page: Any,
        content_ratio_threshold: float = 0.0005,
        dark_pixel_threshold: int = 240,
    ) -> bool:
        """
        Phát hiện trang PDF trống dựa trên mật độ pixel bằng Pillow.
        - Chuyển ảnh về Grayscale ('L').
        - Đếm số lượng pixel tối (< dark_pixel_threshold).
        - Nếu tỷ lệ pixel tối / tổng số pixel < content_ratio_threshold -> Trang trống (True).
        """
        try:
            if isinstance(image_or_page, Image.Image):
                img = image_or_page
            elif hasattr(image_or_page, "to_image"):
                # Đối tượng Page của pdfplumber
                img = image_or_page.to_image(resolution=72).original
            else:
                return False

            gray_img = img.convert("L")
            width, height = gray_img.size
            total_pixels = width * height
            if total_pixels == 0:
                return True

            # Lấy histogram: mảng 256 phần tử biểu thị số lượng pixel cho từng giá trị mức xám (0-255)
            histogram = gray_img.histogram()
            # Ký tự / nét vẽ có mức xám nhỏ hơn dark_pixel_threshold (mặc định 240)
            dark_pixels = sum(histogram[:dark_pixel_threshold])

            content_ratio = dark_pixels / total_pixels
            return content_ratio < content_ratio_threshold
        except Exception:
            return False

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

                    # Kiểm tra trang trống nếu không trích xuất được text chữ gốc
                    is_blank = False
                    if not cleaned:
                        is_blank = self.is_blank_page(page)

                    pages_data.append({
                        "page": idx + 1,
                        "text": cleaned,
                        "char_count": len(cleaned),
                        "has_text": len(cleaned) > 0,
                        "is_blank": is_blank,
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
                    "is_blank": len(cleaned) == 0,
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

    def classify_page(
        self,
        page_or_text: Any,
        threshold_chars: int = 30,
        unreliable_ratio_threshold: float = 0.3,
    ) -> str:
        """
        Phân loại loại trang:
        - 'digital': nếu có text layer rõ ràng, độ dài text >= threshold_chars
          và tỷ lệ ký tự không đọc được (replacement / control chars) thấp.
        - 'scanned': nếu không có text layer hoặc text quá ít / không đáng tin cậy.
        """
        if isinstance(page_or_text, str):
            text = self._clean_whitespace(page_or_text)
        elif hasattr(page_or_text, "extract_text"):
            try:
                raw = page_or_text.extract_text() or ""
                text = self._clean_whitespace(raw)
            except Exception:
                text = ""
        else:
            text = ""

        if len(text) < threshold_chars:
            return "scanned"

        # Kiểm tra tính đáng tin cậy: nếu chứa quá nhiều ký tự vô nghĩa / unicode replacement
        unreliable_chars = sum(1 for c in text if c in ("\ufffd", "?") or (ord(c) < 32 and c not in ("\n", "\t", "\r")))
        if unreliable_chars / len(text) > unreliable_ratio_threshold:
            return "scanned"

        return "digital"

    def classify_document(
        self,
        file_path: Path | str,
        threshold_chars: int = 30,
        max_pages: int | None = None,
    ) -> dict[str, Any]:
        """
        Tự động phân loại tài liệu PDF:
        - 'digital': tất cả các trang đều là digital.
        - 'scanned': tất cả các trang đều là scanned.
        - 'mixed': tài liệu chứa cả trang digital và trang scanned.
        Trả về metadata chi tiết từng trang.
        """
        path = Path(file_path)
        pages_classification: list[dict[str, Any]] = []

        reader = pypdf.PdfReader(str(path))
        pages = reader.pages[:max_pages] if max_pages is not None else reader.pages

        digital_count = 0
        scanned_count = 0

        for idx, page in enumerate(pages):
            try:
                raw_text = page.extract_text() or ""
                cleaned = self._clean_whitespace(raw_text)
                ptype = self.classify_page(cleaned, threshold_chars=threshold_chars)
            except Exception:
                ptype = "scanned"
                cleaned = ""

            if ptype == "digital":
                digital_count += 1
            else:
                scanned_count += 1

            pages_classification.append({
                "page": idx + 1,
                "type": ptype,
                "char_count": len(cleaned),
                "has_text": len(cleaned) > 0,
            })

        total = len(pages)
        if total == 0 or scanned_count == total:
            doc_type = "scanned"
        elif digital_count == total:
            doc_type = "digital"
        else:
            doc_type = "mixed"

        return {
            "document_type": doc_type,
            "total_pages": total,
            "digital_pages": digital_count,
            "scanned_pages": scanned_count,
            "pages": pages_classification,
        }

    def is_scanned_pdf(self, file_path: Path | str, threshold_chars: int = 25, max_pages: int | None = None) -> bool:
        pages = self.extract_pages(file_path, max_pages=max_pages)
        if not pages:
            return True

        total_chars = sum(p["char_count"] for p in pages)
        avg_chars = total_chars / len(pages)
        return avg_chars < threshold_chars

    def extract_hybrid_fast_path(
        self,
        file_path: Path | str,
        ocr_service: Any = None,
        max_pages: int | None = None,
        threshold_chars: int = 30,
    ) -> dict[str, Any]:
        """
        Cơ chế Hybrid Fast Path:
        Tự động phân loại từng trang PDF (digital/scanned/mixed).
        - Trang Digital: trích xuất nhanh trực tiếp bằng PDFService layout, KHÔNG render ảnh hay chạy Tesseract.
        - Trang Scanned: chỉ chạy OCRService và preprocessing pipeline cho các trang này.
        - Giữ nguyên số trang và thứ tự trang chính xác.
        - Có cơ chế Fallback an toàn nếu extraction trang digital thất bại.
        """
        path = Path(file_path)
        if not path.exists():
            return {
                "document_type": "error",
                "text": "",
                "page_count": 0,
                "pages": [],
                "fast_path_used": False,
                "ocr_pages_count": 0,
                "error": "Tệp không tồn tại.",
            }

        pages_result: list[dict[str, Any]] = []

        # Phân loại toàn bộ tài liệu
        classification = self.classify_document(path, threshold_chars=threshold_chars, max_pages=max_pages)
        doc_type = classification["document_type"]

        # 1. Nếu toàn bộ là Digital: trích xuất nhanh 100% bằng Fast Path
        if doc_type == "digital":
            pages_data = self.extract_pages(path, max_pages=max_pages)
            full_text = "\n\n".join(p["text"] for p in pages_data if p["text"])
            return {
                "document_type": "digital",
                "text": full_text,
                "page_count": len(pages_data),
                "pages": pages_data,
                "fast_path_used": True,
                "ocr_pages_count": 0,
            }

        # 2. Nếu là Scanned hoặc Mixed: xử lý riêng từng trang
        try:
            pages_extracted = self.extract_pages(path, max_pages=max_pages)
            ocr_count = 0

            for idx, p_info in enumerate(pages_extracted):
                cleaned = p_info["text"]
                page_type = self.classify_page(cleaned, threshold_chars=threshold_chars)

                # TRANG DIGITAL: Fast Path
                if page_type == "digital" and cleaned.strip():
                    pages_result.append({
                        "page": idx + 1,
                        "text": cleaned,
                        "type": "digital",
                        "is_ocr_used": False,
                        "is_blank": False,
                    })
                else:
                    # TRANG SCANNED / FALLBACK: Gọi OCRService cho trang này
                    ocr_count += 1
                    ocr_text = ""
                    is_blank = False

                    if ocr_service and getattr(ocr_service, "is_available", lambda: False)():
                        try:
                            import io
                            import pymupdf
                            doc_fitz = pymupdf.open(str(path))
                            fitz_page = doc_fitz.load_page(idx)
                            pix = fitz_page.get_pixmap(dpi=150)
                            pil_img = Image.open(io.BytesIO(pix.tobytes("png")))
                            doc_fitz.close()

                            # Chạy pipeline tiền xử lý và OCR 1 lần duy nhất cho trang scanned
                            proc_img, meta = ocr_service.preprocess_image(
                                pil_img,
                                check_blank=True,
                                auto_rotate=True,
                                auto_deskew=True,
                                auto_enhance=True,
                            )
                            if meta.get("is_blank", False):
                                is_blank = True
                            else:
                                ocr_text = ocr_service.extract_text_from_image(proc_img, preprocess=False)
                        except Exception:
                            ocr_text = cleaned

                    pages_result.append({
                        "page": idx + 1,
                        "text": ocr_text,
                        "type": "scanned",
                        "is_ocr_used": True,
                        "is_blank": is_blank,
                    })

            full_text = "\n\n".join(p["text"] for p in pages_result if p["text"])
            return {
                "document_type": doc_type,
                "text": full_text,
                "page_count": len(pages_result),
                "pages": pages_result,
                "fast_path_used": doc_type != "scanned",
                "ocr_pages_count": ocr_count,
            }
        except Exception:
            pages_data = self.extract_pages(path, max_pages=max_pages)
            full_text = "\n\n".join(p["text"] for p in pages_data if p["text"])
            return {
                "document_type": "fallback",
                "text": full_text,
                "page_count": len(pages_data),
                "pages": pages_data,
                "fast_path_used": True,
                "ocr_pages_count": 0,
            }

    @staticmethod
    def _clean_whitespace(text: str) -> str:
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()
