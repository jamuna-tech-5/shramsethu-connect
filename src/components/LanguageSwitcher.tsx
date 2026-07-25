import { Check, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const [q, setQ] = useState("");
  const filtered = LANGUAGES.filter(
    (l) =>
      l.label.toLowerCase().includes(q.toLowerCase()) ||
      l.native.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className={compact ? "" : "rounded-2xl border bg-card p-5 shadow-soft"}>
      {!compact && (
        <>
          <h3 className="text-base font-semibold text-foreground">Choose your language</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You can change this any time in Settings.
          </p>
        </>
      )}
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search language"
          className="pl-9"
        />
      </div>
      <div className="mt-3 grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
        {filtered.map((l) => {
          const active = lang === l.code;
          return (
            <Button
              key={l.code}
              type="button"
              variant={active ? "default" : "outline"}
              onClick={() => setLang(l.code as LangCode)}
              className="justify-between rounded-xl"
            >
              <span className="flex flex-col items-start" data-no-translate>
                <span className="text-sm font-semibold">{l.native}</span>
                <span className="text-[11px] font-normal opacity-70">{l.label}</span>
              </span>
              <span className="flex items-center gap-2">
                {active && <Check className="h-4 w-4" />}
              </span>
            </Button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground" data-no-translate>
        AI-powered translations. Text updates instantly across the entire app.
      </p>
    </div>
  );
}