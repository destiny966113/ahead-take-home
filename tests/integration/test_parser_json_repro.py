import pytest
import os
from fastapi.testclient import TestClient
from uuid import uuid4
from app.main import app
from app.models.models import ParseStatus, BatchStatus

os.environ["CELERY_EAGER"] = "true"

client = TestClient(app)

def test_get_parser_json_success():
    # 1. Setup Data
    from app.db.session import get_session
    from app.repositories.paper_repo import PaperRepository
    from app.repositories.run_repo import RunRepository
    
    with get_session() as db:
        paper_repo = PaperRepository(db)
        paper = paper_repo.create(filename="parser_test.pdf", file_hash=f"g_hash_{uuid4()}")
        
        run_repo = RunRepository(db)
        # Case A: populated raw_metadata with parser_raw
        raw_meta = {
            "omip_id": "OMIP-TEST", 
            "title": "G Title", 
            "authors": ["G Auth"], 
            "year": 2024,
            "parser_raw": {"some": "raw_json"}
        }
        run = run_repo.create(paper_id=paper.id, batch_id=None, raw_metadata=raw_meta)
        run.task_state = BatchStatus.completed
        run_id = str(run.id)
        db.commit()

    headers = {"X-Role": "annotator"}

    # 2. Get Parser
    r = client.get(f"/api/runs/{run_id}/parser", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data == {"some": "raw_json"}


def test_get_parser_json_rebuild():
    # 1. Setup Data - NO parser_raw in metadata
    from app.db.session import get_session
    from app.repositories.paper_repo import PaperRepository
    from app.repositories.run_repo import RunRepository
    
    with get_session() as db:
        paper_repo = PaperRepository(db)
        paper = paper_repo.create(filename="parser_rebuild.pdf", file_hash=f"g_hash_re_{uuid4()}")
        
        run_repo = RunRepository(db)
        # Case B: populated raw_metadata WITHOUT parser_raw
        raw_meta = {
            "omip_id": "OMIP-REBUILD", 
            "title": "Rebuild Title", 
            "authors": ["Rebuild Auth"], 
            "year": 2025
        }
        run = run_repo.create(paper_id=paper.id, batch_id=None, raw_metadata=raw_meta)
        run.task_state = BatchStatus.completed
        run_id = str(run.id)
        db.commit()

    headers = {"X-Role": "annotator"}

    # 2. Get Parser - Should return reconstructed
    r = client.get(f"/api/runs/{run_id}/parser", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["omip_id"] == "OMIP-REBUILD"
    assert data["title"] == "Rebuild Title"
    assert data["tables"] == []

def test_get_parser_json_empty_metadata():
    # 1. Setup Data - Empty metadata
    from app.db.session import get_session
    from app.repositories.paper_repo import PaperRepository
    from app.repositories.run_repo import RunRepository
    
    with get_session() as db:
        paper_repo = PaperRepository(db)
        paper = paper_repo.create(filename="parser_empty.pdf", file_hash=f"g_hash_empty_{uuid4()}")
        
        run_repo = RunRepository(db)
        # Case C: Empty metadata
        run = run_repo.create(paper_id=paper.id, batch_id=None, raw_metadata={})
        run.task_state = BatchStatus.completed
        run_id = str(run.id)
        db.commit()

    headers = {"X-Role": "annotator"}

    # 2. Get Parser - Should return null fields but 200 OK
    r = client.get(f"/api/runs/{run_id}/parser", headers=headers)
    assert r.status_code == 200
    data = r.json()
    # It might return None for fields depending on implementation
    assert "tables" in data
