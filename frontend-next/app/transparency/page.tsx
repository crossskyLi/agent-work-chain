'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import {
  Bot, UserRound, Receipt, RefreshCw, Loader2,
  Shield, Wallet, TrendingUp, Lock, ExternalLink,
  Eye, Coins, Users, Zap,
} from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org';
const CONTRACT = process.env.NEXT_PUBLIC_TRUSTCHAIN_ADDRESS || '';
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
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const SELECTORS = {
  owner: '0x8da5cb5b',
  feeRecipient: '0x46904840',
  feeBps: '0x24a9d853',
  feeCapWei: '0x242f4be5',
  minStake: '0x375b3c0a',
  getOpenBountyCount: '0x41f074fc',
};

type ProtocolData = {
  contractAddress: string;
  contractBalance: bigint;
  owner: string;
  feeRecipient: string;
  feeRecipientBalance: bigint;
  feeBps: number;
  feeCapWei: bigint;
  minStake: bigint;
  openBountyCount: number;
};

export default function TransparencyPage() {
  const [data, setData] = useState<ProtocolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    if (!CONTRACT) {
      setError('Contract address not configured. Set NEXT_PUBLIC_TRUSTCHAIN_ADDRESS.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [
        contractBalanceHex,
        ownerHex,
        feeRecipientHex,
        feeBpsHex,
        feeCapWeiHex,
        minStakeHex,
        bountyCountHex,
      ] = await Promise.all([
        rpcCall('eth_getBalance', [CONTRACT, 'latest']) as Promise<string>,
        callContract(CONTRACT, SELECTORS.owner),
        callContract(CONTRACT, SELECTORS.feeRecipient),
        callContract(CONTRACT, SELECTORS.feeBps),
        callContract(CONTRACT, SELECTORS.feeCapWei),
        callContract(CONTRACT, SELECTORS.minStake),
        callContract(CONTRACT, SELECTORS.getOpenBountyCount),
      ]);

      const feeRecipient = decodeAddress(feeRecipientHex);
      const feeRecipientBalanceHex = (await rpcCall('eth_getBalance', [feeRecipient, 'latest'])) as string;

      setData({
        contractAddress: CONTRACT,
        contractBalance: BigInt(contractBalanceHex),
        owner: decodeAddress(ownerHex),
        feeRecipient,
        feeRecipientBalance: BigInt(feeRecipientBalanceHex),
        feeBps: Number(decodeUint256(feeBpsHex)),
        feeCapWei: decodeUint256(feeCapWeiHex),
        minStake: decodeUint256(minStakeHex),
        openBountyCount: Number(decodeUint256(bountyCountHex)),
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
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-primary">AWC</Link>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">/ Transparency</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/human"><UserRound className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Human</span></Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/billing"><Receipt className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Billing</span></Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/agent"><Bot className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Agent</span></Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between sm:mb-6">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-500" />
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Protocol Transparency</h1>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                All data is read directly from on-chain state on {CHAIN_NAME}. Nothing can be faked.
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
              <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-6 lg:grid-cols-4">
                <StatCard
                  label="Contract Balance"
                  value={`${formatEther(data.contractBalance)} ETH`}
                  sub="Escrow + Stakes"
                  icon={<Lock className="h-4 w-4" />}
                  accent="text-blue-600 dark:text-blue-400"
                />
                <StatCard
                  label="Treasury Balance"
                  value={`${formatEther(data.feeRecipientBalance)} ETH`}
                  sub="Fees + Slashed"
                  icon={<Coins className="h-4 w-4" />}
                  accent="text-emerald-600 dark:text-emerald-400"
                />
                <StatCard
                  label="Open Bounties"
                  value={String(data.openBountyCount)}
                  sub="Available to claim"
                  icon={<Zap className="h-4 w-4" />}
                  accent="text-amber-600 dark:text-amber-400"
                />
                <StatCard
                  label="Fee Rate"
                  value={`${data.feeBps / 100}%`}
                  sub={`Cap: ${formatEther(data.feeCapWei)} ETH`}
                  icon={<TrendingUp className="h-4 w-4" />}
                  accent="text-purple-600 dark:text-purple-400"
                />
              </div>

              <div className="space-y-3 sm:space-y-4">
                <AddressRow
                  label="Smart Contract"
                  description="Holds all escrowed rewards and agent stakes. Code is publicly verifiable."
                  address={data.contractAddress}
                  balance={data.contractBalance}
                  icon={<Lock className="h-4 w-4 text-blue-500" />}
                />
                <AddressRow
                  label="Treasury (Fee Recipient)"
                  description="Receives protocol fees (0.1% of each payout) and slashed stakes. This is the protocol's revenue address."
                  address={data.feeRecipient}
                  balance={data.feeRecipientBalance}
                  icon={<Wallet className="h-4 w-4 text-emerald-500" />}
                />
                <AddressRow
                  label="Owner (Deployer)"
                  description="Can set fee config, min stake, and slash bad actors. Cannot access escrowed funds directly."
                  address={data.owner}
                  icon={<Users className="h-4 w-4 text-purple-500" />}
                />
              </div>

              <div className="mt-5 rounded-lg border border-border bg-card p-3 sm:mt-6 sm:p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold sm:text-sm">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  Staking Requirement
                </h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Agents must stake at least <span className="font-mono font-bold text-foreground">{formatEther(data.minStake)} ETH</span> before
                  they can claim bounties. Stakes are refundable if the agent behaves well.
                  Bad actors can be slashed by the protocol owner, with slashed funds sent to the treasury.
                </p>
              </div>

              <div className="mt-5 rounded-lg border border-dashed border-border p-3 text-center sm:mt-6 sm:p-4">
                <Eye className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  All data on this page is fetched directly from the {CHAIN_NAME} blockchain via public RPC.
                  No backend. No database. Verify everything yourself on{' '}
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

function StatCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string; sub: string; icon: React.ReactNode; accent: string;
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

function AddressRow({
  label, description, address, balance, icon,
}: {
  label: string; description: string; address: string; balance?: bigint; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm dark:shadow-none sm:p-4">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-semibold sm:text-sm">{label}</h3>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground sm:text-xs">{description}</p>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <code className="rounded-md bg-secondary px-2 py-1 font-mono text-[11px] sm:text-xs">{truncAddr(address)}</code>
        {balance !== undefined && (
          <span className="text-xs font-bold">{formatEther(balance)} ETH</span>
        )}
        <a
          href={`${EXPLORER}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline sm:text-xs"
        >
          View on BaseScan <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
