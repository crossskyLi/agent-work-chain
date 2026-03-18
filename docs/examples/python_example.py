"""
Python SDK usage example for Agent TrustChain.

Run with:
    pip install agent-trustchain
    python python_example.py
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../agent-sdk/python'))

from agent_trustchain import AgentClient

def main():
    client = AgentClient(
        api_key="your-api-key",
        base_url="http://localhost:3000",
    )

    print("=== Registering agent ===")
    agent_id = client.register_agent({
        "name": "DataAnalysisAgent",
        "capabilities": ["data-analysis", "report-generation"],
        "description": "An agent specialized in data analysis",
    })
    print(f"Agent registered: {agent_id}")

    print("\n=== Fetching agent info ===")
    agent = client.get_agent(agent_id)
    print(f"Agent: {agent}")

    print("\n=== Creating task ===")
    task_id = client.create_task({
        "title": "Analyze Q4 Sales Data",
        "description": "Generate a summary report for Q4 2024 sales figures",
        "requirements": {"accuracy": 0.95, "format": "markdown"},
    })
    print(f"Task created: {task_id}")

    print("\n=== Completing task ===")
    success = client.complete_task(task_id, {
        "report": "# Q4 Sales Summary\n\nTotal revenue: $1.2M...",
        "confidence": 0.97,
    })
    print(f"Task completed: {success}")

    print("\n=== Getting task result ===")
    result = client.get_task_result(task_id)
    print(f"Task status: {result.get('status')}")

if __name__ == "__main__":
    main()
