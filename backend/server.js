'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();

app.use(express.json());

// In-memory stores (replace with a proper DB in production)
const agents = new Map();
const tasks = new Map();
const disputes = new Map();

function authenticate(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Agent endpoints
app.post('/v1/agents', authenticate, (req, res) => {
    const { name, capabilities, description } = req.body;
    if (!name || !capabilities) {
        return res.status(400).json({ error: 'name and capabilities are required' });
    }
    const agent_id = uuidv4();
    const did = `did:agent:${agent_id}`;
    agents.set(agent_id, {
        agent_id,
        did,
        name,
        capabilities,
        description,
        createdAt: Date.now(),
        active: true,
    });
    res.status(201).json({ agent_id, did });
});

app.get('/v1/agents/:id', authenticate, (req, res) => {
    const agent = agents.get(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
});

// Task endpoints
app.post('/v1/tasks', authenticate, (req, res) => {
    const { title, description, requirements } = req.body;
    if (!title || !description) {
        return res.status(400).json({ error: 'title and description are required' });
    }
    const task_id = uuidv4();
    tasks.set(task_id, {
        task_id,
        title,
        description,
        requirements,
        status: 'created',
        createdAt: Date.now(),
    });
    res.status(201).json({ task_id });
});

app.get('/v1/tasks/:id', authenticate, (req, res) => {
    const task = tasks.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

app.put('/v1/tasks/:id/complete', authenticate, (req, res) => {
    const task = tasks.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.status = 'completed';
    task.result = req.body;
    task.completedAt = Date.now();
    res.json({ success: true, task_id: req.params.id });
});

// Arbitration endpoints
app.post('/v1/arbitration', authenticate, (req, res) => {
    const { taskId, reason } = req.body;
    if (!taskId || !reason) {
        return res.status(400).json({ error: 'taskId and reason are required' });
    }
    const dispute_id = uuidv4();
    disputes.set(dispute_id, {
        dispute_id,
        taskId,
        reason,
        status: 'pending',
        createdAt: Date.now(),
    });
    res.status(201).json({ dispute_id });
});

app.get('/v1/arbitration/:id', authenticate, (req, res) => {
    const dispute = disputes.get(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    res.json(dispute);
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Agent TrustChain API server running on port ${PORT}`);
    });
}

module.exports = app;
