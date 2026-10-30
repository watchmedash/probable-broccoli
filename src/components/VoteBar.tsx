"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { applyVote, type VoteDir } from "@/lib/votes";
import { errorMessage } from "@/lib/errors";
import { Icon, I } from "./Icon";
import { useToast } from "./Toast";

/**
 * Up, score, down. Shows the change at once and confirms it with the server; puts it back if refused.
 * table: "post_votes" or "comment_votes".
 */
export function Votes({ table, id, score, mine, signedIn }: { table: "post_votes" | "comment_votes"; id: number; score: number; mine: number; signedIn: boolean }) {
  const [state, setState] = useState({ score, mine });
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const idCol = table === "post_votes" ? "post_id" : "comment_id";

  async function vote(dir: VoteDir, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
    if (busy) return;
    const before = state;
    const after = applyVote(state, dir);
    setState(after);
    setBusy(true);
    const sb = browserSupabase();
    const { data: u } = await sb.auth.getUser();
    const uid = u.user?.id;
    let res;
    if (after.mine === 0) res = await sb.from(table).delete().eq(idCol, id).eq("user_id", uid);
    else if (before.mine === 0) res = await sb.from(table).insert({ [idCol]: id, value: after.mine });
    else res = await sb.from(table).update({ value: after.mine }).eq(idCol, id).eq("user_id", uid);
    setBusy(false);
    if (res.error) {
      setState(before);
      toast(errorMessage(res.error));
    }
  }

  const cls = state.mine > 0 ? "votes up" : state.mine < 0 ? "votes down" : "votes";
  return (
    <span className={cls}>
      <button className={`act ${state.mine > 0 ? "up-on" : ""}`} onClick={e => vote("up", e)} aria-label="Upvote" aria-pressed={state.mine > 0}>
        <Icon icon={I.up} size={16} />
      </button>
      <span className="score">{state.score}</span>
      <button className={`act ${state.mine < 0 ? "down-on" : ""}`} onClick={e => vote("down", e)} aria-label="Downvote" aria-pressed={state.mine < 0}>
        <Icon icon={I.down} size={16} />
      </button>
    </span>
  );
}

/** Copies the post's share link (nakodu.top/p/ID opens the app on phones that have it). */
export function ShareButton({ id }: { id: number }) {
  const toast = useToast();
  return (
    <button
      className="act"
      onClick={async e => {
        e.preventDefault();
        e.stopPropagation();
        const url = `${location.origin}/p/${id}`;
        if (navigator.share) {
          try { await navigator.share({ url }); } catch {}
        } else {
          await navigator.clipboard.writeText(url);
          toast("Link copied");
        }
      }}
    >
      <Icon icon={I.share} size={14} /> <span className="hide-sm">Share</span>
    </button>
  );
}
