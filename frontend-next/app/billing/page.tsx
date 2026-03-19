'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bot, UserRound, Search, Loader2, RefreshCw,
  Wallet, ArrowDownRight, ArrowUpRight, Receipt,
  TrendingUp, Clock, CircleDollarSign, Filter,
} from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type BillingSummary = {
  totalEscrowed: number;
  totalReleased: number;
  totalRefunded: number;
  totalFees: number;
  activeEscrow: number;
  settledCount: number;
  activeCount: number;
};

type Settlement = {
  id: number;
  taskId: string;
  type: 'reward_released' | 'reward_refunded' | 'fee_charged';
  from: string;
  to: string;
  grossAmount: string | null;
  netAmount: string;
  feeAmount: string | null;
  blockNumber: number;
  txHash: string;
  settledAt: number;
};

type Task = {
  task_id: string;
  creator: string;
  assigned_agent: string | null;
  reward: string;
  status: string;
  description: string;
  created_at: number;
};

type MergedRecord = {
  taskId: string;
  description: string;
  creator: string;
  agent: string | null;
  reward: number;
  fee: number;
  netAmount: number;
  billingStatus: 'escrowed' | 'pending_release' | 'settled' | 'disputed' | 'refunded';
  createdAt: number;
  txHash: string | null;
};

type BillingFilter = 'all' | 'escrowed' | 'settled' | 'disputed';

