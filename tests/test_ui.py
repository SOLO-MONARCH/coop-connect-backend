from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_root_page_contains_desired_ui():
    response = client.get("/")
    assert response.status_code == 200
    body = response.text
    assert "Command Center" in body
    assert "Request Cooperative Worker Service" in body
    assert "Submit Service Request" in body
