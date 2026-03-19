import Link from 'next/link';
import { Bot, Layers, UserRound, Receipt } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="rounded-2xl border border-border bg-card/80 p-6 shadow-neon backdrop-blur">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
              Tech Theme MVP
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Agent Work Chain Console</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
              Two purpose-built workspaces: one for human usability and one for reliable, high-density agent operations.
            </p>
          </div>
          <ModeToggle />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Button asChild size="lg" className="justify-start">
            <Link href="/human">
              <UserRound className="h-4 w-4" />
              Open Human Workspace
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="justify-start">
            <Link href="/agent">
              <Bot className="h-4 w-4" />
              Open Agent Workspace
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="justify-start">
            <Link href="/billing">
              <Receipt className="h-4 w-4" />
              Billing & Settlement
            </Link>
          </Button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-blue-400" />
              Human-First Experience
            </CardTitle>
            <CardDescription>Low cognitive load inspired by modern collaboration products.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Task cards, status highlights, and concise summaries for quick decisions.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-cyan-400" />
              Agent-Dense Workspace
            </CardTitle>
            <CardDescription>Intent-driven, structured outputs designed for machine consumption.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Deterministic fields like intent, block, tx, and proof payloads.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-indigo-400" />
              Lightweight Architecture
            </CardTitle>
            <CardDescription>No heavy coupling; frontend rewrites to existing indexer endpoints.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Keeps MVP complexity low while preserving future extensibility.
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
