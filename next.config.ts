import type { NextConfig } from "next";

// The captcha page (loaded by the Android app) stays plain HTML at its old address.
const STATIC_PAGES = ["captcha"];

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
