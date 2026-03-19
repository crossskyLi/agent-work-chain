import { ethers } from 'ethers';
import type Database from 'better-sqlite3';
import { getDb } from './db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TRUST_CHAIN_ABI } = require('../../sdk/src/abi');

const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_ATTEMPTS = 10;

export interface ListenerConfig {
  rpcUrl: string;
  trustChainAddress: string;
}

export class EventListener {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private running = false;
  private reconnectAttempts = 0;
  private config: ListenerConfig;

  constructor(config: ListenerConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.contract = new ethers.Contract(
      config.trustChainAddress,
      TRUST_CHAIN_ABI,
      this.provider,
    );
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.subscribe();
    console.log('[listener] started');
  }

  stop(): void {
    this.running = false;
    this.contract.removeAllListeners();
    console.log('[listener] stopped');
  }

  private subscribe(): void {
    const db = getDb();

    this.provider.on('error', (err: Error) => {
      console.error('[listener] provider error:', err.message);
      this.handleDisconnect();
    });

    this.contract.on('TaskCreated', (...args: unknown[]) => {
      try {
        const [taskId, creator, reward, event] = args as [
          string, string, bigint, ethers.ContractEventPayload,
        ];
        const rewardEth = ethers.formatEther(reward);
        db.prepare(`
          INSERT OR REPLACE INTO tasks (task_id, creator, reward, status, created_at, block_number, tx_hash)
          VALUES (?, ?, ?, 'Created', ?, ?, ?)
        `).run(
          taskId, creator, rewardEth,
          Math.floor(Date.now() / 1000),
          event.log.blockNumber, event.log.transactionHash,
        );
        this.logEvent(db, 'TaskCreated', taskId, event, { creator, reward: rewardEth });
      } catch (err) {
        console.error('[listener] TaskCreated error:', err);
      }
    });

    this.contract.on('TaskAssigned', (...args: unknown[]) => {
      try {
        const [taskId, agentDID, agentAddress, event] = args as [
          string, string, string, ethers.ContractEventPayload,
        ];
        db.prepare(`
          UPDATE tasks SET assigned_agent = ?, assigned_agent_did = ?, status = 'InProgress' WHERE task_id = ?
        `).run(agentAddress, agentDID, taskId);

        db.prepare(`
          INSERT OR IGNORE INTO agents (address, did, capabilities) VALUES (?, ?, '')
        `).run(agentAddress, agentDID);

        this.logEvent(db, 'TaskAssigned', taskId, event, { agentDID, agentAddress });
      } catch (err) {
        console.error('[listener] TaskAssigned error:', err);
      }
    });

    this.contract.on('TaskCompleted', (...args: unknown[]) => {
      try {
        const [taskId, outputCID, event] = args as [
          string, string, ethers.ContractEventPayload,
        ];
        db.prepare(`
          UPDATE tasks SET output_cid = ?, status = 'Completed', completed_at = ? WHERE task_id = ?
        `).run(outputCID, Math.floor(Date.now() / 1000), taskId);
        this.logEvent(db, 'TaskCompleted', taskId, event, { outputCID });
      } catch (err) {
        console.error('[listener] TaskCompleted error:', err);
      }
    });

    this.contract.on('InputSubmitted', (...args: unknown[]) => {
      try {
        const [taskId, inputCID, event] = args as [
          string, string, ethers.ContractEventPayload,
        ];
        db.prepare('UPDATE tasks SET input_cid = ? WHERE task_id = ?').run(inputCID, taskId);
        this.logEvent(db, 'InputSubmitted', taskId, event, { inputCID });
      } catch (err) {
        console.error('[listener] InputSubmitted error:', err);
      }
    });

    this.contract.on('TaskDisputed', (...args: unknown[]) => {
      try {
        const [taskId, disputeID, event] = args as [
          string, bigint, ethers.ContractEventPayload,
        ];
        db.prepare("UPDATE tasks SET status = 'Disputed' WHERE task_id = ?").run(taskId);
        this.logEvent(db, 'TaskDisputed', taskId, event, {
          disputeID: disputeID.toString(),
        });
      } catch (err) {
        console.error('[listener] TaskDisputed error:', err);
      }
    });

    this.contract.on('RewardReleased', (...args: unknown[]) => {
      try {
        const [taskId, agent, amount, event] = args as [
          string, string, bigint, ethers.ContractEventPayload,
        ];
        db.prepare("UPDATE tasks SET status = 'Resolved' WHERE task_id = ?").run(taskId);
        db.prepare(
          'UPDATE agents SET tasks_completed = tasks_completed + 1 WHERE address = ?',
        ).run(agent);

        const netEth = ethers.formatEther(amount);
        this.logEvent(db, 'RewardReleased', taskId, event, { agent, amount: netEth });

        const task = db
          .prepare('SELECT creator, reward FROM tasks WHERE task_id = ?')
          .get(taskId) as { creator: string; reward: string } | undefined;

        db.prepare(`
          INSERT INTO settlements (task_id, type, from_address, to_address, gross_amount, net_amount, block_number, tx_hash)
          VALUES (?, 'reward_released', ?, ?, ?, ?, ?, ?)
        `).run(
          taskId, task?.creator ?? '', agent,
          task?.reward ?? netEth, netEth,
          event.log.blockNumber, event.log.transactionHash,
        );
      } catch (err) {
        console.error('[listener] RewardReleased error:', err);
      }
    });

    this.contract.on('RewardRefunded', (...args: unknown[]) => {
      try {
        const [taskId, creator, amount, event] = args as [
          string, string, bigint, ethers.ContractEventPayload,
        ];
        db.prepare("UPDATE tasks SET status = 'Resolved' WHERE task_id = ?").run(taskId);

        const netEth = ethers.formatEther(amount);
        this.logEvent(db, 'RewardRefunded', taskId, event, { creator, amount: netEth });

        const task = db
          .prepare('SELECT reward FROM tasks WHERE task_id = ?')
          .get(taskId) as { reward: string } | undefined;

        db.prepare(`
          INSERT INTO settlements (task_id, type, from_address, to_address, gross_amount, net_amount, block_number, tx_hash)
          VALUES (?, 'reward_refunded', ?, ?, ?, ?, ?, ?)
        `).run(
          taskId, creator, creator,
          task?.reward ?? netEth, netEth,
          event.log.blockNumber, event.log.transactionHash,
        );
      } catch (err) {
        console.error('[listener] RewardRefunded error:', err);
      }
    });

    this.contract.on('FeeCharged', (...args: unknown[]) => {
      try {
        const [taskId, recipient, feeAmount, event] = args as [
          string, string, bigint, ethers.ContractEventPayload,
        ];
        const feeEth = ethers.formatEther(feeAmount);
        this.logEvent(db, 'FeeCharged', taskId, event, { recipient, feeAmount: feeEth });

        const task = db
          .prepare('SELECT creator FROM tasks WHERE task_id = ?')
          .get(taskId) as { creator: string } | undefined;

        db.prepare(`
          INSERT INTO settlements (task_id, type, from_address, to_address, net_amount, fee_amount, block_number, tx_hash)
          VALUES (?, 'fee_charged', ?, ?, ?, ?, ?, ?)
        `).run(
          taskId, task?.creator ?? '', recipient,
          feeEth, feeEth,
          event.log.blockNumber, event.log.transactionHash,
        );
      } catch (err) {
        console.error('[listener] FeeCharged error:', err);
      }
    });

    this.contract.on('FeeConfigUpdated', (...args: unknown[]) => {
      try {
        const [feeRecipient, feeBps, feeCapWei, event] = args as [
          string, bigint, bigint, ethers.ContractEventPayload,
        ];
        this.logEvent(db, 'FeeConfigUpdated', null, event, {
          feeRecipient,
          feeBps: Number(feeBps),
          feeCapWei: ethers.formatEther(feeCapWei),
        });
      } catch (err) {
        console.error('[listener] FeeConfigUpdated error:', err);
      }
    });
  }

  private async handleDisconnect(): Promise<void> {
    if (!this.running) return;
    this.contract.removeAllListeners();

    while (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS && this.running) {
      this.reconnectAttempts++;
      const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
      console.log(
        `[listener] reconnecting (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`,
      );

      await new Promise((r) => setTimeout(r, delay));

      try {
        this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
        this.contract = new ethers.Contract(
          this.config.trustChainAddress,
          TRUST_CHAIN_ABI,
          this.provider,
        );
        await this.provider.getBlockNumber();
        this.reconnectAttempts = 0;
        this.subscribe();
        console.log('[listener] reconnected');
        return;
      } catch (err) {
        console.error(
          '[listener] reconnect failed:',
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.error('[listener] max reconnect attempts reached');
  }

  private logEvent(
    db: Database.Database,
    name: string,
    taskId: string | null,
    event: ethers.ContractEventPayload,
    data: Record<string, unknown>,
  ): void {
    db.prepare(`
      INSERT INTO events (event_name, task_id, block_number, tx_hash, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name, taskId,
      event.log.blockNumber, event.log.transactionHash,
      JSON.stringify(data),
    );
  }
}
