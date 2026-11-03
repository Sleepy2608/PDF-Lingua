import re
from dataclasses import asdict, dataclass
from typing import Any

from app.core.text_metrics import levenshtein_distance, normalize_text


def _split_paragraphs(text: str) -> list[str]:
    """Tách văn bản thành danh sách các đoạn (paragraphs) theo ký tự xuống dòng kép \\n\\n hoặc \\n"""
    norm = normalize_text(text)
    if not norm:
        return []
    # Tách đoạn theo khoảng trắng dòng
    raw_paras = re.split(r"\n\s*\n", norm)
    paragraphs = [p.strip() for p in raw_paras if p.strip()]
    if not paragraphs:
        paragraphs = [line.strip() for line in norm.split("\n") if line.strip()]
    return paragraphs


def calculate_reading_order_score(reference: str, hypothesis: str) -> float:
    """
    Tính điểm Reading Order (0.0 - 100.0%):
    Đo lường mức độ tuân thủ thứ tự đọc giữa văn bản trích xuất và Ground Truth.
    Sử dụng thuật toán Longest Common Subsequence (LCS) / Relative Rank Correlation
    trên các đoạn văn bản (paragraphs).
    """
    ref_paras = _split_paragraphs(reference)
    hyp_paras = _split_paragraphs(hypothesis)

    if not ref_paras and not hyp_paras:
        return 100.0
    if not ref_paras or not hyp_paras:
        return 0.0

    # Khớp từng đoạn trong hyp_paras với đoạn tương ứng nhất trong ref_paras
    matched_indices: list[int] = []
    used_ref_indices: set[int] = set()

    for hyp_p in hyp_paras:
        best_match_idx = -1
        best_sim = -1.0
        for i, ref_p in enumerate(ref_paras):
            if i in used_ref_indices:
                continue
            max_len = max(len(hyp_p), len(ref_p))
            if max_len == 0:
                sim = 1.0
            else:
                dist = levenshtein_distance(hyp_p, ref_p)
                sim = 1.0 - (dist / max_len)

            if sim > best_sim and sim >= 0.3:  # Ngưỡng khớp tương đồng tối thiểu 30%
                best_sim = sim
                best_match_idx = i

        if best_match_idx != -1:
            matched_indices.append(best_match_idx)
            used_ref_indices.add(best_match_idx)

    if len(matched_indices) <= 1:
        return 100.0 if len(matched_indices) == len(ref_paras) else round((len(matched_indices) / len(ref_paras)) * 100.0, 2)

    # Tính số lượng cặp thứ tự đúng (Inversion / Concordant Pairs Count)
    correct_pairs = 0
    total_pairs = 0
    for i in range(len(matched_indices)):
        for j in range(i + 1, len(matched_indices)):
            total_pairs += 1
            if matched_indices[i] < matched_indices[j]:
                correct_pairs += 1

    score = (correct_pairs / total_pairs) * 100.0 if total_pairs > 0 else 100.0
    return round(score, 2)


def calculate_paragraph_structure_score(reference: str, hypothesis: str) -> float:
    """
    Tính điểm Paragraph Structure (0.0 - 100.0%):
    Đánh giá tỷ lệ bảo toàn cấu trúc phân đoạn (số đoạn, độ dài từng đoạn).
    """
    ref_paras = _split_paragraphs(reference)
    hyp_paras = _split_paragraphs(hypothesis)

    if not ref_paras and not hyp_paras:
        return 100.0
    if not ref_paras or not hyp_paras:
        return 0.0

    count_diff = abs(len(ref_paras) - len(hyp_paras))
    count_score = max(0.0, 1.0 - (count_diff / max(len(ref_paras), len(hyp_paras))))

    # Đánh giá tương đồng độ dài giữa các đoạn khớp
    min_len = min(len(ref_paras), len(hyp_paras))
    match_scores: list[float] = []
    for i in range(min_len):
        len_ref = len(ref_paras[i])
        len_hyp = len(hyp_paras[i])
        max_l = max(len_ref, len_hyp)
        if max_l == 0:
            match_scores.append(1.0)
        else:
            match_scores.append(1.0 - (abs(len_ref - len_hyp) / max_l))

    avg_match = sum(match_scores) / len(match_scores) if match_scores else 0.0
    final_score = (count_score * 0.4 + avg_match * 0.6) * 100.0
    return round(final_score, 2)


