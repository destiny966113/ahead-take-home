from uuid import UUID
from fastapi.testclient import TestClient


def test_batch_progress(client: TestClient):
    files = [
        ("files", ("a.pdf", b"dummy1", "application/pdf")),
        ("files", ("b.pdf", b"dummy2", "application/pdf")),
        ("files", ("c.pdf", b"dummy3", "application/pdf")),
    ]
    r = client.post("/api/batches/parse", files=files, headers={"X-Role": "annotator"})
    assert r.status_code == 200
    batch_id = r.json()["batch_id"]
    gr = client.get(f"/api/batches/{batch_id}", headers={"X-Role": "annotator"})
    assert gr.status_code == 200
    data = gr.json()
    assert UUID(data["batch_id"])  # valid UUID
    assert data["total_count"] == 3
    assert data["success_count"] >= 0

