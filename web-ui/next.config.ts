import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['child_process', 'fs', 'path'],
};

export default nextConfig;
