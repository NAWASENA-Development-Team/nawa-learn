import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this project. Without it Next walks up the tree
  // looking for a lockfile, finds `bun.lock` in the user's home directory, and
  // treats the home directory as the workspace root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
