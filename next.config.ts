import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Configure output file tracing for monorepo/deployment compatibility
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
