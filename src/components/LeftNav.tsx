import Link from "next/link";
import { fetchHubs, myHubIds } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";
import { HubIcon } from "./Avatars";
import { Icon, I } from "./Icon";
import { NavDrawer, NavLink, ThemeSwitch } from "./NavParts";

/** The left column: feeds, hubs you're in, and the small print. On phones it opens from the header's menu button. */
export async function LeftNav({ theme }: { theme: string }) {
  const me = await currentUser();
  const sb = await serverSupabase();
  const [hubs, mine] = await Promise.all([fetchHubs(sb), me ? myHubIds(sb, me.id) : Promise.resolve([] as number[])]);
  const yours = hubs.filter(h => mine.includes(h.id));
  return (
    <NavDrawer>
      <nav className="nav-group" aria-label="Feeds">
        <NavLink href="/" icon={<Icon icon={I.home} size={17} />} label="Home" exact />
        <NavLink href="/?feed=popular" icon={<Icon icon={I.popular} size={17} />} label="Popular" />
        {me && <NavLink href="/?feed=following" icon={<Icon icon={I.following} size={17} />} label="Following" />}
        <NavLink href="/hubs" icon={<Icon icon={I.users} size={17} />} label="Hubs" exact />
      </nav>
      {yours.length > 0 && (
        <nav className="nav-group" aria-label="Your hubs">
          <span className="nav-title">Your hubs</span>
          {yours.map(h => <NavLink key={h.id} href={`/n/${h.name}`} icon={<HubIcon hub={h} size={24} />} label={`n/${h.name}`} />)}
        </nav>
      )}
      {!me && hubs.length > 0 && (
        <nav className="nav-group" aria-label="Hubs">
          <span className="nav-title">Hubs</span>
          {[...hubs].sort((a, b) => b.member_count - a.member_count).slice(0, 10).map(h => (
            <NavLink key={h.id} href={`/n/${h.name}`} icon={<HubIcon hub={h} size={24} />} label={`n/${h.name}`} />
          ))}
        </nav>
      )}
      <div className="nav-small">
        <Link href="/rules">Rules</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/child-safety">Child safety</Link>
        <Link href="/delete-account">Delete account</Link>
        <a href="/download/nakodu.apk">Android app</a>
        <ThemeSwitch initial={theme} />
      </div>
    </NavDrawer>
  );
}
