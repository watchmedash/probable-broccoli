/** "now", "15m", "10h", "3d", "4w", "1y": the app's short ages. */
/** How long until an erasing post goes, like "Gone in 5h". */
export function goneIn(iso: string, now: Date = new Date()): string {
  const m = Math.max(0, (new Date(iso).getTime() - now.getTime()) / 60000);
  if (m < 60) return `Gone in ${Math.max(1, Math.ceil(m))}m`;
  const h = m / 60;
  if (h < 24) return `Gone in ${Math.ceil(h)}h`;
  return `Gone in ${Math.ceil(h / 24)}d`;
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d`;
  if (d < 365) return `${Math.floor(d / 7)}w`;
  return `${Math.floor(d / 365)}y`;
}

/** Member counts stay hidden until a hub has a few people; "1 member" helps nobody. */
export const SHOW_MEMBERS_FROM = 10;

export function countLabel(n: number, word: string): string {
  return `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
}

/** "Oct 2026", for "Joined ..." on profiles. */
export function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Plain text from markdown, for previews and page descriptions. */
export function plainText(md: string, max = 200): string {
  const text = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Emphasis markers go; underscores inside words and links stay.
    .replace(/[*~`>#]+/g, "")
    .replace(/(^|[^\w])_+(?=\w)|(?<=\w)_+(?=[^\w]|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}
