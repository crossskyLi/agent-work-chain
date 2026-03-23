# API Reference — Audit Swarm Indexer

Base URL: `http://localhost:3000`

## Health

### GET /health
Basic health check.

### GET /health/ready
Detailed readiness with DB and infrastructure status.

## Audits

### GET /v1/audits
List audits with filters.

Query params:
- `status` — Pending, Confirmed, Disputed
- `auditor` — auditor address
- `target_agent` — target agent address
- `limit` — max results (default 50, max 500)
- `offset` — pagination offset

### GET /v1/audits/:auditId
Get a single audit by ID.

### GET /v1/audits/agent/:address/score
Get trust score for an agent.

Response: `{ success: true, data: { avg_score: 85, audit_count: 12 } }`

### GET /v1/audits/agent/:address/audits
List all audits for an agent.

## Challenges

### POST /v1/challenges
Create a skill challenge.

Body: `{ targetAgent, challengeType, prompt }`

### POST /v1/challenges/:auditId/evaluate
Evaluate a challenge.

Body: `{ score, report }`

## Trust Scores

### GET /v1/trust-score/:address
Get trust score breakdown for an agent.

### GET /v1/trust-score/leaderboard
Top agents by trust score.

Query params: `limit` (default 20)

## Auditors

### GET /v1/auditors
List all registered auditors.

### GET /v1/auditors/:address
Get auditor details and stats.
