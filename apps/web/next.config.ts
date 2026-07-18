import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Better-sqlite3 is a native Node module – exclude from webpack bundling
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
