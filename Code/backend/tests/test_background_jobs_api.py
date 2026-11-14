import asyncio
import json
import os
import sys
import tempfile
import threading
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
from app.api.process import (
    _execute_pdf_background_job,
    cancel_processing_job,
    create_processing_job,
    get_job_status,
    _job_semaphore,
    router,
)
from fastapi import HTTPException
from unittest.mock import MagicMock, patch

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


def run_coro_drive(coro):
    """Thực thi coroutine lồng nhau đồng bộ mà không cần event loop hoặc socketpair (PDFL-71.5)"""
    import inspect

    gen = coro.__await__()
    val = None
    while True:
        try:
            future = gen.send(val)
            if inspect.iscoroutine(future):
                val = run_coro_drive(future)
            else:
                val = future
        except StopIteration as e:
            return e.value


def run_coro(coro):
    """Thực thi coroutine đồng bộ không phụ thuộc asyncio.run()"""
    return run_coro_drive(coro)


class MockUploadFile:
    """Mock UploadFile phục vụ kiểm thử endpoint độc lập với mạng"""

    def __init__(self, filename: str, content: bytes, content_type: str = "application/pdf"):
        self.filename = filename
        self.content_type = content_type
        self.content = content

    async def read(self):
        return self.content


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

    def test_cancel_processing_job_endpoint(self):
        """6. Kiểm tra API endpoint hủy job (/jobs/{job_id}/cancel) và các ràng buộc trạng thái (PDFL-71.1)"""
        # Hủy job hợp lệ
        job = job_manager.create_job("to_cancel.pdf", "vi")
        jid = job.job_id

        res = run_coro(cancel_processing_job(job_id=jid, current_user=None))
        self.assertEqual(res.data["status"], "CANCELLED")
        self.assertEqual(res.data["job_id"], jid)

        # Hủy lại lần 2 -> 400 Bad Request
        with self.assertRaises(HTTPException) as ctx:
            run_coro(cancel_processing_job(job_id=jid, current_user=None))
        self.assertEqual(ctx.exception.status_code, 400)

        # Hủy job không tồn tại -> 404 Not Found
        with self.assertRaises(HTTPException) as ctx404:
            run_coro(cancel_processing_job(job_id="non-existent-1234", current_user=None))
        self.assertEqual(ctx404.exception.status_code, 404)

    @patch("app.api.process.translation_service.translate_text")
    def test_cancel_during_execution_stops_worker_and_releases_semaphore(self, mock_translate):
        """7. Kiểm tra hủy job khi đang xử lý (PROCESSING), đảm bảo worker dừng và giải phóng semaphore (PDFL-71.1)"""
        mock_translate.return_value = {
            "translated_text": "Bản dịch thử nghiệm.",
            "engine_used": "mock_engine",
        }

        src_pdf = DATASET_DIR / "digital" / "digital_single_column.pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(src_pdf.read_bytes())
            tmp_path = Path(tmp.name)

        job = job_manager.create_job("cancel_midway.pdf", "vi")
        jid = job.job_id

        # Hủy ngay trước khi trích xuất
        job_manager.cancel_job(jid, reason="Người dùng chủ động hủy.")

        _execute_pdf_background_job(
            job_id=jid,
            tmp_path=tmp_path,
            filename="cancel_midway.pdf",
            target_lang="vi",
            max_allowed_pages=100,
            file_size_mb=0.1,
        )

        final_job = job_manager.get_job(jid)
        self.assertEqual(final_job.status, JobStatus.CANCELLED)
        self.assertEqual(_job_semaphore._value, 4, "Semaphore phải được giải phóng hoàn toàn.")
        self.assertFalse(tmp_path.exists())

    @patch("app.api.process.translation_service.translate_text")
    def test_execute_pdf_background_job_success_and_metrics(self, mock_translate):
        """7. Kiểm tra hàm worker thực tế _execute_pdf_background_job hoàn tất và ghi nhận execution_time_ms (PDFL-71.1)"""
        mock_translate.return_value = {
            "translated_text": "Bản dịch thử nghiệm nền thành công.",
            "engine_used": "mock_worker_engine",
        }

        # Chuẩn bị file tạm
        src_pdf = DATASET_DIR / "digital" / "digital_single_column.pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(src_pdf.read_bytes())
            tmp_path = Path(tmp.name)

        job = job_manager.create_job("digital_worker_test.pdf", "vi")
        jid = job.job_id

        _execute_pdf_background_job(
            job_id=jid,
            tmp_path=tmp_path,
            filename="digital_worker_test.pdf",
            target_lang="vi",
            max_allowed_pages=100,
            file_size_mb=0.1,
        )

        completed_job = job_manager.get_job(jid)
        self.assertIsNotNone(completed_job)
        self.assertEqual(completed_job.status, JobStatus.COMPLETED)
        self.assertIsNotNone(completed_job.result)
        self.assertIn("execution_time_ms", completed_job.result)
        self.assertGreater(completed_job.result["execution_time_ms"], 0)
        self.assertFalse(tmp_path.exists(), "Tệp tạm phải được xóa dọn dẹp sau khi xử lý xong.")

    def test_concurrency_queueing_and_semaphore_release(self):
        """8. Kiểm tra cơ chế xếp hàng khi vượt quá giới hạn 4 worker đồng thời và giải phóng tài nguyên (PDFL-71.1)"""
        # Giả lập chiếm toàn bộ 4 permit của semaphore
        for _ in range(4):
            _job_semaphore.acquire()

        self.assertEqual(_job_semaphore._value, 0)
        try:
            job = job_manager.create_job("queued_doc.pdf", "vi")
            jid = job.job_id

            worker_started = threading.Event()
            worker_done = threading.Event()

            # Tạo file tạm dummy
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(b"%PDF-1.4 dummy content")
                tmp_path = Path(tmp.name)

            try:
                def run_worker():
                    worker_started.set()
                    _execute_pdf_background_job(
                        job_id=jid,
                        tmp_path=tmp_path,
                        filename="queued_doc.pdf",
                        target_lang="vi",
                        max_allowed_pages=10,
                        file_size_mb=0.01,
                    )
                    worker_done.set()

                t = threading.Thread(target=run_worker)
                t.start()
                worker_started.wait(timeout=2.0)

                # Chờ 0.6s để worker cố acquire semaphore và chuyển sang trạng thái xếp hàng
                time.sleep(0.6)

                queued_job = job_manager.get_job(jid)
                self.assertEqual(queued_job.status, JobStatus.PENDING)
                self.assertIn("Hệ thống đang bận", queued_job.message)

                # Hủy job trong khi đang xếp hàng
                job_manager.cancel_job(jid, reason="Hủy khi đang đợi slot.")

                # Chờ worker phát hiện tín hiệu hủy và thoát vòng lặp
                worker_done.wait(timeout=3.0)
                t.join(timeout=3.0)

                final_job = job_manager.get_job(jid)
                self.assertEqual(final_job.status, JobStatus.CANCELLED)
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()
        finally:
            # Giải phóng lại 4 permit đã chiếm
            for _ in range(4):
                _job_semaphore.release()

        self.assertEqual(_job_semaphore._value, 4, "Semaphore phải được hoàn trả đầy đủ 4 permit.")

    @patch("app.api.process.threading.Thread")
    def test_post_jobs_endpoint_returns_202_and_job_id(self, mock_thread):
        """9. Kiểm tra luồng POST /api/process/jobs trả về HTTP 202, job_id, trạng thái PENDING và GET job (PDFL-71.5)"""
        # 1. Xác thực route contract trả về status code 202 (HTTP_202_ACCEPTED)
        jobs_route = next(
            (r for r in router.routes if getattr(r, "path", None) == "/api/process/jobs" and "POST" in getattr(r, "methods", set())),
            None,
        )
        self.assertIsNotNone(jobs_route)
        self.assertEqual(jobs_route.status_code, 202)

        # 2. Chuẩn bị file PDF mẫu hợp lệ
        src_pdf = DATASET_DIR / "digital" / "digital_single_column.pdf"
        if src_pdf.exists():
            pdf_bytes = src_pdf.read_bytes()
        else:
            pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"

        mock_file = MockUploadFile("test_api_doc.pdf", pdf_bytes, "application/pdf")

        # 3. Thực thi endpoint tạo job
        res = run_coro_drive(
            create_processing_job(
                file=mock_file,
                target_lang="vi",
                pages=None,
                current_user=None,
            )
        )
        self.assertIsNotNone(res)
        self.assertTrue(res.success)
        job_data = res.data
        job_id = job_data.get("job_id")
        self.assertIsNotNone(job_id)
        self.assertEqual(job_data.get("status"), "PENDING")
        self.assertEqual(job_data.get("filename"), "test_api_doc.pdf")
        self.assertEqual(job_data.get("progress_percentage"), 0.0)

        # 4. Xác nhận worker thread đã được spawn ở chế độ nền
        mock_thread.assert_called_once()

        # 5. Kiểm tra GET /api/process/jobs/{job_id} trả về đúng job vừa tạo
        get_res = run_coro_drive(get_job_status(job_id=job_id))
        self.assertIsNotNone(get_res)
        self.assertEqual(get_res.data["job_id"], job_id)
        self.assertEqual(get_res.data["status"], "PENDING")

    @patch("app.api.process.translation_service.translate_text")
    def test_concurrency_queued_job_auto_resumes_when_slot_frees_up(self, mock_translate):
        """10. Kiểm tra job PENDING trong hàng đợi tự động resume và chạy khi có slot giải phóng (PDFL-71.5)"""
        mock_translate.return_value = {
            "translated_text": "Bản dịch tự động sau khi giải phóng slot.",
            "engine_used": "mock_resume_engine",
        }

        # Chiếm toàn bộ 4 permit của semaphore
        for _ in range(4):
            _job_semaphore.acquire()

        self.assertEqual(_job_semaphore._value, 0)
        try:
            job = job_manager.create_job("auto_resume_doc.pdf", "vi")
            jid = job.job_id

            src_pdf = DATASET_DIR / "digital" / "digital_single_column.pdf"
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(src_pdf.read_bytes())
                tmp_path = Path(tmp.name)

            try:
                def run_worker():
                    _execute_pdf_background_job(
                        job_id=jid,
                        tmp_path=tmp_path,
                        filename="auto_resume_doc.pdf",
                        target_lang="vi",
                        max_allowed_pages=100,
                        file_size_mb=0.1,
                    )

                t = threading.Thread(target=run_worker)
                t.start()

                # Đợi worker vào trạng thái xếp hàng PENDING
                time.sleep(0.6)
                queued_job = job_manager.get_job(jid)
                self.assertEqual(queued_job.status, JobStatus.PENDING)
                self.assertIn("Hệ thống đang bận", queued_job.message)

                # Giải phóng 1 permit để worker tự resume
                _job_semaphore.release()

                # Chờ worker kết thúc xử lý thành công
                t.join(timeout=5.0)

                final_job = job_manager.get_job(jid)
                self.assertEqual(final_job.status, JobStatus.COMPLETED)
                self.assertIsNotNone(final_job.result)
                self.assertIn("translated_text", final_job.result)
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()
        finally:
            # Giải phóng 3 permit còn lại đã chiếm
            for _ in range(3):
                _job_semaphore.release()

        self.assertEqual(_job_semaphore._value, 4, "Semaphore phải được hoàn trả đầy đủ 4 permit.")

    @patch("app.api.process.pdf_service.extract_hybrid_fast_path")
    def test_worker_exception_cleans_temp_file_and_releases_semaphore(self, mock_extract):
        """11. Kiểm tra worker khi gặp unhandled exception: chuyển FAILED, dọn dẹp file tạm và nhả semaphore (PDFL-71.5)"""
        mock_extract.side_effect = RuntimeError("Simulated crash during extraction")

        src_pdf = DATASET_DIR / "digital" / "digital_single_column.pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(src_pdf.read_bytes())
            tmp_path = Path(tmp.name)

        job = job_manager.create_job("crash_doc.pdf", "vi")
        jid = job.job_id

        _execute_pdf_background_job(
            job_id=jid,
            tmp_path=tmp_path,
            filename="crash_doc.pdf",
            target_lang="vi",
            max_allowed_pages=100,
            file_size_mb=0.1,
        )

        final_job = job_manager.get_job(jid)
        self.assertIsNotNone(final_job)
        self.assertEqual(final_job.status, JobStatus.FAILED)
        self.assertIn("Simulated crash during extraction", final_job.error)
        self.assertEqual(_job_semaphore._value, 4, "Semaphore phải được giải phóng dù xảy ra exception.")
        self.assertFalse(tmp_path.exists(), "Tệp tạm phải được xóa dọn dẹp trong khối finally dù xảy ra exception.")


if __name__ == "__main__":
    unittest.main()
