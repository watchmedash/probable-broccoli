import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PickInterests } from "@/components/Onboarding";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pick your interests", robots: { index: false } };

export default async function WelcomePage() {
  if (!(await currentUser())) redirect("/login");
  return <main><PickInterests /></main>;
}
