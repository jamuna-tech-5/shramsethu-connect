import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

// Only English is currently populated. Structure is ready for future translations.
const dictionaries: Record<string, Record<string, string>> = {
  en: {},
};

type Ctx = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string, fallback?: string) => string;
  hasTranslations: (l: LangCode) => boolean;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("ss_lang") : null;
    if (stored && LANGUAGES.some((l) => l.code === stored)) setLangState(stored as LangCode);
  }, []);

  const setLang = (l: LangCode) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("ss_lang", l);
  };

  const t = (key: string, fallback?: string) => {
    const dict = dictionaries[lang] ?? {};
    return dict[key] ?? fallback ?? key;
  };

  const hasTranslations = (l: LangCode) => l === "en" || Object.keys(dictionaries[l] ?? {}).length > 0;

  return (
    <I18nContext.Provider value={{ lang, setLang, t, hasTranslations }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}