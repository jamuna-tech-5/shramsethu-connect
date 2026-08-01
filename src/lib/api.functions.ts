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
    income_source?: string; income_frequency?: "daily" | "weekly" | "monthly" | "yearly";
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

    // Secure content fingerprint of the actual file bytes (never the filename).
    let contentHash: string | null = null;
    try {
      const digest = await crypto.subtle.digest("SHA-256", buf.slice().buffer as ArrayBuffer);
      contentHash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      contentHash = null;
    }

    // Duplicate ONLY when the byte-identical file is already VERIFIED for this same user.
    let duplicate = false;
    if (contentHash) {
      const { data: dup } = await supabase
        .from("documents")
        .select("id")
        .eq("user_id", userId)
        .eq("content_hash", contentHash)
        .eq("status", "verified")
        .neq("id", doc.id)
        .limit(1);
      duplicate = !!(dup && dup.length);
    }

    const { aiPrompt, parseJsonLoose, resolveAiProvider, AI_NOT_CONFIGURED_MESSAGE } = await import("@/lib/ai.server");
    if (!resolveAiProvider()) {
      await supabase.from("documents").update({
        ocr_status: "failed", status: "needs_review",
        verification_reason: AI_NOT_CONFIGURED_MESSAGE, ai_verified_at: new Date().toISOString(),
      } as never).eq("id", doc.id);
      return { status: "needs_review", confidence_score: 0, verification_reason: AI_NOT_CONFIGURED_MESSAGE };
    }

    const isIncome = !!doc.is_income_proof;
    const kindLabel = String(doc.kind).replace(/_/g, " ");
    const attachment = { mime, b64, filename: (doc.file_name as string) ?? "document" };

    // ---- STAGE 1: OCR — extraction ONLY, no verdict ----
    const ocrPrompt = `You are an OCR extraction engine. Do NOT judge authenticity. Transcribe the attached ${kindLabel} document or app screenshot faithfully and extract whatever fields are visible. Missing fields are normal — return null for them, never invent values.
Return STRICT JSON only:
{"extracted_text": string (full verbatim text, preserve line breaks),
 "detected_type": string (what kind of document this appears to be),
 "legible": boolean (false if blank/unreadable/corrupted),
 "amount": number|null (earnings / total earnings / ride earnings / net pay / amount received, plain number, no symbols or commas),
 "total_earnings": number|null,
 "bonus": number|null,
 "incentives": number|null,
 "wallet_balance": number|null,
 "ride_count": number|null (rides / trips / orders completed),
 "currency": string|null,
 "payment_date": string|null (ISO YYYY-MM-DD),
 "period_start": string|null, "period_end": string|null,
 "employer_or_platform": string|null (e.g. Rapido, Ola, Uber, Namma Yatri, Swiggy, Zomato, Porter, employer or bank name),
 "worker_name": string|null,
 "transaction_ref": string|null,
 "frequency_detected": "daily"|"weekly"|"monthly"|"yearly"|null,
 "present_sections": string[] (field/section headings actually present, e.g. "today's earnings","trip history","incentives","orders completed","wallet balance","payout id")}
JSON only.`;

    type OcrJson = {
      extracted_text?: string; detected_type?: string; legible?: boolean;
      amount?: number | null; currency?: string | null; payment_date?: string | null;
      total_earnings?: number | null; bonus?: number | null; incentives?: number | null;
      wallet_balance?: number | null; ride_count?: number | null;
      period_start?: string | null; period_end?: string | null;
      employer_or_platform?: string | null; worker_name?: string | null;
      transaction_ref?: string | null;
      frequency_detected?: "daily" | "weekly" | "monthly" | "yearly" | null;
      present_sections?: string[];
    };
    let ocr: OcrJson = {};
    let ocrText = "";
    try {
      const raw = await aiPrompt({ prompt: ocrPrompt, json: true, attachment });
      ocr = parseJsonLoose(raw, {} as OcrJson);
      ocrText = String(ocr.extracted_text ?? "").slice(0, 15000);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "OCR failed";
      console.error("[ocr] extraction failed", { documentId: doc.id, mime, reason });
      await supabase.from("documents").update({
        ocr_status: "failed", status: "needs_review",
        verification_reason: reason, ai_verified_at: new Date().toISOString(),
      } as never).eq("id", doc.id);
      return { status: "needs_review", confidence_score: 0, verification_reason: reason };
    }

    // ---- STAGE 2: authenticity / forensic audit (separate pass over the same file) ----
    const authPrompt = isIncome
      ? `You are a forensic document-fraud examiner reviewing an EARNINGS STATEMENT submitted as proof of income for a loan decision. The worker claims income from "${doc.income_source ?? "unspecified"}" (${doc.income_frequency ?? "unspecified"} frequency).

OCR already extracted this data (use it, but judge the ATTACHED FILE itself):
${JSON.stringify({
        detected_type: ocr.detected_type ?? null,
        amount: ocr.amount ?? null,
        employer_or_platform: ocr.employer_or_platform ?? null,
        payment_date: ocr.payment_date ?? null,
        transaction_ref: ocr.transaction_ref ?? null,
        present_sections: ocr.present_sections ?? [],
      }).slice(0, 2000)}

Assess, independently:
1. Is this an OFFICIAL earnings/payout statement issued by a platform, employer or bank — not a hand-made document, spreadsheet export, Word/Canva mock-up, note, or plain-text file?
2. Does the platform actually match the content? (Rapido, Uber, Ola, Swiggy, Zomato, Blinkit, Zepto, Amazon Flex, Dunzo, banks, employers each have recognisable statement structures, payout IDs, order/trip breakdowns, GST/TDS lines, support footers.)
3. Branding & layout: is expected branding, header/footer, logo, statement ID, period, and issuer contact present and consistent with a real statement from that issuer?
4. Required fields present: worker/partner identity, period or payment date, gross/net breakdown, payout reference.
5. Tampering signals: inconsistent fonts/kerning/baseline within a line, mismatched anti-aliasing or compression around numbers, misaligned columns, overlapping or repainted digits, cropped-out regions, screenshot-of-a-screenshot artefacts, editor metadata cues.
6. AI-generated / template signals: placeholder text, implausibly clean synthetic layout, generic wording, invented field names, nonsensical IDs.
7. Data plausibility: unrealistic amounts for the claimed platform and period, impossible dates, arithmetic that does not add up (line items vs total), round-number fabrication.

Return STRICT JSON only:
{"is_official_statement": boolean,
 "platform_identified": string|null,
 "platform_matches_claim": boolean,
 "branding_ok": boolean,
 "required_fields_ok": boolean,
 "missing_fields": string[],
 "tampering_signals": string[],
 "ai_generated_likelihood": number (0-100),
 "data_plausible": boolean,
 "authenticity_confidence": number (0-100 — how confident you are the document is GENUINE and unaltered),
 "verdict": "verified"|"needs_review"|"rejected",
 "reason": string (one clear sentence a worker can understand, naming the decisive evidence)}

Verdict rules — be strict, this gates real money:
- "verified" ONLY when it is unmistakably an authentic official statement: authenticity_confidence >= 90, no tampering signals, branding and required fields present, data plausible.
- "rejected" when there is concrete evidence of forgery, editing, AI generation, a manually typed/self-made document, a non-earnings document, or a blank/unreadable file.
- "needs_review" for everything else — anything merely unusual, partially legible, unbranded, or that you cannot confidently place.
Never guess in favour of the worker. JSON only.`
      : `You are a forensic document-fraud examiner. Judge the ATTACHED ${kindLabel} document for authenticity, not just readability. OCR read: ${JSON.stringify({ detected_type: ocr.detected_type ?? null, legible: ocr.legible ?? null }).slice(0, 500)}.
Check: correct document type, expected issuing-authority branding and layout, all mandatory fields present, and any tampering / editing / AI-generation / template signals.
Return STRICT JSON only:
{"is_official_statement": boolean, "platform_identified": string|null, "platform_matches_claim": true, "branding_ok": boolean, "required_fields_ok": boolean, "missing_fields": string[], "tampering_signals": string[], "ai_generated_likelihood": number (0-100), "data_plausible": boolean, "authenticity_confidence": number (0-100), "verdict": "verified"|"needs_review"|"rejected", "reason": string}
"verified" only when authenticity_confidence >= 90 with no tampering signals; "rejected" on forgery/editing/wrong document/blank; otherwise "needs_review". JSON only.`;

    type AuthJson = {
      is_official_statement?: boolean; platform_identified?: string | null;
      platform_matches_claim?: boolean; branding_ok?: boolean;
      required_fields_ok?: boolean; missing_fields?: string[];
      tampering_signals?: string[]; ai_generated_likelihood?: number;
      data_plausible?: boolean; authenticity_confidence?: number;
      verdict?: string; reason?: string;
    };
    let auth: AuthJson = {};
    try {
      const raw = await aiPrompt({ prompt: authPrompt, json: true, attachment });
      auth = parseJsonLoose(raw, {} as AuthJson);
    } catch (e) {
      const reason = `Authenticity check unavailable — sent for manual review (${e instanceof Error ? e.message : "AI error"})`;
      console.error("[ocr] authenticity pass failed", { documentId: doc.id, mime, reason });
      await supabase.from("documents").update({
        ocr_status: "done", status: "needs_review", ocr_text: ocrText || null,
        verification_reason: reason.slice(0, 500), ai_verified_at: new Date().toISOString(),
      } as never).eq("id", doc.id);
      return { status: "needs_review", confidence_score: 0, verification_reason: reason };
    }

    // Kind mismatch check via keywords when AI didn't already reject
    const kw = KIND_KEYWORDS[String(doc.kind)] ?? [];
    const kindMatch = kw.length === 0 || kw.some((k) => ocrText.toLowerCase().includes(k));

    // ---- Decision: authenticity pass drives the verdict; OCR never verifies on its own ----
    const VERIFY_THRESHOLD = 90;
    let confidence = Math.max(0, Math.min(100, Math.round(Number(auth.authenticity_confidence ?? 0))));
    const tampering = (auth.tampering_signals ?? []).filter(Boolean);
    const missing = (auth.missing_fields ?? []).filter(Boolean);
    const aiLikelihood = Math.max(0, Math.min(100, Math.round(Number(auth.ai_generated_likelihood ?? 0))));

    let status: "verified" | "needs_review" | "rejected" =
      auth.verdict === "verified" || auth.verdict === "needs_review" || auth.verdict === "rejected"
        ? auth.verdict
        : "needs_review";
    let reason = String(auth.reason ?? "").slice(0, 500);

    // Extracted fields come from the OCR pass only.
    let extracted_amount: number | null = null;
    let extracted_date: string | null = null;
    let extracted_employer: string | null = null;
    let extracted_txn_ref: string | null = null;
    if (isIncome) {
      const rawAmount = typeof ocr.amount === "number" ? ocr.amount : Number(ocr.amount ?? NaN);
      extracted_amount = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount * 100) / 100 : null;
      const rawDate = typeof ocr.payment_date === "string" ? ocr.payment_date : null;
      extracted_date = rawDate && /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : null;
      extracted_employer = ocr.employer_or_platform ?? auth.platform_identified ?? null;
      extracted_txn_ref = ocr.transaction_ref ?? null;
    }

    const downgrade = (why: string) => {
      if (status !== "rejected") status = "needs_review";
      reason = reason ? `${why} · ${reason}` : why;
    };

    // Hard gates — a document can only stay "verified" if every one of these holds.
    if (ocr.legible === false) { status = "rejected"; reason = "Document is blank or unreadable"; confidence = Math.min(confidence, 20); }
    if (duplicate) { status = "rejected"; reason = "Duplicate upload detected"; confidence = Math.min(confidence, 20); }
    if (status === "verified") {
      if (tampering.length) { status = "rejected"; reason = `Tampering detected: ${tampering.join("; ")}`.slice(0, 500); confidence = Math.min(confidence, 40); }
      else if (aiLikelihood >= 60) { status = "rejected"; reason = "Document appears artificially generated or manually created"; confidence = Math.min(confidence, 40); }
      else if (auth.is_official_statement === false) downgrade("Does not look like an official issuer-generated statement");
      else if (auth.data_plausible === false) downgrade("Values on the document are not plausible");
      else if (auth.branding_ok === false) downgrade("Expected issuer branding or layout is missing");
      else if (auth.required_fields_ok === false) downgrade(`Required fields missing${missing.length ? `: ${missing.join(", ")}` : ""}`);
      else if (isIncome && auth.platform_matches_claim === false) downgrade("Platform on the document does not match the declared income source");
      else if (isIncome && !extracted_amount) downgrade("No payout amount could be read from the document");
      else if (!isIncome && !kindMatch) downgrade("Detected document type does not match the selected type");
      else if (confidence < VERIFY_THRESHOLD) downgrade(`AI confidence ${confidence}% is below the ${VERIFY_THRESHOLD}% threshold required for automatic verification`);
    }

    if (status === "verified" && isIncome && extracted_amount) {
      reason = `Authentic earnings statement (${confidence}% confidence) · ₹${extracted_amount.toLocaleString("en-IN")}${extracted_employer ? ` from ${extracted_employer}` : ""}${extracted_date ? ` on ${extracted_date}` : ""}`;
    }
    if (!reason) {
      reason = status === "verified"
        ? `Verified with ${confidence}% authenticity confidence`
        : status === "rejected"
          ? "Document could not be authenticated"
          : "Sent for manual review — authenticity could not be confirmed automatically";
    }
    reason = reason.slice(0, 500);

    await supabase.from("documents").update({
      ocr_status: "done", status,
      confidence_score: confidence,
      verification_reason: reason || null,
      ocr_text: ocrText || null,
      content_hash: contentHash,
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
        const { error: txErr } = await supabase.from("transactions").insert({
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
        if (txErr) {
          const failReason = `Verified, but saving the income record failed: ${txErr.message}`;
          await supabase.from("documents").update({
            status: "needs_review", verification_reason: failReason.slice(0, 500),
          } as never).eq("id", doc.id);
          return { status: "needs_review" as const, confidence_score: confidence, verification_reason: failReason };
        }
      }
    }

    // Re-verification that no longer passes must withdraw its financial effect:
    // rejected / manual-review documents never contribute to analytics or GigScore.
    if (status !== "verified") {
      await supabase.from("transactions").delete().eq("document_id", doc.id).eq("user_id", userId);
    }

    // Refresh GigScore (and therefore loan eligibility + dashboard) after any verdict change.
    await supabase.rpc("recompute_gigscore", { _user_id: userId });

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
    const { supabase, userId } = context;
    const verifiedCount = await countVerifiedRecords(supabase, userId);

    // 1. GigScore stays locked until the mandatory profile fields are saved.
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, category, experience, location, work_type, emergency_name, emergency_phone")
      .eq("id", userId)
      .maybeSingle();
    const REQUIRED = [
      "full_name", "phone", "category", "experience",
      "location", "work_type", "emergency_name", "emergency_phone",
    ] as const;
    const missing = REQUIRED.filter((k) => {
      const v = (profile as Record<string, unknown> | null)?.[k];
      return v === null || v === undefined || String(v).trim() === "";
    });
    if (!profile || missing.length > 0) {
      return {
        score: null, verifiedCount, breakdown: null,
        locked: true, missingFields: missing as unknown as string[],
        reason: "profile_incomplete" as const,
      };
    }

    // 2. Unlocked, but the score itself comes only from verified income documents.
    const { count: incomeCount } = await supabase
      .from("transactions").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("type", "income").eq("verified", true);
    if (!incomeCount) {
      return {
        score: null, verifiedCount, breakdown: null,
        locked: false, missingFields: [],
        reason: "no_verified_income" as const,
      };
    }

    // Recompute from the latest verified data so the score is always current.
    await supabase.rpc("recompute_gigscore", { _user_id: userId });
    const { data } = await supabase
      .from("gigscore_snapshots")
      .select("score, breakdown, computed_at")
      .eq("user_id", userId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      score: data?.score ?? null, verifiedCount, breakdown: data?.breakdown ?? null,
      locked: false, missingFields: [], reason: null,
    };
  });

