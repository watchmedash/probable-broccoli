import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/Avatars";
import { Icon, I } from "@/components/Icon";
import { ChatView } from "@/components/ChatView";
import { chatView, CONVERSATION_COLUMNS, type ConversationRow } from "@/lib/messages";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chat", robots: { index: false } };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const me = await currentUser();
  if (!me) redirect(`/login?next=/messages/${id}`);
  const sb = await serverSupabase();
  const { data } = await sb.from("conversations").select(CONVERSATION_COLUMNS).eq("id", id).limit(1, { referencedTable: "last" }).maybeSingle();
  if (!data) notFound();
  const c = data as unknown as ConversationRow;
  const v = chatView(c, me.id);
  const { data: msgs } = await sb.from("messages").select("id,sender_id,body,created_at,reply_to,reactions:message_reactions(emoji,user_id)").eq("conversation_id", id).gt("created_at", v.hiddenAt ?? "-infinity").order("created_at").limit(500);
  return (
    <main className="page single">
      <div className="panel chat-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
          <Link href="/messages" className="icon-btn" aria-label="Back to messages"><Icon icon={I.back} size={16} /></Link>
          {v.other && <Link href={`/u/${v.other.username}`} style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar user={v.other} size={32} /><b>u/{v.other.username}</b></Link>}
        </div>
        <ChatView id={id} me={me.id} other={v.other?.id ?? null} initial={msgs ?? []} status={c.status} incomingRequest={v.incomingRequest} startedByMe={v.startedByMe} hiddenAt={v.hiddenAt} otherRead={v.startedByMe ? c.recipient_read_at : c.requester_read_at} />
      </div>
    </main>
  );
}
