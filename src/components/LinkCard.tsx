"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { isBlockedVideo, videoLink, type VideoLink } from "@/lib/video";
import { VideoPlayer } from "./Media";

type Preview = { url: string; title?: string | null; description?: string | null; image?: string | null; site?: string | null; video?: string | null };

/** The first link in a post as a card, from the same link-preview server function the app uses (through our own address). A page that says it holds a video plays above its card, unless its site is blocked. */
export function LinkCard({ url, blockedVideos = [] }: { url: string; blockedVideos?: string[] }) {
  const [p, setP] = useState<Preview | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/link-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && d && (d.title || d.image || d.video)) setP(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [url]);
  if (!p) return null;
  const playable = p.video && !isBlockedVideo(url, blockedVideos) && !isBlockedVideo(p.video, blockedVideos) ? p.video : null;
  const video: VideoLink | null = playable ? videoLink(playable, blockedVideos) ?? { kind: "page", url: playable } : null;
  return (
    <>
      {video && <VideoPlayer video={video} title={p.title ?? undefined} poster={p.image} playInline />}
      {!video && <a href={url} target="_blank" rel="nofollow ugc noopener" className="panel" style={{ display: "flex", gap: 12, padding: 12, margin: "8px 0", alignItems: "center" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block" }}>{p.title ?? url}</b>
          {p.description && <span className="muted small" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description}</span>}
          <span className="muted small">{p.site ?? new URL(url).hostname}</span>
        </span>
        {p.image && !video && <img src={p.image} alt="" loading="lazy" style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 1, flex: "none" }} />}
      </a>}
    </>
  );
}
