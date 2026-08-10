import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";

import { serverEnv } from "./env.server";

// Built per request: env vars are only reliably injected at call time on
// serverless hosts (Vercel/Cloudflare), not at module evaluation.
function getSessionConfig() {
  const secret = serverEnv("SESSION_SECRET");
  if ((!secret || secret.length < 32) && serverEnv("NODE_ENV") === "production") {
    console.warn("[admin] SESSION_SECRET missing/too short (<32 chars) — admin sessions will not persist reliably.");
  }
  return {
    password: secret && secret.length >= 32 ? secret : "shramsethu-dev-fallback-session-secret-000000",
    name: "shramsethu-admin",
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true,
      // http://localhost during local dev cannot store a Secure cookie.
      secure: serverEnv("NODE_ENV") === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

type AdminSession = { unlocked?: boolean; unlockedAt?: number; code?: string };

// Runtime-agnostic constant-time comparison (Web Crypto works on Node, Vercel and Workers).
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function requireAdminSession() {
  const session = await useSession<AdminSession>(getSessionConfig());
  if (!session.data.unlocked) {
    console.warn("[admin] request without unlocked session");
    throw new Error("Admin access required");
  }
  return session;
}

/** The validated admin code for this session (used to authorize backend RPCs). */
async function adminCode() {
  const session = await requireAdminSession();
  const code = session.data.code || serverEnv("ADMIN_SECRET_CODE");
  if (!code) throw new Error("Admin access is not configured on this deployment.");
  return code;
}

export const adminUnlock = createServerFn({ method: "POST" })
  .inputValidator((v: { code: string }) => v)
  .handler(async ({ data }) => {
    const expected = serverEnv("ADMIN_SECRET_CODE");
    if (!expected) {
      console.error("[admin] ADMIN_SECRET_CODE is not set on this deployment");
      throw new Error(
        "Admin access is not configured. Add ADMIN_SECRET_CODE to your hosting environment variables.",
      );
    }
    if (!data.code || typeof data.code !== "string") {
      return { ok: false as const };
    }
    if (!(await safeEqual(data.code.trim(), expected.trim()))) {
      return { ok: false as const };
    }
    const session = await useSession<AdminSession>(getSessionConfig());
    await session.update({ unlocked: true, unlockedAt: Date.now(), code: data.code.trim() });
    return { ok: true as const };
  });

export const adminLock = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminSession>(getSessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const adminSessionStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AdminSession>(getSessionConfig());
  return { unlocked: !!session.data.unlocked };
});

type WorkerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  status: string | null;
  blocked: boolean | null;
  photo_url: string | null;
  onboarded: boolean | null;
  created_at: string;
  updated_at: string | null;
};

export const adminFetchAllWorkers = createServerFn({ method: "POST" })
  .inputValidator((v: { search?: string } | undefined) => v ?? {})
  .handler(async ({ data }) => {
    const code = await adminCode();
    const { getAdminRpcSupabase } = await import("./admin-supabase.server");
    const supabase = getAdminRpcSupabase();

    // Profiles + documents + income + GigScore are aggregated by a code-guarded
    // SECURITY DEFINER function, so the Lovable-managed publishable key is
    // enough — no service-role key needed on the host.
    const { data: rows, error } = await supabase.rpc("admin_list_workers" as never, {
      _code: code,
      _search: data.search?.trim() || null,
    } as never);

    if (error) {
      console.error("[admin] admin_list_workers failed:", error.message, error.code ?? "");
      if ((error.message || "").includes("forbidden")) {
        throw new Error("Admin authorization was rejected by the database. Re-enter the admin code.");
      }
      throw new Error(`Database error while loading workers: ${error.message}`);
    }

    const workers = (Array.isArray(rows) ? rows : []) as (WorkerRow & {
      last_sign_in_at: string | null;
      documents: unknown[];
      income: { count: number; total: number; last_at: string | null };
      gigscore: number | null;
      docs_verified: number;
      docs_total: number;
    })[];

    return { workers };
  });

export const adminGetDocumentUrl = createServerFn({ method: "POST" })
  .inputValidator((v: { path: string }) => v)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const { getAdminSupabase, hasServiceRole } = await import("./admin-supabase.server");
    if (!hasServiceRole()) {
      throw new Error(
        "File preview needs the optional backend service key on this deployment. Worker, document, income and GigScore data are still available.",
      );
    }
    const supabaseAdmin = getAdminSupabase();
    const { data: signed, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const adminSetWorkerBlocked = createServerFn({ method: "POST" })
  .inputValidator((v: { id: string; blocked: boolean }) => v)
  .handler(async ({ data }) => {
    const code = await adminCode();
    const { getAdminRpcSupabase } = await import("./admin-supabase.server");
    const { error } = await getAdminRpcSupabase().rpc("admin_set_worker_blocked" as never, {
      _code: code,
      _id: data.id,
      _blocked: data.blocked,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });