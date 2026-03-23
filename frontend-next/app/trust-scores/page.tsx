'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Shield, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

type LeaderEntry = { target_agent: string; averageScore: number; confirmedAuditCount: number };

export default function TrustScoresPage() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [singleScore, setSingleScore] = useState<LeaderEntry | null>(null);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/trust-score/leaderboard?limit=20`);
      const json = await res.json();
      setLeaders(json.data || []);
    } catch {
      setLeaders([]);
    } finally {
      setLoading(false);
    }
  }

  async function searchAgent() {
    if (!search.startsWith('0x')) return;
    try {
      const res = await fetch(`${API_BASE}/v1/trust-score/${search}`);
      const json = await res.json();
      if (json.data) {
        setSingleScore({
          target_agent: json.data.address,
          averageScore: json.data.averageScore ?? 0,
          confirmedAuditCount: json.data.confirmedCount ?? 0,
        });
      } else {
        setSingleScore(null);
      }
    } catch {
      setSingleScore(null);
    }
  }

  useEffect(() => { fetchLeaderboard(); }, []);

  function truncAddr(addr: string) {
    return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
  }

  function scoreColor(s: number) {
    if (s >= 80) return 'text-emerald-400';
    if (s >= 60) return 'text-yellow-400';
    return 'text-red-400';
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-primary">Audit Swarm</Link>
          <span className="text-[11px] text-muted-foreground">/ Trust Scores</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-500" />
              <h1 className="text-xl font-bold">Agent Trust Scores</h1>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLeaderboard} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="mb-5 flex gap-2">
            <Input
              placeholder="Search agent address (0x...)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchAgent()}
              className="max-w-sm"
            />
            <Button onClick={searchAgent} variant="secondary" size="sm">Lookup</Button>
          </div>

          {singleScore && (
            <Card className="mb-5 border-emerald-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Score for <code>{truncAddr(singleScore.target_agent)}</code></CardTitle>
              </CardHeader>
              <CardContent className="flex gap-6 text-sm">
                <span>Average: <strong className={scoreColor(singleScore.averageScore)}>{singleScore.averageScore}/100</strong></span>
                <span>Audits: <strong>{singleScore.confirmedAuditCount}</strong></span>
              </CardContent>
            </Card>
          )}

          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            Leaderboard
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : leaders.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No scored agents yet</p>
          ) : (
            <div className="space-y-2">
              {leaders.map((entry, i) => (
                <div
                  key={entry.target_agent}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-right text-xs font-bold text-muted-foreground">#{i + 1}</span>
                    <code className="text-sm">{truncAddr(entry.target_agent)}</code>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`font-bold ${scoreColor(entry.averageScore)}`}>{entry.averageScore}</span>
                    <span className="text-xs text-muted-foreground">{entry.confirmedAuditCount} audits</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
