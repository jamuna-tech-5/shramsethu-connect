import { Fingerprint, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ForgotDialog } from "@/components/AppLockGate";
import { LockSecretFields } from "@/components/LockSecretFields";
import { PatternLock } from "@/components/PatternLock";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  LOCK_EVENT,
  METHOD_LABEL,
  disableLock,
  isBiometricSupported,
  loadLock,
  registerBiometric,
  replaceSecret,
  setBiometric,
  setEnabled,
  setupLock,
  validateSecret,
  verifySecret,
  type LockConfig,
  type LockMethod,
} from "@/lib/app-lock";
import { useStore } from "@/lib/store";

const METHODS: LockMethod[] = ["password", "pin4", "pin6", "pattern"];

/** App Security settings for the currently signed-in user only. */
export function AppSecuritySection({ phone, fullName }: { phone?: string; fullName?: string }) {
  const { session } = useStore();
  const userId = session?.user?.id ?? "";
  const [cfg, setCfg] = useState<LockConfig | null>(null);
  const [bioSupported, setBioSupported] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const sync = useCallback(async () => {
    if (!userId) return setCfg(null);
    setCfg(await loadLock(userId, phone));
  }, [userId, phone]);

  useEffect(() => {
    void sync();
    isBiometricSupported().then(setBioSupported);
    const onEvt = () => void sync();
    window.addEventListener(LOCK_EVENT, onEvt);
    return () => window.removeEventListener(LOCK_EVENT, onEvt);
  }, [sync]);

  const enabled = !!cfg?.enabled;

  const toggle = async (v: boolean) => {
    if (v && !cfg) {
      setSetupOpen(true);
      return;
    }
    if (!userId) return;
    try {
      await setEnabled(userId, v);
      toast.success(v ? "App Lock enabled" : "App Lock disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update App Lock");
    }
  };

  const toggleBiometric = async (v: boolean) => {
    if (!cfg || !userId) return;
    try {
      if (!v) {
        await setBiometric(userId, false);
        toast.success("Biometric unlock disabled");
        return;
      }
      const id = await registerBiometric(fullName || "ShramSethu user");
      if (!id) {
        toast.error("Biometric enrolment was cancelled.");
        return;
      }
      await setBiometric(userId, true, id);
      toast.success("Fingerprint / Face ID enabled");
    } catch {
      toast.error("This device declined biometric enrolment.");
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-soft text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">App Security</h3>
          <p className="text-xs text-muted-foreground">
            Your own App Lock — a password, PIN, pattern or biometrics that protects only your account.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border p-3">
        <div>
          <div className="text-sm">App Lock</div>
          <div className="text-xs text-muted-foreground">
            {enabled ? `Active · ${METHOD_LABEL[cfg!.method]}` : "Off — the app opens without authentication"}
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={(v) => void toggle(v)} />
      </div>

      {cfg && (
        <>
          <div className="mt-3 flex items-center justify-between rounded-xl border p-3">
            <div>
              <div className="text-sm">Fingerprint / Face ID</div>
              <div className="text-xs text-muted-foreground">
                {bioSupported
                  ? "Unlock with your device biometrics; falls back to your " + METHOD_LABEL[cfg.method].toLowerCase()
                  : "Not supported on this device"}
              </div>
            </div>
            <Switch
              checked={!!cfg.biometric}
              onCheckedChange={(v) => void toggleBiometric(v)}
              disabled={!bioSupported}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setChangeOpen(true)}>
              <KeyRound className="mr-1.5 h-4 w-4" /> Change {METHOD_LABEL[cfg.method].toLowerCase()}
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => setSetupOpen(true)}>
              <Fingerprint className="mr-1.5 h-4 w-4" /> Change authentication method
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => setForgotOpen(true)}>
              Forgot {METHOD_LABEL[cfg.method].toLowerCase()}?
            </Button>
            <Button
              variant="ghost"
              className="rounded-full text-destructive hover:text-destructive"
              onClick={async () => {
                if (!confirm("Remove your App Lock?")) return;
                try {
                  await disableLock(userId);
                  toast.success("App Lock removed");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not remove App Lock");
                }
              }}
            >
              Remove App Lock
            </Button>
          </div>
        </>
      )}

      <SetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        userId={userId}
        existing={cfg}
        onDone={() => toast.success("App Lock is active")}
      />
      <ChangeDialog open={changeOpen} onOpenChange={setChangeOpen} cfg={cfg} />
      <ForgotDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        maskedPhone={cfg?.phone || phone}
        method={cfg?.method ?? "password"}
      />
    </div>
  );
}

