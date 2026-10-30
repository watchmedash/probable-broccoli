"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { Hub } from "@/lib/types";

/** Shares a post into one of your hubs (or your profile) with its own title. */
export function Crosspost({ original, hubs }: { original: { id: number; title: string; where: string }; hubs: Hub[] }) {
  const [hubId, setHubId] = useState<number | null>(hubs[0]?.id ?? null);
  const [title, setTitle] = useState(original.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="form-page">
      <h1>Crosspost</h1>
      <p className="muted" style={{ margin: 0 }}>Sharing &quot;{original.title}&quot; from {original.where}.</p>
      <div className="field">
        <label htmlFor="hub">Share to</label>
        <select id="hub" value={hubId ?? ""} onChange={e => setHubId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Your profile</option>
          {hubs.map(h => <option key={h.id} value={h.id}>n/{h.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" value={title} maxLength={300} onChange={e => setTitle(e.target.value)} />
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button
        className="btn block"
        disabled={busy || !title.trim()}
        onClick={async () => {
          setBusy(true);
          const { data, error } = await browserSupabase().rpc("create_post", {
            hub_id: hubId, post_title: title.trim(), post_body: "", image: null, poll_options: null,
            flair: null, share_of: original.id, is_spoiler: false, is_mature: false, images: null,
          });
          setBusy(false);
          if (error) return setError(errorMessage(error));
          router.push(`/p/${data}`);
          router.refresh();
        }}
      >
        Share
      </button>
    </div>
  );
}
