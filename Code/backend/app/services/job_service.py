import asyncio
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class JobStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class Job:
    job_id: str
    filename: str
    target_lang: str
    user_id: Optional[int] = None
    status: JobStatus = JobStatus.PENDING
    total_pages: int = 0
    processed_pages: int = 0
    progress_percentage: float = 0.0
    current_step: int = 1  # 1: Upload, 2: Extract/OCR, 3: Translate, 4: Complete
    message: str = "Đang khởi tạo tác vụ..."
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    execution_time_ms: Optional[int] = None
    history_id: Optional[int] = None
    _cancel_event: threading.Event = field(default_factory=threading.Event, repr=False)

    @property
    def is_cancelled(self) -> bool:
        return self.status == JobStatus.CANCELLED or self._cancel_event.is_set()

    def to_dict(self) -> dict[str, Any]:
        res_exec_time = self.result.get("execution_time_ms") if isinstance(self.result, dict) else None
        res_hist_id = self.result.get("history_id") if isinstance(self.result, dict) else None
        return {
            "job_id": self.job_id,
            "filename": self.filename,
            "target_lang": self.target_lang,
            "user_id": self.user_id,
            "status": self.status.value,
            "total_pages": self.total_pages,
            "processed_pages": self.processed_pages,
            "progress_percentage": round(self.progress_percentage, 1),
            "current_step": self.current_step,
            "message": self.message,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "completed_at": self.completed_at,
            "execution_time_ms": self.execution_time_ms if self.execution_time_ms is not None else res_exec_time,
            "history_id": self.history_id if self.history_id is not None else res_hist_id,
        }


