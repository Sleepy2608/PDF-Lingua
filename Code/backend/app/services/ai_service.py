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

    COPILOT_SYSTEM_PROMPT = (
        "Ban la Tro ly AI thong minh cua he thong PDF-Lingua chuyen phan tich va giai dap ve tai lieu. "
        "Nhiem vu cua ban la tra loi cau hoi cua nguoi dung DUA HOAN TOAN VAO NGU CANH TAI LIEU duoc cung cap duoi day.\n\n"
        "Quy tac ngon ngu va chong ao giac bat buoc:\n"
        "1. DONG BO NGON NGU: Luon tra loi bang chinh ngon ngu ma nguoi dung dang dung de dat cau hoi. "
        "Neu nguoi dung dat cau hoi bang tieng Viet (ke ca khi go tieng Viet khong dau), ban BAT BUOC PHAI TRA LOI BANG TIENG VIET CO DAU DAY DU, dung chinh ta va ngu phap. "
        "Neu nguoi dung hoi bang tieng Anh hoac bat ky ngon ngu nao khac, ban phai tra loi hoan toan bang ngon ngu do.\n"
        "2. NGU CANH TAI LIEU: Chi su dung cac thong tin va du kien xuat hien trong phan 'NGU CANH TAI LIEU'.\n"
        "3. TU CHOI KHI THIEU THONG TIN: Neu thong tin trong tai lieu khong du hoac khong de cap den cau tra loi, hay tu choi ro rang, trung thuc tuyet doi (chong ao giac):\n"
        "- Tieng Viet: 'Tài liệu hiện tại không đề cập đến thông tin này.'\n"
        "- Tieng Anh: 'The document currently does not mention this information.'\n"
        "- Ngon ngu khac: Tra loi cau tu choi tuong duong bang ngon ngu cua nguoi dung.\n"
        "Tuyet doi khong tu y bia dat, suy dien hoac tra loi ngoai ngu canh tai lieu.\n"
        "4. Phong cach tra loi: Ngan gon, suc tich, trung thuc, de hieu va chuyen nghiep."
    )

    NO_INFO_RESPONSE = "Tài liệu hiện tại không đề cập đến thông tin này."
    NO_INFO_RESPONSE_EN = "The document currently does not mention this information."

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
        prompt: str = "",
        system_prompt: str | None = None,
        messages: list[dict[str, str]] | None = None,
        model: str | None = None,
        max_tokens: int = 1500,
        temperature: float = 0.3,
    ) -> str:
        """Execute async HTTP call to B.AI API Gateway (OpenAI-compatible completions endpoint)."""
        if not self.api_key:
            raise ValueError("BAI_API_KEY is not configured in settings or environment.")

        model_name = model or self.default_model
        endpoint = f"{self.base_url}/chat/completions"

        if messages is None:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            if prompt:
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

    def _extract_relevant_chunks(
        self,
        document_text: str,
        query: str,
        top_k: int = 3,
        max_chunk_words: int = 300,
    ) -> list[dict[str, Any]]:
        """
        Split document text into semantic chunks and score by query keyword relevance (RAG context).
        """
        if not document_text or not document_text.strip():
            return []

        raw_chunks = self._split_into_chunks(document_text, max_words=max_chunk_words)
        if not raw_chunks:
            return []

        # Extract search keywords from query (ignore filler and stop words)
        stop_words = {
            # Vietnamese unaccented
            "la", "va", "cua", "cac", "nhung", "mot", "trong", "cho",
            "duoc", "voi", "khi", "nay", "do", "the", "nao", "gi",
            "sao", "bao", "nhieu", "co", "hay", "khong", "thi", "neu",
            "o", "ve", "tu", "den", "nguoi", "rat", "dan", "dung", "vay",
            "ai", "dau", "se", "bi", "ra", "vao", "theo", "tim", "kiem",
            "tai", "lieu", "thong", "tin", "hoi", "dap", "thu", "biet",
            "toi", "ban", "minh", "chung", "ta", "day", "kia", "roi",
            # Vietnamese accented
            "là", "và", "của", "các", "những", "một", "được", "với",
            "này", "đó", "thế", "nào", "gì", "nhiêu", "có", "không",
            "thì", "nếu", "ở", "về", "từ", "đến", "người", "rất",
            "đã", "đang", "sẽ", "bị", "vào", "đâu", "tìm", "kiếm",
            "tài", "liệu", "thông", "tin", "hỏi", "đáp", "thử", "biết",
            "tôi", "bạn", "mình", "chúng", "đây", "rồi", "văn", "bản",
            # English
            "what", "is", "are", "was", "were", "the", "a", "an",
            "in", "on", "at", "to", "for", "of", "with", "by", "from",
            "and", "or", "not", "this", "that", "these", "those", "it",
            "its", "they", "them", "their", "we", "us", "our", "you",
            "your", "he", "him", "his", "she", "her", "can", "could",
            "should", "would", "do", "does", "did", "have", "has", "had",
            "how", "why", "where", "when", "which", "who", "whom", "whose",
            "document", "text", "file", "information", "mentioned", "tell",
            "show", "find", "search", "please", "about",
        }
        query_words = [
            w.lower().strip("?,.!;:\"'()[]{}")
            for w in query.split()
            if len(w.strip("?,.!;:\"'()[]{}")) >= 2 and w.lower() not in stop_words
        ]

        scored_chunks = []
        for idx, chunk in enumerate(raw_chunks):
            chunk_lower = chunk.lower()
            score = 0
            matched_terms = []

            for qw in query_words:
                pattern = r"\b" + re.escape(qw) + r"\b"
                matches = re.findall(pattern, chunk_lower)
                count = len(matches)

                # Prefix/stem matching for words >= 5 chars (e.g. encrypt / encrypted / encryption)
                if count == 0 and len(qw) >= 5:
                    stem = qw[:5]
                    stem_pattern = r"\b" + re.escape(stem) + r"\w*"
                    stem_matches = re.findall(stem_pattern, chunk_lower)
                    count = len(stem_matches)

                if count > 0:
                    score += count * 2
                    matched_terms.append(qw)

            # Bonus for diverse term match
            unique_matches = set(matched_terms)
            score += len(unique_matches) * 5

            # Anti-hallucination guardrail: Require high term coverage for the query
            if query_words:
                match_ratio = len(unique_matches) / len(query_words)
                if len(query_words) >= 4 and match_ratio < 0.45:
                    score = 0
                elif len(query_words) >= 2 and len(unique_matches) < 2:
                    score = 0
                elif len(unique_matches) == 0:
                    score = 0

            scored_chunks.append({
                "chunk_index": idx + 1,
                "text": chunk,
                "score": score,
                "matched_terms": list(unique_matches),
            })

        # Sort by relevance score descending
        scored_chunks.sort(key=lambda c: c["score"], reverse=True)

        return scored_chunks[:top_k]

    @staticmethod
    def _detect_language(text: str) -> str:
        """
        Detect user query language.
        Returns 'vi' for Vietnamese (accented or unaccented), 'en' for English,
        or language codes ('ja', 'ko', 'zh', etc.).
        Defaults to 'vi' for PDF-Lingua primary domain context.
        """
        if not text or not text.strip():
            return "vi"

        normalized = text.strip()

        # 1. Check for Vietnamese diacritic characters
        vi_diacritics_pattern = re.compile(
            r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]"
        )
        if vi_diacritics_pattern.search(normalized):
            return "vi"

        # 2. Check for Japanese characters (Hiragana, Katakana)
        if re.search(r"[\u3040-\u309F\u30A0-\u30FF]", normalized):
            return "ja"

        # 3. Check for Korean Hangul
        if re.search(r"[\uAC00-\uD7AF\u1100-\u11FF]", normalized):
            return "ko"

        # 4. Check for Chinese Hanzi
        if re.search(r"[\u4E00-\u9FFF]", normalized):
            return "zh"

        # 5. Tokenize lower-case words
        words = [re.sub(r"[^\w]", "", w.lower()) for w in normalized.split()]
        words = [w for w in words if w]
        if not words:
            return "vi"

        # Unaccented Vietnamese common words lexicon
        unaccented_vi_lexicon = {
            "khong", "tai", "lieu", "duoc", "trong", "nhung", "nguoi",
            "chinh", "thong", "tin", "chao", "hoi", "dap", "ban", "cua",
            "cac", "mot", "voi", "khi", "nay", "nao", "sao", "bao", "nhieu",
            "gach", "dau", "dong", "tom", "tat", "thu", "co", "tu", "la",
            "va", "cho", "thi", "neu", "ve", "den", "se", "bi", "ra", "vao",
            "theo", "ai", "dau", "gi", "sao", "lam", "giup", "minh", "toi",
            "em", "anh", "chi", "nhe", "a", "day", "do", "kia", "the", "nao",
            "the", "hay", "vay", "chung", "ta", "moi", "het", "con", "lai",
            "chua", "roi", "rat", "qua", "lam", "di", "lai", "nen", "phai",
            "biet", "noi", "dung", "sai"
        }
        vi_count = sum(1 for w in words if w in unaccented_vi_lexicon)

        # English common words lexicon
        english_lexicon = {
            "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
            "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
            "this", "but", "his", "by", "from", "they", "we", "say", "her",
            "she", "or", "an", "will", "my", "one", "all", "would", "there",
            "their", "what", "so", "up", "out", "if", "about", "who", "get",
            "which", "go", "me", "when", "make", "can", "like", "time", "no",
            "just", "him", "know", "take", "people", "into", "year", "your",
            "good", "some", "could", "them", "see", "other", "than", "then",
            "now", "look", "only", "come", "its", "over", "think", "also",
            "back", "after", "use", "two", "how", "our", "work", "first",
            "well", "way", "even", "new", "want", "because", "any", "these",
            "give", "day", "most", "us", "hello", "hi", "summarize", "summary",
            "explain", "document", "question", "answer", "help", "please",
            "is", "are", "was", "were", "has", "had", "does", "did", "tell"
        }
        en_count = sum(1 for w in words if w in english_lexicon)

        if vi_count > en_count:
            return "vi"
        elif en_count > vi_count:
            return "en"
        elif vi_count > 0:
            return "vi"
        elif any(w in {"hello", "hi", "hey", "what", "who", "where", "when", "why", "how", "is", "are"} for w in words):
            return "en"

        return "vi"

    def _generate_mock_chat_response(
        self,
        query: str,
        relevant_chunks: list[dict[str, Any]],
        lang: str = "vi",
    ) -> str:
        """
        Generate intelligent offline fallback answer based on query and relevant context.
        Enforces anti-hallucination and matches query language (accented Vietnamese or target language).
        """
        no_info = self.NO_INFO_RESPONSE_EN if lang == "en" else self.NO_INFO_RESPONSE

        if not relevant_chunks or all(c["score"] == 0 for c in relevant_chunks):
            return no_info

        # Extract sentences from highest-scoring chunk that contain matched keywords
        best_chunk = relevant_chunks[0]
        chunk_text = best_chunk["text"]
        matched_terms = set(best_chunk.get("matched_terms", []))

        sentences = [
            s.strip()
            for s in re.split(r"(?<=[.!?。！？])\s+", chunk_text)
            if len(s.strip()) > 10
        ]

        # Rank sentences by keyword match density
        sentence_scores = []
        for sent in sentences:
            sent_lower = sent.lower()
            cnt = sum(1 for term in matched_terms if term in sent_lower)
            if cnt > 0:
                sentence_scores.append((cnt, sent))

        sentence_scores.sort(key=lambda x: x[0], reverse=True)
        prefix = (
            f"Based on the document (Section {best_chunk['chunk_index']}): "
            if lang == "en"
            else f"Dựa trên tài liệu (Đoạn {best_chunk['chunk_index']}): "
        )

        if sentence_scores:
            top_sentences = [s for _, s in sentence_scores[:2]]
            extracted = " ".join(top_sentences)
            return f"{prefix}{extracted}"

        # If sentences don't isolate well, return first sentence of best chunk
        if sentences:
            return f"{prefix}{sentences[0]}"

        return no_info

    async def chat_with_document(
        self,
        query: str,
        document_text: str,
        conversation_history: list[dict[str, str]] | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        """
        Interactive Copilot QA over document context using RAG retrieval and anti-hallucination guardrails.
        """
        start_time = time.time()
        model_name = model or settings.BAI_MODEL_CHAT or self.default_model
        lang = self._detect_language(query)

        if not query or not query.strip():
            empty_msg = (
                "Please enter a question regarding the document content."
                if lang == "en"
                else "Vui lòng nhập câu hỏi về nội dung tài liệu."
            )
            return {
                "answer": empty_msg,
                "relevant_chunks": [],
                "model_used": model_name,
                "provider": "b.ai",
                "fallback_used": False,
                "fallback_reason": None,
                "execution_time_ms": 0,
            }

        no_info_msg = self.NO_INFO_RESPONSE_EN if lang == "en" else self.NO_INFO_RESPONSE

        if not document_text or not document_text.strip():
            return {
                "answer": no_info_msg,
                "relevant_chunks": [],
                "model_used": model_name,
                "provider": "b.ai",
                "fallback_used": False,
                "fallback_reason": None,
                "execution_time_ms": 0,
            }

        # 1. Retrieve most relevant context chunks
        relevant_chunks = self._extract_relevant_chunks(
            document_text=document_text,
            query=query,
            top_k=3,
        )

        formatted_context = "\n\n".join([
            f"[Doan {c['chunk_index']}]: {c['text']}"
            for c in relevant_chunks
        ])

        if lang == "vi":
            lang_instruction = "BAT BUOC TRA LOI BANG TIENG VIET CO DAU DAY DU."
        elif lang == "en":
            lang_instruction = "RESPOND IN ENGLISH."
        else:
            lang_instruction = f"RESPOND IN THE SAME LANGUAGE AS THE USER QUERY ({lang})."

        user_prompt = (
            f"--- NGU CANH TAI LIEU ---\n{formatted_context}\n--- HET NGU CANH TAI LIEU ---\n\n"
            f"Yeu cau ngon ngu: {lang_instruction}\n"
            f"Cau hoi cua nguoi dung: {query.strip()}\n\n"
            f"Tra loi dua tren ngu canh:"
        )

        answer_text: str = ""
        fallback_used = False
        fallback_reason: str | None = None

        try:
            # Prepare messages with history
            messages = [{"role": "system", "content": self.COPILOT_SYSTEM_PROMPT}]
            if conversation_history:
                for turn in conversation_history[-6:]:
                    r = turn.get("role", "user")
                    c = turn.get("content", "")
                    if r in ("user", "assistant") and c:
                        messages.append({"role": r, "content": c})

            messages.append({"role": "user", "content": user_prompt})

            answer_text = await self._call_bai_api(
                messages=messages,
                model=model_name,
                max_tokens=1000,
                temperature=0.2,
            )

        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            error_body = e.response.text
            logger.warning(f"[AIService Chat] B.AI HTTP {status_code} error: {error_body}")
            fallback_used = True
            fallback_reason = f"B.AI HTTP {status_code}: {error_body}"
            answer_text = self._generate_mock_chat_response(query, relevant_chunks, lang=lang)

        except (httpx.TimeoutException, httpx.ConnectError, Exception) as e:
            logger.warning(f"[AIService Chat] Connection or API exception: {e}. Activating fallback.")
            fallback_used = True
            fallback_reason = str(e)
            answer_text = self._generate_mock_chat_response(query, relevant_chunks, lang=lang)

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "answer": answer_text,
            "relevant_chunks": [c["text"] for c in relevant_chunks],
            "model_used": model_name,
            "provider": "b.ai",
            "fallback_used": fallback_used,
            "fallback_reason": fallback_reason,
            "execution_time_ms": elapsed_ms,
        }


# Global singleton instance for easy import across modules
ai_service = AIService()
