import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { Avatar } from "@/components/Avatars";
import { FeedList } from "@/components/FeedList";
import { FollowButton } from "@/components/JoinButton";
import { SortTabs } from "@/components/SortTabs";
import { monthYear } from "@/lib/format";
import { fetchPosts, fetchProfile, parseRange, parseSort } from "@/lib/queries";
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
  const [page, follow] = await Promise.all([
    fetchPosts(sb, { sort, range, authorId: profile.id }, !!me),
    me && me.id !== profile.id ? sb.from("follows").select("followee_id").eq("follower_id", me.id).eq("followee_id", profile.id).maybeSingle() : null,
  ]);
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
                {profile.banned_at ? "Banned from Nakodu" : profile.created_at ? `Joined ${monthYear(profile.created_at)}` : ""}
              </span>
            </div>
            {me?.id !== profile.id && (
              <div style={{ paddingTop: profile.cover_url ? 36 : 0 }}>
                <FollowButton userId={profile.id} following={!!follow?.data} signedIn={!!me} />
              </div>
            )}
          </div>
        </header>
        <SortTabs base={`/u/${profile.username}`} sort={sort} range={range} defaultSort="new" />
        <FeedList initial={page.posts} next={page.next} query={{ sort, range, authorId: profile.id }} showHub signedIn={!!me} empty="No posts yet." />
      </div>
      <aside className="side" />
    </main>
  );
}
