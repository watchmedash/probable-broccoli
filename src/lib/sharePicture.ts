import { firstBodyImage, isImageUrl } from "./mdedit";
import { firstYouTube } from "./youtube";

type PicturePost = { body: string; image_url: string | null; image_urls?: string[] | null; spoiler: boolean; mature: boolean };

/**
 * The picture a shared link to this post shows: its gallery or upload, a picture written or linked
 * in the text, or a YouTube thumbnail. Spoilers and 18+ posts show none.
 */
export function sharePicture(post: PicturePost): string | null {
  if (post.spoiler || post.mature) return null;
  const bare = post.body.match(/https:\/\/[^\s)\]]+/g)?.find(u => isImageUrl(u, true));
  const yt = firstYouTube(post.body);
  return post.image_urls?.[0] ?? post.image_url ?? firstBodyImage(post.body) ?? bare ?? (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null);
}

/** Share pictures are served from Nakodu at this size, so previews never wait on someone else's host. */
export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;
