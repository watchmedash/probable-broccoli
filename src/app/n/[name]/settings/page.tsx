import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HubSettings } from "@/components/HubSettings";
import { HUB_SETTINGS_COLUMNS, hubAccess, hubTeam, isSiteAdmin } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";
import type { Hub } from "@/lib/types";

export const metadata: Metadata = { title: "Hub settings", robots: { index: false } };

export default async function HubSettingsPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ name }, sp] = await Promise.all([params, searchParams]);
  const me = await currentUser();
  if (!me) redirect(`/login?next=/n/${name}/settings`);
  const sb = await serverSupabase();
  const { data } = await sb.from("communities").select(HUB_SETTINGS_COLUMNS).ilike("name", decodeURIComponent(name).replace(/[\\%_]/g, m => "\\" + m)).limit(1);
  const hub = (data ?? [])[0] as unknown as Hub | undefined;
  if (!hub) notFound();
  const [admin, team] = await Promise.all([isSiteAdmin(sb, me.id), hubTeam(sb, hub.id)]);
  const access = hubAccess(hub, me.id, admin, team, true, false);
  if (!access.isStaff) redirect(`/n/${hub.name}`);
  return <main className="page single"><HubSettings hub={hub} access={access} admin={admin} initialTab={sp.tab} /></main>;
}
