"use client";
import { useEffect, useRef, useState } from "react";
import type { Post } from "@/lib/types";
import { fetchPosts, type FeedQuery, type Viewer } from "@/lib/queries";
import { browserSupabase } from "@/lib/supabase/client";
import { PostCard } from "./PostCard";

/** The first page comes from the server (so search engines see it); the rest loads as you scroll. */
export function FeedList({ initial, next, query, showHub, signedIn, viewer, empty }: {
  initial: Post[]; next: number | null; query: FeedQuery; showHub: boolean; signedIn: boolean; viewer: Viewer | null; empty: React.ReactNode;
}) {
  const [posts, setPosts] = useState(initial);
  const [offset, setOffset] = useState(next);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const shown = useRef(JSON.stringify(query));

  useEffect(() => {
    const key = JSON.stringify(query);
    if (key !== shown.current) {
      shown.current = key;
      setPosts(initial);
      setOffset(next);
      return;
    }
    // Same feed, fresh first page (you joined a hub, say): keep what you've scrolled through.
    setPosts(p => [...initial, ...p.slice(initial.length).filter(o => !initial.some(n => n.id === o.id))]);
    // The query is rebuilt on each render, so it's compared by its text above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, next]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || offset == null) return;
    const io = new IntersectionObserver(async entries => {
      if (!entries[0].isIntersecting || loading) return;
      setLoading(true);
      try {
        const page = await fetchPosts(browserSupabase(), { ...query, offset }, signedIn);
        setPosts(p => [...p, ...page.posts.filter(n => !p.some(o => o.id === n.id))]);
        setOffset(page.next);
      } finally {
        setLoading(false);
      }
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [offset, loading, query, signedIn]);

  if (posts.length === 0) return <div className="empty">{empty}</div>;
  return (
    <div className="feed">
      {posts.map(p => <PostCard key={p.id} post={p} showHub={showHub} signedIn={signedIn} viewer={viewer} />)}
      {offset != null && <div ref={sentinel} className="more-row muted small">{loading ? "Loading..." : ""}</div>}
    </div>
  );
}
