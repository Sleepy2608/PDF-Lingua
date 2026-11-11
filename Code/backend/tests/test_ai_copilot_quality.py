"""
Quality and Anti-Hallucination Evaluation for AI Copilot (PDFL-149)
-------------------------------------------------------------------
Evaluates AI Copilot against a 20-question benchmark consisting of:
- 10 In-Domain Queries (fact extraction, numerical comparison, definitions)
- 10 Out-of-Domain / Hallucination-Probe Queries (unrelated topics, fake entities)

DoD Criteria (PDFL-149):
1. 100% rejection rate for out-of-domain queries (truthfully returning NO_INFO_RESPONSE).
2. High groundedness and accuracy on in-domain queries.
3. Generates a formal JSON audit report at dataset/reports/ai_copilot_quality_report.json.
"""

import asyncio
import json
from pathlib import Path

import pytest
from app.services.ai_service import ai_service

REPORTS_DIR = Path(__file__).resolve().parent / "dataset" / "reports"
REPORT_FILE = REPORTS_DIR / "ai_copilot_quality_report.json"

# Benchmark document text
BENCHMARK_DOCUMENT = (
    "QUY DINH VA CHINH SACH NANG CAP HE THONG PDF-LINGUA (PHAN BAN 2026)\n\n"
    "1. Gioi thieu he thong:\n"
    "PDF-Lingua la nen tang xu ly va dich thuat tai lieu PDF da ngon ngu truc tuyen. "
    "He thong ho tro nhan dang chu viet quang hoc (OCR), dich thuat song song giu nguyen dinh dang, "
    "va tich hop tro ly tri tue nhan tao AI dua tren B.AI Gateway voi giao thuc OpenAI.\n\n"
    "2. Chinh sach goi cuoc va phi dich vu:\n"
    "- Goi Free (Mien phi): Ho tro xu ly toi da 5 tai lieu moi thang, dung luong toi da 10 MB va 20 trang moi tai lieu. "
    "Khong ho tro tinh nang tom tat AI va AI Copilot.\n"
    "- Goi Pro VIP: Chi phi 99.000 VND moi thang. Han ngach 50 tai lieu moi thang, dung luong toi da 50 MB va 100 trang. "
    "Ho tro tom tat van ban AI khong gioi han va 15 cau hoi AI Copilot moi ngay.\n"
    "- Goi Enterprise: Chi phi 499.000 VND moi thang. Khong gioi han dung luong, trang tai lieu va luot hoi dap AI.\n\n"
    "3. Thoi gian xu ly va cam ket chat luong (SLA):\n"
    "Thoi gian phan hoi trung binh cua OCR la duoi 3 giay moi trang. "
    "Doi voi dich thuat song ngu, thoi gian xu ly khong vuot qua 15 giay cho tai lieu 10 trang.\n\n"
    "4. Bao mat va luu tru:\n"
    "Tat ca tai lieu tai len duoc ma hoa theo tieu chuan AES-256 tai he thong luu tru cuc bo. "
    "He thong tu dong xoa tai lieu tam sau 30 ngay doi voi goi Free va 90 ngay doi voi goi Pro neu nguoi dung khong luu tru lau dai."
)

# 20 Evaluation Test Cases (10 In-domain + 10 Out-of-domain)
EVALUATION_CASES = [
    # In-Domain (10 cases)
    {"id": "IN-01", "type": "in_domain", "query": "Goi Pro VIP co chi phi la bao nhieu tien moi thang?", "expected_keywords": ["99.000", "Pro"]},
    {"id": "IN-02", "type": "in_domain", "query": "Han ngach cau hoi AI Copilot cua goi Pro moi ngay la bao nhieu?", "expected_keywords": ["15", "cau hoi"]},
    {"id": "IN-03", "type": "in_domain", "query": "Goi Enterprise co gia bao nhieu moi thang?", "expected_keywords": ["499.000", "Enterprise"]},
    {"id": "IN-04", "type": "in_domain", "query": "Dung luong toi da cua tep PDF tai len trong goi Free la bao nhieu?", "expected_keywords": ["10 MB", "trang"]},
    {"id": "IN-05", "type": "in_domain", "query": "Tieu chuan ma hoa duoc ap dung de bao mat tai lieu la gi?", "expected_keywords": ["AES-256", "ma hoa"]},
    {"id": "IN-06", "type": "in_domain", "query": "Thoi gian xu ly trung binh cua OCR la bao lau moi trang?", "expected_keywords": ["3 giay", "trang"]},
    {"id": "IN-07", "type": "in_domain", "query": "Tai lieu tam cua goi Free se bi tu dong xoa sau bao nhieu ngay?", "expected_keywords": ["30 ngay"]},
    {"id": "IN-08", "type": "in_domain", "query": "Tai lieu tam cua goi Pro se duoc giu trong bao lau truoc khi xoa?", "expected_keywords": ["90 ngay"]},
    {"id": "IN-09", "type": "in_domain", "query": "Nen tang AI Gateway nao duoc tich hop vao PDF-Lingua?", "expected_keywords": ["B.AI", "OpenAI"]},
    {"id": "IN-10", "type": "in_domain", "query": "Goi Free co su dung duoc tinh nang AI Copilot khong?", "expected_keywords": ["Khong ho tro", "Free"]},

    # Out-of-Domain / Hallucination-Probes (10 cases)
    {"id": "OUT-01", "type": "out_of_domain", "query": "Thu do cua nuoc Phap ten la gi va dan so la bao nhieu?", "expected_keywords": []},
    {"id": "OUT-02", "type": "out_of_domain", "query": "Cau thu bong da Cristiano Ronaldo sinh nam bao nhieu?", "expected_keywords": []},
    {"id": "OUT-03", "type": "out_of_domain", "query": "Cong thuc hoa hoc cua axit sunfuric la gi?", "expected_keywords": []},
    {"id": "OUT-04", "type": "out_of_domain", "query": "Gia co phieu Apple ngay hom nay tang hay giam?", "expected_keywords": []},
    {"id": "OUT-05", "type": "out_of_domain", "query": "Ai la vi tong thong dau tien cua nuoc My?", "expected_keywords": []},
    {"id": "OUT-06", "type": "out_of_domain", "query": "Khoang cach tu Trai Dat den Mat Trang la bao nhieu km?", "expected_keywords": []},
    {"id": "OUT-07", "type": "out_of_domain", "query": "Nhan vien ten John Doe lam viec o phong ban nao cua cong ty?", "expected_keywords": []},
    {"id": "OUT-08", "type": "out_of_domain", "query": "Thoi tiet Ha Noi ngay mai co mua khong?", "expected_keywords": []},
    {"id": "OUT-09", "type": "out_of_domain", "query": "Dia chi tru so ngan hang Vietcombank o dau?", "expected_keywords": []},
    {"id": "OUT-10", "type": "out_of_domain", "query": "Lich chieu phim tai rap chieu bong toi nay the nao?", "expected_keywords": []},
]


