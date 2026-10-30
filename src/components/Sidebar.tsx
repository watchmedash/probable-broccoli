import Link from "next/link";
import type { Hub } from "@/lib/types";
import { HubIcon } from "./Avatars";

/** Home's right column: what Nakodu is, and a few hubs to start with. */
export function HomeSidebar({ hubs, signedIn }: { hubs: Hub[]; signedIn: boolean }) {
  return (
    <aside className="side">
      <section className="panel panel-pad">
        <h2>Nakodu</h2>
        <p style={{ margin: "0 0 12px" }}>A calmer place for communities. Join hubs about what you love, share posts and stories, vote and chat.</p>
        {signedIn ? (
          <Link href="/submit" className="btn block">Create a post</Link>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/signup" className="btn block">Join Nakodu</Link>
            <p className="muted small" style={{ margin: 0 }}>Just a username and a password.</p>
          </div>
        )}
      </section>
      {hubs.length > 0 && (
        <section className="panel">
          <div className="panel-pad" style={{ paddingBottom: 4 }}><h2>Hubs</h2></div>
          {hubs.slice(0, 8).map(h => (
            <Link key={h.id} href={`/n/${h.name}`} className="hub-row" style={{ borderBottom: 0, padding: "8px 16px" }}>
              <HubIcon hub={h} size={32} />
              <span className="name" style={{ fontSize: 15 }}>n/{h.name}</span>
            </Link>
          ))}
          <div className="panel-pad" style={{ paddingTop: 8 }}><Link href="/hubs" className="linkish">See all hubs</Link></div>
        </section>
      )}
      <section className="panel panel-pad">
        <h2>Get the app</h2>
        <p className="small muted" style={{ margin: "0 0 10px" }}>Notifications, chat and everything else, on Android.</p>
        <a href="/download/nakodu.apk" className="btn quiet block">Download for Android</a>
      </section>
    </aside>
  );
}
