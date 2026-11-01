"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Icon, I } from "./Icon";
import { useToast } from "./Toast";

export type HubLevel = "all" | "popular" | "mute";
const OPTIONS: [HubLevel, string][] = [["all", "All posts"], ["popular", "Popular posts"], ["mute", "Mute"]];

/** How much of a hub reaches your home feed, member or not. No saved row means Popular. */
export function HubBell({ hubId, hubName, level: initial, uid }: { hubId: number; hubName: string; level: HubLevel; uid: string | null }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(initial);
  const box = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function pick(next: HubLevel) {
    setOpen(false);
    const before = level;
    setLevel(next);
    const sb = browserSupabase();
    const { error } = next === "popular"
      ? await sb.from("hub_prefs").delete().eq("hub_id", hubId).eq("user_id", uid)
      : await sb.from("hub_prefs").upsert({ user_id: uid, hub_id: hubId, level: next });
    if (error) { setLevel(before); toast(errorMessage(error)); return; }
    router.refresh();
  }

  return (
    <span ref={box} style={{ position: "relative" }}>
      <button
        className="icon-btn"
        aria-label={`Home feed: ${OPTIONS.find(o => o[0] === level)?.[1]}`}
        aria-expanded={open}
        onClick={() => (uid ? setOpen(o => !o) : router.push(`/login?next=/n/${hubName}`))}
      >
        <Icon icon={level === "mute" ? I.eyeOff : I.bell} size={18} />
      </button>
      {open && (
        <div className="menu">
          {OPTIONS.map(([value, label]) => (
            <button key={value} onClick={() => pick(value)} style={value === level ? { fontWeight: 700, color: "var(--blue)" } : undefined}>{label}</button>
          ))}
        </div>
      )}
    </span>
  );
}
