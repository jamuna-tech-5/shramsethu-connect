import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Ban, ChevronDown, Download, Eye, FileText, LogOut, Search, Shield, ShieldCheck, Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Logo } from "@/components/Logo";
import {
  adminSessionStatus, adminFetchAllWorkers, adminGetDocumentUrl,
  adminSetWorkerBlocked, adminLock,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — ShramSethu" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Internal administration console for ShramSethu operators." },
    ],
  }),
  component: AdminPage,
});

const DOC_LABEL: Record<string, string> = {
  aadhaar: "Aadhaar Card", pan: "PAN Card", license: "Driving License",
  passport: "Passport", voter_id: "Voter ID", salary_slip: "Salary Slip",
  bank_statement: "Bank Statement", income_proof: "Income Proof",
  payment_receipt: "Payment Receipt", employment_letter: "Employment Letter",
  bank: "Bank Document", identity: "Identity Document", other: "Other Document",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function fmtDay(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sessionQ = useQuery({ queryKey: ["adminSession"], queryFn: () => adminSessionStatus() });
  const unlocked = !!sessionQ.data?.unlocked;

  const workersQ = useQuery({
    queryKey: ["adminAllWorkers", search],
    queryFn: () => adminFetchAllWorkers({ data: { search } }),
    enabled: unlocked,
  });

  const blockMut = useMutation({
    mutationFn: (v: { id: string; blocked: boolean }) => adminSetWorkerBlocked({ data: v }),
    onSuccess: () => { toast.success("Worker updated"); qc.invalidateQueries({ queryKey: ["adminAllWorkers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDoc = async (path: string | null, download = false) => {
    if (!path) { toast.error("File not stored"); return; }
    try {
      const { url } = await adminGetDocumentUrl({ data: { path } });
      if (download) {
        const a = document.createElement("a");
        a.href = url; a.download = ""; a.rel = "noopener";
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to open document"); }
  };

  const signOut = async () => {
    await adminLock().catch(() => {});
    qc.clear();
    navigate({ to: "/auth" });
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const workers = workersQ.data?.workers ?? [];
  const stats = useMemo(() => {
    const total = workers.length;
    const verified = workers.filter((w) => w.docs_verified > 0).length;
    const blocked = workers.filter((w) => w.blocked).length;
    const pendingDocs = workers.reduce((n, w) => n + w.documents.filter((d) => d.status === "pending").length, 0);
    return { total, verified, blocked, pendingDocs };
  }, [workers]);

  if (sessionQ.isLoading) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Checking access…</div>;
  }

  if (!unlocked) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl gradient-primary text-white shadow-soft">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter the secret access code on the sign-in page to continue.</p>
          <Button className="mt-6 rounded-full gradient-primary text-white" onClick={() => navigate({ to: "/auth" })}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size={28} withWordmark />
          <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary sm:inline">Admin</span>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={signOut}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
        </Button>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          eyebrow="Internal"
          title="Admin Dashboard"
          description="View every registered worker, uploaded document, income and verification status — pulled live from the database."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { l: "Registered workers", v: String(stats.total), i: Users },
            { l: "Workers with verified docs", v: String(stats.verified), i: ShieldCheck },
            { l: "Pending documents", v: String(stats.pendingDocs), i: FileText },
            { l: "Blocked accounts", v: String(stats.blocked), i: Ban },
          ].map((c) => (
            <div key={c.l} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">{c.l}</span>
                <c.i className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-bold">{c.v}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">All registered workers</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-72 pl-9" placeholder="Search name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {workersQ.isLoading && <p className="text-sm text-muted-foreground">Loading workers…</p>}
            {workersQ.isError && (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <p className="font-semibold">Could not load workers</p>
                <p className="mt-1 break-words">
                  {workersQ.error instanceof Error ? workersQ.error.message : "Unknown database error."}
                </p>
              </div>
            )}
            {!workersQ.isLoading && !workersQ.isError && workers.length === 0 && (
              <EmptyState icon={Users} title="No workers found" description="No workers match the current search." />
            )}
            {workers.map((w) => {
              const isOpen = expanded.has(w.id);
              const gigLabel = w.gigscore != null ? String(w.gigscore) : "Awaiting data";
              const incomeLabel = w.income.count > 0
                ? `₹${Math.round(w.income.total).toLocaleString("en-IN")} · ${w.income.count} entr${w.income.count === 1 ? "y" : "ies"}`
                : "No records yet";
              const loanLabel = (w.gigscore ?? 0) >= 60 && w.docs_verified >= 1 ? "Eligible" : "Insufficient data";
              const docsLabel = w.docs_total === 0
                ? "No documents"
                : `${w.docs_verified}/${w.docs_total} verified`;
              return (
                <motion.div key={w.id} layout className="rounded-xl border">
                  <button
                    type="button"
                    onClick={() => toggle(w.id)}
                    className="flex w-full flex-wrap items-center gap-3 rounded-xl bg-background p-3 text-left hover:bg-muted/60"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full gradient-primary text-sm font-semibold text-white">
                      {w.full_name?.[0]?.toUpperCase() ?? "W"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{w.full_name ?? "Unnamed worker"}</span>
                        {w.blocked && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">Blocked</span>}
                        {w.onboarded ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">Onboarded</span>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">Onboarding</span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {w.email ?? "—"} · {w.phone ?? "—"} · Joined {fmtDay(w.created_at)}
                      </div>
                    </div>
                    <div className="hidden grid-cols-4 gap-4 text-xs md:grid">
                      <div><div className="text-muted-foreground">GigScore</div><div className="font-semibold">{gigLabel}</div></div>
                      <div><div className="text-muted-foreground">Income</div><div className="font-semibold">{incomeLabel}</div></div>
                      <div><div className="text-muted-foreground">Loan</div><div className="font-semibold">{loanLabel}</div></div>
                      <div><div className="text-muted-foreground">Documents</div><div className="font-semibold">{docsLabel}</div></div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="border-t bg-muted/30 p-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          { k: "Registered", v: fmtDate(w.created_at) },
                          { k: "Last login", v: fmtDate(w.last_sign_in_at) },
                          { k: "Category", v: w.category ?? "—" },
                          { k: "Status", v: w.status ?? "—" },
                        ].map((r) => (
                          <div key={r.k} className="rounded-lg border bg-background p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{r.k}</div>
                            <div className="mt-0.5 text-sm font-medium">{r.v}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Uploaded documents ({w.documents.length})</h4>
                        <Button
                          size="sm"
                          variant={w.blocked ? "outline" : "destructive"}
                          onClick={() => blockMut.mutate({ id: w.id, blocked: !w.blocked })}
                          disabled={blockMut.isPending}
                        >
                          <Ban className="mr-1.5 h-3.5 w-3.5" />
                          {w.blocked ? "Unblock" : "Block"} worker
                        </Button>
                      </div>

                      {w.documents.length === 0 ? (
                        <div className="mt-3 rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                          This worker has not uploaded any documents yet.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {w.documents.map((d) => {
                            const statusClass =
                              d.status === "verified" ? "bg-emerald-500/10 text-emerald-700"
                              : d.status === "rejected" ? "bg-destructive/10 text-destructive"
                              : d.status === "needs_review" ? "bg-amber-500/10 text-amber-700"
                              : "bg-muted text-muted-foreground";
                            return (
                              <div key={d.id} className="rounded-lg border bg-background p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold">{DOC_LABEL[d.kind] ?? d.kind}</div>
                                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                      {d.document_name ?? d.file_name ?? "Untitled"} · {fmtDate(d.created_at)}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass}`}>{d.status}</span>
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">OCR: {d.ocr_status ?? "—"}</span>
                                    {d.confidence_score != null && (
                                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                                        {d.confidence_score}% confidence
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                  <div><span className="font-medium text-foreground">Storage:</span> {d.storage_path ? "Stored securely" : "Missing"}</div>
                                  <div><span className="font-medium text-foreground">AI verified:</span> {fmtDate(d.ai_verified_at)}</div>
                                  {d.verification_reason && (
                                    <div className="sm:col-span-2"><span className="font-medium text-foreground">Reason:</span> {d.verification_reason}</div>
                                  )}
                                </div>
                                <div className="mt-2 flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openDoc(d.storage_path)} disabled={!d.storage_path}>
                                    <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openDoc(d.storage_path, true)} disabled={!d.storage_path}>
                                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 text-xs text-muted-foreground shadow-sm">
          <div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Data shown here is fetched live from the database on every load.</div>
        </div>
      </main>
    </div>
  );
}