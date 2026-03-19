'use strict';

/**
 * Minimal MCP-like stdio server for Agent Work Chain query APIs.
 * Supports:
 * - initialize
 * - tools/list
 * - tools/call
 */

const readline = require('readline');

const API_BASE = process.env.QUERY_API_BASE || 'http://localhost:3000';

function ok(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function err(id, message) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code: -32000, message },
  });
}

async function fetchJson(path, params = {}) {
  const url = new URL(path, API_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const tools = [
  {
    name: 'query_tasks',
    description: 'Query tasks by status/creator/agent/keyword',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        creator: { type: 'string' },
        agent: { type: 'string' },
        q: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  },
  {
    name: 'query_agents',
    description: 'Query agents by capability/keyword',
    inputSchema: {
      type: 'object',
      properties: {
        capability: { type: 'string' },
        q: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  },
  {
    name: 'query_events',
    description: 'Query events by task_id/event_name/keyword',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        event_name: { type: 'string' },
        q: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  },
  {
    name: 'query_overview',
    description: 'Get machine-friendly overview summary for agents',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
    },
  },
];

async function callTool(name, args = {}) {
  if (name === 'query_tasks') {
    return fetchJson('/v1/query/agent', { intent: 'tasks', ...args });
  }
  if (name === 'query_agents') {
    return fetchJson('/v1/query/agent', { intent: 'agents', ...args });
  }
  if (name === 'query_events') {
    return fetchJson('/v1/query/agent', { intent: 'events', ...args });
  }
  if (name === 'query_overview') {
    return fetchJson('/v1/query/agent', { intent: 'overview', ...args });
  }
  throw new Error(`Unknown tool: ${name}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    process.stdout.write(err(null, 'Invalid JSON') + '\n');
    return;
  }

  const { id, method, params } = msg;
  try {
    if (method === 'initialize') {
      process.stdout.write(ok(id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'agent-work-chain-query-mcp', version: '0.1.0' },
        capabilities: { tools: {} },
      }) + '\n');
      return;
    }
    if (method === 'tools/list') {
      process.stdout.write(ok(id, { tools }) + '\n');
      return;
    }
    if (method === 'tools/call') {
      const result = await callTool(params?.name, params?.arguments || {});
      process.stdout.write(ok(id, {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      }) + '\n');
      return;
    }
    process.stdout.write(err(id, `Unsupported method: ${method}`) + '\n');
  } catch (e) {
    process.stdout.write(err(id, e.message || 'Unknown error') + '\n');
  }
});
