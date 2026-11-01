"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { Flair, Hub } from "@/lib/types";
import { Icon, I } from "./Icon";
import { MarkdownEditor } from "./MarkdownEditor";

export function CreatePost({ hubs, initialHub }: { hubs: Hub[]; initialHub: number | null }) {
  const [hubId, setHubId] = useState<number | null>(initialHub);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
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
      image: null,
      poll_options: poll.length ? poll : null,
      flair,
      share_of: null,
      is_spoiler: spoiler,
      is_mature: mature,
      images: null,
    });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    router.push(`/p/${data}`);
    router.refresh();
  }

  return (
    <div className="form-page" style={{ maxWidth: 720 }}>
      <h1>Create a post</h1>
      {/* Started from inside a hub, the post goes there. */}
      {initialHub != null ? (
        <p className="muted" style={{ margin: 0 }}>Posting in <b style={{ color: "var(--ink)" }}>n/{hub?.name}</b></p>
      ) : (
        <div className="field">
          <label htmlFor="hub">Post to</label>
          <select id="hub" value={hubId ?? ""} onChange={e => setHubId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Your profile</option>
            {hubs.map(h => <option key={h.id} value={h.id}>n/{h.name}</option>)}
          </select>
        </div>
      )}
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
      <MarkdownEditor id="body" label="Text (optional)" value={body} onChange={setBody} maxLength={50000} imagesAllowed={imagesAllowed} />
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
        {pollsAllowed && <button className={`btn ${pollOn ? "" : "quiet"}`} onClick={() => setPollOn(p => !p)}>Poll</button>}
        <label className="check"><input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} /> Spoiler</label>
        <label className="check"><input type="checkbox" checked={mature} onChange={e => setMature(e.target.checked)} /> 18+</label>
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn block" disabled={busy} onClick={submit}>{busy ? "Posting..." : "Post"}</button>
    </div>
  );
}
