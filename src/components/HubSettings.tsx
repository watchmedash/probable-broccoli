"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { THREAD_COLUMNS, threadUnread, type ThreadRow } from "@/lib/messages";
import { describeModAction, REPORT_REASONS, type Access, type HubMod } from "@/lib/queries";
import type { Flair, Hub } from "@/lib/types";
import { uploadImage } from "@/lib/upload";
import { Avatar, HubIcon } from "./Avatars";
import { AskDialog } from "./Dialogs";
import { Icon, I } from "./Icon";
import { useToast } from "./Toast";

// Colours a hub can pick, as in the app. Blues first; never orange.
const COLORS = ["#2563EB", "#0EA5E9", "#4F46E5", "#7C3AED", "#0D9488", "#10B981", "#EC4899", "#64748B", "#B91C1C", "#F59E0B", "#8B5CF6"];
type Tab = "general" | "posting" | "automod" | "prefixes" | "mods" | "members" | "reports" | "mail" | "log";
type Person = { id: string; username: string; avatar_url: string | null };
const lines = (s: string) => s.split(/[\n,]+/).map(x => x.trim().toLowerCase()).filter(Boolean);

export function HubSettings({ hub, access, admin, initialTab }: { hub: Hub; access: Access; admin: boolean; initialTab?: string }) {
  const tabs: [Tab, string, boolean][] = [
    ["general", "General", access.canSettings],
    ["posting", "Posting", access.canSettings],
    ["automod", "AutoMod", access.canSettings],
    ["prefixes", "Prefixes", access.canSettings],
    ["mods", "Mods", access.isOwner],
    ["members", "Members", access.canMembers],
    ["reports", "Reports", access.canRemove],
    ["mail", "Mail", access.isStaff],
    ["log", "Mod log", access.isStaff],
  ];
  const visible = tabs.filter(t => t[2]);
  const [tab, setTab] = useState<Tab>((visible.find(t => t[0] === initialTab) ?? visible[0])[0]);
  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
        <Link href={`/n/${hub.name}`} className="icon-btn" aria-label="Back to the hub"><Icon icon={I.back} size={16} /></Link>
        <HubIcon hub={hub} size={36} />
        <h1 style={{ margin: 0, fontSize: 20, flex: 1 }}>n/{hub.name} settings</h1>
      </div>
      <nav className="tabs">{visible.map(([t, label]) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{label}</button>)}</nav>
      <div className="panel-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {(tab === "general" || tab === "posting" || tab === "automod") && <SettingsForm hub={hub} part={tab} admin={admin} />}
        {tab === "prefixes" && <Prefixes hubId={hub.id} />}
        {tab === "mods" && <Mods hubId={hub.id} />}
        {tab === "members" && <Members hubId={hub.id} isPrivate={hub.privacy === "private"} userFlair={!!hub.allow_user_flair} />}
        {tab === "reports" && <Reports hubId={hub.id} />}
        {tab === "mail" && <Mail hubId={hub.id} />}
        {tab === "log" && <Log hubId={hub.id} />}
      </div>
    </div>
  );
}

function Toggle({ label, help, on, onChange }: { label: string; help?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      <span><span style={{ display: "block" }}>{label}</span>{help && <span className="muted small">{help}</span>}</span>
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--blue)", flex: "none" }} />
    </label>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </div>
  );
}

