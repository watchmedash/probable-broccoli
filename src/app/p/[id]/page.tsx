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
import { OriginalCard } from "@/components/OriginalCard";
import { RecentPosts, RecordVisit } from "@/components/RecentPosts";
import { PostMenu } from "@/components/PostMenu";
import { ShareButton, Votes } from "@/components/VoteBar";
import { SITE_URL } from "@/lib/config";
import { plainText, timeAgo } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { HubSidebar } from "@/components/HubSidebar";
import { blockedIds, fetchComments, fetchHubByName, fetchPost, hubAccess, hubNames, hubTeam, isSiteAdmin, linkVideo } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";
import { myVote } from "@/lib/types";
import { HeldNotice } from "@/components/HeldNotice";
import { firstBodyImage } from "@/lib/mdedit";
import { SHARE_HEIGHT, SHARE_WIDTH, sharePicture } from "@/lib/sharePicture";
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
  const description = plainText(post.body, 180) || `A post in ${where} on Nakodu.`;
  // Link previews (Facebook, X, chats) get the post's own picture, served from Nakodu at a fixed size
  // so they never show an empty box while someone else's host is slow or blocks them.
  const images = sharePicture(post)
    ? [{ url: `/p/${post.id}/picture`, width: SHARE_WIDTH, height: SHARE_HEIGHT, type: "image/jpeg" }]
    : [{ url: "/img/og.png", width: 1024, height: 500 }];
  return {
    title: { absolute: post.title },
    description,
    alternates: { canonical: `/p/${post.id}` },
    robots: post.mature ? { index: false } : undefined,
    openGraph: { type: "article", siteName: "Nakodu", title: post.title, description, url: `/p/${post.id}`, images },
    twitter: { card: "summary_large_image", title: post.title, description, images: images.map(i => i.url) },
  };
}

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { me, sb, post } = await load(Number((await params).id));
  // A shared comment link (?c=12) opens on that comment and its replies.
  const focus = Number((await searchParams).c) || null;
  if (!post) notFound();
  const hub = post.community;
  const [comments, siteDomains, admin, team, member, ban, blocked, flairRows, blockedVideos, hubs] = await Promise.all([
    fetchComments(sb, post.id, !!me),
    hub ? Promise.resolve(null) : sb.from("site_link_domains").select("domain").then(r => (r.data ?? []).map((d: { domain: string }) => d.domain)),
    isSiteAdmin(sb, me?.id),
    hub ? hubTeam(sb, hub.id) : Promise.resolve([]),
    hub && me ? sb.from("hub_members").select("hub_id").eq("hub_id", hub.id).eq("user_id", me.id).maybeSingle().then(r => !!r.data) : Promise.resolve(false),
    hub && me ? sb.from("hub_bans").select("hub_id").eq("hub_id", hub.id).eq("user_id", me.id).maybeSingle().then(r => !!r.data) : Promise.resolve(false),
    blockedIds(sb, me?.id),
    hub?.allow_user_flair ? sb.from("hub_user_flairs").select("user_id,text,color").eq("hub_id", hub.id).then(r => r.data ?? []) : Promise.resolve([]),
    sb.from("site_blocked_video_domains").select("domain").then(r => (r.data ?? []).map((d: { domain: string }) => d.domain)),
    hubNames(sb),
  ]);
  const fullHub = hub ? await fetchHubByName(sb, hub.name) : null;
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
  // Once a video plays in the post, its link doesn't need to show as well. Other links stay, with their card below.
  const pageVideo = firstLink && !post.spoiler && !post.mature && !isBlockedVideo(firstLink, blockedVideos) ? await linkVideo(firstLink) : null;
  const shownLink = video?.url && post.body.includes(video.url) ? video.url : yt ? [...post.body.matchAll(/https?:\/\/[^\s)\]]+/g)].map(m => m[0]).find(u => youTubeId(u)) ?? null : pageVideo && !isBlockedVideo(pageVideo, blockedVideos) ? firstLink : null;
  const shownBody = shownLink ? withoutBareLink(post.body, shownLink) : post.body;
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
          {post.held && <HeldNotice postId={post.id} canApprove={access.canRemove} />}
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
              {!onlyLink && shownBody && <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(shownBody, { hubs }) }} />}
            </Lightbox>
          </Covered>
          {post.original && <OriginalCard original={post.original} spoiler={post.spoiler} mature={post.mature} />}
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
          hubs={hubs}
          opId={post.author?.id ?? null}
          hubId={hub?.id ?? null}
          allowImages={hub ? hub.allow_comment_images !== false : true}
          focus={focus}
          canRemove={access.canRemove}
          blocked={blocked}
          userFlairs={userFlairs}
        />
      </div>
      <aside className="side">
        {fullHub && <HubSidebar hub={fullHub} me={me} joined={member} withHeader />}
        <RecentPosts />
      </aside>
      <RecordVisit post={{
        id: post.id, title: post.title, created_at: post.created_at, score: post.score, comments: post.comment_count,
        image: images[0] ?? firstBodyImage(post.body) ?? (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null) ?? post.original?.image_urls?.[0] ?? post.original?.image_url ?? (post.original ? firstBodyImage(post.original.body) : null),
        spoiler: post.spoiler || !!post.original?.spoiler, mature: post.mature || !!post.original?.mature,
        hub: post.community ? { name: post.community.name, color: post.community.color, icon_url: post.community.icon_url } : null,
        author: post.author?.username ?? null,
      }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
  );
}
