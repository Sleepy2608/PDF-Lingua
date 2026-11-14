import html
import io
import os
import re

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
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

    def export_to_docx(
        self,
        content: str,
        title: str = "Tài Liệu Dịch Thuật",
        original_content: str | None = None,
        export_type: str | ExportTargetType | None = None,
    ) -> bytes:
        """
        PDFL-254.1: Xuất tài liệu ra định dạng Microsoft Word (.docx).
        Hỗ trợ:
        - Khổ giấy A4, font tiếng Việt Unicode chuẩn (Arial).
        - Các chế độ xuất: TRANSLATED, ORIGINAL, SUMMARY, BILINGUAL.
        - Chế độ BILINGUAL hiển thị dạng bảng 2 cột với header xám nhạt (#F1F5F9).
        """
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

        doc = Document()

        # 1. Cấu hình trang A4 và lề tiêu chuẩn
        section = doc.sections[0]
        section.page_width = Inches(8.27)   # 210mm
        section.page_height = Inches(11.69) # 297mm
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

        # 2. Cấu hình kiểu chữ mặc định hỗ trợ Unicode tiếng Việt
        normal_style = doc.styles["Normal"]
        normal_font = normal_style.font
        normal_font.name = "Arial"
        normal_font.size = Pt(10.5)
        normal_font.color.rgb = RGBColor(0x33, 0x41, 0x55)
        try:
            normal_style._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
            normal_style._element.rPr.rFonts.set(qn("w:cs"), "Arial")
            normal_style._element.rPr.rFonts.set(qn("w:ascii"), "Arial")
            normal_style._element.rPr.rFonts.set(qn("w:hAnsi"), "Arial")
        except Exception:
            pass

        # 3. Tiêu đề tài liệu
        safe_title = (title.strip() if title else "PDF-Lingua").strip()
        title_p = doc.add_paragraph()
        title_p.paragraph_format.space_before = Pt(0)
        title_p.paragraph_format.space_after = Pt(12)
        title_run = title_p.add_run(safe_title)
        title_run.font.name = "Arial"
        title_run.font.size = Pt(16)
        title_run.bold = True
        title_run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        def add_section_title(text: str, color_rgb: RGBColor = RGBColor(0x4F, 0x46, 0xE5)):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(text)
            run.font.name = "Arial"
            run.font.size = Pt(12)
            run.bold = True
            run.font.color.rgb = color_rgb

        def add_body_paragraphs(text: str, is_summary: bool = False):
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
                        p = doc.add_paragraph()
                        p.paragraph_format.space_after = Pt(4)
                        p.paragraph_format.line_spacing = 1.15
                        if re.match(r"^[-*•]", line_clean):
                            p.paragraph_format.left_indent = Inches(0.2)
                            run = p.add_run(f"• {line_clean.lstrip('-*• ')}")
                        else:
                            run = p.add_run(line_clean)
                        run.font.name = "Arial"
                        run.font.size = Pt(10.5)
                        run.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
                else:
                    p = doc.add_paragraph()
                    p.paragraph_format.space_after = Pt(6)
                    p.paragraph_format.line_spacing = 1.2
                    if is_summary and re.match(r"^(\s*[-*•]|\s*\d+[\.\)])", para_clean):
                        p.paragraph_format.left_indent = Inches(0.2)
                        run = p.add_run(f"• {para_clean.lstrip('-*• ')}")
                    else:
                        run = p.add_run(para_clean)
                    run.font.name = "Arial"
                    run.font.size = Pt(10.5)
                    run.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

        if target_type == ExportTargetType.ORIGINAL:
            add_section_title("VĂN BẢN GỐC")
            add_body_paragraphs(clean_content)

        elif target_type == ExportTargetType.SUMMARY:
            add_section_title("BẢN TÓM TẮT NỘI DUNG", color_rgb=RGBColor(0x0D, 0x94, 0x88))
            add_body_paragraphs(clean_content, is_summary=True)

        elif target_type == ExportTargetType.BILINGUAL:
            add_section_title("BẢN DỊCH SONG NGỮ")
            # Tạo bảng 2 cột cho bản dịch song ngữ đối chiếu
            orig_paras = [p.strip() for p in (clean_orig or "").split("\n\n") if p.strip()]
            trans_paras = [p.strip() for p in clean_content.split("\n\n") if p.strip()]
            max_rows = max(len(orig_paras), len(trans_paras), 1)

            table = doc.add_table(rows=max_rows + 1, cols=2)
            table.style = "Table Grid"

            # 1. Header row
            hdr_cells = table.rows[0].cells
            hdr_titles = ["1. VĂN BẢN GỐC", "2. BẢN DỊCH"]
            for idx, text in enumerate(hdr_titles):
                cell = hdr_cells[idx]
                cell.text = text
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.runs[0].font.name = "Arial"
                p.runs[0].font.size = Pt(11)
                p.runs[0].font.bold = True
                p.runs[0].font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
                # Đặt nền xám nhạt (#F1F5F9)
                tcPr = cell._tc.get_or_add_tcPr()
                shd = OxmlElement("w:shd")
                shd.set(qn("w:val"), "clear")
                shd.set(qn("w:color"), "auto")
                shd.set(qn("w:fill"), "F1F5F9")
                tcPr.append(shd)

            # 2. Content rows
            for i in range(max_rows):
                row_cells = table.rows[i + 1].cells
                left_text = orig_paras[i] if i < len(orig_paras) else ""
                right_text = trans_paras[i] if i < len(trans_paras) else ""

                row_cells[0].text = left_text
                row_cells[1].text = right_text

                for c in row_cells:
                    if c.paragraphs and c.paragraphs[0].runs:
                        c.paragraphs[0].runs[0].font.name = "Arial"
                        c.paragraphs[0].runs[0].font.size = Pt(10)
                        c.paragraphs[0].runs[0].font.color.rgb = RGBColor(0x33, 0x41, 0x55)

            # Cố định độ rộng 2 cột (mỗi cột 3.33 inches)
            col_widths = [Inches(3.33), Inches(3.33)]
            for row in table.rows:
                for idx, width in enumerate(col_widths):
                    row.cells[idx].width = width

        else:  # TRANSLATED
            add_section_title("BẢN DỊCH THUẬT")
            add_body_paragraphs(clean_content)

        buffer = io.BytesIO()
        doc.save(buffer)
        docx_bytes = buffer.getvalue()
        buffer.close()
        return docx_bytes
