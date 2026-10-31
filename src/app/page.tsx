import Link from "next/link";
import { FeedList } from "@/components/FeedList";
import { RecentPosts } from "@/components/RecentPosts";
import { SortTabs } from "@/components/SortTabs";
import { fetchPosts, followingIds, myHubIds, parseRange, parseSort, type FeedQuery, blockedIds } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

type Feed = "popular" | "all" | "following";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const me = await currentUser();
  const sb = await serverSupabase();
  const feed: Feed = params.feed === "popular" ? "popular" : params.feed === "following" && me ? "following" : "all";

  // Popular: the best of the past week in hubs. Following: your hubs and the people you follow.
  // All: hub posts, with what people post on their profiles under its own Users tab.
  const users = feed === "all" && params.sort === "users";
  let query: FeedQuery;
  if (feed === "popular") query = { sort: "top", range: "week", profiles: false };
  else if (users) query = { sort: "new", profiles: true };
  else query = { sort: parseSort(params.sort), range: parseRange(params.t), profiles: feed === "all" ? false : undefined };
  if (feed === "following" && me) {
    const [hubIds, peopleIds] = await Promise.all([myHubIds(sb, me.id), followingIds(sb, me.id)]);
    query = { ...query, hubIds, peopleIds };
  }
  query = { ...query, blocked: await blockedIds(sb, me?.id) };
  const page = await fetchPosts(sb, query, !!me);
  const tabs: [Feed, string][] = [["popular", "Popular"], ["all", "All"], ...(me ? [["following", "Following"] as [Feed, string]] : [])];

  return (
    <main className="page">
      <div>
        <nav className="tabs big" aria-label="Feeds">
          {tabs.map(([f, label]) => (
            <Link key={f} href={f === "all" ? "/" : `/?feed=${f}`} className={feed === f ? "on" : ""} aria-current={feed === f ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        {feed !== "popular" && <SortTabs base="/" sort={query.sort} range={query.range ?? "all"} extra={feed === "following" ? { feed } : {}} users={feed === "all" ? users : undefined} />}
        <FeedList
          initial={page.posts}
          next={page.next}
          query={query}
          showHub
          signedIn={!!me}
          empty={feed === "following" ? <>Join some hubs or follow people and their posts show up here. <Link href="/hubs" className="linkish">Find hubs</Link></> : users ? "Posts people make on their profiles show up here." : "Nothing here yet."}
        />
      </div>
      <aside className="side"><RecentPosts /></aside>
    </main>
  );
}
