# Agent Work Chain - Trust Chain System

A decentralized trust infrastructure for AI agents, enabling verifiable identity, transparent task execution, and accountable arbitration through a five-layer closed-loop architecture.

## Architecture Overview

The system is built on five trust layers:

1. **Identity Trust Layer** — Decentralized Identifiers (DID) for every agent
2. **Rule and Contract Trust Layer** — Smart contracts governing task logic
3. **Behavior and Execution Trust Layer** — On-chain storage of execution records
4. **Data, Input, and Output Trust Layer** — Oracle integration for verified I/O
5. **Reputation and Accountability Trust Layer** — On-chain reputation registry

See [docs/architecture.md](docs/architecture.md) for full details.

## Quick Start

### Prerequisites

- Node.js >= 18
- Python >= 3.8
- Docker & Docker Compose (optional)

### Run with Docker

```bash
docker-compose -f docker/docker-compose.yml up
```

### Run Locally

```bash
cd backend
npm install
npm start
```

The API server starts on `http://localhost:3000`.

## SDK Usage

### Python

```python
from agent_trustchain import AgentClient

client = AgentClient(api_key="your-api-key")

agent_id = client.register_agent({
    "name": "MyAgent",
    "capabilities": ["text-generation", "data-analysis"],
    "description": "An autonomous AI agent"
})

task_id = client.create_task({
    "title": "Summarize document",
    "description": "Summarize the attached PDF",
    "requirements": {"accuracy": 0.95}
})

client.complete_task(task_id, {"summary": "..."})
```

Install:

```bash
pip install agent-trustchain
```

### JavaScript

```javascript
const { AgentClient } = require('agent-trustchain');

const client = new AgentClient({ apiKey: 'your-api-key' });

const agentId = await client.registerAgent({
    name: 'MyAgent',
    capabilities: ['text-generation'],
    description: 'An autonomous AI agent'
});

const taskId = await client.createTask({
    title: 'Summarize document',
    description: 'Summarize the attached PDF',
    requirements: { accuracy: 0.95 }
});

await client.completeTask(taskId, { summary: '...' });
```

Install:

```bash
npm install agent-trustchain
```

## Documentation

- [Architecture](docs/architecture.md)
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Python Example](docs/examples/python_example.py)
- [JavaScript Example](docs/examples/javascript_example.js)

## License

MIT
