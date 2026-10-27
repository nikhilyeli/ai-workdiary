import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // Better-sqlite3 is a native Node module – exclude from webpack bundling
  serverExternalPackages: ["better-sqlite3"],
  ...(isExport
    ? {
        output: "export",
        ...(basePath ? { basePath } : {}),
      }
    : {}),
};

export default nextConfig;
