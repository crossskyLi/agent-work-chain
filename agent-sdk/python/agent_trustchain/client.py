import requests
from typing import List, Dict, Any, Optional


class AgentClient:
    """Client for the Agent TrustChain API."""

    def __init__(self, api_key: str, base_url: str = "https://api.agent-trustchain.com"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        })

    def register_agent(self, agent_data: Dict[str, Any]) -> str:
        """Register a new agent and return agent ID."""
        response = self.session.post(f"{self.base_url}/v1/agents", json=agent_data)
        response.raise_for_status()
        return response.json()["agent_id"]

    def get_agent(self, agent_id: str) -> Dict[str, Any]:
        """Get agent information."""
        response = self.session.get(f"{self.base_url}/v1/agents/{agent_id}")
        response.raise_for_status()
        return response.json()

    def create_task(self, task_data: Dict[str, Any]) -> str:
        """Create a new task and return task ID."""
        response = self.session.post(f"{self.base_url}/v1/tasks", json=task_data)
        response.raise_for_status()
        return response.json()["task_id"]

    def get_task_result(self, task_id: str) -> Dict[str, Any]:
        """Get task result."""
        response = self.session.get(f"{self.base_url}/v1/tasks/{task_id}")
        response.raise_for_status()
        return response.json()

    def complete_task(self, task_id: str, result: Dict[str, Any]) -> bool:
        """Mark a task as completed."""
        response = self.session.put(
            f"{self.base_url}/v1/tasks/{task_id}/complete", json=result
        )
        response.raise_for_status()
        return response.json()["success"]

    def submit_arbitration(self, arbitration_data: Dict[str, Any]) -> str:
        """Submit an arbitration request."""
        response = self.session.post(
            f"{self.base_url}/v1/arbitration", json=arbitration_data
        )
        response.raise_for_status()
        return response.json()["dispute_id"]
