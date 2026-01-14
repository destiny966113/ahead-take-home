#!/bin/sh
set -e
python -m app.utils.wait_for --db --redis --minio --timeout 120
# IMPORTANT: --concurrency=1 ensures only ONE task is processed at a time
# This prevents 503 errors from the parsing API which can't handle concurrent requests
exec celery -A app.workers.celery_app:celery worker --loglevel=INFO --concurrency=1

