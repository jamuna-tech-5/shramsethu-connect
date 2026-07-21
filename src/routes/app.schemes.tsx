import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Landmark, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { listSchemes } from "@/lib/api.functions";

export const Route = createFileRoute("/app/schemes")({
  component: SchemesPage,
});

const TAGS = ["All", "Registration", "Pension", "Health", "Insurance", "Welfare", "Credit"];

function SchemesPage() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("All");
  const { data: SCHEMES = [] } = useQuery({ queryKey: ["schemes"], queryFn: () => listSchemes() });

  const filtered = useMemo(
    () =>
      SCHEMES.filter(
        (s) =>
          (tag === "All" || s.category === tag) &&
          (s.name.toLowerCase().includes(q.toLowerCase()) ||
            (s.summary ?? "").toLowerCase().includes(q.toLowerCase())),
      ),
    [q, tag, SCHEMES],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Discover"
        title="Government Scheme Finder"
        description="Explore central and state schemes relevant to gig and informal workers."
      />

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search schemes" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" className="shrink-0 rounded-full">
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Filters
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${tag === t ? "gradient-primary text-white border-transparent" : "bg-background text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching schemes." description="Try adjusting your search or filters." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-soft text-primary">
                  <Landmark className="h-4 w-4" />
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{s.category}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold">{s.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{s.summary}</p>
              <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Eligibility · </span>{s.eligibility ?? "See official notification"}
              </div>
              {(s as { url?: string }).url ? (
                <Button asChild variant="ghost" size="sm" className="mt-3 rounded-full text-primary">
                  <a href={(s as { url?: string }).url ?? "#"} target="_blank" rel="noopener noreferrer">
                    Learn more <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              ) : (
                <span className="mt-3 inline-block text-xs text-muted-foreground">Official link coming soon</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}