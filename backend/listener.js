'use strict';

const { ethers } = require('ethers');
const { TRUST_CHAIN_ABI, TASK_STATUS } = require('../sdk/src/abi');
const { getDb } = require('./db');

class EventListener {
  constructor({ rpcUrl, trustChainAddress }) {
    this._provider = new ethers.JsonRpcProvider(rpcUrl);
    this._contract = new ethers.Contract(trustChainAddress, TRUST_CHAIN_ABI, this._provider);
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    const db = getDb();

    this._contract.on('TaskCreated', (taskId, creator, reward, event) => {
      const rewardEth = ethers.formatEther(reward);
      db.prepare(`
        INSERT OR REPLACE INTO tasks (task_id, creator, reward, status, created_at, block_number, tx_hash)
        VALUES (?, ?, ?, 'Created', ?, ?, ?)
      `).run(taskId, creator, rewardEth, Math.floor(Date.now() / 1000), event.log.blockNumber, event.log.transactionHash);

      this._logEvent('TaskCreated', taskId, event, { creator, reward: rewardEth });
    });

    this._contract.on('TaskAssigned', (taskId, agentDID, agentAddress, event) => {
      db.prepare(`
        UPDATE tasks SET assigned_agent = ?, assigned_agent_did = ?, status = 'InProgress' WHERE task_id = ?
      `).run(agentAddress, agentDID, taskId);

      db.prepare(`
        INSERT OR IGNORE INTO agents (address, did, capabilities) VALUES (?, ?, '')
      `).run(agentAddress, agentDID);

      this._logEvent('TaskAssigned', taskId, event, { agentDID, agentAddress });
    });

    this._contract.on('TaskCompleted', (taskId, outputCID, event) => {
      db.prepare(`
        UPDATE tasks SET output_cid = ?, status = 'Completed', completed_at = ? WHERE task_id = ?
      `).run(outputCID, Math.floor(Date.now() / 1000), taskId);

      this._logEvent('TaskCompleted', taskId, event, { outputCID });
    });

    this._contract.on('InputSubmitted', (taskId, inputCID, event) => {
      db.prepare(`UPDATE tasks SET input_cid = ? WHERE task_id = ?`).run(inputCID, taskId);
      this._logEvent('InputSubmitted', taskId, event, { inputCID });
    });

    this._contract.on('TaskDisputed', (taskId, disputeID, event) => {
      db.prepare(`UPDATE tasks SET status = 'Disputed' WHERE task_id = ?`).run(taskId);
      this._logEvent('TaskDisputed', taskId, event, { disputeID: disputeID.toString() });
    });

    this._contract.on('RewardReleased', (taskId, agent, amount, event) => {
      db.prepare(`UPDATE tasks SET status = 'Resolved' WHERE task_id = ?`).run(taskId);

      db.prepare(`
        UPDATE agents SET tasks_completed = tasks_completed + 1 WHERE address = ?
      `).run(agent);

      this._logEvent('RewardReleased', taskId, event, { agent, amount: ethers.formatEther(amount) });
    });

    this._contract.on('RewardRefunded', (taskId, creator, amount, event) => {
      db.prepare(`UPDATE tasks SET status = 'Resolved' WHERE task_id = ?`).run(taskId);
      this._logEvent('RewardRefunded', taskId, event, { creator, amount: ethers.formatEther(amount) });
    });

    console.log('Event listener started');
  }

  stop() {
    this._contract.removeAllListeners();
    this._running = false;
    console.log('Event listener stopped');
  }

  _logEvent(name, taskId, event, data) {
    const db = getDb();
    db.prepare(`
      INSERT INTO events (event_name, task_id, block_number, tx_hash, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, taskId, event.log.blockNumber, event.log.transactionHash, JSON.stringify(data));
  }
}

module.exports = { EventListener };
