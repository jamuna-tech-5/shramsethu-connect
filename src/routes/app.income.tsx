import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle, BarChart3, CheckCircle2, Clock, Eye,
  FileCheck2, LineChart as LineIcon, Link2, Loader2, PiggyBank, ShieldCheck,
  Upload, XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { refreshVerifiedData } from "@/lib/refresh";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import {
  analyzeDocument, getMyDocumentUrl, listMyIncomeUploads, listMyTransactions,
  recordDocument, type DocKind,
} from "@/lib/api.functions";

export const Route = createFileRoute("/app/income")({
  component: IncomePage,
});

const SOURCES = [
  "Zomato","Swiggy","Uber","Ola","Rapido","Amazon Flex","Flipkart","Blinkit","Zepto",
  "Construction Work","Daily Wage","Freelancing","Agriculture","Self Employed","Other",
] as const;
type IncomeSource = typeof SOURCES[number];
type Frequency = "daily" | "weekly" | "monthly";

const PROOF_KINDS: { value: DocKind; label: string }[] = [
  { value: "salary_slip", label: "Salary Slip" },
  { value: "payment_receipt", label: "Earnings Screenshot / Payment Receipt" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "income_proof", label: "Platform Earnings Screenshot" },
  { value: "employment_letter", label: "Employer Payment Slip" },
  { value: "other", label: "Other Income Proof" },
];

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const MAX_BYTES = 10 * 1024 * 1024;

type UploadRow = Awaited<ReturnType<typeof listMyIncomeUploads>>[number];

