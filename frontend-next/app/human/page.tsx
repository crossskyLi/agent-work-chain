'use client';

import Link from 'next/link';
import { Fragment, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bot, Search, Circle, CheckCircle2, AlertTriangle,
  Clock, Activity, Loader2, Hash, Wallet, FileText,
  RefreshCw, LayoutDashboard, Receipt,
} from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Task = {
  task_id: string;
  creator: string;
  assigned_agent: string | null;
  assigned_agent_did: string | null;
  description: string;
  input_cid: string | null;
  output_cid: string | null;
  reward: string;
  status: string;
  created_at: number;
  completed_at: number | null;
};

type Event = {
  id: number;
  event_name: string;
  task_id: string;
  block_number: number;
  tx_hash: string;
  data: string;
  created_at: number;
};

type StatusFilter = 'all' | 'active' | 'done';

const STATUS_PILL: Record<string, string> = {
  Created: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/25',
  Assigned: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25',
  Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25',
  Disputed: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25',
  Resolved: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/25',
};

const STATUS_DOT: Record<string, string> = {
  Created: 'bg-blue-500', Assigned: 'bg-amber-500', Completed: 'bg-emerald-500',
  Disputed: 'bg-red-500', Resolved: 'bg-teal-500',
};

const EVENT_DOT: Record<string, string> = {
  TaskCreated: 'bg-blue-500', AgentAssigned: 'bg-amber-500',
  WorkSubmitted: 'bg-emerald-500', ArbitrationRequested: 'bg-purple-500',
  DisputeRuled: 'bg-red-500', TaskResolved: 'bg-teal-500',
};

const STEPS = ['Created', 'Assigned', 'Completed', 'Resolved'] as const;

