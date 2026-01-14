from fastapi.testclient import TestClient


def test_upload_then_parse_by_ids(client: TestClient):
    # upload files
    files = [
        ("files", ("u1.pdf", b"u1", "application/pdf")),
        ("files", ("u2.pdf", b"u2", "application/pdf")),
    ]
    r = client.post("/api/uploads", files=files, headers={"X-Role": "annotator"})
    assert r.status_code == 200
    papers = r.json()["papers"]
    assert len(papers) == 2
    ids = [p["paper_id"] for p in papers]

    # create batch by ids
    r2 = client.post("/api/parse", json={"paper_ids": ids}, headers={"X-Role": "annotator"})
    assert r2.status_code == 200
    data = r2.json()
    assert data["total_count"] == 2

