import Link from "next/link";
import { currentUser, serverSupabase } from "@/lib/supabase/server";
import { Icon, I } from "./Icon";
import { UserMenu, SearchBox } from "./HeaderParts";

export async function Header() {
  const me = await currentUser();
  let unread = 0;
  let avatar: string | null = null;
  if (me) {
    const sb = await serverSupabase();
    const [{ count }, { data: profile }] = await Promise.all([
      sb.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
      sb.from("profiles").select("avatar_url").eq("id", me.id).maybeSingle(),
    ]);
    unread = count ?? 0;
    avatar = profile?.avatar_url ?? null;
  }
  return (
    <header className="top">
      <div className="top-in">
        <Link href="/" className="wordmark">Nakodu</Link>
        <SearchBox />
        <nav className="top-actions">
          <Link href="/search" className="icon-btn show-sm" aria-label="Search"><Icon icon={I.search} size={18} /></Link>
          <Link href="/hubs" className="icon-btn" aria-label="Hubs"><Icon icon={I.users} size={18} /></Link>
          {me ? (
            <>
              <Link href="/submit" className="icon-btn" aria-label="Create a post"><Icon icon={I.plus} size={18} /></Link>
              <Link href="/notifications" className="icon-btn" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
                <Icon icon={I.bell} size={18} />
                {unread > 0 && <span className="badge">{unread > 99 ? "99+" : unread}</span>}
              </Link>
              <UserMenu username={me.username} avatar={avatar} />
            </>
          ) : (
            <>
              <Link href="/login" className="btn ghost hide-sm">Log in</Link>
              <Link href="/signup" className="btn">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