function IncomePage() {
  const qc = useQueryClient();
  const { data: txns = [] } = useQuery({ queryKey: ["txns"], queryFn: () => listMyTransactions() });
  const uploadsQ = useQuery({
    queryKey: ["income-uploads"],
    queryFn: () => listMyIncomeUploads(),
    refetchInterval: (q) => {
      const rows = (q.state.data ?? []) as UploadRow[];
      return rows.some((r) => r.ocr_status === "queued" || r.ocr_status === "running") ? 3000 : false;
    },
  });
  const uploads: UploadRow[] = uploadsQ.data ?? [];

  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const verifiedIncomes = txns.filter((t) => t.type === "income" && t.verified);
  const incomes = verifiedIncomes;
  const sum = (from: Date) => incomes.filter((t) => new Date(t.occurred_on) >= from).reduce((a, t) => a + Number(t.amount), 0);
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = sum(startOfToday);
  const week = sum(startOfWeek), month = sum(startOfMonth), year = sum(startOfYear);

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

  const weekly = useMemo(() => {
    // Last 12 ISO weeks
    const buckets: { label: string; amount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const end = new Date(); end.setDate(now.getDate() - i * 7);
      const start = new Date(end); start.setDate(end.getDate() - 6);
      const amt = incomes.filter((t) => {
        const d = new Date(t.occurred_on);
        return d >= start && d <= end;
      }).reduce((a, t) => a + Number(t.amount), 0);
      buckets.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, amount: amt });
    }
    return buckets;
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

  const verifiedCount = uploads.filter((u) => u.status === "verified").length;
  const pendingCount = uploads.filter((u) => u.status !== "verified" && u.status !== "rejected").length;
  const rejectedCount = uploads.filter((u) => u.status === "rejected").length;
  const verifiedPending = [
    { name: "Verified", value: verifiedCount },
    { name: "Pending", value: pendingCount },
    { name: "Rejected", value: rejectedCount },
  ];
  const PIE_COLORS = ["#10B981", "#F59E0B", "#EF4444"];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="AI-Verified Income"
        description="Upload earnings proof — our AI reads it, verifies the amount, and updates your analytics, GigScore, and loan eligibility."
        actions={
          <UploadEarningsDialog onSaved={() => {
            refreshVerifiedData(qc);
          }} />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Today", v: fmt(today), i: LineIcon },
          { l: "This week", v: fmt(week), i: LineIcon },
          { l: "This month", v: fmt(month), i: BarChart3 },
          { l: "This year", v: fmt(year), i: PiggyBank },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">{s.l}</span>
              <s.i className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{s.v}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">AI-verified only</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold">Income Trend · Last 30 days</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Line type="monotone" dataKey="amount" stroke="#4F46E5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h3 className="mt-6 text-sm font-semibold">Daily earnings · Last 30 days</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 className="mt-6 text-sm font-semibold">Weekly earnings · Last 12 weeks</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Bar dataKey="amount" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 className="mt-6 text-sm font-semibold">Monthly ({now.getFullYear()})</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Bar dataKey="amount" fill="#14B8A6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Income by source</h3>
          {bySource.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No verified income yet — upload a proof to get started.</p>
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

          <h3 className="mt-6 text-sm font-semibold">Verified vs pending</h3>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={verifiedPending} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {verifiedPending.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i]} />))}
                </Pie>
                <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div><div className="font-semibold text-emerald-600">{verifiedCount}</div><div className="text-muted-foreground">Verified</div></div>
            <div><div className="font-semibold text-amber-600">{pendingCount}</div><div className="text-muted-foreground">Pending</div></div>
            <div><div className="font-semibold text-rose-600">{rejectedCount}</div><div className="text-muted-foreground">Rejected</div></div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Earnings proof history</h3>
          <span className="text-xs text-muted-foreground">{uploads.length} upload{uploads.length === 1 ? "" : "s"}</span>
        </div>
        {uploads.length === 0 ? (
          <p className="text-xs text-muted-foreground">No earnings proofs uploaded yet. Every verified upload updates your analytics, GigScore and loan eligibility.</p>
        ) : (
          <div className="grid gap-3">
            {uploads.map((u) => <UploadRow key={u.id} row={u} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadEarningsDialog({ onSaved }: { onSaved: () => void }) {
  const { session } = useStore();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<IncomeSource>("Zomato");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [kind, setKind] = useState<DocKind>("payment_receipt");
  const [busy, setBusy] = useState(false);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!session) { toast.error("Please sign in"); return; }
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    try {
      for (const file of list) {
        const okType = /pdf|png|jpe?g/i.test(file.type) || /\.(pdf|png|jpe?g)$/i.test(file.name);
        if (!okType) { toast.error(`${file.name}: unsupported format`); continue; }
        if (file.size > MAX_BYTES) { toast.error(`${file.name}: exceeds 10 MB`); continue; }
        const path = `${session.user.id}/income/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
        const up = await supabase.storage.from("documents").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        const rec = await recordDocument({ data: {
          kind,
          document_name: `${source} · ${frequency} · ${file.name}`,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          income_source: source,
          income_frequency: frequency,
          is_income_proof: true,
        } });
        toast.success(`${file.name} uploaded — running AI verification`);
        analyzeDocument({ data: { id: rec.id } })
          .then((r) => {
            if (r.status === "verified") toast.success("✅ Your earnings have been verified successfully.");
            else if (r.status === "rejected") toast.error(`Rejected: ${r.verification_reason || "unreadable proof"}`);
            else toast.message("Needs manual review — check the history below.");
            onSaved();
          })
          .catch((e) => toast.error(e instanceof Error ? e.message : "AI verification failed"));
      }
      onSaved();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full gradient-primary text-white">
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload earnings proof
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload earnings proof</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Income source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as IncomeSource)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Income frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Proof type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as DocKind)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROOF_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Upload file(s)</Label>
            <label className="mt-1 block">
              <Button asChild className="w-full rounded-full" disabled={busy}>
                <span className="cursor-pointer">
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                        : <><Upload className="mr-2 h-4 w-4" /> Choose file(s)</>}
                </span>
              </Button>
              <input
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); }}
              />
            </label>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-primary" />
              PDF, PNG, JPG · up to 10 MB · AI OCR reads the file and extracts the amount automatically.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UploadRow({ row }: { row: UploadRow }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [file, setFile] = useState<{ url: string; mime_type: string; file_name: string } | null>(null);
  const openMut = useMutation({
    mutationFn: async () => getMyDocumentUrl({ data: { id: row.id } }),
    onSuccess: (f) => { setFile(f); setViewerOpen(true); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not open file"),
  });
  const running = row.ocr_status === "queued" || row.ocr_status === "running";
  const uploaded = row.created_at ? new Date(row.created_at) : null;

  return (
    <div className="rounded-2xl border p-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl gradient-soft text-primary">
          <FileCheck2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold">
              {row.income_source ?? "Income"}
              {row.income_frequency ? <span className="ml-1 text-xs font-normal text-muted-foreground capitalize">· {row.income_frequency}</span> : null}
            </h4>
            {row.extracted_amount != null && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                ₹{Number(row.extracted_amount).toLocaleString("en-IN")}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.file_name}
            {uploaded && ` · Uploaded ${uploaded.toLocaleDateString()}`}
            {row.extracted_date && ` · Paid ${row.extracted_date}`}
            {row.extracted_employer && ` · ${row.extracted_employer}`}
          </p>
          {running ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {row.ocr_status === "queued" ? "Stored · queued for OCR" : "AI OCR reading & verifying…"}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{row.verification_reason || "AI verification completed."}</p>
          )}
        </div>
        <IncomeStatusPill status={row.status} confidence={row.confidence_score ?? null} running={running} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="rounded-full" disabled={openMut.isPending} onClick={() => openMut.mutate()}>
          {openMut.isPending
            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            : <Eye className="mr-1.5 h-3.5 w-3.5" />} View
        </Button>
      </div>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">{row.file_name || "Uploaded document"}</DialogTitle>
          </DialogHeader>
          {file ? (
            file.mime_type?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.file_name) ? (
              <img
                src={file.url}
                alt={`Earnings proof ${row.file_name ?? ""}`}
                className="max-h-[70vh] w-full rounded-xl border object-contain"
              />
            ) : (
              <iframe
                src={file.url}
                title={row.file_name || "Document"}
                className="h-[70vh] w-full rounded-xl border"
              />
            )
          ) : (
            <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IncomeStatusPill({ status, confidence, running }: { status: string; confidence: number | null; running: boolean }) {
  if (running) return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
      <Loader2 className="h-3 w-3 animate-spin" /> Verifying
    </span>
  );
  if (status === "verified") return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> Verified{confidence != null && ` · ${confidence}%`}
    </span>
  );
  if (status === "needs_review") return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
      <AlertTriangle className="h-3 w-3" /> Needs review{confidence != null && ` · ${confidence}%`}
    </span>
  );
  if (status === "rejected") return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
      <XCircle className="h-3 w-3" /> Rejected{confidence != null && ` · ${confidence}%`}
    </span>
  );
  return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}