/** General, Posting and AutoMod share one form: the app saves every setting together. */
function SettingsForm({ hub, part, admin }: { hub: Hub; part: "general" | "posting" | "automod"; admin: boolean }) {
  const [s, setS] = useState({
    description: hub.description, rules: hub.rules, icon_url: hub.icon_url, banner_url: hub.banner_url,
    privacy: hub.privacy, status: hub.status, who_can_post: hub.who_can_post, who_can_comment: hub.who_can_comment,
    allow_images: hub.allow_images, allow_polls: hub.allow_polls, is_mature: hub.is_mature, members_only: hub.members_only,
    allow_crossposts: hub.allow_crossposts ?? true, flair_required: hub.flair_required, allow_user_flair: hub.allow_user_flair ?? false,
    link_domains: (hub.link_domains ?? []).join("\n"), automod_words: (hub.automod_words ?? []).join("\n"),
    automod_domains: (hub.automod_domains ?? []).join("\n"), automod_min_days: hub.automod_min_days ?? 0,
    filter_swearing: hub.filter_swearing ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS(x => ({ ...x, [k]: v }));
  const upload = async (file: File | undefined, key: "icon_url" | "banner_url") => {
    if (!file) return;
    try { set(key, await uploadImage(file, "post-images")); } catch (e) { setError(errorMessage(e)); }
  };
  async function save() {
    setBusy(true);
    setError(null);
    const { error } = await browserSupabase().from("communities").update({
      ...s,
      description: s.description.trim(),
      link_domains: lines(s.link_domains),
      automod_words: lines(s.automod_words),
      automod_domains: lines(s.automod_domains),
      automod_min_days: Math.max(0, Math.min(365, Number(s.automod_min_days) || 0)),
    }).eq("id", hub.id);
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast("Saved");
    router.refresh();
  }
  return (
    <>
      {part === "general" && (
        <>
          <div className="field"><label htmlFor="desc">Description</label><textarea id="desc" value={s.description} maxLength={300} onChange={e => set("description", e.target.value)} style={{ minHeight: 80 }} /></div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <HubIcon hub={{ name: hub.name, color: hub.color, icon_url: s.icon_url }} size={56} />
            <label className="btn quiet">Change icon<input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { upload(e.target.files?.[0], "icon_url"); e.target.value = ""; }} /></label>
            {s.icon_url && <button className="linkish small" onClick={() => set("icon_url", null)}>Remove icon</button>}
          </div>
          {s.banner_url && <img src={s.banner_url} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 1 }} />}
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <label className="btn quiet">{s.banner_url ? "Change cover" : "Add a cover"}<input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { upload(e.target.files?.[0], "banner_url"); e.target.value = ""; }} /></label>
            {s.banner_url && <button className="linkish small" onClick={() => set("banner_url", null)}>Remove cover</button>}
          </div>
          <div className="field"><label htmlFor="rules">Rules (one per line, shown as you write them)</label><textarea id="rules" value={s.rules} maxLength={2000} onChange={e => set("rules", e.target.value)} /></div>
          <Choice label="Who can see and join" value={s.privacy} options={[["public", "Public: anyone can join"], ["private", "Private: people ask to join"]]} onChange={v => set("privacy", v)} />
          <Toggle label="Only members see posts" on={s.members_only} onChange={v => set("members_only", v)} />
          <Toggle label="18+ hub" help="Only shown to adults who turned on 18+ hubs." on={s.is_mature} onChange={v => set("is_mature", v)} />
          {s.is_mature && <Toggle label="Filter swearing" help="Off: swearing is allowed here. Slurs are blocked everywhere either way." on={s.filter_swearing} onChange={v => set("filter_swearing", v)} />}
          <Toggle label="Archived" help="Read only: nothing new can be posted or commented." on={s.status === "archived"} onChange={v => set("status", v ? "archived" : "active")} />
        </>
      )}
      {part === "posting" && (
        <>
          <Choice label="Who can post" value={s.who_can_post} options={[["everyone", "Everyone"], ["members", "Members"], ["mods", "Mods only"]]} onChange={v => set("who_can_post", v)} />
          <Choice label="Who can comment" value={s.who_can_comment} options={[["everyone", "Everyone"], ["members", "Members"]]} onChange={v => set("who_can_comment", v)} />
          <Toggle label="Pictures in posts" on={s.allow_images} onChange={v => set("allow_images", v)} />
          <Toggle label="Polls" on={s.allow_polls} onChange={v => set("allow_polls", v)} />
          <Toggle label="Crossposts" help="Posts here can be shared to other hubs." on={s.allow_crossposts} onChange={v => set("allow_crossposts", v)} />
          <Toggle label="Every post needs a prefix" on={s.flair_required} onChange={v => set("flair_required", v)} />
          <Toggle label="User flair" help="Mods can give members a short tag shown next to their name here." on={s.allow_user_flair} onChange={v => set("allow_user_flair", v)} />
          <div className="field"><label htmlFor="ld">Clickable links in comments (one site per line)</label><textarea id="ld" value={s.link_domains} placeholder={"youtube.com\nwikipedia.org"} onChange={e => set("link_domains", e.target.value)} style={{ minHeight: 90 }} /></div>
        </>
      )}
      {part === "automod" && (
        <>
          <p className="muted small" style={{ margin: 0 }}>Posts and comments that break these are stopped before they appear.</p>
          <div className="field"><label htmlFor="aw">Blocked words (one per line)</label><textarea id="aw" value={s.automod_words} onChange={e => set("automod_words", e.target.value)} style={{ minHeight: 90 }} /></div>
          <div className="field"><label htmlFor="ad">Blocked sites (one per line)</label><textarea id="ad" value={s.automod_domains} onChange={e => set("automod_domains", e.target.value)} style={{ minHeight: 90 }} /></div>
          <div className="field"><label htmlFor="am">Accounts must be at least this many days old to post</label><input id="am" type="number" min={0} max={365} value={s.automod_min_days} onChange={e => set("automod_min_days", Number(e.target.value))} /></div>
        </>
      )}
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn" onClick={save} disabled={busy} style={{ alignSelf: "flex-start" }}>{busy ? "Saving..." : "Save changes"}</button>
      {part === "general" && admin && (
        <>
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
          <button className="btn danger" style={{ alignSelf: "flex-start" }} onClick={() => setDeleting(true)}>Delete this hub</button>
        </>
      )}
      {deleting && (
        <AskDialog title={`Delete n/${hub.name}?`} text="Its posts go with it. This can't be undone." action="Delete" danger onClose={() => setDeleting(false)}
          onConfirm={async () => {
            const { error } = await browserSupabase().from("communities").delete().eq("id", hub.id);
            if (error) return errorMessage(error);
            router.push("/hubs");
            router.refresh();
          }} />
      )}
    </>
  );
}

