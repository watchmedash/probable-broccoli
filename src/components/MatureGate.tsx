"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";

/** An 18+ hub found in search while "Show 18+ hubs" is off: its posts show once you turn it on. */
export function MatureGate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <span>This hub is 18+. Turn on 18+ hubs to see its posts.</span>
      <button className="btn" disabled={busy} onClick={async () => {
        setBusy(true);
        const sb = browserSupabase();
        const { data: u } = await sb.auth.getUser();
        const { error } = await sb.from("user_settings").upsert({ user_id: u.user?.id, show_mature: true }, { onConflict: "user_id" });
        setBusy(false);
        if (error) { setError(error.message); return; }
        router.refresh();
      }}>Turn on 18+ hubs</button>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
