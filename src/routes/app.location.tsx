import { createFileRoute } from "@tanstack/react-router";
import { Locate, Navigation, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { InteractiveMap } from "@/components/InteractiveMap";
import { getCurrentCoords } from "@/lib/geolocation";
import { useStore } from "@/lib/store";
import { recordLocation } from "@/lib/api.functions";

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
    getCurrentCoords()
      .then(async (c) => {
        setCoords({ lat: c.lat, lng: c.lng });
        setError(null);
        try {
          await recordLocation({ data: { lat: c.lat, lng: c.lng, accuracy: c.accuracy } });
          toast.success("Location shared");
        } catch (e) {
          console.error("[location] save failed", e);
          toast.error(e instanceof Error ? e.message : "Failed to save location");
        }
      })
      .catch((e: Error) => {
        console.error("[location] gps failed", e);
        setError(e.message);
      });
  };

  const markers = coords ? [{ position: coords, title: "You", color: "#4F46E5" }] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field"
        title="Live Location"
        description="Share your status and location while on duty. Location is shared only with your consent."
        actions={<ShareViaButton coords={coords} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <InteractiveMap center={coords} markers={markers} zoom={14} className="h-[420px] w-full" />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t p-4 sm:p-5">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">GPS status</div>
              <div className="truncate text-sm font-semibold">
                {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : error ? error : "Location permission required"}
              </div>
            </div>
            <Button onClick={request} className="shrink-0 rounded-full gradient-primary text-white">
              <Locate className="mr-1.5 h-4 w-4" /> Get my location
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

function ShareViaButton({ coords }: { coords: { lat: number; lng: number } | null }) {
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      let c = coords;
      if (!c) {
        const live = await getCurrentCoords();
        c = { lat: live.lat, lng: live.lng };
      }
      const url = `https://www.google.com/maps?q=${c.lat},${c.lng}`;
      const text = `My current location: ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
      const payload: ShareData = { title: "My live location · ShramSethu", text, url };
      if (nav.share && (!nav.canShare || nav.canShare(payload))) {
        await nav.share(payload);
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Location link copied — paste it in any app to share");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "Could not share location");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" disabled={busy} onClick={share} className="rounded-full gradient-primary text-white">
      <Share2 className="mr-1.5 h-3.5 w-3.5" /> {busy ? "Opening…" : "Share via"}
    </Button>
  );
}
