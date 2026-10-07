from fastapi.testclient import TestClient

from app.api import app
from app.dependencies import llm

client = TestClient(app)


def setup_function() -> None:
    llm.calls.clear()


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_review_returns_llm_answer() -> None:
    response = client.post("/api/reviews", json={"diff": "diff --git a/x.py b/x.py\n+print(1)\n"})
    assert response.status_code == 200
    assert response.json() == {"comment": "stub review: no problems found"}
    assert len(llm.calls) == 1
