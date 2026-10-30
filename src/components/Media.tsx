"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

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
      <div className="play">
        <span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M8 5v14l11-7z" /></svg>
        </span>
      </div>
    </div>
  );
}
