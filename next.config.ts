import type { NextConfig } from "next";

// The legal pages and the captcha page (loaded by the Android app) stay plain HTML at their old addresses.
const STATIC_PAGES = ["privacy", "terms", "rules", "child-safety", "delete-account", "captcha"];

const nextConfig: NextConfig = {
  async rewrites() {
    return STATIC_PAGES.map(p => ({ source: `/${p}`, destination: `/${p}.html` }));
  },
  async headers() {
    return [
      { source: "/.well-known/assetlinks.json", headers: [{ key: "Content-Type", value: "application/json" }] },
      { source: "/download/:file*", headers: [{ key: "Content-Type", value: "application/vnd.android.package-archive" }] },
    ];
  },
  images: { unoptimized: true },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
