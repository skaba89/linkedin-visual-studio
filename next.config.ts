import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Render deployment: standalone output for Docker-like hosts */
  output: "standalone",
  typescript: {
    // TODO: Remove ignoreBuildErrors after all implicit-any errors are fixed
    // Currently 100+ implicit any errors exist in the codebase
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
