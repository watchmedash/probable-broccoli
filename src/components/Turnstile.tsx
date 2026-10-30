"use client";
import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/config";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

let loading: Promise<void> | null = null;
function loadScript() {
  loading ??= new Promise(resolve => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return loading;
}

/** Cloudflare's bot check. Each answer works once, so a new [round] starts it over. */
export function Turnstile({ round, onToken }: { round: number; onToken: (t: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  useEffect(() => {
    let id: string | null = null;
    let gone = false;
    loadScript().then(() => {
      if (gone || !box.current || !window.turnstile) return;
      id = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(null),
        "error-callback": () => cb.current(null),
      });
    });
    return () => {
      gone = true;
      if (id && window.turnstile) window.turnstile.remove(id);
      cb.current(null);
    };
  }, [round]);
  return <div ref={box} style={{ minHeight: 65, display: "flex", justifyContent: "center" }} />;
}
