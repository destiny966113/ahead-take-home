from fastapi.testclient import TestClient


def test_viewer_cannot_create_batch(client: TestClient):
    files = [("files", ("a.pdf", b"dummy", "application/pdf"))]
    r = client.post("/api/batches/parse", files=files, headers={"X-Role": "viewer"})
    assert r.status_code == 403


def test_annotator_can_create_batch(client: TestClient):
    files = [
        ("files", ("a.pdf", b"dummy1", "application/pdf")),
        ("files", ("b.pdf", b"dummy2", "application/pdf")),
    ]
    r = client.post("/api/batches/parse", files=files, headers={"X-Role": "annotator"})
    assert r.status_code == 200
    data = r.json()
    assert "batch_id" in data
    assert data["total_count"] == 2


def test_viewer_cannot_access_draft(client: TestClient):
    # create one paper as annotator
    files = [("files", ("x.pdf", b"data", "application/pdf"))]
    r = client.post("/api/batches/parse", files=files, headers={"X-Role": "annotator"})
    assert r.status_code == 200
    # We don't know paper id here; rely on integration flow for that.
    # This test only ensures route protection works when called.
    # Try accessing a random UUID should still 403 before 404
    import uuid

    random_id = str(uuid.uuid4())
    gr = client.get(f"/api/papers/{random_id}/draft", headers={"X-Role": "viewer"})
    assert gr.status_code == 403
