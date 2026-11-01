import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditPost } from "@/components/EditPost";
import { fetchPost } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit post", robots: { index: false } };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const me = await currentUser();
  if (!me) redirect(`/login?next=/p/${id}/edit`);
  const sb = await serverSupabase();
  const post = Number.isSafeInteger(id) ? await fetchPost(sb, id, true) : null;
  if (!post) notFound();
  if (post.author?.id !== me.id) redirect(`/p/${id}`);
  const hub = post.community ? (await sb.from("communities").select("allow_images").eq("id", post.community.id).maybeSingle()).data : null;
  const pictures = post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : [];
  return <main><EditPost id={post.id} title={post.title} body={post.body} pictures={pictures} imagesAllowed={hub?.allow_images ?? true} /></main>;
}
