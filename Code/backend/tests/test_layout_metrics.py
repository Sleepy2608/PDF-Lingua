import sys
import unittest
from pathlib import Path

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.layout_metrics import (
    calculate_column_order_score,
    calculate_paragraph_structure_score,
    calculate_reading_order_score,
    calculate_table_structure_score,
    evaluate_layout,
)


class TestLayoutEvaluationMetrics(unittest.TestCase):
    def test_single_column_layout(self):
        """1. PDF một cột: Đánh giá hoàn hảo 100% khi trích xuất đúng"""
        ref = (
            "PDF-Lingua Smart Document Extraction\n\n"
            "This is a clean single column layout.\n"
            "Natural reading order flows from top to bottom."
        )
        hyp = ref

        res = evaluate_layout(ref, hyp)
        self.assertEqual(res.reading_order_score, 100.0)
        self.assertEqual(res.paragraph_structure_score, 100.0)
        self.assertEqual(res.column_order_score, 100.0)
        self.assertEqual(res.overall_layout_score, 100.0)

    def test_multi_column_layout(self):
        """2. PDF nhiều cột: Giữ nguyên thứ tự cột 1 trước, cột 2 sau"""
        col1 = "Column 1 Header\n\nFirst section discusses AI pipeline."
        col2 = "Column 2 Header\n\nSecond section discusses Machine Learning."

        ref = f"{col1}\n\n{col2}"
        hyp = f"{col1}\n\n{col2}"

        res = evaluate_layout(ref, hyp)
        self.assertEqual(res.column_order_score, 100.0)
        self.assertEqual(res.reading_order_score, 100.0)

    def test_table_structure_layout(self):
        """3. PDF có bảng: Bảo toàn số hàng và cột của bảng"""
        ref_table = (
            "Financial Balance Table:\n"
            "Item               Q1_Revenue   Q2_Revenue   Growth_Rate\n"
            "Hardware Services  $120,500     $145,200     +20.5%\n"
            "Software Licenses  $340,000     $390,000     +14.7%"
        )
        hyp_table = ref_table

        score = calculate_table_structure_score(ref_table, hyp_table)
        self.assertEqual(score, 100.0)

        # Mất 1 hàng trong bảng
        hyp_missing_row = (
            "Financial Balance Table:\n"
            "Item               Q1_Revenue   Q2_Revenue   Growth_Rate\n"
            "Software Licenses  $340,000     $390,000     +14.7%"
        )
        score_missing = calculate_table_structure_score(ref_table, hyp_missing_row)
        self.assertLess(score_missing, 100.0)

    def test_out_of_order_reading_text(self):
        """4. Văn bản sai thứ tự đọc (ví dụ trích xuất bị đọc đan xen dòng giữa 2 cột)"""
        p1 = "Paragraph A: Introduction to computer science."
        p2 = "Paragraph B: Advanced algorithms and data structures."
        p3 = "Paragraph C: Conclusion and future scope."

        ref = f"{p1}\n\n{p2}\n\n{p3}"
        # Trích xuất bị đảo vị trí đoạn 3 lên đầu
        hyp = f"{p3}\n\n{p1}\n\n{p2}"

        ro_score = calculate_reading_order_score(ref, hyp)
        # Điểm reading order phải giảm do thứ tự bị xáo trộn
        self.assertLess(ro_score, 100.0)

    def test_missing_or_corrupted_paragraph_structure(self):
        """5. Thiếu hoặc gộp mất cấu trúc đoạn (mất ký tự xuống dòng)"""
        ref = (
            "Paragraph One: First statement.\n\n"
            "Paragraph Two: Second statement.\n\n"
            "Paragraph Three: Third statement."
        )
        # Tất cả bị gộp lại thành 1 đoạn duy nhất (mất ngắt dòng)
        hyp = "Paragraph One: First statement. Paragraph Two: Second statement. Paragraph Three: Third statement."

        ps_score = calculate_paragraph_structure_score(ref, hyp)
        self.assertLess(ps_score, 100.0)

    def test_evaluation_result_reusability(self):
        """6. Chuyển đổi dict tái sử dụng cho PDFL-110.5"""
        ref = "Sample text paragraph."
        hyp = "Sample text paragraph."
        res = evaluate_layout(ref, hyp)

        data = res.to_dict()
        self.assertIn("reading_order_score", data)
        self.assertIn("paragraph_structure_score", data)
        self.assertIn("table_structure_score", data)
        self.assertIn("column_order_score", data)
        self.assertIn("overall_layout_score", data)


if __name__ == "__main__":
    unittest.main()

