import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { Suspense } from "react";
import "./globals.css";
import { Header } from "@/components/Header";
import { LeftNav } from "@/components/LeftNav";
import { CollapseButton } from "@/components/NavParts";
import { ToastProvider } from "@/components/Toast";
import { ADSENSE_CLIENT, SITE_URL } from "@/lib/config";

// Roboto, the app's font, bundled with the site (variable weight, Latin).
const roboto = localFont({ src: "./fonts/Roboto.woff2", weight: "100 900", variable: "--font-roboto", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Nakodu: a calmer forum for communities", template: "%s | Nakodu" },
  description: "Join hubs about what you love, share posts, stories and photos, vote and chat. Sign up with just a username, no email.",
  applicationName: "Nakodu",
  other: { "google-adsense-account": ADSENSE_CLIENT },
  openGraph: { siteName: "Nakodu", type: "website", images: [{ url: "/img/og.png", width: 1024, height: 500 }] },
  twitter: { card: "summary_large_image" },
  icons: { icon: [{ url: "/img/icon.svg", type: "image/svg+xml" }, { url: "/img/icon-192.png", sizes: "192x192" }], apple: "/img/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Light unless you picked dark (the switch in the left column).
  const jar = await cookies();
  const theme = jar.get("theme")?.value === "dark" ? "dark" : "light";
  const collapsed = jar.get("nav")?.value === "collapsed";
  return (
    <html lang="en" className={roboto.variable} data-theme={theme}>
      <body>
        <ToastProvider>
          <div className="app-bar">
            <span>Nakodu is better in the app</span>
            <a href="/download/nakodu.apk">Get it for Android</a>
          </div>
          <Suspense>
            <Header />
          </Suspense>
          <div className={`shell ${collapsed ? "collapsed" : ""}`}>
            <Suspense>
              <LeftNav theme={theme} />
            </Suspense>
            <CollapseButton />
            <div className="shell-main">{children}</div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
