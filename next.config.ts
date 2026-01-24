import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "./"),
  typescript: {
    // Ignore TypeScript errors during build in CI
    // (type checking is done separately via tsc)
    ignoreBuildErrors: process.env.CI === "true",
  },
};

export default nextConfig;
