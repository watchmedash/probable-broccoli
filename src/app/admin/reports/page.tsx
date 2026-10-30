import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Reports } from "@/components/HubSettings";
import { Icon, I } from "@/components/Icon";
import { isSiteAdmin } from "@/lib/queries";
import { currentUser, serverSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports", robots: { index: false } };

/** Every open report on Nakodu, for site admins. */
export default async function AdminReportsPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/admin/reports");
  if (!(await isSiteAdmin(await serverSupabase(), me.id))) redirect("/");
  return (
    <main className="page single">
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <Link href="/settings" className="icon-btn" aria-label="Back to settings"><Icon icon={I.back} size={16} /></Link>
          <h1 style={{ margin: 0, fontSize: 22 }}>Reports</h1>
        </div>
        <div className="panel-pad"><Reports hubId={null} /></div>
      </div>
    </main>
  );
}
