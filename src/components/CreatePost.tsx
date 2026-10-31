"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { Flair, Hub } from "@/lib/types";
import { Icon, I } from "./Icon";
import { MarkdownEditor } from "./MarkdownEditor";

const MAX_IMAGES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

export function CreatePost({ hubs, initialHub, uid }: { hubs: Hub[]; initialHub: number | null; uid: string }) {
  const [hubId, setHubId] = useState<number | null>(initialHub);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pollOn, setPollOn] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [flairs, setFlairs] = useState<Flair[]>([]);
  const [flair, setFlair] = useState<number | null>(null);
  const [spoiler, setSpoiler] = useState(false);
  const [mature, setMature] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const hub = hubs.find(h => h.id === hubId) ?? null;
  const imagesAllowed = !hub || hub.allow_images;
  const pollsAllowed = !hub || hub.allow_polls;

  useEffect(() => {
    setFlair(null);
    setFlairs([]);
    if (hubId == null) return;
    browserSupabase().from("hub_flairs").select("id,label,color").eq("hub_id", hubId).order("label").then(({ data }) => setFlairs((data ?? []) as Flair[]));
  }, [hubId]);

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    const list = [...files].slice(0, room);
    if (list.some(f => f.size > MAX_BYTES)) return setError("Pictures can be up to 10 MB each.");
    setUploading(true);
    setError(null);
    try {
      const sb = browserSupabase();
      // Each person uploads into a folder named after them (the bucket's rule).
      const urls = await Promise.all(list.map(async f => {
        const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : f.type === "image/gif" ? "gif" : "jpg";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from("post-images").upload(path, f, { contentType: f.type || "image/jpeg" });
        if (error) throw error;
        return sb.storage.from("post-images").getPublicUrl(path).data.publicUrl;
      }));
      setImages(i => [...i, ...urls]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    const poll = pollOn ? options.map(o => o.trim()).filter(Boolean) : [];
    const problem =
      !title.trim() ? "Give your post a title" :
      pollOn && poll.length < 2 ? "A poll needs at least two options" :
      hub?.flair_required && flairs.length > 0 && flair == null ? "This hub needs a prefix on every post" : null;
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const { data, error } = await browserSupabase().rpc("create_post", {
      hub_id: hubId,
      post_title: title.trim(),
      post_body: body,
      image: images.length === 1 ? images[0] : null,
      poll_options: poll.length ? poll : null,
      flair,
      share_of: null,
      is_spoiler: spoiler,
      is_mature: mature,
      images: images.length > 1 ? images : null,
    });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    router.push(`/p/${data}`);
    router.refresh();
  }

  return (
    <div className="form-page" style={{ maxWidth: 720 }}>
      <h1>Create a post</h1>
      <div className="field">
        <label htmlFor="hub">Post to</label>
        <select id="hub" value={hubId ?? ""} onChange={e => setHubId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Your profile</option>
          {hubs.map(h => <option key={h.id} value={h.id}>n/{h.name}</option>)}
        </select>
      </div>
      {flairs.length > 0 && (
        <div className="field">
          <label htmlFor="flair">Prefix{hub?.flair_required ? "" : " (optional)"}</label>
          <select id="flair" value={flair ?? ""} onChange={e => setFlair(e.target.value ? Number(e.target.value) : null)}>
            <option value="">None</option>
            {flairs.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" value={title} maxLength={300} onChange={e => { setTitle(e.target.value); setError(null); }} />
      </div>
      <MarkdownEditor id="body" label="Text (optional)" value={body} onChange={setBody} maxLength={40000} imagesAllowed={imagesAllowed} />
      {images.length > 0 && (
        <div className="thumbs">
          {images.map(u => (
            <div key={u}>
              <img src={u} alt="" />
              <button aria-label="Remove picture" onClick={() => setImages(i => i.filter(x => x !== u))}><Icon icon={I.close} size={11} /></button>
            </div>
          ))}
        </div>
      )}
      {pollOn && (
        <div className="field">
          <label>Poll options</label>
          {options.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <input style={{ flex: 1 }} value={o} maxLength={80} placeholder={`Option ${i + 1}`} onChange={e => setOptions(list => list.map((x, j) => (j === i ? e.target.value : x)))} />
              {options.length > 2 && <button className="icon-btn" aria-label="Remove option" onClick={() => setOptions(list => list.filter((_, j) => j !== i))}><Icon icon={I.close} size={12} /></button>}
            </div>
          ))}
          {options.length < 6 && <button className="linkish small" style={{ alignSelf: "flex-start" }} onClick={() => setOptions(o => [...o, ""])}>Add option</button>}
        </div>
      )}
      <div className="toolbar">
        {imagesAllowed && (
          <label className="btn quiet" style={{ cursor: images.length >= MAX_IMAGES ? "default" : "pointer" }}>
            <Icon icon={I.imageOutline} size={14} /> {uploading ? "Uploading..." : "Pictures"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden disabled={uploading || images.length >= MAX_IMAGES} onChange={e => { addImages(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        {pollsAllowed && <button className={`btn ${pollOn ? "" : "quiet"}`} onClick={() => setPollOn(p => !p)}>Poll</button>}
        <label className="check"><input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} /> Spoiler</label>
        <label className="check"><input type="checkbox" checked={mature} onChange={e => setMature(e.target.checked)} /> 18+</label>
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn block" disabled={busy || uploading} onClick={submit}>{busy ? "Posting..." : "Post"}</button>
    </div>
  );
}
