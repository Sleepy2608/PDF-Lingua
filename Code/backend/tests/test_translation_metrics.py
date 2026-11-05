import sys
import unittest
from pathlib import Path

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.translation_metrics import (
    calculate_bleu_score,
    calculate_semantic_similarity,
    calculate_translation_similarity,
    evaluate_translation,
)


class TestTranslationEvaluationMetrics(unittest.TestCase):
    def test_exact_translation(self):
        """1. Bản dịch chính xác (100% khớp Ground Truth)"""
        gt_vi = "Trí tuệ nhân tạo và dịch thuật đa ngôn ngữ."
        hyp_vi = "Trí tuệ nhân tạo và dịch thuật đa ngôn ngữ."

        res = evaluate_translation(gt_vi, hyp_vi)
        self.assertEqual(res.bleu_score, 100.0)
        self.assertEqual(res.similarity_score, 100.0)
        self.assertEqual(res.semantic_score, 100.0)
        self.assertEqual(res.overall_translation_score, 100.0)

    def test_partially_correct_translation(self):
        """2. Bản dịch sai một phần (đúng ý chính, thay đổi một số từ vựng)"""
        gt_vi = "Hệ thống trích xuất văn bản từ tài liệu PDF thông minh."
        # Thay 'thông minh' -> 'tự động', thiếu từ 'tài liệu'
        hyp_vi = "Hệ thống trích xuất văn bản từ PDF tự động."

        res = evaluate_translation(gt_vi, hyp_vi)
        # Các chỉ số phải nằm trong khoảng hợp lý (không phải 100% nhưng cũng không phải 0%)
        self.assertGreater(res.bleu_score, 30.0)
        self.assertLess(res.bleu_score, 100.0)
        self.assertGreater(res.similarity_score, 60.0)
        self.assertGreater(res.semantic_score, 60.0)
        self.assertGreater(res.overall_translation_score, 50.0)

    def test_completely_wrong_translation(self):
        """3. Bản dịch sai hoàn toàn (nội dung không liên quan)"""
        gt = "Machine learning models require large datasets."
        hyp = "Thời tiết hôm nay tại Hà Nội rất đẹp và có nắng nhẹ."

        res = evaluate_translation(gt, hyp)
        self.assertEqual(res.similarity_score, 0.0)
        self.assertEqual(res.semantic_score, 0.0)
        self.assertLessEqual(res.overall_translation_score, 5.0)

    def test_empty_translation_and_none(self):
        """4. Văn bản rỗng hoặc None"""
        # Cả 2 đều rỗng -> 100%
        res_both_empty = evaluate_translation("", "")
        self.assertEqual(res_both_empty.overall_translation_score, 100.0)

        res_none = evaluate_translation(None, None)
        self.assertEqual(res_none.overall_translation_score, 100.0)

        # 1 bên rỗng, 1 bên có dữ liệu -> 0%
        res_hyp_empty = evaluate_translation("This is a valid reference.", "")
        self.assertEqual(res_hyp_empty.bleu_score, 0.0)
        self.assertEqual(res_hyp_empty.similarity_score, 0.0)
        self.assertEqual(res_hyp_empty.semantic_score, 0.0)

    def test_short_and_long_sentences(self):
        """5. Câu ngắn và câu dài (kiểm tra tính ổn định của Brevity Penalty & Smoothing)"""
        # Câu ngắn (2-3 từ)
        short_gt = "Chào buổi sáng."
        short_hyp = "Chào buổi sáng"
        res_short = evaluate_translation(short_gt, short_hyp)
        self.assertEqual(res_short.similarity_score, 100.0)
        self.assertGreater(res_short.bleu_score, 80.0)

        # Câu dài (đoạn văn học thuật)
        long_gt = (
            "Trích xuất tài liệu thông minh PDF-Lingua là nền tảng hỗ trợ xử lý toàn diện tài liệu PDF "
            "từ tải lên an toàn, bóc tách văn bản số, nhận dạng ký tự quang học đến dịch thuật đa ngôn ngữ."
        )
        long_hyp = long_gt
        res_long = evaluate_translation(long_gt, long_hyp)
        self.assertEqual(res_long.bleu_score, 100.0)
        self.assertEqual(res_long.overall_translation_score, 100.0)

    def test_bilingual_support(self):
        """6. Hỗ trợ cả tiếng Anh và tiếng Việt"""
        # Tiếng Anh
        en_gt = "Deep learning revolutionizes computer vision and natural language processing."
        en_hyp = "Deep learning changes computer vision and natural language processing."
        res_en = evaluate_translation(en_gt, en_hyp)
        self.assertGreater(res_en.overall_translation_score, 70.0)

        # Tiếng Việt
        vi_gt = "Học sâu tạo ra bước đột phá trong thị giác máy tính và xử lý ngôn ngữ tự nhiên."
        vi_hyp = vi_gt
        res_vi = evaluate_translation(vi_gt, vi_hyp)
        self.assertEqual(res_vi.overall_translation_score, 100.0)

    def test_translation_evaluation_result_reusability(self):
        """7. TranslationEvaluationResult có to_dict() tích hợp cho PDFL-110.5"""
        res = evaluate_translation("Sample test", "Sample test")
        data = res.to_dict()

        self.assertIn("bleu_score", data)
        self.assertIn("similarity_score", data)
        self.assertIn("semantic_score", data)
        self.assertIn("overall_translation_score", data)
        self.assertIsInstance(data["overall_translation_score"], float)


if __name__ == "__main__":
    unittest.main()