function truncAddr(addr: string | null): string {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const sec = Math.floor(Date.now() / 1000) - ts;
  if (sec < 0) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function statusWeight(status: string): number {
  const w: Record<string, number> = {
    Created: 0, Assigned: 30, Completed: 70, Resolved: 100, Disputed: 50,
  };
  return w[status] ?? 0;
}

export default function HumanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tRes, eRes] = await Promise.all([
        fetch('/indexer/v1/tasks?limit=200'),
        fetch('/indexer/v1/events?limit=200'),
      ]);
      if (tRes.ok) { const d = await tRes.json(); setTasks(d.tasks ?? []); }
      if (eRes.ok) { const d = await eRes.json(); setEvents(d.events ?? []); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const m: Record<string, number> = {};
    tasks.forEach((t) => { m[t.status] = (m[t.status] || 0) + 1; });
    return m;
  }, [tasks]);

  const overallProgress = useMemo(() => {
    if (!tasks.length) return 0;
    return Math.round(tasks.reduce((a, t) => a + statusWeight(t.status), 0) / tasks.length);
  }, [tasks]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter === 'active') list = list.filter((t) => ['Created', 'Assigned'].includes(t.status));
    else if (filter === 'done') list = list.filter((t) => ['Completed', 'Resolved'].includes(t.status));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.task_id.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          (t.creator ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [tasks, filter, search]);

  const selected = useMemo(() => tasks.find((t) => t.task_id === selectedId) ?? null, [tasks, selectedId]);

  const taskEvents = useMemo(
    () => (selectedId ? events.filter((e) => e.task_id === selectedId) : events.slice(0, 40)),
    [events, selectedId],
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ---- Top bar ---- */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-primary">AWC</Link>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">/ Human Workspace</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/billing"><Receipt className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Billing</span></Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/agent"><Bot className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Agent View</span></Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      {/* ---- Three-column body ---- */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">

        {/* ====== LEFT: task list ====== */}
        <aside className="flex max-h-52 shrink-0 flex-col border-b border-border sm:max-h-64 md:max-h-none md:w-56 md:border-b-0 md:border-r lg:w-64 xl:w-72 2xl:w-80">
          {/* search */}
          <div className="border-b border-border p-2 sm:p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="h-7 pl-8 text-xs" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {/* project overview */}
          <div className="border-b border-border p-2 sm:p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Project Progress</span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={fetchData}>
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-lg font-bold sm:text-xl">{tasks.length}</span>
              <span className="text-[11px] text-muted-foreground">{overallProgress}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${overallProgress}%` }} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              {Object.entries(stats).map(([s, c]) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[s] ?? 'bg-gray-400'}`} />
                  {c} {s}
                </span>
              ))}
            </div>
          </div>

          {/* filter tabs */}
          <div className="flex border-b border-border text-[11px]">
            {(['all', 'active', 'done'] as const).map((f) => {
              const label =
                f === 'all' ? `All (${tasks.length})`
                  : f === 'active' ? `Active (${(stats.Created ?? 0) + (stats.Assigned ?? 0)})`
                    : `Done (${(stats.Completed ?? 0) + (stats.Resolved ?? 0)})`;
              return (
                <button
                  key={f}
                  className={`flex-1 py-1.5 font-medium transition-colors ${filter === f ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setFilter(f)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* task list */}
          <div className="flex-1 overflow-y-auto">
            {loading && !tasks.length ? (
              <div className="flex items-center justify-center py-8 sm:py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">No tasks found</p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.task_id}
                  className={`w-full border-b border-border px-2 py-2 text-left transition-colors hover:bg-secondary/50 sm:px-3 sm:py-2.5 ${selectedId === t.task_id ? 'bg-secondary/80' : ''}`}
                  onClick={() => setSelectedId(t.task_id)}
                >
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium">{t.task_id.length > 14 ? t.task_id.slice(0, 14) + '…' : t.task_id}</span>
                    <span className={`inline-flex rounded-md border px-1.5 py-px text-[9px] font-semibold ${STATUS_PILL[t.status] ?? ''}`}>{t.status}</span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{t.description || 'No description'}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">{t.reward} USDT</p>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ====== MIDDLE: task detail ====== */}
        <main className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <LayoutDashboard className="h-10 w-10 opacity-20" />
              <p className="text-sm">Select a task to view its story</p>
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            </div>
          ) : (
            <div className="mx-auto max-w-2xl p-4 sm:p-6">
              {/* header */}
              <div className="mb-4 sm:mb-6">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[selected.status] ?? ''}`}>{selected.status}</span>
                  <span className="font-mono text-xs text-muted-foreground">{selected.task_id}</span>
                </div>
                <h1 className="text-lg font-semibold leading-snug sm:text-xl">{(selected.description || 'Untitled Task').slice(0, 120)}</h1>
              </div>

              {/* progress stepper */}
              <div className="mb-4 rounded-lg border border-border bg-card p-3 shadow-sm dark:shadow-none sm:mb-6 sm:p-4">
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:mb-4">Progress</h3>
                <div className="pb-6">
                  <div className="flex items-center">
                    {STEPS.map((step, i) => {
                      const curIdx = STEPS.indexOf(selected.status as typeof STEPS[number]);
                      const isDisputed = selected.status === 'Disputed';
                      const reached = isDisputed ? i <= 1 : i <= curIdx;
                      const isCurrent = step === selected.status;
                      return (
                        <Fragment key={step}>
                          {i > 0 && <div className={`h-0.5 flex-1 ${reached ? 'bg-primary' : 'bg-border'}`} />}
                          <div className="relative">
                            <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 sm:h-7 sm:w-7 ${isCurrent ? 'border-primary bg-primary text-primary-foreground'
                              : reached ? 'border-primary bg-primary/20 text-primary'
                                : 'border-border text-muted-foreground'
                              }`}>
                              {reached ? <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <Circle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                            </div>
                            <span className={`absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap text-[9px] sm:top-9 sm:text-[10px] ${isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{step}</span>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
                {selected.status === 'Disputed' && (
                  <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Under dispute — awaiting arbitration ruling
                  </div>
                )}
              </div>

              {/* metadata grid */}
              <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-3">
                {([
                  { label: 'Creator', value: truncAddr(selected.creator), Icon: Wallet },
                  { label: 'Agent', value: truncAddr(selected.assigned_agent), Icon: Bot },
                  { label: 'Reward', value: `${selected.reward} USDT`, Icon: Hash },
                  { label: 'Created', value: selected.created_at ? timeAgo(selected.created_at) : '—', Icon: Clock },
                ] as const).map((m) => (
                  <div key={m.label} className="rounded-lg border border-border bg-card p-2 shadow-sm dark:shadow-none sm:p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <m.Icon className="h-3 w-3" />{m.label}
                    </div>
                    <p className="truncate font-mono text-xs font-medium sm:text-sm">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* CIDs */}
              {(selected.input_cid || selected.output_cid) && (
                <div className="mb-4 space-y-2 sm:mb-6">
                  {selected.input_cid && (
                    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-2 shadow-sm dark:shadow-none sm:p-3">
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">Input CID</p>
                        <p className="break-all font-mono text-xs">{selected.input_cid}</p>
                      </div>
                    </div>
                  )}
                  {selected.output_cid && (
                    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-2 shadow-sm dark:shadow-none sm:p-3">
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">Output CID</p>
                        <p className="break-all font-mono text-xs">{selected.output_cid}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* story / description */}
              <div className="rounded-lg border border-border bg-card p-3 shadow-sm dark:shadow-none sm:p-4">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Story</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{selected.description || 'No description provided.'}</p>
              </div>
            </div>
          )}
        </main>

        {/* ====== RIGHT: activity timeline ====== */}
        <aside className="flex max-h-64 shrink-0 flex-col border-t border-border sm:max-h-72 md:max-h-none md:w-56 md:border-l md:border-t-0 lg:w-64 xl:w-72 2xl:w-80">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 sm:px-4 sm:py-2.5">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">{selectedId ? 'Task Activity' : 'Recent Activity'}</span>
            </div>
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{taskEvents.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {taskEvents.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">No events yet</p>
            ) : (
              <div className="py-1">
                {taskEvents.map((ev, i) => {
                  let parsed: Record<string, unknown> = {};
                  try { parsed = JSON.parse(ev.data || '{}'); } catch { /* ignore */ }
                  return (
                    <div key={ev.id} className="relative flex gap-3 px-3 py-2 sm:px-4">
                      {i < taskEvents.length - 1 && (
                        <div className="absolute bottom-0 left-[1.3rem] top-6 w-px bg-border sm:left-[1.55rem]" />
                      )}
                      <div className={`relative z-10 mt-1 h-2 w-2 shrink-0 rounded-full ${EVENT_DOT[ev.event_name] ?? 'bg-muted-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold">{ev.event_name}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{ev.created_at ? timeAgo(ev.created_at) : `blk ${ev.block_number}`}</span>
                        </div>
                        {ev.task_id && !selectedId && (
                          <button
                            className="font-mono text-[10px] text-primary/80 hover:text-primary"
                            onClick={() => setSelectedId(ev.task_id)}
                          >
                            {ev.task_id.length > 18 ? ev.task_id.slice(0, 18) + '…' : ev.task_id}
                          </button>
                        )}
                        {Object.keys(parsed).length > 0 && (
                          <div className="mt-0.5 space-y-px text-[10px] text-muted-foreground/70">
                            {Object.entries(parsed).slice(0, 3).map(([k, v]) => (
                              <p key={k} className="truncate">
                                <span className="text-muted-foreground">{k}:</span>{' '}
                                {typeof v === 'string' && v.length > 24 ? v.slice(0, 24) + '…' : String(v)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
