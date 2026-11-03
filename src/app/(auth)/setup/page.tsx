import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinishSignUp } from "@/components/AuthForms";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pick a username", robots: { index: false } };

export default async function SetupPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  const { data } = await (await serverSupabase()).from("profiles").select("needs_setup").eq("id", me.id).maybeSingle();
  if (!data?.needs_setup) redirect("/");
  return <main><FinishSignUp /></main>;
}
