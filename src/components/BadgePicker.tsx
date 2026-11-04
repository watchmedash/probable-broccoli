"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { browserSupabase } from "@/lib/supabase/client";
import { Avatar } from "./Avatars";
import { Icon, I } from "./Icon";
import { useToast } from "./Toast";

type Badge = { id: number; label: string; color: string };

/** You as people see you in this hub, with the pen to pick one of the hub's badges. */
export function BadgePicker({ hubId, me, current, badges }: {
  hubId: number; me: { id: string; username: string; avatar_url: string | null }; current: { text: string; color: string } | null; badges: Badge[];
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  async function pick(badge: number | null) {
    setOpen(false);
    const { error } = await browserSupabase().rpc("pick_badge", { hub: hubId, badge });
    if (error) return toast(errorMessage(error));
    router.refresh();
  }
  return (
    <div ref={box} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
      <Avatar user={me} size={32} />
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <b>u/{me.username}</b>
        {current ? <span className="tag" style={{ background: current.color, color: "#fff", alignSelf: "flex-start" }}>{current.text}</span> : <span className="muted small">No badge</span>}
      </span>
      <button className="icon-btn" aria-label="Pick your badge" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon icon={I.edit} size={14} /></button>
      {open && (
        <div className="menu" style={{ top: 44, right: 0 }}>
          {badges.map(b => (
            <button key={b.id} onClick={() => pick(b.id)}>
              <span className="tag" style={{ background: b.color, color: "#fff" }}>{b.label}</span>
            </button>
          ))}
          <button onClick={() => pick(null)} className="muted">No badge</button>
        </div>
      )}
    </div>
  );
}
