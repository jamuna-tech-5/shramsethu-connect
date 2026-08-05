// Device-level App Lock.
//
// The lock screen runs BEFORE any Supabase session exists (it gates the
// Worker/Admin selection screen), so the credential is stored on the device —
// never in plain text. We keep a PBKDF2-SHA256 hash + random salt in
// localStorage and compare hashes on unlock.

export type LockMethod = "password" | "pin4" | "pin6" | "pattern";

export type LockConfig = {
  enabled: boolean;
  method: LockMethod;
  salt: string;
  hash: string;
  iterations: number;
  biometric: boolean;
  credentialId?: string;
  phone?: string;
  failures: number;
  lockedUntil?: number;
};

const KEY = "ss_applock";
const SESSION_KEY = "ss_applock_unlocked";
export const LOCK_EVENT = "shramsethu:applock";
const ITERATIONS = 150_000;
export const MAX_ATTEMPTS = 5;

export const METHOD_LABEL: Record<LockMethod, string> = {
  password: "Password",
  pin4: "4-digit PIN",
  pin6: "6-digit PIN",
  pattern: "Pattern lock",
};

function browser() {
  return typeof window !== "undefined";
}

function toB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function randomSalt(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return toB64(b.buffer);
}

export async function hashSecret(secret: string, salt: string, iterations = ITERATIONS): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" },
    key,
    256,
  );
  return toB64(bits);
}

export function readLock(): LockConfig | null {
  if (!browser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as LockConfig;
    if (!cfg || typeof cfg.hash !== "string" || !cfg.method) return null;
    return { failures: 0, iterations: ITERATIONS, biometric: false, ...cfg };
  } catch {
    return null;
  }
}

function write(cfg: LockConfig | null) {
  if (!browser()) return;
  if (cfg) window.localStorage.setItem(KEY, JSON.stringify(cfg));
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(LOCK_EVENT));
}

export function saveLock(cfg: LockConfig) {
  write(cfg);
}

export async function setupLock(opts: {
  method: LockMethod;
  secret: string;
  phone?: string;
  biometric?: boolean;
  credentialId?: string;
}) {
  const salt = randomSalt();
  const hash = await hashSecret(opts.secret, salt);
  write({
    enabled: true,
    method: opts.method,
    salt,
    hash,
    iterations: ITERATIONS,
    biometric: !!opts.biometric,
    credentialId: opts.credentialId,
    phone: opts.phone,
    failures: 0,
  });
  markUnlocked();
}

export function disableLock() {
  write(null);
  if (browser()) window.sessionStorage.removeItem(SESSION_KEY);
}

export function setEnabled(enabled: boolean) {
  const cfg = readLock();
  if (!cfg) return;
  write({ ...cfg, enabled });
  if (!enabled && browser()) window.sessionStorage.removeItem(SESSION_KEY);
}

export function setBiometric(on: boolean, credentialId?: string) {
  const cfg = readLock();
  if (!cfg) return;
  write({ ...cfg, biometric: on, credentialId: on ? (credentialId ?? cfg.credentialId) : undefined });
}

export function lockRemainingMs(cfg: LockConfig | null): number {
  if (!cfg?.lockedUntil) return 0;
  return Math.max(0, cfg.lockedUntil - Date.now());
}

export async function verifySecret(secret: string): Promise<{ ok: boolean; message?: string }> {
  const cfg = readLock();
  if (!cfg) return { ok: false, message: "App Lock is not configured." };
  const wait = lockRemainingMs(cfg);
  if (wait > 0) {
    return { ok: false, message: `Too many attempts. Try again in ${Math.ceil(wait / 1000)}s.` };
  }
  const hash = await hashSecret(secret, cfg.salt, cfg.iterations);
  if (hash === cfg.hash) {
    write({ ...cfg, failures: 0, lockedUntil: undefined });
    markUnlocked();
    return { ok: true };
  }
  const failures = (cfg.failures ?? 0) + 1;
  const over = failures - MAX_ATTEMPTS;
  const lockedUntil = over >= 0 ? Date.now() + Math.min(5, over + 1) * 30_000 : undefined;
  write({ ...cfg, failures, lockedUntil });
  return {
    ok: false,
    message: lockedUntil
      ? `Too many incorrect attempts. Locked for ${Math.round((lockedUntil - Date.now()) / 1000)}s.`
      : `Incorrect ${METHOD_LABEL[cfg.method].toLowerCase()}. ${MAX_ATTEMPTS - failures} attempt(s) left.`,
  };
}

export async function replaceSecret(method: LockMethod, secret: string) {
  const cfg = readLock();
  const salt = randomSalt();
  const hash = await hashSecret(secret, salt);
  write({
    biometric: cfg?.biometric ?? false,
    credentialId: cfg?.credentialId,
    phone: cfg?.phone,
    method,
    salt,
    hash,
    iterations: ITERATIONS,
    failures: 0,
    lockedUntil: undefined,
    enabled: true,
  });
  markUnlocked();
}

export function isUnlocked(): boolean {
  if (!browser()) return true;
  const cfg = readLock();
  if (!cfg?.enabled) return true;
  return window.sessionStorage.getItem(SESSION_KEY) === "1";
}

export function markUnlocked() {
  if (!browser()) return;
  window.sessionStorage.setItem(SESSION_KEY, "1");
  window.dispatchEvent(new CustomEvent(LOCK_EVENT));
}

export function relock() {
  if (!browser()) return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent(LOCK_EVENT));
}

/* ---------------- Biometric / platform authenticator (WebAuthn) ------------- */

export async function isBiometricSupported(): Promise<boolean> {
  if (!browser() || !window.PublicKeyCredential) return false;
  try {
    const fn = (window.PublicKeyCredential as unknown as {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
    }).isUserVerifyingPlatformAuthenticatorAvailable;
    return fn ? await fn.call(window.PublicKeyCredential) : false;
  } catch {
    return false;
  }
}

export async function registerBiometric(label: string): Promise<string | null> {
  if (!browser()) return null;
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "ShramSethu", id: window.location.hostname },
      user: { id: userId, name: label || "ShramSethu user", displayName: label || "ShramSethu user" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) return null;
  return toB64(cred.rawId);
}

export async function verifyBiometric(): Promise<boolean> {
  if (!browser()) return false;
  const cfg = readLock();
  if (!cfg?.biometric || !cfg.credentialId) return false;
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const raw = Uint8Array.from(atob(cfg.credentialId), (c) => c.charCodeAt(0));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: "public-key", id: raw }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  if (!assertion) return false;
  markUnlocked();
  return true;
}

export function validateSecret(method: LockMethod, secret: string): string | null {
  if (method === "password") {
    if (secret.length < 6) return "Password must be at least 6 characters.";
    return null;
  }
  if (method === "pin4") return /^\d{4}$/.test(secret) ? null : "PIN must be exactly 4 digits.";
  if (method === "pin6") return /^\d{6}$/.test(secret) ? null : "PIN must be exactly 6 digits.";
  const dots = secret.split("-").filter(Boolean);
  if (dots.length < 4) return "Connect at least 4 dots.";
  return null;
}
