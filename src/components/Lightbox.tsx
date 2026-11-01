"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Icon, I } from "./Icon";

/** Any picture inside opens full size. Arrow keys or the side buttons move between them; Esc or a click outside closes. */
export function Lightbox({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [at, setAt] = useState<number | null>(null);
  const move = (d: number) => setAt(i => (i == null ? i : (i + d + urls.length) % urls.length));

  useEffect(() => {
    if (at == null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAt(null);
      if (e.key === "ArrowRight") setAt(i => (i == null ? i : (i + 1) % urls.length));
      if (e.key === "ArrowLeft") setAt(i => (i == null ? i : (i - 1 + urls.length) % urls.length));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [at, urls.length]);

  return (
    <div
      ref={box}
      className="zoomable"
      onClick={e => {
        const img = e.target as HTMLElement;
        if (img.tagName !== "IMG" || img.closest(".yt") || img.closest(".cover.blur")) return;
        const list = [...(box.current?.querySelectorAll<HTMLImageElement>("img") ?? [])].filter(i => !i.closest(".yt")).map(i => i.src);
        setUrls(list);
        setAt(Math.max(0, list.indexOf((img as HTMLImageElement).src)));
      }}
    >
      {children}
      {at != null && (
        <div className="lightbox" role="dialog" aria-modal aria-label="Picture" onClick={e => { e.stopPropagation(); setAt(null); }}>
          <img src={urls[at]} alt="" onClick={e => e.stopPropagation()} />
          <button className="lb-close" aria-label="Close" onClick={() => setAt(null)}><Icon icon={I.close} size={18} /></button>
          {urls.length > 1 && (
            <>
              <button className="lb-prev" aria-label="Previous picture" onClick={e => { e.stopPropagation(); move(-1); }}>‹</button>
              <button className="lb-next" aria-label="Next picture" onClick={e => { e.stopPropagation(); move(1); }}>›</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
