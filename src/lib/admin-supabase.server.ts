// Server-only Supabase admin client for the Admin Dashboard.
//
// Why this exists instead of importing @/integrations/supabase/client.server:
// that generated client reads `process.env` directly. On some hosts (Nitro
// cloudflare preset, and Vercel builds where env is injected per request) the
// `process.env` shim can be EMPTY at module/eval time, so a correctly
// configured SUPABASE_SERVICE_ROLE_KEY reads as undefined and every admin
// query fails -> the dashboard renders zeros. serverEnv() checks every runtime
// env source before deciding a variable is missing.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { serverEnv, serverEnvAny } from "./env.server";

function isOpaqueKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}

/** Builds a fresh service-role client per request. Never cached across envs. */
export function getAdminSupabase() {
  const url = serverEnvAny("SUPABASE_URL", "VITE_SUPABASE_URL");
  const key = serverEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
    // Names only — never values.
    console.error("[admin] missing backend env:", missing.join(", "));
    throw new Error(
      `Admin dashboard cannot reach the database: missing ${missing.join(" and ")} on this deployment. Add it in your hosting project's Environment Variables and redeploy.`,
    );
  }

  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
        // Opaque sb_* keys are not bearer JWTs.
        if (isOpaqueKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
