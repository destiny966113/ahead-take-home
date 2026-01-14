import pytest
import os
from fastapi.testclient import TestClient
from uuid import uuid4
from app.main import app

os.environ["CELERY_EAGER"] = "true"

client = TestClient(app)

def test_metadata_version_history():
    # 1. Setup Data - Create a paper and run via repo direct usage for speed
    from app.db.session import get_session
    from app.repositories.paper_repo import PaperRepository
    from app.repositories.run_repo import RunRepository
    
    with get_session() as db:
        paper_repo = PaperRepository(db)
        paper = paper_repo.create(filename="vtest.pdf", file_hash=f"vhash_{uuid4()}")
        
        run_repo = RunRepository(db)
        # Initial version
        raw_meta = {"omip_id": "V1", "title": "Title V1", "authors": ["A1"], "year": 2021}
        run = run_repo.create(paper_id=paper.id, batch_id=None, raw_metadata=raw_meta)
        run_id = str(run.id)
        db.commit()

    headers = {"X-Role": "annotator"}

    # 2. Update metadata triggering V2
    update_payload = {"omip_id": "V2", "title": "Title V2", "authors": ["A1", "A2"], "year": 2022}
    r = client.put(f"/api/runs/{run_id}/metadata", json=update_payload, headers=headers)
    assert r.status_code == 200, r.text

    # 3. Update PARSER payload triggering V3
    parser_payload = {"omip_id": "V3", "title": "Title V3", "authors": ["A3"], "year": 2023, "tables": [], "figures": []}
    r = client.put(f"/api/runs/{run_id}/parser", json=parser_payload, headers=headers)
    assert r.status_code == 200, r.text

    # 4. List versions - Expect 3 versions (Initial, Update Meta, Update Parser)
    r = client.get(f"/api/runs/{run_id}/versions", headers=headers)
    assert r.status_code == 200, r.text
    versions = r.json()
    assert len(versions) == 3
    
    # Sort by created_at desc (default from API)
    v3 = versions[0]
    v2 = versions[1]
    v1 = versions[2]
    
    assert v3["omip_id"] == "V3"
    assert v2["omip_id"] == "V2"
    assert v1["omip_id"] == "V1"

    # 5. Get Specific Version Content
    # Get V2 content
    r = client.get(f"/api/runs/{run_id}/versions/{v2['id']}", headers=headers)
    assert r.status_code == 200
    content = r.json()
    assert content["omip_id"] == "V2"
    assert content["title"] == "Title V2"
    # Ensure version_info is present
    assert content["version_info"]["id"] == v2["id"]

    # Get V1 content
    r = client.get(f"/api/runs/{run_id}/versions/{v1['id']}", headers=headers)
    assert r.status_code == 200
    content = r.json()
    assert content["omip_id"] == "V1"
