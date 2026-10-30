import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL, SUPABASE_KEY, SUPABASE_URL } from "@/lib/config";

export const revalidate = 3600;

/** Every public hub and the latest posts, so search engines find the content, plus the legal pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // As a guest: only what anyone can read ends up here (private, members-only and 18+ hubs stay out).
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const [{ data: hubs }, { data: posts }] = await Promise.all([
    sb.from("communities").select("name,created_at").eq("is_mature", false),
    sb.from("posts").select("id,created_at,edited_at,mature").eq("mature", false).order("created_at", { ascending: false }).limit(5000),
  ]);
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/hubs`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...(hubs ?? []).map(h => ({ url: `${SITE_URL}/n/${h.name}`, lastModified: now, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...(posts ?? []).map(p => ({ url: `${SITE_URL}/p/${p.id}`, lastModified: new Date(p.edited_at ?? p.created_at), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...["rules", "privacy", "terms", "child-safety", "delete-account"].map(p => ({ url: `${SITE_URL}/${p}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
