import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Netlify handles the build via @netlify/plugin-nextjs */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
