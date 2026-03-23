import { ethers } from 'ethers';
import type Database from 'better-sqlite3';
import { getDb } from './db';
import { AUDIT_REGISTRY_ABI } from '../../sdk/src/abi';
import { logger } from './middleware/logger';

const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_ATTEMPTS = 10;

export interface ListenerConfig {
  rpcUrl: string;
  auditRegistryAddress: string;
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
      config.auditRegistryAddress,
      AUDIT_REGISTRY_ABI,
      this.provider,
    );
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.subscribe();
    logger.info('listener started — watching AuditRegistry');
  }

  stop(): void {
    this.running = false;
    this.contract.removeAllListeners();
    logger.info('listener stopped');
  }

  private subscribe(): void {
    const db = getDb();

    this.provider.on('error', (err: Error) => {
      logger.error({ err: err.message }, 'listener provider error');
      this.handleDisconnect();
    });

    this.contract.on('AuditorRegistered', (...args: unknown[]) => {
      try {
        const [auditor, specialties, stake, event] = args as [
          string, string, bigint, ethers.ContractEventPayload,
        ];
        db.prepare(`
          INSERT OR REPLACE INTO auditors (address, specialties, stake, registered_at, block_number, tx_hash)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          auditor, specialties, ethers.formatEther(stake),
          Math.floor(Date.now() / 1000),
          event.log.blockNumber, event.log.transactionHash,
        );
        this.logEvent(db, 'AuditorRegistered', null, event, { auditor, specialties, stake: ethers.formatEther(stake) });
      } catch (err) {
        logger.error({ err }, 'listener AuditorRegistered error');
      }
    });

    this.contract.on('AuditSubmitted', (...args: unknown[]) => {
      try {
        const [auditId, auditor, targetAgent, overallScore, event] = args as [
          string, string, string, number, ethers.ContractEventPayload,
        ];
        db.prepare(`
          INSERT OR REPLACE INTO audits (audit_id, auditor, target_agent, overall_score, status, submitted_at, block_number, tx_hash)
          VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?)
        `).run(
          auditId, auditor, targetAgent, overallScore,
          Math.floor(Date.now() / 1000),
          event.log.blockNumber, event.log.transactionHash,
        );
        this.logEvent(db, 'AuditSubmitted', auditId, event, { auditor, targetAgent, overallScore });
      } catch (err) {
        logger.error({ err }, 'listener AuditSubmitted error');
      }
    });

    this.contract.on('AuditConfirmed', (...args: unknown[]) => {
      try {
        const [auditId, event] = args as [string, ethers.ContractEventPayload];
        db.prepare("UPDATE audits SET status = 'Confirmed' WHERE audit_id = ?").run(auditId);

        const audit = db.prepare('SELECT auditor FROM audits WHERE audit_id = ?').get(auditId) as { auditor: string } | undefined;
        if (audit) {
          db.prepare('UPDATE auditors SET total_audits = total_audits + 1 WHERE address = ?').run(audit.auditor);
        }
        this.logEvent(db, 'AuditConfirmed', auditId, event, {});
      } catch (err) {
        logger.error({ err }, 'listener AuditConfirmed error');
      }
    });

    this.contract.on('AuditDisputeRaised', (...args: unknown[]) => {
      try {
        const [auditId, reason, event] = args as [string, string, ethers.ContractEventPayload];
        db.prepare("UPDATE audits SET status = 'Disputed' WHERE audit_id = ?").run(auditId);
        this.logEvent(db, 'AuditDisputeRaised', auditId, event, { reason });
      } catch (err) {
        logger.error({ err }, 'listener AuditDisputeRaised error');
      }
    });

    this.contract.on('CertificationIssued', (...args: unknown[]) => {
      try {
        const [agent, certType, validUntil, event] = args as [
          string, string, bigint, ethers.ContractEventPayload,
        ];
        db.prepare(`
          INSERT OR REPLACE INTO certifications (agent, cert_type, issued_at, valid_until, block_number, tx_hash)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          agent, certType,
          Math.floor(Date.now() / 1000), Number(validUntil),
          event.log.blockNumber, event.log.transactionHash,
        );
        this.logEvent(db, 'CertificationIssued', null, event, { agent, certType, validUntil: Number(validUntil) });
      } catch (err) {
        logger.error({ err }, 'listener CertificationIssued error');
      }
    });
  }

  private async handleDisconnect(): Promise<void> {
    if (!this.running) return;
    this.contract.removeAllListeners();

    while (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS && this.running) {
      this.reconnectAttempts++;
      const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
      logger.info(
        { attempt: this.reconnectAttempts, max: MAX_RECONNECT_ATTEMPTS, delay },
        'listener reconnecting',
      );

      await new Promise((r) => setTimeout(r, delay));

      try {
        this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
        this.contract = new ethers.Contract(
          this.config.auditRegistryAddress,
          AUDIT_REGISTRY_ABI,
          this.provider,
        );
        await this.provider.getBlockNumber();
        this.reconnectAttempts = 0;
        this.subscribe();
        logger.info('listener reconnected');
        return;
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : err },
          'listener reconnect failed',
        );
      }
    }

    logger.error('listener max reconnect attempts reached — indexing stopped');
  }

  private logEvent(
    db: Database.Database,
    name: string,
    auditId: string | null,
    event: ethers.ContractEventPayload,
    data: Record<string, unknown>,
  ): void {
    db.prepare(`
      INSERT INTO events (event_name, audit_id, block_number, tx_hash, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name, auditId,
      event.log.blockNumber, event.log.transactionHash,
      JSON.stringify(data),
    );
  }
}
