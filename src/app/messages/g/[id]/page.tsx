import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GroupChat } from "@/components/GroupChat";
import { GROUP_MESSAGE_COLUMNS } from "@/lib/messages";
import type { Msg } from "@/components/ChatView";
import { hubNames } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Group chat", robots: { index: false } };

type Person = { id: string; username: string; avatar_url: string | null };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const me = await currentUser();
  if (!me) redirect(`/login?next=/messages/g/${id}`);
  const sb = await serverSupabase();
  const [{ data: chat }, { data: members }, { data: newest }, hubs] = await Promise.all([
    sb.from("group_chats").select("id,name").eq("id", id).maybeSingle(),
    sb.from("group_members").select("user:profiles(id,username,avatar_url)").eq("chat_id", id),
    sb.from("group_messages").select(GROUP_MESSAGE_COLUMNS).eq("chat_id", id).order("created_at", { ascending: false }).order("emoji", { referencedTable: "reactions" }).limit(500),
    hubNames(sb),
  ]);
  if (!chat) notFound();
  const people = ((members ?? []) as unknown as { user: Person | null }[]).map(r => r.user).filter((u): u is Person => !!u);
  return (
    <main className="page single">
      <div className="panel chat-panel">
        <GroupChat id={id} me={me.id} name={chat.name} initial={[...(newest ?? [])].reverse() as unknown as Msg[]} members={people} hubs={hubs} />
      </div>
    </main>
  );
}
