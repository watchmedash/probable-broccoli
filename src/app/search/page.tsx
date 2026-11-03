import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, HubIcon } from "@/components/Avatars";
import { FeedList } from "@/components/FeedList";
import { SearchForm } from "@/components/SearchForm";
import { SortTabs } from "@/components/SortTabs";
import { fetchHubByName, fetchPosts, fetchViewer, HUB_COLUMNS, blockedIds, parseRange, parseSort } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";
import type { Hub, Profile } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { renderPreview } from "@/lib/markdown";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

type Kind = "posts" | "comments" | "hubs" | "people";
type Found = { id: number; body: string; score: number; created_at: string; author: Profile | null; post: { id: number; title: string; community: { name: string } | null } | null };
const like = (q: string) => `%${q.replace(/[\\%_]/g, m => "\\" + m)}%`;

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const me = await currentUser();
  const sb = await serverSupabase();
  // Searching from inside a hub stays inside it, so only posts apply.
  const scope = sp.hub ? await fetchHubByName(sb, sp.hub) : null;
  const kind: Kind = !scope && (sp.type === "hubs" || sp.type === "people" || sp.type === "comments") ? sp.type : "posts";
  const tab = (k: Kind, label: string) => (
    <Link href={`/search?q=${encodeURIComponent(q)}${k === "posts" ? "" : `&type=${k}`}`} className={kind === k ? "on" : ""}>{label}</Link>
  );

  let body: React.ReactNode = <div className="empty">{scope ? `Search posts in n/${scope.name}.` : "Search posts, comments, hubs and people."}</div>;
  if (q) {
    if (kind === "posts") {
      const sort = sp.sort ? parseSort(sp.sort) : "top";
      const range = parseRange(sp.t);
      const [blocked, viewer] = await Promise.all([blockedIds(sb, me?.id), fetchViewer(sb, me?.id)]);
      const query = { sort, range, search: q, blocked, hubId: scope?.id };
      const page = await fetchPosts(sb, query, !!me);
      body = (
        <>
          <SortTabs base="/search" sort={sort} range={range} defaultSort="top" extra={{ q, ...(scope ? { hub: scope.name } : {}) }} />
          <FeedList initial={page.posts} next={page.next} query={query} showHub={!scope} signedIn={!!me} viewer={viewer} empty={`No posts match "${q}".`} />
        </>
      );
    } else if (kind === "comments") {
      // Every word has to appear, newest first. Comments on posts you can't see are left out.
      let query = sb.from("comments").select("id,body,score,created_at,author:profiles!author_id(id,username,avatar_url),post:posts(id,title,community:communities(name))").eq("deleted", false);
      for (const w of q.split(/s+/).filter(Boolean).slice(0, 6)) query = query.ilike("body", like(w));
      const { data } = await query.order("created_at", { ascending: false }).limit(40);
      const found = ((data ?? []) as unknown as Found[]).filter(c => c.post);
      body = found.length ? (
        <div className="feed">
          {found.map(c => (
            <article key={c.id} className="card">
              <div className="meta">
                <Avatar user={c.author} size={20} />
                <b style={{ color: "var(--ink)" }}>u/{c.author?.username ?? "deleted"}</b>
                {c.post!.community && <span>in n/{c.post!.community.name}</span>}
                <span>{timeAgo(c.created_at)}</span>
              </div>
              <Link href={`/p/${c.post!.id}?c=${c.id}#comments`} style={{ display: "block" }}>
                <span className="muted small" style={{ display: "block", margin: "4px 0" }}>{c.post!.title}</span>
                <div className="card-body md card-md" dangerouslySetInnerHTML={{ __html: renderPreview(c.body, 500) }} />
              </Link>
            </article>
          ))}
        </div>
      ) : <div className="empty">No comments match &quot;{q}&quot;.</div>;
    } else if (kind === "hubs") {
      const { data } = await sb.from("communities").select(HUB_COLUMNS).or(`name.ilike.${like(q)},description.ilike.${like(q)}`).order("member_count", { ascending: false }).limit(30);
      const hubs = (data ?? []) as Hub[];
      body = hubs.length ? hubs.map(h => (
        <Link key={h.id} href={`/n/${h.name}`} className="hub-row"><HubIcon hub={h} size={40} /><span className="name">n/{h.name}</span></Link>
      )) : <div className="empty">No hubs match &quot;{q}&quot;.</div>;
    } else {
      const { data } = await sb.from("profiles").select("id,username,avatar_url").ilike("username", like(q)).order("username").limit(30);
      const people = (data ?? []) as Profile[];
      body = people.length ? people.map(p => (
        <Link key={p.id} href={`/u/${p.username}`} className="hub-row"><Avatar user={p} size={40} /><span className="name">u/{p.username}</span></Link>
      )) : <div className="empty">Nobody matches &quot;{q}&quot;.</div>;
    }
  }
  return (
    <main className="page single">
      <div>
        <div className="show-sm" style={{ padding: 12, background: "var(--surface)" }}><SearchForm initial={q} hub={scope?.name} /></div>
        {scope ? (
          <div className="panel-pad small" style={{ background: "var(--surface)", display: "flex", gap: 12, alignItems: "center" }}>
            <Link href={`/n/${scope.name}`} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, fontWeight: 600 }}><HubIcon hub={scope} size={24} /> n/{scope.name}</Link>
            {q && <Link href={`/search?q=${encodeURIComponent(q)}`} className="linkish">Search all of Nakodu</Link>}
          </div>
        ) : q && <nav className="tabs" aria-label="Search in">{tab("posts", "Posts")}{tab("comments", "Comments")}{tab("hubs", "Hubs")}{tab("people", "People")}</nav>}
        {body}
      </div>
    </main>
  );
}
