import os
import time
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

os.environ.setdefault("CELERY_EAGER", "true")

from app.main import app
from app.db.session import get_session, engine


def wait_for_db(max_wait: int = 30):
    start = time.time()
    while time.time() - start < max_wait:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                # also ensure a core table exists
                conn.execute(text("SELECT 1 FROM batches LIMIT 1"))
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError("Database not ready after waiting")


@pytest.fixture(scope="session", autouse=True)
def _ready():
    wait_for_db()
    # Clean database for deterministic tests
    from sqlalchemy import text
    with get_session() as s:
        # ensure latest schema diffs (idempotent)
        try:
            s.execute(text("ALTER TABLE parse_runs ADD COLUMN IF NOT EXISTS task_state batch_status NOT NULL DEFAULT 'pending'"))
        except Exception:
            pass
        try:
            s.execute(text("TRUNCATE TABLE extracted_elements, parse_runs, papers, batches, users RESTART IDENTITY CASCADE"))
        except Exception:
            pass


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def db_session():
    with get_session() as s:
        yield s
