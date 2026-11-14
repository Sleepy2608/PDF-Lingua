import os
import re
import statistics
import urllib.parse
from pathlib import Path
from typing import Any, Callable, Optional
try:
    import pdfplumber
except ImportError:
    pdfplumber = None
import pypdf
from PIL import Image


def parse_page_selection(pages_str: Optional[str], total_pages: int) -> list[int]:
    """
    Parse chuỗi lựa chọn trang PDF thành danh sách các index trang (0-based) đã sắp xếp và không trùng lặp (PDFL-255.1).

    Cú pháp hỗ trợ:
    - Trang đơn: '1', '5'
    - Khoảng trang: '1-3' (bao gồm cả trang 1, 2, 3)
    - Danh sách kết hợp: '2, 4, 6', '1-2, 5', '1, 3-5, 8'
    - Toàn bộ trang: None, '', '   ', 'all', 'ALL' -> trả về list(range(total_pages))

    Quy tắc & Xử lý lỗi:
    - Chuyển đổi số trang người dùng nhập (1-based) thành index (0-based).
    - Loại bỏ trang trùng lặp và sắp xếp tăng dần.
    - Ném ValueError trong các trường hợp:
      + total_pages < 1 hoặc không phải kiểu số nguyên
      + Cú pháp sai: chứa ký tự không hợp lệ ('abc', '1a'), dải trang thiếu đầu/cuối ('1-', '-3', '1-2-3'), dấu phẩy thừa (',,', '1,,2')
      + Số trang nhỏ hơn 1 (ví dụ: '0', '-2')
      + Khoảng trang ngược (ví dụ: '5-1', '10-3')
      + Số trang vượt quá total_pages (ví dụ: '10' khi total_pages=5, hoặc '2-8' khi total_pages=5)
    """
    if isinstance(total_pages, bool) or not isinstance(total_pages, int) or total_pages < 1:
        raise ValueError("Tổng số trang của tài liệu không hợp lệ.")

    if pages_str is None:
        return list(range(total_pages))

    clean_str = pages_str.strip()
    if not clean_str or clean_str.lower() == "all":
        return list(range(total_pages))

    # Chặn dấu phẩy ở đầu, cuối hoặc liên tiếp
    raw_tokens = [tok.strip() for tok in clean_str.split(",")]
    if any(not tok for tok in raw_tokens):
        raise ValueError(f"Cú pháp khoảng trang không hợp lệ: '{clean_str}'.")

    selected_indices: set[int] = set()

    for token in raw_tokens:
        if "-" in token:
            parts = token.split("-")
            if len(parts) != 2 or not parts[0].strip() or not parts[1].strip():
                raise ValueError(f"Cú pháp khoảng trang không hợp lệ: '{token}'.")

            start_part, end_part = parts[0].strip(), parts[1].strip()
            if not start_part.isdigit() or not end_part.isdigit():
                raise ValueError(f"Khoảng trang phải là số nguyên dương: '{token}'.")

            start = int(start_part)
            end = int(end_part)

            if start < 1:
                raise ValueError(f"Số trang phải lớn hơn hoặc bằng 1 (nhận được {start}).")
            if end < 1:
                raise ValueError(f"Số trang phải lớn hơn hoặc bằng 1 (nhận được {end}).")
            if start > end:
                raise ValueError(f"Khoảng trang ngược không hợp lệ: '{start}-{end}'.")
            if end > total_pages:
                raise ValueError(f"Trang {end} vượt quá tổng số trang của tài liệu ({total_pages}).")
            if start > total_pages:
                raise ValueError(f"Trang {start} vượt quá tổng số trang của tài liệu ({total_pages}).")

            for p in range(start, end + 1):
                selected_indices.add(p - 1)
        else:
            if not token.isdigit():
                raise ValueError(f"Số trang không hợp lệ: '{token}'.")

            p = int(token)
            if p < 1:
                raise ValueError(f"Số trang phải lớn hơn hoặc bằng 1 (nhận được {p}).")
            if p > total_pages:
                raise ValueError(f"Trang {p} vượt quá tổng số trang của tài liệu ({total_pages}).")

            selected_indices.add(p - 1)

    if not selected_indices:
        raise ValueError("Không có trang nào được chọn.")

    return sorted(selected_indices)


