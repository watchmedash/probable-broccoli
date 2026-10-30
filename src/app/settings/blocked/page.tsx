import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon, I } from "@/components/Icon";
import { BlockedList } from "@/components/MoreSettings";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Blocked people", robots: { index: false } };

export default async function BlockedPage() {
  if (!(await currentUser())) redirect("/login?next=/settings/blocked");
  return (
    <main className="page single">
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <Link href="/settings" className="icon-btn" aria-label="Back to settings"><Icon icon={I.back} size={16} /></Link>
          <h1 style={{ margin: 0, fontSize: 22 }}>Blocked people</h1>
        </div>
        <BlockedList />
      </div>
    </main>
  );
}
