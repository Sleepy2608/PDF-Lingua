from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.translation_service import TranslationService

client = TestClient(app)


# ---------------------------------------------------------------------------
# PDFL-114: Xác định danh sách ngôn ngữ nguồn và ngôn ngữ đích được hỗ trợ
# ---------------------------------------------------------------------------
def test_pdfl_114_supported_languages_backend_mapping():
    """Kiểm tra backend đã xác định đầy đủ bộ ngôn ngữ được hỗ trợ."""
    service = TranslationService()

    # Kiểm tra bản đồ ngôn ngữ MyMemory và danh sách ngôn ngữ Latin
    expected_langs = {"en", "vi", "fr", "de", "es", "ja", "ko", "zh", "ru"}
    for lang in expected_langs:
        assert lang in service.MYMEMORY_LANG_MAP, f"Thiếu mã ngôn ngữ '{lang}' trong MYMEMORY_LANG_MAP"

    assert "vi" in service.LATIN_LANGS
    assert "en" in service.LATIN_LANGS
    assert len(service.VI_CHARS) > 30


def test_pdfl_114_frontend_language_options_present():
    """Kiểm tra giao diện frontend index.html khai báo đầy đủ các option ngôn ngữ."""
    frontend_html_path = Path(__file__).resolve().parents[2] / "frontend" / "index.html"
    assert frontend_html_path.exists(), "Không tìm thấy file Code/frontend/index.html"

    html_content = frontend_html_path.read_text(encoding="utf-8")
    assert 'id="targetLangSelect"' in html_content

    for code in ['value="vi"', 'value="en"', 'value="ja"', 'value="ko"', 'value="zh-CN"', 'value="fr"', 'value="de"', 'value="es"', 'value="ru"']:
        assert code in html_content, f"Thiếu lựa chọn ngôn ngữ {code} trong index.html"


# ---------------------------------------------------------------------------
# PDFL-115: Xây dựng chức năng tự động nhận diện ngôn ngữ nguồn
# ---------------------------------------------------------------------------
def test_pdfl_115_detect_language_vietnamese():
    service = TranslationService()
    # Văn bản tiếng Việt có dấu
    assert service.detect_language("Tài liệu hướng dẫn sử dụng phần mềm PDF-Lingua.") == "vi"


def test_pdfl_115_detect_language_asian_scripts():
    service = TranslationService()
    # Tiếng Nhật
    assert service.detect_language("こんにちは、これは日本語のテストです。") == "ja"
    # Tiếng Hàn
    assert service.detect_language("안녕하세요, 이것은 한국어 테스트입니다.") == "ko"
    # Tiếng Trung
    assert service.detect_language("你好，这是一个中文测试。") == "zh-CN"


def test_pdfl_115_detect_language_empty_and_fallback():
    service = TranslationService()
    # Rỗng -> mặc định "en"
    assert service.detect_language("") == "en"
    assert service.detect_language("   ") == "en"
    # Tiếng Anh / Latin thông thường
    assert service.detect_language("This is a simple English document.") == "en"


def test_pdfl_115_script_category_detection():
    service = TranslationService()
    # Nga (Cyrillic)
    assert service.get_script_category("Привет мир") == "ru"
    # Ả Rập
    assert service.get_script_category("مرحبا بك") == "ar"
    # Bảng chữ cái rời rạc
    assert service.get_script_category("A B C D E F G") == "alphabet_list"


# ---------------------------------------------------------------------------
# PDFL-116: Xây dựng giao diện chọn ngôn ngữ
# ---------------------------------------------------------------------------
def test_pdfl_116_workspace_js_event_listeners():
    """Kiểm tra frontend workspace.js có gắn lắng nghe sự kiện đổi ngôn ngữ."""
    workspace_js_path = Path(__file__).resolve().parents[2] / "frontend" / "js" / "workspace.js"
    assert workspace_js_path.exists(), "Không tìm thấy file Code/frontend/js/workspace.js"

    js_content = workspace_js_path.read_text(encoding="utf-8")
    assert "targetLangSelect" in js_content
    assert "targetLangSelect.addEventListener('change'" in js_content
    assert "handleRetranslate" in js_content


# ---------------------------------------------------------------------------
# PDFL-117: Xây dựng API dịch văn bản
# ---------------------------------------------------------------------------
@patch("app.api.process.translation_service.translate_text")
def test_pdfl_117_retranslate_api_success(mock_translate):
    mock_translate.return_value = {
        "translated_text": "Xin chào thế giới",
        "source_lang": "en",
        "target_lang": "vi",
        "chunk_count": 1,
        "engine_used": "mock_google",
    }

    payload = {
        "text": "Hello world",
        "target_lang": "vi",
        "source_lang": "auto",
    }
    response = client.post("/api/process/retranslate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    assert data["data"]["translated_text"] == "Xin chào thế giới"
    assert data["data"]["target_lang"] == "vi"
    mock_translate.assert_called_once()


def test_pdfl_117_retranslate_api_empty_text_validation():
    payload = {
        "text": "   ",
        "target_lang": "vi",
        "source_lang": "auto",
    }
    response = client.post("/api/process/retranslate", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    msg = data.get("message") or data.get("detail", "")
    assert "không được để trống" in msg


def test_pdfl_117_retranslate_api_missing_required_fields():
    # Thiếu target_lang hoặc text
    response = client.post("/api/process/retranslate", json={})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# PDFL-118: Chia văn bản dài thành các đoạn phù hợp với giới hạn của dịch vụ
# ---------------------------------------------------------------------------
def test_pdfl_118_chunk_text_empty_boundary():
    service = TranslationService()
    assert service.chunk_text("") == []
    assert service.chunk_text("   \n \n   ") == []


def test_pdfl_118_chunk_text_within_limit():
    service = TranslationService()
    text = "Đoạn văn ngắn nằm trong giới hạn cho phép."
    chunks = service.chunk_text(text, max_chars=500)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_pdfl_118_chunk_text_splits_long_paragraph_by_sentence():
    service = TranslationService()
    sentences = [f"Câu số {i} với nội dung kiểm thử độ dài." for i in range(20)]
    long_para = " ".join(sentences)

    chunks = service.chunk_text(long_para, max_chars=120)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 120, f"Chunk vượt quá giới hạn max_chars: {len(chunk)} > 120"

    reconstructed = " ".join(chunks)
    for s in sentences:
        assert s in reconstructed, f"Thiếu câu '{s}' sau khi phân mảnh"


def test_pdfl_118_chunk_text_preserves_paragraph_script_isolation():
    service = TranslationService()
    # Các đoạn thuộc ngữ hệ khác nhau không bị gộp bừa bãi
    text = "Đoạn tiếng Việt số một.\n\nこんにちは世界\n\nĐoạn tiếng Việt số hai."
    chunks = service.chunk_text(text, max_chars=2000)
    assert len(chunks) == 3
    assert chunks[0] == "Đoạn tiếng Việt số một."
    assert chunks[1] == "こんにちは世界"
    assert chunks[2] == "Đoạn tiếng Việt số hai."

