import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MIN_VERIFIED_RECORDS, countVerifiedRecords } from "@/lib/verified-records";

// ---------- Profile ----------
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: settings }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    ]);
    return { profile, settings, isAdmin: !!roleRow };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: Record<string, unknown>) => v)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    const keys = [
      "full_name","phone","category","skills","experience","location","work_type",
      "languages","emergency_name","emergency_phone","photo_url","id_doc_name","onboarded","status",
    ];
    for (const k of keys) if (k in data) patch[k] = data[k];
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { notifications?: boolean; dark_mode?: boolean; location_sharing?: boolean; language?: string }) => v)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Documents ----------
export type DocKind =
  | "aadhaar" | "pan" | "license" | "passport" | "voter_id"
  | "salary_slip" | "bank_statement" | "income_proof"
  | "payment_receipt" | "employment_letter" | "bank" | "identity" | "other";

export const listMyDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, kind, status, file_name, document_name, storage_path, mime_type, size_bytes, ocr_status, confidence_score, verification_reason, rejection_reason, ai_verified_at, verified_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const recordDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: {
    kind: DocKind; document_name?: string; storage_path: string;
    file_name: string; mime_type: string; size_bytes: number;
    income_source?: string; income_frequency?: "daily" | "weekly" | "monthly";
    is_income_proof?: boolean;
  }) => v)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("documents").insert({
      user_id: context.userId,
      kind: data.kind,
      document_name: data.document_name ?? data.file_name,
      storage_path: data.storage_path,
      file_name: data.file_name,
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
      status: "pending",
      ocr_status: "queued",
      income_source: data.income_source ?? null,
      income_frequency: data.income_frequency ?? null,
      is_income_proof: !!data.is_income_proof,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string };
  });

export const getMyDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => v)
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documents").select("storage_path, user_id, mime_type, file_name").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc || doc.user_id !== context.userId) throw new Error("Not found");
    if (!doc.storage_path) throw new Error("File missing");
    const { data: url, error: e2 } = await context.supabase.storage
      .from("documents").createSignedUrl(doc.storage_path, 60 * 60);
    if (e2) throw new Error(e2.message);
    return {
      url: url.signedUrl,
      mime_type: (doc.mime_type as string) ?? "application/octet-stream",
      file_name: (doc.file_name as string) ?? "document",
    };
  });

export const deleteMyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => v)
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents").select("storage_path, user_id").eq("id", data.id).maybeSingle();
    if (!doc || doc.user_id !== context.userId) throw new Error("Not found");
    if (doc.storage_path) {
      await context.supabase.storage.from("documents").remove([doc.storage_path]);
    }
    const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- AI OCR verification ----------
const KIND_KEYWORDS: Record<string, string[]> = {
  aadhaar: ["aadhaar", "aadhar", "uidai", "unique identification"],
  pan: ["income tax", "permanent account number", "pan"],
  license: ["driving licence", "driving license", "transport", "dl no"],
  passport: ["passport", "republic of india", "type p"],
  voter_id: ["election", "elector", "voter", "epic"],
  salary_slip: ["salary", "payslip", "pay slip", "net pay", "gross pay"],
  bank_statement: ["statement of account", "bank statement", "ifsc", "opening balance"],
  income_proof: ["income certificate", "income proof"],
  payment_receipt: ["receipt", "invoice", "paid", "amount received"],
  employment_letter: ["offer letter", "appointment letter", "employment", "hereby appointed"],
};

