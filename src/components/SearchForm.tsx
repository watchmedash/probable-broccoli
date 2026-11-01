"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { searchUrl } from "./HeaderParts";
import { Icon, I } from "./Icon";

/** The search box on the search page itself (phones, where the header has no box). */
export function SearchForm({ initial, hub }: { initial: string; hub?: string }) {
  const [q, setQ] = useState(initial);
  const router = useRouter();
  const label = hub ? `Search ${hub}` : "Search Nakodu";
  return (
    <form className="search" style={{ display: "flex", maxWidth: "none" }} role="search" onSubmit={e => { e.preventDefault(); if (q.trim()) router.push(searchUrl(q.trim(), hub)); }}>
      <Icon icon={I.search} size={15} />
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={label} aria-label={label} autoFocus={!initial} />
    </form>
  );
}
