"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Icon, I } from "./Icon";

/** Pictures full size over the page. Arrow keys or the side buttons move between them; Esc or a click outside closes. */
function Overlay({ urls, at, setAt }: { urls: string[]; at: number; setAt: (fn: (i: number | null) => number | null) => void }) {
  const move = (d: number) => setAt(i => (i == null ? i : (i + d + urls.length) % urls.length));

  // The page behind stays still and its scroll bar goes, without the page jumping sideways.
  useEffect(() => {
    const root = document.documentElement, body = document.body;
    const bar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    body.style.paddingRight = `${bar}px`;
    return () => { root.style.overflow = ""; body.style.paddingRight = ""; };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAt(() => null);
      if (e.key === "ArrowRight") setAt(i => (i == null ? i : (i + 1) % urls.length));
      if (e.key === "ArrowLeft") setAt(i => (i == null ? i : (i - 1 + urls.length) % urls.length));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setAt, urls.length]);

  return (
    <div className="lightbox" role="dialog" aria-modal aria-label="Picture" onClick={e => { e.stopPropagation(); setAt(() => null); }}>
      <img src={urls[at]} alt="" onClick={e => e.stopPropagation()} />
      <button className="lb-close" aria-label="Close" onClick={() => setAt(() => null)}><Icon icon={I.close} size={18} /></button>
      {urls.length > 1 && (
        <>
          <button className="lb-prev" aria-label="Previous picture" onClick={e => { e.stopPropagation(); move(-1); }}>‹</button>
          <button className="lb-next" aria-label="Next picture" onClick={e => { e.stopPropagation(); move(1); }}>›</button>
        </>
      )}
    </div>
  );
}

/** Any picture inside opens full size. */
export function Lightbox({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [at, setAt] = useState<number | null>(null);
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
      {at != null && <Overlay urls={urls} at={at} setAt={setAt} />}
    </div>
  );
}

/** An avatar, icon or cover that opens full size when clicked. Without a picture it's left as it is. */
export function Viewable({ src, children, label = "View picture", className }: { src: string | null | undefined; children: React.ReactNode; label?: string; className?: string }) {
  const [at, setAt] = useState<number | null>(null);
  if (!src) return <>{children}</>;
  return (
    <>
      <button type="button" className={`viewable ${className ?? ""}`} aria-label={label} onClick={() => setAt(0)}>{children}</button>
      {at != null && <Overlay urls={[src]} at={at} setAt={setAt} />}
    </>
  );
}
