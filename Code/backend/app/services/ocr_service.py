import os
import shutil
from pathlib import Path
from typing import Any, Callable, Optional
from PIL import Image, ImageEnhance, ImageOps
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

        gray_img = None
        small_img = None
        bin_img = None
        rot_outer = None
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
        finally:
            for intermediate in (gray_img, small_img, bin_img, rot_outer):
                if intermediate is not None and intermediate is not img:
                    try:
                        intermediate.close()
                    except Exception:
                        pass

    def enhance_image(
        self,
        image_input: Path | str | Image.Image,
        contrast_factor: float = 1.5,
        sharpness_factor: float = 1.5,
    ) -> Image.Image:
        """
        Nâng cao chất lượng ảnh (Image Enhancement) cho OCR bằng Pillow:
        - Chuyển xám (Grayscale).
        - Cân bằng tương phản tự động (Autocontrast).
        - Tăng độ tương phản (Contrast) và độ sắc nét (Sharpness).
        - Error handling và an toàn fallback về ảnh ban đầu.
        """
        if isinstance(image_input, (str, Path)):
            img = Image.open(image_input)
        elif isinstance(image_input, Image.Image):
            img = image_input
        else:
            return image_input

        gray_img = None
        autocontrast_img = None
        contrast_img = None
        try:
            # 1. Chuyển sang ảnh thang độ xám 'L' nếu đang là RGB/RGBA
            gray_img = img.convert("L")

            # 2. Tự động cân bằng histogram / dải sáng
            autocontrast_img = ImageOps.autocontrast(gray_img, cutoff=1)

            # 3. Tăng độ tương phản
            enhancer_contrast = ImageEnhance.Contrast(autocontrast_img)
            contrast_img = enhancer_contrast.enhance(contrast_factor)

            # 4. Tăng độ sắc nét
            enhancer_sharp = ImageEnhance.Sharpness(contrast_img)
            enhanced_img = enhancer_sharp.enhance(sharpness_factor)

            return enhanced_img
        except Exception as e:
            logger.error(f"[OCR] Error during image enhancement: {e}")
            return img
        finally:
            for intermediate in (gray_img, autocontrast_img, contrast_img):
                if intermediate is not None and intermediate is not img:
                    try:
                        intermediate.close()
                    except Exception:
                        pass

    def preprocess_image(
        self,
        image_input: Path | str | Image.Image,
        check_blank: bool = True,
        auto_rotate: bool = True,
        auto_deskew: bool = True,
        auto_enhance: bool = True,
    ) -> tuple[Image.Image, dict[str, Any]]:
        """
        Pipeline tiền xử lý hình ảnh hoàn chỉnh theo thứ tự:
        1. Blank Page Detection
        2. Orientation Correction
        3. Deskew Correction
        4. Image Enhancement
        Kèm error handling và fallback cho từng bước, không làm sập pipeline.
        """
        meta: dict[str, Any] = {
            "is_blank": False,
            "rotation_applied": 0,
            "skew_applied": 0.0,
            "enhanced": False,
            "error": None,
        }

        if isinstance(image_input, (str, Path)):
            try:
                img = Image.open(image_input)
            except Exception as e:
                logger.error(f"[OCR] Cannot open image file: {e}")
                meta["error"] = str(e)
                return image_input, meta
        elif isinstance(image_input, Image.Image):
            img = image_input
        else:
            return image_input, meta

        # Bước 1: Blank Page Detection
        if check_blank:
            try:
                if self.is_blank_page(img):
                    meta["is_blank"] = True
                    return img, meta
            except Exception as e:
                logger.warning(f"[OCR Pipeline] Warning in is_blank_page fallback: {e}")

        # Bước 2: Orientation Correction
        if auto_rotate:
            try:
                rotated_img, rot_angle = self.detect_and_correct_orientation(img)
                if rotated_img is not img and img is not image_input:
                    try:
                        img.close()
                    except Exception:
                        pass
                img = rotated_img
                meta["rotation_applied"] = rot_angle
            except Exception as e:
                logger.warning(f"[OCR Pipeline] Warning in detect_and_correct_orientation fallback: {e}")

        # Bước 3: Deskew Correction
        if auto_deskew:
            try:
                deskewed_img, skew_angle = self.detect_and_correct_skew(img)
                if deskewed_img is not img and img is not image_input:
                    try:
                        img.close()
                    except Exception:
                        pass
                img = deskewed_img
                meta["skew_applied"] = skew_angle
            except Exception as e:
                logger.warning(f"[OCR Pipeline] Warning in detect_and_correct_skew fallback: {e}")

        # Bước 4: Image Enhancement
        if auto_enhance:
            try:
                enhanced_img = self.enhance_image(img)
                if enhanced_img is not img and img is not image_input:
                    try:
                        img.close()
                    except Exception:
                        pass
                img = enhanced_img
                meta["enhanced"] = True
            except Exception as e:
                logger.warning(f"[OCR Pipeline] Warning in enhance_image fallback: {e}")

        return img, meta

    def extract_text_from_image(
        self,
        image_input: Path | str | Image.Image,
        lang: str | None = None,
        preprocess: bool = True,
        auto_rotate: bool = True,
        auto_deskew: bool = True,
        auto_enhance: bool = True,
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

            # Chỉ tiền xử lý khi được yêu cầu (tránh xử lý lặp lại 2 lần)
            if preprocess and (auto_rotate or auto_deskew or auto_enhance):
                img, meta = self.preprocess_image(
                    img,
                    check_blank=True,
                    auto_rotate=auto_rotate,
                    auto_deskew=auto_deskew,
                    auto_enhance=auto_enhance,
                )
                if meta.get("is_blank", False):
                    return ""

            text = pytesseract.image_to_string(img, lang=target_lang)
            return text.strip()
        except pytesseract.TesseractNotFoundError:
            logger.warning("[OCR] Tesseract binary not found.")
            return ""
        except Exception as e:
            logger.error(f"[OCR] Error during image recognition: {e}")
            return ""

    def _ocr_single_page_isolated(
        self,
        pdf_path: Path | str,
        page_idx: int,
        target_lang: str,
        render_scale: float = 2.0,
    ) -> dict[str, Any]:
        """
        Xử lý OCR cho duy nhất 1 trang PDF với tài nguyên cô lập hoàn toàn (Thread-safe).
        Mở tài liệu riêng, render ảnh, preprocess, OCR và giải phóng toàn bộ tài nguyên trong finally.
        """
        doc = None
        pil_image = None
        processed_image = None
        try:
            if pdfium is not None:
                doc = pdfium.PdfDocument(str(pdf_path))
                if page_idx >= len(doc):
                    return {"page": page_idx + 1, "text": "", "is_blank": False, "error": "Index out of range"}
                page = doc.get_page(page_idx)
                pil_image = page.render(scale=render_scale).to_pil()
                del page
            else:
                import io
                import pymupdf
                doc = pymupdf.open(str(pdf_path))
                if page_idx >= len(doc):
                    return {"page": page_idx + 1, "text": "", "is_blank": False, "error": "Index out of range"}
                page = doc.load_page(page_idx)
                pix = page.get_pixmap(dpi=150)
                raw_bytes = pix.tobytes("png")
                del pix
                del page
                pil_image = Image.open(io.BytesIO(raw_bytes))

            processed_image, meta = self.preprocess_image(
                pil_image,
                check_blank=True,
                auto_rotate=True,
                auto_deskew=True,
                auto_enhance=True,
            )

            if meta.get("is_blank", False):
                return {"page": page_idx + 1, "text": "", "is_blank": True, "error": None}

            page_text = self.extract_text_from_image(
                processed_image,
                lang=target_lang,
                preprocess=False,
            )
            return {"page": page_idx + 1, "text": page_text, "is_blank": False, "error": None}

        except Exception as e:
            logger.error(f"[OCR] Error processing page {page_idx + 1}: {e}")
            return {"page": page_idx + 1, "text": "", "is_blank": False, "error": str(e)}
        finally:
            if processed_image is not None and processed_image is not pil_image:
                try:
                    processed_image.close()
                except Exception:
                    pass
                del processed_image
            if pil_image is not None:
                try:
                    pil_image.close()
                except Exception:
                    pass
                del pil_image
            if doc is not None:
                try:
                    doc.close()
                except Exception:
                    pass
                del doc

    def extract_text_from_scanned_pdf(
        self,
        pdf_path: Path | str,
        lang: str | None = None,
        max_pages: int = 50,
        render_scale: float = 2.0,
        max_workers: int | None = 2,
        progress_callback: Optional[Any] = None,
    ) -> dict[str, Any]:
        if not self.is_available():
            return {
                "success": False,
                "text": "",
                "page_count": 0,
                "pages": [],
                "error": "Máy chủ chưa cài đặt công cụ Tesseract OCR.",
            }

        target_lang = lang or self.default_lang

        # Xác định tổng số trang trước khi xử lý
        total_pages = 0
        doc_probe = None
        try:
            if pdfium is not None:
                doc_probe = pdfium.PdfDocument(str(pdf_path))
                total_pages = min(len(doc_probe), max_pages)
            else:
                import pymupdf
                doc_probe = pymupdf.open(str(pdf_path))
                total_pages = min(len(doc_probe), max_pages)
        except Exception as e:
            return {
                "success": False,
                "text": "",
                "page_count": 0,
                "pages": [],
                "error": f"Lỗi đọc tài liệu PDF: {e}",
            }
        finally:
            if doc_probe is not None:
                try:
                    doc_probe.close()
                except Exception:
                    pass
                del doc_probe

        if total_pages == 0:
            return {
                "success": True,
                "text": "",
                "page_count": 0,
                "pages": [],
                "error": None,
            }

        # Kiểm tra điều kiện chạy song song: nếu max_workers > 1 và số trang > 1
        effective_workers = max_workers if (max_workers is not None and max_workers > 1 and total_pages > 1) else 1
        effective_workers = min(effective_workers, 4, total_pages)

        # 1. PARALLEL PATH (ThreadPoolExecutor với isolated resources)
        # Chỉ chạy parallel khi tổng số trang > 1 và effective_workers > 1
        if effective_workers > 1:
            results_by_idx: dict[int, dict[str, Any]] = {}
            try:
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=effective_workers) as executor:
                    future_to_idx = {
                        executor.submit(
                            self._ocr_single_page_isolated,
                            pdf_path,
                            idx,
                            target_lang,
                            render_scale,
                        ): idx
                        for idx in range(total_pages)
                    }

                    completed_count = 0
                    for future in concurrent.futures.as_completed(future_to_idx):
                        idx = future_to_idx[future]
                        try:
                            results_by_idx[idx] = future.result()
                        except Exception as e:
                            logger.error(f"[OCR Parallel] Worker exception for page {idx + 1}: {e}")
                            results_by_idx[idx] = {
                                "page": idx + 1,
                                "text": "",
                                "is_blank": False,
                                "error": str(e),
                            }
                        completed_count += 1
                        if progress_callback is not None:
                            try:
                                progress_callback(completed_count, total_pages, f"Đang nhận dạng OCR trang {completed_count}/{total_pages}")
                            except Exception:
                                pass

                # Bảo đảm đúng thứ tự trang ban đầu (page 1 -> total_pages)
                pages_detail = [results_by_idx[i] for i in range(total_pages)]
                pages_text = [p["text"] for p in pages_detail if p.get("text")]
                full_text = "\n\n".join(pages_text)

                return {
                    "success": True,
                    "text": full_text,
                    "page_count": total_pages,
                    "pages": pages_detail,
                    "error": None,
                }
            except Exception as e:
                logger.warning(f"[OCR Parallel] Parallel processing failed, falling back to sequential: {e}")
                # Fallback to sequential below cho các trang chưa hoàn thành

        # 2. SEQUENTIAL PATH / FALLBACK (Lazy loading & eager cleanup từng trang)
        # Chỉ xử lý tuần tự cho các trang chưa có kết quả (tránh xử lý trùng)
        pages_text: list[str] = []
        pages_detail: list[dict[str, Any]] = []

        doc = None
        try:
            if pdfium is not None:
                doc = pdfium.PdfDocument(str(pdf_path))
                total_pages = min(len(doc), max_pages)

                for i in range(total_pages):
                    if effective_workers > 1 and i in results_by_idx and results_by_idx[i].get("error") is None:
                        # Đã hoàn thành hợp lệ ở parallel path
                        p_info = results_by_idx[i]
                        pages_detail.append(p_info)
                        if p_info.get("text"):
                            pages_text.append(p_info["text"])
                        continue

                    page = doc.get_page(i)
                    pil_image = page.render(scale=render_scale).to_pil()
                    del page

                    try:
                        processed_image, meta = self.preprocess_image(
                            pil_image,
                            check_blank=True,
                            auto_rotate=True,
                            auto_deskew=True,
                            auto_enhance=True,
                        )
                        try:
                            if meta.get("is_blank", False):
                                logger.info(f"[OCR] Page {i + 1} is detected as blank. Skipping OCR.")
                                pages_detail.append({
                                    "page": i + 1,
                                    "text": "",
                                    "is_blank": True,
                                })
                                continue

                            page_text = self.extract_text_from_image(
                                processed_image,
                                lang=target_lang,
                                preprocess=False,
                            )

                            pages_detail.append({
                                "page": i + 1,
                                "text": page_text,
                                "is_blank": False,
                            })

                            if page_text:
                                pages_text.append(page_text)
                        finally:
                            if processed_image is not pil_image:
                                try:
                                    processed_image.close()
                                except Exception:
                                    pass
                            del processed_image
                    finally:
                        try:
                            pil_image.close()
                        except Exception:
                            pass
                        del pil_image

                    if progress_callback is not None:
                        try:
                            progress_callback(i + 1, total_pages, f"Đang nhận dạng OCR trang {i + 1}/{total_pages}")
                        except Exception:
                            pass
            else:
                import io
                import pymupdf
                doc = pymupdf.open(str(pdf_path))
                total_pages = min(len(doc), max_pages)

                for i in range(total_pages):
                    if effective_workers > 1 and i in results_by_idx and results_by_idx[i].get("error") is None:
                        # Đã hoàn thành hợp lệ ở parallel path
                        p_info = results_by_idx[i]
                        pages_detail.append(p_info)
                        if p_info.get("text"):
                            pages_text.append(p_info["text"])
                        continue

                    page = doc.load_page(i)
                    pix = page.get_pixmap(dpi=150)
                    raw_bytes = pix.tobytes("png")
                    del pix
                    del page

                    pil_image = Image.open(io.BytesIO(raw_bytes))
                    try:
                        processed_image, meta = self.preprocess_image(
                            pil_image,
                            check_blank=True,
                            auto_rotate=True,
                            auto_deskew=True,
                            auto_enhance=True,
                        )
                        try:
                            if meta.get("is_blank", False):
                                pages_detail.append({"page": i + 1, "text": "", "is_blank": True})
                                continue

                            page_text = self.extract_text_from_image(
                                processed_image,
                                lang=target_lang,
                                preprocess=False,
                            )
                            pages_detail.append({"page": i + 1, "text": page_text, "is_blank": False})
                            if page_text:
                                pages_text.append(page_text)
                        finally:
                            if processed_image is not pil_image:
                                try:
                                    processed_image.close()
                                except Exception:
                                    pass
                            del processed_image
                    finally:
                        try:
                            pil_image.close()
                        except Exception:
                            pass
                        del pil_image

                    if progress_callback is not None:
                        try:
                            progress_callback(i + 1, total_pages, f"Đang nhận dạng OCR trang {i + 1}/{total_pages}")
                        except Exception:
                            pass

            full_text = "\n\n".join(pages_text)
            return {
                "success": True,
                "text": full_text,
                "page_count": total_pages,
                "pages": pages_detail,
                "error": None,
            }
        except Exception as e:
            logger.error(f"[OCR] Error processing scanned PDF: {e}")
            return {
                "success": False,
                "text": "",
                "page_count": 0,
                "pages": [],
                "error": f"Lỗi nhận dạng PDF: {e}",
            }
        finally:
            if doc is not None:
                try:
                    doc.close()
                except Exception:
                    pass
                del doc
