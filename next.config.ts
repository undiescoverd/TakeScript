import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this repo. Without it Next walks up the
  // directory tree looking for lockfiles and can settle on an unrelated one
  // (e.g. a stray package-lock.json in $HOME) as the file-tracing root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
