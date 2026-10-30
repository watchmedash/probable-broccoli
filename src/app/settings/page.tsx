import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsPanel } from "@/components/SettingsPanel";
import { isSiteAdmin } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/settings");
  const admin = await isSiteAdmin(await serverSupabase(), me.id);
  return <main className="page single"><SettingsPanel username={me.username} admin={admin} /></main>;
}
