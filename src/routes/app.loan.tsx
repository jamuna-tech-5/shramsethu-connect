import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck, Sparkles, TrendingUp, Wallet } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/app/loan")({
  component: LoanPage,
});

function LoanPage() {
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
            Eligibility prediction will be available after sufficient verified data is collected.
          </h3>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            To keep ShramSethu trustworthy, we never show fake approvals, offers or
            partner banks. As you build verified activity, your eligibility will be
            calculated transparently from the signals below.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { i: TrendingUp, t: "Income history", d: "Consistency and volume across sources." },
              { i: Sparkles, t: "GigScore", d: "Verified work reputation over time." },
              { i: CheckCircle2, t: "Work consistency", d: "Regularity of gigs and completed shifts." },
              { i: ShieldCheck, t: "Verification status", d: "Identity, address and profession proofs." },
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
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Estimated eligibility</h3>
          <div className="mt-4 rounded-2xl gradient-soft p-5 text-center">
            <div className="text-3xl font-bold text-gradient">—</div>
            <div className="mt-1 text-xs text-muted-foreground">Requires verified data</div>
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