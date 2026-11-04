import type { NextConfig } from "next";

// The captcha page (loaded by the Android app) stays plain HTML at its old address.
const STATIC_PAGES = ["captcha"];

const nextConfig: NextConfig = {
  async rewrites() {
    return STATIC_PAGES.map(p => ({ source: `/${p}`, destination: `/${p}.html` }));
  },
  // The app is on Google Play now; old APK links go there.
  async redirects() {
    return [{ source: "/download/:file*", destination: "https://play.google.com/store/apps/details?id=com.nakodu.app", permanent: false }];
  },
  async headers() {
    return [
      { source: "/img/hubs/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/img/food/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/.well-known/assetlinks.json", headers: [{ key: "Content-Type", value: "application/json" }] },
    ];
  },
  images: { unoptimized: true },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
