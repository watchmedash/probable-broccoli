import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE } from "./config";
import type { Comment, Hub, Notification, Post, Profile } from "./types";

// The same columns the Android app reads (data/Repositories.kt).
export const HUB_COLUMNS =
  "id,name,description,color,created_by,who_can_post,member_count,icon_url,banner_url,rules,privacy,status,who_can_comment,allow_images,allow_polls,is_mature,link_domains,flair_required,members_only";
const AUTHOR = "author:profiles!author_id(id,username,avatar_url)";
const POST_BASE =
  `id,community_id,title,body,score,comment_count,created_at,edited_at,image_url,image_urls,pinned_at,locked,spoiler,mature,` +
  `community:communities(id,name,color,icon_url,is_mature,link_domains,status,who_can_comment),${AUTHOR},` +
  `poll:poll_options(id,position,label,votes),flair:hub_flairs(id,label,color)`;
const postColumns = (signedIn: boolean) =>
  signedIn ? `${POST_BASE},my_vote:post_votes(value),my_poll:poll_votes(option_id),my_save:saved_posts(post_id)` : POST_BASE;
const commentColumns = (signedIn: boolean) =>
  `id,post_id,parent_id,body,score,depth,deleted,created_at,edited_at,${AUTHOR}` + (signedIn ? ",my_vote:comment_votes(value)" : "");

export type Sort = "hot" | "new" | "top";
export type Range = "day" | "week" | "month" | "year" | "all";
export const RANGES: Record<Range, { label: string; days: number | null }> = {
  day: { label: "Today", days: 1 },
  week: { label: "This week", days: 7 },
  month: { label: "This month", days: 30 },
  year: { label: "This year", days: 365 },
  all: { label: "All time", days: null },
};
const SORT_COLUMN: Record<Sort, string> = { hot: "hot", new: "created_at", top: "score" };

export type FeedQuery = {
  sort: Sort;
  range?: Range;
  hubId?: number;
  authorId?: string;
  hubIds?: number[];
  peopleIds?: string[];
  search?: string;
  offset?: number;
};

export const parseSort = (s?: string): Sort => (s === "new" || s === "top" ? s : "hot");
export const parseRange = (r?: string, fallback: Range = "all"): Range => (r && r in RANGES ? (r as Range) : fallback);
const likeText = (w: string) => w.replace(/[\\%_]/g, m => "\\" + m);

/** One page of posts, newest rules first: pinned posts lead inside a hub. */
export async function fetchPosts(sb: SupabaseClient, q: FeedQuery, signedIn: boolean): Promise<{ posts: Post[]; next: number | null }> {
  const offset = q.offset ?? 0;
  if (q.hubIds && q.hubIds.length === 0 && !(q.peopleIds?.length)) return { posts: [], next: null };
  let query = sb.from("posts").select(signedIn ? postColumns(true) + ",hidden_posts(post_id)" : postColumns(false));
  if (signedIn) query = query.is("hidden_posts", null);
  const days = q.sort === "top" ? RANGES[q.range ?? "all"].days : null;
  if (days) query = query.gte("created_at", new Date(Date.now() - days * 86400000).toISOString());
  if (q.hubId != null) query = query.eq("community_id", q.hubId);
  if (q.authorId) query = query.eq("author_id", q.authorId);
  if (q.peopleIds) {
    const parts = [];
    if (q.hubIds?.length) parts.push(`community_id.in.(${q.hubIds.join(",")})`);
    if (q.peopleIds.length) parts.push(`author_id.in.(${q.peopleIds.join(",")})`);
    query = query.or(parts.join(","));
  } else if (q.hubIds) query = query.in("community_id", q.hubIds);
  const words = (q.search ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 6);
  for (const w of words) query = query.or(`title.ilike.%${likeText(w)}%,body.ilike.%${likeText(w)}%`);
  if (q.hubId != null) query = query.order("pinned_at", { ascending: false, nullsFirst: false });
  query = query.order(SORT_COLUMN[q.sort], { ascending: false });
  if (q.sort !== "new") query = query.order("created_at", { ascending: false });
  const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  const posts = (data ?? []) as unknown as Post[];
  return { posts, next: posts.length === PAGE_SIZE ? offset + PAGE_SIZE : null };
}

