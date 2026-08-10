import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_income",
  title: "List income records",
  description: "List the signed-in worker's income records (amount, source, date, verification flag), newest first. Optionally restrict to a date range or verified records only.",
  inputSchema: {
    from: z.string().optional().describe("Earliest occurred_on date, ISO format YYYY-MM-DD."),
    to: z.string().optional().describe("Latest occurred_on date, ISO format YYYY-MM-DD."),
    verified_only: z.boolean().optional().describe("Return only AI/admin verified records."),
    limit: z.number().int().optional().describe("Maximum rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, verified_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 50, 1), 200);
    let query = supabase
      .from("transactions")
      .select("id, amount, type, source, category, frequency, occurred_on, verified, confidence_score, note")
      .eq("user_id", ctx.getUserId())
      .order("occurred_on", { ascending: false })
      .limit(take);
    if (from) query = query.gte("occurred_on", from);
    if (to) query = query.lte("occurred_on", to);
    if (verified_only) query = query.eq("verified", true);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const total = rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
    return {
      content: [{ type: "text", text: rows.length ? JSON.stringify({ total, records: rows }) : "No income records yet." }],
      structuredContent: { total, records: rows },
    };
  },
});
