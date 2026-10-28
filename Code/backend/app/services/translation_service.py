import json
import re
import urllib.parse
import urllib.request
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

    VI_CHARS = set("àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ")
    NON_LATIN_SCRIPTS = r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff]+"
    LATIN_LANGS = {"en", "vi", "fr", "de", "es", "it", "pt", "nl"}

    def __init__(self, default_target_lang: str = "vi"):
        self.default_target_lang = default_target_lang

    def is_isolated_char_list(self, text: str) -> bool:
        lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
        if not lines:
            return False
        for line in lines:
            tokens = line.split()
            if len(tokens) < 3 or not all(len(t) == 1 for t in tokens):
                return False
        return True

    def get_script_category(self, text: str) -> str:
        if self.is_isolated_char_list(text):
            return "alphabet_list"
        if re.search(r"[\u3040-\u30ff]", text):
            return "ja"
        if re.search(r"[\uac00-\ud7af]", text):
            return "ko"
        if re.search(r"[\u4e00-\u9fff]", text):
            return "zh"
        if re.search(r"[\u0400-\u04ff]", text):
            return "ru"
        if re.search(r"[\u0600-\u06ff]", text):
            return "ar"
        lower = text.lower()
        if any(c in self.VI_CHARS for c in lower):
            return "vi"
        return "latin"

    def detect_language(self, text: str) -> str:
        if not text:
            return "en"
        lower = text.lower()
        if any(c in self.VI_CHARS for c in lower):
            return "vi"
        if re.search(r"[\u3040-\u30ff]", text):
            return "ja"
        if re.search(r"[\uac00-\ud7af]", text):
            return "ko"
        if re.search(r"[\u4e00-\u9fff]", text):
            return "zh-CN"
        return "en"

    def chunk_text(self, text: str, max_chars: int = 2500) -> list[str]:
        if not text or not text.strip():
            return []

        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        chunks: list[str] = []
        current_chunk = ""
        current_cat = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            para_cat = self.get_script_category(para)

            if len(para) > max_chars:
                if current_chunk:
                    chunks.append(current_chunk)
                    current_chunk = ""
                    current_cat = ""
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
                if current_chunk:
                    chunks.append(current_chunk)
                    current_chunk = ""
                    current_cat = ""
            else:
                if (
                    current_chunk
                    and para_cat == current_cat
                    and para_cat != "alphabet_list"
                    and len(current_chunk) + len(para) + 2 <= max_chars
                ):
                    current_chunk = f"{current_chunk}\n\n{para}".strip()
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                    current_chunk = para
                    current_cat = para_cat

        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    def _translate_google_gtx(self, chunk: str, target_lang: str, source_lang: str = "auto") -> tuple[str, str]:
        encoded = urllib.parse.quote(chunk)
        url = (
            f"https://translate.googleapis.com/translate_a/single"
            f"?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={encoded}"
        )
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            translated = "".join([item[0] for item in data[0] if item and item[0]])
            detected = data[2] if len(data) > 2 and data[2] else source_lang
            return translated, detected

    def translate_chunk(self, chunk: str, target_lang: str, source_lang: str = "auto") -> tuple[str, str]:
        if not chunk.strip():
            return "", "none"

        if self.is_isolated_char_list(chunk):
            return chunk, "preserved_characters"

        translated = ""
        engine = "none"

        try:
            translated, detected = self._translate_google_gtx(chunk, target_lang=target_lang, source_lang=source_lang)
            if translated and translated.strip():
                engine = "google"
        except Exception as e:
            logger.warning(f"[Translation] Google GTX endpoint failed: {e}. Trying GoogleTranslator fallback.")

        if not translated or not translated.strip():
            try:
                translated = GoogleTranslator(source=source_lang, target=target_lang).translate(chunk)
                if translated and translated.strip():
                    engine = "google_web"
            except Exception as e:
                logger.warning(f"[Translation] GoogleTranslator failed: {e}. Trying MyMemory fallback.")

        if not translated or not translated.strip():
            try:
                detected = self.detect_language(chunk) if source_lang == "auto" else source_lang
                if detected == target_lang:
                    return chunk, "same_language"

                mm_source = self.MYMEMORY_LANG_MAP.get(detected, "en-US")
                mm_target = self.MYMEMORY_LANG_MAP.get(target_lang, "vi-VN")

                translated = MyMemoryTranslator(source=mm_source, target=mm_target).translate(chunk)
                if translated and translated.strip():
                    engine = "mymemory"
            except Exception as e:
                logger.error(f"[Translation] MyMemory fallback failed: {e}")

        if not translated or not translated.strip():
            return chunk, "fallback_raw"

        # Post-process foreign scripts if target is Latin-based
        if target_lang in self.LATIN_LANGS:
            foreign_matches = set(re.findall(self.NON_LATIN_SCRIPTS, translated))
            for f_word in foreign_matches:
                try:
                    f_trans, _ = self._translate_google_gtx(f_word, target_lang=target_lang, source_lang="auto")
                    if f_trans and f_trans.strip() and f_trans.strip() != f_word:
                        translated = translated.replace(f_word, f_trans.strip())
                except Exception:
                    pass

        return translated, engine

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
