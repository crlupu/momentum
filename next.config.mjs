/** @type {import('next').NextConfig} */
const repoName = "momentum";
const isPages = process.env.GITHUB_PAGES === "true";
// The Vercel deployment that serves the Claude connector (app/api/mcp). Its
// route file is named route.server.ts, which only this build reads as a route;
// everywhere else the app stays a static export.
const isConnector = process.env.MOMENTUM_CONNECTOR === "1";

const nextConfig = isConnector
  ? {
      pageExtensions: ["server.ts", "tsx", "ts", "jsx", "js"],
      images: { unoptimized: true },
      // The server packages stay out of the bundle and load from node_modules.
      serverExternalPackages: ["firebase-admin"],
    }
  : {
      output: "export",
      // Emit workouts/index.html rather than workouts.html, so a direct visit or a
      // refresh on /workouts resolves on any static host.
      trailingSlash: true,
      images: { unoptimized: true },
      basePath: isPages ? `/${repoName}` : "",
      assetPrefix: isPages ? `/${repoName}/` : "",
    };
export default nextConfig;
