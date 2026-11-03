"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { GROUP_MESSAGE_COLUMNS } from "@/lib/messages";
import { browserSupabase } from "@/lib/supabase/client";
import { Avatar } from "./Avatars";
import { BubbleMenu, Composer, MessageList, ReactionBadge, type Msg } from "./ChatView";
import { AskDialog } from "./Dialogs";
import { Icon, I } from "./Icon";
import { ReportDialog } from "./Report";

type Person = { id: string; username: string; avatar_url: string | null };

/** A group chat: everyone's messages with their names, reactions on the corner, and the people in it. */
export function GroupChat({ id, me, name, initial, members: members0, hubs }: {
  id: number; me: string; name: string; initial: Msg[]; members: Person[]; hubs?: string[];
}) {
  const [msgs, setMsgs] = useState(initial);
  const [members, setMembers] = useState(members0);
  const [replying, setReplying] = useState<Msg | null>(null);
  const [reporting, setReporting] = useState<Msg | null>(null);
  const [deleting, setDeleting] = useState<Msg | null>(null);
  const [panel, setPanel] = useState<"people" | "add" | "leave" | null>(null);
  const sb = browserSupabase();
  const router = useRouter();
  const lastSeen = useRef(JSON.stringify(initial));

  const reload = useCallback(async () => {
    const { data } = await sb.from("group_messages").select(GROUP_MESSAGE_COLUMNS).eq("chat_id", id)
      .order("created_at", { ascending: false }).order("emoji", { referencedTable: "reactions" }).limit(500);
    if (!data) return;
    const list = [...data].reverse() as unknown as Msg[];
    const next = JSON.stringify(list);
    if (next === lastSeen.current) return;
    lastSeen.current = next;
    setMsgs(list);
    await sb.rpc("mark_group_read", { chat: id });
  }, [sb, id]);

  useEffect(() => {
    sb.rpc("mark_group_read", { chat: id }).then(() => router.refresh());
    const t = window.setInterval(reload, 5000);
    return () => window.clearInterval(t);
  }, [id, sb, reload, router]);

  async function react(m: Msg, emoji: string) {
    const had = m.reactions?.some(r => r.emoji === emoji && r.user_id === me);
    if (had) await sb.from("group_message_reactions").delete().eq("message_id", m.id).eq("user_id", me);
    else await sb.from("group_message_reactions").insert({ message_id: m.id, emoji });
    await reload();
  }

  async function send(body: string, image: string | null) {
    const { error } = await sb.from("group_messages").insert({ chat_id: id, body, image_url: image, reply_to: replying?.id ?? null });
    if (error) return errorMessage(error);
    setReplying(null);
    await reload();
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
        <Link href="/messages" className="icon-btn" aria-label="Back to messages"><Icon icon={I.back} size={16} /></Link>
        <span className="group-icon"><Icon icon={I.users} size={15} /></span>
        <button className="linkish" style={{ flex: 1, textAlign: "left", color: "var(--ink)" }} onClick={() => setPanel("people")}>
          <b style={{ display: "block" }}>{name}</b>
          <span className="muted small">{members.length === 1 ? "1 person" : `${members.length} people`}</span>
        </button>
        <button className="icon-btn" aria-label="Add someone" title="Add someone" onClick={() => setPanel("add")}><Icon icon={I.follow} size={16} /></button>
      </div>
      <MessageList
        messages={msgs}
        hubs={hubs}
        isMine={m => m.sender_id === me}
        label={m => (m.sender_id === me ? null : m.sender ? `u/${m.sender.username}` : "[deleted]")}
        above={m => {
          const quoted = m.reply_to ? msgs.find(x => x.id === m.reply_to) : null;
          return quoted ? <div className="chat-quote">{quoted.body || "Picture"}</div> : null;
        }}
        corner={m => <ReactionBadge reactions={m.reactions} me={me} onReact={e => react(m, e)} />}
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
      <Composer
        top={replying && (
          <div className="chat-replying">
            <span>{replying.body || "Picture"}</span>
            <button className="icon-btn" style={{ width: 24, height: 24 }} aria-label="Cancel reply" onClick={() => setReplying(null)}><Icon icon={I.close} size={12} /></button>
          </div>
        )}
        onSend={text => send(text, null)}
        onPicture={url => send("", url)}
      />
      {panel === "people" && (
        <div className="dialog-back" onClick={() => setPanel(null)}>
          <div className="dialog" role="dialog" aria-modal aria-label="People in this chat" onClick={e => e.stopPropagation()}>
            <h2>{name}</h2>
            <div style={{ display: "flex", flexDirection: "column", maxHeight: 320, overflowY: "auto" }}>
              {members.map(p => (
                <Link key={p.id} href={`/u/${p.username}`} className="hub-row" style={{ padding: "8px 0", borderBottom: 0 }}><Avatar user={p} size={30} /><span className="name">u/{p.username}</span></Link>
              ))}
            </div>
            <div className="row">
              <button className="btn quiet danger-text" onClick={() => setPanel("leave")}>Leave</button>
              <button className="btn" onClick={() => setPanel(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
      {panel === "add" && (
        <AskDialog
          title="Add someone"
          field
          placeholder="Their username"
          action="Add"
          onClose={() => setPanel(null)}
          onConfirm={async username => {
            const { error } = await sb.rpc("add_to_group", { chat: id, username: username.replace(/^u\//, "") });
            if (error) return errorMessage(error).replace("Something went wrong. Try again in a moment.", error.message);
            const { data } = await sb.from("group_members").select("user:profiles(id,username,avatar_url)").eq("chat_id", id);
            setMembers(((data ?? []) as unknown as { user: Person | null }[]).map(r => r.user).filter((u): u is Person => !!u));
          }}
        />
      )}
      {panel === "leave" && (
        <AskDialog
          title="Leave this chat?"
          text="You stop getting its messages. Someone in it can add you back."
          action="Leave"
          danger
          onClose={() => setPanel(null)}
          onConfirm={async () => {
            const { error } = await sb.from("group_members").delete().eq("chat_id", id).eq("user_id", me);
            if (error) return errorMessage(error);
            router.push("/messages");
            router.refresh();
          }}
        />
      )}
      {reporting?.sender_id && <ReportDialog target={{ user_id: reporting.sender_id }} quote={`Group message: "${reporting.body}"`} onClose={() => setReporting(null)} />}
      {deleting && (
        <AskDialog
          title="Delete this message?"
          text="It's removed for everyone."
          action="Delete"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const { error } = await sb.from("group_messages").delete().eq("id", deleting.id);
            if (error) return errorMessage(error);
            await reload();
          }}
        />
      )}
    </>
  );
}

/** Start a group: a name and the people in it (everyone has to be taking messages). */
export function NewGroup() {
  const [name, setName] = useState("");
  const [people, setPeople] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const names = people.split(/[\s,]+/).map(n => n.replace(/^u\//, "").trim()).filter(Boolean);
  return (
    <div className="form-page">
      <h1>New group</h1>
      <div className="field">
        <label htmlFor="gname">Name</label>
        <input id="gname" value={name} maxLength={50} onChange={e => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="gpeople">People (usernames, separated by spaces or commas)</label>
        <textarea id="gpeople" value={people} onChange={e => setPeople(e.target.value)} autoCapitalize="none" spellCheck={false} style={{ minHeight: 80 }} />
        <span className="muted small">Up to 19 people.</span>
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button
        className="btn block"
        disabled={busy || !name.trim() || names.length === 0}
        onClick={async () => {
          if (names.length > 19) return setError("A group can have up to 19 other people.");
          setBusy(true);
          const { data, error } = await browserSupabase().rpc("create_group", { group_name: name.trim(), usernames: names });
          setBusy(false);
          if (error) return setError(errorMessage(error).replace("Something went wrong. Try again in a moment.", error.message));
          router.push(`/messages/g/${data}`);
        }}
      >
        Start group
      </button>
    </div>
  );
}
