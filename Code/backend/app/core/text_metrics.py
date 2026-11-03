import re
import unicodedata
from dataclasses import asdict, dataclass
from typing import Any, Sequence


def normalize_text(text: str | None) -> str:
    """
    Chuẩn hóa văn bản trước khi đánh giá:
    - Xử lý an toàn nếu text là None hoặc rỗng.
    - Chuẩn hóa Unicode về dạng NFC (chuẩn dựng sẵn cho tiếng Việt có dấu).
    - Chuẩn hóa ký tự xuống dòng (\r\n -> \n).
    - Chuẩn hóa khoảng trắng: thay thế khoảng trắng/tab thừa liên tiếp thành 1 dấu cách đơn.
    - Loại bỏ khoảng trắng đầu/cuối của từng dòng và toàn chuỗi.
    """
    if text is None:
        return ""

    if not isinstance(text, str):
        text = str(text)

    # 1. Chuẩn hóa Unicode NFC (tổ hợp dấu tiếng Việt thành dựng sẵn)
    text = unicodedata.normalize("NFC", text)

    # 2. Đồng nhất ký tự xuống dòng
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # 3. Chuẩn hóa khoảng trắng ngang (spaces, tabs)
    text = re.sub(r"[ \t]+", " ", text)

    # 4. Chuẩn hóa khoảng trắng trên từng dòng
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(lines)

    # 5. Rút gọn nhiều dòng trống liên tiếp
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def levenshtein_distance(seq1: Sequence[Any], seq2: Sequence[Any]) -> int:
    """
    Tính khoảng cách Levenshtein (Edit Distance) giữa 2 chuỗi hoặc 2 danh sách từ/ký tự.
    Sử dụng quy hoạch động tối ưu bộ nhớ O(min(len(seq1), len(seq2))).
    """
    if seq1 == seq2:
        return 0

    len1, len2 = len(seq1), len(seq2)
    if len1 == 0:
        return len2
    if len2 == 0:
        return len1

    # Đảm bảo seq2 luôn là chuỗi ngắn hơn để tối ưu bộ nhớ
    if len1 < len2:
        seq1, seq2 = seq2, seq1
        len1, len2 = len2, len1

    previous_row = list(range(len2 + 1))
    for i, item1 in enumerate(seq1):
        current_row = [i + 1] + [0] * len2
        for j, item2 in enumerate(seq2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (0 if item1 == item2 else 1)
            current_row[j + 1] = min(insertions, deletions, substitutions)
        previous_row = current_row

    return previous_row[-1]


def calculate_cer(reference: str | None, hypothesis: str | None, normalize: bool = True) -> float:
    """
    Tính Character Error Rate (CER):
    CER = LevenshteinDistance(reference, hypothesis) / len(reference)
    - Nếu cả hai đều rỗng: 0.0
    - Nếu reference rỗng nhưng hypothesis có nội dung: 1.0
    """
    ref = normalize_text(reference) if normalize else (reference or "")
    hyp = normalize_text(hypothesis) if normalize else (hypothesis or "")

    if ref == hyp:
        return 0.0

    ref_len = len(ref)
    if ref_len == 0:
        return 1.0

    dist = levenshtein_distance(ref, hyp)
    return dist / ref_len


def calculate_wer(reference: str | None, hypothesis: str | None, normalize: bool = True) -> float:
    """
    Tính Word Error Rate (WER):
    WER = LevenshteinDistance(reference_words, hypothesis_words) / len(reference_words)
    - Chia từ dựa theo khoảng trắng.
    - Nếu cả hai đều rỗng: 0.0
    - Nếu reference rỗng nhưng hypothesis có nội dung: 1.0
    """
    ref = normalize_text(reference) if normalize else (reference or "")
    hyp = normalize_text(hypothesis) if normalize else (hypothesis or "")

    ref_words = ref.split()
    hyp_words = hyp.split()

    if ref_words == hyp_words:
        return 0.0

    ref_len = len(ref_words)
    if ref_len == 0:
        return 1.0

    dist = levenshtein_distance(ref_words, hyp_words)
    return dist / ref_len


def calculate_text_similarity(reference: str | None, hypothesis: str | None, normalize: bool = True) -> float:
    """
    Tính độ tương đồng văn bản (Text Similarity) theo phần trăm (%):
    Similarity = (1 - LevenshteinDistance(ref, hyp) / max(len(ref), len(hyp))) * 100%
    Giá trị trong khoảng [0.0%, 100.0%].
    """
    ref = normalize_text(reference) if normalize else (reference or "")
    hyp = normalize_text(hypothesis) if normalize else (hypothesis or "")

    if ref == hyp:
        return 100.0

    max_len = max(len(ref), len(hyp))
    if max_len == 0:
        return 100.0

    dist = levenshtein_distance(ref, hyp)
    similarity = max(0.0, (1.0 - (dist / max_len)) * 100.0)
    return round(similarity, 2)


@dataclass
class EvaluationResult:
    """
    Kết quả đánh giá độ chính xác toàn diện, có thể tái sử dụng cho PDFL-110.5.
    """
    reference: str
    hypothesis: str
    char_distance: int
    word_distance: int
    ref_char_count: int
    ref_word_count: int
    hyp_char_count: int
    hyp_word_count: int
    cer: float
    wer: float
    similarity_percentage: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def evaluate_text(
    reference: str | None,
    hypothesis: str | None,
    normalize: bool = True,
) -> EvaluationResult:
    """
    Đánh giá toàn diện văn bản với tất cả các chỉ số (CER, WER, Levenshtein, Similarity).
    """
    ref_norm = normalize_text(reference) if normalize else (reference or "")
    hyp_norm = normalize_text(hypothesis) if normalize else (hypothesis or "")

    char_dist = levenshtein_distance(ref_norm, hyp_norm)

    ref_words = ref_norm.split()
    hyp_words = hyp_norm.split()
    word_dist = levenshtein_distance(ref_words, hyp_words)

    ref_char_count = len(ref_norm)
    hyp_char_count = len(hyp_norm)
    ref_word_count = len(ref_words)
    hyp_word_count = len(hyp_words)

    # CER
    if ref_norm == hyp_norm:
        cer = 0.0
    elif ref_char_count == 0:
        cer = 1.0
    else:
        cer = round(char_dist / ref_char_count, 4)

    # WER
    if ref_words == hyp_words:
        wer = 0.0
    elif ref_word_count == 0:
        wer = 1.0
    else:
        wer = round(word_dist / ref_word_count, 4)

    # Similarity (%)
    max_len = max(ref_char_count, hyp_char_count)
    if max_len == 0 or ref_norm == hyp_norm:
        similarity = 100.0
    else:
        similarity = round(max(0.0, (1.0 - (char_dist / max_len)) * 100.0), 2)

    return EvaluationResult(
        reference=ref_norm,
        hypothesis=hyp_norm,
        char_distance=char_dist,
        word_distance=word_dist,
        ref_char_count=ref_char_count,
        ref_word_count=ref_word_count,
        hyp_char_count=hyp_char_count,
        hyp_word_count=hyp_word_count,
        cer=cer,
        wer=wer,
        similarity_percentage=similarity,
    )

