// Server-only AI helper. Works on ANY host (Lovable preview, Vercel, self-hosted)
// by supporting three interchangeable providers, resolved at call time:
//   1. LOVABLE_API_KEY  -> Lovable AI Gateway (default inside Lovable)
//   2. GEMINI_API_KEY   -> Google Generative Language API (direct)
//   3. OPENAI_API_KEY   -> OpenAI chat completions (direct)

export type AiAttachment = { mime: string; b64: string; filename?: string };

export type AiProviderInfo =
  | { provider: "lovable"; key: string }
  | { provider: "gemini"; key: string }
  | { provider: "openai"; key: string }
  | null;

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI is not configured on this deployment. Add LOVABLE_API_KEY (Lovable AI) or GEMINI_API_KEY or OPENAI_API_KEY to your hosting environment variables and redeploy.";

export function resolveAiProvider(): AiProviderInfo {
  const lovable = process.env.LOVABLE_API_KEY?.trim();
  if (lovable) return { provider: "lovable", key: lovable };
  const gemini = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim();
  if (gemini) return { provider: "gemini", key: gemini };
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) return { provider: "openai", key: openai };
  return null;
}

function modelFor(provider: "lovable" | "gemini" | "openai") {
  if (provider === "lovable") return process.env.AI_MODEL?.trim() || "google/gemini-2.5-flash";
  if (provider === "gemini") return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

/**
 * Runs a single-turn prompt (optionally with one image/PDF attachment) and
 * returns the raw model text. `json: true` asks the provider for JSON output.
 */
export async function aiPrompt(opts: {
  prompt: string;
  attachment?: AiAttachment;
  json?: boolean;
  system?: string;
}): Promise<string> {
  const resolved = resolveAiProvider();
  if (!resolved) throw new Error(AI_NOT_CONFIGURED_MESSAGE);
  const { provider, key } = resolved;
  const model = modelFor(provider);

  if (provider === "gemini") {
    const parts: Array<Record<string, unknown>> = [{ text: opts.prompt }];
    if (opts.attachment) {
      parts.push({ inlineData: { mimeType: opts.attachment.mime, data: opts.attachment.b64 } });
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
          generationConfig: opts.json ? { responseMimeType: "application/json" } : {},
        }),
      },
    );
    if (!res.ok) throw new Error(`AI error [${res.status}]: ${(await res.text()).slice(0, 300)}`);
    const j = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  }

  // OpenAI-compatible shape (Lovable AI Gateway and OpenAI)
  const content: Array<Record<string, unknown>> = [{ type: "text", text: opts.prompt }];
  if (opts.attachment) {
    if (opts.attachment.mime.startsWith("image/")) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${opts.attachment.mime};base64,${opts.attachment.b64}` },
      });
    } else {
      content.push({
        type: "file",
        file: {
          filename: opts.attachment.filename ?? "document",
          file_data: `data:${opts.attachment.mime};base64,${opts.attachment.b64}`,
        },
      });
    }
  }

  const url =
    provider === "lovable"
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
  const headers: Record<string, string> =
    provider === "lovable"
      ? { "Content-Type": "application/json", "Lovable-API-Key": key }
      : { "Content-Type": "application/json", Authorization: `Bearer ${key}` };

  const messages: Array<Record<string, unknown>> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI error [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

export function parseJsonLoose<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return fallback;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return fallback;
    }
  }
}