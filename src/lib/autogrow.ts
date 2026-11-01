"use client";
import { useLayoutEffect, useRef } from "react";

/** A text box that grows with what's typed in it, up to [max] pixels, then scrolls. */
export function useAutoGrow(value: string, max: number) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    if (!value) return;
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + border, max)}px`;
  }, [value, max]);
  return ref;
}
