import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** Minimum number of verified work records required before a GigScore is computed. */
export const MIN_VERIFIED_RECORDS = 3;

/**
 * A "verified work record" is any OCR/admin-verified proof of work:
 * a verified work_history entry OR a verified uploaded document.
 */
export async function countVerifiedRecords(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const [work, docs] = await Promise.all([
    supabase.from("work_history").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("verified", true),
    supabase.from("documents").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "verified"),
  ]);
  return (work.count ?? 0) + (docs.count ?? 0);
}
