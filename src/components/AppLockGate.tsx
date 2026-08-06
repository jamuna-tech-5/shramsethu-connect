import { motion } from "framer-motion";
import { Fingerprint, Loader2, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { PatternLock } from "@/components/PatternLock";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LOCK_EVENT,
  METHOD_LABEL,
  isUnlocked,
  loadLock,
  lockRemainingMs,
  verifyBiometric,
  verifySecret,
  type LockConfig,
} from "@/lib/app-lock";
import { requestAppLockReset } from "@/lib/app-lock.functions";
import { useStore } from "@/lib/store";

/**
 * Gates the app behind the signed-in user's OWN App Lock screen.
 * Nothing is shown before sign-in, and one account's lock never applies to
 * another: the config is loaded from that user's database row.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { session, loading, profile } = useStore();
  const userId = session?.user?.id ?? "";
  const [cfg, setCfg] = useState<LockConfig | null>(null);
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(true);

  const sync = useCallback(async () => {
    if (!userId) {
      setCfg(null);
      setUnlocked(true);
      setChecked(true);
      return;
    }
    const next = await loadLock(userId, profile?.phone);
    setCfg(next);
    setUnlocked(isUnlocked(userId));
    setChecked(true);
  }, [userId, profile?.phone]);

  // The recovery page must stay reachable while the app is locked.
  const isRecoveryRoute =
    typeof window !== "undefined" && window.location.pathname.startsWith("/reset-lock");

  useEffect(() => {
    setChecked(false);
    void sync();
    const onEvt = () => void sync();
    window.addEventListener(LOCK_EVENT, onEvt);
    window.addEventListener("storage", onEvt);
    return () => {
      window.removeEventListener(LOCK_EVENT, onEvt);
      window.removeEventListener("storage", onEvt);
    };
  }, [sync]);

  // Not signed in → normal Login / Worker / Admin flow.
  if (loading || !userId || isRecoveryRoute) return <>{children}</>;

  if (!checked) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const locked = !!cfg?.enabled && !unlocked;
  if (!locked) return <>{children}</>;
  return <LockScreen cfg={cfg!} onUnlocked={() => void sync()} />;
}

function LockScreen({ cfg, onUnlocked }: { cfg: LockConfig; onUnlocked: () => void }) {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(lockRemainingMs(cfg));
  const [forgotOpen, setForgotOpen] = useState(false);
  const isPin = cfg.method === "pin4" || cfg.method === "pin6";
  const pinLen = cfg.method === "pin4" ? 4 : 6;

  useEffect(() => {
    if (wait <= 0) return;
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1000)), 1000);
    return () => clearInterval(t);
  }, [wait]);

  const unlock = async (value: string) => {
    if (!value) {
      setError(`Enter your ${METHOD_LABEL[cfg.method].toLowerCase()}.`);
      return;
    }
    setBusy(true);
    const res = await verifySecret(cfg, value);
    setBusy(false);
    if (res.ok) {
      setError(null);
      onUnlocked();
      return;
    }
    setSecret("");
    setError(res.message ?? "Incorrect credentials.");
    setWait(res.lockedUntil ? Math.max(0, res.lockedUntil - Date.now()) : 0);
    cfg.failures = res.failures ?? cfg.failures;
    cfg.lockedUntil = res.lockedUntil;
  };

  const biometric = async () => {
    try {
      const ok = await verifyBiometric(cfg);
      if (ok) onUnlocked();
      else setError("Biometric unlock failed. Use your " + METHOD_LABEL[cfg.method].toLowerCase() + ".");
    } catch {
      setError("Biometric unlock failed. Use your " + METHOD_LABEL[cfg.method].toLowerCase() + ".");
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 text-xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ShramSethu is locked. Enter your {METHOD_LABEL[cfg.method].toLowerCase()} to continue.
          </p>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            unlock(secret);
          }}
        >
          {cfg.method === "pattern" ? (
            <div className="flex justify-center">
              <PatternLock value={secret} onChange={setSecret} size={210} disabled={wait > 0} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="lockSecret">{METHOD_LABEL[cfg.method]}</Label>
              <Input
                id="lockSecret"
                type="password"
                autoFocus
                inputMode={isPin ? "numeric" : "text"}
                disabled={wait > 0}
                value={secret}
                onChange={(e) => setSecret(isPin ? e.target.value.replace(/\D/g, "").slice(0, pinLen) : e.target.value)}
                placeholder={isPin ? "•".repeat(pinLen) : "Enter your password"}
                autoComplete="off"
              />
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {wait > 0 && (
            <p className="text-xs text-warning">
              Authentication temporarily locked. Try again in {Math.ceil(wait / 1000)}s.
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={busy || wait > 0}
            className="w-full rounded-xl gradient-primary text-white shadow-soft"
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-1.5 h-4 w-4" />}
            Unlock
          </Button>

          {cfg.biometric && cfg.credentialId && (
            <Button type="button" variant="outline" size="lg" className="w-full rounded-xl" onClick={biometric}>
              <Fingerprint className="mr-1.5 h-4 w-4" /> Unlock with fingerprint / Face ID
            </Button>
          )}

          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Forgot {METHOD_LABEL[cfg.method].toLowerCase()}?
          </button>
        </form>
      </motion.div>

      <ForgotDialog open={forgotOpen} onOpenChange={setForgotOpen} maskedPhone={cfg.phone} method={cfg.method} />
    </div>
  );
}

export function ForgotDialog({
  open,
  onOpenChange,
  maskedPhone,
  method,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  maskedPhone?: string;
  method: LockConfig["method"];
}) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLink(null);
      setMsg(null);
    }
  }, [open]);

  const send = async () => {
    setBusy(true);
    try {
      const res = await requestAppLockReset({ data: { origin: window.location.origin } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.sent) {
        setMsg(`Recovery link sent by SMS to ${res.maskedPhone}. It expires in 15 minutes and works once.`);
        toast.success("Recovery SMS sent");
      } else {
        setLink(res.link ?? null);
        setMsg("No SMS provider is connected yet, so your one-time recovery link is shown below.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start recovery");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forgot {METHOD_LABEL[method].toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We'll send a secure, single-use recovery link to the mobile number registered on your ShramSethu profile
            {maskedPhone ? ` (${maskedPhone})` : ""}. The link resets only your own app lock.
          </p>
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
          {link && (
            <div className="rounded-xl border bg-muted/40 p-3">
              <a href={link} className="break-all text-xs font-medium text-primary underline">
                {link}
              </a>
            </div>
          )}
          <Button onClick={send} disabled={busy} className="w-full rounded-xl gradient-primary text-white">
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Send recovery link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
