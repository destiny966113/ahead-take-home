import argparse
import os
import time
from urllib.parse import urlparse

import socket

from sqlalchemy import create_engine, text
from app.core.config import settings


def wait_for_host(host: str, port: int, timeout: int = 60, label: str = "host"):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection((host, port), timeout=2):
                return
        except OSError:
            time.sleep(1)
    raise TimeoutError(f"Timeout waiting for {label} {host}:{port}")


def wait_for_db(timeout: int = 60):
    # parse host/port from DATABASE_URL
    url = urlparse(settings.database_url.replace("+psycopg2", ""))
    host = url.hostname or "db"
    port = url.port or 5432
    wait_for_host(host, port, timeout=timeout, label="DB")
    # also test a simple query; wait for init script to finish
    engine = create_engine(settings.database_url, future=True)
    start = time.time()
    while time.time() - start < timeout:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                # ensure tables exist
                conn.execute(text("SELECT 1 FROM batches LIMIT 1"))
                # ensure latest schema columns (idempotent)
                try:
                    conn.execute(text("ALTER TABLE parse_runs ADD COLUMN IF NOT EXISTS task_state batch_status NOT NULL DEFAULT 'pending'"))
                except Exception:
                    pass
                return
        except Exception:
            time.sleep(1)
    raise TimeoutError("Timeout waiting for DB schema readiness")


def wait_for_redis(timeout: int = 60):
    try:
        import redis

        r = redis.Redis.from_url(settings.redis_url)
    except Exception:
        # best-effort: parse host/port and ping TCP
        url = urlparse(settings.redis_url)
        wait_for_host(url.hostname or "redis", url.port or 6379, timeout=timeout, label="Redis")
        return
    start = time.time()
    while time.time() - start < timeout:
        try:
            if r.ping():
                return
        except Exception:
            time.sleep(1)
    raise TimeoutError("Timeout waiting for Redis")


def wait_for_minio(timeout: int = 60):
    host, port = settings.minio_endpoint.split(":") if ":" in settings.minio_endpoint else (settings.minio_endpoint, "9000")
    wait_for_host(host, int(port), timeout=timeout, label="MinIO")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", action="store_true")
    parser.add_argument("--redis", action="store_true")
    parser.add_argument("--minio", action="store_true")
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()

    if args.db:
        wait_for_db(timeout=args.timeout)
    if args.redis:
        wait_for_redis(timeout=args.timeout)
    if args.minio:
        wait_for_minio(timeout=args.timeout)


if __name__ == "__main__":
    main()
