export type VideoLink = { kind: "file"; url: string; hls: boolean } | { kind: "page"; url: string };

/** True when the link's site, or a subdomain of it, is on the admins' block list. */
export function isBlockedVideo(raw: string, blocked: string[] = []): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    return blocked.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return true;
  }
}

/**
 * What a link plays as, going by the address alone: a video file, or a player page such as
 * example.com/embed/123. Other pages can only be told apart by their tags (see LinkCard).
 */
export function videoLink(raw: string, blocked: string[] = []): VideoLink | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || isBlockedVideo(raw, blocked)) return null;
  const file = u.pathname.toLowerCase().match(/\.(mp4|webm|m3u8)$/)?.[1];
  if (file) return { kind: "file", url: u.toString(), hls: file === "m3u8" };
  return /^\/(.+\/)?(embed|player|e)(\/|\.|$)/i.test(u.pathname) ? { kind: "page", url: u.toString() } : null;
}

/** Removes a link where it stands alone; one written as [words](url) stays. */
export function withoutBareLink(body: string, url: string): string {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`), "$1").trim();
}

/** The first playable link in a post, if any. */
export function firstVideo(text: string, blocked: string[] = []): VideoLink | null {
  for (const m of text.matchAll(/https?:\/\/[^\s)\]]+/g)) {
    const v = videoLink(m[0], blocked);
    if (v) return v;
  }
  return null;
}
