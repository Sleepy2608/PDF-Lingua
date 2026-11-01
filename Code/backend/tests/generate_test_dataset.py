import json
from pathlib import Path
import pymupdf
from PIL import Image, ImageDraw, ImageFilter

BASE_DIR = Path(__file__).parent / "dataset"
DIGITAL_DIR = BASE_DIR / "digital"
COMPLEX_DIR = BASE_DIR / "complex"
SCANNED_DIR = BASE_DIR / "scanned"
GROUND_TRUTH_DIR = BASE_DIR / "ground_truth"


def create_directories():
    for d in [DIGITAL_DIR, COMPLEX_DIR, SCANNED_DIR, GROUND_TRUTH_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def generate_single_column_digital():
    filename = "digital_single_column.pdf"
    pdf_path = DIGITAL_DIR / filename
    gt_path = GROUND_TRUTH_DIR / "digital_single_column.txt"

    text_content = (
        "PDF-Lingua Smart Document Extraction\n\n"
        "This is an official single-column academic document.\n"
        "It contains standard text paragraphs designed to evaluate digital extraction precision.\n"
        "Natural reading order flows from the top line directly to the bottom line without split columns.\n"
        "Modern digital PDF extraction should achieve near 100% character accuracy on this clean layout."
    )

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # A4 size
    page.insert_text((72, 100), text_content, fontsize=12)
    doc.save(str(pdf_path))
    doc.close()

    gt_path.write_text(text_content, encoding="utf-8")
    return {
        "filename": filename,
        "type": "Digital PDF",
        "subtype": "single_column",
        "page_count": 1,
        "characteristics": "Clean single-column digital text layout with uniform line heights.",
        "file_path": str(pdf_path.relative_to(BASE_DIR.parent)),
        "ground_truth_path": str(gt_path.relative_to(BASE_DIR.parent)),
    }


def generate_multi_column_digital():
    filename = "digital_multi_column.pdf"
    pdf_path = DIGITAL_DIR / filename
    gt_path = GROUND_TRUTH_DIR / "digital_multi_column.txt"

    col1_text = (
        "Column 1 Header\n\n"
        "First section discusses artificial intelligence and machine learning pipelines.\n"
        "Left column text must be read sequentially before crossing the gutter gap.\n"
        "Column separation must be strictly respected."
    )
    col2_text = (
        "Column 2 Header\n\n"
        "Second section covers multilingual neural machine translation systems.\n"
        "Right column contents follow after column one in natural reading order.\n"
        "Evaluating natural column boundary parsing."
    )

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    # Left column: x=72, y=100, width=210
    page.insert_text((72, 100), col1_text, fontsize=11)
    # Right column: x=320, y=100, width=210 (gutter gap = 38pt)
    page.insert_text((320, 100), col2_text, fontsize=11)
    doc.save(str(pdf_path))
    doc.close()

    ground_truth = f"{col1_text}\n\n{col2_text}"
    gt_path.write_text(ground_truth, encoding="utf-8")
    return {
        "filename": filename,
        "type": "Digital PDF",
        "subtype": "multi_column",
        "page_count": 1,
        "characteristics": "Two-column digital layout separated by a central gutter gap to test reading order.",
        "file_path": str(pdf_path.relative_to(BASE_DIR.parent)),
        "ground_truth_path": str(gt_path.relative_to(BASE_DIR.parent)),
    }


def generate_complex_pdf():
    filename = "complex_tables_and_symbols.pdf"
    pdf_path = COMPLEX_DIR / filename
    gt_path = GROUND_TRUTH_DIR / "complex_tables_and_symbols.txt"

    text_content = (
        "Complex Scientific Report & Financial Summary\n\n"
        "Mathematical Formulas & Symbols:\n"
        "E = m * c^2 | f(x) = alpha * x + beta | Sum(i=1..N) [ x_i ] = Sigma\n\n"
        "Financial Balance Table:\n"
        "Item               Q1_Revenue   Q2_Revenue   Growth_Rate\n"
        "Hardware Services  $120,500     $145,200     +20.5%\n"
        "Software Licenses  $340,000     $390,000     +14.7%\n"
        "Special Symbols: @ # $ % & * [ ] { } < > / = + -"
    )

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((72, 100), text_content, fontsize=11)
    doc.save(str(pdf_path))
    doc.close()

    gt_path.write_text(text_content, encoding="utf-8")
    return {
        "filename": filename,
        "type": "Complex PDF",
        "subtype": "tables_symbols_formulas",
        "page_count": 1,
        "characteristics": "Contains tabular columns, math formulas, dollar currency symbols, and punctuation.",
        "file_path": str(pdf_path.relative_to(BASE_DIR.parent)),
        "ground_truth_path": str(gt_path.relative_to(BASE_DIR.parent)),
    }


def _image_to_pdf(pil_img: Image.Image, output_pdf_path: Path):
    doc = pymupdf.open()
    img_byte_arr = fitz_io = pymupdf.open()
    # Save image to temp bytes or draw into page
    page = doc.new_page(width=pil_img.width * 72 / 150, height=pil_img.height * 72 / 150)
    import io
    img_buf = io.BytesIO()
    pil_img.save(img_buf, format="PNG")
    page.insert_image(page.rect, stream=img_buf.getvalue())
    doc.save(str(output_pdf_path))
    doc.close()


def generate_scanned_high_quality():
    filename = "scanned_high_quality.pdf"
    pdf_path = SCANNED_DIR / filename
    gt_path = GROUND_TRUTH_DIR / "scanned_high_quality.txt"

    text_lines = [
        "Certificate of Academic Achievement",
        "This document certifies that the scanned image has crisp, sharp text.",
        "High resolution 300 DPI scan with high contrast and zero tilt.",
        "Expected OCR accuracy is greater than 95 percent on standard Latin characters."
    ]
    gt_text = "\n".join(text_lines)

    # Render image with crisp black text on white
    w, h = 1200, 1600
    img = Image.new("RGB", (w, h), color="white")
    draw = ImageDraw.Draw(img)
    y = 200
    for line in text_lines:
        draw.text((150, y), line, fill="black")
        y += 80

    _image_to_pdf(img, pdf_path)
    gt_path.write_text(gt_text, encoding="utf-8")
    return {
        "filename": filename,
        "type": "Scanned PDF",
        "subtype": "high_quality",
        "page_count": 1,
        "characteristics": "Clean, high-resolution scanned page without noise, upright 0 degrees orientation.",
        "file_path": str(pdf_path.relative_to(BASE_DIR.parent)),
        "ground_truth_path": str(gt_path.relative_to(BASE_DIR.parent)),
    }


def generate_scanned_medium_skewed():
    filename = "scanned_medium_skewed.pdf"
    pdf_path = SCANNED_DIR / filename
    gt_path = GROUND_TRUTH_DIR / "scanned_medium_skewed.txt"

    text_lines = [
        "Annual Project Evaluation Report",
        "This scanned page is rotated by approximately 4 degrees due to flatbed scanner misalignment.",
        "Deskew correction in PDFL-109.3 will align the document horizontally before character extraction.",
        "Medium DPI image with slight paper texture."
    ]
    gt_text = "\n".join(text_lines)

    w, h = 1200, 1600
    img = Image.new("RGB", (w, h), color="white")
    draw = ImageDraw.Draw(img)
    y = 250
    for line in text_lines:
        draw.text((150, y), line, fill="black")
        y += 80

    # Skew image by 4 degrees
    skewed = img.rotate(-4.0, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(255, 255, 255))
    _image_to_pdf(skewed, pdf_path)
    gt_path.write_text(gt_text, encoding="utf-8")
    return {
        "filename": filename,
        "type": "Scanned PDF",
        "subtype": "medium_skewed",
        "page_count": 1,
        "characteristics": "Medium quality scan with a 4-degree skew tilt requiring deskew pipeline correction.",
        "file_path": str(pdf_path.relative_to(BASE_DIR.parent)),
        "ground_truth_path": str(gt_path.relative_to(BASE_DIR.parent)),
    }


def generate_scanned_low_blurry_noisy():
    filename = "scanned_low_blurry_noisy.pdf"
    pdf_path = SCANNED_DIR / filename
    gt_path = GROUND_TRUTH_DIR / "scanned_low_blurry_noisy.txt"

    text_lines = [
        "Historical Document Archive",
        "Low contrast degraded scan with noise specks and slight gaussian blur.",
        "Requires image enhancement contrast stretching and thresholding.",
        "Tests pipeline robustness under degraded optical capture conditions."
    ]
    gt_text = "\n".join(text_lines)

    w, h = 1000, 1400
    img = Image.new("RGB", (w, h), color=(245, 245, 240))  # Aged paper color
    draw = ImageDraw.Draw(img)
    y = 200
    for line in text_lines:
        draw.text((120, y), line, fill=(80, 80, 80))  # Low contrast grey ink
        y += 80

    # Add scan noise specks
    import random
    random.seed(42)
    for _ in range(300):
        nx, ny = random.randint(0, w - 1), random.randint(0, h - 1)
        draw.point((nx, ny), fill=(100, 100, 100))

    # Apply slight blur
    blurred = img.filter(ImageFilter.GaussianBlur(radius=0.7))
    _image_to_pdf(blurred, pdf_path)
    gt_path.write_text(gt_text, encoding="utf-8")
    return {
        "filename": filename,
        "type": "Scanned PDF",
        "subtype": "low_blurry_noisy",
        "page_count": 1,
        "characteristics": "Low quality scan with low contrast ink, noise artifacts, and slight blur.",
        "file_path": str(pdf_path.relative_to(BASE_DIR.parent)),
        "ground_truth_path": str(gt_path.relative_to(BASE_DIR.parent)),
    }


def build_dataset():
    create_directories()
    metadata_list = [
        generate_single_column_digital(),
        generate_multi_column_digital(),
        generate_complex_pdf(),
        generate_scanned_high_quality(),
        generate_scanned_medium_skewed(),
        generate_low := generate_scanned_low_blurry_noisy(),
    ]

    metadata_path = BASE_DIR / "dataset_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata_list, f, indent=2, ensure_ascii=False)
    print(f"Generated test dataset with {len(metadata_list)} documents successfully!")


if __name__ == "__main__":
    build_dataset()

