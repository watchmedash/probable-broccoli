"use client";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";

/** A small dialog: title, optional text field, and Cancel plus one action. With [reasonsFor] (a hub), its saved removal reasons fill the field. */
export function AskDialog({ title, text, field, placeholder, action, danger, onClose, onConfirm, reasonsFor }: {
  title: string; text?: string; field?: boolean; placeholder?: string; action: string; danger?: boolean;
  onClose: () => void; onConfirm: (value: string) => Promise<string | void> | string | void; reasonsFor?: number | null;
}) {
  const [value, setValue] = useState("");
  const [reasons, setReasons] = useState<{ id: number; title: string; body: string }[]>([]);
  useEffect(() => {
    if (!reasonsFor) return;
    browserSupabase().from("hub_removal_reasons").select("id,title,body").eq("hub_id", reasonsFor).order("created_at")
      .then(({ data }) => setReasons(data ?? []));
  }, [reasonsFor]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="dialog-back" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal aria-label={title} onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        {text && <p style={{ margin: 0 }}>{text}</p>}
        {field && reasons.length > 0 && (
          <select aria-label="Saved reasons" defaultValue="" onChange={e => { const r = reasons.find(x => String(x.id) === e.target.value); if (r) setValue(r.body ? `${r.title}: ${r.body}` : r.title); }} style={{ height: 40, padding: "0 12px", border: "1px solid var(--outline)", borderRadius: 4, background: "var(--surface)" }}>
            <option value="" disabled>Pick a saved reason</option>
            {reasons.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        )}
        {field && (
          <div className="field">
            <textarea value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} maxLength={500} style={{ minHeight: 80 }} autoFocus />
          </div>
        )}
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div className="row">
          <button className="btn quiet" onClick={onClose}>Cancel</button>
          <button
            className={`btn ${danger ? "danger" : ""}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const problem = await onConfirm(value.trim());
              setBusy(false);
              if (problem) setError(problem);
              else onClose();
            }}
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pick one option from a list (used for post prefixes). */
export function PickDialog<T extends string | number>({ title, options, current, onClose, onPick }: {
  title: string; options: { value: T | null; label: string; color?: string }[]; current: T | null; onClose: () => void; onPick: (v: T | null) => Promise<string | void>;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="dialog-back" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal aria-label={title} onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="picker">
          {options.map(o => (
            <label key={String(o.value)}>
              <input
                type="radio"
                checked={o.value === current}
                onChange={async () => {
                  const problem = await onPick(o.value);
                  if (problem) setError(problem);
                  else onClose();
                }}
              />
              {o.color && <span className="flair" style={{ background: o.color, margin: 0 }}>{o.label}</span>}
              {!o.color && o.label}
            </label>
          ))}
        </div>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div className="row"><button className="btn quiet" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
