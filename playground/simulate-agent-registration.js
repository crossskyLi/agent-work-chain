'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const args = {
    source: path.join(__dirname, '..', 'cache', 'agent-ai-category-summary.json'),
    dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'indexer.db'),
    count: 100,
    reset: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source' && argv[i + 1]) {
      args.source = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    } else if (arg === '--db' && argv[i + 1]) {
      args.dbPath = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    } else if (arg === '--count' && argv[i + 1]) {
      args.count = Math.max(1, Number(argv[i + 1]) || 100);
      i += 1;
    } else if (arg === '--reset') {
      args.reset = true;
    }
  }

  return args;
}

function normalizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeAddress(seed) {
  const digest = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 40);
  return `0x${digest}`;
}

function buildSyntheticAgents(categories, count) {
  const rows = [];
  const nowBlock = 1000000;
  let idx = 0;

  while (rows.length < count) {
    const category = categories[idx % categories.length];
    const topExamples = Array.isArray(category.topExamples) ? category.topExamples : [];
    const example = topExamples[idx % Math.max(1, topExamples.length)] || {};

    const categoryKey = normalizeText(category.id || category.label || `cat-${idx}`);
    const exampleName = String(example.name || `agent-${idx + 1}`);
    const exampleSlug = normalizeText(exampleName) || `agent-${idx + 1}`;
    const seed = `${categoryKey}:${exampleSlug}:${idx + 1}`;

    const address = makeAddress(seed);
    const did = `did:ethr:${address}`;

    const reviewCount = Number(example.reviewCount || 0);
    const ratingValue = Number(example.ratingValue || 0);
    const tasksCompleted = Math.max(1, Math.round(reviewCount * 0.12 + ratingValue * 8));
    const disputesTotal = Math.round(tasksCompleted * 0.06);
    const disputesWon = Math.max(0, disputesTotal - 1);
    const disputesLost = Math.max(0, disputesTotal - disputesWon);

    const capabilities = [
      categoryKey,
      'task-execution',
      'result-submission',
      reviewCount > 200 ? 'high-volume' : 'general',
    ];

    rows.push({
      address,
      did,
      capabilities: capabilities.join(','),
      tasksCompleted,
      disputesWon,
      disputesLost,
      lastSeenBlock: nowBlock + idx,
      profileName: exampleName,
      profileUrl: String(example.url || ''),
      categoryLabel: String(category.label || category.id || ''),
    });

    idx += 1;
  }

  return rows;
}

function ensureTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      address TEXT PRIMARY KEY,
      did TEXT UNIQUE,
      capabilities TEXT,
      tasks_completed INTEGER DEFAULT 0,
      disputes_won INTEGER DEFAULT 0,
      disputes_lost INTEGER DEFAULT 0,
      last_seen_block INTEGER DEFAULT 0
    );
  `);
}

function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.source)) {
    throw new Error(`Source file not found: ${args.source}`);
  }

  const raw = JSON.parse(fs.readFileSync(args.source, 'utf8'));
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Source JSON must be a non-empty array.');
  }

  const syntheticAgents = buildSyntheticAgents(raw, args.count);
  const db = new Database(args.dbPath);
  ensureTables(db);

  if (args.reset) {
    db.prepare('DELETE FROM agents').run();
  }

  const upsert = db.prepare(`
    INSERT INTO agents (
      address, did, capabilities, tasks_completed, disputes_won, disputes_lost, last_seen_block
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      did = excluded.did,
      capabilities = excluded.capabilities,
      tasks_completed = excluded.tasks_completed,
      disputes_won = excluded.disputes_won,
      disputes_lost = excluded.disputes_lost,
      last_seen_block = excluded.last_seen_block
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      upsert.run(
        row.address,
        row.did,
        row.capabilities,
        row.tasksCompleted,
        row.disputesWon,
        row.disputesLost,
        row.lastSeenBlock
      );
    }
  });

  insertMany(syntheticAgents);

  const total = db.prepare('SELECT COUNT(*) AS c FROM agents').get().c;
  const preview = db.prepare(`
    SELECT address, did, capabilities, tasks_completed
    FROM agents
    ORDER BY tasks_completed DESC
    LIMIT 5
  `).all();

  console.log(JSON.stringify({
    mode: 'simulated-registration',
    source: args.source,
    dbPath: args.dbPath,
    insertedOrUpdated: syntheticAgents.length,
    totalAgentsInDb: total,
    preview,
  }, null, 2));
}

main();
