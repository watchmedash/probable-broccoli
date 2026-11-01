import type { Metadata } from "next";
import Link from "next/link";
import { HubIcon } from "@/components/Avatars";
import { JoinButton } from "@/components/JoinButton";
import { fetchHubs, myHubIds } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hubs", description: "Every hub on Nakodu.", alternates: { canonical: "/hubs" } };

/** Icon, name and Join, like the app's hub list. Signed in: the hubs you joined, and the rest. */
export default async function HubsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await currentUser();
  const sb = await serverSupabase();
  const [hubs, mine] = await Promise.all([fetchHubs(sb), me ? myHubIds(sb, me.id) : Promise.resolve([] as number[])]);
  const joined = hubs.filter(h => mine.includes(h.id));
  const others = hubs.filter(h => !mine.includes(h.id));
  // New accounts have nothing joined, so they start on the other tab.
  const tab = !me || sp.tab === "all" || (sp.tab !== "joined" && joined.length === 0) ? "all" : "joined";
  const shown = tab === "joined" ? joined : others;
  return (
    <main className="page single">
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>Hubs</h1>
          {me && <Link href="/hubs/new" className="btn ghost"><span aria-hidden>+</span> Create</Link>}
        </div>
        {me && (
          <nav className="tabs" aria-label="Hubs">
            <Link href="/hubs?tab=joined" className={tab === "joined" ? "on" : ""} aria-current={tab === "joined" ? "page" : undefined}>Joined</Link>
            <Link href="/hubs?tab=all" className={tab === "all" ? "on" : ""} aria-current={tab === "all" ? "page" : undefined}>All hubs</Link>
          </nav>
        )}
        {shown.length === 0 && <div className="empty">{tab === "joined" ? "Hubs you join show up here." : "You've joined every hub."}</div>}
        {shown.map(h => (
          <Link key={h.id} href={`/n/${h.name}`} className="hub-row">
            <HubIcon hub={h} size={44} />
            <span className="name">n/{h.name}</span>
            <JoinButton hubId={h.id} joined={mine.includes(h.id)} isPrivate={h.privacy === "private"} signedIn={!!me} small />
          </Link>
        ))}
      </div>
    </main>
  );
}
