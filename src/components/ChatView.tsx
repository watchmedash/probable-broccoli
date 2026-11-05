"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAutoGrow } from "@/lib/autogrow";
import { uploadImage } from "@/lib/upload";
import { Lightbox } from "./Lightbox";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { AskDialog } from "./Dialogs";
import { Icon, I } from "./Icon";
import { ReportDialog } from "./Report";

export type Reaction = { emoji: string; user_id: string };
export type Msg = { id: number; sender_id?: string | null; body: string; image_url?: string | null; created_at: string; from_mod?: boolean; sender?: { username: string } | null; reply_to?: number | null; reactions?: Reaction[] };

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const MESSAGE_COLUMNS = "id,sender_id,body,image_url,created_at,reply_to,reactions:message_reactions(emoji,user_id)";
const time = (s: string | null) => { const t = s ? Date.parse(s) : NaN; return Number.isNaN(t) ? -Infinity : t; };

/** A message list with a box at the bottom. New messages are fetched every few seconds. */
/** A message's text, with web links, u/name and n/name (for hubs that exist) clickable. */
export function MessageText({ body, hubs }: { body: string; hubs?: string[] }) {
  const known = new Set((hubs ?? []).map(h => h.toLowerCase()));
  const parts = body.split(/(https?:\/\/[^\s<>"]+|(?:^|(?<=[\s(]))[un]\/[A-Za-z0-9_]{3,21}\b)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0 || !p) return p;
        if (p.startsWith("http")) return <a key={i} href={p} target="_blank" rel="nofollow ugc noopener" className="bubble-link">{p}</a>;
        if (p.startsWith("n/") && !known.has(p.slice(2).toLowerCase())) return p;
        return <Link key={i} href={`/${p}`} className="bubble-link">{p}</Link>;
      })}
    </>
  );
}