export async function fetchPost(sb: SupabaseClient, id: number, signedIn: boolean): Promise<Post | null> {
  const { data } = await sb.from("posts").select(postColumns(signedIn)).eq("id", id).maybeSingle();
  return (data as unknown as Post) ?? null;
}

export async function fetchComments(sb: SupabaseClient, postId: number, signedIn: boolean): Promise<Comment[]> {
  const { data } = await sb.from("comments").select(commentColumns(signedIn)).eq("post_id", postId).order("created_at").limit(1000);
  return (data ?? []) as unknown as Comment[];
}

export async function insertComment(sb: SupabaseClient, postId: number, parentId: number | null, body: string): Promise<Comment> {
  const { data, error } = await sb.from("comments").insert({ post_id: postId, parent_id: parentId, body }).select(commentColumns(true)).single();
  if (error) throw error;
  return data as unknown as Comment;
}

export async function fetchHubs(sb: SupabaseClient): Promise<Hub[]> {
  const { data } = await sb.from("communities").select(HUB_COLUMNS).order("name");
  return (data ?? []) as Hub[];
}

export async function fetchHubByName(sb: SupabaseClient, name: string): Promise<Hub | null> {
  const { data } = await sb.from("communities").select(HUB_COLUMNS).ilike("name", likeText(name)).limit(1);
  return ((data ?? [])[0] as Hub) ?? null;
}

export async function fetchProfile(sb: SupabaseClient, username: string): Promise<Profile | null> {
  const { data } = await sb.from("profiles").select("id,username,created_at,avatar_url,banned_at,cover_url").ilike("username", likeText(username)).limit(1);
  return ((data ?? [])[0] as Profile) ?? null;
}

export async function myHubIds(sb: SupabaseClient, uid: string): Promise<number[]> {
  const { data } = await sb.from("hub_members").select("hub_id").eq("user_id", uid);
  return (data ?? []).map((r: { hub_id: number }) => r.hub_id);
}

export async function followingIds(sb: SupabaseClient, uid: string): Promise<string[]> {
  const { data } = await sb.from("follows").select("followee_id").eq("follower_id", uid);
  return (data ?? []).map((r: { followee_id: string }) => r.followee_id);
}

export async function fetchNotifications(sb: SupabaseClient): Promise<Notification[]> {
  const { data } = await sb
    .from("notifications")
    .select("id,type,read,created_at,comment_id,detail,thread_id,actor:profiles!actor_id(id,username,avatar_url),post:posts(id,title)")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as Notification[];
}

/** One line of plain English for a notification, worded like the app. */
export function describeNotification(n: Notification): string {
  const who = n.actor ? `u/${n.actor.username}` : "Someone";
  const what = n.post?.title ?? "a deleted post";
  switch (n.type) {
    case "comment_reply": return `${who} replied to your comment in: ${what}`;
    case "mention": return `${who} mentioned you in: ${what}`;
    case "removed": return n.detail ?? "A mod removed something you posted.";
    case "follow": return `${who} started following you`;
    case "modmail": return `Mod mail in ${n.detail ?? "a hub"}`;
    default: return `${who} replied to your post: ${what}`;
  }
}

export const REPORT_REASONS: [string, string][] = [
  ["spam", "Spam"],
  ["harassment", "Harassment or bullying"],
  ["hate", "Hate"],
  ["violence", "Violence or threats"],
  ["sexual", "Sexual content"],
  ["misinformation", "Misinformation"],
  ["rules", "Breaks the hub's rules"],
  ["other", "Something else"],
];
