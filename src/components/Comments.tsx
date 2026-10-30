"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { buildTree, type CommentNode, type CommentSort } from "@/lib/comments";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { insertComment } from "@/lib/queries";
import { myVote, type Comment } from "@/lib/types";
import { Avatar } from "./Avatars";
import { Icon, I } from "./Icon";
import { ReportDialog } from "./Report";
import { useToast } from "./Toast";
import { Votes } from "./VoteBar";

type Ctx = {
  signedIn: boolean;
  myId: string | null;
  closed: boolean;
  allowedDomains: string[];
  postId: number;
  add: (c: Comment) => void;
  replace: (c: Comment) => void;
};

export function Comments({ postId, initial, signedIn, myId, closed, allowedDomains }: {
  postId: number; initial: Comment[]; signedIn: boolean; myId: string | null; closed: boolean; allowedDomains: string[];
}) {
  const [rows, setRows] = useState(initial);
  const [sort, setSort] = useState<CommentSort>("top");
  const tree = useMemo(() => buildTree(rows, sort), [rows, sort]);
  const ctx: Ctx = {
    signedIn, myId, closed, allowedDomains, postId,
    add: c => setRows(r => [...r, c]),
    replace: c => setRows(r => r.map(x => (x.id === c.id ? c : x))),
  };
  return (
    <section className="comments" id="comments" aria-label="Comments">
      {closed ? (
        <p className="muted small" style={{ margin: "8px 0" }}><Icon icon={I.lock} size={12} /> Comments are closed.</p>
      ) : (
        <Composer ctx={ctx} parentId={null} placeholder="Add a comment" />
      )}
      <nav className="tabs" style={{ border: 0, padding: 0, margin: "0 -4px" }} aria-label="Sort comments">
        {(["top", "new", "old"] as CommentSort[]).map(s => (
          <button key={s} className={sort === s ? "on" : ""} onClick={() => setSort(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
        ))}
      </nav>
      {tree.length === 0 ? <p className="muted" style={{ padding: "16px 0" }}>No comments yet.</p> : (
        <div className="thread">{tree.map(n => <CommentItem key={n.comment.id} node={n} depth={0} ctx={ctx} />)}</div>
      )}
    </section>
  );
}

function Composer({ ctx, parentId, placeholder, initial = "", onDone, editId }: {
  ctx: Ctx; parentId: number | null; placeholder: string; initial?: string; onDone?: () => void; editId?: number;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(!!onDone);
  const router = useRouter();
  if (!ctx.signedIn) {
    return (
      <p className="muted small" style={{ margin: "8px 0" }}>
        <Link href={`/login?next=/p/${ctx.postId}`} className="linkish">Log in</Link> or <Link href="/signup" className="linkish">sign up</Link> to join the conversation.
      </p>
    );
  }
  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sb = browserSupabase();
      if (editId) {
        const { error } = await sb.from("comments").update({ body }).eq("id", editId);
        if (error) throw error;
        const { data } = await sb.from("comments").select("id,post_id,parent_id,body,score,depth,deleted,created_at,edited_at,author:profiles!author_id(id,username,avatar_url),my_vote:comment_votes(value)").eq("id", editId).single();
        ctx.replace(data as unknown as Comment);
      } else {
        ctx.add(await insertComment(sb, ctx.postId, parentId, body));
      }
      setText("");
      setFocused(false);
      onDone?.();
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="composer">
      <textarea
        value={text}
        placeholder={placeholder}
        rows={focused ? 4 : 1}
        maxLength={10000}
        onFocus={() => setFocused(true)}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
        aria-label={placeholder}
        autoFocus={!!onDone}
      />
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      {focused && (
        <div className="row">
          <button className="btn quiet" onClick={() => { setText(initial); setFocused(false); onDone?.(); }}>Cancel</button>
          <button className="btn" disabled={!text.trim() || busy} onClick={send}>{editId ? "Save" : parentId ? "Reply" : "Comment"}</button>
        </div>
      )}
    </div>
  );
}

function CommentItem({ node, depth, ctx }: { node: CommentNode; depth: number; ctx: Ctx }) {
  const c = node.comment;
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const toast = useToast();
  const mine = !!ctx.myId && c.author?.id === ctx.myId && !c.deleted;
  return (
    <div className="c">
      <div className="c-main">
        <div className="c-head">
          <button className="linkish" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Expand thread" : "Collapse thread"} style={{ color: "var(--muted)" }}>
            [{collapsed ? "+" : "-"}]
          </button>
          {c.deleted || !c.author ? <b>[deleted]</b> : (
            <Link href={`/u/${c.author.username}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Avatar user={c.author} size={20} />
              <b>u/{c.author.username}</b>
            </Link>
          )}
          <span>{timeAgo(c.created_at)}</span>
          {c.edited_at && !c.deleted && <span>edited</span>}
        </div>
        {!collapsed && (
          <>
            {editing ? (
              <Composer ctx={ctx} parentId={c.parent_id} placeholder="Edit your comment" initial={c.body} editId={c.id} onDone={() => setEditing(false)} />
            ) : c.deleted ? (
              <p className="c-body c-deleted">[deleted]</p>
            ) : (
              <div className="c-body"><div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body, { allowedDomains: ctx.allowedDomains }) }} /></div>
            )}
            {!c.deleted && !editing && (
              <div className="actions" style={{ margin: "0 -8px" }}>
                <Votes table="comment_votes" id={c.id} score={c.score} mine={myVote(c.my_vote)} signedIn={ctx.signedIn} />
                {!ctx.closed && <button className="act" onClick={() => setReplying(r => !r)} aria-label="Reply"><Icon icon={I.reply} size={13} /></button>}
                {mine ? (
                  <>
                    <button className="act" onClick={() => setEditing(true)} aria-label="Edit"><Icon icon={I.edit} size={12} /></button>
                    <button
                      className="act"
                      aria-label="Delete"
                      onClick={async () => {
                        if (!confirm("Delete this comment?")) return;
                        const { error } = await browserSupabase().from("comments").update({ deleted: true }).eq("id", c.id);
                        if (error) return toast(errorMessage(error));
                        ctx.replace({ ...c, deleted: true });
                      }}
                    >
                      <Icon icon={I.trash} size={12} />
                    </button>
                  </>
                ) : ctx.signedIn && (
                  <button className="act" onClick={() => setReporting(true)} aria-label="Report"><Icon icon={I.flag} size={12} /></button>
                )}
              </div>
            )}
            {replying && <Composer ctx={ctx} parentId={c.id} placeholder={`Reply to u/${c.author?.username ?? "deleted"}`} onDone={() => setReplying(false)} />}
            {node.children.length > 0 && (
              <div className="c-children">{node.children.map(k => <CommentItem key={k.comment.id} node={k} depth={depth + 1} ctx={ctx} />)}</div>
            )}
          </>
        )}
      </div>
      {reporting && <ReportDialog target={{ comment_id: c.id }} onClose={() => setReporting(false)} />}
    </div>
  );
}