export const getLoanEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const verifiedCount = await countVerifiedRecords(context.supabase, context.userId);
    if (verifiedCount < MIN_VERIFIED_RECORDS) {
      return { eligible: false, amount: null, reason: "insufficient_data" as const };
    }
    const { count: incomeCount } = await context.supabase
      .from("transactions").select("id", { count: "exact", head: true })
      .eq("user_id", context.userId).eq("type", "income").eq("verified", true);
    if (!incomeCount) return { eligible: false, amount: null, reason: "insufficient_data" as const };
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

// ---------- Maps: shared credential resolution ----------
// Works both inside Lovable (connector gateway) and on any other host
// (a plain Google Maps server key in GOOGLE_MAPS_SERVER_KEY).
function mapsRequest(pathSuffix: "routes" | "places") {
  const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  const lovableKey = process.env.LOVABLE_API_KEY?.trim();
  const connectorKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (serverKey) {
    return {
      url:
        pathSuffix === "routes"
          ? "https://routes.googleapis.com/directions/v2:computeRoutes"
          : "https://places.googleapis.com/v1/places:searchNearby",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": serverKey } as Record<string, string>,
    };
  }
  if (lovableKey && connectorKey) {
    return {
      url:
        pathSuffix === "routes"
          ? "https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes"
          : "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchNearby",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectorKey,
      } as Record<string, string>,
    };
  }
  return null;
}

