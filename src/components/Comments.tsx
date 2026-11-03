"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAutoGrow } from "@/lib/autogrow";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { buildTree, type CommentNode, type CommentSort } from "@/lib/comments";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { insertComment } from "@/lib/queries";
import { uploadImage } from "@/lib/upload";
import { myVote, type Comment } from "@/lib/types";
import { Avatar } from "./Avatars";
import { Icon, I } from "./Icon";
import { ReportDialog } from "./Report";
import { AskDialog } from "./Dialogs";
import { Votes } from "./VoteBar";
import { Lightbox } from "./Lightbox";
import { useToast } from "./Toast";

/** Replies this deep link onward instead of squeezing further right. */
const MAX_DEPTH = 6;
const SEEN_KEY = "nakodu:seen";

/** When you last opened each post (kept in this browser), so new comments can stand out. */
function lastVisit(postId: number): number | null {
  try {
    const map = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, number>;
    const before = map[postId] ?? null;
    map[postId] = Date.now();
    // Only the 300 most recent posts are kept.
    const kept = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 300);
    localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(kept)));
    return before;
  } catch {
    return null;
  }
}

type Ctx = {
  signedIn: boolean;
  myId: string | null;
  /** Who wrote the post, for the OP tag. */
  opId: string | null;
  closed: boolean;
  allowedDomains: string[];
  hubs: string[];
  postId: number;
  canRemove: boolean;
  hubId: number | null;
  allowImages: boolean;
  /** Comments newer than your last visit. */
  fresh: Set<number>;
  userFlairs: Record<string, { text: string; color: string }>;
  add: (c: Comment) => void;
  replace: (c: Comment) => void;
};

