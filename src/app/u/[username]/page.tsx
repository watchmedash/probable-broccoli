import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { Avatar } from "@/components/Avatars";
import { FeedList } from "@/components/FeedList";
import { ProfileActions, SelfActions } from "@/components/ProfileActions";
import { SortTabs } from "@/components/SortTabs";
import { monthYear } from "@/lib/format";
import { blockedIds, fetchPosts, fetchProfile, fetchViewer, isSiteAdmin, parseRange, parseSort } from "@/lib/queries";
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
  const [page, follow, admin, blocked, counts, postScores, commentScores] = await Promise.all([
    fetchPosts(sb, { sort, range, authorId: profile.id }, !!me),
    me && me.id !== profile.id ? sb.from("follows").select("followee_id").eq("follower_id", me.id).eq("followee_id", profile.id).maybeSingle() : null,
    isSiteAdmin(sb, me?.id),
    blockedIds(sb, me?.id),
    sb.from("profiles").select("followers:follows!followee_id(count),following:follows!follower_id(count)").eq("id", profile.id).maybeSingle(),
    sb.from("posts").select("score").eq("author_id", profile.id),
    sb.from("comments").select("score").eq("author_id", profile.id),
  ]);
  // Sparks: everything someone posted or commented, added up (like the app).
  const sparks = [...(postScores.data ?? []), ...(commentScores.data ?? [])].reduce((n, r: { score: number }) => n + r.score, 0);
  const c = counts.data as unknown as { followers: { count: number }[]; following: { count: number }[] } | null;
  const followers = c?.followers?.[0]?.count ?? 0;
  const followingCount = c?.following?.[0]?.count ?? 0;
  const isSelf = me?.id === profile.id;
  return (
    <main className="page">
      <div>
        <header className="head">
          {profile.cover_url && <div className="banner" style={{ backgroundImage: `url(${profile.cover_url})` }} />}
          <div className={`head-row ${profile.cover_url ? "" : "no-banner"}`}>
            <Avatar user={profile} size={profile.cover_url ? 88 : 64} />
            <div className="head-title">
              <h1>u/{profile.username}</h1>
              <span className="muted small">
                {profile.banned_at ? "Banned from Nakodu" : `${sparks === 1 ? "1 spark" : `${sparks} sparks`}   ${profile.created_at ? `Joined ${monthYear(profile.created_at)}` : ""}`}
                <br />{followers === 1 ? "1 follower" : `${followers} followers`}   {followingCount} following
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
        <SortTabs base={`/u/${profile.username}`} sort={sort} range={range} defaultSort="new" />
        <FeedList initial={page.posts} next={page.next} query={{ sort, range, authorId: profile.id }} showHub signedIn={!!me} viewer={await fetchViewer(sb, me?.id)} empty="No posts yet." />
      </div>
      <aside className="side" />
    </main>
  );
}
