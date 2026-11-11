"""
Unit tests for AIService (AI Summarization via B.AI API Gateway)
-----------------------------------------------------------------
Validates prompt engineering, styles (brief, bullets, detailed),
Map-Reduce chunking for long texts, mock fallback, and exception handling.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from app.services import AIService as ExportedAIService
from app.services import ai_service as exported_module
from app.services.ai_service import AIService, ai_service


class TestAIServiceInitialization:
    """Test AIService initialization and configuration parameters."""

    def test_default_initialization(self):
        service = AIService()
        assert service.default_model == "gpt-5-mini"
        assert service.base_url == "https://api.b.ai/v1"

    def test_custom_initialization(self):
        service = AIService(
            api_key="custom-key-123",
            base_url="https://custom.endpoint.com/v1/",
            default_model="claude-3-haiku",
        )
        assert service.api_key == "custom-key-123"
        assert service.base_url == "https://custom.endpoint.com/v1"
        assert service.default_model == "claude-3-haiku"

    def test_exported_singleton(self):
        assert isinstance(ai_service, AIService)
        assert ExportedAIService is AIService
        assert exported_module.ai_service is ai_service


class TestPromptConstruction:
    """Test prompt building across styles, lengths, and custom instructions."""

    def test_prompt_brief_style(self):
        service = AIService()
        prompt = service._build_summarize_prompt(
            text="Van ban mau ve tri tue nhan tao.",
            style="brief",
            length="short",
        )
        assert "2 den 3 cau" in prompt
        assert "50 - 100 tu" in prompt
        assert "Van ban mau ve tri tue nhan tao." in prompt

    def test_prompt_bullets_style(self):
        service = AIService()
        prompt = service._build_summarize_prompt(
            text="Van ban mau.",
            style="bullets",
            length="medium",
        )
        assert "5 den 7 y chinh" in prompt
        assert "150 - 300 tu" in prompt

    def test_prompt_detailed_style(self):
        service = AIService()
        prompt = service._build_summarize_prompt(
            text="Van ban mau.",
            style="detailed",
            length="long",
        )
        assert "### 1. Tong quan & Muc tieu" in prompt
        assert "400 - 600 tu" in prompt

    def test_prompt_with_custom_instruction(self):
        service = AIService()
        prompt = service._build_summarize_prompt(
            text="Van ban mau.",
            style="brief",
            custom_instruction="Nhan manh vao chi phi va loat so lieu.",
        )
        assert "Yeu cau bo sung: Nhan manh vao chi phi va loat so lieu." in prompt


class TestTextChunking:
    """Test text chunking logic for Map-Reduce processing."""

    def test_empty_text_chunking(self):
        service = AIService()
        assert service._split_into_chunks("") == []
        assert service._split_into_chunks("   \n\n  ") == []

    def test_short_text_single_chunk(self):
        service = AIService()
        text = "Doan van ban ngan 1.\n\nDoan van ban ngan 2."
        chunks = service._split_into_chunks(text, max_words=50)
        assert len(chunks) == 1
        assert "Doan van ban ngan 1." in chunks[0]
        assert "Doan van ban ngan 2." in chunks[0]

    def test_long_text_multiple_chunks(self):
        service = AIService()
        paragraphs = [f"Day la doan van ban thu {i} co noi dung dai lap di lap lai de kiem tra chunking." for i in range(20)]
        text = "\n\n".join(paragraphs)

        chunks = service._split_into_chunks(text, max_words=40)
        assert len(chunks) > 1
        # All words should be preserved across chunks
        total_words_original = len(text.split())
        total_words_chunks = sum(len(c.split()) for c in chunks)
        assert total_words_chunks == total_words_original


class TestOfflineMockSummary:
    """Test deterministic offline fallback summary generation."""

    def test_mock_brief_summary(self):
        service = AIService()
        sample_text = (
            "PDF-Lingua la he thong xu ly tai lieu thong minh. "
            "Ung dung ho tro OCR va dich thuat da ngon ngu. "
            "Phien ban Pro tich hop them tinh nang tom tat bang tri tue nhan tao. "
            "Nguoi dung co the xuat file dinh dang PDF hoac TXT mot cach tien loi."
        )
        summary = service._generate_mock_summary(sample_text, style="brief")
        assert len(summary) > 0
        assert "PDF-Lingua la he thong xu ly tai lieu" in summary

    def test_mock_bullets_summary(self):
        service = AIService()
        sample_text = (
            "Cau 1 ve tinh nang OCR chuyen sau tren tai lieu quet. "
            "Cau 2 ve kha nang dich thuat voi 10 ngon ngu pho bien. "
            "Cau 3 ve bao mat du lieu va phan quyen nguoi dung theo chuan JWT. "
            "Cau 4 ve he thong quan ly goi cuoc Free va Pro linh hoat."
        )
        summary = service._generate_mock_summary(sample_text, style="bullets")
        assert "•" in summary
        lines = [line for line in summary.split("\n") if line.startswith("•")]
        assert len(lines) >= 3

    def test_mock_detailed_summary(self):
        service = AIService()
        sample_text = (
            "Tong quan du an PDF-Lingua giup tu dong hoa quy trinh xu ly tai lieu. "
            "Diem trong tam gom nhan dang quang hoc, dich thuat truc tuyen va tom tat AI. "
            "Ket luan he thong dap ung tot yeu cau ky thuat va toi uu chi phi van hanh."
        )
        summary = service._generate_mock_summary(sample_text, style="detailed")
        assert "### 1. Tong quan & Muc tieu" in summary
        assert "### 2. Cac diem trong tam & Phan tich chi tiet" in summary
        assert "### 3. Ket luan & Khuyen nghi" in summary


class TestAIServiceSummarizeExecution:
    """Test full summarize_text method with mocked API responses and error flows."""

    def test_empty_text_returns_empty_summary(self):
        service = AIService()
        result = asyncio.run(service.summarize_text(""))
        assert result["summary"] == ""
        assert result["word_count"] == 0
        assert result["fallback_used"] is False

    def test_successful_bai_api_call(self):
        service = AIService(api_key="valid-key")
        mock_response_data = {
            "choices": [
                {
                    "message": {
                        "content": "Day la ban tom tat truc tiep tu mo hinh GPT-5-mini cua B.AI."
                    }
                }
            ]
        }

        mock_http_response = MagicMock()
        mock_http_response.status_code = 200
        mock_http_response.json.return_value = mock_response_data
        mock_http_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_http_response

            result = asyncio.run(
                service.summarize_text(
                    text="Noi dung van ban can tom tat tren he thong.",
                    style="brief",
                    length="medium",
                )
            )

            assert result["fallback_used"] is False
            assert "Day la ban tom tat truc tiep tu mo hinh GPT-5-mini" in result["summary"]
            assert result["model_used"] == "gpt-5-mini"
            assert result["style"] == "brief"
            assert result["length"] == "medium"
            assert result["word_count"] > 0
            mock_post.assert_called_once()

    def test_credit_insufficient_triggers_fallback(self):
        service = AIService(api_key="zero-balance-key")

        mock_request = httpx.Request("POST", "https://api.b.ai/v1/chat/completions")
        mock_response = httpx.Response(
            status_code=400,
            text='{"error": "credit insufficient balance: balance=0"}',
            request=mock_request,
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.HTTPStatusError(
                message="400 Bad Request",
                request=mock_request,
                response=mock_response,
            )

            sample_text = (
                "Doan 1: Cong nghe nhan dang van ban OCR giup bóc tách dữ liệu nhanh. "
                "Doan 2: Tinh nang tich hop dich thuat giup tiet kiem thoi gian nghien cuu. "
                "Doan 3: Phan he tom tat AI giup nguoi doc nam bat y chinh nhanh chong."
            )

            result = asyncio.run(
                service.summarize_text(
                    text=sample_text,
                    style="bullets",
                    length="medium",
                )
            )

            assert result["fallback_used"] is True
            assert "credit balance is 0" in result["fallback_reason"]
            assert "•" in result["summary"]
            assert result["word_count"] > 0

    def test_network_timeout_triggers_fallback(self):
        service = AIService(api_key="valid-key")

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.TimeoutException("Connection timed out after 60s")

            sample_text = (
                "Doan van ban thu nghiem khi mang bi timeout. "
                "He thong van phai tra ve ket qua tom tat mau de UI khong bi treo."
            )

            result = asyncio.run(
                service.summarize_text(
                    text=sample_text,
                    style="brief",
                )
            )

            assert result["fallback_used"] is True
            assert "timed out" in result["fallback_reason"].lower()
            assert len(result["summary"]) > 0

    def test_map_reduce_for_long_document(self):
        service = AIService(api_key="valid-key")
        # Lower threshold for unit test verification
        service.MAP_REDUCE_THRESHOLD_WORDS = 50
        service.CHUNK_SIZE_WORDS = 25

        words = ["TuKhoa" for _ in range(80)]
        long_text = " ".join(words)

        mock_response_data = {
            "choices": [
                {
                    "message": {
                        "content": "Ban tom tat tong hop sau qua trinh Map-Reduce thanh cong."
                    }
                }
            ]
        }
        mock_http_response = MagicMock()
        mock_http_response.status_code = 200
        mock_http_response.json.return_value = mock_response_data
        mock_http_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_http_response

            result = asyncio.run(
                service.summarize_text(
                    text=long_text,
                    style="detailed",
                )
            )

            assert result["fallback_used"] is False
            assert "Ban tom tat tong hop sau qua trinh Map-Reduce" in result["summary"]
            # Expect multiple calls (at least 2 map calls + 1 reduce call)
            assert mock_post.call_count >= 3
