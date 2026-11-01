"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import type { VideoLink } from "@/lib/video";

/** Spoilers and 18+ posts stay blurred until tapped, like the app. */
export function Covered({ spoiler, mature, children }: { spoiler: boolean; mature: boolean; children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  if (!(spoiler || mature) || shown) return <>{children}</>;
  return (
    <div className="cover blur">
      {children}
      <div className="reveal">
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShown(true); }}>
          {mature ? "Show 18+ post" : "Show spoiler"}
        </button>
      </div>
    </div>
  );
}

const PlayMark = () => (
  <div className="play">
    <span>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M8 5v14l11-7z" /></svg>
    </span>
  </div>
);

/** A video file: plain browser video, no scripts from anywhere else, so no ads or popups. */
function FilePlayer({ url, hls }: { url: string; hls: boolean }) {
  const el = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = el.current;
    if (!video) return;
    if (!hls || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return;
    }
    let player: { destroy: () => void } | null = null;
    let live = true;
    import("hls.js").then(({ default: Hls }) => {
      if (!live) return;
      if (!Hls.isSupported()) return setFailed(true);
      const h = new Hls();
      player = h;
      h.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) setFailed(true); });
      h.loadSource(url);
      h.attachMedia(video);
    }).catch(() => setFailed(true));
    return () => { live = false; player?.destroy(); };
  }, [url, hls]);
  if (failed) return <p className="muted small">This video can&apos;t play here. <a href={url} target="_blank" rel="nofollow ugc noopener" className="linkish">Open it</a></p>;
  return <div className="yt"><video ref={el} controls autoPlay playsInline onError={() => setFailed(true)} /></div>;
}

/**
 * A linked video, loaded only when tapped. Files use the browser's player. Other pages
 * run sandboxed: without allow-popups or allow-top-navigation they can't open ads or send you elsewhere.
 */
export function VideoPlayer({ video, title, poster, playInline }: { video: VideoLink; title?: string; poster?: string | null; playInline: boolean }) {
  const [playing, setPlaying] = useState(false);
  if (playing && video.kind === "file") return <FilePlayer url={video.url} hls={video.hls} />;
  if (playing) {
    return (
      <div className="yt">
        <iframe src={video.url} title={title ?? "Video"} sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      </div>
    );
  }
  return (
    <div
      className="yt"
      style={{ cursor: "pointer" }}
      onClick={e => {
        if (!playInline) return;
        e.preventDefault();
        e.stopPropagation();
        setPlaying(true);
      }}
    >
      {poster && <img src={poster} alt="" loading="lazy" />}
      <PlayMark />
    </div>
  );
}

/** A YouTube thumbnail with a play button; the privacy-friendly player loads only when tapped. */
export function YouTube({ id, title, playInline }: { id: string; title?: string; playInline: boolean }) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <div className="yt">
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={title ?? "YouTube video"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      </div>
    );
  }
  return (
    <div
      className="yt"
      onClick={e => {
        if (!playInline) return;
        e.preventDefault();
        e.stopPropagation();
        setPlaying(true);
      }}
      style={{ cursor: "pointer" }}
    >
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
      <PlayMark />
    </div>
  );
}
