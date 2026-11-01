"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { AskDialog } from "./Dialogs";
import { Icon, I } from "./Icon";

/** A chat row's ⋮ menu: delete the chat on your side only. It sits inside the row's link, so clicks stop here. */
export function ChatRowMenu({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <span ref={box} style={{ position: "relative", flex: "none" }} onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
      <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Chat options" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon icon={I.more} size={14} /></button>
      {open && (
        <div className="menu" style={{ top: 34 }}>
          <button style={{ color: "var(--error)" }} onClick={() => { setOpen(false); setAsking(true); }}><Icon icon={I.trash} size={14} /> Delete chat</button>
        </div>
      )}
      {asking && (
        <AskDialog
          title="Delete this chat?"
          text="It's removed for you only. The other person keeps their copy, and it comes back if a new message arrives."
          action="Delete"
          danger
          onClose={() => setAsking(false)}
          onConfirm={async () => {
            const { error } = await browserSupabase().rpc("hide_conversation", { conversation: id });
            if (error) return errorMessage(error);
            router.refresh();
          }}
        />
      )}
    </span>
  );
}