function truncAddr(addr: string | null): string {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatEth(n: number): string {
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toFixed(4);
}

function timeAgo(ts: number): string {
  const sec = Math.floor(Date.now() / 1000) - ts;
  if (sec < 0) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const BILLING_STATUS_STYLE: Record<string, string> = {
  escrowed: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25',
  pending_release: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/25',
  settled: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25',
  disputed: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25',
  refunded: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-500/25',
};

const BILLING_STATUS_LABEL: Record<string, string> = {
  escrowed: 'Escrowed',
  pending_release: 'Pending Release',
  settled: 'Settled',
  disputed: 'Disputed',
  refunded: 'Refunded',
};

function buildMergedRecords(tasks: Task[], settlements: Settlement[]): MergedRecord[] {
  const feeByTx = new Map<string, number>();
  const releasedTasks = new Set<string>();
  const refundedTasks = new Set<string>();
  const releaseByTask = new Map<string, { netAmount: number; txHash: string }>();

  for (const s of settlements) {
    if (s.type === 'fee_charged') {
      feeByTx.set(s.txHash, parseFloat(s.feeAmount ?? '0'));
    } else if (s.type === 'reward_released') {
      releasedTasks.add(s.taskId);
      releaseByTask.set(s.taskId, { netAmount: parseFloat(s.netAmount), txHash: s.txHash });
    } else if (s.type === 'reward_refunded') {
      refundedTasks.add(s.taskId);
      releaseByTask.set(s.taskId, { netAmount: parseFloat(s.netAmount), txHash: s.txHash });
    }
  }

  return tasks.map((t) => {
    const reward = parseFloat(t.reward) || 0;
    const release = releaseByTask.get(t.task_id);
    const fee = release ? (feeByTx.get(release.txHash) ?? 0) : 0;
    const netAmount = release ? release.netAmount : reward - fee;

    let billingStatus: MergedRecord['billingStatus'] = 'escrowed';
    if (releasedTasks.has(t.task_id)) billingStatus = 'settled';
    else if (refundedTasks.has(t.task_id)) billingStatus = 'refunded';
    else if (t.status === 'Completed') billingStatus = 'pending_release';
    else if (t.status === 'Disputed') billingStatus = 'disputed';

    return {
      taskId: t.task_id,
      description: t.description,
      creator: t.creator,
      agent: t.assigned_agent,
      reward,
      fee,
      netAmount,
      billingStatus,
      createdAt: t.created_at,
      txHash: release?.txHash ?? null,
    };
  });
}

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<BillingFilter>('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, tasksRes, settlementsRes] = await Promise.all([
        fetch('/indexer/v1/billing/summary'),
        fetch('/indexer/v1/tasks?limit=500'),
        fetch('/indexer/v1/billing/settlements?limit=500'),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (tasksRes.ok) { const d = await tasksRes.json(); setTasks(d.tasks ?? []); }
      if (settlementsRes.ok) { const d = await settlementsRes.json(); setSettlements(d.settlements ?? []); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const records = useMemo(() => buildMergedRecords(tasks, settlements), [tasks, settlements]);

  const filtered = useMemo(() => {
    let list = records;
    if (filter === 'escrowed') list = list.filter((r) => r.billingStatus === 'escrowed' || r.billingStatus === 'pending_release');
    else if (filter === 'settled') list = list.filter((r) => r.billingStatus === 'settled' || r.billingStatus === 'refunded');
    else if (filter === 'disputed') list = list.filter((r) => r.billingStatus === 'disputed');

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.taskId.toLowerCase().includes(q) ||
          r.creator.toLowerCase().includes(q) ||
          (r.agent ?? '').toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [records, filter, search]);

  const stats = summary ?? {
    totalEscrowed: 0, totalReleased: 0, totalRefunded: 0,
    totalFees: 0, activeEscrow: 0, settledCount: 0, activeCount: 0,
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-primary">AWC</Link>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">/ Billing</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/human"><UserRound className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Human</span></Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/agent"><Bot className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Agent</span></Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">
          {/* Page header */}
          <div className="mb-5 flex items-center justify-between sm:mb-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Billing & Settlement</h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                On-chain escrow, fee distribution and reward settlements
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Summary cards */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-6 lg:grid-cols-4">
            <SummaryCard
              label="Total Escrowed"
              value={`${formatEth(stats.totalEscrowed)} ETH`}
              sub={`${records.length} tasks`}
              icon={<Wallet className="h-4 w-4" />}
              accent="text-blue-600 dark:text-blue-400"
            />
            <SummaryCard
              label="Total Released"
              value={`${formatEth(stats.totalReleased)} ETH`}
              sub={`${stats.settledCount} settled`}
              icon={<ArrowUpRight className="h-4 w-4" />}
              accent="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryCard
              label="Protocol Fees"
              value={`${formatEth(stats.totalFees)} ETH`}
              sub="on-chain verified"
              icon={<TrendingUp className="h-4 w-4" />}
              accent="text-purple-600 dark:text-purple-400"
            />
            <SummaryCard
              label="Active Escrow"
              value={`${formatEth(stats.activeEscrow)} ETH`}
              sub={`${stats.activeCount} pending`}
              icon={<Clock className="h-4 w-4" />}
              accent="text-amber-600 dark:text-amber-400"
            />
          </div>

          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {(['all', 'escrowed', 'settled', 'disputed'] as const).map((f) => (
                <button
                  key={f}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-xs"
                placeholder="Search by task, address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Billing table */}
          {loading && !records.length ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Receipt className="h-10 w-10 opacity-20" />
              <p className="text-sm">No billing records found</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm dark:shadow-none">
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="whitespace-nowrap px-4 py-2.5">Task</th>
                      <th className="whitespace-nowrap px-4 py-2.5">Creator</th>
                      <th className="whitespace-nowrap px-4 py-2.5">Agent</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right">Reward</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right">Fee</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right">Net</th>
                      <th className="whitespace-nowrap px-4 py-2.5">Status</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filtered.map((r) => (
                      <tr key={r.taskId} className="transition-colors hover:bg-secondary/30">
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <CircleDollarSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-mono text-[11px] font-medium text-foreground">
                                {r.taskId.length > 16 ? r.taskId.slice(0, 16) + '...' : r.taskId}
                              </p>
                              <p className="max-w-[180px] truncate text-[10px] text-muted-foreground">
                                {r.description || 'No description'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                          {truncAddr(r.creator)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                          {truncAddr(r.agent)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[11px]">
                          <span className="flex items-center justify-end gap-1">
                            <ArrowDownRight className="h-3 w-3 text-blue-500" />
                            {formatEth(r.reward)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[11px] text-muted-foreground">
                          {r.fee > 0 ? formatEth(r.fee) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[11px]">
                          <span className="flex items-center justify-end gap-1">
                            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                            {r.billingStatus === 'settled' || r.billingStatus === 'refunded'
                              ? formatEth(r.netAmount)
                              : '—'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <span className={`inline-flex rounded-md border px-1.5 py-px text-[9px] font-semibold ${BILLING_STATUS_STYLE[r.billingStatus] ?? ''}`}>
                            {BILLING_STATUS_LABEL[r.billingStatus]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-[10px] text-muted-foreground">
                          {r.createdAt ? timeAgo(r.createdAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-border/50 md:hidden">
                {filtered.map((r) => (
                  <div key={r.taskId} className="p-3 transition-colors hover:bg-secondary/30">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-[11px] font-medium">
                          {r.taskId.length > 18 ? r.taskId.slice(0, 18) + '...' : r.taskId}
                        </span>
                      </div>
                      <span className={`inline-flex rounded-md border px-1.5 py-px text-[9px] font-semibold ${BILLING_STATUS_STYLE[r.billingStatus] ?? ''}`}>
                        {BILLING_STATUS_LABEL[r.billingStatus]}
                      </span>
                    </div>
                    <p className="mb-2 truncate text-[10px] text-muted-foreground">
                      {r.description || 'No description'}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[9px] text-muted-foreground">Reward</p>
                        <p className="font-mono text-[11px] font-medium">{formatEth(r.reward)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Fee</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{r.fee > 0 ? formatEth(r.fee) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Net</p>
                        <p className="font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          {r.billingStatus === 'settled' || r.billingStatus === 'refunded'
                            ? formatEth(r.netAmount)
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{truncAddr(r.creator)} → {truncAddr(r.agent)}</span>
                      <span>{r.createdAt ? timeAgo(r.createdAt) : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer summary */}
          {filtered.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground sm:text-xs">
              <span>{filtered.length} record{filtered.length === 1 ? '' : 's'}</span>
              <span>Fee & net amounts sourced from on-chain events</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, sub, icon, accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm dark:shadow-none sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[11px]">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <p className="text-base font-bold tracking-tight sm:text-lg">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">{sub}</p>
    </div>
  );
}
