"""
Comprehensive Unit & Integration Tests for:
- PDFL-120: Xử lý lỗi mạng, giới hạn API và lỗi dịch thuật (Multi-tier Fallback Engine)
- PDFL-123: Kiểm thử các trường hợp dịch tiếng Việt, tiếng Anh và các ngôn ngữ được lựa chọn
- PDFL-124: Đánh giá khả năng giữ nguyên đoạn văn, danh sách và nội dung quan trọng khi dịch
- PDFL-125: Đảm bảo hệ thống không làm mất hoặc đảo thứ tự đoạn khi dịch tài liệu dài
"""

from unittest.mock import MagicMock, patch
import urllib.error
import pytest

from app.services.translation_service import TranslationService


# ==============================================================================
# PDFL-120: Xử lý lỗi mạng, giới hạn API và lỗi dịch thuật (Multi-Tier Fallback)
# ==============================================================================

def test_pdfl_120_tier1_gtx_fails_fallback_to_google_web():
    """Verify that when Google GTX fails (e.g. network/timeout), service falls back to GoogleTranslator."""
    service = TranslationService()

    with patch.object(service, "_translate_google_gtx", side_effect=urllib.error.URLError("Network unreachable")):
        with patch("app.services.translation_service.GoogleTranslator") as mock_gt:
            mock_instance = MagicMock()
            mock_instance.translate.return_value = "Bản dịch dự phòng từ Google Web"
            mock_gt.return_value = mock_instance

            translated, engine = service.translate_chunk("Hello world", target_lang="vi", source_lang="en")

            assert translated == "Bản dịch dự phòng từ Google Web"
            assert engine == "google_web"
            mock_instance.translate.assert_called_once_with("Hello world")


def test_pdfl_120_tier1_and_tier2_fail_fallback_to_mymemory():
    """Verify that when both Google GTX and GoogleTranslator fail, service falls back to MyMemory."""
    service = TranslationService()

    with patch.object(service, "_translate_google_gtx", side_effect=Exception("HTTP 429 Too Many Requests")):
        with patch("app.services.translation_service.GoogleTranslator") as mock_gt:
            mock_gt.side_effect = Exception("Google Web Quota Exceeded")
            with patch("app.services.translation_service.MyMemoryTranslator") as mock_mm:
                mock_instance = MagicMock()
                mock_instance.translate.return_value = "Bản dịch dự phòng từ MyMemory"
                mock_mm.return_value = mock_instance

                translated, engine = service.translate_chunk("Hello world", target_lang="vi", source_lang="en")

                assert translated == "Bản dịch dự phòng từ MyMemory"
                assert engine == "mymemory"


def test_pdfl_120_all_tiers_fail_graceful_fallback_raw():
    """Verify that when all network endpoints fail, service does not crash and preserves original text."""
    service = TranslationService()

    with patch.object(service, "_translate_google_gtx", side_effect=urllib.error.URLError("Connection refused")):
        with patch("app.services.translation_service.GoogleTranslator", side_effect=Exception("Service Unavailable")):
            with patch("app.services.translation_service.MyMemoryTranslator", side_effect=Exception("Timeout")):
                original_text = "Important text that must not be lost."
                translated, engine = service.translate_chunk(original_text, target_lang="vi", source_lang="en")

                # Must gracefully return original text with engine indicator
                assert translated == original_text
                assert engine == "fallback_raw"


def test_pdfl_120_empty_chunk_handled_without_network():
    """Verify empty or whitespace-only chunks return cleanly without invoking remote APIs."""
    service = TranslationService()
    translated, engine = service.translate_chunk("   ", target_lang="vi")
    assert translated == ""
    assert engine == "none"


# ==============================================================================
# PDFL-123: Kiểm thử các trường hợp dịch tiếng Việt, tiếng Anh và các ngôn ngữ
# ==============================================================================

def test_pdfl_123_translate_english_to_vietnamese():
    """Verify English to Vietnamese translation routing."""
    service = TranslationService()
    with patch.object(service, "translate_chunk", return_value=("Xin chào thế giới", "google")):
        res = service.translate_text("Hello world", target_lang="vi", source_lang="en")
        assert res["translated_text"] == "Xin chào thế giới"
        assert res["target_lang"] == "vi"
        assert res["chunk_count"] == 1


def test_pdfl_123_translate_vietnamese_to_english():
    """Verify Vietnamese to English translation routing."""
    service = TranslationService()
    with patch.object(service, "translate_chunk", return_value=("Hello world", "google")):
        res = service.translate_text("Xin chào thế giới", target_lang="en", source_lang="vi")
        assert res["translated_text"] == "Hello world"
        assert res["target_lang"] == "en"


def test_pdfl_123_multilingual_targets_supported():
    """Verify multiple target languages (ja, ko, zh-CN, fr, de, es, ru) are supported in mapping."""
    service = TranslationService()
    supported = ["en", "vi", "fr", "de", "es", "ja", "ko", "zh-CN", "ru"]
    for lang in supported:
        assert lang in service.MYMEMORY_LANG_MAP or lang.split("-")[0] in service.MYMEMORY_LANG_MAP


def test_pdfl_123_same_language_skips_external_translation():
    """Verify translating to the same detected language returns original content."""
    service = TranslationService()
    with patch.object(service, "_translate_google_gtx", side_effect=Exception("GTX Fail")):
        with patch("app.services.translation_service.GoogleTranslator", side_effect=Exception("Web Fail")):
            # When source is detected as Vietnamese and target is also Vietnamese
            vn_text = "Hệ thống tự động phát hiện ngôn ngữ tiếng Việt."
            translated, engine = service.translate_chunk(vn_text, target_lang="vi", source_lang="auto")
            assert translated == vn_text
            assert engine == "same_language"


