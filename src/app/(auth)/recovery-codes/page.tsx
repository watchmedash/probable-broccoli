import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RecoveryCodes } from "@/components/Onboarding";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Recovery codes", robots: { index: false } };

export default async function RecoveryCodesPage() {
  if (!(await currentUser())) redirect("/login?next=/settings");
  return <main><Suspense><RecoveryCodes /></Suspense></main>;
}
