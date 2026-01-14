import hashlib
from uuid import UUID
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import text


def _headers(role: str):
    return {"X-Role": role}


def _get_paper_id_by_bytes(db: Session, data: bytes) -> UUID:
    h = hashlib.sha256(data).hexdigest()
    row = db.execute(text("select id from papers where file_hash=:h order by id desc limit 1"), {"h": h}).fetchone()
    assert row is not None
    return row[0]


def test_user_story_1_single_pdf_parse_draft_and_viewer_isolation(client: TestClient, db_session: Session):
    files = [("files", ("one.pdf", b"one", "application/pdf"))]
    r = client.post("/api/batches/parse", files=files, headers=_headers("annotator"))
    assert r.status_code == 200
    batch_id = UUID(r.json()["batch_id"])

    # paper should exist and draft accessible by annotator
    pid = _get_paper_id_by_bytes(db_session, b"one")
    dra = client.get(f"/api/papers/{pid}/draft", headers=_headers("annotator"))
    assert dra.status_code == 200

    # viewer cannot see official (no approved yet)
    vr = client.get(f"/api/papers/{pid}", headers=_headers("viewer"))
    assert vr.status_code in (404, 403)


def test_user_story_2_and_3_batch_88_and_progress_with_one_failure(client: TestClient, db_session: Session, monkeypatch):
    # Simulate one failure by monkeypatching element creation to raise on first call
    from app.repositories.element_repo import ElementRepository

    call_count = {"n": 0}
    real_create = ElementRepository.create

    def flaky_create(self, *args, **kwargs):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise RuntimeError("simulated parse failure")
        return real_create(self, *args, **kwargs)

    monkeypatch.setattr(ElementRepository, "create", flaky_create)

    files = [("files", (f"f{i}.pdf", f"d{i}".encode(), "application/pdf")) for i in range(88)]
    r = client.post("/api/batches/parse", files=files, headers=_headers("annotator"))
    assert r.status_code == 200
    batch_id = r.json()["batch_id"]

    # Check progress reflects 1 failed, 87 succeeded
    gr = client.get(f"/api/batches/{batch_id}", headers=_headers("annotator"))
    assert gr.status_code == 200
    data = gr.json()
    assert data["total_count"] == 88
    assert data["success_count"] + data["failed_count"] == 88
    assert data["failed_count"] == 1
    assert data["processing_count"] == 0
    assert data["status"] in ("completed", "failed")


def test_user_story_4_annotator_edit_draft_only(client: TestClient, db_session: Session):
    # Setup: create a draft run via parse
    r = client.post(
        "/api/batches/parse",
        files=[("files", ("ed.pdf", b"ed", "application/pdf"))],
        headers=_headers("annotator"),
    )
    assert r.status_code == 200
    pid = _get_paper_id_by_bytes(db_session, b"ed")
    dr = client.get(f"/api/papers/{pid}/draft", headers=_headers("annotator"))
    el_id = dr.json()["elements"][0]["id"]

    pr = client.patch(
        f"/api/tables/{el_id}",
        json={"row_index": 0, "col_index": 0, "new_value": "Z"},
        headers=_headers("annotator"),
    )
    assert pr.status_code == 200
    assert pr.json()["content"]["rows"][0][0] == "Z"


def test_user_story_5_reviewer_approve_and_reject(client: TestClient, db_session: Session):
    # Create a draft
    r = client.post(
        "/api/batches/parse",
        files=[("files", ("ap.pdf", b"ap", "application/pdf"))],
        headers=_headers("annotator"),
    )
    pid = _get_paper_id_by_bytes(db_session, b"ap")
    print("[US5] Created draft for paper:", pid)
    dr = client.get(f"/api/papers/{pid}/draft", headers=_headers("annotator"))
    run_id = dr.json()["run_id"]

    # Reviewer approves
    ar = client.post(f"/api/reviews/{run_id}/approve", headers=_headers("reviewer"))
    assert ar.status_code == 200
    print("[US5] Approved run:", run_id)

    # Annotator cannot edit approved
    el_id = dr.json()["elements"][0]["id"]
    pr = client.patch(
        f"/api/tables/{el_id}", json={"caption": "nope"}, headers=_headers("annotator")
    )
    assert pr.status_code in (400, 403)

    # Viewer can now see official
    vr = client.get(f"/api/papers/{pid}", headers=_headers("viewer"))
    assert vr.status_code == 200

    # Create another draft and reject
    r2 = client.post(
        "/api/batches/parse",
        files=[("files", ("rp.pdf", b"rp", "application/pdf"))],
        headers=_headers("annotator"),
    )
    pid2 = _get_paper_id_by_bytes(db_session, b"rp")
    dr2 = client.get(f"/api/papers/{pid2}/draft", headers=_headers("annotator"))
    run_id2 = dr2.json()["run_id"]
    rr = client.post(f"/api/reviews/{run_id2}/reject", headers=_headers("reviewer"))
    assert rr.status_code == 200
    print("[US5] Rejected run:", run_id2)
    # Viewer still cannot see rejected paper
    vr2 = client.get(f"/api/papers/{pid2}", headers=_headers("viewer"))
    assert vr2.status_code in (403, 404)


def test_user_story_6_viewer_only_approved(client: TestClient, db_session: Session):
    r = client.post(
        "/api/batches/parse",
        files=[("files", ("vv.pdf", b"vv", "application/pdf"))],
        headers=_headers("annotator"),
    )
    pid = _get_paper_id_by_bytes(db_session, b"vv")
    # viewer cannot access draft data
    vr = client.get(f"/api/papers/{pid}/draft", headers=_headers("viewer"))
    assert vr.status_code == 403


def test_user_story_7_reparse_flow(client: TestClient, db_session: Session):
    # First parse and approve as official
    client.post(
        "/api/batches/parse",
        files=[("files", ("re.pdf", b"re", "application/pdf"))],
        headers=_headers("annotator"),
    )
    pid = _get_paper_id_by_bytes(db_session, b"re")
    draft = client.get(f"/api/papers/{pid}/draft", headers=_headers("annotator")).json()
    run_id = draft["run_id"]
    client.post(f"/api/reviews/{run_id}/approve", headers=_headers("reviewer"))

    # Re-parse same paper (create new draft via /api/parse)
    r2 = client.post("/api/parse", json={"paper_ids": [str(pid)]}, headers=_headers("annotator"))
    assert r2.status_code == 200

    # Official still points to old run until new approved
    vr = client.get(f"/api/papers/{pid}", headers=_headers("viewer"))
    assert vr.status_code == 200
    old_official = vr.json()["official_run_id"]

    # Get latest draft and approve
    draft2 = client.get(f"/api/papers/{pid}/draft", headers=_headers("annotator")).json()
    new_run_id = draft2["run_id"]
    assert new_run_id != old_official
    client.post(f"/api/reviews/{new_run_id}/approve", headers=_headers("reviewer"))

    vr2 = client.get(f"/api/papers/{pid}", headers=_headers("viewer"))
    assert vr2.json()["official_run_id"] != old_official
