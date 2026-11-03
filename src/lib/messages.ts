import type { SupabaseClient } from "@supabase/supabase-js";

// The same columns the app reads (data/MessageRepository.kt, data/ModmailRepository.kt).
export const CONVERSATION_COLUMNS =
  "id,requested_by,recipient,status,last_message_at,requester_read_at,recipient_read_at,requester_hidden_at,recipient_hidden_at," +
  "requester:profiles!requested_by(id,username,avatar_url),recipient_profile:profiles!recipient(id,username,avatar_url)," +
  "last:messages(body,image_url,sender_id,created_at)";
export const GROUP_MESSAGE_COLUMNS = "id,sender_id,body,image_url,created_at,reply_to,sender:profiles!sender_id(username),reactions:group_message_reactions(emoji,user_id)";
export const THREAD_COLUMNS =
  "id,hub_id,user_id,subject,closed,last_message_at,user_read_at,mods_read_at,hub:communities(name),user:profiles!user_id(id,username,avatar_url)";

type P = { id: string; username: string; avatar_url: string | null } | null;
export type ConversationRow = {
  id: number; requested_by: string; recipient: string; status: string; last_message_at: string;
  requester_read_at: string; recipient_read_at: string; requester_hidden_at: string | null; recipient_hidden_at: string | null; requester: P; recipient_profile: P;
  last: { body: string; image_url?: string | null; sender_id: string; created_at: string }[];
};
export type GroupRow = {
  id: number; name: string; last_message_at: string; read_at: string; hidden_at: string | null;
  last: { body: string; image_url: string | null; sender_id: string | null; sender: { username: string } | null } | null;
};
export type ThreadRow = {
  id: number; hub_id: number; user_id: string; subject: string; closed: boolean; last_message_at: string;
  user_read_at: string | null; mods_read_at: string | null; hub: { name: string } | null; user: P;
};

// "-infinity" (never read) doesn't parse, which counts as unread.
const time = (s: string | null) => { const t = s ? Date.parse(s) : NaN; return Number.isNaN(t) ? -Infinity : t; };

export function chatView(c: ConversationRow, me: string) {
  const startedByMe = c.requested_by === me;
  const other = startedByMe ? c.recipient_profile : c.requester;
  const readAt = time(startedByMe ? c.requester_read_at : c.recipient_read_at);
  const hiddenAt = startedByMe ? c.requester_hidden_at : c.recipient_hidden_at;
  return {
    other,
    startedByMe,
    /** Someone asked to chat with you and you haven't answered. */
    incomingRequest: c.status === "pending" && !startedByMe,
    unread: time(c.last_message_at) > readAt,
    hiddenAt,
    /** You deleted it on your side, and nothing new has come since. */
    hidden: !!hiddenAt && time(c.last_message_at) <= time(hiddenAt),
    last: c.last[0] ?? null,
  };
}

export function threadUnread(t: ThreadRow, me: string) {
  const mine = t.user_id === me;
  return time(t.last_message_at) > time(mine ? t.user_read_at : t.mods_read_at);
}

export async function fetchConversations(sb: SupabaseClient): Promise<ConversationRow[]> {
  const { data } = await sb
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .order("last_message_at", { ascending: false })
    .order("created_at", { ascending: false, referencedTable: "last" })
    .limit(1, { referencedTable: "last" });
  return (data ?? []) as unknown as ConversationRow[];
}

/** Your group chats, newest first, each with its latest message. */
export async function fetchGroups(sb: SupabaseClient, me: string): Promise<GroupRow[]> {
  const { data } = await sb.from("group_members").select("read_at,hidden_at,chat:group_chats(id,name,last_message_at)").eq("user_id", me);
  const rows = ((data ?? []) as unknown as { read_at: string; hidden_at: string | null; chat: { id: number; name: string; last_message_at: string } | null }[]).filter(r => r.chat);
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.chat!.id);
  const { data: recent } = await sb.from("group_messages").select("chat_id,body,image_url,sender_id,sender:profiles!sender_id(username)")
    .in("chat_id", ids).order("created_at", { ascending: false }).limit(Math.min(ids.length * 20, 1000));
  const latest = new Map<number, GroupRow["last"]>();
  for (const m of (recent ?? []) as unknown as (NonNullable<GroupRow["last"]> & { chat_id: number })[]) if (!latest.has(m.chat_id)) latest.set(m.chat_id, m);
  return rows
    .map(r => ({ id: r.chat!.id, name: r.chat!.name, last_message_at: r.chat!.last_message_at, read_at: r.read_at, hidden_at: r.hidden_at, last: latest.get(r.chat!.id) ?? null }))
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
}

export const groupUnread = (g: GroupRow, me: string) => time(g.last_message_at) > time(g.read_at) && g.last?.sender_id !== me;
export const groupHidden = (g: GroupRow) => !!g.hidden_at && time(g.last_message_at) <= time(g.hidden_at);

/** How many chats, groups and mod mail threads have something new, for the header badge. */
export async function unreadMessages(sb: SupabaseClient, me: string): Promise<number> {
  const [convos, threads, groups] = await Promise.all([
    fetchConversations(sb),
    sb.from("hub_threads").select(THREAD_COLUMNS).eq("user_id", me).then(r => (r.data ?? []) as unknown as ThreadRow[]),
    fetchGroups(sb, me),
  ]);
  return convos.filter(c => { const v = chatView(c, me); return v.unread && !v.hidden && c.status !== "declined"; }).length
    + threads.filter(t => threadUnread(t, me)).length
    + groups.filter(g => groupUnread(g, me) && !groupHidden(g)).length;
}
