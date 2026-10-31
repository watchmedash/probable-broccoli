"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { browserSupabase } from "@/lib/supabase/client";

/** Opening the notifications counts as reading them: the badge goes and the highlights with it. */
export function MarkAllRead() {
  const router = useRouter();
  useEffect(() => {
    browserSupabase().from("notifications").update({ read: true }).eq("read", false).then(() => router.refresh());
  }, [router]);
  return null;
}
