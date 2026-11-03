"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/format";
import { renderPreview } from "@/lib/markdown";
import { guestOpens } from "@/lib/guestOpens";
import { firstBodyImage } from "@/lib/mdedit";
import type { Post } from "@/lib/types";
import { Avatar, HubIcon } from "./Avatars";
import { Covered } from "./Media";

/** The post a crosspost shares: where it came from, its title, its picture and its text. Stays covered if the original is a spoiler or 18+. */
export function OriginalCard({ original, spoiler = false, mature = false, signedIn = true }: { original: NonNullable<Post["original"]>; spoiler?: boolean; mature?: boolean; signedIn?: boolean }) {
  const router = useRouter();
  const picture = original.image_urls?.[0] ?? original.image_url ?? firstBodyImage(original.body);
  const text = original.body.trim() ? renderPreview(original.body, 400) : "";
  return (
    <Link href={`/p/${original.id}`} onClick={guestOpens(signedIn, router, `/p/${original.id}`)} className="panel" style={{ display: "block", padding: 12, margin: "8px 0", background: "var(--surface-2)" }}>
      <span className="meta">
        {original.community ? <><HubIcon hub={original.community} size={20} /><b>n/{original.community.name}</b></> : <><Avatar user={original.author} size={20} /><b>u/{original.author?.username ?? "deleted"}</b></>}
        <span>{timeAgo(original.created_at)}</span>
      </span>
      <span className="card-title" style={{ fontSize: 17 }}>{original.title}</span>
      {(picture || text) && (
        <Covered spoiler={spoiler || !!original.spoiler} mature={mature || !!original.mature}>
          {picture && <span className="media"><img src={picture} alt="" loading="lazy" /></span>}
          {text && !picture && <div className="card-body md card-md" dangerouslySetInnerHTML={{ __html: text }} />}
        </Covered>
      )}
    </Link>
  );
}
