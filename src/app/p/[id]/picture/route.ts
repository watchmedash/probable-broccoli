import sharp from "sharp";
import { fetchPost } from "@/lib/queries";
import { SHARE_HEIGHT, SHARE_WIDTH, sharePicture } from "@/lib/sharePicture";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;

/** Only public web hosts: no bare IPs, no local names. */
function safeHost(url: URL) {
  const h = url.hostname.toLowerCase();
  return url.protocol === "https:" && h.includes(".") && !/^[\d.]+$/.test(h) && !h.includes(":") && !h.endsWith(".local") && !h.endsWith(".internal") && h !== "localhost";
}

/**
 * The picture link previews (Facebook, X, chats) show for a post, fetched once and served from
 * Nakodu as a 1200x630 JPEG. Anything that goes wrong falls back to the Nakodu banner.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const fallback = Response.redirect(new URL("/img/og.png", req.url), 302);
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) return fallback;
  const post = await fetchPost(await serverSupabase(), id, false);
  const picture = post ? sharePicture(post) : null;
  if (!picture) return fallback;
  try {
    const url = new URL(picture);
    if (!safeHost(url)) return fallback;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0 (compatible; NakoduPreview/1.0; +https://nakodu.top)" } });
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return fallback;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return fallback;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) return fallback;
    const out = await sharp(bytes, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(SHARE_WIDTH, SHARE_HEIGHT, { fit: "cover", position: "attention" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(out), {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400, s-maxage=604800" },
    });
  } catch {
    return fallback;
  }
}
