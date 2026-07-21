import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, LineChart as LineIcon, Link2, PiggyBank, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addIncomeRecord, addIncomeSource, listIncomeSources, listMyTransactions,
} from "@/lib/api.functions";

export const Route = createFileRoute("/app/income")({
  component: IncomePage,
});

function IncomePage() {
  const qc = useQueryClient();
  const { data: txns = [] } = useQuery({ queryKey: ["txns"], queryFn: () => listMyTransactions() });
  const { data: sources = [] } = useQuery({ queryKey: ["income-sources"], queryFn: () => listIncomeSources() });

  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const incomes = txns.filter((t) => t.type === "income");
  const sum = (from: Date) => incomes.filter((t) => new Date(t.occurred_on) >= from).reduce((a, t) => a + Number(t.amount), 0);
  const fmt = (n: number) => n === 0 ? "—" : `₹${n.toLocaleString("en-IN")}`;
  const week = sum(startOfWeek), month = sum(startOfMonth), year = sum(startOfYear);

  // Aggregate: last 30 days line + monthly bars for current year.
  const daily = useMemo(() => {
    const days: { date: string; amount: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const amt = incomes.filter((t) => t.occurred_on === key).reduce((a, t) => a + Number(t.amount), 0);
      days.push({ date: key.slice(5), amount: amt });
    }
    return days;
  }, [incomes]);

  const monthly = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      m: new Date(now.getFullYear(), i, 1).toLocaleString("en", { month: "short" }),
      amount: 0,
    }));
    incomes.forEach((t) => {
      const d = new Date(t.occurred_on);
      if (d.getFullYear() === now.getFullYear()) months[d.getMonth()].amount += Number(t.amount);
    });
    return months;
  }, [incomes]);

  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    incomes.forEach((t) => {
      const k = t.source ?? "Unknown";
      map.set(k, (map.get(k) ?? 0) + Number(t.amount));
    });
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [incomes]);

  const hasData = incomes.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Income Analytics"
        description="Real earnings from your logged gigs, sources and platforms."
        actions={
          <div className="flex gap-2">
            <AddSourceDialog onSaved={() => qc.invalidateQueries({ queryKey: ["income-sources"] })} />
            <AddIncomeDialog sources={sources as { id: string; name: string }[]} onSaved={() => {
              qc.invalidateQueries({ queryKey: ["txns"] });
              qc.invalidateQueries({ queryKey: ["gigscore"] });
            }} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "This week", v: fmt(week), i: LineIcon },
          { l: "This month", v: fmt(month), i: BarChart3 },
          { l: "This year", v: fmt(year), i: PiggyBank },
          { l: "Sources connected", v: String((sources as unknown[]).length), i: Link2 },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">{s.l}</span>
              <s.i className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{s.v}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{hasData ? "Verified" : "No data yet"}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold">Last 30 days</h3>
          <div className="mt-4 h-64">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                  <Line type="monotone" dataKey="amount" stroke="#4F46E5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={BarChart3} title="No income logged yet." description="Add your first income entry to see analytics." />
            )}
          </div>

          <h3 className="mt-6 text-sm font-semibold">Monthly ({now.getFullYear()})</h3>
          <div className="mt-4 h-56">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                  <Bar dataKey="amount" fill="#14B8A6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={BarChart3} title="No monthly data." description="Log incomes across the year to see trends." />
            )}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Income by source</h3>
          {bySource.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={Link2} title="No sources yet." description="Add a gig platform, employer or bank." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {bySource.map((s) => (
                <li key={s.name} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  <span className="truncate">{s.name}</span>
                  <span className="font-semibold">₹{s.amount.toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-6 text-sm font-semibold">Connected sources</h3>
          {(sources as { id: string; name: string; kind: string }[]).length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">None connected yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {(sources as { id: string; name: string; kind: string }[]).map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground capitalize">{s.kind.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AddSourceDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"gig_platform" | "employer" | "bank" | "other">("gig_platform");
  const [ref, setRef] = useState("");
  const m = useMutation({
    mutationFn: () => addIncomeSource({ data: { kind, name, external_ref: ref || undefined } }),
    onSuccess: () => { toast.success("Source added"); setOpen(false); setName(""); setRef(""); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full"><Link2 className="mr-1.5 h-3.5 w-3.5" /> Add source</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add income source</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="gig_platform">Gig platform</option>
              <option value="employer">Employer</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Zomato / Ola / Employer Ltd." /></div>
          <div><Label>Reference (optional)</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Partner ID / Account number" /></div>
          <Button disabled={!name.trim() || m.isPending} onClick={() => m.mutate()} className="w-full rounded-full gradient-primary text-white">{m.isPending ? "Saving…" : "Save source"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddIncomeDialog({ sources, onSaved }: { sources: { id: string; name: string }[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => addIncomeRecord({ data: { amount: Number(amount), source: source || undefined, occurred_on: date, note: note || undefined } }),
    onSuccess: () => { toast.success("Income recorded"); setOpen(false); setAmount(""); setNote(""); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full gradient-primary text-white"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add income</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log an income</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Amount (₹)</Label><Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1200" /></div>
          <div>
            <Label>Source</Label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">— Not specified —</option>
              {sources.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Note (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <Button disabled={!(Number(amount) > 0) || m.isPending} onClick={() => m.mutate()} className="w-full rounded-full gradient-primary text-white">
            {m.isPending ? "Saving…" : "Save income"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}