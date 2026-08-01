import { createServerFn } from "@tanstack/react-start";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  kn: "Kannada",
  te: "Telugu",
  ta: "Tamil",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
};

export const translateBatch = createServerFn({ method: "POST" })
  .inputValidator((v: { texts: string[]; lang: string }) => v)
  .handler(async ({ data }) => {
    const { texts, lang } = data;
    if (!texts?.length || lang === "en" || !LANG_NAMES[lang]) {
      return { translations: texts ?? [] };
    }
    const { aiPrompt } = await import("@/lib/ai.server");
    const target = LANG_NAMES[lang];
    const system = `You are a professional UI localizer. Translate each string in the provided JSON array from English to ${target}.
Rules:
- Return ONLY a valid JSON array of strings, same length, same order as input. No prose, no code fences.
- Preserve punctuation, emoji, numbers, currency (₹), URLs, e-mails, brand names (ShramSethu, GigScore, Aadhaar, PAN, Zomato, Swiggy, Uber, Ola, Rapido, Namma Yatri, Porter, Google, SOS), and placeholders like {name}, %s, %d, $1.
- Keep translations short and natural for buttons/labels; do not add explanations.
- If a string is a brand/proper noun or empty, keep it unchanged.`;

    const content = await aiPrompt({
      system,
      prompt: JSON.stringify(texts),
    });
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\[[\s\S]*\]/);
      parsed = m ? JSON.parse(m[0]) : [];
    }
    const arr = Array.isArray(parsed) ? (parsed as unknown[]).map((x) => String(x ?? "")) : [];
    // Ensure output length matches input; fall back to English for missing entries.
    const translations = texts.map((t, i) => (arr[i] && arr[i].length > 0 ? arr[i] : t));
    return { translations };
  });