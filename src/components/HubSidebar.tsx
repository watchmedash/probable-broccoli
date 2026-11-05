import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { countLabel, SHOW_MEMBERS_FROM } from "@/lib/format";
import { serverSupabase } from "@/lib/supabase/server";
import type { Hub } from "@/lib/types";
import { Avatar, HubIcon } from "./Avatars";
import { BadgePicker } from "./BadgePicker";
import { Icon, I } from "./Icon";

type Mod = { id: string; username: string; avatar_url: string | null; owner: boolean };

/**
 * A hub's side column, on its page and on its posts: the description, your badge, the rules, then the mods.
 * [withHeader] adds the hub's icon and name on top (on a post, where the page isn't the hub's own).
 */
export async function HubSidebar({ hub, me, joined, withHeader = false }: { hub: Hub; me: { id: string; username: string } | null; joined: boolean; withHeader?: boolean }) {
  const sb = await serverSupabase();
  const [mods, badges, mine, avatar] = await Promise.all([
    sb.rpc("hub_mod_list", { hub: hub.id }).then(r => (r.data ?? []) as Mod[]),
    me ? sb.from("hub_badges").select("id,label,color").eq("hub_id", hub.id).order("created_at").then(r => r.data ?? []) : Promise.resolve([]),
    me ? sb.from("hub_user_flairs").select("text,color").eq("hub_id", hub.id).eq("user_id", me.id).maybeSingle().then(r => r.data ?? null) : Promise.resolve(null),
    me ? sb.from("profiles").select("avatar_url").eq("id", me.id).maybeSingle().then(r => r.data?.avatar_url ?? null) : Promise.resolve(null),
  ]);
  const rules = hub.rules.split("\n").map(r => r.trim()).filter(Boolean);
  return (
    <>
      <section className="panel panel-pad">
        {withHeader && (
          <Link href={`/n/${hub.name}`} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <HubIcon hub={hub} size={40} />
            <b>n/{hub.name}</b>
          </Link>
        )}
        <p style={{ margin: "0 0 10px" }}>{hub.description || "No description yet."}</p>
        {!!hub.categories?.length && <p className="muted small" style={{ margin: "0 0 10px" }}>{hub.categories.map(categoryLabel).join(", ")}</p>}
        {hub.member_count >= SHOW_MEMBERS_FROM && <p className="muted small" style={{ margin: "0 0 12px" }}>{countLabel(hub.member_count, "member")}</p>}
        {withHeader ? (
          <Link href={`/n/${hub.name}`} className="btn quiet block">Visit hub</Link>
        ) : (
          <Link href={`/n/${hub.name}/message-mods`} className="btn quiet block"><Icon icon={I.mail} size={14} /> Message mods</Link>
        )}
      </section>
      {me && joined && badges.length > 0 && (
        <section className="panel panel-pad">
          <h2>Badge</h2>
          <BadgePicker hubId={hub.id} me={{ ...me, avatar_url: avatar }} current={mine} badges={badges} />
        </section>
      )}
      {rules.length > 0 && (
        <section className="panel panel-pad">
          <h2>Rules</h2>
          {/* Exactly as the mods wrote them, numbers or not. */}
          <ul className="rules">{rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </section>
      )}
      {mods.length > 0 && (
        <section className="panel panel-pad">
          <h2>Mods</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mods.map(m => (
              <Link key={m.id} href={`/u/${m.username}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar user={m} size={26} />
                <span>u/{m.username}</span>
                {m.owner && <span className="muted small">owner</span>}
              </Link>
            ))}
          </div>
          {withHeader && <Link href={`/n/${hub.name}/message-mods`} className="btn quiet block" style={{ marginTop: 12 }}><Icon icon={I.mail} size={14} /> Message mods</Link>}
        </section>
      )}
    </>
  );
}
