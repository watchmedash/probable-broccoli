/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Avatar, HubIcon } from "@/components/Avatars";
import { Comments } from "@/components/Comments";
import { Icon, I } from "@/components/Icon";
import { Covered, YouTube } from "@/components/Media";
import { Poll } from "@/components/Poll";
import { PostMenu } from "@/components/PostMenu";
import { ShareButton, Votes } from "@/components/VoteBar";
import { SITE_URL } from "@/lib/config";
import { plainText, timeAgo } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { fetchComments, fetchPost } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";
import { myVote } from "@/lib/types";
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
    title: `${post.title} : ${where}`,
    description,
    alternates: { canonical: `/p/${post.id}` },
    robots: post.mature ? { index: false } : undefined,
    openGraph: { type: "article", title: post.title, description, url: `/p/${post.id}`, images: image && !post.spoiler && !post.mature ? [{ url: image }] : undefined },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { me, sb, post } = await load(Number((await params).id));
  if (!post) notFound();
  const [comments, siteDomains] = await Promise.all([
    fetchComments(sb, post.id, !!me),
    post.community ? Promise.resolve(null) : sb.from("site_link_domains").select("domain").then(r => (r.data ?? []).map((d: { domain: string }) => d.domain)),
  ]);
  // Comment links are clickable only for the sites the hub's mods (or, on profiles, the admins) allow.
  const allowed = post.community ? post.community.link_domains ?? [] : siteDomains ?? [];
  const images = post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : [];
  const yt = images.length === 0 ? firstYouTube(post.body) : null;
  // A post that is only a YouTube link shows the player instead of the bare link.
  const onlyLink = yt && post.body.trim().split(/\s+/).length === 1 && youTubeId(post.body.trim());
  const where = post.community ? `n/${post.community.name}` : null;
  const closed = post.locked || post.community?.status === "archived";

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
                <Link href={`/u/${post.author?.username ?? ""}`} className="author small">{post.author ? `u/${post.author.username}` : "[deleted]"}</Link>
              )}
            </div>
            <span style={{ marginLeft: "auto" }}>
              <PostMenu postId={post.id} authorId={post.author?.id ?? null} signedIn={!!me} myId={me?.id ?? null} />
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
            {images.length === 1 && <div className="media"><img src={images[0]} alt="" /></div>}
            {images.length > 1 && <div className="gallery">{images.map(u => <img key={u} src={u} alt="" loading="lazy" />)}</div>}
            {yt && <YouTube id={yt} title={post.title} playInline />}
            {!onlyLink && post.body && <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />}
          </Covered>
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
        />
      </div>
      <aside className="side">
        {post.community && (
          <section className="panel panel-pad">
            <Link href={`/n/${post.community.name}`} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <HubIcon hub={post.community} size={40} />
              <b>n/{post.community.name}</b>
            </Link>
            <Link href={`/n/${post.community.name}`} className="btn quiet block">See the hub</Link>
          </section>
        )}
      </aside>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
  );
}
