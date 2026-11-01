"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import type { Post } from "@/lib/types";
import { myVote } from "@/lib/types";
import { countLabel, plainText, timeAgo } from "@/lib/format";
import { firstBodyImage } from "@/lib/mdedit";
import type { Viewer } from "@/lib/queries";
import { firstVideo } from "@/lib/video";
import { firstYouTube } from "@/lib/youtube";
import { Avatar, HubIcon } from "./Avatars";
import { Icon, I } from "./Icon";
import { JoinButton } from "./JoinButton";
import { PostMenu } from "./PostMenu";
import { ShareButton, Votes } from "./VoteBar";
import { VideoPlayer, YouTube } from "./Media";

/**
 * A post in a list. Mixed feeds show the hub; a hub's own feed and profiles show the author
 * (like the app). Prefixes and tags only show on the post page.
 */
export function PostCard({ post, showHub, signedIn, viewer }: { post: Post; showHub: boolean; signedIn: boolean; viewer: Viewer | null }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const href = `/p/${post.id}`;
  const inText = firstBodyImage(post.body);
  const images = post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : inText ? [inText] : [];
  const yt = images.length === 0 ? firstYouTube(post.body) : null;
  const video = images.length === 0 && !yt ? firstVideo(post.body) : null;
  const preview = plainText(yt || video ? post.body.replace(/https?:\/\/\S+/g, "") : post.body, 300);
  const hub = post.community;
  const owner = !!viewer && (viewer.admin || hub?.created_by === viewer.id);
  const isStaff = owner || (!!hub && !!viewer?.staffHubs.includes(hub.id));
  const canRemove = owner || (!!hub && !!viewer?.removeHubs.includes(hub.id));
  return (
    <article className="card">
      <div className="meta">
        {showHub && hub ? (
          <Link href={`/n/${hub.name}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HubIcon hub={hub} size={22} />
            <span className="hub-name">n/{hub.name}</span>
          </Link>
        ) : (
          <Link href={`/u/${post.author?.username ?? ""}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar user={post.author} size={22} />
            <span className="author">{post.author ? `u/${post.author.username}` : "[deleted]"}</span>
          </Link>
        )}
        <span>{timeAgo(post.created_at)}</span>
        {post.pinned_at && !showHub && <span className="tag pin"><Icon icon={I.pin} size={11} /> Pinned</span>}
        <span className="card-tools">
          {showHub && hub && !viewer?.hubs.includes(hub.id) && (
            <JoinButton hubId={hub.id} joined={false} isPrivate={hub.privacy === "private"} signedIn={signedIn} small />
          )}
          <PostMenu
            postId={post.id}
            hubId={hub?.id ?? null}
            authorId={post.author?.id ?? null}
            myId={viewer?.id ?? null}
            saved={!!post.my_save?.length}
            followed={!!post.my_follow?.length}
            pinned={!!post.pinned_at}
            locked={post.locked}
            spoiler={post.spoiler}
            mature={post.mature}
            flairId={post.flair?.id ?? null}
            isStaff={isStaff}
            canRemove={canRemove}
            canCrosspost={!post.original && (hub?.allow_crossposts ?? true)}
            onGone={() => setGone(true)}
          />
        </span>
      </div>
      <Link href={href} className="card-title">{post.title}</Link>
      {/* Spoilers and 18+ posts look like any other post with no preview; they're covered on the post page. */}
      {!post.spoiler && !post.mature && (
        <Link href={href} style={{ display: "block" }}>
          {images.length > 0 ? (
            <div className="media">
              <img src={images[0]} alt="" loading="lazy" />
              {images.length > 1 && <span className="count">1 / {images.length}</span>}
            </div>
          ) : yt ? (
            <YouTube id={yt} title={post.title} playInline={false} />
          ) : video ? (
            <VideoPlayer video={video} title={post.title} playInline={false} />
          ) : null}
          {preview && images.length === 0 && <p className="card-body">{preview}</p>}
        </Link>
      )}
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
