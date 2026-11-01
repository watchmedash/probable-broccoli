"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
type Preview = { url: string; title?: string | null; description?: string | null; image?: string | null; site?: string | null };

/** The first link in a post as a card, from the same link-preview server function the app uses (through our own address). */
export function LinkCard({ url }: { url: string }) {
  const [p, setP] = useState<Preview | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/link-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && d && (d.title || d.image)) setP(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [url]);
  if (!p) return null;
  return (
    <a href={url} target="_blank" rel="nofollow ugc noopener" className="panel" style={{ display: "flex", gap: 12, padding: 12, margin: "8px 0", alignItems: "center" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block" }}>{p.title}</b>
        {p.description && <span className="muted small" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description}</span>}
        <span className="muted small">{p.site ?? new URL(url).hostname}</span>
      </span>
      {p.image && <img src={p.image} alt="" loading="lazy" style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 1, flex: "none" }} />}
    </a>
  );
}