export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => v)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, user_id, kind, storage_path, mime_type, file_name, is_income_proof, income_source, income_frequency")
      .eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc || doc.user_id !== userId) throw new Error("Not found");

    await supabase.from("documents").update({ ocr_status: "running" } as never).eq("id", doc.id);

    // Download the file from storage → base64 for the model
    const { data: file, error: dlErr } = await supabase.storage.from("documents").download(doc.storage_path as string);
    if (dlErr || !file) {
      const reason = `Failed to read file: ${dlErr?.message ?? "unknown"}`;
      await supabase.from("documents").update({ ocr_status: "failed", status: "rejected", verification_reason: reason, ai_verified_at: new Date().toISOString() } as never).eq("id", doc.id);
      return { status: "rejected", confidence_score: 0, verification_reason: reason };
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const b64 = typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(buf).toString("base64");
    const mime = (doc.mime_type as string) || "application/octet-stream";

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const isIncome = !!doc.is_income_proof;
    const prompt = isIncome
      ? `You are an earnings-proof verification agent. The worker claims income from "${doc.income_source ?? "unknown"}" with a "${doc.income_frequency ?? "unknown"}" frequency. Analyse the uploaded document (${String(doc.kind).replace(/_/g, " ")}) and return STRICT JSON with keys:
{"extracted_text": string,
 "detected_type": string,
 "quality_ok": boolean,
 "issues": string[],
 "confidence": number (0-100),
 "status": "verified"|"needs_review"|"rejected",
 "reason": string,
 "amount": number|null,
 "currency": string|null,
 "payment_date": string|null,
 "employer_or_platform": string|null,
 "transaction_ref": string|null,
 "frequency_detected": "daily"|"weekly"|"monthly"|null,
 "source_matches_claim": boolean}
Rules:
- BE PERMISSIVE about layout. Gig platforms (Zomato, Swiggy, Uber, Ola, Rapido, Amazon Flex, Blinkit, Zepto, employers, banks) all use different templates, logos, fonts, spacing, languages and column orders. NEVER downgrade a document because of an unfamiliar layout, missing logo, screenshot format, different font, or unusual wording.
- verified: the document is readable AND contains an earnings/payout amount. Treat it as genuine unless there is concrete evidence of tampering. A worker name, platform/employer name, payout date or transaction details strengthen it but only the readable amount is mandatory; infer the platform from the claim when the document does not print it.
- needs_review: ONLY when the file is partially readable and you genuinely cannot decide (e.g. amount is ambiguous between multiple candidates).
- rejected: unreadable, blank, obviously fabricated/edited (mismatched fonts within a field, visible digit tampering, template placeholder text like "Lorem ipsum"/"sample"), or clearly a different document type (ID card, selfie, random photo) with no earnings information.
- source_matches_claim: set true unless the document clearly shows a DIFFERENT real platform/employer than claimed. Absence of a platform name is NOT a mismatch.
- amount MUST be a plain number (no currency symbols, no commas). If multiple amounts appear, pick the net earnings / net pay / total received amount.
- payment_date: ISO YYYY-MM-DD when possible.
Respond with JSON only.`
      : `You are a document verification assistant. Analyse the provided ${String(doc.kind).replace(/_/g, " ")} document and return STRICT JSON with keys: {"extracted_text": string, "detected_type": string, "quality_ok": boolean, "issues": string[], "confidence": number (0-100), "status": "verified"|"needs_review"|"rejected", "reason": string}. Rules: verified only if readable, right document type, mandatory fields present, no blur/crop/rotation problems. needs_review if partially readable or missing some fields. rejected if unreadable, wrong document, corrupted, or blank. Respond with JSON only.`;

    let aiJson: {
      extracted_text?: string; detected_type?: string; quality_ok?: boolean;
      issues?: string[]; confidence?: number; status?: string; reason?: string;
      amount?: number | null; currency?: string | null; payment_date?: string | null;
      employer_or_platform?: string | null; transaction_ref?: string | null;
      frequency_detected?: "daily" | "weekly" | "monthly" | null;
      source_matches_claim?: boolean;
    } = {};
    let ocrText = "";
    try {
      const isImage = mime.startsWith("image/");
      const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
      if (isImage) {
        content.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } });
      } else {
        content.push({ type: "file", file: { filename: doc.file_name ?? "document", file_data: `data:${mime};base64,${b64}` } });
      }
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content }],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`AI error [${res.status}]: ${t.slice(0, 200)}`);
      }
      const j = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const raw = j.choices?.[0]?.message?.content ?? "{}";
      try { aiJson = JSON.parse(raw); } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        aiJson = m ? JSON.parse(m[0]) : {};
      }
      ocrText = String(aiJson.extracted_text ?? "").slice(0, 15000);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "OCR failed";
      await supabase.from("documents").update({
        ocr_status: "failed", status: "needs_review",
        verification_reason: reason, ai_verified_at: new Date().toISOString(),
      } as never).eq("id", doc.id);
      return { status: "needs_review", confidence_score: 0, verification_reason: reason };
    }

    // Duplicate detection (same user, same kind, non-trivial OCR text match)
    let duplicate = false;
    if (ocrText && ocrText.length > 40) {
      const snippet = ocrText.slice(0, 200).replace(/[%_]/g, " ");
      const { data: dup } = await supabase
        .from("documents")
        .select("id")
        .eq("user_id", userId).eq("kind", doc.kind)
        .neq("id", doc.id)
        .ilike("ocr_text", `%${snippet}%`)
        .limit(1);
      if (dup && dup.length) duplicate = true;
    }

    // Kind mismatch check via keywords when AI didn't already reject
    const kw = KIND_KEYWORDS[String(doc.kind)] ?? [];
    const kindMatch = kw.length === 0 || kw.some((k) => ocrText.toLowerCase().includes(k));

    let confidence = Math.max(0, Math.min(100, Math.round(Number(aiJson.confidence ?? 0))));
    let status: "verified" | "needs_review" | "rejected" =
      aiJson.status === "verified" || aiJson.status === "needs_review" || aiJson.status === "rejected"
        ? aiJson.status : "needs_review";
    let reason = String(aiJson.reason ?? (aiJson.issues ?? []).join("; ") ?? "").slice(0, 500);

    if (duplicate) { status = "rejected"; reason = "Duplicate upload detected"; confidence = Math.min(confidence, 30); }
    else if (!isIncome && !kindMatch && status === "verified") { status = "needs_review"; reason = reason || "Detected document type does not match selected type"; }

    // Income-proof specific handling
    let extracted_amount: number | null = null;
    let extracted_date: string | null = null;
    let extracted_employer: string | null = null;
    let extracted_txn_ref: string | null = null;
    if (isIncome) {
      const rawAmount = typeof aiJson.amount === "number" ? aiJson.amount : Number(aiJson.amount ?? NaN);
      extracted_amount = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount * 100) / 100 : null;
      const rawDate = typeof aiJson.payment_date === "string" ? aiJson.payment_date : null;
      extracted_date = rawDate && /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : null;
      extracted_employer = aiJson.employer_or_platform ?? null;
      extracted_txn_ref = aiJson.transaction_ref ?? null;
      if (status !== "rejected") {
        if (extracted_amount) {
          // Genuine, readable earnings proof: layout/logo/format differences never block verification.
          status = "verified";
          confidence = Math.max(confidence, 75);
          reason = `Earnings verified · ₹${extracted_amount.toLocaleString("en-IN")}${extracted_employer ? ` from ${extracted_employer}` : ""}${extracted_date ? ` on ${extracted_date}` : ""}`;
        } else {
          status = "needs_review";
          reason = reason || "Could not extract a payment amount from the document";
        }
      }
    }

    await supabase.from("documents").update({
      ocr_status: "done", status,
      confidence_score: confidence,
      verification_reason: reason || null,
      ocr_text: ocrText || null,
      ai_verified_at: new Date().toISOString(),
      extracted_amount,
      extracted_date,
      extracted_employer,
      extracted_txn_ref,
    } as never).eq("id", doc.id);

    // On verified income proof, record a verified transaction so analytics + GigScore + loan update.
    if (isIncome && status === "verified" && extracted_amount && extracted_amount > 0) {
      // Avoid duplicate transaction for the same document.
      const { data: existing } = await supabase
        .from("transactions").select("id").eq("document_id", doc.id).maybeSingle();
      if (!existing) {
        await supabase.from("transactions").insert({
          user_id: userId,
          type: "income",
          amount: extracted_amount,
          source: doc.income_source ?? extracted_employer ?? null,
          occurred_on: extracted_date ?? new Date().toISOString().slice(0, 10),
          note: extracted_txn_ref ? `Ref: ${extracted_txn_ref}` : null,
          verified: true,
          document_id: doc.id,
          frequency: doc.income_frequency ?? null,
          confidence_score: confidence,
        });
      }
    }

    return { status, confidence_score: confidence, verification_reason: reason };
  });