// OpenStreetMap fallback so nearby search keeps working without any Google key.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function overpassNearby(lat: number, lng: number, includedType: string, radius: number) {
  const filters: Record<string, string> = {
    gas_station: 'node["amenity"="fuel"]',
    hospital: 'node["amenity"~"hospital|clinic|doctors"]',
    electric_vehicle_charging_station: 'node["amenity"="charging_station"]',
    police: 'node["amenity"="police"]',
    pharmacy: 'node["amenity"="pharmacy"]',
    restaurant: 'node["amenity"="restaurant"]',
  };
  const filter = filters[includedType] ?? `node["amenity"="${includedType}"]`;
  const query = `[out:json][timeout:20];${filter}(around:${radius},${lat},${lng});out 15;`;
  // Public Overpass mirrors rate-limit aggressively from cloud IPs (Vercel),
  // so try each mirror before giving up.
  let json: { elements?: Array<{ id: number; lat: number; lon: number; tags?: Record<string, string> }> } | null = null;
  let lastError = "";
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        lastError = `[${res.status}] ${endpoint}`;
        continue;
      }
      json = await res.json();
      break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  if (!json) {
    console.error("[nearby] all Overpass mirrors failed", lastError);
    throw new Error("Nearby search is temporarily unavailable. Please try again in a moment.");
  }
  return (json.elements ?? []).map((e) => ({
    id: String(e.id),
    displayName: { text: e.tags?.name ?? e.tags?.operator ?? "Unnamed place" },
    formattedAddress: [e.tags?.["addr:street"], e.tags?.["addr:city"]].filter(Boolean).join(", ") || undefined,
    location: { latitude: e.lat, longitude: e.lon },
  }));
}

