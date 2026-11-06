import type { Metadata } from "next";
import Link from "next/link";
import { HubIcon } from "@/components/Avatars";
import { Icon, I } from "@/components/Icon";
import { JoinButton } from "@/components/JoinButton";
import { FavoriteStar } from "@/components/FavoriteStar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { categoryLabel } from "@/lib/categories";
import { favoriteHubIds, fetchHubs, myHubIds, seesMature } from "@/lib/queries";
import type { Hub } from "@/lib/types";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hubs", description: "Every hub on Nakodu.", alternates: { canonical: "/hubs" } };

/** Icon, name and Join, like the app's hub list. Signed in: the hubs you joined, and the rest. */
export default async function HubsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await currentUser();
  const sb = await serverSupabase();
  const [everyHub, mine, favs, trendingIds, interests, mature] = await Promise.all([
    fetchHubs(sb),
    me ? myHubIds(sb, me.id) : Promise.resolve([] as number[]),
    me ? favoriteHubIds(sb, me.id) : Promise.resolve([] as number[]),
    sb.rpc("trending_hubs", { max_hubs: 6 }).then(r => (r.data ?? []) as number[]),
    me ? sb.from("user_interests").select("category").eq("user_id", me.id).then(r => (r.data ?? []).map((x: { category: string }) => x.category)) : Promise.resolve([] as string[]),
    seesMature(sb, me?.id),
  ]);
  // 18+ hubs are listed only with "Show 18+ hubs" on (or once joined); adults still find them in search.
  const all = everyHub.filter(h => !h.is_mature || mature || mine.includes(h.id));
  const cat = sp.cat ?? "";
  // Starred hubs lead each list.
  const hubs = [...all].filter(h => !h.unlisted || mine.includes(h.id)).sort((a, b) => Number(favs.includes(b.id)) - Number(favs.includes(a.id)));
  const joined = hubs.filter(h => mine.includes(h.id));
  const others = hubs.filter(h => !mine.includes(h.id));
  // New accounts have nothing joined, so they start on the other tab.
  const tab = !me || sp.tab === "all" || (sp.tab !== "joined" && joined.length === 0) ? "all" : "joined";
  const shown = tab === "joined" ? joined : cat ? hubs.filter(h => h.categories?.includes(cat)) : others;
  // Discovery, on All hubs without a category picked: what matches your interests, then what's busy this week.
  const suggested = tab === "all" && !cat ? others.filter(h => h.categories?.some(c => interests.includes(c))).sort((a, b) => b.member_count - a.member_count).slice(0, 6) : [];
  const trending = tab === "all" && !cat ? trendingIds.map(id => all.find(h => h.id === id)).filter((h): h is Hub => !!h) : [];
  const row = (h: Hub) => (
    <Link key={h.id} href={`/n/${h.name}`} className="hub-row">
      <HubIcon hub={h} size={44} />
      <span className="name" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        n/{h.name}
        {!!h.categories?.length && <span className="muted small" style={{ fontWeight: 400 }}>{h.categories.map(categoryLabel).join(", ")}</span>}
      </span>
      {me && <FavoriteStar hubId={h.id} hubName={h.name} on={favs.includes(h.id)} className="icon-btn hub-fav" />}
      <JoinButton hubId={h.id} joined={mine.includes(h.id)} isPrivate={h.privacy === "private"} signedIn={!!me} small />
    </Link>
  );
  const section = (title: string) => <h2 className="hubs-section">{title}</h2>;
  return (
    <main className="page single">
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>Hubs</h1>
          {me && <Link href="/hubs/new" className="icon-btn" aria-label="Create a hub" title="Create a hub"><Icon icon={I.plus} size={18} /></Link>}
        </div>
        {me && (
          <nav className="tabs" aria-label="Hubs">
            <Link href="/hubs?tab=joined" className={tab === "joined" ? "on" : ""} aria-current={tab === "joined" ? "page" : undefined}>Joined</Link>
            <Link href="/hubs?tab=all" className={tab === "all" ? "on" : ""} aria-current={tab === "all" ? "page" : undefined}>All hubs</Link>
          </nav>
        )}
        {tab === "all" && <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}><CategoryFilter value={cat} /></div>}
        {suggested.length > 0 && <>{section("Suggested for you")}{suggested.map(row)}</>}
        {trending.length > 0 && <>{section("Trending this week")}{trending.map(row)}</>}
        {(suggested.length > 0 || trending.length > 0) && section("Every hub")}
        {shown.length === 0 && <div className="empty">{tab === "joined" ? "Hubs you join show up here." : cat ? "No hubs in this category yet." : "You've joined every hub."}</div>}
        {shown.map(row)}
      </div>
    </main>
  );
}
