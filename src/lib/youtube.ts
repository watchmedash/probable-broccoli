/** The video id in a YouTube link, or null. */
export function youTubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
      if (m) id = m[2];
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** The first YouTube link in a text, if any. */
export function firstYouTube(text: string): string | null {
  for (const m of text.matchAll(/https?:\/\/[^\s)\]]+/g)) {
    const id = youTubeId(m[0]);
    if (id) return id;
  }
  return null;
}
