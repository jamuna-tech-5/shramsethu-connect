import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  size?: number;
  disabled?: boolean;
};

/** 3x3 pattern lock. Value is a dash-joined dot sequence, e.g. "0-3-6-7". */
export function PatternLock({ value, onChange, size = 220, disabled }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [path, setPath] = useState<number[]>(value ? value.split("-").filter(Boolean).map(Number) : []);

  useEffect(() => {
    setPath(value ? value.split("-").filter(Boolean).map(Number) : []);
  }, [value]);

  const dotAt = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cell = r.width / 3;
    for (let i = 0; i < 9; i++) {
      const cx = r.left + (i % 3) * cell + cell / 2;
      const cy = r.top + Math.floor(i / 3) * cell + cell / 2;
      if (Math.hypot(clientX - cx, clientY - cy) < cell * 0.34) return i;
    }
    return null;
  }, []);

  const push = (i: number | null) => {
    if (i === null) return;
    setPath((p) => (p.includes(i) ? p : [...p, i]));
  };

  const finish = () => {
    if (!drawing) return;
    setDrawing(false);
    onChange(path.join("-"));
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={ref}
        style={{ width: size, height: size, touchAction: "none" }}
        className={`relative grid grid-cols-3 rounded-2xl border bg-muted/40 p-3 ${disabled ? "opacity-60" : ""}`}
        onPointerDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          setPath([]);
          setDrawing(true);
          const i = dotAt(e.clientX, e.clientY);
          if (i !== null) setPath([i]);
        }}
        onPointerMove={(e) => {
          if (!drawing || disabled) return;
          push(dotAt(e.clientX, e.clientY));
        }}
        onPointerUp={finish}
        onPointerLeave={finish}
      >
        {Array.from({ length: 9 }).map((_, i) => {
          const active = path.includes(i);
          return (
            <div key={i} className="grid place-items-center">
              <button
                type="button"
                aria-label={`Dot ${i + 1}`}
                disabled={disabled}
                onClick={() => {
                  if (disabled || drawing) return;
                  const next = path.includes(i) ? path : [...path, i];
                  setPath(next);
                  onChange(next.join("-"));
                }}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  active ? "border-primary bg-primary" : "border-border bg-background"
                }`}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {path.length ? `${path.length} dot(s) connected` : "Draw or tap at least 4 dots"}
      </p>
    </div>
  );
}
