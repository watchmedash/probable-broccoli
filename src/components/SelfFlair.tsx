"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlairDialog } from "./HubSettings";

/** Members of hubs with user flair can set their own. */
export function SelfFlair({ hubId, me, current }: { hubId: number; me: { id: string; username: string }; current?: { text: string; color: string } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button className="btn quiet block" onClick={() => setOpen(true)}>{current ? "Change your flair" : "Set your flair"}</button>
      {open && <FlairDialog hubId={hubId} user={{ id: me.id, username: me.username, avatar_url: null }} current={current} onClose={() => { setOpen(false); router.refresh(); }} />}
    </>
  );
}
