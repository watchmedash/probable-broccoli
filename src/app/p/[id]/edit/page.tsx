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
  const post = Number.isSafeInteger(id) ? await fetchPost(await serverSupabase(), id, true) : null;
  if (!post) notFound();
  if (post.author?.id !== me.id) redirect(`/p/${id}`);
  return <main><EditPost id={post.id} title={post.title} body={post.body} image={post.image_url} gallery={(post.image_urls?.length ?? 0) > 1} /></main>;
}
