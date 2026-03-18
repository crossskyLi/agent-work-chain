import pytest
from unittest.mock import patch, MagicMock
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../agent-sdk/python'))

from agent_trustchain.client import AgentClient


class TestAgentClient:
    @patch('agent_trustchain.client.requests.Session')
    def test_register_agent(self, mock_session_class):
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_response = MagicMock()
        mock_response.json.return_value = {"agent_id": "test-id-123"}
        mock_session.post.return_value = mock_response

        client = AgentClient(api_key="test-key", base_url="http://localhost:3000")
        agent_id = client.register_agent({"name": "Test Agent", "capabilities": ["text-gen"]})
        assert agent_id == "test-id-123"

    def test_client_initialization(self):
        client = AgentClient(api_key="my-key", base_url="http://example.com")
        assert client.api_key == "my-key"
        assert client.base_url == "http://example.com"

    def test_client_default_base_url(self):
        client = AgentClient(api_key="my-key")
        assert client.base_url == "https://api.agent-trustchain.com"

    @patch('agent_trustchain.client.requests.Session')
    def test_create_task(self, mock_session_class):
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_response = MagicMock()
        mock_response.json.return_value = {"task_id": "task-456"}
        mock_session.post.return_value = mock_response

        client = AgentClient(api_key="test-key", base_url="http://localhost:3000")
        task_id = client.create_task({"title": "Test Task", "description": "desc"})
        assert task_id == "task-456"

    @patch('agent_trustchain.client.requests.Session')
    def test_complete_task(self, mock_session_class):
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_response = MagicMock()
        mock_response.json.return_value = {"success": True}
        mock_session.put.return_value = mock_response

        client = AgentClient(api_key="test-key", base_url="http://localhost:3000")
        success = client.complete_task("task-456", {"result": "done"})
        assert success is True

    @patch('agent_trustchain.client.requests.Session')
    def test_submit_arbitration(self, mock_session_class):
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_response = MagicMock()
        mock_response.json.return_value = {"dispute_id": "dispute-789"}
        mock_session.post.return_value = mock_response

        client = AgentClient(api_key="test-key", base_url="http://localhost:3000")
        dispute_id = client.submit_arbitration({"taskId": "task-456", "reason": "bad result"})
        assert dispute_id == "dispute-789"
