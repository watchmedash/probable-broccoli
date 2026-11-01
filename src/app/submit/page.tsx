import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreatePost } from "@/components/CreatePost";
import { Crosspost } from "@/components/Crosspost";
import { fetchHubs, fetchPost, myHubIds } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create a post", robots: { index: false } };

export default async function SubmitPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await currentUser();
  const sp = await searchParams;
  const back = `/submit${sp.hub ? `?hub=${sp.hub}` : sp.share ? `?share=${sp.share}` : ""}`;
  if (!me) redirect(`/login?next=${encodeURIComponent(back)}`);
  const sb = await serverSupabase();
  const [hubs, mine] = await Promise.all([fetchHubs(sb), myHubIds(sb, me.id)]);

  if (sp.share) {
    const original = await fetchPost(sb, Number(sp.share), true);
    if (!original) redirect("/");
    // Crossposts can go to your hubs that take them.
    const targets = hubs.filter(h => mine.includes(h.id) && h.allow_crossposts !== false && h.id !== original.community_id);
    const where = original.community ? `n/${original.community.name}` : `u/${original.author?.username ?? "deleted"}`;
    return <main><Crosspost original={{ id: original.id, title: original.title, where }} hubs={targets} /></main>;
  }

  // The hubs you're in, plus the one you came from.
  const choices = hubs.filter(h => mine.includes(h.id) || h.name.toLowerCase() === sp.hub?.toLowerCase());
  const initial = choices.find(h => h.name.toLowerCase() === sp.hub?.toLowerCase())?.id ?? null;
  return <main><CreatePost hubs={choices} initialHub={initial} /></main>;
}
