"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { renderMarkdown } from "@/lib/markdown";
import { uploadImage } from "@/lib/upload";
import { Icon, I } from "./Icon";

/** Authors can change the title, the text and the picture. The hub and any poll stay as posted. */
export function EditPost({ id, title: t0, body: b0, image: i0, gallery }: { id: number; title: string; body: string; image: string | null; gallery: boolean }) {
  const [title, setTitle] = useState(t0);
  const [body, setBody] = useState(b0);
  const [image, setImage] = useState(i0);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="form-page" style={{ maxWidth: 720 }}>
      <h1>Edit post</h1>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" value={title} maxLength={300} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <div style={{ display: "flex" }}>
          <label htmlFor="body" style={{ flex: 1 }}>Text</label>
          <button type="button" className="linkish small" onClick={() => setPreview(p => !p)}>{preview ? "Edit" : "Preview"}</button>
        </div>
        {preview
          ? <div className="md" style={{ minHeight: 160, padding: 12, border: "1px solid var(--outline)", borderRadius: 4 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(body || "*Nothing to preview*") }} />
          : <textarea id="body" value={body} maxLength={40000} onChange={e => setBody(e.target.value)} />}
      </div>
      {!gallery && (
        <div className="toolbar" style={{ alignItems: "center" }}>
          {image && (
            <div className="thumbs"><div><img src={image} alt="" /><button aria-label="Remove picture" onClick={() => setImage(null)}><Icon icon={I.close} size={11} /></button></div></div>
          )}
          <label className="btn quiet">
            <Icon icon={I.imageOutline} size={14} /> {image ? "Change picture" : "Add a picture"}
            <input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={async e => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try { setImage(await uploadImage(f, "post-images")); } catch (err) { setError(errorMessage(err)); }
            }} />
          </label>
        </div>
      )}
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn quiet" onClick={() => router.back()}>Cancel</button>
        <button
          className="btn"
          style={{ flex: 1 }}
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            const change: Record<string, unknown> = { title: title.trim(), body };
            if (!gallery) change.image_url = image;
            const { error } = await browserSupabase().from("posts").update(change).eq("id", id);
            setBusy(false);
            if (error) return setError(errorMessage(error));
            router.push(`/p/${id}`);
            router.refresh();
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
