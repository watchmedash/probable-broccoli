import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PickHubs } from "@/components/Onboarding";
import { fetchHubs } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pick some hubs", robots: { index: false } };

export default async function WelcomePage() {
  if (!(await currentUser())) redirect("/login");
  const hubs = await fetchHubs(await serverSupabase());
  // Private hubs need a request and 18+ hubs need the setting, so neither fits a one-tap start.
  const open = hubs.filter(h => h.privacy !== "private" && !h.is_mature).sort((a, b) => b.member_count - a.member_count);
  return <main><PickHubs hubs={open} /></main>;
}
