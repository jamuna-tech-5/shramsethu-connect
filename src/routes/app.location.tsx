import { createFileRoute } from "@tanstack/react-router";
import { Locate, MapPin, Navigation } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/location")({
  component: LocationPage,
});

const STATUSES = [
  { key: "online", label: "Online", color: "bg-success" },
  { key: "on_duty", label: "On Duty", color: "bg-primary" },
  { key: "available", label: "Available", color: "bg-secondary" },
  { key: "offline", label: "Offline", color: "bg-muted-foreground" },
] as const;

function LocationPage() {
  const { profile, update } = useStore();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = () => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setError(null);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field"
        title="Live Location"
        description="Share your status and location while on duty. Location is shared only with your consent."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="relative h-[420px] w-full overflow-hidden">
            <div className="absolute inset-0 gradient-soft" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(79,70,229,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(79,70,229,0.08)_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full gradient-primary text-white shadow-elevated">
                  <MapPin className="h-6 w-6" />
                </div>
                <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                  Google Maps integration will be available in a future update.
                </p>
                {coords && (
                  <p className="mt-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t p-4 sm:p-5">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">GPS status</div>
              <div className="truncate text-sm font-semibold">
                {coords ? "Location shared" : error ? error : "Location permission required"}
              </div>
            </div>
            <Button onClick={request} className="shrink-0 rounded-full gradient-primary text-white">
              <Locate className="mr-1.5 h-4 w-4" /> Share location
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Worker Status</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {STATUSES.map((s) => {
                const active = profile?.status === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => {
                      update({ status: s.key });
                      toast.success(`Status set to ${s.label}`);
                    }}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${active ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted"}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Privacy first</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Location is only used while you're on duty. You can revoke access anytime
              from your device settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}