function useList<T>(load: () => PromiseLike<{ data: unknown; error: unknown }>) {
  const [items, setItems] = useState<T[] | null>(null);
  const reload = useCallback(() => { load().then(({ data }) => setItems((data ?? []) as T[])); }, [load]);
  useEffect(() => { reload(); }, [reload]);
  return [items, reload] as const;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>{children}</div>;
}

function AddByName({ label, action, extra, onAdd }: { label: string; action: string; extra?: string; onAdd: (username: string, extra: string) => Promise<string | void> }) {
  const [name, setName] = useState("");
  const [more, setMore] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div className="prefix" style={{ flex: 1, minWidth: 180 }}><span>u/</span><input aria-label={label} placeholder={label} value={name} onChange={e => setName(e.target.value)} style={{ height: 38 }} /></div>
        {extra && <input aria-label={extra} placeholder={extra} value={more} onChange={e => setMore(e.target.value)} style={{ flex: 1, minWidth: 160, height: 40, padding: "0 12px", border: "1px solid var(--outline)", borderRadius: 4, background: "var(--surface)" }} />}
        <button className="btn" disabled={!name.trim()} onClick={async () => { const p = await onAdd(name.trim().replace(/^u\//, ""), more.trim()); if (p) setError(p); else { setName(""); setMore(""); setError(null); } }}>{action}</button>
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

async function userId(username: string): Promise<string | null> {
  const { data } = await browserSupabase().from("profiles").select("id").eq("username", username).maybeSingle();
  return data?.id ?? null;
}

function Prefixes({ hubId }: { hubId: number }) {
  const sb = browserSupabase();
  const [items, reload] = useList<Flair>(useCallback(() => sb.from("hub_flairs").select("id,label,color").eq("hub_id", hubId).order("position").order("id"), [hubId, sb]));
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <p className="muted small" style={{ margin: 0 }}>Prefixes label posts, like Question or Guide. Posters pick one when they post.</p>
      {items?.length === 0 && <p className="muted">No prefixes yet.</p>}
      {items?.map(f => (
        <Row key={f.id}>
          <span className="flair" style={{ background: f.color, margin: 0 }}>{f.label}</span>
          <span style={{ flex: 1 }} />
          <button className="linkish small" onClick={async () => { await sb.from("hub_flairs").delete().eq("id", f.id); reload(); }}>Remove</button>
        </Row>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input aria-label="New prefix" placeholder="New prefix" value={label} maxLength={24} onChange={e => setLabel(e.target.value)} style={{ flex: 1, minWidth: 160, height: 40, padding: "0 12px", border: "1px solid var(--outline)", borderRadius: 4, background: "var(--surface)" }} />
        {COLORS.slice(0, 8).map(c => <button key={c} aria-label={c} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: color === c ? "3px solid var(--ink)" : 0, cursor: "pointer" }} />)}
        <button className="btn" disabled={!label.trim()} onClick={async () => {
          const { error } = await sb.from("hub_flairs").insert({ hub_id: hubId, label: label.trim(), color });
          if (error) return setError(errorMessage(error));
          setLabel(""); setError(null); reload();
        }}>Add</button>
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </>
  );
}

function Mods({ hubId }: { hubId: number }) {
  const sb = browserSupabase();
  const [team, reload] = useList<HubMod>(useCallback(() => sb.from("hub_mods").select("can_posts,can_members,can_settings,user:profiles!user_id(id,username,avatar_url)").eq("hub_id", hubId).order("added_at"), [hubId, sb]));
  const toast = useToast();
  const setPerm = async (m: HubMod, k: "can_posts" | "can_members" | "can_settings", v: boolean) => {
    const { error } = await sb.from("hub_mods").update({ can_posts: m.can_posts, can_members: m.can_members, can_settings: m.can_settings, [k]: v }).eq("hub_id", hubId).eq("user_id", m.user.id);
    if (error) toast(errorMessage(error));
    reload();
  };
  return (
    <>
      <AddByName label="Username" action="Add mod" onAdd={async name => {
        const id = await userId(name);
        if (!id) return "There's no one with that username.";
        const { error } = await sb.from("hub_mods").insert({ hub_id: hubId, user_id: id });
        if (error) return errorMessage(error);
        reload();
      }} />
      {team?.length === 0 && <p className="muted">No mods yet besides you.</p>}
      {team?.map(m => (
        <div key={m.user.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar user={m.user} size={28} /><b style={{ flex: 1 }}>u/{m.user.username}</b>
            <button className="linkish small" style={{ color: "var(--error)" }} onClick={async () => { await sb.from("hub_mods").delete().eq("hub_id", hubId).eq("user_id", m.user.id); reload(); }}>Remove</button>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label className="check"><input type="checkbox" checked={m.can_posts} onChange={e => setPerm(m, "can_posts", e.target.checked)} /> Posts and comments</label>
            <label className="check"><input type="checkbox" checked={m.can_members} onChange={e => setPerm(m, "can_members", e.target.checked)} /> Members and bans</label>
            <label className="check"><input type="checkbox" checked={m.can_settings} onChange={e => setPerm(m, "can_settings", e.target.checked)} /> Settings</label>
          </div>
        </div>
      ))}
    </>
  );
}

function Members({ hubId, isPrivate, userFlair }: { hubId: number; isPrivate: boolean; userFlair: boolean }) {
  const sb = browserSupabase();
  const [members, reloadMembers] = useList<{ user: Person | null }>(useCallback(() => sb.from("hub_members").select("user:profiles!user_id(id,username,avatar_url)").eq("hub_id", hubId).order("joined_at"), [hubId, sb]));
  const [requests, reloadRequests] = useList<{ user: Person | null }>(useCallback(() => sb.from("hub_join_requests").select("user:profiles!user_id(id,username,avatar_url)").eq("hub_id", hubId).order("created_at"), [hubId, sb]));
  const [bans, reloadBans] = useList<{ reason: string; user: Person | null }>(useCallback(() => sb.from("hub_bans").select("reason,user:profiles!user_id(id,username,avatar_url)").eq("hub_id", hubId).order("created_at", { ascending: false }), [hubId, sb]));
  const [flairs, reloadFlairs] = useList<{ user_id: string; text: string; color: string }>(useCallback(() => sb.from("hub_user_flairs").select("user_id,text,color").eq("hub_id", hubId), [hubId, sb]));
  const [flairFor, setFlairFor] = useState<Person | null>(null);
  const toast = useToast();
  const act = async (p: PromiseLike<{ error: unknown }>, after: () => void) => { const { error } = await p; if (error) toast(errorMessage(error)); after(); };
  return (
    <>
      {isPrivate && (
        <>
          <h3 style={{ margin: 0, fontSize: 15 }}>Join requests</h3>
          {requests?.length === 0 && <p className="muted small" style={{ margin: 0 }}>No one is waiting.</p>}
          {requests?.map(r => r.user && (
            <Row key={r.user.id}>
              <Avatar user={r.user} size={28} /><Link href={`/u/${r.user.username}`} style={{ flex: 1 }}>u/{r.user.username}</Link>
              <button className="btn quiet" style={{ height: 30 }} onClick={() => act(sb.from("hub_join_requests").delete().eq("hub_id", hubId).eq("user_id", r.user!.id), reloadRequests)}>Decline</button>
              <button className="btn" style={{ height: 30 }} onClick={() => act(sb.from("hub_members").insert({ hub_id: hubId, user_id: r.user!.id }), () => { reloadRequests(); reloadMembers(); })}>Let in</button>
            </Row>
          ))}
        </>
      )}
      <h3 style={{ margin: "8px 0 0", fontSize: 15 }}>Members</h3>
      {members?.map(m => m.user && (
        <Row key={m.user.id}>
          <Avatar user={m.user} size={28} />
          <Link href={`/u/${m.user.username}`} style={{ flex: 1 }}>u/{m.user.username}</Link>
          {userFlair && (() => { const f = flairs?.find(x => x.user_id === m.user!.id); return f ? <span className="tag" style={{ background: f.color, color: "#fff" }}>{f.text}</span> : null; })()}
          {userFlair && <button className="linkish small" onClick={() => setFlairFor(m.user)}>Set flair</button>}
          <button className="linkish small" style={{ color: "var(--error)" }} onClick={() => act(sb.from("hub_members").delete().eq("hub_id", hubId).eq("user_id", m.user!.id), reloadMembers)}>Remove</button>
        </Row>
      ))}
      <h3 style={{ margin: "8px 0 0", fontSize: 15 }}>Banned</h3>
      <AddByName label="Username" extra="Reason" action="Ban" onAdd={async (name, reason) => {
        const id = await userId(name);
        if (!id) return "There's no one with that username.";
        const { error } = await sb.from("hub_bans").insert({ hub_id: hubId, user_id: id, reason });
        if (error) return errorMessage(error);
        reloadBans(); reloadMembers();
      }} />
      {bans?.length === 0 && <p className="muted small" style={{ margin: 0 }}>No one is banned.</p>}
      {bans?.map(b => b.user && (
        <Row key={b.user.id}>
          <Avatar user={b.user} size={28} />
          <span style={{ flex: 1 }}>u/{b.user.username}{b.reason && <span className="muted small"> {b.reason}</span>}</span>
          <button className="linkish small" onClick={() => act(sb.from("hub_bans").delete().eq("hub_id", hubId).eq("user_id", b.user!.id), reloadBans)}>Unban</button>
        </Row>
      ))}
      {flairFor && <FlairDialog hubId={hubId} user={flairFor} current={flairs?.find(f => f.user_id === flairFor.id)} onClose={() => { setFlairFor(null); reloadFlairs(); }} />}
    </>
  );
}

export function FlairDialog({ hubId, user, current, onClose }: { hubId: number; user: Person; current?: { text: string; color: string }; onClose: () => void }) {
  const [text, setText] = useState(current?.text ?? "");
  const [color, setColor] = useState(current?.color ?? COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const sb = browserSupabase();
  return (
    <div className="dialog-back" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal onClick={e => e.stopPropagation()}>
        <h2>Flair for u/{user.username}</h2>
        <input value={text} maxLength={40} onChange={e => setText(e.target.value)} placeholder="Flair text" style={{ height: 40, padding: "0 12px", border: "1px solid var(--outline)", borderRadius: 4, background: "var(--surface)" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{COLORS.slice(0, 8).map(c => <button key={c} aria-label={c} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: color === c ? "3px solid var(--ink)" : 0, cursor: "pointer" }} />)}</div>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div className="row">
          {current && <button className="btn quiet" onClick={async () => { await sb.from("hub_user_flairs").delete().eq("hub_id", hubId).eq("user_id", user.id); onClose(); }}>Clear</button>}
          <button className="btn quiet" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!text.trim()} onClick={async () => {
            const { error } = await sb.from("hub_user_flairs").upsert({ hub_id: hubId, user_id: user.id, text: text.trim().slice(0, 40), color }, { onConflict: "hub_id,user_id" });
            if (error) return setError(errorMessage(error));
            onClose();
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

type ReportRow = {
  id: number; reason: string; details: string; created_at: string;
  reporter: Person | null; post: { id: number; title: string } | null; comment: { id: number; body: string; post_id: number } | null; user: Person | null;
};
export const REPORT_COLUMNS = "id,reason,details,created_at,reporter:profiles!reporter_id(id,username,avatar_url),post:posts(id,title),comment:comments(id,body,post_id),user:profiles!user_id(id,username,avatar_url)";

/** Open reports for one hub, or every open report (site admins) when hubId is null. */
export function Reports({ hubId }: { hubId: number | null }) {
  const sb = browserSupabase();
  const [items, reload] = useList<ReportRow>(useCallback(() => {
    let q = sb.from("reports").select(REPORT_COLUMNS).eq("status", "open");
    if (hubId != null) q = q.eq("hub_id", hubId);
    return q.order("created_at", { ascending: false });
  }, [hubId, sb]));
  const toast = useToast();
  const reasonLabel = (r: string) => REPORT_REASONS.find(x => x[0] === r)?.[1] ?? r;
  async function resolve(r: ReportRow, takeDown: boolean) {
    if (takeDown) {
      const res = r.post ? await sb.rpc("remove_post", { post: r.post.id, reason: reasonLabel(r.reason) }) : r.comment ? await sb.rpc("remove_comment", { comment: r.comment.id, reason: reasonLabel(r.reason) }) : { error: null };
      if (res.error) return toast(errorMessage(res.error));
    }
    const { error } = await sb.from("reports").update({ status: takeDown ? "actioned" : "dismissed" }).eq("id", r.id);
    if (error) toast(errorMessage(error));
    reload();
  }
  if (items?.length === 0) return <p className="muted">No open reports.</p>;
  return (
    <>
      {items?.map(r => (
        <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="small muted">{reasonLabel(r.reason)}   {timeAgo(r.created_at)}   by u/{r.reporter?.username ?? "deleted"}</span>
          {r.post && <Link href={`/p/${r.post.id}`} className="linkish">Post: {r.post.title}</Link>}
          {r.comment && <Link href={`/p/${r.comment.post_id}#comments`} className="linkish">Comment: {r.comment.body.slice(0, 160)}</Link>}
          {r.user && <Link href={`/u/${r.user.username}`} className="linkish">Account: u/{r.user.username}</Link>}
          {r.details && <span>{r.details}</span>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn quiet" style={{ height: 30 }} onClick={() => resolve(r, false)}>Dismiss</button>
            {(r.post || r.comment) && <button className="btn danger" style={{ height: 30 }} onClick={() => resolve(r, true)}>Remove it</button>}
          </div>
        </div>
      ))}
    </>
  );
}

function Mail({ hubId }: { hubId: number }) {
  const sb = browserSupabase();
  const [me, setMe] = useState<string>("");
  useEffect(() => { sb.auth.getUser().then(({ data }) => setMe(data.user?.id ?? "")); }, [sb]);
  const [threads] = useList<ThreadRow>(useCallback(() => sb.from("hub_threads").select(THREAD_COLUMNS).eq("hub_id", hubId).order("last_message_at", { ascending: false }), [hubId, sb]));
  if (threads?.length === 0) return <p className="muted">No mod mail yet.</p>;
  return (
    <>
      {threads?.map(t => (
        <Link key={t.id} href={`/modmail/${t.id}`} className={`notif ${me && threadUnread(t, me) ? "unread" : ""}`} style={{ padding: "10px 4px" }}>
          <Avatar user={t.user} size={28} />
          <span style={{ flex: 1 }}><b style={{ display: "block" }}>{t.subject}</b><span className="muted small">u/{t.user?.username ?? "deleted"}{t.closed ? "   Closed" : ""}</span></span>
          <span className="muted small">{timeAgo(t.last_message_at)}</span>
        </Link>
      ))}
    </>
  );
}

function Log({ hubId }: { hubId: number }) {
  const sb = browserSupabase();
  type Entry = { id: number; action: string; detail: string; created_at: string; post_id: number | null; actor: { username: string } | null; target: { username: string } | null };
  const [items] = useList<Entry>(useCallback(() => sb.from("mod_log").select("id,action,detail,created_at,post_id,actor:profiles!actor_id(username),target:profiles!target_user(username)").eq("hub_id", hubId).order("created_at", { ascending: false }).limit(200), [hubId, sb]));
  if (items?.length === 0) return <p className="muted">Nothing yet.</p>;
  return (
    <>
      {items?.map(e => (
        <Row key={e.id}>
          <span style={{ flex: 1 }}>{e.post_id ? <Link href={`/p/${e.post_id}`}>{describeModAction(e)}</Link> : describeModAction(e)}</span>
          <span className="muted small">{timeAgo(e.created_at)}</span>
        </Row>
      ))}
    </>
  );
}
