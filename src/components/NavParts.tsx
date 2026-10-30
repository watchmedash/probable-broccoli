"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, I } from "./Icon";

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

/** Light by default. The choice is remembered in a cookie so the page arrives in the right colours. */
export function ThemeSwitch({ initial }: { initial: string }) {
  const [dark, setDark] = useState(initial === "dark");
  return (
    <label className="nav-link" style={{ cursor: "pointer" }}>
      <span className="nav-icon"><Icon icon={I.eye} size={16} /></span>
      <span className="nav-label" style={{ flex: 1 }}>Dark mode</span>
      <input
        type="checkbox"
        checked={dark}
        onChange={e => {
          const v = e.target.checked ? "dark" : "light";
          setDark(e.target.checked);
          document.documentElement.dataset.theme = v;
          document.cookie = `theme=${v}; path=/; max-age=31536000; samesite=lax`;
        }}
        style={{ width: 18, height: 18, accentColor: "var(--blue)" }}
      />
    </label>
  );
}
