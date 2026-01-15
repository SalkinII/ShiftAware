import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // For Docker deployment
  eslint: {
    // Allow build to proceed with lint warnings for MVP
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow build to proceed with type errors for MVP (if needed)
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
