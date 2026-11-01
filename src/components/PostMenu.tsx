"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { Flair } from "@/lib/types";
import { AskDialog, PickDialog } from "./Dialogs";
import { Icon, I } from "./Icon";
import { ReportDialog } from "./Report";
import { useToast } from "./Toast";
import { forgetRecent } from "./RecentPosts";

export type PostMenuProps = {
  postId: number;
  hubId: number | null;
  authorId: string | null;
  myId: string | null;
  saved: boolean;
  followed: boolean;
  pinned: boolean;
  locked: boolean;
  spoiler: boolean;
  mature: boolean;
  flairId: number | null;
  /** Hub staff who may pin, lock and change tags. */
  isStaff: boolean;
  /** Hub staff who may take other people's posts down. */
  canRemove: boolean;
  canCrosspost: boolean;
  /** In a feed: the card disappears instead of the page moving away. */
  onGone?: () => void;
};

/** The post's ⋮ menu, with what the app offers: your own post, saving and hiding, and mod tools. */
export function PostMenu(p: PostMenuProps) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"report" | "remove" | "delete" | "prefix" | "block" | null>(null);
  const [flairs, setFlairs] = useState<Flair[]>([]);
  const [saved, setSaved] = useState(p.saved);
  const [followed, setFollowed] = useState(p.followed);
  const router = useRouter();
  const toast = useToast();
  const mine = !!p.myId && p.myId === p.authorId;
  const sb = () => browserSupabase();
  const login = () => router.push(`/login?next=/p/${p.postId}`);
  const leave = () => { if (p.onGone) p.onGone(); else router.push("/"); };

  async function run(fn: () => PromiseLike<{ error: unknown }>, done?: () => void) {
    setOpen(false);
    const { error } = await fn();
    if (error) return toast(errorMessage(error));
    done?.();
    router.refresh();
  }

  const item = (icon: keyof typeof I, label: string, onClick: () => void, danger = false) => (
    <button onClick={onClick} style={danger ? { color: "var(--error)" } : undefined}><Icon icon={I[icon]} size={14} /> {label}</button>
  );

  return (
    <span style={{ position: "relative" }}>
      <button className="icon-btn" aria-label="More" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon icon={I.more} size={16} /></button>
      {open && (
        <div className="menu" onMouseLeave={() => setOpen(false)}>
          {mine && item("edit", "Edit post", () => router.push(`/p/${p.postId}/edit`))}
          {p.myId
            ? item("save", saved ? "Unsave" : "Save", () => run(() => saved ? sb().from("saved_posts").delete().eq("post_id", p.postId) : sb().from("saved_posts").insert({ post_id: p.postId }), () => setSaved(!saved)))
            : item("save", "Save", login)}
          {p.myId && !mine && item("eyeOff", "Hide", () => run(() => sb().from("hidden_posts").insert({ post_id: p.postId }), leave))}
          {p.myId
            ? item("bell", followed ? "Unfollow post" : "Follow post", () => run(() => followed ? sb().from("post_follows").delete().eq("post_id", p.postId).eq("user_id", p.myId) : sb().from("post_follows").insert({ post_id: p.postId }), () => setFollowed(!followed)))
            : item("bell", "Follow post", login)}
          {p.canCrosspost && item("share", "Crosspost", () => (p.myId ? router.push(`/submit?share=${p.postId}`) : login()))}
          {p.isStaff && item("pin", p.pinned ? "Unpin" : "Pin to the hub", () => run(() => sb().from("posts").update({ pinned_at: p.pinned ? null : new Date().toISOString() }).eq("id", p.postId)))}
          {p.isStaff && item("lock", p.locked ? "Unlock comments" : "Lock comments", () => run(() => sb().from("posts").update({ locked: !p.locked }).eq("id", p.postId)))}
          {(mine || p.isStaff) && item("flag", p.spoiler ? "Remove spoiler tag" : "Mark as spoiler", () => run(() => sb().from("posts").update({ spoiler: !p.spoiler, mature: p.mature }).eq("id", p.postId)))}
          {(mine || p.isStaff) && item("flag", p.mature ? "Remove 18+ tag" : "Mark as 18+", () => run(() => sb().from("posts").update({ spoiler: p.spoiler, mature: !p.mature }).eq("id", p.postId)))}
          {(mine || p.isStaff) && p.hubId != null && item("edit", "Change prefix", async () => {
            setOpen(false);
            const { data } = await sb().from("hub_flairs").select("id,label,color").eq("hub_id", p.hubId).order("position").order("id");
            setFlairs((data ?? []) as Flair[]);
            setDialog("prefix");
          })}
          {p.canRemove && !mine && item("trash", "Remove post", () => { setOpen(false); setDialog("remove"); }, true)}
          {mine && item("trash", "Delete post", () => { setOpen(false); setDialog("delete"); }, true)}
          {!mine && item("flag", "Report", () => { setOpen(false); if (!p.myId) return login(); setDialog("report"); })}
          {!mine && p.myId && p.authorId && item("close", "Block this person", () => { setOpen(false); setDialog("block"); })}
        </div>
      )}
      {dialog === "report" && <ReportDialog target={{ post_id: p.postId }} onClose={() => setDialog(null)} />}
      {dialog === "remove" && (
        <AskDialog
          title="Remove this post?"
          text="The author is told, with your reason if you give one. It goes in the mod log."
          field
          placeholder="Reason (optional)"
          action="Remove"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async reason => {
            const { error } = await sb().rpc("remove_post", { post: p.postId, reason: reason || null });
            if (!error) forgetRecent(p.postId);
            if (error) return errorMessage(error);
            p.onGone?.();
            router.refresh();
          }}
        />
      )}
      {dialog === "delete" && (
        <AskDialog
          title="Delete this post?"
          text="This can't be undone."
          action="Delete"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const { error } = await sb().from("posts").delete().eq("id", p.postId);
            if (!error) forgetRecent(p.postId);
            if (error) return errorMessage(error);
            leave();
            router.refresh();
          }}
        />
      )}
      {dialog === "block" && (
        <AskDialog
          title="Block this person?"
          text="Their posts and comments are hidden for you, and neither of you can message the other. You can unblock them in Settings."
          action="Block"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const { error } = await sb().from("blocks").insert({ blocked_id: p.authorId });
            if (error) return errorMessage(error);
            leave();
            router.refresh();
          }}
        />
      )}
      {dialog === "prefix" && (
        <PickDialog<number>
          title="Prefix"
          current={p.flairId}
          options={[{ value: null, label: "None" }, ...flairs.map(f => ({ value: f.id, label: f.label, color: f.color }))]}
          onClose={() => setDialog(null)}
          onPick={async v => {
            const { error } = await sb().from("posts").update({ flair_id: v }).eq("id", p.postId);
            if (error) return errorMessage(error);
            router.refresh();
          }}
        />
      )}
    </span>
  );
}
