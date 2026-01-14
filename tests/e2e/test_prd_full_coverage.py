import hashlib
from uuid import UUID
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import text
import pytest


def _role(role: str):
    return {"X-Role": role}


def _get_paper_id(db: Session, data: bytes) -> UUID:
    h = hashlib.sha256(data).hexdigest()
    row = db.execute(text("SELECT id FROM papers WHERE file_hash=:h ORDER BY id DESC LIMIT 1"), {"h": h}).fetchone()
    assert row is not None
    return row[0]


def test_upload_parse_runs_and_task_states(client: TestClient, db_session: Session):
    files = [("files", ("u1.pdf", b"u1", "application/pdf")), ("files", ("u2.pdf", b"u2", "application/pdf")), ("files", ("u3.pdf", b"u3", "application/pdf"))]

    # Upload
    r = client.post("/api/uploads", files=files, headers=_role("annotator"))
    assert r.status_code == 200
    papers = r.json()["papers"]
    print("[UPLOAD] papers:", papers)
    assert len(papers) == 3
    ids = [p["paper_id"] for p in papers]

    # Parse by ids
    r2 = client.post("/api/parse", json={"paper_ids": ids}, headers=_role("annotator"))
    assert r2.status_code == 200
    batch_id = r2.json()["batch_id"]
    print("[PARSE] batch_id:", batch_id)

    # List runs
    runs = client.get(f"/api/batches/{batch_id}/runs", headers=_role("annotator")).json()
    assert len(runs) == 3
    print("[RUNS]", runs)
    for run in runs:
        assert run["task_state"] in ("completed", "failed")
        assert run["parse_status"] == "draft" or run["parse_status"] == "failed"
        assert run["filename"].endswith(".pdf")

    # Check draft structure of first paper
    pid0 = papers[0]["paper_id"]
    dr = client.get(f"/api/papers/{pid0}/draft", headers=_role("annotator"))
    assert dr.status_code == 200
    body = dr.json()
    print("[DRAFT] body keys:", list(body.keys()))
    assert "run_id" in body
    assert "elements" in body and len(body["elements"]) >= 1
    el = body["elements"][0]
    assert el["type"] == "table"
    assert "rows" in el["content"] and len(el["content"]["rows"]) >= 1


def test_role_enforcement_and_edit_approve_flow(client: TestClient, db_session: Session):
    # viewer cannot upload/parse
    f = [("files", ("v.pdf", b"vvv", "application/pdf"))]
    assert client.post("/api/uploads", files=f, headers=_role("viewer")).status_code == 403
    assert client.post("/api/parse", json={"paper_ids": []}, headers=_role("viewer")).status_code == 403

    # annotator upload + quick parse
    files = [("files", ("e.pdf", b"edit", "application/pdf"))]
    r = client.post("/api/batches/parse", files=files, headers=_role("annotator"))
    assert r.status_code == 200
    pid = _get_paper_id(db_session, b"edit")
    print("[QUICK PARSE] paper_id:", pid)

    # annotator edit draft
    dr = client.get(f"/api/papers/{pid}/draft", headers=_role("annotator")).json()
    el_id = dr["elements"][0]["id"]
    pr = client.patch(f"/api/tables/{el_id}", json={"row_index": 0, "col_index": 0, "new_value": "XYZ"}, headers=_role("annotator"))
    assert pr.status_code == 200 and pr.json()["content"]["rows"][0][0] == "XYZ"
    print("[PATCH] updated element:", pr.json())

    # annotator cannot approve
    run_id = dr["run_id"]
    assert client.post(f"/api/reviews/{run_id}/approve", headers=_role("annotator")).status_code == 403

    # reviewer approve
    ar = client.post(f"/api/reviews/{run_id}/approve", headers=_role("reviewer"))
    assert ar.status_code == 200
    print("[APPROVE] resp:", ar.json())

    # viewer can see official and contains XYZ
    vr = client.get(f"/api/papers/{pid}", headers=_role("viewer"))
    assert vr.status_code == 200
    elements = vr.json()["elements"]
    print("[VIEWER] official elements:", elements)
    # Accept any element containing the edited value
    assert any(
        isinstance(e.get("content", {}).get("rows", []), list) and 
        len(e["content"]["rows"])>0 and len(e["content"]["rows"][0])>0 and e["content"]["rows"][0][0] == "XYZ"
        for e in elements
    )

    # annotator cannot edit approved
    pr2 = client.patch(f"/api/tables/{el_id}", json={"row_index": 0, "col_index": 0, "new_value": "NO"}, headers=_role("annotator"))
    assert pr2.status_code in (400, 403)
