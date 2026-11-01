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

    def detect_and_correct_skew(
        self,
        image_input: Path | str | Image.Image,
        min_angle: float = 1.0,
        max_angle: float = 15.0,
        angle_step: float = 0.5,
        dark_pixel_threshold: int = 200,
    ) -> tuple[Image.Image, float]:
        """
        Phát hiện và hiệu chỉnh góc nghiêng (deskew) của trang scan bằng phân tích
        Horizontal Projection Profile kết hợp Pillow.

        - Chỉ hiệu chỉnh góc nghiêng trong phạm vi [min_angle, max_angle] (1° - 15°).
        - Nếu không đủ nội dung hoặc góc nghiêng ngoài phạm vi cho phép: giữ nguyên ảnh gốc.
        - Xoay ảnh bằng Pillow rotate với expand=True và fillcolor=255 (nền trắng).

        Trả về:
            (ảnh_sau_deskew, góc_nghiêng_đã_hiệu_chỉnh)
        """
        if isinstance(image_input, (str, Path)):
            img = Image.open(image_input)
        elif isinstance(image_input, Image.Image):
            img = image_input
        else:
            return image_input, 0.0

        try:
            gray_img = img.convert("L")
            w, h = gray_img.size

            # Resize ảnh nhỏ để tính toán nhanh Projection Profile
            calc_w = 400
            calc_h = int(h * (calc_w / w)) if w > 0 else 400
            small_img = gray_img.resize((calc_w, calc_h), Image.Resampling.BILINEAR)

            # Nhị phân hoá: điểm đen (chữ) = 1, nền trắng = 0
            # Ngưỡng pixel tối: < dark_pixel_threshold
            get_flat_data = getattr(small_img, "get_flattened_data", small_img.getdata)
            pixels = list(get_flat_data())
            binary = [1 if p < dark_pixel_threshold else 0 for p in pixels]

            total_ink = sum(binary)
            # Nếu không đủ nội dung (quá ít pixel chữ), không xác định được góc đáng tin cậy
            if total_ink < 50:
                return img, 0.0

            # Tạo candidate angles trong phạm vi [-max_angle, max_angle] với bước nhảy angle_step
            # Loại trừ các góc quá nhỏ < min_angle (1 độ) ngoại trừ góc 0 làm mốc chuẩn
            angles = [0.0]
            curr = min_angle
            while curr <= max_angle:
                angles.extend([curr, -curr])
                curr += angle_step

            best_angle = 0.0
            best_variance = -1.0
            zero_angle_variance = -1.0

            bin_img = Image.new("1", (calc_w, calc_h), 0)
            bin_img.putdata(binary)

            for angle in angles:
                if angle == 0.0:
                    rot_bin = bin_img
                else:
                    rot_bin = bin_img.rotate(angle, resample=Image.Resampling.NEAREST, expand=False, fillcolor=0)

                # Tính Horizontal Projection: tổng số pixel mực trên mỗi hàng
                rot_w, rot_h = rot_bin.size
                get_rot_data = getattr(rot_bin, "get_flattened_data", rot_bin.getdata)
                rot_data = list(get_rot_data())

                row_sums = [
                    sum(rot_data[r * rot_w : (r + 1) * rot_w])
                    for r in range(rot_h)
                ]

                # Tính phương sai của profile (khi chữ nằm ngang, các hàng có chữ rất đậm và khoảng cách giữa các dòng = 0 -> phương sai lớn nhất)
                mean_val = sum(row_sums) / len(row_sums) if row_sums else 0
                variance = sum((x - mean_val) ** 2 for x in row_sums) / len(row_sums) if row_sums else 0

                if angle == 0.0:
                    zero_angle_variance = variance

                if variance > best_variance:
                    best_variance = variance
                    best_angle = angle

            # Thăm dò kiểm tra xem góc nghiêng thực tế có vượt quá max_angle (15°) hay không
            # Nếu phương sai tại các góc biên (ví dụ -15° hoặc +15°) vẫn đang tăng mạnh so với lân cận
            # hoặc khi quét góc mở rộng (ví dụ 20° hoặc 25°) có phương sai cao hơn thì góc thật nằm ngoài [1, 15]
            if abs(best_angle) >= max_angle:
                # Kiểm tra góc ngoài phạm vi
                test_outer_angle = best_angle * 1.4
                rot_outer = bin_img.rotate(test_outer_angle, resample=Image.Resampling.NEAREST, expand=False, fillcolor=0)
                rot_outer_w, rot_outer_h = rot_outer.size
                rot_outer_data = list(getattr(rot_outer, "get_flattened_data", rot_outer.getdata)())
                row_sums_outer = [
                    sum(rot_outer_data[r * rot_outer_w : (r + 1) * rot_outer_w])
                    for r in range(rot_outer_h)
                ]
                mean_outer = sum(row_sums_outer) / len(row_sums_outer) if row_sums_outer else 0
                var_outer = sum((x - mean_outer) ** 2 for x in row_sums_outer) / len(row_sums_outer) if row_sums_outer else 0
                if var_outer >= best_variance:
                    # Góc nghiêng thực tế nằm ngoài phạm vi cho phép (> max_angle) -> Giữ nguyên ảnh gốc
                    logger.info(f"[OCR] Skew angle appears beyond max allowable range ({max_angle}°). Keeping original.")
                    return img, 0.0

            # Kiểm tra độ tin cậy: nếu góc tốt nhất rơi vào [min_angle, max_angle)
            # và mang lại cải thiện rõ rệt so với góc 0 (variance cao hơn mốc 0)
            detected_skew = abs(best_angle)
            if min_angle <= detected_skew <= max_angle and best_variance > zero_angle_variance * 1.05:
                logger.info(f"[OCR] Deskew detected skew angle: {best_angle}°. Correcting...")
                fill_val = (255, 255, 255) if img.mode == "RGB" else 255
                deskewed_img = img.rotate(best_angle, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=fill_val)
                return deskewed_img, best_angle

            return img, 0.0
        except Exception as e:
            logger.error(f"[OCR] Error during deskew detection: {e}")
            return img, 0.0

    def extract_text_from_image(
        self,
        image_input: Path | str | Image.Image,
        lang: str | None = None,
        auto_rotate: bool = True,
        auto_deskew: bool = True,
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

            if auto_deskew:
                img, _ = self.detect_and_correct_skew(img)

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
                corrected_image, _ = self.detect_and_correct_orientation(pil_image)

                # Hiệu chỉnh góc nghiêng (Deskew) sau Orientation
                deskewed_image, _ = self.detect_and_correct_skew(corrected_image)

                page_text = self.extract_text_from_image(deskewed_image, lang=target_lang, auto_rotate=False, auto_deskew=False)
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
