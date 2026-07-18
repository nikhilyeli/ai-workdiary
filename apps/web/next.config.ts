import type { NextConfig } from "next";

const isExport = process.env.NEXT_STANDALONE_EXPORT === "true";

const nextConfig: NextConfig = {
  // Better-sqlite3 is a native Node module – exclude from webpack bundling
  serverExternalPackages: ["better-sqlite3"],
  ...(isExport ? { output: "export" } : {}),
};

export default nextConfig;
