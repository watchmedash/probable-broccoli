/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Post } from "@/lib/types";
import { myVote } from "@/lib/types";
import { countLabel, plainText, timeAgo } from "@/lib/format";
import { firstYouTube } from "@/lib/youtube";
import { Avatar, HubIcon } from "./Avatars";
import { Icon, I } from "./Icon";
import { ShareButton, Votes } from "./VoteBar";
import { Covered, YouTube } from "./Media";

/**
 * A post in a list. Mixed feeds show the hub; a hub's own feed and profiles show the author
 * (like the app). Prefixes only show on the post page.
 */
export function PostCard({ post, showHub, signedIn }: { post: Post; showHub: boolean; signedIn: boolean }) {
  const href = `/p/${post.id}`;
  const images = post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : [];
  const yt = images.length === 0 ? firstYouTube(post.body) : null;
  const preview = plainText(yt ? post.body.replace(/https?:\/\/\S+/g, "") : post.body, 300);
  return (
    <article className="card">
      <div className="meta">
        {showHub && post.community ? (
          <Link href={`/n/${post.community.name}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HubIcon hub={post.community} size={22} />
            <span className="hub-name">n/{post.community.name}</span>
          </Link>
        ) : (
          <Link href={`/u/${post.author?.username ?? ""}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar user={post.author} size={22} />
            <span className="author">{post.author ? `u/${post.author.username}` : "[deleted]"}</span>
          </Link>
        )}
        <span>{timeAgo(post.created_at)}</span>
        {post.pinned_at && !showHub && <span className="tag pin"><Icon icon={I.pin} size={11} /> Pinned</span>}
        {post.spoiler && <span className="tag spoiler">SPOILER</span>}
        {post.mature && <span className="tag nsfw">18+</span>}
      </div>
      <Link href={href} className="card-title">{post.title}</Link>
      <Link href={href} style={{ display: "block" }}>
        <Covered spoiler={post.spoiler} mature={post.mature}>
          {images.length > 0 ? (
            <div className="media">
              <img src={images[0]} alt="" loading="lazy" />
              {images.length > 1 && <span className="count">1 / {images.length}</span>}
            </div>
          ) : yt ? (
            <YouTube id={yt} title={post.title} playInline={false} />
          ) : null}
          {preview && images.length === 0 && <p className="card-body">{preview}</p>}
        </Covered>
      </Link>
      <div className="actions">
        <Votes table="post_votes" id={post.id} score={post.score} mine={myVote(post.my_vote)} signedIn={signedIn} />
        <Link href={`${href}#comments`} className="act" aria-label={countLabel(post.comment_count, "comment")}>
          <Icon icon={I.comment} size={15} /> {post.comment_count}
        </Link>
        <ShareButton id={post.id} />
        {post.locked && <span className="act" title="Locked"><Icon icon={I.lock} size={13} /></span>}
      </div>
    </article>
  );
}
