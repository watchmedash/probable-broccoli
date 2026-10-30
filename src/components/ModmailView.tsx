"use client";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Composer, MessageList } from "./ChatView";

type Msg = { id: number; body: string; from_mod: boolean; created_at: string; sender_id: string | null; sender: { username: string } | null };

export function ModmailView({ id, me, mine, initial, closed: c0 }: { id: number; me: string; mine: boolean; initial: Msg[]; closed: boolean }) {
  const [msgs, setMsgs] = useState(initial);
  const [closed, setClosed] = useState(c0);
  const sb = browserSupabase();
  useEffect(() => {
    sb.rpc("mark_thread_read", { thread: id });
    const t = window.setInterval(async () => {
      const { data } = await sb.from("hub_thread_messages").select("id,body,from_mod,created_at,sender_id,sender:profiles(id,username,avatar_url)").eq("thread_id", id).order("created_at");
      if (data && data.length !== msgs.length) { setMsgs(data as never); sb.rpc("mark_thread_read", { thread: id }); }
    }, 6000);
    return () => window.clearInterval(t);
  }, [id, msgs.length, sb]);

  return (
    <>
      <MessageList
        messages={msgs}
        isMine={m => m.sender_id === me}
        // The person who wrote in sees the mods as one team; mods see who said what.
        label={m => (m.from_mod ? (mine ? "Mod team" : `u/${m.sender?.username ?? "mod"} (mod)`) : mine ? null : `u/${m.sender?.username ?? "deleted"}`)}
      />
      {!mine && (
        <div style={{ padding: "0 16px 8px" }}>
          <button
            className="linkish small"
            onClick={async () => {
              const { error } = await sb.from("hub_threads").update({ closed: !closed }).eq("id", id);
              if (!error) setClosed(!closed);
            }}
          >
            {closed ? "Reopen thread" : "Close thread"}
          </button>
        </div>
      )}
      {closed ? (
        <p className="muted panel-pad" style={{ margin: 0 }}>This thread is closed.</p>
      ) : (
        <Composer
          placeholder={mine ? "Reply to the mods" : "Reply as a mod"}
          onSend={async text => {
            const { data, error } = await sb.from("hub_thread_messages").insert({ thread_id: id, body: text }).select("id,body,from_mod,created_at,sender_id").single();
            if (error) return errorMessage(error);
            setMsgs(m => [...m, { ...(data as Msg), sender: null }]);
          }}
        />
      )}
    </>
  );
}
