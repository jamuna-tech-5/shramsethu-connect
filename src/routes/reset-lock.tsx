import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LockSecretFields } from "@/components/LockSecretFields";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { METHOD_LABEL, readLock, setupLock, validateSecret, type LockMethod } from "@/lib/app-lock";
import { consumeAppLockReset, verifyAppLockReset } from "@/lib/app-lock.functions";

const METHODS: LockMethod[] = ["password", "pin4", "pin6", "pattern"];

export const Route = createFileRoute("/reset-lock")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset App Lock — ShramSethu" },
      {
        name: "description",
        content:
          "Use your one-time SMS recovery link to set a new ShramSethu app lock password, PIN or pattern on this device.",
      },
      { property: "og:title", content: "Reset App Lock — ShramSethu" },
      {
        property: "og:description",
        content: "Set a new app lock credential for ShramSethu using your secure recovery link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetLockPage,
});

function ResetLockPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ok" | "invalid">("checking");
  const [error, setError] = useState<string | null>(null);
  const [masked, setMasked] = useState("");
  const [method, setMethod] = useState<LockMethod>("pin4");
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(t);
    const existing = readLock();
    if (existing) setMethod(existing.method);
    if (!t) {
      setState("invalid");
      setError("This recovery link is missing its token.");
      return;
    }
    verifyAppLockReset({ data: { token: t } })
      .then((res) => {
        if (res.ok) {
          setMasked(res.maskedPhone);
          setState("ok");
        } else {
          setError(res.error);
          setState("invalid");
        }
      })
      .catch(() => {
        setError("Could not validate this recovery link.");
        setState("invalid");
      });
  }, []);

  const save = async () => {
    const err = validateSecret(method, secret);
    if (err) return toast.error(err);
    if (secret !== confirm) return toast.error("The two entries do not match.");
    setBusy(true);
    try {
      const used = await consumeAppLockReset({ data: { token } });
      if (!used.ok) {
        toast.error(used.error);
        setState("invalid");
        setError(used.error);
        return;
      }
      const existing = readLock();
      await setupLock({ method, secret, phone: existing?.phone, biometric: false });
      toast.success("Your app lock credential was reset");
      navigate({ to: "/auth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset your app lock");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 text-xl font-bold tracking-tight">Reset App Lock</h1>
          {state === "ok" && (
            <p className="mt-1 text-sm text-muted-foreground">
              Verified for {masked}. Choose a new credential for this device.
            </p>
          )}
        </div>

        {state === "checking" && (
          <div className="mt-8 grid place-items-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {state === "invalid" && (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" className="rounded-xl" onClick={() => navigate({ to: "/auth" })}>
              Back to sign in
            </Button>
          </div>
        )}

        {state === "ok" && (
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Authentication method</Label>
              <Select
                value={method}
                onValueChange={(v) => {
                  setMethod(v as LockMethod);
                  setSecret("");
                  setConfirm("");
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{METHOD_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <LockSecretFields
              method={method}
              secret={secret}
              confirm={confirm}
              onSecret={setSecret}
              onConfirm={setConfirm}
            />
            <Button onClick={save} disabled={busy} className="w-full rounded-xl gradient-primary text-white">
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
              Save new credential
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
