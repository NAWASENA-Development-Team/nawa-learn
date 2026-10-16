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
    // Explicit allowlist. This used to be `hostname: '**'`, which turns the
    // Next image optimiser into an open image proxy: anyone can ask our server
    // to fetch and re-serve an arbitrary URL, and every student's profile photo
    // URL becomes a request our origin makes on a third party's behalf.
    //
    // The only remote image this app renders through `next/image` is a profile
    // photo, and those now live in our own Vercel Blob store. Module content is
    // rendered in an `<iframe>`/`<img>` and never goes through the optimiser.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