class PDFService:
    def __init__(self):
        pass

    @staticmethod
    def parse_page_selection(pages_str: Optional[str], total_pages: int) -> list[int]:
        """PDFL-255.1: Phân tích cú pháp lựa chọn dải trang."""
        return parse_page_selection(pages_str, total_pages)

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

    def validate_filename(self, filename: Optional[str]) -> tuple[bool, Optional[str]]:
        """
        Kiểm tra tính hợp lệ của tên tệp PDF (PDFL-214.1):
        - Bắt buộc phải có tên tệp và có phần mở rộng .pdf (không phân biệt hoa thường).
        - Chặn null byte (\x00, \0) và các ký tự điều khiển.
        - Chặn double extension (ví dụ: file.php.pdf, malicious.exe.pdf, test.txt.pdf, doc.pdf.pdf).
        - Chặn tên tệp không hợp lệ (tên tệp rỗng, chỉ có .pdf, hoặc chỉ có khoảng trắng).
        """
        if not filename or not isinstance(filename, str):
            return False, "Tên tệp không được để trống."

        # Chặn null byte (kể cả URL-encoded %00)
        unquoted = urllib.parse.unquote(filename)
        if "\x00" in filename or "\0" in filename or "\x00" in unquoted or "%00" in filename.lower():
            return False, "Tên tệp không hợp lệ (chứa null byte)."

        # Chặn ký tự điều khiển (cả raw và unquoted)
        if re.search(r"[\x00-\x1f\x7f]", filename) or re.search(r"[\x00-\x1f\x7f]", unquoted):
            return False, "Tên tệp không hợp lệ (chứa ký tự điều khiển)."

        clean_name = filename.strip()
        if not clean_name:
            return False, "Tên tệp không được để trống."

        basename = os.path.basename(clean_name)
        if not basename:
            return False, "Tên tệp không được để trống."

        # Phải kết thúc bằng .pdf (không phân biệt hoa thường)
        if not basename.lower().endswith(".pdf"):
            return False, "Tệp tải lên phải có định dạng .pdf."

        stem = basename[:-4].strip()
        # Tên gốc trước .pdf không được rỗng hoặc chỉ có dấu chấm
        if not stem or stem.strip(".") == "":
            return False, "Tên tệp không hợp lệ (thiếu phần tên chính trước .pdf)."

        # Chặn double extension: stem không được chứa dấu chấm '.'
        # (Ví dụ: shell.php.pdf, file.exe.pdf, test.txt.pdf, doc.pdf.pdf)
        if "." in stem:
            return False, "Tên tệp không hợp lệ (không cho phép double extension)."

        return True, None

    def validate_content_type(self, content_type: Optional[str]) -> tuple[bool, Optional[str]]:
        """
        Kiểm tra Content-Type của tệp tải lên (PDFL-214.1):
        Bắt buộc phải là application/pdf (không phân biệt hoa thường).
        """
        if not content_type or not isinstance(content_type, str):
            return False, "Content-Type không hợp lệ, yêu cầu application/pdf."

        raw = content_type.strip().lower()
        media_type = raw.split(";")[0].strip()
        if media_type != "application/pdf":
            return False, "Content-Type không hợp lệ, yêu cầu application/pdf."

        return True, None

    def validate_raw_pdf_content(self, content: bytes) -> tuple[bool, Optional[str]]:
        """
        Kiểm tra dữ liệu nhị phân thô của tệp PDF (PDFL-214.1):
        - Không được là tệp rỗng (0 bytes).
        - Bắt buộc phải có Magic Bytes bắt đầu bằng %PDF-1.
        """
        if not content or len(content) == 0:
            return False, "Tệp rỗng hoặc không có dữ liệu."

        if not content.startswith(b"%PDF-1."):
            return False, "Tệp không phải là tài liệu PDF hợp lệ (sai Magic Bytes)."

        return True, None

    def validate_upload(
        self,
        filename: Optional[str],
        content_type: Optional[str],
        content: bytes,
    ) -> tuple[bool, Optional[str]]:
        """
        Harden PDF upload validation toàn diện (PDFL-214.1).
        Kiểm tra đồng thời filename, content-type, magic bytes và dung lượng thô.
        """
        valid_name, err_name = self.validate_filename(filename)
        if not valid_name:
            return False, err_name

        valid_ct, err_ct = self.validate_content_type(content_type)
        if not valid_ct:
            return False, err_ct

        valid_content, err_content = self.validate_raw_pdf_content(content)
        if not valid_content:
            return False, err_content

        return True, None

    def validate_pdf(self, file_path: Path | str) -> dict[str, Any]:
        """
        Kiểm tra tính hợp lệ của tệp PDF và xác định số trang từ catalog/metadata.
        Tránh nạp hoặc render toàn bộ trang nhằm tối ưu hiệu năng và bộ nhớ.
        Xử lý an toàn:
        - Tệp không tồn tại
        - Tệp rỗng (0 bytes)
        - Tệp hỏng hoặc không phải PDF
        - Tệp có mật khẩu bảo vệ
        - Tệp có page_count <= 0
        """
        path = Path(file_path)
        if not path.exists():
            return {
                "is_valid": False,
                "is_encrypted": False,
                "page_count": 0,
                "error": "Tệp không tồn tại.",
            }

        try:
            if not path.is_file() or path.stat().st_size == 0:
                return {
                    "is_valid": False,
                    "is_encrypted": False,
                    "page_count": 0,
                    "error": "Tệp rỗng hoặc không phải tệp tin hợp lệ.",
                }
        except Exception as stat_err:
            return {
                "is_valid": False,
                "is_encrypted": False,
                "page_count": 0,
                "error": f"Lỗi truy cập tệp tin: {stat_err}",
            }

        try:
            with open(path, "rb") as f:
                header = f.read(8)
                if not header.startswith(b"%PDF-1."):
                    return {
                        "is_valid": False,
                        "is_encrypted": False,
                        "page_count": 0,
                        "error": "Tệp không phải là tài liệu PDF hợp lệ (sai Magic Bytes).",
                    }
        except Exception as read_err:
            return {
                "is_valid": False,
                "is_encrypted": False,
                "page_count": 0,
                "error": f"Lỗi đọc tệp tin: {read_err}",
            }

        try:
            reader = pypdf.PdfReader(str(path))
            if reader.is_encrypted:
                page_count = 0
                try:
                    page_count = len(reader.pages)
                except Exception:
                    page_count = 0
                return {
                    "is_valid": False,
                    "is_encrypted": True,
                    "page_count": page_count,
                    "error": "Tệp PDF có mật khẩu bảo vệ.",
                }

            page_count = len(reader.pages)
            if page_count <= 0:
                return {
                    "is_valid": False,
                    "is_encrypted": False,
                    "page_count": 0,
                    "error": "Tài liệu PDF không có trang nào hợp lệ để xử lý.",
                }

            return {
                "is_valid": True,
                "is_encrypted": False,
                "page_count": page_count,
                "error": None,
            }
        except Exception as e:
            return {
                "is_valid": False,
                "is_encrypted": False,
                "page_count": 0,
                "error": f"Lỗi đọc tệp PDF: {e}",
            }

    def get_page_count(self, file_path: Path | str) -> int:
        """
        Lấy số trang PDF an toàn và nhanh chóng từ catalog/metadata.
        Tránh hoàn toàn việc render hoặc nạp stream nội dung trang.
        Trả về 0 nếu tệp không tồn tại, rỗng, bị hỏng hoặc không có trang nào.
        """
        path = Path(file_path)
        if not path.is_file():
            return 0

        try:
            if path.stat().st_size == 0:
                return 0
            reader = pypdf.PdfReader(str(path))
            if reader.is_encrypted:
                try:
                    return max(0, len(reader.pages))
                except Exception:
                    return 0
            return max(0, len(reader.pages))
        except Exception:
            return 0

    def extract_text(
        self,
        file_path: Path | str,
        max_pages: int | None = None,
        selected_pages: Optional[list[int]] = None,
    ) -> str:
        pages_data = self.extract_pages(file_path, max_pages=max_pages, selected_pages=selected_pages)
        return "\n\n".join(p["text"] for p in pages_data if p["text"])

    def extract_pages(
        self,
        file_path: Path | str,
        max_pages: int | None = None,
        selected_pages: Optional[list[int]] = None,
    ) -> list[dict[str, Any]]:
        path = Path(file_path)
        pages_data: list[dict[str, Any]] = []

        try:
            with pdfplumber.open(str(path)) as pdf:
                total_in_doc = len(pdf.pages)
                if selected_pages is not None:
                    target_indices = [i for i in selected_pages if 0 <= i < total_in_doc]
                else:
                    target_indices = list(range(total_in_doc))

                if max_pages is not None:
                    target_indices = target_indices[:max_pages]

                for idx in target_indices:
                    page = pdf.pages[idx]
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
            total_in_doc = len(reader.pages)
            if selected_pages is not None:
                target_indices = [i for i in selected_pages if 0 <= i < total_in_doc]
            else:
                target_indices = list(range(total_in_doc))

            if max_pages is not None:
                target_indices = target_indices[:max_pages]

            for idx in target_indices:
                page = reader.pages[idx]
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
        selected_pages: Optional[list[int]] = None,
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
        total_in_doc = len(reader.pages)
        if selected_pages is not None:
            target_indices = [i for i in selected_pages if 0 <= i < total_in_doc]
        else:
            target_indices = list(range(total_in_doc))

        if max_pages is not None:
            target_indices = target_indices[:max_pages]

        digital_count = 0
        scanned_count = 0

        for idx in target_indices:
            page = reader.pages[idx]
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

        total = len(target_indices)
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

    def is_scanned_pdf(
        self,
        file_path: Path | str,
        threshold_chars: int = 25,
        max_pages: int | None = None,
        selected_pages: Optional[list[int]] = None,
    ) -> bool:
        pages = self.extract_pages(file_path, max_pages=max_pages, selected_pages=selected_pages)
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
        max_workers: int | None = 2,
        progress_callback: Optional[Any] = None,
        selected_pages: Optional[list[int]] = None,
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

        # Phân loại toàn bộ tài liệu (hoặc các trang được chọn)
        classification = self.classify_document(
            path,
            threshold_chars=threshold_chars,
            max_pages=max_pages,
            selected_pages=selected_pages,
        )
        doc_type = classification["document_type"]
        total_classified = classification["total_pages"]

        if progress_callback is not None:
            try:
                progress_callback(0, total_classified, f"Đã phân loại tài liệu: {doc_type.upper()} ({total_classified} trang)")
            except Exception:
                pass

        # 1. Nếu toàn bộ là Digital: trích xuất nhanh 100% bằng Fast Path
        if doc_type == "digital":
            pages_data = self.extract_pages(path, max_pages=max_pages, selected_pages=selected_pages)
            full_text = "\n\n".join(p["text"] for p in pages_data if p["text"])
            if progress_callback is not None:
                try:
                    progress_callback(len(pages_data), len(pages_data), f"Trích xuất nhanh {len(pages_data)}/{len(pages_data)} trang Digital")
                except Exception:
                    pass
            return {
                "document_type": "digital",
                "text": full_text,
                "page_count": len(pages_data),
                "pages": pages_data,
                "fast_path_used": True,
                "ocr_pages_count": 0,
            }

        # 2. Nếu là Scanned hoặc Mixed: xử lý riêng từng trang theo cơ chế Parallel / Lazy Loading
        doc_fitz = None
        doc_pdfium = None
        try:
            pages_extracted = self.extract_pages(path, max_pages=max_pages, selected_pages=selected_pages)

            # Lọc danh sách trang scanned cần OCR (dùng 0-based document page index thực tế)
            scanned_orig_indices: list[int] = []
            for p_info in pages_extracted:
                cleaned = p_info["text"]
                page_type = self.classify_page(cleaned, threshold_chars=threshold_chars)
                if not (page_type == "digital" and cleaned.strip()):
                    scanned_orig_indices.append(p_info["page"] - 1)

            # 2a. Xử lý song song với isolated workers nếu có >= 2 trang scanned và ocr_service khả dụng
            # Nếu chỉ có 1 trang Scanned, xử lý tuần tự trực tiếp ở bước 2b để tránh overhead tạo thread
            ocr_results_by_idx: dict[int, dict[str, Any]] = {}
            if len(scanned_orig_indices) > 1 and ocr_service and getattr(ocr_service, "is_available", lambda: False)():
                effective_workers = max_workers if (max_workers is not None and max_workers > 1) else 1
                effective_workers = min(effective_workers, 4, len(scanned_orig_indices))

                if effective_workers > 1 and hasattr(ocr_service, "_ocr_single_page_isolated"):
                    try:
                        import concurrent.futures
                        with concurrent.futures.ThreadPoolExecutor(max_workers=effective_workers) as executor:
                            future_to_idx = {
                                executor.submit(
                                    ocr_service._ocr_single_page_isolated,
                                    path,
                                    s_idx,
                                    getattr(ocr_service, "default_lang", "vie+eng"),
                                ): s_idx
                                for s_idx in scanned_orig_indices
                            }
                            for future in concurrent.futures.as_completed(future_to_idx):
                                s_idx = future_to_idx[future]
                                try:
                                    ocr_results_by_idx[s_idx] = future.result()
                                except Exception as e:
                                    ocr_results_by_idx[s_idx] = {"page": s_idx + 1, "text": "", "is_blank": False, "error": str(e)}
                    except Exception:
                        ocr_results_by_idx = {}

            # 2b. Tổng hợp kết quả theo ĐÚNG THỨ TỰ TRANG ĐÃ CHỌN
            ocr_count = 0

            # Mở sẵn doc_pdfium hoặc doc_fitz 1 lần duy nhất cho toàn bộ các trang scanned
            if ocr_service and getattr(ocr_service, "is_available", lambda: False)():
                try:
                    import pypdfium2 as pdfium
                    doc_pdfium = pdfium.PdfDocument(str(path))
                except Exception:
                    doc_pdfium = None

                if doc_pdfium is None:
                    try:
                        import pymupdf
                        doc_fitz = pymupdf.open(str(path))
                    except Exception:
                        doc_fitz = None

            for seq_idx, p_info in enumerate(pages_extracted):
                orig_page_num = p_info["page"]
                orig_idx = orig_page_num - 1
                cleaned = p_info["text"]
                page_type = self.classify_page(cleaned, threshold_chars=threshold_chars)

                # TRANG DIGITAL: Fast Path tức thì, không nạp ảnh
                if page_type == "digital" and cleaned.strip():
                    pages_result.append({
                        "page": orig_page_num,
                        "text": cleaned,
                        "type": "digital",
                        "is_ocr_used": False,
                        "is_blank": False,
                    })
                else:
                    # TRANG SCANNED / FALLBACK: Xử lý ảnh từng trang (Lazy Streaming) & giải phóng RAM ngay
                    ocr_count += 1
                    ocr_text = ""
                    is_blank = False

                    # 1. Tận dụng kết quả từ parallel worker nếu đã có ở 2a
                    if orig_idx in ocr_results_by_idx:
                        res = ocr_results_by_idx[orig_idx]
                        ocr_text = res.get("text", "")
                        is_blank = res.get("is_blank", False)
                    # 2. Nếu chưa có kết quả (ví dụ chỉ có 1 trang scan), gọi _ocr_single_page_isolated
                    elif ocr_service and getattr(ocr_service, "is_available", lambda: False)():
                        if hasattr(ocr_service, "_ocr_single_page_isolated"):
                            try:
                                res = ocr_service._ocr_single_page_isolated(
                                    path,
                                    orig_idx,
                                    getattr(ocr_service, "default_lang", "vie+eng"),
                                )
                                ocr_text = res.get("text", "")
                                is_blank = res.get("is_blank", False)
                            except Exception:
                                ocr_text = ""

                        # 3. Fallback render bằng doc_pdfium hoặc doc_fitz nếu chưa lấy được text
                        if not ocr_text and (doc_pdfium is not None or doc_fitz is not None):
                            pil_img = None
                            try:
                                if doc_pdfium is not None:
                                    pdfium_page = doc_pdfium.get_page(orig_idx)
                                    pil_img = pdfium_page.render(scale=2.0).to_pil()
                                    del pdfium_page
                                elif doc_fitz is not None:
                                    import io
                                    fitz_page = doc_fitz.load_page(orig_idx)
                                    pix = fitz_page.get_pixmap(dpi=150)
                                    raw_bytes = pix.tobytes("png")
                                    del pix
                                    del fitz_page
                                    pil_img = Image.open(io.BytesIO(raw_bytes))

                                if pil_img is not None:
                                    try:
                                        proc_img, meta = ocr_service.preprocess_image(
                                            pil_img,
                                            check_blank=True,
                                            auto_rotate=True,
                                            auto_deskew=True,
                                            auto_enhance=True,
                                        )
                                        try:
                                            if meta.get("is_blank", False):
                                                is_blank = True
                                            else:
                                                ocr_text = ocr_service.extract_text_from_image(proc_img, preprocess=False)
                                        finally:
                                            if proc_img is not pil_img:
                                                try:
                                                    proc_img.close()
                                                except Exception:
                                                    pass
                                            del proc_img
                                    finally:
                                        try:
                                            pil_img.close()
                                        except Exception:
                                            pass
                                        del pil_img
                            except Exception:
                                ocr_text = cleaned
                    else:
                        ocr_text = cleaned

                    pages_result.append({
                        "page": orig_page_num,
                        "text": ocr_text,
                        "type": "scanned",
                        "is_ocr_used": True,
                        "is_blank": is_blank,
                    })

                if progress_callback is not None:
                    try:
                        progress_callback(
                            seq_idx + 1,
                            len(pages_extracted),
                            f"Đã hoàn thành phân tích trang {orig_page_num} ({seq_idx + 1}/{len(pages_extracted)})",
                        )
                    except Exception:
                        pass

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
            pages_data = self.extract_pages(path, max_pages=max_pages, selected_pages=selected_pages)
            full_text = "\n\n".join(p["text"] for p in pages_data if p["text"])
            return {
                "document_type": "fallback",
                "text": full_text,
                "page_count": len(pages_data),
                "pages": pages_data,
                "fast_path_used": True,
                "ocr_pages_count": 0,
            }
        finally:
            if doc_pdfium is not None:
                try:
                    doc_pdfium.close()
                except Exception:
                    pass
                del doc_pdfium
            if doc_fitz is not None:
                try:
                    doc_fitz.close()
                except Exception:
                    pass
                del doc_fitz

    def extract_hybrid_text(
        self,
        file_path: Path | str,
        ocr_service: Any = None,
        max_pages: int | None = None,
        threshold_chars: int = 30,
        max_workers: int | None = 2,
        progress_callback: Optional[Any] = None,
        selected_pages: Optional[list[int]] = None,
    ) -> dict[str, Any]:
        """
        PDFL-255.1: Trích xuất văn bản hybrid kết hợp layout extraction và OCR.
        Hỗ trợ selective extraction thông qua `selected_pages`.
        """
        return self.extract_hybrid_fast_path(
            file_path=file_path,
            ocr_service=ocr_service,
            max_pages=max_pages,
            threshold_chars=threshold_chars,
            max_workers=max_workers,
            progress_callback=progress_callback,
            selected_pages=selected_pages,
        )

    @staticmethod
    def _clean_whitespace(text: str) -> str:
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()
