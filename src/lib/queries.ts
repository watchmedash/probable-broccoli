import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE, SUPABASE_KEY, SUPABASE_URL } from "./config";
import type { Comment, Hub, Notification, Post, Profile } from "./types";

// The same columns the Android app reads (data/Repositories.kt).
export const HUB_COLUMNS =
  "id,name,description,color,created_by,who_can_post,member_count,icon_url,banner_url,rules,privacy,status,who_can_comment,allow_images,allow_polls,is_mature,link_domains,flair_required,members_only,allow_crossposts,allow_user_flair";
const AUTHOR = "author:profiles!author_id(id,username,avatar_url)";
const POST_BASE =
  `id,community_id,title,body,score,comment_count,created_at,edited_at,image_url,image_urls,pinned_at,locked,spoiler,mature,` +
  `community:communities(id,name,color,icon_url,is_mature,link_domains,status,who_can_comment,allow_crossposts,created_by,privacy,who_can_post,allow_user_flair),${AUTHOR},` +
  `poll:poll_options(id,position,label,votes),flair:hub_flairs(id,label,color),` +
  // The post a crosspost shares (null when guests can't see it, or it was removed).
  `original(id,title,body,image_url,image_urls,created_at,community:communities(id,name,color,icon_url),author:profiles!author_id(id,username,avatar_url))`;
/** Every post column for a signed-in reader (for embeds like saved posts). */
export const POST_SELECT = `${POST_BASE},my_vote:post_votes(value),my_poll:poll_votes(option_id),my_save:saved_posts(post_id),my_follow:post_follows(post_id)`;
const postColumns = (signedIn: boolean) =>
  signedIn ? POST_SELECT : POST_BASE;
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
const FEED_BODY_CHARS = 2000;

export type FeedQuery = {
  sort: Sort;
  range?: Range;
  hubId?: number;
  authorId?: string;
  hubIds?: number[];
  peopleIds?: string[];
  search?: string;
  offset?: number;
  /** People you blocked: their posts stay out of your feeds. */
  blocked?: string[];
  /** True: only posts on people's profiles. False: only posts in hubs. */
  profiles?: boolean;
  /** Hubs you muted: they stay out of your home feed. */
  muted?: number[];
  /** Hubs you left on Popular show only what people liked or what's new; these hubs show everything. */
  popular?: { allHubs: number[]; since: string };
};

/** Who's looking at a feed, for the card's Join button and ⋮ menu. */
export type Viewer = { id: string; admin: boolean; hubs: number[]; staffHubs: number[]; removeHubs: number[] };
export async function fetchViewer(sb: SupabaseClient, uid: string | undefined | null): Promise<Viewer | null> {
  if (!uid) return null;
  const [admin, hubs, mods] = await Promise.all([
    isSiteAdmin(sb, uid),
    myHubIds(sb, uid),
    sb.from("hub_mods").select("hub_id,can_posts").eq("user_id", uid).then(r => (r.data ?? []) as { hub_id: number; can_posts: boolean }[]),
  ]);
  return { id: uid, admin, hubs, staffHubs: mods.map(m => m.hub_id), removeHubs: mods.filter(m => m.can_posts).map(m => m.hub_id) };
}

export async function fetchHubPrefs(sb: SupabaseClient, uid: string): Promise<{ hub_id: number; level: "all" | "mute" }[]> {
  const { data } = await sb.from("hub_prefs").select("hub_id,level").eq("user_id", uid);
  return (data ?? []) as { hub_id: number; level: "all" | "mute" }[];
}

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
  if (q.profiles === true) query = query.is("community_id", null);
  if (q.profiles === false) query = query.not("community_id", "is", null);
  if (q.blocked?.length) query = query.not("author_id", "in", `(${q.blocked.join(",")})`);
  if (q.muted?.length) query = query.not("community_id", "in", `(${q.muted.join(",")})`);
  if (q.popular) {
    const all = q.popular.allHubs.length ? `community_id.in.(${q.popular.allHubs.join(",")}),` : "";
    query = query.or(`${all}score.gte.1,created_at.gte.${q.popular.since}`);
  }
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
  // Lists only show a preview, so a long story doesn't get sent to the browser in full.
  const posts = ((data ?? []) as unknown as Post[]).map(p => (p.body.length > FEED_BODY_CHARS ? { ...p, body: p.body.slice(0, FEED_BODY_CHARS) } : p));
  return { posts, next: posts.length === PAGE_SIZE ? offset + PAGE_SIZE : null };
}

