import { createFileRoute } from "@tanstack/react-router";
import { Activity, AlertTriangle, Ban, CheckCircle2, Eye, ShieldCheck, Trash2, Users, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminStats, adminListWorkers, adminListPendingDocs, adminReviewDocument,
  adminSetBlocked, adminDeleteWorker, adminSignedUrl,
} from "@/lib/api.functions";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { profile } = useStore();
  const isAdmin = !!profile?.isAdmin;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"queue" | "workers">("queue");
  const statsQ = useQuery({ queryKey: ["adminStats"], queryFn: () => adminStats(), enabled: isAdmin });
  const workersQ = useQuery({
    queryKey: ["adminWorkers", search],
    queryFn: () => adminListWorkers({ data: { search } }),
    enabled: isAdmin,
  });
  const queueQ = useQuery({
    queryKey: ["adminQueue"], queryFn: () => adminListPendingDocs(), enabled: isAdmin,
  });
  const s = statsQ.data;

  const review = useMutation({
    mutationFn: (v: { docId: string; decision: "verified" | "rejected" }) => adminReviewDocument({ data: v }),
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["adminQueue"] });
      qc.invalidateQueries({ queryKey: ["adminStats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const block = useMutation({
    mutationFn: (v: { id: string; blocked: boolean }) => adminSetBlocked({ data: v }),
    onSuccess: (_d, v) => { toast.success(v.blocked ? "Worker blocked" : "Worker unblocked"); qc.invalidateQueries({ queryKey: ["adminWorkers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminDeleteWorker({ data: { id } }),
    onSuccess: () => { toast.success("Worker deleted"); qc.invalidateQueries({ queryKey: ["adminWorkers"] }); qc.invalidateQueries({ queryKey: ["adminStats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewDoc = async (path: string) => {
    try {
      const { url } = await adminSignedUrl({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Cannot open document"); }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Internal" title="Admin Dashboard" description="Restricted area." />
        <EmptyState icon={ShieldCheck} title="Access restricted" description="You need administrator privileges to view this page. Go to /admin/login to sign in as an admin." />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Internal"
        title="Admin Dashboard"
        description="Manage workers, review documents, and monitor platform activity."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Registered workers", v: String(s?.registeredWorkers ?? 0), i: Users },
          { l: "Verifications pending", v: String(s?.pendingVerifications ?? 0), i: ShieldCheck },
          { l: "Active today", v: String(s?.activeToday ?? 0), i: Activity },
          { l: "Open SOS alerts", v: String(s?.openSOS ?? 0), i: AlertTriangle },
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

      <div className="inline-flex rounded-full border bg-background p-1 text-xs">
        {(["queue","workers"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 font-medium capitalize ${tab === t ? "gradient-primary text-white" : "text-muted-foreground"}`}>
            {t === "queue" ? "Verification queue" : "All workers"}
          </button>
        ))}
      </div>

      {tab === "queue" ? (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Documents awaiting review</h3>
          <div className="mt-4 space-y-2">
            {queueQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {queueQ.data && queueQ.data.length === 0 && (
              <EmptyState icon={ShieldCheck} title="No documents awaiting review." description="Submitted documents will appear here." />
            )}
            {(queueQ.data ?? []).map((d: any) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold capitalize">{d.kind} — {d.file_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.profiles?.full_name ?? "Unknown"} · {d.profiles?.email ?? d.profiles?.phone ?? ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => viewDoc(d.storage_path)}><Eye className="mr-1 h-4 w-4" />View</Button>
                  <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => review.mutate({ docId: d.id, decision: "verified" })}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => review.mutate({ docId: d.id, decision: "rejected" })}>
                    <XCircle className="mr-1 h-4 w-4" />Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Input placeholder="Search by name, email, or phone" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Name</th><th>Contact</th><th>Category</th><th>Status</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {(workersQ.data ?? []).map((w: any) => (
                  <tr key={w.id} className="border-t">
                    <td className="py-2 font-medium">{w.full_name ?? "—"}</td>
                    <td className="text-muted-foreground">{w.email ?? w.phone ?? "—"}</td>
                    <td className="text-muted-foreground">{w.category ?? "—"}</td>
                    <td>
                      {w.blocked ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Blocked</span>
                        : <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">{w.status ?? "active"}</span>}
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => block.mutate({ id: w.id, blocked: !w.blocked })}>
                          <Ban className="mr-1 h-4 w-4" />{w.blocked ? "Unblock" : "Block"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Delete ${w.full_name ?? "worker"}? This cannot be undone.`)) del.mutate(w.id); }}>
                          <Trash2 className="mr-1 h-4 w-4" />Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {workersQ.data && workersQ.data.length === 0 && (
              <EmptyState icon={Users} title="No workers found." description="Try a different search term." />
            )}
          </div>
        </div>
      )}
    </div>
  );
}