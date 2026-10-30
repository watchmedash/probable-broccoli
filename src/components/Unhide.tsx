"use client";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";

export function Unhide({ id }: { id: number }) {
  const router = useRouter();
  return (
    <button className="linkish small" onClick={async () => { await browserSupabase().from("hidden_posts").delete().eq("post_id", id); router.refresh(); }}>
      Unhide
    </button>
  );
}
