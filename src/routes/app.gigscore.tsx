import { createFileRoute } from "@tanstack/react-router";
import { Award, Info, Sparkles, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/app/gigscore")({
  component: GigScorePage,
});

function GigScorePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reputation"
        title="GigScore"
        description="An AI-powered reputation score built from your verified work activity."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative overflow-hidden rounded-3xl border bg-card p-8 shadow-sm">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="flex flex-col items-center text-center">
            <div className="grid h-40 w-40 place-items-center rounded-full border-8 border-muted">
              <div className="text-center">
                <div className="text-5xl font-bold text-gradient">—</div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Awaiting data</div>
              </div>
            </div>
            <h3 className="mt-6 max-w-md text-base font-semibold">
              Your GigScore will be calculated after verified work activity is added.
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Log gigs, verify documents and connect income sources to start building
              your reputation.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <ExplainCard icon={Info} title="What is GigScore?" body="A single, portable reputation score summarising your verified work identity across gigs and platforms." />
          <ExplainCard icon={Sparkles} title="How is it calculated?" body="From verified work history, income consistency, document verification, on-time performance and skill signals." />
          <ExplainCard icon={Award} title="Benefits" body="Higher GigScore improves visibility to employers, unlocks fairer loan offers and priority access to schemes." />
          <ExplainCard icon={TrendingUp} title="Grows over time" body="The more verified activity you add, the more accurate and valuable your score becomes." />
        </div>
      </div>
    </div>
  );
}

function ExplainCard({ icon: Icon, title, body }: { icon: typeof Info; title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-soft text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}