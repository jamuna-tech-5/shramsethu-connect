// Per-user App Lock.
//
// Each account has its OWN app lock row in the database
// (public.user_app_locks, RLS-scoped to auth.uid()), so one user's
// password / PIN / pattern can never unlock another user's account.
// The credential itself is never stored: we keep a PBKDF2-SHA256 hash and a
// random salt, computed in the browser, and compare hashes on unlock.
// Attempt throttling and the "unlocked for this session" flag are device-local
// and namespaced by user id.

import { supabase } from "@/integrations/supabase/client";

export type LockMethod = "password" | "pin4" | "pin6" | "pattern";

export type LockConfig = {
  userId: string;
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

function sessionKey(userId: string) {
  return `ss_applock_unlocked:${userId}`;
}
function attemptsKey(userId: string) {
  return `ss_applock_attempts:${userId}`;
}

function emit() {
  if (browser()) window.dispatchEvent(new CustomEvent(LOCK_EVENT));
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

/* ------------------------------- attempts --------------------------------- */

type Attempts = { failures: number; lockedUntil?: number };

function readAttempts(userId: string): Attempts {
  if (!browser()) return { failures: 0 };
  try {
    const raw = window.localStorage.getItem(attemptsKey(userId));
    if (!raw) return { failures: 0 };
    const v = JSON.parse(raw) as Attempts;
    return { failures: v.failures ?? 0, lockedUntil: v.lockedUntil };
  } catch {
    return { failures: 0 };
  }
}

function writeAttempts(userId: string, v: Attempts) {
  if (!browser()) return;
  if (v.failures === 0 && !v.lockedUntil) window.localStorage.removeItem(attemptsKey(userId));
  else window.localStorage.setItem(attemptsKey(userId), JSON.stringify(v));
}

/* --------------------------------- load ----------------------------------- */

type Row = {
  user_id: string;
  enabled: boolean;
  method: string;
  salt: string | null;
  secret_hash: string | null;
  iterations: number;
  biometric_enabled: boolean;
  credential_id: string | null;
};

function toConfig(row: Row, phone?: string): LockConfig | null {
  if (!row.salt || !row.secret_hash) return null;
  const attempts = readAttempts(row.user_id);
  return {
    userId: row.user_id,
    enabled: row.enabled,
    method: (row.method as LockMethod) ?? "pin4",
    salt: row.salt,
    hash: row.secret_hash,
    iterations: row.iterations ?? ITERATIONS,
    biometric: row.biometric_enabled,
    credentialId: row.credential_id ?? undefined,
    phone,
    failures: attempts.failures,
    lockedUntil: attempts.lockedUntil,
  };
}

/** Loads the app lock config for one specific user. Never cross-user. */
export async function loadLock(userId: string, phone?: string): Promise<LockConfig | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("user_app_locks")
    .select("user_id, enabled, method, salt, secret_hash, iterations, biometric_enabled, credential_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return toConfig(data as Row, phone);
}

async function upsert(userId: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("user_app_locks")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  emit();
}

/* --------------------------------- writes --------------------------------- */

export async function setupLock(opts: {
  userId: string;
  method: LockMethod;
  secret: string;
  biometric?: boolean;
  credentialId?: string;
}) {
  const salt = randomSalt();
  const hash = await hashSecret(opts.secret, salt);
  await upsert(opts.userId, {
    enabled: true,
    method: opts.method,
    salt,
    secret_hash: hash,
    iterations: ITERATIONS,
    biometric_enabled: !!opts.biometric,
    credential_id: opts.credentialId ?? null,
  });
  writeAttempts(opts.userId, { failures: 0 });
  markUnlocked(opts.userId);
}

export async function replaceSecret(userId: string, method: LockMethod, secret: string) {
  const salt = randomSalt();
  const hash = await hashSecret(secret, salt);
  await upsert(userId, { enabled: true, method, salt, secret_hash: hash, iterations: ITERATIONS });
  writeAttempts(userId, { failures: 0 });
  markUnlocked(userId);
}

export async function setEnabled(userId: string, enabled: boolean) {
  await upsert(userId, { enabled });
  if (!enabled && browser()) window.sessionStorage.removeItem(sessionKey(userId));
  emit();
}

export async function disableLock(userId: string) {
  const { error } = await supabase.from("user_app_locks").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (browser()) {
    window.sessionStorage.removeItem(sessionKey(userId));
    window.localStorage.removeItem(attemptsKey(userId));
  }
  emit();
}

export async function setBiometric(userId: string, on: boolean, credentialId?: string) {
  await upsert(userId, {
    biometric_enabled: on,
    credential_id: on ? (credentialId ?? null) : null,
  });
}

/* -------------------------------- verify ---------------------------------- */

export function lockRemainingMs(cfg: LockConfig | null): number {
  if (!cfg?.lockedUntil) return 0;
  return Math.max(0, cfg.lockedUntil - Date.now());
}

export async function verifySecret(
  cfg: LockConfig | null,
  secret: string,
): Promise<{ ok: boolean; message?: string; failures?: number; lockedUntil?: number }> {
  if (!cfg) return { ok: false, message: "App Lock is not configured." };
  const wait = lockRemainingMs(cfg);
  if (wait > 0) {
    return { ok: false, message: `Too many attempts. Try again in ${Math.ceil(wait / 1000)}s.` };
  }
  const hash = await hashSecret(secret, cfg.salt, cfg.iterations);
  if (hash === cfg.hash) {
    writeAttempts(cfg.userId, { failures: 0 });
    markUnlocked(cfg.userId);
    return { ok: true, failures: 0 };
  }
  const failures = (cfg.failures ?? 0) + 1;
  const over = failures - MAX_ATTEMPTS;
  const lockedUntil = over >= 0 ? Date.now() + Math.min(5, over + 1) * 30_000 : undefined;
  writeAttempts(cfg.userId, { failures, lockedUntil });
  return {
    ok: false,
    failures,
    lockedUntil,
    message: lockedUntil
      ? `Too many incorrect attempts. Locked for ${Math.round((lockedUntil - Date.now()) / 1000)}s.`
      : `Incorrect ${METHOD_LABEL[cfg.method].toLowerCase()}. ${MAX_ATTEMPTS - failures} attempt(s) left.`,
  };
}

/* ------------------------------ session state ----------------------------- */

export function isUnlocked(userId: string): boolean {
  if (!browser() || !userId) return true;
  return window.sessionStorage.getItem(sessionKey(userId)) === "1";
}

export function markUnlocked(userId: string) {
  if (!browser() || !userId) return;
  window.sessionStorage.setItem(sessionKey(userId), "1");
  emit();
}

/** Clears only this user's unlock session (used on sign-out). */
export function relock(userId: string) {
  if (!browser() || !userId) return;
  window.sessionStorage.removeItem(sessionKey(userId));
  emit();
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

export async function verifyBiometric(cfg: LockConfig | null): Promise<boolean> {
  if (!browser() || !cfg?.biometric || !cfg.credentialId) return false;
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
  markUnlocked(cfg.userId);
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