export function MessageList({ messages, isMine, label, above, below, menu, hubs, corner }: {
  messages: Msg[]; isMine: (m: Msg) => boolean; label?: (m: Msg) => string | null; hubs?: string[];
  above?: (m: Msg) => React.ReactNode; below?: (m: Msg) => React.ReactNode; menu?: (m: Msg) => React.ReactNode;
  /** Sits on the bubble's bottom corner (reactions). */
  corner?: (m: Msg) => React.ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  // Opens on the latest message and stays there as new ones arrive and pictures finish loading,
  // unless you scrolled up to read. Scrolls this list only, so the page and the message box stay put.
  const stick = useRef(true);
  const toBottom = () => { if (stick.current && list.current) list.current.scrollTop = list.current.scrollHeight; };
  useLayoutEffect(toBottom, [messages.length]);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const onScroll = () => { stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
    const onLoad = () => toBottom();
    el.addEventListener("scroll", onScroll);
    el.addEventListener("load", onLoad, true);
    const grow = new ResizeObserver(toBottom);
    grow.observe(el);
    return () => { el.removeEventListener("scroll", onScroll); el.removeEventListener("load", onLoad, true); grow.disconnect(); };
  }, []);
  return (
    <Lightbox>
    <div ref={list} className="chat-list">
      {messages.map(m => {
        const mine = isMine(m);
        const who = label?.(m);
        const badge = corner?.(m);
        return (
          <div key={m.id} className={`chat-row ${mine ? "mine" : ""} ${badge ? "has-react" : ""}`}>
            {who && <div className="muted small" style={{ margin: "0 4px 2px", textAlign: mine ? "right" : "left" }}>{who}</div>}
            {above?.(m)}
            <div className="chat-line">
              <div className="bubble-wrap">
                <div className={`bubble ${m.image_url ? "has-pic" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.image_url && <img src={m.image_url} alt="" className="bubble-img" loading="lazy" />}
                  {m.body && <span className="bubble-text"><MessageText body={m.body} hubs={hubs} /></span>}
                </div>
                {badge}
              </div>
              {menu?.(m)}
            </div>
            {below?.(m)}
            <div className="muted small" style={{ margin: "2px 4px 0", textAlign: mine ? "right" : "left", fontSize: 11 }}>{timeAgo(m.created_at)}</div>
          </div>
        );
      })}
    </div>
    </Lightbox>
  );
}

/** Reactions as a small badge on the bubble's corner; tap one to change or take back yours. */
export function ReactionBadge({ reactions, me, onReact }: { reactions?: Reaction[]; me: string; onReact?: (emoji: string) => void }) {
  const counts = new Map<string, { n: number; mine: boolean }>();
  for (const r of reactions ?? []) {
    const c = counts.get(r.emoji) ?? { n: 0, mine: false };
    counts.set(r.emoji, { n: c.n + 1, mine: c.mine || r.user_id === me });
  }
  if (counts.size === 0) return null;
  return (
    <div className="chat-reactions">
      {[...counts].map(([e, c]) => <button key={e} className={c.mine ? "on" : ""} aria-label={`${e} ${c.n}`} disabled={!onReact} style={onReact ? undefined : { cursor: "default" }} onClick={() => onReact?.(e)}>{e}{c.n > 1 ? c.n : ""}</button>)}
    </div>
  );
}

export function Composer({ onSend, placeholder = "Message", top, onPicture }: {
  onSend: (text: string) => Promise<string | void>; placeholder?: string; top?: React.ReactNode;
  /** Sends a picture on its own; without it there's no picture button. */
  onPicture?: (url: string) => Promise<string | void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function picture(file: File | undefined | null) {
    if (!file || !onPicture || !file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const problem = await onPicture(await uploadImage(file, "post-images"));
      setError(problem || null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const box = useAutoGrow(text, 180);
  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    const problem = await onSend(t);
    setBusy(false);
    if (problem) setError(problem);
    else { setText(""); setError(null); }
  }
  return (
    <div style={{ borderTop: "1px solid var(--line)", padding: 12, flex: "none" }}>
      {top}
      {error && <p className="error" style={{ margin: "0 0 8px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        {onPicture && (
          <label className="icon-btn" aria-label="Send a picture" title="Send a picture" style={{ height: 42, cursor: "pointer" }}>
            <Icon icon={I.imageOutline} size={17} />
            <input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={e => { picture(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
        <textarea
          ref={box}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          onPaste={e => { const f = onPicture ? [...e.clipboardData.files].find(x => x.type.startsWith("image/")) : null; if (f) { e.preventDefault(); picture(f); } }}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={1}
          maxLength={2000}
          style={{ flex: 1, resize: "none", padding: "10px 12px", border: "1px solid var(--outline)", borderRadius: 4, background: "var(--surface)", minHeight: 42, boxSizing: "border-box" }}
        />
        <button className="btn" aria-label="Send" disabled={busy || !text.trim()} onClick={send} style={{ height: 42, width: 46, padding: 0 }}><Icon icon={I.send} size={16} /></button>
      </div>
    </div>
  );
}

/** A bubble's ⋮ menu: react, reply, and report (theirs) or delete (yours). */
export function BubbleMenu({ mine, onReact, onReply, onReport, onDelete }: { mine: boolean; onReact: (e: string) => void; onReply: () => void; onReport: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState<"down" | "up" | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const run = (fn: () => void) => () => { setOpen(null); fn(); };
  return (
    <span ref={box} className="bubble-more" style={{ position: "relative" }}>
      <button
        className="icon-btn"
        style={{ width: 28, height: 28 }}
        aria-label="Message options"
        aria-expanded={!!open}
        onClick={e => setOpen(o => (o ? null : e.clientY > window.innerHeight - 260 ? "up" : "down"))}
      >
        <Icon icon={I.more} size={14} />
      </button>
      {open && (
        <div className="menu" style={{ top: open === "down" ? 30 : "auto", bottom: open === "up" ? 30 : "auto", right: mine ? 0 : "auto", left: mine ? "auto" : 0 }}>
          {/* Reactions are for other people's messages. */}
          {!mine && (
            <div className="reaction-row">
              {REACTIONS.map(e => <button key={e} aria-label={`React with ${e}`} onClick={run(() => onReact(e))}>{e}</button>)}
            </div>
          )}
          <button onClick={run(onReply)}><Icon icon={I.comment} size={14} /> Reply</button>
          {mine
            ? <button onClick={run(onDelete)} style={{ color: "var(--error)" }}><Icon icon={I.trash} size={14} /> Delete</button>
            : <button onClick={run(onReport)}><Icon icon={I.flag} size={14} /> Report</button>}
        </div>
      )}
    </span>
  );
}

export function ChatView({ id, me, other, initial, status, incomingRequest, otherRead: read0, startedByMe, hiddenAt, hubs }: {
  id: number; me: string; other: string | null; initial: Msg[]; status: string; incomingRequest: boolean; otherRead: string | null; startedByMe: boolean; hiddenAt: string | null; hubs?: string[];
}) {
  const [msgs, setMsgs] = useState(initial);
  const [state, setState] = useState(status);
  const [otherRead, setOtherRead] = useState(read0);
  const [replying, setReplying] = useState<Msg | null>(null);
  const [reporting, setReporting] = useState<Msg | null>(null);
  const [deleting, setDeleting] = useState<Msg | null>(null);
  const router = useRouter();
  const sb = browserSupabase();
  const lastSeen = useRef(JSON.stringify(initial));

  // Supabase only sends a call once it's awaited; then the header can drop the badge.
  const markRead = useCallback(async () => {
    await sb.rpc("mark_conversation_read", { conversation: id });
    router.refresh();
  }, [sb, id, router]);

  const reload = useCallback(async () => {
    // A chat you deleted on your side restarts from the next new message.
    const { data: newest } = await sb.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", id).gt("created_at", hiddenAt ?? "-infinity").order("created_at", { ascending: false }).order("emoji", { referencedTable: "reactions" }).limit(500);
    if (!newest) return false;
    const data = [...newest].reverse();
    const next = JSON.stringify(data);
    if (next === lastSeen.current) return false;
    const grew = data.length !== JSON.parse(lastSeen.current).length;
    lastSeen.current = next;
    setMsgs(data as Msg[]);
    return grew;
  }, [sb, id, hiddenAt]);

  useEffect(() => {
    markRead();
    const t = window.setInterval(async () => {
      if (await reload()) markRead();
      const { data } = await sb.from("conversations").select("requester_read_at,recipient_read_at").eq("id", id).maybeSingle();
      if (data) setOtherRead(startedByMe ? data.recipient_read_at : data.requester_read_at);
    }, 5000);
    return () => window.clearInterval(t);
  }, [id, sb, markRead, reload, startedByMe]);

  async function answer(accept: boolean) {
    const { error } = await sb.from("conversations").update({ status: accept ? "accepted" : "declined" }).eq("id", id);
    if (error) return;
    if (accept) setState("accepted");
    else { router.push("/messages"); router.refresh(); }
  }

  async function react(m: Msg, emoji: string) {
    const had = m.reactions?.some(r => r.emoji === emoji && r.user_id === me);
    if (had) await sb.from("message_reactions").delete().eq("message_id", m.id).eq("user_id", me).eq("emoji", emoji);
    else await sb.from("message_reactions").insert({ message_id: m.id, emoji });
    await reload();
  }

  // "Seen" sits under the newest of your messages the other person has opened.
  const readAt = time(otherRead);
  const seenId = [...msgs].reverse().find(m => m.sender_id === me && Date.parse(m.created_at) <= readAt)?.id ?? null;

  return (
    <>
      <MessageList
        messages={msgs}
        hubs={hubs}
        isMine={m => m.sender_id === me}
        above={m => {
          const quoted = m.reply_to ? msgs.find(x => x.id === m.reply_to) : null;
          return quoted ? <div className="chat-quote">{quoted.body || "Picture"}</div> : null;
        }}
        corner={m => <ReactionBadge reactions={m.reactions} me={me} onReact={m.sender_id === me ? undefined : e => react(m, e)} />}
        below={m => m.id === seenId ? <div className="muted small" style={{ margin: "2px 4px 0", textAlign: "right", fontSize: 11 }}>Seen</div> : null}
        menu={m => (
          <BubbleMenu
            mine={m.sender_id === me}
            onReact={e => react(m, e)}
            onReply={() => setReplying(m)}
            onReport={() => setReporting(m)}
            onDelete={() => setDeleting(m)}
          />
        )}
      />
      {state === "pending" && incomingRequest ? (
        <div style={{ borderTop: "1px solid var(--line)", padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: "none" }}>
          <p style={{ margin: 0 }}>This person wants to chat. They can&apos;t send more until you accept.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn quiet" style={{ flex: 1 }} onClick={() => answer(false)}>Decline</button>
            <button className="btn" style={{ flex: 1 }} onClick={() => answer(true)}>Accept</button>
          </div>
        </div>
      ) : state === "declined" ? (
        <p className="muted panel-pad" style={{ margin: 0 }}>This chat was declined.</p>
      ) : (
        <Composer
          top={replying && (
            <div className="chat-replying">
              <span>{replying.body}</span>
              <button className="icon-btn" style={{ width: 24, height: 24 }} aria-label="Cancel reply" onClick={() => setReplying(null)}><Icon icon={I.close} size={12} /></button>
            </div>
          )}
          onSend={async text => {
            const { error } = await sb.from("messages").insert({ conversation_id: id, body: text, reply_to: replying?.id ?? null });
            if (error) return errorMessage(error);
            setReplying(null);
            await reload();
          }}
          onPicture={async url => {
            const { error } = await sb.from("messages").insert({ conversation_id: id, body: "", image_url: url, reply_to: replying?.id ?? null });
            if (error) return errorMessage(error);
            setReplying(null);
            await reload();
          }}
        />
      )}
      {reporting && other && <ReportDialog target={{ user_id: other }} quote={`Chat message: "${reporting.body}"`} onClose={() => setReporting(null)} />}
      {deleting && (
        <AskDialog
          title="Delete this message?"
          text="It's removed for both of you."
          action="Delete"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const { error } = await sb.from("messages").delete().eq("id", deleting.id);
            if (error) return errorMessage(error);
            await reload();
          }}
        />
      )}
    </>
  );
}
