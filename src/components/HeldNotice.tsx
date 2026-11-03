"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/errors";
import { browserSupabase } from "@/lib/supabase/client";

/** On a post waiting for approval: who can see it, and for mods, Approve. */
export function HeldNotice({ postId, canApprove }: { postId: number; canApprove: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="note" style={{ margin: "8px 0", alignItems: "center" }}>
      <span style={{ flex: 1 }}>Waiting for a mod to approve this. Until then only you and the mods can see it.{error && <span className="error" style={{ display: "block" }}>{error}</span>}</span>
      {canApprove && (
        <button className="btn" onClick={async () => {
          const { error } = await browserSupabase().rpc("approve_post", { post: postId });
          if (error) return setError(errorMessage(error));
          router.refresh();
        }}>Approve</button>
      )}
    </div>
  );
}
