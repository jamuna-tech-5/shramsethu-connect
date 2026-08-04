import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Landmark, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { listSchemes } from "@/lib/api.functions";

export const Route = createFileRoute("/app/schemes")({
  component: SchemesPage,
});

const TAGS = ["All", "Registration", "Pension", "Health", "Insurance"];
const HIDDEN_CATEGORIES = ["Welfare", "Credit"];

type Scheme = {
  id: string; name: string; category: string | null; summary: string | null;
  authority?: string | null; benefits?: string | null; eligibility: string | null; url?: string | null;
};

function SchemesPage() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("All");
  const [active, setActive] = useState<Scheme | null>(null);
  const { data: SCHEMES = [] } = useQuery({ queryKey: ["schemes"], queryFn: () => listSchemes() });

  const filtered = useMemo(
    () =>
      SCHEMES.filter(
        (s) =>
          !HIDDEN_CATEGORIES.includes(s.category ?? "") &&
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
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => setActive(s as Scheme)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(s as Scheme); } }}
              className="cursor-pointer rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
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
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 rounded-full text-primary"
                onClick={(e) => { e.stopPropagation(); setActive(s as Scheme); }}
              >
                View details
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{active?.name}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {active.category && <span className="rounded-full bg-muted px-2 py-0.5">{active.category}</span>}
                {active.authority && <span className="rounded-full bg-muted px-2 py-0.5">{active.authority}</span>}
              </div>
              {active.summary && <p className="text-muted-foreground">{active.summary}</p>}
              {active.benefits && (
                <div className="rounded-xl bg-muted/60 p-3 text-xs">
                  <span className="font-semibold text-foreground">Benefits · </span>{active.benefits}
                </div>
              )}
              <div className="rounded-xl bg-muted/60 p-3 text-xs">
                <span className="font-semibold text-foreground">Eligibility · </span>
                {active.eligibility ?? "See official notification"}
              </div>
              {active.url ? (
                <Button asChild className="w-full rounded-full gradient-primary text-white">
                  <a href={active.url} target="_blank" rel="noopener noreferrer">
                    Open official portal <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Official link coming soon.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}