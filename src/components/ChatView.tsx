"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";

type Msg = { id: number; sender_id?: string | null; body: string; created_at: string; from_mod?: boolean; sender?: { username: string } | null };

/** A message list with a box at the bottom. New messages are fetched every few seconds. */
export function MessageList({ messages, isMine, label }: { messages: Msg[]; isMine: (m: Msg) => boolean; label?: (m: Msg) => string | null }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: 16, overflowY: "auto" }}>
      {messages.map(m => {
        const mine = isMine(m);
        const who = label?.(m);
        return (
          <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%" }}>
            {who && <div className="muted small" style={{ margin: "0 4px 2px", textAlign: mine ? "right" : "left" }}>{who}</div>}
            <div style={{ padding: "8px 12px", borderRadius: 8, background: mine ? "var(--blue)" : "var(--surface-2)", color: mine ? "#fff" : "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
            <div className="muted small" style={{ margin: "2px 4px 0", textAlign: mine ? "right" : "left", fontSize: 11 }}>{timeAgo(m.created_at)}</div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

export function Composer({ onSend, placeholder = "Message" }: { onSend: (text: string) => Promise<string | void>; placeholder?: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    <div style={{ borderTop: "1px solid var(--line)", padding: 12 }}>
      {error && <p className="error" style={{ margin: "0 0 8px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={1}
          maxLength={2000}
          style={{ flex: 1, resize: "none", padding: "10px 12px", border: "1px solid var(--outline)", borderRadius: 4, background: "var(--surface)", minHeight: 42 }}
        />
        <button className="btn" disabled={busy || !text.trim()} onClick={send} style={{ height: 42 }}>Send</button>
      </div>
    </div>
  );
}

export function ChatView({ id, me, initial, status, incomingRequest }: { id: number; me: string; initial: Msg[]; status: string; incomingRequest: boolean }) {
  const [msgs, setMsgs] = useState(initial);
  const [state, setState] = useState(status);
  const router = useRouter();
  const sb = browserSupabase();

  // Supabase only sends a call once it's awaited; then the header can drop the badge.
  const markRead = useCallback(async () => {
    await sb.rpc("mark_conversation_read", { conversation: id });
    router.refresh();
  }, [sb, id, router]);

  useEffect(() => {
    markRead();
    const t = window.setInterval(async () => {
      const { data } = await sb.from("messages").select("id,sender_id,body,created_at").eq("conversation_id", id).order("created_at").limit(500);
      if (data && data.length !== msgs.length) {
        setMsgs(data);
        markRead();
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, [id, msgs.length, sb, markRead]);

  async function answer(accept: boolean) {
    const { error } = await sb.from("conversations").update({ status: accept ? "accepted" : "declined" }).eq("id", id);
    if (error) return;
    if (accept) setState("accepted");
    else { router.push("/messages"); router.refresh(); }
  }

  return (
    <>
      <MessageList messages={msgs} isMine={m => m.sender_id === me} />
      {state === "pending" && incomingRequest ? (
        <div style={{ borderTop: "1px solid var(--line)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0 }}>This person wants to chat. They can&apos;t send more until you accept.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn quiet" style={{ flex: 1 }} onClick={() => answer(false)}>Decline</button>
            <button className="btn" style={{ flex: 1 }} onClick={() => answer(true)}>Accept</button>
          </div>
        </div>
      ) : state === "declined" ? (
        <p className="muted panel-pad" style={{ margin: 0 }}>This chat was declined.</p>
      ) : (
        <Composer onSend={async text => {
          const { data, error } = await sb.from("messages").insert({ conversation_id: id, body: text }).select("id,sender_id,body,created_at").single();
          if (error) return errorMessage(error);
          setMsgs(m => [...m, data]);
        }} />
      )}
    </>
  );
}
