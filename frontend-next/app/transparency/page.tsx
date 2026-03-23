'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Loader2, Shield, Eye, ExternalLink, Lock, Users,
} from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org';
const CONTRACT = process.env.NEXT_PUBLIC_AUDIT_REGISTRY_ADDRESS || '';
const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://sepolia.basescan.org';
const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || 'Base Sepolia';

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function callContract(to: string, data: string): Promise<string> {
  return (await rpcCall('eth_call', [{ to, data }, 'latest'])) as string;
}

function decodeUint256(hex: string): bigint {
  return BigInt(hex.length >= 66 ? '0x' + hex.slice(2, 66) : hex);
}

function decodeAddress(hex: string): string {
  return '0x' + hex.slice(26, 66);
}

function formatEther(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

function truncAddr(addr: string): string {
  return addr.length < 10 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const SELECTORS = {
  owner: '0x8da5cb5b',
  minStake: '0x375b3c0a',
};

type ProtocolData = {
  contractAddress: string;
  contractBalance: bigint;
  owner: string;
  minStake: bigint;
};

export default function TransparencyPage() {
  const [data, setData] = useState<ProtocolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    if (!CONTRACT) {
      setError('Contract address not configured. Set NEXT_PUBLIC_AUDIT_REGISTRY_ADDRESS.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [contractBalanceHex, ownerHex, minStakeHex] = await Promise.all([
        rpcCall('eth_getBalance', [CONTRACT, 'latest']) as Promise<string>,
        callContract(CONTRACT, SELECTORS.owner),
        callContract(CONTRACT, SELECTORS.minStake),
      ]);

      setData({
        contractAddress: CONTRACT,
        contractBalance: BigInt(contractBalanceHex),
        owner: decodeAddress(ownerHex),
        minStake: decodeUint256(minStakeHex),
      });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query chain');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-primary">Audit Swarm</Link>
          <span className="text-[11px] text-muted-foreground">/ Transparency</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-500" />
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">On-Chain Transparency</h1>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                All data read directly from AuditRegistry on {CHAIN_NAME}. Verify everything on-chain.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="hidden text-[10px] text-muted-foreground sm:inline">{lastUpdated}</span>
              )}
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Registry Balance</span>
                  <p className="mt-1 text-lg font-bold">{formatEther(data.contractBalance)} ETH</p>
                  <p className="text-[10px] text-muted-foreground">Auditor stakes held</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Min Stake</span>
                  <p className="mt-1 text-lg font-bold">{formatEther(data.minStake)} ETH</p>
                  <p className="text-[10px] text-muted-foreground">Required to register as auditor</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-semibold">AuditRegistry Contract</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="rounded-md bg-secondary px-2 py-1 font-mono text-xs">{truncAddr(data.contractAddress)}</code>
                    <a
                      href={`${EXPLORER}/address/${data.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View on BaseScan <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-500" />
                    <h3 className="text-sm font-semibold">Owner</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="rounded-md bg-secondary px-2 py-1 font-mono text-xs">{truncAddr(data.owner)}</code>
                    <a
                      href={`${EXPLORER}/address/${data.owner}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View on BaseScan <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-dashed border-border p-4 text-center">
                <Eye className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  All data fetched directly from {CHAIN_NAME} blockchain. No backend. Verify on{' '}
                  <a
                    href={`${EXPLORER}/address/${data.contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    BaseScan
                  </a>.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
