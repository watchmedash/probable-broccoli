import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewChat } from "@/components/NewChat";
import { NewGroup } from "@/components/GroupChat";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New chat", robots: { index: false } };

export default async function NewChatPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const to = sp.to ?? "";
  if (!(await currentUser())) redirect(`/login?next=${encodeURIComponent(`/messages/new${to ? `?to=${to}` : ""}`)}`);
  return <main>{sp.group ? <NewGroup /> : <NewChat to={to} />}</main>;
}
