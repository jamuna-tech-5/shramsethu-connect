import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { translateBatch } from "@/lib/translate.functions";

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

type Ctx = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string, fallback?: string) => string;
  hasTranslations: (l: LangCode) => boolean;
};

const I18nContext = createContext<Ctx | null>(null);

const CACHE_PREFIX = "ss_tr_v1:";
const ATTRS_TO_TRANSLATE = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "SVG", "PATH", "CANVAS", "TEXTAREA"]);
const BATCH_SIZE = 40;

function loadCache(lang: LangCode): Map<string, string> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + lang);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, string>));
  } catch {
    return new Map();
  }
}
function saveCache(lang: LangCode, cache: Map<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(Object.fromEntries(cache)));
  } catch { /* ignore quota */ }
}

function shouldTranslate(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 1) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  return true;
}

function isSkippableElement(el: Element | null): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (SKIP_TAGS.has(cur.tagName)) return true;
    if (cur.hasAttribute && cur.hasAttribute("data-no-translate")) return true;
    if (cur.getAttribute && cur.getAttribute("translate") === "no") return true;
    cur = cur.parentElement;
  }
  return false;
}

type OriginalStore = {
  text: WeakMap<Text, string>;
  attr: WeakMap<Element, Record<string, string>>;
};

function collectNodes(root: Node, store: OriginalStore) {
  const texts: Text[] = [];
  const attrs: { el: Element; name: string }[] = [];
  if (root.nodeType === 1 && isSkippableElement(root as Element)) return { texts, attrs };
  if (root.nodeType === 3) {
    const t = root as Text;
    const known = store.text.get(t);
    if (!isSkippableElement(t.parentElement) && (known != null || shouldTranslate(t.nodeValue ?? ""))) {
      if (known == null) store.text.set(t, t.nodeValue ?? "");
      texts.push(t);
    }
    return { texts, attrs };
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === 1) {
      const el = node as Element;
      if (!isSkippableElement(el)) {
        for (const a of ATTRS_TO_TRANSLATE) {
          const v = el.getAttribute(a);
          const cur = store.attr.get(el) ?? {};
          if (v && (a in cur || shouldTranslate(v))) {
            if (!(a in cur)) cur[a] = v;
            store.attr.set(el, cur);
            attrs.push({ el, name: a });
          }
        }
      }
    } else if (node.nodeType === 3) {
      const t = node as Text;
      const known = store.text.get(t);
      if (!isSkippableElement(t.parentElement) && (known != null || shouldTranslate(t.nodeValue ?? ""))) {
        if (known == null) store.text.set(t, t.nodeValue ?? "");
        texts.push(t);
      }
    }
    node = walker.nextNode();
  }
  return { texts, attrs };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");
  const cacheRef = useRef<Map<string, string>>(new Map());
  const reverseRef = useRef<Set<string>>(new Set());
  const storeRef = useRef<OriginalStore>({ text: new WeakMap(), attr: new WeakMap() });
  const langRef = useRef<LangCode>("en");
  const pendingRef = useRef<Set<string>>(new Set());
  const scheduledRef = useRef<number | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  langRef.current = lang;

  const rebuildReverse = useCallback(() => {
    reverseRef.current = new Set(cacheRef.current.values());
  }, []);

  const applyOnly = useCallback((texts: Text[], attrs: { el: Element; name: string }[]) => {
    const cache = cacheRef.current;
    const store = storeRef.current;
    const currentLang = langRef.current;
    const missing = new Set<string>();
    for (const t of texts) {
      const original = store.text.get(t) ?? t.nodeValue ?? "";
      if (currentLang === "en") { if (t.nodeValue !== original) t.nodeValue = original; continue; }
      const key = original.trim();
      if (!key) continue;
      const translated = cache.get(key);
      if (translated) {
        const leading = original.match(/^\s*/)?.[0] ?? "";
        const trailing = original.match(/\s*$/)?.[0] ?? "";
        const next = leading + translated + trailing;
        if (t.nodeValue !== next) t.nodeValue = next;
      } else {
        missing.add(key);
      }
    }
    for (const { el, name } of attrs) {
      const originals = store.attr.get(el) ?? {};
      const original = originals[name] ?? el.getAttribute(name) ?? "";
      if (currentLang === "en") { if (el.getAttribute(name) !== original) el.setAttribute(name, original); continue; }
      const key = original.trim();
      if (!key) continue;
      const translated = cache.get(key);
      if (translated) {
        if (el.getAttribute(name) !== translated) el.setAttribute(name, translated);
      } else {
        missing.add(key);
      }
    }
    if (missing.size > 0 && currentLang !== "en") {
      for (const m of missing) pendingRef.current.add(m);
      scheduleFlush();
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (scheduledRef.current != null) return;
    scheduledRef.current = window.setTimeout(async () => {
      scheduledRef.current = null;
      const currentLang = langRef.current;
      if (currentLang === "en" || pendingRef.current.size === 0) return;
      const items = Array.from(pendingRef.current);
      pendingRef.current.clear();
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        try {
          const { translations } = await translateBatch({ data: { texts: batch, lang: currentLang } });
          if (langRef.current !== currentLang) return;
          const cache = cacheRef.current;
          batch.forEach((src, idx) => {
            const tr = translations[idx];
            if (tr && typeof tr === "string") cache.set(src, tr);
          });
          saveCache(currentLang, cache);
        } catch (e) {
          console.warn("translateBatch failed", e);
        }
      }
      rebuildReverse();
      // Re-apply across whole document with new cache entries.
      if (typeof document !== "undefined") {
        const { texts, attrs } = collectNodes(document.body, storeRef.current);
        applyOnly(texts, attrs);
      }
    }, 80);
  }, [applyOnly, rebuildReverse]);

  const retranslateAll = useCallback(() => {
    if (typeof document === "undefined") return;
    const { texts, attrs } = collectNodes(document.body, storeRef.current);
    applyOnly(texts, attrs);
  }, [applyOnly]);

  // Boot: pick saved language from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("ss_lang");
    if (stored && LANGUAGES.some((l) => l.code === stored) && stored !== "en") {
      cacheRef.current = loadCache(stored as LangCode);
      rebuildReverse();
      setLangState(stored as LangCode);
    }
    const onLang = (e: Event) => {
      const detail = (e as CustomEvent).detail as { lang?: string } | undefined;
      const code = detail?.lang;
      if (code && LANGUAGES.some((l) => l.code === code)) {
        setLangState((prev) => (prev === code ? prev : (code as LangCode)));
      }
    };
    window.addEventListener("shramsethu:lang", onLang as EventListener);
    return () => window.removeEventListener("shramsethu:lang", onLang as EventListener);
  }, [rebuildReverse]);

  // Whenever lang changes: load its cache, scan DOM, translate, observe mutations.
  useEffect(() => {
    if (typeof document === "undefined") return;
    cacheRef.current = lang === "en" ? new Map() : loadCache(lang);
    rebuildReverse();
    // set <html lang>
    try { document.documentElement.setAttribute("lang", lang); } catch { /* ignore */ }
    retranslateAll();

    observerRef.current?.disconnect();
    const observer = new MutationObserver((mutations) => {
      const texts: Text[] = [];
      const attrs: { el: Element; name: string }[] = [];
      const seen = new Set<Node>();
      for (const m of mutations) {
        if (m.type === "characterData") {
          const t = m.target as Text;
          if (!t.parentElement || isSkippableElement(t.parentElement)) continue;
          const currentText = t.nodeValue ?? "";
          const known = storeRef.current.text.get(t);
          if (known == null && !shouldTranslate(currentText)) continue;
          // If the mutation matches a known translation, ignore (it was us).
          if (reverseRef.current.has(currentText.trim())) continue;
          // Only adopt a new source string when it looks like source text; a
          // non-latin value here is a leftover translation from another language.
          if (shouldTranslate(currentText) && currentText.trim() !== (known ?? "").trim()) {
            storeRef.current.text.set(t, currentText);
          } else if (known == null) {
            storeRef.current.text.set(t, currentText);
          }
          texts.push(t);
        } else if (m.type === "attributes" && m.target.nodeType === 1) {
          const el = m.target as Element;
          const name = m.attributeName ?? "";
          if (!(ATTRS_TO_TRANSLATE as readonly string[]).includes(name)) continue;
          const v = el.getAttribute(name) ?? "";
          const cur = storeRef.current.attr.get(el) ?? {};
          if (!(name in cur) && !shouldTranslate(v)) continue;
          if (reverseRef.current.has(v.trim())) continue;
          if (shouldTranslate(v)) {
            cur[name] = v;
            storeRef.current.attr.set(el, cur);
          }
          attrs.push({ el, name });
        } else if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if (seen.has(n)) return;
            seen.add(n);
            if (n.nodeType === 1 || n.nodeType === 3) {
              const collected = collectNodes(n, storeRef.current);
              texts.push(...collected.texts);
              attrs.push(...collected.attrs);
            }
          });
        }
      }
      if (texts.length || attrs.length) applyOnly(texts, attrs);
    });
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ATTRS_TO_TRANSLATE as unknown as string[],
    });
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [lang, retranslateAll, applyOnly, rebuildReverse]);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("ss_lang", l);
    import("@/lib/api.functions").then(({ updateMySettings }) => {
      updateMySettings({ data: { language: l } }).catch(() => {});
    }).catch(() => {});
  }, []);

  const t = (key: string, fallback?: string) => fallback ?? key;
  const hasTranslations = (_l: LangCode) => true;

  return (
    <I18nContext.Provider value={{ lang, setLang, t, hasTranslations }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
