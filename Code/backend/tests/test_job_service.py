import sys
import threading
import time
import unittest
from pathlib import Path

# Add Code/backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.job_service import JobManager, JobStatus


class TestJobService(unittest.TestCase):
    def setUp(self):
        self.manager = JobManager(max_retained_jobs=50, job_ttl_seconds=2)

    def test_job_creation(self):
        """Kiểm tra tạo job với ID duy nhất và trạng thái ban đầu PENDING"""
        job1 = self.manager.create_job("doc1.pdf", "vi")
        job2 = self.manager.create_job("doc2.pdf", "en")

        self.assertIsNotNone(job1.job_id)
        self.assertIsNotNone(job2.job_id)
        self.assertNotEqual(job1.job_id, job2.job_id)

        self.assertEqual(job1.status, JobStatus.PENDING)
        self.assertEqual(job1.progress_percentage, 0.0)
        self.assertEqual(job1.processed_pages, 0)
        self.assertEqual(job1.total_pages, 0)
        self.assertIsNone(job1.result)
        self.assertIsNone(job1.error)

    def test_job_lifecycle_success(self):
        """Kiểm tra chu trình chuyển đổi trạng thái thành công: PENDING -> PROCESSING -> COMPLETED"""
        job = self.manager.create_job("lifecycle.pdf", "vi")
        jid = job.job_id

        # 1. Chuyển sang PROCESSING
        self.manager.set_processing(jid, total_pages=10, message="Đang phân tích...")
        job_state = self.manager.get_job(jid)
        self.assertEqual(job_state.status, JobStatus.PROCESSING)
        self.assertEqual(job_state.total_pages, 10)
        self.assertEqual(job_state.current_step, 2)
        self.assertGreaterEqual(job_state.progress_percentage, 10.0)

        # 2. Cập nhật tiến độ từng trang
        self.manager.update_progress(jid, processed_pages=5, total_pages=10, message="Đang xử lý trang 5/10")
        job_state = self.manager.get_job(jid)
        self.assertEqual(job_state.processed_pages, 5)
        # 15 + (5/10)*65 = 47.5%
        self.assertAlmostEqual(job_state.progress_percentage, 47.5, delta=0.5)

        # 3. Chuyển sang dịch thuật
        self.manager.set_translating(jid)
        job_state = self.manager.get_job(jid)
        self.assertEqual(job_state.current_step, 3)
        self.assertGreaterEqual(job_state.progress_percentage, 85.0)

        # 4. Hoàn tất
        dummy_result = {"text": "hello", "translated_text": "xin chào"}
        self.manager.set_completed(jid, result=dummy_result)
        job_state = self.manager.get_job(jid)
        self.assertEqual(job_state.status, JobStatus.COMPLETED)
        self.assertEqual(job_state.progress_percentage, 100.0)
        self.assertEqual(job_state.current_step, 4)
        self.assertEqual(job_state.result, dummy_result)
        self.assertIsNotNone(job_state.completed_at)

    def test_job_lifecycle_failure(self):
        """Kiểm tra chu trình chuyển đổi trạng thái thất bại: PENDING -> PROCESSING -> FAILED"""
        job = self.manager.create_job("fail.pdf", "vi")
        jid = job.job_id

        self.manager.set_processing(jid, total_pages=5)
        self.manager.set_failed(jid, error="Tệp PDF bị hỏng không thể phân tích.")

        job_state = self.manager.get_job(jid)
        self.assertEqual(job_state.status, JobStatus.FAILED)
        self.assertIn("Tệp PDF bị hỏng", job_state.error)
        self.assertIsNotNone(job_state.completed_at)

    def test_no_premature_completion(self):
        """Đảm bảo không bao giờ báo hoàn thành trước khi gọi set_completed"""
        job = self.manager.create_job("check_premature.pdf", "vi")
        jid = job.job_id

        self.manager.set_processing(jid, total_pages=10)
        for p in range(1, 11):
            self.manager.update_progress(jid, processed_pages=p, total_pages=10)
            job_state = self.manager.get_job(jid)
            # Dù xử lý hết 10 trang, tiến độ chưa được vượt 80% (cần dịch) và status vẫn là PROCESSING
            self.assertLessEqual(job_state.progress_percentage, 80.0)
            self.assertEqual(job_state.status, JobStatus.PROCESSING)

    def test_concurrent_job_updates_thread_safe(self):
        """Kiểm tra an toàn luồng khi nhiều thread cập nhật tiến độ đồng thời"""
        job = self.manager.create_job("concurrent.pdf", "vi")
        jid = job.job_id
        self.manager.set_processing(jid, total_pages=100)

        def worker_update(start_p, end_p):
            for p in range(start_p, end_p):
                self.manager.update_progress(jid, processed_pages=p, total_pages=100)
                time.sleep(0.001)

        t1 = threading.Thread(target=worker_update, args=(1, 50))
        t2 = threading.Thread(target=worker_update, args=(50, 101))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        final_job = self.manager.get_job(jid)
        self.assertEqual(final_job.status, JobStatus.PROCESSING)
        self.assertEqual(final_job.processed_pages, 100)

    def test_job_cleanup_expired(self):
        """Kiểm tra cơ chế dọn dẹp các job đã hoàn thành hoặc thất bại vượt quá TTL"""
        job = self.manager.create_job("old.pdf", "vi")
        jid = job.job_id
        self.manager.set_completed(jid, result={})

        # Giả lập thời gian completed_at đã cũ quá 2 giây TTL
        self.manager._jobs[jid].completed_at = time.time() - 5.0

        # Khi tạo job mới, cleanup sẽ tự động chạy
        self.manager.create_job("new.pdf", "vi")
        self.assertIsNone(self.manager.get_job(jid), "Job cũ đã hoàn thành quá TTL phải được dọn dẹp khỏi bộ nhớ.")


if __name__ == "__main__":
    unittest.main()