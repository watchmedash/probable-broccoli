"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";
import { browserSupabase } from "@/lib/supabase/client";
import { HubIcon } from "./Avatars";

const KEY = "nakodu:recent";
const MAX = 10;

export type RecentPost = {
  id: number; title: string; created_at: string; score: number; comments: number; image: string | null;
  hub: { name: string; color: string; icon_url: string | null } | null; author: string | null;
};

function read(): RecentPost[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

function write(list: RecentPost[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(KEY));
  } catch {}
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

/** Posts you opened lately, kept only in this browser, with Clear. */
export function RecentPosts() {
  const [items, setItems] = useState<RecentPost[] | null>(null);
  useEffect(() => {
    const load = () => setItems(read());
    load();
    window.addEventListener(KEY, load);
    // The list lives in this browser, so posts deleted since, here or elsewhere, have to be looked up. A failed lookup leaves it alone.
    const ids = read().map(p => p.id);
    if (ids.length) {
      Promise.resolve(browserSupabase().from("posts").select("id").in("id", ids)).then(({ data, error }) => {
        if (error || !data) return;
        const left = new Set(data.map((d: { id: number }) => d.id));
        const gone = ids.filter(id => !left.has(id));
        if (gone.length) write(read().filter(p => !gone.includes(p.id)));
      }).catch(() => {});
    }
    return () => window.removeEventListener(KEY, load);
  }, []);
  if (!items || items.length === 0) return null;
  return (
    <section className="panel recent">
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 6px" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Recent posts</h2>
        <button className="linkish small" onClick={() => { try { localStorage.removeItem(KEY); } catch {} setItems([]); }}>Clear</button>
      </div>
      {items.map(p => (
        <Link key={p.id} href={`/p/${p.id}`} className="recent-item">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="meta" style={{ fontSize: 12 }}>
              {p.hub ? <><HubIcon hub={p.hub} size={18} /><b style={{ color: "var(--ink)" }}>n/{p.hub.name}</b></> : <b style={{ color: "var(--ink)" }}>u/{p.author ?? "deleted"}</b>}
              <span>{timeAgo(p.created_at)}</span>
            </span>
            <span className="recent-title">{p.title}</span>
            <span className="muted small">{p.score === 1 ? "1 upvote" : `${p.score} upvotes`}   {p.comments === 1 ? "1 comment" : `${p.comments} comments`}</span>
          </span>
          {p.image && <img src={p.image} alt="" loading="lazy" className="recent-thumb" />}
        </Link>
      ))}
    </section>
  );
}
