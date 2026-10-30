"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Icon, I } from "./Icon";
import { ReportDialog } from "./Report";
import { useToast } from "./Toast";

/** The post's ⋮ menu: delete your own post, or report someone else's. */
export function PostMenu({ postId, authorId, signedIn, myId }: { postId: number; authorId: string | null; signedIn: boolean; myId: string | null }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const mine = !!myId && myId === authorId;
  return (
    <span style={{ position: "relative" }}>
      <button className="icon-btn" aria-label="More" onClick={() => setOpen(o => !o)}><Icon icon={I.more} size={16} /></button>
      {open && (
        <div className="menu" onMouseLeave={() => setOpen(false)}>
          {mine ? (
            <button
              onClick={async () => {
                setOpen(false);
                if (!confirm("Delete this post? This can't be undone.")) return;
                const { error } = await browserSupabase().from("posts").delete().eq("id", postId);
                if (error) return toast(errorMessage(error));
                router.push("/");
                router.refresh();
              }}
            >
              <Icon icon={I.trash} size={14} /> Delete post
            </button>
          ) : (
            <button onClick={() => { setOpen(false); if (!signedIn) return router.push(`/login?next=/p/${postId}`); setReporting(true); }}>
              <Icon icon={I.flag} size={14} /> Report
            </button>
          )}
        </div>
      )}
      {reporting && <ReportDialog target={{ post_id: postId }} onClose={() => setReporting(false)} />}
    </span>
  );
}