/** The video a page says it holds, from the same preview function as the link cards. Gives up quickly: the card can still show it. */
export async function previewVideo(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/link-preview`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(2500),
    });
    return res.ok ? ((await res.json()).video ?? null) : null;
  } catch {
    return null;
  }
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
    case "followed_post": return `${who} commented on a post you follow: ${what}`;
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

export const HUB_SETTINGS_COLUMNS = HUB_COLUMNS + ",automod_words,automod_domains,automod_min_days,filter_swearing";

export type HubMod = { user: { id: string; username: string; avatar_url: string | null }; can_posts: boolean; can_members: boolean; can_settings: boolean };

export async function isSiteAdmin(sb: SupabaseClient, uid: string | undefined | null): Promise<boolean> {
  if (!uid) return false;
  const { data } = await sb.from("site_admins").select("user_id").eq("user_id", uid);
  return (data ?? []).length > 0;
}

export async function hubTeam(sb: SupabaseClient, hubId: number): Promise<HubMod[]> {
  const { data } = await sb.from("hub_mods").select("can_posts,can_members,can_settings,user:profiles!user_id(id,username,avatar_url)").eq("hub_id", hubId).order("added_at");
  return ((data ?? []) as unknown as HubMod[]).filter(m => m.user);
}

export async function blockedIds(sb: SupabaseClient, uid: string | undefined | null): Promise<string[]> {
  if (!uid) return [];
  const { data } = await sb.from("blocks").select("blocked_id").eq("blocker_id", uid);
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
}

/** What someone may do in a hub; mirrors the app's HubAccess (the database has the final say). */
export type Access = { isStaff: boolean; isOwner: boolean; canRemove: boolean; canMembers: boolean; canSettings: boolean; canPost: boolean; canComment: boolean };
export function hubAccess(hub: { created_by: string | null; status: string; privacy: string; who_can_post: string; who_can_comment: string } | null, uid: string | null, admin: boolean, team: HubMod[], joined: boolean, banned: boolean): Access {
  const none = { isStaff: false, isOwner: false, canRemove: false, canMembers: false, canSettings: false, canPost: false, canComment: false };
  if (!uid) return none;
  if (!hub) return { ...none, isStaff: admin, isOwner: admin, canRemove: admin, canPost: true, canComment: true };
  const owner = admin || hub.created_by === uid;
  const mine = team.find(m => m.user.id === uid);
  const staff = owner || !!mine;
  const open = hub.status !== "archived" && !banned && (hub.privacy !== "private" || joined);
  return {
    isStaff: staff,
    isOwner: owner,
    canRemove: owner || !!mine?.can_posts,
    canMembers: owner || !!mine?.can_members,
    canSettings: owner || !!mine?.can_settings,
    canPost: staff || (open && (hub.who_can_post === "mods" ? false : hub.who_can_post === "members" ? joined : true)),
    canComment: staff || (open && (hub.who_can_comment !== "members" || joined)),
  };
}

/** One line of plain English for a mod log entry, worded like the app. */
export function describeModAction(e: { action: string; detail: string; actor: { username: string } | null; target: { username: string } | null }): string {
  const who = e.actor ? `u/${e.actor.username}` : "A mod";
  const whom = e.target ? `u/${e.target.username}` : "[deleted]";
  const about = e.detail?.trim() ? `: ${e.detail}` : "";
  switch (e.action) {
    case "remove_post": return `${who} removed a post by ${whom}${about}`;
    case "remove_comment": return `${who} removed a comment by ${whom}${about}`;
    case "pin": return `${who} pinned${about}`;
    case "unpin": return `${who} unpinned${about}`;
    case "lock": return `${who} locked${about}`;
    case "unlock": return `${who} unlocked${about}`;
    case "change_prefix": return `${who} changed the prefix on${about}`;
    case "change_tags": return `${who} changed the tags on${about}`;
    case "ban": return `${who} banned ${whom}${about}`;
    case "unban": return `${who} unbanned ${whom}`;
    case "add_mod": return `${who} added ${whom} as a mod`;
    case "remove_mod": return `${who} removed ${whom} as a mod`;
    case "remove_member": return `${who} removed ${whom} from the hub`;
    case "edit_settings": return `${who} changed the hub settings`;
    default: return `${who}: ${e.action}${about}`;
  }
}
