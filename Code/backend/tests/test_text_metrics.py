import sys
import unittest
from pathlib import Path

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.text_metrics import (
    calculate_cer,
    calculate_text_similarity,
    calculate_wer,
    evaluate_text,
    levenshtein_distance,
    normalize_text,
)


class TestTextEvaluationMetrics(unittest.TestCase):
    def test_identical_texts(self):
        """1. Hai văn bản giống hệt nhau -> Khoảng cách 0, CER=0, WER=0, Similarity=100%"""
        text = "PDF-Lingua trích xuất văn bản và dịch thuật thông minh."
        res = evaluate_text(text, text)

        self.assertEqual(res.char_distance, 0)
        self.assertEqual(res.word_distance, 0)
        self.assertEqual(res.cer, 0.0)
        self.assertEqual(res.wer, 0.0)
        self.assertEqual(res.similarity_percentage, 100.0)

    def test_character_insert_delete_substitute(self):
        """2. Thêm, xóa, thay thế ký tự"""
        # Thay thế 1 ký tự: 'cat' -> 'hat' (dist=1, CER=1/3)
        self.assertEqual(levenshtein_distance("cat", "hat"), 1)
        self.assertAlmostEqual(calculate_cer("cat", "hat"), 1 / 3, places=2)

        # Thêm 1 ký tự: 'cat' -> 'cats' (dist=1, CER=1/3)
        self.assertEqual(levenshtein_distance("cat", "cats"), 1)
        self.assertAlmostEqual(calculate_cer("cat", "cats"), 1 / 3, places=2)

        # Xóa 1 ký tự: 'cats' -> 'cat' (dist=1, CER=1/4)
        self.assertEqual(levenshtein_distance("cats", "cat"), 1)
        self.assertAlmostEqual(calculate_cer("cats", "cat"), 1 / 4, places=2)

    def test_word_differences(self):
        """3. Sai khác từ: kiểm tra WER và tính độc lập với CER"""
        ref = "Hệ thống trích xuất văn bản tự động"
        # Thay 1 từ: 'tự động' -> 'thông minh'
        hyp = "Hệ thống trích xuất văn bản thông minh"

        res = evaluate_text(ref, hyp)
        # 8 từ tiếng Việt, thay thế 2 từ 'tự động' thành 'thông minh' -> word_distance = 2, WER = 2/8 = 0.25
        self.assertEqual(res.ref_word_count, 8)
        self.assertEqual(res.word_distance, 2)
        self.assertAlmostEqual(res.wer, 2 / 8, places=4)
        # CER tính trên ký tự độc lập với WER
        self.assertNotEqual(res.cer, res.wer)
        self.assertGreater(res.similarity_percentage, 70.0)

    def test_empty_and_none_strings(self):
        """4. Chuỗi rỗng và xử lý an toàn với None"""
        # Cả 2 đều rỗng hoặc None
        self.assertEqual(calculate_cer("", ""), 0.0)
        self.assertEqual(calculate_wer("", ""), 0.0)
        self.assertEqual(calculate_text_similarity("", ""), 100.0)
        self.assertEqual(calculate_cer(None, None), 0.0)

        # Ref có nội dung, hyp rỗng
        res_empty_hyp = evaluate_text("PDF document", "")
        self.assertEqual(res_empty_hyp.char_distance, len("PDF document"))
        self.assertEqual(res_empty_hyp.cer, 1.0)
        self.assertEqual(res_empty_hyp.wer, 1.0)
        self.assertEqual(res_empty_hyp.similarity_percentage, 0.0)

        # Ref rỗng, hyp có nội dung
        res_empty_ref = evaluate_text(None, "PDF document")
        self.assertEqual(res_empty_ref.cer, 1.0)
        self.assertEqual(res_empty_ref.wer, 1.0)
        self.assertEqual(res_empty_ref.similarity_percentage, 0.0)

    def test_vietnamese_accented_normalization(self):
        """5. Văn bản tiếng Việt có dấu (Unicode NFC đối chiếu với tổ hợp ký tự)"""
        # 'Tiếng Việt': dạng dựng sẵn (NFC) vs tổ hợp (NFD)
        import unicodedata
        nfc_text = "Tiếng Việt chuẩn hóa"
        nfd_text = unicodedata.normalize("NFD", nfc_text)

        # Trước khi chuẩn hóa, độ dài byte/code points khác nhau
        self.assertNotEqual(len(nfc_text), len(nfd_text))

        # Sau khi qua hàm đánh giá chuẩn hóa NFC, khoảng cách phải bằng 0 và similarity = 100%
        res = evaluate_text(nfc_text, nfd_text)
        self.assertEqual(res.char_distance, 0)
        self.assertEqual(res.cer, 0.0)
        self.assertEqual(res.wer, 0.0)
        self.assertEqual(res.similarity_percentage, 100.0)

    def test_evaluation_result_reusability(self):
        """6. Kiểm tra cấu trúc EvaluationResult có thể chuyển đổi dict dùng cho PDFL-110.5"""
        ref = "Artificial Intelligence"
        hyp = "Artifical Inteligence"
        res = evaluate_text(ref, hyp)

        data = res.to_dict()
        self.assertIn("cer", data)
        self.assertIn("wer", data)
        self.assertIn("similarity_percentage", data)
        self.assertIn("char_distance", data)
        self.assertIn("word_distance", data)
        self.assertIsInstance(data["cer"], float)
        self.assertIsInstance(data["wer"], float)


if __name__ == "__main__":
    unittest.main()
