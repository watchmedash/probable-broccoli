"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { isBlockedVideo, videoLink, type VideoLink } from "@/lib/video";
import { VideoPlayer } from "./Media";

type Preview = { url: string; title?: string | null; description?: string | null; image?: string | null; site?: string | null; video?: string | null };

// The block list, read once however many cards are on the page.
let blockList: Promise<string[]> | null = null;
const loadBlockList = () => (blockList ??= Promise.resolve(browserSupabase().from("site_blocked_video_domains").select("domain")).then(r => (r.data ?? []).map((d: { domain: string }) => d.domain)));

/** The first link in a post as a card, from the same link-preview server function the app uses (through our own address). A page that says it holds a video plays above its card, unless its site is blocked. */
export function LinkCard({ url, blockedVideos, onPlays }: { url: string; blockedVideos?: string[]; onPlays?: () => void }) {
  const [p, setP] = useState<Preview | null>(null);
  const [blocked, setBlocked] = useState(blockedVideos ?? []);
  const spot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (blockedVideos) return;
    let live = true;
    loadBlockList().then(list => { if (live) setBlocked(list); }).catch(() => {});
    return () => { live = false; };
  }, [blockedVideos]);
  // Asked for only as the card nears the screen, so a long feed doesn't fetch every link at once.
  useEffect(() => {
    const el = spot.current;
    if (!el) return;
    let live = true;
    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      fetch("/api/link-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (live && d && (d.title || d.image || d.video)) setP(d); })
        .catch(() => {});
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => { live = false; io.disconnect(); };
  }, [url]);
  const plays = !!p?.video && !isBlockedVideo(url, blocked) && !isBlockedVideo(p.video, blocked);
  useEffect(() => { if (plays) onPlays?.(); }, [plays, onPlays]);
  if (!p) return <div ref={spot} />;
  const playable = p.video && !isBlockedVideo(url, blocked) && !isBlockedVideo(p.video, blocked) ? p.video : null;
  const video: VideoLink | null = playable ? videoLink(playable, blocked) ?? { kind: "page", url: playable } : null;
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
