"""
AI Service Module for PDF-Lingua
---------------------------------
Handles AI-powered document summarization and chat assistance via B.AI Multi-model Gateway
(OpenAI-compatible /v1/chat/completions protocol).
Supports 3 summarization styles (brief, bullets, detailed), 3 length presets (short, medium, long),
Map-Reduce chunking for long documents, and an intelligent offline fallback mechanism
when external API credits are exhausted or network is unavailable.
"""

import asyncio
import re
import time
from typing import Any

import httpx

from app.core.config import settings
from app.core.logger import logger


class AIService:
    """Service class for AI-powered text summarization and document intelligence."""

    DEFAULT_MODEL: str = "gpt-5-mini"
    MAP_REDUCE_THRESHOLD_WORDS: int = 3000
    CHUNK_SIZE_WORDS: int = 1500
    REQUEST_TIMEOUT_SECONDS: float = 60.0

    STYLE_PROMPTS = {
        "brief": (
            "Hay tom tat noi dung cot loi cua van ban sau trong 2 den 3 cau suc tich bang tieng Viet. "
            "Neu bat thong diep hoac phat hien quan trong nhat."
        ),
        "bullets": (
            "Hay phan tich va rut trich 5 den 7 y chinh quan trong nhat tu van ban sau bang tieng Viet. "
            "Trinh bay duoi dang danh sach gach dau dong (•) ro rang, mach lac, moi gach dau dong la mot luan diem doc lap."
        ),
        "detailed": (
            "Hay lap ban tom tat phan tich chuyen sau cho van ban sau theo cau truc phan muc ro rang bang tieng Viet:\n"
            "### 1. Tong quan & Muc tieu\n"
            "### 2. Cac diem trong tam & Phan tich chi tiet\n"
            "### 3. Ket luan & Khuyen nghi"
        ),
    }

    LENGTH_CONSTRAINTS = {
        "short": "Do dai ban tom tat: ngan gon, khoang 50 - 100 tu.",
        "medium": "Do dai ban tom tat: vua phai, khoang 150 - 300 tu.",
        "long": "Do dai ban tom tat: day du, chi tiet, khoang 400 - 600 tu.",
    }

    SYSTEM_PROMPT = (
        "Ban la chuyen gia phan tich va tom tat tai lieu cua he thong PDF-Lingua. "
        "Nhiem vu cua ban la doc hieu van ban nguon va tao ban tom tat trung thuc, khach quan, chinh xac tuyet doi. "
        "Tuyet doi khong tu y suy dien, bia dat thong tin khong co trong tai lieu nguon (chong ao giac)."
    )

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        default_model: str | None = None,
    ):
        self.api_key = api_key if api_key is not None else settings.BAI_API_KEY
        self.base_url = (base_url or settings.BAI_BASE_URL).rstrip("/")
        self.default_model = default_model or settings.BAI_MODEL_SUMMARIZE or self.DEFAULT_MODEL

    def _build_summarize_prompt(
        self,
        text: str,
        style: str = "brief",
        length: str = "medium",
        custom_instruction: str = "",
    ) -> str:
        """Construct the user prompt incorporating style, length, and text."""
        style_instruction = self.STYLE_PROMPTS.get(style, self.STYLE_PROMPTS["brief"])
        length_instruction = self.LENGTH_CONSTRAINTS.get(length, self.LENGTH_CONSTRAINTS["medium"])

        prompt_parts = [
            f"Yeu cau phong cach: {style_instruction}",
            f"Yeu cau do dai: {length_instruction}",
        ]

        if custom_instruction and custom_instruction.strip():
            prompt_parts.append(f"Yeu cau bo sung: {custom_instruction.strip()}")

        prompt_parts.append(f"\n--- NOI DUNG VAN BAN NGUON ---\n{text}\n--- HET VAN BAN NGUON ---")
        prompt_parts.append("\nHien thi ban tom tat bang tieng Viet:")

        return "\n".join(prompt_parts)

    def _split_into_chunks(self, text: str, max_words: int = 1500) -> list[str]:
        """Split long document into semantic paragraphs/chunks respecting word limits."""
        if not text or not text.strip():
            return []

        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        if not paragraphs:
            paragraphs = [text.strip()]

        chunks: list[str] = []
        current_chunk_words: list[str] = []
        current_count = 0

        for para in paragraphs:
            para_words = para.split()
            para_len = len(para_words)

            if current_count + para_len > max_words and current_chunk_words:
                chunks.append(" ".join(current_chunk_words))
                current_chunk_words = []
                current_count = 0

            # If a single paragraph is longer than max_words, split by sentences
            if para_len > max_words:
                sentences = re.split(r"(?<=[.!?。！？])\s+", para)
                for sentence in sentences:
                    sentence_words = sentence.split()
                    sent_len = len(sentence_words)
                    if sent_len > max_words:
                        # Slice oversized sentence by word limits
                        for i in range(0, sent_len, max_words):
                            slice_words = sentence_words[i : i + max_words]
                            if current_count + len(slice_words) > max_words and current_chunk_words:
                                chunks.append(" ".join(current_chunk_words))
                                current_chunk_words = []
                                current_count = 0
                            current_chunk_words.extend(slice_words)
                            current_count += len(slice_words)
                    else:
                        if current_count + sent_len > max_words and current_chunk_words:
                            chunks.append(" ".join(current_chunk_words))
                            current_chunk_words = []
                            current_count = 0
                        current_chunk_words.extend(sentence_words)
                        current_count += sent_len
            else:
                current_chunk_words.extend(para_words)
                current_count += para_len

        if current_chunk_words:
            chunks.append(" ".join(current_chunk_words))

        return chunks

    async def _call_bai_api(
        self,
        prompt: str,
        system_prompt: str | None = None,
        model: str | None = None,
        max_tokens: int = 1500,
        temperature: float = 0.3,
    ) -> str:
        """Execute async HTTP call to B.AI API Gateway (OpenAI-compatible completions endpoint)."""
        if not self.api_key:
            raise ValueError("BAI_API_KEY is not configured in settings or environment.")

        model_name = model or self.default_model
        endpoint = f"{self.base_url}/chat/completions"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model_name,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(endpoint, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

    def _generate_mock_summary(
        self,
        text: str,
        style: str = "brief",
        length: str = "medium",
    ) -> str:
        """Generate a structured, deterministic offline fallback summary.

        Used when external API credit balance is 0 or network is unavailable,
        guaranteeing the application remains testable and responsive.
        """
        cleaned = re.sub(r"\s+", " ", text).strip()
        sentences = [s.strip() for s in re.split(r"(?<=[.!?。！？])\s+", cleaned) if len(s.strip()) > 15]

        if not sentences:
            sentences = [cleaned[:200] if len(cleaned) > 200 else cleaned]

        if style == "brief":
            selected = sentences[:3] if len(sentences) >= 3 else sentences
            return " ".join(selected)

        elif style == "bullets":
            bullet_count = min(6, max(3, len(sentences)))
            selected = sentences[:bullet_count]
            bullet_lines = [f"• {s}" for s in selected]
            return "\n".join(bullet_lines)

        elif style == "detailed":
            intro = sentences[0] if sentences else "Tai lieu cung cap thong tin tong quan."
            mid_points = sentences[1:5] if len(sentences) > 1 else sentences
            conclusion = sentences[-1] if len(sentences) > 5 else "Cac phan tich tren phan anh noi dung tai lieu."

            bullet_items = "\n".join([f"- {pt}" for pt in mid_points])
            return (
                f"### 1. Tong quan & Muc tieu\n{intro}\n\n"
                f"### 2. Cac diem trong tam & Phan tich chi tiet\n{bullet_items}\n\n"
                f"### 3. Ket luan & Khuyen nghi\n{conclusion}"
            )

        return " ".join(sentences[:3])

    async def _map_reduce_summary(
        self,
        chunks: list[str],
        style: str = "brief",
        length: str = "medium",
        model: str | None = None,
    ) -> str:
        """Process multiple document chunks using the Map-Reduce summarization strategy."""
        logger.info(f"[AIService] Starting Map phase for {len(chunks)} chunks.")

        # Map Phase: Summarize each chunk into key takeaways
        async def summarize_chunk(idx: int, chunk: str) -> str:
            map_prompt = (
                f"Hay doc doan van ban sau va rut trich cac y quan trong nhat duoi dang 3-4 cau ngan gon bang tieng Viet:\n\n{chunk}"
            )
            try:
                return await self._call_bai_api(
                    prompt=map_prompt,
                    system_prompt=self.SYSTEM_PROMPT,
                    model=model,
                    max_tokens=600,
                )
            except Exception as e:
                logger.warning(f"[AIService] Map chunk {idx} failed ({e}), using local extract fallback.")
                return self._generate_mock_summary(chunk, style="brief")

        map_tasks = [summarize_chunk(i, c) for i, c in enumerate(chunks)]
        chunk_summaries = await asyncio.gather(*map_tasks)

        logger.info(f"[AIService] Completed Map phase. Starting Reduce phase for {len(chunk_summaries)} summaries.")

        # Reduce Phase: Synthesize intermediate summaries into final summary
        combined_text = "\n\n".join([f"[Phan {i+1}]: {s}" for i, s in enumerate(chunk_summaries)])
        reduce_prompt = self._build_summarize_prompt(
            text=combined_text,
            style=style,
            length=length,
            custom_instruction="Tong hop tat ca cac phan tren thanh mot ban tom tat hoan chinh, nhat quan, khong trung lap.",
        )

        try:
            return await self._call_bai_api(
                prompt=reduce_prompt,
                system_prompt=self.SYSTEM_PROMPT,
                model=model,
                max_tokens=1500,
            )
        except Exception as e:
            logger.warning(f"[AIService] Reduce phase failed ({e}), using local fallback.")
            return self._generate_mock_summary(combined_text, style=style, length=length)

    async def summarize_text(
        self,
        text: str,
        style: str = "brief",
        length: str = "medium",
        custom_instruction: str = "",
        model: str | None = None,
    ) -> dict[str, Any]:
        """Summarize text using B.AI API with automatic Map-Reduce and graceful fallback.

        Parameters
        ----------
        text : str
            Source document content to summarize.
        style : str
            One of 'brief', 'bullets', 'detailed'. Defaults to 'brief'.
        length : str
            One of 'short', 'medium', 'long'. Defaults to 'medium'.
        custom_instruction : str
            Optional custom direction to guide the summary.
        model : str | None
            Specific model ID. Defaults to settings.BAI_MODEL_SUMMARIZE.

        Returns
        -------
        dict[str, Any]
            Dictionary containing:
            - summary: The resulting summary text.
            - style: Requested style.
            - length: Requested length.
            - word_count: Word count of the summary.
            - model_used: Model used for generation.
            - provider: "b.ai".
            - fallback_used: True if offline mock fallback was used.
            - fallback_reason: Diagnostic reason if fallback was used.
            - execution_time_ms: Processing latency in milliseconds.
        """
        start_time = time.time()
        style = style.lower() if style in self.STYLE_PROMPTS else "brief"
        length = length.lower() if length in self.LENGTH_CONSTRAINTS else "medium"
        model_name = model or self.default_model

        if not text or not text.strip():
            return {
                "summary": "",
                "style": style,
                "length": length,
                "word_count": 0,
                "model_used": model_name,
                "provider": "b.ai",
                "fallback_used": False,
                "fallback_reason": None,
                "execution_time_ms": 0,
            }

        word_count = len(text.split())
        summary_result: str = ""
        fallback_used = False
        fallback_reason: str | None = None

        # Check if Map-Reduce is required for very long documents
        if word_count > self.MAP_REDUCE_THRESHOLD_WORDS:
            logger.info(
                f"[AIService] Text length ({word_count} words) exceeds threshold "
                f"({self.MAP_REDUCE_THRESHOLD_WORDS}). Triggering Map-Reduce."
            )
            chunks = self._split_into_chunks(text, max_words=self.CHUNK_SIZE_WORDS)
            try:
                summary_result = await self._map_reduce_summary(
                    chunks=chunks,
                    style=style,
                    length=length,
                    model=model_name,
                )
            except Exception as e:
                logger.error(f"[AIService] Map-Reduce error: {e}. Activating mock fallback.")
                summary_result = self._generate_mock_summary(text, style=style, length=length)
                fallback_used = True
                fallback_reason = str(e)
        else:
            # Single-call summarization
            prompt = self._build_summarize_prompt(
                text=text,
                style=style,
                length=length,
                custom_instruction=custom_instruction,
            )

            try:
                summary_result = await self._call_bai_api(
                    prompt=prompt,
                    system_prompt=self.SYSTEM_PROMPT,
                    model=model_name,
                )
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                error_body = e.response.text
                logger.warning(f"[AIService] B.AI HTTP {status_code} error: {error_body}")

                # Detect balance exhaustion or deposit requirement
                if status_code in (400, 403, 402) and any(
                    kw in error_body.lower()
                    for kw in ("balance", "credit", "deposit", "insufficient")
                ):
                    fallback_used = True
                    fallback_reason = "b.ai credit balance is 0 or deposit required"
                    summary_result = self._generate_mock_summary(text, style=style, length=length)
                else:
                    fallback_used = True
                    fallback_reason = f"B.AI HTTP {status_code}: {error_body}"
                    summary_result = self._generate_mock_summary(text, style=style, length=length)

            except (httpx.TimeoutException, httpx.ConnectError, Exception) as e:
                logger.warning(f"[AIService] Network or API exception ({e}). Activating fallback.")
                fallback_used = True
                fallback_reason = str(e)
                summary_result = self._generate_mock_summary(text, style=style, length=length)

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "summary": summary_result,
            "style": style,
            "length": length,
            "word_count": len(summary_result.split()),
            "model_used": model_name,
            "provider": "b.ai",
            "fallback_used": fallback_used,
            "fallback_reason": fallback_reason,
            "execution_time_ms": elapsed_ms,
        }


# Global singleton instance for easy import across modules
ai_service = AIService()