// ---------- Location ----------
export const recordLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { lat: number; lng: number; accuracy?: number }) => v)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("location_pings").insert({
      user_id: context.userId,
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- SOS ----------
export const triggerSOS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { lat?: number; lng?: number; message?: string }) => v)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sos_events").insert({
      user_id: context.userId,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      message: data.message ?? null,
      status: "active",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Schemes ----------
export const listSchemes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("schemes")
      .select("id, code, name, authority, category, summary, benefits, eligibility, url")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Notifications, work history, transactions ----------
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyWorkHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("work_history")
      .select("*")
      .eq("user_id", context.userId)
      .order("started_on", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("transactions")
      .select("id, type, amount, source, occurred_on, note, verified, document_id, frequency, confidence_score, created_at")
      .eq("user_id", context.userId)
      .order("occurred_on", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyIncomeUploads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, kind, status, file_name, document_name, storage_path, mime_type, ocr_status, confidence_score, verification_reason, ai_verified_at, created_at, income_source, income_frequency, extracted_amount, extracted_date, extracted_employer, extracted_txn_ref")
      .eq("user_id", context.userId)
      .eq("is_income_proof", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyGigscore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const verifiedCount = await countVerifiedRecords(context.supabase, context.userId);
    if (verifiedCount < MIN_VERIFIED_RECORDS) {
      return { score: null, verifiedCount, reason: "insufficient_data" as const };
    }
    // Recompute from the latest verified data so the score is always current.
    await context.supabase.rpc("recompute_gigscore", { _user_id: context.userId });
    const { data } = await context.supabase
      .from("gigscore_snapshots")
      .select("score, breakdown, computed_at")
      .eq("user_id", context.userId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { score: data?.score ?? null, verifiedCount, breakdown: data?.breakdown ?? null, reason: null };
  });

export const getLoanEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const verifiedCount = await countVerifiedRecords(context.supabase, context.userId);
    if (verifiedCount < MIN_VERIFIED_RECORDS) {
      return { eligible: false, amount: null, reason: "insufficient_data" as const };
    }
    await context.supabase.rpc("recompute_gigscore", { _user_id: context.userId });
    const { data: gig } = await context.supabase
      .from("gigscore_snapshots").select("score")
      .eq("user_id", context.userId)
      .order("computed_at", { ascending: false }).limit(1).maybeSingle();
    if (!gig?.score) return { eligible: false, amount: null, reason: "insufficient_data" as const };
    return { eligible: true, amount: null, reason: null };
  });

