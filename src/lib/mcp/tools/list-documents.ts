import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_documents",
  title: "List documents",
  description: "List the signed-in worker's uploaded documents and income proofs with verification status, AI confidence and extracted fields. No file contents are returned.",
  inputSchema: {
    status: z.enum(["pending", "verified", "rejected"]).optional().describe("Filter by verification status."),
    limit: z.number().int().optional().describe("Maximum rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = supabase
      .from("documents")
      .select(
        "id, kind, document_name, file_name, status, ocr_status, confidence_score, rejection_reason, is_income_proof, income_source, income_frequency, income_month, income_year, extracted_amount, extracted_date, extracted_employer, created_at",
      )
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: rows.length ? JSON.stringify(rows) : "No documents uploaded yet." }],
      structuredContent: { documents: rows },
    };
  },
});