def calculate_table_structure_score(reference: str, hypothesis: str) -> float:
    """
    Tính điểm Table Structure (0.0 - 100.0%):
    Đánh giá khả năng giữ cấu trúc bảng biểu (hàng, cột, phân cách ký tự).
    """
    ref_lines = [l.strip() for l in normalize_text(reference).split("\n") if l.strip()]
    hyp_lines = [l.strip() for l in normalize_text(hypothesis).split("\n") if l.strip()]

    # Tìm các hàng bảng biểu (chứa nhiều khoảng trắng cách cột hoặc thanh phân cách |, +)
    def is_table_row(line: str) -> bool:
        return "|" in line or "+" in line or len(re.split(r"\s{2,}", line)) >= 2

    ref_table_rows = [l for l in ref_lines if is_table_row(l)]
    hyp_table_rows = [l for l in hyp_lines if is_table_row(l)]

    if not ref_table_rows and not hyp_table_rows:
        return 100.0
    if not ref_table_rows or not hyp_table_rows:
        return 0.0

    # Tỷ lệ số hàng bảng bảo toàn
    row_count_ratio = min(len(ref_table_rows), len(hyp_table_rows)) / max(len(ref_table_rows), len(hyp_table_rows))

    # Tỷ lệ bảo toàn số cột trên từng hàng
    col_scores: list[float] = []
    min_r = min(len(ref_table_rows), len(hyp_table_rows))
    for i in range(min_r):
        ref_cols = [c.strip() for c in re.split(r"[|\t]|\s{2,}", ref_table_rows[i]) if c.strip()]
        hyp_cols = [c.strip() for c in re.split(r"[|\t]|\s{2,}", hyp_table_rows[i]) if c.strip()]
        max_c = max(len(ref_cols), len(hyp_cols))
        if max_c == 0:
            col_scores.append(1.0)
        else:
            col_scores.append(1.0 - (abs(len(ref_cols) - len(hyp_cols)) / max_c))

    avg_col_score = sum(col_scores) / len(col_scores) if col_scores else 0.0
    final_score = (row_count_ratio * 0.5 + avg_col_score * 0.5) * 100.0
    return round(final_score, 2)


def calculate_column_order_score(reference: str, hypothesis: str) -> float:
    """
    Tính điểm Column Order (0.0 - 100.0%):
    Đánh giá khả năng bóc tách chuẩn thứ tự văn bản đa cột (không bị đọc nhảy ngang rãnh cột).
    """
    ref_norm = normalize_text(reference)
    hyp_norm = normalize_text(hypothesis)

    if not ref_norm and not hyp_norm:
        return 100.0
    if not ref_norm or not hyp_norm:
        return 0.0

    # Chia văn bản thành các khối lớn
    ref_paras = _split_paragraphs(ref_norm)
    hyp_paras = _split_paragraphs(hyp_norm)

    if len(ref_paras) <= 1:
        # Nếu tài liệu đơn cột, điểm column order tuân theo độ tương đồng chuỗi
        dist = levenshtein_distance(ref_norm, hyp_norm)
        max_l = max(len(ref_norm), len(hyp_norm))
        return round((1.0 - (dist / max_l)) * 100.0, 2) if max_l > 0 else 100.0

    # Đánh giá thứ tự xuất hiện các đoạn cột chính
    return calculate_reading_order_score(reference, hypothesis)


@dataclass
class LayoutEvaluationResult:
    """
    Kết quả đánh giá Layout độc lập, chuẩn hóa điểm số dễ tái sử dụng cho PDFL-110.5.
    """
    reading_order_score: float
    paragraph_structure_score: float
    table_structure_score: float
    column_order_score: float
    overall_layout_score: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def evaluate_layout(reference: str | None, hypothesis: str | None) -> LayoutEvaluationResult:
    """
    Hàm điều phối đánh giá toàn diện Layout văn bản.
    """
    ref = reference or ""
    hyp = hypothesis or ""

    ro_score = calculate_reading_order_score(ref, hyp)
    ps_score = calculate_paragraph_structure_score(ref, hyp)
    ts_score = calculate_table_structure_score(ref, hyp)
    co_score = calculate_column_order_score(ref, hyp)

    # Điểm tổng hợp layout trung bình có trọng số
    overall = round((ro_score * 0.3 + ps_score * 0.25 + ts_score * 0.2 + co_score * 0.25), 2)

    return LayoutEvaluationResult(
        reading_order_score=ro_score,
        paragraph_structure_score=ps_score,
        table_structure_score=ts_score,
        column_order_score=co_score,
        overall_layout_score=overall,
    )

