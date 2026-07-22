/** @type {import('next').NextConfig} */
const repoName = "momentum";
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: isPages ? `/${repoName}` : "",
  assetPrefix: isPages ? `/${repoName}/` : "",
};
export default nextConfig;
