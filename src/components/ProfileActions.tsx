"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { uploadImage } from "@/lib/upload";
import { AskDialog } from "./Dialogs";
import { Icon, I } from "./Icon";
import { FollowButton } from "./JoinButton";
import { ReportDialog } from "./Report";
import { useToast } from "./Toast";

/** On someone else's profile: follow, message, and the ⋮ menu (block, report, and site bans for admins). */
export function ProfileActions({ userId, username, following, blocked, banned, signedIn, admin }: {
  userId: string; username: string; following: boolean; blocked: boolean; banned: boolean; signedIn: boolean; admin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"report" | "block" | "ban" | null>(null);
  const router = useRouter();
  const toast = useToast();
  const sb = browserSupabase();
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
      <FollowButton userId={userId} following={following} signedIn={signedIn} />
      <Link href={signedIn ? `/messages/new?to=${username}` : `/login?next=/u/${username}`} className="icon-btn" aria-label="Message"><Icon icon={I.mail} size={18} /></Link>
      {signedIn && <button className="icon-btn" aria-label="More" onClick={() => setOpen(o => !o)}><Icon icon={I.more} size={16} /></button>}
      {open && (
        <div className="menu" onMouseLeave={() => setOpen(false)}>
          {blocked ? (
            <button onClick={async () => { setOpen(false); const { data } = await sb.auth.getUser(); await sb.from("blocks").delete().eq("blocker_id", data.user?.id).eq("blocked_id", userId); router.refresh(); }}>
              <Icon icon={I.close} size={14} /> Unblock
            </button>
          ) : (
            <button onClick={() => { setOpen(false); setDialog("block"); }}><Icon icon={I.close} size={14} /> Block</button>
          )}
          <button onClick={() => { setOpen(false); setDialog("report"); }}><Icon icon={I.flag} size={14} /> Report</button>
          {admin && (
            banned ? (
              <button onClick={async () => { setOpen(false); const { error } = await sb.rpc("set_site_ban", { target_username: username, ban: false, reason: null }); if (error) toast(errorMessage(error)); router.refresh(); }}>
                <Icon icon={I.check} size={14} /> Lift site ban
              </button>
            ) : (
              <button style={{ color: "var(--error)" }} onClick={() => { setOpen(false); setDialog("ban"); }}><Icon icon={I.lock} size={14} /> Ban from Nakodu</button>
            )
          )}
        </div>
      )}
      {dialog === "report" && <ReportDialog target={{ user_id: userId }} onClose={() => setDialog(null)} />}
      {dialog === "block" && (
        <AskDialog title={`Block u/${username}?`} text="Their posts and comments are hidden for you, and neither of you can message the other." action="Block" danger onClose={() => setDialog(null)}
          onConfirm={async () => { const { error } = await sb.from("blocks").insert({ blocked_id: userId }); if (error) return errorMessage(error); router.refresh(); }} />
      )}
      {dialog === "ban" && (
        <AskDialog title={`Ban u/${username} from Nakodu?`} text="They can still log in and read, but can't post, comment, vote or message anywhere." field placeholder="Reason (optional)" action="Ban" danger onClose={() => setDialog(null)}
          onConfirm={async reason => { const { error } = await sb.rpc("set_site_ban", { target_username: username, ban: true, reason: reason || null }); if (error) return errorMessage(error); router.refresh(); }} />
      )}
    </div>
  );
}

/** On your own profile: change your picture or cover (photos go in your folder of the avatars bucket). */
export function SelfActions({ hasCover }: { hasCover: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function change(file: File | undefined, column: "avatar_url" | "cover_url") {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file, "avatars");
      const sb = browserSupabase();
      const { data } = await sb.auth.getUser();
      const { error } = await sb.from("profiles").update({ [column]: url }).eq("id", data.user?.id);
      if (error) throw error;
      router.refresh();
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <label className="icon-btn" aria-label="Change picture" title="Change picture" aria-disabled={busy}><Icon icon={I.edit} size={16} /><input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { change(e.target.files?.[0], "avatar_url"); e.target.value = ""; }} /></label>
      <label className="icon-btn" aria-label={hasCover ? "Change cover" : "Add a cover"} title={hasCover ? "Change cover" : "Add a cover"} aria-disabled={busy}><Icon icon={I.image} size={16} /><input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { change(e.target.files?.[0], "cover_url"); e.target.value = ""; }} /></label>
    </div>
  );
}
