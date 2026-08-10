import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_schemes",
  title: "Search government schemes",
  description: "Search the ShramSethu catalogue of Indian government welfare and support schemes for gig workers by keyword.",
  inputSchema: {
    query: z.string().optional().describe("Keyword to match against scheme name, summary or authority."),
    limit: z.number().int().optional().describe("Maximum rows to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 10, 1), 50);
    let q = supabase
      .from("schemes")
      .select("code, name, authority, category, summary, benefits, eligibility, url")
      .eq("active", true)
      .limit(take);
    if (query?.trim()) {
      const term = `%${query.trim()}%`;
      q = q.or(`name.ilike.${term},summary.ilike.${term},authority.ilike.${term},benefits.ilike.${term}`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: rows.length ? JSON.stringify(rows) : "No matching schemes found." }],
      structuredContent: { schemes: rows },
    };
  },
});
