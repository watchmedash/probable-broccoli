import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/Toast";
import { SITE_URL } from "@/lib/config";

// Roboto, the app's font, bundled with the site (variable weight, Latin).
const roboto = localFont({ src: "./fonts/Roboto.woff2", weight: "100 900", variable: "--font-roboto", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Nakodu: a calmer forum for communities", template: "%s | Nakodu" },
  description: "Join hubs about what you love, share posts, stories and photos, vote and chat. Sign up with just a username, no email.",
  applicationName: "Nakodu",
  openGraph: { siteName: "Nakodu", type: "website", images: [{ url: "/img/og.png", width: 1024, height: 500 }] },
  twitter: { card: "summary_large_image" },
  icons: { icon: [{ url: "/img/icon.svg", type: "image/svg+xml" }, { url: "/img/icon-192.png", sizes: "192x192" }], apple: "/img/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#FFFFFF" }, { media: "(prefers-color-scheme: dark)", color: "#151A21" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <ToastProvider>
          <div className="app-bar">
            <span>Nakodu is better in the app</span>
            <a href="/download/nakodu.apk">Get it for Android</a>
          </div>
          <Suspense>
            <Header />
          </Suspense>
          {children}
          <footer className="site">
            <span>Nakodu</span>
            <a href="/rules">Rules</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/child-safety">Child safety</a>
            <a href="/delete-account">Delete account</a>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
