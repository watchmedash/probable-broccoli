"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Avatar } from "./Avatars";
import { useToast } from "./Toast";

type S = {
  allow_messages: string; notify_post_replies: boolean; notify_comment_replies: boolean; notify_mentions: boolean;
  show_mature: boolean; notify_follows: boolean; notify_modmail: boolean; birth_date: string | null;
};
const DEFAULTS: S = { allow_messages: "everyone", notify_post_replies: true, notify_comment_replies: true, notify_mentions: true, show_mature: false, notify_follows: true, notify_modmail: true, birth_date: null };

function age(iso: string) {
  const b = new Date(iso + "T00:00:00Z"), n = new Date();
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--line)" }}>
      <h2 className="panel-pad" style={{ margin: 0, paddingBottom: 6, fontSize: 13, color: "var(--blue)", textTransform: "uppercase", letterSpacing: ".4px" }}>{title}</h2>
      <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </section>
  );
}

function Switch({ label, help, on, onChange }: { label: string; help?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
      <span><span style={{ display: "block" }}>{label}</span>{help && <span className="muted small">{help}</span>}</span>
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--blue)", flex: "none" }} />
    </label>
  );
}

/** Notifications, privacy and 18+, kept on the server and private to you, like the app's Settings. */
export function AccountSettings() {
  const [s, setS] = useState<S | null>(null);
  const [askBirthday, setAskBirthday] = useState(false);
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sb = browserSupabase();
  const toast = useToast();
  useEffect(() => {
    sb.auth.getUser().then(async ({ data: u }) => {
      const { data } = await sb.from("user_settings").select("allow_messages,notify_post_replies,notify_comment_replies,notify_mentions,show_mature,notify_follows,notify_modmail,birth_date").eq("user_id", u.user?.id).maybeSingle();
      setS({ ...DEFAULTS, ...(data ?? {}) });
    });
  }, [sb]);
  async function save(next: S) {
    const before = s;
    setS(next);
    // Every field is sent; a null birthday keeps whatever is saved.
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("user_settings").upsert({ user_id: u.user?.id, ...next, birth_date: before?.birth_date ? null : next.birth_date }, { onConflict: "user_id" });
    if (error) { setS(before); toast(errorMessage(error)); return false; }
    return true;
  }
  if (!s) return null;
  const set = (patch: Partial<S>) => save({ ...s, ...patch });
  return (
    <>
      <Section title="Notifications">
        <Switch label="Replies to your posts" on={s.notify_post_replies} onChange={v => set({ notify_post_replies: v })} />
        <Switch label="Replies to your comments" on={s.notify_comment_replies} onChange={v => set({ notify_comment_replies: v })} />
        <Switch label="Mentions" help="Someone writes u/yourname" on={s.notify_mentions} onChange={v => set({ notify_mentions: v })} />
        <Switch label="New followers" on={s.notify_follows} onChange={v => set({ notify_follows: v })} />
        <Switch label="Mod mail" on={s.notify_modmail} onChange={v => set({ notify_modmail: v })} />
      </Section>
      <Section title="Privacy">
        <Switch label="Let anyone send me a chat request" on={s.allow_messages === "everyone"} onChange={v => set({ allow_messages: v ? "everyone" : "nobody" })} />
        <Switch
          label="Show 18+ hubs and posts"
          help="Only for adults. Your birthday decides."
          on={s.show_mature}
          onChange={v => { if (v && !s.birth_date) { setAskBirthday(true); return; } set({ show_mature: v }); }}
        />
        <Link href="/settings/blocked" className="linkish">Blocked people</Link>
      </Section>
      {askBirthday && (
        <div className="dialog-back" onClick={() => setAskBirthday(false)}>
          <div className="dialog" role="dialog" aria-modal onClick={e => e.stopPropagation()}>
            <h2>When&apos;s your birthday?</h2>
            <p style={{ margin: 0 }}>18+ hubs are only for adults. You can set this once.</p>
            <input type="date" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={e => { setBirthday(e.target.value); setError(null); }} style={{ height: 44, padding: "0 12px", border: "1px solid var(--outline)", borderRadius: 4, background: "var(--surface)" }} />
            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
            <div className="row">
              <button className="btn quiet" onClick={() => setAskBirthday(false)}>Cancel</button>
              <button className="btn" disabled={!birthday} onClick={async () => {
                if (age(birthday) < 18) return setError("18+ hubs are only for people 18 and over.");
                if (await save({ ...s, show_mature: true, birth_date: birthday })) setAskBirthday(false);
              }}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Site admin tools: every open report, the site-wide word filter, and which sites are clickable on profile posts. */
export function AdminSettings() {
  const sb = browserSupabase();
  const toast = useToast();
  const [words, setWords] = useState<{ word: string; level: string }[] | null>(null);
  const [domains, setDomains] = useState<string[] | null>(null);
  const [word, setWord] = useState("");
  const [level, setLevel] = useState("slur");
  const [domain, setDomain] = useState("");
  const [embeds, setEmbeds] = useState<string[] | null>(null);
  const [embed, setEmbed] = useState("");
  const load = useCallback(async () => {
    const [w, d, e] = await Promise.all([sb.from("blocked_words").select("word,level").order("word"), sb.from("site_link_domains").select("domain").order("domain"), sb.from("site_embed_domains").select("domain").order("domain")]);
    setEmbeds((e.data ?? []).map((r: { domain: string }) => r.domain));
    setWords(w.data ?? []);
    setDomains((d.data ?? []).map((r: { domain: string }) => r.domain));
  }, [sb]);
  useEffect(() => { load(); }, [load]);
  const act = async (p: PromiseLike<{ error: unknown }>) => { const { error } = await p; if (error) toast(errorMessage(error)); load(); };
  const input = { height: 38, padding: "0 12px", border: "1px solid var(--outline)", borderRadius: 4, background: "var(--surface)", flex: 1, minWidth: 140 } as const;
  return (
    <>
      <Section title="Site admin">
        <Link href="/admin/reports" className="linkish">Every open report</Link>
      </Section>
      <Section title="Word filter">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input aria-label="Word" placeholder="Word" value={word} onChange={e => setWord(e.target.value)} style={input} />
          <select aria-label="Where it's blocked" value={level} onChange={e => setLevel(e.target.value)} style={{ ...input, flex: "none" }}>
            <option value="slur">Blocked everywhere</option>
            <option value="profanity">Allowed only in 18+ hubs</option>
          </select>
          <button className="btn" disabled={!word.trim()} onClick={() => { act(sb.from("blocked_words").insert({ word: word.trim().toLowerCase(), level })); setWord(""); }}>Add</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto" }}>
          {words?.map(w => (
            <span key={w.word} className="tag spoiler" style={{ height: 26, gap: 6 }}>
              {w.word} <span className="muted">{w.level === "slur" ? "everywhere" : "outside 18+"}</span>
              <button className="linkish" aria-label={`Remove ${w.word}`} onClick={() => act(sb.from("blocked_words").delete().eq("word", w.word))}>x</button>
            </span>
          ))}
        </div>
      </Section>
      <Section title="Clickable links on profile posts">
        <div style={{ display: "flex", gap: 8 }}>
          <input aria-label="Site" placeholder="youtube.com" value={domain} onChange={e => setDomain(e.target.value)} style={input} />
          <button className="btn" disabled={!domain.trim()} onClick={() => { act(sb.from("site_link_domains").insert({ domain: domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") })); setDomain(""); }}>Add</button>
        </div>
        {domains?.map(d => (
          <div key={d} style={{ display: "flex", alignItems: "center" }}>
            <span style={{ flex: 1 }}>{d}</span>
            <button className="linkish small" onClick={() => act(sb.from("site_link_domains").delete().eq("domain", d))}>Remove</button>
          </div>
        ))}
      </Section>
      <Section title="Video sites that play inside posts">
        <div style={{ display: "flex", gap: 8 }}>
          <input aria-label="Video site" placeholder="example.com" value={embed} onChange={e => setEmbed(e.target.value)} style={input} />
          <button className="btn" disabled={!embed.trim()} onClick={() => { act(sb.from("site_embed_domains").insert({ domain: embed.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") })); setEmbed(""); }}>Add</button>
        </div>
        {embeds?.map(d => (
          <div key={d} style={{ display: "flex", alignItems: "center" }}>
            <span style={{ flex: 1 }}>{d}</span>
            <button className="linkish small" onClick={() => act(sb.from("site_embed_domains").delete().eq("domain", d))}>Remove</button>
          </div>
        ))}
      </Section>
    </>
  );
}

export function BlockedList() {
  const sb = browserSupabase();
  const [people, setPeople] = useState<{ id: string; username: string; avatar_url: string | null }[] | null>(null);
  const load = useCallback(async () => {
    const { data: u } = await sb.auth.getUser();
    const { data } = await sb.from("blocks").select("blocked:profiles!blocked_id(id,username,avatar_url)").eq("blocker_id", u.user?.id).order("created_at", { ascending: false });
    setPeople(((data ?? []) as unknown as { blocked: { id: string; username: string; avatar_url: string | null } | null }[]).map(r => r.blocked).filter(Boolean) as never);
  }, [sb]);
  useEffect(() => { load(); }, [load]);
  if (people?.length === 0) return <div className="empty">You haven&apos;t blocked anyone.</div>;
  return (
    <>
      {people?.map(p => (
        <div key={p.id} className="hub-row">
          <Avatar user={p} size={36} />
          <span className="name">u/{p.username}</span>
          <button className="btn quiet" style={{ height: 32 }} onClick={async () => {
            const { data: u } = await sb.auth.getUser();
            await sb.from("blocks").delete().eq("blocker_id", u.user?.id).eq("blocked_id", p.id);
            load();
          }}>Unblock</button>
        </div>
      ))}
    </>
  );
}
