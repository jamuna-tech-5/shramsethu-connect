// Runtime environment resolution that works on every host we deploy to.
//
// Why this exists: `process.env` is NOT the same object on every runtime.
//   - Node / Vercel Serverless (Nitro "vercel" preset)  -> process.env works
//   - Cloudflare Workers (Nitro "cloudflare" preset)    -> env is injected per
//     request; the unenv `process.env` shim can be EMPTY, so a var that is
//     correctly configured on the host still reads as `undefined`.
//   - Nitro also mirrors build/runtime env onto `globalThis.__env__`.
// Reading only `process.env` therefore makes a correctly-set key look missing.
// This helper checks every source before deciding a variable is absent.

type EnvBag = Record<string, string | undefined>;

function bags(): EnvBag[] {
  const out: EnvBag[] = [];
  const g = globalThis as unknown as {
    process?: { env?: EnvBag };
    __env__?: EnvBag;
    Deno?: { env?: { toObject?: () => EnvBag } };
  };
  if (typeof process !== "undefined" && process.env) out.push(process.env as EnvBag);
  if (g.process?.env && g.process.env !== (typeof process !== "undefined" ? process.env : undefined)) {
    out.push(g.process.env);
  }
  if (g.__env__) out.push(g.__env__);
  try {
    if (g.Deno?.env?.toObject) out.push(g.Deno.env.toObject());
  } catch {
    /* ignore */
  }
  try {
    const meta = (import.meta as unknown as { env?: EnvBag }).env;
    if (meta) out.push(meta);
  } catch {
    /* ignore */
  }
  return out;
}

/** First non-empty value for `name` across every available env source. */
export function serverEnv(name: string): string | undefined {
  for (const bag of bags()) {
    const v = bag?.[name];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/** First non-empty value among several candidate names. */
export function serverEnvAny(...names: string[]): string | undefined {
  for (const n of names) {
    const v = serverEnv(n);
    if (v) return v;
  }
  return undefined;
}

/** Non-secret presence report — never returns values. */
export function envPresence(names: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const n of names) out[n] = !!serverEnv(n);
  return out;
}
