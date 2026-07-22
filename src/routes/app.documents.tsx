import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Clock, Download, Eye, FileCheck2,
  Loader2, ShieldCheck, Trash2, Upload, XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import {
  analyzeDocument, deleteMyDocument, getMyDocumentUrl,
  listMyDocuments, recordDocument, type DocKind,
} from "@/lib/api.functions";

export const Route = createFileRoute("/app/documents")({
  component: DocumentsPage,
});

const KINDS: { value: DocKind; label: string; hint: string }[] = [
  { value: "aadhaar", label: "Aadhaar Card", hint: "Government ID" },
  { value: "pan", label: "PAN Card", hint: "Tax identity" },
  { value: "license", label: "Driving License", hint: "For drivers" },
  { value: "passport", label: "Passport", hint: "Government ID" },
  { value: "voter_id", label: "Voter ID", hint: "Elector card / EPIC" },
  { value: "salary_slip", label: "Salary Slip", hint: "Monthly payslip" },
  { value: "bank_statement", label: "Bank Statement", hint: "Account statement" },
  { value: "income_proof", label: "Income Proof", hint: "Certificate / ITR" },
  { value: "payment_receipt", label: "Payment Receipt", hint: "Receipts / invoices" },
  { value: "employment_letter", label: "Employment Letter", hint: "Offer / appointment" },
  { value: "other", label: "Other Supporting", hint: "Any other document" },
];

const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

type DocRow = Awaited<ReturnType<typeof listMyDocuments>>[number];

