import { createFileRoute } from "@tanstack/react-router";
import { Activity, AlertTriangle, ShieldCheck, Users } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { adminStats } from "@/lib/api.functions";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { profile } = useStore();
  const isAdmin = !!profile?.isAdmin;
  const q = useQuery({ queryKey: ["adminStats"], queryFn: () => adminStats(), enabled: isAdmin });
  const s = q.data;
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Internal" title="Admin Dashboard" description="Restricted area." />
        <EmptyState icon={ShieldCheck} title="Access restricted" description="You need administrator privileges to view this page." />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Internal"
        title="Admin Dashboard"
        description="Overview for platform operators. Real metrics appear once the platform has activity."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Registered workers", v: String(s?.registeredWorkers ?? 0), i: Users },
          { l: "Verifications pending", v: String(s?.pendingVerifications ?? 0), i: ShieldCheck },
          { l: "Active today", v: String(s?.activeToday ?? 0), i: Activity },
          { l: "Open SOS alerts", v: String(s?.openSOS ?? 0), i: AlertTriangle },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">{s.l}</span>
              <s.i className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{s.v}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">No records yet</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Verification queue</h3>
          <div className="mt-4">
            <EmptyState icon={ShieldCheck} title="No documents awaiting review." description="Submitted documents will appear here for verification." />
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Recent SOS alerts</h3>
          <div className="mt-4">
            <EmptyState icon={AlertTriangle} title="No alerts triggered." description="Live alerts and their status will surface here." />
          </div>
        </div>
      </div>
    </div>
  );
}