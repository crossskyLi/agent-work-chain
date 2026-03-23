'use strict';

/**
 * MCP stdio server for Audit Swarm indexer APIs (JSON-RPC tools/list + tools/call).
 * Expects backend routes mounted under the same paths as backend/src/routes (see README when wiring app).
 */

const readline = require('readline');

const API_BASE = process.env.AUDIT_INDEXER_BASE || process.env.QUERY_API_BASE || 'http://localhost:3000';

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

async function fetchPath(path) {
  const url = new URL(path, API_BASE);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const tools = [
  {
    name: 'query_audits',
    description: 'Query audits by status, auditor, or target_agent (indexer)',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        auditor: { type: 'string' },
        target_agent: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  },
  {
    name: 'query_trust_score',
    description: 'Get trust score breakdown for an agent address',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: '0x-prefixed agent address' },
      },
      required: ['agent'],
    },
  },
  {
    name: 'query_auditors',
    description: 'List registered auditors',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  },
  {
    name: 'query_certifications',
    description: 'Check certifications for an agent (indexer)',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string' },
        cert_type: { type: 'string' },
      },
      required: ['agent'],
    },
  },
  {
    name: 'query_overview',
    description: 'Protocol overview stats (audits, auditors, certifications aggregates)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function callTool(name, args = {}) {
  if (name === 'query_audits') {
    return fetchJson('/v1/audits', {
      status: args.status,
      auditor: args.auditor,
      target_agent: args.target_agent,
      limit: args.limit,
      offset: args.offset,
    });
  }
  if (name === 'query_trust_score') {
    const agent = String(args.agent || '').replace(/^\/+/, '');
    return fetchPath(`/v1/trust-score/${encodeURIComponent(agent)}`);
  }
  if (name === 'query_auditors') {
    return fetchJson('/v1/auditors', {
      limit: args.limit,
      offset: args.offset,
    });
  }
  if (name === 'query_certifications') {
    const agent = String(args.agent || '').replace(/^\/+/, '');
    return fetchJson('/v1/certifications', {
      agent,
      cert_type: args.cert_type,
    });
  }
  if (name === 'query_overview') {
    return fetchPath('/v1/audit-protocol/overview');
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
      process.stdout.write(
        ok(id, {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'agent-work-chain-audit-mcp', version: '0.1.0' },
          capabilities: { tools: {} },
        }) + '\n',
      );
      return;
    }
    if (method === 'tools/list') {
      process.stdout.write(ok(id, { tools }) + '\n');
      return;
    }
    if (method === 'tools/call') {
      const result = await callTool(params?.name, params?.arguments || {});
      process.stdout.write(
        ok(id, {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        }) + '\n',
      );
      return;
    }
    process.stdout.write(err(id, `Unsupported method: ${method}`) + '\n');
  } catch (e) {
    process.stdout.write(err(id, e.message || 'Unknown error') + '\n');
  }
});
