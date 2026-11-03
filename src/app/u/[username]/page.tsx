import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { Avatar } from "@/components/Avatars";
import { Icon, I } from "@/components/Icon";
import { FeedList } from "@/components/FeedList";
import { Viewable } from "@/components/Lightbox";
import { ProfileComments, type ProfileComment } from "@/components/ProfileComments";
import { ProfileActions, SelfActions } from "@/components/ProfileActions";
import { SortTabs } from "@/components/SortTabs";
import { monthYear } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/config";
import { PROFILE_COMMENT_COLUMNS, blockedIds, fetchPosts, fetchProfile, fetchViewer, isSiteAdmin, parseRange, parseSort } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

const load = cache(async (username: string) => {
  const sb = await serverSupabase();
  return { sb, profile: await fetchProfile(sb, decodeURIComponent(username)) };
});

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { profile } = await load((await params).username);
  if (!profile) return { title: "User not found" };
  return { title: `u/${profile.username}`, description: `Posts by u/${profile.username} on Nakodu.`, alternates: { canonical: `/u/${profile.username}` } };
}

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const { sb, profile } = await load(username);
  if (!profile) notFound();
  if (profile.username !== decodeURIComponent(username)) redirect(`/u/${profile.username}`);
  const me = await currentUser();
  const sort = sp.sort ? parseSort(sp.sort) : "new";
  const range = parseRange(sp.t);
  const tab = sp.tab === "comments" ? "comments" : "posts";
  const [page, follow, admin, blocked, counts, sparkCount, comments] = await Promise.all([
    tab === "posts" ? fetchPosts(sb, { sort, range, authorId: profile.id }, !!me) : Promise.resolve({ posts: [], next: null }),
    me && me.id !== profile.id ? sb.from("follows").select("followee_id").eq("follower_id", me.id).eq("followee_id", profile.id).maybeSingle() : null,
    isSiteAdmin(sb, me?.id),
    blockedIds(sb, me?.id),
    sb.from("profiles").select("followers:follows!followee_id(count),following:follows!follower_id(count)").eq("id", profile.id).maybeSingle(),
    // Sparks: the score of everything someone posted and commented, counted by the database (like the app).
    sb.rpc("user_sparks", { uid: profile.id }),
    tab === "comments"
      ? sb.from("comments").select(PROFILE_COMMENT_COLUMNS).eq("author_id", profile.id).eq("deleted", false).order("created_at", { ascending: false }).limit(PAGE_SIZE)
      : Promise.resolve({ data: [] }),
  ]);
  const sparks = (sparkCount.data as number | null) ?? 0;
  const c = counts.data as unknown as { followers: { count: number }[]; following: { count: number }[] } | null;
  const followers = c?.followers?.[0]?.count ?? 0;
  const followingCount = c?.following?.[0]?.count ?? 0;
  const isSelf = me?.id === profile.id;
  return (
    <main className="page">
      <div>
        <header className="head">
          {profile.cover_url && <Viewable src={profile.cover_url} label="View cover" className="banner-view"><div className="banner" style={{ backgroundImage: `url(${profile.cover_url})` }} /></Viewable>}
          <div className={`head-row ${profile.cover_url ? "" : "no-banner"}`}>
            <Viewable src={profile.avatar_url} label="View avatar"><Avatar user={profile} size={profile.cover_url ? 88 : 64} /></Viewable>
            <div className="head-title">
              <h1>u/{profile.username}</h1>
              <span className="muted small">
                {profile.banned_at ? "Banned from Nakodu" : `${sparks === 1 ? "1 spark" : `${sparks} sparks`}   ${profile.created_at ? `Joined ${monthYear(profile.created_at)}` : ""}`}
              </span>
              <span className="muted small" style={{ display: "flex", gap: 14, marginTop: 2 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }} aria-label={followers === 1 ? "1 follower" : `${followers} followers`} title="Followers"><Icon icon={I.users} size={13} /> {followers}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }} aria-label={`${followingCount} following`} title="Following"><Icon icon={I.following} size={13} /> {followingCount}</span>
              </span>
            </div>
            <div style={{ paddingTop: profile.cover_url ? 36 : 0 }}>
              {isSelf ? (
                <SelfActions hasCover={!!profile.cover_url} />
              ) : (
                <ProfileActions userId={profile.id} username={profile.username} following={!!follow?.data} blocked={blocked.includes(profile.id)} banned={!!profile.banned_at} signedIn={!!me} admin={admin} />
              )}
            </div>
          </div>
        </header>
        <nav className="tabs big" aria-label="Profile">
          <Link href={`/u/${profile.username}`} className={tab === "posts" ? "on" : ""} aria-current={tab === "posts" ? "page" : undefined}>Posts</Link>
          <Link href={`/u/${profile.username}?tab=comments`} className={tab === "comments" ? "on" : ""} aria-current={tab === "comments" ? "page" : undefined}>Comments</Link>
        </nav>
        {tab === "comments" ? (
          <ProfileComments authorId={profile.id} initial={(comments.data ?? []) as unknown as ProfileComment[]} signedIn={!!me} />
        ) : (
          <>
            <SortTabs base={`/u/${profile.username}`} sort={sort} range={range} defaultSort="new" />
            <FeedList initial={page.posts} next={page.next} query={{ sort, range, authorId: profile.id }} showHub signedIn={!!me} viewer={await fetchViewer(sb, me?.id)} empty="No posts yet." />
          </>
        )}
      </div>
      <aside className="side" />
    </main>
  );
}