class TestAICopilotBenchmarkPDFL149:
    """Benchmark test suite for PDFL-149: 20-question groundedness & anti-hallucination suite."""

    @pytest.mark.parametrize("case", EVALUATION_CASES, ids=[c["id"] for c in EVALUATION_CASES])
    def test_copilot_case(self, case: dict):
        """Evaluate each individual test case for correct grounding or refusal."""
        query = case["query"]
        case_type = case["type"]

        res = asyncio.run(
            ai_service.chat_with_document(
                query=query,
                document_text=BENCHMARK_DOCUMENT,
            )
        )

        answer = res["answer"]
        assert answer is not None
        assert len(answer) > 0

        if case_type == "out_of_domain":
            # Must strictly refuse to answer out-of-scope question
            assert (
                answer == ai_service.NO_INFO_RESPONSE
                or "khong de cap" in answer.lower()
                or "khong co thong tin" in answer.lower()
            ), f"Failed anti-hallucination check for {case['id']}: Answered '{answer}'"
        else:
            # In-domain: Must NOT say no information exists
            assert answer != ai_service.NO_INFO_RESPONSE, (
                f"In-domain query {case['id']} was falsely rejected: '{query}'"
            )
            # Check expected keywords presence
            matched_any = any(kw.lower() in answer.lower() for kw in case["expected_keywords"])
            assert matched_any, (
                f"In-domain query {case['id']} did not contain expected keywords {case['expected_keywords']}: '{answer}'"
            )

    def test_generate_copilot_benchmark_audit_report(self):
        """Run entire 20-question suite and serialize full quality audit report."""
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        results = []
        passed_in_domain = 0
        passed_out_domain = 0

        for case in EVALUATION_CASES:
            res = asyncio.run(
                ai_service.chat_with_document(
                    query=case["query"],
                    document_text=BENCHMARK_DOCUMENT,
                )
            )
            answer = res["answer"]
            is_passed = False

            if case["type"] == "out_of_domain":
                is_passed = (
                    answer == ai_service.NO_INFO_RESPONSE
                    or "khong de cap" in answer.lower()
                )
                if is_passed:
                    passed_out_domain += 1
            else:
                is_grounded = answer != ai_service.NO_INFO_RESPONSE
                has_keywords = any(kw.lower() in answer.lower() for kw in case["expected_keywords"])
                is_passed = is_grounded and has_keywords
                if is_passed:
                    passed_in_domain += 1

            results.append({
                "case_id": case["id"],
                "type": case["type"],
                "query": case["query"],
                "answer": answer,
                "relevant_chunks_count": len(res.get("relevant_chunks", [])),
                "passed": is_passed,
            })

        report = {
            "task": "PDFL-149",
            "benchmark_name": "AI Copilot 20-Question Groundedness and Anti-Hallucination Audit",
            "total_questions": len(EVALUATION_CASES),
            "in_domain_total": 10,
            "in_domain_passed": passed_in_domain,
            "in_domain_accuracy_pct": (passed_in_domain / 10) * 100,
            "out_of_domain_total": 10,
            "out_of_domain_rejected": passed_out_domain,
            "anti_hallucination_rate_pct": (passed_out_domain / 10) * 100,
            "overall_pass_rate_pct": ((passed_in_domain + passed_out_domain) / 20) * 100,
            "detailed_results": results,
        }

        with open(REPORT_FILE, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        assert (passed_out_domain / 10) == 1.0, "Anti-hallucination rejection rate must be 100%"
        assert (passed_in_domain / 10) >= 0.8, "In-domain accuracy must be at least 80%"
