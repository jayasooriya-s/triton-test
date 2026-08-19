import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure output file tracing for monorepo compatibility
  outputFileTracingRoot: ".",
};

export default nextConfig;
