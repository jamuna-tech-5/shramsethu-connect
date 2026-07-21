import { createFileRoute } from "@tanstack/react-router";
import { BatteryCharging, Fuel, Hospital, MapPin, Search, Wrench } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InteractiveMap, type MapMarker } from "@/components/InteractiveMap";
import { useMutation } from "@tanstack/react-query";
import { nearbyPlaces } from "@/lib/api.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/charging")({
  component: ChargingPage,
});

const CATEGORIES = [
  { key: "electric_vehicle_charging_station", label: "EV Charging", icon: BatteryCharging, color: "#14B8A6" },
  { key: "gas_station", label: "Fuel", icon: Fuel, color: "#F59E0B" },
  { key: "hospital", label: "Hospitals", icon: Hospital, color: "#EF4444" },
  { key: "car_repair", label: "Mechanics", icon: Wrench, color: "#4F46E5" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];
type Place = { id?: string; displayName?: { text?: string }; formattedAddress?: string; rating?: number; userRatingCount?: number; location?: { latitude: number; longitude: number } };

function ChargingPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryKey>("electric_vehicle_charging_station");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const search = useMutation({
    mutationFn: async (cat: CategoryKey) => {
      const coords = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!("geolocation" in navigator)) return reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
      });
      const c = { lat: coords.coords.latitude, lng: coords.coords.longitude };
      setCenter(c);
      return nearbyPlaces({ data: { lat: c.lat, lng: c.lng, includedType: cat } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const places = (search.data ?? []) as Place[];
  const filtered = places.filter((s) => {
    const name = (s.displayName?.text ?? "").toLowerCase();
    return !q || name.includes(q.toLowerCase()) || (s.formattedAddress ?? "").toLowerCase().includes(q.toLowerCase());
  });
  const active = CATEGORIES.find((c) => c.key === category)!;
  const markers: MapMarker[] = [
    ...(center ? [{ position: center, title: "You", color: "#4F46E5" } as MapMarker] : []),
    ...filtered.filter((p) => p.location).map((p) => ({
      position: { lat: p.location!.latitude, lng: p.location!.longitude },
      title: p.displayName?.text, color: active.color,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mobility"
        title="Nearby Services"
        description="Live map of EV charging, fuel, hospitals and mechanics around you — powered by Google Maps."
      />

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 min-w-[220px]" placeholder="Filter results" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="inline-flex flex-wrap gap-1 rounded-full border bg-background p-1 text-xs">
            {CATEGORIES.map((x) => (
              <button
                key={x.key}
                onClick={() => { setCategory(x.key); search.mutate(x.key); }}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium ${category === x.key ? "gradient-primary text-white" : "text-muted-foreground"}`}
              >
                <x.icon className="h-3.5 w-3.5" />
                {x.label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => search.mutate(category)} disabled={search.isPending} className="ml-auto rounded-full gradient-primary text-white">
            {search.isPending ? "Searching…" : "Find near me"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <InteractiveMap center={center} markers={markers} zoom={13} className="h-[420px] w-full" />
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Nearby {active.label.toLowerCase()}</h3>
          <div className="mt-4">
            {filtered.length === 0 ? (
              <EmptyState icon={MapPin} title={`No ${active.label.toLowerCase()} found yet.`} description="Tap 'Find near me' to load live results from Google Maps." />
            ) : (
              <ul className="max-h-[440px] space-y-2 overflow-auto pr-1">
                {filtered.map((s) => (
                  <li key={s.id ?? s.formattedAddress} className="rounded-xl border p-3">
                    <div className="text-sm font-semibold">{s.displayName?.text ?? active.label}</div>
                    <div className="text-xs text-muted-foreground">{s.formattedAddress}</div>
                    {typeof s.rating === "number" && (
                      <div className="mt-1 text-[11px] text-muted-foreground">★ {s.rating.toFixed(1)} · {s.userRatingCount ?? 0} reviews</div>
                    )}
                    {s.location && (
                      <a target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[11px] font-medium text-primary"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${s.location.latitude},${s.location.longitude}`}>Directions →</a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}