import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, MessageSquare, Phone, Pencil, Plus, Share2, ShieldAlert, Siren, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { getCurrentCoords } from "@/lib/geolocation";
import {
  deleteEmergencyContact,
  listEmergencyContacts,
  saveEmergencyContact,
  triggerSOS,
} from "@/lib/api.functions";

export const Route = createFileRoute("/app/sos")({
  component: SosPage,
});

const HOTLINES = [
  { label: "Police", number: "100" },
  { label: "Ambulance", number: "108" },
  { label: "Fire Department", number: "101" },
  { label: "Women Helpline", number: "1091" },
];

type Contact = { id: string; name: string; phone: string; relation: string | null; is_primary: boolean };

function SosPage() {
  const { profile } = useStore();
  const qc = useQueryClient();
  const [triggered, setTriggered] = useState(false);
  const [alert, setAlert] = useState<{ message: string; mapsUrl: string } | null>(null);
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);

  const { data: contacts = [] } = useQuery({
    queryKey: ["emergency-contacts"],
    queryFn: () => listEmergencyContacts() as Promise<Contact[]>,
  });

  const save = useMutation({
    mutationFn: (c: Partial<Contact>) =>
      saveEmergencyContact({
        data: {
          id: c.id,
          name: c.name ?? "",
          phone: c.phone ?? "",
          relation: c.relation ?? undefined,
          is_primary: !!c.is_primary,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergency-contacts"] });
      setEditing(null);
      toast.success("Emergency contact saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEmergencyContact({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergency-contacts"] });
      toast.success("Contact removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const trigger = async () => {
    setTriggered(true);
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const c = await getCurrentCoords();
      lat = c.lat;
      lng = c.lng;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get your location");
    }
    const mapsUrl = lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : "";
    const when = new Date().toLocaleString();
    const message = [
      `EMERGENCY SOS from ${profile?.fullName || "a ShramSethu user"}`,
      "I need immediate help.",
      `Time: ${when}`,
      mapsUrl ? `Live location: ${mapsUrl}` : "Live location: unavailable",
    ].join("\n");

    triggerSOS({ data: { lat, lng, message } }).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Failed to record SOS"),
    );
    setAlert({ message, mapsUrl });
    setTimeout(() => setTriggered(false), 4000);
  };

  const sendSms = () => {
    if (!alert) return;
    const numbers = contacts.map((c) => c.phone.replace(/[^+0-9]/g, "")).filter(Boolean);
    if (numbers.length === 0) {
      toast.error("Add at least one emergency contact first");
      return;
    }
    const sep = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? "&" : "?";
    window.location.href = `sms:${numbers.join(",")}${sep}body=${encodeURIComponent(alert.message)}`;
  };

  const shareAlert = async () => {
    if (!alert) return;
    const payload: ShareData = { title: "Emergency SOS · ShramSethu", text: alert.message };
    if (alert.mapsUrl) payload.url = alert.mapsUrl;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
    try {
      if (nav.share && (!nav.canShare || nav.canShare(payload))) {
        await nav.share(payload);
        return;
      }
      await navigator.clipboard.writeText(alert.message);
      toast.success("Emergency message copied — paste it in any app to share");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "Could not share");
    }
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Your emergency contacts</h3>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditing({})}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {contacts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No emergency contacts yet. Add one so SOS can notify them instantly.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {contacts.map((c) => (
                  <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {c.name}
                        {c.is_primary ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Primary</span> : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.relation ? `${c.relation} · ` : ""}{c.phone}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button asChild size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                        <a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`}><Phone className="h-3.5 w-3.5" /></a>
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setEditing(c)} aria-label="Edit contact">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive" onClick={() => remove.mutate(c.id)} aria-label="Delete contact">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
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

      <Dialog open={!!alert} onOpenChange={(o) => !o && setAlert(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Send emergency alert</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Review the message below, then send it via SMS or share it through any app.
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/40 p-3 text-xs">{alert?.message}</pre>
          <p className="text-xs text-muted-foreground">
            {contacts.length > 0
              ? `Will be addressed to ${contacts.length} saved contact${contacts.length > 1 ? "s" : ""}.`
              : "No saved contacts yet — add one to auto-fill numbers."}
          </p>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" className="rounded-full" onClick={shareAlert}>
              <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share via
            </Button>
            <Button className="rounded-full gradient-primary text-white" onClick={sendSms}>
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Send SOS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit contact" : "Add emergency contact"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input className="mt-1" value={editing?.name ?? ""} onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Phone number</Label>
              <Input className="mt-1" inputMode="tel" value={editing?.phone ?? ""} onChange={(e) => setEditing((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Relation (optional)</Label>
              <Input className="mt-1" value={editing?.relation ?? ""} onChange={(e) => setEditing((p) => ({ ...p, relation: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!editing?.is_primary} onChange={(e) => setEditing((p) => ({ ...p, is_primary: e.target.checked }))} />
              Primary contact
            </label>
          </div>
          <DialogFooter>
            <Button className="rounded-full" disabled={save.isPending} onClick={() => editing && save.mutate(editing)}>
              {save.isPending ? "Saving…" : "Save contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}