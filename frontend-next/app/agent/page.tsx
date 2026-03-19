'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
  UserRound, Search, Database, Code2,
  ArrowRight, Loader2, Copy, Check, Receipt,
} from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Intent = 'overview' | 'tasks' | 'agents' | 'events';

type AgentResponse = {
  schema: string;
  generatedAt: string;
  payload: {
    intent: string;
    count: number;
    records: Array<Record<string, unknown>>;
  };
};

type SchemaField = { name: string; type: string; nullable?: boolean };

const SCHEMA_MAP: Record<Intent, SchemaField[]> = {
  tasks: [
    { name: 'id', type: 'string' },
    { name: 'status', type: 'status_enum' },
    { name: 'reward', type: 'string' },
    { name: 'creator', type: 'address' },
    { name: 'assignedAgent', type: 'address', nullable: true },
    { name: 'inputCid', type: 'cid', nullable: true },
    { name: 'outputCid', type: 'cid', nullable: true },
    { name: 'createdAt', type: 'timestamp' },
  ],
  agents: [
    { name: 'address', type: 'address' },
    { name: 'did', type: 'string' },
    { name: 'capabilities', type: 'string' },
    { name: 'tasksCompleted', type: 'integer' },
    { name: 'disputesWon', type: 'integer' },
    { name: 'disputesLost', type: 'integer' },
  ],
  events: [
    { name: 'id', type: 'integer' },
    { name: 'event', type: 'string' },
    { name: 'taskId', type: 'string' },
    { name: 'block', type: 'integer' },
    { name: 'tx', type: 'hash' },
    { name: 'data', type: 'json' },
  ],
  overview: [
    { name: 'totals.tasks', type: 'integer' },
    { name: 'totals.agents', type: 'integer' },
    { name: 'totals.events', type: 'integer' },
    { name: 'latestTasks', type: 'array<TaskSummary>' },
  ],
};

const TYPE_COLOR: Record<string, string> = {
  string: 'text-emerald-700 dark:text-emerald-400',
  enum: 'text-pink-700 dark:text-pink-400',
  address: 'text-amber-700 dark:text-amber-400',
  cid: 'text-purple-700 dark:text-purple-400',
  hash: 'text-purple-700 dark:text-purple-400',
  integer: 'text-blue-700 dark:text-blue-400',
  timestamp: 'text-blue-700 dark:text-blue-400',
  json: 'text-orange-700 dark:text-orange-400',
  array: 'text-orange-700 dark:text-orange-400',
};

