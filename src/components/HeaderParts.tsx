"use client";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { Avatar } from "./Avatars";
import { Icon, I } from "./Icon";

export const searchUrl = (q: string, hub?: string | null) => `/search?q=${encodeURIComponent(q)}${hub ? `&hub=${encodeURIComponent(hub)}` : ""}`;

/** The hub a search should stay inside: the one you're in, or the one you're already searching. */
function useSearchHub(): string | null {
  const params = useSearchParams();
  const path = usePathname();
  if (path === "/search") return params.get("hub");
  const m = path.match(/^\/n\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const path = usePathname();
  const hub = useSearchHub();
  const onSearch = path === "/search" ? params.get("q") ?? "" : "";
  const [q, setQ] = useState(onSearch);
  // The box empties once you leave the search results.
  useEffect(() => { setQ(onSearch); }, [onSearch]);
  const label = hub ? `Search ${hub}` : "Search Nakodu";
  return (
    <form className="search" role="search" onSubmit={e => { e.preventDefault(); if (q.trim()) router.push(searchUrl(q.trim(), hub)); }}>
      <Icon icon={I.search} size={15} />
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={label} aria-label={label} />
    </form>
  );
}

/** The search icon on phones, which keeps you inside the hub you're in. */
export function SearchIconLink() {
  const hub = useSearchHub();
  return <Link href={hub ? `/search?hub=${encodeURIComponent(hub)}` : "/search"} className="icon-btn show-sm" aria-label="Search"><Icon icon={I.search} size={18} /></Link>;
}

export function UserMenu({ username, avatar }: { username: string; avatar: string | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={box} style={{ position: "relative" }}>
      <button className="icon-btn" onClick={() => setOpen(o => !o)} aria-label="Your account" aria-expanded={open}>
        <Avatar user={{ username, avatar_url: avatar }} size={28} />
      </button>
      {open && (
        <div className="menu" onClick={() => setOpen(false)}>
          <Link href={`/u/${username}`}><Icon icon={I.user} size={14} /> u/{username}</Link>
          <Link href="/saved"><Icon icon={I.save} size={14} /> Saved</Link>
          <Link href="/settings"><Icon icon={I.settings} size={14} /> Settings</Link>
          <button
            onClick={async () => {
              await browserSupabase().auth.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <Icon icon={I.logout} size={14} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
