import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, LineChart, Link2, PiggyBank } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { listMyTransactions } from "@/lib/api.functions";

export const Route = createFileRoute("/app/income")({
  component: IncomePage,
});

function IncomePage() {
  const { data: txns = [] } = useQuery({ queryKey: ["txns"], queryFn: () => listMyTransactions() });
  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const sum = (from: Date) => txns.filter((t) => t.type === "income" && new Date(t.occurred_on) >= from).reduce((a, t) => a + Number(t.amount), 0);
  const fmt = (n: number) => n === 0 ? "—" : `₹${n.toLocaleString("en-IN")}`;
  const week = sum(startOfWeek), month = sum(startOfMonth), year = sum(startOfYear);
  const sources = new Set(txns.filter((t) => t.type === "income").map((t) => t.source ?? "")).size;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Income Analytics"
        description="Understand your earnings across gigs, weeks and months."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "This week", v: fmt(week), i: LineChart },
          { l: "This month", v: fmt(month), i: BarChart3 },
          { l: "This year", v: fmt(year), i: PiggyBank },
          { l: "Sources connected", v: String(sources), i: Link2 },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">{s.l}</span>
              <s.i className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{s.v}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">No data yet</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold">Yearly Trends</h3>
          <div className="mt-4">
            <EmptyState
              icon={BarChart3}
              title="Connect your income sources to view analytics."
              description="Charts appear only after verified income data is available. We never show fake data."
              action={
                <Button className="rounded-full gradient-primary text-white shadow-soft">Connect a source</Button>
              }
            />
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Income Sources</h3>
          <div className="mt-4">
            <EmptyState icon={Link2} title="No sources connected." description="Add a gig platform or bank account to begin." />
          </div>
        </div>
      </div>
    </div>
  );
}