'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Search, Shield, Loader2, RefreshCw } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

type Audit = {
  audit_id: string;
  auditor: string;
  target_agent: string;
  overall_score: number;
  status: string;
  submitted_at: number;
  report_cid: string;
};

export default function DashboardPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function fetchAudits() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (filter) params.set('target_agent', filter);
      params.set('limit', '50');
      const res = await fetch(`${API_BASE}/v1/audits?${params}`);
      const json = await res.json();
      setAudits(json.data || []);
    } catch {
      setAudits([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAudits(); }, [statusFilter]);

  function statusColor(s: string) {
    if (s === 'Confirmed') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (s === 'Disputed') return 'bg-red-500/15 text-red-400 border-red-500/30';
    return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  }

  function truncAddr(addr: string) {
    return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-primary">Audit Swarm</Link>
          <span className="text-[11px] text-muted-foreground">/ Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/trust-scores"><Shield className="mr-1 h-3.5 w-3.5" />Scores</Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-xl font-bold">Audit Dashboard</h1>
            <Button variant="outline" size="sm" onClick={fetchAudits} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="mb-4 flex gap-2">
            <Input
              placeholder="Filter by agent address..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAudits()}
              className="max-w-xs"
            />
            <select
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Disputed">Disputed</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : audits.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No audits found</p>
          ) : (
            <div className="space-y-3">
              {audits.map((a) => (
                <Card key={a.audit_id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-mono">{a.audit_id}</CardTitle>
                      <Badge variant="outline" className={statusColor(a.status)}>{a.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Score: <strong className="text-foreground">{a.overall_score}/100</strong></span>
                    <span>Target: <code>{truncAddr(a.target_agent)}</code></span>
                    <span>Auditor: <code>{truncAddr(a.auditor)}</code></span>
                    <span>{new Date(a.submitted_at * 1000).toLocaleDateString()}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
