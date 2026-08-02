import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Production diagnostics for the AI pipeline. Returns ONLY presence booleans
 * and model names — never key values. Signed-in users can call it so the
 * deployed app can be debugged without guessing whether the host actually
 * exposes GEMINI_API_KEY to the server runtime.
 */
export const getAiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { aiEnvDiagnostics } = await import("@/lib/ai.server");
    const diag = aiEnvDiagnostics();
    return { ...diag, configured: diag.providers.length > 0 };
  });
