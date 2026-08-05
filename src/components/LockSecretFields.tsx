import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PatternLock } from "@/components/PatternLock";
import type { LockMethod } from "@/lib/app-lock";

type Props = {
  method: LockMethod;
  secret: string;
  confirm: string;
  onSecret: (v: string) => void;
  onConfirm: (v: string) => void;
};

/** Enter + confirm fields for a password / PIN / pattern credential. */
export function LockSecretFields({ method, secret, confirm, onSecret, onConfirm }: Props) {
  if (method === "pattern") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Draw pattern</Label>
          <PatternLock value={secret} onChange={onSecret} size={190} />
        </div>
        <div className="space-y-1.5">
          <Label>Confirm pattern</Label>
          <PatternLock value={confirm} onChange={onConfirm} size={190} />
        </div>
      </div>
    );
  }

  const isPin = method !== "password";
  const len = method === "pin4" ? 4 : 6;
  const label = method === "password" ? "Password" : `${len}-digit PIN`;
  const clean = (v: string) => (isPin ? v.replace(/\D/g, "").slice(0, len) : v);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Enter {label}</Label>
        <Input
          type="password"
          inputMode={isPin ? "numeric" : "text"}
          value={secret}
          onChange={(e) => onSecret(clean(e.target.value))}
          placeholder={isPin ? "•".repeat(len) : "At least 6 characters"}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Confirm {label}</Label>
        <Input
          type="password"
          inputMode={isPin ? "numeric" : "text"}
          value={confirm}
          onChange={(e) => onConfirm(clean(e.target.value))}
          placeholder={`Re-enter ${label.toLowerCase()}`}
          autoComplete="new-password"
        />
      </div>
    </div>
  );
}
