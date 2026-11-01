import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatars";
import { ChatRowMenu } from "@/components/ChatRowMenu";
import { Icon, I } from "@/components/Icon";
import { timeAgo } from "@/lib/format";
import { chatView, fetchConversations, THREAD_COLUMNS, threadUnread, type ThreadRow } from "@/lib/messages";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await currentUser();
  if (!me) redirect("/login?next=/messages");
  const tab = (await searchParams).tab === "mods" ? "mods" : "chats";
  const sb = await serverSupabase();
  const [convos, threads] = await Promise.all([
    fetchConversations(sb),
    sb.from("hub_threads").select(THREAD_COLUMNS).eq("user_id", me.id).order("last_message_at", { ascending: false }).then(r => (r.data ?? []) as unknown as ThreadRow[]),
  ]);
  const chats = convos.filter(c => c.status !== "declined" && !chatView(c, me.id).hidden);
  return (
    <main className="page single">
      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px" }}>
          <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>Messages</h1>
          <Link href="/messages/new" className="icon-btn" aria-label="New chat" title="New chat"><Icon icon={I.plus} size={18} /></Link>
        </div>
        <nav className="tabs">
          <Link href="/messages" className={tab === "chats" ? "on" : ""}>Chats</Link>
          <Link href="/messages?tab=mods" className={tab === "mods" ? "on" : ""}>Mod mail</Link>
        </nav>
        {tab === "chats" && (chats.length === 0 ? <div className="empty">No chats yet. Start one from someone&apos;s profile.</div> : chats.map(c => {
          const v = chatView(c, me.id);
          return (
            <Link key={c.id} href={`/messages/${c.id}`} className={`notif ${v.unread ? "unread" : ""}`}>
              <Avatar user={v.other} size={40} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", gap: 8 }}>
                  <b>u/{v.other?.username ?? "deleted"}</b>
                  {v.incomingRequest && <span className="tag spoiler">REQUEST</span>}
                  {c.status === "pending" && v.startedByMe && <span className="muted small">Waiting for them to accept</span>}
                </span>
                <span className="muted small" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.last ? `${v.last.sender_id === me.id ? "You: " : ""}${v.last.body}` : ""}
                </span>
              </span>
              <span className="muted small">{timeAgo(c.last_message_at)}</span>
              <ChatRowMenu id={c.id} />
            </Link>
          );
        }))}
        {tab === "mods" && (threads.length === 0 ? <div className="empty">Messages you send to a hub&apos;s mods show up here.</div> : threads.map(t => (
          <Link key={t.id} href={`/modmail/${t.id}`} className={`notif ${threadUnread(t, me.id) ? "unread" : ""}`}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: "block" }}>{t.subject}</b>
              <span className="muted small">n/{t.hub?.name ?? "hub"}{t.closed ? "   Closed" : ""}</span>
            </span>
            <span className="muted small">{timeAgo(t.last_message_at)}</span>
          </Link>
        )))}
      </div>
    </main>
  );
}
