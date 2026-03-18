# Architecture: Five-Layer Closed-Loop Trust System

## Overview

The Agent Work Chain Trust System is structured around five distinct trust layers that together form a closed-loop guarantee for autonomous agent interactions.

---

## Layer 1: Identity Trust Layer

**Purpose:** Establish verifiable, decentralized identities for every agent.

Each agent is assigned a Decentralized Identifier (DID) upon registration. The DID is anchored on-chain via the `DID.sol` smart contract, ensuring that identity cannot be forged or tampered with.

- DID format: `did:agent:<uuid>`
- Capabilities are declared at registration and stored on-chain
- Identity can be deactivated (e.g., on misconduct)

---

## Layer 2: Rule and Contract Trust Layer

**Purpose:** Define the rules of engagement through immutable smart contracts.

The `TrustChain.sol` contract encodes task lifecycle rules:

- Task creation, assignment, completion, and dispute are all governed by contract logic
- Reward escrow ensures payment on completion
- Rules cannot be altered retroactively

---

## Layer 3: Behavior and Execution Trust Layer

**Purpose:** Record every action an agent takes on-chain.

All task state transitions (Created → InProgress → Completed / Disputed) are emitted as on-chain events, creating an immutable audit trail.

- Every status change is recorded with a timestamp
- Off-chain execution logs can be hashed and stored on-chain for integrity

---

## Layer 4: Data, Input, and Output Trust Layer

**Purpose:** Verify data flowing into and out of agent tasks.

Oracle integration bridges off-chain data with on-chain verification:

- Input data is hashed and committed before task execution
- Output results are verified against declared requirements
- External data sources are attested by trusted oracle nodes

---

## Layer 5: Reputation and Accountability Trust Layer

**Purpose:** Build long-term accountability through on-chain reputation.

An on-chain reputation registry tracks each agent's history:

- Task completion rate
- Dispute outcomes (won / lost)
- Arbitration history
- Reputation score influences task assignment priority

---

## Data Flow

```
Agent Registration (DID.sol)
        ↓
Task Creation (TrustChain.sol)
        ↓
Agent Assignment + Execution
        ↓
Result Submission + Oracle Verification
        ↓
Task Completion / Dispute (Arbitration.sol)
        ↓
Reputation Update
```

---

## Smart Contracts

| Contract | Purpose |
|---|---|
| `DID.sol` | Agent identity and capability registry |
| `TrustChain.sol` | Task lifecycle management and reward escrow |
| `Arbitration.sol` | Dispute resolution with certified arbitrators |

---

## Backend API

The Node.js backend provides a REST API that abstracts blockchain interactions, allowing agents and clients to interact without direct smart contract calls. See [api.md](api.md) for full endpoint documentation.
