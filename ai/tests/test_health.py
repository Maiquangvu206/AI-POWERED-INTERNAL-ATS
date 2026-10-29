from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ai-service"
    assert "timestamp" in body
    assert body["llm"]["provider"]
    assert body["embedding"]["model"]


def test_analyze_requires_internal_token() -> None:
    response = client.post(
        "/internal/v1/ai/analyze",
        json={
            "cv_url": "http://localhost:9000/cv-files/cv/2026/10/test.pdf",
            "jd_text": "Cần 3 năm kinh nghiệm Node.js, PostgreSQL và Docker cho team Platform.",
            "required_skills": ["Node.js"],
        },
    )

    assert response.status_code == 401


def test_analyze_validates_payload() -> None:
    response = client.post(
        "/internal/v1/ai/analyze",
        headers={"X-Internal-Token": "change-me-internal-service-token"},
        json={
            "cv_url": "http://localhost:9000/cv-files/cv/2026/10/test.pdf",
            "jd_text": "ngan",
        },
    )

    assert response.status_code == 422
