import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Briefcase,
  Clock,
  FileCheck2,
  Sparkles,
  Wallet,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { profileCompletion, useStore } from "@/lib/store";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useStore();
  const pct = profileCompletion(profile);
  const verified = Object.values(profile?.documents ?? {}).filter((v) => v === "verified").length;
  const totalDocs = Object.keys(profile?.documents ?? { a: 0 }).length || 3;

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl gradient-hero p-6 text-white shadow-elevated sm:p-8"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
              ShramSethu
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome, {profile?.fullName?.split(" ")[0] ?? "Worker"}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/85 sm:text-base">
              Let's continue building your verified digital work identity.
            </p>
          </div>
          <BadgeCheck className="hidden h-10 w-10 shrink-0 text-white sm:block" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatChip label="Profile completion" value={`${pct}%`} sub={pct < 100 ? "Keep going" : "Complete"} />
          <StatChip label="Verification" value={`${verified}/${totalDocs}`} sub="Documents verified" />
          <StatChip label="GigScore" value="—" sub="Awaiting activity" />
        </div>
      </motion.div>

      {/* Profile completion */}
      {pct < 100 && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl gradient-soft text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="truncate text-sm font-semibold">Finish your profile to unlock GigScore</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Add more work details to improve visibility to employers and lenders.</p>
            </div>
            <Button asChild size="sm" className="shrink-0 rounded-full gradient-primary text-white">
              <Link to="/app/profile">Continue <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <Progress value={pct} className="mt-4 h-2" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Activity</h3>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4">
            <EmptyState icon={Activity} title="No recent activity" description="Once you start logging gigs and updates, they will appear here." />
          </div>
        </div>
        {/* Notifications */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <div className="mt-4">
            <EmptyState icon={Bell} title="You're all caught up" description="Important updates about verification and schemes will appear here." />
          </div>
        </div>

        {/* Work history */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Work History</h3>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4">
            <EmptyState icon={Briefcase} title="No work records added yet." description="Log your first gig to start building work history." />
          </div>
        </div>

        {/* Income */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Income Records</h3>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4">
            <EmptyState icon={Wallet} title="No income data available." action={<Button asChild size="sm" variant="outline" className="rounded-full"><Link to="/app/income">Connect sources</Link></Button>} />
          </div>
        </div>

        {/* Upcoming */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Upcoming Features</h3>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <ul className="mt-4 space-y-3">
            {[
              { icon: Wallet, t: "Real-time loan eligibility" },
              { icon: FileCheck2, t: "Aadhaar / PAN e-verification" },
              { icon: BarChart3, t: "Bank-account income sync" },
            ].map((u) => (
              <li key={u.t} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg gradient-soft text-primary">
                  <u.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{u.t}</span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Coming soon</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-4 backdrop-blur">
      <div className="text-[11px] font-medium uppercase tracking-wider text-white/80">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-[11px] text-white/75">{sub}</div>
    </div>
  );
}