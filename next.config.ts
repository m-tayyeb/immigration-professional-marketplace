import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep local development assets separate from production build output.
  // Running `next build` while `next dev` is active otherwise invalidates the
  // dev server's CSS asset references because both default to `.next`.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
