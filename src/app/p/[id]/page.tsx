/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Avatar, HubIcon } from "@/components/Avatars";
import { Comments } from "@/components/Comments";
import { Icon, I } from "@/components/Icon";
import { Lightbox } from "@/components/Lightbox";
import { Covered, VideoPlayer, YouTube } from "@/components/Media";
import { Poll } from "@/components/Poll";
import { LinkCard } from "@/components/LinkCard";
import { RecentPosts, RecordVisit } from "@/components/RecentPosts";
import { PostMenu } from "@/components/PostMenu";
import { ShareButton, Votes } from "@/components/VoteBar";
import { SITE_URL } from "@/lib/config";
import { plainText, timeAgo } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { blockedIds, fetchComments, fetchPost, hubAccess, hubTeam, isSiteAdmin, previewVideo } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";
import { myVote } from "@/lib/types";
import { firstBodyImage } from "@/lib/mdedit";
import { firstVideo, isBlockedVideo, videoLink, withoutBareLink } from "@/lib/video";
import { firstYouTube, youTubeId } from "@/lib/youtube";

// One read per request, shared by the metadata and the page.
const load = cache(async (id: number) => {
  const me = await currentUser();
  const sb = await serverSupabase();
  return { me, sb, post: Number.isSafeInteger(id) ? await fetchPost(sb, id, !!me) : null };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { post } = await load(Number((await params).id));
  if (!post) return { title: "Post not found" };
  const where = post.community ? `n/${post.community.name}` : `u/${post.author?.username ?? "deleted"}`;
  const image = post.image_urls?.[0] ?? post.image_url;
  const description = plainText(post.body, 180) || `A post in ${where} on Nakodu.`;
  return {
    title: { absolute: post.title },
    description,
    alternates: { canonical: `/p/${post.id}` },
    robots: post.mature ? { index: false } : undefined,
    openGraph: { type: "article", title: post.title, description, url: `/p/${post.id}`, images: image && !post.spoiler && !post.mature ? [{ url: image }] : undefined },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { me, sb, post } = await load(Number((await params).id));
  if (!post) notFound();
  const hub = post.community;
  const [comments, siteDomains, admin, team, member, ban, blocked, flairRows, blockedVideos] = await Promise.all([
    fetchComments(sb, post.id, !!me),
    hub ? Promise.resolve(null) : sb.from("site_link_domains").select("domain").then(r => (r.data ?? []).map((d: { domain: string }) => d.domain)),
    isSiteAdmin(sb, me?.id),
    hub ? hubTeam(sb, hub.id) : Promise.resolve([]),
    hub && me ? sb.from("hub_members").select("hub_id").eq("hub_id", hub.id).eq("user_id", me.id).maybeSingle().then(r => !!r.data) : Promise.resolve(false),
    hub && me ? sb.from("hub_bans").select("hub_id").eq("hub_id", hub.id).eq("user_id", me.id).maybeSingle().then(r => !!r.data) : Promise.resolve(false),
    blockedIds(sb, me?.id),
    hub?.allow_user_flair ? sb.from("hub_user_flairs").select("user_id,text,color").eq("hub_id", hub.id).then(r => r.data ?? []) : Promise.resolve([]),
    sb.from("site_blocked_video_domains").select("domain").then(r => (r.data ?? []).map((d: { domain: string }) => d.domain)),
  ]);
  const access = hubAccess(hub ? { created_by: hub.created_by, status: hub.status, privacy: hub.privacy, who_can_post: hub.who_can_post, who_can_comment: hub.who_can_comment } : null, me?.id ?? null, admin, team, member, ban);
  const userFlairs = Object.fromEntries((flairRows as { user_id: string; text: string; color: string }[]).map(r => [r.user_id, { text: r.text, color: r.color }]));
  const authorFlair = post.author ? userFlairs[post.author.id] : undefined;
  // Comment links are clickable only for the sites the hub's mods (or, on profiles, the admins) allow.
  const allowed = post.community ? post.community.link_domains ?? [] : siteDomains ?? [];
  const images = post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : [];
  const yt = images.length === 0 && !isBlockedVideo("https://www.youtube.com/", blockedVideos) && !isBlockedVideo("https://youtu.be/", blockedVideos) ? firstYouTube(post.body) : null;
  // A post that is only a YouTube link shows the player instead of the bare link.
  const video = images.length === 0 && !yt ? firstVideo(post.body, blockedVideos) : null;
  const single = post.body.trim().split(/\s+/).length === 1 ? post.body.trim() : "";
  const onlyLink = (yt && youTubeId(single)) || (video && videoLink(single, blockedVideos));
  const where = post.community ? `n/${post.community.name}` : null;
  // The first non-YouTube link gets a preview card, like in the app.
  const firstLink = images.length === 0 && !yt && !video ? post.body.match(/https?:\/\/[^\s)\]]+/)?.[0] ?? null : null;
  // Once a video plays in the post, its link doesn't need to show as well.
  const pageVideo = firstLink && !post.spoiler && !post.mature && !isBlockedVideo(firstLink, blockedVideos) ? await previewVideo(firstLink) : null;
  const playsFrom = video?.url && post.body.includes(video.url) ? video.url : yt ? [...post.body.matchAll(/https?:\/\/[^\s)\]]+/g)].map(m => m[0]).find(u => youTubeId(u)) ?? null : pageVideo && !isBlockedVideo(pageVideo, blockedVideos) ? firstLink : null;
  const shownBody = playsFrom ? withoutBareLink(post.body, playsFrom) : post.body;
  const closed = post.locked || post.community?.status === "archived" || (!!me && !access.canComment && !access.isStaff);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    text: plainText(post.body, 5000),
    url: `${SITE_URL}/p/${post.id}`,
    datePublished: post.created_at,
    ...(post.edited_at ? { dateModified: post.edited_at } : {}),
    author: { "@type": "Person", name: post.author?.username ?? "[deleted]", url: post.author ? `${SITE_URL}/u/${post.author.username}` : undefined },
    ...(images[0] ? { image: images[0] } : {}),
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: Math.max(0, post.score) },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: post.comment_count },
    ],
    ...(where ? { isPartOf: { "@type": "WebPage", name: where, url: `${SITE_URL}/n/${post.community!.name}` } } : {}),
  };

  return (
    <main className="page">
      <div>
        <article className="post">
          <div className="meta" style={{ alignItems: "center" }}>
            {post.community ? (
              <Link href={`/n/${post.community.name}`}><HubIcon hub={post.community} size={36} /></Link>
            ) : (
              <Avatar user={post.author} size={36} />
            )}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {post.community ? (
                  <Link href={`/n/${post.community.name}`} className="hub-name">n/{post.community.name}</Link>
                ) : (
                  <Link href={`/u/${post.author?.username ?? ""}`} className="hub-name">{post.author ? `u/${post.author.username}` : "[deleted]"}</Link>
                )}
                <span>{timeAgo(post.created_at)}</span>
                {post.edited_at && <span>edited</span>}
              </span>
              {post.community && (
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Link href={`/u/${post.author?.username ?? ""}`} className="author small">{post.author ? `u/${post.author.username}` : "[deleted]"}</Link>
                  {authorFlair && <span className="tag" style={{ background: authorFlair.color, color: "#fff" }}>{authorFlair.text}</span>}
                </span>
              )}
            </div>
            <span style={{ marginLeft: "auto" }}>
              <PostMenu
                postId={post.id}
                hubId={hub?.id ?? null}
                authorId={post.author?.id ?? null}
                myId={me?.id ?? null}
                saved={!!post.my_save?.length}
                followed={!!post.my_follow?.length}
                pinned={!!post.pinned_at}
                locked={post.locked}
                spoiler={post.spoiler}
                mature={post.mature}
                flairId={post.flair?.id ?? null}
                isStaff={access.isStaff}
                canRemove={access.canRemove}
                canCrosspost={!post.original && (hub?.allow_crossposts ?? true)}
              />
            </span>
          </div>
          <h1>{post.title}</h1>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {post.flair && <span className="flair" style={{ background: post.flair.color }}>{post.flair.label}</span>}
            {post.spoiler && <span className="tag spoiler">SPOILER</span>}
            {post.mature && <span className="tag nsfw">18+</span>}
            {post.locked && <span className="tag spoiler"><Icon icon={I.lock} size={10} /> Locked</span>}
          </div>
          <Covered spoiler={post.spoiler} mature={post.mature}>
            <Lightbox>
              {images.length === 1 && <div className="media"><img src={images[0]} alt="" /></div>}
              {images.length > 1 && <div className="gallery">{images.map(u => <img key={u} src={u} alt="" loading="lazy" />)}</div>}
              {yt && <YouTube id={yt} title={post.title} playInline />}
              {video && <VideoPlayer video={video} title={post.title} playInline />}
              {!onlyLink && shownBody && <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(shownBody) }} />}
            </Lightbox>
          </Covered>
          {post.original && (
            // A crosspost shows the post it shares.
            <Link href={`/p/${post.original.id}`} className="panel" style={{ display: "block", padding: 12, margin: "8px 0", background: "var(--surface-2)" }}>
              <span className="meta">
                {post.original.community ? <><HubIcon hub={post.original.community} size={20} /><b>n/{post.original.community.name}</b></> : <><Avatar user={post.original.author} size={20} /><b>u/{post.original.author?.username ?? "deleted"}</b></>}
                <span>{timeAgo(post.original.created_at)}</span>
              </span>
              <span className="card-title" style={{ fontSize: 17 }}>{post.original.title}</span>
              {(post.original.image_urls?.[0] ?? post.original.image_url) && <span className="media"><img src={post.original.image_urls?.[0] ?? post.original.image_url!} alt="" loading="lazy" /></span>}
              {post.original.body && <span className="card-body">{plainText(post.original.body, 240)}</span>}
            </Link>
          )}
          {firstLink && !post.spoiler && !post.mature && <LinkCard url={firstLink} blockedVideos={blockedVideos} />}
          {post.poll && post.poll.length > 0 && (
            <Poll postId={post.id} options={post.poll} mine={post.my_poll?.[0]?.option_id ?? null} signedIn={!!me} />
          )}
          <div className="actions">
            <Votes table="post_votes" id={post.id} score={post.score} mine={myVote(post.my_vote)} signedIn={!!me} />
            <span className="act"><Icon icon={I.comment} size={15} /> {post.comment_count}</span>
            <ShareButton id={post.id} />
          </div>
        </article>
        <Comments
          postId={post.id}
          initial={comments}
          signedIn={!!me}
          myId={me?.id ?? null}
          closed={closed}
          allowedDomains={allowed}
          canRemove={access.canRemove}
          blocked={blocked}
          userFlairs={userFlairs}
        />
      </div>
      <aside className="side">
        {post.community && (
          <section className="panel panel-pad">
            <Link href={`/n/${post.community.name}`} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <HubIcon hub={post.community} size={40} />
              <b>n/{post.community.name}</b>
            </Link>
            <Link href={`/n/${post.community.name}`} className="btn quiet block">Visit hub</Link>
          </section>
        )}
        <RecentPosts />
      </aside>
      <RecordVisit post={{
        id: post.id, title: post.title, created_at: post.created_at, score: post.score, comments: post.comment_count,
        image: post.spoiler || post.mature ? null : images[0] ?? firstBodyImage(post.body) ?? (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null),
        hub: post.community ? { name: post.community.name, color: post.community.color, icon_url: post.community.icon_url } : null,
        author: post.author?.username ?? null,
      }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
  );
}
