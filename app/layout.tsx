import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

// GitHub Pages serves the app under /momentum/, Vercel serves it at the root.
const BASE = process.env.GITHUB_PAGES === "true" ? "/momentum" : "";

export const metadata: Metadata = {
  title: "Momentum — Progress Tracker",
  description: "Goals, recurring tasks and progress tracking.",
  applicationName: "Momentum",
  manifest: `${BASE}/manifest.json`,
  appleWebApp: {
    capable: true,
    title: "Momentum",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: `${BASE}/icons/favicon-32.png`, sizes: "32x32", type: "image/png" },
      { url: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: `${BASE}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* iOS home-screen app */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Momentum" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
