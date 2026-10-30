import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsPanel } from "@/components/SettingsPanel";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/settings");
  return <main className="page single"><SettingsPanel username={me.username} /></main>;
}
