/** @type {import('next').NextConfig} */
const repoName = "momentum";
const isPages = process.env.GITHUB_PAGES === "true";
// The Vercel deployment that serves the Claude connector (app/api/mcp). The
// GitHub Pages build is a static export, which can't have it: that workflow
// removes app/api before building.
const isConnector = process.env.MOMENTUM_CONNECTOR === "1";

const nextConfig = isConnector
  ? {
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
