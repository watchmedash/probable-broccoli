"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
const NAME = /^[A-Za-z0-9_]{3,21}$/;

export function CreateHub() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="form-page">
      <h1>Create a hub</h1>
      <div className="field">
        <label htmlFor="name">Name</label>
        <div className="prefix"><span>n/</span><input id="name" value={name} maxLength={21} onChange={e => { setName(e.target.value.trim()); setError(null); }} autoCapitalize="none" spellCheck={false} style={{ height: 42 }} /></div>
        <span className="muted small">3 to 21 letters, numbers or _. You can&apos;t change it later.</span>
      </div>
      <div className="field">
        <label htmlFor="desc">What&apos;s it about? (optional)</label>
        <textarea id="desc" value={description} maxLength={300} onChange={e => setDescription(e.target.value)} style={{ minHeight: 80 }} />
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button
        className="btn block"
        disabled={busy}
        onClick={async () => {
          if (!NAME.test(name)) return setError("Hub names are 3 to 21 letters, numbers or _");
          setBusy(true);
          const { data, error } = await browserSupabase().from("communities").insert({ name, description: description.trim() }).select("name").single();
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