function SetupDialog({
  open,
  onOpenChange,
  userId,
  existing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  existing: LockConfig | null;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<LockMethod>(existing?.method ?? "pin4");
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMethod(existing?.method ?? "pin4");
      setSecret("");
      setConfirm("");
    }
  }, [open, existing]);

  const save = async () => {
    if (!userId) return toast.error("Sign in again to change App Security.");
    const err = validateSecret(method, secret);
    if (err) return toast.error(err);
    if (secret !== confirm) return toast.error("The two entries do not match.");
    setBusy(true);
    try {
      await setupLock({
        userId,
        method,
        secret,
        biometric: existing?.biometric,
        credentialId: existing?.credentialId,
      });
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save App Lock");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Change authentication method" : "Set up App Lock"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Authentication method</Label>
            <Select value={method} onValueChange={(v) => { setMethod(v as LockMethod); setSecret(""); setConfirm(""); }}>
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
          <p className="text-[11px] text-muted-foreground">
            Saved to your account as a salted PBKDF2-SHA256 hash — never in plain text, and never shared with other
            users. Recovery uses the mobile number on your profile.
          </p>
          <Button onClick={save} disabled={busy} className="w-full rounded-xl gradient-primary text-white">
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Save and enable App Lock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChangeDialog({
  open,
  onOpenChange,
  cfg,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cfg: LockConfig | null;
}) {
  const [current, setCurrent] = useState("");
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrent("");
      setSecret("");
      setConfirm("");
    }
  }, [open]);

  if (!cfg) return null;
  const label = METHOD_LABEL[cfg.method].toLowerCase();

  const save = async () => {
    setBusy(true);
    try {
      const check = await verifySecret(cfg, current);
      if (!check.ok) return toast.error(check.message ?? `Current ${label} is incorrect.`);
      const err = validateSecret(cfg.method, secret);
      if (err) return toast.error(err);
      if (secret !== confirm) return toast.error("The two entries do not match.");
      await replaceSecret(cfg.userId, cfg.method, secret);
      onOpenChange(false);
      toast.success(`Your ${label} was updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update your credential");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current {label}</Label>
            <LockSecretFieldsCurrent method={cfg.method} value={current} onChange={setCurrent} />
          </div>
          <LockSecretFields
            method={cfg.method}
            secret={secret}
            confirm={confirm}
            onSecret={setSecret}
            onConfirm={setConfirm}
          />
          <Button onClick={save} disabled={busy} className="w-full rounded-xl gradient-primary text-white">
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Update {label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LockSecretFieldsCurrent({
  method,
  value,
  onChange,
}: {
  method: LockMethod;
  value: string;
  onChange: (v: string) => void;
}) {
  if (method === "pattern") return <PatternLock value={value} onChange={onChange} size={180} />;
  const isPin = method !== "password";
  const len = method === "pin4" ? 4 : 6;
  return (
    <input
      type="password"
      inputMode={isPin ? "numeric" : "text"}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={value}
      onChange={(e) => onChange(isPin ? e.target.value.replace(/\D/g, "").slice(0, len) : e.target.value)}
      placeholder={isPin ? "•".repeat(len) : "Enter your current password"}
      autoComplete="off"
    />
  );
}
