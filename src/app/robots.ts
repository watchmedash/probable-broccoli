import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/settings", "/notifications", "/submit", "/recovery-codes", "/welcome", "/search"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
