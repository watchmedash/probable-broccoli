import Link from "next/link";
import { FeedList } from "@/components/FeedList";
import { HomeSidebar } from "@/components/Sidebar";
import { SortTabs } from "@/components/SortTabs";
import { fetchHubs, fetchPosts, followingIds, myHubIds, parseRange, parseSort, type FeedQuery } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

type Feed = "popular" | "all" | "following";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const me = await currentUser();
  const sb = await serverSupabase();
  const feed: Feed = params.feed === "popular" ? "popular" : params.feed === "following" && me ? "following" : "all";

  // Popular: the best of the past week everywhere. Following: your hubs and the people you follow.
  let query: FeedQuery;
  if (feed === "popular") query = { sort: "top", range: "week" };
  else query = { sort: parseSort(params.sort), range: parseRange(params.t) };
  if (feed === "following" && me) {
    const [hubIds, peopleIds] = await Promise.all([myHubIds(sb, me.id), followingIds(sb, me.id)]);
    query = { ...query, hubIds, peopleIds };
  }
  const [page, hubs] = await Promise.all([fetchPosts(sb, query, !!me), fetchHubs(sb)]);
  const tabs: [Feed, string][] = [["popular", "Popular"], ["all", "All"], ...(me ? [["following", "Following"] as [Feed, string]] : [])];

  return (
    <main className="page">
      <div>
        <nav className="tabs big" aria-label="Feeds">
          {tabs.map(([f, label]) => (
            <Link key={f} href={f === "all" ? "/" : `/?feed=${f}`} className={feed === f ? "on" : ""} aria-current={feed === f ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        {feed !== "popular" && <SortTabs base="/" sort={query.sort} range={query.range ?? "all"} extra={feed === "following" ? { feed } : {}} />}
        <FeedList
          initial={page.posts}
          next={page.next}
          query={query}
          showHub
          signedIn={!!me}
          empty={feed === "following" ? <>Join some hubs or follow people and their posts show up here. <Link href="/hubs" className="linkish">Find hubs</Link></> : "Nothing here yet."}
        />
      </div>
      <HomeSidebar hubs={[...hubs].sort((a, b) => b.member_count - a.member_count)} signedIn={!!me} />
    </main>
  );
}
