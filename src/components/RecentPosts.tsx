"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { guestOpens } from "@/lib/guestOpens";
import { timeAgo } from "@/lib/format";
import { browserSupabase } from "@/lib/supabase/client";
import { HubIcon } from "./Avatars";
import { Icon, I } from "./Icon";

const KEY = "nakodu:recent";
const MAX = 10;

export type RecentPost = {
  id: number; title: string; created_at: string; score: number; comments: number; image: string | null;
  spoiler?: boolean; mature?: boolean;
  hub: { name: string; color: string; icon_url: string | null } | null; author: string | null;
};

type Fresh = { id: number; title: string; score: number; comment_count: number; spoiler: boolean; mature: boolean; image_url: string | null; image_urls: string[] | null; original: { spoiler: boolean; mature: boolean } | null };

function read(): RecentPost[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

function write(list: RecentPost[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(KEY));
  } catch {}
}

/** Covers or uncovers a post on the list, once it's marked. */
export function tagRecent(id: number, spoiler: boolean, mature: boolean) {
  write(read().map(p => (p.id === id ? { ...p, spoiler, mature } : p)));
}

/** Takes a post off the list, once it's deleted or removed. */
export function forgetRecent(id: number) {
  write(read().filter(p => p.id !== id));
}

/** Remembers an opened post on this browser (newest first, at most 10). */
export function RecordVisit({ post }: { post: RecentPost }) {
  useEffect(() => {
    write([post, ...read().filter(p => p.id !== post.id)].slice(0, MAX));
  }, [post]);
  return null;
}

type PopularRow = {
  id: number; title: string; created_at: string; score: number; comment_count: number; spoiler: boolean; mature: boolean;
  image_url: string | null; image_urls: string[] | null;
  community: { name: string; color: string; icon_url: string | null; is_mature: boolean } | null;
};

/** The week's most liked hub posts (all time if the week is quiet), leaving out 18+. */
async function popularPosts(): Promise<RecentPost[]> {
  const sb = browserSupabase();
  const columns = "id,title,created_at,score,comment_count,spoiler,mature,image_url,image_urls,community:communities!inner(name,color,icon_url,is_mature)";
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const query = (recent: boolean) => {
    let q = sb.from("posts").select(columns).eq("mature", false).eq("community.is_mature", false).eq("community.unlisted", false).eq("held", false).order("score", { ascending: false }).order("created_at", { ascending: false }).limit(MAX);
    if (recent) q = q.gte("created_at", since);
    return q;
  };
  let { data } = await query(true);
  if ((data ?? []).length < MAX) data = (await query(false)).data;
  return ((data ?? []) as unknown as PopularRow[]).map(r => ({
    id: r.id, title: r.title, created_at: r.created_at, score: r.score, comments: r.comment_count,
    image: r.image_urls?.[0] ?? r.image_url, spoiler: r.spoiler, mature: r.mature,
    hub: r.community ? { name: r.community.name, color: r.community.color, icon_url: r.community.icon_url } : null, author: null,
  }));
}

function Item({ p, signedIn }: { p: RecentPost; signedIn: boolean }) {
  const router = useRouter();
  return (
    <Link href={`/p/${p.id}`} className="recent-item" onClick={guestOpens(signedIn, router, `/p/${p.id}`)}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="meta" style={{ fontSize: 12 }}>
          {p.hub ? <><HubIcon hub={p.hub} size={18} /><b style={{ color: "var(--ink)" }}>n/{p.hub.name}</b></> : <b style={{ color: "var(--ink)" }}>u/{p.author ?? "deleted"}</b>}
          <span>{timeAgo(p.created_at)}</span>
        </span>
        <span className="recent-title">{p.title}</span>
        <span className="muted small">{p.score === 1 ? "1 upvote" : `${p.score} upvotes`}{p.comments > 0 && `   ${p.comments === 1 ? "1 comment" : `${p.comments} comments`}`}</span>
      </span>
      {p.image && (p.spoiler || p.mature ? (
        <span className="recent-cover">
          <img src={p.image} alt="" loading="lazy" className="recent-thumb" />
          <span><Icon icon={I.eye} size={20} /></span>
        </span>
      ) : <img src={p.image} alt="" loading="lazy" className="recent-thumb" />)}
    </Link>
  );
}

/**
 * Posts you opened lately, kept only in this browser, with Clear. Until there are 10 of them,
 * popular posts fill the rest, and they make room as your own list grows.
 */
export function RecentPosts() {
  const [items, setItems] = useState<RecentPost[] | null>(null);
  const [popular, setPopular] = useState<RecentPost[]>([]);
  const [signedIn, setSignedIn] = useState(true);
  useEffect(() => {
    popularPosts().then(setPopular).catch(() => {});
    browserSupabase().auth.getSession().then(({ data }) => setSignedIn(!!data.session)).catch(() => {});
  }, []);
  useEffect(() => {
    const load = () => setItems(read());
    load();
    window.addEventListener(KEY, load);
    // The list lives in this browser, so what changed since, here or elsewhere, has to be looked up. A failed lookup leaves it alone.
    const ids = read().map(p => p.id);
    if (ids.length) {
      Promise.resolve(browserSupabase().from("posts").select("id,title,score,comment_count,spoiler,mature,image_url,image_urls,original(spoiler,mature)").in("id", ids)).then(({ data, error }) => {
        if (error || !data) return;
        const rows = data as unknown as Fresh[];
        const before = read();
        const after = before
          .filter(p => !ids.includes(p.id) || rows.some(r => r.id === p.id))
          .map(p => {
            const r = rows.find(x => x.id === p.id);
            if (!r) return p;
            return {
              ...p, title: r.title, score: r.score, comments: r.comment_count,
              spoiler: r.spoiler || !!r.original?.spoiler, mature: r.mature || !!r.original?.mature,
              image: r.image_urls?.[0] ?? r.image_url ?? p.image,
            };
          });
        if (JSON.stringify(after) !== JSON.stringify(before)) write(after);
      }).catch(() => {});
    }
    return () => window.removeEventListener(KEY, load);
  }, []);
  if (!items) return null;
  const fill = popular.filter(p => !items.some(r => r.id === p.id)).slice(0, Math.max(0, MAX - items.length));
  if (items.length === 0 && fill.length === 0) return null;
  return (
    <section className="panel recent">
      {items.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 6px" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Recent posts</h2>
            <button className="linkish small" onClick={() => { try { localStorage.removeItem(KEY); } catch {} setItems([]); }}>Clear</button>
          </div>
          {items.map(p => <Item key={p.id} p={p} signedIn={signedIn} />)}
        </>
      )}
      {fill.length > 0 && (
        <>
          <h2 style={{ margin: 0, padding: "14px 16px 6px" }}>Popular posts</h2>
          {fill.map(p => <Item key={p.id} p={p} signedIn={signedIn} />)}
        </>
      )}
    </section>
  );
}
