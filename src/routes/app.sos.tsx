import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Phone, ShieldAlert, Siren } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { triggerSOS } from "@/lib/api.functions";

export const Route = createFileRoute("/app/sos")({
  component: SosPage,
});

const HOTLINES = [
  { label: "Police", number: "100" },
  { label: "Ambulance", number: "108" },
  { label: "Women Helpline", number: "1091" },
  { label: "Disaster Management", number: "108" },
];

function SosPage() {
  const { profile } = useStore();
  const [triggered, setTriggered] = useState(false);

  const trigger = async () => {
    setTriggered(true);
    const fire = (lat?: number, lng?: number) =>
      triggerSOS({ data: { lat, lng, message: "Emergency triggered from app" } })
        .then(() => toast.success("SOS triggered. Your emergency contact will be notified."))
        .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to trigger SOS"));
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => fire(p.coords.latitude, p.coords.longitude),
        () => fire(),
        { timeout: 5000 },
      );
    } else {
      await fire();
    }
    setTimeout(() => setTriggered(false), 4000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Safety"
        title="Emergency SOS"
        description="One tap to alert your emergency contacts and reach public helplines."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative overflow-hidden rounded-3xl border bg-card p-8 text-center shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 50% 40%, rgba(239,68,68,0.18), transparent 60%)" }} />
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h3 className="mt-3 text-lg font-semibold">Trigger emergency alert</h3>
          <p className="mt-1 text-sm text-muted-foreground">Your location and profile will be shared with your emergency contact.</p>
          <button
            onClick={trigger}
            className={`relative mx-auto mt-8 grid h-48 w-48 place-items-center rounded-full text-white shadow-elevated transition ${triggered ? "animate-pulse" : "hover:scale-[1.02]"}`}
            style={{ background: "radial-gradient(circle at 30% 30%, #ef4444, #b91c1c)" }}
          >
            <div className="text-center">
              <Siren className="mx-auto h-10 w-10" />
              <div className="mt-2 text-xl font-bold tracking-widest">SOS</div>
              <div className="text-[11px] uppercase tracking-widest opacity-80">Tap to trigger</div>
            </div>
          </button>
          <div className="mt-6 flex items-start justify-center gap-2 rounded-xl bg-amber-50 p-3 text-left text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>Use responsibly. False alerts may impact service and could carry legal consequences.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Your emergency contact</h3>
            {profile?.emergencyName ? (
              <div className="mt-3 rounded-xl border p-4">
                <div className="text-sm font-semibold">{profile.emergencyName}</div>
                <div className="text-xs text-muted-foreground">
                  Contact · {profile.emergencyPhone}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No emergency contact set. Add one from your profile.
              </p>
            )}
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Public helplines</h3>
            <ul className="mt-3 space-y-2">
              {HOTLINES.map((h) => (
                <li key={h.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{h.label}</div>
                    <div className="truncate text-xs text-muted-foreground">Free national helpline</div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full">
                    <a href={`tel:${h.number}`}><Phone className="mr-1.5 h-3.5 w-3.5" />{h.number}</a>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}