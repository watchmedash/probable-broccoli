"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import type { PollOption } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { countLabel } from "@/lib/format";
import { useToast } from "./Toast";

/** Pick an option; picking another one moves your vote. Results show once you've voted. */
export function Poll({ postId, options, mine, signedIn }: { postId: number; options: PollOption[]; mine: number | null; signedIn: boolean }) {
  const [opts, setOpts] = useState([...options].sort((a, b) => a.position - b.position));
  const [choice, setChoice] = useState(mine);
  const router = useRouter();
  const toast = useToast();
  const total = opts.reduce((n, o) => n + o.votes, 0);

  async function pick(id: number) {
    if (!signedIn) return router.push(`/login?next=/p/${postId}`);
    if (id === choice) return;
    const before = { opts, choice };
    setOpts(o => o.map(x => ({ ...x, votes: x.votes + (x.id === id ? 1 : x.id === choice ? -1 : 0) })));
    setChoice(id);
    const sb = browserSupabase();
    const { data: u } = await sb.auth.getUser();
    const res = choice == null
      ? await sb.from("poll_votes").insert({ post_id: postId, option_id: id })
      : await sb.from("poll_votes").update({ option_id: id }).eq("post_id", postId).eq("user_id", u.user?.id);
    if (res.error) {
      setOpts(before.opts);
      setChoice(before.choice);
      toast(errorMessage(res.error));
    }
  }

  return (
    <div className="poll">
      {opts.map(o => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        return (
          <button key={o.id} className={o.id === choice ? "mine" : ""} onClick={() => pick(o.id)} aria-pressed={o.id === choice}>
            {choice != null && <span className="bar" style={{ width: `${pct}%` }} />}
            <span>{o.label}</span>
            {choice != null && <span>{pct}%</span>}
          </button>
        );
      })}
      <span className="muted small" style={{ padding: "2px 4px" }}>{countLabel(total, "vote")}</span>
    </div>
  );
}
