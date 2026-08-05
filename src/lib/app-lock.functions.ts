import { createServerFn } from "@tanstack/react-start";

export const requestAppLockReset = createServerFn({ method: "POST" })
  .inputValidator((v: { phone: string; origin: string }) => v)
  .handler(async ({ data }) => {
    const {
      normalizePhone,
      phoneTail,
      randomToken,
      sha256Hex,
      sendRecoverySms,
      smsConfigured,
    } = await import("./app-lock.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const phone = normalizePhone(String(data.phone ?? ""));
    if (phone.replace(/\D/g, "").length < 10) {
      return { ok: false as const, error: "Enter the mobile number registered on your profile." };
    }

    const digits = phone.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .not("phone", "is", null);
    const match = (rows ?? []).find(
      (r) => (r.phone ?? "").replace(/\D/g, "").slice(-10) === last10,
    );
    if (!match) {
      return { ok: false as const, error: "No ShramSethu profile is registered with that number." };
    }

    // Invalidate previous unused links for this number.
    await supabaseAdmin
      .from("app_lock_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("phone", phone)
      .is("used_at", null);

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("app_lock_resets").insert({
      token_hash: tokenHash,
      phone,
      user_id: match.id,
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
      .select("id, phone, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "This recovery link is not valid." };
    if (row.used_at) return { ok: false as const, error: "This recovery link has already been used." };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "This recovery link has expired. Request a new one." };
    }
    return { ok: true as const, maskedPhone: `••••••${phoneTail(row.phone)}` };
  });

export const consumeAppLockReset = createServerFn({ method: "POST" })
  .inputValidator((v: { token: string }) => v)
  .handler(async ({ data }) => {
    const { sha256Hex } = await import("./app-lock.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = await sha256Hex(String(data.token ?? ""));
    const { data: row } = await supabaseAdmin
      .from("app_lock_resets")
      .select("id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "This recovery link is no longer valid." };
    }
    const { error } = await supabaseAdmin
      .from("app_lock_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null);
    if (error) return { ok: false as const, error: "Could not complete the reset. Try again." };
    return { ok: true as const };
  });
