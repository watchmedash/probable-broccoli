"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Icon, I } from "./Icon";
import { useToast } from "./Toast";

/** Join or leave a hub. Private hubs take a request instead. */
export function JoinButton({ hubId, joined, requested = false, isPrivate = false, signedIn, small = false }: {
  hubId: number; joined: boolean; requested?: boolean; isPrivate?: boolean; signedIn: boolean; small?: boolean;
}) {
  const [state, setState] = useState<"in" | "out" | "asked">(joined ? "in" : requested ? "asked" : "out");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
    if (busy) return;
    setBusy(true);
    const sb = browserSupabase();
    const { data: u } = await sb.auth.getUser();
    const uid = u.user?.id;
    const before = state;
    let res;
    if (state === "in") { setState("out"); res = await sb.from("hub_members").delete().eq("hub_id", hubId).eq("user_id", uid); }
    else if (state === "asked") { setState("out"); res = await sb.from("hub_join_requests").delete().eq("hub_id", hubId).eq("user_id", uid); }
    else if (isPrivate) { setState("asked"); res = await sb.from("hub_join_requests").insert({ hub_id: hubId }); }
    else { setState("in"); res = await sb.from("hub_members").insert({ hub_id: hubId }); }
    setBusy(false);
    if (res.error) { setState(before); toast(errorMessage(res.error)); }
    else router.refresh();
  }
  const label = state === "in" ? "Joined" : state === "asked" ? "Requested" : isPrivate ? "Ask to join" : "Join";
  return (
    <button className={`btn ${state === "out" ? "" : "quiet"}`} style={small ? { height: 32, padding: "0 14px" } : undefined} onClick={toggle} disabled={busy}>
      {label}
    </button>
  );
}

export function FollowButton({ userId, following, signedIn }: { userId: string; following: boolean; signedIn: boolean }) {
  const [on, setOn] = useState(following);
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      className="icon-btn"
      style={on ? undefined : { color: "var(--blue)" }}
      aria-label={on ? "Unfollow" : "Follow"}
      aria-pressed={on}
      onClick={async () => {
        if (!signedIn) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
        const sb = browserSupabase();
        const { data: u } = await sb.auth.getUser();
        setOn(!on);
        const res = on
          ? await sb.from("follows").delete().eq("follower_id", u.user?.id).eq("followee_id", userId)
          : await sb.from("follows").insert({ followee_id: userId });
        if (res.error) { setOn(on); toast(errorMessage(res.error)); }
      }}
    >
      <Icon icon={on ? I.following : I.follow} size={18} />
    </button>
  );
}
