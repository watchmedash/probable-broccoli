"use client";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { Avatar } from "./Avatars";
import { Icon, I } from "./Icon";

export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const path = usePathname();
  const [q, setQ] = useState(path === "/search" ? params.get("q") ?? "" : "");
  return (
    <form className="search" role="search" onSubmit={e => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}>
      <Icon icon={I.search} size={15} />
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search Nakodu" aria-label="Search Nakodu" />
    </form>
  );
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
          <Link href="/hubs/new"><Icon icon={I.plus} size={14} /> Create a hub</Link>
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
