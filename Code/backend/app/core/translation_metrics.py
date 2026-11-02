import math
import re
from collections import Counter
from dataclasses import asdict, dataclass
from typing import Any

from app.core.text_metrics import normalize_text


def _tokenize(text: str) -> list[str]:
    """Tách từ văn bản hỗ trợ tiếng Việt và tiếng Anh (bỏ dấu câu, giữ lại từ có nghĩa)"""
    norm = normalize_text(text).lower()
    # Tách từ theo từ ngữ (hỗ trợ ký tự unicode chữ cái tiếng Việt \w)
    tokens = re.findall(r"\b\w+\b", norm, flags=re.UNICODE)
    return tokens


def _get_ngrams(tokens: list[str], n: int) -> Counter[tuple[str, ...]]:
    """Tạo n-gram từ danh sách token"""
    if len(tokens) < n:
        return Counter()
    return Counter(tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1))


def calculate_bleu_score(reference: str, hypothesis: str, max_n: int = 4) -> float:
    """
    Tính BLEU Score chuẩn (0.0 - 100.0) với Brevity Penalty (BP) và Smoothing:
    - Hỗ trợ câu ngắn bằng smoothing (Chen & Cherry Smoothing 1).
    - Phù hợp cho cả tiếng Việt và tiếng Anh.
    """
    ref_tokens = _tokenize(reference)
    hyp_tokens = _tokenize(hypothesis)

    if not ref_tokens and not hyp_tokens:
        return 100.0
    if not ref_tokens or not hyp_tokens:
        return 0.0

    c = len(hyp_tokens)
    r = len(ref_tokens)

    # 1. Brevity Penalty
    if c > r:
        bp = 1.0
    else:
        bp = math.exp(1.0 - (r / c)) if c > 0 else 0.0

    # 2. Modified n-gram precisions
    effective_n = min(max_n, max(1, len(hyp_tokens), len(ref_tokens)))
    precisions: list[float] = []

    for n in range(1, effective_n + 1):
        hyp_ngrams = _get_ngrams(hyp_tokens, n)
        ref_ngrams = _get_ngrams(ref_tokens, n)

        total_hyp = sum(hyp_ngrams.values())
        if total_hyp == 0:
            continue

        # Clipped counts
        overlap = 0
        for ngram, count in hyp_ngrams.items():
            overlap += min(count, ref_ngrams.get(ngram, 0))

        # Smoothing: nếu overlap = 0 trong câu ngắn, dùng smoothing epsilon để tránh log(0)
        if overlap == 0:
            smoothed_p = 1.0 / (2.0 * total_hyp)
        else:
            smoothed_p = overlap / total_hyp
        precisions.append(smoothed_p)

    if not precisions:
        return 0.0

    # Trung bình nhân log
    log_sum = sum((1.0 / len(precisions)) * math.log(p) for p in precisions)
    bleu = bp * math.exp(log_sum) * 100.0
    return round(min(100.0, max(0.0, bleu)), 2)


def calculate_translation_similarity(reference: str, hypothesis: str) -> float:
    """
    Tính Translation Text Similarity (0.0 - 100.0%):
    Đo độ trùng khớp từ vựng (Token Overlap F1-Score) giữa bản dịch và Ground Truth.
    F1 = 2 * (Precision * Recall) / (Precision + Recall)
    """
    ref_tokens = _tokenize(reference)
    hyp_tokens = _tokenize(hypothesis)

    if not ref_tokens and not hyp_tokens:
        return 100.0
    if not ref_tokens or not hyp_tokens:
        return 0.0

    ref_counts = Counter(ref_tokens)
    hyp_counts = Counter(hyp_tokens)

    overlap = sum(min(count, hyp_counts.get(token, 0)) for token, count in ref_counts.items())

    precision = overlap / len(hyp_tokens) if hyp_tokens else 0.0
    recall = overlap / len(ref_tokens) if ref_tokens else 0.0

    if precision + recall == 0:
        return 0.0

    f1 = (2.0 * precision * recall) / (precision + recall) * 100.0
    return round(f1, 2)


def calculate_semantic_similarity(reference: str, hypothesis: str) -> float:
    """
    Tính Semantic Similarity (0.0 - 100.0%):
    Sử dụng Cosine Similarity trên vector trọng số TF-IDF tần suất từ vựng (Word Frequency Vector).
    """
    ref_tokens = _tokenize(reference)
    hyp_tokens = _tokenize(hypothesis)

    if not ref_tokens and not hyp_tokens:
        return 100.0
    if not ref_tokens or not hyp_tokens:
        return 0.0

    vocab = sorted(list(set(ref_tokens + hyp_tokens)))
    if not vocab:
        return 100.0

    ref_counts = Counter(ref_tokens)
    hyp_counts = Counter(hyp_tokens)

    # Vector tần số từ
    vec_ref = [ref_counts.get(w, 0) for w in vocab]
    vec_hyp = [hyp_counts.get(w, 0) for w in vocab]

    dot_product = sum(r * h for r, h in zip(vec_ref, vec_hyp))
    norm_ref = math.sqrt(sum(r * r for r in vec_ref))
    norm_hyp = math.sqrt(sum(h * h for h in vec_hyp))

    if norm_ref == 0 or norm_hyp == 0:
        return 0.0

    cos_sim = (dot_product / (norm_ref * norm_hyp)) * 100.0
    return round(min(100.0, max(0.0, cos_sim)), 2)


@dataclass
class TranslationEvaluationResult:
    """
    Kết quả đánh giá chất lượng bản dịch độc lập, chuẩn hóa dễ tái sử dụng cho PDFL-110.5.
    """
    bleu_score: float
    similarity_score: float
    semantic_score: float
    overall_translation_score: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def evaluate_translation(reference: str | None, hypothesis: str | None) -> TranslationEvaluationResult:
    """
    Hàm điều phối đánh giá chất lượng bản dịch toàn diện.
    """
    ref = reference or ""
    hyp = hypothesis or ""

    bleu = calculate_bleu_score(ref, hyp)
    sim = calculate_translation_similarity(ref, hyp)
    sem = calculate_semantic_similarity(ref, hyp)

    # Điểm tổng hợp chất lượng dịch có trọng số (40% BLEU, 30% Similarity, 30% Semantic)
    overall = round((bleu * 0.4 + sim * 0.3 + sem * 0.3), 2)

    return TranslationEvaluationResult(
        bleu_score=bleu,
        similarity_score=sim,
        semantic_score=sem,
        overall_translation_score=overall,
    )

