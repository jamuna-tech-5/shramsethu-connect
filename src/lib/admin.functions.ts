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

type AdminSession = { unlocked?: boolean; unlockedAt?: number };

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
    await session.update({ unlocked: true, unlockedAt: Date.now() });
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
    await requireAdminSession();
    const { getAdminSupabase } = await import("./admin-supabase.server");
    const supabaseAdmin = getAdminSupabase();

    let q = supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, category, status, blocked, photo_url, onboarded, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (data.search && data.search.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
    }
    const { data: workers, error } = await q.limit(500);
    if (error) throw new Error(error.message);

    const ids = (workers ?? []).map((w) => (w as WorkerRow).id);
    if (ids.length === 0) return { workers: [] };

    const [docsRes, gigRes, txRes, authRes] = await Promise.all([
      supabaseAdmin
        .from("documents")
        .select("id, user_id, kind, status, file_name, document_name, storage_path, mime_type, size_bytes, ocr_status, confidence_score, verification_reason, ai_verified_at, verified_at, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("gigscore_snapshots")
        .select("user_id, score, computed_at")
        .in("user_id", ids)
        .order("computed_at", { ascending: false }),
      supabaseAdmin
        .from("transactions")
        .select("user_id, amount, occurred_on, type")
        .in("user_id", ids)
        .eq("type", "income"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (docsRes.error) throw new Error(docsRes.error.message);

    type DocRow = {
      id: string; user_id: string; kind: string; status: string;
      file_name: string | null; document_name: string | null;
      storage_path: string | null; mime_type: string | null; size_bytes: number | null;
      ocr_status: string | null; confidence_score: number | null;
      verification_reason: string | null; ai_verified_at: string | null;
      verified_at: string | null; created_at: string;
    };
    const docsByUser = new Map<string, DocRow[]>();
    for (const d of docsRes.data ?? []) {
      const row = d as DocRow;
      if (!docsByUser.has(row.user_id)) docsByUser.set(row.user_id, []);
      docsByUser.get(row.user_id)!.push(row);
    }
    const gigByUser = new Map<string, number>();
    for (const g of gigRes.data ?? []) {
      const row = g as { user_id: string; score: number };
      if (!gigByUser.has(row.user_id)) gigByUser.set(row.user_id, row.score);
    }
    const incByUser = new Map<string, { count: number; total: number; last_at: string | null }>();
    for (const t of txRes.data ?? []) {
      const row = t as { user_id: string; amount: number; occurred_on: string };
      const cur = incByUser.get(row.user_id) ?? { count: 0, total: 0, last_at: null };
      cur.count += 1;
      cur.total += Number(row.amount) || 0;
      if (!cur.last_at || row.occurred_on > cur.last_at) cur.last_at = row.occurred_on;
      incByUser.set(row.user_id, cur);
    }
    const lastSignInByUser = new Map<string, string | null>();
    for (const u of authRes.data?.users ?? []) {
      lastSignInByUser.set(u.id, u.last_sign_in_at ?? null);
    }

    const result = (workers ?? []).map((w) => {
      const row = w as WorkerRow;
      const docs = docsByUser.get(row.id) ?? [];
      const docs_verified = docs.filter((d) => d.status === "verified").length;
      return {
        ...row,
        last_sign_in_at: lastSignInByUser.get(row.id) ?? null,
        documents: docs,
        income: incByUser.get(row.id) ?? { count: 0, total: 0, last_at: null },
        gigscore: gigByUser.get(row.id) ?? null,
        docs_verified,
        docs_total: docs.length,
      };
    });
    return { workers: result };
  });

export const adminGetDocumentUrl = createServerFn({ method: "POST" })
  .inputValidator((v: { path: string }) => v)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const { getAdminSupabase } = await import("./admin-supabase.server");
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
    await requireAdminSession();
    const { getAdminSupabase } = await import("./admin-supabase.server");
    const supabaseAdmin = getAdminSupabase();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ blocked: data.blocked } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });