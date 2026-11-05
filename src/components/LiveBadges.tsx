"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { unreadMessages } from "@/lib/messages";
import { browserSupabase } from "@/lib/supabase/client";
import { Icon, I } from "./Icon";

/**
 * The messages and bell buttons with their counts. The counts check again every 30 seconds while
 * the tab is open, when you come back to the tab, and on every page change.
 */
export function LiveBadges({ meId, chats: firstChats, notes: firstNotes }: { meId: string; chats: number; notes: number }) {
  const [chats, setChats] = useState(firstChats);
  const [notes, setNotes] = useState(firstNotes);
  const path = usePathname();
  useEffect(() => { setChats(firstChats); setNotes(firstNotes); }, [firstChats, firstNotes]);
  useEffect(() => {
    let alive = true;
    const sb = browserSupabase();
    async function check() {
      if (document.hidden) return;
      const [{ count }, c] = await Promise.all([
        sb.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
        unreadMessages(sb, meId),
      ]);
      if (!alive) return;
      if (count != null) setNotes(count);
      setChats(c);
    }
    const t = window.setInterval(check, 30_000);
    const onShow = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { alive = false; window.clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [meId, path]);
  return (
    <>
      <Link href="/messages" className="icon-btn" aria-label={chats ? `Messages, ${chats} new` : "Messages"}>
        <Icon icon={I.mail} size={18} />
        {chats > 0 && <span className="badge">{chats > 99 ? "99+" : chats}</span>}
      </Link>
      <Link href="/notifications" className="icon-btn" aria-label={notes ? `Notifications, ${notes} unread` : "Notifications"}>
        <Icon icon={I.bell} size={18} />
        {notes > 0 && <span className="badge">{notes > 99 ? "99+" : notes}</span>}
      </Link>
    </>
  );
}
