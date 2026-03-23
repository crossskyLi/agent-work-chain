'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Award, Search, Shield } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

type Cert = {
  agent: string;
  cert_type: string;
  issued_at: number;
  valid_until: number;
};

export default function CertificationsPage() {
  const [address, setAddress] = useState('');
  const [certs, setCerts] = useState<Cert[]>([]);
  const [searched, setSearched] = useState(false);

  async function searchCerts() {
    if (!address.startsWith('0x')) return;
    setSearched(true);
    try {
      const res = await fetch(`${API_BASE}/v1/certifications?agent=${encodeURIComponent(address)}`);
      const json = await res.json();
      setCerts(json.data || []);
    } catch {
      setCerts([]);
    }
  }

  function isValid(cert: Cert) {
    return cert.valid_until * 1000 > Date.now();
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-primary">Audit Swarm</Link>
          <span className="text-[11px] text-muted-foreground">/ Certifications</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/trust-scores"><Shield className="mr-1 h-3.5 w-3.5" />Scores</Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-bold">Agent Certifications</h1>
          </div>

          <div className="mb-5 flex gap-2">
            <Input
              placeholder="Enter agent address (0x...)..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchCerts()}
              className="max-w-sm"
            />
            <Button onClick={searchCerts} variant="secondary" size="sm">
              <Search className="mr-1 h-3.5 w-3.5" />
              Search
            </Button>
          </div>

          {searched && certs.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No certifications found for this agent.
            </p>
          )}

          {certs.length > 0 && (
            <div className="space-y-3">
              {certs.map((c) => (
                <Card key={`${c.agent}-${c.cert_type}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{c.cert_type}</CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          isValid(c)
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border-red-500/30'
                        }
                      >
                        {isValid(c) ? 'Valid' : 'Expired'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex gap-4 text-xs text-muted-foreground">
                    <span>Issued: {new Date(c.issued_at * 1000).toLocaleDateString()}</span>
                    <span>Expires: {new Date(c.valid_until * 1000).toLocaleDateString()}</span>
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
