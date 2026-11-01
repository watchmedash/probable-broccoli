import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { Unhide } from "@/components/Unhide";
import { fetchViewer, POST_SELECT } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";
import type { Post } from "@/lib/types";

export const metadata: Metadata = { title: "Saved and hidden", robots: { index: false } };

/** Your saved posts (newest save first), or the ones you hid so you can bring them back. */
export default async function SavedPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await currentUser();
  if (!me) redirect("/login?next=/saved");
  const hidden = (await searchParams).tab === "hidden";
  const sb = await serverSupabase();
  const table = hidden ? "hidden_posts" : "saved_posts";
  const at = hidden ? "hidden_at" : "saved_at";
  const { data } = await sb.from(table).select(`${at},post:posts(${POST_SELECT})`).order(at, { ascending: false }).limit(100);
  const posts = ((data ?? []) as unknown as { post: Post | null }[]).map(r => r.post).filter((p): p is Post => !!p);
  const viewer = await fetchViewer(sb, me.id);
  return (
    <main className="page single">
      <div>
        <nav className="tabs big">
          <Link href="/saved" className={hidden ? "" : "on"}>Saved</Link>
          <Link href="/saved?tab=hidden" className={hidden ? "on" : ""}>Hidden</Link>
        </nav>
        {posts.length === 0 ? (
          <div className="empty">{hidden ? "Posts you hide show up here, so you can bring them back." : "Posts you save show up here."}</div>
        ) : (
          <div className="feed">
            {posts.map(p => (
              <div key={p.id}>
                <PostCard post={p} showHub signedIn viewer={viewer} />
                {hidden && <UnhideRow id={p.id} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function UnhideRow({ id }: { id: number }) {
  return <div style={{ padding: "0 16px 8px", background: "var(--surface)" }}><Unhide id={id} /></div>;
}
