/** @type {import('next').NextConfig} */
const repoName = "momentum";
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  output: "export",
  // Emit workouts/index.html rather than workouts.html, so a direct visit or a
  // refresh on /workouts resolves on any static host.
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isPages ? `/${repoName}` : "",
  assetPrefix: isPages ? `/${repoName}/` : "",
};
export default nextConfig;
