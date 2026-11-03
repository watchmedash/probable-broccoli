import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

/** Google sends people back here. New accounts go on to pick a username; everyone else carries on. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const asked = url.searchParams.get("next") ?? "/";
  // Only same-site paths, so a crafted link can't send people elsewhere.
  const next = asked.startsWith("/") && !asked.startsWith("//") ? asked : "/";
  if (!code) return NextResponse.redirect(new URL("/login", url.origin));
  const sb = await serverSupabase();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?google=failed", url.origin));
  const { data: me } = await sb.from("profiles").select("needs_setup").eq("id", data.user.id).maybeSingle();
  return NextResponse.redirect(new URL(me?.needs_setup ? "/setup" : next, url.origin));
}
