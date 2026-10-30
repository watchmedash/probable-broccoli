import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MessageMods } from "@/components/MessageMods";
import { fetchHubByName } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Message the mods", robots: { index: false } };

export default async function MessageModsPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!(await currentUser())) redirect(`/login?next=/n/${name}/message-mods`);
  const hub = await fetchHubByName(await serverSupabase(), decodeURIComponent(name));
  if (!hub) notFound();
  return <main><MessageMods hubId={hub.id} hubName={hub.name} /></main>;
}
