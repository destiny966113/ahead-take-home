from celery import Celery
from app.core.config import settings


celery = Celery(
    "omip_tasks",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=['app.workers.tasks'],  # Auto-discover tasks
)

celery.conf.update(
    task_always_eager=settings.celery_eager,
    task_eager_propagates=True,
    # Timeout configuration
    task_time_limit=600,  # 10 minutes hard limit per task (kill task after this)
    task_soft_time_limit=540,  # 9 minutes soft limit (raise SoftTimeLimitExceeded)
    # Task acknowledgement - only acknowledge after completion (success or failure)
    task_acks_late=True,
    # Critical: Ensure only ONE task is processed at a time
    worker_prefetch_multiplier=1,  # Worker fetches only 1 task at a time
    worker_concurrency=1,  # Only 1 worker process (ensures sequential processing)
    # Retry configuration
    task_reject_on_worker_lost=True,  # Reject task if worker crashes
    task_acks_on_failure_or_timeout=True,  # Acknowledge failed/timed-out tasks
    # Task routing
    task_create_missing_queues=True,  # Auto-create queues if missing
    # Result backend settings
    result_expires=3600,  # Results expire after 1 hour
    result_persistent=True,  # Persist results to backend
)

