import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
export const listMyDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, kind, status, file_name, created_at, verified_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const recordDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { kind: "aadhaar" | "pan" | "license" | "other"; storage_path: string; file_name: string; mime_type: string; size_bytes: number }) => v)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("documents").insert({
      user_id: context.userId,
      kind: data.kind,
      storage_path: data.storage_path,
      file_name: data.file_name,
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
      .select("id, code, name, authority, category, summary, benefits, eligibility")
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
      .select("*")
      .eq("user_id", context.userId)
      .order("occurred_on", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyGigscore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Only return a score if enough verified work exists.
    const { count } = await context.supabase
      .from("work_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("verified", true);
    const verifiedCount = count ?? 0;
    if (verifiedCount < 5) return { score: null, verifiedCount, reason: "insufficient_data" as const };
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
    const [{ count: verifiedWork }, { data: gig }] = await Promise.all([
      context.supabase.from("work_history").select("id", { count: "exact", head: true }).eq("user_id", context.userId).eq("verified", true),
      context.supabase.from("gigscore_snapshots").select("score").eq("user_id", context.userId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if ((verifiedWork ?? 0) < 5 || !gig?.score) {
      return { eligible: false, amount: null, reason: "insufficient_data" as const };
    }
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
      _doc_id: data.docId, _decision: data.decision, _note: data.note ?? null,
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