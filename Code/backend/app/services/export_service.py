import html
import io
import os
import re

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

from app.schemas.process import ExportTargetType


class ExportService:
    def __init__(self):
        self.font_name = self._register_unicode_font()

    @staticmethod
    def _register_unicode_font() -> str:
        candidates = [
            ("Arial", r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf"),
            ("TimesNewRoman", r"C:\Windows\Fonts\times.ttf", r"C:\Windows\Fonts\timesbd.ttf"),
            ("SegoeUI", r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\segoeuib.ttf"),
            (
                "DejaVuSans",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            ),
        ]
        for item in candidates:
            name = item[0]
            regular_path = item[1]
            bold_path = item[2] if len(item) > 2 else None
            if os.path.exists(regular_path):
                try:
                    pdfmetrics.registerFont(TTFont(name, regular_path))
                    if bold_path and os.path.exists(bold_path):
                        bold_name = f"{name}-Bold"
                        pdfmetrics.registerFont(TTFont(bold_name, bold_path))
                        registerFontFamily(name, normal=name, bold=bold_name, italic=name, boldItalic=bold_name)
                    return name
                except Exception:
                    continue
        return "Helvetica"

    @staticmethod
    def _validate_export_inputs(
        content: str | None,
        original_content: str | None,
        target_type: ExportTargetType,
    ) -> tuple[str, str | None]:
        """
        PDFL-156.2: Kiểm tra nội dung đầu vào cho ExportService.
        Từ chối None, chuỗi rỗng và chuỗi chỉ chứa whitespace.
        Ném ValueError cho từng loại xuất khi nội dung không hợp lệ.
        """
        clean_content = (content or "").strip() if isinstance(content, str) else ""
        clean_orig = (original_content or "").strip() if isinstance(original_content, str) else ""

        if target_type == ExportTargetType.ORIGINAL:
            actual_content = clean_content or clean_orig
            if not actual_content:
                raise ValueError("Nội dung văn bản gốc không được để trống.")
            return actual_content, None

        elif target_type == ExportTargetType.TRANSLATED:
            if not clean_content:
                raise ValueError("Nội dung bản dịch không được để trống.")
            return clean_content, None

        elif target_type == ExportTargetType.SUMMARY:
            if not clean_content:
                raise ValueError("Nội dung tóm tắt không được để trống.")
            return clean_content, None

        elif target_type == ExportTargetType.BILINGUAL:
            if not clean_content:
                raise ValueError("Nội dung bản dịch không được để trống khi xuất song ngữ.")
            if not clean_orig:
                raise ValueError("Nội dung văn bản gốc không được để trống khi xuất song ngữ.")
            return clean_content, clean_orig

        else:
            if not clean_content:
                raise ValueError("Nội dung tệp xuất không được để trống.")
            return clean_content, None

    def export_to_txt(
        self,
        content: str,
        title: str | None = None,
        export_type: str | ExportTargetType = ExportTargetType.TRANSLATED,
        original_content: str | None = None,
    ) -> bytes:
        if isinstance(export_type, str):
            try:
                target_type = ExportTargetType(export_type.lower())
            except ValueError:
                target_type = ExportTargetType.TRANSLATED
        elif isinstance(export_type, ExportTargetType):
            target_type = export_type
        else:
            target_type = ExportTargetType.TRANSLATED

        clean_content, clean_orig = self._validate_export_inputs(
            content=content,
            original_content=original_content,
            target_type=target_type,
        )

        parts: list[str] = []
        if title and title.strip():
            clean_title = title.strip()
            parts.append(clean_title)
            parts.append("=" * len(clean_title))
            parts.append("")

        if target_type == ExportTargetType.BILINGUAL:
            parts.append("=== 1. VĂN BẢN GỐC ===")
            parts.append(clean_orig or "")
            parts.append("")
            parts.append("=== 2. BẢN DỊCH ===")
            parts.append(clean_content)
        elif target_type == ExportTargetType.ORIGINAL:
            parts.append(clean_content)
        elif target_type == ExportTargetType.SUMMARY:
            parts.append(clean_content)
        else:  # TRANSLATED
            parts.append(clean_content)

        full_text = "\n".join(parts)
        return full_text.encode("utf-8-sig")

    def export_to_pdf(
        self,
        content: str,
        title: str = "Tài Liệu Dịch Thuật",
        original_content: str | None = None,
        export_type: str | ExportTargetType | None = None,
    ) -> bytes:
        # Xử lý backward compatibility:
        # Nếu export_type không được truyền:
        # - Có original_content -> BILINGUAL
        # - Không có original_content -> TRANSLATED
        if export_type is None:
            if original_content and original_content.strip():
                target_type = ExportTargetType.BILINGUAL
            else:
                target_type = ExportTargetType.TRANSLATED
        elif isinstance(export_type, str):
            try:
                target_type = ExportTargetType(export_type.lower())
            except ValueError:
                target_type = ExportTargetType.TRANSLATED
        elif isinstance(export_type, ExportTargetType):
            target_type = export_type
        else:
            target_type = ExportTargetType.TRANSLATED

        clean_content, clean_orig = self._validate_export_inputs(
            content=content,
            original_content=original_content,
            target_type=target_type,
        )

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=40,
            rightMargin=40,
            topMargin=40,
            bottomMargin=40,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontName=self.font_name,
            fontSize=16,
            leading=22,
            textColor=HexColor("#1E293B"),
            spaceAfter=8,
        )
        section_style = ParagraphStyle(
            "SectionTitle",
            parent=styles["Heading2"],
            fontName=self.font_name,
            fontSize=12,
            leading=16,
            textColor=HexColor("#4F46E5"),
            spaceBefore=12,
            spaceAfter=6,
        )
        summary_section_style = ParagraphStyle(
            "SummarySectionTitle",
            parent=section_style,
            textColor=HexColor("#0D9488"),
        )
        body_style = ParagraphStyle(
            "DocBody",
            parent=styles["Normal"],
            fontName=self.font_name,
            fontSize=10,
            leading=15,
            textColor=HexColor("#334155"),
            spaceAfter=8,
        )
        bullet_style = ParagraphStyle(
            "DocBullet",
            parent=styles["Normal"],
            fontName=self.font_name,
            fontSize=10,
            leading=15,
            textColor=HexColor("#1E293B"),
            leftIndent=16,
            firstLineIndent=-10,
            spaceAfter=5,
        )

        story: list = []

        safe_title = html.escape(title.strip() if title else "PDF-Lingua")
        story.append(Paragraph(f"<b>{safe_title}</b>", title_style))
        story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#E2E8F0"), spaceAfter=12))

        def add_paragraphs(text: str, is_summary: bool = False):
            for para in text.strip().split("\n\n"):
                para_clean = para.strip()
                if not para_clean:
                    continue
                lines = para_clean.split("\n")
                if is_summary and len(lines) > 1 and any(re.match(r"^(\s*[-*•]|\s*\d+[\.\)])", l) for l in lines):
                    for line in lines:
                        line_clean = line.strip()
                        if not line_clean:
                            continue
                        safe_line = html.escape(line_clean)
                        if re.match(r"^[-*•]", line_clean):
                            story.append(Paragraph(f"&bull;&nbsp; {safe_line.lstrip('-*• ')}", bullet_style))
                        elif re.match(r"^\d+[\.\)]", line_clean):
                            story.append(Paragraph(safe_line, bullet_style))
                        else:
                            story.append(Paragraph(safe_line, body_style))
                else:
                    safe_para = html.escape(para_clean).replace("\n", "<br/>")
                    if is_summary and re.match(r"^(\s*[-*•]|\s*\d+[\.\)])", para_clean):
                        story.append(Paragraph(safe_para, bullet_style))
                    else:
                        story.append(Paragraph(safe_para, body_style))

        if target_type == ExportTargetType.ORIGINAL:
            story.append(Paragraph("<b>VĂN BẢN GỐC</b>", section_style))
            add_paragraphs(clean_content)
        elif target_type == ExportTargetType.SUMMARY:
            story.append(Paragraph("<b>BẢN TÓM TẮT NỘI DUNG</b>", summary_section_style))
            add_paragraphs(clean_content, is_summary=True)
        elif target_type == ExportTargetType.BILINGUAL:
            story.append(Paragraph("<b>1. VĂN BẢN GỐC</b>", section_style))
            add_paragraphs(clean_orig or "")
            story.append(Spacer(1, 10))
            story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#CBD5E1"), spaceAfter=10))
            story.append(Paragraph("<b>2. BẢN DỊCH</b>", section_style))
            add_paragraphs(clean_content)
        else:  # TRANSLATED
            story.append(Paragraph("<b>BẢN DỊCH THUẬT</b>", section_style))
            add_paragraphs(clean_content)

        doc.build(story)
        pdf_data = buffer.getvalue()
        buffer.close()
        return pdf_data