// ---------- Admin ----------
export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const [workers, pending, sos, active] = await Promise.all([
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "pending"),
      context.supabase.from("sos_events").select("id", { count: "exact", head: true }).eq("status", "active"),
      context.supabase.from("profiles").select("id", { count: "exact", head: true }).in("status", ["online","on_duty","available"]),
    ]);
    return {
      registeredWorkers: workers.count ?? 0,
      pendingVerifications: pending.count ?? 0,
      openSOS: sos.count ?? 0,
      activeToday: active.count ?? 0,
    };
  });

// ---------- Admin: workers & documents ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminListWorkers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { search?: string; onlyBlocked?: boolean } | undefined) => v ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("profiles").select("id, full_name, email, phone, category, status, blocked, photo_url, onboarded, created_at").order("created_at", { ascending: false });
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
    }
    if (data.onlyBlocked) q = q.eq("blocked", true);
    const { data: rows, error } = await q.limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminGetWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const [{ data: p }, { data: docs }, { data: gs }, { data: txns }] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("documents").select("*").eq("user_id", data.id).order("created_at", { ascending: false }),
      context.supabase.from("gigscore_snapshots").select("score, breakdown, computed_at").eq("user_id", data.id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      context.supabase.from("transactions").select("id, type, amount, occurred_on, source").eq("user_id", data.id).order("occurred_on", { ascending: false }).limit(50),
    ]);
    return { profile: p, documents: docs ?? [], gigscore: gs, transactions: txns ?? [] };
  });

export const adminSetBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; blocked: boolean }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("profiles").update({ blocked: data.blocked } as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListPendingDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, user_id, kind, status, file_name, storage_path, mime_type, created_at, profiles:user_id(full_name, email, phone)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { path: string }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: url, error } = await context.supabase.storage.from("documents").createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: url.signedUrl };
  });

