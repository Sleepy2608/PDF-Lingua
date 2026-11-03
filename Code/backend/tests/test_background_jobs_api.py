import asyncio
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from typing import Any

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.job_service import JobStatus, job_manager
from app.services.pdf_service import PDFService
from app.services.ocr_service import OCRService
from unittest.mock import MagicMock

DATASET_DIR = Path(__file__).parent / "dataset"


def execute_pdf_job_sync(
    job_id: str,
    tmp_path: Path,
    filename: str,
    target_lang: str,
    max_allowed_pages: int,
    file_size_mb: float,
    pdf_service: PDFService,
    ocr_service: OCRService,
    translation_service: Any,
) -> None:
    """Hàm mô phỏng logic background worker trong process.py"""
    try:
        validation = pdf_service.validate_pdf(tmp_path)
        if not validation["is_valid"]:
            job_manager.set_failed(job_id, validation["error"] or "Tệp PDF không hợp lệ.")
            return

        page_count = validation["page_count"]
        if page_count <= 0:
            job_manager.set_failed(job_id, "Tài liệu PDF không có trang nào hợp lệ để xử lý.")
            return

        if page_count > max_allowed_pages:
            job_manager.set_failed(
                job_id,
                f"Tài liệu có {page_count} trang, vượt quá giới hạn ({max_allowed_pages} trang).",
            )
            return

        job_manager.set_processing(
            job_id,
            total_pages=page_count,
            message=f"Đang phân tích {page_count} trang PDF...",
        )

        def on_progress(processed: int, total: int, msg: str) -> None:
            job_manager.update_progress(job_id, processed_pages=processed, total_pages=total, message=msg)

        extract_res = pdf_service.extract_hybrid_fast_path(
            tmp_path,
            ocr_service=ocr_service,
            max_pages=max_allowed_pages,
            progress_callback=on_progress,
        )

        original_text = extract_res.get("text", "")
        if not original_text.strip():
            job_manager.set_failed(job_id, "Không thể trích xuất văn bản từ tài liệu này.")
            return

        job_manager.set_translating(job_id, message="Đang dịch thuật văn bản sang ngôn ngữ đích...")
        trans_res = translation_service.translate_text(
            original_text,
            target_lang=target_lang,
            source_lang="auto",
        )

        result_data = {
            "filename": filename,
            "page_count": page_count,
            "file_size_mb": file_size_mb,
            "target_lang": target_lang,
            "is_ocr_used": extract_res.get("ocr_pages_count", 0) > 0 or extract_res.get("fast_path_used") is False,
            "original_text": original_text,
            "translated_text": trans_res["translated_text"],
            "engine_used": trans_res["engine_used"],
        }
        job_manager.set_completed(job_id, result=result_data, message="Xử lý và dịch thuật hoàn tất!")

    except Exception as e:
        job_manager.set_failed(job_id, str(e))


