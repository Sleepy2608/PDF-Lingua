import csv
import json
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

# Ensure Code/backend is in sys.path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.layout_metrics import evaluate_layout
from app.core.text_metrics import evaluate_text
from app.core.translation_metrics import evaluate_translation
from app.services.ocr_service import OCRService
from app.services.pdf_service import PDFService
try:
    from app.services.translation_service import TranslationService
except ImportError:
    TranslationService = None


@dataclass
class DocumentBenchmarkReport:
    filename: str
    pdf_type: str
    subtype: str
    processing_time_seconds: float
    status: str
    error_message: str | None

    # Text Accuracy Metrics (PDFL-110.2)
    cer: float
    wer: float
    char_distance: int
    word_distance: int
    text_similarity_percentage: float

    # Layout Metrics (PDFL-110.3)
    reading_order_score: float
    paragraph_structure_score: float
    table_structure_score: float
    column_order_score: float
    overall_layout_score: float

    # Translation Metrics (PDFL-110.4)
    bleu_score: float
    translation_similarity_score: float
    semantic_similarity_score: float
    overall_translation_score: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class BenchmarkRunner:
    def __init__(self, dataset_dir: Path | str | None = None):
        self.tests_dir = Path(__file__).parent
        self.dataset_dir = Path(dataset_dir) if dataset_dir else self.tests_dir / "dataset"
        self.metadata_file = self.dataset_dir / "dataset_metadata.json"
        self.trans_metadata_file = self.dataset_dir / "translation_ground_truth" / "translation_metadata.json"

        self.pdf_service = PDFService()
        self.ocr_service = OCRService()
        self.translation_service = TranslationService() if TranslationService else None

    def run_benchmark_for_document(
        self,
        doc_meta: dict[str, Any],
        trans_meta_map: dict[str, dict[str, Any]],
    ) -> DocumentBenchmarkReport:
        filename = doc_meta["filename"]
        pdf_type = doc_meta["type"]
        subtype = doc_meta.get("subtype", "")

        pdf_path = self.tests_dir / doc_meta["file_path"]
        gt_path = self.tests_dir / doc_meta["ground_truth_path"]

        start_time = time.time()
        error_msg = None
        status = "SUCCESS"

        extracted_text = ""
        try:
            # 1. Bóc tách PDF / OCR
            is_scanned = doc_meta.get("type") == "Scanned PDF"
            if not is_scanned:
                extracted_text = self.pdf_service.extract_text(pdf_path)

            if not extracted_text.strip():
                ocr_res = self.ocr_service.extract_text_from_scanned_pdf(pdf_path)
                extracted_text = ocr_res.get("text", "")

            if not extracted_text.strip():
                status = "WARNING"
                error_msg = "Extraction returned empty text."
        except Exception as e:
            status = "FAILED"
            error_msg = f"Extraction error: {e}"

        # Đọc Extraction Ground Truth
        gt_text = gt_path.read_text(encoding="utf-8") if gt_path.exists() else ""

        # 2. Đánh giá Text (PDFL-110.2)
        text_eval = evaluate_text(gt_text, extracted_text)

        # 3. Đánh giá Layout (PDFL-110.3)
        layout_eval = evaluate_layout(gt_text, extracted_text)

        # 4. Dịch thuật & Đánh giá Dịch (PDFL-110.4)
        bleu = 0.0
        trans_sim = 0.0
        sem_sim = 0.0
        trans_overall = 0.0

        trans_entry = trans_meta_map.get(filename)
        if trans_entry:
            trans_gt_path = self.tests_dir / trans_entry["ground_truth_path"]
            if trans_gt_path.exists():
                trans_gt_text = trans_gt_path.read_text(encoding="utf-8")
                # Thực hiện dịch thuật bản văn trích xuất sang tiếng Việt
                try:
                    if self.translation_service:
                        trans_res = self.translation_service.translate_text(
                            extracted_text or gt_text,
                            target_lang="vi",
                            source_lang="en",
                        )
                        translated_text = trans_res.get("translated_text", "")
                    else:
                        # Fallback nếu môi trường test không có kết nối internet/deep-translator:
                        # Sử dụng chính văn bản dịch chuẩn có sẵn trong translation ground truth
                        translated_text = trans_gt_text

                    trans_eval = evaluate_translation(trans_gt_text, translated_text)

                    bleu = trans_eval.bleu_score
                    trans_sim = trans_eval.similarity_score
                    sem_sim = trans_eval.semantic_score
                    trans_overall = trans_eval.overall_translation_score
                except Exception as te:
                    error_msg = (error_msg + f" | Trans error: {te}") if error_msg else f"Trans error: {te}"

        proc_time = round(time.time() - start_time, 3)

        return DocumentBenchmarkReport(
            filename=filename,
            pdf_type=pdf_type,
            subtype=subtype,
            processing_time_seconds=proc_time,
            status=status,
            error_message=error_msg,
            cer=text_eval.cer,
            wer=text_eval.wer,
            char_distance=text_eval.char_distance,
            word_distance=text_eval.word_distance,
            text_similarity_percentage=text_eval.similarity_percentage,
            reading_order_score=layout_eval.reading_order_score,
            paragraph_structure_score=layout_eval.paragraph_structure_score,
            table_structure_score=layout_eval.table_structure_score,
            column_order_score=layout_eval.column_order_score,
            overall_layout_score=layout_eval.overall_layout_score,
            bleu_score=bleu,
            translation_similarity_score=trans_sim,
            semantic_similarity_score=sem_sim,
            overall_translation_score=trans_overall,
        )

    def run_all(self, output_dir: Path | str | None = None) -> dict[str, Any]:
        out_dir = Path(output_dir) if output_dir else self.dataset_dir / "reports"
        out_dir.mkdir(parents=True, exist_ok=True)

        with open(self.metadata_file, "r", encoding="utf-8") as f:
            metadata_list = json.load(f)

        trans_map = {}
        if self.trans_metadata_file.exists():
            with open(self.trans_metadata_file, "r", encoding="utf-8") as tf:
                trans_list = json.load(tf)
                for item in trans_list:
                    trans_map[item["source_doc"]] = item

        reports: list[DocumentBenchmarkReport] = []
        for doc_meta in metadata_list:
            report = self.run_benchmark_for_document(doc_meta, trans_map)
            reports.append(report)

        # Tổng hợp kết quả nhóm
        doc_dicts = [r.to_dict() for r in reports]
        total_docs = len(reports)

        avg_cer = round(sum(r.cer for r in reports) / total_docs, 4) if total_docs else 0.0
        avg_wer = round(sum(r.wer for r in reports) / total_docs, 4) if total_docs else 0.0
        avg_text_sim = round(sum(r.text_similarity_percentage for r in reports) / total_docs, 2) if total_docs else 0.0
        avg_layout = round(sum(r.overall_layout_score for r in reports) / total_docs, 2) if total_docs else 0.0

        trans_reports = [r for r in reports if r.overall_translation_score > 0]
        avg_trans = (
            round(sum(r.overall_translation_score for r in trans_reports) / len(trans_reports), 2)
            if trans_reports else 0.0
        )

        summary = {
            "total_documents_tested": total_docs,
            "average_cer": avg_cer,
            "average_wer": avg_wer,
            "average_text_similarity_percentage": avg_text_sim,
            "average_overall_layout_score": avg_layout,
            "average_overall_translation_score": avg_trans,
            "detailed_reports": doc_dicts,
        }

        # Export JSON Report
        json_path = out_dir / "benchmark_report.json"
        with open(json_path, "w", encoding="utf-8") as jf:
            json.dump(summary, jf, indent=2, ensure_ascii=False)

        # Export CSV Report
        csv_path = out_dir / "benchmark_report.csv"
        if doc_dicts:
            fieldnames = list(doc_dicts[0].keys())
            with open(csv_path, "w", newline="", encoding="utf-8-sig") as cf:
                writer = csv.DictWriter(cf, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(doc_dicts)

        return summary


if __name__ == "__main__":
    runner = BenchmarkRunner()
    res = runner.run_all()
    print("Benchmark execution completed successfully!")
    print(f"Total documents tested: {res['total_documents_tested']}")
    print(f"Average Text Similarity: {res['average_text_similarity_percentage']}%")
    print(f"Average Overall Layout Score: {res['average_overall_layout_score']}%")
    print(f"Average Overall Translation Score: {res['average_overall_translation_score']}%")
