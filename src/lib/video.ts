export type VideoLink = { kind: "file"; url: string; hls: boolean } | { kind: "page"; url: string };

const hostMatches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** What a link plays as: a video file on any https site, or a page on a site the admins allow. */
export function videoLink(raw: string, embedDomains: string[] = []): VideoLink | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const file = u.pathname.toLowerCase().match(/\.(mp4|webm|m3u8)$/)?.[1];
  if (file) return { kind: "file", url: u.toString(), hls: file === "m3u8" };
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  return embedDomains.some(d => hostMatches(host, d)) ? { kind: "page", url: u.toString() } : null;
}

/** The first playable link in a post, if any. */
export function firstVideo(text: string, embedDomains: string[] = []): VideoLink | null {
  for (const m of text.matchAll(/https?:\/\/[^\s)\]]+/g)) {
    const v = videoLink(m[0], embedDomains);
    if (v) return v;
  }
  return null;
}
