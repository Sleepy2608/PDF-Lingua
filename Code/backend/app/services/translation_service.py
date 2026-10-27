import re
from typing import Any
from deep_translator import GoogleTranslator, MyMemoryTranslator

from app.core.logger import logger


class TranslationService:
    MYMEMORY_LANG_MAP = {
        "en": "en-US",
        "vi": "vi-VN",
        "fr": "fr-FR",
        "de": "de-DE",
        "es": "es-ES",
        "ja": "ja-JP",
        "ko": "ko-KR",
        "zh": "zh-CN",
        "zh-CN": "zh-CN",
        "ru": "ru-RU",
    }

    def __init__(self, default_target_lang: str = "vi"):
        self.default_target_lang = default_target_lang

    def chunk_text(self, text: str, max_chars: int = 2500) -> list[str]:
        if not text or len(text) <= max_chars:
            return [text] if text else []

        paragraphs = text.split("\n\n")
        chunks: list[str] = []
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(para) > max_chars:
                sentences = re.split(r"(?<=[.!?。！？])\s+", para)
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    if len(current_chunk) + len(sentence) + 1 <= max_chars:
                        current_chunk = f"{current_chunk} {sentence}".strip()
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        current_chunk = sentence
            else:
                if len(current_chunk) + len(para) + 2 <= max_chars:
                    current_chunk = f"{current_chunk}\n\n{para}".strip()
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                    current_chunk = para

        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    def translate_chunk(self, chunk: str, target_lang: str, source_lang: str = "auto") -> tuple[str, str]:
        if not chunk.strip():
            return "", "none"

        try:
            translated = GoogleTranslator(source=source_lang, target=target_lang).translate(chunk)
            if translated:
                return translated, "google"
        except Exception as e:
            logger.warning(f"[Translation] GoogleTranslator failed or rate-limited: {e}. Falling back to MyMemory.")

        try:
            mm_source = self.MYMEMORY_LANG_MAP.get(source_lang, "auto" if source_lang == "auto" else "en-US")
            mm_target = self.MYMEMORY_LANG_MAP.get(target_lang, "vi-VN")
            if mm_source == "auto":
                mm_source = "en-US"

            translated = MyMemoryTranslator(source=mm_source, target=mm_target).translate(chunk)
            if translated:
                return translated, "mymemory"
        except Exception as e:
            logger.error(f"[Translation] MyMemory fallback also failed: {e}")

        return chunk, "fallback_raw"

    def translate_text(
        self,
        text: str,
        target_lang: str | None = None,
        source_lang: str = "auto",
        max_chars: int = 2500,
    ) -> dict[str, Any]:
        target = target_lang or self.default_target_lang
        if not text or not text.strip():
            return {
                "translated_text": "",
                "source_lang": source_lang,
                "target_lang": target,
                "chunk_count": 0,
                "engine_used": "none",
            }

        chunks = self.chunk_text(text, max_chars=max_chars)
        translated_chunks: list[str] = []
        engines_used: set[str] = set()

        for chunk in chunks:
            translated_part, engine = self.translate_chunk(chunk, target_lang=target, source_lang=source_lang)
            translated_chunks.append(translated_part)
            engines_used.add(engine)

        return {
            "translated_text": "\n\n".join(translated_chunks),
            "source_lang": source_lang,
            "target_lang": target,
            "chunk_count": len(chunks),
            "engine_used": ", ".join(sorted(engines_used)),
        }
