import json
import unittest
from pathlib import Path

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
import sys
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from tests.benchmark_runner import BenchmarkRunner


class TestBenchmarkExecution(unittest.TestCase):
    def setUp(self):
        self.runner = BenchmarkRunner()

    def test_benchmark_run_all(self):
        """1. Chạy thử nghiệm benchmark toàn bộ dataset và kiểm tra xuất báo cáo"""
        reports_dir = Path(__file__).parent / "dataset" / "reports"
        summary = self.runner.run_all(output_dir=reports_dir)

        total_pdfs = len(list((Path(__file__).parent / "dataset").glob("*/*.pdf")))
        self.assertIn("total_documents_tested", summary)
        self.assertEqual(summary["total_documents_tested"], total_pdfs)
        self.assertIn("detailed_reports", summary)
        self.assertEqual(len(summary["detailed_reports"]), total_pdfs)

        # Kiểm tra file báo cáo JSON và CSV đã xuất ra thành công
        json_report = reports_dir / "benchmark_report.json"
        csv_report = reports_dir / "benchmark_report.csv"

        self.assertTrue(json_report.exists(), "Báo cáo JSON không tồn tại.")
        self.assertTrue(csv_report.exists(), "Báo cáo CSV không tồn tại.")
        self.assertGreater(json_report.stat().st_size, 0)
        self.assertGreater(csv_report.stat().st_size, 0)

    def test_report_consistency(self):
        """2. Kiểm tra tính nhất quán giữa các chỉ số báo cáo"""
        reports_dir = Path(__file__).parent / "dataset" / "reports"
        json_report = reports_dir / "benchmark_report.json"

        with open(json_report, "r", encoding="utf-8") as f:
            data = json.load(f)

        for item in data["detailed_reports"]:
            self.assertIn("filename", item)
            self.assertIn("cer", item)
            self.assertIn("wer", item)
            self.assertIn("text_similarity_percentage", item)
            self.assertIn("overall_layout_score", item)
            self.assertIn("overall_translation_score", item)
            self.assertGreaterEqual(item["processing_time_seconds"], 0.0)


if __name__ == "__main__":
    unittest.main()

