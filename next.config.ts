import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Netlify handles the build via @netlify/plugin-nextjs */
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