// Straight-line fallback so distance/ETA still render when the Routes API is
// unavailable on a deployment (no server key, restricted key, or outage).
function haversineEstimate(o: { lat: number; lng: number }, d: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(d.lat - o.lat);
  const dLng = toRad(d.lng - o.lng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(o.lat)) * Math.cos(toRad(d.lat)) * Math.sin(dLng / 2) ** 2;
  const meters = Math.round(2 * R * Math.asin(Math.sqrt(a)) * 1.3); // road-factor
  return {
    durationSeconds: Math.round(meters / 8.3), // ~30 km/h urban average
    distanceMeters: meters,
    polyline: null as string | null,
    estimated: true as const,
  };
}

// ---------- Maps: routes/directions ----------
export const computeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }) => v)
  .handler(async ({ data }) => {
    const req = mapsRequest("routes");
    if (!req) return haversineEstimate(data.origin, data.destination);
    try {
      const res = await fetch(req.url, {
        method: "POST",
        headers: {
          ...req.headers,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: data.origin.lat, longitude: data.origin.lng } } },
          destination: { location: { latLng: { latitude: data.destination.lat, longitude: data.destination.lng } } },
          travelMode: "DRIVE",
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error("[routes] Google Routes failed", res.status, (await res.text()).slice(0, 200));
        return haversineEstimate(data.origin, data.destination);
      }
      const json = (await res.json()) as { routes?: Array<{ duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }> };
      const r = json.routes?.[0];
      if (!r) return haversineEstimate(data.origin, data.destination);
      return {
        durationSeconds: r.duration ? Number(String(r.duration).replace("s", "")) : null,
        distanceMeters: r.distanceMeters ?? null,
        polyline: r.polyline?.encodedPolyline ?? null,
        estimated: false as const,
      };
    } catch (e) {
      console.error("[routes] request error", e instanceof Error ? e.message : e);
      return haversineEstimate(data.origin, data.destination);
    }
  });