class TestBackgroundJobsAPI(unittest.TestCase):
    def setUp(self):
        self.pdf_service = PDFService()
        self.ocr_service = OCRService()
        self.translation_service = MagicMock()
        self.translation_service.translate_text.return_value = {
            "translated_text": "Bản dịch thử nghiệm tự động.",
            "engine_used": "mock_engine",
        }

    def test_background_job_execution_success(self):
        """1. Kiểm tra worker nền thực thi thành công, cập nhật từng bước và lưu kết quả"""
        pdf_path = DATASET_DIR / "digital" / "digital_single_column.pdf"
        job = job_manager.create_job("digital_single_column.pdf", "vi")
        jid = job.job_id

        execute_pdf_job_sync(
            job_id=jid,
            tmp_path=pdf_path,
            filename="digital_single_column.pdf",
            target_lang="vi",
            max_allowed_pages=100,
            file_size_mb=0.1,
            pdf_service=self.pdf_service,
            ocr_service=self.ocr_service,
            translation_service=self.translation_service,
        )

        final_job = job_manager.get_job(jid)
        self.assertIsNotNone(final_job)
        self.assertEqual(final_job.status, JobStatus.COMPLETED)
        self.assertEqual(final_job.progress_percentage, 100.0)
        self.assertEqual(final_job.current_step, 4)
        self.assertIsNotNone(final_job.result)
        self.assertIn("translated_text", final_job.result)
        self.assertFalse(final_job.result["is_ocr_used"])

    def test_background_job_execution_failure(self):
        """2. Kiểm tra worker nền bắt lỗi và cập nhật trạng thái FAILED chính xác khi tệp hỏng"""
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(b"Corrupted broken data")
            tmp_path = Path(tmp.name)

        try:
            job = job_manager.create_job("corrupted.pdf", "vi")
            jid = job.job_id

            execute_pdf_job_sync(
                job_id=jid,
                tmp_path=tmp_path,
                filename="corrupted.pdf",
                target_lang="vi",
                max_allowed_pages=100,
                file_size_mb=0.01,
                pdf_service=self.pdf_service,
                ocr_service=self.ocr_service,
                translation_service=self.translation_service,
            )

            final_job = job_manager.get_job(jid)
            self.assertEqual(final_job.status, JobStatus.FAILED)
            self.assertIsNotNone(final_job.error)
            self.assertIsNone(final_job.result)
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    def test_sse_streaming_generator_and_reconnection(self):
        """3. Kiểm tra generator SSE stream phân phối event và hỗ trợ kết nối lại (reconnection)"""
        job = job_manager.create_job("streaming_test.pdf", "vi")
        jid = job.job_id

        # Giả lập client 1 kết nối SSE
        q1 = job_manager.subscribe(jid)
        self.assertFalse(q1.empty())
        first_event = q1.get_nowait()
        self.assertEqual(first_event["job_id"], jid)
        self.assertEqual(first_event["status"], "PENDING")

        # Cập nhật tiến độ
        job_manager.set_processing(jid, total_pages=5, message="Đang xử lý...")
        self.assertFalse(q1.empty())
        proc_event = q1.get_nowait()
        self.assertEqual(proc_event["status"], "PROCESSING")
        self.assertEqual(proc_event["total_pages"], 5)

        # Ngắt client 1
        job_manager.unsubscribe(jid, q1)

        # Job hoàn tất khi client 1 đã ngắt kết nối
        job_manager.set_completed(jid, result={"text": "done"})

        # Client 2 kết nối lại (Reconnection) -> Nhận ngay snapshot trạng thái mới nhất
        q2 = job_manager.subscribe(jid)
        self.assertFalse(q2.empty())
        reconnect_event = q2.get_nowait()
        self.assertEqual(reconnect_event["status"], "COMPLETED")
        self.assertEqual(reconnect_event["progress_percentage"], 100.0)
        self.assertEqual(reconnect_event["result"], {"text": "done"})
        job_manager.unsubscribe(jid, q2)

    def test_multi_subscriber_fanout(self):
        """4. Kiểm tra nhiều subscriber nhận cùng sự kiện broadcast (fan-out)"""
        job = job_manager.create_job("fanout_test.pdf", "en")
        jid = job.job_id

        q1 = job_manager.subscribe(jid)
        q2 = job_manager.subscribe(jid)

        # Cả 2 đều nhận snapshot PENDING
        self.assertEqual(q1.get_nowait()["status"], "PENDING")
        self.assertEqual(q2.get_nowait()["status"], "PENDING")

        job_manager.set_processing(jid, total_pages=10, message="Đang OCR...")
        self.assertEqual(q1.get_nowait()["message"], "Đang OCR...")
        self.assertEqual(q2.get_nowait()["message"], "Đang OCR...")

        job_manager.unsubscribe(jid, q1)
        job_manager.unsubscribe(jid, q2)

    def test_job_query_contract(self):
        """5. Kiểm tra truy vấn job status bằng job_id và trường hợp job không tồn tại"""
        job = job_manager.create_job("query_test.pdf", "vi")
        jid = job.job_id

        found = job_manager.get_job(jid)
        self.assertIsNotNone(found)
        self.assertEqual(found.job_id, jid)
        self.assertEqual(found.status, JobStatus.PENDING)

        not_found = job_manager.get_job("non-existent-id")
        self.assertIsNone(not_found)


if __name__ == "__main__":
    unittest.main()
