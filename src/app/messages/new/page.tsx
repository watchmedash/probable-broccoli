import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewChat } from "@/components/NewChat";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New chat", robots: { index: false } };

export default async function NewChatPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const to = (await searchParams).to ?? "";
  if (!(await currentUser())) redirect(`/login?next=${encodeURIComponent(`/messages/new${to ? `?to=${to}` : ""}`)}`);
  return <main><NewChat to={to} /></main>;
}
