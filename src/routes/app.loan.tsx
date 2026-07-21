import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, ShieldCheck, Sparkles, TrendingUp, Wallet } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { getLoanEligibility, getMyGigscore, listMyDocuments, listMyTransactions } from "@/lib/api.functions";

export const Route = createFileRoute("/app/loan")({
  component: LoanPage,
});

function LoanPage() {
  const { data } = useQuery({ queryKey: ["loan"], queryFn: () => getLoanEligibility() });
  const gig = useQuery({ queryKey: ["gigscore"], queryFn: () => getMyGigscore() });
  const docs = useQuery({ queryKey: ["docs"], queryFn: () => listMyDocuments() });
  const txns = useQuery({ queryKey: ["txns"], queryFn: () => listMyTransactions() });

  const verifiedDocs = (docs.data ?? []).filter((d) => d.status === "verified").length;
  const incomes = (txns.data ?? []).filter((t) => t.type === "income");
  const incomeMonths = new Set(incomes.map((t) => (t.occurred_on ?? "").slice(0, 7))).size;
  const totalIncome = incomes.reduce((a, t) => a + Number(t.amount), 0);
  const score = gig.data?.score ?? 0;

  // Simple, transparent eligibility estimation.
  const eligible = score >= 40 && verifiedDocs >= 2 && incomeMonths >= 2;
  const monthlyAvg = incomeMonths > 0 ? totalIncome / Math.max(incomeMonths, 1) : 0;
  const estAmount = eligible ? Math.round((monthlyAvg * (score / 60) * 6) / 500) * 500 : 0;

  const checks = [
    { ok: score >= 40, label: `GigScore ≥ 40 (current ${score})` },
    { ok: verifiedDocs >= 2, label: `2+ verified documents (current ${verifiedDocs})` },
    { ok: incomeMonths >= 2, label: `Income logged for 2+ months (current ${incomeMonths})` },
  ];
  const tips = [
    !checks[0].ok && "Log verified gigs and complete your profile to raise your GigScore.",
    !checks[1].ok && "Upload and verify Aadhaar, PAN or Driving License in Documents.",
    !checks[2].ok && "Record income across multiple months so we can see consistency.",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Credit"
        title="Loan Eligibility Prediction"
        description="Fair credit signals based on verified work history — never on fake approvals."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border bg-card p-8 shadow-sm">
          <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white shadow-soft">
            <Wallet className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-xl font-semibold">
            {eligible ? "You meet ShramSethu's eligibility signals." : "Your eligibility is being built from verified activity."}
          </h3>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            To keep ShramSethu trustworthy, we never show fake approvals or partner banks.
            Below is a transparent view of your signals and how to improve them.
          </p>

          <div className="mt-6 space-y-2">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-sm">
                {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
              </div>
            ))}
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { i: TrendingUp, t: "Income history", d: `₹${totalIncome.toLocaleString("en-IN")} across ${incomeMonths} months.` },
              { i: Sparkles, t: "GigScore", d: `Score ${score}/100 from verified work.` },
              { i: CheckCircle2, t: "Verified docs", d: `${verifiedDocs} documents approved.` },
              { i: ShieldCheck, t: "Trust status", d: eligible ? "Ready for partner bank review." : "Building verified signals." },
            ].map((f) => (
              <li key={f.t} className="rounded-2xl border p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl gradient-soft text-primary">
                    <f.i className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{f.t}</div>
                    <div className="text-xs text-muted-foreground">{f.d}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {tips.length > 0 && (
            <div className="mt-6 rounded-2xl border bg-muted/40 p-4">
              <div className="text-sm font-semibold">Suggestions to improve eligibility</div>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Estimated eligibility</h3>
          <div className="mt-4 rounded-2xl gradient-soft p-5 text-center">
            <div className="text-3xl font-bold text-gradient">{eligible ? `₹${estAmount.toLocaleString("en-IN")}` : "—"}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {eligible ? "Indicative ceiling · pending partner bank"
                : data?.reason === "insufficient_data" ? "Requires more verified data"
                : "Requires more verified data"}
            </div>
          </div>
          <div className="mt-5 space-y-2 text-xs text-muted-foreground">
            <p><span className="font-semibold text-foreground">No partner banks yet.</span> ShramSethu is a new platform. Bank and NBFC integrations are on the roadmap.</p>
            <p>We will never show pre-approved offers unless a real lender is connected and consents to a formal decision.</p>
          </div>
        </div>
      </div>
    </div>
  );
}