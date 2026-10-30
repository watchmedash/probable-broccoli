import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateHub } from "@/components/CreateHub";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create a hub", robots: { index: false } };

export default async function NewHubPage() {
  if (!(await currentUser())) redirect("/login?next=/hubs/new");
  return <main><CreateHub /></main>;
}