function typeColor(type: string): string {
  for (const [key, color] of Object.entries(TYPE_COLOR)) {
    if (type.startsWith(key) || type.includes(key)) return color;
  }
  return 'text-muted-foreground';
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function isFilledField(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '';
}

function recordKey(record: Record<string, unknown>): string {
  return String(record.id ?? record.address ?? record.event ?? JSON.stringify(record).slice(0, 32));
}

async function queryAgent(params: { q: string; limit: number; intent: Intent }): Promise<AgentResponse> {
  const url = new URL('/indexer/v1/query/agent', window.location.origin);
  if (params.q) url.searchParams.set('q', params.q);
  url.searchParams.set('limit', String(params.limit));
  url.searchParams.set('intent', params.intent);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function AgentPage() {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(20);
  const [intent, setIntent] = useState<Intent>('tasks');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const schema = useMemo(() => SCHEMA_MAP[intent] ?? [], [intent]);
  const records = useMemo(() => result?.payload?.records ?? [], [result]);

  async function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      setResult(await queryAgent({ q: q.trim(), limit, intent }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function copyRecord(record: Record<string, unknown>, idx: number) {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ---- Top bar ---- */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-primary">AWC</Link>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">/ Agent Workspace</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/billing"><Receipt className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Billing</span></Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/human"><UserRound className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Human View</span></Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      {/* ---- Query bar ---- */}
      <div className="border-b border-border px-3 py-2 sm:px-4">
        <form className="flex flex-wrap items-center gap-2" onSubmit={onSearch}>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 font-mono text-xs"
            value={intent}
            onChange={(e) => setIntent(e.target.value as Intent)}
          >
            <option value="overview">overview</option>
            <option value="tasks">tasks</option>
            <option value="agents">agents</option>
            <option value="events">events</option>
          </select>
          <Input className="h-8 min-w-[120px] flex-1 font-mono text-xs sm:min-w-[160px]" placeholder="taskId / did / address / keyword" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input className="h-8 w-14 font-mono text-xs sm:w-16" type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(Number(e.target.value || 20))} />
          <Button type="submit" size="sm" className="h-8" disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span className="ml-1 hidden sm:inline">Query</span>
          </Button>
        </form>
        {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {/* ---- Two-column body ---- */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">

        {/* ====== LEFT: schema panel ====== */}
        <aside className="flex shrink-0 flex-col border-b border-border md:w-64 md:border-b-0 md:border-r lg:w-72 xl:w-80">
          {/* envelope */}
          <div className="border-b border-border p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">Response Envelope</span>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <Row label="schema" type="string" value={result?.schema ?? '—'} />
              <Row label="generatedAt" type="timestamp" value={result?.generatedAt ?? '—'} />
              <Row label="intent" type="enum" value={result?.payload?.intent ?? intent} />
              <Row label="count" type="integer" value={result?.payload?.count ?? '—'} />
            </div>
          </div>

          {/* record schema */}
          <div className="max-h-56 overflow-y-auto p-3 sm:p-4 md:max-h-none md:flex-1">
            <div className="mb-3 flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">Record Schema</span>
              <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{intent}</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm dark:shadow-none">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] text-muted-foreground">
                    <th className="whitespace-nowrap px-3 py-1.5 font-medium">Field</th>
                    <th className="whitespace-nowrap px-3 py-1.5 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {schema.map((f) => (
                    <tr key={f.name} className="border-b border-border/50 last:border-0">
                      <td className="whitespace-nowrap px-3 py-1.5 text-foreground">{f.name}{f.nullable ? <span className="text-muted-foreground/50">?</span> : ''}</td>
                      <td className={`whitespace-nowrap px-3 py-1.5 ${typeColor(f.type)}`}>{f.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* query stats */}
            {result && (
              <div className="mt-3 rounded-lg border border-border bg-card p-2 shadow-sm dark:shadow-none sm:mt-4 sm:p-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Query Stats</span>
                <div className="mt-1.5 space-y-1 font-mono text-[11px] sm:mt-2">
                  <p>records: <span className="text-foreground">{records.length}</span></p>
                  <p>intent: <span className="text-foreground">{result.payload.intent}</span></p>
                  <p>generated: <span className="text-foreground">{new Date(result.generatedAt).toLocaleTimeString()}</span></p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ====== RIGHT: records view ====== */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4">
          {!result ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Database className="h-10 w-10 opacity-20" />
              <p className="text-sm">Run a query to view records</p>
              <p className="max-w-sm text-center text-xs text-muted-foreground/60">
                Select an intent, optionally add a search term, then hit Query.
              </p>
            </div>
          ) : records.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <p className="text-sm">No records returned</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{records.length} RECORDS</span>
              </div>
              {records.map((rec, idx) => (
                <div key={recordKey(rec) + idx} className="rounded-lg border border-border bg-card shadow-sm dark:shadow-none">
                  {/* record header */}
                  <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 sm:px-4">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-[11px] font-semibold text-primary">
                        {String(rec.id ?? rec.address ?? `#${idx}`)}
                      </span>
                      {rec.status != null && (
                        <span className={`shrink-0 rounded-md border px-1.5 py-px text-[9px] font-semibold ${statusPill(String(rec.status))}`}>
                          {String(rec.status)}
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="ml-2 h-6 w-6 shrink-0 p-0" onClick={() => copyRecord(rec, idx)}>
                      {copiedIdx === idx ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  {/* record fields */}
                  <div className="divide-y divide-border/30">
                    {Object.entries(rec).map(([key, val]) => {
                      const filled = isFilledField(val);
                      const schemaField = schema.find((f) => f.name === key);
                      return (
                        <div key={key} className="flex items-start gap-2 px-3 py-1.5 sm:gap-3 sm:px-4">
                          <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground sm:w-28">{key}</span>
                          <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-border" />
                          <span className={`min-w-0 break-all font-mono text-[11px] ${
                            !filled ? 'italic text-muted-foreground/40'
                            : key === 'status' ? statusTextColor(String(val))
                            : schemaField ? typeColor(schemaField.type)
                            : 'text-foreground'
                          }`}>
                            {typeof val === 'object' && val !== null
                              ? JSON.stringify(val, null, 1)
                              : formatValue(val)}
                          </span>
                          {filled && schemaField?.nullable && (
                            <span className="ml-auto shrink-0 rounded bg-emerald-100 px-1 py-px text-[8px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">SET</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function Row({ label, type, value }: { label: string; type: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={typeColor(type)}>{formatValue(value)}</span>
    </div>
  );
}

function statusPill(status: string): string {
  const m: Record<string, string> = {
    Created:   'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/25',
    Assigned:  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25',
    Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25',
    Disputed:  'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25',
    Resolved:  'bg-teal-100 text-teal-700 border-teal-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/25',
  };
  return m[status] ?? 'bg-secondary text-secondary-foreground';
}

function statusTextColor(status: string): string {
  const m: Record<string, string> = {
    Created: 'text-blue-700 dark:text-blue-400',
    Assigned: 'text-amber-700 dark:text-amber-400',
    Completed: 'text-emerald-700 dark:text-emerald-400',
    Disputed: 'text-red-700 dark:text-red-400',
    Resolved: 'text-teal-700 dark:text-cyan-300',
  };
  return m[status] ?? 'text-foreground';
}
