import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { HubIcon } from "@/components/Avatars";
import { FeedList } from "@/components/FeedList";
import { JoinButton } from "@/components/JoinButton";
import { SortTabs } from "@/components/SortTabs";
import { countLabel } from "@/lib/format";
import { fetchHubByName, fetchPosts, parseRange, parseSort } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

const load = cache(async (name: string) => {
  const sb = await serverSupabase();
  return { sb, hub: await fetchHubByName(sb, decodeURIComponent(name)) };
});

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { hub } = await load((await params).name);
  if (!hub) return { title: "Hub not found" };
  return {
    title: `n/${hub.name}`,
    description: hub.description || `The n/${hub.name} hub on Nakodu.`,
    alternates: { canonical: `/n/${hub.name}` },
    robots: hub.is_mature ? { index: false } : undefined,
    openGraph: { title: `n/${hub.name}`, description: hub.description, url: `/n/${hub.name}`, images: hub.banner_url ? [{ url: hub.banner_url }] : undefined },
  };
}

export default async function HubPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ name }, sp] = await Promise.all([params, searchParams]);
  const { sb, hub } = await load(name);
  if (!hub) notFound();
  if (hub.name !== decodeURIComponent(name)) redirect(`/n/${hub.name}`);
  const me = await currentUser();
  const sort = parseSort(sp.sort);
  const range = parseRange(sp.t);
  const [page, member, request] = await Promise.all([
    fetchPosts(sb, { sort, range, hubId: hub.id }, !!me),
    me ? sb.from("hub_members").select("hub_id").eq("hub_id", hub.id).eq("user_id", me.id).maybeSingle() : null,
    me && hub.privacy === "private" ? sb.from("hub_join_requests").select("hub_id").eq("hub_id", hub.id).eq("user_id", me.id).maybeSingle() : null,
  ]);
  const joined = !!member?.data;
  const locked = (hub.privacy === "private" || hub.members_only) && !joined;
  const rules = hub.rules.split("\n").map(r => r.trim()).filter(Boolean);

  return (
    <main className="page">
      <div>
        <header className="head">
          {hub.banner_url && <div className="banner" style={{ backgroundImage: `url(${hub.banner_url})` }} role="img" aria-label="" />}
          <div className={`head-row ${hub.banner_url ? "" : "no-banner"}`}>
            <HubIcon hub={hub} size={hub.banner_url ? 80 : 56} />
            <div className="head-title">
              <h1>n/{hub.name}</h1>
              <span className="muted small">{countLabel(hub.member_count, "member")}{hub.is_mature ? "   18+" : ""}</span>
            </div>
            <div style={{ paddingTop: hub.banner_url ? 36 : 0, display: "flex", gap: 8 }}>
              {joined && <Link href={`/submit?hub=${hub.name}`} className="btn quiet hide-sm">Create a post</Link>}
              <JoinButton hubId={hub.id} joined={joined} requested={!!request?.data} isPrivate={hub.privacy === "private"} signedIn={!!me} />
            </div>
          </div>
          {hub.description && <p className="head-desc">{hub.description}</p>}
          {rules.length > 0 && (
            // Phones have no sidebar, so the rules fold out here.
            <details className="show-sm head-desc" style={{ paddingTop: 0 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink)" }}>Rules</summary>
              <ul className="rules" style={{ marginTop: 10 }}>{rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </details>
          )}
        </header>
        <SortTabs base={`/n/${hub.name}`} sort={sort} range={range} />
        {locked && page.posts.length === 0 ? (
          <div className="empty">{hub.privacy === "private" ? "This hub is private. Ask to join to see its posts." : "Only members see posts here. Join to read them."}</div>
        ) : (
          <FeedList initial={page.posts} next={page.next} query={{ sort, range, hubId: hub.id }} showHub={false} signedIn={!!me} empty="No posts here yet." />
        )}
      </div>
      <aside className="side">
        <section className="panel panel-pad">
          <h2>About</h2>
          <p style={{ margin: "0 0 10px" }}>{hub.description || "No description yet."}</p>
          <p className="muted small" style={{ margin: 0 }}>{countLabel(hub.member_count, "member")}</p>
        </section>
        {rules.length > 0 && (
          <section className="panel panel-pad">
            <h2>Rules</h2>
            {/* Exactly as the mods wrote them, numbers or not. */}
            <ul className="rules">{rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </section>
        )}
      </aside>
    </main>
  );
}
