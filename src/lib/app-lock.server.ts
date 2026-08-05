// Server-only helpers for App Lock recovery over SMS.
import { serverEnv, serverEnvAny } from "./env.server";

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return `+${digits}`;
}

export function phoneTail(phone: string) {
  const d = phone.replace(/[^\d]/g, "");
  return d.slice(-4);
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export function smsConfigured(): boolean {
  return !!(serverEnv("LOVABLE_API_KEY") && serverEnvAny("TWILIO_API_KEY"));
}

/**
 * Sends the recovery SMS through the Twilio connector gateway.
 * Returns { sent: false, reason } when no SMS provider is configured so the
 * caller can fall back to showing the link in-app.
 */
export async function sendRecoverySms(
  to: string,
  body: string,
): Promise<{ sent: boolean; reason?: string }> {
  const lovableKey = serverEnv("LOVABLE_API_KEY");
  const twilioKey = serverEnvAny("TWILIO_API_KEY");
  const from = serverEnvAny("TWILIO_FROM_NUMBER", "TWILIO_PHONE_NUMBER");
  if (!lovableKey || !twilioKey) return { sent: false, reason: "sms_provider_not_configured" };
  if (!from) return { sent: false, reason: "sms_sender_number_missing" };
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`SMS send failed [${res.status}]: ${text}`);
      return { sent: false, reason: `provider_error_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("SMS send threw", e);
    return { sent: false, reason: "sms_request_failed" };
  }
}
