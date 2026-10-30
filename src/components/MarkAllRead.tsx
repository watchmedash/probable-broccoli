"use client";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";

export function MarkAllRead() {
  const router = useRouter();
  return (
    <button
      className="linkish"
      onClick={async () => {
        await browserSupabase().from("notifications").update({ read: true }).eq("read", false);
        router.refresh();
      }}
    >
      Mark all read
    </button>
  );
}
