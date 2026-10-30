import Link from "next/link";
import { RANGES, type Range, type Sort } from "@/lib/queries";

/** Hot, New, Top (with a time range under Top), as links so every view has its own address. */
export function SortTabs({ base, sort, range, extra = {}, defaultSort = "hot" }: { base: string; sort: Sort; range: Range; extra?: Record<string, string>; defaultSort?: Sort }) {
  const url = (p: Record<string, string>) => {
    const q = new URLSearchParams({ ...extra, ...p });
    for (const [k, v] of [...q.entries()]) if (!v || (k === "sort" && v === defaultSort)) q.delete(k);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <>
      <nav className="tabs" aria-label="Sort">
        {(["hot", "new", "top"] as Sort[]).map(s => (
          <Link key={s} href={url({ sort: s })} className={sort === s ? "on" : ""} aria-current={sort === s ? "page" : undefined}>
            {s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </nav>
      {sort === "top" && (
        <nav className="subtabs" aria-label="Time range">
          {(Object.keys(RANGES) as Range[]).map(r => (
            <Link key={r} href={url({ sort: "top", t: r })} className={range === r ? "on" : ""}>{RANGES[r].label}</Link>
          ))}
        </nav>
      )}
    </>
  );
}
