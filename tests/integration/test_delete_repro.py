import pytest
import os
from fastapi.testclient import TestClient
from app.main import app

# Force configured for test
os.environ["CELERY_EAGER"] = "true"

client = TestClient(app)

def test_create_and_delete_paper():
    # 1. Create/Upload a fake paper (we can mock the upload or use the paper creation logic)
    # Since upload endpoint does PDF parsing and requires a file, let's use the DB directly to insert a paper.
    from app.db.session import get_session
    from app.repositories.paper_repo import PaperRepository
    from app.repositories.run_repo import RunRepository
    from uuid import uuid4
    
    paper_id = uuid4()
    
    with get_session() as db:
        paper_repo = PaperRepository(db)
        paper = paper_repo.create(filename="repro_delete.pdf", file_hash=f"hash_{paper_id}")
        
        # Create a run with metadata
        run_repo = RunRepository(db)
        raw_metadata = {
            "omip_id": "OMIP-999", 
            "title": "Repro Title", 
            "authors": ["Me"], 
            "year": 2024
        }
        run = run_repo.create(paper_id=paper.id, batch_id=None, raw_metadata=raw_metadata)
        
        paper.official_run_id = run.id
        db.add(paper)
        db.commit()
        
        real_paper_id = paper.id
        real_run_id = run.id

    # 2. Verify it exists
    response = client.get(f"/api/papers/{real_paper_id}")
    # We need to authenticate. The endpoint checks for role.
    headers = {"X-Role": "annotator"}
    
    response = client.get(f"/api/papers/{real_paper_id}", headers=headers)
    assert response.status_code == 200, response.text
    
    # 3. Call Delete
    response = client.delete(f"/api/papers/{real_paper_id}", headers=headers)
    assert response.status_code == 200, f"Delete failed: {response.text}"
    
    # 4. Verify it's gone
    with get_session() as db:
        paper = paper_repo.get(real_paper_id)
        assert paper is None
        
        run = run_repo.get(real_run_id)
        assert run is None
