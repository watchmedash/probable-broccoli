import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon, I } from "@/components/Icon";
import { ModmailView } from "@/components/ModmailView";
import { THREAD_COLUMNS, type ThreadRow } from "@/lib/messages";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mod mail", robots: { index: false } };

/** One mod mail thread: the person who wrote in sees "Mod team"; mods see who wrote. */
export default async function ModmailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const me = await currentUser();
  if (!me) redirect(`/login?next=/modmail/${id}`);
  const sb = await serverSupabase();
  const { data } = await sb.from("hub_threads").select(THREAD_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const t = data as unknown as ThreadRow;
  const { data: msgs } = await sb.from("hub_thread_messages").select("id,body,from_mod,created_at,sender_id,sender:profiles(id,username,avatar_url)").eq("thread_id", id).order("created_at");
  const mine = t.user_id === me.id;
  return (
    <main className="page single">
      <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 120px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
          <Link href={mine ? "/messages?tab=mods" : `/n/${t.hub?.name}/settings?tab=mail`} className="icon-btn" aria-label="Back"><Icon icon={I.back} size={16} /></Link>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <b>{t.subject}</b>
            <span className="muted small">{mine ? `To the mods of n/${t.hub?.name}` : `From u/${t.user?.username ?? "deleted"} to n/${t.hub?.name}`}</span>
          </span>
        </div>
        <ModmailView id={id} me={me.id} mine={mine} initial={(msgs ?? []) as never} closed={t.closed} />
      </div>
    </main>
  );
}
