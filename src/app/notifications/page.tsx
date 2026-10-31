import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatars";
import { MarkAllRead } from "@/components/MarkAllRead";
import { timeAgo } from "@/lib/format";
import { describeNotification, fetchNotifications } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function NotificationsPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/notifications");
  const items = await fetchNotifications(await serverSupabase());
  const unread = items.some(n => !n.read);
  return (
    <main className="page single">
      <div className="panel" style={{ overflow: "hidden" }}>
        {unread && <MarkAllRead />}
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>Notifications</h1>
        </div>
        {items.length === 0 && <div className="empty">Nothing yet. Replies, mentions and follows show up here.</div>}
        {items.map(n => {
          const href = n.type === "follow" && n.actor ? `/u/${n.actor.username}` : n.post ? `/p/${n.post.id}${n.comment_id ? "#comments" : ""}` : null;
          const row = (
            <>
              <Avatar user={n.actor} size={36} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block" }}>{describeNotification(n)}</span>
                <span className="muted small">{timeAgo(n.created_at)}</span>
              </span>
            </>
          );
          return href ? (
            <Link key={n.id} href={href} className={`notif ${n.read ? "" : "unread"}`}>{row}</Link>
          ) : (
            <div key={n.id} className={`notif ${n.read ? "" : "unread"}`}>{row}</div>
          );
        })}
      </div>
    </main>
  );
}
