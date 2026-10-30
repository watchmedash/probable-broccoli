import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, HubIcon } from "@/components/Avatars";
import { FeedList } from "@/components/FeedList";
import { SearchForm } from "@/components/SearchForm";
import { fetchPosts, HUB_COLUMNS, blockedIds } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";
import type { Hub, Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

type Kind = "posts" | "hubs" | "people";
const like = (q: string) => `%${q.replace(/[\\%_]/g, m => "\\" + m)}%`;

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const kind: Kind = sp.type === "hubs" || sp.type === "people" ? sp.type : "posts";
  const me = await currentUser();
  const sb = await serverSupabase();
  const tab = (k: Kind, label: string) => (
    <Link href={`/search?q=${encodeURIComponent(q)}${k === "posts" ? "" : `&type=${k}`}`} className={kind === k ? "on" : ""}>{label}</Link>
  );

  let body: React.ReactNode = <div className="empty">Search posts, hubs and people.</div>;
  if (q) {
    if (kind === "posts") {
      const blocked = await blockedIds(sb, me?.id);
      const page = await fetchPosts(sb, { sort: "top", search: q, blocked }, !!me);
      body = <FeedList initial={page.posts} next={page.next} query={{ sort: "top", search: q, blocked }} showHub signedIn={!!me} empty={`No posts match "${q}".`} />;
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
        <div className="show-sm" style={{ padding: 12, background: "var(--surface)" }}><SearchForm initial={q} /></div>
        {q && <nav className="tabs" aria-label="Search in">{tab("posts", "Posts")}{tab("hubs", "Hubs")}{tab("people", "People")}</nav>}
        {body}
      </div>
    </main>
  );
}
