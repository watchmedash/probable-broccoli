import type { Metadata } from "next";
import Link from "next/link";
import { HubIcon } from "@/components/Avatars";
import { JoinButton } from "@/components/JoinButton";
import { fetchHubs, myHubIds } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hubs", description: "Every hub on Nakodu.", alternates: { canonical: "/hubs" } };

/** Every hub: icon, name and Join, like the app's hub list. */
export default async function HubsPage() {
  const me = await currentUser();
  const sb = await serverSupabase();
  const [hubs, mine] = await Promise.all([fetchHubs(sb), me ? myHubIds(sb, me.id) : Promise.resolve([] as number[])]);
  const yours = hubs.filter(h => mine.includes(h.id));
  const others = hubs.filter(h => !mine.includes(h.id));
  const list = (items: typeof hubs) => items.map(h => (
    <Link key={h.id} href={`/n/${h.name}`} className="hub-row">
      <HubIcon hub={h} size={44} />
      <span className="name">n/{h.name}</span>
      <JoinButton hubId={h.id} joined={mine.includes(h.id)} isPrivate={h.privacy === "private"} signedIn={!!me} small />
    </Link>
  ));
  return (
    <main className="page single">
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>Hubs</h1>
        </div>
        {yours.length > 0 && <><div className="panel-pad small muted" style={{ paddingBottom: 6, fontWeight: 700 }}>Your hubs</div>{list(yours)}</>}
        <div className="panel-pad small muted" style={{ paddingBottom: 6, fontWeight: 700 }}>{yours.length ? "More hubs" : "All hubs"}</div>
        {list(others)}
      </div>
    </main>
  );
}
