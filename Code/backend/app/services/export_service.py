import html
import io
import os
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer


class ExportService:
    def __init__(self):
        self.font_name = self._register_unicode_font()

    @staticmethod
    def _register_unicode_font() -> str:
        candidates = [
            ("Arial", r"C:\Windows\Fonts\arial.ttf"),
            ("TimesNewRoman", r"C:\Windows\Fonts\times.ttf"),
            ("SegoeUI", r"C:\Windows\Fonts\segoeui.ttf"),
            ("DejaVuSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ]
        for name, path in candidates:
            if os.path.exists(path):
                try:
                    pdfmetrics.registerFont(TTFont(name, path))
                    return name
                except Exception:
                    continue
        return "Helvetica"

    def export_to_txt(self, content: str, title: str | None = None) -> bytes:
        parts: list[str] = []
        if title:
            parts.append(title.strip())
            parts.append("=" * len(title.strip()))
            parts.append("")

        parts.append(content.strip())
        full_text = "\n".join(parts)
        return full_text.encode("utf-8-sig")

    def export_to_pdf(
        self,
        content: str,
        title: str = "Tài Liệu Dịch Thuật",
        original_content: str | None = None,
    ) -> bytes:
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
        body_style = ParagraphStyle(
            "DocBody",
            parent=styles["Normal"],
            fontName=self.font_name,
            fontSize=10,
            leading=15,
            textColor=HexColor("#334155"),
            spaceAfter=8,
        )

        story: list = []

        safe_title = html.escape(title)
        story.append(Paragraph(f"<b>{safe_title}</b>", title_style))
        story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#E2E8F0"), spaceAfter=12))

        if original_content and original_content.strip():
            story.append(Paragraph("<b>1. Văn bản gốc:</b>", section_style))
            for para in original_content.strip().split("\n\n"):
                if para.strip():
                    safe_para = html.escape(para.strip()).replace("\n", "<br/>")
                    story.append(Paragraph(safe_para, body_style))

            story.append(Spacer(1, 10))
            story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#CBD5E1"), spaceAfter=10))
            story.append(Paragraph("<b>2. Bản dịch:</b>", section_style))

        for para in content.strip().split("\n\n"):
            if para.strip():
                safe_para = html.escape(para.strip()).replace("\n", "<br/>")
                story.append(Paragraph(safe_para, body_style))

        doc.build(story)
        pdf_data = buffer.getvalue()
        buffer.close()
        return pdf_data