// ---------- Google Maps: nearby places via connector gateway ----------
export const nearbyPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { lat: number; lng: number; includedType: string; radiusMeters?: number }) => v)
  .handler(async ({ data }) => {
    const radius = data.radiusMeters ?? 8000;
    const req = mapsRequest("places");
    if (!req) return await overpassNearby(data.lat, data.lng, data.includedType, radius);
    let json: { places?: Array<Record<string, unknown>> } | null = null;
    try {
      const res = await fetch(req.url, {
        method: "POST",
        headers: {
          ...req.headers,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({
          includedTypes: [data.includedType],
          maxResultCount: 15,
          locationRestriction: {
            circle: { center: { latitude: data.lat, longitude: data.lng }, radius },
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        // Restricted/invalid/over-quota key in production (403/400/429) or an
        // upstream outage — degrade to OpenStreetMap instead of failing.
        console.error("[nearby] Google Places failed", res.status, (await res.text()).slice(0, 200));
        return await overpassNearby(data.lat, data.lng, data.includedType, radius);
      }
      json = await res.json();
    } catch (e) {
      console.error("[nearby] Google Places request error", e instanceof Error ? e.message : e);
      return await overpassNearby(data.lat, data.lng, data.includedType, radius);
    }
    const places = (json?.places ?? []) as unknown as Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      rating?: number;
      userRatingCount?: number;
    }>;
    // An empty Google result set should still show OSM results rather than "none found".
    if (places.length === 0) {
      try {
        return await overpassNearby(data.lat, data.lng, data.includedType, radius);
      } catch {
        return places;
      }
    }
    return places;
  });