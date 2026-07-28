import { createFileRoute } from "@tanstack/react-router";
import { Locate, Navigation, Send, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InteractiveMap } from "@/components/InteractiveMap";
import { getCurrentCoords } from "@/lib/geolocation";
import { useStore } from "@/lib/store";
import {
  listMyShares, recordLocation, searchWorkers, startLocationShare,
  stopLocationShare, updateLiveShare,
} from "@/lib/api.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  const qc = useQueryClient();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shares = useQuery({ queryKey: ["shares"], queryFn: () => listMyShares() });

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

  // Live tracking: while any live share is active, push updates every 20s.
  useEffect(() => {
    const hasLive = (shares.data?.outgoing ?? []).some((s) => s.active && s.mode === "live");
    if (!hasLive || !("geolocation" in navigator)) return;
    const id = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (p) => { updateLiveShare({ data: { lat: p.coords.latitude, lng: p.coords.longitude } }).catch(() => {}); },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }, 20000);
    return () => clearInterval(id);
  }, [shares.data]);

  const markers = coords ? [{ position: coords, title: "You", color: "#4F46E5" }] : [];
  const outgoing = shares.data?.outgoing ?? [];
  const incoming = shares.data?.incoming ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field"
        title="Live Location"
        description="Share your status and location while on duty. Location is shared only with your consent."
        actions={<ShareLocationDialog coords={coords} onShared={() => qc.invalidateQueries({ queryKey: ["shares"] })} />}
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
            <div className="flex items-center gap-2"><Send className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Active shares</h3></div>
            {outgoing.filter((s) => s.active).length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">You're not sharing with anyone right now.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {outgoing.filter((s) => s.active).map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                    <span className="capitalize">{s.mode} share</span>
                    <Button variant="ghost" size="sm" className="h-6 rounded-full px-2 text-destructive"
                      onClick={async () => { await stopLocationShare({ data: { id: s.id } }); qc.invalidateQueries({ queryKey: ["shares"] }); toast.success("Sharing stopped"); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Shared with you</h3></div>
            {incoming.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Nobody is sharing their location with you.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {incoming.map((s) => (
                  <li key={s.id} className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                    <div className="font-medium capitalize">{s.mode} · active</div>
                    {s.latest_lat != null && s.latest_lng != null && (
                      <div className="text-muted-foreground">{Number(s.latest_lat).toFixed(4)}, {Number(s.latest_lng).toFixed(4)}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
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

type Worker = { id: string; full_name: string | null; photo_url: string | null; category: string | null };

function ShareLocationDialog({ coords, onShared }: { coords: { lat: number; lng: number } | null; onShared: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Worker[]>([]);
  const [mode, setMode] = useState<"current" | "live">("current");
  const [message, setMessage] = useState("");
  const results = useQuery({
    queryKey: ["worker-search", q], enabled: q.trim().length >= 2,
    queryFn: () => searchWorkers({ data: { q } }) as Promise<Worker[]>,
  });
  const m = useMutation({
    mutationFn: async () => {
      if (!coords) throw new Error("Get your location first");
      return startLocationShare({ data: { recipientIds: selected.map((s) => s.id), mode, lat: coords.lat, lng: coords.lng, message: message || undefined } });
    },
    onSuccess: () => { toast.success("Location shared"); setOpen(false); setSelected([]); setQ(""); setMessage(""); onShared(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = (w: Worker) => setSelected((s) => s.find((x) => x.id === w.id) ? s.filter((x) => x.id !== w.id) : [...s, w]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full gradient-primary text-white"><Send className="mr-1.5 h-3.5 w-3.5" /> Share location</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Share location with someone</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Find worker</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone" />
          </div>
          <div className="max-h-40 overflow-auto rounded-lg border">
            {q.trim().length < 2 ? <p className="p-3 text-xs text-muted-foreground">Type at least 2 characters.</p>
              : (results.data ?? []).length === 0 ? <p className="p-3 text-xs text-muted-foreground">No matches.</p>
              : (results.data ?? []).map((w) => {
                const on = !!selected.find((x) => x.id === w.id);
                return (
                  <button type="button" key={w.id} onClick={() => toggle(w)}
                    className={`flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted ${on ? "bg-primary/5" : ""}`}>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs font-semibold">{(w.full_name ?? "?").slice(0, 1).toUpperCase()}</span>
                    <span className="flex-1 truncate">{w.full_name ?? "Unnamed"}</span>
                    {w.category && <span className="text-xs text-muted-foreground">{w.category}</span>}
                    {on && <span className="text-xs font-medium text-primary">Selected</span>}
                  </button>
                );
              })}
          </div>
          {selected.length > 0 && <div className="text-xs text-muted-foreground">{selected.length} selected</div>}
          <div>
            <Label>Mode</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["current", "live"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setMode(k)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize ${mode === k ? "border-primary bg-primary/5 text-primary" : ""}`}>
                  {k === "current" ? "One-time" : "Live tracking"}
                </button>
              ))}
            </div>
          </div>
          <div><Label>Message (optional)</Label><Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="On my way…" /></div>
          {!coords && <p className="text-xs text-destructive">Tap "Get my location" first.</p>}
          <Button disabled={!coords || selected.length === 0 || m.isPending} onClick={() => m.mutate()} className="w-full rounded-full gradient-primary text-white">
            {m.isPending ? "Sharing…" : `Share with ${selected.length || 0}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}