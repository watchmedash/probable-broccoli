"use client";
import { useEffect } from "react";

/** Clicking a >!spoiler!< reveals it. Inside a link (a feed card) the click only reveals. */
export function Spoilers() {
  useEffect(() => {
    const reveal = (e: MouseEvent) => {
      const s = (e.target as HTMLElement | null)?.closest?.(".md-spoiler");
      if (!s || s.classList.contains("on")) return;
      e.preventDefault();
      e.stopPropagation();
      s.classList.add("on");
    };
    document.addEventListener("click", reveal, true);
    return () => document.removeEventListener("click", reveal, true);
  }, []);
  return null;
}
