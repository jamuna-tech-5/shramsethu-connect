import { createFileRoute } from "@tanstack/react-router";
import { Battery, BatteryCharging, MapPin, Search, Zap } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/charging")({
  component: ChargingPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "fast", label: "Fast charging" },
  { key: "standard", label: "Standard" },
] as const;

function ChargingPage() {
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number]["key"]>("all");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mobility"
        title="EV Charging Stations"
        description="Find nearby chargers as you work. Provider integrations coming soon."
      />

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search area or station" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="shrink-0 inline-flex rounded-full border bg-background p-1 text-xs">
            {FILTERS.map((x) => (
              <button
                key={x.key}
                onClick={() => setF(x.key)}
                className={`rounded-full px-3 py-1 font-medium ${f === x.key ? "gradient-primary text-white" : "text-muted-foreground"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="relative h-[380px]">
            <div className="absolute inset-0 gradient-soft" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(20,184,166,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,166,0.1)_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full gradient-primary text-white shadow-elevated">
                  <BatteryCharging className="h-6 w-6" />
                </div>
                <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                  Interactive map will load once a charging provider is connected.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Nearby stations</h3>
          <div className="mt-4">
            <EmptyState
              icon={MapPin}
              title="No stations to show yet."
              description="Enable location and connect an EV charging provider to view real-time availability."
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border p-3">
              <div className="flex items-center gap-2 text-primary"><Zap className="h-3.5 w-3.5" /> Fast</div>
              <div className="mt-1 text-muted-foreground">50 kW +</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="flex items-center gap-2 text-primary"><Battery className="h-3.5 w-3.5" /> Standard</div>
              <div className="mt-1 text-muted-foreground">Up to 22 kW</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}