class JobManager:
    """
    Quản lý vòng đời, trạng thái và tiến độ của các Background Jobs xử lý PDF.
    Hỗ trợ thread-safe, cập nhật tiến độ real-time và phân phối sự kiện cho Streaming (SSE).
    """

    def __init__(self, max_retained_jobs: int = 500, job_ttl_seconds: int = 3600):
        self._jobs: dict[str, Job] = {}
        self._lock = threading.RLock()
        self._subscribers: dict[str, list[tuple[asyncio.Queue, Optional[asyncio.AbstractEventLoop]]]] = {}
        self._max_retained_jobs = max_retained_jobs
        self._job_ttl_seconds = job_ttl_seconds

    def create_job(self, filename: str, target_lang: str, user_id: Optional[int] = None) -> Job:
        with self._lock:
            self._cleanup_expired_jobs_locked()
            job_id = str(uuid.uuid4())
            job = Job(job_id=job_id, filename=filename, target_lang=target_lang, user_id=user_id)
            self._jobs[job_id] = job
            return job

    def get_job(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def set_processing(
        self,
        job_id: str,
        total_pages: int = 0,
        message: str = "Đang phân tích tài liệu PDF...",
        progress_percentage: float = 10.0,
    ) -> Optional[Job]:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.is_cancelled:
                return None
            job.status = JobStatus.PROCESSING
            job.total_pages = total_pages
            job.progress_percentage = max(job.progress_percentage, progress_percentage)
            job.current_step = 2
            job.message = message
            job.updated_at = time.time()
            self._notify_subscribers_locked(job)
            return job

    def set_queued(
        self,
        job_id: str,
        message: str = "Hệ thống đang bận. Đang xếp hàng chờ đến lượt xử lý...",
    ) -> Optional[Job]:
        """Cập nhật thông điệp hàng đợi chờ, giữ nguyên trạng thái PENDING (PDFL-71.1)"""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.is_cancelled:
                return None
            job.status = JobStatus.PENDING
            job.current_step = 1
            job.message = message
            job.updated_at = time.time()
            self._notify_subscribers_locked(job)
            return job

    def update_progress(
        self,
        job_id: str,
        processed_pages: int,
        total_pages: Optional[int] = None,
        message: Optional[str] = None,
        step: Optional[int] = None,
    ) -> Optional[Job]:
        with self._lock:
            job = self._jobs.get(job_id)
            if (
                not job
                or job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)
                or job.is_cancelled
            ):
                return None

            job.status = JobStatus.PROCESSING
            if total_pages is not None and total_pages > 0:
                job.total_pages = total_pages
            job.processed_pages = min(processed_pages, job.total_pages if job.total_pages > 0 else processed_pages)

            # Tính toán % tiến độ (Giai đoạn đọc trang chiếm từ 15% -> 80%)
            if job.total_pages > 0:
                ratio = job.processed_pages / job.total_pages
                calculated_pct = 15.0 + (ratio * 65.0)
                job.progress_percentage = min(80.0, max(job.progress_percentage, calculated_pct))
            else:
                job.progress_percentage = min(80.0, max(job.progress_percentage, 15.0))

            if message is not None:
                job.message = message
            if step is not None:
                job.current_step = step
            job.updated_at = time.time()

            self._notify_subscribers_locked(job)
            return job

    def set_translating(
        self,
        job_id: str,
        message: str = "Đang dịch thuật văn bản sang ngôn ngữ đích...",
        progress_percentage: float = 85.0,
    ) -> Optional[Job]:
        with self._lock:
            job = self._jobs.get(job_id)
            if (
                not job
                or job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)
                or job.is_cancelled
            ):
                return None
            job.status = JobStatus.PROCESSING
            job.current_step = 3
            job.progress_percentage = max(job.progress_percentage, progress_percentage)
            job.message = message
            job.updated_at = time.time()
            self._notify_subscribers_locked(job)
            return job

    def set_completed(
        self,
        job_id: str,
        result: dict[str, Any],
        message: str = "Xử lý và dịch thuật hoàn tất!",
        execution_time_ms: Optional[int] = None,
        history_id: Optional[int] = None,
    ) -> Optional[Job]:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.status in (JobStatus.FAILED, JobStatus.CANCELLED) or job.is_cancelled:
                return None
            job.status = JobStatus.COMPLETED
            job.progress_percentage = 100.0
            job.current_step = 4
            job.message = message
            job.result = result
            if execution_time_ms is not None:
                job.execution_time_ms = execution_time_ms
            elif isinstance(result, dict) and "execution_time_ms" in result:
                job.execution_time_ms = result["execution_time_ms"]
            if history_id is not None:
                job.history_id = history_id
            elif isinstance(result, dict) and "history_id" in result:
                job.history_id = result["history_id"]
            job.updated_at = time.time()
            job.completed_at = time.time()
            self._notify_subscribers_locked(job)
            return job

    def set_failed(
        self,
        job_id: str,
        error: str,
        execution_time_ms: Optional[int] = None,
    ) -> Optional[Job]:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            if job.status == JobStatus.CANCELLED:
                return job
            job.status = JobStatus.FAILED
            job.error = error
            job.message = f"Xử lý thất bại: {error}"
            if execution_time_ms is not None:
                job.execution_time_ms = execution_time_ms
            job.updated_at = time.time()
            job.completed_at = time.time()
            self._notify_subscribers_locked(job)
            return job

    def cancel_job(
        self,
        job_id: str,
        user_id: Optional[int] = None,
        reason: str = "Tác vụ đã bị hủy.",
    ) -> tuple[bool, str, Optional[Job]]:
        """
        Hủy tác vụ một cách an toàn và dứt khoát (PDFL-71.1).
        Phân biệt rõ ràng với ngừng theo dõi SSE (unsubscribe):
        - Hủy job: Thay đổi trạng thái Job sang CANCELLED, phát sự kiện hủy qua _cancel_event.
        - Ngừng theo dõi: Chỉ ngắt kết nối subscriber queue của client mà job vẫn tiếp tục chạy.
        """
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False, "Không tìm thấy tác vụ.", None

            if user_id is not None and job.user_id is not None and job.user_id != user_id:
                return False, "Bạn không có quyền hủy tác vụ của người dùng khác.", None

            if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
                return False, f"Không thể hủy tác vụ vì đã ở trạng thái {job.status.value}.", job

            job.status = JobStatus.CANCELLED
            job.message = reason
            job.error = "Tác vụ đã bị hủy."
            job.updated_at = time.time()
            job.completed_at = time.time()
            job._cancel_event.set()
            self._notify_subscribers_locked(job)
            return True, "Hủy tác vụ thành công.", job

    def is_job_cancelled(self, job_id: str) -> bool:
        """Kiểm tra xem tác vụ đã nhận tín hiệu hủy hay chưa (thread-safe)"""
        with self._lock:
            job = self._jobs.get(job_id)
            return job.is_cancelled if job else False

    def subscribe(self, job_id: str, loop: Optional[asyncio.AbstractEventLoop] = None) -> asyncio.Queue:
        """Đăng ký nhận stream event cho một Job ID (dành cho SSE)"""
        try:
            curr_loop = loop or asyncio.get_running_loop()
        except RuntimeError:
            curr_loop = None

        # Giới hạn kích thước queue để tránh phình bộ nhớ khi client chậm (PDFL-111.4)
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                q.put_nowait(job.to_dict())
            if job_id not in self._subscribers:
                self._subscribers[job_id] = []
            self._subscribers[job_id].append((q, curr_loop))
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue) -> None:
        """Hủy đăng ký nhận stream event"""
        with self._lock:
            if job_id in self._subscribers:
                self._subscribers[job_id] = [item for item in self._subscribers[job_id] if item[0] is not q]
                if not self._subscribers[job_id]:
                    del self._subscribers[job_id]

    def _notify_subscribers_locked(self, job: Job) -> None:
        data = job.to_dict()
        subscribers = self._subscribers.get(job.job_id, [])
        for q, loop in subscribers:
            try:
                # Nếu queue đầy, đẩy bớt event cũ nhất ra để ưu tiên cập nhật mới nhất
                if q.full():
                    try:
                        q.get_nowait()
                    except Exception:
                        pass

                if loop and loop.is_running():
                    try:
                        curr_loop = asyncio.get_running_loop()
                    except RuntimeError:
                        curr_loop = None
                    if curr_loop is loop:
                        q.put_nowait(data)
                    else:
                        loop.call_soon_threadsafe(q.put_nowait, data)
                else:
                    q.put_nowait(data)
            except Exception:
                pass

    def _cleanup_expired_jobs_locked(self) -> None:
        now = time.time()
        expired_ids = [
            jid
            for jid, j in self._jobs.items()
            if (j.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED))
            and (now - (j.completed_at or j.updated_at) > self._job_ttl_seconds)
        ]
        for jid in expired_ids:
            del self._jobs[jid]
            if jid in self._subscribers:
                del self._subscribers[jid]

        # Giới hạn số lượng job tối đa trong RAM:
        # TUYỆT ĐỐI KHÔNG XÓA các Job đang hoạt động (PENDING hoặc PROCESSING) (PDFL-111.4)
        finished_jobs = [
            j
            for j in self._jobs.values()
            if j.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)
        ]
        if len(self._jobs) > self._max_retained_jobs and finished_jobs:
            sorted_finished = sorted(finished_jobs, key=lambda x: (x.completed_at or x.updated_at or x.created_at))
            excess = len(self._jobs) - self._max_retained_jobs
            for old_job in sorted_finished[:excess]:
                if old_job.job_id in self._jobs:
                    del self._jobs[old_job.job_id]
                if old_job.job_id in self._subscribers:
                    del self._subscribers[old_job.job_id]


# Singleton instance để chia sẻ trạng thái xuyên suốt ứng dụng
job_manager = JobManager()