function DocumentsPage() {
  const { session } = useStore();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["docs"],
    queryFn: () => listMyDocuments(),
    enabled: !!session,
    refetchInterval: (query) => {
      const rows = (query.state.data ?? []) as DocRow[];
      return rows.some((r) => r.ocr_status === "queued" || r.ocr_status === "running") ? 3000 : false;
    },
  });
  const rows: DocRow[] = q.data ?? [];

  const [kind, setKind] = useState<DocKind>("aadhaar");
  const [docName, setDocName] = useState("");
  const [busy, setBusy] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!session) return;
    const list = Array.from(files);
    for (const file of list) {
      const okType = /pdf|png|jpe?g/i.test(file.type) || /\.(pdf|png|jpe?g)$/i.test(file.name);
      if (!okType) { toast.error(`${file.name}: unsupported format`); continue; }
      if (file.size > MAX_BYTES) { toast.error(`${file.name}: exceeds 10 MB`); continue; }
      setBusy((n) => n + 1);
      try {
        const path = `${session.user.id}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
        const up = await supabase.storage.from("documents").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        const rec = await recordDocument({ data: {
          kind,
          document_name: docName.trim() || file.name,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
        } });
        toast.success(`${file.name} uploaded — running AI verification`);
        qc.invalidateQueries({ queryKey: ["docs"] });
        // Fire and forget — page will poll for status.
        analyzeDocument({ data: { id: rec.id } })
          .then(() => qc.invalidateQueries({ queryKey: ["docs"] }))
          .catch((e) => toast.error(e instanceof Error ? e.message : "AI verification failed"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    setDocName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const grouped = useMemo(() => {
    const g = new Map<string, DocRow[]>();
    for (const r of rows) {
      const list = g.get(r.kind) ?? [];
      list.push(r);
      g.set(r.kind, list);
    }
    return g;
  }, [rows]);

  const stats = useMemo(() => ({
    total: rows.length,
    verified: rows.filter((r) => r.status === "verified").length,
    review: rows.filter((r) => r.status === "needs_review").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  }), [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance"
        title="Document Verification"
        description="Upload identity, income and employment documents. Every file is encrypted at rest and verified by our AI OCR agent."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Verified" value={stats.verified} tone="emerald" />
        <StatCard label="Needs review" value={stats.review} tone="amber" />
        <StatCard label="Rejected" value={stats.rejected} tone="rose" />
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(200px,220px)_minmax(0,1fr)_auto]">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Document type</label>
            <Select value={kind} onValueChange={(v) => setKind(v as DocKind)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Label (optional)</label>
            <Input
              className="mt-1"
              placeholder="e.g. Aadhaar Copy 2, June Salary Slip"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <label className="w-full">
              <Button asChild className="w-full rounded-full" disabled={busy > 0}>
                <span className="cursor-pointer">
                  {busy > 0
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                    : <><Upload className="mr-2 h-4 w-4" /> Upload document(s)</>}
                </span>
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length) uploadFiles(files);
                }}
              />
            </label>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          PDF, PNG or JPG · up to 10 MB · multiple files supported · nothing overwrites previous uploads.
        </div>
      </div>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your documents…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No documents yet"
          description="Upload your first document above. Every upload is stored as a separate record and independently verified."
        />
      ) : (
        <div className="space-y-6">
          {KINDS.map((k) => {
            const list = grouped.get(k.value);
            if (!list?.length) return null;
            return (
              <section key={k.value}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{k.label}</h3>
                  <span className="text-xs text-muted-foreground">{list.length} file{list.length > 1 ? "s" : ""}</span>
                </div>
                <div className="grid gap-3">
                  {list.map((r) => <DocumentRow key={r.id} row={r} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" | "rose" }) {
  const cls = tone === "emerald" ? "text-emerald-600"
    : tone === "amber" ? "text-amber-600"
    : tone === "rose" ? "text-rose-600" : "text-foreground";
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function DocumentRow({ row }: { row: DocRow }) {
  const qc = useQueryClient();
  const displayName = row.document_name || row.file_name || "Document";
  const uploaded = row.created_at ? new Date(row.created_at) : null;

  const openMut = useMutation({
    mutationFn: async (action: "view" | "download") => {
      const { url } = await getMyDocumentUrl({ data: { id: row.id } });
      if (action === "download") {
        const a = document.createElement("a");
        a.href = url;
        a.download = row.file_name || displayName;
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not open file"),
  });

  const reanalyzeMut = useMutation({
    mutationFn: () => analyzeDocument({ data: { id: row.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["docs"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Verification failed"),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteMyDocument({ data: { id: row.id } }),
    onSuccess: () => { toast.success("Document deleted"); qc.invalidateQueries({ queryKey: ["docs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const running = row.ocr_status === "queued" || row.ocr_status === "running";

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl gradient-soft text-primary">
          <FileCheck2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold">{displayName}</h4>
            <span className="text-xs text-muted-foreground">{KIND_LABEL[row.kind] ?? row.kind}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.file_name}
            {uploaded && ` · Uploaded ${uploaded.toLocaleDateString()} ${uploaded.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          </p>
          {running ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {row.ocr_status === "queued" ? "OCR queued…" : "AI verification running…"}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              {row.verification_reason || row.rejection_reason || "AI verification completed."}
            </p>
          )}
        </div>
        <StatusPill status={row.status} confidence={row.confidence_score ?? null} running={running} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => openMut.mutate("view")}>
          <Eye className="mr-1.5 h-3.5 w-3.5" /> View
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => openMut.mutate("download")}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Download
        </Button>
        {!running && (
          <Button size="sm" variant="ghost" className="rounded-full" disabled={reanalyzeMut.isPending} onClick={() => reanalyzeMut.mutate()}>
            {reanalyzeMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
            Re-verify
          </Button>
        )}
        <Button size="sm" variant="ghost" className="ml-auto rounded-full text-rose-600 hover:text-rose-700" disabled={deleteMut.isPending} onClick={() => {
          if (window.confirm("Delete this document? This cannot be undone.")) deleteMut.mutate();
        }}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}

function StatusPill({ status, confidence, running }: { status: string; confidence: number | null; running: boolean }) {
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
      <XCircle className="h-3 w-3" /> Rejected
    </span>
  );
  return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}