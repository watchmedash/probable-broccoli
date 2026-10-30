import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreatePost } from "@/components/CreatePost";
import { fetchHubs, myHubIds } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create a post", robots: { index: false } };

export default async function SubmitPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await currentUser();
  const sp = await searchParams;
  if (!me) redirect(`/login?next=${encodeURIComponent(`/submit${sp.hub ? `?hub=${sp.hub}` : ""}`)}`);
  const sb = await serverSupabase();
  const [hubs, mine] = await Promise.all([fetchHubs(sb), myHubIds(sb, me.id)]);
  // The hubs you're in, plus the one you came from.
  const choices = hubs.filter(h => mine.includes(h.id) || h.name.toLowerCase() === sp.hub?.toLowerCase());
  const initial = choices.find(h => h.name.toLowerCase() === sp.hub?.toLowerCase())?.id ?? null;
  return <main><CreatePost hubs={choices} initialHub={initial} uid={me.id} /></main>;
}
