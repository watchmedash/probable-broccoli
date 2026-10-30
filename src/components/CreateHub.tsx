"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { HubIcon } from "./Avatars";

// Colours a hub can pick, as in the app. Blues first; never orange.
const COLORS = ["#2563EB", "#0EA5E9", "#4F46E5", "#7C3AED", "#0D9488", "#10B981", "#EC4899", "#64748B"];
const NAME = /^[A-Za-z0-9_]{3,21}$/;

export function CreateHub() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="form-page">
      <h1>Create a hub</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <HubIcon hub={{ name: name || "?", color, icon_url: null }} size={48} />
        <b>n/{name || "name"}</b>
      </div>
      <div className="field">
        <label htmlFor="name">Name</label>
        <div className="prefix"><span>n/</span><input id="name" value={name} maxLength={21} onChange={e => { setName(e.target.value.trim()); setError(null); }} autoCapitalize="none" spellCheck={false} style={{ height: 42 }} /></div>
        <span className="muted small">3 to 21 letters, numbers or _. You can&apos;t change it later.</span>
      </div>
      <div className="field">
        <label htmlFor="desc">What&apos;s it about? (optional)</label>
        <textarea id="desc" value={description} maxLength={300} onChange={e => setDescription(e.target.value)} style={{ minHeight: 80 }} />
      </div>
      <div className="field">
        <label>Colour</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COLORS.map(c => <button key={c} aria-label={c} aria-pressed={c === color} onClick={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: c === color ? "3px solid var(--ink)" : 0, cursor: "pointer" }} />)}
        </div>
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button
        className="btn block"
        disabled={busy}
        onClick={async () => {
          if (!NAME.test(name)) return setError("Hub names are 3 to 21 letters, numbers or _");
          setBusy(true);
          const { data, error } = await browserSupabase().from("communities").insert({ name, description: description.trim(), color }).select("name").single();
          setBusy(false);
          if (error) return setError(error.code === "23505" ? "That name is taken" : errorMessage(error));
          router.push(`/n/${data.name}`);
          router.refresh();
        }}
      >
        Create hub
      </button>
    </div>
  );
}
