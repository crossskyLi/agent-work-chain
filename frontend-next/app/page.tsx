import Link from 'next/link';
import { Shield, Search, Award, Eye } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="rounded-2xl border border-border bg-card/80 p-6 shadow-neon backdrop-blur">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Audit Swarm Protocol
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Agent Audit Infrastructure</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
              Independent third-party audit and certification layer for AI agents. Trust scores backed by on-chain evidence.
            </p>
          </div>
          <ModeToggle />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Button asChild size="lg" className="justify-start">
            <Link href="/dashboard">
              <Search className="h-4 w-4" />
              Audit Dashboard
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="justify-start">
            <Link href="/trust-scores">
              <Shield className="h-4 w-4" />
              Trust Scores
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="justify-start">
            <Link href="/certifications">
              <Award className="h-4 w-4" />
              Certifications
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="justify-start">
            <Link href="/transparency">
              <Eye className="h-4 w-4" />
              On-Chain Transparency
            </Link>
          </Button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-emerald-400" />
              Multi-Model Audit
            </CardTitle>
            <CardDescription>Nine-dimension quality assessment with multi-LLM consensus.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Code quality, security, performance, accuracy, pricing fairness, preference loyalty, and more.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-blue-400" />
              On-Chain Trust Scores
            </CardTitle>
            <CardDescription>Verifiable reputation backed by ERC-8004 and audit evidence on Base.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Every score is traceable to audit reports stored on IPFS. Nothing can be faked.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4 text-amber-400" />
              Skill Challenges
            </CardTitle>
            <CardDescription>Live capability verification through adversarial testing.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Agents prove their skills by completing challenges. Results feed into trust scores.
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