# ==============================================================================
# PDFL-124: Đánh giá khả năng giữ nguyên đoạn văn, danh sách và nội dung quan trọng
# ==============================================================================

def test_pdfl_124_preserve_paragraph_structure_after_translation():
    """Verify that multiple paragraphs separated by empty lines maintain their structure."""
    service = TranslationService()

    para1 = "Đoạn văn thứ nhất bàn về trí tuệ nhân tạo."
    para2 = "Đoạn văn thứ hai mô tả thuật toán xử lý ngôn ngữ tự nhiên."
    para3 = "Đoạn văn thứ ba tóm lược kết quả thực nghiệm."
    full_text = f"{para1}\n\n{para2}\n\n{para3}"

    chunks = service.chunk_text(full_text, max_chars=80)
    assert len(chunks) == 3
    assert chunks[0] == para1
    assert chunks[1] == para2
    assert chunks[2] == para3

    # When translating text with mocked chunk responses
    def mock_translate_chunk(chunk, target_lang, source_lang="auto"):
        return f"[Dịch: {chunk}]", "mock_engine"

    with patch.object(service, "translate_chunk", side_effect=mock_translate_chunk):
        res = service.translate_text(full_text, target_lang="en", max_chars=80)
        translated_paragraphs = res["translated_text"].split("\n\n")
        assert len(translated_paragraphs) == 3
        assert translated_paragraphs[0] == f"[Dịch: {para1}]"
        assert translated_paragraphs[1] == f"[Dịch: {para2}]"
        assert translated_paragraphs[2] == f"[Dịch: {para3}]"


def test_pdfl_124_preserve_isolated_alphabet_and_character_lists():
    """Verify isolated alphabet lists (e.g. A B C D...) are preserved verbatim without corruption."""
    service = TranslationService()

    alphabet_vn = "Ă Â Ơ Ô Ê Ư Á À Ạ Ã Ả Ỏ Ò Ó Ỏ Ọ Õ"
    assert service.is_isolated_char_list(alphabet_vn) is True

    # When calling translate_chunk, it must preserve the characters without network call
    translated, engine = service.translate_chunk(alphabet_vn, target_lang="en")
    assert translated == alphabet_vn
    assert engine == "preserved_characters"


def test_pdfl_124_script_category_isolation():
    """Verify distinct scripts (e.g. Japanese Kanji vs Latin) are not merged into a single chunk."""
    service = TranslationService()

    text = "English introduction paragraph.\n\n日本語の段落です。\n\nTiếng Việt kết luận."
    chunks = service.chunk_text(text, max_chars=2000)
    assert len(chunks) == 3
    assert chunks[0] == "English introduction paragraph."
    assert chunks[1] == "日本語の段落です。"
    assert chunks[2] == "Tiếng Việt kết luận."


# ==============================================================================
# PDFL-125: Đảm bảo hệ thống không làm mất hoặc đảo thứ tự đoạn khi dịch tài liệu dài
# ==============================================================================

def test_pdfl_125_strict_sequential_order_of_long_document_chunks():
    """Verify that translating a multi-paragraph long document maintains exact chronological order."""
    service = TranslationService()

    total_paragraphs = 12
    paragraphs = [
        f"Mục {i:02d}: Nội dung chi tiết của phần thứ {i} trong tài liệu kỹ thuật dài."
        for i in range(1, total_paragraphs + 1)
    ]
    long_document = "\n\n".join(paragraphs)

    def mock_ordered_translate(chunk, target_lang, source_lang="auto"):
        return f"Translated_{chunk}", "ordered_engine"

    with patch.object(service, "translate_chunk", side_effect=mock_ordered_translate):
        result = service.translate_text(long_document, target_lang="en", max_chars=300)

        assert result["chunk_count"] > 1
        translated_text = result["translated_text"]

        # Verify every paragraph exists in exact sequential order
        last_index = -1
        for i in range(1, total_paragraphs + 1):
            expected_segment = f"Mục {i:02d}:"
            current_index = translated_text.find(expected_segment)
            assert current_index != -1, f"Thiếu đoạn {expected_segment} trong kết quả dịch!"
            assert current_index > last_index, f"Đoạn {i} bị đảo lộn thứ tự so với đoạn trước đó!"
            last_index = current_index


def test_pdfl_125_long_sentence_splitting_retains_sentence_order():
    """Verify that when an oversized paragraph is split by sentences, no sentence is lost or reversed."""
    service = TranslationService()

    sentences = [f"Đây là câu văn số {i} với nội dung kiểm tra độ dài." for i in range(1, 15)]
    oversized_para = " ".join(sentences)

    chunks = service.chunk_text(oversized_para, max_chars=120)
    assert len(chunks) > 1

    # Rejoin all chunks
    reconstructed = " ".join(chunks)
    for s in sentences:
        assert s in reconstructed, f"Câu '{s}' bị mất sau khi phân mảnh!"

    # Verify order of sentences in reconstructed text
    prev_pos = -1
    for s in sentences:
        pos = reconstructed.find(s)
        assert pos > prev_pos, f"Thứ tự của câu '{s}' bị xáo trộn!"
        prev_pos = pos
