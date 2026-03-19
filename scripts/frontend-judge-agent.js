'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { file: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--file' && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function toTimestamp(isoString) {
  const t = Date.parse(isoString);
  if (Number.isNaN(t)) {
    throw new Error(`Invalid date: ${isoString}`);
  }
  return t;
}

function calcScore(scores) {
  const functional = Number(scores.functional || 0);
  const quality = Number(scores.quality || 0);
  const ux = Number(scores.ux || 0);
  const performance = Number(scores.performance || 0);
  const docs = Number(scores.docs || 0);
  return functional + quality + ux + performance + docs;
}

function evaluate(input) {
  const publishedAt = toTimestamp(input.publishedAt);
  const deadlineDays = Number(input.deadlineDays || 10);
  const deadlineAt = publishedAt + deadlineDays * 24 * 60 * 60 * 1000;
  const passLine = Number(input.passLine || 80);

  const rows = (input.submissions || []).map((s) => {
    const submittedAt = toTimestamp(s.submittedAt);
    const eligible = submittedAt <= deadlineAt;
    const total = calcScore(s.scores || {});
    return {
      agentId: s.agentId,
      prUrl: s.prUrl,
      submittedAt: s.submittedAt,
      eligible,
      score: total,
      scores: s.scores || {},
    };
  });

  const eligibleRows = rows
    .filter((r) => r.eligible)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return toTimestamp(a.submittedAt) - toTimestamp(b.submittedAt);
    });

  const winner = eligibleRows[0] && eligibleRows[0].score >= passLine ? eligibleRows[0] : null;

  return {
    taskId: input.taskId || 'frontend-bounty-unknown',
    publishedAt: new Date(publishedAt).toISOString(),
    deadlineAt: new Date(deadlineAt).toISOString(),
    passLine,
    eligibleSubmissions: eligibleRows.length,
    ineligibleSubmissions: rows.length - eligibleRows.length,
    ranking: eligibleRows.map((r, idx) => ({
      rank: idx + 1,
      agentId: r.agentId,
      prUrl: r.prUrl,
      submittedAt: r.submittedAt,
      score: r.score,
      scores: r.scores,
    })),
    winner: winner
      ? {
          agentId: winner.agentId,
          prUrl: winner.prUrl,
          score: winner.score,
        }
      : null,
    payout: winner
      ? {
          amount: String(input.rewardAmount || 10),
          currency: input.rewardCurrency || 'USDT',
          status: 'pending_tx_hash',
        }
      : {
          amount: '0',
          currency: input.rewardCurrency || 'USDT',
          status: 'no_winner',
        },
  };
}

function main() {
  const args = parseArgs(process.argv);
  const filePath = args.file
    ? path.resolve(process.cwd(), args.file)
    : path.resolve(process.cwd(), 'scripts', 'frontend-judge-input.example.json');

  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const input = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const result = evaluate(input);
  console.log(JSON.stringify(result, null, 2));
}

main();

