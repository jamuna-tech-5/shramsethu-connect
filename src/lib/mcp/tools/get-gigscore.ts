import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_gigscore",
  title: "Get GigScore",
  description: "Return the signed-in worker's latest GigScore snapshot with its score breakdown.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("gigscore_snapshots")
      .select("score, breakdown, computed_at")
      .eq("user_id", ctx.getUserId())
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "No GigScore yet — verified income or documents are needed first." }] };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { gigscore: data } };
  },
});
