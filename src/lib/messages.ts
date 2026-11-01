import type { SupabaseClient } from "@supabase/supabase-js";

// The same columns the app reads (data/MessageRepository.kt, data/ModmailRepository.kt).
export const CONVERSATION_COLUMNS =
  "id,requested_by,recipient,status,last_message_at,requester_read_at,recipient_read_at,requester_hidden_at,recipient_hidden_at," +
  "requester:profiles!requested_by(id,username,avatar_url),recipient_profile:profiles!recipient(id,username,avatar_url)," +
  "last:messages(body,sender_id,created_at)";
export const THREAD_COLUMNS =
  "id,hub_id,user_id,subject,closed,last_message_at,user_read_at,mods_read_at,hub:communities(name),user:profiles!user_id(id,username,avatar_url)";

type P = { id: string; username: string; avatar_url: string | null } | null;
export type ConversationRow = {
  id: number; requested_by: string; recipient: string; status: string; last_message_at: string;
  requester_read_at: string; recipient_read_at: string; requester_hidden_at: string | null; recipient_hidden_at: string | null; requester: P; recipient_profile: P;
  last: { body: string; sender_id: string; created_at: string }[];
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

/** How many chats and mod mail threads have something new, for the header badge. */
export async function unreadMessages(sb: SupabaseClient, me: string): Promise<number> {
  const [convos, threads] = await Promise.all([
    fetchConversations(sb),
    sb.from("hub_threads").select(THREAD_COLUMNS).eq("user_id", me).then(r => (r.data ?? []) as unknown as ThreadRow[]),
  ]);
  return convos.filter(c => { const v = chatView(c, me); return v.unread && !v.hidden && c.status !== "declined"; }).length + threads.filter(t => threadUnread(t, me)).length;
}
