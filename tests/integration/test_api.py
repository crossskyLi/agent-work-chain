import pytest
import requests

BASE_URL = "http://localhost:3000"
HEADERS = {"Authorization": "Bearer test-api-key", "Content-Type": "application/json"}


def test_register_agent():
    """Test agent registration endpoint."""
    payload = {
        "name": "Integration Test Agent",
        "capabilities": ["text-generation", "data-analysis"],
        "description": "An agent for integration testing",
    }
    response = requests.post(f"{BASE_URL}/v1/agents", json=payload, headers=HEADERS)
    assert response.status_code == 201
    data = response.json()
    assert "agent_id" in data
    assert "did" in data
    return data["agent_id"]


def test_create_task():
    """Test task creation endpoint."""
    payload = {
        "title": "Test Task",
        "description": "A test task for integration testing",
        "requirements": {"accuracy": 0.95},
    }
    response = requests.post(f"{BASE_URL}/v1/tasks", json=payload, headers=HEADERS)
    assert response.status_code == 201
    data = response.json()
    assert "task_id" in data
    return data["task_id"]


def test_complete_task():
    """Test completing a task end-to-end."""
    payload = {
        "title": "Complete Me",
        "description": "Task to be completed",
    }
    create_res = requests.post(f"{BASE_URL}/v1/tasks", json=payload, headers=HEADERS)
    assert create_res.status_code == 201
    task_id = create_res.json()["task_id"]

    complete_res = requests.put(
        f"{BASE_URL}/v1/tasks/{task_id}/complete",
        json={"result": "done"},
        headers=HEADERS,
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["success"] is True


def test_submit_arbitration():
    """Test arbitration submission against a real task."""
    task_payload = {
        "title": "Arbitration Test Task",
        "description": "Task used to test arbitration workflow",
    }
    task_res = requests.post(f"{BASE_URL}/v1/tasks", json=task_payload, headers=HEADERS)
    assert task_res.status_code == 201
    task_id = task_res.json()["task_id"]

    payload = {
        "taskId": task_id,
        "reason": "The result was incorrect",
    }
    response = requests.post(f"{BASE_URL}/v1/arbitration", json=payload, headers=HEADERS)
    assert response.status_code == 201
    assert "dispute_id" in response.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
