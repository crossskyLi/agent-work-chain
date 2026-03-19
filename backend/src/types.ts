import type { Request } from 'express';

export interface TaskRow {
  task_id: string;
  creator: string;
  assigned_agent: string | null;
  assigned_agent_did: string | null;
  description: string | null;
  input_cid: string | null;
  output_cid: string | null;
  reward: string | null;
  status: string;
  created_at: number | null;
  completed_at: number | null;
  block_number: number | null;
  tx_hash: string | null;
}

export interface AgentRow {
  address: string;
  did: string | null;
  capabilities: string | null;
  tasks_completed: number;
  disputes_won: number;
  disputes_lost: number;
  last_seen_block: number;
}

export interface EventRow {
  id: number;
  event_name: string;
  task_id: string | null;
  block_number: number;
  tx_hash: string;
  data: string | null;
  created_at: number;
}

export interface SettlementRow {
  id: number;
  task_id: string;
  type: string;
  from_address: string;
  to_address: string;
  gross_amount: string | null;
  net_amount: string;
  fee_amount: string | null;
  block_number: number;
  tx_hash: string;
  settled_at: number;
}

export interface TaskQueryParams {
  status?: string;
  creator?: string;
  agent?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AgentQueryParams {
  capability?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface EventQueryParams {
  task_id?: string;
  event_name?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface SettlementQueryParams {
  task_id?: string;
  type?: string;
  address?: string;
  limit?: number;
  offset?: number;
}

export interface AuthenticatedRequest extends Request {
  agentAddress?: string;
}
