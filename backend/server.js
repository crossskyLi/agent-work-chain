'use strict';

const express = require('express');
const { ethers } = require('ethers');
const { SiweMessage } = require('siwe');
const { getDb } = require('./db');
const { EventListener } = require('./listener');

const app = express();
app.use(express.json());

// ========== SIWE Auth ==========

async function authenticate(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Missing authorization header' });

  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const message = JSON.parse(Buffer.from(token, 'base64').toString());
      const siwe = new SiweMessage(message.message);
      const result = await siwe.verify({ signature: message.signature });
      if (!result.success) return res.status(401).json({ error: 'Invalid signature' });
      req.agentAddress = result.data.address;
    } catch {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
  } else {
    return res.status(401).json({ error: 'Unsupported auth scheme' });
  }

  next();
}

// ========== Task Discovery ==========

app.get('/v1/tasks', (req, res) => {
  const db = getDb();
  const { status, creator, agent, limit = 50, offset = 0 } = req.query;

  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (creator) {
    sql += ' AND creator = ?';
    params.push(creator);
  }
  if (agent) {
    sql += ' AND assigned_agent = ?';
    params.push(agent);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const tasks = db.prepare(sql).all(...params);
  res.json({ tasks, count: tasks.length });
});

app.get('/v1/tasks/:id', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// ========== Agent Discovery ==========

app.get('/v1/agents', (req, res) => {
  const db = getDb();
  const { capability, limit = 50, offset = 0 } = req.query;

  let sql = 'SELECT * FROM agents WHERE 1=1';
  const params = [];

  if (capability) {
    sql += ' AND capabilities LIKE ?';
    params.push(`%${capability}%`);
  }

  sql += ' ORDER BY tasks_completed DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const agents = db.prepare(sql).all(...params);
  res.json({ agents, count: agents.length });
});

app.get('/v1/agents/:address', (req, res) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE address = ? OR did = ?')
    .get(req.params.address, req.params.address);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

// ========== Event History ==========

app.get('/v1/events', (req, res) => {
  const db = getDb();
  const { task_id, event_name, limit = 100, offset = 0 } = req.query;

  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];

  if (task_id) {
    sql += ' AND task_id = ?';
    params.push(task_id);
  }
  if (event_name) {
    sql += ' AND event_name = ?';
    params.push(event_name);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const events = db.prepare(sql).all(...params);
  res.json({ events, count: events.length });
});

// ========== Health ==========

app.get('/health', (req, res) => {
  const db = getDb();
  const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get();
  res.json({
    status: 'ok',
    tasks: taskCount.count,
    agents: agentCount.count,
  });
});

// ========== Start ==========

const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const TRUSTCHAIN_ADDRESS = process.env.TRUSTCHAIN_ADDRESS;

if (require.main === module) {
  if (!TRUSTCHAIN_ADDRESS) {
    console.error('TRUSTCHAIN_ADDRESS environment variable is required');
    process.exit(1);
  }

  const listener = new EventListener({
    rpcUrl: RPC_URL,
    trustChainAddress: TRUSTCHAIN_ADDRESS,
  });
  listener.start();

  app.listen(PORT, () => {
    console.log(`Indexer running on port ${PORT}`);
    console.log(`Listening to TrustChain at ${TRUSTCHAIN_ADDRESS}`);
  });
}

module.exports = app;
