import time
from uuid import UUID
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.repositories.batch_repo import BatchRepository
from app.repositories.paper_repo import PaperRepository
from app.repositories.run_repo import RunRepository
from app.models.models import ParseStatus, Paper
from sqlalchemy import text


def _wait_for_batch_done(db: Session, batch_id: UUID, timeout: int = 10):
    repo = BatchRepository(db)
    start = time.time()
    while time.time() - start < timeout:
        # Prefer checking parse_runs have materialized metadata (works in eager mode)
        runs = db.execute(text("SELECT count(*) FROM parse_runs WHERE batch_id = :b AND raw_metadata <> '{}'::jsonb"), {"b": str(batch_id)}).scalar()
        total = db.execute(text("SELECT total_count FROM batches WHERE id = :b"), {"b": str(batch_id)}).scalar()
        if runs is not None and total is not None and runs >= total:
            return
        time.sleep(0.2)
    raise AssertionError("Batch did not finish in time")


def test_end_to_end_flow(client: TestClient, db_session: Session):
    # 1) create batch with two files as annotator
    files = [
        ("files", ("a.pdf", b"dummy1", "application/pdf")),
        ("files", ("b.pdf", b"dummy2", "application/pdf")),
    ]
    r = client.post("/api/batches/parse", files=files, headers={"X-Role": "annotator"})
    assert r.status_code == 200, r.text
    batch_id = UUID(r.json()["batch_id"])

    # wait for tasks to complete (eager mode runs inline but to be safe)
    _wait_for_batch_done(db_session, batch_id)

    # find one paper and its draft run
    paper_repo = PaperRepository(db_session)
    run_repo = RunRepository(db_session)

    # deterministically select the paper we just uploaded: sha256(b"dummy1")
    import hashlib

    h1 = hashlib.sha256(b"dummy1").hexdigest()
    p1 = paper_repo.get_by_hash(h1)
    assert p1 is not None, "Paper created from dummy1 should exist"

    run = run_repo.get_latest_draft_for_paper(p1.id)
    assert run is not None
    assert run.status == ParseStatus.draft

    # 2) annotator edits a table cell
    # get one draft element from API draft endpoint
    dr = client.get(f"/api/papers/{p1.id}/draft", headers={"X-Role": "annotator"})
    assert dr.status_code == 200, dr.text
    first_el = dr.json()["elements"][0]
    el_id = first_el["id"]
    pr = client.patch(
        f"/api/tables/{el_id}",
        json={"row_index": 0, "col_index": 1, "new_value": "X"},
        headers={"X-Role": "annotator"},
    )
    assert pr.status_code == 200
    assert pr.json()["content"]["rows"][0][1] == "X"

    # 3) reviewer approves the run
    ar = client.post(f"/api/reviews/{run.id}/approve", headers={"X-Role": "reviewer"})
    assert ar.status_code == 200

    # 4) viewer can now fetch official data
    vr = client.get(f"/api/papers/{p1.id}", headers={"X-Role": "viewer"})
    assert vr.status_code == 200
    data = vr.json()
    assert data["official_run_id"]
    assert len(data["elements"]) >= 1

    # 5) annotator can no longer edit approved data
    fr = client.patch(
        f"/api/tables/{el_id}",
        json={"caption": "should fail"},
        headers={"X-Role": "annotator"},
    )
    assert fr.status_code in (400, 403)