export function Comments({ postId, initial, signedIn, myId, opId = null, closed, allowedDomains, hubs = [], canRemove = false, blocked = [], userFlairs = {}, hubId = null, allowImages = true, focus = null }: {
  postId: number; initial: Comment[]; signedIn: boolean; myId: string | null; opId?: string | null; closed: boolean; allowedDomains: string[];
  hubs?: string[]; canRemove?: boolean; blocked?: string[]; userFlairs?: Record<string, { text: string; color: string }>;
  hubId?: number | null; allowImages?: boolean;
  /** A shared comment link: just that comment and its replies. */
  focus?: number | null;
}) {
  // Comments from people you blocked are left out, like in the app.
  const [rows, setRows] = useState(() => initial.filter(c => !c.author || !blocked.includes(c.author.id)));
  const [sort, setSort] = useState<CommentSort>("top");
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  // Read once when the page opens: what came in since you were last here (not your own).
  useEffect(() => {
    const before = lastVisit(postId);
    if (before) setFresh(new Set(initial.filter(c => Date.parse(c.created_at) > before && c.author?.id !== myId).map(c => c.id)));
  }, [postId, initial, myId]);
  const whole = useMemo(() => buildTree(rows, sort), [rows, sort]);
  const tree = useMemo(() => {
    if (focus == null) return whole;
    const find = (list: CommentNode[]): CommentNode | null => {
      for (const n of list) { if (n.comment.id === focus) return n; const f = find(n.children); if (f) return f; }
      return null;
    };
    const hit = find(whole);
    return hit ? [hit] : whole;
  }, [whole, focus]);
  const ctx: Ctx = {
    signedIn, myId, opId, closed, allowedDomains, hubs, postId, canRemove, userFlairs, hubId, allowImages, fresh,
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
      {focus != null && tree !== whole && (
        <p className="small" style={{ margin: "8px 0" }}>
          <span className="muted">One comment thread. </span>
          <Link href={`/p/${postId}#comments`} className="linkish">See all comments</Link>
        </p>
      )}
      {tree.length === 0 ? <p className="muted" style={{ padding: "16px 0" }}>No comments yet.</p> : (
        <Lightbox>
          <div className="thread">{tree.map(n => <CommentItem key={n.comment.id} node={n} top depth={0} ctx={ctx} />)}</div>
        </Lightbox>
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
  const [uploading, setUploading] = useState(false);
  // A picture or GIF goes in on its own line, where it shows in the comment.
  async function addPicture(file: File | undefined | null) {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file, "post-images");
      setText(t => `${t.trimEnd()}${t.trim() ? "\n\n" : ""}![](${url})\n`);
      setFocused(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  const box = useAutoGrow(text, 420);
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
      {/* One line until you write more; it grows with the text. */}
      <textarea
        ref={box}
        value={text}
        placeholder={placeholder}
        rows={1}
        maxLength={10000}
        onFocus={() => setFocused(true)}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
        onPaste={e => { const f = ctx.allowImages ? [...e.clipboardData.files].find(x => x.type.startsWith("image/")) : null; if (f) { e.preventDefault(); addPicture(f); } }}
        aria-label={placeholder}
        autoFocus={!!onDone}
      />
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      {focused && (
        <div className="row">
          {ctx.allowImages && (
            <label className="icon-btn" aria-label="Add a picture or GIF" title="Add a picture or GIF" style={{ marginRight: "auto", cursor: "pointer" }}>
              <Icon icon={I.imageOutline} size={16} />
              <input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={e => { addPicture(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          )}
          {uploading && <span className="muted small" style={{ alignSelf: "center" }}>Uploading...</span>}
          <button className="icon-btn" aria-label="Cancel" onClick={() => { setText(initial); setFocused(false); onDone?.(); }}><Icon icon={I.close} size={15} /></button>
          <button className="btn" aria-label={editId ? "Save" : parentId ? "Reply" : "Comment"} style={{ width: 46, padding: 0 }} disabled={!text.trim() || busy || uploading} onClick={send}><Icon icon={editId ? I.check : I.send} size={15} /></button>
        </div>
      )}
    </div>
  );
}

/** A comment's ⋮ menu: edit and delete your own, report other people's, and remove for mods. */
function CommentMenu({ mine, signedIn, canRemove, onEdit, onDelete, onReport, onRemove, onShare }: {
  mine: boolean; signedIn: boolean; canRemove: boolean; onEdit: () => void; onDelete: () => void; onReport: () => void; onRemove: () => void; onShare: () => void;
}) {
  const [open, setOpen] = useState<"down" | "up" | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const run = (fn: () => void) => () => { setOpen(null); fn(); };
  return (
    <span ref={box} style={{ position: "relative" }}>
      <button className="act" aria-label="Comment options" aria-expanded={!!open} onClick={e => setOpen(o => (o ? null : e.clientY > window.innerHeight - 220 ? "up" : "down"))}>
        <Icon icon={I.more} size={13} />
      </button>
      {open && (
        <div className="menu" style={{ left: 0, right: "auto", top: open === "down" ? 36 : "auto", bottom: open === "up" ? 36 : "auto" }}>
          <button onClick={run(onShare)}><Icon icon={I.share} size={14} /> Share</button>
          {!signedIn ? null : mine ? (
            <>
              <button onClick={run(onEdit)}><Icon icon={I.edit} size={14} /> Edit</button>
              <button onClick={run(onDelete)} style={{ color: "var(--error)" }}><Icon icon={I.trash} size={14} /> Delete</button>
            </>
          ) : (
            <button onClick={run(onReport)}><Icon icon={I.flag} size={14} /> Report</button>
          )}
          {canRemove && !mine && <button onClick={run(onRemove)} style={{ color: "var(--error)" }}><Icon icon={I.trash} size={14} /> Remove</button>}
        </div>
      )}
    </span>
  );
}

/**
 * One comment. A line runs from its avatar down to its replies, with a circled minus on the line.
 * The minus, or tapping the name row, folds the comment and its replies down to a plus, the name and
 * the time. A comment without replies doesn't fold.
 */
function CommentItem({ node, top = false, depth, ctx }: { node: CommentNode; top?: boolean; depth: number; ctx: Ctx }) {
  const c = node.comment;
  const toast = useToast();
  async function share() {
    const url = `${location.origin}/p/${ctx.postId}?c=${c.id}`;
    try {
      if (navigator.share) await navigator.share({ url });
      else { await navigator.clipboard.writeText(url); toast("Link copied"); }
    } catch {}
  }
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<"report" | "remove" | "delete" | null>(null);
  const flair = c.author ? ctx.userFlairs[c.author.id] : undefined;
  const mine = !!ctx.myId && c.author?.id === ctx.myId && !c.deleted;
  const kids = node.children.length;
  const isOp = !c.deleted && !!c.author && c.author.id === ctx.opId;
  // Only a comment with replies folds.
  const fold = () => { if (kids > 0) setCollapsed(v => !v); };
  return (
    <div className={`c ${top ? "c-top" : ""}`}>
      <div className={`c-head ${kids > 0 ? "folds" : ""}`} onClick={fold}>
        {collapsed ? (
          <span className="c-avatar c-plus"><span className="c-toggle" aria-label={`Show ${kids} ${kids === 1 ? "reply" : "replies"}`}>+</span></span>
        ) : c.deleted || !c.author ? <span className="c-avatar c-avatar-gone" /> : (
          <Link href={`/u/${c.author.username}`} onClick={e => e.stopPropagation()} aria-label={`u/${c.author.username}`}>
            <Avatar user={c.author} size={top ? 28 : 24} />
          </Link>
        )}
        <b>{c.deleted || !c.author ? "[deleted]" : c.author.username}</b>
        {isOp && !collapsed && <span className="op">OP</span>}
        {flair && !c.deleted && !collapsed && <span className="tag" style={{ background: flair.color, color: "#fff" }}>{flair.text}</span>}
        <span>{timeAgo(c.created_at)}</span>
        {!collapsed && c.edited_at && !c.deleted && <span>edited</span>}
      </div>
      {!collapsed && (
        <div className={`c-content ${kids > 0 ? "has-kids" : ""}`}>
          <div className="c-own">
            {editing ? (
              <Composer ctx={ctx} parentId={c.parent_id} placeholder="Edit your comment" initial={c.body} editId={c.id} onDone={() => setEditing(false)} />
            ) : c.deleted ? (
              <p className="c-body c-deleted">[deleted]</p>
            ) : (
              <div className={`c-body ${ctx.fresh.has(c.id) ? "c-new-body" : ""}`}><div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body, { allowedDomains: ctx.allowedDomains, hubs: ctx.hubs }) }} /></div>
            )}
            <div className="actions c-actions">
              {kids > 0 && <button className="c-toggle" onClick={() => setCollapsed(true)} aria-label="Fold this thread">-</button>}
              {!c.deleted && !editing && (
                <>
                  <Votes table="comment_votes" id={c.id} score={c.score} mine={myVote(c.my_vote)} signedIn={ctx.signedIn} />
                  {!ctx.closed && <button className="act" onClick={() => setReplying(r => !r)} aria-label="Reply"><Icon icon={I.reply} size={13} /></button>}
                  <CommentMenu
                    mine={mine}
                    signedIn={ctx.signedIn}
                    canRemove={ctx.canRemove}
                    onEdit={() => setEditing(true)}
                    onDelete={() => setDialog("delete")}
                    onReport={() => setDialog("report")}
                    onRemove={() => setDialog("remove")}
                    onShare={share}
                  />
                </>
              )}
            </div>
            {replying && <Composer ctx={ctx} parentId={c.id} placeholder={`Reply to u/${c.author?.username ?? "deleted"}`} onDone={() => setReplying(false)} />}
          </div>
          {kids > 0 && depth + 1 >= MAX_DEPTH ? (
            <div className="c-children">
              <Link href={`/p/${ctx.postId}?c=${c.id}#comments`} className="linkish small" style={{ display: "inline-block", padding: "10px 0" }}>Continue this thread</Link>
            </div>
          ) : kids > 0 && (
            <div className="c-children">{node.children.map(k => <CommentItem key={k.comment.id} node={k} depth={depth + 1} ctx={ctx} />)}</div>
          )}
        </div>
      )}
      {dialog === "report" && <ReportDialog target={{ comment_id: c.id }} onClose={() => setDialog(null)} />}
      {dialog === "delete" && <DeleteDialog c={c} ctx={ctx} onClose={() => setDialog(null)} />}
      {dialog === "remove" && (
        <AskDialog
          title="Remove this comment?"
          text="The author is told, with your reason if you give one. It goes in the mod log."
          field
          placeholder="Reason (optional)"
          action="Remove"
          danger
          reasonsFor={ctx.hubId}
          onClose={() => setDialog(null)}
          onConfirm={async reason => {
            const { error } = await browserSupabase().rpc("remove_comment", { comment: c.id, reason: reason || null });
            if (error) return errorMessage(error);
            ctx.replace({ ...c, deleted: true });
          }}
        />
      )}
    </div>
  );
}

function DeleteDialog({ c, ctx, onClose }: { c: Comment; ctx: Ctx; onClose: () => void }) {
  return (
    <AskDialog
      title="Delete this comment?"
      text="Replies stay, under [deleted]."
      action="Delete"
      danger
      onClose={onClose}
      onConfirm={async () => {
        const { error } = await browserSupabase().from("comments").update({ deleted: true }).eq("id", c.id);
        if (error) return errorMessage(error);
        ctx.replace({ ...c, deleted: true });
      }}
    />
  );
}
