"use client";
import { useEffect, useRef, useState } from "react";
import { ADSENSE_CLIENT, ADSENSE_FEED_LAYOUT, ADSENSE_FEED_SLOT } from "@/lib/config";

// Read once however many ads are on the page, and only once one is near the screen, so pages without ads never fetch it.
let script: Promise<void> | null = null;
const loadScript = () => (script ??= new Promise<void>((resolve, reject) => {
  const s = document.createElement("script");
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  s.async = true;
  s.crossOrigin = "anonymous";
  s.onload = () => resolve();
  s.onerror = () => reject(new Error("blocked"));
  document.head.appendChild(s);
}));

/** An ad between posts. Takes up no room until Google has filled it, and goes away if it has nothing to show. */
export function FeedAd() {
  const spot = useRef<HTMLDivElement>(null);
  const unit = useRef<HTMLModElement>(null);
  const [near, setNear] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = spot.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      setNear(true);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !unit.current || unit.current.dataset.pushed) return;
    unit.current.dataset.pushed = "1";
    loadScript().then(() => {
      const w = window as unknown as { adsbygoogle?: object[] };
      (w.adsbygoogle ??= []).push({});
    }).catch(() => setGone(true));
  }, [near]);

  if (gone) return null;
  return (
    <div ref={spot} className="ad-card">
      <span className="ad-label muted small">Ad</span>
      {near && (
        <ins
          ref={unit}
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_FEED_SLOT}
          data-ad-format="fluid"
          data-ad-layout-key={ADSENSE_FEED_LAYOUT}
        />
      )}
    </div>
  );
}
