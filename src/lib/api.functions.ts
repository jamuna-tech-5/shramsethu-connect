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
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
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
  .inputValidator((v: { kind: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number }) => v)
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
      status: "triggered",
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
      context.supabase.from("sos_events").select("id", { count: "exact", head: true }).eq("status", "triggered"),
      context.supabase.from("profiles").select("id", { count: "exact", head: true }).in("status", ["online","on_duty","available"]),
    ]);
    return {
      registeredWorkers: workers.count ?? 0,
      pendingVerifications: pending.count ?? 0,
      openSOS: sos.count ?? 0,
      activeToday: active.count ?? 0,
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
    return json.places ?? [];
  });