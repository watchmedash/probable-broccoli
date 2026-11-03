"use client";
import { CATEGORIES } from "@/lib/categories";

/** Tick categories, up to [max]. Once full, the rest wait until one is unticked. */
export function CategoryPicker({ value, onChange, max }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const full = max != null && value.length >= max;
  return (
    <div className="picker categories">
      {CATEGORIES.map(([slug, label]) => {
        const on = value.includes(slug);
        return (
          <label key={slug} style={{ opacity: full && !on ? 0.5 : 1 }}>
            <input
              type="checkbox"
              checked={on}
              disabled={full && !on}
              onChange={() => onChange(on ? value.filter(v => v !== slug) : [...value, slug])}
              style={{ width: 18, height: 18, accentColor: "var(--blue)", flex: "none" }}
            />
            <span>{label}</span>
          </label>
        );
      })}
    </div>
  );
}
