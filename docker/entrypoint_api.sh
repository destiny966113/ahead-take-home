#!/bin/sh
set -e
python -m app.utils.wait_for --db --minio --timeout 120
exec uvicorn app.main:app --host 0.0.0.0 --port ${API_PORT:-8088}

