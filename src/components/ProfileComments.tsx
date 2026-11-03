"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PAGE_SIZE } from "@/lib/config";
import { timeAgo } from "@/lib/format";
import { guestOpens } from "@/lib/guestOpens";
import { renderPreview } from "@/lib/markdown";
import { PROFILE_COMMENT_COLUMNS } from "@/lib/queries";
import { browserSupabase } from "@/lib/supabase/client";
import { Icon, I } from "./Icon";

export type ProfileComment = {
  id: number;
  body: string;
  score: number;
  created_at: string;
  edited_at: string | null;
  post: { id: number; title: string; community: { name: string } | null } | null;
};

/** Someone's comments, newest first, each with the post it's on. More load as you scroll. */
export function ProfileComments({ authorId, initial, signedIn }: { authorId: string; initial: ProfileComment[]; signedIn: boolean }) {
  const [rows, setRows] = useState(initial);
  const [done, setDone] = useState(initial.length < PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver(async entries => {
      if (!entries[0].isIntersecting || loading) return;
      setLoading(true);
      const { data } = await browserSupabase().from("comments").select(PROFILE_COMMENT_COLUMNS)
        .eq("author_id", authorId).eq("deleted", false).order("created_at", { ascending: false }).range(rows.length, rows.length + PAGE_SIZE - 1);
      const more = (data ?? []) as unknown as ProfileComment[];
      setRows(r => [...r, ...more.filter(n => !r.some(o => o.id === n.id))]);
      if (more.length < PAGE_SIZE) setDone(true);
      setLoading(false);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [authorId, done, loading, rows.length]);

  // Comments on posts you can't see (a private hub, say) are left out.
  const shown = rows.filter(c => c.post);
  if (shown.length === 0) return <div className="empty">No comments yet.</div>;
  return (
    <div className="feed">
      {shown.map(c => {
        const href = `/p/${c.post!.id}#comments`;
        return (
          <article key={c.id} className="card">
            <div className="meta">
              {c.post!.community && <Link href={`/n/${c.post!.community.name}`} className="hub-name" style={{ fontSize: 13 }}>n/{c.post!.community.name}</Link>}
              <span>{timeAgo(c.created_at)}</span>
              {c.edited_at && <span>edited</span>}
            </div>
            <Link href={href} onClick={guestOpens(signedIn, router, `/p/${c.post!.id}`)} style={{ display: "block" }}>
              <span className="muted small" style={{ display: "block", margin: "4px 0" }}>{c.post!.title}</span>
              <div className="card-body md card-md" dangerouslySetInnerHTML={{ __html: renderPreview(c.body, 600) }} />
            </Link>
            <div className="actions">
              <span className="act" aria-label={`${c.score} points`}><Icon icon={I.up} size={14} /> {c.score}</span>
            </div>
          </article>
        );
      })}
      {!done && <div ref={sentinel} className="more-row muted small">{loading ? "Loading..." : ""}</div>}
    </div>
  );
}
