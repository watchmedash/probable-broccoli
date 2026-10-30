"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const TOGGLE = "nakodu:menu";

/** The header's menu button (phones): opens the left column as a drawer. */
export function MenuButton() {
  return (
    <button className="icon-btn show-nav" aria-label="Menu" onClick={() => window.dispatchEvent(new Event(TOGGLE))}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
    </button>
  );
}

/** A plain column on wide screens; a drawer over the page on narrow ones. Closes when you navigate. */
export function NavDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    const toggle = () => setOpen(o => !o);
    window.addEventListener(TOGGLE, toggle);
    return () => window.removeEventListener(TOGGLE, toggle);
  }, []);
  useEffect(() => { setOpen(false); }, [path, params]);
  return (
    <>
      {open && <div className="nav-back" onClick={() => setOpen(false)} />}
      <aside className={`leftnav ${open ? "open" : ""}`}>{children}</aside>
    </>
  );
}

export function NavLink({ href, icon, label, exact }: { href: string; icon: React.ReactNode; label: string; exact?: boolean }) {
  const path = usePathname();
  const params = useSearchParams();
  const [p, q] = href.split("?");
  const feed = new URLSearchParams(q ?? "").get("feed");
  const on = feed ? path === "/" && params.get("feed") === feed : exact ? path === p && (p !== "/" || !params.get("feed")) : path.startsWith(p);
  return (
    <Link href={href} className={`nav-link ${on ? "on" : ""}`} aria-current={on ? "page" : undefined}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </Link>
  );
}

/** Folds the left column down to icons (wide screens). Remembered in a cookie. */
export function CollapseButton() {
  return (
    <button
      className="icon-btn nav-collapse"
      aria-label="Collapse or expand the menu"
      onClick={() => {
        const shell = document.querySelector(".shell");
        const collapsed = !shell?.classList.contains("collapsed");
        shell?.classList.toggle("collapsed", collapsed);
        document.cookie = `nav=${collapsed ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
    </button>
  );
}

/** Light by default; a small link switches. Remembered in a cookie so pages arrive in the right colours. */
export function ThemeSwitch({ initial }: { initial: string }) {
  const [dark, setDark] = useState(initial === "dark");
  return (
    <button
      className="linkish"
      style={{ color: "inherit", fontWeight: 400, font: "inherit" }}
      onClick={() => {
        const v = dark ? "light" : "dark";
        setDark(!dark);
        document.documentElement.dataset.theme = v;
        document.cookie = `theme=${v}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      {dark ? "Light theme" : "Dark theme"}
    </button>
  );
}
