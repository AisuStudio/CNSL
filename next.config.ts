import type { NextConfig } from "next";

// GitHub Pages build: static export under the repo subpath. Enabled only when
// GHPAGES=true (set by the deploy workflow) so `next dev` and other hosts are
// unaffected. PAGES_BASE_PATH is "/<repo>" (the workflow derives it).
const isPages = process.env.GHPAGES === "true";
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = isPages
  ? {
      output: "export",
      basePath,
      assetPrefix: basePath || undefined,
      images: { unoptimized: true },
      trailingSlash: true,
    }
  : {};

export default nextConfig;
