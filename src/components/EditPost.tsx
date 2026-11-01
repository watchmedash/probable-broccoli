"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { uploadImage } from "@/lib/upload";
import { Icon, I } from "./Icon";
import { MarkdownEditor } from "./MarkdownEditor";

const MAX_GALLERY = 10;

/** Authors can change the title, the text and the gallery. The hub and any poll stay as posted. */
export function EditPost({ id, title: t0, body: b0, pictures: p0, imagesAllowed }: { id: number; title: string; body: string; pictures: string[]; imagesAllowed: boolean }) {
  const [title, setTitle] = useState(t0);
  const [body, setBody] = useState(b0);
  const [pictures, setPictures] = useState(p0);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function addToGallery(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all([...files].slice(0, MAX_GALLERY - pictures.length).map(f => uploadImage(f, "post-images")));
      setPictures(g => [...g, ...urls]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="form-page" style={{ maxWidth: 720 }}>
      <h1>Edit post</h1>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" value={title} maxLength={300} onChange={e => setTitle(e.target.value)} />
      </div>
      <MarkdownEditor id="body" label="Text" value={body} onChange={setBody} maxLength={50000} />
      {pictures.length > 0 && (
        <div className="thumbs">
          {pictures.map(u => (
            <div key={u}>
              <img src={u} alt="" />
              <button aria-label="Remove picture" onClick={() => setPictures(g => g.filter(x => x !== u))}><Icon icon={I.close} size={11} /></button>
            </div>
          ))}
        </div>
      )}
      {imagesAllowed && (
        <div className="toolbar">
          <label className="btn quiet" style={{ cursor: pictures.length >= MAX_GALLERY ? "default" : "pointer" }}>
            <Icon icon={I.imageOutline} size={14} /> {uploading ? "Uploading..." : pictures.length ? `Gallery ${pictures.length}/${MAX_GALLERY}` : "Gallery"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden disabled={uploading || pictures.length >= MAX_GALLERY} onChange={e => { addToGallery(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      )}
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn quiet" onClick={() => router.back()}>Cancel</button>
        <button
          className="btn"
          style={{ flex: 1 }}
          disabled={busy || uploading || !title.trim()}
          onClick={async () => {
            setBusy(true);
            const change = { title: title.trim(), body, image_url: pictures[0] ?? null, image_urls: pictures.length > 1 ? pictures : null };
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
