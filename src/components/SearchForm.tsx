"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, I } from "./Icon";

/** The search box on the search page itself (phones, where the header has no box). */
export function SearchForm({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const router = useRouter();
  return (
    <form className="search" style={{ display: "flex", maxWidth: "none" }} role="search" onSubmit={e => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}>
      <Icon icon={I.search} size={15} />
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search Nakodu" aria-label="Search Nakodu" autoFocus={!initial} />
    </form>
  );
}
