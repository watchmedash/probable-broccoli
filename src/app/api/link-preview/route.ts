import { NextResponse } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/config";

// Browsers can't call the preview function directly: it doesn't answer their cross-site checks.
export async function POST(request: Request) {
  const { url } = await request.json().catch(() => ({ url: null }));
  if (typeof url !== "string" || url.length > 2000) return NextResponse.json({ error: "bad url" }, { status: 400 });
  const res = await fetch(`${SUPABASE_URL}/functions/v1/link-preview`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ url }),
  });
  return NextResponse.json(await res.json().catch(() => null), { status: res.status });
}
