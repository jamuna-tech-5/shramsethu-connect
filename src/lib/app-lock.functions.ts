import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Starts App Lock recovery for the CURRENTLY SIGNED-IN user only.
 * The one-time token is bound to that user's id, so a link can never reset
 * another account's app lock.
 */
export const requestAppLockReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { origin: string }) => v)
  .handler(async ({ data, context }) => {
    const {
      normalizePhone,
      phoneTail,
      randomToken,
      sha256Hex,
      sendRecoverySms,
      smsConfigured,
    } = await import("./app-lock.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("phone")
      .eq("id", context.userId)
      .maybeSingle();

    const phone = normalizePhone(String(profile?.phone ?? ""));
    if (phone.replace(/\D/g, "").length < 10) {
      return {
        ok: false as const,
        error: "No mobile number is registered on your profile. Add one in Profile, then try again.",
      };
    }

    // Invalidate this user's previous unused links.
    await supabaseAdmin
      .from("app_lock_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("used_at", null);

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("app_lock_resets").insert({
      token_hash: tokenHash,
      phone,
      user_id: context.userId,
      expires_at: expiresAt,
    });
    if (error) return { ok: false as const, error: "Could not create a recovery link. Try again." };

    const base = String(data.origin ?? "").replace(/\/$/, "");
    const link = `${base}/reset-lock?token=${token}`;
    const sms = await sendRecoverySms(
      phone,
      `ShramSethu: reset your app lock using this one-time link (valid 15 minutes): ${link}. Do not share it with anyone.`,
    );

    return {
      ok: true as const,
      sent: sms.sent,
      smsConfigured: smsConfigured(),
      reason: sms.reason,
      maskedPhone: `••••••${phoneTail(phone)}`,
      // Only returned when no SMS provider is configured, so recovery still works.
      link: sms.sent ? undefined : link,
    };
  });

export const verifyAppLockReset = createServerFn({ method: "POST" })
  .inputValidator((v: { token: string }) => v)
  .handler(async ({ data }) => {
    const { sha256Hex, phoneTail } = await import("./app-lock.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = await sha256Hex(String(data.token ?? ""));
    const { data: row } = await supabaseAdmin
      .from("app_lock_resets")
      .select("id, phone, expires_at, used_at, user_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "This recovery link is not valid." };
    if (row.used_at) return { ok: false as const, error: "This recovery link has already been used." };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "This recovery link has expired. Request a new one." };
    }
    const { data: lock } = await supabaseAdmin
      .from("user_app_locks")
      .select("method")
      .eq("user_id", row.user_id ?? "")
      .maybeSingle();
    return {
      ok: true as const,
      maskedPhone: `••••••${phoneTail(row.phone)}`,
      method: (lock?.method ?? "pin4") as string,
    };
  });

/**
 * Consumes the one-time token and writes the NEW credential for the single
 * user that token belongs to. The hash + salt are computed in the browser, so
 * the plain credential never reaches the server.
 */
export const consumeAppLockReset = createServerFn({ method: "POST" })
  .inputValidator(
    (v: { token: string; method: string; salt: string; hash: string; iterations: number }) => v,
  )
  .handler(async ({ data }) => {
    const { sha256Hex } = await import("./app-lock.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const method = String(data.method ?? "");
    if (!["password", "pin4", "pin6", "pattern"].includes(method)) {
      return { ok: false as const, error: "Unsupported authentication method." };
    }
    if (!data.salt || !data.hash) {
      return { ok: false as const, error: "Missing credential data. Try again." };
    }

    const tokenHash = await sha256Hex(String(data.token ?? ""));
    const { data: row } = await supabaseAdmin
      .from("app_lock_resets")
      .select("id, expires_at, used_at, user_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!row || row.used_at || !row.user_id || new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "This recovery link is no longer valid." };
    }

    const { error: upErr } = await supabaseAdmin.from("user_app_locks").upsert(
      {
        user_id: row.user_id,
        enabled: true,
        method,
        salt: data.salt,
        secret_hash: data.hash,
        iterations: Number(data.iterations) || 150000,
      },
      { onConflict: "user_id" },
    );
    if (upErr) return { ok: false as const, error: "Could not save the new credential. Try again." };

    const { error } = await supabaseAdmin
      .from("app_lock_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null);
    if (error) return { ok: false as const, error: "Could not complete the reset. Try again." };
    return { ok: true as const };
  });
