import json
from pathlib import Path

TRANS_GT_DIR = Path(__file__).parent / "dataset" / "translation_ground_truth"
TRANS_GT_DIR.mkdir(parents=True, exist_ok=True)

pairs = [
    {
        "source_doc": "digital_single_column.pdf",
        "source_lang": "en",
        "target_lang": "vi",
        "filename": "digital_single_column_vi.txt",
        "ground_truth": (
            "Trích xuất tài liệu thông minh PDF-Lingua\n\n"
            "Đây là tài liệu học thuật định dạng một cột chuẩn.\n"
            "Tài liệu bao gồm các đoạn văn bản chuẩn mực được thiết kế để đánh giá độ chính xác của quá trình trích xuất kỹ thuật số.\n"
            "Thứ tự đọc tự nhiên diễn ra liền mạch từ dòng trên cùng xuống dòng dưới cùng mà không bị chia cột.\n"
            "Hệ thống trích xuất PDF số hóa hiện đại cần đạt độ chính xác ký tự gần 100% trên bố cục rõ ràng này."
        )
    },
    {
        "source_doc": "digital_multi_column.pdf",
        "source_lang": "en",
        "target_lang": "vi",
        "filename": "digital_multi_column_vi.txt",
        "ground_truth": (
            "Tiêu đề Cột 1\n\n"
            "Phần đầu tiên thảo luận về quy trình trí tuệ nhân tạo và học máy.\n"
            "Văn bản ở cột bên trái phải được đọc tuần tự trước khi bước qua rãnh ngăn cách giữa các cột.\n"
            "Ranh giới phân tách cột phải được tuân thủ nghiêm ngặt.\n\n"
            "Tiêu đề Cột 2\n\n"
            "Phần thứ hai đề cập đến hệ thống dịch máy nơ-ron đa ngôn ngữ.\n"
            "Nội dung cột bên phải tiếp nối sau cột thứ nhất theo thứ tự đọc tự nhiên.\n"
            "Đánh giá khả năng phân tích ranh giới cột tự nhiên."
        )
    },
    {
        "source_doc": "complex_tables_and_symbols.pdf",
        "source_lang": "en",
        "target_lang": "vi",
        "filename": "complex_tables_and_symbols_vi.txt",
        "ground_truth": (
            "Báo cáo Khoa học Phức tạp & Tổng kết Tài chính\n\n"
            "Công thức Toán học & Ký hiệu:\n"
            "E = m * c^2 | f(x) = alpha * x + beta | Sum(i=1..N) [ x_i ] = Sigma\n\n"
            "Bảng Cân đối Tài chính:\n"
            "Mục                Doanh_thu_Q1   Doanh_thu_Q2   Tỷ_lệ_tăng_trưởng\n"
            "Dịch vụ Phần cứng  $120,500       $145,200       +20.5%\n"
            "Bản quyền Phần mềm $340,000       $390,000       +14.7%\n"
            "Ký hiệu Đặc biệt: @ # $ % & * [ ] { } < > / = + -"
        )
    },
    {
        "source_doc": "scanned_high_quality.pdf",
        "source_lang": "en",
        "target_lang": "vi",
        "filename": "scanned_high_quality_vi.txt",
        "ground_truth": (
            "Chứng nhận Thành tích Học tập\n"
            "Tài liệu này chứng nhận rằng hình ảnh scan có chữ rõ ràng và sắc nét.\n"
            "Hình ảnh scan độ phân giải cao 300 DPI với độ tương phản cao và không bị nghiêng.\n"
            "Độ chính xác OCR kỳ vọng đạt trên 95 phần trăm đối với các ký tự Latinh tiêu chuẩn."
        )
    }
]

metadata_list = []
for p in pairs:
    file_path = TRANS_GT_DIR / p["filename"]
    file_path.write_text(p["ground_truth"], encoding="utf-8")
    metadata_list.append({
        "source_doc": p["source_doc"],
        "source_lang": p["source_lang"],
        "target_lang": p["target_lang"],
        "filename": p["filename"],
        "ground_truth_path": str(file_path.relative_to(Path(__file__).parent)),
    })

meta_file = TRANS_GT_DIR / "translation_metadata.json"
meta_file.write_text(json.dumps(metadata_list, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Generated {len(metadata_list)} translation ground truth files successfully!")

