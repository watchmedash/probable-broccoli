"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { browserSupabase } from "@/lib/supabase/client";
import { Icon, I } from "./Icon";
import { useToast } from "./Toast";

/** Stars a hub, so it sits at the top of your hubs. Tap again to unstar. */
export function FavoriteStar({ hubId, hubName, on: initial, className = "fav-star" }: { hubId: number; hubName: string; on: boolean; className?: string }) {
  const [on, setOn] = useState(initial);
  // The list reorders after a change, so a star can end up on another row: it always follows the server.
  useEffect(() => { setOn(initial); }, [initial, hubId]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !on;
    setOn(next);
    const sb = browserSupabase();
    const { error } = next
      ? await sb.from("hub_favorites").insert({ hub_id: hubId })
      : await sb.from("hub_favorites").delete().eq("hub_id", hubId);
    setBusy(false);
    if (error) {
      setOn(!next);
      return toast(errorMessage(error));
    }
    router.refresh();
  }
  return (
    <button className={`${className} ${on ? "on" : ""}`} onClick={toggle} aria-pressed={on} aria-label={on ? `Unfavourite n/${hubName}` : `Favourite n/${hubName}`} title={on ? "Unfavourite" : "Favourite"}>
      <Icon icon={on ? I.star : I.starOutline} size={15} />
    </button>
  );
}