export const adminReviewDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { docId: string; decision: "verified" | "rejected"; note?: string }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.rpc("admin_review_document", {
      _doc_id: data.docId, _decision: data.decision, _note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Cascades to related tables via FK ON DELETE CASCADE where set.
    const { error } = await context.supabase.from("profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Income sources & records ----------
export const listIncomeSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("income_sources").select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addIncomeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { kind: "gig_platform" | "employer" | "bank" | "other"; name: string; external_ref?: string }) => v)
  .handler(async ({ data, context }) => {
    if (!data.name?.trim()) throw new Error("Name required");
    const { error } = await context.supabase.from("income_sources").insert({
      user_id: context.userId, kind: data.kind, name: data.name.trim(), external_ref: data.external_ref,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addIncomeRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { amount: number; source?: string; occurred_on?: string; note?: string }) => v)
  .handler(async ({ data, context }) => {
    if (!(data.amount > 0)) throw new Error("Amount must be positive");
    const { error } = await context.supabase.from("transactions").insert({
      user_id: context.userId, type: "income", amount: data.amount,
      source: data.source ?? null, occurred_on: data.occurred_on ?? new Date().toISOString().slice(0, 10),
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- User directory (for location sharing) ----------
export const searchWorkers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { q: string }) => v)
  .handler(async ({ data, context }) => {
    const query = data.q?.trim();
    if (!query || query.length < 2) return [];
    const s = `%${query}%`;
    const { data: rows, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, photo_url, status, category")
      .or(`full_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`)
      .neq("id", context.userId)
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Location shares ----------
export const startLocationShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { recipientIds: string[]; mode: "current" | "live"; lat: number; lng: number; message?: string }) => v)
  .handler(async ({ data, context }) => {
    if (!data.recipientIds?.length) throw new Error("Choose at least one recipient");
    const rows = data.recipientIds.map((rid) => ({
      sender_id: context.userId, recipient_id: rid, mode: data.mode,
      latest_lat: data.lat, latest_lng: data.lng, message: data.message ?? null, active: true,
    }));
    const { data: inserted, error } = await context.supabase.from("location_shares").insert(rows).select("id, recipient_id");
    if (error) throw new Error(error.message);
    const notes = (inserted ?? []).map((r: { recipient_id: string }) => ({
      user_id: r.recipient_id, kind: "info" as const,
      title: "Location shared with you", body: data.mode === "live" ? "Live location sharing started." : "A location was shared with you.",
    }));
    if (notes.length) await context.supabase.from("notifications").insert(notes);
    return { ok: true, count: inserted?.length ?? 0 };
  });

export const updateLiveShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { lat: number; lng: number }) => v)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("location_shares")
      .update({ latest_lat: data.lat, latest_lng: data.lng } as never)
      .eq("sender_id", context.userId).eq("active", true).eq("mode", "live");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const stopLocationShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id?: string; all?: boolean }) => v)
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("location_shares").update({ active: false, ended_at: new Date().toISOString() } as never).eq("sender_id", context.userId);
    if (data.id) q = q.eq("id", data.id);
    else if (data.all) q = q.eq("active", true);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [outgoing, incoming] = await Promise.all([
      context.supabase.from("location_shares").select("id, recipient_id, mode, latest_lat, latest_lng, active, started_at").eq("sender_id", context.userId).order("started_at", { ascending: false }).limit(20),
      context.supabase.from("location_shares").select("id, sender_id, mode, latest_lat, latest_lng, active, started_at").eq("recipient_id", context.userId).eq("active", true).order("started_at", { ascending: false }).limit(20),
    ]);
    return { outgoing: outgoing.data ?? [], incoming: incoming.data ?? [] };
  });

// ---------- Maps: routes/directions ----------
export const computeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }) => v)
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) throw new Error("Google Maps not configured");
    const res = await fetch("https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: data.origin.lat, longitude: data.origin.lng } } },
        destination: { location: { latLng: { latitude: data.destination.lat, longitude: data.destination.lng } } },
        travelMode: "DRIVE",
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Routes error [${res.status}]: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { routes?: Array<{ duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }> };
    const r = json.routes?.[0];
    return {
      durationSeconds: r?.duration ? Number(String(r.duration).replace("s", "")) : null,
      distanceMeters: r?.distanceMeters ?? null,
      polyline: r?.polyline?.encodedPolyline ?? null,
    };
  });

// ---------- Google Maps: nearby places via connector gateway ----------
export const nearbyPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { lat: number; lng: number; includedType: string; radiusMeters?: number }) => v)
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) throw new Error("Google Maps not configured");
    const res = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchNearby", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({
        includedTypes: [data.includedType],
        maxResultCount: 15,
        locationRestriction: {
          circle: { center: { latitude: data.lat, longitude: data.lng }, radius: data.radiusMeters ?? 8000 },
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Maps error [${res.status}]: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { places?: Array<Record<string, unknown>> };
    return (json.places ?? []) as unknown as Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      rating?: number;
      userRatingCount?: number;
    }>;
  });