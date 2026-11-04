"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/errors";
import { browserSupabase } from "@/lib/supabase/client";
import { Avatar } from "./Avatars";
import { Icon, I } from "./Icon";
import { useToast } from "./Toast";

type Badge = { id: number; label: string; color: string };

/** You as people see you in this hub; the pen opens the hub's badges to pick from. */
export function BadgePicker({ hubId, me, current, badges }: {
  hubId: number; me: { id: string; username: string; avatar_url: string | null }; current: { text: string; color: string } | null; badges: Badge[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const picked = current ? badges.find(b => b.label === current.text && b.color === current.color)?.id ?? null : null;
  async function pick(badge: number | null) {
    setBusy(true);
    const { error } = await browserSupabase().rpc("pick_badge", { hub: hubId, badge });
    setBusy(false);
    if (error) return toast(errorMessage(error));
    setOpen(false);
    router.refresh();
  }
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar user={me} size={32} />
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
          <span>{me.username}</span>
          {current && <span className="tag" style={{ background: current.color, color: "#fff", alignSelf: "flex-start" }}>{current.text}</span>}
        </span>
        <button className="icon-btn" aria-label="Pick your badge" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <Icon icon={I.edit} size={14} />
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="muted small">Pick your badge for this hub</span>
          {badges.map(b => (
            <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="radio" name={`badge-${hubId}`} checked={picked === b.id} disabled={busy} onChange={() => pick(b.id)} />
              <span className="tag" style={{ background: b.color, color: "#fff" }}>{b.label}</span>
            </label>
          ))}
          {current && <button className="linkish small" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => pick(null)}>Remove my badge</button>}
        </div>
      )}
    </div>
  );
}
