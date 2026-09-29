import type { Metadata, Viewport } from "next";
import "./carbon.scss";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorker } from "@/components/ServiceWorker";
import { AppShell } from "@/components/AppShell";

// GitHub Pages serves the app under /momentum/, Vercel serves it at the root.
const BASE = process.env.GITHUB_PAGES === "true" ? "/momentum" : "";
/**
 * Bumped whenever the icons change. Their file names stay the same, and iOS
 * and browsers remember an icon by its address, so a new one is only fetched
 * under a new address. Keep in step with public/manifest.json.
 */
const ICONS = "3";

export const metadata: Metadata = {
  title: "Momentum — Progress Tracker",
  description: "Goals, recurring tasks and progress tracking.",
  applicationName: "Momentum",
  manifest: `${BASE}/manifest.json?v=${ICONS}`,
  appleWebApp: {
    capable: true,
    title: "Momentum",
    statusBarStyle: "default",
  },
  icons: {
    // .ico first for the browser tab, then the transparent PNGs and the SVG
    // mark, which stays crisp on high-density displays.
    icon: [
      { url: `${BASE}/favicon.ico?v=${ICONS}`, sizes: "any" },
      { url: `${BASE}/icons/favicon-32.png?v=${ICONS}`, sizes: "32x32", type: "image/png" },
      { url: `${BASE}/icons/icon-192.png?v=${ICONS}`, sizes: "192x192", type: "image/png" },
      { url: `${BASE}/icons/icon-512.png?v=${ICONS}`, sizes: "512x512", type: "image/png" },
      { url: `${BASE}/logo.svg?v=${ICONS}`, type: "image/svg+xml" },
    ],
    shortcut: [{ url: `${BASE}/favicon.ico?v=${ICONS}` }],
    apple: [{ url: `${BASE}/icons/apple-touch-icon.png?v=${ICONS}`, sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The browser's own bars match the page ground in either appearance.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f1" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* No web fonts: the system face (SF Pro on Apple devices) is already
            on the device, reads best at small sizes and works offline. */}
        {/* iOS home-screen app */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Momentum" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <ServiceWorker base={BASE} />
      </body>
    </html>
  );
}
